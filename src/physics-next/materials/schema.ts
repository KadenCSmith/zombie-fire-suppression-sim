import {
  KIND_DIMENSIONS, parseReportedQuantity,
} from './units'
import type { QuantityKind, SIQuantity } from './units'

export const PARAMETER_FORMAT_VERSION = 1 as const

export class MaterialDataError extends Error {
  constructor(readonly code: string, readonly path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'MaterialDataError'
  }
}

/** Internal shared parsing primitives, deliberately not re-exported by index.ts. */
export function fail(code: string, path: string, message: string): never {
  throw new MaterialDataError(code, path, message)
}
export function text(input: unknown, path: string): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 16384)
    return fail('TEXT', path, 'Expected nonblank text of at most 16384 characters.')
  return input
}
export function identifier(input: unknown, path: string): string {
  const value = text(input, path)
  if (value.length > 4096 || !/^[A-Za-z0-9][A-Za-z0-9._:@%/+\-]*$/.test(value))
    return fail('IDENTIFIER', path, 'Expected an explicit stable ASCII identifier.')
  return value
}
export function number(input: unknown, path: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input))
    return fail('FINITE', path, 'Expected a finite number without coercion.')
  return input === 0 ? 0 : input
}
export function choice<const T extends readonly string[]>(
  input: unknown, allowed: T, path: string,
): T[number] {
  if (typeof input !== 'string' || !allowed.includes(input))
    return fail('ENUM', path, `Expected one of ${allowed.join(', ')}.`)
  return input as T[number]
}
export function object(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    return fail('OBJECT', path, 'Expected a plain data object.')
  return input as Record<string, unknown>
}
export function keys(
  input: unknown, expected: readonly string[], path: string,
): Record<string, unknown> {
  const value = object(input, path)
  if (Object.keys(value).length !== expected.length
    || expected.some(key => !Object.hasOwn(value, key)))
    return fail('FIELDS', path, `Exactly these fields are required: ${expected.join(', ')}.`)
  return value
}
export function list(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input)) return fail('ARRAY', path, 'Expected an explicit array.')
  return input
}
export function nullableText(input: unknown, path: string): string | null {
  return input === null ? null : text(input, path)
}
export function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length)
    fail('DUPLICATE', path, 'Duplicate identities are not silently merged.')
}
export function lexical(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0 }

/**
 * Own enumerable plain JSON data only. No getters, toJSON hooks, undefined,
 * sparse arrays, extra array properties, cycles, symbols or custom prototypes.
 * Copy before freezing: never mutate or freeze caller-owned data.
 * Resource limits reject oversized metadata rather than silently truncating it.
 */
export function copyData(input: unknown): unknown {
  const active = new Set<object>()
  let count = 0
  const visit = (value: unknown, path: string, depth: number): unknown => {
    if (++count > 100000 || depth > 64) return fail('LIMIT', path, 'Data limit exceeded.')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'string') {
      if (value.length > 16384) return fail('LIMIT', path, 'Text limit exceeded.')
      return value
    }
    if (typeof value === 'number') return number(value, path)
    if (typeof value !== 'object') return fail('JSON', path, 'Not JSON-safe data.')
    if (active.has(value)) return fail('CYCLE', path, 'Cyclic data is not JSON.')
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (array ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null)
      return fail('JSON', path, 'Custom prototypes are not accepted.')
    active.add(value)
    const own = Reflect.ownKeys(value)
    if (own.some(key => typeof key !== 'string'))
      return fail('JSON', path, 'Symbol keys are not JSON.')
    let result: unknown
    if (array) {
      if (value.length > 10000 || own.length !== value.length + 1)
        return fail('JSON', path, 'Sparse, extended or oversized array.')
      const entries: unknown[] = []
      for (let i = 0; i < value.length; i++) {
        const d = Object.getOwnPropertyDescriptor(value, String(i))
        if (!d || !Object.hasOwn(d, 'value') || !d.enumerable)
          return fail('JSON', path, 'Array entries must be own enumerable data.')
        entries.push(visit(d.value, `${path}[${i}]`, depth + 1))
      }
      result = entries
    } else {
      const fields: Record<string, unknown> = {}
      for (const key of own as string[]) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype')
          return fail('JSON', path, 'Reserved object key.')
        const d = Object.getOwnPropertyDescriptor(value, key)
        if (!d || !Object.hasOwn(d, 'value') || !d.enumerable)
          return fail('JSON', path, 'Fields must be own enumerable data.')
        fields[key] = visit(d.value, `${path}.${key}`, depth + 1)
      }
      result = fields
    }
    active.delete(value)
    return result
  }
  return visit(input, '$', 0)
}
export function freezeData<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeData(child)
    Object.freeze(value)
  }
  return value
}
/** Only use on previously checked data; this is identity ordering, not a hash. */
export function canonicalData(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalData).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const v = value as Record<string, unknown>
    return `{${Object.keys(v).sort(lexical).map(
      key => `${JSON.stringify(key)}:${canonicalData(v[key])}`,
    ).join(',')}}`
  }
  return JSON.stringify(value) as string
}

export function quantityKind(input: unknown, path: string): QuantityKind {
  const kind = text(input, path)
  if (!Object.hasOwn(KIND_DIMENSIONS, kind))
    return fail('KIND', path, 'An explicit catalog quantity kind is required.')
  return kind as QuantityKind
}
export type Quantity = SIQuantity<QuantityKind>
/** Rebuild all SI/transform metadata from the original report; reject tampering. */
export function readQuantity(input: unknown, kind: QuantityKind, path: string): Quantity {
  const raw = keys(input, [
    'format', 'version', 'kind', 'valueSI', 'unitSI', 'reported', 'conversion',
  ], path)
  const rebuilt = parseReportedQuantity(kind, raw.reported)
  if (canonicalData(raw) !== canonicalData(rebuilt))
    return fail('QUANTITY', path, 'SI quantity differs from its explicit original report.')
  return rebuilt
}
export function spreadKind(kind: QuantityKind): QuantityKind {
  return kind === 'absoluteTemperature' ? 'temperatureDifference'
    : kind === 'absolutePressure' ? 'pressureDifference' : kind
}

export interface MaterialIdentity {
  readonly id: string
  readonly label: string
  readonly class: 'peat' | 'mineral-soil' | 'water' | 'co2' | 'gas-mixture' | 'root' | 'composite' | 'other'
  readonly specimenId: string | null
  readonly description: string
}
export function readMaterial(input: unknown, path: string): MaterialIdentity {
  const v = keys(input, ['id', 'label', 'class', 'specimenId', 'description'], path)
  return {
    id: identifier(v.id, `${path}.id`), label: text(v.label, `${path}.label`),
    class: choice(v.class, ['peat', 'mineral-soil', 'water', 'co2', 'gas-mixture', 'root', 'composite', 'other'], `${path}.class`),
    specimenId: v.specimenId === null ? null : identifier(v.specimenId, `${path}.specimenId`),
    description: text(v.description, `${path}.description`),
  }
}
export interface CitationReference {
  readonly sourceId: string
  readonly role: 'value' | 'method' | 'context'
  readonly locator: Readonly<{
    kind: 'page' | 'table' | 'figure' | 'section' | 'lines' | 'dataset-row' | 'whole-source'
    value: string | null
  }>
}
export function readCitations(input: unknown, path: string): readonly CitationReference[] {
  const result = list(input, path).map((item, i): CitationReference => {
    const p = `${path}[${i}]`
    const v = keys(item, ['sourceId', 'role', 'locator'], p)
    const l = keys(v.locator, ['kind', 'value'], `${p}.locator`)
    const kind = choice(l.kind, [
      'page', 'table', 'figure', 'section', 'lines', 'dataset-row', 'whole-source',
    ], `${p}.locator.kind`)
    if (kind === 'whole-source' && l.value !== null)
      fail('LOCATOR', p, 'Whole-source locators must explicitly use null.')
    return {
      sourceId: identifier(v.sourceId, `${p}.sourceId`),
      role: choice(v.role, ['value', 'method', 'context'], `${p}.role`),
      locator: { kind, value: kind === 'whole-source' ? null : text(l.value, `${p}.locator.value`) },
    }
  })
  unique(result.map(canonicalData), path)
  return result.sort((a, b) => lexical(canonicalData(a), canonicalData(b)))
}
export const PROVENANCE_CLAIMS = Object.freeze({
  measured: 'observation', estimated: 'estimate', assumed: 'model-assumption',
  fitted: 'fit', derived: 'derivation', unknown: 'unknown',
} as const)
export type ProvenanceStatus = keyof typeof PROVENANCE_CLAIMS
export interface Derivation {
  readonly inputIds: readonly string[]
  readonly method: string
  /** Descriptive expression only; never evaluated as code. */
  readonly expression: string | null
}
export interface Provenance {
  readonly status: ProvenanceStatus
  readonly claim: (typeof PROVENANCE_CLAIMS)[ProvenanceStatus]
  readonly rationale: string
  readonly sourceGap: string | null
  readonly derivation: Derivation | null
}
export function readProvenance(
  input: unknown, citations: readonly CitationReference[], path: string,
): Provenance {
  const v = keys(input, ['status', 'claim', 'rationale', 'sourceGap', 'derivation'], path)
  const status = choice(v.status, [
    'measured', 'estimated', 'assumed', 'fitted', 'derived', 'unknown',
  ], `${path}.status`)
  if (v.claim !== PROVENANCE_CLAIMS[status])
    fail('CLAIM', path, 'Claim must agree with evidence status; no observation upgrade.')
  const sourceGap = nullableText(v.sourceGap, `${path}.sourceGap`)
  if (!citations.some(c => c.role === 'value') && sourceGap === null)
    fail('SOURCE_GAP', path, 'An absent value source needs an explicit explanation; context or method references are not numeric evidence.')
  if ((status === 'measured' || status === 'fitted')
    && !citations.some(c => c.role === 'value' && c.locator.kind !== 'whole-source'))
    fail('EVIDENCE', path, 'Measured/fitted values require a located value reference.')
  let derivation: Derivation | null = null
  if (status === 'derived') {
    const d = keys(v.derivation, ['inputIds', 'method', 'expression'], `${path}.derivation`)
    const inputIds = list(d.inputIds, path).map((x, i) => identifier(x, `${path}.inputIds[${i}]`))
    if (!inputIds.length) fail('DERIVATION', path, 'A derivation requires explicit input records.')
    unique(inputIds, path)
    derivation = {
      inputIds: inputIds.sort(lexical), method: text(d.method, `${path}.method`),
      expression: nullableText(d.expression, `${path}.expression`),
    }
  } else if (v.derivation !== null) {
    fail('DERIVATION', path, 'Only derived records carry a derivation chain.')
  }
  return {
    status, claim: PROVENANCE_CLAIMS[status],
    rationale: text(v.rationale, `${path}.rationale`), sourceGap, derivation,
  }
}

export interface ApplicabilityBound {
  readonly axis: string
  readonly quantityKind: QuantityKind
  readonly lower: Quantity | null
  readonly upper: Quantity | null
}
export interface CategoryCondition { readonly axis: string; readonly value: string }
export interface Applicability {
  readonly state: 'specified' | 'unknown'
  readonly bounds: readonly ApplicabilityBound[]
  readonly categories: readonly CategoryCondition[]
  readonly note: string
}
export function readApplicability(input: unknown, path: string): Applicability {
  const v = keys(input, ['state', 'bounds', 'categories', 'note'], path)
  const state = choice(v.state, ['specified', 'unknown'], path)
  const bounds = list(v.bounds, path).map((item, i): ApplicabilityBound => {
    const p = `${path}.bounds[${i}]`
    const b = keys(item, ['axis', 'quantityKind', 'lower', 'upper'], p)
    const kind = quantityKind(b.quantityKind, `${p}.quantityKind`)
    const lower = b.lower === null ? null : readQuantity(b.lower, kind, `${p}.lower`)
    const upper = b.upper === null ? null : readQuantity(b.upper, kind, `${p}.upper`)
    if (lower === null && upper === null) fail('BOUND', p, 'At least one finite bound is required.')
    if (lower && upper && (lower.valueSI > upper.valueSI
      || lower.reported.basis !== upper.reported.basis))
      fail('BOUND', p, 'Bounds must be ordered with identical reporting basis.')
    return { axis: identifier(b.axis, `${p}.axis`), quantityKind: kind, lower, upper }
  })
  const categories = list(v.categories, path).map((item, i): CategoryCondition => {
    const p = `${path}.categories[${i}]`
    const c = keys(item, ['axis', 'value'], p)
    return { axis: identifier(c.axis, `${p}.axis`), value: text(c.value, `${p}.value`) }
  })
  unique([...bounds, ...categories].map(x => x.axis), `${path}.axes`)
  if (state === 'unknown' && bounds.length + categories.length !== 0)
    fail('APPLICABILITY', path, 'Unknown applicability cannot simultaneously assert conditions.')
  if (state === 'specified' && bounds.length + categories.length === 0)
    fail('APPLICABILITY', path, 'Specified applicability requires at least one explicit condition.')
  return {
    state, bounds: bounds.sort((a, b) => lexical(a.axis, b.axis)),
    categories: categories.sort((a, b) => lexical(a.axis, b.axis)),
    note: text(v.note, `${path}.note`),
  }
}

export interface ScalarValue { readonly form: 'scalar'; readonly quantity: Quantity }
export interface RangeValue {
  readonly form: 'range'
  readonly lower: Quantity
  readonly upper: Quantity
  readonly interpretation: 'observed-span' | 'uncertainty-bounds' | 'assumed-bounds' | 'software-guard'
  readonly note: string
}
interface DistributionBase {
  readonly form: 'distribution'
  readonly lower: Quantity
  readonly upper: Quantity
  readonly interpretation: 'epistemic' | 'aleatory' | 'mixed' | 'unspecified'
  readonly note: string
}
export type DistributionValue =
  | (DistributionBase & Readonly<{ family: 'uniform' }>)
  | (DistributionBase & Readonly<{ family: 'triangular'; mode: Quantity }>)
  | (DistributionBase & Readonly<{
    family: 'truncated-normal'; location: Quantity; scale: Quantity
  }>)
export interface UnknownValue { readonly form: 'unknown'; readonly reason: string }
export type ParameterValue = ScalarValue | RangeValue | DistributionValue | UnknownValue

function readValue(input: unknown, kind: QuantityKind, basis: string, path: string): ParameterValue {
  const obj = object(input, path)
  const form = choice(obj.form, ['scalar', 'range', 'distribution', 'unknown'], `${path}.form`)
  const quantity = (raw: unknown, at: string, expected = kind) => {
    const q = readQuantity(raw, expected, at)
    if (q.reported.basis !== basis) fail('BASIS', at, 'Quantity basis differs from parameter basis.')
    return q
  }
  if (form === 'unknown') {
    const v = keys(input, ['form', 'reason'], path)
    return { form, reason: text(v.reason, `${path}.reason`) }
  }
  if (form === 'scalar') {
    const v = keys(input, ['form', 'quantity'], path)
    return { form, quantity: quantity(v.quantity, `${path}.quantity`) }
  }
  if (form === 'range') {
    const v = keys(input, ['form', 'lower', 'upper', 'interpretation', 'note'], path)
    const lower = quantity(v.lower, `${path}.lower`), upper = quantity(v.upper, `${path}.upper`)
    if (lower.valueSI > upper.valueSI) fail('RANGE', path, 'Reversed range.')
    return {
      form, lower, upper, interpretation: choice(v.interpretation, [
        'observed-span', 'uncertainty-bounds', 'assumed-bounds', 'software-guard',
      ], path), note: text(v.note, `${path}.note`),
    }
  }
  const family = choice(obj.family, ['uniform', 'triangular', 'truncated-normal'], `${path}.family`)
  const extra = family === 'triangular' ? ['mode']
    : family === 'truncated-normal' ? ['location', 'scale'] : []
  const v = keys(input, ['form', 'family', 'lower', 'upper', 'interpretation', 'note', ...extra], path)
  const lower = quantity(v.lower, `${path}.lower`), upper = quantity(v.upper, `${path}.upper`)
  if (lower.valueSI >= upper.valueSI) fail('DISTRIBUTION', path, 'Support must have positive width.')
  const common: DistributionBase = {
    form, lower, upper, interpretation: choice(v.interpretation, [
      'epistemic', 'aleatory', 'mixed', 'unspecified',
    ], path), note: text(v.note, `${path}.note`),
  }
  if (family === 'uniform') return { ...common, family }
  if (family === 'triangular') {
    const mode = quantity(v.mode, `${path}.mode`)
    if (mode.valueSI < lower.valueSI || mode.valueSI > upper.valueSI)
      fail('DISTRIBUTION', path, 'Mode must be inside support.')
    return { ...common, family, mode }
  }
  const location = quantity(v.location, `${path}.location`)
  const scale = quantity(v.scale, `${path}.scale`, spreadKind(kind))
  if (scale.valueSI <= 0) fail('DISTRIBUTION', path, 'Untruncated standard deviation must be positive.')
  return { ...common, family, location, scale }
}

export interface ParameterRecord {
  readonly format: 'zfs-material-parameter'
  readonly version: typeof PARAMETER_FORMAT_VERSION
  /** Immutable evidence-record identity, not just a property name. */
  readonly id: string
  readonly key: string
  readonly material: MaterialIdentity
  readonly quantityKind: QuantityKind
  readonly basis: string
  readonly value: ParameterValue
  readonly provenance: Provenance
  readonly citations: readonly CitationReference[]
  readonly applicability: Applicability
  readonly notes: readonly string[]
}

/** Strict schema parse is not a source authenticity check or physical validation. */
export function parseParameterRecord(input: unknown): ParameterRecord {
  const v = keys(copyData(input), [
    'format', 'version', 'id', 'key', 'material', 'quantityKind', 'basis',
    'value', 'provenance', 'citations', 'applicability', 'notes',
  ], '$')
  if (v.format !== 'zfs-material-parameter' || v.version !== PARAMETER_FORMAT_VERSION)
    fail('VERSION', '$', 'Unsupported parameter format/version; explicit migration required.')
  const kind = quantityKind(v.quantityKind, '$.quantityKind')
  const basis = text(v.basis, '$.basis')
  const citations = readCitations(v.citations, '$.citations')
  const provenance = readProvenance(v.provenance, citations, '$.provenance')
  const value = readValue(v.value, kind, basis, '$.value')
  if ((value.form === 'unknown') !== (provenance.status === 'unknown'))
    fail('UNKNOWN', '$', 'Unknown status and unknown value must agree.')
  if (value.form === 'range' && value.interpretation === 'software-guard'
    && provenance.status !== 'assumed')
    fail('CLAIM', '$', 'Software guards are model assumptions, not observed parameter evidence.')
  return freezeData({
    format: 'zfs-material-parameter', version: PARAMETER_FORMAT_VERSION,
    id: identifier(v.id, '$.id'), key: identifier(v.key, '$.key'),
    material: readMaterial(v.material, '$.material'),
    quantityKind: kind, basis, value, provenance, citations,
    applicability: readApplicability(v.applicability, '$.applicability'),
    notes: list(v.notes, '$.notes').map((n, i) => text(n, `$.notes[${i}]`)),
  })
}

/** Canonical JSON round trips preserve original reports; only key/order normalization occurs. */
export function serializeParameterRecord(input: unknown): string {
  return canonicalData(parseParameterRecord(input))
}
