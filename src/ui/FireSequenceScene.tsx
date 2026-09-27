import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { Line } from '@react-three/drei/core/Line.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { OakTree } from './OakTree'
import { createSoilTexture } from './FractureStudy'
import { SequenceExcavator, SequenceGrass } from './FireSequenceEquipment'
import { NaturalAggregates } from './CoupledNaturalContext'
import { FIRE_SEQUENCE_GEOMETRY as G, fireSequencePose, eased, illustratedPeatCoverage, illustratedPeatFront, type FireSourceMode, type FireSequenceView } from '../story/fireSequence'

export interface FireFieldSnapshot { timeS: number; nx: number; ny: number; nz: number; temperatureK: ArrayLike<number>; oxygen: ArrayLike<number>; co2: ArrayLike<number>; dryIceKg?: number }
export interface FireSequenceLayers { fire: boolean; gas: boolean; water: boolean; anatomy: boolean }
interface SceneProps { time: number; mode: FireSourceMode; view: FireSequenceView; layers: FireSequenceLayers; frame?: FireFieldSnapshot; resetToken: number }
const SOURCE_X = G.sourceX
const CRACK_PATHS: Array<Array<[number, number, number]>> = [
  [[SOURCE_X,-1.28,.035],[.9,-1.4,.045],[1.25,-1.1,.04],[1.85,-1.32,.045],[2.48,-.82,.04],[3.1,-.68,.04]],
  [[SOURCE_X,-1.28,.04],[.1,-1.64,.04],[-.5,-1.78,.04],[-1.02,-2.1,.04],[-1.9,-2.0,.04],[-2.75,-2.5,.04]],
  [[SOURCE_X,-1.28,.04],[.78,-1.9,.04],[1.4,-2.08,.04],[1.7,-2.55,.04],[2.6,-2.8,.04]],
  [[SOURCE_X,-1.28,.04],[-.15,-.84,.04],[-.82,-.63,.04],[-1.15,-.24,.04],[-1.65,-.04,.04]],
  [[SOURCE_X,-1.28,.04],[1.25,-1.1,.04],[1.42,-.55,.04],[1.15,-.18,.04]],
  [[SOURCE_X,-1.28,.04],[.1,-1.64,.04],[-.1,-2.16,.04],[-.66,-2.62,.04]],
]
const random = (n: number) => { const v = Math.sin(n * 91.713 + 7.157) * 43758.5453; return v - Math.floor(v) }

function Ground({ time, view, frame, fire }: { time: number; view: FireSequenceView; frame?: FireFieldSnapshot; fire: boolean }) {
  const invalidate = useThree(state => state.invalidate)
  const texture = useMemo(() => {
    const width = frame ? frame.nx * frame.ny : 2, height = frame?.nz ?? 2, data = new Float32Array(width * height * 4)
    for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
      const id = frame ? z * width + x : 0, q = (z * width + x) * 4
      data[q] = frame?.temperatureK[id] ?? 283.15; data[q + 1] = frame?.oxygen[id] ?? .209; data[q + 2] = frame?.co2[id] ?? .0004; data[q + 3] = 1
    }
    const value = new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType); value.minFilter = value.magFilter = THREE.NearestFilter; value.needsUpdate = true; return value
  }, [frame])
  const uniforms = useMemo(() => ({ uClock: { value: 0 }, uDrill: { value: 0 }, uView: { value: 0 }, uHasField: { value: 0 }, uShowFire: { value: 1 }, uField: { value: texture }, uGrid: { value: new THREE.Vector3(2,1,2) }, uPeatFront: { value: 1 } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: .96, side: THREE.DoubleSide })
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms,uniforms)
      shader.vertexShader = 'varying vec3 vGround;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround = position + vec3(0.0,-1.6,-2.0);')
      shader.fragmentShader = `varying vec3 vGround; uniform float uClock,uDrill,uView,uHasField,uShowFire,uPeatFront; uniform sampler2D uField; uniform vec3 uGrid;
float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,41.21)))*43758.5453);}
vec3 palette(float a){return mix(mix(vec3(.05,.26,.35),vec3(.28,.67,.48),smoothstep(.0,.6,a)),vec3(1.0,.38,.075),smoothstep(.55,1.0,a));}
` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 p=vGround;
if(abs(p.x-${SOURCE_X.toFixed(2)})<${G.boreRadiusM.toFixed(2)} && p.z>-.42 && p.y>-uDrill && uDrill>.005) discard;
float depth=-p.y+.025*sin(p.x*2.2)+.016*sin(p.z*4.2);
vec3 earth=depth<.17?vec3(.065,.039,.017):depth<.72?vec3(.27,.17,.075):depth<1.8?vec3(.40,.28,.15):vec3(.52,.46,.34);
float lens=length(vec2((p.x-.5)/3.1,(p.y+1.65)/.68));
float edge=.025*sin(p.x*23.0)*sin(p.y*17.0);
earth=mix(earth,vec3(.065,.038,.018),1.0-smoothstep(.99+edge,1.03+edge,lens));
float grit=grain(floor(p*170.0));earth*=.73+.42*grit;
vec3 cell=clamp(floor(vec3((p.x+4.0)/8.0,(p.z+4.0)/8.0,-p.y/3.2)*uGrid),vec3(0.0),uGrid-1.0);
vec4 state=texture2D(uField,vec2((cell.x+cell.y*uGrid.x+.5)/(uGrid.x*uGrid.y),(cell.z+.5)/uGrid.z));
float fieldValue=uView<1.5?clamp((state.r-273.15)/600.0,0.0,1.0):uView<2.5?clamp(state.g/.209,0.0,1.0):clamp(state.b/.5,0.0,1.0);
if(uView>.5&&uHasField>.5)earth=palette(fieldValue);
vec2 peatPoint=vec2((p.x-.5)/3.1,(p.y+1.65)/.68);
float frontCoordinate=dot(peatPoint,normalize(vec2(.3548387,.9264706)));
float reached=step(uPeatFront,frontCoordinate)*(1.0-smoothstep(.98,1.015,lens))*step(12.0,uClock);
float downProgress=smoothstep(8.0,12.0,uClock);
float pathCenter=1.7+.1*sin(-p.y*5.0);
float connectedPath=(1.0-smoothstep(.045,.12,abs(p.x-pathCenter)))*step(-p.y,1.045*downProgress)*step(p.y,0.0)*step(8.0,uClock);
float heat=max(reached,connectedPath)*uShowFire;
float ember=step(.90,grain(floor(p*vec3(42.0,56.0,35.0))))*step(.65,grit);
vec3 emberTint=mix(vec3(.76,.035,.002),vec3(1.0,.30,.018),step(.94,grain(floor(p*63.0))));
if(uView<.5 && p.z>-.02){earth=mix(earth,vec3(.022,.016,.011),heat*(.78+.12*grit));earth+=heat*(.006+ember*.88)*emberTint;}
diffuseColor.rgb=earth;`)
    }
    return m
  },[uniforms])
  useLayoutEffect(() => { uniforms.uClock.value=time;uniforms.uDrill.value=view==='natural'?fireSequencePose(time,'gradual').drillDepth:0;uniforms.uView.value=['natural','temperature','oxygen','co2'].indexOf(view);uniforms.uHasField.value=frame?1:0;uniforms.uShowFire.value=fire?1:0;uniforms.uPeatFront.value=illustratedPeatFront(illustratedPeatCoverage(time));uniforms.uField.value=texture;uniforms.uGrid.value.set(frame?.nx??2,frame?.ny??1,frame?.nz??2);invalidate() },[time,view,frame,fire,uniforms,texture,invalidate])
  useEffect(()=>()=>texture.dispose(),[texture]);useEffect(()=>()=>material.dispose(),[material])
  return <mesh position={[0,-1.6,-2]} material={material} receiveShadow><boxGeometry args={[8,3.2,4,32,16,12]}/></mesh>
}

function StoryAggregates({time}:{time:number}){
  const group=useRef<THREE.Group>(null),invalidate=useThree(state=>state.invalidate)
  const uniform=useMemo(()=>({value:0}),[])
  useLayoutEffect(()=>{
    group.current?.traverse(object=>{if(!(object instanceof THREE.InstancedMesh))return;const material=object.material as THREE.MeshStandardMaterial
      material.onBeforeCompile=shader=>{shader.uniforms.uBoreDepth=uniform;shader.vertexShader='varying vec3 vAggregateWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvAggregateWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 vAggregateWorld; uniform float uBoreDepth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
if(abs(vAggregateWorld.x-${SOURCE_X})<${G.boreRadiusM}&&vAggregateWorld.z>-.42&&vAggregateWorld.y>-uBoreDepth&&uBoreDepth>.005)discard;`)}
      material.needsUpdate=true
    })
  },[uniform])
  useLayoutEffect(()=>{uniform.value=fireSequencePose(time,'gradual').drillDepth;invalidate()},[time,uniform,invalidate])
  return <group ref={group}><NaturalAggregates fidelity="precision2560" cut/></group>
}
function Tree({time}:{time:number}){
  const group=useRef<THREE.Group>(null),texture=useMemo(createSoilTexture,[]),uniform=useMemo(()=>({value:0}),[]),invalidate=useThree(state=>state.invalidate)
  useEffect(()=>()=>texture.dispose(),[texture])
  useLayoutEffect(()=>{
    group.current?.traverse(object=>{if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh)return
      const material=object.material as THREE.MeshStandardMaterial,key=material.customProgramCacheKey()
      if(!key.startsWith('oak-bark-true'))return
      const original=material.onBeforeCompile
      material.onBeforeCompile=(shader,renderer)=>{original.call(material,shader,renderer);shader.uniforms.uStoryBoreDepth=uniform;shader.fragmentShader='uniform float uStoryBoreDepth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
if(abs(vOak.x-${SOURCE_X})<${G.boreRadiusM}&&vOak.z>-.42&&vOak.y>-uStoryBoreDepth&&uStoryBoreDepth>.005)discard;`)}
      material.customProgramCacheKey=()=>key+'-story-excavation';material.needsUpdate=true
    })
  },[uniform])
  useLayoutEffect(()=>{uniform.value=fireSequencePose(time,'gradual').drillDepth;invalidate()},[time,uniform,invalidate])
  return <group ref={group}><OakTree soilTexture={texture} natural/></group>
}
function SourceAndCap({time,mode,frame}:{time:number;mode:FireSourceMode;frame?:FireFieldSnapshot}){
  const pose=fireSequencePose(time,mode),transition=mode==='rapid'?1-eased(time,55,58):1
  const mass=(time<55||mode==='rapid'?G.sourceInitialMassKg:frame?.dryIceKg??G.sourceInitialMassKg)*transition,radius=Math.cbrt(3*Math.max(0,mass)/(4*Math.PI*G.sourceDensityKgM3))
  const geometry=useMemo(()=>new THREE.LatheGeometry(Array.from({length:33},(_,i)=>{const x=i/32;return new THREE.Vector2(G.capRadiusM*x,G.capRiseM*(1-x*x)-pose.bend*(1-x*x)**2)}),48),[pose.bend])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <><group visible={pose.sourceVisible&&mass>1e-6} position={[SOURCE_X,pose.sourceY,.012]}><mesh><sphereGeometry args={[Math.max(.001,radius),24,18]}/><meshStandardMaterial color="#e2f4f1" roughness={.5} emissive="#c7e4dc" emissiveIntensity={.12}/></mesh></group><group visible={pose.capVisible} position={[SOURCE_X,pose.capY,0]}><mesh geometry={geometry} rotation={[Math.PI,0,0]} castShadow><meshStandardMaterial color="#a5b3b7" metalness={.84} roughness={.22} side={THREE.DoubleSide}/></mesh><mesh position={[0,-.11+pose.bend,0]}><torusGeometry args={[.075,.017,6,18,Math.PI]}/><meshStandardMaterial color="#8c9b9f" metalness={.8} roughness={.2}/></mesh></group></>
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
function Tracers({time,mode,layers}:{time:number;mode:FireSourceMode;layers:FireSequenceLayers}){
  const gas=useRef<THREE.InstancedMesh>(null),smoke=useRef<THREE.InstancedMesh>(null),cuttings=useRef<THREE.InstancedMesh>(null),invalidate=useThree(state=>state.invalidate)
  const geometry=useMemo(()=>new THREE.IcosahedronGeometry(1,0),[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useLayoutEffect(()=>{
    const object=new THREE.Object3D(),pose=fireSequencePose(time,mode)
    for(let i=0;i<170;i++){
      const age=(time*.11+random(i+200))%1,angle=random(i+201)*Math.PI*2,reach=pose.gas*(.3+2.1*age),vertical=(random(i+300)-.45)*1.1
      object.position.set(SOURCE_X+Math.cos(angle)*reach,-G.sourceDepthM+vertical*reach,.03+Math.abs(Math.sin(angle))*.055);object.scale.setScalar(layers.gas&&time>=55?.013+pose.gas*.018*(1-age):0);object.updateMatrix();gas.current?.setMatrixAt(i,object.matrix)
    }
    for(let i=0;i<65;i++){
      const age=(time*.25+random(i+33))%1,active=time<31?1-eased(time,20,31):0
      object.position.set(1.72+Math.sin(age*5+i)*age*.25,.2+age*1.9,-.3+age*.13);object.scale.setScalar(layers.fire?.04+age*.14*active:0);if(!active)object.scale.setScalar(0);object.updateMatrix();smoke.current?.setMatrixAt(i,object.matrix)
    }
    for(let i=0;i<100;i++){
      const age=(time*.65+random(i+14))%1,angle=random(i+55)*Math.PI*2,active=time<31&&pose.drillDepth>0
      object.position.set(SOURCE_X+Math.cos(angle)*age*.7,.05+Math.sin(age*Math.PI)*.4,-.06+Math.sin(angle)*age*.4);object.rotation.set(i,time+i,i*.7);object.scale.setScalar(active?.012+random(i+101)*.025:0);object.updateMatrix();cuttings.current?.setMatrixAt(i,object.matrix)
    }
    for(const ref of[gas,smoke,cuttings])if(ref.current){ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()}invalidate()
  },[time,mode,layers,geometry,invalidate])
  return <><instancedMesh ref={gas} args={[geometry,undefined,170]} raycast={()=>null}><meshBasicMaterial color="#7cd0d6" transparent opacity={.38} depthWrite={false}/></instancedMesh><instancedMesh ref={smoke} args={[geometry,undefined,65]} raycast={()=>null}><meshBasicMaterial color="#a9aaa0" transparent opacity={.11} depthWrite={false}/></instancedMesh><instancedMesh ref={cuttings} args={[geometry,undefined,100]} raycast={()=>null}><meshStandardMaterial color="#8a6845" roughness={1}/></instancedMesh></>
}
function WaterPaths({time,showWater}:{time:number;showWater:boolean}){
  const pose=fireSequencePose(time,'gradual'),water=useRef<THREE.InstancedMesh>(null),invalidate=useThree(state=>state.invalidate)
  const curves=useMemo(()=>CRACK_PATHS.map(points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)))),[])
  useLayoutEffect(()=>{
    const object=new THREE.Object3D()
    for(let i=0;i<144;i++){const path=curves[i%curves.length],travel=(time*.22+random(i+17))%1,point=path.getPoint(travel*pose.water);object.position.copy(point);object.scale.setScalar(showWater&&time>=70?.017+.015*random(i+91):0);object.updateMatrix();water.current?.setMatrixAt(i,object.matrix)}
    if(water.current){water.current.instanceMatrix.needsUpdate=true;water.current.computeBoundingSphere()}invalidate()
  },[time,showWater,pose.water,curves,invalidate])
  return <>{pose.crack>0&&CRACK_PATHS.map((points,i)=><Line key={i} points={points} color="#100e0c" lineWidth={1+pose.crack*2.5} transparent opacity={pose.crack*.85}/>)}{showWater&&time>=69&&<><Line points={[[-4.3,.4,-.1],[-2.4,.36,-.1],[-.7,.45,-.04],[1.02,.22,.06],[1.02,-.12,.06],[SOURCE_X,-.34,.05],[SOURCE_X,-1.28,.04]]} color="#558f9e" lineWidth={5}/>{curves.map((curve,i)=><Line key={i} points={curve.getPoints(30).slice(0,Math.max(2,Math.round(31*pose.water)))} color="#69c6d6" lineWidth={2.2} transparent opacity={.62}/>)}</>}<instancedMesh ref={water} args={[undefined,undefined,144]} raycast={()=>null}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#76d6e4" roughness={.15} metalness={.2} transparent opacity={.85}/></instancedMesh></>
}
function Camera({resetToken}:{resetToken:number}){
  const controls=useRef<OrbitControlsImpl>(null),{camera,invalidate}=useThree()
  useEffect(()=>{camera.position.set(5.2,3.3,10.6);controls.current?.target.set(0,-.25,0);controls.current?.update();invalidate()},[resetToken,camera,invalidate])
  return <OrbitControls ref={controls} makeDefault target={[0,-.25,0]} minDistance={5} maxDistance={19} maxPolarAngle={Math.PI*.75} enableDamping={false}/>
}
export function FireSequenceScene(props:SceneProps){
  return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[5.2,3.3,10.6],fov:39,near:.05,far:60}}><color attach="background" args={['#122521']}/><ambientLight intensity={1.15}/><hemisphereLight args={['#fff0cf','#28322d',1.45]}/><directionalLight position={[-3,8,7]} intensity={2.1}/><Ground time={props.time} view={props.view} frame={props.frame} fire={props.layers.fire}/>{props.view==='natural'&&<><StoryAggregates time={props.time}/><SequenceGrass time={props.time}/>{props.layers.anatomy&&<Tree time={props.time}/>}<SurfaceFire time={props.time} visible={props.layers.fire}/><SurfaceConnection time={props.time} visible={props.layers.fire}/><SequenceExcavator time={props.time}/><SourceAndCap time={props.time} mode={props.mode} frame={props.frame}/><Tracers time={props.time} mode={props.mode} layers={props.layers}/><WaterPaths time={props.time} showWater={props.layers.water}/></>}<gridHelper args={[14,14,'#344f43','#233a31']} position={[0,-3.23,0]}/><Camera resetToken={props.resetToken}/></Canvas>
}
