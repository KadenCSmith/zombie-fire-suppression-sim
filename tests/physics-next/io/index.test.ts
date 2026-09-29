import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  createWebCryptoSha256, migratePersistedRuntimeCheckpoint, persistRuntimeCheckpoint,
  restorePersistedRuntimeCheckpoint,
} from '../../../src/physics-next/io';
import type { RuntimeCheckpointIOPolicy } from '../../../src/physics-next/io';
import { createRuntimeCheckpoint, restoreRuntimeCheckpoint } from '../../../src/physics-next/numerics/checkpoint';
import type { CheckpointIdentity, RuntimeState } from '../../../src/physics-next/numerics/checkpoint';
import { AtomicState } from '../../../src/physics-next/numerics/transaction';
import { createTimestepState, planTimestep, settleTimestep } from '../../../src/physics-next/numerics/timestep';
import { BoundedDiagnostics, stepDiagnostic } from '../../../src/physics-next/numerics/diagnostics';
import { createGeometryGrid, assertGeometryGrid } from '../../../src/physics-next/geometry/types';
import type { GridSpec } from '../../../src/physics-next/geometry/types';
import { createGeometryPartition } from '../../../src/physics-next/geometry/interfaces';
import type { GeometryRegionSpec } from '../../../src/physics-next/geometry/interfaces';
import { voxelizeGeometry } from '../../../src/physics-next/geometry/voxelize';
import type { GeometryVoxelization } from '../../../src/physics-next/geometry/voxelize';
import { MaterialRegistry } from '../../../src/physics-next/materials/registry';
import { exportEvidenceBundle } from '../../../src/physics-next/materials/adapters';
import type { EvidenceBundle } from '../../../src/physics-next/materials/adapters';

/** Synthetic closed-transfer software fixture, NOT the active solver or measured material data. */
export interface FixtureOwner {
  backing: ArrayBuffer;
  massKg: Float64Array;
  massAlias: Float64Array;
  massBytes: Uint8Array;
  energyJ: Float64Array;
  initialMassKg: number;
  initialEnergyJ: number;
  removedMassKg: number;
  removedEnergyJ: number;
  eventTimesS: number[];
  eventCursor: number;
  geometry: {
    gridSpec: GridSpec;
    gridMetrics: { dxM: number; dyM: number; dzM: number; cellCount: number; nodeCount: number; cellVolumeM3: number };
    regionSpecs: readonly GeometryRegionSpec[];
    voxelization: Omit<GeometryVoxelization, 'grid'>;
  };
  evidence: EvidenceBundle;
}
const identity: CheckpointIdentity = {
  sourceRevision: 'a'.repeat(40), ownerSchema: 'h-fixture-closed-transfer-v1',
  contextFingerprint: 'synthetic-h-contract-fixture-not-a-measured-model',
};
const adapter = createWebCryptoSha256();
function geometryFixture(): FixtureOwner['geometry'] {
  const gridSpec: GridSpec = { nx: 1, ny: 1, nz: 2, originM: [0, 0, 0], sizeM: [1, 1, 2] };
  const regions: GeometryRegionSpec[] = [{
    id: 'void', role: 'void', priority: 1, minimumFeatureM: 0.4,
    geometry: { kind: 'transform', transform: { translationM: [0.5, 0.5, 0.5], quaternionXYZW: [0, 0, 0, 1] },
      child: { kind: 'sphere', radiusM: 0.2 } },
  }];
  const grid = createGeometryGrid(gridSpec);
  const report = voxelizeGeometry(createGeometryPartition(grid, regions, { id: 'peat', role: 'soil' }), {
    maxDepth: 0, maxBlocks: 2, volumeToleranceM3: 1e-9,
  });
  const { grid: validatedGrid, ...voxelization } = report;
  return {
    gridSpec, gridMetrics: { dxM: validatedGrid.dxM, dyM: validatedGrid.dyM, dzM: validatedGrid.dzM,
      cellCount: validatedGrid.cellCount, nodeCount: validatedGrid.nodeCount, cellVolumeM3: validatedGrid.cellVolumeM3 },
    regionSpecs: regions, voxelization,
  };
}
function evidenceFixture(): EvidenceBundle {
  const registry = new MaterialRegistry({
    format: 'zfs-material-set', version: 1, id: 'synthetic-fixture-set', revision: 1, parent: null,
    records: [{
      format: 'zfs-material-parameter', version: 1, id: 'missing-density-evidence', key: 'bulk-density',
      material: { id: 'peat', label: 'Synthetic fixture peat', class: 'peat',
        specimenId: 'software-only', description: 'No measured specimen or field data.' },
      quantityKind: 'bulkDensity', basis: 'dry mass per bulk volume',
      value: { form: 'unknown', reason: 'No density measurement was supplied.' },
      provenance: { status: 'unknown', claim: 'unknown', rationale: 'Preserve the evidence gap.',
        sourceGap: 'No experimental source.', derivation: null },
      citations: [], applicability: { state: 'unknown', bounds: [], categories: [], note: 'Not established.' },
      notes: ['This is not a material dataset.'],
    }],
    sources: [], overrides: [],
  });
  return exportEvidenceBundle(registry, [{ materialId: 'peat', key: 'bulk-density' }], []);
}
export function createPersistenceFixture(events: number[] = []): AtomicState<RuntimeState<FixtureOwner>> {
  const backing = new ArrayBuffer(24); new Uint8Array(backing).fill(0x5a);
  const mass = new Float64Array(backing, 8, 2); mass.set([4, 8]);
  const owner: FixtureOwner = {
    backing, massKg: mass, massAlias: mass, massBytes: new Uint8Array(backing, 8, 16),
    energyJ: new Float64Array([100, 200]), initialMassKg: 12, initialEnergyJ: 300,
    removedMassKg: 0, removedEnergyJ: 0, eventTimesS: [...events], eventCursor: 0,
    geometry: geometryFixture(), evidence: evidenceFixture(),
  };
  Object.defineProperty(owner, 'hiddenMass', { value: mass, enumerable: false });
  return new AtomicState({
    owner,
    timestep: createTimestepState({
      minimumStep: 0.125, initialStep: 0.5, maximumStep: 1, shrinkFactor: 0.5,
      growthFactor: 2, lowErrorRatio: 0.25, growthAfter: 2, maxRetries: 2,
    }, 0),
    iterations: [],
    diagnostics: new BoundedDiagnostics({ capacity: 8, maximumIds: 8, maximumTextLength: 80 }).snapshot(),
  });
}
export function validatePersistenceFixture(owner: Readonly<FixtureOwner>): boolean {
  try {
    const keys = [
      'backing', 'massKg', 'massAlias', 'massBytes', 'energyJ', 'initialMassKg', 'initialEnergyJ',
      'removedMassKg', 'removedEnergyJ', 'eventTimesS', 'eventCursor', 'geometry', 'evidence', 'hiddenMass',
    ];
    if (Reflect.ownKeys(owner).length !== keys.length || !keys.every(k => Object.hasOwn(owner, k))) return false;
    if (!(owner.massKg instanceof Float64Array) || owner.massKg.length !== 2 ||
        !(owner.energyJ instanceof Float64Array) || owner.energyJ.length !== 2 ||
        owner.massAlias !== owner.massKg || owner.massKg.buffer !== owner.backing ||
        owner.massBytes.buffer !== owner.backing || owner.massKg.byteOffset !== 8 ||
        Object.getOwnPropertyDescriptor(owner, 'hiddenMass')?.value !== owner.massKg ||
        Object.getOwnPropertyDescriptor(owner, 'hiddenMass')?.enumerable !== false) return false;
    if (owner.massKg[0] + owner.massKg[1] + owner.removedMassKg !== owner.initialMassKg ||
        owner.energyJ[0] + owner.energyJ[1] + owner.removedEnergyJ !== owner.initialEnergyJ ||
        [...owner.massKg, ...owner.energyJ].some(x => !Number.isFinite(x) || x < 0)) return false;
    if (!Number.isSafeInteger(owner.eventCursor) || owner.eventCursor < 0 ||
        owner.eventCursor > owner.eventTimesS.length) return false;
    const grid = createGeometryGrid(owner.geometry.gridSpec), metrics = owner.geometry.gridMetrics;
    for (const key of ['dxM', 'dyM', 'dzM', 'cellCount', 'nodeCount', 'cellVolumeM3'] as const)
      if (!Object.is(grid[key], metrics[key])) return false;
    const vox = owner.geometry.voxelization;
    if (vox.cellVolumesM3.length !== grid.cellCount || vox.topologyValidated !== false) return false;
    const registry = new MaterialRegistry(owner.evidence.set);
    const queries = owner.evidence.queryReport.items.map(q => ({ materialId: q.materialId, key: q.key }));
    assert.deepEqual(exportEvidenceBundle(registry, queries, owner.evidence.correlations), owner.evidence);
    return true;
  } catch { return false; }
}
export function fixturePolicy(): RuntimeCheckpointIOPolicy<FixtureOwner> {
  return {
    expectedIdentity: { ...identity },
    context: { sourceCommit: identity.sourceRevision, ownerSchema: identity.ownerSchema,
      contextFingerprint: identity.contextFingerprint, nativeUnits: 'SI', coordinates: 'x-y-horizontal-z-down' },
    validateOwner: validatePersistenceFixture,
  };
}
/** Toy 0.125 kg/s and 2 J/s conservative transfer, not a peat law or calibrated parameter. */
export function advancePersistenceFixture(
  store: AtomicState<RuntimeState<FixtureOwner>>, errorRatio = 0.125,
): 'accepted' | 'retry' | 'stopped' | 'cancelled' {
  const trial = store.begin(), s = trial.state;
  const boundary = s.owner.eventTimesS[s.owner.eventCursor] ?? null;
  const planned = planTimestep(s.timestep, boundary);
  assert.equal(planned.status, 'trial'); assert.ok(planned.pending !== null);
  const transition = settleTimestep(planned, planned.attempts, { kind: 'evaluated', errorRatio, guards: [] });
  const log = BoundedDiagnostics.restore(s.diagnostics!); log.add(stepDiagnostic(transition.record));
  if (transition.record.decision === 'accepted') {
    const dt = transition.record.plan.step;
    s.owner.massKg[0] -= dt / 8; s.owner.massKg[1] += dt / 8;
    s.owner.energyJ[0] -= 2 * dt; s.owner.energyJ[1] += 2 * dt;
    if (boundary !== null && transition.state.time === boundary) s.owner.eventCursor++;
    s.timestep = transition.state; s.diagnostics = log.snapshot(); store.commit(trial);
  } else {
    s.owner.massKg[0] = 999;
    store.rollback(trial);
    const control = store.begin();
    control.state.timestep = transition.state; control.state.diagnostics = log.snapshot();
    store.commit(control);
  }
  return transition.record.decision;
}
describe('documented G/D/F reference-contract persistence fixture', () => {
  it('round-trips complete G envelope and owner graph without mutating the source', async () => {
    const store = createPersistenceFixture(), checkpoint = createRuntimeCheckpoint(store, identity);
    const before = store.snapshot();
    const encoded = await persistRuntimeCheckpoint(checkpoint, fixturePolicy(), adapter);
    const result = await restorePersistedRuntimeCheckpoint(encoded.bytes, fixturePolicy(), adapter);
    assert.deepEqual(result.checkpoint, checkpoint); assert.deepEqual(store.snapshot(), before);
    const owner = result.store.read().owner;
    assert.equal(owner.massAlias, owner.massKg); assert.equal(owner.massKg.buffer, owner.backing);
    assert.equal(owner.massBytes.buffer, owner.backing);
    assert.equal(Object.getOwnPropertyDescriptor(owner, 'hiddenMass')!.value, owner.massKg);
    assert.deepEqual(new Uint8Array(owner.backing), new Uint8Array(before.committed.owner.backing));
  });
  it('preserves extensive mass/energy ledgers and removed inventories exactly', async () => {
    const store = createPersistenceFixture(); advancePersistenceFixture(store); advancePersistenceFixture(store);
    const before = store.read().owner, cp = createRuntimeCheckpoint(store, identity);
    const restored = await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(cp, fixturePolicy(), adapter)).bytes, fixturePolicy(), adapter);
    const after = restored.store.read().owner;
    assert.deepEqual(after.massKg, before.massKg); assert.deepEqual(after.energyJ, before.energyJ);
    assert.equal(after.massKg[0] + after.massKg[1] + after.removedMassKg, 12);
    assert.equal(after.energyJ[0] + after.energyJ[1] + after.removedEnergyJ, 300);
    assert.equal(after.removedMassKg, before.removedMassKg); assert.equal(after.removedEnergyJ, before.removedEnergyJ);
  });
  it('retains control-only rejection state without inventing an accepted step or intervention', async () => {
    const store = createPersistenceFixture(), before = store.read().owner;
    assert.equal(advancePersistenceFixture(store, 2), 'retry');
    const control = store.read(); assert.deepEqual(control.owner, before);
    assert.equal(control.timestep.time, 0); assert.equal(control.timestep.acceptedSteps, 0);
    assert.equal(control.timestep.rejectedAttempts, 1); assert.equal(control.timestep.nextStep, 0.25);
    const checkpoint = createRuntimeCheckpoint(store, identity);
    assert.equal(checkpoint.transaction.version, 1); assert.equal(checkpoint.transaction.trialSerial, 2);
    const encoded=await persistRuntimeCheckpoint(checkpoint,fixturePolicy(),adapter);
    assert.equal(encoded.bytes.length,14868);
    assert.equal(encoded.contentSha256,'82bee428ced1164f17812b2eea560f97897984276c35c621c7111a14bb2f7d6a');
    const restored=await restorePersistedRuntimeCheckpoint(encoded.bytes,fixturePolicy(),adapter);
    assert.deepEqual(restored.checkpoint, checkpoint);
    advancePersistenceFixture(store); advancePersistenceFixture(restored.store);
    assert.deepEqual(createRuntimeCheckpoint(restored.store, identity), createRuntimeCheckpoint(store, identity));
  });
  it('retains rollback and exception bookkeeping without discarded physical data', async () => {
    const store = createPersistenceFixture(), before = store.read();
    const trial = store.begin(); trial.state.owner.massKg[0] = 99; store.rollback(trial);
    assert.deepEqual(store.read(), before);
    assert.throws(() => store.run(draft => { draft.owner.energyJ[0] = 0; throw new Error('discard'); }));
    assert.deepEqual(store.read(), before); assert.equal(store.version, 0);
    const checkpoint = createRuntimeCheckpoint(store, identity); assert.equal(checkpoint.transaction.trialSerial, 2);
    const loaded = await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(checkpoint, fixturePolicy(), adapter)).bytes, fixturePolicy(), adapter);
    assert.deepEqual(loaded.checkpoint, checkpoint);
  });
  it('refuses active transactions and pending timestep snapshots before hashing', async () => {
    const store = createPersistenceFixture(), trial = store.begin();
    assert.throws(() => createRuntimeCheckpoint(store, identity)); store.rollback(trial);
    const checkpoint = structuredClone(createRuntimeCheckpoint(store, identity));
    Object.assign(checkpoint.transaction.committed, { timestep: planTimestep(checkpoint.transaction.committed.timestep, null) });
    let hashes = 0;
    await assert.rejects(() => persistRuntimeCheckpoint(checkpoint, fixturePolicy(), {
      async digest(bytes:Uint8Array) { hashes++; return adapter.digest(bytes); },
    }));
    assert.equal(hashes, 0);
  });
  it('refuses missing/presentation fields and impure or asynchronous owner validators', async () => {
    const cp = createRuntimeCheckpoint(createPersistenceFixture(), identity);
    const presentation = structuredClone(cp);
    Object.assign(presentation.transaction.committed.owner, { camera: { orbit:1 }, presentationTime:3 });
    await assert.rejects(() => persistRuntimeCheckpoint(presentation, fixturePolicy(), adapter));
    const missing = structuredClone(cp);
    delete (missing.transaction.committed.owner as unknown as Record<string,unknown>).energyJ;
    await assert.rejects(() => persistRuntimeCheckpoint(missing, fixturePolicy(), adapter));
    await assert.rejects(() => persistRuntimeCheckpoint(cp, {
      ...fixturePolicy(), validateOwner(owner) { owner.massKg[0] += 1; return true; },
    }, adapter));
    await assert.rejects(() => persistRuntimeCheckpoint(cp, {
      ...fixturePolicy(), validateOwner: (async () => true) as unknown as (o:Readonly<FixtureOwner>)=>boolean,
    }, adapter));
  });
  it('has identical no-intervention continuation after restart without resetting history', async () => {
    const uninterrupted=createPersistenceFixture(), source=createPersistenceFixture();
    advancePersistenceFixture(uninterrupted); advancePersistenceFixture(source);
    const loaded=await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(createRuntimeCheckpoint(source,identity),fixturePolicy(),adapter)).bytes,
      fixturePolicy(),adapter);
    for(let i=0;i<5;i++){advancePersistenceFixture(uninterrupted);advancePersistenceFixture(loaded.store);}
    assert.deepEqual(createRuntimeCheckpoint(loaded.store,identity),createRuntimeCheckpoint(uninterrupted,identity));
    assert.equal(loaded.store.read().owner.eventCursor,0); assert.deepEqual(loaded.store.read().owner.eventTimesS,[]);
  });
  it('preserves event cursor and exactly clipped endpoint over restart',async()=>{
    const source=createPersistenceFixture([0.75]);advancePersistenceFixture(source);
    const loaded=await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(createRuntimeCheckpoint(source,identity),fixturePolicy(),adapter)).bytes,
      fixturePolicy(),adapter);
    advancePersistenceFixture(source);advancePersistenceFixture(loaded.store);
    assert.equal(loaded.store.read().timestep.time,0.75);assert.equal(loaded.store.read().owner.eventCursor,1);
    assert.deepEqual(createRuntimeCheckpoint(source,identity),createRuntimeCheckpoint(loaded.store,identity));
  });
  it('retains D fractions/bounds/flags and requires GridSpec reconstruction',async()=>{
    const source=createPersistenceFixture(),before=source.read().owner.geometry;
    const loaded=await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(createRuntimeCheckpoint(source,identity),fixturePolicy(),adapter)).bytes,
      fixturePolicy(),adapter);
    const geometry=loaded.store.read().owner.geometry;assert.deepEqual(geometry,before);
    const grid=createGeometryGrid(geometry.gridSpec);assertGeometryGrid(grid);
    assert.equal(grid.cellCount,geometry.gridMetrics.cellCount);assert.throws(()=>assertGeometryGrid({...grid}));
    assert.equal(geometry.voxelization.topologyValidated,false);
    assert.equal(geometry.voxelization.accepted,before.voxelization.accepted);
    assert.deepEqual(geometry.voxelization.unresolvedFraction,before.voxelization.unresolvedFraction);
  });
  it('retains F unknown evidence, source gaps and not-evaluated decisions without defaults',async()=>{
    const source=createPersistenceFixture(),before=source.read().owner.evidence;
    assert.equal(before.validation,'not-evaluated');assert.equal(before.queryReport.unknown,1);
    const loaded=await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(createRuntimeCheckpoint(source,identity),fixturePolicy(),adapter)).bytes,
      fixturePolicy(),adapter);
    const evidence=loaded.store.read().owner.evidence;assert.deepEqual(evidence,before);
    assert.equal(evidence.set.records[0].value.form,'unknown');
    assert.equal(evidence.set.records[0].provenance.sourceGap,'No experimental source.');
    assert.equal(new MaterialRegistry(evidence.set).select({materialId:'peat',key:'bulk-density'}).state,'unknown');
  });
  it('rejects independently mismatched context and unknown G algorithms or schemas',async()=>{
    const cp=createRuntimeCheckpoint(createPersistenceFixture(),identity);
    const bytes=(await persistRuntimeCheckpoint(cp,fixturePolicy(),adapter)).bytes, p=fixturePolicy();
    await assert.rejects(()=>restorePersistedRuntimeCheckpoint(bytes,{
      ...p,context:{...p.context,contextFingerprint:'different'},
      expectedIdentity:{...p.expectedIdentity,contextFingerprint:'different'},
    },adapter));
    const bad=structuredClone(cp);Object.assign(bad.algorithms,{timestep:'unknown'});
    await assert.rejects(()=>persistRuntimeCheckpoint(bad,fixturePolicy(),adapter));
    await assert.rejects(()=>persistRuntimeCheckpoint({...cp,schemaVersion:9} as unknown as typeof cp,fixturePolicy(),adapter));
  });
  it('allows only identity-preserving current-version migration with pre/post hashes',async()=>{
    const cp=createRuntimeCheckpoint(createPersistenceFixture(),identity);
    const encoded=await persistRuntimeCheckpoint(cp,fixturePolicy(),adapter);
    const once=await migratePersistedRuntimeCheckpoint(encoded.bytes,fixturePolicy(),adapter);
    const twice=await migratePersistedRuntimeCheckpoint(once.bytes,fixturePolicy(),adapter);
    assert.deepEqual(once.bytes,encoded.bytes);assert.deepEqual(twice.bytes,encoded.bytes);
    assert.equal(once.beforeSha256,encoded.contentSha256);assert.equal(once.afterSha256,encoded.contentSha256);
    assert.deepEqual(once.transitions,[]);assert.deepEqual(twice.transitions,[]);
  });
  it('does not replace an active store and isolates returned snapshots',async()=>{
    const source=createPersistenceFixture(),before=source.snapshot(),cp=createRuntimeCheckpoint(source,identity);
    const loaded=await restorePersistedRuntimeCheckpoint(
      (await persistRuntimeCheckpoint(cp,fixturePolicy(),adapter)).bytes,fixturePolicy(),adapter);
    loaded.store.read().owner.massKg[0]=999;loaded.checkpoint.transaction.committed.owner.massKg[0]=888;
    assert.deepEqual(source.snapshot(),before);assert.deepEqual(loaded.store.read().owner.massKg,before.committed.owner.massKg);
    assert.notEqual(loaded.store,source);
    assert.deepEqual(restoreRuntimeCheckpoint(cp,identity,validatePersistenceFixture).snapshot(),before);
  });
});
