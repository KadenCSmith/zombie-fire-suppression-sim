import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { BASE_UNITS, FORMAT_ID, SCHEMA_ID, SCHEMA_VERSION, SCALAR_ENCODING, SchemaError } from '../../../src/physics-next/io/schema';
import type { PhysicalStateManifest } from '../../../src/physics-next/io/schema';
import {encodeFloat64,encodeTypedArray} from '../../../src/physics-next/io/canonical';
import {createWebCryptoSha256,sealBundle,verifyBundle} from '../../../src/physics-next/io/hash';
import {migrateToCurrent,hashMigrationEnvelopeClaims,runEnvelopeMigrations} from '../../../src/physics-next/io/migration';
import type {EnvelopeMigrationStep,MigrationEnvelope} from '../../../src/physics-next/io/migration';

type Mutable<T> = T extends readonly (infer V)[] ? Mutable<V>[] :
  T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
/** Synthetic inspection recording, not a real source revision or physics-validation claim. */
function recordingFixture(): {m:Mutable<PhysicalStateManifest>;p:Map<string,Uint8Array>} {
  const m:Mutable<PhysicalStateManifest>={
    format:FORMAT_ID,schemaId:SCHEMA_ID,schemaVersion:SCHEMA_VERSION,scalarEncoding:SCALAR_ENCODING,
    runId:'synthetic.recording',
    units:{system:'SI',temperature:'absolute-kelvin',coordinates:'x-y-horizontal-depth-positive-down',
      dimensionOrder:['kg','m','s','A','K','mol','cd'],
      definitions:BASE_UNITS.map(u=>({id:u.id,dimensions:[...u.dimensions]}))},
    grids:[{id:'grid',kind:'uniform-cartesian-3d',axisOrder:['x','y','depth'],indexOrder:'x-fastest',cells:[1,1,1],
      originM:[encodeFloat64(0),encodeFloat64(0),encodeFloat64(0)],
      extentM:[encodeFloat64(1),encodeFloat64(1),encodeFloat64(1)]}],
    fieldDefinitions:[{id:'history',semanticId:'synthetic.history.v1',owner:'physics',role:'history',required:true,
      unitId:'1',basis:'synthetic dimensionless state, not a measured quantity',dtype:'f64',association:'cell',
      globalEntities:null,components:['value'],layout:'entity-major'}],
    blocks:[{id:'block',dtype:'f64',byteOrder:'little-endian',elementCount:1,byteLength:8,sha256:null}],
    provenance:[{id:'source',source:{baselineCommit:'a'.repeat(40),snapshotSha256:'b'.repeat(64),
      implementationCommit:'a'.repeat(40),dirty:false,workingTreeSha256:null},
      model:{id:'synthetic.model',revision:'1',sha256:null},
      parameters:{id:'synthetic.parameters',revision:'1',sha256:null},evidence:[],verificationReports:[]}],
    states:[0,1].map(i=>({id:`s${i}`,gridId:'grid',provenanceId:'source',acceptance:'accepted',capture:'native-committed',
      commitIndex:i,acceptedStepIndex:i,kind:i===0?'initial':'step',
      timeS:encodeFloat64(i/4),stepSizeS:i===0?null:encodeFloat64(0.25),
      physicsCoverage:'complete',missing:[],restart:'inspection-only',restartContract:null,
      fields:[{fieldId:'history',blockId:'block'}],controllerId:null,extensions:[]})),
    controllers:[],events:[],
    extensions:[{namespace:'synthetic.unknown',version:1,critical:false,
      data:{note:'Unknown metadata remains data.',values:[encodeFloat64(-0),2,1]}}],
    integrity:null,
  };
  return {m,p:new Map([['block',encodeTypedArray('f64',new Float64Array([-0]))]])};
}

const adapter=createWebCryptoSha256();
async function oldFixture(){
  const {m,p}=recordingFixture(),sealed=await sealBundle(m,p,adapter);
  const draft:MigrationEnvelope={...sealed.manifest,schemaVersion:0,schemaId:'zf-physical-states/v0',integrity:null};
  const sha=await hashMigrationEnvelopeClaims(draft,adapter);
  return {m:{...draft,integrity:{profile:'zf-physical-canonical/v1' as const,algorithm:'sha256' as const,
    manifestSha256:sha}},p:sealed.payloads};
}
const step:EnvelopeMigrationStep={fromVersion:0,toVersion:1,
  transform:m=>({...m,schemaId:SCHEMA_ID,schemaVersion:SCHEMA_VERSION,integrity:null})};
describe('physical-envelope migration, separate from G runtime',()=>{
  it('verifies current-version idempotence without inventing transformations',async()=>{
    const {m,p}=recordingFixture(),sealed=await sealBundle(m,p,adapter);
    const a=await migrateToCurrent(sealed.manifest,sealed.payloads,adapter);
    const b=await migrateToCurrent(a.bundle.manifest,a.bundle.payloads,adapter);
    assert.deepEqual(a.bundle.manifest,b.bundle.manifest);assert.deepEqual(a.receipts,[]);
  });
  it('refuses unregistered historical versions and unrelated formats',async()=>{
    const {m,p}=await oldFixture();
    await assert.rejects(()=>migrateToCurrent(m,p,adapter),SchemaError);
    await assert.rejects(()=>migrateToCurrent({formatVersion:1},new Map(),adapter),SchemaError);
  });
  it('records pre/post hashes for an explicitly registered fixture-only envelope step',async()=>{
    const {m,p}=await oldFixture(),out=await migrateToCurrent(m,p,adapter,[step]);
    assert.equal(out.receipts[0].beforeSha256,m.integrity.manifestSha256);
    assert.equal(out.receipts[0].afterSha256,out.bundle.manifest.integrity!.manifestSha256);
    assert.notEqual(out.receipts[0].beforeSha256,out.receipts[0].afterSha256);
    assert.deepEqual(out.bundle.manifest.extensions,m.extensions);assert.deepEqual(out.bundle.payloads,p);
    await verifyBundle(out.bundle.manifest,out.bundle.payloads,adapter);
  });
  it('rejects semantic changes, dropped metadata, skipped versions and mutating callbacks',async()=>{
    const {m,p}=await oldFixture();
    for(const edit of [
      (n:MigrationEnvelope)=>({...n,extensions:[]}),
      (n:MigrationEnvelope)=>({...n,fieldDefinitions:n.fieldDefinitions.map(f=>({...f,basis:'changed'}))}),
    ])await assert.rejects(()=>migrateToCurrent(m,p,adapter,[{...step,
      transform:n=>edit(step.transform(n) as MigrationEnvelope)}]),SchemaError);
    await assert.rejects(()=>runEnvelopeMigrations(m,p,adapter,2,[{...step,toVersion:2}]),SchemaError);
    await assert.rejects(()=>migrateToCurrent(m,p,adapter,[{...step,transform:n=>{
      Object.assign(n,{runId:'changed'});return n;
    }}]),SchemaError);
  });
});
