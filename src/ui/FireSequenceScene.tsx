import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { Line } from '@react-three/drei/core/Line.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { contactCoolingState } from '../story/contactCooling'
import { OakTree } from './OakTree'
import { createSoilTexture } from './FractureStudy'
import { SequenceExcavator, SequenceGrass } from './FireSequenceEquipment'
import { NaturalAggregates } from './CoupledNaturalContext'
import { Chamber, Underreamer, SegmentedDome, CrackAndWaterPaths, ConstrainedCap, ConstrainedCrackAndWaterPaths } from './FireInterventionEquipment'
import { createFireGroundGeometry } from './FireGroundGeometry'
import { buildPeatAppearance, buildStoryWettingGrid, rapidSoilDisruptionAt, storyRupture, storyRuptureOffset, STORY_RUPTURE_GLSL, RAPID_SOIL_DISRUPTION_GLSL } from '../story/fireAppearance'
import { FIRE_SEQUENCE_GEOMETRY as G, fireSequencePose, rapidGasPulse, rapidGasQuench, constrainedCapShape, constrainedSoilLiftAt, openPitDepthAt, eased, illustratedPeatCoverage, type FireSourceMode, type FireSequenceView } from '../story/fireSequence'

import { currentPeatCoverage, currentEquipmentState } from '../story/firePresentation'
import { FireWaterTruck } from './FireWaterTruck'

export interface FireFieldSnapshot { timeS: number; nx: number; ny: number; nz: number; temperatureK: ArrayLike<number>; oxygen: ArrayLike<number>; co2: ArrayLike<number>; dryIceKg?: number }
export interface FireSequenceLayers { fire: boolean; gas: boolean; water: boolean; anatomy: boolean }
interface SceneProps { time: number; mode: FireSourceMode; view: FireSequenceView; layers: FireSequenceLayers; frame?: FireFieldSnapshot; resetToken: number; realistic?: boolean; openPit?: boolean; straightBore?: boolean; cinematic?: boolean; cameraDistance?: number; connectedSupply?: boolean }
const SOURCE_X = G.sourceX
const random = (n: number) => { const v = Math.sin(n * 91.713 + 7.157) * 43758.5453; return v - Math.floor(v) }

function Ground({ time, mode, view, frame, fire, water, realistic, openPit, straightBore, connectedSupply }: { time: number; mode: FireSourceMode; view: FireSequenceView; frame?: FireFieldSnapshot; fire: boolean; water: boolean; realistic: boolean; openPit: boolean; straightBore: boolean; connectedSupply?: boolean }) {
  const invalidate = useThree(state => state.invalidate)
  const texture = useMemo(() => {
    const width = frame ? frame.nx * frame.ny : 2, height = frame?.nz ?? 2, data = new Float32Array(width * height * 4)
    for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
      const id = frame ? z * width + x : 0, q = (z * width + x) * 4
      data[q] = frame?.temperatureK[id] ?? 283.15; data[q + 1] = frame?.oxygen[id] ?? .209; data[q + 2] = frame?.co2[id] ?? .0004; data[q + 3] = 1
    }
    const value = new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType); value.minFilter = value.magFilter = THREE.NearestFilter; value.needsUpdate = true; return value
  }, [frame])
  const wetTexture=useMemo(()=>{const field=buildStoryWettingGrid(time,realistic,mode,straightBore),tex=new THREE.DataTexture(field.data,field.width,field.height,THREE.RGBAFormat,THREE.FloatType);tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;return tex},[time,realistic,mode,straightBore])
  useEffect(()=>()=>wetTexture.dispose(),[wetTexture])
  const groundGeometry = useMemo(createFireGroundGeometry, [])
  const peatTexture = useMemo(() => { const field=buildPeatAppearance(), data=new Float32Array(field.nx*field.ny*4);for(let i=0;i<field.arrival.length;i++){data[i*4]=field.arrival[i];data[i*4+1]=field.mask[i];data[i*4+3]=1}const tex=new THREE.DataTexture(data,field.nx,field.ny,THREE.RGBAFormat,THREE.FloatType);tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.needsUpdate=true;return tex },[])
  useEffect(()=>()=>{groundGeometry.dispose();peatTexture.dispose()},[groundGeometry,peatTexture])
  const uniforms = useMemo(() => ({ uContacts:{value:Array.from({length:13},()=>new THREE.Vector4(0,0,.1,1))},uWet:{value:wetTexture},uShowWater:{value:1},uUnderream:{value:0},uPitDepth:{value:0},uCapLift:{value:0},uRealistic:{value:0},uStraightBore:{value:0},uPeat:{value:peatTexture}, uPulse:{value:0}, uDamage:{value:0}, uGasPulse:{value:0},uGasQuench:{value:0}, uClock: { value: 0 }, uDrill: { value: 0 }, uView: { value: 0 }, uHasField: { value: 0 }, uShowFire: { value: 1 }, uField: { value: texture }, uGrid: { value: new THREE.Vector3(2,1,2) }, uCoverage: { value: 0 } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: .96, side: THREE.DoubleSide })
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms,uniforms)
      shader.vertexShader = STORY_RUPTURE_GLSL+RAPID_SOIL_DISRUPTION_GLSL+'attribute vec3 displayCenter; attribute float displaySeed; uniform float uPulse,uDamage,uGasPulse,uView,uCapLift; varying vec3 vGround;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vGround=position;
if(uView<.5){
 vec3 local=position-displayCenter;
 float strength=exp(-((displayCenter.x-.4)*(displayCenter.x-.4)/7.0+displayCenter.z*displayCenter.z/5.0))*pow(clamp((displayCenter.y+3.2)/3.2,0.0,1.0),.4);
 float shrink=.003+uDamage*strength*(.045+.05*displaySeed);
 float turn=(displaySeed-.5)*(.15*uPulse+.045*uDamage)*strength;
 transformed.xy=displayCenter.xy+mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*local.xy*(1.0-shrink);
 transformed.z=displayCenter.z+local.z*(1.0-shrink);
 transformed+=storyRuptureOffset(displayCenter,uPulse,uDamage)*.75+storyRuptureOffset(position,uPulse,uDamage)*.25;
 transformed+=rapidSoilDisruption(displayCenter,uGasPulse)*.75+rapidSoilDisruption(position,uGasPulse)*.25;
 float radial=length(vec2(position.x-${SOURCE_X.toFixed(2)},position.z));
 float overhead=(1.0-smoothstep(.20,.90,radial))*smoothstep(-1.16,-.25,position.y);
 transformed.y+=uCapLift*overhead;
}`)
      shader.fragmentShader = `varying vec3 vGround; uniform float uClock,uDrill,uView,uHasField,uShowFire,uCoverage,uUnderream,uPitDepth,uShowWater,uRealistic,uStraightBore,uGasPulse,uGasQuench; uniform sampler2D uField,uPeat,uWet; uniform vec3 uGrid; uniform vec4 uContacts[13];
float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,41.21)))*43758.5453);}
vec3 palette(float a){return mix(mix(vec3(.05,.26,.35),vec3(.28,.67,.48),smoothstep(.0,.6,a)),vec3(1.0,.38,.075),smoothstep(.55,1.0,a));}
// Same outline as insideIllustratedPeat; the sampled arrival graph stays unchanged.
float illustratedPeatMask(vec2 p){
 float edge=length((p-vec2(.5,-1.65))/vec2(3.1,.68))-(1.0+.045*sin(p.x*5.1+p.y*3.7)+.024*sin(p.x*14.3-p.y*12.1));
 float feather=max(fwidth(edge),.001);
 return 1.0-smoothstep(-feather,feather,edge);
}
` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 p=vGround;
if(uPitDepth>.005 && p.y>-uPitDepth){float pitRadius=${G.pitBottomRadiusM}+(${G.pitTopRadiusM-G.pitBottomRadiusM})*clamp((p.y+uPitDepth)/uPitDepth,0.0,1.0);if(length(vec2(p.x-${SOURCE_X.toFixed(2)},p.z))<pitRadius)discard;}
if(length(vec2(p.x-${SOURCE_X.toFixed(2)},p.z))<${G.boreRadiusM.toFixed(2)} && p.y>-uDrill && uDrill>.005) discard;
if(uUnderream>.005&&pow(length(vec2(p.x-${SOURCE_X.toFixed(2)},p.z))/(${G.cavityRadiusM}*uUnderream),2.0)+pow((p.y-(${G.cavityCenterY}))/${G.cavityHalfHeightM},2.0)<1.0)discard;
float depth=-p.y+.025*sin(p.x*2.2)+.016*sin(p.z*4.2);
vec3 earth=depth<.17?vec3(.055,.038,.020):depth<.72?vec3(.21,.145,.072):depth<1.8?vec3(.33,.27,.16):vec3(.46,.44,.33);
vec4 peat=texture2D(uPeat,vec2((p.x+4.0)/8.0,(p.y+3.2)/3.2));
float peatMask=illustratedPeatMask(p.xy);
earth=mix(earth,vec3(.055,.032,.014),peatMask);
float grit=grain(floor(p*170.0));earth*=.73+.42*grit;
vec3 cell=clamp(floor(vec3((p.x+4.0)/8.0,(p.z+4.0)/8.0,-p.y/3.2)*uGrid),vec3(0.0),uGrid-1.0);
vec4 state=texture2D(uField,vec2((cell.x+cell.y*uGrid.x+.5)/(uGrid.x*uGrid.y),(cell.z+.5)/uGrid.z));
float fieldValue=uView<1.5?clamp((state.r-273.15)/600.0,0.0,1.0):uView<2.5?clamp(state.g/.209,0.0,1.0):clamp(state.b/.5,0.0,1.0);
if(uView>.5&&uHasField>.5)earth=palette(fieldValue);
float reached=step(peat.r,uCoverage)*peatMask*step(12.0,uClock);
float downProgress=smoothstep(8.0,12.0,uClock);
float pathCenter=1.7+.1*sin(-p.y*5.0);
float connectedPath=(1.0-smoothstep(.045,.12,abs(p.x-pathCenter)))*step(-p.y,1.045*downProgress)*step(p.y,0.0)*step(8.0,uClock);
float heat=max(reached,connectedPath)*uShowFire;
float coarseHeat=smoothstep(.22,.8,grain(floor(p*vec3(11.0,16.0,9.0))));
float ember=step(.68,grain(floor(p*vec3(28.0,37.0,25.0))))*(.45+.55*coarseHeat);
vec3 emberTint=mix(vec3(.90,.065,.003),vec3(1.0,.39,.026),step(.94,grain(floor(p*63.0))));
float localGlow=1.0;for(int i=0;i<13;i++){float footprint=1.0-smoothstep(.3,1.0,distance(p.xy,uContacts[i].xy)/uContacts[i].z);localGlow=min(localGlow,mix(1.0,uContacts[i].w,footprint));}
float wetness=texture2D(uWet,vec2((p.x+4.0)/8.0,(p.y+3.2)/3.2)).r*uShowWater;
float gasNear=(1.0-smoothstep(.18,1.34,length((p.xy-vec2(.4,-1.3))*vec2(1.0,1.16))))*peatMask;
float gasSuppression=gasNear*uGasQuench;
vec3 peatEmission=vec3(0.0);
if(uView<.5 && p.z>-.02){
 earth=mix(earth,vec3(.035,.017,.009),heat*(.72+.13*grit));
 earth=mix(earth,vec3(.032,.027,.022),gasSuppression*.78*heat);
 earth=mix(earth,vec3(.21,.29,.28),gasNear*uGasPulse*.16);
 float wetBlend=smoothstep(.08,.80,wetness);
 if(uStraightBore>.5){
  vec3 wetPeat=vec3(.040,.027,.020)*(.72+.42*grain(floor(p*vec3(61.0,69.0,53.0))));
  earth=mix(earth,wetPeat,wetBlend*.94*peatMask);
 }else earth=mix(earth,earth*.40,wetness*.8);
 float sparse=step(.94,grain(floor(p*vec3(18.0,23.0,17.0))))*.16;
 float visibleEmber=uStraightBore>.5?mix(1.0,sparse,wetBlend):(uRealistic>.5?sparse:1.0);
 visibleEmber*=1.0-.985*gasSuppression;
 float wetGlow=uStraightBore>.5?1.0-.58*wetBlend:(uRealistic>.5?1.0-.98*wetness:1.0);
 peatEmission=heat*localGlow*(.035+.065*coarseHeat+ember*1.7)*emberTint*visibleEmber*wetGlow;
}
diffuseColor.rgb=earth;`)
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=peatEmission;')
    }
    return m
  },[uniforms])
  useLayoutEffect(() => { contactCoolingState(time,mode).patches.forEach((p,i)=>uniforms.uContacts.value[i].set(p.xM,p.yM,p.radiusM,Math.max(0,Math.min(1,(p.temperatureK-550)/(823.15-550)))**1.7));uniforms.uWet.value=wetTexture;uniforms.uShowWater.value=water?1:0;uniforms.uRealistic.value=realistic?1:0;uniforms.uStraightBore.value=straightBore?1:0;uniforms.uUnderream.value=view==='natural'&&!openPit&&!straightBore?(realistic?.92*eased(time,31,33):fireSequencePose(time,mode).underream):0;uniforms.uPitDepth.value=view==='natural'&&openPit?openPitDepthAt(time):0;uniforms.uCapLift.value=view==='natural'&&realistic&&!straightBore?constrainedCapShape(time,mode).soilLiftM:0;uniforms.uClock.value=time;uniforms.uDrill.value=view==='natural'&&!openPit?fireSequencePose(time,'gradual').drillDepth:0;uniforms.uView.value=['natural','temperature','oxygen','co2'].indexOf(view);uniforms.uHasField.value=frame?1:0;uniforms.uShowFire.value=fire?1:0;uniforms.uCoverage.value=connectedSupply?currentPeatCoverage(time):illustratedPeatCoverage(time);const rupture=storyRupture(time,mode);uniforms.uPulse.value=view==='natural'&&!realistic?rupture.pulse:0;uniforms.uDamage.value=view==='natural'&&!realistic?rupture.damage:0;uniforms.uGasPulse.value=view==='natural'&&straightBore?rapidGasPulse(time)*(mode==='rapid'?1:0):0;uniforms.uGasQuench.value=view==='natural'&&straightBore&&mode==='rapid'?rapidGasQuench(time):0;uniforms.uField.value=texture;uniforms.uGrid.value.set(frame?.nx??2,frame?.ny??1,frame?.nz??2);invalidate() },[time,mode,view,frame,fire,water,realistic,openPit,straightBore,connectedSupply,uniforms,texture,wetTexture,invalidate])
  useEffect(()=>()=>texture.dispose(),[texture]);useEffect(()=>()=>material.dispose(),[material])
  return <mesh geometry={groundGeometry} material={material} receiveShadow castShadow/>
}

function OpenExcavation({time}:{time:number}){
  const depth=openPitDepthAt(time)
  if(depth<.005)return null
  return <group userData={{scientificRole:'authored open excavation with fixed sloped walls and staged backfill; soil support is not calculated'}}>
    <mesh position={[SOURCE_X,-depth/2,0]} receiveShadow><cylinderGeometry args={[G.pitTopRadiusM,G.pitBottomRadiusM,depth,48,1,true,Math.PI/2,Math.PI]}/><meshStandardMaterial color="#78634a" side={THREE.BackSide} roughness={1}/></mesh>
    <mesh position={[SOURCE_X,-depth,-.18]} receiveShadow><cylinderGeometry args={[G.pitBottomRadiusM,G.pitBottomRadiusM,.035,48,1,false,Math.PI/2,Math.PI]}/><meshStandardMaterial color="#4b3725" roughness={1}/></mesh>
  </group>
}

function StoryAggregates({time,mode,realistic,openPit,straightBore}:{time:number;mode:FireSourceMode;realistic:boolean;openPit:boolean;straightBore:boolean}){
  const group=useRef<THREE.Group>(null),invalidate=useThree(state=>state.invalidate)
  const originals=useRef(new Map<THREE.InstancedMesh,THREE.Matrix4[]>())
  const uniform=useMemo(()=>({value:0}),[]),cavityUniform=useMemo(()=>({value:0}),[]),pitUniform=useMemo(()=>({value:0}),[])
  useLayoutEffect(()=>{
    group.current?.traverse(object=>{if(!(object instanceof THREE.InstancedMesh))return;const material=object.material as THREE.MeshStandardMaterial
      material.onBeforeCompile=shader=>{shader.uniforms.uBoreDepth=uniform;shader.uniforms.uCavity=cavityUniform;shader.uniforms.uPitDepth=pitUniform;shader.vertexShader='varying vec3 vAggregateWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvAggregateWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 vAggregateWorld; uniform float uBoreDepth,uCavity,uPitDepth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
if(uPitDepth>.005&&vAggregateWorld.y>-uPitDepth){float pitRadius=${G.pitBottomRadiusM}+${G.pitTopRadiusM-G.pitBottomRadiusM}*clamp((vAggregateWorld.y+uPitDepth)/uPitDepth,0.0,1.0);if(length(vec2(vAggregateWorld.x-${SOURCE_X},vAggregateWorld.z))<pitRadius)discard;}
if(length(vec2(vAggregateWorld.x-${SOURCE_X},vAggregateWorld.z))<${G.boreRadiusM}&&vAggregateWorld.y>-uBoreDepth&&uBoreDepth>.005)discard;
if(uCavity>.005&&pow(length(vec2(vAggregateWorld.x-${SOURCE_X},vAggregateWorld.z))/(${G.cavityRadiusM}*uCavity),2.0)+pow((vAggregateWorld.y-(${G.cavityCenterY}))/${G.cavityHalfHeightM},2.0)<1.0)discard;`)}
      material.needsUpdate=true
    })
  },[uniform,cavityUniform,pitUniform])
  useLayoutEffect(()=>{cavityUniform.value=openPit||straightBore?0:realistic?.92*eased(time,31,33):fireSequencePose(time,'gradual').underream;pitUniform.value=openPit?openPitDepthAt(time):0;uniform.value=openPit?0:fireSequencePose(time,'gradual').drillDepth;const r=storyRupture(time,mode),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4();group.current?.traverse(object=>{if(!(object instanceof THREE.InstancedMesh))return;if(!originals.current.has(object)){const values=Array.from({length:object.count},(_,i)=>{const m=new THREE.Matrix4();object.getMatrixAt(i,m);return m});originals.current.set(object,values)}originals.current.get(object)!.forEach((base,i)=>{base.decompose(position,rotation,scale);if(realistic&&straightBore)position.add(new THREE.Vector3(...rapidSoilDisruptionAt(position.x,position.y,position.z,time,mode)));else if(realistic)position.y+=constrainedSoilLiftAt(position.x,position.y,position.z,time,mode);else position.add(new THREE.Vector3(...storyRuptureOffset(position.x,position.y,position.z,r.pulse,r.damage)));matrix.compose(position,rotation,scale);object.setMatrixAt(i,matrix)});object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere()});invalidate()},[time,mode,realistic,openPit,straightBore,uniform,cavityUniform,pitUniform,invalidate])
  return <group ref={group}><NaturalAggregates fidelity="precision2560" cut/></group>
}
function Tree({time,mode,realistic,openPit,straightBore}:{time:number;mode:FireSourceMode;realistic:boolean;openPit:boolean;straightBore:boolean}){
  const group=useRef<THREE.Group>(null),texture=useMemo(createSoilTexture,[]),uniform=useMemo(()=>({value:0}),[]),cavityUniform=useMemo(()=>({value:0}),[]),pitUniform=useMemo(()=>({value:0}),[]),invalidate=useThree(state=>state.invalidate)
  useEffect(()=>()=>texture.dispose(),[texture])
  useLayoutEffect(()=>{
    const originals=new Map<THREE.MeshStandardMaterial,{compile:THREE.MeshStandardMaterial['onBeforeCompile'];cache:THREE.MeshStandardMaterial['customProgramCacheKey']}>()
    group.current?.traverse(object=>{if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh)return
      const material=object.material as THREE.MeshStandardMaterial,key=material.customProgramCacheKey()
      if(!key.startsWith('oak-bark-true')||originals.has(material))return
      const original=material.onBeforeCompile
      originals.set(material,{compile:original,cache:material.customProgramCacheKey})
      material.onBeforeCompile=(shader,renderer)=>{original.call(material,shader,renderer);shader.uniforms.uStoryBoreDepth=uniform;shader.uniforms.uStoryCavity=cavityUniform;shader.uniforms.uStoryPitDepth=pitUniform;shader.fragmentShader='uniform float uStoryBoreDepth,uStoryCavity,uStoryPitDepth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
if(uStoryPitDepth>.005&&vOak.y>-uStoryPitDepth){float pitRadius=${G.pitBottomRadiusM}+${G.pitTopRadiusM-G.pitBottomRadiusM}*clamp((vOak.y+uStoryPitDepth)/uStoryPitDepth,0.0,1.0);if(length(vec2(vOak.x-${SOURCE_X},vOak.z))<pitRadius)discard;}
if(length(vec2(vOak.x-${SOURCE_X},vOak.z))<${G.boreRadiusM}&&vOak.y>-uStoryBoreDepth&&uStoryBoreDepth>.005)discard;
if(uStoryCavity>.005&&pow(length(vec2(vOak.x-${SOURCE_X},vOak.z))/(${G.cavityRadiusM}*uStoryCavity),2.0)+pow((vOak.y-(${G.cavityCenterY}))/${G.cavityHalfHeightM},2.0)<1.0)discard;`)}
      material.customProgramCacheKey=()=>key+'-story-excavation';material.needsUpdate=true
    })
    // React effect replay and natural/scientific remounts must not stack hooks.
    return()=>{for(const [material,original] of originals){material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.cache;material.needsUpdate=true}}
  },[uniform,cavityUniform,pitUniform])
  useLayoutEffect(()=>{cavityUniform.value=openPit||straightBore?0:realistic?.92*eased(time,31,33):fireSequencePose(time,'gradual').underream;pitUniform.value=openPit?openPitDepthAt(time):0;uniform.value=openPit?0:fireSequencePose(time,'gradual').drillDepth;const r=storyRupture(time,mode),data=texture.image.data as Float32Array;for(let j=0;j<25;j++)for(let i=0;i<49;i++){const x=-4+i/48*8,y=-3.2+j/24*3.2,o=realistic?[0,straightBore?0:constrainedSoilLiftAt(x,y,0,time,mode),0]:storyRuptureOffset(x,y,0,r.pulse,r.damage),id=(j*49+i)*4;data[id]=o[0];data[id+1]=o[1]}texture.needsUpdate=true;invalidate()},[time,mode,realistic,openPit,straightBore,texture,uniform,cavityUniform,pitUniform,invalidate])
  return <group ref={group}><OakTree soilTexture={texture} natural/></group>
}
function SourceAndCap({time,mode,realistic,openPit,straightBore}:{time:number;mode:FireSourceMode;realistic:boolean;openPit:boolean;straightBore:boolean}){
  const pose=fireSequencePose(time,mode)
  const mass=contactCoolingState(time,mode).ledger.dryIceRemainingKg,radius=Math.cbrt(3*Math.max(0,mass)/(4*Math.PI*G.sourceDensityKgM3))
  // Diameter-only presentation enlargement; the 4 kg contact ledger is unchanged.
  const displayRadius=straightBore?radius*2:radius
  const pocket=!straightBore&&(realistic?eased(time,31,33):pose.underream)>.05
  const wallSegments=pocket?[[0,-G.cavityCenterY-G.cavityHalfHeightM],[-G.cavityCenterY+G.cavityHalfHeightM,pose.drillDepth]]:[[0,pose.drillDepth]]
  return <>{!openPit&&<>{pose.drillDepth>.005&&wallSegments.map(([top,bottom],i)=><mesh key={i} position={[SOURCE_X,-(top+bottom)/2,0]}><cylinderGeometry args={[G.boreRadiusM*.997,G.boreRadiusM*.997,Math.max(.001,bottom-top),32,1,true,Math.PI/2,Math.PI]}/><meshStandardMaterial color="#705a3b" roughness={1} side={THREE.BackSide}/></mesh>)}{!straightBore&&<><Chamber time={time} constrained={realistic}/><Underreamer time={time} constrained={realistic}/></>}</>}<group visible={pose.sourceVisible&&mass>1e-6} position={[SOURCE_X,pose.sourceY,.012]} userData={{scientificRole:straightBore?'2x-diameter presentation proxy; mass and density in the separate contact budget are unchanged':'contact-budget dry-ice geometry'}}><mesh><sphereGeometry args={[Math.max(.001,displayRadius),24,18]}/><meshStandardMaterial color="#e2f4f1" roughness={.5} emissive="#c7e4dc" emissiveIntensity={.12}/></mesh></group>{realistic?<ConstrainedCap time={time} mode={mode} fixedSize={straightBore}/>:<SegmentedDome time={time} mode={mode}/>}</>
}
function SurfaceConnection({time,visible}:{time:number;visible:boolean}){
  const points=useMemo(()=>new THREE.CatmullRomCurve3([new THREE.Vector3(1.72,.035,-.28),new THREE.Vector3(1.72,.005,.035),new THREE.Vector3(1.78,-.38,.038),new THREE.Vector3(1.64,-.73,.04),new THREE.Vector3(1.6,-1.02,.04)]).getPoints(60),[])
  if(!visible||time<8)return null
  const shown=points.slice(0,Math.max(2,Math.ceil(61*eased(time,8,12))))
  return <><Line points={shown} color="#16100a" lineWidth={8} transparent opacity={.9}/><Line points={shown} color="#bd491b" lineWidth={1.1} dashed dashSize={.035} gapSize={.055} transparent opacity={.58}/></>
}
function SurfaceFire({time,visible}:{time:number;visible:boolean}){
  const amount=Math.min(1,.15+eased(time,0,9))*(1-.82*eased(time,12,23)),startX=1.72
  return <group visible={visible&&time<27} position={[startX,.02,-.28]}>{Array.from({length:13},(_,i)=>{const angle=i*2.3999,r=.09+random(i)*.24,h=(.2+random(i+12)*.5)*(1+.12*Math.sin(time*7+i));return <mesh key={i} position={[Math.cos(angle)*r,h*amount*.46,Math.sin(angle)*r*.55]} scale={[.05+random(i+37)*.075,h*amount,.06+random(i+89)*.04]} rotation={[0,angle,Math.sin(time*4+i)*.12]}><coneGeometry args={[1,1,7]}/><meshBasicMaterial color={i%3===0?'#ffe3a0':i%3===1?'#ef742c':'#bf3a18'} transparent opacity={.86}/></mesh>})}<pointLight color="#ff9d50" intensity={amount*1.8} distance={2.5}/></group>
}
function Tracers({time,mode,layers,realistic,straightBore,connectedSupply}:{time:number;mode:FireSourceMode;layers:FireSequenceLayers;realistic:boolean;straightBore:boolean;connectedSupply?:boolean}){
  const gas=useRef<THREE.InstancedMesh>(null),smoke=useRef<THREE.InstancedMesh>(null),cuttings=useRef<THREE.InstancedMesh>(null),invalidate=useThree(state=>state.invalidate)
  const geometry=useMemo(()=>new THREE.IcosahedronGeometry(1,0),[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useLayoutEffect(()=>{
    const object=new THREE.Object3D(),pose=fireSequencePose(time,mode)
    for(let i=0;i<170;i++){
      const age=(time*.11+random(i+200))%1,angle=random(i+201)*Math.PI*2,burst=eased(time,55.02,55.38),reach=(straightBore?burst:pose.gas)*(straightBore?.12+1.25*age:.3+2.1*age),vertical=(random(i+300)-.45)*1.1
      const visible=straightBore?layers.gas&&mode==='rapid'&&time>=55.02&&time<56.25:!realistic&&layers.gas&&time>=55
      object.position.set(SOURCE_X+Math.cos(angle)*reach,-G.sourceDepthM+vertical*reach,straightBore?.16+Math.abs(Math.sin(angle))*.05:.03+Math.abs(Math.sin(angle))*.055);object.scale.setScalar(visible?(straightBore?(1-eased(time,55.45,56.25))*(.012+burst*.013*(1-age)):.013+pose.gas*.018*(1-age)):0);object.updateMatrix();gas.current?.setMatrixAt(i,object.matrix)
    }
    for(let i=0;i<65;i++){
      const age=(time*.25+random(i+33))%1,active=time<31?1-eased(time,20,31):0
      object.position.set(1.72+Math.sin(age*5+i)*age*.25,.2+age*1.9,-.3+age*.13);object.scale.setScalar(layers.fire?.04+age*.14*active:0);if(!active)object.scale.setScalar(0);object.updateMatrix();smoke.current?.setMatrixAt(i,object.matrix)
    }
    for(let i=0;i<100;i++){
      const age=(time*.65+random(i+14))%1,angle=random(i+55)*Math.PI*2,active=connectedSupply?currentEquipmentState(time).drilling:time<31&&pose.drillDepth>0
      object.position.set(SOURCE_X+Math.cos(angle)*age*.7,.05+Math.sin(age*Math.PI)*.4,-.06+Math.sin(angle)*age*.4);object.rotation.set(i,time+i,i*.7);object.scale.setScalar(active?.012+random(i+101)*.025:0);object.updateMatrix();cuttings.current?.setMatrixAt(i,object.matrix)
    }
    for(const ref of[gas,smoke,cuttings])if(ref.current){ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()}invalidate()
  },[time,mode,layers,realistic,straightBore,connectedSupply,geometry,invalidate])
  return <><instancedMesh ref={gas} args={[geometry,undefined,170]} raycast={()=>null}><meshBasicMaterial color={straightBore?'#b8bdba':'#7cd0d6'} transparent opacity={straightBore?.25:.38} depthWrite={false}/></instancedMesh><instancedMesh ref={smoke} args={[geometry,undefined,65]} raycast={()=>null}><meshBasicMaterial color="#a9aaa0" transparent opacity={.11} depthWrite={false}/></instancedMesh><instancedMesh ref={cuttings} args={[geometry,undefined,100]} raycast={()=>null}><meshStandardMaterial color="#8a6845" roughness={1}/></instancedMesh></>
}
function PressureBurst({time,mode,local=false}:{time:number;mode:FireSourceMode;local?:boolean}){
  const dust=useRef<THREE.InstancedMesh>(null),debris=useRef<THREE.InstancedMesh>(null),invalidate=useThree(state=>state.invalidate)
  const dustMaterial=useMemo(()=>new THREE.MeshBasicMaterial({color:'#a5997f',transparent:true,opacity:.1,depthWrite:false}),[])
  useEffect(()=>()=>dustMaterial.dispose(),[dustMaterial])
  useLayoutEffect(()=>{
    const object=new THREE.Object3D(),age=time-55,active=mode==='rapid'&&age>=0&&age<(local?1.35:3.2)
    dustMaterial.opacity=active?(local?.24*(1-eased(time,55.55,56.3)):.13*(1-eased(time,56,58.2))):0
    for(let i=0;i<110;i++){
      const t=Math.max(0,age-random(i+404)*(local?.07:.28)),angle=random(i+710)*Math.PI*2,ring=random(i+143)
      const burst=1-Math.exp(-9*t)
      object.position.set(SOURCE_X+Math.cos(angle)*(local?.10+burst*(.3+ring*.55):.1+ring*.45+t*.6),local?-G.sourceDepthM+Math.sin(angle)*(.15+burst*.42):.05+t*(.6+random(i+193)*.5),local?.18+Math.abs(Math.sin(angle))*.05:-.1-Math.abs(Math.sin(angle))*(.1+t*.7));object.rotation.set(i,i*2,i*.3);object.scale.setScalar(active&&t>0?(local?.035+.045*burst:.08+t*.24)*(.6+ring):0);object.updateMatrix();dust.current?.setMatrixAt(i,object.matrix)
    }
    for(let i=0;i<140;i++){
      const t=Math.max(0,age-random(i+31)*(local?.06:.18)),angle=random(i+810)*Math.PI*2,speed=1+random(i+145)*1.8,y=.05+(1.6+random(i+934)*2.1)*t-4.905*t*t
      const burst=1-Math.exp(-10*t)
      object.position.set(SOURCE_X+Math.cos(angle)*(local?speed*burst*.36:speed*t),local?-G.sourceDepthM+Math.sin(angle)*speed*burst*.21-(t*t*.09):y,local?.19:-.12-Math.abs(Math.sin(angle))*(.12+speed*t*.6));object.rotation.set(i+t*5,i*.7+t*3,i+t*4);object.scale.setScalar(active&&t>0&&(local||y>-.03)?local?.010+random(i+514)*.020:.018+random(i+514)*.055:0);object.updateMatrix();debris.current?.setMatrixAt(i,object.matrix)
    }
    for(const ref of[dust,debris])if(ref.current){ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()}invalidate()
  },[time,mode,local,dustMaterial,invalidate])
  return <group userData={{scientificRole:'prescribed pressure-release dust and debris; no explosive yield calculation'}}><instancedMesh ref={dust} args={[undefined,dustMaterial,110]} raycast={()=>null}><icosahedronGeometry args={[1,1]}/></instancedMesh><instancedMesh ref={debris} args={[undefined,undefined,140]} raycast={()=>null} castShadow><icosahedronGeometry args={[1,0]}/><meshStandardMaterial color="#685539" roughness={1}/></instancedMesh></group>
}
function Camera({resetToken,cinematic,distance}:{resetToken:number;cinematic?:boolean;distance?:number}){
  const controls=useRef<OrbitControlsImpl>(null),{camera,invalidate}=useThree()
  useEffect(()=>{camera.position.set(7.2,4.0,12.3);controls.current?.target.set(0,-.05,-1.1);controls.current?.update();invalidate()},[resetToken,camera,invalidate])
  useEffect(()=>{if(distance===undefined)return;const target=controls.current?.target??new THREE.Vector3(0,-.05,-1.1);camera.position.sub(target).setLength(distance).add(target);controls.current?.update();invalidate()},[distance,resetToken,camera,invalidate])
  return <OrbitControls ref={controls} makeDefault target={[0,-.05,-1.1]} minDistance={5} maxDistance={19} maxPolarAngle={Math.PI*.75} enableDamping={false} enableZoom={!cinematic}/>
}
export function FireSequenceScene(props:SceneProps){
  const realistic=props.realistic??false
  const openPit=props.openPit??false
  const straightBore=props.straightBore??false
  return <Canvas shadows frameloop="demand" dpr={[1,1.5]} camera={{position:[7.2,4.0,12.3],fov:38,near:.05,far:60}}>
    <color attach="background" args={[props.cinematic?'#000000':'#1c2c2f']}/><ambientLight intensity={.65}/><hemisphereLight args={['#e1eadb','#28322c',1.1]}/>
    <directionalLight castShadow position={[-4,9,5]} intensity={2.5} shadow-mapSize={[2048,2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-bias={-.0002}/>
    <Ground time={props.time} mode={props.mode} view={props.view} frame={props.frame} fire={props.layers.fire} water={props.layers.water} realistic={realistic} openPit={openPit} straightBore={straightBore} connectedSupply={props.connectedSupply}/>
    {props.view==='natural'&&<>
      <StoryAggregates time={props.time} mode={props.mode} realistic={realistic} openPit={openPit} straightBore={straightBore}/>
      <SequenceGrass time={props.time} mode={realistic?'gradual':props.mode} realistic={realistic} openPit={openPit} straightBore={straightBore}/>
      {props.layers.anatomy&&<Tree time={props.time} mode={props.mode} realistic={realistic} openPit={openPit} straightBore={straightBore}/>}
      <SurfaceFire time={props.time} visible={props.layers.fire}/><SurfaceConnection time={props.time} visible={props.layers.fire}/>
      {openPit&&<OpenExcavation time={props.time}/>}
      <SequenceExcavator time={props.time} openPit={openPit} connectedSupply={props.connectedSupply}/>{props.connectedSupply&&props.layers.water&&<FireWaterTruck time={props.time}/>}<SourceAndCap time={props.time} mode={props.mode} realistic={realistic} openPit={openPit} straightBore={straightBore}/>
      <Tracers time={props.time} mode={props.mode} layers={props.layers} realistic={realistic} straightBore={straightBore} connectedSupply={props.connectedSupply}/>
      {!realistic&&<><PressureBurst time={props.time} mode={props.mode}/><CrackAndWaterPaths time={props.time} mode={props.mode} showWater={props.layers.water}/></>}
      {realistic&&straightBore&&<PressureBurst time={props.time} mode={props.mode} local/>}
      {realistic&&<ConstrainedCrackAndWaterPaths time={props.time} mode={props.mode} showWater={props.layers.water} sourceFracture={straightBore} connectedSupply={props.connectedSupply}/>}
    </>}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.24,-1]} receiveShadow><planeGeometry args={[200,200]}/><shadowMaterial opacity={.27}/></mesh>
    <Camera resetToken={props.resetToken} cinematic={props.cinematic} distance={props.cameraDistance}/>
  </Canvas>
}
