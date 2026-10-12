import { describe, expect, it, vi } from 'vitest'
import { VibratoryFieldRun } from '../../../src/alternatives/vibratory-injection/field'

describe('4.2.4 experimental reacting field source',()=>{
  it('conserves finite imported liquid, enthalpy and water species while reacting',()=>{
    const run=new VibratoryFieldRun({endS:2,waterKg:.01})
    const state=run.advanceTo(2)
    expect(state.deliveredKg).toBeCloseTo(.01,12)
    expect(state.remainingKg).toBe(0)
    expect(state.addedWaterKg.reduce((a,b)=>a+b,0)).toBeCloseTo(.01,12)
    expect(Math.abs(state.massResidualKg)).toBeLessThan(1e-7)
    expect(Math.abs(state.energyResidualJ)).toBeLessThan(1e-4)
    expect(Math.abs(state.waterSpeciesResidualKg)).toBeLessThan(1e-7)
    expect(state.reactedFuelKg).toBeGreaterThan(0)
    expect(state.oxygenKg).toBeGreaterThan(0)
    expect(state.liquidFlowWorkJ).toBeGreaterThan(0)
  })
  it('has source-off equivalence to zero flow, with owned snapshots and independent runs',()=>{
    const a=new VibratoryFieldRun({enabled:false,endS:1}),b=new VibratoryFieldRun({flowKgS:0,endS:1})
    const state=a.advanceTo(1)
    expect(b.snapshot().timeS).toBe(0)
    expect(state).toEqual(b.advanceTo(1))
    state.frame.temperatureK[0]=9999
    expect(a.snapshot().frame.temperatureK[0]).not.toBe(9999)
    expect(a.snapshot().deliveredKg).toBe(0)
  })
  it('replays matching accepted checkpoints deterministically and rejects invalid time',()=>{
    const a=new VibratoryFieldRun({endS:2}),b=new VibratoryFieldRun({endS:2})
    a.advanceTo(.5);a.advanceTo(1)
    expect(a.advanceTo(2)).toEqual(b.advanceTo(2))
    expect(()=>a.advanceTo(1)).toThrow()
    expect(()=>a.advanceTo(Number.NaN)).toThrow()
  })
  it('doses actual shortened steps and restores the entire candidate on source failure',()=>{
    const short=new VibratoryFieldRun({endS:1})
    short.sim.scenario.model.maxStepS=.03125
    expect(short.advanceTo(1).deliveredKg).toBeCloseTo(.025,12)
    const rejected=new VibratoryFieldRun({endS:1}),before=rejected.snapshot()
    const resolve=rejected.sim.resolve.bind(rejected.sim),step=rejected.sim.step.bind(rejected.sim)
    let rejectSource=false
    vi.spyOn(rejected.sim,'step').mockImplementation(dt=>{const accepted=step(dt);rejectSource=true;return accepted})
    vi.spyOn(rejected.sim,'resolve').mockImplementation(()=>{resolve();if(rejectSource){rejectSource=false;rejected.sim.water[0]+=.01;rejected.sim.energy[0]+=20;throw new Error('Rejected source candidate')}})
    expect(()=>rejected.advanceTo(.125)).toThrow('Rejected source candidate')
    expect(rejected.snapshot()).toEqual(before)
  })
  it('reduces source-splitting differences under timestep refinement',()=>{
    const runs=[.125,.0625,.03125].map(stepS=>new VibratoryFieldRun({endS:2,stepS}))
    const states=runs.map(run=>run.advanceTo(2))
    // Renderer snapshots are Float32; use the owned double state for refinement.
    const difference=(a:VibratoryFieldRun,b:VibratoryFieldRun)=>Math.hypot(...a.sim.temperature.map((t,i)=>t-b.sim.temperature[i]))
    expect(difference(runs[1],runs[2])).toBeLessThan(difference(runs[0],runs[2]))
    for(const state of states)expect(state.deliveredKg).toBeCloseTo(.05,12)
    expect(states[0].rawMassResidualKg-states[0].deliveredKg).toBe(states[0].massResidualKg)
    expect(states[0].rawEnergyResidualJ-states[0].inletEnergyJ).toBe(states[0].energyResidualJ)
    // Three atlas preparations plus 112+ physical steps exceeded 5 s on CI.
  },20000)
  it('checks mesh and deposition-support sensitivity without asserting a treatment benefit',()=>{
    const configurations=[{nx:8,ny:4,nz:5,supportCells:1},{nx:16,ny:8,nz:10,supportCells:1},{nx:16,ny:8,nz:10,supportCells:2}]
    const runs=configurations.map(grid=>new VibratoryFieldRun({endS:1},grid))
    const totals=runs.map(run=>[run.sim.fuel,run.sim.water,run.sim.energy].map(a=>a.reduce((sum,v)=>sum+v,0)))
    for(let j=0;j<3;j++)expect(Math.abs(totals[0][j]/totals[1][j]-1)).toBeLessThan(1e-10)
    const states=runs.map(run=>run.advanceTo(1))
    for(const state of states){expect(state.deliveredKg).toBeCloseTo(.025,12);expect(Math.abs(state.massResidualKg)).toBeLessThan(1e-7);expect(Math.abs(state.energyResidualJ)).toBeLessThan(1e-4);expect(Number.isFinite(state.maximumK)).toBe(true)}
    expect(states[1].addedWaterKg).not.toEqual(states[2].addedWaterKg)
    console.log('C_FIELD_SENSITIVITY',states.map((s,i)=>({numerics:configurations[i],maximumK:s.maximumK,reactedFuelKg:s.reactedFuelKg,deliveredKg:s.deliveredKg})))
  })
  it('rolls back an inadmissible pure-liquid interface state',()=>{
    const run=new VibratoryFieldRun({endS:.125}),before=run.snapshot(),step=run.sim.step.bind(run.sim)
    vi.spyOn(run.sim,'step').mockImplementation(dt=>{const accepted=step(dt);run.sim.pressure.fill(100);return accepted})
    expect(()=>run.advanceTo(.125)).toThrow('Pure-liquid inlet')
    expect(run.snapshot()).toEqual(before)
  })
})
