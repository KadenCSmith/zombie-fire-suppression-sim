import { useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import * as THREE from 'three'
import { SUPPLY_OUTLET_LOCAL, TRUCK_WHEEL_RADIUS, wheelRollAngle } from './visuals'

const BODY = '#6c7e70', FRAME = '#29352f', METAL = '#aab5aa'

function Wheel({ x, side, roll }: { x: number; side: number; roll: number }) {
  return <group position={[x, TRUCK_WHEEL_RADIUS, side * .65]} rotation={[0, 0, roll]}>
    <mesh castShadow><torusGeometry args={[.23, .092, 12, 36]}/><meshStandardMaterial color="#141b17" roughness={.98}/></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.166, .166, .145, 24]}/><meshStandardMaterial color={METAL} metalness={.72} roughness={.44}/></mesh>
    <mesh position={[0, 0, side * .08]}><torusGeometry args={[.125, .016, 6, 24]}/><meshStandardMaterial color="#65756a" metalness={.6} roughness={.5}/></mesh>
    {Array.from({ length: 8 }, (_, i) => {
      const angle = i * Math.PI / 4
      return <mesh key={i} position={[Math.cos(angle) * .087, Math.sin(angle) * .087, side * .09]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.013, .013, .025, 6]}/><meshStandardMaterial color="#c2c9bb" metalness={.75} roughness={.4}/>
      </mesh>
    })}
    {Array.from({ length: 20 }, (_, i) => {
      const angle = i * Math.PI / 10
      return <mesh key={'tread-' + i} position={[Math.cos(angle) * .315, Math.sin(angle) * .315, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[.023, .075, .13]}/><meshStandardMaterial color="#202a22" roughness={1}/>
      </mesh>
    })}
  </group>
}

function HoseReel({ payout }: { payout: number }) {
  const coil = useMemo(() => {
    const points = Array.from({ length: 151 }, (_, i) => {
      const q = i / 150, a = q * Math.PI * 10
      return new THREE.Vector3(Math.cos(a) * .17, Math.sin(a) * .17, -.08 + q * .16)
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 150, .026, 6, false)
  }, [])
  useEffect(() => () => coil.dispose(), [coil])
  return <group position={[-.88, .78, .63]}>
    <mesh position={[0, -.19, 0]}><boxGeometry args={[.48, .11, .34]}/><meshStandardMaterial color={FRAME} roughness={.7}/></mesh>
    <group rotation={[0, 0, -payout * Math.PI * 8]}>
      {[-.12, .12].map(z => <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.235, .235, .035, 32]}/><meshStandardMaterial color="#768d7d" metalness={.6} roughness={.45}/>
      </mesh>)}
      <mesh geometry={coil}><meshStandardMaterial color="#b1ad92" roughness={.94}/></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.06, .06, .29, 16]}/><meshStandardMaterial color={METAL} metalness={.75} roughness={.3}/></mesh>
    </group>
  </group>
}

/** Entirely new procedural service vehicle. Display coordinates are artwork;
 * there is no equipment specification, pump/pressure or vehicle simulation. */
export function ServiceVehicle({ travel, payout }: { travel: number; payout: number }) {
  return <group userData={{ scientificRole: 'New authored utility tanker, rear work deck, hose reel and pump bay; no equipment performance prediction' }}>
    {[-.39, .39].map(z => <mesh key={z} position={[0, .43, z]} castShadow><boxGeometry args={[4.35, .16, .10]}/><meshStandardMaterial color={FRAME} metalness={.55} roughness={.75}/></mesh>)}
    {[-1.35, -.25, 1.62].map(x => <group key={x}>
      <mesh position={[x, .322, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.055, .055, 1.3, 10]}/><meshStandardMaterial color="#354039" metalness={.6} roughness={.7}/></mesh>
      <Wheel x={x} side={-1} roll={wheelRollAngle(travel)}/><Wheel x={x} side={1} roll={wheelRollAngle(travel)}/>
      {[-.77, .77].map(z => <mesh key={z} position={[x, .322, z]}><torusGeometry args={[.35, .025, 6, 24, Math.PI]}/><meshStandardMaterial color="#4d5f51" metalness={.35} roughness={.75}/></mesh>)}
    </group>)}
    <RoundedBox position={[1.7, 1.20, 0]} args={[1.0, 1.08, 1.23]} radius={.10} smoothness={3} castShadow><meshStandardMaterial color={BODY} metalness={.18} roughness={.58}/></RoundedBox>
    <RoundedBox position={[2.10, .80, 0]} args={[.33, .43, 1.18]} radius={.06} smoothness={3} castShadow><meshStandardMaterial color="#758777" metalness={.22} roughness={.55}/></RoundedBox>
    <mesh position={[2.207, 1.28, 0]} rotation={[0, 0, -.12]}><boxGeometry args={[.025, .44, 1.04]}/><meshPhysicalMaterial color="#304b4a" roughness={.11} metalness={.3}/></mesh>
    <mesh position={[2.28, .70, 0]}><boxGeometry args={[.025, .25, .63]}/><meshStandardMaterial color="#20302a" roughness={.86}/></mesh>
    {[-.08, 0, .08].map(y => <mesh key={y} position={[2.296, .70 + y, 0]}><boxGeometry args={[.018, .018, .59]}/><meshStandardMaterial color="#7e8c80" metalness={.6} roughness={.45}/></mesh>)}
    <mesh position={[2.29, .49, 0]}><boxGeometry args={[.13, .14, 1.30]}/><meshStandardMaterial color="#7d8c80" metalness={.7} roughness={.4}/></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[1.63, 1.29, side * .626]}><boxGeometry args={[.68, .45, .035]}/><meshStandardMaterial color="#293c35" roughness={.65}/></mesh>
      <mesh position={[1.63, 1.29, side * .649]}><boxGeometry args={[.61, .38, .012]}/><meshPhysicalMaterial color="#52706b" roughness={.12} metalness={.22}/></mesh>
      <mesh position={[1.57, .85, side * .633]}><boxGeometry args={[.77, .40, .022]}/><meshStandardMaterial color="#687c6b" metalness={.25} roughness={.65}/></mesh>
      <mesh position={[1.35, .99, side * .655]}><boxGeometry args={[.15, .025, .028]}/><meshStandardMaterial color={METAL} metalness={.7} roughness={.45}/></mesh>
      <mesh position={[1.17, .43, side * .70]}><boxGeometry args={[.23, .075, .22]}/><meshStandardMaterial color="#8c998b" metalness={.65} roughness={.72}/></mesh>
      <mesh position={[2.0, 1.37, side * .75]}><boxGeometry args={[.05, .05, .27]}/><meshStandardMaterial color={FRAME} roughness={.7}/></mesh>
      <mesh position={[1.97, 1.34, side * .89]}><boxGeometry args={[.16, .25, .055]}/><meshStandardMaterial color="#344d44" metalness={.4} roughness={.25}/></mesh>
      <mesh position={[2.29, .84, side * .44]}><boxGeometry args={[.025, .13, .22]}/><meshStandardMaterial color="#d8d5ba" emissive="#b9ae79" emissiveIntensity={.16} roughness={.35}/></mesh>
      <mesh position={[.65, .59, side * .63]}><boxGeometry args={[1.1, .09, .10]}/><meshStandardMaterial color="#65766a" metalness={.4} roughness={.7}/></mesh>
      <mesh position={[-2.38, .82, side * .55]}><boxGeometry args={[.055, .10, .16]}/><meshStandardMaterial color="#7d4936" roughness={.5}/></mesh>
    </group>)}
    <group position={[.15, 1.22, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><capsuleGeometry args={[.52, .8, 10, 40]}/><meshStandardMaterial color="#b5bfb2" metalness={.48} roughness={.5}/></mesh>
      {[-.36, .36].map(y => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[.529, .529, .045, 40, 1, true]}/><meshStandardMaterial color="#5a7363" metalness={.55} roughness={.52}/></mesh>)}
    </group>
    {[-.36, .67].map(x => <mesh key={x} position={[x, .62, 0]}><boxGeometry args={[.17, .23, .91]}/><meshStandardMaterial color="#536a5b" metalness={.5} roughness={.7}/></mesh>)}
    <mesh position={[.15, 1.77, 0]}><cylinderGeometry args={[.15, .15, .06, 20]}/><meshStandardMaterial color="#6b7c6d" metalness={.6} roughness={.5}/></mesh>
    <mesh position={[...SUPPLY_OUTLET_LOCAL]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.055, .055, .15, 16]}/><meshStandardMaterial color={METAL} metalness={.8} roughness={.3}/></mesh>
    <mesh position={[-1.70, .65, 0]} castShadow><boxGeometry args={[1.7, .14, 1.64]}/><meshStandardMaterial color="#67786b" metalness={.45} roughness={.72}/></mesh>
    <mesh position={[-2.56, .51, 0]}><boxGeometry args={[.10, .16, 1.42]}/><meshStandardMaterial color="#6e7e70" metalness={.55} roughness={.65}/></mesh>
    <HoseReel payout={payout}/>
    <group position={[-1.10, .89, .68]}>
      <mesh position={[0, -.11, 0]}><boxGeometry args={[.36, .12, .24]}/><meshStandardMaterial color="#526757" metalness={.4} roughness={.7}/></mesh>
      <mesh><boxGeometry args={[.44, .10, .32]}/><meshStandardMaterial color={FRAME} metalness={.4} roughness={.7}/></mesh>
      <mesh position={[.08, .13, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.11, .11, .27, 20]}/><meshStandardMaterial color="#819584" metalness={.5} roughness={.55}/></mesh>
      {[-.08, -.04, 0, .04, .08].map(x => <mesh key={x} position={[.08 + x, .13, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.12, .12, .008, 20]}/><meshStandardMaterial color="#506958" metalness={.45} roughness={.6}/></mesh>)}
      <mesh position={[-.15, .13, 0]}><sphereGeometry args={[.105, 16, 12]}/><meshStandardMaterial color="#8d9b8b" metalness={.7} roughness={.4}/></mesh>
    </group>
  </group>
}
