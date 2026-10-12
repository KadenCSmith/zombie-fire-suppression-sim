import { describe, expect, it } from 'vitest'
import { createRun, duplicatePanel, freshPanel, linkedCompatibility } from '../../../src/alternatives/model'
import { createParticleRun, PROPERTIES, simulateParticle, sphereRadiusSquared, twoCapacityHeatJ } from '../../../src/alternatives/fine-dry-ice-injection/physics'
import { matchedWaterOnly, particleScenario } from '../../../src/alternatives/fine-dry-ice-injection/scenarios'
const base = () => freshPanel('D-test','nanoparticles')
describe('D finite particle transport', () => {
  it('matches an independently integrated fixed-bath sphere analytical radius and lifetime', () => {
    const r=50e-6,k=.6,rho=1560,T=293.15,L=25200/.0440095
    const life=rho*L*r*r/(2*k*(T-195))
    expect(life).toBeCloseTo(.01896038550978119,14)
    expect(sphereRadiusSquared(r,k,T,rho,L,life/4)).toBeCloseTo(.75*r*r,18)
    expect(sphereRadiusSquared(r,k,T,rho,L,2*life)).toBe(0)
  })
  it('matches analytical two-capacity energy and equilibrium without overshoot', () => {
    const q=twoCapacityHeatJ(330,290,1000,4000,2,100)
    expect(q).toBeCloseTo(32000*(1-Math.exp(-.25)),10)
    const huge=twoCapacityHeatJ(330,290,1000,4000,2,1e10)
    expect(330-huge/1000).toBeCloseTo(290+huge/4000,12)
  })
  it('permits complete upstream loss; finite source and cold gas survive accounting', () => {
    const s=simulateParticle(base(),30)
    expect(s.solidEnteringGroundKg).toBe(0); expect(s.undergroundSublimatedKg).toBe(0)
    expect(s.upstreamSublimatedKg).toBeCloseTo(.01,12)
    expect(s.locations.source.waterKg).toBe(0); expect(s.waterEnteringGroundKg).toBeCloseTo(1,12)
    expect(s.locations.soil.gasKg).toBeCloseTo(.01,12)
    expect(s.oxygenMoleFraction).toBeNull(); expect(s.pressurePa).toBeNull()
    expect(s.releases.every(r=>r.location==='source')).toBe(true)
    expect(Math.abs(s.energyResidualJ)).toBeLessThan(1e-7)
  })
  it('allows conditional survival and soil sublimation without restarting size at entry', () => {
    const s=simulateParticle(particleScenario(base(),'film-sensitivity'),30)
    expect(s.solidEnteringGroundKg).toBeGreaterThan(0); expect(s.solidEnteringGroundKg).toBeLessThan(.01)
    expect(s.undergroundSublimatedKg).toBeGreaterThan(0)
    expect(s.undergroundSublimatedKg+s.locations.soil.solidKg).toBeCloseTo(s.solidEnteringGroundKg,12)
    expect(s.releases.some(r=>r.location==='soil')).toBe(true)
  })
  it('zero particles exactly equals matched water-only and off retains source', () => {
    const a=base(); a.thermal.dryIceKg=0
    const b=matchedWaterOnly(a,'water')
    const x=simulateParticle(a,30),y=simulateParticle(b,30)
    expect(x.peatTemperatureK).toBe(y.peatTemperatureK); expect(x.locations).toEqual(y.locations)
    const off=simulateParticle(particleScenario(base(),'off'),30)
    expect(off.peatTemperatureK).toBe(333.15); expect(off.locations.source.solidKg).toBeCloseTo(.01,12)
    expect(off.releases).toEqual([]); expect(off.waterEnteringGroundKg).toBe(0)
  })
  it('pre-sublimated counterfactual carries conserved cold water/gas enthalpy', () => {
    const s=simulateParticle(particleScenario(base(),'pre-sublimated'),0)
    const expected=195+(4186*(293.15-195)-.01*PROPERTIES.latentJkg)/(4186+.01*850)
    expect(s.locations.source.temperatureK).toBeCloseTo(expected,12)
    expect(s.locations.source.temperatureK).toBeCloseTo(291.5859729588857,11)
    expect(s.locations.source.solidKg).toBe(0); expect(s.energyResidualJ).toBe(0)
  })
  it('rejects bulk freezing, unsupported hot-fire states and missing size provenance', () => {
    expect(()=>simulateParticle(particleScenario(base(),'freezing-stop'),1)).toThrow(/freezing/)
    const a=base(); a.thermal.initialK=823.15; expect(()=>simulateParticle(a,0)).toThrow(/Fire/)
    const b=base(); b.particleInjection!.sizeProvenance=''; expect(()=>simulateParticle(b,0)).toThrow(/sizeProvenance/)
    const c=base(); c.particleInjection!.particleDiameterM=1e-9; expect(()=>simulateParticle(c,0)).toThrow(/particleDiameterM/)
  })
  it('conserves water, CO2 and energy with nonnegative finite inventory across cases', () => {
    for(const scenario of ['conduction-reference','film-sensitivity','water-only','pre-sublimated','off'] as const) {
      const config=particleScenario(base(),scenario)
      for(const time of [0,.02,.1,1,3,12,30]) {
        const s=simulateParticle(config,time)
        expect(Math.abs(s.waterMassResidualKg)).toBeLessThan(1e-10)
        expect(Math.abs(s.co2MassResidualKg)).toBeLessThan(1e-10)
        expect(Math.abs(s.energyResidualJ)/Math.max(1,s.initialEnthalpyJ)).toBeLessThan(1e-9)
        for(const c of Object.values(s.locations)) for(const key of ['waterKg','solidKg','gasKg','enthalpyJ'] as const) expect(Number.isFinite(c[key]) && c[key]>=-1e-12).toBe(true)
      }
    }
  })
  it('separate instances, cloned configs and snapshots, failed advance and replay stay isolated', () => {
    const a=base(), b=duplicatePanel(a,'D-second'), r=createRun(a), other=createParticleRun(b)
    a.thermal.waterKg=4; a.particleInjection!.particleDiameterM=.0005
    const before=other.snapshot(); const out=r.advanceTo(3); out.particleInjection!.locations.source.waterKg=999
    expect(other.snapshot()).toEqual(before); expect(r.snapshot().particleInjection!.locations.source.waterKg).toBeLessThan(1)
    expect(()=>r.advanceTo(2)).toThrow(); expect(()=>r.advanceTo(NaN)).toThrow(); expect(()=>r.advanceTo(31)).toThrow()
    expect(createRun(b).advanceTo(3)).toEqual(other.advanceTo(3))
    const direct=createRun(b).advanceTo(12); const chunked=createRun(b); chunked.advanceTo(3); expect(chunked.advanceTo(12)).toEqual(direct)
  })
  it('matched particle comparisons link only supported identical systems', () => {
    const a=base(),b=matchedWaterOnly(a,'water')
    expect(linkedCompatibility([a,b])).toBeNull()
    b.particleInjection!.hoseResidenceS=2; expect(linkedCompatibility([a,b])).toMatch(/transport/)
  })
})
