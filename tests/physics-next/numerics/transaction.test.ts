import * as assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  AtomicState, cloneOwnedState, StateOwnershipError, TransactionError,
  type TrialHandle, type TrialResult,
} from '../../../src/physics-next/numerics/transaction';
import {
  createTimestepState, planTimestep, settleTimestep,
} from '../../../src/physics-next/numerics/timestep';

function initial() {
  return { values: new Float64Array([1, 2, 3]), history: [{ value: 1 }], time: 0 };
}
it('construction, reads, and trial graphs are deeply owned', () => {
  const input = initial();
  const store = new AtomicState(input);
  input.values[0] = 99; input.history[0].value = 99;
  const read = store.read();
  read.values[1] = 77; read.history.push({ value: 77 });
  const trial = store.begin();
  trial.state.values[0] = 55;
  assert.deepEqual(store.read(), initial());
  store.rollback(trial);
  assert.deepEqual(store.read(), initial());
});
it('commit isolates published state from all retained trial and return-value aliases', () => {
  const store = new AtomicState(initial());
  const result = store.run(draft => {
    draft.values[1] = 8; draft.history.push({ value: 8 });
    return { decision: 'commit', value: draft };
  });
  assert.equal(result.version, 1);
  result.value.values[1] = 99; result.value.history.length = 0;
  assert.deepEqual(store.read().values, new Float64Array([1, 8, 3]));
  assert.equal(store.read().history.length, 2);
});
it('rollback preserves committed arrays, histories, scalars and version exactly', () => {
  const store = new AtomicState(initial()), before = store.snapshot();
  const result = store.run(draft => {
    draft.values.fill(100); draft.time = 100; draft.history.push({ value: 100 });
    return { decision: 'rollback', value: 'declined' };
  });
  assert.equal(result.committed, false);
  assert.equal(store.version, 0);
  assert.deepEqual(store.read(), before.committed);
  assert.equal(store.snapshot().trialSerial, before.trialSerial + 1);
});
it('throwing operations abandon the trial and allow the next independent attempt', () => {
  const store = new AtomicState(initial());
  assert.throws(() => store.run(draft => {
    draft.values[0] = 5; draft.time = 5;
    throw new Error('injected');
  }), /injected/);
  assert.equal(store.hasActiveTrial, false);
  assert.deepEqual(store.read(), initial());
  store.run(draft => { draft.time = 1; return { decision: 'commit', value: null }; });
  assert.equal(store.read().time, 1);
});
it('nonfinite late commit errors cannot leak trial arrays or history', () => {
  const store = new AtomicState(initial());
  const trial = store.begin();
  trial.state.values[0] = 11; trial.state.history[0].value = NaN;
  assert.throws(() => store.commit(trial), StateOwnershipError);
  assert.equal(store.hasActiveTrial, false);
  assert.deepEqual(store.read(), initial());
  assert.equal(store.version, 0);
  assert.throws(() => store.commit(trial), TransactionError);
});
it('nested and stale handles are rejected without discarding the valid active trial', () => {
  const store = new AtomicState(initial()), a = store.begin();
  assert.throws(() => store.begin(), TransactionError);
  const forged = { ...a } as TrialHandle<ReturnType<typeof initial>>;
  assert.throws(() => store.commit(forged), TransactionError);
  assert.equal(store.hasActiveTrial, true);
  store.rollback(a);
  const b = store.begin();
  assert.throws(() => store.rollback(a), TransactionError);
  store.commit(b);
  assert.throws(() => store.commit(b), TransactionError);
});
it('callbacks cannot publish, roll back, or begin another trial reentrantly', () => {
  const store = new AtomicState(initial());
  store.run(() => {
    assert.throws(() => store.begin(), TransactionError);
    assert.throws(() => store.rollback({} as TrialHandle<ReturnType<typeof initial>>), TransactionError);
    assert.throws(() => store.commit({} as TrialHandle<ReturnType<typeof initial>>), TransactionError);
    return { decision: 'rollback', value: null };
  });
  assert.equal(store.version, 0);
});
it('thenable results are rejected synchronously without physical publication', () => {
  const store = new AtomicState(initial());
  assert.throws(() => store.run(draft => {
    draft.time = 123;
    return Promise.resolve({ decision: 'commit', value: null }) as unknown as TrialResult<null>;
  }), TransactionError);
  assert.deepEqual(store.read(), initial());
  assert.equal(store.hasActiveTrial, false);
});
it('typed array types, offsets, and internal shared buffers are preserved but owned', () => {
  const buffer = new ArrayBuffer(32);
  const floats = new Float64Array(buffer, 8, 2); floats.set([2, 3]);
  const bytes = new Uint8Array(buffer);
  const input = { buffer, floats, bytes, alias: floats, view: new DataView(buffer, 8, 16) };
  const copy = cloneOwnedState(input);
  assert.notEqual(copy.buffer, buffer);
  assert.equal(copy.floats.buffer, copy.buffer);
  assert.equal(copy.bytes.buffer, copy.buffer);
  assert.equal(copy.view.buffer, copy.buffer);
  assert.equal(copy.alias, copy.floats);
  assert.equal(copy.floats.byteOffset, 8);
  copy.floats[0] = 10;
  assert.equal(floats[0], 2);
  const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
  assert.equal(copy.view.getFloat64(0, littleEndian), 10);
});
it('all supported numeric view classes and ordinary dense arrays clone correctly', () => {
  for (const Type of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array]) {
    const input = new Type([1, 2, 3]), copy = cloneOwnedState(input);
    assert.equal(Object.getPrototypeOf(copy), Type.prototype);
    assert.deepEqual(copy, input); assert.notEqual(copy.buffer, input.buffer);
  }
  assert.deepEqual(cloneOwnedState([1, { x: [2] }]), [1, { x: [2] }]);
});
it('shared aliases in plain records are retained internally, not back to inputs', () => {
  const child = { x: [1] }, copy = cloneOwnedState({ a: child, b: child });
  assert.equal(copy.a, copy.b); assert.notEqual(copy.a, child);
});
it('null-prototype records and __proto__ fields are copied without prototype mutation', () => {
  const input = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(input, '__proto__', { value: { polluted: true }, enumerable: true });
  const copy = cloneOwnedState(input);
  assert.equal(Object.getPrototypeOf(copy), null);
  assert.deepEqual(copy['__proto__'], { polluted: true });
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});
it('accessors are rejected without invoking them, including late trial additions', () => {
  let calls = 0;
  const state = initial();
  Object.defineProperty(state, 'bad', { get() { calls++; throw new Error('getter'); } });
  assert.throws(() => cloneOwnedState(state), StateOwnershipError);
  assert.equal(calls, 0);
  const store = new AtomicState(initial()), t = store.begin();
  Object.defineProperty(t.state, 'bad', { get() { calls++; return 1; } });
  assert.throws(() => store.commit(t), StateOwnershipError);
  assert.equal(calls, 0); assert.deepEqual(store.read(), initial());
});
it('unsupported graphs fail rather than silently losing state', () => {
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  const sparse = new Array(3); sparse[0] = 1;
  const symbol = { [Symbol('x')]: 1 };
  const extra = [1] as number[] & { label?: string }; extra.label = 'x';
  for (const value of [undefined, () => 1, 1n, new Date(), new Map(), new Set(),
    cycle, sparse, symbol, extra, NaN, Infinity, new Float32Array([Infinity])]) {
    assert.throws(() => cloneOwnedState(value), StateOwnershipError);
  }
});
it('shared and detached buffers are rejected', () => {
  if (typeof SharedArrayBuffer !== 'undefined') {
    assert.throws(() => cloneOwnedState(new SharedArrayBuffer(8)), StateOwnershipError);
    assert.throws(() => cloneOwnedState(new Float64Array(new SharedArrayBuffer(8))), StateOwnershipError);
  }
  const buffer = new ArrayBuffer(8);
  structuredClone(buffer, { transfer: [buffer] });
  assert.throws(() => cloneOwnedState(buffer), StateOwnershipError);
});
it('resizable buffers are rejected when supported by the runtime', () => {
  const Ctor = ArrayBuffer as unknown as new (
    length: number, options?: { maxByteLength: number }
  ) => ArrayBuffer & { resizable?: boolean };
  const buffer = new Ctor(8, { maxByteLength: 16 });
  if (buffer.resizable) assert.throws(() => cloneOwnedState(buffer), StateOwnershipError);
});
it('snapshot refuses active trials and owns all data at a quiescent barrier', () => {
  const store = new AtomicState(initial()), t = store.begin();
  assert.throws(() => store.snapshot(), TransactionError);
  store.rollback(t);
  const snap = store.snapshot();
  snap.committed.values[0] = 99;
  assert.equal(store.read().values[0], 1);
  store.run(() => {
    assert.throws(() => store.snapshot(), TransactionError);
    return { decision: 'rollback', value: null };
  });
});
it('restore preserves commit version and consumed trial IDs deterministically', () => {
  const a = new AtomicState(initial());
  a.run(d => { d.time = 1; return { decision: 'commit', value: null }; });
  a.run(() => ({ decision: 'rollback', value: null }));
  const b = AtomicState.restore(a.snapshot());
  const x = a.begin(), y = b.begin();
  assert.equal(x.id, y.id); assert.equal(x.baseVersion, y.baseVersion);
  x.state.time = 2; y.state.time = 2;
  a.commit(x); b.commit(y);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
it('malformed transaction snapshot versions and counters are rejected', () => {
  const base = new AtomicState(initial()).snapshot();
  for (const bad of [{ ...base, schemaVersion: 2 }, { ...base, version: NaN },
    { ...base, trialSerial: -1 }, { ...base, version: 1, trialSerial: 0 }]) {
    assert.throws(() => AtomicState.restore(bad as typeof base), TransactionError);
  }
});
it('physical data and a candidate accepted clock publish or roll back together', () => {
  const clock = createTimestepState({
    minimumStep: 0.125, initialStep: 1, maximumStep: 1, shrinkFactor: 0.5,
    growthFactor: 1, lowErrorRatio: 0.1, growthAfter: 1, maxRetries: 2,
  });
  const store = new AtomicState({ values: new Float64Array([1]), clock, history: [0] });
  const before = store.read();
  const attempt = (commit: boolean) => store.run(draft => {
    const planned = planTimestep(draft.clock, null);
    const result = settleTimestep(planned, planned.attempts,
      { kind: 'evaluated', errorRatio: 0, guards: [] });
    draft.clock = result.state; draft.values[0] = 9; draft.history.push(result.state.time);
    return { decision: commit ? 'commit' : 'rollback', value: result.record };
  });
  attempt(false); assert.deepEqual(store.read(), before);
  attempt(true);
  assert.equal(store.read().clock.time, 1);
  assert.equal(store.read().values[0], 9);
  assert.deepEqual(store.read().history, [0, 1]);
});
it('deterministic repeated rejections leave accepted graph byte-for-byte unchanged', () => {
  const store = new AtomicState(initial()), before = store.read();
  const bytes = new Uint8Array(before.values.buffer).slice();
  for (let i = 0; i < 100; i++) store.run(draft => {
    draft.values[0] = i; draft.history.push({ value: i }); draft.time = i;
    return { decision: 'rollback', value: null };
  });
  const after = store.read();
  assert.deepEqual(new Uint8Array(after.values.buffer), bytes);
  assert.deepEqual(after.history, before.history);
  assert.equal(after.time, before.time); assert.equal(store.version, 0);
});


it('view/buffer metadata accessors are rejected before any getter runs', () => {
  let calls = 0;
  for (const name of ['buffer', 'length', 'byteOffset']) {
    const view = new Float64Array([1]);
    Object.defineProperty(view, name, { get() { calls++; return 0; } });
    assert.throws(() => cloneOwnedState(view), StateOwnershipError);
  }
  const buffer = new ArrayBuffer(8);
  Object.defineProperty(buffer, 'resizable', { get() { calls++; return false; } });
  assert.throws(() => cloneOwnedState(buffer), StateOwnershipError);
  assert.equal(calls, 0);
});
