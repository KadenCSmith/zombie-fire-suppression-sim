import { R } from '../../coupled/thermodynamics'
import {
  GAS_IDS, SPECIES_IDS, speciesIndex, exchangeCellInventory, inspectChemistryCell,
  speciesEnthalpyJkg, ChemistryStepRejected,
  type ChemistryModel, type ChemistryCellState,
} from './chemistry'
import { gasMixtureState } from './gasMixture'

export interface AtmosphereInput {
  readonly temperatureK:number
  readonly pressurePa:number
  /** Wet mole fractions in GAS_IDS order, including explicit CO and H2O entries. */
  readonly moleFractions:readonly number[]
  /** Recorded forcing metadata; DOES NOT automatically determine film coefficients. */
  readonly windSpeedMS:number
}
export interface AtmosphericFilmInput {
  readonly areaM2:number
  /** One explicitly chosen common external mixing coefficient, m/s. */
  readonly gasFilmMPerS:number
  /** Superficial speed per pressure difference, m/(Pa s). */
  readonly pressureMobilityMPerPaS:number
  readonly heatFilmWm2K:number
  readonly openAreaFraction:number
  readonly filmThicknessM:number
  readonly meanFreePathM:number
  readonly maxMach:number
  readonly maxKnudsen:number
  readonly coefficientStatus:'uncalibrated-assumption'|'literature-input'|'measured'
  readonly evidence:string
}
function bounded(v:number,lo:number,hi:number,name:string):void{
  if(!Number.isFinite(v)||v<lo||v>hi)throw new Error(`boundary ${name}: outside [${lo},${hi}]`)
}
function positive(v:number,name:string):void{
  if(!Number.isFinite(v)||v<=0)throw new Error(`boundary ${name}: positive required`)
}
export interface AtmosphericFlux {
  readonly speciesOutMolPerS:Float64Array
  readonly massEnthalpyOutW:number
  readonly convectiveHeatOutW:number
  readonly energyOutW:number
  readonly superficialVelocityMS:number
  readonly inflowMoleFractions:Float64Array|null
  readonly coefficientStatus:AtmosphericFilmInput['coefficientStatus']
}
/** Outward is positive. External film coefficients never modify soil material inputs. */
export function atmosphericFlux(
  model:ChemistryModel,cell:ChemistryCellState,air:AtmosphereInput,film:AtmosphericFilmInput,
):AtmosphericFlux{
  const inside=gasMixtureState(model,cell),m=GAS_IDS.map(id=>model.registry[id].molarMassKgMol!)
  bounded(air.temperatureK,model.minTemperatureK,model.maxTemperatureK,'ambient T')
  bounded(air.pressurePa,model.minPressurePa,model.maxPressurePa,'ambient p')
  bounded(air.windSpeedMS,0,150,'wind')
  if(air.moleFractions.length!==5)throw new Error('boundary five wet mole fractions required')
  air.moleFractions.forEach(x=>bounded(x,0,1,'ambient fraction'))
  if(Math.abs(air.moleFractions.reduce((s,x)=>s+x,0)-1)>1e-12)throw new Error('boundary mole fractions must sum to one')
  bounded(film.areaM2,0,1e12,'area');bounded(film.gasFilmMPerS,0,1e6,'gas film')
  bounded(film.pressureMobilityMPerPaS,0,1,'pressure mobility')
  bounded(film.heatFilmWm2K,0,1e9,'heat film')
  positive(film.openAreaFraction,'open fraction');bounded(film.openAreaFraction,0,1,'open fraction')
  positive(film.filmThicknessM,'film thickness');bounded(film.meanFreePathM,0,1,'mean free path')
  positive(film.maxMach,'Mach limit');bounded(film.maxMach,0,0.1,'Mach limit')
  positive(film.maxKnudsen,'Kn limit');bounded(film.maxKnudsen,0,0.01,'Kn limit')
  if(!['uncalibrated-assumption','literature-input','measured'].includes(film.coefficientStatus)
    ||typeof film.evidence!=='string'||!film.evidence.trim())throw new Error('boundary coefficient evidence/status required')
  const outsideC=air.pressurePa/(R*air.temperatureK),meanC=(outsideC+inside.molarConcentrationMolM3)/2
  const x=inside.moleFractions.map((v,i)=>(v+air.moleFractions[i])/2),meanM=x.reduce((s,v,i)=>s+v*m[i],0)
  const uncorrected=inside.moleFractions.map((v,i)=>film.gasFilmMPerS*meanC*(v-air.moleFractions[i]))
  const massDrift=uncorrected.reduce((s,v,i)=>s+v*m[i],0)
  const diffusion=uncorrected.map((v,i)=>v-x[i]/meanM*massDrift)
  const velocity=film.pressureMobilityMPerPaS*(inside.pressurePa-air.pressurePa)
  const outsideM=air.moleFractions.reduce((s,v,i)=>s+v*m[i],0)
  const outsideCv=air.moleFractions.reduce((s,v,i)=>s+v*m[i]*model.caloric.species[GAS_IDS[i]].cvJkgK,0)/outsideM
  const outsideSound=Math.sqrt((1+R/(outsideM*outsideCv))*R*air.temperatureK/outsideM)
  if(Math.abs(velocity)/film.openAreaFraction/Math.min(inside.soundSpeedMS,outsideSound)>film.maxMach
    ||film.meanFreePathM/film.filmThicknessM>film.maxKnudsen)throw new ChemistryStepRejected('boundary low-Mach/continuum guard')
  const donorX=velocity>=0?inside.moleFractions:air.moleFractions
  const donorC=velocity>=0?inside.molarConcentrationMolM3:outsideC
  const speciesOutMolPerS=Float64Array.from(x,(_,i)=>film.areaM2*(velocity*donorC*donorX[i]+diffusion[i]))
  const massEnthalpyOutW=speciesOutMolPerS.reduce((s,rate,i)=>s+rate*m[i]*speciesEnthalpyJkg(model,GAS_IDS[i],
    rate>=0?inside.temperatureK:air.temperatureK,rate>=0?inside.pressurePa:air.pressurePa),0)
  const convectiveHeatOutW=film.areaM2*film.heatFilmWm2K*(inside.temperatureK-air.temperatureK)
  const inward=speciesOutMolPerS.reduce((s,v)=>s+Math.max(0,-v),0)
  const inflowMoleFractions=inward===0?null:Float64Array.from(speciesOutMolPerS,v=>Math.max(0,-v)/inward)
  if(speciesOutMolPerS.some(v=>!Number.isFinite(v))||!Number.isFinite(massEnthalpyOutW+convectiveHeatOutW))throw new Error('boundary flux overflow')
  return {speciesOutMolPerS,massEnthalpyOutW,convectiveHeatOutW,energyOutW:massEnthalpyOutW+convectiveHeatOutW,
    superficialVelocityMS:velocity,inflowMoleFractions,coefficientStatus:film.coefficientStatus}
}
export interface AtmosphericBoundaryTrial {
  readonly next:ChemistryCellState
  readonly physicalDurationS:number
  readonly speciesOutMol:Float64Array
  readonly energyOutJ:number
  readonly convectiveHeatOutJ:number
  readonly massEnthalpyOutJ:number
  readonly speciesResidualMol:Float64Array
  readonly energyResidualJ:number
  readonly flux:AtmosphericFlux
}
/** Bounded single-face trial. Multiple boundary faces must share one gross-outflow budget. */
export function trialAtmosphericBoundary(
  model:ChemistryModel,input:ChemistryCellState,air:AtmosphereInput,film:AtmosphericFilmInput,dtS:number,
):AtmosphericBoundaryTrial{
  bounded(dtS,0,1e6,'dt')
  const flux=atmosphericFlux(model,input,air,film),m=GAS_IDS.map(id=>model.registry[id].molarMassKgMol!)
  const speciesOutMol=Float64Array.from(flux.speciesOutMolPerS,v=>v*dtS)
  const delta=new Float64Array(SPECIES_IDS.length)
  for(let i=0;i<5;i++){
    const k=speciesIndex(GAS_IDS[i]),outKg=speciesOutMol[i]*m[i]
    if(outKg>model.controls.maxConsumedFraction*input.massKg[k])throw new ChemistryStepRejected('boundary outgoing budget; reduce dt')
    delta[k]=-outKg
  }
  const energyOutJ=dtS*flux.energyOutW,next=exchangeCellInventory(model,input,delta,-energyOutJ)
  const old=inspectChemistryCell(model,input),now=inspectChemistryCell(model,next)
  if(Math.abs(now.temperatureK-old.temperatureK)>model.controls.maxTemperatureChangeK)throw new ChemistryStepRejected('boundary temperature-change bound')
  const speciesResidualMol=Float64Array.from(GAS_IDS,(id,i)=>(next.massKg[speciesIndex(id)]-input.massKg[speciesIndex(id)])/m[i]+speciesOutMol[i])
  const energyResidualJ=now.totalInternalEnergyJ-old.totalInternalEnergyJ+energyOutJ
  if(speciesResidualMol.some((v,i)=>Math.abs(v)*m[i]>model.controls.massAbsoluteToleranceKg+
    model.controls.relativeTolerance*(input.massKg[speciesIndex(GAS_IDS[i])]+Math.abs(delta[speciesIndex(GAS_IDS[i])])) )
    ||Math.abs(energyResidualJ)>model.controls.energyAbsoluteToleranceJ+model.controls.relativeTolerance*
      (Math.abs(old.totalInternalEnergyJ)+Math.abs(now.totalInternalEnergyJ)+Math.abs(energyOutJ)))throw new ChemistryStepRejected('boundary ledger closure')
  return {next,physicalDurationS:dtS,speciesOutMol,energyOutJ,convectiveHeatOutJ:dtS*flux.convectiveHeatOutW,
    massEnthalpyOutJ:dtS*flux.massEnthalpyOutW,speciesResidualMol,energyResidualJ,flux}
}
