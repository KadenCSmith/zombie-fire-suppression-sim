import { Line } from '@react-three/drei/core/Line.js'
import { AdditiveBlending, DoubleSide } from 'three'
import type { MethodSceneProps } from '../contract'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { liquidWavesPresentation } from './model'
import { liquidAnimationFrame, liquidContactPath } from './animation'
import { WetPeat } from './extinguish'

/** Additions only: the external host replays the actual original 4.2.3 scene,
 * including its dry ice, pressure release, truck and hose. No duplicate
 * equipment, source, parent scene or original timeline is implemented here.
 * Fissure opening and particle motion are explicitly illustrative. */
export function MethodCues({ id, time }: MethodSceneProps) {
  liquidWavesPresentation(id, time)
  const f = liquidAnimationFrame(time), sourceX = G.sourceX
  if (!f.injection) return null
  return <group userData={{ stage: f.stage, illustrative: true, worldSpace: true, base: '4.2.3' }}>
    <WetPeat progress={f.extinguishing}/>
    <Line points={[[sourceX + .035, .13, .12], [sourceX + .035, -G.sourceDepthM, .12]]} color="#436b73" lineWidth={3} transparent opacity={.5}/>
    {f.drops.map((drop, i) => <mesh key={i} position={[sourceX + drop.x, drop.y, .16]} scale={[drop.scale, drop.scale * 1.8, drop.scale]}>
      <sphereGeometry args={[.025, 10, 6]}/><meshStandardMaterial color="#9ed5df" roughness={.2} metalness={.15} emissive="#426c78" emissiveIntensity={.35} transparent opacity={drop.opacity}/>
    </mesh>)}
    {f.opening > 0 && [-3, -2, -1, 0, 1, 2, 3].map(branch => {
      const extent = Math.min(1, f.opening * 1.2 + .05)
      const points = Array.from({ length: 36 }, (_, i) => liquidContactPath(branch, i / 35 * extent))
      const width = 1.5 + 4 * f.opening + f.strength * 3
      return <group key={branch} userData={{ scientificRole: 'authored fissure overlay, not calculated fracture or ground displacement' }}>
        <Line points={points.map(([x,y,z])=>[x,y+.008,z-.008] as [number,number,number])} color="#8e7656" lineWidth={width + 2} transparent opacity={.55}/>
        <Line points={points} color="#100d09" lineWidth={width} transparent opacity={.92}/>
        <Line points={points.map(([x,y,z])=>[x,y,z+.014] as [number,number,number])} color="#678e91" lineWidth={1.2 + f.strength * .7} transparent opacity={.75}/>
        {[0, 1, 2, 3, 4].map(i => {
          const progress = (f.flowClock * .7 + i / 5 + (branch + 3) * .13) % 1
          return <mesh key={i} position={liquidContactPath(branch, progress * extent)} scale={[1.5, .8, .7]}>
            <sphereGeometry args={[.025, 10, 6]}/><meshBasicMaterial color="#b5e5eb" transparent opacity={.65 * (1 - progress * .5)}/>
          </mesh>
        })}
      </group>
    })}
    {f.fronts.map((front, i) => <group key={i} position={[sourceX, -G.sourceDepthM, .14]}>
      <mesh scale={[front.radius, front.radius * .48, .025]}>
        <sphereGeometry args={[1, 40, 20]}/><meshBasicMaterial color="#79bdc8" transparent opacity={front.opacity * .07} depthWrite={false} blending={AdditiveBlending}/>
      </mesh>
      <mesh scale={[front.radius, front.radius * .48, 1]}>
        <ringGeometry args={[.984, 1, 96]}/><meshBasicMaterial color="#a7d8df" transparent opacity={front.opacity} side={DoubleSide} depthWrite={false}/>
      </mesh>
    </group>)}
    {f.waves && Array.from({ length: 36 }, (_, i) => {
      const branch = i % 7 - 3, along = (i * .173) % 1
      const point = liquidContactPath(branch, along * Math.min(1, f.opening * 1.2 + .05))
      return <mesh key={i} position={[point[0] + Math.sin(i * 2.4) * f.strength * .035, point[1] + Math.sin(f.progress * Math.PI) * (.035 + (i % 4) * .018), point[2] + .025]} rotation={[f.progress * 3, i, f.progress * 2]} scale={f.strength}>
        <icosahedronGeometry args={[.015 + (i % 3) * .006, 0]}/><meshStandardMaterial color="#8e7656" roughness={1} transparent opacity={.65 * (1 - f.progress)}/>
      </mesh>
    })}
  </group>
}
