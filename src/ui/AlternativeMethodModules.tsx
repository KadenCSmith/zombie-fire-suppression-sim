import type { MethodSceneProps } from '../alternatives/contract'
import { MethodCues as SublimationCues } from '../alternatives/sublimation-injection/scene'
import { MethodCues as PressureCues } from '../alternatives/pressure-pulse/scene'
import { MethodCues as VibrationCues } from '../alternatives/vibratory-injection/scene'
import { MethodScience as SublimationScience } from '../alternatives/sublimation-injection/science'
import { MethodScience as PressureScience } from '../alternatives/pressure-pulse/science'
import { MethodScience as VibrationScience } from '../alternatives/vibratory-injection/science'
export function AlternativeMethodCues(props:MethodSceneProps) {
  if(props.id==='sublimation-injection')return <SublimationCues {...props}/>
  if(['pressure-pulse','liquid-waves','pressure-only'].includes(props.id))return <PressureCues {...props}/>
  if(props.id==='vibratory-injection')return <VibrationCues {...props}/>
  return null
}
export function AlternativeMethodScience() { return <><SublimationScience/><PressureScience/><VibrationScience/></> }
