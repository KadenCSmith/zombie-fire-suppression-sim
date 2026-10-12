import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { Line } from '@react-three/drei/core/Line.js'
import type { OrbitControls as Controls } from 'three-stdlib'
import { Vector3 } from 'three'
import { AlternativeMethodCues } from './AlternativeMethodModules'
import { methodPresentation } from '../alternatives/presentation'
import type { VariantId } from '../alternatives/registry'

function AlternativeCamera({resetToken,distance}:{resetToken:number;distance:number}) {
  const controls=useRef<Controls>(null),{camera,invalidate}=useThree()
  useEffect(()=>{
    const target=new Vector3(0,-.7,0)
    camera.position.set(5,3,8).sub(target).setLength(distance).add(target)
    controls.current?.target.copy(target);controls.current?.update();invalidate()
  },[camera,distance,resetToken,invalidate])
  return <OrbitControls ref={controls} target={[0,-.7,0]} minDistance={5} maxDistance={19} enableZoom={false} enableDamping={false}/>
}

/** New concept host, authored independently of the protected original render.
 * Geometry and motion here are illustrative; they never enter solver state. */
export function AlternativeScene({id,time,resetToken,cameraDistance}:{id:VariantId;time:number;resetToken:number;cameraDistance:number}) {
  const pose=methodPresentation(id,time)
  return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[5,3,8],fov:38,near:.05,far:60}}>
    <color attach="background" args={['#000000']}/><ambientLight intensity={1.3}/><directionalLight position={[-3,6,5]} intensity={2}/>
    {[{y:-.3,h:.6,c:'#463d2e'},{y:-1,h:.8,c:'#372c22'},{y:-1.9,h:1,c:'#25251e'}].map((layer,i)=><mesh key={i} position={[0,layer.y,-.55]}><boxGeometry args={[6,layer.h,1.2]}/><meshStandardMaterial color={layer.c} roughness={1}/></mesh>)}
    {[-1.8,-.6,.6,1.8].map((x,i)=><Line key={i} points={[[x,.03,.08],[x*.8,-.45,.08],[x*.5,-1.1,.08]]} color="#6a5540" lineWidth={2}/>)}
    <mesh position={[-1.4,.7,-.5]}><cylinderGeometry args={[.09,.13,1.4,12]}/><meshStandardMaterial color="#514437"/></mesh>
    <mesh position={[-1.4,1.65,-.5]}><icosahedronGeometry args={[.75,1]}/><meshStandardMaterial color="#3d5432" roughness={1}/></mesh>
    {pose.access&&<group position={[pose.vibration,0,0]}>
      <mesh position={[.4,.55,-.2]}><boxGeometry args={[.65,.35,.5]}/><meshStandardMaterial color="#9d853e"/></mesh>
      <Line points={[[.4,.5,.08],[.4,-Math.min(1.8,Math.max(0,time-18)/8),.08]]} color="#a9aaa1" lineWidth={4}/>
    </group>}
    <AlternativeMethodCues id={id} time={time}/>
    <AlternativeCamera resetToken={resetToken} distance={cameraDistance}/>
  </Canvas>
}
