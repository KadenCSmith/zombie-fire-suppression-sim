import {
  SPECIES_IDS, speciesIndex, exchangeCellInventory, inspectChemistryCell,
  speciesInternalEnergyJkg, speciesEnthalpyJkg, ChemistryStepRejected,
  type ChemistryModel, type ChemistryCellState,
} from './chemistry'
import { gasMixtureState, stefanBinaryFilmMolPerM2S } from './gasMixture'
import { R } from '../../coupled/thermodynamics'

export const DRY_ICE_SCHEMA='agent-b-two-node-dry-ice-v1' as const
export interface DryIceParameters {
  readonly densityKgM3:number
  readonly solidCvJkgK:number
  readonly solidConductivityWmK:number
  readonly coreMassFraction:number
  readonly referenceTemperatureK:number
  readonly referencePressurePa:number
  /** h_g - h_s at the explicit reference point, J/kg, not an extra heat source. */
  readonly referenceSublimationEnthalpyJkg:number
  readonly heatTransferWm2K:number
  readonly exposedAreaFraction:number
  readonly gasFilmThicknessM:number
  readonly effectiveCO2CarrierDiffusionM2S:number
  readonly interfaceMobilityKgM2PaS:number
  readonly meanFreePathM:number
  readonly maxKnudsen:number
  readonly maxMach:number
  readonly maxSourceTemperatureChangeK:number
  readonly carrierReduction:'co2-pseudobinary-explicit'
  readonly evidence:string
}
export interface DryIceState {
  readonly schema:typeof DRY_ICE_SCHEMA
  readonly configurationKey:string
  readonly timeS:number
  readonly coreKg:number
  readonly shellKg:number
  readonly coreEnergyJ:number
  readonly shellEnergyJ:number
}
function bounded(v:number,lo:number,hi:number,name:string):void {
  if(!Number.isFinite(v)||v<lo||v>hi)throw new Error(`dry ice ${name}: outside [${lo},${hi}]`)
}
function positive(v:number,name:string):void {
  if(!Number.isFinite(v)||v<=0)throw new Error(`dry ice ${name}: positive required`)
}
/** NIST/Giauque-Egan Antoine fit, Pa. Valid ONLY 154.26–195.89 K. */
export function dryIceSaturationPressurePa(temperatureK:number):number {
  bounded(temperatureK,154.26,195.89,'Antoine temperature')
  return 1e5*10**(6.81228-1301.679/(temperatureK-3.494))
}
function validate(p:DryIceParameters):void {
  bounded(p.densityKgM3,1,1e5,'density');bounded(p.solidCvJkgK,1,1e6,'solid cv')
  bounded(p.solidConductivityWmK,0,1e4,'conductivity');bounded(p.coreMassFraction,0.01,0.99,'core fraction')
  bounded(p.referenceTemperatureK,154.26,195.89,'reference T');bounded(p.referencePressurePa,1000,300000,'reference p')
  bounded(p.referenceSublimationEnthalpyJkg,1,1e8,'sublimation enthalpy')
  bounded(p.heatTransferWm2K,0,1e9,'heat film');bounded(p.exposedAreaFraction,0,1,'area fraction')
  bounded(p.gasFilmThicknessM,1e-12,1e3,'film thickness');bounded(p.effectiveCO2CarrierDiffusionM2S,0,1,'binary D')
  bounded(p.interfaceMobilityKgM2PaS,0,1,'interface mobility');bounded(p.meanFreePathM,0,1,'mean free path')
  positive(p.maxKnudsen,'max Kn');bounded(p.maxKnudsen,0,0.01,'max Kn')
  positive(p.maxMach,'max Mach');bounded(p.maxMach,0,0.1,'max Mach')
  positive(p.maxSourceTemperatureChangeK,'temperature-change bound');bounded(p.maxSourceTemperatureChangeK,0,20,'temperature-change bound')
  if(p.carrierReduction!=='co2-pseudobinary-explicit'||typeof p.evidence!=='string'||!p.evidence.trim())throw new Error('dry ice explicit carrier/evidence required')
  if(p.meanFreePathM/p.gasFilmThicknessM>p.maxKnudsen)throw new Error('dry ice film outside continuum regime')
}
function config(model:ChemistryModel,p:DryIceParameters):string {
  validate(p)
  return JSON.stringify([DRY_ICE_SCHEMA,model.configurationKey,
    Object.keys(p).sort().map(k=>[k,p[k as keyof DryIceParameters]])])
}
function solidU(model:ChemistryModel,p:DryIceParameters,t:number):number {
  const reference=speciesEnthalpyJkg(model,'CO2',p.referenceTemperatureK,p.referencePressurePa)
    -p.referencePressurePa/p.densityKgM3-p.referenceSublimationEnthalpyJkg
  return reference+p.solidCvJkgK*(t-p.referenceTemperatureK)
}
export function inspectDryIceSource(
  model:ChemistryModel,p:DryIceParameters,s:DryIceState,
):{massKg:number;coreTemperatureK:number|null;shellTemperatureK:number|null;energyJ:number}{
  const keys=['schema','configurationKey','timeS','coreKg','shellKg','coreEnergyJ','shellEnergyJ']
  if(s===null||typeof s!=='object'||Array.isArray(s)||Object.keys(s).length!==keys.length
    ||keys.some(k=>!Object.hasOwn(s,k)))throw new Error('dry ice state fields')
  if(s.schema!==DRY_ICE_SCHEMA||s.configurationKey!==config(model,p))throw new Error('dry ice schema/configuration mismatch')
  bounded(s.timeS,0,1e12,'clock');bounded(s.coreKg,0,1e12,'core mass');bounded(s.shellKg,0,1e12,'shell mass')
  bounded(s.coreEnergyJ,-1e30,1e30,'core energy');bounded(s.shellEnergyJ,-1e30,1e30,'shell energy')
  const massKg=s.coreKg+s.shellKg,energyJ=s.coreEnergyJ+s.shellEnergyJ
  if(massKg===0){
    if(energyJ!==0||s.coreEnergyJ!==0||s.shellEnergyJ!==0)throw new Error('empty source retains energy')
    return {massKg,energyJ,coreTemperatureK:null,shellTemperatureK:null}
  }
  if(s.coreKg===0||s.shellKg===0||Math.abs(s.coreKg/massKg-p.coreMassFraction)>1e-12)throw new Error('dry ice remesh mass fraction')
  const uref=solidU(model,p,p.referenceTemperatureK)
  const coreTemperatureK=p.referenceTemperatureK+(s.coreEnergyJ/s.coreKg-uref)/p.solidCvJkgK
  const shellTemperatureK=p.referenceTemperatureK+(s.shellEnergyJ/s.shellKg-uref)/p.solidCvJkgK
  // Narrow caloric/pressure-fit domain; no liquid, superheated solid or EOS extrapolation.
  for(const t of [coreTemperatureK,shellTemperatureK])bounded(t,154.26,195.89,'solid temperature')
  for(const t of [154.26,195.89]){
    if(!(speciesInternalEnergyJkg(model,'CO2',t)>solidU(model,p,t)))throw new Error('nonpositive sublimation internal-energy gap')
  }
  return {massKg,energyJ,coreTemperatureK,shellTemperatureK}
}
export function createDryIceSource(
  model:ChemistryModel,p:DryIceParameters,massKg:number,coreTemperatureK:number,shellTemperatureK:number,timeS:number,
):DryIceState{
  bounded(massKg,0,1e12,'mass');bounded(coreTemperatureK,154.26,195.89,'core T');bounded(shellTemperatureK,154.26,195.89,'shell T')
  const coreKg=massKg*p.coreMassFraction,shellKg=massKg-coreKg
  const s={schema:DRY_ICE_SCHEMA,configurationKey:config(model,p),timeS:timeS===0?0:timeS,coreKg,shellKg,
    coreEnergyJ:coreKg===0?0:coreKg*solidU(model,p,coreTemperatureK),
    shellEnergyJ:shellKg===0?0:shellKg*solidU(model,p,shellTemperatureK)}
  inspectDryIceSource(model,p,s);return Object.freeze(s)
}
export function dryIceGeometry(p:DryIceParameters,massKg:number):{
  radiusM:number;exposedAreaM2:number;coreToShellConductanceWK:number;biot:number|null
}{
  validate(p);bounded(massKg,0,1e12,'geometry mass')
  if(massKg===0)return {radiusM:0,exposedAreaM2:0,coreToShellConductanceWK:0,biot:0}
  const radiusM=Math.cbrt(3*massKg/(4*Math.PI*p.densityKgM3)),ri=radiusM*Math.cbrt(p.coreMassFraction)
  const rc=0.75*ri,rs=0.75*(radiusM**4-ri**4)/(radiusM**3-ri**3)
  const coreToShellConductanceWK=4*Math.PI*p.solidConductivityWmK/(1/rc-1/rs)
  return {radiusM,exposedAreaM2:p.exposedAreaFraction*4*Math.PI*radiusM**2,coreToShellConductanceWK,
    biot:p.solidConductivityWmK===0?null:p.heatTransferWm2K*p.exposedAreaFraction*radiusM/(3*p.solidConductivityWmK)}
}
/**
 * Interface kinetic pressure-drop resistance in series with a pseudobinary Stefan film.
 * Returns kg/(m^2 s), positive sublimation. Empirical interface mobility is REQUIRED.
 * Pure-carrier-loss and unresolvable endpoint limits reject; no "explosion" branch.
 */
export function dryIceMassFluxKgM2S(
  model:ChemistryModel,p:DryIceParameters,surfaceTemperatureK:number,gas:ChemistryCellState,
):number{
  validate(p)
  const state=gasMixtureState(model,gas)
  if(state.pressurePa>=518500)throw new Error('dry ice liquid/high-pressure regimes unsupported')
  const ps=dryIceSaturationPressurePa(surfaceTemperatureK),pa=state.pressurePa*state.moleFractions[1]
  if(p.interfaceMobilityKgM2PaS===0||p.effectiveCO2CarrierDiffusionM2S===0)return 0
  if(state.moleFractions[1]>=1-1e-10)throw new Error('pure CO2 has no finite stagnant-carrier film')
  if(ps===pa)return 0
  const tf=(surfaceTemperatureK+state.temperatureK)/2,c=state.pressurePa/(R*tf),m=model.registry.CO2.molarMassKgMol!
  const film=(pi:number)=>m*stefanBinaryFilmMolPerM2S(c,p.effectiveCO2CarrierDiffusionM2S,p.gasFilmThicknessM,pi/state.pressurePa,pa/state.pressurePa)
  const kinetic=(pi:number)=>p.interfaceMobilityKgM2PaS*(ps-pi)
  let lo=Math.min(ps,pa),hi=Math.min(Math.max(ps,pa),state.pressurePa*(1-1e-12))
  if(hi<lo||kinetic(hi)-film(hi)>0)throw new ChemistryStepRejected('source film endpoint unresolved; unsupported regime')
  for(let i=0;i<70;i++){
    const mid=(lo+hi)/2
    if(kinetic(mid)-film(mid)>0)lo=mid;else hi=mid
  }
  const pi=(lo+hi)/2,k=kinetic(pi),f=film(pi)
  if(Math.abs(k-f)>1e-12+1e-10*Math.max(Math.abs(k),Math.abs(f)))throw new ChemistryStepRejected('interface/film balance failed')
  const rate=(k+f)/2,velocity=Math.abs(rate)/(state.molarConcentrationMolM3*m)
  if(velocity/state.soundSpeedMS>p.maxMach)throw new ChemistryStepRejected('source low-Mach guard')
  return rate
}
export interface DryIceTrial {
  readonly nextSource:DryIceState
  readonly nextGas:ChemistryCellState
  readonly physicalDurationS:number
  readonly sublimatedKg:number
  readonly depositedKg:number
  readonly sourceHeatFromGasJ:number
  readonly externalHeaterJ:number
  /** Already applied to nextGas.poreVolumeM3. Do NOT add this a second time. */
  readonly releasedSourceVolumeM3:number
  readonly massResidualKg:number
  readonly energyResidualJ:number
}
/**
 * Local phase change inside ONE rigid combined source+gas control volume.
 * Phase transfer carries u_g, not an external face h_g; no fictitious flow work.
 * gas.poreVolumeM3 MUST exclude this source's current solid volume on entry.
 * The sum gas-available pore volume + source solid volume is invariant.
 * No skeleton strain, cavity opening, pressure work or soil displacement is supplied.
 */
export function trialDryIce(
  model:ChemistryModel,p:DryIceParameters,inputSource:DryIceState,inputGas:ChemistryCellState,
  dtS:number,coreHeaterW:number,
):DryIceTrial{
  bounded(dtS,0,1e6,'dt');bounded(coreHeaterW,0,1e12,'heater')
  const old=inspectDryIceSource(model,p,inputSource),gasOld=inspectChemistryCell(model,inputGas)
  if(inputSource.timeS!==inputGas.timeS)throw new Error('source/gas clocks differ')
  const geometry=dryIceGeometry(p,old.massKg)
  const zero=new Float64Array(SPECIES_IDS.length)
  if(dtS===0)return {nextSource:Object.freeze({...inputSource}),nextGas:exchangeCellInventory(model,inputGas,zero,0),
    physicalDurationS:0,sublimatedKg:0,depositedKg:0,sourceHeatFromGasJ:0,externalHeaterJ:0,
    releasedSourceVolumeM3:0,massResidualKg:0,energyResidualJ:0}
  if(old.massKg===0){
    if(coreHeaterW!==0)throw new Error('heater has no source inventory')
    return {nextSource:Object.freeze({...inputSource}),nextGas:exchangeCellInventory(model,inputGas,zero,0),
      physicalDurationS:dtS,sublimatedKg:0,depositedKg:0,sourceHeatFromGasJ:0,externalHeaterJ:0,
      releasedSourceVolumeM3:0,massResidualKg:0,energyResidualJ:0}
  }
  const tc=old.coreTemperatureK!,ts=old.shellTemperatureK!,co2=speciesIndex('CO2')
  const rate=geometry.exposedAreaM2===0?0:dryIceMassFluxKgM2S(model,p,ts,inputGas)
  const dm=dtS*geometry.exposedAreaM2*rate
  if(dm>model.controls.maxConsumedFraction*inputSource.shellKg
    ||-dm>model.controls.maxConsumedFraction*inputGas.massKg[co2])throw new ChemistryStepRejected('source/gas mass budget; reduce whole dt')
  const heat=dtS*geometry.exposedAreaM2*p.heatTransferWm2K*(gasOld.temperatureK-ts)
  const heater=dtS*coreHeaterW
  const transferred=dm*speciesInternalEnergyJkg(model,'CO2',dm>=0?ts:gasOld.temperatureK)
  let mc=inputSource.coreKg,ms=inputSource.shellKg-dm
  let ec=inputSource.coreEnergyJ+heater,es=inputSource.shellEnergyJ+heat-transferred
  // Conservative two-volume remapping to fixed core fraction as the outer sphere changes.
  const target=p.coreMassFraction*(mc+ms),moved=mc-target
  if(moved>=0){const e=moved*ec/mc;ec-=e;es+=e}
  else{const e=(-moved)*es/ms;ec+=e;es-=e}
  ms+=moved;mc=target
  const uref=solidU(model,p,p.referenceTemperatureK)
  let tcore=p.referenceTemperatureK+(ec/mc-uref)/p.solidCvJkgK
  let tshell=p.referenceTemperatureK+(es/ms-uref)/p.solidCvJkgK
  // Exact conduction update for the remapped fixed masses; all other processes are explicit.
  const conductance=dryIceGeometry(p,mc+ms).coreToShellConductanceWK,cc=mc*p.solidCvJkgK,cs=ms*p.solidCvJkgK
  const mean=(cc*tcore+cs*tshell)/(cc+cs),difference=(tcore-tshell)*Math.exp(-conductance*dtS*(1/cc+1/cs))
  tcore=mean+cs/(cc+cs)*difference;tshell=mean-cc/(cc+cs)*difference
  const nextSource=Object.freeze({...inputSource,coreKg:mc,shellKg:ms,
    coreEnergyJ:mc*solidU(model,p,tcore),shellEnergyJ:ms*solidU(model,p,tshell)})
  let current:ReturnType<typeof inspectDryIceSource>
  try{current=inspectDryIceSource(model,p,nextSource)}
  catch(error){throw new ChemistryStepRejected(`source caloric domain: ${String(error)}`)}
  if(Math.abs(tcore-tc)>p.maxSourceTemperatureChangeK||Math.abs(tshell-ts)>p.maxSourceTemperatureChangeK)throw new ChemistryStepRejected('source temperature-change bound')
  zero[co2]=dm
  const releasedSourceVolumeM3=dm/p.densityKgM3
  const nextGas=exchangeCellInventory(model,inputGas,zero,transferred-heat,releasedSourceVolumeM3)
  const gasNow=inspectChemistryCell(model,nextGas)
  if(Math.abs(gasNow.temperatureK-gasOld.temperatureK)>model.controls.maxTemperatureChangeK)throw new ChemistryStepRejected('source gas temperature-change bound')
  const pco2=gasMixtureState(model,nextGas).pressurePa*gasMixtureState(model,nextGas).moleFractions[1]
  const newDriving=dryIceSaturationPressurePa(tshell)-pco2
  if(dm!==0&&Math.sign(newDriving)!==Math.sign(dm))throw new ChemistryStepRejected('source crossed mass-transfer equilibrium; reduce dt')
  const massResidualKg=current.massKg-old.massKg+nextGas.massKg[co2]-inputGas.massKg[co2]
  const energyResidualJ=current.energyJ-old.energyJ+gasNow.totalInternalEnergyJ-gasOld.totalInternalEnergyJ-heater
  const mtol=model.controls.massAbsoluteToleranceKg+model.controls.relativeTolerance*(old.massKg+inputGas.massKg[co2])
  const etol=model.controls.energyAbsoluteToleranceJ+model.controls.relativeTolerance*
    (Math.abs(old.energyJ)+Math.abs(current.energyJ)+Math.abs(gasOld.totalInternalEnergyJ)+Math.abs(gasNow.totalInternalEnergyJ)+Math.abs(heater))
  if(Math.abs(massResidualKg)>mtol||Math.abs(energyResidualJ)>etol)throw new ChemistryStepRejected('source/gas closure')
  return {nextSource,nextGas,physicalDurationS:dtS,sublimatedKg:Math.max(0,dm),depositedKg:Math.max(0,-dm),
    sourceHeatFromGasJ:heat,externalHeaterJ:heater,releasedSourceVolumeM3,massResidualKg,energyResidualJ}
}
export function checkpointDryIceSource(model:ChemistryModel,p:DryIceParameters,s:DryIceState):string{
  inspectDryIceSource(model,p,s);return JSON.stringify(s)
}
export function restoreDryIceSource(model:ChemistryModel,p:DryIceParameters,text:string):DryIceState{
  const value:unknown=JSON.parse(text)
  if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('dry ice checkpoint object required')
  const keys=['schema','configurationKey','timeS','coreKg','shellKg','coreEnergyJ','shellEnergyJ']
  if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new Error('dry ice checkpoint fields')
  const s=value as DryIceState;inspectDryIceSource(model,p,s);return Object.freeze({...s})
}
