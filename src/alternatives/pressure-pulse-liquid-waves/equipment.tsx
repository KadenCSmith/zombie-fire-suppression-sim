import { Quaternion, Vector3 } from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { pipeTruckFrame } from './animation'

type Point = [number, number, number]

/** Opaque rigid segments distinguish this supply from the original woven hose. */
function MetalSegment({ from, to, radius = .045, color = '#aab5b4' }: { from: Point; to: Point; radius?: number; color?: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), delta = b.clone().sub(a)
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize())
  return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, delta.length(), 12]}/>
    <meshStandardMaterial color={color} metalness={.78} roughness={.28}/>
  </mesh>
}

/** Independently authored service truck; original water truck remains on right. */
export function PipeTruck({ time }: { time: number }) {
  const f = pipeTruckFrame(time)
  if (!f.visible) return null
  const pipeX = G.sourceX - .11
  return <group userData={{ scientificRole: 'Authored opposite-side service truck and rigid pipe installation; no equipment or pressure design' }}>
    <group position={f.position}>
      <mesh position={[0, .39, 0]} castShadow><boxGeometry args={[2.8, .18, 1.08]}/><meshStandardMaterial color="#323b3b" metalness={.55} roughness={.55}/></mesh>
      {[-.95, -.35, .95].flatMap(x => [-.57, .57].map(z => <group key={x + ':' + z} position={[x, .29, z]} rotation={[Math.PI / 2, 0, 0]}>
        <group rotation={[0, -f.travel / .29, 0]}>
          <mesh castShadow><cylinderGeometry args={[.29, .29, .18, 20]}/><meshStandardMaterial color="#181c1b" roughness={.95}/></mesh>
          <mesh><cylinderGeometry args={[.13, .13, .19, 12]}/><meshStandardMaterial color="#a5adaa" metalness={.85} roughness={.32}/></mesh>
          <mesh position={[0, 0, .09]}><boxGeometry args={[.2, .2, .04]}/><meshStandardMaterial color="#596460" metalness={.7}/></mesh>
        </group>
      </group>))}
      <mesh position={[.99, .94, 0]} castShadow><boxGeometry args={[1, 1, 1.06]}/><meshStandardMaterial color="#b87932" metalness={.35} roughness={.5}/></mesh>
      <mesh position={[1.5, 1.15, 0]}><boxGeometry args={[.025, .4, .87]}/><meshStandardMaterial color="#456467" metalness={.35} roughness={.2}/></mesh>
      {[-.54, .54].map(z => <group key={z}>
        <mesh position={[1.03, 1.16, z]}><boxGeometry args={[.56, .4, .02]}/><meshStandardMaterial color="#47686a" metalness={.3} roughness={.2}/></mesh>
        <mesh position={[1.51, .64, z * .75]}><boxGeometry args={[.03, .12, .14]}/><meshStandardMaterial color="#e6dfbe" emissive="#b9a56b" emissiveIntensity={.25}/></mesh>
        <mesh position={[-.45, .56, z]}><boxGeometry args={[1.65, .18, .06]}/><meshStandardMaterial color="#a4afad" metalness={.7}/></mesh>
      </group>)}
      <mesh position={[-.4, .83, 0]} castShadow><boxGeometry args={[1.35, .65, .8]}/><meshStandardMaterial color="#5d7374" metalness={.55} roughness={.4}/></mesh>
      {[-.65, -.15].map(x => <mesh key={x} position={[x, 1.19, 0]}><boxGeometry args={[.3, .08, .83]}/><meshStandardMaterial color="#a0aeac" metalness={.8} roughness={.3}/></mesh>)}
      <MetalSegment from={[-.8, 1.33, -.35]} to={[.3, 1.33, -.35]} radius={.045}/>
      <MetalSegment from={[-.8, 1.33, .35]} to={[.3, 1.33, .35]} radius={.045}/>
      <mesh position={[-.35, 1.22, 0]}><cylinderGeometry args={[.12, .12, .5, 16]}/><meshStandardMaterial color="#bd863d" metalness={.5} roughness={.5}/></mesh>
    </group>
    {time >= 65 && time < 74 && <group>
      <MetalSegment from={[-2.7, 1.42, -.95]} to={[-2.25 + f.arm * (pipeX + 2.25), 1.6 + f.arm * 2.02, -.95 + f.arm * 1.04]} radius={.075} color="#bd863d"/>
      {f.pipeVisible && <MetalSegment from={[pipeX, 3.6, .09]} to={[pipeX, f.pipeBottom + 1.56, .09]} radius={.009} color="#39423d"/>}
    </group>}
    {f.pipeVisible && <group>
      <MetalSegment from={[pipeX, f.pipeBottom, .09]} to={[pipeX, f.pipeBottom + 1.56, .09]} radius={.055}/>
      {[.04, .82, 1.5].map(y => <mesh key={y} position={[pipeX, f.pipeBottom + y, .09]}><cylinderGeometry args={[.069, .069, .055, 16]}/><meshStandardMaterial color="#616f6e" metalness={.8} roughness={.3}/></mesh>)}
    </group>}
    {f.connected && <group>
      <MetalSegment from={[-1.17, .7, -.58]} to={[pipeX, .7, -.58]}/>
      <MetalSegment from={[pipeX, .7, -.58]} to={[pipeX, .7, .09]}/>
      <MetalSegment from={[pipeX, .7, .09]} to={[pipeX, .23, .09]}/>
      <mesh position={[pipeX, .23, .09]}><sphereGeometry args={[.067, 12, 8]}/><meshStandardMaterial color="#9daaa9" metalness={.8} roughness={.3}/></mesh>
    </group>}
  </group>
}
