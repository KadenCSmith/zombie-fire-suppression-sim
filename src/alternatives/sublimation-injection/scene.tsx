import { useEffect, useLayoutEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import * as THREE from 'three'
import type { MethodSceneProps } from '../contract'
import { DELIVERY_ROUTE, MEDIA_MOUNT, MEDIA_SCALE, TREATMENT_PARKED, WORLD_STAGING, preparationVisuals } from './visuals'
import { IllustrativeQuench } from './quench'
import { Annotation } from './annotation'
import { LoadingAssembly, WaterContact } from './loading'
import { WaterSupply } from './supply'

const TEAL = '#78bac2'
const SILVER = '#9aa9a1'

function Rim({ y, radius = .72 }: { y: number; radius?: number }) {
  return <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <torusGeometry args={[radius, .027, 10, 72]}/>
    <meshStandardMaterial color={SILVER} metalness={.72} roughness={.28}/>
  </mesh>
}

/** Non-dimensional cutaway with an authored closing cover. No pressure law,
 * containment/trigger design or equipment construction specifications. */
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
    <group position={[0, .68, -.72]} rotation={[-1.45 * (1 - visual.lid), 0, 0]}>
      <mesh position={[0, 0, .72]} castShadow><cylinderGeometry args={[.75, .75, .055, 64]}/>
        <meshStandardMaterial color="#85938a" metalness={.5} roughness={.5}/>
      </mesh>
    </group>
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
  const visual = preparationVisuals(time)
  const amount = visual.phaseChange * (1 - visual.lid)
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
    <WaterSupply time={visual.time}>
      <MediaCutaway time={visual.time}/>
      <LoadingAssembly time={visual.time}/>
      <PhaseChange time={visual.time}/>
    </WaterSupply>
    <DeliveryPath time={visual.time}/>
    <ContactSteam time={visual.time}/>
    <IllustrativeQuench progress={visual.quench}/>
    {visual.time >= WORLD_STAGING.iceStart && visual.time < 75 && <Annotation position={[TREATMENT_PARKED[0] + MEDIA_MOUNT[0], MEDIA_MOUNT[1] + 2.1 * MEDIA_SCALE, TREATMENT_PARKED[2]]}>
      {visual.boost > 0 ? 'Faster flow · illustrative' : visual.lid === 1 ? 'Capped preparation · illustrative' : visual.lid > 0 ? 'Closing lid · illustrative' : 'Dry ice added to water'}
    </Annotation>}
    {visual.time >= 75 && <Annotation position={[.4, -.7, .3]}>Illustrative quenching</Annotation>}
  </group>
}
