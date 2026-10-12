import { Line } from '@react-three/drei/core/Line.js'
import { DoubleSide } from 'three'
import type { MethodSceneProps } from '../contract'
import { liquidWavesPresentation, waveCueProgress } from './model'

/** Separate geometry: rings indicate sequence, never wave speed, pressure,
 * fracture or infiltration. No original scene/assets are imported. */
export function MethodCues({ id, time }: MethodSceneProps) {
  const p = liquidWavesPresentation(id, time)
  return <>
    {p.waves && [0, 1, 2].map(i => {
      const phase = waveCueProgress(time, i)
      return <mesh key={i} position={[.4, -1.35, .16 + i * .005]} scale={[1 + phase * 3, .65 + phase * 1.8, 1]}>
        <ringGeometry args={[.20, .215, 48]}/>
        <meshBasicMaterial color="#81b6c3" transparent opacity={.55 * (1 - phase)} side={DoubleSide}/>
      </mesh>
    })}
    {p.injection && <>
      <Line points={[[.4, .2, .18], [.4, -1.8, .18]]} color="#81b6c3" lineWidth={2}/>
      <Line points={[[.08, -1.8, .18], [.72, -1.8, .18]]} color="#81b6c3" lineWidth={3}/>
      <mesh position={[.4, -1.8, .18]}><sphereGeometry args={[.055, 12, 8]}/><meshBasicMaterial color="#81b6c3"/></mesh>
    </>}
  </>
}
