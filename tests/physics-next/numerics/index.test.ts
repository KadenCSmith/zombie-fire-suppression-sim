import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import * as numerics from '../../../src/physics-next/numerics';

function runtime(): numerics.RuntimeState<{ values: Float64Array; acceptedHistory: number[] }> {
  return {
    owner: { values: new Float64Array([1]), acceptedHistory: [] },
    timestep: numerics.createTimestepState({
      minimumStep: 0.125, initialStep: 1, maximumStep: 2, shrinkFactor: 0.5,
      growthFactor: 2, lowErrorRatio: 0.25, growthAfter: 2, maxRetries: 2,
    }),
    iterations: [],
    diagnostics: new numerics.BoundedDiagnostics({
      capacity: 4, maximumIds: 8, maximumTextLength: 80,
    }).snapshot(),
  };
}
it('barrel exports every public runtime value without name collisions', () => {
  const expected = [
    'NORM_REDUCTION_VERSION', 'scaledNorm', 'evaluateResidualGroups',
    'ITERATION_ALGORITHM_VERSION', 'IterationContractError', 'IterationController',
    'TIMESTEP_ALGORITHM_VERSION', 'TimestepContractError', 'createTimestepState',
    'restoreTimestepState', 'planTimestep', 'settleTimestep',
    'TRANSACTION_SCHEMA_VERSION', 'StateOwnershipError', 'TransactionError',
    'cloneOwnedState', 'AtomicState',
    'DIAGNOSTICS_SCHEMA_VERSION', 'DIAGNOSTICS_ALGORITHM_VERSION', 'DiagnosticError',
    'BoundedDiagnostics', 'stepDiagnostic', 'iterationDiagnostic',
    'RUNTIME_CHECKPOINT_SCHEMA_VERSION', 'CheckpointError',
    'createRuntimeCheckpoint', 'restoreRuntimeCheckpoint',
  ];
  assert.deepEqual(Object.keys(numerics).sort(), expected.sort());
});
it('rejected physical trial can persist retry control without publishing trial arrays/history', () => {
  const store = new numerics.AtomicState(runtime());
  const trial = store.begin();
  const planned = numerics.planTimestep(trial.state.timestep, null);
  trial.state.owner.values[0] = 999;
  trial.state.owner.acceptedHistory.push(999);
  const rejection = numerics.settleTimestep(planned, planned.attempts, {
    kind: 'evaluated', errorRatio: 2, guards: [],
  });
  const baseVersion = trial.baseVersion;
  store.rollback(trial);
  assert.equal(store.version, baseVersion);
  // This second transaction starts from the original physical state; no rejected
  // trial fields are copied back. A real coordinator must also guard generation.
  store.run(draft => {
    draft.timestep = rejection.state;
    const diagnostics = numerics.BoundedDiagnostics.restore(draft.diagnostics!);
    diagnostics.add(numerics.stepDiagnostic(rejection.record));
    draft.diagnostics = diagnostics.snapshot();
    return { decision: 'commit', value: null };
  });
  assert.equal(store.read().owner.values[0], 1);
  assert.deepEqual(store.read().owner.acceptedHistory, []);
  assert.equal(store.read().timestep.time, 0);
  assert.equal(store.read().timestep.retries, 1);
  assert.equal(store.read().diagnostics!.records[0].reason, 'RETRY');
  const identity = { sourceRevision: 'fixture', contextFingerprint: 'fixture', ownerSchema: 'fixture' };
  const cp = numerics.createRuntimeCheckpoint(store, identity);
  const restored = numerics.restoreRuntimeCheckpoint<typeof cp.transaction.committed.owner>(
    cp, identity, owner => owner.values instanceof Float64Array && owner.values.length === 1,
  );
  restored.run(draft => {
    const next = numerics.planTimestep(draft.timestep, null);
    const acceptance = numerics.settleTimestep(next, next.attempts,
      { kind: 'evaluated', errorRatio: 0, guards: [] });
    draft.owner.values[0] = 2;
    draft.owner.acceptedHistory.push(acceptance.state.time);
    draft.timestep = acceptance.state;
    return { decision: 'commit', value: null };
  });
  assert.equal(restored.read().timestep.time, 0.5);
  assert.equal(restored.read().owner.values[0], 2);
  assert.deepEqual(restored.read().owner.acceptedHistory, [0.5]);
});
it('cancellation after provisional acceptance discards its clock and physical candidate', () => {
  const store = new numerics.AtomicState(runtime()), trial = store.begin();
  const planned = numerics.planTimestep(trial.state.timestep, null);
  trial.state.owner.values[0] = 22;
  const provisional = numerics.settleTimestep(planned, planned.attempts,
    { kind: 'evaluated', errorRatio: 0, guards: [] });
  assert.equal(provisional.state.time, 1);
  // A final cancellation check uses the original pending plan, NOT the already
  // accepted candidate controller. No acceptance has been published.
  const cancelled = numerics.settleTimestep(planned, planned.attempts, { kind: 'cancelled' });
  store.rollback(trial);
  store.run(draft => {
    draft.timestep = cancelled.state;
    const diagnostics = numerics.BoundedDiagnostics.restore(draft.diagnostics!);
    diagnostics.add(numerics.stepDiagnostic(cancelled.record));
    draft.diagnostics = diagnostics.snapshot();
    return { decision: 'commit', value: null };
  });
  assert.equal(store.read().owner.values[0], 1);
  assert.equal(store.read().timestep.time, 0);
  assert.equal(store.read().timestep.acceptedSteps, 0);
  assert.equal(store.read().timestep.stopReason, 'CANCELLED');
  assert.equal(store.read().diagnostics!.records[0].reason, 'CANCELLED');
});
