import { describe, expect, it } from 'vitest'
import { parseReportedQuantity } from '../../../src/physics-next/materials/units'
import type { QuantityKind, SIValue } from '../../../src/physics-next/materials/units'
import { MaterialDataError, parseParameterRecord } from '../../../src/physics-next/materials/schema'
import { stableSourceId } from '../../../src/physics-next/materials/provenance'
import { MaterialRegistry } from '../../../src/physics-next/materials/registry'
import {
  exportEvidenceBundle, parseProjectionRequest, projectScalars,
} from '../../../src/physics-next/materials/adapters'

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

describe('fail-closed scalar projections', () => {
  it('returns SI scalars with complete original reports and declared assumption provenance', () => {
    const registry = new MaterialRegistry(setInput([example({
      value: { form: 'scalar', quantity: q('bulkDensity', 0.135, 'g/cm3') },
    })]))
    const result = project(registry)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.values.rho).toBe(135)
      expect(result.audit.evidence[0].provenance.status).toBe('assumed')
      expect(result.audit.evidence[0].value.form === 'scalar'
        && result.audit.evidence[0].value.quantity.reported.unit).toBe('g/cm3')
      expect(result.audit.set).toEqual({ id: 'fixture-set', revision: 1 })
      expect(result.audit.check).toBe('software-gates-only-not-physical-validation')
      expect(Object.isFrozen(result.values)).toBe(true)
    }
  })
  it('returns no partial numbers when any requested field is missing', () => {
    const raw = request()
    const result = project(new MaterialRegistry(setInput()), {
      ...raw, requirements: [...raw.requirements, { ...raw.requirements[0], field: 'other', key: 'missing' }],
    })
    refused(result, 'SELECTION_MISSING')
  })
  it('refuses unresolved conflicts and records explicit override decisions on success', () => {
    const records = [example({ id: 'a' }), example({ id: 'b' })]
    refused(project(new MaterialRegistry(setInput(records))), 'SELECTION_CONFLICT')
    const result = project(new MaterialRegistry(setInput(records, [decision()])))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.audit.decisions.map(d => d.decisionId)).toEqual(['decision-1'])
  })
  it('refuses explicit unknowns, ranges and distributions rather than selecting a nominal value', () => {
    const unknown = example({ value: { form: 'unknown', reason: 'Not measured.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'Missing.',
        sourceGap: 'No source.', derivation: null } })
    refused(project(new MaterialRegistry(setInput([unknown]))), 'SELECTION_UNKNOWN')
    const range = example({ value: { form: 'range', lower: q('bulkDensity', 100, 'kg/m3'),
      upper: q('bulkDensity', 200, 'kg/m3'), interpretation: 'assumed-bounds', note: 'Not a scalar.' } })
    refused(project(new MaterialRegistry(setInput([range]))), 'NONSCALAR')
    refused(project(new MaterialRegistry(setInput([{ ...distributed('a'), key: 'bulk-density' }]))), 'NONSCALAR')
  })
  it('separates quantity semantics even when both use kg/m3', () => {
    const registry = new MaterialRegistry(setInput([example({
      quantityKind: 'particleDensity', value: { form: 'scalar', quantity: q('particleDensity', 135, 'kg/m3') },
    })]))
    refused(project(registry), 'QUANTITY_KIND')
  })
  it('requires matching denominator basis instead of silently translating dry to wet density', () => {
    const basis = 'wet mass per bulk volume'
    const registry = new MaterialRegistry(setInput([example({ basis,
      value: { form: 'scalar', quantity: q('bulkDensity', 135, 'kg/m3', basis) },
    })]))
    refused(project(registry), 'BASIS')
  })
  it('requires explicitly accepted statuses and source gaps', () => {
    const registry = new MaterialRegistry(setInput())
    refused(project(registry, request({ policy: { ...request().policy, allowedStatuses: ['measured'] } })), 'PROVENANCE_STATUS')
    refused(project(registry, request({ policy: { ...request().policy, allowSourceGaps: false } })), 'SOURCE_GAP')
    refused(project(registry, request({ policy: { ...request().policy, requireLocatedValueCitation: true } })), 'VALUE_CITATION')
  })
  it('refuses citations as a substitute for an explicit missing-value-source note', () => {
    rejected(() => parseParameterRecord(example({
      citations: [{ sourceId: 'src:manual:fixture', role: 'context',
        locator: { kind: 'whole-source', value: null } }],
      provenance: { ...example().provenance, sourceGap: null },
    })), 'SOURCE_GAP')
  })
  it('requires source availability at the explicitly accepted evidence level', () => {
    const rawSource = source()
    const record = example({
      citations: [{ sourceId: rawSource.id, role: 'value', locator: { kind: 'table', value: '1' } }],
      provenance: { status: 'measured', claim: 'observation', rationale: 'Synthetic observation fixture only.',
        sourceGap: null, derivation: null },
    })
    const strict = request({ policy: {
      allowedStatuses: ['measured'], allowedSourceAvailability: ['full-text'],
      allowSourceGaps: false, requireLocatedValueCitation: true,
    } })
    refused(project(new MaterialRegistry(setInput([record], [], [rawSource])), strict), 'SOURCE_AVAILABILITY')
    const available = { ...rawSource, access: { ...rawSource.access, availability: 'full-text' } }
    const result = project(new MaterialRegistry(setInput([record], [], [available])), strict)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.audit.sources[0].id).toBe(rawSource.id)
    const transcribed = { ...rawSource, access: { ...rawSource.access, availability: 'baseline-transcription' } }
    refused(project(new MaterialRegistry(setInput([record], [], [transcribed])), strict), 'SOURCE_AVAILABILITY')
  })
  it('refuses unknown applicability, missing context and wrong categorical state', () => {
    const registry = new MaterialRegistry(setInput())
    refused(project(registry, request({ contexts: [] })), 'MISSING_CONTEXT')
    refused(project(new MaterialRegistry(setInput([example({
      applicability: { state: 'unknown', bounds: [], categories: [], note: 'Unestablished.' },
    })]))), 'APPLICABILITY_UNKNOWN')
    refused(project(registry, request({ contexts: [
      { material: example().material, quantities: [], categories: [{ axis: 'state', value: 'wet' }] },
    ] })), 'CATEGORY')
  })
  it('refuses different specimens and unsupported extra target axes', () => {
    const registry = new MaterialRegistry(setInput())
    refused(project(registry, request({ contexts: [
      { ...request().contexts[0], material: { ...example().material, specimenId: 'wrong-specimen' } },
    ] })), 'MATERIAL_IDENTITY')
    refused(project(registry, request({ contexts: [{
      ...request().contexts[0], quantities: [
        { axis: 'temperature', quantity: q('absoluteTemperature', 300, 'K', 'specimen temperature') },
      ],
    }] })), 'UNSUPPORTED_CONTEXT_AXIS')
  })
  it('requires consumer-specified axes even when the record has other applicability metadata', () => {
    const raw = request()
    refused(project(new MaterialRegistry(setInput()), {
      ...raw, requirements: [{ ...raw.requirements[0], requiredAxes: ['state', 'temperature'] }],
    }), 'REQUIRED_AXIS')
  })
  it('checks exact closed applicability bounds in Kelvin and matching temperature basis', () => {
    const basis = 'specimen absolute temperature'
    const registry = new MaterialRegistry(setInput([example({ applicability: {
      state: 'specified', bounds: [{ axis: 'temperature', quantityKind: 'absoluteTemperature',
        lower: q('absoluteTemperature', 0, 'degC', basis), upper: q('absoluteTemperature', 40, 'degC', basis) }],
      categories: [{ axis: 'state', value: 'dry' }], note: 'Test applicability only.',
    } })]))
    const at = (value: number, kind: QuantityKind = 'absoluteTemperature', unit = 'degC', b = basis) => request({
      contexts: [{ ...request().contexts[0], quantities: [{ axis: 'temperature', quantity: q(kind, value, unit, b) }] }],
    })
    expect(project(registry, at(0)).ok).toBe(true)
    expect(project(registry, at(40)).ok).toBe(true)
    refused(project(registry, at(40.001)), 'OUTSIDE_APPLICABILITY')
    refused(project(registry, at(20, 'temperatureDifference', 'delta_K')), 'CONTEXT_UNIT_OR_BASIS')
    refused(project(registry, at(20, 'absoluteTemperature', 'degC', 'different temperature reference')), 'CONTEXT_UNIT_OR_BASIS')
    refused(project(registry), 'MISSING_AXIS')
  })
  it('enforces inclusive/exclusive numerical consumer guards independently of evidence bounds', () => {
    const registry = new MaterialRegistry(setInput())
    const raw = request(), required = raw.requirements[0]
    refused(project(registry, { ...raw, requirements: [{ ...required, guard: {
      ...required.guard, lower: q('bulkDensity', 135, 'kg/m3'), lowerInclusive: false,
    } }] }), 'CONSUMER_GUARD')
    refused(project(registry, { ...raw, requirements: [{ ...required, guard: {
      ...required.guard, upper: q('bulkDensity', 134, 'kg/m3'),
    } }] }), 'CONSUMER_GUARD')
    expect(project(registry, { ...raw, requirements: [{ ...required, guard: {
      ...required.guard, lower: q('bulkDensity', 135, 'kg/m3'), upper: q('bulkDensity', 135, 'kg/m3'),
    } }] }).ok).toBe(true)
  })
  it('checks all derivation ancestors, rather than laundering assumptions as derived evidence', () => {
    const parent = example({ id: 'input', key: 'density-input' })
    const child = derived('output', ['input'])
    const registry = new MaterialRegistry(setInput([parent, child]))
    refused(project(registry, request({ policy: { ...request().policy, allowedStatuses: ['derived'] } })), 'PROVENANCE_STATUS')
    const result = project(registry, request({ policy: { ...request().policy, allowedStatuses: ['assumed', 'derived'] } }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.audit.evidence.map(r => r.id)).toEqual(['input', 'output'])
  })
  it('rejects derivations of unknown or nonscalar inputs, even when the output claims a scalar', () => {
    const parent = example({ id: 'input', key: 'density-input',
      value: { form: 'unknown', reason: 'Missing.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'Missing.',
        sourceGap: 'No data.', derivation: null } })
    const registry = new MaterialRegistry(setInput([parent, derived('output', ['input'])]))
    const result = project(registry, request({ policy: { ...request().policy, allowedStatuses: ['derived'] } }))
    refused(result, 'DEPENDENCY_SELECTION')
    refused(result, 'NONSCALAR')
  })
  it('rejects conflict-bearing or superseded dependency records instead of swapping operands', () => {
    const parent = example({ id: 'input', key: 'density-input' })
    const other = example({ id: 'new-input', key: 'density-input' })
    const records = [parent, other, derived('output', ['input'])]
    const raw = request({ policy: { ...request().policy, allowedStatuses: ['assumed', 'derived'] } })
    refused(project(new MaterialRegistry(setInput(records)), raw), 'DEPENDENCY_SELECTION')
    const override = { ...decision(['input', 'new-input'], 'new-input'), key: 'density-input' }
    refused(project(new MaterialRegistry(setInput(records, [override])), raw), 'STALE_DERIVATION')
  })
  it('requires separate context for a distinct-material derivation input', () => {
    const otherMaterial = { ...example().material, id: 'peat-b', specimenId: 'test-b' }
    const parent = example({ id: 'input', key: 'density-input', material: otherMaterial })
    const registry = new MaterialRegistry(setInput([parent, derived('output', ['input'])]))
    const raw = request({ policy: { ...request().policy, allowedStatuses: ['assumed', 'derived'] } })
    refused(project(registry, raw), 'MISSING_CONTEXT')
    expect(project(registry, { ...raw, contexts: [
      ...raw.contexts, { material: otherMaterial, quantities: [], categories: [{ axis: 'state', value: 'dry' }] },
    ] }).ok).toBe(true)
  })
  it('checks dependency applicability, not only the root parameter', () => {
    const parent = example({ id: 'input', key: 'density-input',
      applicability: { state: 'unknown', bounds: [], categories: [], note: 'No applicability data.' } })
    const registry = new MaterialRegistry(setInput([parent, derived('output', ['input'])]))
    refused(project(registry, request({ policy: { ...request().policy, allowedStatuses: ['assumed', 'derived'] } })), 'APPLICABILITY_UNKNOWN')
  })
  it('rejects missing policy fields, duplicate fields, ambiguous axes and reserved output names', () => {
    const raw = request()
    rejected(() => parseProjectionRequest({ ...raw, policy: {} }), 'FIELDS')
    rejected(() => parseProjectionRequest({ ...raw, requirements: [...raw.requirements, ...raw.requirements] }), 'DUPLICATE')
    rejected(() => parseProjectionRequest({ ...raw, requirements: [{ ...raw.requirements[0], field: 'constructor' }] }), 'FIELD')
    rejected(() => parseProjectionRequest({ ...raw, requirements: [] }), 'REQUIREMENTS')
    rejected(() => parseProjectionRequest({ ...raw, contexts: [...raw.contexts, ...raw.contexts] }), 'DUPLICATE')
    rejected(() => parseProjectionRequest({ ...raw, policy: { ...raw.policy, allowSourceGaps: 'true' } }), 'BOOLEAN')
    rejected(() => parseProjectionRequest({ ...raw, policy: { ...raw.policy, allowedStatuses: ['unknown'] } }), 'ENUM')
    rejected(() => parseProjectionRequest({ ...raw, policy: { ...raw.policy, allowedSourceAvailability: ['unknown'] } }), 'ENUM')
  })
  it('rejects incomplete guards or contradictory support bounds without defaults', () => {
    const raw = request(), req = raw.requirements[0]
    rejected(() => parseProjectionRequest({ ...raw, requirements: [{ ...req, guard: null }] }), 'OBJECT')
    rejected(() => parseProjectionRequest({ ...raw, requirements: [{ ...req, guard: {
      ...req.guard, lower: null, upper: null,
    } }] }), 'GUARD')
    rejected(() => parseProjectionRequest({ ...raw, requirements: [{ ...req, guard: {
      ...req.guard, lower: q('bulkDensity', 1000, 'kg/m3'),
    } }] }), 'GUARD')
  })
})
describe('metadata-only evidence exports', () => {
  it('retains all unresolved evidence and absent-property queries without a validation decision', () => {
    const registry = new MaterialRegistry(setInput([example({ id: 'a' }), example({ id: 'b' })]))
    const bundle = exportEvidenceBundle(registry, [query, { materialId: 'peat-a', key: 'missing' }], [])
    expect(bundle.set.records.length).toBe(2)
    expect(bundle.queryReport.conflicted).toBe(1)
    expect(bundle.queryReport.missing).toBe(1)
    expect(bundle.validation).toBe('not-evaluated')
    expect(Object.hasOwn(bundle, 'samples')).toBe(false)
    expect(Object.isFrozen(bundle.set.records)).toBe(true)
  })
  it('exports checked correlation metadata without proposing a sampler or an inferred copula', () => {
    const registry = new MaterialRegistry(setInput([distributed('a'), distributed('b')]))
    const bundle = exportEvidenceBundle(registry, [{ materialId: 'peat-a', key: 'density-a' }], [correlation()])
    expect(bundle.correlations[0].matrix[0][1]).toBe(0.5)
    expect(bundle.stochasticUse).toBe('metadata-only-no-samples-or-joint-distribution-approval')
    rejected(() => exportEvidenceBundle(registry, [], [correlation(), correlation()]), 'DUPLICATE')
  })
})

/** Static-only proof that literal field maps retain quantity brands and refusal exposes no values. */
function compileProjectionContracts() {
  const parsed = parseProjectionRequest(request())
  const typed = { ...parsed, requirements: [
    { ...parsed.requirements[0], field: 'rho', quantityKind: 'bulkDensity' },
  ] as const }
  const registry = new MaterialRegistry(setInput())
  const result = projectScalars(registry, typed)
  if (result.ok) {
    const density: SIValue<'bulkDensity'> = result.values.rho
    // @ts-expect-error a density projection is not a stress
    const stress: SIValue<'stress'> = result.values.rho
    // @ts-expect-error unspecified fields are not supplied by a literal spec
    const absent = result.values.unknownField
    void density; void stress; void absent
  } else {
    // @ts-expect-error refused projections have no partial numeric output
    const numbers = result.values
    void numbers
  }
}
void compileProjectionContracts
