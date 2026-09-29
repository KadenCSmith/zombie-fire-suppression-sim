import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  TimestepContractError, createTimestepState, planTimestep, restoreTimestepState, settleTimestep,
  type TimestepPolicy, type TimestepState, type TrialOutcome,
} from '../../../src/physics-next/numerics/timestep';

function policy(overrides: Partial<TimestepPolicy> = {}): TimestepPolicy {
  return { minimumStep: 0.125, initialStep: 1, maximumStep: 4, shrinkFactor: 0.5,
    growthFactor: 2, lowErrorRatio: 0.25, growthAfter: 2, maxRetries: 3, ...overrides };
}
function outcome(errorRatio = 0): TrialOutcome {
  return { kind: 'evaluated', errorRatio, guards: [] };
}
function trial(state = createTimestepState(policy()), boundary: number | null = null): TimestepState {
  const result = planTimestep(state, boundary);
  assert.equal(result.status, 'trial');
  return result;
}
function settle(s: TimestepState, o = outcome()) {
  return settleTimestep(s, s.pending!.attempt, o);
}
function finite(value: unknown): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach(finite);
}
it('planning never advances the clock and settling advances exactly once', () => {
  const initial = createTimestepState(policy());
  const t = trial(initial);
  assert.equal(t.time, 0); assert.equal(initial.attempts, 0);
  const accepted = settle(t);
  assert.equal(accepted.state.time, t.pending!.endTime);
  assert.equal(accepted.state.lastAcceptedStep, t.pending!.endTime - t.pending!.startTime);
  assert.equal(accepted.state.acceptedSteps, 1);
  assert.throws(() => settle(accepted.state), TypeError);
  assert.throws(() => settleTimestep(accepted.state, 1, outcome()), TimestepContractError);
});
it('a declined step leaves time unchanged and retries use a smaller step', () => {
  const a = trial();
  const b = settle(a, outcome(2));
  assert.equal(b.record.decision, 'retry');
  assert.equal(b.state.time, a.time);
  assert.equal(b.state.nextStep, 0.5);
  assert.equal(b.state.rejectedAttempts, 1);
  const c = trial(b.state);
  const d = settle(c);
  assert.equal(d.state.time, 0.5);
  assert.equal(d.state.retries, 0);
  assert.equal(d.state.growthStreak, 0);
});
it('error ratio equality passes, positive overshoot fails, and invalid ratios are terminal', () => {
  assert.equal(settle(trial(), outcome(1)).record.decision, 'accepted');
  assert.equal(settle(trial(), outcome(1 + Number.EPSILON)).record.cause, 'ERROR_EXCEEDED');
  for (const error of [NaN, Infinity, -Infinity, -1]) {
    const r = settle(trial(), outcome(error));
    assert.equal(r.record.reason, 'INVALID_OUTCOME');
    assert.equal(r.state.time, 0); finite(r);
  }
});
it('all guards are checked and fatal gates override retryable gates', () => {
  const r = settle(trial(), { kind: 'evaluated', errorRatio: 2, guards: [
    { id: 'first', passed: false, retryable: true },
    { id: 'fatal', passed: false, retryable: false },
  ] });
  assert.equal(r.record.reason, 'FATAL_GUARD');
  assert.deepEqual(r.record.failedGuardIds, ['first', 'fatal']);
  assert.equal(r.state.time, 0);
});
it('malformed/duplicate guards fail without echoing bad data', () => {
  for (const guards of [
    [{ id: '', passed: true, retryable: true }],
    [{ id: 'g', passed: true, retryable: true }, { id: 'g', passed: true, retryable: true }],
    [{ id: 'g', passed: NaN, retryable: true }],
  ]) {
    const r = settle(trial(), { kind: 'evaluated', errorRatio: 0, guards } as unknown as TrialOutcome);
    assert.equal(r.record.reason, 'INVALID_OUTCOME'); finite(r);
  }
});
it('guard rejection is retryable only when all failing guards explicitly allow it', () => {
  const r = settle(trial(), { kind: 'evaluated', errorRatio: 0, guards: [
    { id: 'guard', passed: false, retryable: true },
  ] });
  assert.equal(r.record.cause, 'GUARD_REJECTED');
  assert.equal(r.record.decision, 'retry');
});
it('retry budget counts additional attempts, and zero disables retries', () => {
  let s = trial(createTimestepState(policy({ maxRetries: 1 })));
  const first = settle(s, outcome(2));
  assert.equal(first.record.decision, 'retry');
  s = trial(first.state);
  const last = settle(s, outcome(2));
  assert.equal(last.record.reason, 'RETRY_LIMIT');
  assert.equal(last.record.cause, 'ERROR_EXCEEDED');
  assert.equal(last.state.rejectedAttempts, 2);
  assert.equal(last.state.time, 0);
  assert.equal(settle(trial(createTimestepState(policy({ maxRetries: 0 }))), outcome(2))
    .record.reason, 'RETRY_LIMIT');
});
it('retries may land on the minimum but cannot go below it', () => {
  let s = createTimestepState(policy({ initialStep: 0.1875 }));
  const r = settle(trial(s), outcome(2));
  assert.equal(r.state.nextStep, 0.125);
  s = trial(r.state);
  assert.equal(settle(s, outcome(2)).record.reason, 'MINIMUM_STEP');
});
it('event clipping includes exact equality and lands on the exact declared time', () => {
  for (const boundary of [0.25, 1]) {
    const t = trial(createTimestepState(policy()), boundary);
    assert.equal(t.pending!.clipped, true);
    assert.equal(t.pending!.endTime, boundary);
    assert.equal(settle(t).state.time, boundary);
  }
});
it('subminimum event steps can pass but cannot silently trigger smaller retries', () => {
  const t = trial(createTimestepState(policy()), 0.03125);
  assert.equal(t.pending!.belowMinimum, true);
  const good = settle(t);
  assert.equal(good.state.time, 0.03125);
  assert.equal(good.state.nextStep, 1);
  assert.equal(good.state.growthStreak, 0);
  assert.equal(settle(t, outcome(2)).record.reason, 'MINIMUM_STEP');
});
it('events at or behind the current time require caller consumption, not clock snapping', () => {
  const s = createTimestepState(policy(), 2);
  for (const boundary of [2, 1, NaN, Infinity, -Infinity]) {
    assert.throws(() => planTimestep(s, boundary), TimestepContractError);
  }
  assert.equal(s.time, 2);
});
it('boundary clipping never crosses the event and does not destroy the nominal step', () => {
  const s = settle(trial(createTimestepState(policy()), 0.75)).state;
  assert.equal(s.nextStep, 1);
  assert.equal(trial(s, 1.125).pending!.endTime, 1.125);
});
it('growth requires consecutive low-error unclipped unretried accepted steps', () => {
  let s = settle(trial()).state;
  assert.equal(s.nextStep, 1); assert.equal(s.growthStreak, 1);
  s = settle(trial(s), outcome(0.5)).state;
  assert.equal(s.growthStreak, 0);
  s = settle(trial(s)).state; s = settle(trial(s)).state;
  assert.equal(s.nextStep, 2);
  s = settle(trial(s)).state; s = settle(trial(s)).state;
  assert.equal(s.nextStep, 4);
  s = settle(trial(s)).state; s = settle(trial(s)).state;
  assert.equal(s.nextStep, 4);
});
it('growth factors cannot overflow the maximum bound', () => {
  const s = createTimestepState(policy({ growthAfter: 1, growthFactor: Number.MAX_VALUE }));
  assert.equal(settle(trial(s)).state.nextStep, 4);
});
it('cancellation is terminal, has no accepted/rejected evaluation, and preserves time', () => {
  const s = trial();
  const r = settle(s, { kind: 'cancelled' });
  assert.equal(r.record.decision, 'cancelled');
  assert.equal(r.state.time, 0);
  assert.equal(r.state.rejectedAttempts, 0);
  assert.equal(r.state.acceptedSteps, 0);
  assert.deepEqual(restoreTimestepState(r.state), r.state);
  assert.throws(() => planTimestep(r.state, null), TimestepContractError);
});
it('nested planning and stale attempt outcomes are rejected without changes', () => {
  const s = trial(), before = structuredClone(s);
  assert.throws(() => planTimestep(s, null), TimestepContractError);
  assert.throws(() => settleTimestep(s, s.attempts + 1, outcome()), TimestepContractError);
  assert.deepEqual(s, before);
});
it('unrepresentable clock advances and overflow stop rather than loop', () => {
  const tiny = planTimestep(createTimestepState(policy(), 2 ** 54), null);
  assert.equal(tiny.stopReason, 'TIME_NOT_REPRESENTABLE');
  assert.equal(tiny.time, 2 ** 54);
  const huge = createTimestepState(policy({ minimumStep: 1, initialStep: Number.MAX_VALUE,
    maximumStep: Number.MAX_VALUE }), Number.MAX_VALUE);
  assert.equal(planTimestep(huge, null).stopReason, 'TIME_RANGE');
});
it('binary64 endpoints do not exceed the requested cap', () => {
  const s = createTimestepState(policy({ minimumStep: 1e-6, initialStep: 0.1 }), 0.2);
  const t = trial(s);
  assert.ok(t.pending!.step <= 0.1);
  assert.equal(settle(t).state.time, t.pending!.endTime);
  assert.equal(settle(t).state.lastAcceptedStep, t.pending!.step);
});
it('restore owns pending plans and reproduces the next decision exactly', () => {
  const t = trial();
  const raw = structuredClone(t);
  const restored = restoreTimestepState(raw);
  (raw.policy as { growthAfter: number }).growthAfter = 7;
  (raw.pending as unknown as { endTime: number }).endTime = 999;
  assert.deepEqual(settle(restored), settle(t));
  assert.ok(Object.isFrozen(restored.policy));
  assert.ok(Object.isFrozen(restored.pending));
});
it('tampered schema, counters, state, and pending plans are rejected', () => {
  const initial = createTimestepState(policy());
  const bad: unknown[] = [
    { ...initial, schemaVersion: 2 }, { ...initial, nextStep: Infinity },
    { ...initial, attempts: 1 }, { ...initial, growthStreak: 2 },
    { ...initial, time: NaN }, { ...initial, retries: 5 },
    { ...initial, lastAcceptedStep: 1 },
  ];
  const t = trial();
  bad.push({ ...t, pending: { ...t.pending, step: 0.25, endTime: 0.25 } });
  for (const input of bad) assert.throws(() => restoreTimestepState(input as TimestepState),
    TimestepContractError);
});
it('malformed policies are rejected at creation', () => {
  for (const change of [
    { minimumStep: 0 }, { initialStep: 9 }, { maximumStep: Infinity },
    { shrinkFactor: 1 }, { growthFactor: 0.5 }, { lowErrorRatio: 1 },
    { maxRetries: -1 }, { growthAfter: 0 },
  ]) assert.throws(() => createTimestepState(policy(change)), TimestepContractError);
});
it('a deterministic multi-step sequence preserves finite accounting and original snapshots', () => {
  let s = createTimestepState(policy());
  for (let i = 0; i < 150; i++) {
    const before = structuredClone(s);
    let pending = trial(s);
    const rejected = i % 5 === 0;
    if (rejected && pending.pending!.step > s.policy.minimumStep) {
      const r = settle(pending, outcome(2));
      assert.equal(r.state.time, s.time);
      pending = trial(r.state);
    }
    const accepted = settle(pending, outcome(i % 3 ? 0.1 : 0.5));
    assert.ok(accepted.state.time > s.time);
    assert.deepEqual(s, before);
    s = restoreTimestepState(accepted.state);
    assert.equal(s.attempts, s.acceptedSteps + s.rejectedAttempts);
    finite(s);
  }
  assert.equal(s.acceptedSteps, 150);
});

it('a rounding-stalled reduction is distinct from actually reaching the minimum', () => {
  const s = createTimestepState(policy({
    minimumStep: Number.MIN_VALUE, initialStep: 2 * Number.MIN_VALUE,
    maximumStep: 8 * Number.MIN_VALUE, shrinkFactor: 1 - Number.EPSILON,
  }));
  const stopped = settle(trial(s), outcome(2));
  assert.equal(stopped.record.reason, 'STEP_REDUCTION_NOT_REPRESENTABLE');
  assert.equal(stopped.state.time, 0);
  assert.deepEqual(restoreTimestepState(stopped.state), stopped.state);
});
