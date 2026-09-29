import { describe, expect, it } from 'vitest'
import * as materials from '../../../src/physics-next/materials'
import {
  MaterialDataError, MaterialRegistry, parseReportedQuantity, parseParameterRecord,
  parseProjectionRequest, projectScalars, exportEvidenceBundle, appendRegistry,
} from '../../../src/physics-next/materials'
import type { QuantityKind } from '../../../src/physics-next/materials'

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
function decision(candidates = ['a', 'b'], selectedId = 'b') {
  return {
    materialId: 'peat-a', key: 'bulk-density', decisionId: 'decision-1',
    candidateIds: candidates, selectedId, reason: 'Explicit software test selection.', decidedBy: 'Test fixture',
  }
}
const query = { materialId: 'peat-a', key: 'bulk-density' }

function request(overrides: Record<string, unknown> = {}) {
  return {
    format: 'zfs-scalar-projection-request', version: 1, id: 'fixture-projection',
    targetMaterialId: 'peat-a', requirements: [{
      field: 'rho', key: 'bulk-density', quantityKind: 'bulkDensity', basis: 'dry mass per bulk volume',
      requiredAxes: ['state'], guard: {
        lower: q('bulkDensity', 1, 'kg/m3'), upper: q('bulkDensity', 500, 'kg/m3'),
        lowerInclusive: true, upperInclusive: true, note: 'Synthetic consumer guard, not an experimental range.',
      },
    }],
    contexts: [{ material: example().material, quantities: [], categories: [{ axis: 'state', value: 'dry' }] }],
    policy: { allowedStatuses: ['assumed'], allowedSourceAvailability: [],
      allowSourceGaps: true, requireLocatedValueCitation: false }, ...overrides,
  }
}
function project(registry: MaterialRegistry, input: unknown = request()) {
  return projectScalars(registry, parseProjectionRequest(input))
}
function refused(result: ReturnType<typeof project>, code: string) {
  expect(result.ok).toBe(false)
  expect(Object.hasOwn(result, 'values')).toBe(false)
  if (!result.ok) expect(result.issues.some(i => i.code === code)).toBe(true)
}

describe('public material API and standalone handoff smoke tests', () => {
  it('exports the intentional API and not raw parsing/freeze helpers or defaults', () => {
    expect(Object.keys(materials).sort()).toEqual([
      'UNIT_CATALOG_VERSION', 'DIMENSIONS', 'KIND_DIMENSIONS', 'UNITS', 'SI_UNITS',
      'UnitError', 'convertValue', 'parseReportedQuantity', 'normalizeQuantity',
      'PARAMETER_FORMAT_VERSION', 'PROVENANCE_CLAIMS', 'MaterialDataError',
      'parseParameterRecord', 'serializeParameterRecord', 'SOURCE_FORMAT_VERSION',
      'stableSourceId', 'parseSourceRecord', 'buildEvidenceGraph',
      'MATERIAL_SET_FORMAT_VERSION', 'MaterialRegistry', 'appendRegistry',
      'CORRELATION_PSD_TOLERANCE_PER_DIMENSION', 'describeDistribution', 'parseCorrelation',
      'parseProjectionRequest', 'projectScalars', 'exportEvidenceBundle',
    ].sort())
    expect(Object.hasOwn(materials, 'DEFAULT_MATERIALS')).toBe(false)
    expect(Object.hasOwn(materials, 'copyData')).toBe(false)
  })
  it('round trips reports through registry and projection with all provenance still visible', () => {
    const record = parseParameterRecord(example())
    const registry = new MaterialRegistry(setInput([record]))
    const reloaded = new MaterialRegistry(JSON.parse(registry.serialize()))
    const result = project(reloaded)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.values.rho).toBe(135)
      expect(result.audit.evidence[0]).toEqual(record)
      expect(result.audit.request.policy.allowSourceGaps).toBe(true)
    }
    const evidence = exportEvidenceBundle(reloaded, [query], [])
    expect(evidence.validation).toBe('not-evaluated')
    expect(evidence.queryReport.selected).toBe(1)
  })
  it('adds evidence as a conflict until a separately identified revision explicitly selects it', () => {
    const first = new MaterialRegistry(setInput([example({ id: 'a' })]))
    const second = appendRegistry(first, { records: [example({ id: 'b' })], sources: [], overrides: [] })
    refused(project(second), 'SELECTION_CONFLICT')
    const third = appendRegistry(second, { records: [], sources: [], overrides: [decision()] })
    expect(project(third).ok).toBe(true)
    expect(third.snapshot.revision).toBe(3)
    expect(first.snapshot.records.length).toBe(1)
    expect(second.conflicts().length).toBe(1)
  })
  it('rejects malformed persisted data without changing a parsed registry', () => {
    const registry = new MaterialRegistry(setInput())
    const before = registry.serialize()
    rejected(() => new MaterialRegistry({ ...registry.snapshot, revision: 99 }), 'LINEAGE')
    expect(registry.serialize()).toBe(before)
  })
})
