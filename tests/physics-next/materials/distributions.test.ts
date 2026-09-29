import { describe, expect, it } from 'vitest'
import { parseReportedQuantity } from '../../../src/physics-next/materials/units'
import type { QuantityKind } from '../../../src/physics-next/materials/units'
import { MaterialDataError } from '../../../src/physics-next/materials/schema'
import { MaterialRegistry } from '../../../src/physics-next/materials/registry'
import { describeDistribution, parseCorrelation } from '../../../src/physics-next/materials/distributions'

function q(kind: QuantityKind, value: number, unit: string, basis = 'dry mass per bulk volume') {
  return parseReportedQuantity(kind, {
    value, unit, numericText: null, unitText: null, precision: { kind: 'unknown' }, basis,
  })
}
function example(overrides: Record<string, unknown> = {}) {
  return {
    format: 'zfs-material-parameter', version: 1, id: 'evidence-a', key: 'bulk-density',
    material: { id: 'peat-a', label: 'Synthetic peat fixture', class: 'peat',
      specimenId: 'test-only', description: 'Invented software test data; not a material dataset.' },
    quantityKind: 'bulkDensity', basis: 'dry mass per bulk volume',
    value: { form: 'scalar', quantity: q('bulkDensity', 135, 'kg/m3') },
    provenance: { status: 'assumed', claim: 'model-assumption', rationale: 'Software fixture only.',
      sourceGap: 'No experimental source.', derivation: null },
    citations: [],
    applicability: { state: 'specified', bounds: [], categories: [{ axis: 'state', value: 'dry' }],
      note: 'Synthetic dry state only.' },
    notes: ['Never use this fixture as material evidence.'], ...overrides,
  }
}
function rejected(action: () => unknown, code?: string) {
  let caught: unknown
  try { action() } catch (error) { caught = error }
  expect(caught instanceof Error).toBe(true)
  if (code !== undefined) {
    expect(caught).toBeInstanceOf(MaterialDataError)
    expect((caught as MaterialDataError).code).toBe(code)
  }
}

function setInput(records: unknown[] = [example()], overrides: unknown[] = [], sources: unknown[] = []) {
  return { format: 'zfs-material-set', version: 1, id: 'fixture-set', revision: 1, parent: null,
    records, sources, overrides }
}
function distributed(id: string, overrides: Record<string, unknown> = {}) {
  return example({ id, key: `density-${id}`, value: {
    form: 'distribution', family: 'uniform', lower: q('bulkDensity', 100, 'kg/m3'),
    upper: q('bulkDensity', 200, 'kg/m3'), interpretation: 'epistemic', note: 'Synthetic distribution only.',
    ...overrides,
  } })
}
function correlation(overrides: Record<string, unknown> = {}) {
  return {
    format: 'zfs-material-correlation', version: 1, id: 'correlation-test',
    kind: 'pearson', unit: '1', recordIds: ['a', 'b'], matrix: [[1, 0.5], [0.5, 1]],
    citations: [], provenance: { status: 'assumed', claim: 'model-assumption',
      rationale: 'Synthetic correlation only.', sourceGap: 'No dataset.', derivation: null },
    note: 'No joint distribution or sample is asserted.', ...overrides,
  }
}

describe('bounded distribution metadata', () => {
  it('preserves support, original reports, and declared uncertainty interpretation without sampling', () => {
    const d = describeDistribution(distributed('a'))
    expect(d.supportSI).toEqual([100, 200])
    expect(d.distribution.lower.reported.unit).toBe('kg/m3')
    expect(d.distribution.interpretation).toBe('epistemic')
    expect(d.use).toBe('metadata-only-no-sampling-or-validation')
    expect(Object.isFrozen(d.supportSI)).toBe(true)
    expect(Object.hasOwn(d, 'samples')).toBe(false)
  })
  it('accepts triangular endpoints but refuses out-of-support modes', () => {
    expect(describeDistribution(distributed('a', {
      family: 'triangular', mode: q('bulkDensity', 100, 'kg/m3'),
    })).distribution.family).toBe('triangular')
    rejected(() => describeDistribution(distributed('a', {
      family: 'triangular', mode: q('bulkDensity', 99, 'kg/m3'),
    })), 'DISTRIBUTION')
  })
  it('rejects scalar/range substitution, unbounded families, and overflowing support width', () => {
    rejected(() => describeDistribution(example()), 'DISTRIBUTION')
    rejected(() => describeDistribution(distributed('a', { family: 'normal' })), 'ENUM')
    rejected(() => describeDistribution(distributed('a', { upper: q('bulkDensity', 100, 'kg/m3') })), 'DISTRIBUTION')
    rejected(() => describeDistribution(distributed('a', {
      lower: q('bulkDensity', -1e308, 'kg/m3'), upper: q('bulkDensity', 1e308, 'kg/m3'),
    })), 'DISTRIBUTION')
  })
  it('uses pressure differences as scale for absolute-pressure distributions', () => {
    const basis = 'absolute gas pressure, specimen voids'
    const input = example({ quantityKind: 'absolutePressure', basis, value: {
      form: 'distribution', family: 'truncated-normal', lower: q('absolutePressure', 1, 'bar', basis),
      upper: q('absolutePressure', 2, 'bar', basis), location: q('absolutePressure', 1.5, 'bar', basis),
      scale: q('pressureDifference', 0.1, 'bar', basis), interpretation: 'unspecified',
      note: 'Synthetic metadata.',
    } })
    const d = describeDistribution(input).distribution
    expect(d.family === 'truncated-normal' && d.scale.valueSI).toBe(10000)
  })
})
describe('correlation structure checks without joint-distribution claims', () => {
  const registry = new MaterialRegistry(setInput([distributed('a'), distributed('b'), distributed('c')]))
  it('preserves ordered rows/columns and round trips without correlation conversion', () => {
    const raw = correlation({ recordIds: ['b', 'a'] })
    const parsed = parseCorrelation(raw, registry)
    expect(parsed.recordIds).toEqual(['b', 'a'])
    expect(parsed.matrix).toEqual([[1, 0.5], [0.5, 1]])
    expect(parseCorrelation(JSON.parse(JSON.stringify(parsed)), registry)).toEqual(parsed)
    expect(Object.isFrozen(parsed.matrix[0])).toBe(true)
  })
  it('accepts independent, perfect positive/negative and rank-deficient PSD metadata', () => {
    for (const rho of [-1, 0, 1])
      expect(parseCorrelation(correlation({ matrix: [[1, rho], [rho, 1]] }), registry).matrix[0][1]).toBe(rho)
    expect(parseCorrelation(correlation({
      recordIds: ['a', 'b', 'c'], matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    }), registry).matrix.length).toBe(3)
  })
  it('rejects indefinite matrices even with valid pairwise coefficient ranges', () => {
    rejected(() => parseCorrelation(correlation({
      recordIds: ['a', 'b', 'c'], matrix: [[1, 0.9, 0.9], [0.9, 1, -0.9], [0.9, -0.9, 1]],
    }), registry), 'CORRELATION_PSD')
  })
  it('rejects asymmetry, non-unit diagonals, bounds, shape and nonfinite values', () => {
    const cases: [unknown, string][] = [
      [[[1, 0.5], [0.4, 1]], 'CORRELATION_SYMMETRY'],
      [[[0.99, 0], [0, 1]], 'CORRELATION_DIAGONAL'],
      [[[1, 1.1], [1.1, 1]], 'CORRELATION_BOUNDS'],
      [[[1]], 'CORRELATION_SIZE'],
      [[[1, NaN], [NaN, 1]], 'FINITE'],
    ]
    for (const [matrix, code] of cases)
      rejected(() => parseCorrelation(correlation({ matrix }), registry), code)
  })
  it('rejects non-distribution targets, dangling references, duplicate IDs and unsupported dependence kinds', () => {
    const scalarRegistry = new MaterialRegistry(setInput([example({ id: 'a' }), distributed('b')]))
    rejected(() => parseCorrelation(correlation(), scalarRegistry), 'DISTRIBUTION')
    rejected(() => parseCorrelation(correlation({ recordIds: ['a', 'missing'] }), registry), 'DANGLING_RECORD')
    rejected(() => parseCorrelation(correlation({ recordIds: ['a', 'a'] }), registry), 'DUPLICATE')
    rejected(() => parseCorrelation(correlation({ kind: 'spearman' }), registry), 'CORRELATION_KIND')
    rejected(() => parseCorrelation(correlation({ unit: '%' }), registry), 'CORRELATION_KIND')
  })
  it('requires explicit provenance and source connectivity', () => {
    rejected(() => parseCorrelation(correlation({ provenance: {
      status: 'unknown', claim: 'unknown', rationale: 'Not known.', sourceGap: 'Missing.', derivation: null,
    } }), registry), 'CORRELATION_PROVENANCE')
    rejected(() => parseCorrelation(correlation({ citations: [
      { sourceId: 'src:manual:absent', role: 'context', locator: { kind: 'page', value: '1' } },
    ] }), registry), 'DANGLING_SOURCE')
    rejected(() => parseCorrelation(correlation({ provenance: {
      status: 'measured', claim: 'observation', rationale: 'Unsupported.', sourceGap: 'Missing.', derivation: null,
    } }), registry), 'EVIDENCE')
  })
})
