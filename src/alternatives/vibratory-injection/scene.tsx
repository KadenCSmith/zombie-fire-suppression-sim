import { Line } from '@react-three/drei/core/Line.js'
import type { MethodSceneProps } from '../contract'
import { methodModule } from './index'

/** Private concept coordinates; no original scene, asset or geometry imports.
 * Marker positions are not computed delivery depths or contact control volumes. */
const geometry = { x: .4, front: .13, tip: -1.6, outlets: [-.5, -.95, -1.4] } as const

export function MethodCues({ id, time }: MethodSceneProps) {
  const p = methodModule.presentation(id, time)
  if (!p.access) return null
  const { x, front, tip } = geometry
  return <group>
    <Line points={[[x - .8, .45, front], [x - .8, .22, front], [x, .22, front]]} color="#566c70" lineWidth={2}/>
    <group position={[p.vibration, 0, 0]}>
      <mesh position={[x, .26, front]}><boxGeometry args={[.22, .17, .18]}/><meshStandardMaterial color="#a4a79c" roughness={.7}/></mesh>
      {p.injection && <Line points={[[x, .2, front], [x, tip, front]]} color="#81b6c3" lineWidth={3}/>}
    </group>
    {p.injection && geometry.outlets.map((y, i) => <group key={y}>
      <Line points={[[x, y, front], [x + .18 + i * .035, y, front]]} color="#81b6c3" lineWidth={2}/>
      <mesh position={[x + .23 + i * .035, y, front]}><sphereGeometry args={[.035, 10, 8]}/><meshBasicMaterial color="#81b6c3"/></mesh>
    </group>)}
  </group>
}
