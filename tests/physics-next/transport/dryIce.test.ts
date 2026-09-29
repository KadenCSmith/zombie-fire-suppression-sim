import {describe,it,expect} from 'vitest'
import {dryIceSaturationPressurePa,createDryIceSource,inspectDryIceSource,dryIceGeometry,
 dryIceMassFluxKgM2S,trialDryIce,checkpointDryIceSource,restoreDryIceSource,type DryIceParameters}
 from '../../../src/physics-next/transport/dryIce'

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

const dp:DryIceParameters={
 densityKgM3:1500,solidCvJkgK:1000,solidConductivityWmK:0.1,coreMassFraction:0.5,
 referenceTemperatureK:190,referencePressurePa:60000,referenceSublimationEnthalpyJkg:5e5,
 heatTransferWm2K:2,exposedAreaFraction:1,gasFilmThicknessM:0.01,
 effectiveCO2CarrierDiffusionM2S:1e-5,interfaceMobilityKgM2PaS:1e-8,meanFreePathM:1e-8,
 maxKnudsen:0.01,maxMach:0.1,maxSourceTemperatureChangeK:5,carrierReduction:'co2-pseudobinary-explicit',
 evidence:'Synthetic constant-property source verification; not dry-ice or soil calibration',
}

describe('dry ice: finite two-node source within a rigid combined control volume',()=>{
 it('matches NIST Antoine units and rejects extrapolation instead of using liquid CO2',()=>{
  expect(dryIceSaturationPressurePa(190)).toBeCloseTo(1e5*10**(6.81228-1301.679/(190-3.494)),9)
  expect(dryIceSaturationPressurePa(190)).toBeGreaterThan(dryIceSaturationPressurePa(180))
  expect(()=>dryIceSaturationPressurePa(200)).toThrow(/Antoine/)
  expect(()=>dryIceSaturationPressurePa(216.58)).toThrow()
  expect(()=>dryIceSaturationPressurePa(150)).toThrow()
 })
 it('derives sphere size from mass and has finite internal thermal conductance',()=>{
  const g=dryIceGeometry(dp,1)
  expect(4/3*Math.PI*g.radiusM**3*dp.densityKgM3).toBeCloseTo(1,13)
  expect(g.coreToShellConductanceWK).toBeGreaterThan(0)
  expect(g.biot!).toBeGreaterThan(0)
 })
 it('round trips complete source energy, masses and parameter identity',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,190,180,0)
  expect(restoreDryIceSource(m,dp,checkpointDryIceSource(m,dp,s))).toEqual(s)
  expect(()=>restoreDryIceSource(m,{...dp,solidCvJkgK:1001},checkpointDryIceSource(m,dp,s))).toThrow(/configuration/)
 })
 it('sublimates into low-CO2 gas and conserves combined mass and energy',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,185,185,0),g=testCell(m,{},300)
  const beforeS=checkpointDryIceSource(m,dp,s),beforeG=checkpointChemistryCell(m,g)
  const t=trialDryIce(m,dp,s,g,0.01,0)
  expect(t.sublimatedKg).toBeGreaterThan(0);expect(t.depositedKg).toBe(0)
  expect(t.nextGas.massKg[speciesIndex('CO2')]).toBeGreaterThan(g.massKg[speciesIndex('CO2')])
  expect(Math.abs(t.massResidualKg)).toBeLessThan(1e-12)
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-6)
  expect(checkpointDryIceSource(m,dp,s)).toBe(beforeS);expect(checkpointChemistryCell(m,g)).toBe(beforeG)
 })
 it('deposits from supersaturated CO2 without manufacturing source mass or energy',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,180,180,0),g=testCell(m,{O2:0,N2:0.01,CO2:0.4},185)
  const t=trialDryIce(m,dp,s,g,0.01,0)
  expect(t.depositedKg).toBeGreaterThan(0);expect(t.sublimatedKg).toBe(0)
  expect(t.nextGas.massKg[speciesIndex('CO2')]).toBeLessThan(g.massKg[speciesIndex('CO2')])
  expect(inspectDryIceSource(m,dp,t.nextSource).massKg).toBeGreaterThan(1)
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-6)
 })
 it('reserves and releases source solid volume exactly once without changing host pore capacity',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,185,185,0),g=testCell(m)
  const t=trialDryIce(m,dp,s,g,0.01,0)
  const oldTotal=g.poreVolumeM3+1/dp.densityKgM3
  const newTotal=t.nextGas.poreVolumeM3+inspectDryIceSource(m,dp,t.nextSource).massKg/dp.densityKgM3
  expect(newTotal).toBeCloseTo(oldTotal,13)
  expect(t.releasedSourceVolumeM3).toBeCloseTo(t.sublimatedKg/dp.densityKgM3,15)
 })
 it('has zero phase flux at equilibrium',()=>{
  const m=testModel(),ts=185,p=60000,x=dryIceSaturationPressurePa(ts)/p
  const g=testCell(m,{O2:0,CO2:x*m.registry.CO2.molarMassKgMol!,N2:(1-x)*m.registry.N2.molarMassKgMol!},185,p)
  expect(Math.abs(dryIceMassFluxKgM2S(m,dp,ts,g))).toBeLessThan(1e-12)
 })
 it('has zero mass transfer for zero mobility or diffusion, without disabling heat exchange',()=>{
  const m=testModel(),g=testCell(m)
  for(const p of [{...dp,interfaceMobilityKgM2PaS:0},{...dp,effectiveCO2CarrierDiffusionM2S:0}]){
   const s=createDryIceSource(m,p,1,185,185,0),t=trialDryIce(m,p,s,g,0.01,0)
   expect(t.sublimatedKg).toBe(0);expect(t.depositedKg).toBe(0)
   expect(t.sourceHeatFromGasJ).toBeGreaterThan(0)
   expect(t.nextSource.coreKg+t.nextSource.shellKg).toBeCloseTo(1,13)
  }
 })
 it('has no external exchange for zero exposed area while preserving finite source inventory',()=>{
  const m=testModel(),p={...dp,exposedAreaFraction:0},s=createDryIceSource(m,p,1,185,185,0),g=testCell(m)
  const t=trialDryIce(m,p,s,g,1,0)
  expect(t.sublimatedKg).toBe(0);expect(t.sourceHeatFromGasJ).toBe(0)
  expect(checkpointChemistryCell(m,t.nextGas)).toBe(checkpointChemistryCell(m,g))
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-7)
 })
 it('matches the analytic two-node conduction temperature-difference decay',()=>{
  const m=testModel(),p={...dp,exposedAreaFraction:0},s=createDryIceSource(m,p,1,190,180,0),g=testCell(m)
  const dt=10,conductance=dryIceGeometry(p,1).coreToShellConductanceWK
  const t=trialDryIce(m,p,s,g,dt,0),v=inspectDryIceSource(m,p,t.nextSource)
  const expected=10*Math.exp(-conductance*dt*(1/(0.5*1000)+1/(0.5*1000)))
  expect(v.coreTemperatureK!-v.shellTemperatureK!).toBeCloseTo(expected,10)
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-6)
 })
 it('tracks core heater energy as external input, not chemical heat or unexplained energy',()=>{
  const m=testModel(),p={...dp,exposedAreaFraction:0},s=createDryIceSource(m,p,1,185,185,0),g=testCell(m)
  const t=trialDryIce(m,p,s,g,0.1,100)
  expect(t.externalHeaterJ).toBe(10)
  expect(inspectDryIceSource(m,p,t.nextSource).energyJ-inspectDryIceSource(m,p,s).energyJ).toBeCloseTo(10,6)
  expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-6)
 })
 it('gives monotone finite solid depletion over repeated supported sublimation steps',()=>{
  const m=testModel();let s=createDryIceSource(m,dp,1,185,185,0),g=testCell(m),last=1
  for(let i=0;i<30;i++){
   const t=trialDryIce(m,dp,s,g,0.01,0);s=t.nextSource;g=t.nextGas
   const mass=inspectDryIceSource(m,dp,s).massKg
   expect(mass).toBeLessThan(last);expect(mass).toBeGreaterThan(0);last=mass
   expect(Math.abs(t.massResidualKg)).toBeLessThan(1e-12)
  }
 })
 it('rejects excessive depletion, overheating and pure-CO2 film limits without partial commits',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,185,185,0),g=testCell(m),saved=checkpointDryIceSource(m,dp,s)
  expect(()=>trialDryIce(m,dp,s,g,1e6,0)).toThrow()
  expect(()=>trialDryIce(m,dp,s,g,1,1e9)).toThrow()
  expect(()=>dryIceMassFluxKgM2S(m,dp,185,testCell(m,{N2:0,O2:0,CO2:0.2}))).toThrow(/pure/)
  expect(checkpointDryIceSource(m,dp,s)).toBe(saved)
 })
 it('rejects high-pressure gas, noncontinuum films and absent calibration fields',()=>{
  const m=testModel()
  expect(()=>testCell(m,{},200,518500)).toThrow()
  expect(()=>createDryIceSource(m,{...dp,meanFreePathM:1},1,185,185,0)).toThrow(/continuum/)
  expect(()=>createDryIceSource(m,{...dp,evidence:''},1,185,185,0)).toThrow()
  const bad={...dp};Reflect.deleteProperty(bad,'solidCvJkgK')
  expect(()=>createDryIceSource(m,bad,1,185,185,0)).toThrow()
 })
 it('restarts coupled source and gas continuation deterministically',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,185,185,0),g=testCell(m)
  const t=trialDryIce(m,dp,s,g,0.01,0)
  const restored=restoreDryIceSource(m,dp,checkpointDryIceSource(m,dp,t.nextSource))
  const ga=exchangeCellInventory(m,t.nextGas,new Float64Array(SPECIES_IDS.length),0)
  const a=trialDryIce(m,dp,t.nextSource,t.nextGas,0.01,0),b=trialDryIce(m,dp,restored,ga,0.01,0)
  expect(checkpointDryIceSource(m,dp,a.nextSource)).toBe(checkpointDryIceSource(m,dp,b.nextSource))
  expect(checkpointChemistryCell(m,a.nextGas)).toBe(checkpointChemistryCell(m,b.nextGas))
 })
 it('handles empty source and zero dt without retained source energy or invisible heating',()=>{
  const m=testModel(),g=testCell(m),s=createDryIceSource(m,dp,0,185,185,0)
  const t=trialDryIce(m,dp,s,g,1,0)
  expect(t.sublimatedKg).toBe(0);expect(inspectDryIceSource(m,dp,t.nextSource).energyJ).toBe(0)
  expect(()=>trialDryIce(m,dp,s,g,1,1)).toThrow(/no source/)
  const full=createDryIceSource(m,dp,1,185,185,0),z=trialDryIce(m,dp,full,g,0,0)
  expect(z.nextSource).toEqual(full);expect(inspectChemistryCell(m,z.nextGas)).toEqual(inspectChemistryCell(m,g))
 })
})

describe('final source state audit',()=>{
 it('rejects extra state fields consistently before checkpointing or taking a trial',()=>{
  const m=testModel(),s=createDryIceSource(m,dp,1,190,190,0),extra={...s,untrackedEnergyJ:1}
  expect(()=>inspectDryIceSource(m,dp,extra)).toThrow(/fields/)
  expect(()=>checkpointDryIceSource(m,dp,extra)).toThrow(/fields/)
  expect(()=>trialDryIce(m,dp,extra,testCell(m),0,0)).toThrow(/fields/)
 })
})
