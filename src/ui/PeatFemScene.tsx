import { useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import * as THREE from 'three'
import { sample, type Mesh, type Frame } from '../peatfem/model'
export type PeatField='temperature'|'oxygen'|'fuel'|'char'
export const FIELD_INFO:Record<PeatField,{label:string;unit:string}>={temperature:{label:'Temperature',unit:'K'},oxygen:{label:'Oxygen',unit:'kg O₂/m³ gas'},fuel:{label:'Remaining dry peat',unit:'kg/m³ bulk'},char:{label:'Passive β-char',unit:'kg/m³ bulk'}}
function geometry(mesh:Mesh){
  const surface:number[]=[],edges:number[]=[],nodes:number[]=[],half=Math.max(1,Math.ceil(mesh.n/2))
  const faces=[[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]],edgePairs=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]]
  const position=(node:number)=>[mesh.coordinates[3*node],mesh.coordinates[3*node+2],mesh.coordinates[3*node+1]]
  const seen=new Set<number>()
  for(let k=0;k<mesh.n;k++)for(let j=0;j<half;j++)for(let i=0;i<mesh.n;i++){
    const e=i+mesh.n*(j+mesh.n*k),c=mesh.connectivity.subarray(8*e,8*e+8)
    const visible=[i===0,i===mesh.n-1,j===0,j===half-1,k===0,k===mesh.n-1]
    faces.forEach((face,f)=>{if(visible[f])for(const a of [face[0],face[1],face[2],face[0],face[2],face[3]])surface.push(...position(c[a]))})
    edgePairs.forEach(([a,b])=>edges.push(...position(c[a]),...position(c[b])))
    c.forEach(v=>{if(!seen.has(v)){seen.add(v);nodes.push(...position(v))}})
  }
  const make=(array:number[])=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(array,3))
  return {surface:make(surface),edges:make(edges),nodes:make(nodes)}
}
function Field({mesh,frame,field,wireframe,nodes,range,onProbe}:{mesh:Mesh;frame:Frame;field:PeatField;wireframe:boolean;nodes:boolean;overlay:boolean;range:[number,number];onProbe:(p:[number,number,number])=>void}){
  const geo=useMemo(()=>geometry(mesh),[mesh]),texture=useMemo(()=>{
    const tex=new THREE.Data3DTexture(new Float32Array(frame[field]),mesh.n+1,mesh.n+1,mesh.n+1)
    tex.format=THREE.RedFormat;tex.type=THREE.FloatType;tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.unpackAlignment=1;tex.needsUpdate=true;return tex
  },[mesh,frame,field])
  useEffect(()=>()=>texture.dispose(),[texture]);useEffect(()=>()=>Object.values(geo).forEach(g=>g.dispose()),[geo])
  const uniforms={uField:{value:texture},uN:{value:mesh.n},uL:{value:mesh.lengthM},uRange:{value:new THREE.Vector2(...range)}}
  return <>
    <mesh geometry={geo.surface} onPointerDown={event=>{event.stopPropagation();const p=event.point;onProbe([Math.max(0,Math.min(mesh.lengthM,p.x)),Math.max(0,Math.min(mesh.lengthM,p.z)),Math.max(0,Math.min(mesh.lengthM,p.y))])}}>
      <rawShaderMaterial glslVersion={THREE.GLSL3} side={THREE.DoubleSide} uniforms={uniforms}
        vertexShader={'precision highp float; in vec3 position; uniform mat4 projectionMatrix,modelViewMatrix; out vec3 physical; void main(){physical=position.xzy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'}
        fragmentShader={`precision highp float; precision highp sampler3D; uniform sampler3D uField; uniform int uN; uniform float uL; uniform vec2 uRange; in vec3 physical; out vec4 outColor;
          void main(){vec3 q=clamp(physical/uL*float(uN),vec3(0),vec3(float(uN)));ivec3 cell=min(ivec3(floor(q)),ivec3(uN-1));vec3 f=q-vec3(cell);float value=0.0;
          for(int a=0;a<8;a++){ivec3 b=ivec3(a&1,(a>>1)&1,(a>>2)&1);vec3 w=mix(vec3(1)-f,f,vec3(b));value+=texelFetch(uField,cell+b,0).r*w.x*w.y*w.z;}
          float t=clamp((value-uRange.x)/(uRange.y-uRange.x),0.0,1.0);vec3 color=t<.5?mix(vec3(.07,.17,.42),vec3(.12,.7,.6),t*2.0):mix(vec3(.12,.7,.6),vec3(1,.75,.18),(t-.5)*2.0);outColor=vec4(color,1.0);}`}/>
    </mesh>
    {wireframe&&<lineSegments geometry={geo.edges}><lineBasicMaterial color="#b9ced1" transparent opacity={.32}/></lineSegments>}
    {nodes&&<points geometry={geo.nodes}><pointsMaterial size={.001} color="#fff" sizeAttenuation/></points>}
  </>
}
export function PeatFemScene(props:Parameters<typeof Field>[0]){
  const L=props.mesh.lengthM
  return <><Canvas key={props.mesh.n} frameloop="always" dpr={[1,1.5]} camera={{position:[L*1.85,L*1.6,L*2.2],fov:42,near:L/100,far:L*30}} gl={{antialias:true}}>
    <color attach="background" args={['#020606']}/><Field {...props}/><OrbitControls makeDefault target={[L/2,L/2,L/4]} minDistance={L*.6} maxDistance={L*5} enableDamping={false}/>
    <axesHelper args={[L*.15]}/>
  </Canvas>{props.overlay&&<div className="fem-temperature-grid" aria-label="Front-face temperature sample table"><small>Front face · x → / z ↑ · K</small>{Array.from({length:25},(_,i)=>{const x=(i%5)*L/4,z=(4-Math.floor(i/5))*L/4;return <span key={i} className="fem-grid-value" title={`FE sample (${x},0,${z}) m at ${props.frame.timeS} s`}>{sample(props.mesh,props.frame.temperature,x,0,z).toFixed(0)} K</span>})}</div>}</>
}
