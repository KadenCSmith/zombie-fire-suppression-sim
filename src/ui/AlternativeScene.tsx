import { cloneElement } from 'react'
import { AlternativeMethodCues } from './AlternativeMethodModules'
import { FireSequenceScene } from './FireSequenceScene'
import type { VariantId } from '../alternatives/registry'

/** The protected export is a hook-free Canvas factory. Invoke it unchanged,
 * retaining every authored child and Canvas prop; append only private world
 * objects. The independent original route never uses this external adapter. */
export function AlternativeScene({id,time,resetToken,cameraDistance}:{id:VariantId;time:number;resetToken:number;cameraDistance:number}) {
  const contextTime = Math.max(0, Math.min(38, time))
  const original = FireSequenceScene({time:contextTime,mode:'rapid',view:'natural',layers:{fire:true,gas:false,water:false,anatomy:true},resetToken,realistic:true,straightBore:true,cinematic:true,connectedSupply:true,cameraDistance})
  const scene = id === 'nanoparticles' ? original : cloneElement(original, undefined,
    original.props.children,
    <group key="alternative-world-cues" userData={{alternative:id,illustrative:true}}><AlternativeMethodCues id={id} time={time}/></group>)
  return <div className="alternative-scene-composition" data-method={id} data-presentation-active={time >= 38} data-original-animation="fire-spread-and-drilling" data-original-context-time={contextTime} data-presentation-space="original-world">
    {scene}
  </div>
}
