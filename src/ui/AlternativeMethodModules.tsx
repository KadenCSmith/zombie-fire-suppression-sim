import type { MethodSceneProps } from '../alternatives/contract'
import { MethodCues as SublimationCues } from '../alternatives/sublimation-injection/scene'
import { MethodCues as LiquidWaveCues } from '../alternatives/pressure-pulse-liquid-waves/scene'
import { MethodCues as PressureOnlyCues } from '../alternatives/pressure-pulse-pressure-only/scene'
import { MethodCues as VibrationCues } from '../alternatives/vibratory-injection/scene'
import { MethodScience as SublimationScience } from '../alternatives/sublimation-injection/science'
import { MethodScience as LiquidWaveScience } from '../alternatives/pressure-pulse-liquid-waves/science'
import { MethodScience as PressureOnlyScience } from '../alternatives/pressure-pulse-pressure-only/science'
import { MethodScience as VibrationScience } from '../alternatives/vibratory-injection/science'
import { MethodCues as ParticleCues } from '../alternatives/fine-dry-ice-injection/scene'
import { MethodScience as ParticleScience } from '../alternatives/fine-dry-ice-injection/science'
export function AlternativeMethodCues(props:MethodSceneProps) {
  if(props.id==='sublimation-injection')return <SublimationCues {...props}/>
  if(props.id==='liquid-waves')return <LiquidWaveCues {...props}/>
  if(props.id==='pressure-only')return <PressureOnlyCues {...props}/>
  if(props.id==='vibratory-injection')return <VibrationCues {...props}/>
  if(props.id==='nanoparticles')return <ParticleCues {...props}/>
  return null
}
export function AlternativeMethodScience() { return <><SublimationScience/><LiquidWaveScience/><PressureOnlyScience/><VibrationScience/><ParticleScience/></> }
