/** A series of elastic bar elements and one irreversible mode-I cohesive interface.
 * Prescribed weak plane, free lateral contraction, small bulk strain, quasi-static.
 * It predicts conditional force/opening, not an unconstrained spatial crack path.
 */
export interface TensileInputs { strengthPa: number; fractureEnergyJm2: number; youngsPa: number; interfaceStiffnessPam: number; lengthM: number; diameterM: number; elements: number; increments: number }
export interface TensileFrame { stage: number; extensionM: number; openingM: number; tractionPa: number; forceN: number; damage: number; externalWorkJ: number; storedEnergyJ: number; fractureDissipationJ: number; energyResidualJ: number; bulkStrain: number }
export const DEFAULT_TENSILE: TensileInputs = { strengthPa:4250,fractureEnergyJm2:5,youngsPa:1e6,interfaceStiffnessPam:1e8,lengthM:0.1,diameterM:0.066,elements:4,increments:100 }
export const KRIMPEN_EVIDENCE = {
  id:'krimpen-woody-peat-abebaw-2005-via-okelly-2017',
  material:'Krimpen woody peat · horizontal specimens',
  waterContentDryMassPercent:[460,570],sampleDepthM:[0.5,0.9],lengthM:0.1,diameterM:0.066,
  loadingRateStrainPerHour:0.12,
  unsubmergedStrengthPa:[3500,5000],submergedStrengthPa:[0,2000],
  source:'https://doi.org/10.1680/jgere.17.00006',
  basis:'Reported laboratory ranges, four specimens, reviewed by O’Kelly (2017) from Abebaw (2005). No independent validation dataset or fracture-energy curve has been imported.',
}
export function tensileScales(p:TensileInputs) {
  if(Object.values(p).some(v=>!Number.isFinite(v)) || p.strengthPa<=0 || p.fractureEnergyJm2<=0 || p.youngsPa<=0 || p.interfaceStiffnessPam<=0 || p.lengthM<=0 || p.diameterM<=0 || !Number.isInteger(p.elements) || p.elements<2 || p.elements>64 || !Number.isInteger(p.increments) || p.increments<10 || p.increments>1000) throw new Error('Invalid tensile test inputs.')
  const initiationOpeningM=p.strengthPa/p.interfaceStiffnessPam
  const failureOpeningM=2*p.fractureEnergyJm2/p.strengthPa
  // Sum elastic-element compliance so a mesh change cannot alter fracture energy.
  let compliance=0
  for(let i=0;i<p.elements;i++) compliance+=(p.lengthM/p.elements)/p.youngsPa
  if(failureOpeningM<=initiationOpeningM+compliance*p.strengthPa) throw new Error('Snap-back under grip control: this quasi-static coupon cannot trace that unstable branch. Increase fracture energy or shorten/stiffen the specimen; a dynamic or arc-length solve is required.')
  if(p.strengthPa/p.youngsPa>0.02) throw new Error('Peak bulk strain exceeds 2%; a finite-strain material model is required.')
  return {initiationOpeningM,failureOpeningM,compliance,areaM2:Math.PI*p.diameterM**2/4,initiationExtensionM:initiationOpeningM+compliance*p.strengthPa}
}
export function runTensileFracture(p:TensileInputs,extensions?:readonly number[]):TensileFrame[] {
  const s=tensileScales(p),K=p.interfaceStiffnessPam,ft=p.strengthPa,dc=s.failureOpeningM,d0=s.initiationOpeningM,C=s.compliance
  let damage=0,maxExtension=0,previousExtension=0,previousTraction=0,workPerArea=0
  const envelope=(extension:number)=>{
    if(extension<=s.initiationExtensionM) { const opening=extension/(1+C*K);return {opening,traction:K*opening} }
    if(extension>=dc) return {opening:extension,traction:0}
    const opening=(extension-C*ft*dc/(dc-d0))/(1-C*ft/(dc-d0))
    return {opening,traction:ft*(dc-opening)/(dc-d0)}
  }
  const frames:TensileFrame[]=[]
  // Load beyond separation, then unload. This is a loading coordinate, not time.
  const targets=extensions??Array.from({length:2*p.increments+1},(_,stage)=>1.1*dc*(stage<=p.increments?stage/p.increments:2-stage/p.increments))
  if(targets.length<2 || targets[0]!==0 || targets.some(v=>!Number.isFinite(v)||v<0)) throw new Error('Extension history must start at zero and contain finite, nonnegative grip displacements. Compression/contact is not implemented.')
  for(let stage=0;stage<targets.length;stage++) {
    const target=targets[stage]
    const increasing=target>=previousExtension
    const breaks=[previousExtension,target]
    if(increasing) for(const boundary of [s.initiationExtensionM,dc,maxExtension]) if(boundary>previousExtension && boundary<target) breaks.push(boundary)
    breaks.sort((a,b)=>increasing?a-b:b-a)
    let opening=0,traction=0
    for(const extension of breaks.slice(1)) {
      if(extension>maxExtension) {
        const next=envelope(extension);opening=next.opening;traction=next.traction
        damage=opening>d0 ? Math.max(damage,Math.min(1,1-traction/(K*opening))) : damage
        maxExtension=extension
      } else { const stiffness=(1-damage)*K;opening=extension/(1+C*stiffness);traction=stiffness*opening }
      workPerArea+=0.5*(previousTraction+traction)*(extension-previousExtension)
      previousExtension=extension;previousTraction=traction
    }
    const maximum=envelope(maxExtension)
    const delta=maximum.opening
    const cohesiveEnvelopeWork=delta<=d0?0.5*K*delta**2:delta<dc?0.5*ft*d0+ft*(delta-d0)-0.5*ft*(delta-d0)**2/(dc-d0):p.fractureEnergyJm2
    const dissipationPerArea=cohesiveEnvelopeWork-0.5*maximum.traction*delta
    const storedPerArea=0.5*C*traction**2+0.5*traction*opening
    frames.push({stage,extensionM:target,openingM:opening,tractionPa:traction,forceN:traction*s.areaM2,damage,externalWorkJ:workPerArea*s.areaM2,storedEnergyJ:storedPerArea*s.areaM2,fractureDissipationJ:dissipationPerArea*s.areaM2,energyResidualJ:(workPerArea-storedPerArea-dissipationPerArea)*s.areaM2,bulkStrain:traction/p.youngsPa})
  }
  return frames
}
export interface TensileObservation { extensionM:number; forceN:number }
/** Compare the loading branch with measured points. No automatic 'validated' badge. */
export function compareTensileObservations(frames:TensileFrame[],observations:TensileObservation[]) {
  if(observations.length<3 || observations.some((o,i)=>!Number.isFinite(o.extensionM)||!Number.isFinite(o.forceN)||o.extensionM<0||o.forceN<0||(i>0&&o.extensionM<=observations[i-1].extensionM))) throw new Error('Provide at least three increasing, nonnegative extension/force observations.')
  const loading=frames.slice(0,(frames.length+1)/2)
  if(observations[0].extensionM<loading[0].extensionM || observations.at(-1)!.extensionM>loading.at(-1)!.extensionM) throw new Error('Observed extension exceeds the calculated loading range; no extrapolation is allowed.')
  let squared=0
  for(const o of observations) {
    const hi=Math.max(1,loading.findIndex(f=>f.extensionM>=o.extensionM)),a=loading[hi-1],b=loading[hi]
    const predicted=a.forceN+(b.forceN-a.forceN)*(o.extensionM-a.extensionM)/(b.extensionM-a.extensionM)
    squared+=(predicted-o.forceN)**2
  }
  const observedPeakN=Math.max(...observations.map(o=>o.forceN)),modeledPeakN=Math.max(...loading.map(f=>f.forceN))
  return {rmseN:Math.sqrt(squared/observations.length),observedPeakN,modeledPeakN,peakErrorN:modeledPeakN-observedPeakN,points:observations.length,note:'Interpolation comparison only. Source, matched conditions and calibration/holdout independence must be reviewed; this score is not automatic experimental validation.'}
}

/** Strict two-column loading data, with units converted at the boundary. */
export function parseTensileCsv(text:string):TensileObservation[] {
  if(text.length>1000000) throw new Error('CSV must be under 1 MB.')
  const lines=text.trim().split(/\r?\n/)
  if(lines.shift()?.trim()!=='extension_mm,force_N') throw new Error('CSV header must be extension_mm,force_N. Use the increasing loading branch.')
  if(lines.length>10000) throw new Error('Use at most 10,000 loading observations.')
  return lines.map(line=>{
    const cells=line.split(',')
    if(cells.length!==2||cells.some(c=>!c.trim())) throw new Error('Each row needs two numeric values.')
    return {extensionM:Number(cells[0])/1000,forceN:Number(cells[1])}
  })
}
