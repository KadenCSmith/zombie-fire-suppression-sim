import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  CheckpointError, createRuntimeCheckpoint, restoreRuntimeCheckpoint,
  type CheckpointIdentity, type RuntimeState, type RuntimeCheckpoint,
} from '../../../src/physics-next/numerics/checkpoint';
import { AtomicState, TransactionError } from '../../../src/physics-next/numerics/transaction';
import {
  createTimestepState, planTimestep, settleTimestep,
} from '../../../src/physics-next/numerics/timestep';
import { IterationController } from '../../../src/physics-next/numerics/iteration';
import { BoundedDiagnostics, stepDiagnostic } from '../../../src/physics-next/numerics/diagnostics';

interface Owner { values: Float64Array; eventTimes: number[]; eventCursor: number; }
const identity: CheckpointIdentity = {
  sourceRevision: '4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3',
  contextFingerprint: 'toy-test-context-v1', ownerSchema: 'toy-owner-v1',
};
function state(): RuntimeState<Owner> {
  return {
    owner: { values: new Float64Array([0]), eventTimes: [0.75, 1.25, 2], eventCursor: 0 },
    timestep: createTimestepState({
      minimumStep: 0.125, initialStep: 1, maximumStep: 2, shrinkFactor: 0.5,
      growthFactor: 2, lowErrorRatio: 0.25, growthAfter: 2, maxRetries: 2,
    }),
    iterations: [],
    diagnostics: new BoundedDiagnostics({
      capacity: 3, maximumIds: 8, maximumTextLength: 80,
    }).snapshot(),
  };
}
function validate(owner: Readonly<Owner>): boolean {
  return owner.values instanceof Float64Array && owner.values.length === 1
    && Number.isSafeInteger(owner.eventCursor) && owner.eventCursor >= 0
    && owner.eventCursor <= owner.eventTimes.length
    && owner.eventTimes.every((t, i) => t >= 0 && (i === 0 || t > owner.eventTimes[i - 1]));
}
function controller() {
  return new IterationController({
    label: 'toy-decision', maxEvaluations: 1, stagnation: null, divergence: null,
    relaxation: { initial: 1, minimum: 1, maximum: 1, decreaseFactor: 0.5,
      increaseFactor: 1, goodReductionRatio: 0.5, growthPatience: 1 },
  });
}
function advance(store: AtomicState<RuntimeState<Owner>>, errorRatio: number): void {
  store.run(draft => {
    while (draft.owner.eventCursor < draft.owner.eventTimes.length
        && draft.owner.eventTimes[draft.owner.eventCursor] === draft.timestep.time) {
      draft.owner.eventCursor++;
    }
    const boundary = draft.owner.eventTimes[draft.owner.eventCursor] ?? null;
    const pending = planTimestep(draft.timestep, boundary);
    assert.equal(pending.status, 'trial');
    const decision = settleTimestep(pending, pending.attempts,
      { kind: 'evaluated', errorRatio, guards: [] });
    assert.ok(decision.record.decision === 'accepted' || decision.record.decision === 'retry',
      JSON.stringify(decision.record));
    // A toy accepted accumulator, not a physical equation/solver.
    if (decision.record.decision === 'accepted') draft.owner.values[0] += pending.pending!.step;
    draft.timestep = decision.state;
    const nonlinear = controller();
    nonlinear.observe([{ id: 'toy', units: '1', residual: [errorRatio], norm: 'linf',
      scale: 1, absoluteTolerance: 1, relativeTolerance: 0, referenceScale: 0,
      combination: 'max', boundary: 'inclusive' }]);
    draft.iterations = [{ id: 'outer', state: nonlinear.snapshot() }];
    const diagnostics = BoundedDiagnostics.restore(draft.diagnostics!);
    diagnostics.add(stepDiagnostic(decision.record));
    draft.diagnostics = diagnostics.snapshot();
    return { decision: 'commit', value: null };
  });
}

it('empty quiescent runtime round trips without changing data or transaction counters', () => {
  const store = new AtomicState(state()), cp = createRuntimeCheckpoint(store, identity);
  const restored = restoreRuntimeCheckpoint<Owner>(cp, identity, validate);
  assert.deepEqual(restored.snapshot(), store.snapshot());
});
it('runtime restart at every split reproduces retries, growth, event cursor and diagnostics', () => {
  const errors = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0.5, 0, 0];
  const reference = new AtomicState(state());
  for (const error of errors) advance(reference, error);
  for (let split = 0; split <= errors.length; split++) {
    const a = new AtomicState(state());
    for (let i = 0; i < split; i++) advance(a, errors[i]);
    const cp = createRuntimeCheckpoint(a, identity);
    const b = restoreRuntimeCheckpoint<Owner>(structuredClone(cp), identity, validate);
    for (let i = split; i < errors.length; i++) {
      advance(a, errors[i]); advance(b, errors[i]);
      assert.deepEqual(a.snapshot(), b.snapshot());
    }
    assert.deepEqual(b.snapshot(), reference.snapshot());
    assert.equal(b.read().owner.eventCursor, 3);
    assert.ok(b.read().diagnostics!.dropped > 0);
  }
});
it('identity comparison uses independently supplied intended configuration', () => {
  const cp = createRuntimeCheckpoint(new AtomicState(state()), identity);
  for (const changed of [
    { ...identity, sourceRevision: 'other' },
    { ...identity, contextFingerprint: 'other' },
    { ...identity, ownerSchema: 'other' },
  ]) assert.throws(() => restoreRuntimeCheckpoint(cp, changed, validate), CheckpointError);
});
it('schema and algorithm incompatibilities fail without implicit defaults', () => {
  const cp = createRuntimeCheckpoint(new AtomicState(state()), identity);
  assert.throws(() => restoreRuntimeCheckpoint({ ...cp, schemaVersion: 9 }, identity, validate), CheckpointError);
  assert.throws(() => restoreRuntimeCheckpoint({
    ...cp, algorithms: { ...cp.algorithms, timestep: 'other' },
  }, identity, validate), CheckpointError);
  assert.throws(() => restoreRuntimeCheckpoint({
    ...cp, transaction: { ...cp.transaction, committed: { ...cp.transaction.committed, iterations: undefined } },
  }, identity, validate));
});
it('explicit schema hook must return a complete current envelope before validation', () => {
  const cp = createRuntimeCheckpoint(new AtomicState(state()), identity);
  const wrapped = { schemaVersion: 0, current: cp };
  let calls = 0;
  const restored = restoreRuntimeCheckpoint<Owner>(wrapped, identity, validate, (old, target) => {
    calls++; assert.equal(target, 1);
    return (old as { current: RuntimeCheckpoint<Owner> }).current;
  });
  assert.equal(calls, 1);
  assert.deepEqual(restored.snapshot().committed, cp.transaction.committed);
  assert.throws(() => restoreRuntimeCheckpoint(wrapped, identity, validate,
    () => ({ schemaVersion: 1 })));
  assert.throws(() => restoreRuntimeCheckpoint(wrapped, identity, validate,
    () => ({ schemaVersion: 0 })), CheckpointError);
});
it('a physical trial, pending timestep and unresolved iteration each block runtime snapshots', () => {
  const a = new AtomicState(state()), trial = a.begin();
  assert.throws(() => createRuntimeCheckpoint(a, identity), TransactionError);
  a.rollback(trial);
  const pending = state(); pending.timestep = planTimestep(pending.timestep, null);
  assert.throws(() => createRuntimeCheckpoint(new AtomicState(pending), identity), CheckpointError);
  const active = new IterationController({
    ...controller().policy, maxEvaluations: 2,
  });
  active.observe([{ id: 'toy', units: '1', residual: [2], norm: 'linf', scale: 1,
    absoluteTolerance: 1, relativeTolerance: 0, referenceScale: 0,
    combination: 'max', boundary: 'inclusive' }]);
  const unresolved = state(); unresolved.iterations = [{ id: 'outer', state: active.snapshot() }];
  assert.throws(() => createRuntimeCheckpoint(new AtomicState(unresolved), identity), CheckpointError);
});
it('prepared empty and terminal iteration snapshots can be included without losing histories', () => {
  const s = state();
  const ready = controller(), done = controller(); done.cancel();
  s.iterations = [{ id: 'ready', state: ready.snapshot() }, { id: 'done', state: done.snapshot() }];
  const cp = createRuntimeCheckpoint(new AtomicState(s), identity);
  assert.deepEqual(restoreRuntimeCheckpoint<Owner>(cp, identity, validate).read().iterations, s.iterations);
});
it('duplicated named controllers and corrupt scalar histories are rejected', () => {
  const s = state();
  s.iterations = [{ id: 'same', state: controller().snapshot() }, { id: 'same', state: controller().snapshot() }];
  assert.throws(() => createRuntimeCheckpoint(new AtomicState(s), identity), CheckpointError);
  const store = new AtomicState(state()); advance(store, 0);
  const cp = createRuntimeCheckpoint(store, identity);
  const altered = structuredClone(cp);
  (altered.transaction.committed.iterations[0].state.history[0] as unknown as {
    nextRelaxation: number;
  }).nextRelaxation = 0.25;
  assert.throws(() => restoreRuntimeCheckpoint(altered, identity, validate));
});
it('owner validation is mandatory, synchronous and does not mutate the restored owner', () => {
  const cp = createRuntimeCheckpoint(new AtomicState(state()), identity);
  assert.throws(() => restoreRuntimeCheckpoint(cp, identity, () => false), CheckpointError);
  assert.throws(() => restoreRuntimeCheckpoint<Owner>(cp, identity, owner => {
    owner.values[0] = 99; return true;
  }), CheckpointError);
  const asyncValidator = (() => Promise.resolve(true)) as unknown as (owner: Readonly<Owner>) => boolean;
  assert.throws(() => restoreRuntimeCheckpoint(cp, identity, asyncValidator), CheckpointError);
  assert.equal(cp.transaction.committed.owner.values[0], 0);
});
it('checkpoint and restore never retain external mutable typed-array aliases', () => {
  const a = new AtomicState(state());
  const cp = createRuntimeCheckpoint(a, identity);
  const b = restoreRuntimeCheckpoint<Owner>(cp, identity, validate);
  cp.transaction.committed.owner.values[0] = 42;
  assert.equal(a.read().owner.values[0], 0);
  assert.equal(b.read().owner.values[0], 0);
});
it('nonfinite owner values, extra envelope fields and invalid counters are rejected', () => {
  const cp = createRuntimeCheckpoint(new AtomicState(state()), identity);
  const raw = structuredClone(cp); raw.transaction.committed.owner.values[0] = NaN;
  assert.throws(() => restoreRuntimeCheckpoint(raw, identity, validate));
  assert.throws(() => restoreRuntimeCheckpoint({ ...cp, unknown: true }, identity, validate), CheckpointError);
  assert.throws(() => restoreRuntimeCheckpoint({
    ...cp, transaction: { ...cp.transaction, version: 1, trialSerial: 0 },
  }, identity, validate));
});
it('owner-internal alias topology and bytes survive the data-only checkpoint', () => {
  const values = new Float64Array([1]);
  const s: RuntimeState<{ a: Float64Array; b: Float64Array }> = {
    ...state(), owner: { a: values, b: values },
  };
  const cp = createRuntimeCheckpoint(new AtomicState(s), identity);
  const restored = restoreRuntimeCheckpoint<typeof s.owner>(cp, identity, o => o.a === o.b);
  const owner = restored.read().owner;
  assert.equal(owner.a, owner.b); assert.notEqual(owner.a, values);
  assert.equal(owner.a[0], 1);
});
it('cross-subsystem mutable sharing is rejected rather than silently broken', () => {
  const s = state();
  const shared: RuntimeState<{ sharedPolicy: typeof s.timestep.policy }> = {
    ...s, owner: { sharedPolicy: s.timestep.policy },
  };
  assert.throws(() => createRuntimeCheckpoint(new AtomicState(shared), identity), CheckpointError);
});
it('metadata key ordering is not treated as a different checkpoint schema', () => {
  const cp = createRuntimeCheckpoint(new AtomicState(state()), identity);
  const reordered = { transaction: cp.transaction, algorithms: cp.algorithms,
    identity: cp.identity, schemaVersion: cp.schemaVersion };
  assert.deepEqual(restoreRuntimeCheckpoint<Owner>(reordered, identity, validate).snapshot(), cp.transaction);
});
