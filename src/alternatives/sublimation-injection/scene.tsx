import { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei/web/Html.js'
import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import * as THREE from 'three'
import type { MethodSceneProps } from '../contract'
import { preparationVisuals } from './visuals'

const TEAL = '#78bac2'
const SILVER = '#9aa9a1'
const labelStyle = {
  display: 'block', width: 124, textAlign: 'center', color: '#c0cec6',
  fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11,
  fontWeight: 400, letterSpacing: '.035em', lineHeight: 1.5,
  textShadow: '0 1px 8px #000, 0 1px 2px #000', pointerEvents: 'none',
} as const

function Annotation({ position, children }: { position: [number, number, number]; children: string }) {
  return <Html center position={position} zIndexRange={[4, 0]}><span style={labelStyle}>{children}</span></Html>
}

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
    {[0, 1, 2].map(i => <mesh key={i} position={[-.15, visual.surfaceOffset + .005, .13]} rotation={[-Math.PI / 2, 0, 0]} scale={1 + .06 * Math.sin(time * .7 + i)}>
      <ringGeometry args={[.12 + i * .13, .124 + i * .13, 56]}/>
      <meshBasicMaterial color="#c4e3e0" transparent opacity={.16 - i * .035} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>)}
    {Array.from({ length: 9 }, (_, i) => {
      const angle = i * 2.39996, radius = .12 + (i % 3) * .14
      return <mesh key={i} position={[Math.cos(angle) * radius, .12 + (i % 3) * .105, Math.sin(angle) * radius]}
        rotation={[i * .37, i * .71, i * .23]} scale={visual.solidScale * (.12 + (i % 3) * .035)}>
        <dodecahedronGeometry args={[1, 0]}/>
        <meshPhysicalMaterial color="#d6e3dc" metalness={.06} roughness={.37} clearcoat={.4} clearcoatRoughness={.22}/>
      </mesh>
    })}
    <Annotation position={[-1.1, .35, .05]}>Solid medium</Annotation>
    <Annotation position={[-1.1, -.3, .3]}>Liquid medium</Annotation>
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
    {Array.from({ length: 18 }, (_, i) => {
      const age = (time * .11 + i / 18) % 1, angle = i * 2.39996
      const width = .19 + age * .48
      return <sprite key={i} position={[Math.cos(angle) * (.19 + age * .22), .37 + age * 1.1, Math.sin(angle) * .22]}
        scale={[width, width, 1]}>
        <spriteMaterial map={texture} color="#c0d7d0" transparent opacity={amount * Math.sin(age * Math.PI) * .32} depthWrite={false}/>
      </sprite>
    })}
  </group>
}

function DeliveryPath({ time }: { time: number }) {
  const visual = preparationVisuals(time)
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(.56, -.38, .4), new THREE.Vector3(.98, -.48, .48),
    new THREE.Vector3(1.45, -.49, .55), new THREE.Vector3(1.63, -.81, .58),
    new THREE.Vector3(1.63, -1.55, .58),
  ], false, 'centripetal'), [])
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 56, .035, 10, false), [curve])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <group userData={{ scientificRole: 'Illustrative prescribed delivery path; no infiltration, soil response or suppression' }}>
    <mesh geometry={geometry}><meshStandardMaterial color="#3c514d" metalness={.4} roughness={.5}/></mesh>
    {Array.from({ length: 14 }, (_, i) => {
      const position = (time * .19 + i / 14) % 1
      const point = curve.getPointAt(position)
      return <mesh key={i} position={point} visible={position <= visual.delivery && visual.delivery > 0}>
        <sphereGeometry args={[.043, 8, 6]}/><meshStandardMaterial color="#a5dcdf" emissive="#4c9da8" emissiveIntensity={.6} roughness={.25}/>
      </mesh>
    })}
    <group position={[1.63, -1.6, .58]}>
      <mesh><cylinderGeometry args={[.17, .17, .055, 40]}/><meshStandardMaterial color="#54685e" metalness={.6} roughness={.3}/></mesh>
      <mesh position={[0, .031, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.075, .12, 40]}/><meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={visual.contact * .35} roughness={.25}/>
      </mesh>
    </group>
    <Annotation position={[1.43, -1.95, .58]}>{visual.delivery > 0 ? 'Prescribed contact' : 'Subsurface access'}</Annotation>
  </group>
}

/** Private, presentation-only close-up. Existing fire/excavator animation is
 * composed read-only by the coordinator host, never reconstructed here. */
export function MethodCues({ time }: MethodSceneProps) {
  const visual = preparationVisuals(time)
  return <group position={[.22, .2, 0]} rotation={[.12, -.26, 0]}
    userData={{ scientificRole: '4.2.1 illustrative method close-up; not dimensioned equipment or a physical outcome' }}>
    <pointLight position={[-2.6, 3, 3]} intensity={13} color="#e0d5b7" distance={9}/>
    <pointLight position={[2.6, 2.2, -1.8]} intensity={12} color="#8dbfbd" distance={8}/>
    <group position={[-.25, .12, 0]}>
      <MediaCutaway time={visual.time}/>
      <PhaseChange time={visual.time}/>
      <DeliveryPath time={visual.time}/>
    </group>
  </group>
}
