import type { IterationRecord, IterationReason } from './iteration';
import type { StepRecord, StepCause } from './timestep';
import { cloneOwnedState } from './transaction';

export const DIAGNOSTICS_SCHEMA_VERSION = 1 as const;
export const DIAGNOSTICS_ALGORITHM_VERSION = 'bounded-fifo-v1' as const;
export type DiagnosticCategory = 'iteration' | 'timestep' | 'checkpoint' | 'contract';
export type DiagnosticReason = IterationReason | StepRecord['reason']
  | 'CHECKPOINT_CREATED' | 'CHECKPOINT_RESTORED' | 'CONTRACT_ERROR';
export interface DiagnosticPolicy {
  readonly capacity: number;
  readonly maximumIds: number;
  /** UTF-16 code units per ID/detail. Oversize inputs are rejected, not hidden. */
  readonly maximumTextLength: number;
}
export interface DiagnosticInput {
  readonly category: DiagnosticCategory;
  readonly reason: DiagnosticReason;
  readonly cause: StepCause | null;
  readonly timeBefore: number | null;
  readonly timeAfter: number | null;
  readonly attempt: number | null;
  readonly evaluation: number | null;
  readonly step: number | null;
  readonly metric: number | null;
  readonly ids: readonly string[];
  readonly detail: string;
}
export interface DiagnosticRecord extends DiagnosticInput { readonly sequence: number; }
export interface DiagnosticSnapshot {
  readonly schemaVersion: typeof DIAGNOSTICS_SCHEMA_VERSION;
  readonly algorithmVersion: typeof DIAGNOSTICS_ALGORITHM_VERSION;
  readonly policy: DiagnosticPolicy;
  readonly totalAdded: number;
  readonly dropped: number;
  /** Oldest to newest; a bounded suffix, never represented as the entire run. */
  readonly records: readonly DiagnosticRecord[];
}
export class DiagnosticError extends Error {
  readonly field: string;
  constructor(field: string) {
    super(`INVALID_DIAGNOSTIC: ${field}`); this.name = 'DiagnosticError'; this.field = field;
  }
}
function check(ok: boolean, field: string): void { if (!ok) throw new DiagnosticError(field); }
function natural(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function ownPolicy(input: DiagnosticPolicy): DiagnosticPolicy {
  check(input !== null && typeof input === 'object', 'policy');
  check(natural(input.capacity) && input.capacity > 0 && input.capacity <= 0xfffffffe, 'capacity');
  check(natural(input.maximumIds) && input.maximumIds <= 0xfffffffe, 'maximumIds');
  check(natural(input.maximumTextLength) && input.maximumTextLength > 0
    && input.maximumTextLength <= 0xfffffffe, 'maximumTextLength');
  return Object.freeze({
    capacity: input.capacity, maximumIds: input.maximumIds, maximumTextLength: input.maximumTextLength,
  });
}
const CATEGORY_REASONS: Readonly<Record<DiagnosticCategory, readonly DiagnosticReason[]>> = {
  iteration: ['CONTINUE', 'CRITERIA_SATISFIED', 'INVALID_RESIDUAL', 'GROUP_POLICY_CHANGED',
    'DIVERGENCE', 'STAGNATION', 'EVALUATION_LIMIT', 'CANCELLED'],
  timestep: ['ACCEPTED', 'RETRY', 'CANCELLED', 'INVALID_OUTCOME', 'FATAL_GUARD',
    'RETRY_LIMIT', 'MINIMUM_STEP', 'STEP_REDUCTION_NOT_REPRESENTABLE', 'TIME_NOT_REPRESENTABLE', 'TIME_RANGE'],
  checkpoint: ['CHECKPOINT_CREATED', 'CHECKPOINT_RESTORED'],
  contract: ['CONTRACT_ERROR'],
};
const CAUSES: readonly StepCause[] = ['NONE', 'CANCELLED', 'ERROR_EXCEEDED',
  'GUARD_REJECTED', 'FATAL_GUARD', 'INVALID_OUTCOME'];
function ownInput(input: DiagnosticInput, policy: DiagnosticPolicy): DiagnosticInput {
  check(input !== null && typeof input === 'object', 'record');
  check(Object.prototype.hasOwnProperty.call(CATEGORY_REASONS, input.category), 'category');
  check(CATEGORY_REASONS[input.category].includes(input.reason), 'reason');
  check(input.cause === null || CAUSES.includes(input.cause), 'cause');
  check(input.category === 'timestep' || input.cause === null, 'cause category');
  for (const key of ['timeBefore', 'timeAfter'] as const) {
    check(input[key] === null || (Number.isFinite(input[key]) && input[key]! >= 0), key);
  }
  check(input.timeBefore === null || input.timeAfter === null
    || input.timeAfter >= input.timeBefore, 'time order');
  for (const key of ['attempt', 'evaluation'] as const) {
    check(input[key] === null || natural(input[key]!), key);
  }
  check(input.step === null || (Number.isFinite(input.step) && input.step > 0), 'step');
  check(input.metric === null || Number.isFinite(input.metric), 'metric');
  check(Array.isArray(input.ids) && input.ids.length <= policy.maximumIds, 'ids length');
  const seen = new Set<string>(), ids: string[] = [];
  for (const id of input.ids) {
    check(typeof id === 'string' && id.length > 0 && id.trim() === id
      && id.length <= policy.maximumTextLength && !seen.has(id), 'id');
    seen.add(id); ids.push(id);
  }
  check(typeof input.detail === 'string' && input.detail.length <= policy.maximumTextLength, 'detail');
  if (input.category === 'timestep' && input.reason === 'ACCEPTED') {
    check(input.timeBefore !== null && input.timeAfter !== null && input.step !== null
      && input.timeAfter > input.timeBefore && input.step === input.timeAfter - input.timeBefore
      && input.cause === 'NONE', 'accepted interval');
  }
  if (input.category === 'timestep' && input.reason !== 'ACCEPTED') {
    check(input.timeBefore === input.timeAfter, 'unaccepted clock advance');
  }
  return Object.freeze({
    category: input.category, reason: input.reason, cause: input.cause,
    timeBefore: input.timeBefore, timeAfter: input.timeAfter, attempt: input.attempt,
    evaluation: input.evaluation, step: input.step, metric: input.metric,
    ids: Object.freeze(ids), detail: input.detail,
  });
}
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k =>
    Object.prototype.hasOwnProperty.call(b, k)
    && sameData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
/**
 * Storage is bounded by capacity and per-record text/ID limits. No solver arrays,
 * callbacks, raw residuals, Error objects, wall-clock time, or hidden random state.
 */
export class BoundedDiagnostics {
  readonly #policy: DiagnosticPolicy;
  readonly #ring: DiagnosticRecord[] = [];
  #head = 0;
  #size = 0;
  #total = 0;
  constructor(policy: DiagnosticPolicy) { this.#policy = ownPolicy(policy); }
  get size(): number { return this.#size; }
  get totalAdded(): number { return this.#total; }
  get dropped(): number { return this.#total - this.#size; }
  add(input: DiagnosticInput): DiagnosticRecord {
    const data = ownInput(input, this.#policy);
    check(this.#total < Number.MAX_SAFE_INTEGER, 'sequence overflow');
    const record = Object.freeze({ ...data, sequence: this.#total + 1 });
    if (this.#size < this.#policy.capacity) {
      this.#ring[(this.#head + this.#size) % this.#policy.capacity] = record;
      this.#size++;
    } else {
      this.#ring[this.#head] = record;
      this.#head = (this.#head + 1) % this.#policy.capacity;
    }
    this.#total++;
    return record;
  }
  records(): readonly DiagnosticRecord[] {
    const result: DiagnosticRecord[] = [];
    for (let i = 0; i < this.#size; i++) result.push(this.#ring[(this.#head + i) % this.#policy.capacity]);
    return Object.freeze(result);
  }
  snapshot(): DiagnosticSnapshot {
    return Object.freeze({
      schemaVersion: DIAGNOSTICS_SCHEMA_VERSION, algorithmVersion: DIAGNOSTICS_ALGORITHM_VERSION,
      policy: this.#policy, totalAdded: this.#total, dropped: this.dropped, records: this.records(),
    });
  }
  static restore(snapshot: DiagnosticSnapshot): BoundedDiagnostics {
    const input = cloneOwnedState(snapshot);
    check(input !== null && typeof input === 'object', 'snapshot');
    check(input.schemaVersion === DIAGNOSTICS_SCHEMA_VERSION
      && input.algorithmVersion === DIAGNOSTICS_ALGORITHM_VERSION, 'versions');
    const result = new BoundedDiagnostics(input.policy);
    check(natural(input.totalAdded) && natural(input.dropped) && Array.isArray(input.records),
      'history metadata');
    check(input.records.length === Math.min(input.totalAdded, input.policy.capacity)
      && input.dropped === input.totalAdded - input.records.length, 'history accounting');
    for (let i = 0; i < input.records.length; i++) {
      const raw = input.records[i];
      const record = Object.freeze({ ...ownInput(raw, input.policy), sequence: input.dropped + i + 1 });
      check(sameData(record, raw), 'record sequence/shape');
      result.#ring.push(record);
    }
    result.#size = input.records.length;
    result.#total = input.totalAdded;
    check(sameData(result.snapshot(), input), 'snapshot shape');
    return result;
  }
}
/** Record actual accepted/rejected/cancelled endpoints without changing state. */
export function stepDiagnostic(record: StepRecord): DiagnosticInput {
  return {
    category: 'timestep', reason: record.reason, cause: record.cause,
    timeBefore: record.timeBefore, timeAfter: record.timeAfter,
    attempt: record.attempt, evaluation: null, step: record.plan.step,
    metric: record.errorRatio, ids: record.failedGuardIds, detail: '',
  };
}
/** Complete per-group metrics stay in the iteration history, not a blended score. */
export function iterationDiagnostic(
  record: IterationRecord, physicalTime: number, attempt: number | null,
): DiagnosticInput {
  return {
    category: 'iteration', reason: record.reason, cause: null,
    timeBefore: physicalTime, timeAfter: physicalTime, attempt, evaluation: record.evaluation,
    step: null, metric: null,
    ids: record.criteria?.ok ? record.criteria.groups.filter(g => !g.passed).map(g => g.id) : [],
    detail: '',
  };
}
