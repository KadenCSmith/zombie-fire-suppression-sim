import {describe,it,expect} from 'vitest'
import {phaseAt,equilibrate,T0,LF,saturationPressure,gasH,gasU,R} from '../src/coupled/thermodynamics'
import {CoupledTransport,coupledScenario,DEFAULT_COUPLED} from '../src/coupled/model'
function box(){const s=coupledScenario({...DEFAULT_COUPLED,dryIceKg:0,heaterW:0,reaction:false});s.domain={nx:4,ny:4,nz:4,widthM:1,lengthM:1,depthM:1};s.source.centerXM=s.source.centerYM=s.source.centerDepthM=0.5;s.peatRegions=[];s.hotRegions=[];s.root.amountKgM3=0;s.soilLayers=[{...s.soilLayers[0],thicknessM:1,moistureSaturationOffset:0,porosityOffset:0}];s.atmosphere.topGasBoundary='noFlux';s.atmosphere.sideGasBoundary='noFlux';s.atmosphere.surfaceHeatTransferWm2K=0;s.atmosphere.bottomHeatTransferWm2K=0;s.atmosphere.deepTemperatureC=s.atmosphere.temperatureC;return s}
describe('coupled caloric and transport reference',()=>{
 it('inverts energy through freezing, melting, evaporation and condensation',()=>{
  for(const t of[180,250,273.14,280,330,400,700]){const p=phaseAt(t,0.01,0.001,120,[0.1,0.2,0.3],t<T0),q=equilibrate(p.energy,0.01,0.001,120,[0.1,0.2,0.3]);expect(q.temperature).toBeCloseTo(t,8);expect(q.energy).toBeCloseTo(p.energy,6);expect(q.ice+q.liquid+q.vapor).toBeCloseTo(0.01,13)}
  const frozen=phaseAt(T0,1,0.01,100,[0,0,0],true),liquid=phaseAt(T0,1,0.01,100,[0,0,0],false)
  const mid=equilibrate((frozen.energy+liquid.energy)/2,1,0.01,100,[0,0,0]);expect(mid.temperature).toBe(T0);expect(mid.liquid).toBeGreaterThan(0.49);expect(mid.ice).toBeGreaterThan(0.49);expect(liquid.energy-frozen.energy).toBeCloseTo(LF, -2)
  expect(saturationPressure(373.15)).toBeCloseTo(101418,-1)
  expect(gasH(1,300)-gasU(1,300)).toBeCloseTo(R*300,10)
 })
 it('preserves an insulated closed uniform equilibrium',()=>{
  const sim=new CoupledTransport(box()),before=sim.frame();sim.advance(20)
  expect(sim.ledger.steps).toBeGreaterThan(1);expect(Math.abs(sim.ledger.energyResidualJ)).toBeLessThan(1e-5);expect(Math.abs(sim.ledger.massResidualKg)).toBeLessThan(1e-9)
  expect(Math.max(...sim.ledger.speciesResidualMol.map(Math.abs))).toBeLessThan(1e-8)
  expect(Math.max(...sim.temperature)-Math.min(...sim.temperature)).toBeLessThan(1e-8);expect(sim.frame().temperatureK).toEqual(before.temperatureK)
 })
 it('closes finite dry ice, heater, open species and transported energy ledgers',()=>{
  const s=box();s.source.initialMassKg=0.01;s.source.enabled=true;s.source.heatGenerationWm3=50000;s.source.contactConductanceWm2K=0;s.atmosphere.topGasBoundary='atmospheric'
  const sim=new CoupledTransport(s);sim.advance(30)
  expect(sim.dryIce).toBe(0);expect(sim.ledger.heaterJ).toBeGreaterThan(5000);expect(Math.abs(sim.ledger.energyResidualJ)).toBeLessThan(1e-5);expect(Math.abs(sim.ledger.massResidualKg)).toBeLessThan(1e-8);expect(Math.max(...sim.ledger.speciesResidualMol.map(Math.abs))).toBeLessThan(1e-7)
 })
 it('consumes oxygen and fuel with molecular mass closure and no oxygen supplied by CO2',()=>{
  const s=box();s.model.smolderRateS=1e-4;s.soil.moistureSaturation=0;s.hotRegions=[{id:'hot',shape:'slab',centerXM:0.5,centerYM:0.5,centerDepthM:0.5,sizeXM:1,sizeYM:1,thicknessM:1,temperatureC:270,fuelFraction:1}]
  const sim=new CoupledTransport(s),oxygen=sim.gas[0].reduce((a,b)=>a+b,0);sim.advance(1)
  expect(sim.ledger.reactionJ).toBeGreaterThan(0);expect(sim.gas[0].reduce((a,b)=>a+b,0)).toBeLessThan(oxygen);expect(Math.abs(sim.ledger.massResidualKg)).toBeLessThan(1e-8);expect(Math.abs(sim.ledger.energyResidualJ)).toBeLessThan(1e-4)
 })
 it('returns identical last valid state on an unsupported pore state',()=>{
  const sim=new CoupledTransport(box()),t=sim.time,m=sim.totalMass();sim.kh.fill(1e5);sim.energy[0]+=1e6;sim.resolve();const initial=sim.frame()
  expect(()=>sim.step(1)).toThrow();expect(sim.time).toBe(t);expect(sim.totalMass()).toBe(m);expect(sim.frame().temperatureK).toEqual(initial.temperatureK)
 })
})
