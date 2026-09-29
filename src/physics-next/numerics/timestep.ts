/** Pure step-control decisions. The caller owns all physical state and events. */
export const TIMESTEP_ALGORITHM_VERSION = 'exact-endpoint-hysteresis-v1' as const;

export interface TimestepPolicy {
  /** Seconds. No implicit model-dependent timestep formula is applied. */
  readonly minimumStep: number;
  readonly initialStep: number;
  readonly maximumStep: number;
  readonly shrinkFactor: number;
  readonly growthFactor: number;
  /** Dimensionless normalized error; acceptance always requires errorRatio <= 1. */
  readonly lowErrorRatio: number;
  readonly growthAfter: number;
  /** Additional attempts after an initial rejection; zero disables retries. */
  readonly maxRetries: number;
}
export type TimestepStopReason =
  | 'CANCELLED' | 'INVALID_OUTCOME' | 'FATAL_GUARD'
  | 'RETRY_LIMIT' | 'MINIMUM_STEP' | 'STEP_REDUCTION_NOT_REPRESENTABLE'
  | 'TIME_NOT_REPRESENTABLE' | 'TIME_RANGE';
export interface StepPlan {
  readonly attempt: number;
  readonly startTime: number;
  readonly endTime: number;
  /** Exactly endTime - startTime, not an independently rounded requested dt. */
  readonly step: number;
  readonly requestedStep: number;
  /** Earliest caller-owned event/stop boundary, or null if none is declared. */
  readonly boundaryTime: number | null;
  readonly clipped: boolean;
  readonly belowMinimum: boolean;
}
export interface TimestepState {
  readonly schemaVersion: 1;
  readonly algorithmVersion: typeof TIMESTEP_ALGORITHM_VERSION;
  readonly policy: TimestepPolicy;
  readonly time: number;
  readonly nextStep: number;
  readonly attempts: number;
  readonly acceptedSteps: number;
  readonly rejectedAttempts: number;
  readonly retries: number;
  readonly growthStreak: number;
  readonly lastAcceptedStep: number | null;
  readonly status: 'ready' | 'trial' | 'stopped';
  readonly stopReason: TimestepStopReason | null;
  readonly pending: StepPlan | null;
}
export interface StepGuard {
  readonly id: string;
  readonly passed: boolean;
  readonly retryable: boolean;
}
export type TrialOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'evaluated'; readonly errorRatio: number; readonly guards: readonly StepGuard[] };
export type StepCause = 'NONE' | 'CANCELLED' | 'ERROR_EXCEEDED' | 'GUARD_REJECTED'
  | 'FATAL_GUARD' | 'INVALID_OUTCOME';
export interface StepRecord {
  readonly attempt: number;
  readonly decision: 'accepted' | 'retry' | 'stopped' | 'cancelled';
  readonly reason: 'ACCEPTED' | 'RETRY' | TimestepStopReason;
  /** Retained even when the terminal reason is a retry/minimum-step limit. */
  readonly cause: StepCause;
  readonly plan: StepPlan;
  readonly timeBefore: number;
  readonly timeAfter: number;
  readonly errorRatio: number | null;
  readonly guards: readonly StepGuard[];
  readonly failedGuardIds: readonly string[];
  readonly nextStep: number;
  readonly retries: number;
}
export interface StepTransition {
  readonly state: TimestepState;
  readonly record: StepRecord;
}
export class TimestepContractError extends Error {
  readonly field: string;
  constructor(field: string) {
    super(`INVALID_TIMESTEP_CONTRACT: ${field}`);
    this.name = 'TimestepContractError';
    this.field = field;
  }
}
function requireValue(condition: boolean, field: string): void {
  if (!condition) throw new TimestepContractError(field);
}
function positive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function natural(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function countNext(value: number): number {
  requireValue(natural(value) && value < Number.MAX_SAFE_INTEGER, 'counter overflow');
  return value + 1;
}
function ownPolicy(input: TimestepPolicy): TimestepPolicy {
  requireValue(input !== null && typeof input === 'object', 'policy');
  for (const key of ['minimumStep', 'initialStep', 'maximumStep'] as const) {
    requireValue(positive(input[key]), key);
  }
  requireValue(input.minimumStep <= input.initialStep && input.initialStep <= input.maximumStep,
    'step bounds');
  requireValue(positive(input.shrinkFactor) && input.shrinkFactor < 1, 'shrinkFactor');
  requireValue(Number.isFinite(input.growthFactor) && input.growthFactor >= 1, 'growthFactor');
  requireValue(Number.isFinite(input.lowErrorRatio) && input.lowErrorRatio >= 0
    && input.lowErrorRatio < 1, 'lowErrorRatio');
  requireValue(natural(input.growthAfter) && input.growthAfter > 0, 'growthAfter');
  requireValue(natural(input.maxRetries), 'maxRetries');
  return Object.freeze({
    minimumStep: input.minimumStep, initialStep: input.initialStep, maximumStep: input.maximumStep,
    shrinkFactor: input.shrinkFactor, growthFactor: input.growthFactor,
    lowErrorRatio: input.lowErrorRatio, growthAfter: input.growthAfter, maxRetries: input.maxRetries,
  });
}
const STOP_REASONS: readonly TimestepStopReason[] = Object.freeze([
  'CANCELLED', 'INVALID_OUTCOME', 'FATAL_GUARD', 'RETRY_LIMIT', 'MINIMUM_STEP',
  'STEP_REDUCTION_NOT_REPRESENTABLE', 'TIME_NOT_REPRESENTABLE', 'TIME_RANGE',
]);
function ownPlan(input: StepPlan, s: TimestepState): StepPlan {
  requireValue(input !== null && typeof input === 'object', 'pending');
  const p = Object.freeze({
    attempt: input.attempt, startTime: input.startTime, endTime: input.endTime,
    step: input.step, requestedStep: input.requestedStep, boundaryTime: input.boundaryTime,
    clipped: input.clipped, belowMinimum: input.belowMinimum,
  });
  requireValue(p.attempt === s.attempts && p.startTime === s.time, 'pending identity');
  requireValue(Number.isFinite(p.endTime) && p.endTime > p.startTime, 'pending.endTime');
  requireValue(positive(p.step) && p.step === p.endTime - p.startTime, 'pending.step');
  requireValue(p.requestedStep === s.nextStep && p.step <= p.requestedStep, 'pending.requestedStep');
  requireValue(typeof p.clipped === 'boolean' && typeof p.belowMinimum === 'boolean', 'pending flags');
  requireValue(p.boundaryTime === null || (Number.isFinite(p.boundaryTime)
    && p.boundaryTime > p.startTime && p.endTime <= p.boundaryTime), 'pending.boundaryTime');
  requireValue(!p.clipped || p.endTime === p.boundaryTime, 'pending clipped endpoint');
  requireValue(p.belowMinimum === (p.step < s.policy.minimumStep), 'pending belowMinimum');
  requireValue(!p.belowMinimum || p.clipped, 'subminimum without event');
  // Recompute the canonical plan: a forged checkpoint cannot choose a different dt.
  const expected = computePlan(s, p.boundaryTime, p.attempt);
  requireValue(typeof expected !== 'string'
    && expected.endTime === p.endTime && expected.clipped === p.clipped, 'pending canonical plan');
  return p;
}

/**
 * Structural/finite validation and ownership for typed controller snapshots.
 * This does not authenticate bytes or prove the supplied physical state matches.
 */
export function restoreTimestepState(input: TimestepState): TimestepState {
  requireValue(input !== null && typeof input === 'object', 'state');
  requireValue(input.schemaVersion === 1 && input.algorithmVersion === TIMESTEP_ALGORITHM_VERSION,
    'schema/algorithm');
  const policy = ownPolicy(input.policy);
  requireValue(Number.isFinite(input.time) && input.time >= 0, 'time');
  requireValue(positive(input.nextStep) && input.nextStep >= policy.minimumStep
    && input.nextStep <= policy.maximumStep, 'nextStep');
  for (const key of ['attempts', 'acceptedSteps', 'rejectedAttempts', 'retries', 'growthStreak'] as const) {
    requireValue(natural(input[key]), key);
  }
  requireValue(input.retries <= policy.maxRetries && input.retries <= input.rejectedAttempts, 'retries');
  requireValue(input.growthStreak < policy.growthAfter, 'growthStreak');
  requireValue(input.lastAcceptedStep === null || positive(input.lastAcceptedStep), 'lastAcceptedStep');
  requireValue((input.acceptedSteps === 0) === (input.lastAcceptedStep === null), 'accepted history');
  requireValue(input.lastAcceptedStep === null || input.lastAcceptedStep <= policy.maximumStep,
    'lastAcceptedStep maximum');
  requireValue(input.status === 'ready' || input.status === 'trial' || input.status === 'stopped', 'status');
  requireValue(input.stopReason === null || STOP_REASONS.includes(input.stopReason), 'stopReason');
  requireValue((input.status === 'stopped') === (input.stopReason !== null), 'terminal reason');
  const settled = input.acceptedSteps + input.rejectedAttempts;
  requireValue(Number.isSafeInteger(settled), 'settled count');
  const outstanding = input.status === 'trial' || input.stopReason === 'CANCELLED' ? 1 : 0;
  requireValue(input.attempts === settled + outstanding, 'attempt accounting');
  const owned: TimestepState = {
    schemaVersion: 1, algorithmVersion: TIMESTEP_ALGORITHM_VERSION, policy,
    time: input.time === 0 ? 0 : input.time, nextStep: input.nextStep,
    attempts: input.attempts, acceptedSteps: input.acceptedSteps,
    rejectedAttempts: input.rejectedAttempts, retries: input.retries, growthStreak: input.growthStreak,
    lastAcceptedStep: input.lastAcceptedStep, status: input.status,
    stopReason: input.stopReason, pending: null,
  };
  requireValue((input.status === 'trial') === (input.pending !== null), 'pending status');
  return Object.freeze({ ...owned, pending: input.pending === null ? null : ownPlan(input.pending, owned) });
}
export function createTimestepState(policy: TimestepPolicy, startTime = 0): TimestepState {
  const owned = ownPolicy(policy);
  return restoreTimestepState({
    schemaVersion: 1, algorithmVersion: TIMESTEP_ALGORITHM_VERSION, policy: owned,
    time: startTime, nextStep: owned.initialStep,
    attempts: 0, acceptedSteps: 0, rejectedAttempts: 0, retries: 0, growthStreak: 0,
    lastAcceptedStep: null, status: 'ready', stopReason: null, pending: null,
  });
}
/** Previous representable positive binary64. Used only to avoid exceeding a cap. */
function previousFloat(value: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) - 1n, false);
  return view.getFloat64(0, false);
}
function computePlan(s: TimestepState, boundaryTime: number | null, attempt: number):
StepPlan | TimestepStopReason {
  const requestedStep = s.nextStep;
  const distance = boundaryTime === null ? null : boundaryTime - s.time;
  const clipped = distance !== null && distance <= requestedStep;
  let endTime = clipped ? boundaryTime! : s.time + requestedStep;
  if (!Number.isFinite(endTime)) return 'TIME_RANGE';
  if (!clipped && endTime - s.time > requestedStep) endTime = previousFloat(endTime);
  const step = endTime - s.time;
  if (!(step > 0) || (!clipped && step < s.policy.minimumStep)) return 'TIME_NOT_REPRESENTABLE';
  return Object.freeze({
    attempt, startTime: s.time, endTime, step, requestedStep,
    boundaryTime, clipped, belowMinimum: step < s.policy.minimumStep,
  });
}
/** No clock advance. A caller must consume events exactly at time BEFORE this call. */
export function planTimestep(state: TimestepState, boundaryTime: number | null): TimestepState {
  const s = restoreTimestepState(state);
  requireValue(s.status === 'ready', 'plan requires ready state');
  requireValue(boundaryTime === null || (Number.isFinite(boundaryTime) && boundaryTime > s.time),
    'boundary must be finite and strictly in the future');
  const attempt = countNext(s.attempts);
  const plan = computePlan(s, boundaryTime, attempt);
  if (typeof plan === 'string') return Object.freeze({ ...s, status: 'stopped', stopReason: plan });
  return Object.freeze({ ...s, status: 'trial', attempts: attempt, pending: plan });
}
function ownGuards(input: readonly StepGuard[]): readonly StepGuard[] | null {
  if (!Array.isArray(input)) return null;
  const result: StepGuard[] = [], seen = new Set<string>();
  for (const g of input) {
    if (g === null || typeof g !== 'object' || typeof g.id !== 'string'
        || g.id.length === 0 || g.id.trim() !== g.id || seen.has(g.id)
        || typeof g.passed !== 'boolean' || typeof g.retryable !== 'boolean') return null;
    seen.add(g.id);
    result.push(Object.freeze({ id: g.id, passed: g.passed, retryable: g.retryable }));
  }
  return Object.freeze(result);
}
/**
 * Preview of a decision: input controller and solver states are never mutated.
 * Publish transition.state and physical trial together via a caller-owned transaction.
 * The caller must pass errorRatio = its declared nonnegative error / positive budget.
 */
export function settleTimestep(state: TimestepState, attempt: number, outcome: TrialOutcome): StepTransition {
  const s = restoreTimestepState(state);
  requireValue(s.status === 'trial' && s.pending !== null, 'settle requires trial');
  const plan = s.pending!;
  requireValue(attempt === plan.attempt, 'stale attempt');
  let cause: StepCause = 'NONE';
  let errorRatio: number | null = null;
  let guards: readonly StepGuard[] = Object.freeze([]);
  if (outcome === null || typeof outcome !== 'object') cause = 'INVALID_OUTCOME';
  else if (outcome.kind === 'cancelled') cause = 'CANCELLED';
  else if (outcome.kind !== 'evaluated' || !Number.isFinite(outcome.errorRatio) || outcome.errorRatio < 0) {
    cause = 'INVALID_OUTCOME';
  } else {
    const checked = ownGuards(outcome.guards);
    if (checked === null) cause = 'INVALID_OUTCOME';
    else {
      guards = checked;
      errorRatio = outcome.errorRatio === 0 ? 0 : outcome.errorRatio;
      if (guards.some(g => !g.passed && !g.retryable)) cause = 'FATAL_GUARD';
      else if (guards.some(g => !g.passed)) cause = 'GUARD_REJECTED';
      else if (errorRatio > 1) cause = 'ERROR_EXCEEDED';
    }
  }
  let next: TimestepState;
  let decision: StepRecord['decision'];
  let reason: StepRecord['reason'];
  if (cause === 'NONE') {
    const grow = !plan.clipped && s.retries === 0 && errorRatio! <= s.policy.lowErrorRatio;
    let streak = grow ? countNext(s.growthStreak) : 0;
    let nextStep = s.nextStep;
    if (streak >= s.policy.growthAfter) {
      streak = 0;
      nextStep = nextStep >= s.policy.maximumStep / s.policy.growthFactor
        ? s.policy.maximumStep : Math.min(s.policy.maximumStep, nextStep * s.policy.growthFactor);
    }
    next = Object.freeze({
      ...s, time: plan.endTime, acceptedSteps: countNext(s.acceptedSteps), retries: 0,
      growthStreak: streak, nextStep, lastAcceptedStep: plan.step, status: 'ready',
      pending: null, stopReason: null,
    });
    decision = 'accepted'; reason = 'ACCEPTED';
  } else if (cause === 'CANCELLED') {
    next = Object.freeze({ ...s, status: 'stopped', stopReason: 'CANCELLED', pending: null });
    decision = 'cancelled'; reason = 'CANCELLED';
  } else {
    const rejectedAttempts = countNext(s.rejectedAttempts);
    let stop: TimestepStopReason | null = cause === 'INVALID_OUTCOME' || cause === 'FATAL_GUARD'
      ? cause : null;
    if (stop === null && s.retries >= s.policy.maxRetries) stop = 'RETRY_LIMIT';
    if (stop === null && plan.step <= s.policy.minimumStep) stop = 'MINIMUM_STEP';
    const reduced = Math.max(s.policy.minimumStep, plan.step * s.policy.shrinkFactor);
    if (stop === null && !(reduced < plan.step)) stop = 'STEP_REDUCTION_NOT_REPRESENTABLE';
    if (stop !== null) {
      next = Object.freeze({
        ...s, rejectedAttempts, growthStreak: 0, status: 'stopped', pending: null, stopReason: stop,
      });
      decision = 'stopped'; reason = stop;
    } else {
      next = Object.freeze({
        ...s, rejectedAttempts, retries: countNext(s.retries), growthStreak: 0,
        nextStep: reduced, status: 'ready', pending: null, stopReason: null,
      });
      decision = 'retry'; reason = 'RETRY';
    }
  }
  const record: StepRecord = Object.freeze({
    attempt: plan.attempt, decision, reason, cause, plan,
    timeBefore: s.time, timeAfter: next.time, errorRatio, guards,
    failedGuardIds: Object.freeze(guards.filter(g => !g.passed).map(g => g.id)),
    nextStep: next.nextStep, retries: next.retries,
  });
  return Object.freeze({ state: next, record });
}
