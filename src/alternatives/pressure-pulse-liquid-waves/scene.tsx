import { Line } from '@react-three/drei/core/Line.js'
import { AdditiveBlending, DoubleSide } from 'three'
import type { MethodSceneProps } from '../contract'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { FireWaterTruck } from '../../ui/FireWaterTruck'
import { FabricHose } from '../../ui/FireInterventionEquipment'
import { liquidWavesPresentation } from './model'
import { liquidAnimationFrame, liquidAssetTime, liquidContactPath } from './animation'

/** World-space effects for the existing cutaway, not an inset or replacement
 * environment. Original equipment exports are invoked unchanged. Every effect
 * follows presentation time and has no influence on numerical state. */
export function MethodCues({ id, time }: MethodSceneProps) {
  liquidWavesPresentation(id, time)
  const f = liquidAnimationFrame(time), sourceX = G.sourceX
  if (time < 38) return null
  return <group userData={{ stage: f.stage, illustrative: true, worldSpace: true }}>
    {time >= 46 && <><FireWaterTruck time={liquidAssetTime(time)}/><FabricHose time={liquidAssetTime(time)} connectedSupply/></>}
    {f.fronts.map((front, i) => <group key={i} position={[sourceX, -G.sourceDepthM, .12]}>
      <mesh scale={[front.radius, front.radius * .5, .025]}>
        <sphereGeometry args={[1, 40, 20]}/><meshBasicMaterial color="#5a9ea8" transparent opacity={front.opacity * .045} depthWrite={false} blending={AdditiveBlending}/>
      </mesh>
      <mesh scale={[front.radius, front.radius * .5, 1]}>
        <ringGeometry args={[.986, 1, 96]}/><meshBasicMaterial color="#75c4d0" transparent opacity={front.opacity * .72} side={DoubleSide} depthWrite={false}/>
      </mesh>
      {[0, Math.PI].map(angle => <mesh key={angle} position={[Math.cos(front.angle + angle) * front.radius, Math.sin(front.angle + angle) * front.radius * .5, .035]}>
        <sphereGeometry args={[.022, 8, 6]}/><meshBasicMaterial color="#b6e0e5" transparent opacity={front.opacity}/>
      </mesh>)}
    </group>)}
    {f.waves && <mesh position={[sourceX, -G.sourceDepthM, .15]} scale={1 + Math.sin(time * 3) * .17}>
      <sphereGeometry args={[.06, 16, 10]}/><meshBasicMaterial color="#84cbd4" transparent opacity={.5}/>
    </mesh>}
    {f.injection && <>
      <Line points={[[sourceX + .035, .13, .12], [sourceX + .035, -G.sourceDepthM, .12]]} color="#436b73" lineWidth={4} transparent opacity={.55}/>
      {f.drops.map((drop, i) => <mesh key={i} position={[sourceX + drop.x, drop.y, .16]} scale={[drop.scale, drop.scale * 1.8, drop.scale]}>
        <sphereGeometry args={[.024, 10, 6]}/><meshStandardMaterial color="#8fc9d5" roughness={.2} metalness={.15} emissive="#426c78" emissiveIntensity={.35} transparent opacity={drop.opacity}/>
      </mesh>)}
      {[-2, -1, 0, 1, 2].map(branch => {
        const points = Array.from({ length: 28 }, (_, i) => liquidContactPath(branch, i / 27 * f.contact))
        return <group key={branch}>
          <Line points={points} color="#527c81" lineWidth={1.6} transparent opacity={.58}/>
          {[0, 1, 2, 3].map(i => {
            const progress = ((time - 56) * .32 + i / 4 + (branch + 2) * .13) % 1
            return <mesh key={i} position={liquidContactPath(branch, progress * f.contact)} scale={[1.4, .8, .7]}>
              <sphereGeometry args={[.025, 10, 6]}/><meshBasicMaterial color="#a5dbe4" transparent opacity={.65 * (1 - progress * .5)}/>
            </mesh>
          })}
        </group>
      })}
      {f.ripples.map((ripple, i) => <mesh key={i} position={[sourceX, -G.sourceDepthM, .16]} scale={[ripple.radius, ripple.radius * .28, 1]}>
        <ringGeometry args={[.975, 1, 48]}/><meshBasicMaterial color="#9ccecf" transparent opacity={ripple.opacity * .45} side={DoubleSide}/>
      </mesh>)}
    </>}
  </group>
}
