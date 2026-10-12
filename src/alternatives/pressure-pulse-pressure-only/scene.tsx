import type { MethodSceneProps } from '../contract'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { pressureOnlyPresentation } from './model'
import { pressureAnimationFrame, pressureSoilPoint } from './animation'
import { PressureGround } from './groundResponse'

/** Original dry-ice event is read-only host context. Only privately owned earth
 * cues move; no water, equipment, heat source or extinction state is created. */
export function MethodCues({ id, time }: MethodSceneProps) {
  pressureOnlyPresentation(id, time)
  const f = pressureAnimationFrame(time)
  if (!f.active) return null
  return <group userData={{ stage: f.stage, illustrative: true, worldSpace: true, liquid: false }}>
    <PressureGround opening={f.opening} jolt={f.jolt} settled={f.settled}/>
    {f.fragments && Array.from({ length: 48 }, (_, i) => {
      const branch = i % 8, p = pressureSoilPoint(branch, .15 + (i * .137) % .75)
      const flight = Math.max(0, Math.sin(Math.PI * Math.min(1, f.age / (1.15 + (i % 4) * .22))))
      const side = p[0] < G.sourceX ? -1 : 1
      return <mesh key={i} position={[p[0] + side * flight * (.08 + (i % 3) * .04) + f.tremor,
        p[1] + flight * (.12 + (i % 5) * .025), p[2] + .04 + flight * .17]}
        rotation={[i * .83 + flight * 3, flight + i, f.tremor * 5]} scale={.7 + flight * .5}>
        <icosahedronGeometry args={[.021 + (i % 3) * .008, 0]}/><meshStandardMaterial color={i % 2 ? '#897556' : '#65553b'} roughness={1}/>
      </mesh>
    })}
    {Array.from({ length: 10 }, (_, i) => {
      const angle = i * 2.4, radius = .3 + (i % 3) * .19
      return <group key={i} position={[G.sourceX + Math.cos(angle) * radius + f.tremor,
        .014 + f.jolt * (.1 + (i % 3) * .025) - f.settled * .022,
        -.12 - Math.abs(Math.sin(angle)) * radius]}
        rotation={[f.tremor * 3, angle, f.jolt * (i % 2 ? .1 : -.1)]}>
        <mesh castShadow><boxGeometry args={[.19, .05, .14]}/><meshStandardMaterial color="#59482f" roughness={1}/></mesh>
        <mesh position={[0, .027, 0]}><boxGeometry args={[.19, .008, .14]}/><meshStandardMaterial color="#536b37" roughness={1}/></mesh>
      </group>
    })}
  </group>
}
