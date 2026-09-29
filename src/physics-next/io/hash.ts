import {
  CANONICAL_PROFILE_ID, DEFAULT_LIMITS, SchemaError, validateManifest,
} from './schema';
import type { PhysicalStateManifest, ValidationOptions } from './schema';
import {
  canonicalManifestBytes, cloneManifest, copyBytes, validateBlockBytes,
} from './canonical';

export interface Sha256Adapter {
  /** SHA-256 of exactly these bytes. Trusted executable capability, never loaded from a file. */
  digest(bytes: Uint8Array): Promise<Uint8Array>;
}
export interface PhysicalBundle {
  readonly manifest: PhysicalStateManifest;
  /** Owned finite little-endian bytes, indexed by block ID; not paths. */
  readonly payloads: ReadonlyMap<string, Uint8Array>;
}
function failure(code: string, path: string, detail: string): never {
  throw new SchemaError(code, path, detail);
}
export function createWebCryptoSha256(
  subtle: Pick<SubtleCrypto, 'digest'> | undefined = globalThis.crypto?.subtle,
): Sha256Adapter {
  if (subtle == null || typeof subtle.digest !== 'function') failure('HASH_UNAVAILABLE', '$hash', 'Supply a trusted SHA-256 adapter.');
  return {
    async digest(bytes) {
      const owned = copyBytes(bytes);
      const result = await subtle.digest('SHA-256', owned.buffer as ArrayBuffer);
      return new Uint8Array(new Uint8Array(result)); // Own a local fixed buffer, even for a foreign-realm backend.
    },
  };
}
export async function sha256Hex(bytes: Uint8Array, adapter: Sha256Adapter): Promise<string> {
  const owned = copyBytes(bytes);
  let result: Uint8Array;
  try { result = await adapter.digest(owned); }
  catch { return failure('HASH_BACKEND', '$hash', 'SHA-256 adapter failed.'); }
  const digest = copyBytes(result, 32);
  if (digest.byteLength !== 32) failure('HASH_BACKEND', '$hash', 'SHA-256 must return exactly 32 bytes.');
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}
export async function checkSha256Adapter(adapter: Sha256Adapter): Promise<void> {
  const vectors: readonly [string, string][] = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ];
  for (const [text, expected] of vectors) {
    if (await sha256Hex(new TextEncoder().encode(text), adapter) !== expected)
      failure('HASH_BACKEND', '$hash', 'Known-answer SHA-256 self-test failed.');
  }
}
export function snapshotBundle(
  value: unknown, payloads: ReadonlyMap<string, Uint8Array>, options: ValidationOptions = {},
): PhysicalBundle {
  const manifest = cloneManifest(value, options);
  if (!(payloads instanceof Map) || Object.getPrototypeOf(payloads) !== Map.prototype)
    failure('PAYLOADS', '$payloads', 'Require an ordinary same-realm Map.');
  const size = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!.call(payloads) as number;
  if (size !== manifest.blocks.length) failure('PAYLOADS', '$payloads', 'Missing or extra block entries.');
  const copies = new Map<string, Uint8Array>();
  for (const b of manifest.blocks) {
    const raw = Map.prototype.get.call(payloads, b.id) as unknown;
    const bytes = copyBytes(raw, b.byteLength);
    validateBlockBytes(b.dtype, b.elementCount, bytes, options.limits);
    copies.set(b.id, bytes);
  }
  return { manifest, payloads: copies };
}
/** This hashes descriptor claims only. It does NOT verify payloads or provenance documents. */
export async function hashManifestClaims(
  value: unknown, adapter: Sha256Adapter, options: ValidationOptions = {},
): Promise<string> {
  return sha256Hex(canonicalManifestBytes(value, options), adapter);
}
async function processBundle(
  input: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  options: ValidationOptions, requireSealed: boolean,
): Promise<PhysicalBundle> {
  const snap = snapshotBundle(input, payloads, options);
  if (requireSealed && snap.manifest.integrity === null)
    failure('UNSEALED', '$.integrity', 'A sealed manifest is required.');
  const blocks: PhysicalStateManifest['blocks'][number][] = [];
  for (const b of snap.manifest.blocks) {
    if (requireSealed && b.sha256 === null) failure('UNSEALED', b.id, 'Block digest missing.');
    const actual = await sha256Hex(snap.payloads.get(b.id)!, adapter);
    if (b.sha256 !== null && b.sha256 !== actual) failure('HASH_MISMATCH', b.id, 'Payload digest differs.');
    blocks.push({ ...b, sha256: actual });
  }
  const claimed = snap.manifest.integrity;
  const withBlocks: PhysicalStateManifest = { ...snap.manifest, blocks, integrity: null };
  const root = await hashManifestClaims(withBlocks, adapter, options);
  if (claimed !== null && claimed.manifestSha256 !== root)
    failure('HASH_MISMATCH', '$.integrity', 'Manifest digest differs.');
  const manifest: PhysicalStateManifest = {
    ...withBlocks, integrity: { profile: CANONICAL_PROFILE_ID, algorithm: 'sha256', manifestSha256: root },
  };
  validateManifest(manifest, options);
  return { manifest, payloads: snap.payloads };
}
/** Fills null block hashes and envelope only. Never silently repairs a mismatching claim. */
export function sealBundle(
  input: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  options: ValidationOptions = {},
): Promise<PhysicalBundle> {
  return processBundle(input, payloads, adapter, options, false);
}
/** Integrity is not authentication, physics validation, evidence resolution or restart authorization. */
export function verifyBundle(
  input: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  options: ValidationOptions = {},
): Promise<PhysicalBundle> {
  return processBundle(input, payloads, adapter, options, true);
}
export const HASH_BUFFER_CEILING = DEFAULT_LIMITS.maxTotalPayloadBytes;
