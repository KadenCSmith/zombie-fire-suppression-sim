import { Line } from '@react-three/drei/core/Line.js'
import { DoubleSide } from 'three'
import { FIRE_SEQUENCE_GEOMETRY } from '../../story/fireSequence'
import type { MethodSceneProps } from '../contract'
import { methodModule } from './index'
export function MethodCues({id,time}:MethodSceneProps) {
  const p=methodModule.presentation(id,time),x=FIRE_SEQUENCE_GEOMETRY.sourceX
  return <>
    {(p.pulse||p.waves)&&[0,1,2].map(i=><mesh key={i} position={[x,-1.4,.12+i*.01]} scale={1+((time*(p.waves?1.5:.7)+i*.33)%1)*2}><ringGeometry args={[.18,.19,48]}/><meshBasicMaterial color={p.waves?'#81b6c3':'#b4baa1'} transparent opacity={.5-i*.1} side={DoubleSide}/></mesh>)}
    {p.injection&&<><Line points={[[x,.2,.14],[x,-1.8,.14]]} color="#81b6c3" lineWidth={2}/>{Array.from({length:p.contacts},(_,i)=><group key={i} position={[x,-.6-i*.55,.14]}><Line points={[[-.35,0,0],[.35,0,0]]} color="#81b6c3" lineWidth={3}/><mesh><sphereGeometry args={[.045,12,8]}/><meshBasicMaterial color="#81b6c3"/></mesh></group>)}</>}
  </>
}
