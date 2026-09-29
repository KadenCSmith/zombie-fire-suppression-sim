import {
  BYTES_PER_ELEMENT, CANONICAL_PROFILE_ID, DEFAULT_LIMITS, SchemaError,
  resolveIoLimits, validateManifest, validateScientificJson,
} from './schema';
import type {
  DType, Extension, Float64Token, IdentityReference, IoLimits,
  PhysicalStateManifest, ScientificJson, ValidationOptions,
} from './schema';

export type NumericArray = Float64Array | Float32Array | Int32Array | Uint32Array |
  Int16Array | Uint16Array | Int8Array | Uint8Array;
const constructors = {
  f64: Float64Array, f32: Float32Array, i32: Int32Array, u32: Uint32Array,
  i16: Int16Array, u16: Uint16Array, i8: Int8Array, u8: Uint8Array,
} as const;
export const MANIFEST_DOMAIN = `${CANONICAL_PROFILE_ID}\0manifest\0`;
export const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function error(code: string, detail: string): never {
  throw new SchemaError(code, '$canonical', detail);
}
export function encodeFloat64(value: number): Float64Token {
  if (typeof value !== 'number' || !Number.isFinite(value)) error('NUMBER', 'Expected finite binary64.');
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  let bits = '';
  for (let i = 0; i < 8; i++) bits += view.getUint8(i).toString(16).padStart(2, '0');
  return { $f64: bits };
}
export function decodeFloat64(value: unknown): number {
  validateScientificJson(value);
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      !Object.hasOwn(value, '$f64')) error('NUMBER', 'Expected a binary64 token.');
  const token = value as Float64Token, view = new DataView(new ArrayBuffer(8));
  for (let i = 0; i < 8; i++) view.setUint8(i, Number.parseInt(token.$f64.slice(i * 2, i * 2 + 2), 16));
  return view.getFloat64(0, false);
}
/** JSON escaping applies only to validated primitives; no object.toJSON is called. */
function writeJson(value: ScientificJson): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(writeJson).join(',')}]`;
  const record = value as { readonly [key: string]: ScientificJson };
  return `{${Object.keys(record).sort(compareText)
    .map(key => `${JSON.stringify(key)}:${writeJson(record[key])}`).join(',')}}`;
}
export function canonicalScientificText(value: unknown, limits: Partial<IoLimits> = {}): string {
  validateScientificJson(value, limits);
  return writeJson(value);
}
/** Copies data; preserves all array orders and token bits. Does not freeze the result. */
export function cloneManifest(value: unknown, options: ValidationOptions = {}): PhysicalStateManifest {
  validateManifest(value, options);
  return JSON.parse(canonicalScientificText(value, options.limits)) as PhysicalStateManifest;
}
const byId = <T extends { readonly id: string }>(a: readonly T[]): T[] =>
  [...a].sort((x, y) => compareText(x.id, y.id));
const extensions = (a: readonly Extension[]): Extension[] =>
  [...a].sort((x, y) => compareText(x.namespace, y.namespace));
const identities = (a: readonly IdentityReference[]): IdentityReference[] =>
  [...a].sort((x, y) => compareText(x.id, y.id) || compareText(x.revision, y.revision));

/** Root envelope excluded; catalog/binding order is not semantic. States are NOT sorted. */
export function canonicalManifestText(value: unknown, options: ValidationOptions = {}): string {
  const m = validateManifest(value, options).manifest;
  const commit = new Map(m.states.map(s => [s.id, s.commitIndex]));
  const fields = (a: PhysicalStateManifest['states'][number]['fields']) =>
    [...a].sort((x, y) => compareText(x.fieldId, y.fieldId));
  const projected = {
    format: m.format, schemaId: m.schemaId, schemaVersion: m.schemaVersion,
    scalarEncoding: m.scalarEncoding, runId: m.runId,
    units: { ...m.units, definitions: byId(m.units.definitions) },
    grids: byId(m.grids), fieldDefinitions: byId(m.fieldDefinitions), blocks: byId(m.blocks),
    provenance: byId(m.provenance).map(p => ({
      ...p, evidence: identities(p.evidence), verificationReports: identities(p.verificationReports),
    })),
    states: m.states.map(s => ({
      ...s, fields: fields(s.fields), missing: [...s.missing].sort(compareText),
      extensions: extensions(s.extensions),
    })),
    controllers: byId(m.controllers).map(c => ({
      ...c, fields: fields(c.fields), missing: [...c.missing].sort(compareText),
    })),
    events: [...m.events].sort((a, b) =>
      (commit.get(a.stateId)! - commit.get(b.stateId)!) || a.order - b.order || compareText(a.id, b.id)),
    extensions: extensions(m.extensions),
  };
  return canonicalScientificText(projected, options.limits);
}
export function canonicalManifestBytes(value: unknown, options: ValidationOptions = {}): Uint8Array {
  return new TextEncoder().encode(MANIFEST_DOMAIN + canonicalManifestText(value, options));
}
/** Restrict trusted live inputs to same-realm, ordinary, fixed, non-shared typed arrays.
 * Cross-realm callers must explicitly copy first. Properties outside the numeric view are not serialized.
 * Reflection on hostile Proxies cannot be made side-effect-free; external input must be bytes.
 */
export function assertFixedArray(value: unknown, dtype: DType): asserts value is NumericArray {
  if (!Object.hasOwn(constructors, dtype) || value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== constructors[dtype].prototype) error('DTYPE', 'Wrong typed-array class.');
  for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
    if (Object.hasOwn(value, key)) error('BUFFER', 'Shadowed typed-array metadata.');
  }
  const array = value as NumericArray, buffer = array.buffer;
  if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Reflect.ownKeys(buffer).length !== 0)
    error('BUFFER', 'Require an ordinary non-shared ArrayBuffer.');
  const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
  if (resizable?.call(buffer) === true) error('BUFFER', 'Resizable buffers are forbidden.');
  try { new DataView(buffer); } catch { error('BUFFER', 'Detached buffer.'); }
}
export function copyBytes(value: unknown, maxBytes = DEFAULT_LIMITS.maxTotalPayloadBytes): Uint8Array {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 ||
      maxBytes > DEFAULT_LIMITS.maxTotalPayloadBytes + DEFAULT_LIMITS.maxManifestBytes + 16)
    error('LIMIT', 'Invalid byte-copy ceiling.');
  assertFixedArray(value, 'u8');
  if (value.byteLength > maxBytes) error('LIMIT', 'Byte input exceeds limit.');
  return new Uint8Array(value as Uint8Array);
}
function blockShape(dtype: DType, count: number, l: IoLimits): number {
  if (!Object.hasOwn(BYTES_PER_ELEMENT, dtype) || !Number.isSafeInteger(count) || count < 0 ||
      count > l.maxBlockElements || count > Math.floor(l.maxBlockBytes / BYTES_PER_ELEMENT[dtype]))
    error('LIMIT', 'Invalid dtype, count or block byte length.');
  return count * BYTES_PER_ELEMENT[dtype];
}
export function readNumeric(view: DataView, dtype: DType, offset: number): number {
  switch (dtype) {
    case 'f64': return view.getFloat64(offset, true);
    case 'f32': return view.getFloat32(offset, true);
    case 'i32': return view.getInt32(offset, true);
    case 'u32': return view.getUint32(offset, true);
    case 'i16': return view.getInt16(offset, true);
    case 'u16': return view.getUint16(offset, true);
    case 'i8': return view.getInt8(offset);
    case 'u8': return view.getUint8(offset);
  }
}
function writeNumeric(view: DataView, dtype: DType, offset: number, value: number): void {
  switch (dtype) {
    case 'f64': view.setFloat64(offset, value, true); break;
    case 'f32': view.setFloat32(offset, value, true); break;
    case 'i32': view.setInt32(offset, value, true); break;
    case 'u32': view.setUint32(offset, value, true); break;
    case 'i16': view.setInt16(offset, value, true); break;
    case 'u16': view.setUint16(offset, value, true); break;
    case 'i8': view.setInt8(offset, value); break;
    case 'u8': view.setUint8(offset, value); break;
  }
}
export function encodeTypedArray(dtype: DType, value: NumericArray, limits: Partial<IoLimits> = {}): Uint8Array {
  assertFixedArray(value, dtype);
  const length = blockShape(dtype, value.length, resolveIoLimits(limits));
  const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
  for (let i = 0; i < value.length; i++) {
    const n = value[i];
    if (!Number.isFinite(n)) error('NUMBER', 'Nonfinite typed-array element.');
    writeNumeric(view, dtype, i * BYTES_PER_ELEMENT[dtype], n);
  }
  return bytes;
}
/** Verifies exact bytes and finiteness without coercing, rounding or normalizing payloads. */
export function validateBlockBytes(
  dtype: DType, count: number, bytes: Uint8Array, limits: Partial<IoLimits> = {},
): void {
  assertFixedArray(bytes, 'u8');
  const expected = blockShape(dtype, count, resolveIoLimits(limits));
  if (bytes.byteLength !== expected) error('LAYOUT', 'Payload byte length mismatch.');
  if (dtype === 'f64' || dtype === 'f32') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(readNumeric(view, dtype, i * BYTES_PER_ELEMENT[dtype])))
        error('NUMBER', 'NaN or infinity in payload bytes.');
    }
  }
}
