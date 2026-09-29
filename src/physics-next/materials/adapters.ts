import { SI_UNITS, KIND_DIMENSIONS } from './units'
import type { QuantityKind, SIValue } from './units'
import {
  canonicalData, choice, copyData, fail, freezeData, identifier, keys, lexical, list,
  quantityKind, readMaterial, readQuantity, text, unique,
} from './schema'
import type {
  CategoryCondition, MaterialIdentity, ParameterRecord, ProvenanceStatus, Quantity,
} from './schema'
import { MaterialRegistry } from './registry'
import type { CompletenessReport, EvidenceOverride, ParameterSet } from './registry'
import type { SourceRecord } from './provenance'
import { parseCorrelation } from './distributions'
import type { CorrelationMetadata } from './distributions'

export interface NumericGuard {
  readonly lower: Quantity | null
  readonly upper: Quantity | null
  readonly lowerInclusive: boolean
  readonly upperInclusive: boolean
  /** Consumer support policy only, never an experimental applicability range. */
  readonly note: string
}
export interface ScalarRequirement {
  readonly field: string
  readonly key: string
  readonly quantityKind: QuantityKind
  readonly basis: string
  readonly requiredAxes: readonly string[]
  readonly guard: NumericGuard
}
export interface ProjectionContext {
  readonly material: MaterialIdentity
  readonly quantities: readonly Readonly<{ axis: string; quantity: Quantity }>[]
  readonly categories: readonly CategoryCondition[]
}
export type KnownProvenanceStatus = Exclude<ProvenanceStatus, 'unknown'>
export type ReadableSourceAvailability = 'full-text' | 'abstract-only' | 'baseline-transcription'
export interface ProjectionPolicy {
  readonly allowedStatuses: readonly KnownProvenanceStatus[]
  readonly allowedSourceAvailability: readonly ReadableSourceAvailability[]
  readonly allowSourceGaps: boolean
  readonly requireLocatedValueCitation: boolean
}
export interface ProjectionRequest<R extends readonly ScalarRequirement[] = readonly ScalarRequirement[]> {
  readonly format: 'zfs-scalar-projection-request'
  readonly version: 1
  readonly id: string
  readonly targetMaterialId: string
  readonly requirements: R
  readonly contexts: readonly ProjectionContext[]
  readonly policy: ProjectionPolicy
}
export interface ProjectionIssue {
  readonly field: string
  readonly recordId: string | null
  readonly code: string
  readonly detail: string
}
export type ProjectedValues<R extends readonly ScalarRequirement[]> =
  string extends R[number]['field']
    ? Readonly<Partial<Record<string, SIValue<QuantityKind>>>>
    : { readonly [P in R[number] as P['field']]: SIValue<P['quantityKind']> }
export interface ProjectionAudit {
  readonly check: 'software-gates-only-not-physical-validation'
  readonly request: ProjectionRequest
  readonly set: Readonly<{ id: string; revision: number }>
  readonly evidence: readonly ParameterRecord[]
  readonly sources: readonly SourceRecord[]
  readonly decisions: readonly EvidenceOverride[]
}
export type ProjectionResult<R extends readonly ScalarRequirement[]> =
  | Readonly<{ ok: false; issues: readonly ProjectionIssue[] }>
  | Readonly<{ ok: true; values: ProjectedValues<R>; audit: ProjectionAudit }>

function boolean(input: unknown, path: string): boolean {
  if (typeof input !== 'boolean') return fail('BOOLEAN', path, 'An explicit boolean is required.')
  return input
}
function readGuard(input: unknown, kind: QuantityKind, basis: string): NumericGuard {
  const v = keys(input, ['lower', 'upper', 'lowerInclusive', 'upperInclusive', 'note'], '$.guard')
  const lower = v.lower === null ? null : readQuantity(v.lower, kind, '$.guard.lower')
  const upper = v.upper === null ? null : readQuantity(v.upper, kind, '$.guard.upper')
  const lowerInclusive = boolean(v.lowerInclusive, '$.guard.lowerInclusive')
  const upperInclusive = boolean(v.upperInclusive, '$.guard.upperInclusive')
  if (!lower && !upper) fail('GUARD', '$.guard', 'At least one explicit consumer support bound is required.')
  if ((lower && lower.reported.basis !== basis) || (upper && upper.reported.basis !== basis))
    fail('BASIS', '$.guard', 'Support bounds must have the requested reporting basis.')
  if (lower && upper && (lower.valueSI > upper.valueSI
    || (lower.valueSI === upper.valueSI && !(lowerInclusive && upperInclusive))))
    fail('GUARD', '$.guard', 'Consumer support bounds are empty or reversed.')
  return { lower, upper, lowerInclusive, upperInclusive, note: text(v.note, '$.guard.note') }
}
function readContext(input: unknown): ProjectionContext {
  const v = keys(input, ['material', 'quantities', 'categories'], '$.context')
  const quantities = list(v.quantities, '$.context.quantities').map((item, i) => {
    const at = `$.context.quantities[${i}]`
    const q = keys(item, ['axis', 'quantity'], at)
    const raw = keys(q.quantity, ['format', 'version', 'kind', 'valueSI', 'unitSI', 'reported', 'conversion'], at)
    const kind = quantityKind(raw.kind, `${at}.quantity.kind`)
    return { axis: identifier(q.axis, `${at}.axis`), quantity: readQuantity(q.quantity, kind, at) }
  })
  const categories = list(v.categories, '$.context.categories').map((item, i) => {
    const at = `$.context.categories[${i}]`, c = keys(item, ['axis', 'value'], at)
    return { axis: identifier(c.axis, `${at}.axis`), value: text(c.value, `${at}.value`) }
  })
  unique([...quantities, ...categories].map(x => x.axis), '$.context.axes')
  return {
    material: readMaterial(v.material, '$.context.material'),
    quantities: quantities.sort((a, b) => lexical(a.axis, b.axis)),
    categories: categories.sort((a, b) => lexical(a.axis, b.axis)),
  }
}
/** Runtime JSON boundary. No guessed material, unit, consumer field or acceptance policy. */
export function parseProjectionRequest(input: unknown): ProjectionRequest {
  const v = keys(copyData(input), [
    'format', 'version', 'id', 'targetMaterialId', 'requirements', 'contexts', 'policy',
  ], '$')
  if (v.format !== 'zfs-scalar-projection-request' || v.version !== 1)
    fail('VERSION', '$', 'Unsupported projection-request format/version.')
  const requirements = list(v.requirements, '$.requirements').map((item, i): ScalarRequirement => {
    const at = `$.requirements[${i}]`
    const r = keys(item, ['field', 'key', 'quantityKind', 'basis', 'requiredAxes', 'guard'], at)
    const field = text(r.field, `${at}.field`)
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field) || ['constructor', 'prototype'].includes(field))
      fail('FIELD', at, 'Provide an explicit nonreserved consumer field name.')
    const kind = quantityKind(r.quantityKind, `${at}.quantityKind`)
    const basis = text(r.basis, `${at}.basis`)
    const requiredAxes = list(r.requiredAxes, `${at}.requiredAxes`).map((x, j) => identifier(x, `${at}.requiredAxes[${j}]`))
    unique(requiredAxes, `${at}.requiredAxes`)
    return {
      field, key: identifier(r.key, `${at}.key`), quantityKind: kind, basis,
      requiredAxes: requiredAxes.sort(lexical), guard: readGuard(r.guard, kind, basis),
    }
  }).sort((a, b) => lexical(a.field, b.field))
  if (!requirements.length) fail('REQUIREMENTS', '$', 'At least one explicit field requirement is required.')
  unique(requirements.map(r => r.field), '$.requirements.fields')
  const contexts = list(v.contexts, '$.contexts').map(readContext)
    .sort((a, b) => lexical(a.material.id, b.material.id))
  unique(contexts.map(c => c.material.id), '$.contexts.materials')
  const p = keys(v.policy, [
    'allowedStatuses', 'allowedSourceAvailability', 'allowSourceGaps', 'requireLocatedValueCitation',
  ], '$.policy')
  const allowedStatuses = list(p.allowedStatuses, '$.policy.allowedStatuses').map(x => choice(x, [
    'measured', 'estimated', 'assumed', 'fitted', 'derived',
  ], '$.policy.allowedStatuses')).sort(lexical)
  const allowedSourceAvailability = list(p.allowedSourceAvailability, '$.policy.allowedSourceAvailability')
    .map(x => choice(x, ['full-text', 'abstract-only', 'baseline-transcription'], '$.policy.allowedSourceAvailability')).sort(lexical)
  unique(allowedStatuses, '$.policy.allowedStatuses')
  unique(allowedSourceAvailability, '$.policy.allowedSourceAvailability')
  if (!allowedStatuses.length) fail('POLICY', '$.policy', 'No usable provenance statuses were explicitly accepted.')
  return freezeData({
    format: 'zfs-scalar-projection-request', version: 1,
    id: identifier(v.id, '$.id'), targetMaterialId: identifier(v.targetMaterialId, '$.targetMaterialId'),
    requirements, contexts, policy: {
      allowedStatuses, allowedSourceAvailability,
      allowSourceGaps: boolean(p.allowSourceGaps, '$.policy.allowSourceGaps'),
      requireLocatedValueCitation: boolean(p.requireLocatedValueCitation, '$.policy.requireLocatedValueCitation'),
    },
  })
}

type IssueSink = (code: string, detail: string) => void
function checkApplicability(
  record: ParameterRecord, context: ProjectionContext | undefined,
  requiredAxes: readonly string[], issue: IssueSink,
): void {
  if (!context) { issue('MISSING_CONTEXT', 'Supply explicit state for this material, including derivation inputs.'); return }
  if (canonicalData(context.material) !== canonicalData(record.material))
    issue('MATERIAL_IDENTITY', 'Context identity differs from the evidence material/specimen.')
  const applicability = record.applicability
  if (applicability.state === 'unknown') { issue('APPLICABILITY_UNKNOWN', 'Applicability is explicitly unknown.'); return }
  const evidenceAxes = new Set([...applicability.bounds, ...applicability.categories].map(x => x.axis))
  const contextAxes = new Set([...context.quantities, ...context.categories].map(x => x.axis))
  for (const axis of requiredAxes) {
    if (!evidenceAxes.has(axis) || !contextAxes.has(axis))
      issue('REQUIRED_AXIS', `Consumer-required axis ${axis} lacks evidence or target context.`)
  }
  // Conservative: extra target state is not silently treated as unrestricted.
  for (const axis of contextAxes) if (!evidenceAxes.has(axis))
    issue('UNSUPPORTED_CONTEXT_AXIS', `Evidence has no applicability statement for ${axis}.`)
  for (const condition of applicability.categories) {
    const target = context.categories.find(c => c.axis === condition.axis)
    if (!target || target.value !== condition.value)
      issue('CATEGORY', `Required categorical condition ${condition.axis} does not match.`)
  }
  for (const bound of applicability.bounds) {
    const target = context.quantities.find(q => q.axis === bound.axis)?.quantity
    if (!target) { issue('MISSING_AXIS', `No target quantity for ${bound.axis}.`); continue }
    const basis = (bound.lower ?? bound.upper)!.reported.basis
    if (target.kind !== bound.quantityKind || target.reported.basis !== basis) {
      issue('CONTEXT_UNIT_OR_BASIS', `Target ${bound.axis} has a different quantity kind or reference basis.`)
      continue
    }
    if ((bound.lower && target.valueSI < bound.lower.valueSI)
      || (bound.upper && target.valueSI > bound.upper.valueSI))
      issue('OUTSIDE_APPLICABILITY', `Target ${bound.axis} lies outside the recorded closed bounds.`)
  }
}
function checkEvidence(
  registry: MaterialRegistry, record: ParameterRecord, policy: ProjectionPolicy, issue: IssueSink,
): void {
  if (record.provenance.status === 'unknown'
    || !policy.allowedStatuses.includes(record.provenance.status))
    issue('PROVENANCE_STATUS', `Status ${record.provenance.status} is not accepted by the explicit consumer policy.`)
  if (record.provenance.sourceGap !== null && !policy.allowSourceGaps)
    issue('SOURCE_GAP', 'The record retains a source gap which the consumer did not accept.')
  if (policy.requireLocatedValueCitation && !record.citations.some(
    c => c.role === 'value' && c.locator.kind !== 'whole-source',
  )) issue('VALUE_CITATION', 'A located value source is required by the consumer.')
  for (const citation of record.citations.filter(c => c.role !== 'context')) {
    const source = registry.getSource(citation.sourceId)!
    const availability = source.access.availability
    if (availability === 'unknown' || availability === 'unavailable'
      || !policy.allowedSourceAvailability.includes(availability))
      issue('SOURCE_AVAILABILITY', `Supporting source ${source.id} is not available at an accepted evidence level.`)
  }
}

/**
 * Build a typed SI field map only after all requested scalars AND their exact
 * dependency evidence pass the declared gates. No partial numeric output on refusal.
 * The supplied field specification is F-owned data, not a guessed A/B contract.
 * Malformed input throws; a well-formed but inadmissible request returns ok:false.
 */
export function projectScalars<const R extends readonly ScalarRequirement[]>(
  registry: MaterialRegistry, input: ProjectionRequest<R>,
): ProjectionResult<R> {
  if (!(registry instanceof MaterialRegistry))
    return fail('REGISTRY', '$.registry', 'Expected an immutable parsed registry.')
  const request = parseProjectionRequest(input)
  const contexts = new Map(request.contexts.map(c => [c.material.id, c]))
  const issues: ProjectionIssue[] = []
  const values: Record<string, SIValue<QuantityKind>> = {}
  const used = new Map<string, ParameterRecord>()
  const decisions = new Map<string, EvidenceOverride>()
  for (const requirement of request.requirements) {
    const selected = registry.select({ materialId: request.targetMaterialId, key: requirement.key })
    const rootId = selected.state === 'selected' || selected.state === 'unknown' ? selected.record.id : null
    const rootIssue = (code: string, detail: string) => issues.push({
      field: requirement.field, recordId: rootId, code, detail,
    })
    if (selected.state !== 'selected') {
      rootIssue(`SELECTION_${selected.state.toUpperCase()}`, 'No unambiguous known record is selected for this field.')
      continue
    }
    const record = selected.record
    if (record.quantityKind !== requirement.quantityKind) rootIssue('QUANTITY_KIND', 'Selected evidence has the wrong quantity kind.')
    if (record.basis !== requirement.basis) rootIssue('BASIS', 'Selected evidence has the wrong reporting basis.')
    const nodes = [...registry.dependencies(record.id), record]
    for (const node of nodes) {
      used.set(node.id, node)
      const issue = (code: string, detail: string) => issues.push({
        field: requirement.field, recordId: node.id, code, detail,
      })
      const nodeSelection = registry.select({ materialId: node.material.id, key: node.key })
      if (nodeSelection.state !== 'selected')
        issue('DEPENDENCY_SELECTION', 'An exact derivation input is unknown or has an unresolved evidence conflict.')
      else if (nodeSelection.record.id !== node.id)
        issue('STALE_DERIVATION', 'The derivation uses evidence superseded by the current explicit selection.')
      if (nodeSelection.state === 'selected' && nodeSelection.decision)
        decisions.set(nodeSelection.decision.decisionId, nodeSelection.decision)
      if (node.value.form !== 'scalar')
        issue('NONSCALAR', 'Only scalar inputs may enter a scalar projection; no midpoint, draw or fit is inferred.')
      checkEvidence(registry, node, request.policy, issue)
      checkApplicability(node, contexts.get(node.material.id),
        node.id === record.id ? requirement.requiredAxes : [], issue)
    }
    if (record.value.form === 'scalar') {
      const q = record.value.quantity
      if (q.unitSI !== SI_UNITS[KIND_DIMENSIONS[requirement.quantityKind]])
        rootIssue('UNIT_SI', 'Output is not in the explicitly requested canonical SI unit.')
      const g = requirement.guard
      if ((g.lower && (q.valueSI < g.lower.valueSI || (!g.lowerInclusive && q.valueSI === g.lower.valueSI)))
        || (g.upper && (q.valueSI > g.upper.valueSI || (!g.upperInclusive && q.valueSI === g.upper.valueSI))))
        rootIssue('CONSUMER_GUARD', 'Scalar is outside explicitly declared consumer support bounds.')
      values[requirement.field] = q.valueSI
    }
  }
  if (issues.length) {
    const uniqueIssues = [...new Map(issues.map(i => [canonicalData(i), i])).values()]
      .sort((a, b) => lexical(canonicalData(a), canonicalData(b)))
    return freezeData({ ok: false, issues: uniqueIssues })
  }
  const evidence = [...used.values()].sort((a, b) => lexical(a.id, b.id))
  const sourceIds = [...new Set(evidence.flatMap(r => r.citations.map(c => c.sourceId)))].sort(lexical)
  return freezeData({
    ok: true, values: values as ProjectedValues<R>,
    audit: {
      check: 'software-gates-only-not-physical-validation', request,
      set: { id: registry.snapshot.id, revision: registry.snapshot.revision },
      evidence, sources: sourceIds.map(id => registry.getSource(id)!),
      decisions: [...decisions.values()].sort((a, b) => lexical(a.decisionId, b.decisionId)),
    },
  })
}

export interface EvidenceBundle {
  readonly format: 'zfs-material-evidence-bundle'
  readonly version: 1
  readonly set: ParameterSet
  readonly queryReport: CompletenessReport
  readonly correlations: readonly CorrelationMetadata[]
  readonly validation: 'not-evaluated'
  readonly stochasticUse: 'metadata-only-no-samples-or-joint-distribution-approval'
}
/**
 * C-facing neutral data envelope: includes unresolved candidates and explicit
 * unknowns. It performs no C-specific validation, fitting or statistical decisions.
 * Supply [] explicitly when no correlation metadata is being exported.
 */
export function exportEvidenceBundle(
  registry: MaterialRegistry, queries: unknown, rawCorrelations: unknown,
): EvidenceBundle {
  if (!(registry instanceof MaterialRegistry))
    return fail('REGISTRY', '$.registry', 'Expected an immutable parsed registry.')
  const queryReport = registry.completeness(queries)
  const correlations = list(copyData(rawCorrelations), '$.correlations')
    .map(c => parseCorrelation(c, registry)).sort((a, b) => lexical(a.id, b.id))
  unique(correlations.map(c => c.id), '$.correlations')
  return freezeData({
    format: 'zfs-material-evidence-bundle', version: 1, set: registry.snapshot,
    queryReport, correlations, validation: 'not-evaluated',
    stochasticUse: 'metadata-only-no-samples-or-joint-distribution-approval',
  })
}
