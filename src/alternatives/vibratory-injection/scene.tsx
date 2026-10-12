import { Line } from '@react-three/drei/core/Line.js'
import { FIRE_SEQUENCE_GEOMETRY } from '../../story/fireSequence'
import type { MethodSceneProps } from '../contract'
import { methodModule } from './index'
export function MethodCues({id,time}:MethodSceneProps) {
  const p=methodModule.presentation(id,time),x=FIRE_SEQUENCE_GEOMETRY.sourceX
  return p.injection?<><Line points={[[x,.2,.14],[x,-1.8,.14]]} color="#81b6c3" lineWidth={2}/><Line points={[[x-.35,-.6,.14],[x+.35,-.6,.14]]} color="#81b6c3" lineWidth={3}/></>:null
}
