import {describe,it,expect} from 'vitest'
import {atmosphericFlux,trialAtmosphericBoundary,type AtmosphereInput,type AtmosphericFilmInput}
 from '../../../src/physics-next/transport/boundaries'
import {gasMixtureState} from '../../../src/physics-next/transport/gasMixture'

import {
  SPECIES_IDS, GAS_IDS, speciesIndex, compileChemistryModel, createChemistryCell,
  inspectChemistryCell, checkpointChemistryCell, exchangeCellInventory,
  type ChemistryModel, type ChemistryCellState, type OrganicDefinitions, type MassVector,
  type SpeciesId, type SpeciesCaloricInput, type Evidence,
} from '../../../src/physics-next/transport/chemistry'
import { R } from '../../../src/coupled/thermodynamics'
const evidence: Evidence = { kind: 'synthetic-test', source: 'Manufactured conservation fixture',
  specimen: 'none', limits: 'No material calibration or treatment prediction' }
function testModel(): ChemistryModel {
  const organic = Object.fromEntries(['fuel','pyrolysate','charAlpha','charBeta'].map(id =>
    [id, {formula: {C:1,H:0,O:0,N:0}, evidence}])) as unknown as OrganicDefinitions
  const vector = Object.fromEntries(SPECIES_IDS.map(id =>
    [id, id === 'liquidWater' ? -1 : id === 'H2O' ? 1 : 0])) as unknown as MassVector
  const caloric = Object.fromEntries(SPECIES_IDS.map(id => [id, {
    cvJkgK: 3000, chemicalReferenceJkg: 0,
    phaseReferenceJkg: id === 'H2O' ? 2e6 : id === 'ice' ? -3e5 : 0, evidence,
  }])) as Record<SpeciesId, SpeciesCaloricInput>
  return compileChemistryModel(organic, [{id:'water', stage:'drying', stoichiometry:vector,
    kinetics:{preExponentialPerS:0,activationEnergyJMol:0,solidOrder:1,oxygenOrder:0,
      oxygenReferencePa:10000,minTemperatureK:150,maxTemperatureK:1200,minPressurePa:1000,maxPressurePa:300000},
    evidence}], {
    referenceTemperatureK:300,minTemperatureK:150,maxTemperatureK:1100,
    minPressurePa:1000,maxPressurePa:300000,liquidDensityKgM3:1000,iceDensityKgM3:900,
    species:caloric,evidence,
  }, {maxSubstepS:0.1,minSubstepS:1e-12,maxSubsteps:10000,maxBacktracks:40,
    maxConsumedFraction:0.2,maxTemperatureChangeK:5,massAbsoluteToleranceKg:1e-12,
    atomAbsoluteToleranceMol:1e-10,energyAbsoluteToleranceJ:1e-7,relativeTolerance:1e-12})
}
function testCell(model: ChemistryModel, changes: Partial<Record<SpeciesId,number>> = {},
  temperatureK=300, pressurePa=60000): ChemistryCellState {
  const values = {mineral:10,N2:0.2,O2:0.01,...changes}
  const massKg = Float64Array.from(SPECIES_IDS,id => values[id as keyof typeof values] ?? 0)
  const n = GAS_IDS.reduce((sum,id)=>sum+massKg[speciesIndex(id)]/model.registry[id].molarMassKgMol!,0)
  return createChemistryCell(model,{timeS:0,massKg,temperatureK,
    poreVolumeM3:n*R*temperatureK/pressurePa+massKg[speciesIndex('liquidWater')]/1000+massKg[speciesIndex('ice')]/900,
    referenceReactantKg:{water:100}})
}

const film:AtmosphericFilmInput={areaM2:1,gasFilmMPerS:1e-5,pressureMobilityMPerPaS:1e-9,
 heatFilmWm2K:5,openAreaFraction:0.5,filmThicknessM:0.01,meanFreePathM:1e-8,
 maxMach:0.1,maxKnudsen:0.01,coefficientStatus:'uncalibrated-assumption',
 evidence:'Manufactured boundary fixture; not calibrated wind/material coefficients'}
function atmosphere(m:ChemistryModel,s:ChemistryCellState):AtmosphereInput{
 const v=gasMixtureState(m,s);return {temperatureK:v.temperatureK,pressurePa:v.pressurePa,moleFractions:v.moleFractions,windSpeedMS:0}
}
describe('atmosphere: explicit open-system ledgers',()=>{
 it('gives zero mass and heat flux at equilibrium',()=>{
  const m=testModel(),s=testCell(m),f=atmosphericFlux(m,s,atmosphere(m,s),film)
  for(const v of f.speciesOutMolPerS)expect(Math.abs(v)).toBe(0)
  expect(Math.abs(f.energyOutW)).toBe(0);expect(f.inflowMoleFractions).toBe(null)
 })
 it('uses outward-positive heat and cools a warmer closed-to-mass surface',()=>{
  const m=testModel(),s=testCell(m,{},305),air={...atmosphere(m,s),temperatureK:300}
  const t=trialAtmosphericBoundary(m,s,air,{...film,gasFilmMPerS:0,pressureMobilityMPerPaS:0},0.1)
  expect(t.convectiveHeatOutJ).toBeCloseTo(2.5,10)
  expect(t.next.thermalEnergyJ).toBeCloseTo(s.thermalEnergyJ-2.5,7)
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-7)
 })
 it('warms the cell for negative outward convective heat',()=>{
  const m=testModel(),s=testCell(m),air={...atmosphere(m,s),temperatureK:310}
  const t=trialAtmosphericBoundary(m,s,air,{...film,gasFilmMPerS:0,pressureMobilityMPerPaS:0},0.1)
  expect(t.energyOutJ).toBeLessThan(0);expect(t.next.thermalEnergyJ).toBeGreaterThan(s.thermalEnergyJ)
 })
 it('records pressure-driven outflow as species loss with transported enthalpy',()=>{
  const m=testModel(),s=testCell(m),air={...atmosphere(m,s),pressurePa:50000}
  const t=trialAtmosphericBoundary(m,s,air,{...film,gasFilmMPerS:0,heatFilmWm2K:0},0.1)
  expect(t.speciesOutMol[2]).toBeGreaterThan(0)
  expect(t.next.massKg[speciesIndex('N2')]).toBeLessThan(s.massKg[speciesIndex('N2')])
  for(const v of t.speciesResidualMol)expect(Math.abs(v)).toBeLessThan(1e-11)
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-7)
 })
 it('uses specified ambient wet composition for pure advective inflow',()=>{
  const m=testModel(),s=testCell(m),x=[0.1,0.1,0.6,0.1,0.1]
  const air={...atmosphere(m,s),pressurePa:70000,moleFractions:x}
  const t=trialAtmosphericBoundary(m,s,air,{...film,gasFilmMPerS:0,heatFilmWm2K:0},0.1)
  for(let i=0;i<5;i++){
   expect(t.speciesOutMol[i]).toBeLessThan(0)
   expect(t.flux.inflowMoleFractions![i]).toBeCloseTo(x[i],13)
  }
  expect(t.flux.inflowMoleFractions!.reduce((a,b)=>a+b,0)).toBeCloseTo(1,13)
 })
 it('keeps the common film diffusion in a zero-net-mass frame',()=>{
  const m=testModel(),s=testCell(m,{CO2:0.02,CO:0.01,H2O:0.001})
  const air={...atmosphere(m,s),moleFractions:[0.2,0.02,0.76,0.01,0.01]}
  const f=atmosphericFlux(m,s,air,{...film,pressureMobilityMPerPaS:0,heatFilmWm2K:0})
  expect(Math.abs(f.speciesOutMolPerS.reduce((v,n,i)=>v+n*m.registry[GAS_IDS[i]].molarMassKgMol!,0))).toBeLessThan(1e-14)
 })
 it('does not infer film coefficients from wind speed or rewrite material coefficients',()=>{
  const m=testModel(),s=testCell(m),a=atmosphere(m,s),before=JSON.stringify(film)
  const f=atmosphericFlux(m,s,{...a,windSpeedMS:20},film)
  expect(f.coefficientStatus).toBe('uncalibrated-assumption')
  expect(JSON.stringify(film)).toBe(before)
  expect(f.speciesOutMolPerS).toEqual(atmosphericFlux(m,s,a,film).speciesOutMolPerS)
 })
 it('rejects missing CO/H2O fractions, invalid composition and unlabelled coefficients',()=>{
  const m=testModel(),s=testCell(m),a=atmosphere(m,s)
  expect(()=>atmosphericFlux(m,s,{...a,moleFractions:[0.2,0,0.8]},film)).toThrow()
  expect(()=>atmosphericFlux(m,s,{...a,moleFractions:[0.2,0,0.7,0,0]},film)).toThrow()
  expect(()=>atmosphericFlux(m,s,a,{...film,evidence:''})).toThrow()
 })
 it('has no hidden source for zero area or zero coefficients',()=>{
  const m=testModel(),s=testCell(m),air={...atmosphere(m,s),pressurePa:70000,temperatureK:305}
  for(const f of [{...film,areaM2:0},{...film,gasFilmMPerS:0,pressureMobilityMPerPaS:0,heatFilmWm2K:0}]){
   const t=trialAtmosphericBoundary(m,s,air,f,1)
   expect(checkpointChemistryCell(m,t.next)).toBe(checkpointChemistryCell(m,s))
   expect(Math.abs(t.energyOutJ)).toBe(0)
  }
 })
 it('rejects unsupported speed and excessive dt without modifying the input',()=>{
  const m=testModel(),s=testCell(m),air={...atmosphere(m,s),pressurePa:10000}
  const saved=checkpointChemistryCell(m,s)
  expect(()=>trialAtmosphericBoundary(m,s,air,{...film,pressureMobilityMPerPaS:1},1)).toThrow(/guard/)
  expect(()=>trialAtmosphericBoundary(m,s,air,{...film,gasFilmMPerS:0,heatFilmWm2K:0},1e6)).toThrow()
  expect(checkpointChemistryCell(m,s)).toBe(saved)
 })
 it('round trips a boundary result through the owned caloric state without extra sources',()=>{
  const m=testModel(),s=testCell(m),t=trialAtmosphericBoundary(m,s,atmosphere(m,s),film,0)
  const n=exchangeCellInventory(m,t.next,new Float64Array(SPECIES_IDS.length),0)
  expect(checkpointChemistryCell(m,n)).toBe(checkpointChemistryCell(m,s))
  expect(inspectChemistryCell(m,n).temperatureK).toBeCloseTo(300,12)
 })
})
