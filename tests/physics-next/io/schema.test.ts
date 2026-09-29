import { describe, expect, it } from 'vitest';
import {
  BASELINE_ARCHIVE_SHA256, BASELINE_COMMIT, BASE_UNITS, BYTES_PER_ELEMENT,
  CANONICAL_PROFILE_ID, DEFAULT_LIMITS, FORMAT_ID, SCALAR_ENCODING, SCHEMA_ID,
  SCHEMA_VERSION, SchemaError, validateManifest,
} from '../../../src/physics-next/io/schema';
import type {
  Association, DType, Float64Token, PhysicalStateManifest, ValidationOptions,
} from '../../../src/physics-next/io/schema';

type Mutable<T> = T extends readonly (infer V)[] ? Mutable<V>[] :
  T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
function real(value: number): Float64Token {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return { $f64: Array.from({ length: 8 }, (_, i) => view.getUint8(i).toString(16).padStart(2, '0')).join('') };
}
function fixture(): Mutable<PhysicalStateManifest> {
  return {
    format: FORMAT_ID, schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION,
    scalarEncoding: SCALAR_ENCODING, runId: 'fixture.run',
    units: {
      system: 'SI', temperature: 'absolute-kelvin', coordinates: 'x-y-horizontal-depth-positive-down',
      dimensionOrder: ['kg', 'm', 's', 'A', 'K', 'mol', 'cd'],
      definitions: BASE_UNITS.map(u => ({ id: u.id, dimensions: [...u.dimensions] })),
    },
    grids: [{ id: 'g0', kind: 'uniform-cartesian-3d', axisOrder: ['x', 'y', 'depth'],
      indexOrder: 'x-fastest', cells: [2, 3, 1],
      originM: [real(0), real(0), real(0)], extentM: [real(2), real(3), real(1)] }],
    fieldDefinitions: [{ id: 'temperature', semanticId: 'fixture.absolute-temperature.v1',
      owner: 'physics', role: 'state', required: true, unitId: 'K', basis: 'absolute cell temperature',
      dtype: 'f64', association: 'cell', globalEntities: null, components: ['value'], layout: 'entity-major' }],
    blocks: [{ id: 'b0', dtype: 'f64', byteOrder: 'little-endian', elementCount: 6, byteLength: 48, sha256: null }],
    provenance: [{ id: 'p0', source: {
      baselineCommit: BASELINE_COMMIT, snapshotSha256: BASELINE_ARCHIVE_SHA256,
      implementationCommit: BASELINE_COMMIT, dirty: false, workingTreeSha256: null,
    }, model: { id: 'fixture.single-field-model', revision: '1', sha256: 'a'.repeat(64) },
    parameters: { id: 'fixture.parameters', revision: '1', sha256: 'b'.repeat(64) },
    evidence: [], verificationReports: [] }],
    states: [{ id: 's0', gridId: 'g0', provenanceId: 'p0', acceptance: 'accepted', capture: 'native-committed',
      commitIndex: 0, acceptedStepIndex: 0, kind: 'initial', timeS: real(0), stepSizeS: null,
      physicsCoverage: 'complete', missing: [], restart: 'inspection-only', restartContract: null,
      fields: [{ fieldId: 'temperature', blockId: 'b0' }], controllerId: null, extensions: [] }],
    controllers: [], events: [], extensions: [], integrity: null,
  };
}
function withData(data: unknown): unknown {
  return { ...fixture(), extensions: [{ namespace: 'example.test', version: 1, critical: false, data }] };
}
function rejected(value: unknown, options?: ValidationOptions, code?: string): void {
  let caught: unknown;
  try { validateManifest(value, options); } catch (error) { caught = error; }
  expect(caught instanceof SchemaError).toBe(true);
  if (code !== undefined) expect((caught as SchemaError).code).toBe(code);
}
function withStep(): Mutable<PhysicalStateManifest> {
  const m = fixture();
  m.states.push({ ...structuredClone(m.states[0]), id: 's1', commitIndex: 1,
    acceptedStepIndex: 1, kind: 'step', timeS: real(1), stepSizeS: real(1) });
  return m;
}
function withController(): Mutable<PhysicalStateManifest> {
  const m = fixture();
  m.controllers.push({ id: 'c0', stateId: 's0',
    schema: { id: 'fixture.controller-schema', revision: '1', sha256: 'c'.repeat(64) },
    coverage: 'complete', missing: [], payload: { nextStepS: real(0.25), acceptedStepIndex: 0 }, fields: [] });
  m.states[0].controllerId = 'c0';
  return m;
}
function candidate(): Mutable<PhysicalStateManifest> {
  const m = withController();
  m.states[0].restart = 'candidate';
  m.states[0].restartContract = { id: 'fixture.restart-contract', revision: '1', sha256: 'd'.repeat(64) };
  return m;
}

describe('v1 manifest structure and noninterference', () => {
  it('accepts a synthetic native state without copying or mutating it', () => {
    const m = fixture(), before = structuredClone(m), result = validateManifest(m);
    expect(result.manifest).toBe(m);
    expect(m).toEqual(before);
    expect(result.declaredPayloadBytes).toBe(48);
    expect(result.compactManifestBytes).toBe(new TextEncoder().encode(JSON.stringify(m)).length);
  });
  it('is JSON-safe at the manifest level without claiming a payload round trip', () => {
    const m = withController();
    m.grids[0].originM[0] = real(-0);
    m.controllers[0].payload = { threshold: real(1 / 3), smallest: real(Number.MIN_VALUE) };
    const parsed: unknown = JSON.parse(JSON.stringify(m));
    expect(validateManifest(parsed).manifest).toEqual(m);
  });
  it('accepts both null-prototype scientific objects and valid scalar Unicode', () => {
    const data = Object.assign(Object.create(null) as Record<string, unknown>, { note: 'peat 🌱 e\u0301' });
    expect(() => validateManifest(withData(data))).not.toThrow();
  });
  for (const field of ['presentationTime', 'camera', 'animationFrames']) {
    it(`rejects root presentation property ${field}`, () => rejected({ ...fixture(), [field]: 0 }));
  }
  it('rejects nested unknown core keys instead of silently dropping them', () => {
    const m = fixture(); Object.assign(m.states[0], { camera: 'orbit' }); rejected(m);
  });
  it('rejects missing required core properties', () => {
    const m = fixture() as unknown as Record<string, unknown>; delete m.scalarEncoding; rejected(m);
  });
  it('rejects legacy checkpoint and UI recording shapes', () => {
    rejected({ formatVersion: 1, arrays: {}, scenario: {} });
    rejected({ format: 'zombie-fire-recording', schemaVersion: 1, checkpoints: [] });
  });
  it('rejects an unsupported format/schema/version/scalar encoding', () => {
    for (const change of [{ format: 'other' }, { schemaId: 'other/v1' },
      { schemaVersion: 2 }, { schemaVersion: 0 }, { scalarEncoding: 'json-number' }]) rejected({ ...fixture(), ...change });
  });
  it('checks the expected baseline without requiring network access', () => {
    expect(() => validateManifest(fixture(), { expectedBaselineCommit: BASELINE_COMMIT })).not.toThrow();
    rejected(fixture(), { expectedBaselineCommit: 'f'.repeat(40) }, 'BASELINE');
  });
});

describe('exact scalar-token and safe JSON boundaries', () => {
  for (const value of [0, -0, 0.1, 1 / 3, -42, Number.MIN_VALUE, Number.MAX_VALUE]) {
    it(`retains the finite bits ${real(value).$f64}`, () => {
      const token = real(value), input = withData({ sample: token });
      const result = validateManifest(input);
      expect(result.manifest.extensions[0].data).toEqual({ sample: token });
    });
  }
  for (const bits of ['7ff0000000000000', 'fff0000000000000', '7ff8000000000000', '7ff0000000000001']) {
    it(`rejects nonfinite bits ${bits}`, () => rejected(withData({ $f64: bits }), undefined, 'NUMBER'));
  }
  for (const bits of ['0', '00000000000000000', '3FF0000000000000', 'xxxxxxxxxxxxxxxx']) {
    it(`rejects malformed token ${bits}`, () => rejected(withData({ $f64: bits })));
  }
  it('rejects extra token keys', () => rejected(withData({ $f64: real(1).$f64, extra: true })));
  it('rejects raw fractional, nonfinite, unsafe integer and negative-zero numbers', () => {
    for (const n of [0.25, NaN, Infinity, -Infinity, -0, Number.MAX_SAFE_INTEGER + 1]) rejected(withData(n));
  });
  it('permits exact signed safe integer metadata', () => {
    expect(() => validateManifest(withData([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]))).not.toThrow();
  });
  it('rejects symbols, bigint, undefined and executable values', () => {
    for (const v of [Symbol('x'), 1n, undefined, () => 1]) rejected(withData(v));
  });
  it('does not invoke an accessor while rejecting it', () => {
    let called = false;
    const data = Object.defineProperty({}, 'x', { enumerable: true, get() { called = true; return 1; } });
    rejected(withData(data)); expect(called).toBe(false);
  });
  it('does not invoke toJSON while rejecting it', () => {
    let called = false;
    rejected(withData({ toJSON() { called = true; return 1; } })); expect(called).toBe(false);
  });
  it('rejects inherited/custom-prototype objects and native typed buffers', () => {
    for (const data of [new Date(0), new Map(), new Uint8Array(2), new Float64Array(2),
      new ArrayBuffer(8), Object.create({ inherited: 1 })]) rejected(withData(data));
  });
  it('rejects forbidden keys including literal JSON __proto__ without pollution', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      rejected(withData(JSON.parse(`{"${key}": {"polluted": true}}`)));
    }
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
  it('rejects own symbols and non-enumerable properties', () => {
    rejected(withData({ [Symbol('hidden')]: 1 }));
    rejected(withData(Object.defineProperty({}, 'x', { value: 1, enumerable: false })));
  });
  it('rejects cycles, sparse/decorated arrays and accessor elements', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic; rejected(withData(cyclic));
    rejected(withData(new Array(4)));
    rejected(withData(Object.assign([1], { extra: 2 })));
    const a = [1]; Object.defineProperty(a, '0', { enumerable: true, get() { throw new Error('must not run'); } });
    rejected(withData(a));
  });
  it('rejects unpaired surrogates and preserves ordinary escaped strings', () => {
    rejected(withData('\ud800')); rejected(withData('\udfff'));
    const input = withData('"\\\b\f\n\r\t\u0000\u007f\u0080\u07ff\u0800🌱');
    expect(validateManifest(input).compactManifestBytes).toBe(new TextEncoder().encode(JSON.stringify(input)).length);
  });
});

describe('units, geometry and exact field cardinality', () => {
  it('requires every base unit and locks their dimensions', () => {
    const missing = fixture(); missing.units.definitions.pop(); rejected(missing);
    const altered = fixture(); altered.units.definitions.find(u => u.id === 'K')!.dimensions[0] = 1; rejected(altered);
  });
  it('accepts a declared coherent derived unit and requires the field basis', () => {
    const m = fixture();
    m.units.definitions.push({ id: 'Pa', dimensions: [1, -1, -2, 0, 0, 0, 0] });
    m.fieldDefinitions[0].unitId = 'Pa'; m.fieldDefinitions[0].basis = 'absolute cell pressure';
    m.fieldDefinitions[0].semanticId = 'fixture.pressure.v1';
    expect(() => validateManifest(m)).not.toThrow();
    m.fieldDefinitions[0].basis = ''; rejected(m);
  });
  it('rejects arbitrary conversion factors, offsets and incompatible dimension conventions', () => {
    const m = fixture(); Object.assign(m.units.definitions[0], { scale: 0.3048 }); rejected(m);
    const n = fixture(); Object.assign(n.units, { temperature: 'C' }); rejected(n);
    const q = fixture(); q.units.definitions[0].dimensions[1] = 33; rejected(q);
    const order = fixture(); order.units.dimensionOrder.reverse(); rejected(order);
  });
  it('requires field unit references to exist', () => {
    const m = fixture(); m.fieldDefinitions[0].unitId = 'missing'; rejected(m, undefined, 'REFERENCE');
  });
  it('rejects zero, fractional and enormous grid counts before payload allocation', () => {
    for (const n of [0, 1.5, Number.MAX_SAFE_INTEGER]) {
      const m = fixture(); m.grids[0].cells[0] = n; rejected(m);
    }
    const m = fixture(); m.grids[0].cells = [1024, 1024, 1024]; rejected(m);
  });
  it('rejects nonpositive extents, overflowed endpoints and spacing underflow', () => {
    for (const n of [0, -1]) { const m = fixture(); m.grids[0].extentM[0] = real(n); rejected(m); }
    const overflow = fixture(); overflow.grids[0].originM[0] = real(Number.MAX_VALUE);
    overflow.grids[0].extentM[0] = real(Number.MAX_VALUE); rejected(overflow);
    const underflow = fixture(); underflow.grids[0].extentM[0] = real(Number.MIN_VALUE); rejected(underflow);
  });
  it('rejects unsupported geometry/order rather than remapping', () => {
    const m = fixture(); Object.assign(m.grids[0], { kind: 'unstructured' }); rejected(m);
    const n = fixture(); Object.assign(n.grids[0], { indexOrder: 'z-fastest' }); rejected(n);
  });
  const layouts: readonly [Association, number][] = [
    ['cell', 6], ['node', 24], ['face-x', 9], ['face-y', 8], ['face-depth', 12], ['global', 5],
  ];
  for (const [association, entities] of layouts) {
    it(`checks ${association} entity-major vector cardinality`, () => {
      const m = fixture(); m.fieldDefinitions[0].association = association;
      m.fieldDefinitions[0].globalEntities = association === 'global' ? entities : null;
      m.fieldDefinitions[0].components = ['x', 'y', 'depth'];
      m.blocks[0].elementCount = entities * 3; m.blocks[0].byteLength = entities * 3 * 8;
      expect(() => validateManifest(m)).not.toThrow();
      m.blocks[0].elementCount--; m.blocks[0].byteLength -= 8; rejected(m, undefined, 'LAYOUT');
    });
  }
  it('accepts empty explicit global collections without pretending they are grid fields', () => {
    const m = fixture(); m.fieldDefinitions[0].association = 'global'; m.fieldDefinitions[0].globalEntities = 0;
    m.blocks[0].elementCount = 0; m.blocks[0].byteLength = 0;
    expect(validateManifest(m).declaredPayloadBytes).toBe(0);
  });
  it('requires the global count only for global associations', () => {
    const m = fixture(); m.fieldDefinitions[0].globalEntities = 6; rejected(m);
    const n = fixture(); n.fieldDefinitions[0].association = 'global'; rejected(n);
  });
  it('rejects duplicate/empty components and does not reorder tensor components', () => {
    const m = fixture(); m.fieldDefinitions[0].components = ['xx', 'xx']; rejected(m);
    const n = fixture(); n.fieldDefinitions[0].components = []; rejected(n);
  });
  for (const dtype of Object.keys(BYTES_PER_ELEMENT) as DType[]) {
    it(`validates exact ${dtype} byte count without downcasting`, () => {
      const m = fixture(); m.fieldDefinitions[0].dtype = dtype; m.blocks[0].dtype = dtype;
      m.blocks[0].byteLength = 6 * BYTES_PER_ELEMENT[dtype];
      expect(validateManifest(m).declaredPayloadBytes).toBe(6 * BYTES_PER_ELEMENT[dtype]);
      m.blocks[0].byteLength++; rejected(m, undefined, 'LAYOUT');
    });
  }
  it('rejects dtype mismatch, padding, unsupported type and native/big endianness', () => {
    const m = fixture(); m.blocks[0].dtype = 'f32'; m.blocks[0].byteLength = 24; rejected(m);
    const n = fixture(); Object.assign(n.blocks[0], { byteOrder: 'big-endian' }); rejected(n);
    const q = fixture(); Object.assign(q.blocks[0], { dtype: 'f16' }); rejected(q);
  });
});

describe('references, extensions and size ceilings', () => {
  it('rejects duplicate identifiers in every indexed collection', () => {
    for (const key of ['grids', 'fieldDefinitions', 'blocks', 'provenance', 'states'] as const) {
      const m = fixture(); Object.assign(m, { [key]: [...m[key], m[key][0]] }); rejected(m, undefined, 'DUPLICATE');
    }
    const m = withController(); m.controllers.push(structuredClone(m.controllers[0])); rejected(m, undefined, 'DUPLICATE');
  });
  it('rejects dangling grid/provenance/field/block/controller/event references', () => {
    for (const key of ['gridId', 'provenanceId', 'controllerId'] as const) {
      const m = fixture(); m.states[0][key] = 'missing'; rejected(m, undefined, 'REFERENCE');
    }
    for (const key of ['fieldId', 'blockId'] as const) {
      const m = fixture(); m.states[0].fields[0][key] = 'missing'; rejected(m, undefined, 'REFERENCE');
    }
    const m = fixture(); m.events.push({ id: 'e0', stateId: 'missing', order: 0, type: 'fixture.marker', payload: null }); rejected(m);
  });
  it('rejects orphan blocks/controllers and duplicate field bindings', () => {
    const m = fixture(); m.blocks.push({ ...m.blocks[0], id: 'orphan' }); rejected(m);
    const n = withController(); n.states[0].controllerId = null; rejected(n);
    const q = fixture(); q.states[0].fields.push({ ...q.states[0].fields[0] }); rejected(q);
  });
  it('enforces required field presence without filling missing arrays', () => {
    const m = fixture(); m.fieldDefinitions.push({ ...m.fieldDefinitions[0], id: 'required-extra' }); rejected(m);
  });
  it('permits storage sharing across accepted states and counts unique blocks once', () => {
    expect(validateManifest(withStep()).declaredPayloadBytes).toBe(48);
  });
  it('does not impose catalog or binding order', () => {
    const m = fixture();
    m.fieldDefinitions.push({ ...m.fieldDefinitions[0], id: 'temperature-history', role: 'history' });
    m.blocks.push({ ...m.blocks[0], id: 'b1' });
    m.states[0].fields.push({ fieldId: 'temperature-history', blockId: 'b1' });
    validateManifest(m); m.fieldDefinitions.reverse(); m.blocks.reverse(); m.states[0].fields.reverse();
    expect(() => validateManifest(m)).not.toThrow();
  });
  it('preserves optional unknown extensions including signed zero', () => {
    const m = fixture();
    m.extensions.push({ namespace: 'future.science', version: 12, critical: false, data: { unfamiliar: real(-0) } });
    const before = structuredClone(m.extensions);
    expect(validateManifest(m).manifest.extensions).toEqual(before);
  });
  it('rejects unknown critical extensions unless their exact supported version is declared', () => {
    const m = fixture(); m.extensions.push({ namespace: 'future.science', version: 2, critical: true, data: null });
    rejected(m, undefined, 'UNSUPPORTED');
    rejected(m, { knownCriticalExtensions: [{ namespace: 'future.science', version: 1 }] }, 'UNSUPPORTED');
    expect(() => validateManifest(m, { knownCriticalExtensions: [{ namespace: 'future.science', version: 2 }] })).not.toThrow();
  });
  it('rejects duplicate namespaces and unqualified extension names', () => {
    const m = fixture(); m.extensions.push({ namespace: 'unqualified', version: 1, critical: false, data: null }); rejected(m);
    m.extensions[0].namespace = 'example.test'; m.extensions.push({ ...m.extensions[0] }); rejected(m);
  });
  for (const id of ['../b0', 'a..b', '/tmp/b0', 'a/b', 'a\\b', '%2e%2e', 'a'.repeat(129)]) {
    it(`rejects path-like/oversized identifier ${id.slice(0, 20)}`, () => {
      const m = fixture(); m.runId = id; rejected(m);
    });
  }
  it('enforces exact compact JSON byte boundary including escaped Unicode', () => {
    const input = withData('peat 🌱\n"'), bytes = validateManifest(input).compactManifestBytes;
    expect(bytes).toBe(new TextEncoder().encode(JSON.stringify(input)).length);
    expect(() => validateManifest(input, { limits: { maxManifestBytes: bytes } })).not.toThrow();
    rejected(input, { limits: { maxManifestBytes: bytes - 1 } }, 'LIMIT');
  });
  it('enforces payload byte boundaries before allocation', () => {
    expect(() => validateManifest(fixture(), { limits: { maxBlockBytes: 48, maxTotalPayloadBytes: 48 } })).not.toThrow();
    rejected(fixture(), { limits: { maxBlockBytes: 47 } });
    rejected(fixture(), { limits: { maxTotalPayloadBytes: 47 } }, 'LIMIT');
    const m = fixture(); m.blocks[0].elementCount = DEFAULT_LIMITS.maxBlockElements + 1; rejected(m);
  });
  it('caps aggregate distinct payload bytes, not just individual blocks', () => {
    const m = fixture(); m.fieldDefinitions.push({ ...m.fieldDefinitions[0], id: 'other' });
    m.blocks.push({ ...m.blocks[0], id: 'other-block' });
    m.states[0].fields.push({ fieldId: 'other', blockId: 'other-block' });
    expect(validateManifest(m).declaredPayloadBytes).toBe(96);
    rejected(m, { limits: { maxTotalPayloadBytes: 95 } }, 'LIMIT');
  });
  it('rejects attempts to raise, disable or invent a resource limit', () => {
    for (const n of [0, -1, 1.5, Infinity, DEFAULT_LIMITS.maxBlocks + 1]) {
      rejected(fixture(), { limits: { maxBlocks: n } }, 'LIMIT');
    }
    rejected(fixture(), { limits: { nonexistent: 1 } as ValidationOptions['limits'] }, 'LIMIT');
  });
  it('enforces collection, depth, node and string limits', () => {
    rejected(withStep(), { limits: { maxStates: 1 } });
    rejected(fixture(), { limits: { maxDepth: 2 } }, 'LIMIT');
    rejected(fixture(), { limits: { maxJsonNodes: 10 } }, 'LIMIT');
    rejected(withData('x'.repeat(DEFAULT_LIMITS.maxStringBytes)), undefined, 'LIMIT');
    const m = fixture(); m.grids[0].cells = [1024, 1024, 1];
    rejected(m, { limits: { maxEntities: 1_000_000 } });
  });
});

describe('accepted sequence and controller/provenance boundaries', () => {
  it('retains accepted states across sparse commit/step gaps without synthesizing entries', () => {
    const m = withStep(); m.states[1].commitIndex = 10; m.states[1].acceptedStepIndex = 8;
    m.states[1].timeS = real(30); m.states[1].stepSizeS = real(0.5);
    expect(validateManifest(m).manifest.states.length).toBe(2);
  });
  it('permits a recording beginning at a noninitial sparse accepted state', () => {
    const m = withStep(); m.states.shift(); expect(() => validateManifest(m)).not.toThrow();
  });
  it('permits same-time accepted interventions with separate commit indices and events', () => {
    const m = withStep(); m.states[1].kind = 'intervention'; m.states[1].acceptedStepIndex = 0;
    m.states[1].timeS = real(0); m.states[1].stepSizeS = null;
    m.events.push({ id: 'e1', stateId: 's1', order: 0, type: 'fixture.heater-enabled', payload: true });
    expect(() => validateManifest(m)).not.toThrow();
  });
  it('rejects intervention states without event markers and duplicate event order', () => {
    const m = withStep(); m.states[1].kind = 'intervention'; m.states[1].acceptedStepIndex = 0;
    m.states[1].timeS = real(0); m.states[1].stepSizeS = null; rejected(m);
    m.events.push({ id: 'e0', stateId: 's1', order: 0, type: 'fixture.event', payload: null },
      { id: 'e1', stateId: 's1', order: 0, type: 'fixture.event', payload: null }); rejected(m, undefined, 'DUPLICATE');
  });
  it('rejects trial/presentation captures', () => {
    const m = fixture(); Object.assign(m.states[0], { acceptance: 'trial' }); rejected(m);
    const n = fixture(); Object.assign(n.states[0], { capture: 'display-f32' }); rejected(n);
  });
  it('rejects out-of-order, duplicate and impossible sparse sequences', () => {
    const m = withStep(); m.states.reverse(); rejected(m);
    const n = withStep(); n.states[1].commitIndex = 0; rejected(n);
    const q = withStep(); q.states[1].timeS = real(0); rejected(q);
    const gap = withStep(); gap.states[0].kind = 'step'; gap.states[0].commitIndex = 10;
    gap.states[0].acceptedStepIndex = 1; gap.states[0].timeS = real(1); gap.states[0].stepSizeS = real(1);
    gap.states[1].commitIndex = 12; gap.states[1].acceptedStepIndex = 12; gap.states[1].timeS = real(12); rejected(gap);
  });
  it('rejects time advance without any accepted step, including across gaps', () => {
    const m = withStep(); m.states[1].kind = 'intervention'; m.states[1].commitIndex = 10;
    m.states[1].acceptedStepIndex = 0; m.states[1].stepSizeS = null;
    m.events.push({ id: 'e0', stateId: 's1', order: 0, type: 'fixture.event', payload: null }); rejected(m);
  });
  it('rejects impossible first sparse intervention clocks and commit counts', () => {
    const m = withStep(); m.states.shift(); m.states[0].kind = 'intervention';
    m.states[0].stepSizeS = null; m.states[0].acceptedStepIndex = 0;
    m.events.push({ id: 'e0', stateId: 's1', order: 0, type: 'fixture.event', payload: null });
    rejected(m);
    m.states[0].acceptedStepIndex = 1; rejected(m);
    m.states[0].commitIndex = 2; expect(() => validateManifest(m)).not.toThrow();
  });
  it('rejects blank field bases and omission explanations', () => {
    const m = fixture(); m.fieldDefinitions[0].basis = '  '; rejected(m);
    const n = fixture(); n.states[0].physicsCoverage = 'partial'; n.states[0].missing = ['  ']; rejected(n);
  });
  it('requires a positive finite step size no larger than elapsed physical time', () => {
    for (const dt of [0, -1, 2]) { const m = withStep(); m.states[1].stepSizeS = real(dt); rejected(m); }
  });
  it('rejects invalid initial-state indices/time', () => {
    const m = fixture(); m.states[0].timeS = real(1); rejected(m);
    const n = fixture(); n.states[0].acceptedStepIndex = 1; rejected(n);
  });
  it('requires partial coverage to declare omissions and complete coverage to have none', () => {
    const m = fixture(); m.states[0].physicsCoverage = 'partial'; rejected(m, undefined, 'COVERAGE');
    m.states[0].missing = ['fixture.missing-history']; expect(() => validateManifest(m)).not.toThrow();
    m.states[0].physicsCoverage = 'complete'; rejected(m, undefined, 'COVERAGE');
  });
  it('binds a controller to exactly one accepted state', () => {
    const m = withController(); expect(() => validateManifest(m)).not.toThrow();
    m.controllers[0].stateId = 'other'; rejected(m, undefined, 'REFERENCE');
  });
  it('checks controller field ownership, units and exact global sizes', () => {
    const m = withController();
    m.fieldDefinitions.push({ ...m.fieldDefinitions[0], id: 'controller.history', semanticId: 'fixture.controller-history.v1',
      owner: 'controller', role: 'history', association: 'global', globalEntities: 2, unitId: '1', basis: 'dimensionless error history' });
    m.blocks.push({ ...m.blocks[0], id: 'bc', elementCount: 2, byteLength: 16 });
    m.controllers[0].fields.push({ fieldId: 'controller.history', blockId: 'bc' });
    expect(() => validateManifest(m)).not.toThrow();
    m.fieldDefinitions[1].owner = 'physics'; rejected(m);
  });
  it('accepts only structurally complete, identified restart candidates', () => {
    expect(() => validateManifest(candidate())).not.toThrow();
    const noController = candidate(); noController.states[0].controllerId = null; rejected(noController);
    const partial = candidate(); partial.controllers[0].coverage = 'partial'; partial.controllers[0].missing = ['fixture.queue']; rejected(partial);
    const unbound = candidate(); unbound.states[0].restartContract!.sha256 = null; rejected(unbound);
    const params = candidate(); params.provenance[0].parameters.sha256 = null; rejected(params);
    const controller = candidate(); controller.controllers[0].schema.sha256 = null; rejected(controller);
  });
  it('keeps unresolved evidence hashes explicit for inspection without fetching evidence', () => {
    const m = fixture(); m.provenance[0].evidence.push({ id: 'F.evidence-id', revision: '1', sha256: null });
    m.provenance[0].verificationReports.push({ id: 'C.report-id', revision: '1', sha256: 'e'.repeat(64) });
    expect(validateManifest(m).manifest.provenance[0].evidence[0].sha256).toBe(null);
  });
  it('rejects dirty source without a tree identity and duplicate evidence identities', () => {
    const m = fixture(); m.provenance[0].source.dirty = true; rejected(m, undefined, 'PROVENANCE');
    m.provenance[0].source.workingTreeSha256 = 'f'.repeat(64); expect(() => validateManifest(m)).not.toThrow();
    const ref = { id: 'evidence.item', revision: '1', sha256: null };
    m.provenance[0].evidence.push(ref, { ...ref }); rejected(m, undefined, 'DUPLICATE');
  });
  it('requires block hash syntax for a sealed envelope but does not verify the claimed digest', () => {
    const m = fixture(); m.integrity = { profile: CANONICAL_PROFILE_ID, algorithm: 'sha256', manifestSha256: '0'.repeat(64) };
    rejected(m, undefined, 'INTEGRITY');
    m.blocks[0].sha256 = '0'.repeat(64);
    // This is only syntax acceptance; no payload bytes or SHA-256 implementation were supplied.
    expect(() => validateManifest(m)).not.toThrow();
    m.blocks[0].sha256 = 'A'.repeat(64); rejected(m);
  });
});
