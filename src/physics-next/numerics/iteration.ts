import { cloneOwnedState } from './transaction';
import {
  NORM_REDUCTION_VERSION, evaluateResidualGroups,
  type GroupCriterion, type ResidualCriteriaResult, type ResidualGroup, type NormFailureCode,
} from './norms';

export const ITERATION_ALGORITHM_VERSION = 'group-history-relaxation-v1' as const;

export interface IterationPolicy {
  /** Caller-chosen identity, not a switch selecting solver equations. */
  readonly label: string;
  /** Counts observations, including an initial-residual observation if supplied. */
  readonly maxEvaluations: number;
  /** Null explicitly disables this heuristic. Window counts transitions. */
  readonly stagnation: {
    readonly window: number;
    readonly minimumRelativeImprovement: number;
  } | null;
  /** Null explicitly disables this heuristic. Factor comparison is strict. */
  readonly divergence: {
    readonly factor: number;
    readonly patience: number;
  } | null;
  readonly relaxation: {
    readonly initial: number;
    readonly minimum: number;
    readonly maximum: number;
    readonly decreaseFactor: number;
    readonly increaseFactor: number;
    readonly goodReductionRatio: number;
    readonly growthPatience: number;
  };
}

export type IterationDecision = 'continue' | 'criteria-satisfied' | 'failed' | 'cancelled';
export type IterationReason =
  | 'CONTINUE' | 'CRITERIA_SATISFIED' | 'INVALID_RESIDUAL'
  | 'GROUP_POLICY_CHANGED' | 'DIVERGENCE' | 'STAGNATION'
  | 'EVALUATION_LIMIT' | 'CANCELLED';
export type RelaxationReason =
  | 'INITIAL' | 'HELD' | 'DECREASED' | 'INCREASED'
  | 'LOWER_BOUND' | 'UPPER_BOUND' | 'TERMINAL';

export interface IterationGroupProgress {
  readonly id: string;
  /** Dimensionless norm using this group's fixed declared conditioning scale. */
  readonly value: number;
  readonly bestValue: number;
  readonly divergenceStreak: number;
  readonly stagnant: boolean;
  readonly divergent: boolean;
}

export interface IterationRecord {
  readonly kind: 'observation' | 'cancellation';
  /** Cancellation does not add a residual evaluation. */
  readonly evaluation: number;
  readonly decision: IterationDecision;
  readonly reason: IterationReason;
  /** Null only for cancellation. Invalid numeric data are never echoed. */
  readonly criteria: ResidualCriteriaResult | null;
  readonly progress: readonly IterationGroupProgress[];
  readonly stagnantGroupIds: readonly string[];
  readonly divergentGroupIds: readonly string[];
  readonly policyMismatchIndex: number | null;
  /** Recommendation before this observation, NOT a claim it was applied. */
  readonly suggestedRelaxation: number;
  readonly nextRelaxation: number;
  readonly relaxationReason: RelaxationReason;
  readonly growthStreak: number;
}

/**
 * Data only, not a storage format or authenticated checkpoint.
 * restore() validates and replays this entire state.
 */
export interface IterationSnapshot {
  readonly schemaVersion: 1;
  readonly algorithmVersion: typeof ITERATION_ALGORITHM_VERSION;
  readonly reductionVersion: typeof NORM_REDUCTION_VERSION;
  readonly policy: IterationPolicy;
  readonly history: readonly IterationRecord[];
}

export class IterationContractError extends Error {
  readonly code: 'INVALID_POLICY' | 'TERMINAL_CONTROLLER' | 'INVALID_SNAPSHOT';
  readonly field: string;
  constructor(code: 'INVALID_POLICY' | 'TERMINAL_CONTROLLER' | 'INVALID_SNAPSHOT', field: string) {
    super(`${code}: ${field}`);
    this.name = 'IterationContractError';
    this.code = code;
    this.field = field;
  }
}

function requirePolicy(condition: boolean, field: string): void {
  if (!condition) throw new IterationContractError('INVALID_POLICY', field);
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function ownPolicy(policy: IterationPolicy): IterationPolicy {
  requirePolicy(policy !== null && typeof policy === 'object', 'policy');
  requirePolicy(typeof policy.label === 'string' && policy.label.length > 0
    && policy.label.trim() === policy.label, 'label');
  // Array-backed complete histories cannot represent more than 2^32-1 slots;
  // reserve one slot for cancellation. Resource budgets remain caller-owned.
  requirePolicy(positiveInteger(policy.maxEvaluations)
    && policy.maxEvaluations <= 0xfffffffe, 'maxEvaluations');
  let stagnation: IterationPolicy['stagnation'] = null;
  if (policy.stagnation !== null) {
    const s = policy.stagnation;
    requirePolicy(s !== undefined && typeof s === 'object', 'stagnation');
    requirePolicy(positiveInteger(s.window), 'stagnation.window');
    requirePolicy(positiveFinite(s.minimumRelativeImprovement)
      && s.minimumRelativeImprovement <= 1, 'stagnation.minimumRelativeImprovement');
    stagnation = Object.freeze({
      window: s.window, minimumRelativeImprovement: s.minimumRelativeImprovement,
    });
  }
  let divergence: IterationPolicy['divergence'] = null;
  if (policy.divergence !== null) {
    const d = policy.divergence;
    requirePolicy(d !== undefined && typeof d === 'object', 'divergence');
    requirePolicy(Number.isFinite(d.factor) && d.factor > 1, 'divergence.factor');
    requirePolicy(positiveInteger(d.patience), 'divergence.patience');
    divergence = Object.freeze({ factor: d.factor, patience: d.patience });
  }
  const r = policy.relaxation;
  requirePolicy(r !== null && typeof r === 'object', 'relaxation');
  for (const key of ['minimum', 'initial', 'maximum'] as const) {
    requirePolicy(positiveFinite(r[key]), `relaxation.${key}`);
  }
  requirePolicy(r.minimum <= r.initial && r.initial <= r.maximum, 'relaxation.bounds');
  requirePolicy(positiveFinite(r.decreaseFactor) && r.decreaseFactor < 1,
    'relaxation.decreaseFactor');
  requirePolicy(Number.isFinite(r.increaseFactor) && r.increaseFactor >= 1,
    'relaxation.increaseFactor');
  requirePolicy(positiveFinite(r.goodReductionRatio) && r.goodReductionRatio < 1,
    'relaxation.goodReductionRatio');
  requirePolicy(positiveInteger(r.growthPatience), 'relaxation.growthPatience');
  return Object.freeze({
    label: policy.label, maxEvaluations: policy.maxEvaluations, stagnation, divergence,
    relaxation: Object.freeze({
      initial: r.initial, minimum: r.minimum, maximum: r.maximum,
      decreaseFactor: r.decreaseFactor, increaseFactor: r.increaseFactor,
      goodReductionRatio: r.goodReductionRatio, growthPatience: r.growthPatience,
    }),
  });
}

const POLICY_FIELDS = [
  'id', 'units', 'norm', 'count', 'scale', 'absoluteTolerance',
  'relativeTolerance', 'referenceScale', 'combination', 'boundary',
] as const;

function policyMismatch(
  first: readonly GroupCriterion[], current: readonly GroupCriterion[],
): number | null {
  const common = Math.min(first.length, current.length);
  for (let i = 0; i < common; i++) {
    for (const field of POLICY_FIELDS) {
      if (first[i][field] !== current[i][field]) return i;
    }
  }
  return first.length === current.length ? null : common;
}

/** Strict factor test without forming an overflowing value / best ratio. */
function aboveFactor(value: number, best: number, factor: number): boolean {
  if (value <= best) return false;
  if (best === 0) return true;
  return best / value < 1 / factor;
}

function decrease(value: number, policy: IterationPolicy['relaxation']): number {
  if (policy.decreaseFactor <= policy.minimum / value) return policy.minimum;
  return Math.max(policy.minimum, value * policy.decreaseFactor);
}

function increase(value: number, policy: IterationPolicy['relaxation']): number {
  if (value >= policy.maximum / policy.increaseFactor) return policy.maximum;
  return Math.min(policy.maximum, value * policy.increaseFactor);
}


function requireSnapshot(condition: boolean, field: string): void {
  if (!condition) throw new IterationContractError('INVALID_SNAPSHOT', field);
}
/** Report-only finite, acyclic scalar data; raw vectors are intentionally absent. */
function sameReportData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every(k => Object.prototype.hasOwnProperty.call(b, k)
    && sameReportData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
const FAILURE_CODES: readonly NormFailureCode[] = Object.freeze([
  'INVALID_NORM', 'INVALID_VECTOR', 'EMPTY_VECTOR', 'SHARED_BUFFER', 'LENGTH_MISMATCH',
  'NON_FINITE_INPUT', 'INVALID_SCALE', 'INVALID_TOLERANCE', 'INVALID_REFERENCE_SCALE',
  'INVALID_GROUP', 'EMPTY_GROUPS', 'DUPLICATE_GROUP_ID', 'INVALID_COMBINATION',
  'INVALID_BOUNDARY', 'ARITHMETIC_OVERFLOW', 'ARITHMETIC_UNDERFLOW',
]);
function ownCriteriaReport(input: ResidualCriteriaResult | null): ResidualCriteriaResult {
  requireSnapshot(input !== null && typeof input === 'object', 'criteria');
  const data = input!;
  if (!data.ok) {
    const validIndex = (x: number | null): boolean =>
      x === null || (Number.isSafeInteger(x) && x >= 0);
    requireSnapshot(data.ok === false && data.passed === false
      && FAILURE_CODES.includes(data.code) && typeof data.field === 'string' && data.field.length > 0
      && validIndex(data.componentIndex) && validIndex(data.groupIndex), 'invalid failure report');
    const expected = Object.freeze({
      ok: false as const, passed: false as const, code: data.code, field: data.field,
      componentIndex: data.componentIndex, groupIndex: data.groupIndex,
    });
    requireSnapshot(sameReportData(expected, data), 'failure report shape');
    return expected;
  }
  requireSnapshot(data.ok === true && Array.isArray(data.groups) && data.groups.length > 0,
    'criteria groups');
  // A zero dummy residual checks only dimensional policy arithmetic and identities.
  // No claim is made that this dummy residual reproduces a saved norm.
  const policies = evaluateResidualGroups(data.groups.map(g => ({ ...g, residual: [0] })));
  requireSnapshot(policies.ok, 'group policy arithmetic');
  if (!policies.ok) throw new IterationContractError('INVALID_SNAPSHOT', 'group policies');
  const groups = data.groups.map((g, i): GroupCriterion => {
    requireSnapshot(Number.isSafeInteger(g.count) && g.count > 0 && g.count <= 0xffffffff
      && Number.isSafeInteger(g.maxIndex) && g.maxIndex >= 0 && g.maxIndex < g.count
      && Number.isFinite(g.value) && g.value >= 0, 'group metric');
    const checked = policies.groups[i];
    const passed = checked.boundary === 'inclusive' ? g.value <= checked.limit : g.value < checked.limit;
    const expected: GroupCriterion = Object.freeze({
      ...checked, count: g.count, maxIndex: g.maxIndex, value: g.value, passed,
      reason: passed ? 'TOLERANCE_SATISFIED' : 'TOLERANCE_EXCEEDED',
    });
    requireSnapshot(sameReportData(expected, g), 'group derived fields');
    return expected;
  });
  const passed = groups.every(g => g.passed);
  const expected: ResidualCriteriaResult = Object.freeze({
    ok: true, passed, reason: passed ? 'ALL_GROUPS_SATISFIED' : 'GROUP_TOLERANCE_EXCEEDED',
    groups: Object.freeze(groups), reductionVersion: NORM_REDUCTION_VERSION,
  });
  requireSnapshot(sameReportData(expected, data), 'criteria report shape');
  return expected;
}

/**
 * Caller-agnostic runtime decision controller, not Picard/Newton or line search.
 * Only copied, frozen scalar norm reports are retained; no trial arrays, solver
 * callbacks, clock, randomness, worker handles, or physics state are stored.
 *
 * observe() returns one record; history() copies the complete record index.
 * A numerical failure is terminal. The timestep owner decides whether to retry.
 */
export class IterationController {
  readonly #policy: IterationPolicy;
  readonly #history: IterationRecord[] = [];

  constructor(policy: IterationPolicy) {
    this.#policy = ownPolicy(policy);
  }

  get policy(): IterationPolicy { return this.#policy; }
  get current(): IterationRecord | null {
    return this.#history.length === 0 ? null : this.#history[this.#history.length - 1];
  }
  get done(): boolean { return this.current !== null && this.current.decision !== 'continue'; }
  get evaluations(): number { return this.current?.evaluation ?? 0; }
  get relaxation(): number {
    return this.current?.nextRelaxation ?? this.#policy.relaxation.initial;
  }
  history(): readonly IterationRecord[] { return Object.freeze(this.#history.slice()); }
  snapshot(): IterationSnapshot {
    return Object.freeze({
      schemaVersion: 1, algorithmVersion: ITERATION_ALGORITHM_VERSION,
      reductionVersion: NORM_REDUCTION_VERSION, policy: this.#policy, history: this.history(),
    });
  }

  observe(groups: readonly ResidualGroup[]): IterationRecord {
    if (this.done) throw new IterationContractError('TERMINAL_CONTROLLER', 'observe');
    return this.#observeCriteria(evaluateResidualGroups(groups));
  }

  #observeCriteria(criteria: ResidualCriteriaResult): IterationRecord {
    if (this.done) throw new IterationContractError('TERMINAL_CONTROLLER', 'observe');
    const previous = this.current;
    const suggested = this.relaxation;
    const evaluation = this.evaluations + 1;
    let reason: IterationReason = 'CONTINUE';
    let decision: IterationDecision = 'continue';
    let mismatch: number | null = null;
    let progress: readonly IterationGroupProgress[] = Object.freeze([]);
    if (!criteria.ok) {
      reason = 'INVALID_RESIDUAL';
      decision = 'failed';
    } else {
      const first = this.#history[0]?.criteria;
      if (first?.ok) mismatch = policyMismatch(first.groups, criteria.groups);
      if (mismatch !== null) {
        reason = 'GROUP_POLICY_CHANGED';
        decision = 'failed';
      } else {
        const s = this.#policy.stagnation;
        const d = this.#policy.divergence;
        const priorWindow = s && this.#history.length >= s.window
          ? this.#history[this.#history.length - s.window] : null;
        progress = Object.freeze(criteria.groups.map((g, i): IterationGroupProgress => {
          const old = previous?.progress[i];
          const bestValue = old ? Math.min(old.bestValue, g.value) : g.value;
          const divergenceStreak = !g.passed && d && old
            && aboveFactor(g.value, old.bestValue, d.factor)
            ? old.divergenceStreak + 1 : 0;
          const oldBest = priorWindow?.progress[i].bestValue;
          const improvement = oldBest === undefined || oldBest === 0
            ? 0 : (oldBest - bestValue) / oldBest;
          return Object.freeze({
            id: g.id, value: g.value, bestValue, divergenceStreak,
            stagnant: !g.passed && s !== null && oldBest !== undefined
              && improvement < s.minimumRelativeImprovement,
            divergent: d !== null && divergenceStreak >= d.patience,
          });
        }));
        // A final permitted observation may satisfy the criteria. Never turn a
        // satisfied numerical criterion into an evaluation-limit failure.
        if (criteria.passed) {
          reason = 'CRITERIA_SATISFIED';
          decision = 'criteria-satisfied';
        } else if (progress.some(g => g.divergent)) {
          reason = 'DIVERGENCE';
          decision = 'failed';
        } else if (progress.some(g => g.stagnant)) {
          reason = 'STAGNATION';
          decision = 'failed';
        } else if (evaluation >= this.#policy.maxEvaluations) {
          reason = 'EVALUATION_LIMIT';
          decision = 'failed';
        }
      }
    }

    let nextRelaxation = suggested;
    let growthStreak = previous?.growthStreak ?? 0;
    let relaxationReason: RelaxationReason = 'TERMINAL';
    if (decision === 'continue') {
      relaxationReason = previous ? 'HELD' : 'INITIAL';
      if (previous && criteria.ok) {
        const r = this.#policy.relaxation;
        const unresolved = criteria.groups.filter(g => !g.passed);
        // Match by stable index, not by a sorted or nondeterministic reduction.
        const worsened = criteria.groups.some((g, i) =>
          !g.passed && g.value >= previous.progress[i].value);
        const good = unresolved.length > 0 && criteria.groups.every((g, i) => {
          if (g.passed) return true;
          const old = previous.progress[i].value;
          return g.value < old && g.value / old <= r.goodReductionRatio;
        });
        if (worsened) {
          growthStreak = 0;
          nextRelaxation = decrease(suggested, r);
          relaxationReason = nextRelaxation < suggested ? 'DECREASED'
            : suggested === r.minimum ? 'LOWER_BOUND' : 'HELD';
        } else if (good) {
          growthStreak++;
          if (growthStreak >= r.growthPatience) {
            growthStreak = 0;
            nextRelaxation = increase(suggested, r);
            relaxationReason = nextRelaxation > suggested ? 'INCREASED'
              : suggested === r.maximum ? 'UPPER_BOUND' : 'HELD';
          }
        } else {
          growthStreak = 0;
        }
      }
    }
    const record: IterationRecord = Object.freeze({
      kind: 'observation', evaluation, decision, reason, criteria, progress,
      stagnantGroupIds: Object.freeze(progress.filter(g => g.stagnant).map(g => g.id)),
      divergentGroupIds: Object.freeze(progress.filter(g => g.divergent).map(g => g.id)),
      policyMismatchIndex: mismatch, suggestedRelaxation: suggested, nextRelaxation,
      relaxationReason, growthStreak,
    });
    // Publish only after evaluation/all allocation succeeds. No earlier mutation
    // of history or caller arrays. Host resource failures are not numerical success.
    this.#history.push(record);
    return record;
  }


  /**
   * Replays validated scalar reports; never reconstructs or invents raw residuals.
   * Ensures every stored decision/counter/suggestion agrees with this algorithm.
   * Identity/authenticity of the solver data and future observations is caller-owned.
   */
  static restore(snapshot: IterationSnapshot): IterationController {
    const owned = cloneOwnedState(snapshot);
    requireSnapshot(owned !== null && typeof owned === 'object', 'snapshot');
    requireSnapshot(owned.schemaVersion === 1
      && owned.algorithmVersion === ITERATION_ALGORITHM_VERSION
      && owned.reductionVersion === NORM_REDUCTION_VERSION, 'versions');
    const controller = new IterationController(owned.policy);
    requireSnapshot(Array.isArray(owned.history)
      && owned.history.length <= controller.policy.maxEvaluations + 1, 'history length');
    for (const record of owned.history) {
      requireSnapshot(record !== null && typeof record === 'object', 'record');
      let actual: IterationRecord;
      if (record.kind === 'observation') {
        actual = controller.#observeCriteria(ownCriteriaReport(record.criteria));
      } else {
        requireSnapshot(record.kind === 'cancellation', 'record.kind');
        actual = controller.cancel();
      }
      requireSnapshot(sameReportData(actual, record), 'history replay mismatch');
    }
    requireSnapshot(sameReportData(controller.snapshot(), owned), 'snapshot replay mismatch');
    return controller;
  }

  /** Poll/yield scheduling and precommit cancellation checks remain caller-owned. */
  cancel(): IterationRecord {
    const previous = this.current;
    // Terminal cancellation is idempotent and cannot rewrite a prior outcome.
    if (previous && this.done) return previous;
    const record: IterationRecord = Object.freeze({
      kind: 'cancellation', evaluation: this.evaluations,
      decision: 'cancelled', reason: 'CANCELLED', criteria: null,
      progress: Object.freeze([]), stagnantGroupIds: Object.freeze([]),
      divergentGroupIds: Object.freeze([]), policyMismatchIndex: null,
      suggestedRelaxation: this.relaxation, nextRelaxation: this.relaxation,
      relaxationReason: 'TERMINAL', growthStreak: previous?.growthStreak ?? 0,
    });
    this.#history.push(record);
    return record;
  }
}
