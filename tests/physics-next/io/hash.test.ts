import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { BASE_UNITS, FORMAT_ID, SCHEMA_ID, SCHEMA_VERSION, SCALAR_ENCODING, SchemaError } from '../../../src/physics-next/io/schema';
import type { PhysicalStateManifest } from '../../../src/physics-next/io/schema';
import {encodeFloat64,encodeTypedArray} from '../../../src/physics-next/io/canonical';
import {checkSha256Adapter,createWebCryptoSha256,sealBundle,verifyBundle,sha256Hex} from '../../../src/physics-next/io/hash';
import {serializeBundle,deserializeBundle,decodeTypedArray} from '../../../src/physics-next/io/serialize';

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
describe('physical-recording byte integrity',()=>{
  it('passes SHA-256 known answers and takes local ownership of backend buffers',async()=>{
    await checkSha256Adapter(adapter);
    assert.equal(await sha256Hex(new TextEncoder().encode('abc'),adapter),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const raw=new ArrayBuffer(32);Object.setPrototypeOf(raw,Object.create(null));
    const local=await createWebCryptoSha256({digest:async()=>raw}).digest(new Uint8Array());
    assert.equal(Object.getPrototypeOf(local.buffer),ArrayBuffer.prototype);assert.notEqual(local.buffer,raw);
  });
  it('verifies actual bytes and rejects changed claims instead of repairing them',async()=>{
    const {m,p}=recordingFixture(),sealed=await sealBundle(m,p,adapter);assert.equal(m.integrity,null);
    await verifyBundle(sealed.manifest,sealed.payloads,adapter);
    const bad=new Map(sealed.payloads),corrupt=new Uint8Array(bad.get('block')!);corrupt[0]^=1;bad.set('block',corrupt);
    await assert.rejects(()=>verifyBundle(sealed.manifest,bad,adapter),SchemaError);
    await assert.rejects(()=>sealBundle(sealed.manifest,bad,adapter),SchemaError);
    await assert.rejects(()=>verifyBundle({...sealed.manifest,runId:'changed'},sealed.payloads,adapter),SchemaError);
  });
  it('round-trips physical recordings independently of the runtime format',async()=>{
    const {m,p}=recordingFixture(),wire=await serializeBundle(m,p,adapter),decoded=await deserializeBundle(wire,adapter);
    assert.deepEqual(decoded.manifest.states,m.states);assert.deepEqual(decoded.manifest.extensions,m.extensions);
    assert.deepEqual(decoded.payloads.get('block'),p.get('block'));
    assert.ok(Object.is(decodeTypedArray('f64',1,decoded.payloads.get('block')!)[0],-0));
    assert.deepEqual(await serializeBundle(decoded.manifest,decoded.payloads,adapter),wire);
    const extra=new Uint8Array(wire.length+1);extra.set(wire);
    await assert.rejects(()=>deserializeBundle(extra,adapter),SchemaError);
  });
  it('snapshots all fields before the first digest callback',async()=>{
    const {m,p}=recordingFixture(),expected=await sealBundle(m,p,adapter);let first=true;
    const actual=await sealBundle(m,p,{async digest(bytes:Uint8Array){
      if(first){first=false;m.runId='mutated';p.get('block')!.fill(0);}return adapter.digest(bytes);
    }});
    assert.deepEqual(actual.manifest,expected.manifest);assert.deepEqual(actual.payloads,expected.payloads);
  });
  it('refuses unsealed imports, extra payloads and unknown critical extensions',async()=>{
    const {m,p}=recordingFixture();await assert.rejects(()=>verifyBundle(m,p,adapter),SchemaError);
    const extra=new Map(p);extra.set('extra',new Uint8Array());
    await assert.rejects(()=>sealBundle(m,extra,adapter),SchemaError);
    m.extensions[0].critical=true;await assert.rejects(()=>sealBundle(m,p,adapter),SchemaError);
  });
});
