import { describe, expect, it } from 'vitest'
import { parseReportedQuantity } from '../../../src/physics-next/materials/units'
import type { QuantityKind } from '../../../src/physics-next/materials/units'
import { MaterialDataError } from '../../../src/physics-next/materials/schema'
import {
  buildEvidenceGraph, parseSourceRecord, stableSourceId,
} from '../../../src/physics-next/materials/provenance'

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

describe('source identity and citation metadata', () => {

  it('rejects ill-formed Unicode in a source identity with a metadata error', () => {
    rejected(() => stableSourceId({ scheme: 'manual', value: '\ud800' }), 'IDENTITY')
  })

  it('makes stable IDs independent of titles, citation order, and DOI capitalization', () => {
    const a = { scheme: 'doi', value: '10.1234/Example.A' }
    expect(stableSourceId(a)).toBe(stableSourceId({ scheme: 'doi', value: ' 10.1234/example.a ' }))
    expect(stableSourceId({ scheme: 'manual', value: 'x/y' }) === stableSourceId({ scheme: 'manual', value: 'x%2Fy' })).toBe(false)
    const before = source()
    const after = { ...before, citation: { ...before.citation, title: 'Corrected title only' } }
    expect(parseSourceRecord(before).id).toBe(parseSourceRecord(after).id)
  })
  it('retains repository identities distinct from papers they cite', () => {
    const local = { scheme: 'repository', value: 'github:owner/repo@abc:docs/source.md' }
    expect(stableSourceId(local).startsWith('src:repository:')).toBe(true)
    expect(stableSourceId(local) === stableSourceId({ ...local, value: 'github:owner/repo@def:docs/source.md' })).toBe(false)
  })
  it('preserves missing retrieval and license information explicitly', () => {
    const parsed = parseSourceRecord(source())
    expect(parsed.access.retrievedOn).toBe(null)
    expect(parsed.license.identifier).toBe(null)
    expect(Object.isFrozen(parsed.license)).toBe(true)
    expect(parseSourceRecord(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed)
  })
  it('accepts a real leap-day shape but refuses invalid or partial retrieval dates', () => {
    expect(parseSourceRecord(source('fixture', {
      access: { retrievedOn: '2024-02-29', availability: 'baseline-transcription', note: 'Fixture date only.' },
    })).access.retrievedOn).toBe('2024-02-29')
    for (const retrievedOn of ['2023-02-29', '2026-04-31', '2026-13-01', '2026', 'today', 0]) {
      rejected(() => parseSourceRecord(source('fixture', {
        access: { retrievedOn, availability: 'unknown', note: 'Fixture.' },
      })))
    }
  })
  it('checks URL protocol and identity consistency without fetching it', () => {
    const identity = { scheme: 'url', value: 'https://example.invalid/source' }
    expect(parseSourceRecord(source('fixture', {
      identity, id: stableSourceId(identity),
      citation: { ...source().citation, url: identity.value },
    })).identity.value).toBe(identity.value)
    for (const value of ['file:///tmp/source', 'https://user:pass@example.invalid', '/relative']) {
      rejected(() => stableSourceId({ scheme: 'url', value }), 'URL')
    }
    rejected(() => parseSourceRecord(source('fixture', {
      identity, id: stableSourceId(identity),
    })), 'URL')
  })
  it('rejects bare-ID forgery and source schema extensions', () => {
    rejected(() => parseSourceRecord(source('fixture', { id: 'src:manual:other' })), 'SOURCE_ID')
    rejected(() => parseSourceRecord(source('fixture', { measured: true })), 'FIELDS')
    rejected(() => parseSourceRecord(source('fixture', { version: 2 })), 'VERSION')
  })
  it('requires DOI metadata to agree with the identity', () => {
    const identity = { scheme: 'doi', value: '10.1234/example' }
    const raw = source('fixture', { identity, id: stableSourceId(identity) })
    rejected(() => parseSourceRecord(raw), 'DOI')
    expect(parseSourceRecord({
      ...raw, citation: { ...raw.citation, doi: '10.1234/EXAMPLE' },
    }).citation.doi).toBe(identity.value)
  })
  it('does not execute source accessors or invent authors', () => {
    const raw = source()
    let invoked = false
    Object.defineProperty(raw, 'citation', { enumerable: true, get() { invoked = true; return {} } })
    rejected(() => parseSourceRecord(raw), 'JSON')
    expect(invoked).toBe(false)
    expect(parseSourceRecord(source()).citation.authors).toEqual([])
  })
})
describe('provenance graph integrity', () => {
  it('orders dependencies deterministically and preserves original source locators', () => {
    const baseRecord = example({ id: 'a', citations: [
      { sourceId: stableSourceId({ scheme: 'manual', value: 'fixture' }), role: 'context',
        locator: { kind: 'figure', value: '3b' } },
    ] })
    const records = [derived('c', ['b', 'a']), derived('b', ['a']), baseRecord]
    const first = buildEvidenceGraph(records, [source('unused'), source()])
    const second = buildEvidenceGraph([...records].reverse(), [source(), source('unused')])
    expect(first).toEqual(second)
    expect(first.topologicalRecordIds).toEqual(['a', 'b', 'c'])
    expect(first.edges).toEqual([
      { inputId: 'a', outputId: 'b' }, { inputId: 'a', outputId: 'c' },
      { inputId: 'b', outputId: 'c' },
    ])
    expect(first.records[0].citations[0].locator.value).toBe('3b')
    expect(first.sourceUsage[0].recordIds).toEqual(['a'])
    expect(Object.isFrozen(first.edges[0])).toBe(true)
  })
  it('rejects missing sources and missing parent records', () => {
    rejected(() => buildEvidenceGraph([example({ citations: [
      { sourceId: 'src:manual:missing', role: 'context', locator: { kind: 'whole-source', value: null } },
    ] })], []), 'DANGLING_SOURCE')
    rejected(() => buildEvidenceGraph([derived('child', ['missing'])], []), 'DANGLING_RECORD')
  })
  it('rejects self cycles and multi-record cycles even if some nodes are independent', () => {
    rejected(() => buildEvidenceGraph([derived('a', ['a'])], []), 'DERIVATION_CYCLE')
    rejected(() => buildEvidenceGraph([example(), derived('a', ['b']), derived('b', ['a'])], []), 'DERIVATION_CYCLE')
  })
  it('rejects duplicate record and normalized source identities instead of merging', () => {
    rejected(() => buildEvidenceGraph([example(), example()], []), 'DUPLICATE')
    rejected(() => buildEvidenceGraph([], [source(), source()]), 'DUPLICATE')
    const identity = { scheme: 'doi', value: '10.1234/example' }
    const raw = source('fixture', { identity, id: stableSourceId(identity),
      citation: { ...source().citation, doi: '10.1234/example' } })
    rejected(() => buildEvidenceGraph([], [raw, {
      ...raw, identity: { ...identity, value: '10.1234/EXAMPLE' },
    }]), 'DUPLICATE')
  })
  it('does not collapse distinct identities with coincident titles', () => {
    expect(buildEvidenceGraph([], [source('one'), source('two')]).sources.length).toBe(2)
  })
  it('keeps unknown derivation inputs unknown without evaluating expressions', () => {
    const unknown = example({ id: 'input', value: { form: 'unknown', reason: 'Missing input.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'No measurement.',
        sourceGap: 'Absent.', derivation: null } })
    const graph = buildEvidenceGraph([unknown, derived('output', ['input'])], [])
    expect(graph.records[0].value.form).toBe('unknown')
    expect(graph.records[1].provenance.status).toBe('derived')
    expect(graph.topologicalRecordIds).toEqual(['input', 'output'])
  })
})
