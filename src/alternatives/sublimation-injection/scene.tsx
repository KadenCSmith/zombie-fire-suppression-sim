import { Html } from '@react-three/drei/web/Html.js'
import { Line } from '@react-three/drei/core/Line.js'
import type { MethodSceneProps } from '../contract'
import { PRESENTATION_TIMING, sublimationPresentation } from './index'

const labelStyle = { color: '#b4c2ba', fontSize: 10, letterSpacing: '.08em', whiteSpace: 'nowrap', pointerEvents: 'none', background: '#000b', padding: '5px 7px' } as const

/** Independent symbolic media zone, not a vessel/device or dimensional design.
 * Geometry/motion consume only presentation time and never solver snapshots. */
export function MethodCues({ time }: MethodSceneProps) {
  const timeS = Number.isFinite(time) ? Math.max(0, Math.min(PRESENTATION_TIMING.endS, time)) : 0
  const pose = sublimationPresentation(timeS)
  const surface = pose.contextTime >= PRESENTATION_TIMING.surfaceS
  const preparation = timeS >= PRESENTATION_TIMING.preparationS
  const progress = Math.max(0, Math.min(1, (timeS - PRESENTATION_TIMING.injectionS) / 12))
  return <>
    {surface && <group position={[1.65, .52, .32]} userData={{ scientificRole: 'Illustrative surface solid/liquid preparation; no tank thermodynamics' }}>
      <mesh position={[0, -.2, 0]}><boxGeometry args={[1.2, .06, .65]}/><meshStandardMaterial color="#4b6057"/></mesh>
      <mesh position={[0, 0, 0]}><boxGeometry args={[1.1, .4, .6]}/><meshStandardMaterial color="#8a9b91" wireframe transparent opacity={.45}/></mesh>
      <mesh position={[.25, -.08, .03]}><boxGeometry args={[.48, .15, .47]}/><meshStandardMaterial color="#70aebe" transparent opacity={.8}/></mesh>
      {[-.34, -.15].map((x, i) => <mesh key={i} position={[x, -.04 + i * .08, .03]} rotation={[.2, i * .3, .1]}><boxGeometry args={[.17, .16, .19]}/><meshStandardMaterial color="#d5e5de" roughness={.6}/></mesh>)}
      <Html center zIndexRange={[5, 0]} position={[0, .48, 0]} style={labelStyle}>SOLID + LIQUID · CONCEPT</Html>
      {preparation && <>
        {[0, 1, 2].map(i => <mesh key={i} position={[-.23 + i * .12, .22 + ((timeS * .13 + i * .22) % .5), .02]}><sphereGeometry args={[.035, 8, 6]}/><meshStandardMaterial color="#c8d8d0" transparent opacity={.4}/></mesh>)}
        <Html center zIndexRange={[5, 0]} position={[0, .99, 0]} style={labelStyle}>PROPOSED PHASE CHANGE · UNMODELED</Html>
      </>}
    </group>}
    {pose.injection && <group userData={{ scientificRole: 'Authored delivery/contact cue; not calculated infiltration or suppression' }}>
      <Line points={[[1.7, .42, .42], [.4, .42, .42], [.4, .42 - 2.22 * progress, .42]]} color="#70aebe" lineWidth={2}/>
      {progress === 1 && <mesh position={[.4, -1.8, .42]}><ringGeometry args={[.06, .09, 24]}/><meshBasicMaterial color="#8cc4d0"/></mesh>}
      <Html center zIndexRange={[5, 0]} position={[1.15, -1.6, .42]} style={labelStyle}>PRESCRIBED CONTACT · NOT FIELD TRANSPORT</Html>
    </group>}
  </>
}
