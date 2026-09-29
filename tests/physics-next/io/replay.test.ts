import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { BASE_UNITS, FORMAT_ID, SCHEMA_ID, SCHEMA_VERSION, SCALAR_ENCODING, SchemaError } from '../../../src/physics-next/io/schema';
import type { PhysicalStateManifest } from '../../../src/physics-next/io/schema';
import {encodeFloat64,encodeTypedArray} from '../../../src/physics-next/io/canonical';
import {createWebCryptoSha256,sealBundle} from '../../../src/physics-next/io/hash';
import {createReplayInspector} from '../../../src/physics-next/io/replay';

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
async function inspector(data=recordingFixture()){
  const sealed=await sealBundle(data.m,data.p,adapter);
  return createReplayInspector(sealed.manifest,sealed.payloads,adapter);
}
describe('exact passive physical replay',()=>{
  it('selects exact records without interpolation or clock advance',async()=>{
    const r=await inspector(),before=r.manifest();
    assert.equal(r.selectCommit(1)!.state.id,'s1');assert.equal(r.selectCommit(5),null);
    assert.deepEqual(r.atTime(0.125),[]);assert.equal(r.positionAtTime(0.125).kind,'between');
    assert.deepEqual(r.atTime(0.25+Number.EPSILON),[]);assert.deepEqual(r.manifest(),before);
    assert.throws(()=>r.atTime(NaN),SchemaError);
  });
  it('retains distinct same-time interventions and deterministic event order',async()=>{
    const d=recordingFixture();
    d.m.states.splice(1,0,{...structuredClone(d.m.states[0]),id:'event',kind:'intervention',commitIndex:1});
    d.m.states[2].commitIndex=2;
    d.m.events.push({id:'e2',stateId:'event',order:2,type:'synthetic.marker',payload:null},
      {id:'e1',stateId:'event',order:1,type:'synthetic.marker',payload:null});
    const r=await inspector(d);
    assert.deepEqual(r.atTime(0).map(s=>s.state.id),['s0','event']);
    assert.deepEqual(r.selectState('event')!.events.map(e=>e.id),['e1','e2']);
  });
  it('reports sparse prefixes/internal gaps and an unknown suffix',async()=>{
    const d=recordingFixture();
    d.m.states[1].commitIndex=10;d.m.states[1].acceptedStepIndex=8;d.m.states[1].timeS=encodeFloat64(2);
    let r=await inspector(d);
    assert.equal(r.coverage().gaps[0].missingCommits,9);assert.equal(r.coverage().gaps[0].missingAcceptedSteps,7);
    assert.equal(r.coverage().suffixExtent,'unknown');
    d.m.states.shift();r=await inspector(d);
    assert.equal(r.coverage().gaps[0].kind,'prefix');assert.equal(r.coverage().gaps[0].previousTimeS,null);
    assert.equal(r.positionAtTime(1).kind,'before-recording');
  });
  it('returns isolated metadata/field copies and refuses unverified data',async()=>{
    const {m,p}=recordingFixture();
    await assert.rejects(()=>createReplayInspector(m,p,adapter),SchemaError);
    const r=await inspector(),before=r.manifest();
    r.readField('s0','history')!.bytes.fill(0);Object.assign(r.selectState('s0')!.state,{id:'altered'});
    assert.deepEqual(r.manifest(),before);assert.deepEqual(r.readField('s0','history')!.bytes,p.get('block'));
  });
});
