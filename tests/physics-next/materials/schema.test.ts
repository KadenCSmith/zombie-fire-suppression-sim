import { describe, expect, it } from 'vitest'
import { parseReportedQuantity } from '../../../src/physics-next/materials/units'
import type { QuantityKind } from '../../../src/physics-next/materials/units'
import {
  MaterialDataError, parseParameterRecord, serializeParameterRecord,
} from '../../../src/physics-next/materials/schema'

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

describe('strict material parameter records', () => {
  it('round trips canonical SI data, original reports, and metadata', () => {
    const input = example()
    const parsed = parseParameterRecord(input)
    expect(parsed.value.form).toBe('scalar')
    expect(parseParameterRecord(JSON.parse(serializeParameterRecord(parsed)))).toEqual(parsed)
    expect(Object.isFrozen(parsed.material)).toBe(true)
    expect(Object.isFrozen(parsed.citations)).toBe(true)
    expect(Object.isFrozen(input.material)).toBe(false)
  })
  it('preserves numeric zero rather than interpreting it as missing', () => {
    const parsed = parseParameterRecord(example({
      value: { form: 'scalar', quantity: q('bulkDensity', 0, 'kg/m3') },
    }))
    expect(parsed.value.form === 'scalar' && parsed.value.quantity.valueSI).toBe(0)
  })
  it('represents an explicit unknown without manufacturing a number', () => {
    const record = parseParameterRecord(example({
      value: { form: 'unknown', reason: 'Not measured.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'Missing measurement.',
        sourceGap: 'No source.', derivation: null },
      applicability: { state: 'unknown', bounds: [], categories: [], note: 'Not established.' },
    }))
    expect(record.value).toEqual({ form: 'unknown', reason: 'Not measured.' })
    expect(Object.hasOwn(record.value, 'quantity')).toBe(false)
  })
  for (const field of Object.keys(example())) {
    it(`rejects missing mandatory field ${field}`, () => {
      const raw: Record<string, unknown> = example()
      delete raw[field]
      rejected(() => parseParameterRecord(raw), 'FIELDS')
    })
  }
  it('rejects unknown top-level and nested fields', () => {
    rejected(() => parseParameterRecord(example({ surprise: true })), 'FIELDS')
    rejected(() => parseParameterRecord(example({
      material: { ...example().material, source: 'hidden-default' },
    })), 'FIELDS')
  })
  for (const wrong of [2, '1', null]) {
    it(`rejects version ${String(wrong)} without migration`, () => {
      rejected(() => parseParameterRecord(example({ version: wrong })), 'VERSION')
    })
  }
  it('rejects evidence claims that upgrade assumptions to observations', () => {
    rejected(() => parseParameterRecord(example({
      provenance: { status: 'assumed', claim: 'observation', rationale: 'Wrong.',
        sourceGap: 'No source.', derivation: null },
    })), 'CLAIM')
  })
  it('requires an explicit source gap and located measured evidence', () => {
    rejected(() => parseParameterRecord(example({
      provenance: { status: 'assumed', claim: 'model-assumption', rationale: 'Fixture.',
        sourceGap: null, derivation: null },
    })), 'SOURCE_GAP')
    rejected(() => parseParameterRecord(example({
      provenance: { status: 'measured', claim: 'observation', rationale: 'Unsupported.',
        sourceGap: 'Missing.', derivation: null },
    })), 'EVIDENCE')
    const citations = [{
      sourceId: 'src:manual:fixture', role: 'value',
      locator: { kind: 'table', value: '2, row 3' },
    }]
    const record = parseParameterRecord(example({
      provenance: { status: 'measured', claim: 'observation', rationale: 'Synthetic observation label.',
        sourceGap: null, derivation: null }, citations,
    }))
    expect(record.provenance.status).toBe('measured')
  })
  it('checks all six statuses and their distinct claims', () => {
    const statuses = [
      ['measured', 'observation'], ['estimated', 'estimate'], ['assumed', 'model-assumption'],
      ['fitted', 'fit'], ['derived', 'derivation'], ['unknown', 'unknown'],
    ]
    for (const [status, claim] of statuses) {
      const record = parseParameterRecord(example({
        value: status === 'unknown' ? { form: 'unknown', reason: 'Missing.' } : example().value,
        citations: [{ sourceId: 'src:manual:fixture', role: 'value',
          locator: { kind: 'lines', value: '1-2' } }],
        provenance: { status, claim, rationale: 'Synthetic test.',
          sourceGap: null, derivation: status === 'derived' ? {
            inputIds: ['parent-b', 'parent-a'], method: 'Documented external calculation.', expression: null,
          } : null },
      }))
      expect(record.provenance.status).toBe(status)
      if (status === 'derived')
        expect(record.provenance.derivation?.inputIds).toEqual(['parent-a', 'parent-b'])
    }
  })
  it('requires unknown status and value to agree in both directions', () => {
    rejected(() => parseParameterRecord(example({ value: { form: 'unknown', reason: 'Missing.' } })), 'UNKNOWN')
    rejected(() => parseParameterRecord(example({
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'Missing.',
        sourceGap: 'None.', derivation: null },
    })), 'UNKNOWN')
  })
  it('requires derivation inputs and rejects derivation metadata on assumptions', () => {
    rejected(() => parseParameterRecord(example({
      provenance: { status: 'derived', claim: 'derivation', rationale: 'Derived.',
        sourceGap: 'None.', derivation: { inputIds: [], method: 'External.', expression: null } },
    })), 'DERIVATION')
    rejected(() => parseParameterRecord(example({
      provenance: { status: 'assumed', claim: 'model-assumption', rationale: 'Fixture.',
        sourceGap: 'None.', derivation: { inputIds: ['a'], method: 'External.', expression: null } },
    })), 'DERIVATION')
  })
  it('does not infer units, kinds, or denominator basis', () => {
    rejected(() => parseParameterRecord(example({ quantityKind: 'density' })), 'KIND')
    rejected(() => parseParameterRecord(example({ quantityKind: 'particleDensity' })), 'QUANTITY')
    rejected(() => parseParameterRecord(example({ basis: 'wet mass per bulk volume' })), 'BASIS')
    rejected(() => parseParameterRecord(example({ value: { form: 'scalar', quantity: 135 } })), 'OBJECT')
  })
  it('rejects altered SI values, transforms, and units', () => {
    const original = q('bulkDensity', 0.135, 'g/cm3')
    for (const quantity of [
      { ...original, valueSI: 999 }, { ...original, unitSI: 'g/cm3' },
      { ...original, conversion: { ...original.conversion, valueOut: 999 } },
    ]) rejected(() => parseParameterRecord(example({ value: { form: 'scalar', quantity } })), 'QUANTITY')
  })
  it('preserves dry-basis moisture greater than 100 percent without converting saturation', () => {
    const parsed = parseParameterRecord(example({
      key: 'moisture', quantityKind: 'dryMassMoisture', basis: 'water per dry solid mass',
      value: { form: 'scalar', quantity: q('dryMassMoisture', 150, '%', 'water per dry solid mass') },
    }))
    expect(parsed.value.form === 'scalar' && parsed.value.quantity.valueSI).toBe(1.5)
  })
  it('accepts ordered ranges and refuses reversed ranges', () => {
    const range = { form: 'range', lower: q('bulkDensity', 100, 'kg/m3'),
      upper: q('bulkDensity', 160, 'kg/m3'), interpretation: 'assumed-bounds', note: 'Not data.' }
    expect(parseParameterRecord(example({ value: range })).value.form).toBe('range')
    rejected(() => parseParameterRecord(example({
      value: { ...range, lower: range.upper, upper: range.lower },
    })), 'RANGE')
  })
  it('prevents software guards from being recorded as measurements', () => {
    rejected(() => parseParameterRecord(example({
      value: { form: 'range', lower: q('bulkDensity', 100, 'kg/m3'), upper: q('bulkDensity', 200, 'kg/m3'),
        interpretation: 'software-guard', note: 'Support guard only.' },
      provenance: { status: 'measured', claim: 'observation', rationale: 'Wrong.',
        sourceGap: null, derivation: null },
      citations: [{ sourceId: 'src:manual:fixture', role: 'value', locator: { kind: 'page', value: '1' } }],
    })), 'CLAIM')
  })
  it('checks applicability bound order, basis, and duplicate axes', () => {
    const bounds = [{ axis: 'temperature', quantityKind: 'absoluteTemperature',
      lower: q('absoluteTemperature', 0, 'degC', 'specimen absolute temperature'),
      upper: q('absoluteTemperature', 300, 'K', 'specimen absolute temperature') }]
    const applicability = { state: 'specified', bounds, categories: [], note: 'Fixture.' }
    expect(parseParameterRecord(example({ applicability })).applicability.bounds.length).toBe(1)
    rejected(() => parseParameterRecord(example({
      applicability: { ...applicability, bounds: [...bounds, ...bounds] },
    })), 'DUPLICATE')
    rejected(() => parseParameterRecord(example({
      applicability: { ...applicability, bounds: [{ ...bounds[0], lower: bounds[0].upper, upper: bounds[0].lower }] },
    })), 'BOUND')
    rejected(() => parseParameterRecord(example({
      applicability: { ...applicability, state: 'unknown' },
    })), 'APPLICABILITY')
  })
  it('rejects missing applicability conditions, unbounded unknowns, and duplicate references', () => {
    rejected(() => parseParameterRecord(example({
      applicability: { state: 'specified', bounds: [], categories: [], note: 'Incomplete.' },
    })), 'APPLICABILITY')
    rejected(() => parseParameterRecord(example({
      applicability: { state: 'specified', bounds: [
        { axis: 'temperature', quantityKind: 'absoluteTemperature', lower: null, upper: null },
      ], categories: [], note: 'Unknown is not infinite support.' },
    })), 'BOUND')
    const c = { sourceId: 'src:manual:fixture', role: 'context', locator: { kind: 'whole-source', value: null } }
    rejected(() => parseParameterRecord(example({ citations: [c, c] })), 'DUPLICATE')
  })
  it('handles interval-valued temperature spread without an affine offset', () => {
    const basis = 'specimen absolute temperature'
    const value = { form: 'distribution', family: 'truncated-normal',
      lower: q('absoluteTemperature', 0, 'degC', basis), upper: q('absoluteTemperature', 40, 'degC', basis),
      location: q('absoluteTemperature', 20, 'degC', basis), scale: q('temperatureDifference', 3, 'delta_degC', basis),
      interpretation: 'epistemic', note: 'Invented distribution, not a fit.' }
    const parsed = parseParameterRecord(example({ quantityKind: 'absoluteTemperature', basis, value }))
    expect(parsed.value.form === 'distribution' && parsed.value.family === 'truncated-normal'
      && parsed.value.scale.valueSI).toBe(3)
    rejected(() => parseParameterRecord(example({
      quantityKind: 'absoluteTemperature', basis,
      value: { ...value, scale: q('absoluteTemperature', 3, 'degC', basis) },
    })))
  })
  it('checks distribution shape, support, mode, scale, and unsupported families', () => {
    const uniform = { form: 'distribution', family: 'uniform',
      lower: q('bulkDensity', 100, 'kg/m3'), upper: q('bulkDensity', 200, 'kg/m3'),
      interpretation: 'epistemic', note: 'Test metadata only.' }
    expect(parseParameterRecord(example({ value: uniform })).value.form).toBe('distribution')
    for (const value of [
      { ...uniform, family: 'lognormal' },
      { ...uniform, upper: uniform.lower },
      { ...uniform, family: 'triangular', mode: q('bulkDensity', 300, 'kg/m3') },
      { ...uniform, family: 'truncated-normal', location: q('bulkDensity', 150, 'kg/m3'),
        scale: q('bulkDensity', 0, 'kg/m3') },
      { ...uniform, samples: [1, 2] },
    ]) rejected(() => parseParameterRecord(example({ value })))
  })
  for (const bad of [NaN, Infinity, -Infinity, undefined, () => 1, 1n, Symbol('bad'), new Date(0)]) {
    it(`rejects non-JSON or nonfinite ${String(bad)}`, () => {
      rejected(() => parseParameterRecord(example({ notes: [bad] })))
    })
  }
  it('refuses getters without executing them', () => {
    let invoked = false
    const raw = example()
    Object.defineProperty(raw, 'notes', { enumerable: true, get() { invoked = true; return [] } })
    rejected(() => parseParameterRecord(raw), 'JSON')
    expect(invoked).toBe(false)
  })
  it('rejects cycles, sparse arrays, hidden properties, reserved keys, and custom objects', () => {
    const cycle: unknown[] = []; cycle.push(cycle)
    const sparse = new Array(1)
    const hidden = {}; Object.defineProperty(hidden, 'x', { value: 1 })
    const bads = [cycle, sparse, hidden, JSON.parse('{"__proto__":{}}'), Object.create({ x: 1 })]
    for (const bad of bads) rejected(() => parseParameterRecord(example({ notes: bad })))
  })
})
