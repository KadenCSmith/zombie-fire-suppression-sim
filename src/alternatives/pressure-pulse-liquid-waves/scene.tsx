import type { MethodSceneProps } from '../contract'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { liquidWavesPresentation } from './model'
import { liquidAnimationFrame, liquidContactPath } from './animation'
import { WetPeat } from './extinguish'
import { PipeTruck } from './equipment'
import { GroundFissures } from './groundPulse'

/** Additions to the unchanged original animation: original water truck enters
 * from right; private service truck enters from left. No expanding wave rings.
 * Ground motion, fractures and extinguishing are authored, never physics data. */
export function MethodCues({ id, time }: MethodSceneProps) {
  liquidWavesPresentation(id, time)
  const f = liquidAnimationFrame(time), sourceX = G.sourceX
  return <group userData={{ stage: f.stage, illustrative: true, worldSpace: true, base: '4.2.3' }}>
    <PipeTruck time={f.time}/>
    {f.injection && <group>
      <WetPeat progress={f.extinguishing}/>
      <GroundFissures opening={f.opening} strength={f.strength}/>
      {f.strength > .003 && Array.from({ length: 42 }, (_, i) => {
        const branch = i % 7 - 3, along = .12 + (i * .173) % .82
        const point = liquidContactPath(branch, along * Math.min(1, f.opening * 1.12 + .08))
        return <mesh key={i} position={[point[0] + Math.sin(i * 2.4) * f.strength * .07 + f.tremor, point[1] + f.strength * (.07 + (i % 4) * .035), point[2] + .045 + f.strength * .12]} rotation={[f.strength * 2.5, i, f.tremor * 8]} scale={.6 + f.strength}>
          <icosahedronGeometry args={[.022 + (i % 3) * .009, 0]}/><meshStandardMaterial color="#877354" roughness={1}/>
        </mesh>
      })}
      {f.opening > 0 && Array.from({ length: 10 }, (_, i) => {
        const angle = i * 2.4, radius = .37 + (i % 4) * .16
        const lift = f.strength * (.07 + (i % 3) * .025)
        return <group key={i} position={[sourceX + Math.cos(angle) * radius + f.tremor, .015 + lift, -.15 - Math.abs(Math.sin(angle)) * radius]} rotation={[f.tremor * 2, angle, f.strength * (i % 2 ? .11 : -.11)]}>
          <mesh castShadow><boxGeometry args={[.18 + (i % 3) * .035, .055, .13]}/><meshStandardMaterial color="#4e402b" roughness={1}/></mesh>
          <mesh position={[0,.03,0]}><boxGeometry args={[.18 + (i % 3) * .035, .008, .13]}/><meshStandardMaterial color="#526d36" roughness={1}/></mesh>
        </group>
      })}
    </group>}
  </group>
}
