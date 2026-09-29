/**
 * Equation-agnostic, float64 runtime norms. No solver state is retained or mutated.
 * L1 is a sum; L2 is Euclidean (NOT RMS); Linf is a maximum.
 * Inputs must be ordinary arrays or same-realm Float32Array/Float64Array views.
 * Shared buffers, getters/proxies, and concurrent mutation are not supported;
 * shared typed-array buffers are explicitly rejected.
 */
export const NORM_REDUCTION_VERSION = 'ordered-max-neumaier-v1' as const;

export type NumericVector = readonly number[] | Float32Array | Float64Array;
export type NormScale = number | NumericVector;
export type NormKind = 'l1' | 'l2' | 'linf';
export type ToleranceCombination = 'sum' | 'max';
export type ToleranceBoundary = 'inclusive' | 'exclusive';

export type NormFailureCode =
  | 'INVALID_NORM' | 'INVALID_VECTOR' | 'EMPTY_VECTOR' | 'SHARED_BUFFER'
  | 'LENGTH_MISMATCH' | 'NON_FINITE_INPUT' | 'INVALID_SCALE'
  | 'INVALID_TOLERANCE' | 'INVALID_REFERENCE_SCALE'
  | 'INVALID_GROUP' | 'EMPTY_GROUPS' | 'DUPLICATE_GROUP_ID'
  | 'INVALID_COMBINATION' | 'INVALID_BOUNDARY'
  | 'ARITHMETIC_OVERFLOW' | 'ARITHMETIC_UNDERFLOW';

export interface NormFailure {
  readonly ok: false;
  readonly passed: false;
  readonly code: NormFailureCode;
  readonly field: string;
  readonly componentIndex: number | null;
  readonly groupIndex: number | null;
}

export interface ScaledNorm {
  readonly ok: true;
  readonly kind: NormKind;
  readonly count: number;
  /** Dimensionless when scales have the same units as values. */
  readonly value: number;
  /** First (lowest-index) component attaining the maximum scaled magnitude. */
  readonly maxIndex: number;
  readonly reductionVersion: typeof NORM_REDUCTION_VERSION;
}
export type ScaledNormResult = ScaledNorm | NormFailure;

export interface ResidualGroup {
  readonly id: string;
  /** Opaque, nonblank unit label. Use "1" for dimensionless quantities. */
  readonly units: string;
  readonly residual: NumericVector;
  readonly norm: NormKind;
  /** Strictly positive scalar in residual units; NOT a reference floor. */
  readonly scale: number;
  /** Tolerance of the selected unnormalized group norm, in residual units. */
  readonly absoluteTolerance: number;
  /** Dimensionless; zero disables only the relative term. */
  readonly relativeTolerance: number;
  /** Nonnegative, caller-declared reference magnitude in residual-norm units. */
  readonly referenceScale: number;
  /** Explicit: max and sum are different acceptance policies. */
  readonly combination: ToleranceCombination;
  /** Explicit: inclusive uses <=; exclusive uses <, including at zero. */
  readonly boundary: ToleranceBoundary;
}

export interface GroupCriterion {
  readonly id: string;
  readonly units: string;
  readonly norm: NormKind;
  readonly scale: number;
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly referenceScale: number;
  readonly combination: ToleranceCombination;
  readonly boundary: ToleranceBoundary;
  readonly count: number;
  readonly maxIndex: number;
  /** All four quantities below are dimensionless, divided by group.scale. */
  readonly value: number;
  readonly absoluteLimit: number;
  readonly relativeLimit: number;
  readonly limit: number;
  readonly passed: boolean;
  readonly reason: 'TOLERANCE_SATISFIED' | 'TOLERANCE_EXCEEDED';
}

export interface GroupCriteriaResult {
  readonly ok: true;
  readonly passed: boolean;
  readonly reason: 'ALL_GROUPS_SATISFIED' | 'GROUP_TOLERANCE_EXCEEDED';
  readonly groups: readonly GroupCriterion[];
  readonly reductionVersion: typeof NORM_REDUCTION_VERSION;
}
export type ResidualCriteriaResult = GroupCriteriaResult | NormFailure;

function failure(
  code: NormFailureCode, field: string, componentIndex: number | null = null,
  groupIndex: number | null = null,
): NormFailure {
  // Never echo an invalid numeric input into diagnostics.
  return Object.freeze({ ok: false, passed: false, code, field, componentIndex, groupIndex });
}

function validKind(value: unknown): value is NormKind {
  return value === 'l1' || value === 'l2' || value === 'linf';
}

function validateVector(value: unknown, field: string): NormFailure | null {
  if (!Array.isArray(value) && !(value instanceof Float32Array) && !(value instanceof Float64Array)) {
    return failure('INVALID_VECTOR', field);
  }
  if (!Array.isArray(value) && typeof SharedArrayBuffer !== 'undefined'
      && value.buffer instanceof SharedArrayBuffer) {
    return failure('SHARED_BUFFER', field);
  }
  if (value.length === 0) return failure('EMPTY_VECTOR', field);
  return null;
}

function positiveScale(value: number, field: string, index: number | null): NormFailure | null {
  if (!Number.isFinite(value)) return failure('NON_FINITE_INPUT', field, index);
  if (value <= 0) return failure('INVALID_SCALE', field, index);
  return null;
}

function checkedArithmetic(
  value: number, nonzeroExpected: boolean, field: string, index: number | null = null,
): number | NormFailure {
  if (!Number.isFinite(value)) return failure('ARITHMETIC_OVERFLOW', field, index);
  if (value === 0 && nonzeroExpected) return failure('ARITHMETIC_UNDERFLOW', field, index);
  return value === 0 ? 0 : value; // Canonical positive zero.
}

/**
 * Computes || values[i] / scales[i] ||, in ascending component-index order.
 * A scalar scale broadcasts; vector scales must match values.length exactly.
 * Every component is checked, including entries after a current Linf maximum.
 * Valid finite inputs can still return an arithmetic-range failure.
 */
export function scaledNorm(values: NumericVector, scales: NormScale, kind: NormKind): ScaledNormResult {
  if (!validKind(kind)) return failure('INVALID_NORM', 'kind');
  const invalidValues = validateVector(values, 'values');
  if (invalidValues) return invalidValues;
  if (typeof scales === 'number') {
    const invalidScale = positiveScale(scales, 'scales', null);
    if (invalidScale) return invalidScale;
  } else {
    const invalidScales = validateVector(scales, 'scales');
    if (invalidScales) return invalidScales;
    if (scales.length !== values.length) return failure('LENGTH_MISMATCH', 'scales');
  }

  const count = values.length;
  // Linf needs no O(n) workspace. L1/L2 own their temporary scaled samples.
  const magnitudes = kind === 'linf' ? null : new Float64Array(count);
  let maximum = 0;
  let maxIndex = 0;
  for (let i = 0; i < count; i++) {
    const raw = values[i];
    if (!Number.isFinite(raw)) return failure('NON_FINITE_INPUT', 'values', i);
    const scale = typeof scales === 'number' ? scales : scales[i];
    const invalidScale = positiveScale(scale, 'scales', typeof scales === 'number' ? null : i);
    if (invalidScale) return invalidScale;
    const magnitude = checkedArithmetic(Math.abs(raw) / scale, raw !== 0, 'scaledComponent', i);
    if (typeof magnitude !== 'number') return magnitude;
    if (magnitudes) magnitudes[i] = magnitude;
    if (magnitude > maximum) { maximum = magnitude; maxIndex = i; }
  }

  let value = maximum;
  if (maximum !== 0 && magnitudes !== null) {
    // Normalize before summing/squaring: avoid overflow in q*q and
    // preserve a nonzero L2 for tiny values. Order is never sorted.
    let sum = 0;
    let correction = 0;
    for (let i = 0; i < count; i++) {
      const ratio = magnitudes[i] / maximum;
      const term = kind === 'l1' ? ratio : ratio * ratio;
      const next = sum + term;
      correction += sum >= term ? (sum - next) + term : (term - next) + sum;
      sum = next;
    }
    const reduced = sum + correction;
    const candidate = maximum * (kind === 'l1' ? reduced : Math.sqrt(reduced));
    const checked = checkedArithmetic(candidate, true, 'norm');
    if (typeof checked !== 'number') return checked;
    value = checked;
  }
  return Object.freeze({
    ok: true, kind, count, value, maxIndex, reductionVersion: NORM_REDUCTION_VERSION,
  });
}

function evaluateGroup(group: ResidualGroup): GroupCriterion | NormFailure {
  if (group === null || typeof group !== 'object'
      || typeof group.id !== 'string' || group.id.trim() === '' || group.id !== group.id.trim()
      || typeof group.units !== 'string' || group.units.trim() === '' || group.units !== group.units.trim()) {
    return failure('INVALID_GROUP', 'group');
  }
  if (!validKind(group.norm)) return failure('INVALID_NORM', 'norm');
  if (group.combination !== 'sum' && group.combination !== 'max') {
    return failure('INVALID_COMBINATION', 'combination');
  }
  if (group.boundary !== 'inclusive' && group.boundary !== 'exclusive') {
    return failure('INVALID_BOUNDARY', 'boundary');
  }
  const invalidScale = positiveScale(group.scale, 'scale', null);
  if (invalidScale) return invalidScale;
  for (const field of ['absoluteTolerance', 'relativeTolerance', 'referenceScale'] as const) {
    const value = group[field];
    if (!Number.isFinite(value)) return failure('NON_FINITE_INPUT', field);
    if (value < 0) return failure(
      field === 'referenceScale' ? 'INVALID_REFERENCE_SCALE' : 'INVALID_TOLERANCE', field,
    );
  }

  const metric = scaledNorm(group.residual, group.scale, group.norm);
  if (!metric.ok) return metric;
  const absolute = checkedArithmetic(
    group.absoluteTolerance / group.scale, group.absoluteTolerance !== 0, 'absoluteLimit',
  );
  if (typeof absolute !== 'number') return absolute;
  let relative = 0;
  // Validate referenceScale even when rtol is zero; do not evaluate 0 * Infinity.
  if (group.relativeTolerance !== 0 && group.referenceScale !== 0) {
    const reference = checkedArithmetic(group.referenceScale / group.scale, true, 'scaledReference');
    if (typeof reference !== 'number') return reference;
    const product = checkedArithmetic(group.relativeTolerance * reference, true, 'relativeLimit');
    if (typeof product !== 'number') return product;
    relative = product;
  }
  const limit = checkedArithmetic(
    group.combination === 'sum' ? absolute + relative : Math.max(absolute, relative),
    absolute !== 0 || relative !== 0, 'limit',
  );
  if (typeof limit !== 'number') return limit;

  // Do not divide by the tolerance: zero references/budgets need no NaN/Infinity
  // convention, and rounded ratios cannot alter a strict boundary comparison.
  const passed = group.boundary === 'inclusive' ? metric.value <= limit : metric.value < limit;
  return Object.freeze({
    id: group.id, units: group.units, norm: group.norm, scale: group.scale,
    absoluteTolerance: group.absoluteTolerance === 0 ? 0 : group.absoluteTolerance,
    relativeTolerance: group.relativeTolerance === 0 ? 0 : group.relativeTolerance,
    referenceScale: group.referenceScale === 0 ? 0 : group.referenceScale,
    combination: group.combination, boundary: group.boundary,
    count: metric.count, maxIndex: metric.maxIndex, value: metric.value,
    absoluteLimit: absolute, relativeLimit: relative, limit, passed,
    reason: passed ? 'TOLERANCE_SATISFIED' : 'TOLERANCE_EXCEEDED',
  });
}

/**
 * Every named group must pass; groups are never averaged into one score.
 * An invalid later group cannot be hidden by an earlier tolerance failure.
 * Results are deeply frozen, contain no input arrays, and have no controller state.
 */
export function evaluateResidualGroups(groups: readonly ResidualGroup[]): ResidualCriteriaResult {
  if (!Array.isArray(groups)) return failure('INVALID_GROUP', 'groups');
  if (groups.length === 0) return failure('EMPTY_GROUPS', 'groups');
  const seen = new Set<string>();
  const reports: GroupCriterion[] = [];
  let passed = true;
  for (let i = 0; i < groups.length; i++) {
    const report = evaluateGroup(groups[i]);
    if ('ok' in report) return Object.freeze({ ...report, groupIndex: i });
    if (seen.has(report.id)) return failure('DUPLICATE_GROUP_ID', 'id', null, i);
    seen.add(report.id);
    reports.push(report);
    if (!report.passed) passed = false;
  }
  return Object.freeze({
    ok: true, passed, reason: passed ? 'ALL_GROUPS_SATISFIED' : 'GROUP_TOLERANCE_EXCEEDED',
    groups: Object.freeze(reports), reductionVersion: NORM_REDUCTION_VERSION,
  });
}
