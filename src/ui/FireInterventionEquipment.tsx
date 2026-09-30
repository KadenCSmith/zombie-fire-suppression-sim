import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei/core/Line.js'
import * as THREE from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G, STORY_CRACK_PATHS, CONSTRAINED_CRACK_PATHS, fireSequencePose, storyCapShape, constrainedCapShape, storyHosePoints, storyWettingProgress, constrainedWettingProgress, pointAlongStoryPath, eased, type FireSourceMode, type StoryPoint } from '../story/fireSequence'
import { storyRupture, storyRuptureOffset } from '../story/fireAppearance'

const UP = new THREE.Vector3(0,1,0)
function Rod({ a,b,radius,color }: {a:StoryPoint;b:StoryPoint;radius:number;color:string}) {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av)
  return <mesh position={av.add(bv).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(UP,delta.clone().normalize())}><cylinderGeometry args={[radius,radius,delta.length(),10]}/><meshStandardMaterial color={color} roughness={.4} metalness={.8}/></mesh>
}
/** Visible folding tool opens an explicitly authored chamber; this is not an excavation solver. */
export function Underreamer({time,constrained=false}:{time:number;constrained?:boolean}) {
  const pose=fireSequencePose(time,'gradual'),extension=constrained?eased(time,31,33)*(1-eased(time,33,34)):pose.cutterExtension,r=.13+((constrained?G.cavityRadiusM*.92:G.cavityRadiusM)-.13)*extension
  if(time<31||time>=34)return null
  return <group position={[G.sourceX,G.cavityCenterY,0]} rotation={[0,time*8,0]} userData={{scientificRole:'illustrative folding underream cutter'}}>{[0,Math.PI/2,Math.PI,Math.PI*1.5].map((angle,i)=><group key={i} rotation={[0,angle,0]}><Rod a={[.045,-.19,0]} b={[r,0,0]} radius={.032} color="#8d9390"/><Rod a={[.045,.18,0]} b={[r,0,0]} radius={.022} color="#b2b7b0"/><mesh position={[r,0,0]} rotation={[0,0,-.15]}><boxGeometry args={[.06,.18,.10]}/><meshStandardMaterial color="#ccaa56" metalness={.7} roughness={.45}/></mesh></group>)}</group>
}
export function Chamber({time,constrained=false}:{time:number;constrained?:boolean}) {
  const p=fireSequencePose(time,'gradual'),r=G.cavityRadiusM*(constrained?.92:1)*(constrained?eased(time,31,33):p.underream)
  if(!r)return null
  return <mesh position={[G.sourceX,G.cavityCenterY,0]} scale={[r,G.cavityHalfHeightM,r]}><sphereGeometry args={[1,40,24,Math.PI,Math.PI]}/><meshStandardMaterial color="#302416" roughness={1} side={THREE.BackSide}/></mesh>
}
function capGeometry(time:number,mode:FireSourceMode) {
  const shape=storyCapShape(time,mode),positions:number[]=[],normals:number[]=[],parts=10,rows=16,columns=7
  const gap=G.capGapHalfAngleRad*2,start=G.capGapCenterRad+G.capGapHalfAngleRad,sector=(Math.PI*2-gap)/parts
  const at=(q:number,theta:number)=>new THREE.Vector3(Math.sin(theta)*shape.radiusM*q,.38*(1-q)*(1-shape.deployment)-shape.riseM*(1-q*q)*shape.deployment+shape.inversionM*(1-q*q)**2,Math.cos(theta)*shape.radiusM*q)
  const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>{const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();for(const p of[a,b,c]){positions.push(...p.toArray());normals.push(...normal.toArray())}}
  for(let panel=0;panel<parts;panel++)for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
    const q=.04+i/rows*.96,qq=.04+(i+1)/rows*.96,a=start+panel*sector+.007+(sector-.014)*j/columns,b=start+panel*sector+.007+(sector-.014)*(j+1)/columns
    tri(at(q,a),at(qq,a),at(qq,b));tri(at(q,a),at(qq,b),at(q,b))
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return geometry
}
export function SegmentedDome({time,mode}:{time:number;mode:FireSourceMode}) {
  const p=fireSequencePose(time,mode),shape=storyCapShape(time,mode),geometry=useMemo(()=>capGeometry(time,mode),[time,mode])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  if(!p.capVisible)return null
  return <group position={[G.sourceX,shape.rimY,0]} userData={{scientificRole:'authored segmented shell deployment, inversion and wedge engagement'}}><mesh geometry={geometry} castShadow><meshStandardMaterial color="#9caeb0" metalness={.84} roughness={.29} side={THREE.DoubleSide}/></mesh>{Array.from({length:10},(_,i)=>{const a=G.capGapCenterRad+G.capGapHalfAngleRad+(Math.PI*2-G.capGapHalfAngleRad*2)*(i+.5)/10,r=shape.radiusM*.97;return <group key={i} position={[Math.sin(a)*r,0,Math.cos(a)*r]} rotation={[0,a,0]}><mesh><boxGeometry args={[.063,.034,.075+.065*shape.damage]}/><meshStandardMaterial color="#626d6b" metalness={.9} roughness={.4}/></mesh><mesh position={[0,.021,0]}><sphereGeometry args={[.018,8,6]}/><meshStandardMaterial color="#d0d2c4" metalness={.9} roughness={.3}/></mesh></group>})}</group>
}
/** A constrained concave panel flattens without turning into an inflated dome. */
export function ConstrainedCap({time,mode}:{time:number;mode:FireSourceMode}) {
  const p=fireSequencePose(time,mode),shape=constrainedCapShape(time,mode)
  const geometry=useMemo(()=>{
    const positions:number[]=[],normals:number[]=[],parts=10,rows=16,columns=7
    const gap=G.capGapHalfAngleRad*2,start=G.capGapCenterRad+G.capGapHalfAngleRad,sector=(Math.PI*2-gap)/parts
    const radius=G.capFoldedRadiusM+(shape.radiusM-G.capFoldedRadiusM)*p.capDeployment
    const at=(q:number,theta:number)=>new THREE.Vector3(Math.sin(theta)*radius*q,.38*(1-q)*(1-p.capDeployment)-shape.depthM*(1-q*q)*p.capDeployment,Math.cos(theta)*radius*q)
    const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>{const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();for(const point of[a,b,c]){positions.push(...point.toArray());normals.push(...normal.toArray())}}
    for(let panel=0;panel<parts;panel++)for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
      const q=.04+i/rows*.96,qq=.04+(i+1)/rows*.96,a=start+panel*sector+.007+(sector-.014)*j/columns,b=start+panel*sector+.007+(sector-.014)*(j+1)/columns
      tri(at(q,a),at(qq,a),at(qq,b));tri(at(q,a),at(qq,b),at(q,b))
    }
    const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return result
  },[shape.radiusM,shape.depthM,p.capDeployment])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  if(!p.capVisible)return null
  return <group position={[G.sourceX,p.capY,0]} userData={{scientificRole:'authored concave-to-flat panel with bounded projected-radius change; pressure and material strain not calculated'}}><mesh geometry={geometry} castShadow><meshStandardMaterial color="#899795" metalness={.72} roughness={.42} side={THREE.DoubleSide}/></mesh></group>
}
/** Original procedural woven canvas material; no stock pixels are used. */
function hoseTexture() {
  const width=256,height=128,data=new Uint8Array(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const warp=Math.sin(x*Math.PI/3),weft=Math.sin(y*Math.PI/3),braid=Math.sin((x+y)*Math.PI/6),n=Math.sin(x*29.31+y*71.17)*.5
    const v=Math.round(186+warp*13+weft*10+braid*7+n*8),i=(y*width+x)*4
    data[i]=v+15;data[i+1]=v+10;data[i+2]=v-7;data[i+3]=255
  }
  const tex=new THREE.DataTexture(data,width,height);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(16,2);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;return tex
}
export function FabricHose({time}:{time:number}) {
  const texture=useMemo(hoseTexture,[]),curve=useMemo(()=>new THREE.CatmullRomCurve3(storyHosePoints(time).map(p=>new THREE.Vector3(...p)),false,'centripetal'),[time])
  const geometry=useMemo(()=>{const g=new THREE.TubeGeometry(curve,180,G.hoseRadiusM,14,false),p=g.attributes.position;for(let i=0;i<p.count;i++){const section=Math.floor(i/15),center=curve.getPointAt(section/180);if(center.y>.035&&center.x<-.2)p.setY(i,center.y+(p.getY(i)-center.y)*.48)}g.computeVertexNormals();return g},[curve])
  useEffect(()=>()=>texture.dispose(),[texture]);useEffect(()=>()=>geometry.dispose(),[geometry])
  const seam=useMemo(()=>[1,-1].map(side=>curve.getPoints(140).map(p=>[p.x,p.y+.028,p.z+side*.033] as StoryPoint)),[curve])
  if(time<69)return null
  return <group userData={{scientificRole:'flexible woven fire hose, staged insertion through an open service sector'}}><mesh geometry={geometry} castShadow><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.007} roughness={.96}/></mesh>{seam.map((p,i)=><Line key={i} points={p} color="#8e8a71" lineWidth={.7}/>)}<mesh position={[-4.34,.155,-.78]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.06,.06,.18,20]}/><meshStandardMaterial color="#788780" metalness={.85} roughness={.3}/></mesh></group>
}
export function CrackAndWaterPaths({time,mode,showWater}:{time:number;mode:FireSourceMode;showWater:boolean}) {
  const pose=fireSequencePose(time,mode),r=storyRupture(time,mode),offset=(p:StoryPoint):StoryPoint=>{const d=storyRuptureOffset(...p,r.pulse,r.damage);return[p[0]+d[0],p[1]+d[1],p[2]+d[2]]}
  return <>{mode==='rapid'&&pose.crack>0&&STORY_CRACK_PATHS.map((points,i)=><Line key={i} points={points.map(offset)} color="#0b0806" lineWidth={.6+pose.crack*1.8} transparent opacity={pose.crack*.85}/>)}{showWater&&time>=72&&STORY_CRACK_PATHS.map((points,i)=>{const front=storyWettingProgress(time,i),wet=Array.from({length:24},(_,j)=>offset(pointAlongStoryPath(points,front*j/23)));return <Line key={i} points={wet} color="#536e70" lineWidth={1.8} transparent opacity={.5*eased(time,72+i*.65,74+i*.65)}/>})}{showWater&&<FabricHose time={time}/>}</>
}
export function ConstrainedCrackAndWaterPaths({time,mode,showWater}:{time:number;mode:FireSourceMode;showWater:boolean}) {
  const flatten=constrainedCapShape(time,mode).flatten
  return <>{mode==='rapid'&&flatten>0&&CONSTRAINED_CRACK_PATHS.map((points,i)=><Line key={`fracture-${i}`} points={points} color="#17100d" lineWidth={.65+flatten*.8} transparent opacity={flatten*.7}/>)}
    {mode==='rapid'&&showWater&&time>=72&&CONSTRAINED_CRACK_PATHS.map((points,i)=>{
      const progress=constrainedWettingProgress(time,i)
      if(progress<=0)return null
      const wet=Array.from({length:24},(_,j)=>pointAlongStoryPath(points,progress*j/23))
      return <Line key={`water-${i}`} points={wet} color="#5b7c7a" lineWidth={1.2} transparent opacity={.72}/>
    })}
    {showWater&&<FabricHose time={time}/>}
  </>
}
