import { NORM_REDUCTION_VERSION } from './norms';
import {
  ITERATION_ALGORITHM_VERSION, IterationController, type IterationSnapshot,
} from './iteration';
import {
  TIMESTEP_ALGORITHM_VERSION, restoreTimestepState, type TimestepState,
} from './timestep';
import {
  TRANSACTION_SCHEMA_VERSION, AtomicState, cloneOwnedState, type TransactionSnapshot,
} from './transaction';
import {
  DIAGNOSTICS_SCHEMA_VERSION, DIAGNOSTICS_ALGORITHM_VERSION,
  BoundedDiagnostics, type DiagnosticSnapshot,
} from './diagnostics';

export const RUNTIME_CHECKPOINT_SCHEMA_VERSION = 1 as const;
export interface CheckpointIdentity {
  /** Opaque identities supplied/verified by the caller, never inferred here. */
  readonly sourceRevision: string;
  readonly contextFingerprint: string;
  readonly ownerSchema: string;
}
export interface NamedIterationSnapshot {
  readonly id: string;
  readonly state: IterationSnapshot;
}
/**
 * One atomic graph. Owner must include every remaining acceptance-affecting
 * field/cache, event cursor/order, future-input schedule and optional RNG state.
 * No domain-specific equations or bytes/transport format are specified here.
 */
export interface RuntimeState<T> {
  /** Mutable draft slots; AtomicState never exposes its private committed graph. */
  owner: T;
  timestep: TimestepState;
  iterations: readonly NamedIterationSnapshot[];
  diagnostics: DiagnosticSnapshot | null;
}
export interface RuntimeCheckpoint<T> {
  readonly schemaVersion: typeof RUNTIME_CHECKPOINT_SCHEMA_VERSION;
  readonly identity: CheckpointIdentity;
  readonly algorithms: {
    readonly norms: typeof NORM_REDUCTION_VERSION;
    readonly iteration: typeof ITERATION_ALGORITHM_VERSION;
    readonly timestep: typeof TIMESTEP_ALGORITHM_VERSION;
    readonly transaction: typeof TRANSACTION_SCHEMA_VERSION;
    readonly diagnostics: typeof DIAGNOSTICS_ALGORITHM_VERSION;
    readonly diagnosticsSchema: typeof DIAGNOSTICS_SCHEMA_VERSION;
  };
  readonly transaction: TransactionSnapshot<RuntimeState<T>>;
}
export type CheckpointMigration = (
  previousData: unknown, requiredSchema: typeof RUNTIME_CHECKPOINT_SCHEMA_VERSION,
) => unknown;
export type CheckpointFailure =
  | 'UNSUPPORTED_SCHEMA' | 'INVALID_IDENTITY' | 'IDENTITY_MISMATCH'
  | 'ALGORITHM_MISMATCH' | 'INVALID_RUNTIME_STATE' | 'ACTIVE_TIMESTEP'
  | 'ACTIVE_ITERATION' | 'OWNER_REJECTED' | 'OWNER_VALIDATOR_MUTATED'
  | 'INVALID_ENVELOPE';
export class CheckpointError extends Error {
  readonly code: CheckpointFailure;
  constructor(code: CheckpointFailure) {
    super(code); this.name = 'CheckpointError'; this.code = code;
  }
}
function ensure(ok: boolean, code: CheckpointFailure): void { if (!ok) throw new CheckpointError(code); }
function ownIdentity(input: CheckpointIdentity): CheckpointIdentity {
  ensure(input !== null && typeof input === 'object', 'INVALID_IDENTITY');
  for (const field of ['sourceRevision', 'contextFingerprint', 'ownerSchema'] as const) {
    ensure(typeof input[field] === 'string' && input[field].length > 0
      && input[field].trim() === input[field], 'INVALID_IDENTITY');
  }
  return Object.freeze({
    sourceRevision: input.sourceRevision, contextFingerprint: input.contextFingerprint,
    ownerSchema: input.ownerSchema,
  });
}
const ALGORITHMS = Object.freeze({
  norms: NORM_REDUCTION_VERSION, iteration: ITERATION_ALGORITHM_VERSION,
  timestep: TIMESTEP_ALGORITHM_VERSION, transaction: TRANSACTION_SCHEMA_VERSION,
  diagnostics: DIAGNOSTICS_ALGORITHM_VERSION, diagnosticsSchema: DIAGNOSTICS_SCHEMA_VERSION,
});

/**
 * Compares validated owned graphs, including buffer bytes and alias topology.
 * Descriptor reads do not execute getters. Not a serializer, digest or signature.
 */
function sameOwned(a: unknown, b: unknown, exactKeyOrder = false): boolean {
  const left = new Map<object, object>(), right = new Map<object, object>();
  function equal(x: unknown, y: unknown): boolean {
    if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') return Object.is(x, y);
    if (left.has(x) || right.has(y)) return left.get(x) === y && right.get(y) === x;
    if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return false;
    left.set(x, y); right.set(y, x);
    if (x instanceof ArrayBuffer) {
      if (!(y instanceof ArrayBuffer) || x.byteLength !== y.byteLength) return false;
      const xb = new Uint8Array(x), yb = new Uint8Array(y);
      for (let i = 0; i < xb.length; i++) if (xb[i] !== yb[i]) return false;
      return true;
    }
    if (ArrayBuffer.isView(x)) {
      return ArrayBuffer.isView(y) && x.byteOffset === y.byteOffset && x.byteLength === y.byteLength
        && equal(x.buffer, y.buffer);
    }
    const xkeys = Reflect.ownKeys(x), ykeys = Reflect.ownKeys(y);
    if (!exactKeyOrder) { xkeys.sort(); ykeys.sort(); }
    if (xkeys.length !== ykeys.length) return false;
    // Metadata key order is not semantic; validator checks can request exact owner order.
    for (let i = 0; i < xkeys.length; i++) {
      if (xkeys[i] !== ykeys[i]) return false;
      const xd = Object.getOwnPropertyDescriptor(x, xkeys[i])!;
      const yd = Object.getOwnPropertyDescriptor(y, ykeys[i])!;
      if (!('value' in xd) || !('value' in yd) || xd.enumerable !== yd.enumerable
          || !equal(xd.value, yd.value)) return false;
    }
    return true;
  }
  return equal(a, b);
}
function ownRuntime<T>(input: RuntimeState<T>): RuntimeState<T> {
  ensure(input !== null && typeof input === 'object', 'INVALID_RUNTIME_STATE');
  const timestep = restoreTimestepState(input.timestep);
  ensure(timestep.status !== 'trial', 'ACTIVE_TIMESTEP');
  ensure(Array.isArray(input.iterations), 'INVALID_RUNTIME_STATE');
  const ids = new Set<string>();
  const iterations = input.iterations.map(named => {
    ensure(named !== null && typeof named === 'object'
      && typeof named.id === 'string' && named.id.length > 0 && named.id.trim() === named.id
      && !ids.has(named.id), 'INVALID_RUNTIME_STATE');
    ids.add(named.id);
    const controller = IterationController.restore(named.state);
    // Empty/prepared or terminal controllers only at the committed runtime barrier.
    ensure(controller.evaluations === 0 || controller.done, 'ACTIVE_ITERATION');
    return Object.freeze({ id: named.id, state: controller.snapshot() });
  });
  const diagnostics = input.diagnostics === null ? null : BoundedDiagnostics.restore(input.diagnostics).snapshot();
  const result: RuntimeState<T> = Object.freeze({
    owner: cloneOwnedState(input.owner), timestep, iterations: Object.freeze(iterations), diagnostics,
  });
  // Cross-subsystem mutable aliases would be broken by independent validation.
  // Refuse them (or noncanonical/unknown schema fields), never silently break them.
  ensure(sameOwned(result, input), 'INVALID_RUNTIME_STATE');
  return result;
}
function makeEnvelope<T>(
  snapshot: TransactionSnapshot<RuntimeState<T>>, identity: CheckpointIdentity,
): RuntimeCheckpoint<T> {
  const transaction = AtomicState.restore(snapshot).snapshot();
  const runtime = ownRuntime(transaction.committed);
  return Object.freeze({
    schemaVersion: RUNTIME_CHECKPOINT_SCHEMA_VERSION, identity: ownIdentity(identity),
    algorithms: ALGORITHMS, transaction: Object.freeze({ ...transaction, committed: runtime }),
  });
}
/**
 * Data structures only. Throws for an active transaction, pending timestep, or
 * unresolved iteration. No timeout/clock is hidden and no incomplete checkpoint is emitted.
 */
export function createRuntimeCheckpoint<T>(
  store: AtomicState<RuntimeState<T>>, identity: CheckpointIdentity,
): RuntimeCheckpoint<T> {
  return makeEnvelope(store.snapshot(), identity);
}
/**
 * Expected identity MUST come from independently loaded intended configuration,
 * not just be copied from the input checkpoint. No implicit/default migration.
 * Owner validator must return true, synchronously, without changing its owned copy.
 */
export function restoreRuntimeCheckpoint<T>(
  input: unknown,
  expectedIdentity: CheckpointIdentity,
  validateOwner: (owner: Readonly<T>) => boolean,
  migration?: CheckpointMigration,
): AtomicState<RuntimeState<T>> {
  let data = cloneOwnedState(input);
  const header = (): number | null => {
    if (data === null || typeof data !== 'object') return null;
    const value = (data as { schemaVersion?: unknown }).schemaVersion;
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
  };
  if (header() !== RUNTIME_CHECKPOINT_SCHEMA_VERSION) {
    ensure(migration !== undefined, 'UNSUPPORTED_SCHEMA');
    data = cloneOwnedState(migration!(data, RUNTIME_CHECKPOINT_SCHEMA_VERSION));
    ensure(header() === RUNTIME_CHECKPOINT_SCHEMA_VERSION, 'UNSUPPORTED_SCHEMA');
  }
  ensure(data !== null && typeof data === 'object', 'INVALID_ENVELOPE');
  const checkpoint = data as RuntimeCheckpoint<T>;
  const identity = ownIdentity(checkpoint.identity);
  const expected = ownIdentity(expectedIdentity);
  ensure(sameOwned(identity, expected), 'IDENTITY_MISMATCH');
  ensure(sameOwned(checkpoint.algorithms, ALGORITHMS), 'ALGORITHM_MISMATCH');
  const canonical = makeEnvelope(checkpoint.transaction, identity);
  ensure(sameOwned(canonical, checkpoint), 'INVALID_ENVELOPE');
  const candidate = cloneOwnedState(canonical.transaction.committed.owner);
  const before = cloneOwnedState(candidate);
  ensure(typeof validateOwner === 'function' && validateOwner(candidate) === true, 'OWNER_REJECTED');
  // Invalid values/accessors/cycles introduced by a validator are rejected as well.
  ensure(sameOwned(before, cloneOwnedState(candidate), true), 'OWNER_VALIDATOR_MUTATED');
  return AtomicState.restore(canonical.transaction);
}
