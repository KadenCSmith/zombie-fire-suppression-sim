import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  BoundedDiagnostics, DiagnosticError, stepDiagnostic, iterationDiagnostic,
  type DiagnosticInput, type DiagnosticPolicy,
} from '../../../src/physics-next/numerics/diagnostics';
import { IterationController } from '../../../src/physics-next/numerics/iteration';
import {
  createTimestepState, planTimestep, settleTimestep,
} from '../../../src/physics-next/numerics/timestep';

function policy(overrides: Partial<DiagnosticPolicy> = {}): DiagnosticPolicy {
  return { capacity: 3, maximumIds: 2, maximumTextLength: 32, ...overrides };
}
function event(i = 0, overrides: Partial<DiagnosticInput> = {}): DiagnosticInput {
  return { category: 'contract', reason: 'CONTRACT_ERROR', cause: null,
    timeBefore: i, timeAfter: i, attempt: null, evaluation: null, step: null, metric: null,
    ids: [], detail: '', ...overrides };
}
it('diagnostics retain the newest bounded suffix with explicit dropped count', () => {
  const log = new BoundedDiagnostics(policy());
  for (let i = 0; i < 20; i++) log.add(event(i));
  assert.equal(log.size, 3); assert.equal(log.totalAdded, 20); assert.equal(log.dropped, 17);
  assert.deepEqual(log.records().map(x => x.sequence), [18, 19, 20]);
  assert.deepEqual(log.records().map(x => x.timeAfter), [17, 18, 19]);
});
it('capacity one and an empty restored history retain deterministic sequencing', () => {
  const empty = new BoundedDiagnostics(policy({ capacity: 1 }));
  assert.deepEqual(BoundedDiagnostics.restore(empty.snapshot()).snapshot(), empty.snapshot());
  empty.add(event(0)); empty.add(event(1));
  assert.equal(empty.records()[0].sequence, 2); assert.equal(empty.dropped, 1);
});
it('restoring a wrapped ring gives identical future snapshots and drop counts', () => {
  const a = new BoundedDiagnostics(policy());
  for (let i = 0; i < 5; i++) a.add(event(i));
  const b = BoundedDiagnostics.restore(structuredClone(a.snapshot()));
  for (let i = 5; i < 12; i++) {
    assert.deepEqual(a.add(event(i)), b.add(event(i)));
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
it('invalid/oversize input fails without changing history or sequence', () => {
  const log = new BoundedDiagnostics(policy()); log.add(event());
  const before = log.snapshot();
  const edits: Partial<DiagnosticInput>[] = [
    { metric: NaN }, { metric: Infinity }, { attempt: 1.5 }, { step: 0 },
    { ids: ['a', 'b', 'c'] }, { ids: ['same', 'same'] },
    { detail: 'x'.repeat(33) }, { ids: ['x'.repeat(33)] },
    { timeBefore: 2, timeAfter: 1 },
    { category: 'checkpoint', reason: 'CONTRACT_ERROR' },
  ];
  for (const edit of edits) {
    assert.throws(() => log.add(event(0, edit)), DiagnosticError);
    assert.deepEqual(log.snapshot(), before);
  }
});
it('input IDs, returned records and snapshots do not alias mutable caller arrays', () => {
  const log = new BoundedDiagnostics(policy()), ids = ['force'];
  const record = log.add(event(0, { ids }));
  ids[0] = 'mutated';
  assert.deepEqual(record.ids, ['force']);
  assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.ids));
  const snapshot = log.snapshot();
  log.add(event(1));
  assert.equal(snapshot.records.length, 1);
});
it('snapshot tampering with schema, counters, record order, or nonfinite data is rejected', () => {
  const log = new BoundedDiagnostics(policy()); log.add(event(0)); log.add(event(1));
  const s = log.snapshot();
  for (const bad of [
    { ...s, schemaVersion: 2 }, { ...s, totalAdded: 4 }, { ...s, dropped: 1 },
    { ...s, records: [...s.records].reverse() },
    { ...s, records: [{ ...s.records[0], metric: NaN }, s.records[1]] },
  ]) assert.throws(() => BoundedDiagnostics.restore(bad as typeof s));
});
it('diagnostic policies must bound both record count and per-record content', () => {
  for (const change of [{ capacity: 0 }, { capacity: 1.5 }, { capacity: Infinity },
    { maximumIds: -1 }, { maximumTextLength: 0 }, { maximumTextLength: Infinity }]) {
    assert.throws(() => new BoundedDiagnostics(policy(change)), DiagnosticError);
  }
});
it('step diagnostics preserve acceptance/rejection reason, cause and exact interval', () => {
  const clock = createTimestepState({
    minimumStep: 0.125, initialStep: 1, maximumStep: 2, shrinkFactor: 0.5,
    growthFactor: 2, lowErrorRatio: 0.25, growthAfter: 2, maxRetries: 1,
  });
  const pending = planTimestep(clock, null), log = new BoundedDiagnostics(policy());
  const bad = settleTimestep(pending, pending.attempts,
    { kind: 'evaluated', errorRatio: 2, guards: [] });
  const record = log.add(stepDiagnostic(bad.record));
  assert.equal(record.reason, 'RETRY'); assert.equal(record.cause, 'ERROR_EXCEEDED');
  assert.equal(record.timeBefore, record.timeAfter);
  const next = planTimestep(bad.state, null);
  const good = settleTimestep(next, next.attempts,
    { kind: 'evaluated', errorRatio: 0, guards: [] });
  const accepted = log.add(stepDiagnostic(good.record));
  assert.equal(accepted.reason, 'ACCEPTED');
  assert.equal(accepted.step, accepted.timeAfter! - accepted.timeBefore!);
});
it('an accepted label cannot hide a missing interval or unaccepted time advance', () => {
  const log = new BoundedDiagnostics(policy());
  assert.throws(() => log.add(event(0, { category: 'timestep', reason: 'ACCEPTED', cause: 'NONE' })),
    DiagnosticError);
  assert.throws(() => log.add(event(0, {
    category: 'timestep', reason: 'RETRY', cause: 'ERROR_EXCEEDED', timeAfter: 1,
  })), DiagnosticError);
});
it('iteration summaries do not invent a combined metric or label numerical success as accuracy', () => {
  const c = new IterationController({
    label: 'example', maxEvaluations: 2, stagnation: null, divergence: null,
    relaxation: { initial: 1, minimum: 1, maximum: 1, decreaseFactor: 0.5,
      increaseFactor: 1, goodReductionRatio: 0.5, growthPatience: 1 },
  });
  const record = c.observe([{ id: 'group', units: '1', residual: [0], norm: 'linf',
    scale: 1, absoluteTolerance: 1, relativeTolerance: 0, referenceScale: 0,
    combination: 'max', boundary: 'inclusive' }]);
  const entry = new BoundedDiagnostics(policy()).add(iterationDiagnostic(record, 0, 1));
  assert.equal(entry.reason, 'CRITERIA_SATISFIED');
  assert.equal(entry.metric, null);
  assert.deepEqual(entry.ids, []);
});
