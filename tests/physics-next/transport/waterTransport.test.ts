import { describe, it, expect } from 'vitest'
import {
  waterRetention, liquidFaceMassRateKgS, trialWaterColumn,
  type WaterCellInput, type LiquidFace,
} from '../../../src/physics-next/transport/waterTransport'

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

const parameters: WaterCellInput = {
  retention:{alphaPerPa:1e-4,n:2,poreConnectivity:0.5,residualSaturation:0,suctionCapPa:1e6},
  vaporConductanceKgPaS:0,phaseRelaxationPerS:0,freezingTemperatureK:273.15,
}
const face: LiquidFace = {a:0,b:1,areaM2:1,distanceM:1,permeabilityM2:1e-12,viscosityPaS:1e-3}
describe('water: independent frozen-geometry closed columns',()=>{
  it('has bounded retention endpoints and decreasing suction',()=>{
    const a=waterRetention(0,parameters.retention), b=waterRetention(1,parameters.retention)
    expect(a.relativePermeability).toBe(0); expect(b.relativePermeability).toBe(1)
    expect(b.capillaryPressurePa).toBe(0)
    expect(waterRetention(0.2,parameters.retention).capillaryPressurePa)
      .toBeGreaterThan(waterRetention(0.8,parameters.retention).capillaryPressurePa)
    expect(()=>waterRetention(-0.1,parameters.retention)).toThrow()
    expect(()=>waterRetention(0.5,{...parameters.retention,n:1})).toThrow()
  })
  it('balances a no-flow hydrostatic column with downward-positive z',()=>{
    for(let i=0;i<8;i++) expect(liquidFaceMassRateKgS(1e5+9810*i,1e5+9810*(i+1),
      0.5,0.5,i,i+1,1000,9.81,face)).toBeCloseTo(0,15)
  })
  it('moves downward at uniform pressure and reverses on swapping oriented endpoints',()=>{
    const a=liquidFaceMassRateKgS(1e5,1e5,0.5,0.5,0,1,1000,9.81,face)
    const b=liquidFaceMassRateKgS(1e5,1e5,0.5,0.5,1,0,1000,9.81,face)
    expect(a).toBeGreaterThan(0); expect(a).toBe(-b)
  })
  it('returns exactly zero flux with zero intrinsic permeability or zero area',()=>{
    expect(liquidFaceMassRateKgS(1e5,2e5,1,1,0,1,1000,9.81,{...face,permeabilityM2:0})).toBe(0)
    expect(liquidFaceMassRateKgS(1e5,2e5,1,1,0,1,1000,9.81,{...face,areaM2:0})).toBe(0)
  })
  it('conserves water and internal plus gravitational energy in a closed column',()=>{
    const m=testModel(), cells=[testCell(m,{liquidWater:10}),testCell(m,{liquidWater:8})]
    const saved=cells.map(s=>checkpointChemistryCell(m,s))
    const trial=trialWaterColumn(m,cells,[0,1],[parameters,parameters],[face],0.1,9.81)
    expect(Math.abs(trial.totalWaterResidualKg)).toBeLessThan(1e-11)
    expect(Math.abs(trial.energyResidualJ)).toBeLessThan(1e-7)
    expect(cells.map(s=>checkpointChemistryCell(m,s))).toEqual(saved)
    expect(trial.next[0].massKg).not.toBe(cells[0].massKg)
  })
  it('preserves the entire state for zero dt and has no phase change when coefficients are zero',()=>{
    const m=testModel(), s=testCell(m,{liquidWater:1},270)
    const t=trialWaterColumn(m,[s],[0],[parameters],[],0,0)
    expect(checkpointChemistryCell(m,t.next[0])).toBe(checkpointChemistryCell(m,s))
    const x=trialWaterColumn(m,[s],[0],[parameters],[],10,0)
    expect(x.vaporKgDelta[0]).toBe(0); expect(x.frozenKg[0]===0).toBe(true)
  })
  it('freezes toward but not beyond the pure-water plateau with no added latent heat',()=>{
    const m=testModel(), s=testCell(m,{liquidWater:1},270)
    const t=trialWaterColumn(m,[s],[0],[{...parameters,phaseRelaxationPerS:1}],[],100,0)
    expect(t.frozenKg[0]).toBeGreaterThan(0)
    expect(inspectChemistryCell(m,t.next[0]).temperatureK).toBeGreaterThan(270)
    expect(inspectChemistryCell(m,t.next[0]).temperatureK<=273.15).toBe(true)
    expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-7)
    expect(t.freezeExpansionM3[0]).toBeCloseTo(t.frozenKg[0]*(1/900-1/1000),14)
  })
  it('melts with latent cooling and a negative freeze-expansion request',()=>{
    const m=testModel(), s=testCell(m,{ice:1},276)
    const t=trialWaterColumn(m,[s],[0],[{...parameters,phaseRelaxationPerS:1}],[],100,0)
    expect(t.frozenKg[0]).toBeLessThan(0)
    expect(inspectChemistryCell(m,t.next[0]).temperatureK).toBeLessThan(276)
    expect(inspectChemistryCell(m,t.next[0]).temperatureK>=273.15).toBe(true)
    expect(t.freezeExpansionM3[0]).toBeLessThan(0)
  })
  it('evaporates into undersaturated gas and cools without double-counting energy',()=>{
    const m=testModel(), s=testCell(m,{liquidWater:1},300)
    const t=trialWaterColumn(m,[s],[0],[{...parameters,vaporConductanceKgPaS:1e-8}],[],1,0)
    expect(t.vaporKgDelta[0]).toBeGreaterThan(0)
    expect(inspectChemistryCell(m,t.next[0]).temperatureK).toBeLessThan(300)
    expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-7)
  })
  it('condenses supersaturated vapor with warming and bounded inventory',()=>{
    const m=testModel(), s=testCell(m,{H2O:0.05,liquidWater:1},290)
    const t=trialWaterColumn(m,[s],[0],[{...parameters,vaporConductanceKgPaS:1e-7}],[],10,0)
    expect(t.vaporKgDelta[0]).toBeLessThan(0)
    expect(inspectChemistryCell(m,t.next[0]).temperatureK).toBeGreaterThan(290)
    for(const v of t.next[0].massKg) expect(v).toBeGreaterThanOrEqual(0)
  })
  it('bounds very large vapor requests at equilibrium, donor mass and available energy',()=>{
    const m=testModel(), s=testCell(m,{liquidWater:1},300)
    const t=trialWaterColumn(m,[s],[0],[{...parameters,vaporConductanceKgPaS:1}],[],1e6,0)
    expect(t.vaporKgDelta[0]).toBeGreaterThan(0); expect(t.vaporKgDelta[0]<=0.2).toBe(true)
    expect(Math.abs(t.energyResidualJ)).toBeLessThan(1e-7)
  })
  it('rejects an oversized face step atomically and rejects duplicate faces',()=>{
    const m=testModel(), cells=[testCell(m,{liquidWater:1},300,2e5),testCell(m,{liquidWater:1},300,1e4)]
    const saved=cells.map(s=>checkpointChemistryCell(m,s))
    expect(()=>trialWaterColumn(m,cells,[0,1],[parameters,parameters],[{...face,permeabilityM2:1}],1e3,0)).toThrow()
    expect(cells.map(s=>checkpointChemistryCell(m,s))).toEqual(saved)
    expect(()=>trialWaterColumn(m,cells,[0,1],[parameters,parameters],[face,face],0,0)).toThrow(/duplicate/)
  })
  it('replays the same complete water trial deterministically',()=>{
    const m=testModel(), cells=[testCell(m,{liquidWater:1},270),testCell(m,{liquidWater:1},300)]
    const p={...parameters,phaseRelaxationPerS:1,vaporConductanceKgPaS:1e-8}
    const a=trialWaterColumn(m,cells,[0,1],[p,p],[face],0.01,9.81)
    const b=trialWaterColumn(m,cells,[0,1],[p,p],[face],0.01,9.81)
    expect(a.next.map(s=>checkpointChemistryCell(m,s))).toEqual(b.next.map(s=>checkpointChemistryCell(m,s)))
  })
  it('uses shared exchange energy references for phase changes',()=>{
    const m=testModel(), s=testCell(m,{liquidWater:1})
    const delta=new Float64Array(SPECIES_IDS.length);delta[speciesIndex('liquidWater')]=-0.001;delta[speciesIndex('H2O')]=0.001
    const next=exchangeCellInventory(m,s,delta,0)
    expect(inspectChemistryCell(m,next).totalInternalEnergyJ).toBeCloseTo(inspectChemistryCell(m,s).totalInternalEnergyJ,7)
  })
})
