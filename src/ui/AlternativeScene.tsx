import { cloneElement } from 'react'
import { AlternativeMethodCues } from './AlternativeMethodModules'
import { FireSequenceScene } from './FireSequenceScene'
import type { VariantId } from '../alternatives/registry'

/** The protected export is a hook-free Canvas factory. Invoke it unchanged,
 * retaining every authored child and Canvas prop; append only private world
 * objects. The independent original route never uses this external adapter. */
export function AlternativeScene({id,time,resetToken,cameraDistance}:{id:VariantId;time:number;resetToken:number;cameraDistance:number}) {
  // The user explicitly selected the complete original as liquid-waves' base.
  // Its authored treatment remains illustrative, never a new calculated result.
  const fullBase = id === 'liquid-waves'
  // Pressure-only reuses the original dry-ice addition/cap/release animation,
  // held before the original water delivery. This remains authored imagery.
  const pressureOnly = id === 'pressure-only'
  const contextTime = Math.max(0, Math.min(fullBase ? 90 : pressureOnly ? 57 : 38, time))
  // Explicitly requested authored movie endings, not calculated extinction.
  // This uses the export's public layer prop only in these new alternatives.
  const fire = id === 'sublimation-injection' ? time < 86 : fullBase ? time < 89 : true
  const original = FireSequenceScene({time:contextTime,mode:'rapid',view:'natural',layers:{fire,gas:fullBase || pressureOnly,water:fullBase,anatomy:true},resetToken,realistic:true,straightBore:true,cinematic:true,connectedSupply:true,cameraDistance})
  const scene = id === 'nanoparticles' ? original : cloneElement(original, undefined,
    original.props.children,
    <group key="alternative-world-cues" userData={{alternative:id,illustrative:true}}><AlternativeMethodCues id={id} time={time}/></group>)
  return <div className="alternative-scene-composition" data-method={id} data-presentation-active={time >= 38} data-original-animation="fire-spread-and-drilling" data-original-context-time={contextTime} data-original-replay={fullBase?'full-authored-base':pressureOnly?'authored-gas-release-no-water':'introduction'} data-presentation-space="original-world">
    {scene}
  </div>
}
