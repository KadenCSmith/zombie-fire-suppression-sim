import {
  canonicalData, choice, copyData, fail, freezeData, identifier, keys, lexical,
  list, nullableText, parseParameterRecord, text, unique,
} from './schema'
import type { ParameterRecord } from './schema'

export const SOURCE_FORMAT_VERSION = 1 as const
export interface SourceIdentity {
  readonly scheme: 'doi' | 'url' | 'repository' | 'dataset' | 'manual'
  readonly value: string
}
export interface SourceRecord {
  readonly format: 'zfs-material-source'
  readonly version: typeof SOURCE_FORMAT_VERSION
  /** Deterministically derived from identity, not citation title or array position. */
  readonly id: string
  readonly identity: SourceIdentity
  readonly citation: Readonly<{
    authors: readonly string[]
    title: string
    published: string | null
    container: string | null
    doi: string | null
    url: string | null
  }>
  readonly access: Readonly<{
    retrievedOn: string | null
    availability: 'full-text' | 'abstract-only' | 'baseline-transcription' | 'unavailable' | 'unknown'
    note: string
  }>
  readonly license: Readonly<{ identifier: string | null; note: string }>
  readonly notes: readonly string[]
}

function doi(input: unknown, path: string): string {
  const value = text(input, path).trim().toLowerCase()
  if (!/^10\.\d{4,9}\/[\x21-\x7e]+$/.test(value))
    return fail('DOI', path, 'Use an explicit bare DOI, not a guessed or resolver URL alias.')
  return value
}
function url(input: unknown, path: string): string {
  const value = text(input, path)
  let parsed: URL
  try { parsed = new URL(value) } catch { return fail('URL', path, 'An absolute HTTP(S) URL is required.') }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    return fail('URL', path, 'Only credential-free HTTP(S) source URLs are accepted.')
  return parsed.href
}
function identity(input: unknown): SourceIdentity {
  const v = keys(copyData(input), ['scheme', 'value'], '$.identity')
  const scheme = choice(v.scheme, ['doi', 'url', 'repository', 'dataset', 'manual'], '$.identity.scheme')
  const value = scheme === 'doi' ? doi(v.value, '$.identity.value')
    : scheme === 'url' ? url(v.value, '$.identity.value') : text(v.value, '$.identity.value')
  if (value !== value.trim()) fail('IDENTITY', '$.identity', 'Non-URL/DOI identities must not have outer whitespace.')
  return { scheme, value }
}
export function stableSourceId(input: unknown): string {
  const normalized = identity(input)
  let encoded: string
  try { encoded = encodeURIComponent(normalized.value) }
  catch { return fail('IDENTITY', '$.identity.value', 'Source identity must contain well-formed Unicode.') }
  return identifier(`src:${normalized.scheme}:${encoded}`, '$.id')
}
/** Calendar date with explicit precision, not a clock read or inferred retrieval. */
function date(input: unknown, path: string): string | null {
  if (input === null) return null
  const value = text(input, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return fail('DATE', path, 'Use YYYY-MM-DD or explicit null.')
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return fail('DATE', path, 'Invalid calendar date.')
  return value
}

export function parseSourceRecord(input: unknown): SourceRecord {
  const v = keys(copyData(input), [
    'format', 'version', 'id', 'identity', 'citation', 'access', 'license', 'notes',
  ], '$')
  if (v.format !== 'zfs-material-source' || v.version !== SOURCE_FORMAT_VERSION)
    fail('VERSION', '$', 'Unsupported source format/version.')
  const sourceIdentity = identity(v.identity)
  const id = stableSourceId(sourceIdentity)
  if (v.id !== id) fail('SOURCE_ID', '$.id', 'Source ID must match its canonical identity.')
  const c = keys(v.citation, ['authors', 'title', 'published', 'container', 'doi', 'url'], '$.citation')
  const citationDoi = c.doi === null ? null : doi(c.doi, '$.citation.doi')
  if (sourceIdentity.scheme === 'doi' && citationDoi !== sourceIdentity.value)
    fail('DOI', '$.citation.doi', 'DOI citation and identity must agree.')
  const citationUrl = c.url === null ? null : url(c.url, '$.citation.url')
  if (sourceIdentity.scheme === 'url' && citationUrl !== sourceIdentity.value)
    fail('URL', '$.citation.url', 'URL identity and citation URL must agree.')
  const a = keys(v.access, ['retrievedOn', 'availability', 'note'], '$.access')
  const license = keys(v.license, ['identifier', 'note'], '$.license')
  return freezeData({
    format: 'zfs-material-source', version: SOURCE_FORMAT_VERSION, id, identity: sourceIdentity,
    citation: {
      authors: list(c.authors, '$.citation.authors').map((x, i) => text(x, `$.citation.authors[${i}]`)),
      title: text(c.title, '$.citation.title'),
      published: nullableText(c.published, '$.citation.published'),
      container: nullableText(c.container, '$.citation.container'), doi: citationDoi, url: citationUrl,
    },
    access: {
      retrievedOn: date(a.retrievedOn, '$.access.retrievedOn'),
      availability: choice(a.availability, [
        'full-text', 'abstract-only', 'baseline-transcription', 'unavailable', 'unknown',
      ], '$.access.availability'),
      note: text(a.note, '$.access.note'),
    },
    license: {
      identifier: nullableText(license.identifier, '$.license.identifier'),
      note: text(license.note, '$.license.note'),
    },
    notes: list(v.notes, '$.notes').map((n, i) => text(n, `$.notes[${i}]`)),
  })
}

export interface EvidenceEdge { readonly inputId: string; readonly outputId: string }
export interface EvidenceGraph {
  readonly records: readonly ParameterRecord[]
  readonly sources: readonly SourceRecord[]
  readonly edges: readonly EvidenceEdge[]
  /** Dependencies precede consumers, with lexical tie-breaking. */
  readonly topologicalRecordIds: readonly string[]
  readonly sourceUsage: readonly Readonly<{ sourceId: string; recordIds: readonly string[] }>[]
}

/**
 * Validate source and derivation connectivity, not the truth of citations,
 * arithmetic of external derivations, independence, or physical applicability.
 * Unknown inputs remain present and will block numerical adapters later.
 */
export function buildEvidenceGraph(rawRecords: unknown, rawSources: unknown): EvidenceGraph {
  const records = list(copyData(rawRecords), '$.records').map(parseParameterRecord)
    .sort((a, b) => lexical(a.id, b.id))
  const sources = list(copyData(rawSources), '$.sources').map(parseSourceRecord)
    .sort((a, b) => lexical(a.id, b.id))
  unique(records.map(r => r.id), '$.records')
  unique(sources.map(s => s.id), '$.sources')
  unique(sources.map(s => canonicalData(s.identity)), '$.sources.identities')
  const byRecord = new Map(records.map(r => [r.id, r]))
  const bySource = new Map(sources.map(s => [s.id, s]))
  const usage = new Map(sources.map(s => [s.id, new Set<string>()]))
  const remaining = new Map<string, number>()
  const consumers = new Map(records.map(r => [r.id, [] as string[]]))
  const edges: EvidenceEdge[] = []
  for (const record of records) {
    for (const citation of record.citations) {
      if (!bySource.has(citation.sourceId))
        fail('DANGLING_SOURCE', record.id, `Missing source ${citation.sourceId}.`)
      usage.get(citation.sourceId)!.add(record.id)
    }
    const inputs = record.provenance.derivation?.inputIds ?? []
    remaining.set(record.id, inputs.length)
    for (const inputId of inputs) {
      if (!byRecord.has(inputId))
        fail('DANGLING_RECORD', record.id, `Missing derivation input ${inputId}.`)
      consumers.get(inputId)!.push(record.id)
      edges.push({ inputId, outputId: record.id })
    }
  }
  const ready = records.filter(r => remaining.get(r.id) === 0).map(r => r.id).sort(lexical)
  const topologicalRecordIds: string[] = []
  while (ready.length) {
    const id = ready.shift()!
    topologicalRecordIds.push(id)
    for (const outputId of consumers.get(id)!) {
      const count = remaining.get(outputId)! - 1
      remaining.set(outputId, count)
      if (count === 0) { ready.push(outputId); ready.sort(lexical) }
    }
  }
  if (topologicalRecordIds.length !== records.length)
    fail('DERIVATION_CYCLE', '$.records', 'Derivation graph contains a cycle, including possible self-reference.')
  edges.sort((a, b) => lexical(a.inputId, b.inputId) || lexical(a.outputId, b.outputId))
  return freezeData({
    records, sources, edges, topologicalRecordIds,
    sourceUsage: sources.map(s => ({ sourceId: s.id, recordIds: [...usage.get(s.id)!].sort(lexical) })),
  })
}
