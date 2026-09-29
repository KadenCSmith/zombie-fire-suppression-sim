/** Physical-state manifest only. No solver, renderer, filesystem or hash dependency. */
export const FORMAT_ID = 'zombie-fire-physical-states' as const;
export const SCHEMA_ID = 'zf-physical-states/v1' as const;
export const SCHEMA_VERSION = 1 as const;
export const CANONICAL_PROFILE_ID = 'zf-physical-canonical/v1' as const;
export const SCALAR_ENCODING = 'ieee754-binary64-hex-be' as const;
/** Historical reference identity only; never a default for current-main runtime checkpoints. */
export const BASELINE_COMMIT = '4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3';
export const BASELINE_ARCHIVE_SHA256 =
  '4554f980bdd2658d764927487ce2a8799eb18bdaee074479b0d85197f35ed1a2';

export interface Float64Token { readonly $f64: string }
/** Numeric literals here are safe integers (not -0); scientific reals use tokens. */
export type ScientificJson = null | boolean | string | number | Float64Token |
  readonly ScientificJson[] | { readonly [key: string]: ScientificJson };
export type Triple<T> = readonly [T, T, T];
export type Dimensions = readonly [number, number, number, number, number, number, number];
export type DType = 'f64' | 'f32' | 'i32' | 'u32' | 'i16' | 'u16' | 'i8' | 'u8';
export const BYTES_PER_ELEMENT: Readonly<Record<DType, number>> = Object.freeze({
  f64: 8, f32: 4, i32: 4, u32: 4, i16: 2, u16: 2, i8: 1, u8: 1,
});
export interface UnitDefinition { readonly id: string; readonly dimensions: Dimensions }
export const BASE_UNITS: readonly UnitDefinition[] = Object.freeze([
  { id: '1', dimensions: [0, 0, 0, 0, 0, 0, 0] as const },
  { id: 'kg', dimensions: [1, 0, 0, 0, 0, 0, 0] as const },
  { id: 'm', dimensions: [0, 1, 0, 0, 0, 0, 0] as const },
  { id: 's', dimensions: [0, 0, 1, 0, 0, 0, 0] as const },
  { id: 'A', dimensions: [0, 0, 0, 1, 0, 0, 0] as const },
  { id: 'K', dimensions: [0, 0, 0, 0, 1, 0, 0] as const },
  { id: 'mol', dimensions: [0, 0, 0, 0, 0, 1, 0] as const },
  { id: 'cd', dimensions: [0, 0, 0, 0, 0, 0, 1] as const },
].map(u => Object.freeze({ id: u.id, dimensions: Object.freeze(u.dimensions) })));
export interface IdentityReference {
  readonly id: string;
  readonly revision: string;
  readonly sha256: string | null;
}
export interface Extension {
  readonly namespace: string;
  readonly version: number;
  readonly critical: boolean;
  readonly data: ScientificJson;
}
export interface GridDescriptor {
  readonly id: string;
  readonly kind: 'uniform-cartesian-3d';
  readonly axisOrder: readonly ['x', 'y', 'depth'];
  readonly indexOrder: 'x-fastest';
  readonly cells: Triple<number>;
  readonly originM: Triple<Float64Token>;
  readonly extentM: Triple<Float64Token>;
}
export type Association = 'cell' | 'node' | 'face-x' | 'face-y' | 'face-depth' | 'global';
export interface FieldDescriptor {
  readonly id: string;
  readonly semanticId: string;
  readonly owner: 'physics' | 'controller';
  readonly role: 'state' | 'history' | 'diagnostic';
  readonly required: boolean;
  readonly unitId: string;
  readonly basis: string;
  readonly dtype: DType;
  readonly association: Association;
  /** null except for global; zero permits an explicitly empty global collection. */
  readonly globalEntities: number | null;
  readonly components: readonly string[];
  readonly layout: 'entity-major';
}
export interface BlockDescriptor {
  readonly id: string;
  readonly dtype: DType;
  readonly byteOrder: 'little-endian';
  readonly elementCount: number;
  readonly byteLength: number;
  readonly sha256: string | null;
}
export interface FieldBinding { readonly fieldId: string; readonly blockId: string }
export interface Provenance {
  readonly id: string;
  readonly source: {
    readonly baselineCommit: string;
    readonly snapshotSha256: string;
    readonly implementationCommit: string | null;
    readonly dirty: boolean;
    readonly workingTreeSha256: string | null;
  };
  readonly model: IdentityReference;
  readonly parameters: IdentityReference;
  readonly evidence: readonly IdentityReference[];
  readonly verificationReports: readonly IdentityReference[];
}
export interface AcceptedState {
  readonly id: string;
  readonly gridId: string;
  readonly provenanceId: string;
  readonly acceptance: 'accepted';
  readonly capture: 'native-committed';
  readonly commitIndex: number;
  readonly acceptedStepIndex: number;
  readonly kind: 'initial' | 'step' | 'intervention';
  readonly timeS: Float64Token;
  readonly stepSizeS: Float64Token | null;
  readonly physicsCoverage: 'complete' | 'partial';
  readonly missing: readonly string[];
  readonly restart: 'inspection-only' | 'candidate';
  readonly restartContract: IdentityReference | null;
  readonly fields: readonly FieldBinding[];
  readonly controllerId: string | null;
  readonly extensions: readonly Extension[];
}
export interface ControllerCheckpoint {
  readonly id: string;
  readonly stateId: string;
  readonly schema: IdentityReference;
  readonly coverage: 'complete' | 'partial';
  readonly missing: readonly string[];
  readonly payload: ScientificJson;
  readonly fields: readonly FieldBinding[];
}
export interface EventMarker {
  readonly id: string;
  readonly stateId: string;
  readonly order: number;
  readonly type: string;
  readonly payload: ScientificJson;
}
export interface PhysicalStateManifest {
  readonly format: typeof FORMAT_ID;
  readonly schemaId: typeof SCHEMA_ID;
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly scalarEncoding: typeof SCALAR_ENCODING;
  readonly runId: string;
  readonly units: {
    readonly system: 'SI';
    readonly temperature: 'absolute-kelvin';
    readonly coordinates: 'x-y-horizontal-depth-positive-down';
    readonly dimensionOrder: readonly ['kg', 'm', 's', 'A', 'K', 'mol', 'cd'];
    readonly definitions: readonly UnitDefinition[];
  };
  readonly grids: readonly GridDescriptor[];
  readonly fieldDefinitions: readonly FieldDescriptor[];
  readonly blocks: readonly BlockDescriptor[];
  readonly provenance: readonly Provenance[];
  readonly states: readonly AcceptedState[];
  readonly controllers: readonly ControllerCheckpoint[];
  readonly events: readonly EventMarker[];
  readonly extensions: readonly Extension[];
  readonly integrity: null | {
    readonly profile: typeof CANONICAL_PROFILE_ID;
    readonly algorithm: 'sha256';
    readonly manifestSha256: string;
  };
}
export interface IoLimits {
  readonly maxManifestBytes: number;
  readonly maxDepth: number;
  readonly maxJsonNodes: number;
  readonly maxStringBytes: number;
  readonly maxStates: number;
  readonly maxGrids: number;
  readonly maxFields: number;
  readonly maxBlocks: number;
  readonly maxEvents: number;
  readonly maxProvenance: number;
  readonly maxUnits: number;
  readonly maxComponents: number;
  readonly maxExtensions: number;
  readonly maxCells: number;
  readonly maxEntities: number;
  readonly maxBlockElements: number;
  readonly maxBlockBytes: number;
  readonly maxTotalPayloadBytes: number;
}
export const DEFAULT_LIMITS: Readonly<IoLimits> = Object.freeze({
  maxManifestBytes: 8 * 1024 * 1024, maxDepth: 32, maxJsonNodes: 500_000,
  maxStringBytes: 64 * 1024, maxStates: 4096, maxGrids: 64, maxFields: 1024,
  maxBlocks: 16_384, maxEvents: 65_536, maxProvenance: 128, maxUnits: 128,
  maxComponents: 256, maxExtensions: 256, maxCells: 1_048_576,
  maxEntities: 2_097_152, maxBlockElements: 8_388_608,
  maxBlockBytes: 64 * 1024 * 1024, maxTotalPayloadBytes: 256 * 1024 * 1024,
});
export interface ValidationOptions {
  readonly limits?: Partial<IoLimits>;
  readonly expectedBaselineCommit?: string;
  readonly knownCriticalExtensions?: readonly { readonly namespace: string; readonly version: number }[];
}
export interface ValidatedManifest {
  /** Original object; no copying, sorting, normalization or freezing is performed. */
  readonly manifest: PhysicalStateManifest;
  readonly compactManifestBytes: number;
  readonly declaredPayloadBytes: number;
}
export class SchemaError extends Error {
  constructor(readonly code: string, readonly path: string, detail: string) {
    super(`${code} at ${path}: ${detail}`);
    this.name = 'SchemaError';
  }
}
function fail(code: string, path: string, detail: string): never {
  throw new SchemaError(code, path, detail);
}
function check(ok: boolean, code: string, path: string, detail: string): asserts ok {
  if (!ok) fail(code, path, detail);
}
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
function limitsFor(override: Partial<IoLimits> = {}): IoLimits {
  const out = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(override)) {
    check(Object.hasOwn(DEFAULT_LIMITS, key), 'LIMIT', '$options.limits', 'Unknown limit.');
    const k = key as keyof IoLimits, n = override[k];
    check(typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= DEFAULT_LIMITS[k],
      'LIMIT', `$options.limits.${key}`, 'Limits must be positive integers no greater than defaults.');
    out[k] = n;
  }
  return out;
}
/** Exact compact-JSON UTF-8 size of a string; rejects unpaired UTF-16 surrogates. */
function stringBytes(s: string, path: string, l: IoLimits): number {
  check(s.length <= l.maxStringBytes, 'LIMIT', path, 'String exceeds limit.');
  let bytes = 2;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 34 || c === 92 || c === 8 || c === 9 || c === 10 || c === 12 || c === 13) bytes += 2;
    else if (c < 32) bytes += 6;
    else if (c < 128) bytes++;
    else if (c < 2048) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(++i);
      check(next >= 0xdc00 && next <= 0xdfff, 'JSON', path, 'Unpaired surrogate.');
      bytes += 4;
    } else {
      check(c < 0xdc00 || c > 0xdfff, 'JSON', path, 'Unpaired surrogate.');
      bytes += 3;
    }
    check(bytes <= l.maxStringBytes, 'LIMIT', path, 'Encoded string exceeds limit.');
  }
  check(bytes <= l.maxStringBytes, 'LIMIT', path, 'Encoded string exceeds limit.');
  return bytes;
}
function assertToken(value: unknown, path: string): asserts value is Float64Token {
  check(value !== null && typeof value === 'object' && !Array.isArray(value),
    'NUMBER', path, 'Expected a binary64 token.');
  const r = value as Record<string, unknown>;
  check(Object.keys(r).length === 1 && typeof r.$f64 === 'string' && /^[0-9a-f]{16}$/.test(r.$f64),
    'NUMBER', path, 'Expected exactly one lowercase 16-hex $f64 token.');
  check((Number.parseInt(r.$f64.slice(0, 3), 16) & 0x7ff) !== 0x7ff,
    'NUMBER', path, 'NaN and infinity are forbidden.');
}
/** Used only for schema inequalities; never rewrites or rounds stored token bits. */
function tokenValue(token: Float64Token): number {
  const b = new ArrayBuffer(8), view = new DataView(b);
  for (let i = 0; i < 8; i++) view.setUint8(i, Number.parseInt(token.$f64.slice(2 * i, 2 * i + 2), 16));
  return view.getFloat64(0, false);
}
function inspectJson(value: unknown, l: IoLimits): number {
  let nodes = 0, bytes = 0;
  const active = new Set<object>();
  const add = (n: number, path: string) => {
    check(n <= l.maxManifestBytes - bytes, 'LIMIT', path, 'Compact manifest byte limit exceeded.');
    bytes += n;
  };
  const visit = (v: unknown, path: string, depth: number): void => {
    check(++nodes <= l.maxJsonNodes && depth <= l.maxDepth, 'LIMIT', path, 'JSON node/depth limit exceeded.');
    if (v === null) { add(4, path); return; }
    if (typeof v === 'boolean') { add(v ? 4 : 5, path); return; }
    if (typeof v === 'string') { add(stringBytes(v, path, l), path); return; }
    if (typeof v === 'number') {
      check(Number.isSafeInteger(v) && !Object.is(v, -0), 'NUMBER', path,
        'JSON numbers must be safe integers excluding -0; use $f64 for scientific reals.');
      add(String(v).length, path); return;
    }
    check(typeof v === 'object', 'JSON', path, 'Only scientific JSON values are permitted.');
    check(!active.has(v), 'JSON', path, 'Cyclic input.');
    const array = Array.isArray(v), prototype = Object.getPrototypeOf(v);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      'JSON', path, 'Custom prototypes, typed arrays and non-JSON objects are forbidden.');
    active.add(v);
    if (array) {
      check(v.length <= l.maxJsonNodes, 'LIMIT', path, 'Array length exceeds node budget.');
      const keys = Reflect.ownKeys(v);
      check(keys.length === v.length + 1, 'JSON', path, 'Sparse/decorated arrays are forbidden.');
      add(2 + Math.max(0, v.length - 1), path);
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        check(d !== undefined && 'value' in d && d.enumerable === true,
          'JSON', `${path}[${i}]`, 'Missing or accessor/non-enumerable array element.');
        visit(d.value, `${path}[${i}]`, depth + 1);
      }
    } else {
      const keys = Reflect.ownKeys(v);
      check(keys.length <= l.maxJsonNodes - nodes, 'LIMIT', path, 'Object exceeds node budget.');
      add(2 + Math.max(0, keys.length - 1), path);
      for (const key of keys) {
        check(typeof key === 'string' && !FORBIDDEN_KEYS.has(key), 'JSON', path, 'Unsafe/symbol key.');
        add(stringBytes(key, path, l) + 1, path);
        const d = Object.getOwnPropertyDescriptor(v, key);
        check(d !== undefined && 'value' in d && d.enumerable === true,
          'JSON', path, 'Accessors and non-enumerable properties are forbidden.');
        visit(d.value, `${path}.${key}`, depth + 1);
      }
      if (Object.hasOwn(v, '$f64')) assertToken(v, path);
    }
    active.delete(v);
  };
  visit(value, '$', 0);
  return bytes;
}
type Rule = (v: unknown, path: string) => void;
const anything: Rule = () => { /* inspectJson already checked this subtree. */ };
const literal = (expected: string | number): Rule => (v, p) =>
  check(v === expected, 'UNSUPPORTED', p, `Expected ${String(expected)}.`);
const oneOf = (...values: readonly string[]): Rule => (v, p) =>
  check(typeof v === 'string' && values.includes(v), 'SHAPE', p, 'Unsupported enum value.');
const int = (min: number, max = Number.MAX_SAFE_INTEGER): Rule => (v, p) =>
  check(typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v, -0) && v >= min && v <= max,
    'SHAPE', p, `Expected integer in [${min}, ${max}].`);
const text: Rule = (v, p) => check(typeof v === 'string' && v.trim().length > 0, 'SHAPE', p, 'Expected nonblank text.');
const identifier: Rule = (v, p) => check(typeof v === 'string' && ID.test(v) && !v.includes('..') && !FORBIDDEN_KEYS.has(v),
  'SHAPE', p, 'Expected a safe opaque identifier (no paths).');
const bool: Rule = (v, p) => check(typeof v === 'boolean', 'SHAPE', p, 'Expected boolean.');
const hex = (re: RegExp): Rule => (v, p) => check(typeof v === 'string' && re.test(v), 'SHAPE', p, 'Invalid lowercase digest/commit.');
const nullable = (rule: Rule): Rule => (v, p) => { if (v !== null) rule(v, p); };
const list = (rule: Rule, max: number, min = 0): Rule => (v, p) => {
  check(Array.isArray(v) && v.length >= min && v.length <= max, 'LIMIT', p, 'Invalid array length.');
  v.forEach((item, i) => rule(item, `${p}[${i}]`));
};
const tuple = (...rules: Rule[]): Rule => (v, p) => {
  check(Array.isArray(v) && v.length === rules.length, 'SHAPE', p, 'Invalid tuple.');
  rules.forEach((r, i) => r(v[i], `${p}[${i}]`));
};
const object = (rules: Readonly<Record<string, Rule>>): Rule => (v, p) => {
  check(v !== null && typeof v === 'object' && !Array.isArray(v), 'SHAPE', p, 'Expected object.');
  const r = v as Record<string, unknown>, expected = Object.keys(rules);
  check(Object.keys(r).length === expected.length, 'SHAPE', p, 'Missing/unknown core keys.');
  for (const key of expected) {
    check(Object.hasOwn(r, key), 'SHAPE', `${p}.${key}`, 'Missing core key.');
    rules[key](r[key], `${p}.${key}`);
  }
};
function syntax(l: IoLimits): Rule {
  const digest = nullable(hex(SHA256));
  const identity = object({ id: identifier, revision: identifier, sha256: digest });
  const extension = object({ namespace: identifier, version: int(1), critical: bool, data: anything });
  const extensions = list(extension, l.maxExtensions);
  const binding = object({ fieldId: identifier, blockId: identifier });
  const fields = list(binding, l.maxFields);
  const missing = list(text, l.maxFields);
  const dtype = oneOf('f64', 'f32', 'i32', 'u32', 'i16', 'u16', 'i8', 'u8');
  const grid = object({ id: identifier, kind: literal('uniform-cartesian-3d'),
    axisOrder: tuple(literal('x'), literal('y'), literal('depth')), indexOrder: literal('x-fastest'),
    cells: tuple(int(1, l.maxCells), int(1, l.maxCells), int(1, l.maxCells)),
    originM: tuple(assertToken, assertToken, assertToken), extentM: tuple(assertToken, assertToken, assertToken) });
  const unit = object({ id: identifier, dimensions: tuple(...Array<Rule>(7).fill(int(-32, 32))) });
  const field = object({ id: identifier, semanticId: identifier, owner: oneOf('physics', 'controller'),
    role: oneOf('state', 'history', 'diagnostic'), required: bool, unitId: identifier, basis: text, dtype,
    association: oneOf('cell', 'node', 'face-x', 'face-y', 'face-depth', 'global'),
    globalEntities: nullable(int(0, l.maxEntities)), components: list(identifier, l.maxComponents, 1),
    layout: literal('entity-major') });
  const block = object({ id: identifier, dtype, byteOrder: literal('little-endian'),
    elementCount: int(0, l.maxBlockElements), byteLength: int(0, l.maxBlockBytes), sha256: digest });
  const provenance = object({ id: identifier,
    source: object({ baselineCommit: hex(COMMIT), snapshotSha256: hex(SHA256),
      implementationCommit: nullable(hex(COMMIT)), dirty: bool, workingTreeSha256: digest }),
    model: identity, parameters: identity, evidence: list(identity, l.maxFields),
    verificationReports: list(identity, l.maxFields) });
  const state = object({ id: identifier, gridId: identifier, provenanceId: identifier,
    acceptance: literal('accepted'), capture: literal('native-committed'), commitIndex: int(0),
    acceptedStepIndex: int(0), kind: oneOf('initial', 'step', 'intervention'), timeS: assertToken,
    stepSizeS: nullable(assertToken), physicsCoverage: oneOf('complete', 'partial'), missing,
    restart: oneOf('inspection-only', 'candidate'), restartContract: nullable(identity),
    fields: list(binding, l.maxFields, 1), controllerId: nullable(identifier), extensions });
  const controller = object({ id: identifier, stateId: identifier, schema: identity,
    coverage: oneOf('complete', 'partial'), missing, payload: anything, fields });
  const event = object({ id: identifier, stateId: identifier, order: int(0), type: identifier, payload: anything });
  return object({ format: literal(FORMAT_ID), schemaId: literal(SCHEMA_ID), schemaVersion: literal(SCHEMA_VERSION),
    scalarEncoding: literal(SCALAR_ENCODING), runId: identifier,
    units: object({ system: literal('SI'), temperature: literal('absolute-kelvin'),
      coordinates: literal('x-y-horizontal-depth-positive-down'),
      dimensionOrder: tuple(...['kg', 'm', 's', 'A', 'K', 'mol', 'cd'].map(literal)),
      definitions: list(unit, l.maxUnits, 8) }),
    grids: list(grid, l.maxGrids, 1), fieldDefinitions: list(field, l.maxFields, 1),
    blocks: list(block, l.maxBlocks, 1), provenance: list(provenance, l.maxProvenance, 1),
    states: list(state, l.maxStates, 1), controllers: list(controller, l.maxStates),
    events: list(event, l.maxEvents), extensions,
    integrity: nullable(object({ profile: literal(CANONICAL_PROFILE_ID), algorithm: literal('sha256'),
      manifestSha256: hex(SHA256) })) });
}
function indexed<T extends { readonly id: string }>(values: readonly T[], path: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const v of values) {
    check(!out.has(v.id), 'DUPLICATE', path, `Duplicate id ${v.id}.`);
    out.set(v.id, v);
  }
  return out;
}
function unique(values: readonly string[], path: string): void {
  check(new Set(values).size === values.length, 'DUPLICATE', path, 'Duplicate entry.');
}
function reference<T>(map: ReadonlyMap<string, T>, id: string, path: string): T {
  const found = map.get(id);
  check(found !== undefined, 'REFERENCE', path, `Unresolved id ${id}.`);
  return found;
}
function product(values: readonly number[], max: number, path: string): number {
  let result = 1;
  for (const n of values) {
    check(Number.isSafeInteger(n) && n >= 0 && (n === 0 || result <= Math.floor(max / n)),
      'LIMIT', path, 'Size multiplication exceeds bound.');
    result *= n;
  }
  return result;
}
function entityCount(field: FieldDescriptor, grid: GridDescriptor, l: IoLimits): number {
  const [x, y, z] = grid.cells, p = `$.fieldDefinitions.${field.id}`;
  switch (field.association) {
    case 'global': return field.globalEntities!;
    case 'cell': return product([x, y, z], l.maxCells, p);
    case 'node': return product([x + 1, y + 1, z + 1], l.maxEntities, p);
    case 'face-x': return product([x + 1, y, z], l.maxEntities, p);
    case 'face-y': return product([x, y + 1, z], l.maxEntities, p);
    case 'face-depth': return product([x, y, z + 1], l.maxEntities, p);
  }
}
function coverage(value: 'complete' | 'partial', missing: readonly string[], path: string): void {
  unique(missing, `${path}.missing`);
  check(value === 'complete' ? missing.length === 0 : missing.length > 0,
    'COVERAGE', path, 'Complete requires no missing entries; partial requires explicit missing entries.');
}
/** Structural validation only: declared hashes/payloads/owner semantics are NOT verified. */
export function validateManifest(value: unknown, options: ValidationOptions = {}): ValidatedManifest {
  const l = limitsFor(options.limits), compactManifestBytes = inspectJson(value, l);
  syntax(l)(value, '$');
  const m = value as PhysicalStateManifest;
  const units = indexed(m.units.definitions, '$.units.definitions');
  const grids = indexed(m.grids, '$.grids');
  const definitions = indexed(m.fieldDefinitions, '$.fieldDefinitions');
  const blocks = indexed(m.blocks, '$.blocks');
  const provenances = indexed(m.provenance, '$.provenance');
  const states = indexed(m.states, '$.states');
  const controllers = indexed(m.controllers, '$.controllers');
  indexed(m.events, '$.events');
  for (const base of BASE_UNITS) {
    const unit = reference(units, base.id, '$.units.definitions');
    check(unit.dimensions.every((n, i) => n === base.dimensions[i]), 'UNITS', base.id, 'Base SI unit redefined.');
  }
  for (const grid of m.grids) {
    const p = `$.grids.${grid.id}`;
    product(grid.cells, l.maxCells, p);
    product(grid.cells.map(n => n + 1), l.maxEntities, p);
    grid.extentM.forEach((token, i) => {
      const extent = tokenValue(token), origin = tokenValue(grid.originM[i]);
      check(extent > 0 && Number.isFinite(origin + extent) && origin + extent > origin,
        'GRID', `${p}.extentM[${i}]`, 'Extent must be positive and have a representable finite endpoint.');
      check(extent / grid.cells[i] > 0, 'GRID', p, 'Cell spacing underflows.');
    });
  }
  for (const f of m.fieldDefinitions) {
    reference(units, f.unitId, `$.fieldDefinitions.${f.id}.unitId`);
    unique(f.components, `$.fieldDefinitions.${f.id}.components`);
    check(f.association === 'global' ? f.globalEntities !== null : f.globalEntities === null,
      'LAYOUT', f.id, 'Only global fields specify a global entity count.');
  }
  let declaredPayloadBytes = 0;
  for (const block of m.blocks) {
    const expected = product([block.elementCount, BYTES_PER_ELEMENT[block.dtype]], l.maxBlockBytes, block.id);
    check(expected === block.byteLength, 'LAYOUT', block.id, 'Element count/dtype/byte length mismatch.');
    check(block.byteLength <= l.maxTotalPayloadBytes - declaredPayloadBytes,
      'LIMIT', block.id, 'Aggregate payload byte limit exceeded.');
    declaredPayloadBytes += block.byteLength;
    if (m.integrity !== null) check(block.sha256 !== null, 'INTEGRITY', block.id, 'Sealed manifest requires every block digest.');
  }
  for (const p of m.provenance) {
    if (options.expectedBaselineCommit !== undefined) {
      check(p.source.baselineCommit === options.expectedBaselineCommit,
        'BASELINE', p.id, 'Unexpected source baseline.');
    }
    check(!p.source.dirty || p.source.workingTreeSha256 !== null,
      'PROVENANCE', p.id, 'Dirty source requires an explicit working-tree identity.');
    for (const refs of [p.evidence, p.verificationReports]) unique(refs.map(r => `${r.id}@${r.revision}`), p.id);
  }
  const checkExtensions = (exts: readonly Extension[], p: string) => {
    unique(exts.map(e => e.namespace), p);
    for (const e of exts) {
      check(e.namespace.includes('.'), 'SHAPE', p, 'Extension namespace must be qualified.');
      const supported = options.knownCriticalExtensions?.some(k => k.namespace === e.namespace && k.version === e.version);
      check(!e.critical || supported === true, 'UNSUPPORTED', p, `Unsupported critical extension ${e.namespace}@${e.version}.`);
    }
  };
  checkExtensions(m.extensions, '$.extensions');
  const usedBlocks = new Set<string>(), usedControllers = new Set<string>();
  const checkBindings = (bindings: readonly FieldBinding[], owner: 'physics' | 'controller', grid: GridDescriptor, p: string) => {
    unique(bindings.map(b => b.fieldId), p);
    const present = new Set(bindings.map(b => b.fieldId));
    for (const binding of bindings) {
      const f = reference(definitions, binding.fieldId, p), b = reference(blocks, binding.blockId, p);
      check(f.owner === owner && b.dtype === f.dtype, 'LAYOUT', p, 'Owner or dtype mismatch.');
      const count = product([entityCount(f, grid, l), f.components.length], l.maxBlockElements, p);
      check(b.elementCount === count, 'LAYOUT', p, 'Field shape differs from block element count.');
      usedBlocks.add(b.id);
    }
    for (const f of m.fieldDefinitions) if (f.owner === owner && f.required) {
      check(present.has(f.id), 'REFERENCE', p, `Required field missing: ${f.id}.`);
    }
  };
  const eventsByState = new Map<string, EventMarker[]>();
  for (const e of m.events) {
    reference(states, e.stateId, `$.events.${e.id}.stateId`);
    const events = eventsByState.get(e.stateId) ?? [];
    events.push(e); eventsByState.set(e.stateId, events);
  }
  for (const [stateId, events] of eventsByState) unique(events.map(e => String(e.order)), `$.events.${stateId}`);
  let previous: AcceptedState | undefined;
  for (const state of m.states) {
    const p = `$.states.${state.id}`, time = tokenValue(state.timeS);
    const grid = reference(grids, state.gridId, `${p}.gridId`);
    const provenance = reference(provenances, state.provenanceId, `${p}.provenanceId`);
    check(time >= 0 && state.commitIndex >= state.acceptedStepIndex, 'ORDER', p, 'Invalid time or commit/step indices.');
    check(state.acceptedStepIndex === 0 ? time === 0 : time > 0,
      'ORDER', p, 'Physical time must agree with whether any step has been accepted.');
    if (state.kind === 'initial') {
      check(state.commitIndex === 0 && state.acceptedStepIndex === 0 && time === 0 && state.stepSizeS === null,
        'ORDER', p, 'Initial state must be commit/step/time zero with null step size.');
    } else if (state.kind === 'step') {
      check(state.acceptedStepIndex > 0 && state.stepSizeS !== null && tokenValue(state.stepSizeS) > 0 &&
        tokenValue(state.stepSizeS) <= time && time > 0,
        'ORDER', p, 'Accepted time step needs positive time, step index and step size.');
    } else {
      check(state.commitIndex > state.acceptedStepIndex && state.stepSizeS === null &&
        (eventsByState.get(state.id)?.length ?? 0) > 0,
        'ORDER', p, 'Intervention needs a nonzero commit, null step size and accepted event marker.');
    }
    if (previous) {
      const oldTime = tokenValue(previous.timeS);
      check(state.commitIndex > previous.commitIndex && state.acceptedStepIndex >= previous.acceptedStepIndex && time >= oldTime,
        'ORDER', p, 'Stored accepted sequence is not monotone.');
      const commits = state.commitIndex - previous.commitIndex;
      const steps = state.acceptedStepIndex - previous.acceptedStepIndex;
      check(steps <= commits && (steps > 0 ? time > oldTime : time === oldTime),
        'ORDER', p, 'Commit/step gaps and physical time disagree.');
      check(state.kind === 'step' ? steps > 0 : steps < commits,
        'ORDER', p, 'Recorded commit kind disagrees with the sparse step count.');
      if (state.commitIndex === previous.commitIndex + 1) {
        const stepping = state.kind === 'step';
        check(state.acceptedStepIndex === previous.acceptedStepIndex + (stepping ? 1 : 0) &&
          (stepping ? time > oldTime : time === oldTime), 'ORDER', p, 'Adjacent commits disagree with their accepted kind.');
      }
    }
    coverage(state.physicsCoverage, state.missing, p);
    checkBindings(state.fields, 'physics', grid, `${p}.fields`);
    checkExtensions(state.extensions, `${p}.extensions`);
    const controller = state.controllerId === null ? null : reference(controllers, state.controllerId, `${p}.controllerId`);
    if (controller) {
      check(controller.stateId === state.id && !usedControllers.has(controller.id),
        'REFERENCE', p, 'Controller must belong exclusively to this accepted state.');
      usedControllers.add(controller.id);
      coverage(controller.coverage, controller.missing, `$.controllers.${controller.id}`);
      checkBindings(controller.fields, 'controller', grid, `$.controllers.${controller.id}.fields`);
    }
    if (state.restart === 'candidate') {
      check(state.physicsCoverage === 'complete' && controller?.coverage === 'complete' &&
        controller.schema.sha256 !== null && state.restartContract?.sha256 != null &&
        provenance.model.sha256 !== null && provenance.parameters.sha256 !== null,
        'COVERAGE', p, 'Restart candidate needs complete declared state/controller and content-identified contracts/parameters.');
    } else check(state.restartContract === null, 'COVERAGE', p, 'Inspection-only has no restart claim.');
    previous = state;
  }
  check(usedBlocks.size === blocks.size, 'REFERENCE', '$.blocks', 'Unreferenced payload block.');
  check(usedControllers.size === controllers.size, 'REFERENCE', '$.controllers', 'Unreferenced controller checkpoint.');
  return { manifest: m, compactManifestBytes, declaredPayloadBytes };
}

/** Shared hard-limit resolution for H-owned codecs. A caller may only lower ceilings. */
export function resolveIoLimits(overrides: Partial<IoLimits> = {}): IoLimits {
  return limitsFor(overrides);
}
/** Bounded, data-only JSON validation; does not assert any physical semantics. */
export function validateScientificJson(
  value: unknown, overrides: Partial<IoLimits> = {},
): asserts value is ScientificJson {
  inspectJson(value, limitsFor(overrides));
}
