import { describe,it,expect } from 'vitest'
import { REACTIONS,CONSTITUENTS,localInitial,properties,reactionRates,reactLocal,totalMass,energy,R } from '../src/peatfem/chemistry'
describe('Irish-moss column chemistry and fixed-volume closure',()=>{
  it('uses rendered C4 table and source-species normalization for both chars',()=>{
    expect(REACTIONS.map(r=>r.log10A)).toEqual([27,8.18,16.8,8.38,13.3])
    const s=localInitial(123,.1,600),ref={peat:123,water:12.3};s.solid[2]=10
    const Y=s.gas[0]/s.gas.reduce((a,b)=>a+b,0)
    const expected=123*10**13.3*Math.exp(-172000/(R*600))*(10/123)**2.58*((1+Y)**.86-1)
    expect(reactionRates(s,ref)[4]/expected).toBeCloseTo(1,12)
  })
  it('has oxygen-independent drying/pyrolysis and zero oxidative sources when starved',()=>{
    const s=localInitial(123,.1,600,101325,0),rate=reactionRates(s,{peat:123,water:12.3})
    expect(rate[0]).toBeGreaterThan(0);expect(rate[1]).toBeGreaterThan(0);expect(Array.from(rate.slice(2))).toEqual([0,0,0])
    const next=reactLocal(s,.01,{peat:123,water:12.3});expect(next.state.solid[2]).toBeGreaterThan(0);expect(next.state.gas[2]).toBeGreaterThan(0);expect(next.state.temperature).toBeLessThan(s.temperature)
  })
  it('closes total species mass and source energy with finite latent cooling counted once',()=>{
    const s=localInitial(123,.35,410),next=reactLocal(s,.1,{peat:123,water:43.05})
    expect(Math.abs(totalMass(next.state)-totalMass(s))).toBeLessThan(1e-10)
    expect(Math.abs(energy(next.state)-energy(s)-next.heatJ)).toBeLessThan(1e-7)
    expect(next.heatJ).toBeLessThan(0);expect(next.state.temperature).toBeLessThan(s.temperature)
    expect(next.state.gas[2]).toBeCloseTo(next.extents[0],11)
    expect(-next.heatJ).toBeGreaterThanOrEqual(next.extents[0]*2.26e6)
  })
  it('oxidizes each char distinctly, respecting oxygen and ash yields',()=>{
    for(const [index,k] of [[2,4],[3,3]]){
      const s=localInitial(1,0,850);s.solid[1]=0;s.solid[index]=1
      const next=reactLocal(s,.1,{peat:1,water:0}),e=next.extents[k]
      expect(e).toBeGreaterThan(0);expect(next.state.solid[4]).toBeCloseTo(e*REACTIONS[k].yield,12)
      expect(s.gas[0]-next.state.gas[0]).toBeCloseTo(e*REACTIONS[k].oxygen,12)
      expect(totalMass(next.state)).toBeCloseTo(totalMass(s),10);expect(next.state.gas[0]).toBeGreaterThanOrEqual(0)
    }
  })
  it('derives gas EOS and state-dependent material storage from consistent intrinsic volumes',()=>{
    const s=localInitial(123,.1),p=properties(s)
    expect(p.theta).toBeCloseTo(1-123/1500-12.3/1000,12);expect(p.pressure).toBeCloseTo(101325,7)
    const d=localInitial(123,0),dry=properties(d);expect(dry.theta).toBeGreaterThan(p.theta);expect(dry.permeability).toBeGreaterThan(p.permeability)
    const hot={...s,temperature:600};expect(properties(hot).conductivity).toBeGreaterThan(p.conductivity)
    expect(CONSTITUENTS.gasCp-R/.01801528).toBeGreaterThan(0)
  })
  it('has no-reactant identity, nonnegative finite inventories and bounded failed chemistry',()=>{
    const s=localInitial(1,0,1200);s.solid.fill(0)
    expect(Array.from(reactLocal(s,1,{peat:1,water:0}).extents)).toEqual([0,0,0,0,0])
    const wet=localInitial(123,.1,450),next=reactLocal(wet,2,{peat:123,water:12.3})
    expect([...next.state.solid,...next.state.gas].every(v=>v>=0&&Number.isFinite(v))).toBe(true)
    expect(()=>reactLocal(s,-1,{peat:1,water:0})).toThrow('interval')
  })
})
