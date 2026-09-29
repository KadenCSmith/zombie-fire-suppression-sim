import {
  CANONICAL_PROFILE_ID, FORMAT_ID, SCHEMA_ID, SCHEMA_VERSION, SchemaError,
  validateManifest, validateScientificJson,
} from './schema';
import type { PhysicalStateManifest, ScientificJson, ValidationOptions } from './schema';
import { MANIFEST_DOMAIN, canonicalManifestText, canonicalScientificText } from './canonical';
import { sha256Hex, snapshotBundle } from './hash';
import type { PhysicalBundle, Sha256Adapter } from './hash';

/** Physical-recording envelope family only, NOT G runtime-checkpoint migration. */
export type MigrationEnvelope = Omit<PhysicalStateManifest, 'schemaId' | 'schemaVersion'> & {
  readonly schemaId: string; readonly schemaVersion: number;
};
export interface EnvelopeMigrationStep {
  readonly fromVersion: number; readonly toVersion: number;
  readonly transform: (manifest: MigrationEnvelope) => unknown;
}
export interface MigrationReceipt {
  readonly fromVersion: number; readonly toVersion: number;
  readonly beforeSha256: string; readonly afterSha256: string;
}
export interface EnvelopeMigrationResult {
  readonly manifest: MigrationEnvelope;
  readonly payloads: ReadonlyMap<string, Uint8Array>;
  readonly receipts: readonly MigrationReceipt[];
}
export interface CurrentMigrationResult { readonly bundle: PhysicalBundle; readonly receipts: readonly MigrationReceipt[] }
export const MAX_MIGRATION_STEPS = 32;
function fail(code: string, detail: string): never { throw new SchemaError(code, '$migration', detail); }
function version(n: unknown): asserts n is number {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || Object.is(n, -0))
    fail('UNSUPPORTED', 'Invalid version index.');
}
function schemaId(n: number): string { return `zf-physical-states/v${n}`; }
function envelope(value: unknown, options: ValidationOptions): MigrationEnvelope {
  validateScientificJson(value, options.limits);
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail('UNSUPPORTED', 'Expected a physical manifest object.');
  const m = value as unknown as MigrationEnvelope; version(m.schemaVersion);
  if (m.format !== FORMAT_ID || m.schemaId !== schemaId(m.schemaVersion))
    fail('UNSUPPORTED', 'Unsupported format/version identity.');
  validateManifest({ ...m, schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION }, options);
  return m;
}
export async function hashMigrationEnvelopeClaims(
  value: unknown, adapter: Sha256Adapter, options: ValidationOptions = {},
): Promise<string> {
  const m = envelope(value, options);
  const projected = JSON.parse(canonicalManifestText({ ...m, schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION }, options)) as Record<string, ScientificJson>;
  projected.schemaId = m.schemaId; projected.schemaVersion = m.schemaVersion;
  return sha256Hex(new TextEncoder().encode(MANIFEST_DOMAIN + canonicalScientificText(projected, options.limits)), adapter);
}
function protectedBody(m: MigrationEnvelope, options: ValidationOptions): string {
  const body: Record<string, unknown> = { ...m };
  delete body.schemaId; delete body.schemaVersion; delete body.integrity;
  return canonicalScientificText(body, options.limits);
}
function frozenCopy(m: MigrationEnvelope, options: ValidationOptions): MigrationEnvelope {
  const copy = JSON.parse(canonicalScientificText(m, options.limits)) as MigrationEnvelope;
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    Object.values(value).forEach(freeze); Object.freeze(value);
  };
  freeze(copy); return copy;
}
export async function runEnvelopeMigrations(
  input: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  targetVersion: number, steps: readonly EnvelopeMigrationStep[], options: ValidationOptions = {},
): Promise<EnvelopeMigrationResult> {
  version(targetVersion); const source = envelope(input, options);
  if (targetVersion < source.schemaVersion || targetVersion - source.schemaVersion > MAX_MIGRATION_STEPS)
    fail('UNSUPPORTED', 'Downgrade or excessive migration chain.');
  if (!Array.isArray(steps) || steps.length > MAX_MIGRATION_STEPS) fail('MIGRATION_ROUTE', 'Invalid step registry.');
  const graph = new Map<number, EnvelopeMigrationStep>();
  for (const s of steps) {
    version(s.fromVersion); version(s.toVersion);
    if (s.toVersion !== s.fromVersion + 1 || typeof s.transform !== 'function' || graph.has(s.fromVersion))
      fail('MIGRATION_ROUTE', 'Steps must be unique capabilities for adjacent versions.');
    graph.set(s.fromVersion, { fromVersion: s.fromVersion, toVersion: s.toVersion, transform: s.transform });
  }
  const route: EnvelopeMigrationStep[] = [];
  for (let v = source.schemaVersion; v < targetVersion; v++) {
    const s = graph.get(v); if (s === undefined) fail('UNSUPPORTED', `No reviewed migration from version ${v}.`);
    route.push(s);
  }
  const snap = snapshotBundle({ ...source, schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION }, payloads, options);
  let current: MigrationEnvelope = { ...snap.manifest, schemaId: source.schemaId, schemaVersion: source.schemaVersion };
  if (current.integrity === null) fail('UNSEALED', 'Verify the source before transforming it.');
  for (const b of current.blocks) {
    if (b.sha256 === null || await sha256Hex(snap.payloads.get(b.id)!, adapter) !== b.sha256)
      fail('HASH_MISMATCH', `Source block ${b.id} differs.`);
  }
  let root = await hashMigrationEnvelopeClaims(current, adapter, options);
  if (root !== current.integrity.manifestSha256) fail('HASH_MISMATCH', 'Source manifest differs.');
  const protectedText = protectedBody(current, options), receipts: MigrationReceipt[] = [];
  for (const step of route) {
    let proposal: unknown;
    try { proposal = step.transform(frozenCopy(current, options)); }
    catch { return fail('MIGRATION_TRANSFORM', 'Callback threw or attempted to mutate frozen input.'); }
    const next = envelope(proposal, options);
    if (next.schemaVersion !== step.toVersion || next.schemaId !== schemaId(step.toVersion) || next.integrity !== null)
      fail('MIGRATION_ROUTE', 'Transform must produce the exact next unsealed envelope.');
    if (protectedBody(next, options) !== protectedText)
      fail('MIGRATION_SEMANTICS', 'Scientific data, units, semantics, ordering or extensions changed.');
    const owned = JSON.parse(canonicalScientificText(next, options.limits)) as MigrationEnvelope;
    const after = await hashMigrationEnvelopeClaims(owned, adapter, options);
    current = { ...owned, integrity: { profile: CANONICAL_PROFILE_ID, algorithm: 'sha256', manifestSha256: after } };
    envelope(current, options);
    receipts.push({ fromVersion: step.fromVersion, toVersion: step.toVersion, beforeSha256: root, afterSha256: after });
    root = after;
  }
  return { manifest: current, payloads: snap.payloads, receipts };
}
export async function migrateToCurrent(
  input: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  steps: readonly EnvelopeMigrationStep[] = [], options: ValidationOptions = {},
): Promise<CurrentMigrationResult> {
  const result = await runEnvelopeMigrations(input, payloads, adapter, SCHEMA_VERSION, steps, options);
  return { bundle: { manifest: validateManifest(result.manifest, options).manifest, payloads: result.payloads },
    receipts: result.receipts };
}
