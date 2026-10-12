import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import * as THREE from 'three'
import { SOLID_COUNT, loadingBucketPose, solidLoadingPose } from './visuals'

type Point = [number, number, number]
function Rod({ from, to, radius = .025, color = '#738078' }: { from: Point; to: Point; radius?: number; color?: string }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a)
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
  return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 10]}/>
    <meshStandardMaterial color={color} metalness={.55} roughness={.45}/>
  </mesh>
}

/** Generic open loading prop, entirely separate from the liquid source.
 * All sizes/poses are authored artwork, not equipment construction data. */
export function LoadingAssembly({ time }: { time: number }) {
  const { position, tilt } = loadingBucketPose(time), [x, y] = position
  return <group userData={{ scientificRole: 'Authored open bucket handling and gravity-shaped solid motion; no pressure mechanism or dynamics prediction' }}>
    <RoundedBox position={[1.1, -.73, -.46]} args={[.31, .13, .32]} radius={.025} smoothness={2} castShadow>
      <meshStandardMaterial color="#465149" metalness={.4} roughness={.6}/>
    </RoundedBox>
    <Rod from={[1.1, -.73, -.46]} to={[1.1, 1.95, -.46]} radius={.055}/>
    <mesh position={[1.1, y + .34, -.46]}><boxGeometry args={[.16, .23, .17]}/><meshStandardMaterial color="#455b53" metalness={.5} roughness={.5}/></mesh>
    <Rod from={[1.1, y + .38, -.46]} to={[x, y + .38, 0]} radius={.035}/>
    <Rod from={[x, y + .38, -.3]} to={[x, y + .38, .3]} radius={.025}/>
    {[-.3, .3].map(z => <group key={z}>
      <Rod from={[x, y + .38, z]} to={[x, y, z]} radius={.018}/>
      <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.045, .045, .07, 14]}/><meshStandardMaterial color="#a2aca3" metalness={.7} roughness={.35}/></mesh>
    </group>)}
    <group position={position} rotation={[0, 0, tilt]}>
      <mesh position={[0, -.23, 0]} castShadow><boxGeometry args={[.55, .04, .5]}/><meshStandardMaterial color="#7f8d83" metalness={.5} roughness={.55}/></mesh>
      {[-.2675, .2675].map(side => <mesh key={side} position={[side, .015, 0]} castShadow><boxGeometry args={[.015, .45, .5]}/><meshStandardMaterial color="#8b988f" metalness={.55} roughness={.48}/></mesh>)}
      {[-.2425, .2425].map(z => <mesh key={z} position={[0, .015, z]} castShadow><boxGeometry args={[.52, .45, .015]}/><meshStandardMaterial color="#93a096" metalness={.5} roughness={.5}/></mesh>)}
      <Rod from={[-.275, .245, -.25]} to={[.275, .245, -.25]} radius={.012}/>
      <Rod from={[-.275, .245, .25]} to={[.275, .245, .25]} radius={.012}/>
    </group>
    {Array.from({ length: SOLID_COUNT }, (_, i) => {
      const solid = solidLoadingPose(time, i)
      return <RoundedBox key={i} position={solid.position} rotation={solid.rotation} scale={solid.scale}
        args={[1.8, 1.35, 1.5]} radius={.14} smoothness={2} castShadow>
        <meshStandardMaterial color={i % 2 ? '#d9ded9' : '#eef0e9'} roughness={.94} metalness={0}/>
      </RoundedBox>
    })}
  </group>
}

export function WaterContact({ time }: { time: number }) {
  const first = solidLoadingPose(time, 0), amount = Math.max(0, Math.min(1, (time - first.impactS) / 2))
  return <group userData={{ scientificRole: 'Authored impact ripples and bubbles only after solid contact; not a phase-change calculation' }}>
    {Array.from({ length: SOLID_COUNT }, (_, i) => {
      const solid = solidLoadingPose(time, i), age = (time - solid.impactS) / 1.25
      if (age < 0 || age > 1) return null
      return <mesh key={i} position={[solid.landing[0], .009, solid.landing[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={.1 + age * .8}>
        <ringGeometry args={[.3, .315, 40]}/><meshBasicMaterial color="#d8e8e5" transparent opacity={(1 - age) * .35} depthWrite={false} side={THREE.DoubleSide}/>
      </mesh>
    })}
    {Array.from({ length: 14 }, (_, i) => {
      const age = (((time - first.impactS) * .9 + i / 14) % 1 + 1) % 1
      const solid = solidLoadingPose(time, i % SOLID_COUNT)
      return <mesh key={'bubble-' + i} visible={time >= solid.impactS} position={[solid.landing[0] + .025 * Math.sin(age * 7 + i), -.36 * (1 - age), solid.landing[2]]} scale={.75 + age * .35}>
        <sphereGeometry args={[.018 + (i % 3) * .004, 8, 6]}/>
        <meshPhysicalMaterial color="#d6e5df" transparent opacity={amount * Math.sin(age * Math.PI) * .42} roughness={.18} metalness={0} depthWrite={false}/>
      </mesh>
    })}
  </group>
}
