import { useEffect, useLayoutEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import * as THREE from 'three'
import type { MethodSceneProps } from '../contract'
import { DELIVERY_ROUTE, MEDIA_MOUNT, TRUCK_PARKED, WORLD_STAGING, preparationVisuals } from './visuals'
import { IllustrativeQuench } from './quench'
import { Annotation } from './annotation'
import { LoadingAssembly, WaterContact } from './loading'

const TEAL = '#78bac2'
const SILVER = '#9aa9a1'

function Rim({ y, radius = .72 }: { y: number; radius?: number }) {
  return <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <torusGeometry args={[radius, .027, 10, 72]}/>
    <meshStandardMaterial color={SILVER} metalness={.72} roughness={.28}/>
  </mesh>
}

/** A deliberately open, non-dimensional cutaway: no closure, pressure gauge,
 * containment/trigger mechanism or construction specifications. */
function MediaCutaway({ time }: { time: number }) {
  const visual = preparationVisuals(time)
  return <group userData={{ scientificRole: 'Illustrative open solid/liquid cutaway; not a pressure vessel model or design' }}>
    <RoundedBox position={[0, -.81, 0]} args={[1.77, .12, 1.57]} radius={.06} smoothness={3}>
      <meshStandardMaterial color="#28342e" roughness={.52} metalness={.4}/>
    </RoundedBox>
    <mesh position={[0, -.64, 0]}><cylinderGeometry args={[.73, .66, .21, 64]}/>
      <meshStandardMaterial color="#53645b" metalness={.65} roughness={.3}/>
    </mesh>
    <mesh position={[0, .04, 0]}><cylinderGeometry args={[.72, .72, 1.23, 64, 1, true, Math.PI / 2, Math.PI]}/>
      <meshStandardMaterial color="#6a7b72" metalness={.66} roughness={.32} side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[0, .04, 0]} renderOrder={3}>
      <cylinderGeometry args={[.72, .72, 1.23, 64, 1, true, -Math.PI / 2, Math.PI]}/>
      <meshPhysicalMaterial color="#b2d2c8" transparent opacity={.1} roughness={.13} metalness={.22} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <Rim y={-.57}/><Rim y={.65}/>
    {[-1, 1].map(side => <mesh key={side} position={[side * .72, .04, 0]}>
      <cylinderGeometry args={[.018, .018, 1.23, 8]}/><meshStandardMaterial color="#b0bab2" metalness={.75} roughness={.24}/>
    </mesh>)}
    <mesh position={[0, -.275, 0]}><cylinderGeometry args={[.685, .68, .55, 64]}/>
      <meshPhysicalMaterial color="#357e88" transparent opacity={.65} roughness={.22} metalness={.12} depthWrite={false}/>
    </mesh>
    <mesh position={[0, visual.surfaceOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.685, 64]}/><meshPhysicalMaterial color={TEAL} transparent opacity={.83} metalness={.26} roughness={.17} side={THREE.DoubleSide}/>
    </mesh>
    <WaterContact time={time}/>
  </group>
}

function softParticleTexture() {
  const size = 32, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1)
    const index = (y * size + x) * 4
    data[index] = data[index + 1] = data[index + 2] = 255
    data[index + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 255)
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

function PhaseChange({ time }: { time: number }) {
  const texture = useMemo(softParticleTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  const amount = preparationVisuals(time).phaseChange
  return <group userData={{ scientificRole: 'Authored phase-change cue; no calculated pressure, cooling or gas transport' }}>
    {Array.from({ length: 26 }, (_, i) => {
      const age = (time * .15 + i / 26) % 1, angle = i * 2.39996
      const overflow = Math.max(0, (age - .35) / .65)
      const radius = age < .35 ? .15 + age * 1.5 : .675 + overflow * .65
      const height = age < .35 ? .04 + age * 1.8 : .67 - overflow * .72
      const width = .13 + age * .4
      return <sprite key={i} position={[Math.cos(angle) * radius, height, Math.sin(angle) * radius]}
        scale={[width, width, 1]}>
        <spriteMaterial map={texture} color="#d5ddd6" transparent opacity={amount * Math.sin(age * Math.PI) * .21} depthWrite={false}/>
      </sprite>
    })}
  </group>
}

function DeliveryPath({ time }: { time: number }) {
  const visual = preparationVisuals(time)
  const curve = useMemo(() => new THREE.CatmullRomCurve3(DELIVERY_ROUTE.map(p => new THREE.Vector3(...p)), false, 'centripetal'), [])
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 80, .053, 10, false), [curve])
  const water = useMemo(() => new THREE.TubeGeometry(curve, 80, .033, 10, false), [curve])
  useLayoutEffect(() => {
    geometry.setDrawRange(0, Math.floor(visual.hose * 80) * 10 * 6)
    water.setDrawRange(0, Math.floor(visual.delivery * 80) * 10 * 6)
  }, [geometry, water, visual.hose, visual.delivery])
  useEffect(() => () => { geometry.dispose(); water.dispose() }, [geometry, water])
  return <group userData={{ scientificRole: 'Illustrative prescribed delivery path; no infiltration, soil response or suppression' }}>
    <mesh geometry={geometry} castShadow><meshStandardMaterial color="#283a32" transparent opacity={.62} depthWrite={false} metalness={.08} roughness={.8}/></mesh>
    <mesh geometry={water}><meshStandardMaterial color="#649ba8" emissive="#4093a3" emissiveIntensity={.06 + visual.boost * .08} transparent opacity={.42 + visual.boost * .18}/></mesh>
    {Array.from({ length: 16 }, (_, i) => {
      const position = (visual.flowTravel + i / 16) % 1
      const point = curve.getPointAt(position)
      return <mesh key={i} position={point} visible={position <= visual.delivery && visual.delivery > 0}>
        <sphereGeometry args={[.018, 8, 6]}/><meshStandardMaterial color="#a5c9cc" emissive="#4c9da8" emissiveIntensity={.08} roughness={.25} transparent opacity={i % 2 ? visual.boost * .6 : .6}/>
      </mesh>
    })}
  </group>
}

function SupplyTruck({ time }: { time: number }) {
  const visual = preparationVisuals(time)
  return <group position={[TRUCK_PARKED[0] + visual.truckTravel, TRUCK_PARKED[1], TRUCK_PARKED[2]]}
    userData={{ scientificRole: 'Authored flatbed arrival with open demonstration payload; no vehicle or pressure-system dynamics' }}>
    <RoundedBox position={[.03, .5, 0]} args={[2.9, .18, 1.22]} radius={.055} smoothness={3} castShadow>
      <meshStandardMaterial color="#354139" metalness={.45} roughness={.6}/>
    </RoundedBox>
    <RoundedBox position={[.46, .73, 0]} args={[2.12, .12, 1.35]} radius={.025} smoothness={2} castShadow>
      <meshStandardMaterial color="#77897b" metalness={.55} roughness={.47}/>
    </RoundedBox>
    <RoundedBox position={[-1.01, 1.06, 0]} args={[.91, 1, 1.23]} radius={.1} smoothness={3} castShadow>
      <meshStandardMaterial color="#899a85" metalness={.28} roughness={.52}/>
    </RoundedBox>
    <mesh position={[-1.476, 1.25, 0]} rotation={[0, 0, -.12]}><boxGeometry args={[.022, .4, .99]}/><meshStandardMaterial color="#304e4d" metalness={.3} roughness={.18}/></mesh>
    {[-.628, .628].map(z => <group key={z}>
      <mesh position={[-.99, 1.28, z]}><boxGeometry args={[.62, .38, .018]}/><meshStandardMaterial color="#3e5d57" metalness={.3} roughness={.2}/></mesh>
      <mesh position={[-.92, .93, z * 1.015]}><boxGeometry args={[.15, .025, .025]}/><meshStandardMaterial color="#b3c0af" metalness={.8} roughness={.3}/></mesh>
      <mesh position={[-1.48, .8, z * .77]}><boxGeometry args={[.022, .12, .15]}/><meshStandardMaterial color="#dedbc2" emissive="#d9cc9c" emissiveIntensity={.17}/></mesh>
    </group>)}
    <mesh position={[-1.49, .6, 0]}><boxGeometry args={[.1, .12, 1.33]}/><meshStandardMaterial color="#8a9888" metalness={.7} roughness={.4}/></mesh>
    {[-.97, 1.02].flatMap(x => [-.67, .67].map(z => <group key={x + ':' + z} position={[x, .32, z]} rotation={[Math.PI / 2, 0, 0]}>
      <group rotation={[0, visual.truckTravel / .3, 0]}>
        <mesh castShadow><cylinderGeometry args={[.3, .3, .2, 28]}/><meshStandardMaterial color="#151c17" roughness={.92}/></mesh>
        <mesh><cylinderGeometry args={[.15, .15, .215, 18]}/><meshStandardMaterial color="#a3afa0" metalness={.8} roughness={.35}/></mesh>
        {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.cos(i * Math.PI * .4) * .095, z > 0 ? -.112 : .112, Math.sin(i * Math.PI * .4) * .095]}>
          <sphereGeometry args={[.02, 6, 4]}/><meshStandardMaterial color="#46554a" metalness={.7} roughness={.4}/>
        </mesh>)}
      </group>
    </group>))}
    <group position={[...MEDIA_MOUNT]}>
      <MediaCutaway time={time}/>
      <LoadingAssembly time={time}/>
      <PhaseChange time={time}/>
    </group>
  </group>
}

function ContactSteam({ time }: { time: number }) {
  const texture = useMemo(softParticleTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  const visual = preparationVisuals(time)
  return <group userData={{ scientificRole: 'Authored contact steam accompanying illustrative quenching; no calculated evaporation or extinction' }}>
    {Array.from({ length: 26 }, (_, i) => {
      const age = (time * .13 + i / 26) % 1
      const radius = visual.quench * 2.35 * ((i % 7) / 6)
      const angle = i * 2.39996
      const width = .22 + age * .42
      return <sprite key={i} position={[.4 + Math.cos(angle) * radius, -1.3 + Math.sin(angle) * radius * .35 + age * .55, .17 + age * .08]} scale={[width, width, 1]}>
        <spriteMaterial map={texture} color="#cad4ce" transparent opacity={visual.steam * Math.sin(age * Math.PI) * .29} depthWrite={false}/>
      </sprite>
    })}
  </group>
}

/** Mounted in the shared world by the external coordinator adapter. Original
 * fire, grass, excavator, lighting, camera and depth buffer are reused unchanged. */
export function MethodCues({ time }: MethodSceneProps) {
  const visual = preparationVisuals(time)
  if (visual.time < WORLD_STAGING.arrive) return null
  return <group userData={{ scientificRole: '4.2.1 world-space authored truck, dry-ice loading and faster liquid cues; no predicted pressure or suppression' }}>
    <SupplyTruck time={visual.time}/>
    <DeliveryPath time={visual.time}/>
    <ContactSteam time={visual.time}/>
    <IllustrativeQuench progress={visual.quench}/>
    {visual.time >= WORLD_STAGING.iceStart && visual.time < 75 && <Annotation position={[TRUCK_PARKED[0] + MEDIA_MOUNT[0], 3, TRUCK_PARKED[2]]}>
      {visual.boost > 0 ? 'Faster flow · illustrative' : 'Dry ice added to water'}
    </Annotation>}
    {visual.time >= 75 && <Annotation position={[.4, -.7, .3]}>Illustrative quenching</Annotation>}
  </group>
}
