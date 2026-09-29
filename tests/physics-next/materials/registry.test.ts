import { describe, expect, it } from 'vitest'
import { parseReportedQuantity } from '../../../src/physics-next/materials/units'
import type { QuantityKind } from '../../../src/physics-next/materials/units'
import { MaterialDataError } from '../../../src/physics-next/materials/schema'
import { stableSourceId } from '../../../src/physics-next/materials/provenance'
import { MaterialRegistry, appendRegistry } from '../../../src/physics-next/materials/registry'

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

function source(value = 'fixture', overrides: Record<string, unknown> = {}) {
  const identity = { scheme: 'manual', value }
  return {
    format: 'zfs-material-source', version: 1, id: stableSourceId(identity), identity,
    citation: { authors: [], title: 'Synthetic software fixture', published: null,
      container: null, doi: null, url: null },
    access: { retrievedOn: null, availability: 'unknown', note: 'No external source retrieved.' },
    license: { identifier: null, note: 'No license is asserted.' },
    notes: ['Not experimental evidence.'], ...overrides,
  }
}
function derived(id: string, inputs: string[]) {
  return example({ id, provenance: {
    status: 'derived', claim: 'derivation', rationale: 'Synthetic external calculation.',
    sourceGap: 'No direct citation.', derivation: {
      inputIds: inputs, method: 'Test graph only; no arithmetic evaluated.', expression: 'descriptive only',
    },
  } })
}

function setInput(records: unknown[] = [example()], overrides: unknown[] = [], sources: unknown[] = []) {
  return { format: 'zfs-material-set', version: 1, id: 'fixture-set', revision: 1, parent: null,
    records, sources, overrides }
}
function decision(candidates = ['a', 'b'], selectedId = 'b') {
  return {
    materialId: 'peat-a', key: 'bulk-density', decisionId: 'decision-1',
    candidateIds: candidates, selectedId, reason: 'Explicit software test selection.', decidedBy: 'Test fixture',
  }
}
const query = { materialId: 'peat-a', key: 'bulk-density' }

describe('immutable versioned material registry', () => {

  it('requires a new decision ID for changed choices in an appended revision', () => {
    const before = new MaterialRegistry(setInput(
      [example({ id: 'a' }), example({ id: 'b' })], [decision()],
    ))
    rejected(() => appendRegistry(before, {
      records: [], sources: [], overrides: [decision(['a', 'b'], 'a')],
    }), 'DECISION_IDENTITY')
    const after = appendRegistry(before, {
      records: [], sources: [], overrides: [{ ...decision(['a', 'b'], 'a'), decisionId: 'decision-2' }],
    })
    const chosen = after.select(query)
    expect(chosen.state === 'selected' && chosen.record.id).toBe('a')
    const original = before.select(query)
    expect(original.state === 'selected' && original.record.id).toBe('b')
  })

  it('detaches and freezes values, preserving canonical JSON round trips', () => {
    const raw = setInput()
    const registry = new MaterialRegistry(raw)
    raw.records.length = 0
    expect(registry.snapshot.records.length).toBe(1)
    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.snapshot.records[0].value)).toBe(true)
    expect(new MaterialRegistry(JSON.parse(registry.serialize())).snapshot).toEqual(registry.snapshot)
  })
  it('keeps competing evidence and exposes conflicts regardless of insertion order or equal values', () => {
    const a = example({ id: 'a' }), b = example({ id: 'b' })
    const first = new MaterialRegistry(setInput([b, a]))
    const second = new MaterialRegistry(setInput([a, b]))
    expect(first.serialize()).toBe(second.serialize())
    expect(first.select(query)).toEqual({ ...query, state: 'conflict', candidateIds: ['a', 'b'] })
    expect(first.conflicts().length).toBe(1)
    expect(first.snapshot.records.length).toBe(2)
  })
  it('accepts only a documented selection acknowledging every candidate', () => {
    const registry = new MaterialRegistry(setInput(
      [example({ id: 'a' }), example({ id: 'b' })], [decision()],
    ))
    const result = registry.select(query)
    expect(result.state).toBe('selected')
    expect(result.state === 'selected' && result.record.id).toBe('b')
    expect(result.state === 'selected' && result.decision?.reason).toBe('Explicit software test selection.')
    expect(registry.conflicts()).toEqual([])
  })
  it('refuses stale candidate lists, unsupported winners, duplicate decisions and missing reasons', () => {
    const records = [example({ id: 'a' }), example({ id: 'b' })]
    rejected(() => new MaterialRegistry(setInput(records, [decision(['a'])])), 'STALE_OVERRIDE')
    rejected(() => new MaterialRegistry(setInput(records, [decision(['a', 'b'], 'c')])), 'OVERRIDE')
    rejected(() => new MaterialRegistry(setInput(records, [decision(), decision()])), 'DUPLICATE')
    rejected(() => new MaterialRegistry(setInput(records, [{ ...decision(), reason: '' }])), 'TEXT')
    rejected(() => new MaterialRegistry(setInput([example({ id: 'a' })], [decision(['a'], 'a')])), 'OVERRIDE')
  })
  it('never lets an override mask incompatible quantity semantics', () => {
    const b = example({ id: 'b', quantityKind: 'particleDensity',
      value: { form: 'scalar', quantity: q('particleDensity', 1500, 'kg/m3') } })
    const records = [example({ id: 'a' }), b]
    expect(new MaterialRegistry(setInput(records)).select(query).state).toBe('conflict')
    rejected(() => new MaterialRegistry(setInput(records, [decision()])), 'SEMANTIC_CONFLICT')
  })
  it('retains explicit unknowns and never fills absent properties', () => {
    const unknown = example({ id: 'unknown', key: 'unmeasured',
      value: { form: 'unknown', reason: 'No measurement.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'No data.',
        sourceGap: 'Absent.', derivation: null } })
    const registry = new MaterialRegistry(setInput([example(), unknown]))
    const report = registry.completeness([
      query, { materialId: 'peat-a', key: 'unmeasured' }, { materialId: 'peat-a', key: 'absent' },
    ])
    expect([report.requested, report.selected, report.unknown, report.missing, report.conflicted]).toEqual([3, 1, 1, 1, 0])
    expect(registry.getRecord('absent')).toBe(undefined)
    expect(registry.select({ materialId: 'peat-b', key: 'bulk-density' }).state).toBe('missing')
    rejected(() => registry.completeness([query, query]), 'DUPLICATE')
  })
  it('allows a deliberately selected unknown to remain unknown', () => {
    const unknown = example({ id: 'b', value: { form: 'unknown', reason: 'Safer to leave unknown.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'No data.',
        sourceGap: 'Absent.', derivation: null } })
    const registry = new MaterialRegistry(setInput([example({ id: 'a' }), unknown], [decision()]))
    expect(registry.select(query).state).toBe('unknown')
  })
  it('appends a new revision without replacing the prior one', () => {
    const before = new MaterialRegistry(setInput([example({ id: 'a' })]))
    const serialized = before.serialize()
    const after = appendRegistry(before, { records: [example({ id: 'b' })], sources: [], overrides: [decision()] })
    expect(before.serialize()).toBe(serialized)
    expect(after.snapshot.revision).toBe(2)
    expect(after.snapshot.parent).toEqual({ id: 'fixture-set', revision: 1 })
    expect(after.snapshot.records.map(r => r.id)).toEqual(['a', 'b'])
    expect(after.select(query).state).toBe('selected')
    expect(before.getRecord('b')).toBe(undefined)
  })
  it('rejects replacing an immutable record ID or source identity on append', () => {
    const before = new MaterialRegistry(setInput([example()], [], [source()]))
    rejected(() => appendRegistry(before, { records: [example()], sources: [], overrides: [] }), 'DUPLICATE')
    rejected(() => appendRegistry(before, { records: [], sources: [source()], overrides: [] }), 'DUPLICATE')
  })
  it('requires refreshed decisions after new conflicting evidence arrives', () => {
    const before = new MaterialRegistry(setInput(
      [example({ id: 'a' }), example({ id: 'b' })], [decision()],
    ))
    rejected(() => appendRegistry(before, {
      records: [example({ id: 'c' })], sources: [], overrides: [decision()],
    }), 'STALE_OVERRIDE')
    const after = appendRegistry(before, { records: [example({ id: 'c' })], sources: [], overrides: [] })
    expect(after.select(query).state).toBe('conflict')
    expect(before.select(query).state).toBe('selected')
  })
  it('checks material identity consistency instead of conflating specimens', () => {
    rejected(() => new MaterialRegistry(setInput([example(), example({
      id: 'other', key: 'other-key', material: { ...example().material, specimenId: 'different-specimen' },
    })])), 'MATERIAL_IDENTITY')
  })
  it('queries direct and transitive dependencies without evaluating calculations', () => {
    const registry = new MaterialRegistry(setInput([
      example({ id: 'a' }), derived('b', ['a']), derived('c', ['b']),
    ]))
    expect(registry.dependencies('c').map(r => r.id)).toEqual(['a', 'b'])
    expect(registry.dependencies('c', false).map(r => r.id)).toEqual(['b'])
    expect(registry.dependencies('a')).toEqual([])
    rejected(() => registry.dependencies('missing'), 'MISSING_RECORD')
  })
  it('requires sound version lineage and strict JSON fields', () => {
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
      rejected(() => new MaterialRegistry({ ...setInput(), revision }))
    }
    rejected(() => new MaterialRegistry({ ...setInput(), revision: 2 }), 'LINEAGE')
    rejected(() => new MaterialRegistry({ ...setInput(), revision: 2, parent: { id: 'other', revision: 1 } }), 'LINEAGE')
    rejected(() => new MaterialRegistry({ ...setInput(), revision: 4, parent: { id: 'fixture-set', revision: 1 } }), 'LINEAGE')
    rejected(() => new MaterialRegistry({ ...setInput(), version: 2 }), 'VERSION')
    rejected(() => new MaterialRegistry({ ...setInput(), defaultValue: 0 }), 'FIELDS')
  })
  it('uses tuple keys without accidental identifier-separator collisions', () => {
    const one = example({ id: 'a', material: { ...example().material, id: 'a:b' }, key: 'c' })
    const two = example({ id: 'b', material: { ...example().material, id: 'a' }, key: 'b:c' })
    const registry = new MaterialRegistry(setInput([one, two]))
    expect(registry.select({ materialId: 'a:b', key: 'c' }).state).toBe('selected')
    expect(registry.select({ materialId: 'a', key: 'b:c' }).state).toBe('selected')
  })
})
