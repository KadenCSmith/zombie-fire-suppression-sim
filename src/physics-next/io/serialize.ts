import {
  BYTES_PER_ELEMENT, SchemaError, resolveIoLimits, validateManifest, validateScientificJson,
} from './schema';
import type { DType, Float64Token, IoLimits, ScientificJson, ValidationOptions } from './schema';
import {
  assertFixedArray, canonicalScientificText, copyBytes, decodeFloat64, encodeFloat64,
  readNumeric, validateBlockBytes,
} from './canonical';
import type { NumericArray } from './canonical';
import { sealBundle, sha256Hex, verifyBundle } from './hash';
import type { PhysicalBundle, Sha256Adapter } from './hash';

export const CONTAINER_HEADER_BYTES = 16;
export const CONTAINER_MAGIC = 'ZFPIO1\r\n';
function fail(code: string, detail: string): never {
  throw new SchemaError(code, '$container', detail);
}
/** Strict bounded JSON: duplicate decoded keys, unsafe keys and nonminimal numbers fail closed. */
export function parseScientificJson(text: string, limits: Partial<IoLimits> = {}): ScientificJson {
  const l = resolveIoLimits(limits);
  if (typeof text !== 'string' || text.length > l.maxManifestBytes) fail('LIMIT', 'Manifest text too large.');
  if (new TextEncoder().encode(text).byteLength > l.maxManifestBytes) fail('LIMIT', 'Manifest UTF-8 too large.');
  let i = 0, nodes = 0;
  const whitespace = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\r' || text[i] === '\n')) i++;
  };
  const quoted = (): string => {
    if (text[i] !== '"') fail('JSON', 'Expected quoted string.');
    const start = i++;
    while (i < text.length) {
      if (i - start > l.maxStringBytes * 6) fail('LIMIT', 'Escaped string exceeds limit.');
      if (text[i] === '"') {
        i++;
        let s: unknown;
        try { s = JSON.parse(text.slice(start, i)); } catch { fail('JSON', 'Malformed string escape.'); }
        validateScientificJson(s, l);
        if (typeof s !== 'string') fail('JSON', 'Expected string.');
        return s;
      }
      if (text.charCodeAt(i) < 32) fail('JSON', 'Unescaped control character.');
      if (text[i] === '\\') i += 2;
      else i++;
    }
    return fail('JSON', 'Unterminated string.');
  };
  const value = (depth: number): ScientificJson => {
    whitespace();
    if (++nodes > l.maxJsonNodes || depth > l.maxDepth) fail('LIMIT', 'JSON node/depth limit.');
    const c = text[i];
    if (c === '"') return quoted();
    if (c === '{') {
      i++; whitespace();
      const out: { [key: string]: ScientificJson } = Object.create(null) as { [key: string]: ScientificJson };
      const seen = new Set<string>();
      if (text[i] === '}') { i++; return out; }
      while (true) {
        whitespace(); const key = quoted();
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail('JSON', 'Unsafe object key.');
        if (seen.has(key)) fail('DUPLICATE_KEY', 'Duplicate decoded object key.');
        seen.add(key);
        whitespace(); if (text[i++] !== ':') fail('JSON', 'Expected colon.');
        out[key] = value(depth + 1);
        whitespace(); const end = text[i++];
        if (end === '}') return out;
        if (end !== ',') fail('JSON', 'Expected object separator.');
      }
    }
    if (c === '[') {
      i++; whitespace(); const out: ScientificJson[] = [];
      if (text[i] === ']') { i++; return out; }
      while (true) {
        out.push(value(depth + 1)); whitespace(); const end = text[i++];
        if (end === ']') return out;
        if (end !== ',') fail('JSON', 'Expected array separator.');
      }
    }
    for (const [word, result] of [['null', null], ['true', true], ['false', false]] as const) {
      if (text.startsWith(word, i)) { i += word.length; return result; }
    }
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else if (text[i] >= '1' && text[i] <= '9') {
      do {
        i++;
        if (i - start > 17) fail('NUMBER', 'Integer literal exceeds safe range.');
      } while (text[i] >= '0' && text[i] <= '9');
    } else return fail('JSON', 'Unexpected token.');
    const n = Number(text.slice(start, i));
    if (!Number.isSafeInteger(n) || Object.is(n, -0)) fail('NUMBER', 'Only safe integer literals excluding -0.');
    return n;
  };
  const result = value(0); whitespace();
  if (i !== text.length) fail('JSON', 'Trailing content or unsupported numeric spelling.');
  validateScientificJson(result, l);
  return result;
}
export function decodeTypedArray(
  dtype: DType, count: number, bytes: Uint8Array, limits: Partial<IoLimits> = {},
): NumericArray {
  validateBlockBytes(dtype, count, bytes, limits);
  const constructors = {
    f64: Float64Array, f32: Float32Array, i32: Int32Array, u32: Uint32Array,
    i16: Int16Array, u16: Uint16Array, i8: Int8Array, u8: Uint8Array,
  };
  const out = new constructors[dtype](count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < count; i++) out[i] = readNumeric(view, dtype, i * BYTES_PER_ELEMENT[dtype]);
  return out;
}
export async function serializeBundle(
  manifest: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  options: ValidationOptions = {},
): Promise<Uint8Array> {
  const bundle = await sealBundle(manifest, payloads, adapter, options);
  const checked = validateManifest(bundle.manifest, options);
  const text = canonicalScientificText(bundle.manifest, options.limits);
  const json = new TextEncoder().encode(text);
  const out = new Uint8Array(CONTAINER_HEADER_BYTES + json.byteLength + checked.declaredPayloadBytes);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) out[i] = CONTAINER_MAGIC.charCodeAt(i);
  view.setUint32(8, json.byteLength, true);
  view.setUint32(12, checked.declaredPayloadBytes, true);
  out.set(json, CONTAINER_HEADER_BYTES);
  let offset = CONTAINER_HEADER_BYTES + json.byteLength;
  for (const block of bundle.manifest.blocks) {
    out.set(bundle.payloads.get(block.id)!, offset); offset += block.byteLength;
  }
  return out;
}
export async function deserializeBundle(
  input: Uint8Array, adapter: Sha256Adapter, options: ValidationOptions = {},
): Promise<PhysicalBundle> {
  const l = resolveIoLimits(options.limits);
  assertFixedArray(input, 'u8');
  const max = CONTAINER_HEADER_BYTES + l.maxManifestBytes + l.maxTotalPayloadBytes;
  if (input.byteLength < CONTAINER_HEADER_BYTES || input.byteLength > max) fail('LIMIT', 'Container byte limit.');
  const bytes = copyBytes(input, max), header = new DataView(bytes.buffer);
  for (let i = 0; i < 8; i++) if (bytes[i] !== CONTAINER_MAGIC.charCodeAt(i)) fail('UNSUPPORTED', 'Unknown magic/container version.');
  const manifestBytes = header.getUint32(8, true), payloadBytes = header.getUint32(12, true);
  if (manifestBytes === 0 || manifestBytes > l.maxManifestBytes || payloadBytes > l.maxTotalPayloadBytes)
    fail('LIMIT', 'Header lengths exceed policy.');
  if (bytes.byteLength !== CONTAINER_HEADER_BYTES + manifestBytes + payloadBytes)
    fail('LAYOUT', 'Header length, truncation or trailing bytes.');
  const jsonBytes = bytes.subarray(CONTAINER_HEADER_BYTES, CONTAINER_HEADER_BYTES + manifestBytes);
  if (jsonBytes[0] === 0xef && jsonBytes[1] === 0xbb && jsonBytes[2] === 0xbf) fail('JSON', 'UTF-8 BOM is forbidden.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(jsonBytes); }
  catch { return fail('UTF8', 'Malformed UTF-8.'); }
  const checked = validateManifest(parseScientificJson(text, l), options);
  if (checked.declaredPayloadBytes !== payloadBytes) fail('LAYOUT', 'Manifest/header payload length mismatch.');
  if (checked.manifest.integrity === null) fail('UNSEALED', 'Sealed input required.');
  let offset = CONTAINER_HEADER_BYTES + manifestBytes;
  const payloads = new Map<string, Uint8Array>();
  for (const block of checked.manifest.blocks) {
    if (block.byteLength > bytes.byteLength - offset) fail('LAYOUT', 'Truncated block.');
    payloads.set(block.id, bytes.subarray(offset, offset + block.byteLength)); offset += block.byteLength;
  }
  if (offset !== bytes.byteLength) fail('LAYOUT', 'Trailing payload bytes.');
  return verifyBundle(checked.manifest, payloads, adapter, options);
}

/** Separate runtime graph format, not the physical-field recording format. */
export const OWNED_GRAPH_FORMAT = 'zfs-owned-runtime-checkpoint' as const;
export const OWNED_GRAPH_VERSION = 1 as const;
export const OWNED_GRAPH_MAGIC = 'ZFRCP1\r\n';
export const OWNED_GRAPH_DOMAIN = 'zfs-owned-runtime-checkpoint/v1\0manifest\0';
export type NativeByteOrder = 'little-endian' | 'big-endian';
export function nativeByteOrder(): NativeByteOrder {
  return new Uint8Array(new Uint16Array([0x0102]).buffer)[0] === 2 ? 'little-endian' : 'big-endian';
}
export interface CheckpointGraphLimits {
  readonly maxMetadataBytes: number;
  readonly maxGraphNodes: number;
  readonly maxEdges: number;
  readonly maxGraphDepth: number;
  readonly maxArrayLength: number;
  readonly maxViewElements: number;
  readonly maxStringBytes: number;
  readonly maxBufferBytes: number;
  readonly maxTotalBufferBytes: number;
}
export const CHECKPOINT_GRAPH_LIMITS: Readonly<CheckpointGraphLimits> = Object.freeze({
  maxMetadataBytes: 8 * 1024 * 1024, maxGraphNodes: 65_536, maxEdges: 500_000,
  maxGraphDepth: 32, maxArrayLength: 100_000, maxViewElements: 2_097_152,
  maxStringBytes: 64 * 1024, maxBufferBytes: 64 * 1024 * 1024,
  maxTotalBufferBytes: 128 * 1024 * 1024,
});
export interface OwnedGraphContext {
  readonly sourceCommit: string;
  readonly ownerSchema: string;
  readonly contextFingerprint: string;
  readonly nativeUnits: 'SI';
  readonly coordinates: 'x-y-horizontal-z-down';
}
export interface OwnedGraphEncodeOptions {
  readonly limits?: Partial<CheckpointGraphLimits>;
  /** Trusted synchronous gate on a private reconstructed copy, before the first digest callback. */
  readonly validateSnapshot?: (snapshot: unknown) => boolean;
}
export interface EncodedOwnedGraph { readonly bytes: Uint8Array; readonly contentSha256: string }
export interface DecodedOwnedGraph {
  readonly value: unknown;
  readonly context: OwnedGraphContext;
  readonly contentSha256: string;
}
export class CheckpointIOError extends Error {
  constructor(readonly code: string, detail: string) {
    super(`${code}: ${detail}`); this.name = 'CheckpointIOError';
  }
}
function ioCheck(ok: boolean, code: string, detail: string): asserts ok {
  if (!ok) throw new CheckpointIOError(code, detail);
}
export function resolveCheckpointLimits(input: Partial<CheckpointGraphLimits> = {}): CheckpointGraphLimits {
  const out = { ...CHECKPOINT_GRAPH_LIMITS };
  for (const name of Object.keys(input)) {
    ioCheck(Object.hasOwn(out, name), 'LIMIT', 'Unknown checkpoint limit.');
    const key = name as keyof CheckpointGraphLimits, value = input[key];
    ioCheck(typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 &&
      value <= CHECKPOINT_GRAPH_LIMITS[key], 'LIMIT', 'Only lowered positive limits are allowed.');
    out[key] = value;
  }
  return out;
}
function jsonLimits(l: CheckpointGraphLimits): Partial<IoLimits> {
  return { maxManifestBytes: l.maxMetadataBytes, maxStringBytes: l.maxStringBytes };
}
function plain(v: unknown, expected: readonly string[]): Record<string, unknown> {
  ioCheck(v !== null && typeof v === 'object' && !Array.isArray(v), 'FORMAT', 'Expected a record.');
  const r = v as Record<string, unknown>;
  ioCheck(Object.keys(r).length === expected.length && expected.every(k => Object.hasOwn(r, k)),
    'FORMAT', 'Unknown or missing metadata property.');
  return r;
}
function natural(n: unknown, max: number): asserts n is number {
  ioCheck(typeof n === 'number' && Number.isSafeInteger(n) && !Object.is(n, -0) && n >= 0 && n <= max,
    'LIMIT', 'Invalid bounded natural number.');
}
function digest(v: unknown): asserts v is string {
  ioCheck(typeof v === 'string' && /^[0-9a-f]{64}$/.test(v), 'FORMAT', 'Invalid SHA-256 text.');
}
function copyContext(input: OwnedGraphContext, l: CheckpointGraphLimits): OwnedGraphContext {
  validateScientificJson(input, jsonLimits(l));
  const r = plain(input, ['sourceCommit', 'ownerSchema', 'contextFingerprint', 'nativeUnits', 'coordinates']);
  ioCheck(typeof r.sourceCommit === 'string' && /^[0-9a-f]{40}$/.test(r.sourceCommit),
    'IDENTITY', 'A full declared source commit is required; ancestry is an external gate.');
  for (const key of ['ownerSchema', 'contextFingerprint']) {
    ioCheck(typeof r[key] === 'string' && (r[key] as string).trim().length > 0 &&
      (r[key] as string).trim() === r[key], 'IDENTITY', 'Explicit nonblank identity required.');
  }
  ioCheck(r.nativeUnits === 'SI' && r.coordinates === 'x-y-horizontal-z-down',
    'CONVENTION', 'Explicit supported native units/coordinates are required.');
  return { sourceCommit: r.sourceCommit, ownerSchema: r.ownerSchema as string,
    contextFingerprint: r.contextFingerprint as string, nativeUnits: 'SI', coordinates: 'x-y-horizontal-z-down' };
}
const NUMERIC_VIEWS = {
  i8: Int8Array, u8: Uint8Array, u8c: Uint8ClampedArray, i16: Int16Array, u16: Uint16Array,
  i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array,
} as const;
type ViewKind = keyof typeof NUMERIC_VIEWS | 'data-view';
type GraphAtom = null | boolean | string | Float64Token | { readonly $ref: number };
type GraphNode =
  | { readonly kind: 'record'; readonly recordPrototype: 'plain' | 'null';
      readonly entries: readonly (readonly [string, boolean, GraphAtom])[] }
  | { readonly kind: 'array'; readonly values: readonly GraphAtom[] }
  | { readonly kind: 'buffer'; readonly byteLength: number; readonly sha256: string | null }
  | { readonly kind: 'view'; readonly view: ViewKind; readonly buffer: number;
      readonly byteOffset: number; readonly byteLength: number; readonly length: number | null };
interface GraphDraft {
  readonly root: GraphAtom;
  readonly nodes: GraphNode[];
  readonly payloads: Map<number, Uint8Array>;
}
interface GraphManifest {
  readonly format: typeof OWNED_GRAPH_FORMAT;
  readonly version: typeof OWNED_GRAPH_VERSION;
  readonly scalarEncoding: 'ieee754-binary64-hex-be';
  readonly byteOrder: NativeByteOrder;
  readonly context: OwnedGraphContext;
  readonly root: GraphAtom;
  readonly nodes: readonly GraphNode[];
  readonly sha256: string | null;
}
function ordinaryBuffer(buffer: ArrayBuffer, l: CheckpointGraphLimits): number {
  ioCheck(Object.getPrototypeOf(buffer) === ArrayBuffer.prototype && Reflect.ownKeys(buffer).length === 0,
    'BUFFER', 'Shared, foreign, decorated or custom buffers are unsupported.');
  const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
  ioCheck(resizable?.call(buffer) !== true, 'BUFFER', 'Resizable buffers are unsupported.');
  let length: number;
  try { length = new DataView(buffer).byteLength; }
  catch { throw new CheckpointIOError('BUFFER', 'Detached buffer.'); }
  natural(length, l.maxBufferBytes); return length;
}
function captureGraph(input: unknown, l: CheckpointGraphLimits): GraphDraft {
  const ids = new Map<object, number>(), active = new Set<object>();
  const nodes: GraphNode[] = [], payloads = new Map<number, Uint8Array>();
  let totalBytes = 0, edges = 0;
  const atom = (value: unknown, depth: number): GraphAtom => {
    ioCheck(++edges <= l.maxEdges, 'LIMIT', 'Graph edge budget.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') { validateScientificJson(value, jsonLimits(l)); return value; }
    if (typeof value === 'number') return encodeFloat64(value);
    ioCheck(value !== null && typeof value === 'object', 'STATE', 'Only owned finite data may be stored.');
    ioCheck(depth <= l.maxGraphDepth, 'LIMIT', 'Object-reference depth budget.');
    ioCheck(!active.has(value), 'CYCLE', 'Cyclic graphs are unsupported.');
    const existing = ids.get(value); if (existing !== undefined) return { $ref: existing };
    ioCheck(nodes.length < l.maxGraphNodes, 'LIMIT', 'Too many distinct graph nodes.');
    const id = nodes.length; ids.set(value, id);
    nodes.push({ kind: 'buffer', byteLength: 0, sha256: null }); active.add(value);
    const proto = Object.getPrototypeOf(value);
    if (proto === ArrayBuffer.prototype) {
      const buffer = value as ArrayBuffer, length = ordinaryBuffer(buffer, l);
      ioCheck(length <= l.maxTotalBufferBytes - totalBytes, 'LIMIT', 'Total unique buffer limit.');
      totalBytes += length;
      payloads.set(id, new Uint8Array(new Uint8Array(buffer)));
      nodes[id] = { kind: 'buffer', byteLength: length, sha256: null };
    } else if (ArrayBuffer.isView(value)) {
      for (const key of ['buffer', 'byteOffset', 'byteLength', 'length'])
        ioCheck(!Object.hasOwn(value, key), 'STATE', 'Shadowed view metadata.');
      let viewKind: ViewKind, count: number | null;
      if (proto === DataView.prototype) {
        ioCheck(Reflect.ownKeys(value).length === 0, 'STATE', 'Decorated DataView.');
        viewKind = 'data-view'; count = null;
      } else {
        const key = (Object.keys(NUMERIC_VIEWS) as (keyof typeof NUMERIC_VIEWS)[])
          .find(k => NUMERIC_VIEWS[k].prototype === proto);
        ioCheck(key !== undefined, 'STATE', 'Unsupported numeric view class.');
        viewKind = key;
        const array = value as Exclude<NumericArray, DataView>;
        natural(array.length, l.maxViewElements); count = array.length;
        const keys = Reflect.ownKeys(array);
        ioCheck(keys.length === count && keys.every((k, i) => k === String(i)), 'STATE', 'Decorated numeric view.');
        for (let i = 0; i < count; i++) ioCheck(Number.isFinite(array[i]), 'NUMBER', 'Nonfinite numeric view.');
      }
      const view = value as ArrayBufferView, reference = atom(view.buffer, depth + 1);
      ioCheck(reference !== null && typeof reference === 'object' && '$ref' in reference, 'GRAPH', 'Missing backing buffer.');
      nodes[id] = { kind: 'view', view: viewKind, buffer: reference.$ref,
        byteOffset: view.byteOffset, byteLength: view.byteLength, length: count };
    } else if (Array.isArray(value)) {
      ioCheck(proto === Array.prototype, 'STATE', 'Custom array prototype.');
      natural(value.length, l.maxArrayLength);
      ioCheck(Reflect.ownKeys(value).length === value.length + 1, 'STATE', 'Sparse/decorated array.');
      const values: GraphAtom[] = [];
      for (let i = 0; i < value.length; i++) {
        const d = Object.getOwnPropertyDescriptor(value, String(i));
        ioCheck(d !== undefined && 'value' in d && d.enumerable === true, 'STATE', 'Invalid array element.');
        values.push(atom(d.value, depth + 1));
      }
      nodes[id] = { kind: 'array', values };
    } else {
      ioCheck(proto === Object.prototype || proto === null, 'STATE', 'Classes/compiled geometry are not owned data.');
      const keys = Reflect.ownKeys(value);
      ioCheck(keys.length <= l.maxEdges - edges, 'LIMIT', 'Record edge budget.');
      ioCheck(keys.every(k => typeof k === 'string'), 'STATE', 'Symbol keys are unsupported.');
      const entries: [string, boolean, GraphAtom][] = [];
      for (const key of keys as string[]) { // Runtime enumeration order is observable state.
        validateScientificJson(key, jsonLimits(l));
        const d = Object.getOwnPropertyDescriptor(value, key)!;
        ioCheck('value' in d, 'STATE', 'Accessor properties are unsupported.');
        entries.push([key, d.enumerable === true, atom(d.value, depth + 1)]);
      }
      nodes[id] = { kind: 'record', recordPrototype: proto === null ? 'null' : 'plain', entries };
    }
    active.delete(value); return { $ref: id };
  };
  const root = atom(input, 0);
  validateGraph(root, nodes, l, false);
  return { root, nodes, payloads };
}
function validateGraph(
  root: unknown, rawNodes: unknown, l: CheckpointGraphLimits, sealed: boolean,
): { root: GraphAtom; nodes: readonly GraphNode[]; payloadBytes: number } {
  ioCheck(Array.isArray(rawNodes), 'GRAPH', 'Expected graph node array.');
  natural(rawNodes.length, l.maxGraphNodes);
  let edges = 0, payloadBytes = 0;
  const atom = (v: unknown): GraphAtom => {
    ioCheck(++edges <= l.maxEdges, 'LIMIT', 'Graph edge limit.');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'string') { validateScientificJson(v, jsonLimits(l)); return v; }
    ioCheck(v !== null && typeof v === 'object' && !Array.isArray(v), 'GRAPH', 'Invalid graph atom.');
    if (Object.hasOwn(v, '$f64')) { decodeFloat64(v); return v as Float64Token; }
    const r = plain(v, ['$ref']); natural(r.$ref, rawNodes.length - 1); return { $ref: r.$ref };
  };
  const nodes = rawNodes as unknown as readonly GraphNode[], rootValue = atom(root);
  for (const raw of rawNodes as unknown[]) {
    const kind = (raw as { kind?: unknown } | null)?.kind;
    if (kind === 'buffer') {
      const n = plain(raw, ['kind', 'byteLength', 'sha256']); natural(n.byteLength, l.maxBufferBytes);
      ioCheck(n.byteLength <= l.maxTotalBufferBytes - payloadBytes, 'LIMIT', 'Total unique buffer limit.');
      payloadBytes += n.byteLength;
      if (sealed || n.sha256 !== null) digest(n.sha256);
    } else if (kind === 'view') {
      const n = plain(raw, ['kind', 'view', 'buffer', 'byteOffset', 'byteLength', 'length']);
      natural(n.buffer, nodes.length - 1); natural(n.byteOffset, l.maxBufferBytes); natural(n.byteLength, l.maxBufferBytes);
      ioCheck(n.view === 'data-view' || (typeof n.view === 'string' && Object.hasOwn(NUMERIC_VIEWS, n.view)),
        'GRAPH', 'Unknown view encoding.');
      const b = nodes[n.buffer];
      ioCheck(b !== null && typeof b === 'object' && b.kind === 'buffer', 'GRAPH', 'View target is not a buffer.');
      ioCheck(n.byteOffset <= b.byteLength && n.byteLength <= b.byteLength - n.byteOffset,
        'GRAPH', 'View exceeds its backing buffer.');
      if (n.view === 'data-view') ioCheck(n.length === null, 'GRAPH', 'DataView length is byte-only.');
      else {
        natural(n.length, l.maxViewElements);
        const width = NUMERIC_VIEWS[n.view as keyof typeof NUMERIC_VIEWS].BYTES_PER_ELEMENT;
        ioCheck(n.byteOffset % width === 0 && n.length <= Math.floor(l.maxBufferBytes / width) &&
          n.length * width === n.byteLength, 'GRAPH', 'Misaligned or inconsistent numeric view.');
      }
      ioCheck(++edges <= l.maxEdges, 'LIMIT', 'Graph edge limit.');
    } else if (kind === 'array') {
      const n = plain(raw, ['kind', 'values']);
      ioCheck(Array.isArray(n.values), 'GRAPH', 'Invalid array node.'); natural(n.values.length, l.maxArrayLength);
      n.values.forEach(atom);
    } else if (kind === 'record') {
      const n = plain(raw, ['kind', 'recordPrototype', 'entries']);
      ioCheck(n.recordPrototype === 'plain' || n.recordPrototype === 'null', 'GRAPH', 'Invalid prototype tag.');
      ioCheck(Array.isArray(n.entries), 'GRAPH', 'Invalid record entries.');
      ioCheck(n.entries.length <= l.maxEdges - edges, 'LIMIT', 'Record edge limit.');
      const seen = new Set<string>(); let previousIndex = -1, namedKeySeen = false;
      for (const entry of n.entries as unknown[]) {
        ioCheck(Array.isArray(entry) && entry.length === 3 && typeof entry[0] === 'string' &&
          typeof entry[1] === 'boolean', 'GRAPH', 'Invalid property entry.');
        validateScientificJson(entry[0], jsonLimits(l));
        const key = entry[0], numeric = Number(key);
        ioCheck(!seen.has(key), 'GRAPH', 'Duplicate record key.'); seen.add(key);
        const indexKey = Number.isInteger(numeric) && numeric >= 0 && numeric < 0xffffffff && String(numeric) === key;
        if (indexKey) {
          ioCheck(!namedKeySeen && numeric > previousIndex, 'GRAPH', 'Impossible JavaScript own-key order.');
          previousIndex = numeric;
        } else namedKeySeen = true;
        atom(entry[2]);
      }
    } else throw new CheckpointIOError('GRAPH', 'Unknown graph node tag.');
  }
  const colors = new Uint8Array(nodes.length), heights = new Uint32Array(nodes.length);
  let reached = 0;
  const heightAtom = (v: GraphAtom, depth: number): number =>
    v === null || typeof v !== 'object' || !('$ref' in v) ? 0 : height(v.$ref, depth);
  const height = (id: number, depth: number): number => {
    ioCheck(depth <= l.maxGraphDepth, 'LIMIT', 'Logical graph depth limit.');
    ioCheck(colors[id] !== 1, 'CYCLE', 'Cyclic graph reference.');
    if (colors[id] === 2) return heights[id];
    colors[id] = 1; reached++;
    const n = nodes[id]; let childHeight = 0;
    if (n.kind === 'view') childHeight = height(n.buffer, depth + 1);
    else if (n.kind === 'array') {
      for (const v of n.values) childHeight = Math.max(childHeight, heightAtom(v, depth + 1));
    } else if (n.kind === 'record') {
      for (const entry of n.entries) childHeight = Math.max(childHeight, heightAtom(entry[2], depth + 1));
    }
    colors[id] = 2; heights[id] = childHeight + 1;
    ioCheck(heights[id] <= l.maxGraphDepth + 1, 'LIMIT', 'Logical longest-path limit.');
    return heights[id];
  };
  const rootHeight = heightAtom(rootValue, 0);
  ioCheck(rootHeight <= l.maxGraphDepth + 1 && reached === nodes.length,
    'GRAPH', 'Unreachable graph node or excessive depth.');
  return { root: rootValue, nodes, payloadBytes };
}
function restoreGraph(
  root: GraphAtom, nodes: readonly GraphNode[], payloads: ReadonlyMap<number, Uint8Array>,
): unknown {
  const values: unknown[] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind === 'buffer') {
      const bytes = payloads.get(i)!;
      ioCheck(bytes.byteLength === n.byteLength, 'GRAPH', 'Missing buffer bytes.');
      values[i] = new Uint8Array(bytes).buffer;
    } else if (n.kind === 'record') values[i] = Object.create(n.recordPrototype === 'null' ? null : Object.prototype);
    else if (n.kind === 'array') values[i] = new Array(n.values.length);
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; if (n.kind !== 'view') continue;
    const buffer = values[n.buffer] as ArrayBuffer;
    if (n.view === 'data-view') values[i] = new DataView(buffer, n.byteOffset, n.byteLength);
    else {
      const a = new NUMERIC_VIEWS[n.view](buffer, n.byteOffset, n.length!);
      for (let j = 0; j < a.length; j++) ioCheck(Number.isFinite(a[j]), 'NUMBER', 'Nonfinite restored numeric view.');
      values[i] = a;
    }
  }
  const atom = (v: GraphAtom): unknown => {
    if (v === null || typeof v !== 'object') return v;
    return '$ref' in v ? values[v.$ref] : decodeFloat64(v);
  };
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind === 'array') n.values.forEach((v, j) => { (values[i] as unknown[])[j] = atom(v); });
    else if (n.kind === 'record') {
      for (const [key, enumerable, v] of n.entries)
        Object.defineProperty(values[i], key, { value: atom(v), enumerable, writable: true, configurable: true });
    }
  }
  return atom(root);
}
function manifestPreimage(manifest: GraphManifest, l: CheckpointGraphLimits): Uint8Array {
  const body: Record<string, unknown> = { ...manifest }; delete body.sha256;
  return new TextEncoder().encode(OWNED_GRAPH_DOMAIN + canonicalScientificText(body, jsonLimits(l)));
}
export async function serializeOwnedGraph(
  value: unknown, context: OwnedGraphContext, adapter: Sha256Adapter, options: OwnedGraphEncodeOptions = {},
): Promise<EncodedOwnedGraph> {
  const l = resolveCheckpointLimits(options.limits), ownedContext = copyContext(context, l);
  const gate = options.validateSnapshot, graph = captureGraph(value, l);
  canonicalScientificText({ root: graph.root, nodes: graph.nodes }, jsonLimits(l));
  if (gate !== undefined) {
    ioCheck(typeof gate === 'function' && gate(restoreGraph(graph.root, graph.nodes, graph.payloads)) === true,
      'OWNER', 'Snapshot gate must synchronously return true.');
  }
  const nodes = [...graph.nodes];
  for (const [id, bytes] of graph.payloads) {
    const n = nodes[id] as Extract<GraphNode, { kind: 'buffer' }>;
    nodes[id] = { ...n, sha256: await sha256Hex(bytes, adapter) };
  }
  const draft: GraphManifest = {
    format: OWNED_GRAPH_FORMAT, version: OWNED_GRAPH_VERSION, scalarEncoding: 'ieee754-binary64-hex-be',
    byteOrder: nativeByteOrder(), context: ownedContext, root: graph.root, nodes, sha256: null,
  };
  const contentSha256 = await sha256Hex(manifestPreimage(draft, l), adapter);
  const manifest: GraphManifest = { ...draft, sha256: contentSha256 };
  const json = new TextEncoder().encode(canonicalScientificText(manifest, jsonLimits(l)));
  const payloadBytes = validateGraph(graph.root, nodes, l, true).payloadBytes;
  const bytes = new Uint8Array(16 + json.byteLength + payloadBytes), header = new DataView(bytes.buffer);
  for (let i = 0; i < 8; i++) bytes[i] = OWNED_GRAPH_MAGIC.charCodeAt(i);
  header.setUint32(8, json.byteLength, true); header.setUint32(12, payloadBytes, true);
  bytes.set(json, 16); let offset = 16 + json.byteLength;
  for (let i = 0; i < nodes.length; i++) if (nodes[i].kind === 'buffer') {
    const buffer = graph.payloads.get(i)!; bytes.set(buffer, offset); offset += buffer.byteLength;
  }
  return { bytes, contentSha256 };
}
export async function deserializeOwnedGraph(
  input: Uint8Array, expectedContext: OwnedGraphContext, adapter: Sha256Adapter,
  limits: Partial<CheckpointGraphLimits> = {},
): Promise<DecodedOwnedGraph> {
  const l = resolveCheckpointLimits(limits), expected = copyContext(expectedContext, l);
  const bytes = copyBytes(input, 16 + l.maxMetadataBytes + l.maxTotalBufferBytes);
  ioCheck(bytes.byteLength >= 16, 'FORMAT', 'Truncated runtime header.');
  for (let i = 0; i < 8; i++) ioCheck(bytes[i] === OWNED_GRAPH_MAGIC.charCodeAt(i), 'VERSION', 'Unknown runtime-storage version.');
  const header = new DataView(bytes.buffer), jsonLength = header.getUint32(8, true), payloadLength = header.getUint32(12, true);
  ioCheck(jsonLength > 0 && jsonLength <= l.maxMetadataBytes && payloadLength <= l.maxTotalBufferBytes,
    'LIMIT', 'Runtime header exceeds configured limits.');
  ioCheck(bytes.length === 16 + jsonLength + payloadLength, 'FORMAT', 'Truncation/trailing runtime bytes.');
  const json = bytes.subarray(16, 16 + jsonLength);
  ioCheck(!(json[0] === 0xef && json[1] === 0xbb && json[2] === 0xbf), 'FORMAT', 'BOM is forbidden.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(json); }
  catch { throw new CheckpointIOError('UTF8', 'Invalid UTF-8.'); }
  const r = plain(parseScientificJson(text, jsonLimits(l)),
    ['format', 'version', 'scalarEncoding', 'byteOrder', 'context', 'root', 'nodes', 'sha256']);
  ioCheck(r.format === OWNED_GRAPH_FORMAT && r.version === OWNED_GRAPH_VERSION &&
    r.scalarEncoding === 'ieee754-binary64-hex-be', 'VERSION', 'Unsupported runtime format/profile.');
  ioCheck(r.byteOrder === 'little-endian' || r.byteOrder === 'big-endian', 'FORMAT', 'Unknown byte order.');
  ioCheck(r.byteOrder === nativeByteOrder(), 'ENDIAN', 'Exact aliased-buffer restoration requires matching host byte order.');
  const context = copyContext(r.context as OwnedGraphContext, l);
  ioCheck(canonicalScientificText(context) === canonicalScientificText(expected),
    'IDENTITY', 'Expected context must be loaded independently and match exactly.');
  digest(r.sha256);
  const graph = validateGraph(r.root, r.nodes, l, true);
  ioCheck(graph.payloadBytes === payloadLength, 'FORMAT', 'Graph/header payload mismatch.');
  ioCheck(await sha256Hex(manifestPreimage(r as unknown as GraphManifest, l), adapter) === r.sha256,
    'HASH', 'Runtime manifest differs.');
  const payloads = new Map<number, Uint8Array>(); let offset = 16 + jsonLength;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]; if (n.kind !== 'buffer') continue;
    const raw = bytes.subarray(offset, offset + n.byteLength); offset += n.byteLength;
    ioCheck(await sha256Hex(raw, adapter) === n.sha256, 'HASH', 'Runtime backing-buffer hash differs.');
    payloads.set(i, raw);
  }
  ioCheck(offset === bytes.length, 'FORMAT', 'Payload endpoint mismatch.');
  return { value: restoreGraph(graph.root, graph.nodes, payloads), context, contentSha256: r.sha256 };
}
