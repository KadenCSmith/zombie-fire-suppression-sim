/**
 * H persistence boundary. G/D/F compatibility must be checked against current main.
 * Reference compilation is not current-main integration verification.
 */
export * from './schema';
export {
  canonicalManifestBytes, canonicalManifestText, canonicalScientificText,
  decodeFloat64, encodeFloat64, encodeTypedArray,
} from './canonical';
export type { NumericArray } from './canonical';
export {
  checkSha256Adapter, createWebCryptoSha256, hashManifestClaims, sealBundle, sha256Hex, verifyBundle,
} from './hash';
export type { PhysicalBundle, Sha256Adapter } from './hash';
export {
  CONTAINER_HEADER_BYTES, CONTAINER_MAGIC, decodeTypedArray, deserializeBundle, parseScientificJson,
  serializeBundle, OWNED_GRAPH_FORMAT, OWNED_GRAPH_VERSION, OWNED_GRAPH_MAGIC, OWNED_GRAPH_DOMAIN,
  CHECKPOINT_GRAPH_LIMITS, CheckpointIOError, nativeByteOrder, resolveCheckpointLimits,
  serializeOwnedGraph, deserializeOwnedGraph,
} from './serialize';
export type {
  NativeByteOrder, CheckpointGraphLimits, OwnedGraphContext, OwnedGraphEncodeOptions,
  EncodedOwnedGraph, DecodedOwnedGraph,
} from './serialize';
export { createReplayInspector } from './replay';
export type {
  FieldInspection, ReplayCoverage, ReplayGap, ReplayInspector, ReplayPosition, ReplaySelection,
} from './replay';
export {
  MAX_MIGRATION_STEPS, hashMigrationEnvelopeClaims, migrateToCurrent, runEnvelopeMigrations,
} from './migration';
export type {
  CurrentMigrationResult, EnvelopeMigrationResult, EnvelopeMigrationStep, MigrationEnvelope, MigrationReceipt,
} from './migration';

import { canonicalScientificText, copyBytes } from './canonical';
import type { Sha256Adapter } from './hash';
import { CheckpointIOError, deserializeOwnedGraph, resolveCheckpointLimits, serializeOwnedGraph } from './serialize';
import type { CheckpointGraphLimits, EncodedOwnedGraph, OwnedGraphContext } from './serialize';
import { createRuntimeCheckpoint, restoreRuntimeCheckpoint } from '../numerics/checkpoint';
import type { CheckpointIdentity, RuntimeCheckpoint, RuntimeState } from '../numerics/checkpoint';
import type { AtomicState } from '../numerics/transaction';

export interface RuntimeCheckpointIOPolicy<T> {
  /** Independently loaded context, never copied from the imported file. */
  readonly context: OwnedGraphContext;
  readonly expectedIdentity: CheckpointIdentity;
  readonly validateOwner: (owner: Readonly<T>) => boolean;
  readonly limits?: Partial<CheckpointGraphLimits>;
}
export interface RestoredRuntimeCheckpoint<T> {
  /** A new detached store; no active application store is replaced. */
  readonly store: AtomicState<RuntimeState<T>>;
  readonly checkpoint: RuntimeCheckpoint<T>;
  readonly contentSha256: string;
}
function ownPolicy<T>(policy: RuntimeCheckpointIOPolicy<T>): RuntimeCheckpointIOPolicy<T> {
  const limits = resolveCheckpointLimits(policy.limits);
  const context = JSON.parse(canonicalScientificText(policy.context, {
    maxManifestBytes: limits.maxMetadataBytes, maxStringBytes: limits.maxStringBytes,
  })) as OwnedGraphContext;
  const identity = JSON.parse(canonicalScientificText(policy.expectedIdentity)) as CheckpointIdentity;
  if (identity.sourceRevision !== context.sourceCommit || identity.ownerSchema !== context.ownerSchema ||
      identity.contextFingerprint !== context.contextFingerprint || typeof policy.validateOwner !== 'function') {
    throw new CheckpointIOError('IDENTITY', 'Explicit policy, complete Git identity and owner validator must agree.');
  }
  return { context, expectedIdentity: identity, validateOwner: policy.validateOwner, limits };
}
export function persistRuntimeCheckpoint<T>(
  checkpoint: RuntimeCheckpoint<T>, policy: RuntimeCheckpointIOPolicy<T>, adapter: Sha256Adapter,
): Promise<EncodedOwnedGraph> {
  const owned = ownPolicy(policy);
  return serializeOwnedGraph(checkpoint, owned.context, adapter, {
    limits: owned.limits,
    validateSnapshot(snapshot) {
      restoreRuntimeCheckpoint<T>(snapshot, owned.expectedIdentity, owned.validateOwner);
      return true;
    },
  });
}
export async function restorePersistedRuntimeCheckpoint<T>(
  bytes: Uint8Array, policy: RuntimeCheckpointIOPolicy<T>, adapter: Sha256Adapter,
): Promise<RestoredRuntimeCheckpoint<T>> {
  const owned = ownPolicy(policy);
  const decoded = await deserializeOwnedGraph(bytes, owned.context, adapter, owned.limits);
  const store = restoreRuntimeCheckpoint<T>(decoded.value, owned.expectedIdentity, owned.validateOwner);
  return { store, checkpoint: createRuntimeCheckpoint(store, owned.expectedIdentity),
    contentSha256: decoded.contentSha256 };
}
/** Current-version identity migration only. Unknown formats/G schemas require a reviewed adapter. */
export async function migratePersistedRuntimeCheckpoint<T>(
  input: Uint8Array, policy: RuntimeCheckpointIOPolicy<T>, adapter: Sha256Adapter,
): Promise<{ readonly bytes: Uint8Array; readonly beforeSha256: string; readonly afterSha256: string;
  readonly transitions: readonly [] }> {
  const owned = ownPolicy(policy), limits = resolveCheckpointLimits(owned.limits);
  const bytes = copyBytes(input, 16 + limits.maxMetadataBytes + limits.maxTotalBufferBytes);
  const checked = await restorePersistedRuntimeCheckpoint(bytes, owned, adapter);
  return { bytes, beforeSha256: checked.contentSha256, afterSha256: checked.contentSha256, transitions: [] };
}
