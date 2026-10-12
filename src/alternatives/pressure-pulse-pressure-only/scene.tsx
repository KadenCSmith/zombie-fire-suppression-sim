import { AdditiveBlending, DoubleSide } from 'three'
import type { MethodSceneProps } from '../contract'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { pressureOnlyPresentation } from './model'
import { pressureAnimationFrame } from './animation'

/** A transient in the original world coordinates. Only abstract input contours
 * and neutral tracer glyphs move; soil, roots and fire are never displaced,
 * fractured, cooled or suppressed. There is no liquid/equipment source. */
export function MethodCues({ id, time }: MethodSceneProps) {
  pressureOnlyPresentation(id, time)
  const f = pressureAnimationFrame(time)
  if (!f.active) return null
  return <group position={[G.sourceX, -G.sourceDepthM, .13]} userData={{ stage: f.stage, illustrative: true, worldSpace: true, liquid: false }}>
    {f.fronts.map((front, i) => <group key={i}>
      <mesh scale={[front.radius, front.radius * .48, .035]}>
        <sphereGeometry args={[1, 40, 20]}/><meshBasicMaterial color="#b4a382" transparent opacity={front.opacity * .04} depthWrite={false} blending={AdditiveBlending}/>
      </mesh>
      <mesh scale={[front.radius, front.radius * .48, 1]}>
        <ringGeometry args={[.989, 1, 96]}/><meshBasicMaterial color="#c4ab7f" transparent opacity={front.opacity * .7} side={DoubleSide} depthWrite={false}/>
      </mesh>
      {Array.from({ length: 8 }, (_, j) => {
        const angle = front.angle + j * Math.PI / 4
        return <mesh key={j} position={[Math.cos(angle) * front.radius, Math.sin(angle) * front.radius * .48, .035]}
          rotation={[0, 0, angle + Math.PI / 4]} scale={[1, .6, .6]}>
          <octahedronGeometry args={[.018, 0]}/><meshBasicMaterial color="#dbc8a8" transparent opacity={front.opacity * .7}/>
        </mesh>
      })}
    </group>)}
    <mesh rotation={[0, 0, Math.PI / 4]} scale={f.indicator}>
      <octahedronGeometry args={[.065, 0]}/><meshBasicMaterial color="#e4c594" transparent opacity={.45}/>
    </mesh>
  </group>
}
