import {describe,it,expect} from 'vitest'
import {CoupledTransport,coupledScenario,LAB_DEFAULT_COUPLED} from '../src/coupled/model'
import {co2SolidU} from '../src/coupled/thermodynamics'
const center={xM:4.4,yM:4,depthM:1.3}
function empty(fidelity:'preview'|'precision20480'='preview'){const scenario=coupledScenario({...LAB_DEFAULT_COUPLED,fidelity,dryIceKg:0,heaterW:0,reaction:false,mechanics:false,cap:false});scenario.source.enabled=false;return new CoupledTransport(scenario,true)}
describe('conservative finite-source insertion',()=>{
 it('imports mass and internal energy without erasing prior state or elapsed time',()=>{
  const sim=empty();sim.advance(2);const mass=sim.totalMass(),energy=sim.totalEnergy(),heater=sim.ledger.heaterJ,steps=sim.ledger.steps,oxygen=sim.gas[0].slice()
  sim.insertDryIce(4,194.65,center)
  expect(sim.time).toBe(2);expect(sim.ledger.steps).toBe(steps);expect(sim.ledger.heaterJ).toBe(heater)
  expect(sim.totalMass()-mass).toBeCloseTo(4,8);expect(sim.gas[0]).toEqual(oxygen)
  expect(sim.totalEnergy()-energy).toBeCloseTo(4*co2SolidU(194.65)+(sim.ledger.insertionWorkJ??0),3)
  expect(sim.ledger.insertionWorkJ).toBeGreaterThan(0);expect(Math.abs(sim.ledger.massResidualKg)).toBeLessThan(1e-7);expect(Math.abs(sim.ledger.energyResidualJ)).toBeLessThan(1e-4)
  sim.advance(2);expect(sim.dryIce).toBeLessThan(4);expect(Math.abs(sim.ledger.massResidualKg)).toBeLessThan(1e-7);expect(Math.abs(sim.ledger.energyResidualJ)).toBeLessThan(1e-4)
 })
 it('restores placement geometry and import ledger with the checkpoint',()=>{
  const sim=empty(),before=sim.checkpoint();sim.insertDryIce(4,194.65,{xM:3,yM:3,depthM:1});sim.restore(before)
  expect(sim.checkpoint()).toEqual(before)
 })
 it('rejects unsupported insertions without changing accepted state',()=>{
  const sim=empty(),before=sim.checkpoint()
  for(const mass of [NaN,-1,21])expect(()=>sim.insertDryIce(mass,194.65,center)).toThrow()
  expect(()=>sim.insertDryIce(4,300,center)).toThrow();expect(()=>sim.insertDryIce(4,194.65,{...center,depthM:0})).toThrow()
  expect(sim.checkpoint()).toEqual(before)
  sim.insertDryIce(4,194.65,center);const accepted=sim.checkpoint();expect(()=>sim.insertDryIce(4,194.65,center)).toThrow();expect(sim.checkpoint()).toEqual(accepted)
 })
 it('rolls back a placement that exceeds local pore capacity',()=>{
  const sim=empty('precision20480'),before=sim.checkpoint()
  expect(()=>sim.insertDryIce(20,194.65,{xM:4.125,yM:4.125,depthM:1.36})).toThrow()
  expect(sim.checkpoint()).toEqual(before)
 })
 it('keeps the ignition source fixed until its schedule has ended',()=>{
  const sim=empty();sim.scenario.source.enabled=true;sim.scenario.source.startTimeS=0;sim.scenario.source.durationS=30
  const before=sim.checkpoint();expect(()=>sim.insertDryIce(4,194.65,center)).toThrow(/ignition/);expect(sim.checkpoint()).toEqual(before)
  sim.scenario.source.startTimeS=100;expect(()=>sim.insertDryIce(4,194.65,center)).toThrow(/ignition/)
 })
})
