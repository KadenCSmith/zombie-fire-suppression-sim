/**
 * Owned finite data only: plain records, dense arrays, primitive scalar values,
 * fixed ordinary ArrayBuffer, DataView, and the nine non-BigInt numeric views.
 * Classes, functions, accessors, symbols, cycles, shared/resizable buffers and
 * detached buffers are rejected. Proxies/concurrent external mutation are unsupported.
 * Shared references within an acyclic input graph are preserved in each owned copy.
 */
export const TRANSACTION_SCHEMA_VERSION = 1 as const;
export type StateOwnershipFailure =
  | 'UNSUPPORTED_VALUE' | 'NON_FINITE_VALUE' | 'ACCESSOR_PROPERTY'
  | 'SYMBOL_PROPERTY' | 'CYCLIC_STATE' | 'UNSUPPORTED_BUFFER'
  | 'UNSUPPORTED_PROTOTYPE' | 'SPARSE_ARRAY' | 'EXTRA_ARRAY_PROPERTY';
export class StateOwnershipError extends Error {
  readonly code: StateOwnershipFailure;
  constructor(code: StateOwnershipFailure) {
    super(code); this.name = 'StateOwnershipError'; this.code = code;
  }
}
function ownershipFailure(code: StateOwnershipFailure): never {
  throw new StateOwnershipError(code);
}
const VIEW_TYPES = [
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array,
] as const;

export function cloneOwnedState<T>(input: T): T {
  const copies = new Map<object, unknown>(), active = new Set<object>();
  function copy(value: unknown): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) ownershipFailure('NON_FINITE_VALUE');
      return value;
    }
    if (typeof value !== 'object') ownershipFailure('UNSUPPORTED_VALUE');
    if (active.has(value)) ownershipFailure('CYCLIC_STATE');
    if (copies.has(value)) return copies.get(value);
    if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
      ownershipFailure('UNSUPPORTED_BUFFER');
    }
    if (value instanceof ArrayBuffer) {
      if (Object.getPrototypeOf(value) !== ArrayBuffer.prototype
          || Reflect.ownKeys(value).length !== 0
          || (value as ArrayBuffer & { resizable?: boolean }).resizable === true) ownershipFailure('UNSUPPORTED_BUFFER');
      let result: ArrayBuffer;
      try { result = value.slice(0); }
      catch { return ownershipFailure('UNSUPPORTED_BUFFER'); }
      copies.set(value, result);
      return result;
    }
    if (ArrayBuffer.isView(value)) {
      const proto = Object.getPrototypeOf(value);
      if (proto === DataView.prototype) {
        if (Reflect.ownKeys(value).length !== 0) ownershipFailure('UNSUPPORTED_VALUE');
        if (!(value.buffer instanceof ArrayBuffer)) ownershipFailure('UNSUPPORTED_BUFFER');
        let offset: number, length: number;
        try { offset = value.byteOffset; length = value.byteLength; }
        catch { return ownershipFailure('UNSUPPORTED_BUFFER'); }
        const result = new DataView(copy(value.buffer) as ArrayBuffer, offset, length);
        copies.set(value, result);
        return result;
      }
      const constructor = VIEW_TYPES.find(type => proto === type.prototype);
      if (!constructor) ownershipFailure('UNSUPPORTED_PROTOTYPE');
      const keys = Reflect.ownKeys(value);
      // Check names before reading .length/.buffer: an own accessor can shadow
      // a typed-array intrinsic. Numeric indexed properties cannot be accessors.
      for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== String(i)) ownershipFailure('EXTRA_ARRAY_PROPERTY');
      }
      const view = value as Float64Array;
      if (keys.length !== view.length) ownershipFailure('EXTRA_ARRAY_PROPERTY');
      if (!(view.buffer instanceof ArrayBuffer)) ownershipFailure('UNSUPPORTED_BUFFER');
      for (let i = 0; i < view.length; i++) {
        if (!Number.isFinite(view[i])) ownershipFailure('NON_FINITE_VALUE');
      }
      const buffer = copy(view.buffer) as ArrayBuffer;
      const result = new constructor(buffer, view.byteOffset, view.length);
      copies.set(value, result);
      return result;
    }
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) ownershipFailure('UNSUPPORTED_PROTOTYPE');
      const keys = Reflect.ownKeys(value);
      if (keys.length < value.length + 1) ownershipFailure('SPARSE_ARRAY');
      if (keys.length > value.length + 1) ownershipFailure('EXTRA_ARRAY_PROPERTY');
      const result: unknown[] = new Array(value.length);
      copies.set(value, result); active.add(value);
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor) ownershipFailure('SPARSE_ARRAY');
        if (!('value' in descriptor)) ownershipFailure('ACCESSOR_PROPERTY');
        result[i] = copy(descriptor.value);
      }
      active.delete(value);
      return result;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) ownershipFailure('UNSUPPORTED_PROTOTYPE');
    const result: Record<string, unknown> = Object.create(proto) as Record<string, unknown>;
    copies.set(value, result); active.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') ownershipFailure('SYMBOL_PROPERTY');
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor)) ownershipFailure('ACCESSOR_PROPERTY');
      Object.defineProperty(result, key, {
        value: copy(descriptor.value), enumerable: descriptor.enumerable,
        writable: true, configurable: true,
      });
    }
    active.delete(value);
    return result;
  }
  return copy(input) as T;
}
export type TransactionFailure =
  | 'NESTED_TRIAL' | 'STALE_TRIAL' | 'REENTRANT_OPERATION'
  | 'INVALID_RESULT' | 'COUNTER_LIMIT' | 'ACTIVE_CHECKPOINT' | 'INVALID_CHECKPOINT';
export class TransactionError extends Error {
  readonly code: TransactionFailure;
  constructor(code: TransactionFailure) {
    super(code); this.name = 'TransactionError'; this.code = code;
  }
}
function fail(code: TransactionFailure): never { throw new TransactionError(code); }
function natural(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function increment(value: number): number {
  if (!natural(value) || value >= Number.MAX_SAFE_INTEGER) fail('COUNTER_LIMIT');
  return value + 1;
}
export interface TrialHandle<T> {
  readonly id: number;
  readonly baseVersion: number;
  /** Mutable trial, never an alias of committed state. */
  readonly state: T;
}
export type TrialResult<R> =
  | { readonly decision: 'commit'; readonly value: R }
  | { readonly decision: 'rollback'; readonly value: R };
export interface TransactionResult<R> {
  readonly committed: boolean;
  readonly version: number;
  /** May alias discarded trial data; it never aliases the published state. */
  readonly value: R;
}
export interface TransactionSnapshot<T> {
  readonly schemaVersion: typeof TRANSACTION_SCHEMA_VERSION;
  readonly version: number;
  /** Count of successful begin() calls, including subsequently rolled-back trials. */
  readonly trialSerial: number;
  readonly committed: T;
}
/**
 * Synchronous pointer-swap publication of a wholly owned data graph.
 * No external objects, callbacks, worker state, engine classes or stores are patched.
 * A transaction protects ONLY the complete state graph actually given to it.
 */
export class AtomicState<T> {
  #committed: T;
  #version = 0;
  #trialSerial = 0;
  #active: TrialHandle<T> | null = null;
  #running = false;

  constructor(initial: T) { this.#committed = cloneOwnedState(initial); }
  get version(): number { return this.#version; }
  get hasActiveTrial(): boolean { return this.#active !== null; }
  /** Read copies deliberately cannot mutate the owner's live committed graph. */
  read(): T { return cloneOwnedState(this.#committed); }

  begin(): TrialHandle<T> {
    if (this.#running) fail('REENTRANT_OPERATION');
    if (this.#active !== null) fail('NESTED_TRIAL');
    const serial = increment(this.#trialSerial);
    const trial = Object.freeze({
      id: serial, baseVersion: this.#version, state: cloneOwnedState(this.#committed),
    });
    this.#active = trial; this.#trialSerial = serial;
    return trial;
  }
  #requireTrial(trial: TrialHandle<T>): void {
    if (this.#active !== trial || trial.baseVersion !== this.#version) fail('STALE_TRIAL');
  }
  #publish(trial: TrialHandle<T>): number {
    this.#requireTrial(trial);
    try {
      const version = increment(this.#version);
      // Retained handles/operation return values cannot mutate the committed copy.
      const candidate = cloneOwnedState(trial.state);
      // No user callbacks or allocations after this point and before publication.
      this.#committed = candidate; this.#version = version; this.#active = null;
      return version;
    } catch (error) {
      // Even failure while validating/cloning a candidate abandons the trial.
      this.#active = null;
      throw error;
    }
  }
  commit(trial: TrialHandle<T>): number {
    if (this.#running) fail('REENTRANT_OPERATION');
    return this.#publish(trial);
  }
  rollback(trial: TrialHandle<T>): void {
    if (this.#running) fail('REENTRANT_OPERATION');
    this.#requireTrial(trial);
    this.#active = null;
  }
  /**
   * Runs only synchronous author code on an owned trial. Return commit/rollback.
   * Rejected/throwing/thenable operations cannot publish. Async continuations may
   * still run in the host but retain only an abandoned, disconnected trial.
   */
  run<R>(operation: (draft: T) => TrialResult<R>): TransactionResult<R> {
    const trial = this.begin();
    this.#running = true;
    try {
      const result = operation(trial.state);
      if (result === null || typeof result !== 'object'
          || 'then' in result
          || (result.decision !== 'commit' && result.decision !== 'rollback')) fail('INVALID_RESULT');
      const value = result.value;
      if (result.decision === 'commit') {
        const version = increment(this.#version);
        const response = Object.freeze({ committed: true, version, value });
        this.#publish(trial);
        return response;
      }
      this.#active = null;
      return Object.freeze({ committed: false, version: this.#version, value });
    } catch (error) {
      this.#active = null;
      throw error;
    } finally {
      this.#running = false;
    }
  }
  /** Quiescent barrier only. Mid-trial checkpoints are explicitly unsupported. */
  snapshot(): TransactionSnapshot<T> {
    if (this.#active !== null || this.#running) fail('ACTIVE_CHECKPOINT');
    return Object.freeze({
      schemaVersion: TRANSACTION_SCHEMA_VERSION, version: this.#version,
      trialSerial: this.#trialSerial, committed: this.read(),
    });
  }
  static restore<T>(snapshot: TransactionSnapshot<T>): AtomicState<T> {
    if (snapshot === null || typeof snapshot !== 'object'
        || snapshot.schemaVersion !== TRANSACTION_SCHEMA_VERSION
        || !natural(snapshot.version) || !natural(snapshot.trialSerial)
        || snapshot.version > snapshot.trialSerial) fail('INVALID_CHECKPOINT');
    const result = new AtomicState(snapshot.committed);
    result.#version = snapshot.version; result.#trialSerial = snapshot.trialSerial;
    return result;
  }
}
