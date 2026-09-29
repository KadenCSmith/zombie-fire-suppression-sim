import {
  canonicalData, copyData, fail, freezeData, identifier, keys, lexical, list,
  number, text, unique,
} from './schema'
import type { ParameterRecord } from './schema'
import { buildEvidenceGraph } from './provenance'
import type { EvidenceGraph, SourceRecord } from './provenance'

export const MATERIAL_SET_FORMAT_VERSION = 1 as const

export interface ParameterQuery { readonly materialId: string; readonly key: string }
export interface EvidenceOverride extends ParameterQuery {
  readonly decisionId: string
  readonly selectedId: string
  /** Exact candidate list acknowledged by the decision; new evidence makes it stale. */
  readonly candidateIds: readonly string[]
  readonly reason: string
  readonly decidedBy: string
}
export interface ParameterSet {
  readonly format: 'zfs-material-set'
  readonly version: typeof MATERIAL_SET_FORMAT_VERSION
  readonly id: string
  readonly revision: number
  readonly parent: Readonly<{ id: string; revision: number }> | null
  readonly records: readonly ParameterRecord[]
  readonly sources: readonly SourceRecord[]
  readonly overrides: readonly EvidenceOverride[]
}
export type Selection =
  | (ParameterQuery & Readonly<{ state: 'missing' }>)
  | (ParameterQuery & Readonly<{ state: 'conflict'; candidateIds: readonly string[] }>)
  | (ParameterQuery & Readonly<{
    state: 'selected' | 'unknown'; record: ParameterRecord; decision: EvidenceOverride | null
  }>)
export interface CompletenessReport {
  readonly requested: number
  readonly selected: number
  readonly missing: number
  readonly unknown: number
  readonly conflicted: number
  readonly items: readonly Selection[]
}

function positiveRevision(input: unknown, path: string): number {
  const revision = number(input, path)
  if (!Number.isSafeInteger(revision) || revision < 1)
    return fail('REVISION', path, 'Revision must be a positive safe integer.')
  return revision
}
function query(input: unknown): ParameterQuery {
  const v = keys(copyData(input), ['materialId', 'key'], '$.query')
  return { materialId: identifier(v.materialId, '$.query.materialId'), key: identifier(v.key, '$.query.key') }
}
/** JSON tuple avoids separator collisions in caller-chosen IDs and property keys. */
function slot(value: ParameterQuery): string { return JSON.stringify([value.materialId, value.key]) }
function recordQuery(record: ParameterRecord): ParameterQuery {
  return { materialId: record.material.id, key: record.key }
}
function readOverride(input: unknown): EvidenceOverride {
  const v = keys(input, [
    'materialId', 'key', 'decisionId', 'selectedId', 'candidateIds', 'reason', 'decidedBy',
  ], '$.override')
  const candidateIds = list(v.candidateIds, '$.override.candidateIds')
    .map((x, i) => identifier(x, `$.override.candidateIds[${i}]`)).sort(lexical)
  unique(candidateIds, '$.override.candidateIds')
  return {
    materialId: identifier(v.materialId, '$.override.materialId'),
    key: identifier(v.key, '$.override.key'),
    decisionId: identifier(v.decisionId, '$.override.decisionId'),
    selectedId: identifier(v.selectedId, '$.override.selectedId'), candidateIds,
    reason: text(v.reason, '$.override.reason'), decidedBy: text(v.decidedBy, '$.override.decidedBy'),
  }
}
function parseSet(input: unknown): { snapshot: ParameterSet; graph: EvidenceGraph } {
  const v = keys(copyData(input), [
    'format', 'version', 'id', 'revision', 'parent', 'records', 'sources', 'overrides',
  ], '$')
  if (v.format !== 'zfs-material-set' || v.version !== MATERIAL_SET_FORMAT_VERSION)
    fail('VERSION', '$', 'Unsupported material-set format/version.')
  const id = identifier(v.id, '$.id'), revision = positiveRevision(v.revision, '$.revision')
  let parent: ParameterSet['parent'] = null
  if (v.parent !== null) {
    const p = keys(v.parent, ['id', 'revision'], '$.parent')
    parent = { id: identifier(p.id, '$.parent.id'), revision: positiveRevision(p.revision, '$.parent.revision') }
    if (parent.id !== id || parent.revision !== revision - 1)
      fail('LINEAGE', '$.parent', 'Parent must be the immediately preceding revision of this set.')
  } else if (revision !== 1) {
    fail('LINEAGE', '$.parent', 'Only revision 1 may omit its parent.')
  }
  const graph = buildEvidenceGraph(v.records, v.sources)
  const groups = new Map<string, ParameterRecord[]>()
  const materials = new Map<string, string>()
  for (const record of graph.records) {
    const material = canonicalData(record.material)
    const existing = materials.get(record.material.id)
    if (existing !== undefined && existing !== material)
      fail('MATERIAL_IDENTITY', record.id, 'One material ID has conflicting identity metadata; use explicit distinct IDs.')
    materials.set(record.material.id, material)
    const key = slot(recordQuery(record))
    const group = groups.get(key) ?? []
    group.push(record); groups.set(key, group)
  }
  const overrides = list(v.overrides, '$.overrides').map(readOverride)
    .sort((a, b) => lexical(slot(a), slot(b)))
  unique(overrides.map(slot), '$.overrides.slots')
  unique(overrides.map(o => o.decisionId), '$.overrides.decisionIds')
  for (const override of overrides) {
    const candidates = groups.get(slot(override)) ?? []
    if (candidates.length < 2)
      fail('OVERRIDE', override.decisionId, 'An override must resolve an actual multiple-record conflict.')
    const ids = candidates.map(c => c.id).sort(lexical)
    if (canonicalData(ids) !== canonicalData(override.candidateIds))
      fail('STALE_OVERRIDE', override.decisionId, 'The decision must acknowledge every current candidate exactly.')
    if (!ids.includes(override.selectedId))
      fail('OVERRIDE', override.decisionId, 'The selected evidence is not a candidate for this property/material.')
    // No selection can hide a units/basis disagreement behind an identical key.
    if (new Set(candidates.map(c => JSON.stringify([c.quantityKind, c.basis]))).size !== 1)
      fail('SEMANTIC_CONFLICT', override.decisionId, 'Separate incompatible property kinds/bases before selecting evidence.')
  }
  return {
    graph, snapshot: freezeData({
      format: 'zfs-material-set', version: MATERIAL_SET_FORMAT_VERSION, id, revision, parent,
      records: graph.records, sources: graph.sources, overrides,
    }),
  }
}

/**
 * Immutable registry handle. Maps remain private; no mutation method is exposed.
 * A selected record is structurally selected, not approved for a physical model.
 * All records for one material/key conflict conservatively, even for disjoint states.
 */
export class MaterialRegistry {
  readonly snapshot: ParameterSet
  readonly graph: EvidenceGraph
  readonly #records: Map<string, ParameterRecord>
  readonly #sources: Map<string, SourceRecord>
  readonly #groups: Map<string, readonly ParameterRecord[]>
  readonly #overrides: Map<string, EvidenceOverride>
  constructor(input: unknown) {
    const { snapshot, graph } = parseSet(input)
    this.snapshot = snapshot
    this.graph = graph
    this.#records = new Map(snapshot.records.map(r => [r.id, r]))
    this.#sources = new Map(snapshot.sources.map(s => [s.id, s]))
    const groups = new Map<string, ParameterRecord[]>()
    for (const record of snapshot.records) {
      const key = slot(recordQuery(record)), current = groups.get(key) ?? []
      current.push(record); groups.set(key, current)
    }
    this.#groups = new Map([...groups].map(([key, group]) => [key, Object.freeze(group)]))
    this.#overrides = new Map(snapshot.overrides.map(o => [slot(o), o]))
    Object.freeze(this)
  }
  select(input: unknown): Selection {
    const q = query(input), group = this.#groups.get(slot(q)) ?? []
    if (!group.length) return freezeData({ ...q, state: 'missing' })
    const decision = this.#overrides.get(slot(q)) ?? null
    if (group.length > 1 && decision === null)
      return freezeData({ ...q, state: 'conflict', candidateIds: group.map(r => r.id) })
    const record = decision ? this.#records.get(decision.selectedId)! : group[0]
    return freezeData({ ...q, state: record.value.form === 'unknown' ? 'unknown' : 'selected', record, decision })
  }
  conflicts(): readonly Selection[] {
    const found: Selection[] = []
    for (const group of this.#groups.values()) {
      const selected = this.select(recordQuery(group[0]))
      if (selected.state === 'conflict') found.push(selected)
    }
    return freezeData(found.sort((a, b) => lexical(slot(a), slot(b))))
  }
  completeness(input: unknown): CompletenessReport {
    const queries = list(copyData(input), '$.queries').map(query).sort((a, b) => lexical(slot(a), slot(b)))
    unique(queries.map(slot), '$.queries')
    const items = queries.map(q => this.select(q))
    return freezeData({
      requested: items.length, items, selected: items.filter(i => i.state === 'selected').length,
      unknown: items.filter(i => i.state === 'unknown').length,
      missing: items.filter(i => i.state === 'missing').length,
      conflicted: items.filter(i => i.state === 'conflict').length,
    })
  }
  getRecord(id: string): ParameterRecord | undefined {
    return this.#records.get(identifier(id, '$.recordId'))
  }
  getSource(id: string): SourceRecord | undefined {
    return this.#sources.get(identifier(id, '$.sourceId'))
  }
  dependencies(id: string, transitive = true): readonly ParameterRecord[] {
    const record = this.getRecord(id)
    if (!record) return fail('MISSING_RECORD', '$.recordId', 'Dependency query record does not exist.')
    if (typeof transitive !== 'boolean') return fail('BOOLEAN', '$.transitive', 'Expected an explicit boolean.')
    const found = new Set<string>()
    const pending = [...record.provenance.derivation?.inputIds ?? []]
    while (pending.length) {
      const next = pending.pop()!
      if (found.has(next)) continue
      found.add(next)
      if (transitive) pending.push(...this.#records.get(next)!.provenance.derivation?.inputIds ?? [])
    }
    return Object.freeze([...found].sort(lexical).map(key => this.#records.get(key)!))
  }
  serialize(): string { return canonicalData(this.snapshot) }
}

/**
 * Append-only evidence revision. Callers supply the complete new decision list;
 * no old decision is silently reused against a changed candidate set.
 * Archive the previous snapshot separately using its id/revision.
 */
export function appendRegistry(current: MaterialRegistry, input: unknown): MaterialRegistry {
  if (!(current instanceof MaterialRegistry)) fail('REGISTRY', '$.current', 'Expected a parsed registry handle.')
  const v = keys(copyData(input), ['records', 'sources', 'overrides'], '$.append')
  const nextDecisions = list(v.overrides, '$.append.overrides').map(readOverride)
  const previousDecisions = new Map(current.snapshot.overrides.map(d => [d.decisionId, d]))
  for (const decision of nextDecisions) {
    const previous = previousDecisions.get(decision.decisionId)
    if (previous && canonicalData(previous) !== canonicalData(decision))
      fail('DECISION_IDENTITY', decision.decisionId, 'A changed selection, candidate list or rationale requires a new decision ID.')
  }
  const revision = current.snapshot.revision + 1
  positiveRevision(revision, '$.revision')
  return new MaterialRegistry({
    format: 'zfs-material-set', version: MATERIAL_SET_FORMAT_VERSION,
    id: current.snapshot.id, revision,
    parent: { id: current.snapshot.id, revision: current.snapshot.revision },
    records: [...current.snapshot.records, ...list(v.records, '$.append.records')],
    sources: [...current.snapshot.sources, ...list(v.sources, '$.append.sources')],
    overrides: v.overrides,
  })
}
