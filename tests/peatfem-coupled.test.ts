import {describe,it,expect} from 'vitest'
import {PeatSolver,DEFAULT_SETTINGS,totals} from '../src/peatfem/coupled'
import {localInitial} from '../src/peatfem/chemistry'
import {EMPTY_INTERVENTIONS} from '../src/peatfem/model'
describe('active conservative reacting 3D FEM integration',()=>{
  it('has sealed no-source uniform identity and consistent EOS',()=>{
    const solver=new PeatSolver({...DEFAULT_SETTINGS,n:2,chemistry:false,ignitionW:0,closed:true})
    const base=totals(solver.mesh,solver.frame);solver.advance(.2);const now=totals(solver.mesh,solver.frame)
    expect(now.energyJ).toBeCloseTo(base.energyJ,8);expect(now.componentsKg).toBeCloseTo(base.componentsKg,11)
    expect(Math.max(...Array.from(solver.frame.pressure,p=>Math.abs(p-101325)))).toBeLessThan(.001)
    expect(solver.frame.temperature.every(v=>Math.abs(v-300)<1e-7)).toBe(true)
  })
  it('couples drying mass, vapor EOS, latent cooling and sealed energy',()=>{
    const solver=new PeatSolver({...DEFAULT_SETTINGS,n:2,initialK:410,ignitionW:0,closed:true,maxStepS:.02})
    const base=totals(solver.mesh,solver.frame),f=solver.advance(.02),now=totals(solver.mesh,f)
    expect(now.waterKg).toBeLessThan(base.waterKg);expect(f.gas[2].some(v=>v>0)).toBe(true)
    expect(now.maximumK).toBeLessThan(base.maximumK)
    expect(Math.abs(now.componentsKg-base.componentsKg)).toBeLessThan(1e-9)
    expect(Math.abs(now.energyJ-base.energyJ-f.ledger.reactionJ)).toBeLessThan(1e-3)
    expect(Math.max(...f.pressure)).toBeGreaterThan(101325)
  })
  it('closes open-boundary mixture mass and gas enthalpy in the same accepted state',()=>{
    const solver=new PeatSolver({...DEFAULT_SETTINGS,n:2,initialK:400,maxStepS:.02})
    const base=totals(solver.mesh,solver.frame)
    for(let k=0;k<3;k++)solver.advance()
    const f=solver.frame,now=totals(solver.mesh,f),boundary=f.ledger.gasBoundaryKg.reduce((a,b)=>a+b,0)
    expect(Math.abs(now.componentsKg-base.componentsKg+boundary)/base.componentsKg).toBeLessThan(1e-7)
    expect(Math.abs(now.energyJ-base.energyJ-f.ledger.reactionJ-f.ledger.ignitionJ+f.ledger.heatOutJ+f.ledger.gasEnthalpyOutJ)/Math.max(1,base.energyJ)).toBeLessThan(1e-7)
    expect(f.nonlinearError).toBeLessThan(1e-8)
    expect(f.oxygen.every(Y=>Y>=0&&Y<=1)).toBe(true)
    expect(f.darcySpeed.some(q=>q>0)).toBe(true)
  })
  it('enforces the prescribed pressure after heat transport and thermal expansion',()=>{
    const s=new PeatSolver({...DEFAULT_SETTINGS,n:2,chemistry:false,maxStepS:.1})
    s.advance(.1)
    let error=0;s.mesh.topArea.forEach((area,i)=>{if(area>0)error=Math.max(error,Math.abs(s.frame.pressure[i]-s.settings.ambientPressurePa))})
    expect(error).toBeLessThan(.002)
  })
  it('integrates finite ignition exactly across its cutoff without residual heating',()=>{
    const solver=new PeatSolver({...DEFAULT_SETTINGS,n:2,chemistry:false,closed:true,ignitionS:.15,ignitionW:3,maxStepS:.1})
    while(solver.frame.timeS<.3)solver.advance(Math.min(.1,.3-solver.frame.timeS))
    expect(solver.frame.ledger.ignitionJ).toBeCloseTo(.45,11)
    expect(totals(solver.mesh,solver.frame).energyJ).toBeCloseTo(.45,6)
  })
  it('preserves a deterministic restart, checkpoint and disabled intervention seam',()=>{
    const a=new PeatSolver({...DEFAULT_SETTINGS,n:2}),b=new PeatSolver({...DEFAULT_SETTINGS,n:2})
    const f=a.advance(.1);b.advance(.1,EMPTY_INTERVENTIONS)
    expect(Array.from(f.temperature)).toEqual(Array.from(b.frame.temperature))
    const saved=a.snapshot(),restored=new PeatSolver({...DEFAULT_SETTINGS,n:2});restored.restore(saved)
    a.advance(.1);restored.advance(.1)
    expect(Array.from(a.frame.temperature)).toEqual(Array.from(restored.frame.temperature))
    saved.temperature[0]=999;expect(restored.frame.temperature[0]).not.toBe(999)
    expect(()=>restored.advance(.1,[{} as never])).toThrow('disabled')
  })
  it('advances a fine-mesh buried hot seed beyond the former gas residual-floor stall',()=>{
    const s=new PeatSolver({...DEFAULT_SETTINGS,n:8,ignitionW:0,maxStepS:.005}),f=s.snapshot()
    f.temperature.forEach((_,i)=>{
      const [x,y,z]=s.mesh.coordinates.subarray(3*i,3*i+3),r2=((x-.05)**2+(y-.05)**2+(z-.05)**2)/.035**2,T=300+350*Math.max(0,1-r2)**2
      const state=localInitial(123,.1*Math.max(0,Math.min(1,(373-T)/73)),T)
      f.temperature[i]=T;f.water[i]=state.solid[0];f.gas.forEach((g,j)=>{g[i]=state.gas[j]})
    })
    f.peak={temperatureK:650,node:f.temperature.indexOf(650),timeS:0};s.restore(f)
    const base=totals(s.mesh,s.frame)
    while(s.frame.timeS<.0001-1e-12)s.advance()
    const now=totals(s.mesh,s.frame)
    expect(s.frame.nonlinearError).toBeLessThan(1e-8)
    expect(Math.abs(now.componentsKg-base.componentsKg+s.frame.ledger.gasBoundaryKg.reduce((a,b)=>a+b,0))).toBeLessThan(1e-9)
    expect(Math.abs(now.energyJ-base.energyJ-s.frame.ledger.reactionJ+s.frame.ledger.heatOutJ+s.frame.ledger.gasEnthalpyOutJ)).toBeLessThan(1e-4)
  })
  it('retains the last accepted state on a failed linear solve',()=>{
    const s=new PeatSolver({...DEFAULT_SETTINGS,n:2,initialK:410,maxIterations:0})
    expect(()=>s.advance()).toThrow('Solver stopped');expect(s.frame.timeS).toBe(0);expect(s.status).toBe('failed')
  })
})
