import { Line } from '@react-three/drei/core/Line.js'
import { FIRE_SEQUENCE_GEOMETRY } from '../../story/fireSequence'
import type { MethodSceneProps } from '../contract'
/** Abstract media blocks, not pressure equipment specifications. Original rapid render remains separate. */
export function MethodCues({time}:MethodSceneProps) {
  const x=FIRE_SEQUENCE_GEOMETRY.sourceX
  return <>{time>=35&&<group position={[x+1,.25,.2]}><mesh position={[-.15,0,0]}><boxGeometry args={[.2,.2,.2]}/><meshStandardMaterial color="#dcece5"/></mesh><mesh position={[.2,0,0]}><boxGeometry args={[.3,.12,.25]}/><meshStandardMaterial color="#81b6c3"/></mesh></group>}{time>=60&&<Line points={[[x+1,.2,.14],[x,.2,.14],[x,-1.8,.14]]} color="#81b6c3" lineWidth={2}/>}</>
}
