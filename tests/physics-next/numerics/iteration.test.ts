import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  IterationController, IterationContractError, type IterationPolicy,
} from '../../../src/physics-next/numerics/iteration';
import { type ResidualGroup } from '../../../src/physics-next/numerics/norms';

function policy(overrides: Partial<IterationPolicy> = {}): IterationPolicy {
  return {
    label: 'test-policy', maxEvaluations: 20, stagnation: null, divergence: null,
    relaxation: { minimum: 0.125, initial: 0.5, maximum: 1,
      decreaseFactor: 0.5, increaseFactor: 2, goodReductionRatio: 0.6, growthPatience: 2 },
    ...overrides,
  };
}
function group(value: number, overrides: Partial<ResidualGroup> = {}): ResidualGroup {
  return { id: 'force', units: 'N', residual: [value], norm: 'linf', scale: 1,
    absoluteTolerance: 1, relativeTolerance: 0, referenceScale: 0,
    combination: 'max', boundary: 'inclusive', ...overrides };
}
function finite(value: unknown): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(finite);
}

it('criteria satisfaction includes initial and final permitted observations', () => {
  const a = new IterationController(policy({ maxEvaluations: 1 }));
  assert.equal(a.observe([group(1)]).reason, 'CRITERIA_SATISFIED');
  const b = new IterationController(policy({ maxEvaluations: 2 }));
  b.observe([group(4)]);
  assert.equal(b.observe([group(1)]).reason, 'CRITERIA_SATISFIED');
});
it('evaluation limit is terminal and does not grow history on misuse', () => {
  const c = new IterationController(policy({ maxEvaluations: 1 }));
  assert.equal(c.observe([group(2)]).reason, 'EVALUATION_LIMIT');
  const snapshot = c.snapshot();
  assert.throws(() => c.observe([group(0)]), IterationContractError);
  assert.deepEqual(c.snapshot(), snapshot);
});
it('every group must pass, irrespective of another group becoming zero', () => {
  const c = new IterationController(policy());
  assert.equal(c.observe([group(0), group(2, { id: 'pressure', units: 'Pa' })]).decision, 'continue');
});
for (const v of [NaN, Infinity, -Infinity]) {
  it(`nonfinite input ${String(v)} fails closed with finite history`, () => {
    const c = new IterationController(policy());
    assert.equal(c.observe([group(v)]).reason, 'INVALID_RESIDUAL');
    finite(c.snapshot());
  });
}
it('invalid array input and duplicate groups cannot satisfy the controller', () => {
  const a = new IterationController(policy());
  assert.equal(a.observe([]).reason, 'INVALID_RESIDUAL');
  const b = new IterationController(policy());
  assert.equal(b.observe([group(0), group(0)]).reason, 'INVALID_RESIDUAL');
});
it('all identity and tolerance-policy fields are locked after first observation', () => {
  const changes: Partial<ResidualGroup>[] = [
    { id: 'changed' }, { units: 'Pa' }, { norm: 'l2' }, { scale: 2 },
    { absoluteTolerance: 20 }, { relativeTolerance: 1 }, { referenceScale: 1 },
    { combination: 'sum' }, { boundary: 'exclusive' }, { residual: [2, 3] },
  ];
  for (const change of changes) {
    const c = new IterationController(policy());
    c.observe([group(4)]);
    const record = c.observe([group(2, change)]);
    assert.equal(record.reason, 'GROUP_POLICY_CHANGED');
    assert.equal(record.policyMismatchIndex, 0);
  }
});
it('added, removed, and reordered groups fail even when they would pass', () => {
  const a = new IterationController(policy()); a.observe([group(4)]);
  assert.equal(a.observe([group(0), group(0, { id: 'b' })]).reason, 'GROUP_POLICY_CHANGED');
  for (const groups of [[group(0)], [group(0, { id: 'b' }), group(0)]]) {
    const b = new IterationController(policy());
    b.observe([group(4), group(4, { id: 'b' })]);
    assert.equal(b.observe(groups).reason, 'GROUP_POLICY_CHANGED');
  }
});
it('stagnation window counts transitions and uses the best history', () => {
  const c = new IterationController(policy({
    stagnation: { window: 2, minimumRelativeImprovement: 0.1 },
  }));
  assert.equal(c.observe([group(10)]).reason, 'CONTINUE');
  assert.equal(c.observe([group(9.5)]).reason, 'CONTINUE');
  const r = c.observe([group(9.4)]);
  assert.equal(r.reason, 'STAGNATION');
  assert.deepEqual(r.stagnantGroupIds, ['force']);
});
it('a stagnant component cannot be hidden by another improving group', () => {
  const c = new IterationController(policy({
    stagnation: { window: 1, minimumRelativeImprovement: 0.1 },
  }));
  c.observe([group(100), group(5, { id: 'other' })]);
  assert.equal(c.observe([group(10), group(5, { id: 'other' })]).reason, 'STAGNATION');
});
it('divergence is strict, consecutive, and measured against prior best', () => {
  const c = new IterationController(policy({ divergence: { factor: 2, patience: 2 } }));
  c.observe([group(10)]); c.observe([group(20)]);
  assert.equal(c.current?.progress[0].divergenceStreak, 0);
  c.observe([group(21)]); c.observe([group(19)]);
  assert.equal(c.current?.progress[0].divergenceStreak, 0);
  c.observe([group(21)]);
  assert.equal(c.observe([group(22)]).reason, 'DIVERGENCE');
});
it('zero best and extreme finite ratios produce no infinity', () => {
  const c = new IterationController(policy({ divergence: { factor: 2, patience: 1 } }));
  c.observe([group(0), group(5, { id: 'other' })]);
  assert.equal(c.observe([group(2), group(5, { id: 'other' })]).reason, 'DIVERGENCE');
  const d = new IterationController(policy({ divergence: { factor: 2, patience: 1 } }));
  d.observe([group(Number.MIN_VALUE, { absoluteTolerance: 0 })]);
  assert.equal(d.observe([group(Number.MAX_VALUE, { absoluteTolerance: 0 })]).reason, 'DIVERGENCE');
  finite(c.snapshot()); finite(d.snapshot());
});
it('criterion satisfaction takes precedence over stagnation and iteration limit', () => {
  const c = new IterationController(policy({
    maxEvaluations: 2, stagnation: { window: 1, minimumRelativeImprovement: 1 },
  }));
  c.observe([group(1.1)]);
  assert.equal(c.observe([group(1)]).reason, 'CRITERIA_SATISFIED');
});
it('relaxation decreases, holds lower bound, and grows only after hysteresis', () => {
  const c = new IterationController(policy());
  c.observe([group(100)]); c.observe([group(100)]); c.observe([group(100)]);
  assert.equal(c.relaxation, 0.125);
  assert.equal(c.observe([group(100)]).relaxationReason, 'LOWER_BOUND');
  c.observe([group(50)]);
  assert.equal(c.relaxation, 0.125);
  c.observe([group(25)]);
  assert.equal(c.relaxation, 0.25);
});
it('relaxation is bounded for extreme policy factors and never applies a solver update', () => {
  const base = policy();
  const c = new IterationController(policy({
    relaxation: { ...base.relaxation, increaseFactor: Number.MAX_VALUE, growthPatience: 1 },
  }));
  const raw = new Float64Array([100]);
  c.observe([group(100, { residual: raw })]);
  c.observe([group(50)]);
  assert.equal(c.relaxation, 1);
  assert.equal(c.observe([group(25)]).relaxationReason, 'UPPER_BOUND');
  assert.equal(raw[0], 100);
  finite(c.snapshot());
});
it('cancellation is possible before/between observations, terminal and idempotent', () => {
  for (const observeFirst of [false, true]) {
    const c = new IterationController(policy());
    if (observeFirst) c.observe([group(2)]);
    const count = c.evaluations;
    const r = c.cancel();
    assert.equal(r.reason, 'CANCELLED');
    assert.equal(r.evaluation, count);
    assert.equal(c.cancel(), r);
    assert.throws(() => c.observe([group(0)]), IterationContractError);
    assert.equal(c.history().length, count + 1);
  }
});
it('cancellation after numerical satisfaction cannot rewrite prior outcome', () => {
  const c = new IterationController(policy());
  const r = c.observe([group(0)]);
  assert.equal(c.cancel(), r);
  assert.equal(c.history().length, 1);
});
it('snapshots, history, and policy own frozen data and never retain residual arrays', () => {
  const input = { ...policy(), relaxation: { ...policy().relaxation } };
  const c = new IterationController(input);
  input.relaxation.initial = 0.75;
  const raw = [4];
  c.observe([group(4, { residual: raw })]);
  raw[0] = NaN;
  const saved = c.snapshot();
  c.observe([group(2)]);
  assert.equal(saved.history.length, 1);
  assert.equal(saved.policy.relaxation.initial, 0.5);
  assert.ok(Object.isFrozen(saved.history[0].progress[0]));
  assert.throws(() => (saved.history as unknown[]).push({}), TypeError);
  finite(saved);
});
it('invalid policies fail before any controller state is created', () => {
  for (const maxEvaluations of [0, -1, 1.5, NaN, Infinity, 0xffffffff]) {
    assert.throws(() => new IterationController(policy({ maxEvaluations })), IterationContractError);
  }
  for (const relaxation of [
    { ...policy().relaxation, minimum: 0 },
    { ...policy().relaxation, initial: 2 },
    { ...policy().relaxation, decreaseFactor: 1 },
    { ...policy().relaxation, increaseFactor: NaN },
    { ...policy().relaxation, growthPatience: 0 },
  ]) assert.throws(() => new IterationController(policy({ relaxation })), IterationContractError);
});
it('same finite observations generate identical complete histories', () => {
  const a = new IterationController(policy()), b = new IterationController(policy());
  for (const x of [100, 80, 40, 20, 10, 5, 2, 1]) {
    assert.deepEqual(a.observe([group(x)]), b.observe([group(x)]));
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
});


it('replay restart at every split reproduces all future decisions and relaxation', () => {
  const values = [100, 100, 50, 25, 20, 10, 5, 2, 1];
  for (let split = 0; split <= values.length; split++) {
    const a = new IterationController(policy());
    for (let i = 0; i < split; i++) a.observe([group(values[i])]);
    const b = IterationController.restore(structuredClone(a.snapshot()));
    for (let i = split; i < values.length; i++) {
      assert.deepEqual(a.observe([group(values[i])]), b.observe([group(values[i])]));
    }
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
it('replay retains stagnation window, divergence streak, and terminal histories', () => {
  for (const config of [
    { p: policy({ stagnation: { window: 2, minimumRelativeImprovement: 0.1 } }),
      values: [10, 9.5, 9.4] },
    { p: policy({ divergence: { factor: 2, patience: 2 } }), values: [10, 21, 22] },
  ]) {
    const a = new IterationController(config.p);
    a.observe([group(config.values[0])]); a.observe([group(config.values[1])]);
    const b = IterationController.restore(a.snapshot());
    assert.deepEqual(a.observe([group(config.values[2])]), b.observe([group(config.values[2])]));
    assert.deepEqual(IterationController.restore(a.snapshot()).snapshot(), a.snapshot());
  }
  for (const kind of ['invalid', 'cancel', 'empty-cancel', 'limit']) {
    const a = new IterationController(policy({ maxEvaluations: kind === 'limit' ? 1 : 20 }));
    if (kind === 'invalid') a.observe([group(NaN)]);
    else if (kind === 'empty-cancel') a.cancel();
    else { a.observe([group(10)]); if (kind === 'cancel') a.cancel(); }
    assert.deepEqual(IterationController.restore(a.snapshot()).snapshot(), a.snapshot());
  }
});
it('replay rejects tampered derived decisions, norm budgets and controller variables', () => {
  const a = new IterationController(policy());
  a.observe([group(100)]); a.observe([group(50)]);
  const edits: ((x: { history: { growthStreak: number; nextRelaxation: number; progress: { bestValue: number }[]; criteria: { groups: { limit: number }[] }; reason: string }[]; policy: { relaxation: { initial: number } }; algorithmVersion: string }) => void)[] = [
    x => { x.history[1].growthStreak = 7; },
    x => { x.history[1].nextRelaxation = 0.9; },
    x => { x.history[0].progress[0].bestValue = 1; },
    x => { x.history[0].criteria.groups[0].limit = 1e20; },
    x => { x.history[0].reason = 'CRITERIA_SATISFIED'; },
    x => { x.policy.relaxation.initial = 0.75; },
    x => { x.algorithmVersion = 'unknown'; },
    x => { x.history.push(x.history[1]); },
  ];
  for (const edit of edits) {
    const data = structuredClone(a.snapshot());
    edit(data as unknown as { history: { growthStreak: number; nextRelaxation: number; progress: { bestValue: number }[]; criteria: { groups: { limit: number }[] }; reason: string }[]; policy: { relaxation: { initial: number } }; algorithmVersion: string });
    assert.throws(() => IterationController.restore(data));
  }
});
it('restored iteration owns its reports and rejects invalid snapshot values', () => {
  const a = new IterationController(policy()); a.observe([group(10)]);
  const raw = structuredClone(a.snapshot());
  const restored = IterationController.restore(raw);
  (raw.history[0] as unknown as { growthStreak: number }).growthStreak = 8;
  assert.equal(restored.current!.growthStreak, 0);
  const bad = { ...a.snapshot(), schemaVersion: 2 };
  assert.throws(() => IterationController.restore(bad as unknown as ReturnType<typeof a.snapshot>));
  assert.throws(() => IterationController.restore({
    ...a.snapshot(), policy: { ...policy(), maxEvaluations: NaN },
  }));
});
