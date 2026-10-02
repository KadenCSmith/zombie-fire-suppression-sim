import { Line } from '@react-three/drei/core/Line.js'
import { currentEquipmentState, WATER_TRUCK } from '../story/firePresentation'
import type { StoryPoint } from '../story/fireSequence'

/** Procedural equipment in the existing scene's material style. All motion is clock-derived. */
export function FireWaterTruck({ time }: { time: number }) {
  const state = currentEquipmentState(time)
  if (!state.truckVisible) return null
  const wheels = [-.91, .92].flatMap(x => [-.57, .57].map(z => [x, WATER_TRUCK.wheelRadiusM, z] as StoryPoint))
  const coil: StoryPoint[] = Array.from({ length: 121 }, (_, i) => {
    const q = i / 120, angle = q * Math.PI * 12 - state.hoseProgress * Math.PI * 12
    const radius = .17 + .13 * q * (1 - state.hoseProgress)
    return [-1.27 + Math.cos(angle) * radius, .63 + Math.sin(angle) * radius, .58]
  })
  return <group position={state.truckPosition} userData={{ scientificRole: 'authored water supply truck and hose reel; no vehicle or pump dynamics' }}>
    <mesh position={[0, .39, 0]} castShadow><boxGeometry args={[2.7, .2, 1.04]}/><meshStandardMaterial color="#343c38" metalness={.55} roughness={.7}/></mesh>
    {wheels.map((p, i) => <group key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
      <group rotation={[0, state.truckTravel / WATER_TRUCK.wheelRadiusM, 0]}>
        <mesh castShadow><cylinderGeometry args={[.29, .29, .18, 20]}/><meshStandardMaterial color="#19201c" roughness={.95}/></mesh>
        <mesh><cylinderGeometry args={[.14, .14, .195, 12]}/><meshStandardMaterial color="#a7ada2" roughness={.4} metalness={.8}/></mesh>
        {[0, 1, 2, 3, 4].map(n => <mesh key={n} position={[Math.cos(n * Math.PI * .4) * .09, p[2] > 0 ? -.102 : .102, Math.sin(n * Math.PI * .4) * .09]}><sphereGeometry args={[.018, 6, 4]}/><meshStandardMaterial color="#4f5b52" metalness={.8}/></mesh>)}
      </group>
    </group>)}
    <group position={[-.43, 1.01, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[.47, .47, 1.68, 32]}/><meshStandardMaterial color="#c7d1c2" metalness={.42} roughness={.54}/></mesh>
      {[-.63, .63].map(y => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[.481, .481, .04, 32]}/><meshStandardMaterial color="#667c70" roughness={.6} metalness={.65}/></mesh>)}
    </group>
    <mesh position={[-.48, 1.5, 0]}><cylinderGeometry args={[.15, .15, .05, 16]}/><meshStandardMaterial color="#738779" metalness={.65} roughness={.45}/></mesh>
    <mesh position={[.94, .91, 0]} castShadow><boxGeometry args={[1.03, .91, 1.04]}/><meshStandardMaterial color="#9baa96" metalness={.28} roughness={.6}/></mesh>
    <mesh position={[1.465, 1.11, 0]}><boxGeometry args={[.02, .38, .86]}/><meshStandardMaterial color="#496561" roughness={.25} metalness={.3}/></mesh>
    {[-.525, .525].map(z => <group key={z}>
      <mesh position={[1.02, 1.13, z]}><boxGeometry args={[.59, .38, .012]}/><meshStandardMaterial color="#55726a" roughness={.22} metalness={.3}/></mesh>
      <mesh position={[.95, .77, z * 1.02]}><boxGeometry args={[.12, .026, .025]}/><meshStandardMaterial color="#cad2c6" metalness={.8}/></mesh>
      <mesh position={[1.48, .63, z * .76]}><boxGeometry args={[.026, .10, .13]}/><meshStandardMaterial color="#ece6c5" emissive="#cbbb72" emissiveIntensity={.25}/></mesh>
    </group>)}
    <mesh position={[1.49, .45, 0]}><boxGeometry args={[.09, .12, 1.12]}/><meshStandardMaterial color="#748175" metalness={.7} roughness={.5}/></mesh>
    <mesh position={[1.478, .72, 0]}><boxGeometry args={[.025, .20, .46]}/><meshStandardMaterial color="#2c3a33" roughness={.8}/></mesh>
    <mesh position={[-1.27, .63, .55]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.32, .32, .055, 28]}/><meshStandardMaterial color="#637b6b" metalness={.65} roughness={.5}/></mesh>
    <Line points={coil} color="#c7bea4" lineWidth={3}/>
    <mesh position={WATER_TRUCK.outletLocal} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.07, .07, .15, 16]}/><meshStandardMaterial color="#a0aaa0" metalness={.8} roughness={.3}/></mesh>
    <mesh position={[-1.20, .76, .59]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.085, .012, 6, 16]}/><meshStandardMaterial color="#986b49" roughness={.6} metalness={.55}/></mesh>
  </group>
}
