import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { BASE_UNITS, FORMAT_ID, SCHEMA_ID, SCHEMA_VERSION, SCALAR_ENCODING, SchemaError } from '../../../src/physics-next/io/schema';
import type { PhysicalStateManifest } from '../../../src/physics-next/io/schema';
import {
  canonicalScientificText,canonicalManifestText,decodeFloat64,encodeFloat64,encodeTypedArray,validateBlockBytes,
} from '../../../src/physics-next/io/canonical';

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

describe('physical-recording canonical contract',()=>{
  it('retains finite binary64 values and signed zero without decimal rounding',()=>{
    for(const n of [0,-0,0.1,1/3,Number.MIN_VALUE,Number.MAX_VALUE,-12])
      assert.ok(Object.is(decodeFloat64(encodeFloat64(n)),n));
    assert.equal(encodeFloat64(-0).$f64,'8000000000000000');
    assert.notEqual(canonicalScientificText(1),canonicalScientificText(encodeFloat64(1)));
    for(const bad of [NaN,Infinity,-Infinity])assert.throws(()=>encodeFloat64(bad),SchemaError);
  });
  it('orders metadata keys by UTF-16 without normalizing Unicode or array order',()=>{
    assert.equal(canonicalScientificText({'2':2,'10':1,'\ue000':4,'\u{10000}':3}),'{"10":1,"2":2,"𐀀":3,"":4}');
    assert.notEqual(canonicalScientificText('é'),canonicalScientificText('e\u0301'));
    assert.notEqual(canonicalScientificText([1,2]),canonicalScientificText([2,1]));
    assert.throws(()=>canonicalScientificText('\ud800'),SchemaError);
  });
  it('ignores catalog/binding order but not accepted-state order',()=>{
    const {m}=recordingFixture();
    m.fieldDefinitions.push({...m.fieldDefinitions[0],id:'history2'});m.blocks.push({...m.blocks[0],id:'block2'});
    m.states.forEach(s=>s.fields.push({fieldId:'history2',blockId:'block2'}));
    const before=canonicalManifestText(m);
    m.fieldDefinitions.reverse();m.blocks.reverse();m.units.definitions.reverse();m.states.forEach(s=>s.fields.reverse());
    assert.equal(canonicalManifestText(m),before);
    m.states.reverse();assert.throws(()=>canonicalManifestText(m),SchemaError);
  });
  it('uses exact little-endian bytes and rejects nonfinite floats or wrong dtype',()=>{
    assert.deepEqual([...encodeTypedArray('f64',new Float64Array([1,-0]))],
      [0,0,0,0,0,0,240,63,0,0,0,0,0,0,0,128]);
    assert.throws(()=>encodeTypedArray('f32',new Float64Array([1])),SchemaError);
    assert.throws(()=>encodeTypedArray('f64',new Float64Array([NaN])),SchemaError);
    const bad=new Uint8Array(8);new DataView(bad.buffer).setFloat64(0,Infinity,true);
    assert.throws(()=>validateBlockBytes('f64',1,bad),SchemaError);
  });
  it('rejects accessor metadata and lowered-budget overflow',()=>{
    let ran=false;const data={get x(){ran=true;return 1;}};
    assert.throws(()=>canonicalScientificText(data),SchemaError);assert.equal(ran,false);
    assert.throws(()=>canonicalScientificText([1,2,3],{maxJsonNodes:2}),SchemaError);
  });
});
