import {useEffect,useMemo,useRef} from 'react'
import {Canvas,useFrame,useThree} from '@react-three/fiber'
import {OrbitControls} from '@react-three/drei/core/OrbitControls.js'
import {Line} from '@react-three/drei/core/Line.js'
import * as THREE from 'three'
import type {CoupledFrame,Fidelity} from '../coupled/model'
import {PRESETS} from '../coupled/model'
import {oakStructure} from './OakTree'
export type CoupledField='temperatureK'|'pressurePa'|'oxygen'|'co2'|'iceKg'|'damage'|'porosity'
export const COUPLED_FIELDS:Record<CoupledField,{label:string;unit:string;range:[number,number]}>={temperatureK:{label:'Temperature',unit:'K',range:[190,600]},pressurePa:{label:'Pore pressure',unit:'Pa absolute',range:[100000,103000]},oxygen:{label:'Oxygen',unit:'mol/mol',range:[0,0.21]},co2:{label:'CO₂',unit:'mol/mol',range:[0,0.1]},iceKg:{label:'Frozen water',unit:'kg/cell',range:[0,10]},damage:{label:'Diffuse fracture',unit:'1',range:[0,1]},porosity:{label:'Pore fraction',unit:'m³/m³',range:[0.35,0.95]}}
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],TRI=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]
function FieldMesh({frame,fidelity,field,cut,amplification,onProbe}:{frame?:CoupledFrame;fidelity:Fidelity;field:CoupledField;cut:boolean;amplification:number;onProbe:(i:number)=>void}){
 const {nx,ny,nz}=PRESETS[fidelity]
 const {geometry,ids}=useMemo(()=>{
  const positions:number[]=[],colors:number[]=[],ids:number[]=[],range=COUPLED_FIELDS[field].range,color=new THREE.Color()
  for(let z=0;z<nz;z++)for(let y=0;y<(cut?ny/2:ny);y++)for(let x=0;x<nx;x++){
   const id=(z*ny+y)*nx+x;ids.push(id);const value=frame?.[field][id]??range[0],fraction=Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0])))
   if(!frame)color.set(z>=nz/2?'#685344':'#6d7359');else color.setHSL(0.56-0.5*fraction,0.35+0.3*fraction,0.28+0.3*fraction)
   for(const corner of TRI){const[a,b,c]=CORNERS[corner],q=(((z+c)*(ny+1)+y+b)*(nx+1)+x+a)*3,u=frame?.displacementM
    positions.push((x+a)*8/nx-4+(u?.[q]??0)*amplification,-(z+c)*3.2/nz-(u?.[q+2]??0)*amplification,(y+b)*8/ny-4+(u?.[q+1]??0)*amplification);colors.push(color.r,color.g,color.b)}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return{geometry,ids}
 },[frame,nx,ny,nz,field,cut,amplification])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <mesh geometry={geometry} onClick={e=>{e.stopPropagation();onProbe(ids[Math.floor((e.faceIndex??0)/12)])}}><meshStandardMaterial vertexColors roughness={0.95} side={THREE.DoubleSide}/></mesh>
}
function Context({frame,capEnabled,capRadius,capRise}:{frame?:CoupledFrame;capEnabled:boolean;capRadius:number;capRise:number}){
 const oak=useMemo(()=>oakStructure(true),[])
 const capGeometry=useMemo(()=>new THREE.LatheGeometry(Array.from({length:33},(_,i)=>{const x=i/32,shape=(1-x*x)**2;return new THREE.Vector2(capRadius*x,capRise*(1-x*x)+(frame?.cap?.centerUpM??0)-(frame?.cap?.flexM??0)+(frame?.cap?.flexM??0)*shape)}),48),[capRadius,capRise,frame])
 useEffect(()=>()=>capGeometry.dispose(),[capGeometry])
 const geometries=useMemo(()=>[...oak.wood,...oak.roots].map(limb=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(limb.points.map(p=>new THREE.Vector3(...p))),12,limb.radius,5,false)),[oak])
 useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries])
 return <>
  <group position={[-3.24,0,0.09]}>{geometries.map((g,i)=><mesh key={i} geometry={g}><meshStandardMaterial color={i<oak.wood.length?'#4c3d2a':'#a28358'} roughness={1}/></mesh>)}{oak.tips.filter((_,i)=>i%4===0).map((p,i)=><mesh key={i} position={p}><sphereGeometry args={[0.34,7,5]}/><meshStandardMaterial color="#536342" roughness={1}/></mesh>)}</group>
  <Line points={[[0.4,0.1,0],[0.4,-1.3,0]]} color="#bec7ba" dashed dashSize={0.06} gapSize={0.06}/>
  <mesh position={[0.4,-1.3,0]}><sphereGeometry args={[Math.cbrt(3*(frame?.dryIceKg??4)/(4*Math.PI*1560)),16,12]}/><meshStandardMaterial color="#c4e6e8" roughness={0.8}/></mesh>
  {capEnabled&&<mesh position={[0.4,0.005,0]} geometry={capGeometry}><meshStandardMaterial color="#8c9999" metalness={0.7} roughness={0.4} side={THREE.DoubleSide}/></mesh>}
 </>
}
function Metrics(){const {gl}=useThree(),stats=useRef({last:performance.now(),frames:0});useFrame(()=>{stats.current.frames++;const now=performance.now();if(now-stats.current.last>=1000){gl.domElement.dataset.fps=String(stats.current.frames*1000/(now-stats.current.last));stats.current={last:now,frames:0}}});return null}
export function CoupledScene(props:{capEnabled:boolean;capRadius:number;capRise:number;frame?:CoupledFrame;fidelity:Fidelity;field:CoupledField;cut:boolean;amplification:number;context:boolean;onProbe:(i:number)=>void}){
 return <Canvas dpr={[1,1.5]} camera={{position:[8,6,10],fov:45,near:0.05,far:100}}><color attach="background" args={['#172222']}/><ambientLight intensity={1.5}/><directionalLight position={[4,10,8]} intensity={2}/><FieldMesh {...props}/>{props.context&&<Context frame={props.frame} capEnabled={props.capEnabled} capRadius={props.capRadius} capRise={props.capRise}/>}<OrbitControls makeDefault target={[0,-0.5,0]}/><gridHelper args={[16,16,'#536154','#293c34']} position={[0,-3.23,0]}/><Metrics/></Canvas>
}
