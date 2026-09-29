import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  NORM_REDUCTION_VERSION, evaluateResidualGroups, scaledNorm,
  type GroupCriteriaResult, type NormFailure, type NormFailureCode,
  type NormKind, type NormScale, type NumericVector, type ResidualGroup,
  type ScaledNorm,
} from '../../../src/physics-next/numerics/norms';

function metric(values: NumericVector, scale: NormScale, kind: NormKind): ScaledNorm {
  const result = scaledNorm(values, scale, kind);
  assert.ok(result.ok, JSON.stringify(result));
  return result;
}
function criteria(groups: readonly ResidualGroup[]): GroupCriteriaResult {
  const result = evaluateResidualGroups(groups);
  assert.ok(result.ok, JSON.stringify(result));
  return result;
}
function bad(result: { readonly ok: boolean }, code: NormFailureCode, field?: string): NormFailure {
  assert.equal(result.ok, false);
  const issue = result as NormFailure;
  assert.equal(issue.passed, false);
  assert.equal(issue.code, code);
  if (field !== undefined) assert.equal(issue.field, field);
  assert.ok(Object.isFrozen(issue));
  return issue;
}
function group(overrides: Partial<ResidualGroup> = {}): ResidualGroup {
  return {
    id: 'example', units: 'Pa', residual: [3, -4], norm: 'linf', scale: 1,
    absoluteTolerance: 4, relativeTolerance: 0, referenceScale: 0,
    combination: 'max', boundary: 'inclusive', ...overrides,
  };
}
function close(actual: number, expected: number): void {
  assert.ok(Number.isFinite(actual));
  const tolerance = Math.max(Number.MIN_VALUE, Math.abs(expected) * 2e-14);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
}
function finiteTree(value: unknown): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) finiteTree(child);
  }
}

for (const [kind, expected] of [['l1', 7], ['l2', 5], ['linf', 4]] as const) {
  it(`${kind}: raw and scalar-scaled values`, () => {
    assert.equal(metric([3, -4], 1, kind).value, expected);
    assert.equal(metric([3, -4], 2, kind).value, expected / 2);
  });
  it(`${kind}: per-component scales`, () => {
    assert.equal(metric([30, -8], [10, 2], kind).value, expected);
  });
  it(`${kind}: zero vectors and deterministic ties`, () => {
    const zero = metric([-0, 0, -0], 1, kind);
    assert.equal(zero.value, 0);
    assert.equal(Object.is(zero.value, -0), false);
    assert.equal(zero.maxIndex, 0);
    assert.equal(metric([0, 6, -6], 1, kind).maxIndex, 1);
  });
  it(`${kind}: typed arrays and immutable inputs`, () => {
    const values = new Float64Array([30, -8]);
    const scales = new Float32Array([10, 2]);
    const oldValues = values.slice();
    const oldScales = scales.slice();
    assert.equal(metric(values, scales, kind).value, expected);
    assert.equal(metric(new Float32Array([3, -4]), 1, kind).value, expected);
    assert.deepEqual(values, oldValues);
    assert.deepEqual(scales, oldScales);
  });
}
it('L1 and L2 are not mean absolute error and RMS', () => {
  assert.equal(metric([1, 1, 1, 1], 1, 'l1').value, 4);
  assert.equal(metric([1, 1, 1, 1], 1, 'l2').value, 2);
});
it('L2 avoids overflow and underflow in intermediate squares', () => {
  close(metric([1e308, 1e308], 1, 'l2').value, Math.SQRT2 * 1e308);
  close(metric([1e-300, 1e-300], 1, 'l2').value, Math.SQRT2 * 1e-300);
});
it('true L1 overflow fails while a requested Linf remains representable', () => {
  bad(scaledNorm([1e308, 1e308], 1, 'l1'), 'ARITHMETIC_OVERFLOW', 'norm');
  assert.equal(metric([1e308, 1e308], 1, 'linf').value, 1e308);
});
it('compensates small positive terms in an ordered L1 reduction', () => {
  assert.equal(metric([1e16, 1, 1], 1, 'l1').value, 1e16 + 2);
});
it('retains a representable subnormal component', () => {
  assert.equal(metric([Number.MIN_VALUE], 1, 'l2').value, Number.MIN_VALUE);
});
it('fails closed when scaling overflows or erases a nonzero component', () => {
  bad(scaledNorm([1], Number.MIN_VALUE, 'l2'), 'ARITHMETIC_OVERFLOW', 'scaledComponent');
  bad(scaledNorm([Number.MIN_VALUE], 2, 'linf'), 'ARITHMETIC_UNDERFLOW', 'scaledComponent');
});
it('repeats identical reductions without sorting or mutating its input', () => {
  const values = Object.freeze([1e16, 1, 1, -3, 2e-200, -7e10]);
  for (const kind of ['l1', 'l2', 'linf'] as const) {
    const first = metric(values, 1, kind);
    for (let i = 0; i < 50; i++) assert.deepEqual(metric(values, 1, kind), first);
    assert.equal(first.reductionVersion, NORM_REDUCTION_VERSION);
    assert.ok(Object.isFrozen(first));
  }
});
it('agrees with independent moderate-range formulas across 200 deterministic vectors', () => {
  let seed = 123456789;
  for (let trial = 0; trial < 200; trial++) {
    const values: number[] = [];
    const scales: number[] = [];
    for (let i = 0; i < 1 + trial % 17; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      values.push((seed % 2001) - 1000);
      scales.push(2 ** (i % 8));
    }
    const q = values.map((v, i) => Math.abs(v) / scales[i]);
    const l1 = metric(values, scales, 'l1').value;
    const l2 = metric(values, scales, 'l2').value;
    const linf = metric(values, scales, 'linf').value;
    close(l1, q.reduce((a, b) => a + b, 0));
    close(l2, Math.sqrt(q.reduce((a, b) => a + b * b, 0)));
    assert.equal(linf, Math.max(...q));
    assert.ok(linf <= l2 * (1 + 1e-14));
    assert.ok(l2 <= l1 * (1 + 1e-14));
    assert.equal(metric(values.map(v => -v), scales, 'l2').value, l2);
  }
});

for (const value of [NaN, Infinity, -Infinity, '2', undefined]) {
  it(`rejects invalid residual component ${String(value)} even after a Linf maximum`, () => {
    const result = scaledNorm([100, value] as NumericVector, 1, 'linf');
    assert.equal(bad(result, 'NON_FINITE_INPUT', 'values').componentIndex, 1);
  });
}
for (const value of [null, undefined, {}, '12', { 0: 1, length: 1 },
  new Uint8Array([1]), new BigInt64Array([1n]), new DataView(new ArrayBuffer(8))]) {
  it(`rejects unsupported vector ${Object.prototype.toString.call(value)}`, () => {
    bad(scaledNorm(value as unknown as NumericVector, 1, 'l1'), 'INVALID_VECTOR', 'values');
  });
}
it('rejects empty, sparse, and mismatched arrays', () => {
  bad(scaledNorm([], 1, 'l1'), 'EMPTY_VECTOR', 'values');
  bad(scaledNorm(new Float64Array(0), 1, 'l2'), 'EMPTY_VECTOR', 'values');
  bad(scaledNorm(new Array<number>(2), 1, 'linf'), 'NON_FINITE_INPUT', 'values');
  bad(scaledNorm([1, 2], [1], 'l2'), 'LENGTH_MISMATCH', 'scales');
  bad(scaledNorm([1], [], 'l2'), 'EMPTY_VECTOR', 'scales');
  bad(scaledNorm([1], {} as NormScale, 'l2'), 'INVALID_VECTOR', 'scales');
});
for (const scale of [0, -0, -1, NaN, Infinity, -Infinity]) {
  it(`rejects scalar and component scale ${String(scale)}`, () => {
    const code = Number.isFinite(scale) ? 'INVALID_SCALE' : 'NON_FINITE_INPUT';
    bad(scaledNorm([1], scale, 'l1'), code, 'scales');
    assert.equal(bad(scaledNorm([1, 1], [1, scale], 'linf'), code, 'scales').componentIndex, 1);
  });
}
it('rejects sparse scale arrays and unknown norm kinds', () => {
  bad(scaledNorm([1], new Array<number>(1), 'l1'), 'NON_FINITE_INPUT', 'scales');
  bad(scaledNorm([1], 1, 'rms' as NormKind), 'INVALID_NORM', 'kind');
});
it('rejects shared typed-array values and scales when shared buffers are available', () => {
  if (typeof SharedArrayBuffer === 'undefined') return;
  const shared = new Float64Array(new SharedArrayBuffer(16));
  shared.set([1, 2]);
  bad(scaledNorm(shared, 1, 'l1'), 'SHARED_BUFFER', 'values');
  bad(scaledNorm([1, 2], shared, 'l2'), 'SHARED_BUFFER', 'scales');
});

it('evaluates absolute-only and relative-only tolerances in declared units', () => {
  const absolute = criteria([group({
    residual: [0.125], scale: 2, absoluteTolerance: 0.25, referenceScale: 100,
  })]);
  assert.equal(absolute.passed, true);
  assert.equal(absolute.groups[0].value, 0.0625);
  assert.equal(absolute.groups[0].absoluteLimit, 0.125);
  assert.equal(absolute.groups[0].relativeLimit, 0);
  const relative = criteria([group({
    residual: [3], absoluteTolerance: 0, relativeTolerance: 0.04, referenceScale: 100,
  })]);
  assert.equal(relative.passed, true);
  assert.equal(relative.groups[0].limit, 4);
});
it('distinguishes max from additive absolute-relative criteria', () => {
  const g = group({ residual: [1.5], absoluteTolerance: 1, relativeTolerance: 0.5, referenceScale: 2 });
  assert.equal(criteria([g]).passed, false);
  const sum = criteria([{ ...g, combination: 'sum' }]);
  assert.equal(sum.passed, true);
  assert.equal(sum.groups[0].limit, 2);
});
it('distinguishes strict and inclusive equality without computing a residual/limit ratio', () => {
  const g = group({ residual: [1], absoluteTolerance: 1 });
  assert.equal(criteria([g]).passed, true);
  assert.equal(criteria([{ ...g, boundary: 'exclusive' }]).passed, false);
  assert.equal(criteria([{ ...g, residual: [1 - Number.EPSILON], boundary: 'exclusive' }]).passed, true);
  assert.equal(criteria([{ ...g, residual: [1 + Number.EPSILON] }]).passed, false);
});
it('uses the absolute term alone when the reference scale is zero', () => {
  assert.equal(criteria([group({
    residual: [0.125], absoluteTolerance: 0.25, relativeTolerance: 0.1, referenceScale: 0,
  })]).passed, true);
});
it('does not silently floor a zero reference or zero combined tolerance', () => {
  const g = group({ residual: [Number.MIN_VALUE], absoluteTolerance: 0, relativeTolerance: 0.1, referenceScale: 0 });
  assert.equal(criteria([g]).passed, false);
  assert.equal(criteria([{ ...g, residual: [0] }]).passed, true);
  assert.equal(criteria([{ ...g, residual: [0], boundary: 'exclusive' }]).passed, false);
});
it('uses the requested norm rather than RMS or a per-component substitute', () => {
  const g = group({ residual: [0.6, 0.6], absoluteTolerance: 1 });
  assert.equal(criteria([{ ...g, norm: 'l1' }]).passed, false);
  assert.equal(criteria([{ ...g, norm: 'l2' }]).passed, true);
  assert.equal(criteria([{ ...g, norm: 'linf' }]).passed, true);
  assert.equal(criteria([{ ...g, residual: [1, 1], norm: 'l2' }]).passed, false);
});
it('requires every component group to pass without dimension or size dilution', () => {
  const result = criteria([
    group({ id: 'pressure-change', residual: [2], absoluteTolerance: 1 }),
    group({ id: 'force-equation', units: 'N', residual: new Float64Array(1000), absoluteTolerance: 1 }),
  ]);
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'GROUP_TOLERANCE_EXCEEDED');
  assert.deepEqual(result.groups.map(g => g.passed), [false, true]);
  assert.deepEqual(result.groups.map(g => g.id), ['pressure-change', 'force-equation']);
});
it('still rejects an invalid later group after a valid tolerance failure', () => {
  const issue = bad(evaluateResidualGroups([
    group({ id: 'first', residual: [2], absoluteTolerance: 1 }),
    group({ id: 'second', residual: [NaN] }),
  ]), 'NON_FINITE_INPUT', 'values');
  assert.equal(issue.groupIndex, 1);
  assert.equal(issue.componentIndex, 0);
});
it('preserves decisions when the scalar conditioning scale is changed', () => {
  for (const scale of [0.5, 1, 2, 128]) {
    const result = criteria([group({ scale, relativeTolerance: 0.01, referenceScale: 100 })]);
    assert.equal(result.passed, true);
    assert.equal(result.groups[0].value, 4 / scale);
    assert.equal(result.groups[0].limit, 4 / scale);
  }
});
it('requires caller unit conversion but gives consistent results for consistently converted data', () => {
  const pa = group({ residual: [3000], scale: 1000, absoluteTolerance: 2000, relativeTolerance: 0.01, referenceScale: 100000 });
  const kpa = { ...pa, units: 'kPa', residual: [3], scale: 1, absoluteTolerance: 2, referenceScale: 100 };
  const a = criteria([pa]).groups[0], b = criteria([kpa]).groups[0];
  assert.equal(a.value, b.value);
  assert.equal(a.limit, b.limit);
  assert.equal(a.passed, b.passed);
});
it('allows representable dimensionless comparisons of very large physical quantities', () => {
  const result = criteria([group({ residual: [1e308], scale: 1e308, absoluteTolerance: 1e308 })]);
  assert.equal(result.groups[0].value, 1);
  assert.equal(result.groups[0].limit, 1);
  assert.equal(result.passed, true);
});
it('does not hide invalid references behind a disabled relative term', () => {
  bad(evaluateResidualGroups([group({ referenceScale: Infinity })]), 'NON_FINITE_INPUT', 'referenceScale');
});
for (const field of ['absoluteTolerance', 'relativeTolerance', 'referenceScale'] as const) {
  it(`rejects negative and non-finite ${field}`, () => {
    const code = field === 'referenceScale' ? 'INVALID_REFERENCE_SCALE' : 'INVALID_TOLERANCE';
    bad(evaluateResidualGroups([group({ [field]: -1 })]), code, field);
    for (const value of [NaN, Infinity, -Infinity]) {
      bad(evaluateResidualGroups([group({ [field]: value })]), 'NON_FINITE_INPUT', field);
    }
  });
}
it('rejects zero and non-finite group scales', () => {
  bad(evaluateResidualGroups([group({ scale: 0 })]), 'INVALID_SCALE', 'scale');
  bad(evaluateResidualGroups([group({ scale: Infinity })]), 'NON_FINITE_INPUT', 'scale');
});
it('rejects empty, missing, sparse, malformed, and duplicate groups', () => {
  bad(evaluateResidualGroups([]), 'EMPTY_GROUPS', 'groups');
  bad(evaluateResidualGroups(null as unknown as ResidualGroup[]), 'INVALID_GROUP', 'groups');
  bad(evaluateResidualGroups(new Array<ResidualGroup>(1)), 'INVALID_GROUP', 'group');
  bad(evaluateResidualGroups([null as unknown as ResidualGroup]), 'INVALID_GROUP', 'group');
  bad(evaluateResidualGroups([group({ id: ' ' })]), 'INVALID_GROUP', 'group');
  bad(evaluateResidualGroups([group({ units: '' })]), 'INVALID_GROUP', 'group');
  bad(evaluateResidualGroups([group({ id: ' padded ' })]), 'INVALID_GROUP', 'group');
  bad(evaluateResidualGroups([group({ units: ' Pa ' })]), 'INVALID_GROUP', 'group');
  assert.equal(bad(evaluateResidualGroups([group(), group()]), 'DUPLICATE_GROUP_ID', 'id').groupIndex, 1);
});
it('requires explicit, recognized norm, combination, and boundary policies', () => {
  bad(evaluateResidualGroups([group({ norm: 'rms' as NormKind })]), 'INVALID_NORM', 'norm');
  bad(evaluateResidualGroups([group({ combination: undefined as unknown as 'max' })]), 'INVALID_COMBINATION', 'combination');
  bad(evaluateResidualGroups([group({ boundary: undefined as unknown as 'inclusive' })]), 'INVALID_BOUNDARY', 'boundary');
});
it('reports overflow and underflow of tolerance arithmetic without non-finite diagnostics', () => {
  bad(evaluateResidualGroups([group({
    residual: [0], absoluteTolerance: Number.MIN_VALUE, scale: 2,
  })]), 'ARITHMETIC_UNDERFLOW', 'absoluteLimit');
  bad(evaluateResidualGroups([group({
    residual: [0], absoluteTolerance: 0, relativeTolerance: 1, referenceScale: 1, scale: Number.MIN_VALUE,
  })]), 'ARITHMETIC_OVERFLOW', 'scaledReference');
  bad(evaluateResidualGroups([group({
    residual: [0], absoluteTolerance: 0, relativeTolerance: Number.MIN_VALUE, referenceScale: 0.5,
  })]), 'ARITHMETIC_UNDERFLOW', 'relativeLimit');
  bad(evaluateResidualGroups([group({
    residual: [0], absoluteTolerance: 0, relativeTolerance: 1e308, referenceScale: 2,
  })]), 'ARITHMETIC_OVERFLOW', 'relativeLimit');
  const g = group({
    residual: [0], absoluteTolerance: 1e308, relativeTolerance: 1, referenceScale: 1e308,
  });
  bad(evaluateResidualGroups([{ ...g, combination: 'sum' }]), 'ARITHMETIC_OVERFLOW', 'limit');
  assert.equal(criteria([g]).passed, true);
});
it('returns deeply owned, frozen reports while leaving the caller mutable', () => {
  const residual = [3, -4];
  const g = { ...group(), residual };
  const before = structuredClone(g);
  const result = criteria([g]);
  assert.deepEqual(g, before);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.groups));
  assert.ok(Object.isFrozen(result.groups[0]));
  const saved = structuredClone(result);
  residual[1] = 400;
  g.absoluteTolerance = 999;
  assert.deepEqual(result, saved);
  assert.equal('residual' in result.groups[0], false);
});
it('produces only finite numeric leaves in valid, exceeded, zero-limit, and invalid reports', () => {
  for (const result of [
    evaluateResidualGroups([group()]),
    evaluateResidualGroups([group({ residual: [100] })]),
    evaluateResidualGroups([group({ residual: [0], absoluteTolerance: 0 })]),
    evaluateResidualGroups([group({ residual: [Infinity] })]),
    scaledNorm([NaN], 1, 'l2'),
    scaledNorm([1], Number.MIN_VALUE, 'l1'),
  ]) {
    finiteTree(result);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  }
});
