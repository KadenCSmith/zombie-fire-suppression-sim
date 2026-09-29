import {describe,it,expect} from 'vitest'
import * as transport from '../../../src/physics-next/transport/index'
import {mixtureViscosityPaS,gasMixtureState,maxwellStefanFlux,gasFaceFlux,
 trialGasColumn,stefanBinaryFilmMolPerM2S,type GasTransportInput,type GasFace}
 from '../../../src/physics-next/transport/gasMixture'

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

const gp:GasTransportInput={
 pureViscosityPaS:[2e-5,1.5e-5,1.8e-5,1e-5,1.7e-5],
 binaryDiffusionM2S:Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>i===j?0:2e-5)),
 meanFreePathM:1e-8,minTemperatureK:150,maxTemperatureK:1100,minPressurePa:1000,maxPressurePa:300000,
 maxMach:0.1,maxKnudsen:0.01,maxPoreReynolds:1,thermalDiffusion:'neglected-explicitly',
 evidence:'Synthetic transport fixture; not material coefficients',
}
const gf:GasFace={a:0,b:1,areaM2:1,distanceM:1,permeabilityM2:1e-14,gasPorosity:0.5,
 poreDiameterM:1e-3,diffusionScale:0.2,heatConductanceWK:0}

describe('gas: five-species mass-frame transport and Darcy guards',()=>{
 it('matches ideal-gas mixture density and pure-species viscosity',()=>{
  const m=testModel(),s=testCell(m,{O2:0,N2:0.2}),v=gasMixtureState(m,s)
  expect(v.densityKgM3).toBeCloseTo(v.pressurePa*m.registry.N2.molarMassKgMol!/(R*v.temperatureK),12)
  expect(mixtureViscosityPaS([0,0,1,0,0],GAS_IDS.map(id=>m.registry[id].molarMassKgMol!),gp.pureViscosityPaS)).toBeCloseTo(gp.pureViscosityPaS[2],14)
  expect(v.soundSpeedMS).toBeGreaterThan(0)
 })
 it('rejects unnormalized compositions and missing/asymmetric diffusion properties',()=>{
  const m=testModel(),s=testCell(m)
  expect(()=>mixtureViscosityPaS([1,1,0,0,0],[1,1,1,1,1],[1,1,1,1,1])).toThrow()
  const d=gp.binaryDiffusionM2S.map(row=>[...row]);d[0][1]*=2
  expect(()=>gasFaceFlux(m,s,s,0,0,0,gf,{...gp,binaryDiffusionM2S:d})).toThrow(/symmetry/)
  expect(()=>gasFaceFlux(m,s,s,0,0,0,gf,{...gp,evidence:''})).toThrow()
 })
 it('has zero advection and diffusion in a uniform horizontal state',()=>{
  const m=testModel(),s=testCell(m,{CO2:0.01,H2O:0.001,CO:0.005})
  const f=gasFaceFlux(m,s,s,0,0,0,gf,gp)
  for(const v of f.speciesMolPerS)expect(Math.abs(v)).toBe(0)
  expect(Math.abs(f.enthalpyW)).toBe(0)
 })
 it('solves binary mass-frame diffusion with zero net diffusive mass',()=>{
  const m=testModel(),mass=GAS_IDS.map(id=>m.registry[id].molarMassKgMol!)
  const f=maxwellStefanFlux([0.4,0,0.6,0,0],mass,gp.binaryDiffusionM2S,10,[0.2,0,-0.2,0,0])
  expect(f[0]).toBeLessThan(0);expect(f[2]).toBeGreaterThan(0)
  expect(Math.abs(f.reduce((s,v,i)=>s+v*mass[i],0))).toBeLessThan(1e-14)
  for(const i of [1,3,4])expect(Math.abs(f[i])).toBe(0)
 })
 it('recovers the local Stefan stagnant-carrier law after frame transformation',()=>{
  const m=testModel(),mass=GAS_IDS.map(id=>m.registry[id].molarMassKgMol!)
  const xA=0.4,c=10,gradient=-0.2
  const j=maxwellStefanFlux([xA,0,1-xA,0,0],mass,gp.binaryDiffusionM2S,c,[gradient,0,-gradient,0,0])
  const velocity=-j[2]/(c*(1-xA))
  expect(j[0]+c*xA*velocity).toBeCloseTo(-c*2e-5*gradient/(1-xA),13)
  expect(j[2]+c*(1-xA)*velocity).toBeCloseTo(0,15)
 })
 it('matches the exact integrated Stefan log law and dilute limit',()=>{
  expect(stefanBinaryFilmMolPerM2S(40,2e-5,0.1,0.5,0.1)).toBeCloseTo(40*2e-5/0.1*Math.log(0.9/0.5),14)
  expect(stefanBinaryFilmMolPerM2S(40,2e-5,0.1,1e-7,0)/(40*2e-5/0.1*1e-7)).toBeCloseTo(1,6)
  expect(stefanBinaryFilmMolPerM2S(40,0,0.1,0.5,0.1)).toBe(0)
  expect(()=>stefanBinaryFilmMolPerM2S(40,2e-5,0.1,1,0.1)).toThrow(/pure/)
 })
 it('balances an isothermal one-species barometric column',()=>{
  const m=testModel(),T=300,z=1,pressure=60000
  const pa=testCell(m,{O2:0,N2:0.2},T,pressure)
  const pb=testCell(m,{O2:0,N2:0.2},T,pressure*Math.exp(m.registry.N2.molarMassKgMol!*9.81*z/(R*T)))
  const f=gasFaceFlux(m,pa,pb,0,z,9.81,gf,gp)
  expect(Math.abs(f.darcyVelocityMS)).toBeLessThan(1e-15)
  for(const v of f.speciesMolPerS)expect(Math.abs(v)).toBeLessThan(1e-12)
 })
 it('balances each species in a gravitationally segregated isothermal mixture',()=>{
  const m=testModel(),a=testCell(m,{O2:0.02,CO2:0.05,CO:0.01,H2O:0.001}),T=300
  const v=gasMixtureState(m,a),mass:Partial<Record<SpeciesId,number>>={}
  let pb=0
  GAS_IDS.forEach((id,i)=>{
   const factor=Math.exp(m.registry[id].molarMassKgMol!*9.81/(R*T))
   mass[id]=a.massKg[speciesIndex(id)]*factor
   pb+=v.pressurePa*v.moleFractions[i]*factor
  })
  const b=testCell(m,mass,T,pb),f=gasFaceFlux(m,a,b,0,1,9.81,gf,gp)
  expect(Math.abs(f.darcyVelocityMS)).toBeLessThan(1e-14)
  for(const rate of f.speciesMolPerS)expect(Math.abs(rate)).toBeLessThan(1e-11)
 })
 it('conserves every species and energy in a closed diffusing two-cell system',()=>{
  const m=testModel(),a=testCell(m,{CO2:0.04,CO:0.02,H2O:0.002}),b=testCell(m,{CO2:0.01,CO:0.001,H2O:0.001})
  const saved=[a,b].map(s=>checkpointChemistryCell(m,s))
  const tr=trialGasColumn(m,[a,b],[0,0],[{...gf,permeabilityM2:0}],[gp],0.01,0)
  for(const residual of tr.speciesResidualMol)expect(Math.abs(residual)).toBeLessThan(1e-11)
  expect(Math.abs(tr.energyResidualJ)).toBeLessThan(1e-7)
  expect([a,b].map(s=>checkpointChemistryCell(m,s))).toEqual(saved)
  expect(tr.next[0].massKg).not.toBe(a.massKg)
 })
 it('carries the fifth CO species without putting it into background N2',()=>{
  const m=testModel(),a=testCell(m,{CO:0.02}),b=testCell(m,{CO:0.001})
  const f=gasFaceFlux(m,a,b,0,0,0,{...gf,permeabilityM2:0},gp)
  expect(f.speciesMolPerS[4]).toBeGreaterThan(0)
  expect(f.speciesMolPerS.length).toBe(5)
 })
 it('supports heat-only transfer without changing inventories',()=>{
  const m=testModel(),a=testCell(m,{},301),b=testCell(m,{},300)
  const tr=trialGasColumn(m,[a,b],[0,0],[{...gf,permeabilityM2:0,diffusionScale:0,heatConductanceWK:10}],[gp],0.1,0)
  expect(tr.next[0].massKg).toEqual(a.massKg)
  expect(tr.next[0].thermalEnergyJ).toBeCloseTo(a.thermalEnergyJ-1,7)
  expect(tr.next[1].thermalEnergyJ).toBeCloseTo(b.thermalEnergyJ+1,7)
 })
 it('rejects noncontinuum pores, excessive Darcy velocity and invalid material range',()=>{
  const m=testModel(),a=testCell(m,{},300,100000),b=testCell(m,{},300,10000)
  expect(()=>gasFaceFlux(m,a,b,0,0,0,{...gf,poreDiameterM:1e-9},gp)).toThrow(/applicability/)
  expect(()=>gasFaceFlux(m,a,b,0,0,0,{...gf,permeabilityM2:1},gp)).toThrow(/applicability/)
  expect(()=>gasFaceFlux(m,a,b,0,0,0,gf,{...gp,minTemperatureK:310})).toThrow()
 })
 it('rejects an oversized diffusive step without changing either state',()=>{
  const m=testModel(),a=testCell(m,{CO2:0.02}),b=testCell(m,{CO2:0.0001})
  const saved=[a,b].map(s=>checkpointChemistryCell(m,s))
  expect(()=>trialGasColumn(m,[a,b],[0,0],[{...gf,permeabilityM2:0}],[gp],1e6,0)).toThrow(/budget/)
  expect([a,b].map(s=>checkpointChemistryCell(m,s))).toEqual(saved)
 })
 it('has zero exchange when both diffusion and permeability vanish',()=>{
  const m=testModel(),a=testCell(m,{CO2:0.02}),b=testCell(m,{CO2:0.001})
  const tr=trialGasColumn(m,[a,b],[0,0],[{...gf,permeabilityM2:0,diffusionScale:0}],[gp],1,0)
  expect(tr.next.map(s=>checkpointChemistryCell(m,s))).toEqual([a,b].map(s=>checkpointChemistryCell(m,s)))
 })
 it('replays a transport trial deterministically and keeps clocks unchanged',()=>{
  const m=testModel(),a=testCell(m,{CO:0.02}),b=testCell(m,{CO:0.001})
  const tr=()=>trialGasColumn(m,[a,b],[0,0],[{...gf,permeabilityM2:0}],[gp],0.01,0)
  expect(tr().next.map(s=>checkpointChemistryCell(m,s))).toEqual(tr().next.map(s=>checkpointChemistryCell(m,s)))
  expect(tr().next[0].timeS).toBe(a.timeS)
 })
 it('rejects duplicate faces and bad forcing even for an otherwise empty transfer',()=>{
  const m=testModel(),s=testCell(m)
  expect(()=>trialGasColumn(m,[s,s],[0,0],[gf,gf],[gp,gp],0,0)).toThrow(/duplicate/)
  expect(()=>maxwellStefanFlux([1,0,0,0,0],[1,1,1,1,1],gp.binaryDiffusionM2S,10,[1,0,0,0,0])).toThrow(/sum/)
  const d=new Float64Array(SPECIES_IDS.length)
  const c=exchangeCellInventory(m,s,d,0)
  expect(checkpointChemistryCell(m,c)).toBe(checkpointChemistryCell(m,s))
 })
})

describe('final transport interface audit',()=>{
 it('validates all MS diffusion coefficients before solving, including unused diagonals',()=>{
  const x=[0.5,0,0.5,0,0],mass=[0.032,0.044,0.028,0.018,0.028],d=[0.1,0,-0.1,0,0]
  const bad=gp.binaryDiffusionM2S.map(row=>row.slice());bad[4][4]=1
  expect(()=>maxwellStefanFlux(x,mass,bad,20,d)).toThrow(/diagonal/)
  expect(()=>maxwellStefanFlux(x,mass,bad.slice(1),20,d)).toThrow(/dimensions/)
  expect(()=>maxwellStefanFlux(x,mass,gp.binaryDiffusionM2S,20,[NaN,0,0,0,0])).toThrow()
 })
})

describe('barrel and operator handoff smoke tests',()=>{
 it('exports all five independently owned operator families without registration side effects',()=>{
  expect(transport.trialGasColumn).toBe(trialGasColumn)
  expect(typeof transport.advanceChemistryCell).toBe('function')
  expect(typeof transport.trialWaterColumn).toBe('function')
  expect(typeof transport.trialAtmosphericBoundary).toBe('function')
  expect(typeof transport.trialDryIce).toBe('function')
 })
 it('conserves a closed water-then-gas split, preserves clocks and replays from saved inputs',()=>{
  const m=testModel(),initial=[testCell(m,{liquidWater:0.2,H2O:0.0001}),
    testCell(m,{liquidWater:0.1,H2O:0.0002})]
  const initialText=initial.map(s=>checkpointChemistryCell(m,s)),dt=0.01
  const wp={retention:{alphaPerPa:1e-4,n:2,poreConnectivity:0.5,residualSaturation:0.05,
    suctionCapPa:1e6},vaporConductanceKgPaS:1e-8,phaseRelaxationPerS:0,freezingTemperatureK:273.15}
  const step=(states:readonly ChemistryCellState[])=>{
    const w=transport.trialWaterColumn(m,states,[0,0],[wp,wp],[],dt,0)
    return trialGasColumn(m,w.next,[0,0],[{...gf,permeabilityM2:0}],[gp],dt,0).next
  }
  const next=step(initial),restored=initialText.map(s=>transport.restoreChemistryCell(m,s))
  expect(next.map(s=>checkpointChemistryCell(m,s))).toEqual(step(restored).map(s=>checkpointChemistryCell(m,s)))
  const u=(states:readonly ChemistryCellState[])=>states.reduce((v,s)=>v+inspectChemistryCell(m,s).totalInternalEnergyJ,0)
  const waterKg=(states:readonly ChemistryCellState[])=>states.reduce((v,s)=>v+
    s.massKg[speciesIndex('liquidWater')]+s.massKg[speciesIndex('ice')]+s.massKg[speciesIndex('H2O')],0)
  expect(u(next)).toBeCloseTo(u(initial),7)
  expect(waterKg(next)).toBeCloseTo(waterKg(initial),12)
  expect(next.every(s=>s.timeS===0)).toBe(true)
  expect(initial.map(s=>checkpointChemistryCell(m,s))).toEqual(initialText)
  expect(next[0].massKg).not.toBe(initial[0].massKg)
  expect(next[0].referenceReactantKg).not.toBe(initial[0].referenceReactantKg)
 })
})
