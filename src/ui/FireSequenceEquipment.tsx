import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G, eased, fireSequencePose, illustratedPeatCoverage } from '../story/fireSequence'
type Point = [number, number, number]
const random=(n:number)=>{const v=Math.sin(n*91.713+17.157)*43758.5453;return v-Math.floor(v)}
function Beam({from,to,radius=.1,color='#d6a53c',metalness=.3}:{from:Point;to:Point;radius?:number;color?:string;metalness?:number}){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),direction=b.clone().sub(a)
  return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize())}><cylinderGeometry args={[radius,radius,direction.length(),8]}/><meshStandardMaterial color={color} roughness={.43} metalness={metalness}/></mesh>
}
/** Articulated presentation geometry; no excavator dynamics or contact solver. */
export function SequenceExcavator({time}:{time:number}){
  const pose=fireSequencePose(time,'gradual'),visible=time>=24&&time<40&&illustratedPeatCoverage(time)>=.7
  const offset=-6*(1-eased(time,24,27))-6*eased(time,36.5,40),bodyX=-2.45
  const a:Point=[bodyX+.35,1.04,-.76],b:Point=[-1.15,2.95,-.34],c:Point=[G.sourceX,pose.drillY+2.3,-.02]
  const helix=useMemo(()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:161},(_,i)=>{const t=i/160,angle=t*Math.PI*11;return new THREE.Vector3(Math.cos(angle)*G.augerRadiusM,t*1.9+.15,Math.sin(angle)*G.augerRadiusM)})),160,.047,6,false),[])
  useEffect(()=>()=>helix.dispose(),[helix])
  return <group visible={visible} position={[offset,0,0]} userData={{scientificRole:'prescribed excavator and drilling animation'}}>
    <group position={[bodyX,0,-.9]}>
      {[-.55,.55].map((z,index)=><group key={index} position={[0,.2,z]}><mesh><boxGeometry args={[1.85,.34,.32]}/><meshStandardMaterial color="#232b28" roughness={.9}/></mesh>{[-.74,-.38,0,.38,.74].map((x,i)=><mesh key={i} position={[x,0,index===0?-.035:.035]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.16,.16,.37,14]}/><meshStandardMaterial color="#4a5042" roughness={.76} metalness={.4}/></mesh>)}{Array.from({length:13},(_,i)=><mesh key={i} position={[-.87+i*.145,.184,0]}><boxGeometry args={[.05,.035,.39]}/><meshStandardMaterial color="#4a5046" roughness={.85}/></mesh>)}</group>)}
      <mesh position={[0,.46,0]}><boxGeometry args={[1.68,.25,1.22]}/><meshStandardMaterial color="#b98727" roughness={.6} metalness={.32}/></mesh>
      <mesh position={[.35,.8,0]}><boxGeometry args={[.93,.49,1.08]}/><meshStandardMaterial color="#d7a337" roughness={.52} metalness={.3}/></mesh>
      <mesh position={[-.47,1.04,-.08]}><boxGeometry args={[.74,.9,.89]}/><meshStandardMaterial color="#22433e" roughness={.22} metalness={.48}/></mesh>
      <mesh position={[-.47,1.53,-.08]}><boxGeometry args={[.89,.11,1.02]}/><meshStandardMaterial color="#e0b750" roughness={.48} metalness={.3}/></mesh>
      {[-.81,-.12].map((x,i)=><mesh key={i} position={[x,1.07,.385]}><boxGeometry args={[.045,.84,.06]}/><meshStandardMaterial color="#e3b547" roughness={.48} metalness={.3}/></mesh>)}
      <mesh position={[-.46,.76,.39]}><boxGeometry args={[.71,.07,.06]}/><meshStandardMaterial color="#d5a23d"/></mesh>
      {Array.from({length:5},(_,i)=><mesh key={i} position={[.1+i*.105,.86,.548]}><boxGeometry args={[.035,.2,.012]}/><meshStandardMaterial color="#374035"/></mesh>)}
      <mesh position={[.8,.69,.32]}><boxGeometry args={[.03,.12,.2]}/><meshBasicMaterial color="#f2deb5"/></mesh>
    </group>
    <Beam from={a} to={b} radius={.14}/><Beam from={b} to={c} radius={.105}/>
    <Beam from={[a[0]-.1,a[1]+.07,a[2]+.17]} to={[b[0]-.15,b[1]-.5,b[2]+.17]} radius={.045} color="#bac3bd" metalness={.9}/>
    <Beam from={[b[0]-.1,b[1]-.13,b[2]+.18]} to={[c[0]-.2,c[1]+.25,c[2]+.18]} radius={.04} color="#bdc8c2" metalness={.9}/>
    {[a,b,c].map((point,i)=><mesh key={i} position={point} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.18,.18,.31,12]}/><meshStandardMaterial color="#e2b64a" metalness={.4} roughness={.4}/></mesh>)}
    <group position={[G.sourceX,pose.drillY,-.02]} rotation={[0,pose.drillVisible?time*5:0,0]}>
      <mesh position={[0,1.17,0]}><cylinderGeometry args={[.09,.1,2.2,14]}/><meshStandardMaterial color="#899b9c" metalness={.85} roughness={.28}/></mesh>
      <mesh geometry={helix}><meshStandardMaterial color="#73898c" metalness={.85} roughness={.3}/></mesh>
      <mesh position={[0,.06,0]} rotation={[0,0,Math.PI]}><coneGeometry args={[.32,.28,12]}/><meshStandardMaterial color="#adbcbb" metalness={.8} roughness={.3}/></mesh>
      <mesh position={[0,2.2,0]}><cylinderGeometry args={[.21,.21,.3,16]}/><meshStandardMaterial color="#d8ae42" metalness={.45} roughness={.4}/></mesh>
    </group>
  </group>
}

export function SequenceGrass({time}:{time:number}){
  const ref=useRef<THREE.InstancedMesh>(null),invalidate=useThree(state=>state.invalidate),excavated=fireSequencePose(time,'gradual').drillDepth>0
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.032,0,0,.032,0,0,-.021,.42,.02,.021,.42,.02,-.012,.75,.06,.012,.75,.06,0,1,.14],3));g.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);g.computeVertexNormals();return g},[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;const object=new THREE.Object3D()
    for(let i=0;i<1560;i++){
      const clump=Math.floor(i/6),angle=random(i+400)*Math.PI*2,x=-3.88+random(clump+900)*7.76+(random(i+2)-.5)*.1,z=-3.86+random(clump+1700)*3.8+(random(i+3)-.5)*.1
      const removed=excavated&&Math.abs(x-G.sourceX)<G.boreRadiusM&&z>-.42
      object.position.set(x,.012,z);object.rotation.set((random(i+4)-.5)*.3,angle,(random(i+5)-.5)*.24);object.scale.set(removed?0:.7+random(i+7)*.5,removed?0:.09+random(i+8)*.19,1);object.updateMatrix();mesh.setMatrixAt(i,object.matrix)
      mesh.setColorAt(i,new THREE.Color().setHSL(.20+random(i+9)*.06,.28+random(i+10)*.18,.18+random(i+11)*.14))
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();invalidate()
  },[excavated,invalidate])
  return <instancedMesh ref={ref} args={[geometry,undefined,1560]} raycast={()=>null} userData={{scientificRole:'seeded grass appearance only'}}><meshStandardMaterial roughness={.93} side={THREE.DoubleSide}/></instancedMesh>
}
