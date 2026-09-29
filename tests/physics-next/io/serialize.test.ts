import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  CheckpointIOError, OWNED_GRAPH_DOMAIN, OWNED_GRAPH_MAGIC, canonicalScientificText,
  createWebCryptoSha256, deserializeOwnedGraph, nativeByteOrder, parseScientificJson,
  serializeOwnedGraph, sha256Hex,
} from '../../../src/physics-next/io';
import type { OwnedGraphContext } from '../../../src/physics-next/io';
const context: OwnedGraphContext = {
  sourceCommit: 'a'.repeat(40), ownerSchema: 'h-fixture-owned-graph-v1',
  contextFingerprint: 'h-fixture-context-v1', nativeUnits: 'SI', coordinates: 'x-y-horizontal-z-down',
};
const adapter = createWebCryptoSha256();
function sample() {
  const buffer = new ArrayBuffer(48); new Uint8Array(buffer).fill(0xa5);
  const floats = new Float64Array(buffer, 8, 2); floats.set([273.15, -0]);
  const shared = { smallest: Number.MIN_VALUE, greatest: Number.MAX_VALUE, third: 1 / 3 };
  const graph = Object.assign(Object.create(null) as Record<string, unknown>, {
    buffer, floats, sameView: floats, bytes: new Uint8Array(buffer, 8, 16),
    view: new DataView(buffer, 4, 24), left: shared, right: shared,
  });
  Object.defineProperty(graph, 'hidden', { value: floats, enumerable: false, configurable: true, writable: true });
  Object.defineProperty(graph, '__proto__', { value: { onlyData: true }, enumerable: true });
  return graph;
}
function split(bytes: Uint8Array) {
  const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
  return { manifest: JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+n))) as Record<string,unknown>,
    payload: bytes.slice(16+n) };
}
async function wire(manifest:Record<string,unknown>,payload:Uint8Array,recompute=false):Promise<Uint8Array>{
  if(recompute){
    const body={...manifest};delete body.sha256;
    manifest.sha256=await sha256Hex(new TextEncoder().encode(OWNED_GRAPH_DOMAIN+canonicalScientificText(body)),adapter);
  }
  const json=new TextEncoder().encode(canonicalScientificText(manifest));
  const bytes=new Uint8Array(16+json.length+payload.length),header=new DataView(bytes.buffer);
  for(let i=0;i<8;i++)bytes[i]=OWNED_GRAPH_MAGIC.charCodeAt(i);
  header.setUint32(8,json.length,true);header.setUint32(12,payload.length,true);
  bytes.set(json,16);bytes.set(payload,16+json.length);return bytes;
}
describe('runtime owned-graph byte contract',()=>{
  it('preserves buffers, offsets, alias topology and hidden/null-prototype properties',async()=>{
    const input=sample(),encoded=await serializeOwnedGraph(input,context,adapter);
    const decoded=await deserializeOwnedGraph(encoded.bytes,context,adapter);
    const value=decoded.value as Record<string,unknown>;
    assert.equal(Object.getPrototypeOf(value),null);
    assert.equal(value.floats,value.sameView);assert.equal(value.hidden,value.floats);assert.equal(value.left,value.right);
    assert.equal((value.floats as Float64Array).buffer,value.buffer);
    assert.equal((value.bytes as Uint8Array).buffer,value.buffer);assert.equal((value.view as DataView).buffer,value.buffer);
    assert.equal((value.floats as Float64Array).byteOffset,8);assert.equal((value.view as DataView).byteOffset,4);
    assert.equal((value.view as DataView).byteLength,24);
    assert.equal(Object.getOwnPropertyDescriptor(value,'hidden')!.enumerable,false);
    assert.ok(Object.is((value.floats as Float64Array)[1],-0));
    assert.deepEqual(new Uint8Array(value.buffer as ArrayBuffer),new Uint8Array(input.buffer as ArrayBuffer));
    assert.equal(Object.getOwnPropertyDescriptor(value,'__proto__')!.value.onlyData,true);
    assert.equal(Object.hasOwn(Object.prototype,'onlyData'),false);
    assert.notEqual(value.buffer,input.buffer);assert.notEqual(value.left,input.left);
    const again=await serializeOwnedGraph(value,context,adapter);
    assert.deepEqual(again.bytes,encoded.bytes);assert.equal(again.contentSha256,encoded.contentSha256);
  });
  it('preserves all nine G numeric view types without changing width',async()=>{
    const views=[
      new Int8Array([-128,127]),new Uint8Array([0,255]),new Uint8ClampedArray([0,255]),
      new Int16Array([-32768,32767]),new Uint16Array([0,65535]),
      new Int32Array([-2147483648,2147483647]),new Uint32Array([0,4294967295]),
      new Float32Array([-0,2**-149]),new Float64Array([-0,Number.MIN_VALUE]),
    ];
    const result=await deserializeOwnedGraph((await serializeOwnedGraph(views,context,adapter)).bytes,context,adapter);
    const restored=result.value as typeof views;
    for(let i=0;i<views.length;i++){
      assert.equal(Object.getPrototypeOf(restored[i]),Object.getPrototypeOf(views[i]));
      assert.deepEqual(new Uint8Array(restored[i].buffer),new Uint8Array(views[i].buffer));
    }
  });
  for(const primitive of [null,false,'',0,-0,1/3,Number.MIN_VALUE,Number.MAX_VALUE]){
    it(`supports a buffer-free primitive ${String(primitive)}`,async()=>{
      const encoded=await serializeOwnedGraph(primitive,context,adapter);
      assert.ok(Object.is((await deserializeOwnedGraph(encoded.bytes,context,adapter)).value,primitive));
    });
  }
  it('retains opaque raw/DataView bits without interpreting them as floating-point values',async()=>{
    const buffer=new ArrayBuffer(8);new DataView(buffer).setFloat64(0,NaN,true);
    const data={buffer,opaque:new DataView(buffer)};
    const result=await deserializeOwnedGraph((await serializeOwnedGraph(data,context,adapter)).bytes,context,adapter);
    assert.deepEqual(new Uint8Array((result.value as typeof data).buffer),new Uint8Array(buffer));
  });
  it('distinguishes shared buffers from equal but separate buffers',async()=>{
    const a=new ArrayBuffer(8),b=new ArrayBuffer(8);
    assert.notEqual((await serializeOwnedGraph({a,b:a},context,adapter)).contentSha256,
      (await serializeOwnedGraph({a,b},context,adapter)).contentSha256);
  });
  it('preserves runtime record/array order and signed zero',async()=>{
    const a=await serializeOwnedGraph({b:[2,1],a:-0},context,adapter);
    const b=await serializeOwnedGraph({a:-0,b:[2,1]},context,adapter);
    assert.notEqual(a.contentSha256,b.contentSha256);
    assert.notEqual(b.contentSha256,(await serializeOwnedGraph({a:0,b:[2,1]},context,adapter)).contentSha256);
    assert.notEqual(b.contentSha256,(await serializeOwnedGraph({a:-0,b:[1,2]},context,adapter)).contentSha256);
  });
  it('copies inputs and expected context before asynchronous hashing',async()=>{
    const value=sample(),expected=await serializeOwnedGraph(value,context,adapter),mutable={...context};
    const pending=serializeOwnedGraph(value,mutable,adapter);
    new Uint8Array(value.buffer as ArrayBuffer).fill(0);mutable.contextFingerprint='mutated';
    const result=await pending;assert.deepEqual(result.bytes,expected.bytes);
    const before=result.bytes.slice(),restoring=deserializeOwnedGraph(result.bytes,context,adapter);result.bytes.fill(0);
    const restored=await restoring;assert.equal(restored.contentSha256,expected.contentSha256);
    assert.deepEqual((await serializeOwnedGraph(restored.value,context,adapter)).bytes,before);
  });
  it('runs synchronous gates before hashing and isolates the gate copy',async()=>{
    let calls=0;const hasher={async digest(bytes:Uint8Array){calls++;return adapter.digest(bytes);}};
    await assert.rejects(()=>serializeOwnedGraph({a:1},context,hasher,{validateSnapshot:()=>false}));
    assert.equal(calls,0);
    await assert.rejects(()=>serializeOwnedGraph({},context,hasher,{
      validateSnapshot:(async()=>true) as unknown as (v:unknown)=>boolean,
    }));
    assert.equal(calls,0);
    const written=await serializeOwnedGraph({a:1},context,adapter,{
      validateSnapshot(v){(v as {a:number}).a=2;return true;},
    });
    assert.deepEqual((await deserializeOwnedGraph(written.bytes,context,adapter)).value,{a:1});
  });
});
describe('runtime malformed-input and capacity gates',()=>{
  for(const value of [NaN,Infinity,-Infinity,undefined,1n,()=>1,new Date(),new Map()]){
    it(`rejects unsupported ${typeof value}`,async()=>{
      await assert.rejects(()=>serializeOwnedGraph(value,context,adapter));
    });
  }
  it('rejects sparse arrays, symbols, accessors, cycles and custom views without executing getters',async()=>{
    let calls=0;
    const accessor=Object.defineProperty({},'x',{get(){calls++;return 1;}});
    const cycle:{self?:unknown}={};cycle.self=cycle;
    const view=new Float64Array([1]);Object.defineProperty(view,'length',{get(){calls++;return 1;}});
    for(const value of [accessor,cycle,view,new Array(2),{[Symbol('x')]:1}])
      await assert.rejects(()=>serializeOwnedGraph(value,context,adapter));
    assert.equal(calls,0);
  });
  it('rejects shared, resizable and detached buffers',async()=>{
    const resize=Reflect.construct(ArrayBuffer,[8,{maxByteLength:16}]) as ArrayBuffer;
    const detached=new ArrayBuffer(8);structuredClone(detached,{transfer:[detached]});
    for(const v of [resize,detached,new SharedArrayBuffer(8)])
      await assert.rejects(()=>serializeOwnedGraph(v,context,adapter));
  });
  it('bounds unique buffers, views, arrays, objects, depth and metadata without truncation',async()=>{
    await assert.rejects(()=>serializeOwnedGraph(new ArrayBuffer(9),context,adapter,{limits:{maxBufferBytes:8}}));
    await assert.rejects(()=>serializeOwnedGraph([new ArrayBuffer(8),new ArrayBuffer(8)],context,adapter,
      {limits:{maxTotalBufferBytes:15}}));
    await assert.rejects(()=>serializeOwnedGraph([1,2],context,adapter,{limits:{maxArrayLength:1}}));
    await assert.rejects(()=>serializeOwnedGraph({a:{}},context,adapter,{limits:{maxGraphNodes:1}}));
    await assert.rejects(()=>serializeOwnedGraph({a:{b:{}}},context,adapter,{limits:{maxGraphDepth:1}}));
    await assert.rejects(()=>serializeOwnedGraph('abc',context,adapter,{limits:{maxMetadataBytes:10}}));
    await assert.rejects(()=>serializeOwnedGraph(new Float64Array(2),context,adapter,{limits:{maxViewElements:1}}));
    await assert.rejects(()=>serializeOwnedGraph({},context,adapter,{limits:{maxGraphNodes:1000000}}));
  });
  it('checks the longest path through already-shared subtrees',async()=>{
    const tail={leaf:{}},value={a:tail,z:{next:{shared:tail}}};
    await assert.rejects(()=>serializeOwnedGraph(value,context,adapter,{limits:{maxGraphDepth:3}}));
  });
  it('rejects identity/version/endianness mismatches and corrupted bytes',async()=>{
    const written=await serializeOwnedGraph(sample(),context,adapter);
    await assert.rejects(()=>deserializeOwnedGraph(written.bytes,{...context,ownerSchema:'different'},adapter));
    const broken=written.bytes.slice();broken[broken.length-1]^=1;
    await assert.rejects(()=>deserializeOwnedGraph(broken,context,adapter));
    const magic=written.bytes.slice();magic[0]^=1;
    await assert.rejects(()=>deserializeOwnedGraph(magic,context,adapter));
    const {manifest,payload}=split(written.bytes);
    manifest.byteOrder=nativeByteOrder()==='little-endian'?'big-endian':'little-endian';
    const swapped=await wire(manifest,payload,true);
    await assert.rejects(()=>deserializeOwnedGraph(swapped,context,adapter),CheckpointIOError);
    manifest.byteOrder=nativeByteOrder();manifest.version=2;
    const newer=await wire(manifest,payload,true);
    await assert.rejects(()=>deserializeOwnedGraph(newer,context,adapter));
  });
  it('rejects validly rehashed nonfinite floating-point payloads',async()=>{
    const encoded=await serializeOwnedGraph(new Float64Array([1]),context,adapter);
    const {manifest,payload}=split(encoded.bytes);
    new DataView(payload.buffer).setFloat64(0,NaN,nativeByteOrder()==='little-endian');
    const buffer=(manifest.nodes as Array<Record<string,unknown>>).find(n=>n.kind==='buffer')!;
    buffer.sha256=await sha256Hex(payload,adapter);
    const invalid=await wire(manifest,payload,true);
    await assert.rejects(()=>deserializeOwnedGraph(invalid,context,adapter));
  });
  it('rejects bad offsets, cycles, dangling references and trailing bytes',async()=>{
    const encoded=await serializeOwnedGraph(sample(),context,adapter);
    const first=split(encoded.bytes),nodes=first.manifest.nodes as Array<Record<string,unknown>>;
    nodes.find(n=>n.kind==='view')!.byteOffset=Number.MAX_SAFE_INTEGER;
    const offset=await wire(first.manifest,first.payload);
    await assert.rejects(()=>deserializeOwnedGraph(offset,context,adapter));
    const other=split(encoded.bytes),root=other.manifest.root as {$ref:number};
    (other.manifest.nodes as Array<Record<string,unknown>>)[root.$ref].entries=[['self',true,{$ref:root.$ref}]];
    const cyclic=await wire(other.manifest,other.payload);
    await assert.rejects(()=>deserializeOwnedGraph(cyclic,context,adapter));
    const dangling=split(encoded.bytes);dangling.manifest.root={$ref:999999};
    const reference=await wire(dangling.manifest,dangling.payload);
    await assert.rejects(()=>deserializeOwnedGraph(reference,context,adapter));
    const extra=new Uint8Array(encoded.bytes.length+1);extra.set(encoded.bytes);
    await assert.rejects(()=>deserializeOwnedGraph(extra,context,adapter));
  });
  it('rejects duplicate escaped keys, unsafe object keys and scientific numeric literals',()=>{
    assert.throws(()=>parseScientificJson('{"x":1,"\\u0078":2}'));
    assert.throws(()=>parseScientificJson('{"__proto__":{}}'));
    assert.throws(()=>parseScientificJson('{"x":1e2}'));
  });
});
describe('runtime record-order regressions',()=>{
  it('preserves key order used by deterministic owner reductions',async()=>{
    const input={z:1e16,a:-1e16,m:1},encoded=await serializeOwnedGraph(input,context,adapter);
    const decoded=(await deserializeOwnedGraph(encoded.bytes,context,adapter)).value as Record<string,number>;
    const total=(v:Record<string,number>)=>Object.keys(v).reduce((sum,key)=>sum+v[key],0);
    assert.deepEqual(Object.keys(decoded),Object.keys(input));assert.equal(total(decoded),total(input));
  });
  it('retains mixed keys and rejects a rehashed impossible own-key order',async()=>{
    const input:Record<string,unknown>={z:1,'10':2,'2':3,a:4};
    Object.defineProperty(input,'hidden',{value:5,enumerable:false});
    const encoded=await serializeOwnedGraph(input,context,adapter);
    const restored=(await deserializeOwnedGraph(encoded.bytes,context,adapter)).value as object;
    assert.deepEqual(Reflect.ownKeys(restored),Reflect.ownKeys(input));
    const {manifest,payload}=split(encoded.bytes);
    const record=(manifest.nodes as {kind:string;entries?:unknown[][]}[]).find(n=>n.kind==='record')!;
    [record.entries![0],record.entries![2]]=[record.entries![2],record.entries![0]];
    const invalid=await wire(manifest,payload,true);
    await assert.rejects(()=>deserializeOwnedGraph(invalid,context,adapter),CheckpointIOError);
  });
});
