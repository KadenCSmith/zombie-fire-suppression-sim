import { Line } from '@react-three/drei/core/Line.js'
import type { MethodSceneProps } from '../contract'
import { SequenceExcavator } from '../../ui/FireSequenceEquipment'
import { FireWaterTruck } from '../../ui/FireWaterTruck'
import { eased, pointAlongStoryPath, type StoryPoint } from '../../story/fireSequence'
import { TreatmentEffects } from './effects'
import { treatmentVisual } from './visuals'

/** World-space continuation after the original introduction. Equipment exports
 * are invoked read-only. Motion/flow markers do not enter numerical state. */
export function MethodCues({ time }: MethodSceneProps) {
  if(time<38)return null
  const truckTime=57+Math.min(8,time-38),feed=eased(time,48,54),active=time>=50&&time<78
  const visualTime=time-24,pose=treatmentVisual(visualTime)
  const rotor=31+((time*6.5)%(2*Math.PI))/6.5,vibration=pose.displacementX,depth=1.385*feed
  const route:StoryPoint[]=[[1.08,.63,-.54],[1.02,.28,-.46],[.81,.13,-.39],[.59,.13,-.28],[.4,.29,-.02],[.4,.14,.1],[.4,-depth,.12]]
  return <group userData={{method:'4.2.4',role:'world-space illustrative drilling and continuous liquid delivery'}}>
    <FireWaterTruck time={truckTime}/>
    {time>=46&&<>
      <group position={[vibration,0,0]}><SequenceExcavator time={rotor} connectedSupply/></group>
      <Line points={route} color="#1c3031" lineWidth={9}/><Line points={route} color="#688b8b" lineWidth={2}/>
      <mesh position={[.4,.37,-.02]}><cylinderGeometry args={[.145,.145,.22,24]}/><meshStandardMaterial color="#687d77" metalness={.7} roughness={.35}/></mesh>
      {active&&Array.from({length:24},(_,i)=>{
        const p=pointAlongStoryPath(route,(time*.48+i/24)%1)
        return <mesh key={i} position={p}><sphereGeometry args={[.018,7,5]}/><meshBasicMaterial color="#87e0de"/></mesh>
      })}
      {active&&<><mesh position={[.4,-depth,.14]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.08,.012,8,32]}/><meshBasicMaterial color="#a3e6dd"/></mesh><pointLight position={[.4,-depth,.2]} color="#9cded4" intensity={.12} distance={.35}/></>}
      <TreatmentEffects time={visualTime} depth={depth} showFire={false}/>
    </>}
  </group>
}
