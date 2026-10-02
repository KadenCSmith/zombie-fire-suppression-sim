import { describe, it, expect } from 'vitest'
import { basis, createMesh, elementOperators, sparseAction, transport, sample, oxidationRate,
  PeatSolver, totals, MATERIAL, DEFAULT_SETTINGS, type Settings } from '../src/peatfem/model'
const settings=(extra:Partial<Settings>={}):Settings=>({...DEFAULT_SETTINGS,n:2,ignitionW:0,heatTransfer:0,massTransferMS:0,...extra})
const maxAbs=(v:ArrayLike<number>)=>Math.max(...Array.from(v,Math.abs))
describe('volumetric Q1 FEM and actual boundaries',()=>{
  it('has partition of unity, zero gradient sum, and exact affine interpolation',()=>{
    for(const p of [[0,0,0],[.23,-.61,.87],[-1,1,-1]]){
      const {shape,gradients}=basis(...p as [number,number,number]);expect(shape.reduce((a,b)=>a+b,0)).toBeCloseTo(1,14)
      for(let d=0;d<3;d++)expect(shape.reduce((a,_,i)=>a+gradients[3*i+d],0)).toBeCloseTo(0,14)
    }
    const m=createMesh(3,.1),field=Float64Array.from(m.weights,(_,i)=>m.coordinates[3*i]+2*m.coordinates[3*i+1]+3*m.coordinates[3*i+2])
    expect(sample(m,field,.023,.076,.041)).toBeCloseTo(.023+2*.076+3*.041,13)
    expect(()=>sample(m,field,-.001,0,0)).toThrow()
  })
  it('matches independent tensor-product hand entries and a tiny assembled action',()=>{
    const h=.7,{mass,stiffness}=elementOperators(h)
    expect(mass[0]).toBeCloseTo(h**3/27,14);expect(mass[7]).toBeCloseTo(h**3/216,14)
    expect(stiffness[0]).toBeCloseTo(h/3,14);expect(stiffness[1]).toBeCloseTo(0,14);expect(stiffness[3]).toBeCloseTo(-h/12,14);expect(stiffness[7]).toBeCloseTo(-h/12,14)
    const m=createMesh(1,h),x=Float64Array.from({length:8},(_,i)=>i*i+1),action=sparseAction(m.stiffness,x)
    for(let a=0;a<8;a++){
      let independent=0
      for(let b=0;b<8;b++){const flips=((a^b)&1?1:0)+((a^b)&2?1:0)+((a^b)&4?1:0);independent+=(flips===0?h/3:flips===1?0:-h/12)*x[b]}
      expect(action[a]).toBeCloseTo(independent,12)
    }
  })
  it('integrates volume, positive Jacobians, outward top and ignition power exactly',()=>{
    const m=createMesh(4,.1)
    expect(m.weights.reduce((a,b)=>a+b,0)).toBeCloseTo(.001,14)
    expect(m.topArea.reduce((a,b)=>a+b,0)).toBeCloseTo(.01,14)
    expect(m.ignitionShape.reduce((a,b)=>a+b,0)).toBeCloseTo(1,14)
    m.topArea.forEach((a,i)=>{if(a>0)expect(m.coordinates[3*i+2]).toBeCloseTo(.1,14)})
    for(let e=0;e<m.n**3;e++){const v=m.connectivity.subarray(8*e,8*e+8);expect(new Set(v).size).toBe(8);expect(m.coordinates[3*v[1]]-m.coordinates[3*v[0]]).toBeCloseTo(m.h,14);expect(m.coordinates[3*v[4]+2]-m.coordinates[3*v[0]+2]).toBeCloseTo(m.h,14)}
    expect(maxAbs(sparseAction(m.stiffness,new Float64Array(m.weights.length).fill(1)))).toBeLessThan(1e-14)
    const K=m.stiffness;for(let i=0;i<m.weights.length;i++)for(let p=K.offsets[i];p<K.offsets[i+1];p++)if(K.columns[p]!==i)expect(K.values[p]).toBeLessThan(1e-14)
  })
  it('preserves constant fields and solves a steady affine Dirichlet field',()=>{
    const m=createMesh(3,1),zero=new Float64Array(m.weights.length),initial=zero.slice().fill(7)
    expect(maxAbs(transport(m,initial,1,1,zero,zero,.2).field.map(v=>v-7))).toBeLessThan(1e-10)
    const exact=Float64Array.from(zero,(_,i)=>1+m.coordinates[3*i]+2*m.coordinates[3*i+1]-m.coordinates[3*i+2]),boundary=new Map<number,number>()
    exact.forEach((v,i)=>{const p=m.coordinates.subarray(3*i,3*i+3);if([...p].some(c=>c===0||c===1))boundary.set(i,v)})
    expect(maxAbs(transport(m,exact,1,1,zero,zero,1,1000,boundary).field.map((v,i)=>v-exact[i]))).toBeLessThan(1e-10)
  })
  it('matches a no-flux cosine diffusion eigenmode with systematic spatial refinement',()=>{
    const errors:number[]=[]
    for(const n of [4,8,16]){
      const m=createMesh(n,1),zero=new Float64Array(m.weights.length),initial=Float64Array.from(zero,(_,i)=>Math.cos(Math.PI*m.coordinates[3*i]))
      const dt=.0001;let field:Float64Array=initial
      for(let j=0;j<100;j++)field=transport(m,field,1,1,zero,zero,dt).field
      const exact=Math.exp(-(Math.PI**2)*.01);errors.push(Math.sqrt(field.reduce((sum,v,i)=>sum+m.weights[i]*(v-initial[i]*exact)**2,0)))
    }
    expect(errors[1]).toBeLessThan(errors[0]/3);expect(errors[2]).toBeLessThan(errors[1]/2)
  })
})
describe('coupled finite reaction and accepted-state accounting',()=>{
  it('releases no oxidation heat without oxygen or fuel',()=>{
    expect(oxidationRate(600,123,0)).toBe(0);expect(oxidationRate(600,0,.28)).toBe(0)
    const solver=new PeatSolver(settings({initialK:600,initialOxygenKgM3:0}));solver.advance()
    expect(solver.frame.ledger.reactionJ).toBe(0);expect(solver.frame.ledger.reactedPeatKg).toBe(0)
    const noFuel=new PeatSolver(settings({initialK:600}));noFuel.frame.fuel.fill(0);noFuel.advance();expect(noFuel.frame.ledger.reactionJ).toBe(0)
  })
  it('books finite ignition once, including an end crossed inside a step',()=>{
    const solver=new PeatSolver(settings({chemistry:false,ignitionW:2,ignitionS:.3,maxStepS:1})),initial=totals(solver.mesh,solver.frame)
    for(let i=0;i<4;i++)solver.advance();const f=solver.frame,t=totals(solver.mesh,f)
    expect(f.ledger.ignitionJ).toBeCloseTo(.6,12);expect(t.energyJ-initial.energyJ).toBeCloseTo(.6,7)
    expect(f.ledger.reactionJ).toBe(0)
  })
  it('conserves each reaction product, oxygen and reduced stored energy in a sealed hot system',()=>{
    const solver=new PeatSolver(settings({initialK:600})),initial=totals(solver.mesh,solver.frame)
    for(let j=0;j<20;j++)solver.advance();const f=solver.frame,t=totals(solver.mesh,f),l=f.ledger
    expect(l.reactedPeatKg).toBeGreaterThan(0)
    expect(t.componentsKg-initial.componentsKg).toBeCloseTo(0,10)
    expect(initial.oxygenKg-t.oxygenKg).toBeCloseTo(l.oxygenUsedKg,10)
    expect(t.charKg).toBeCloseTo(l.reactedPeatKg*MATERIAL.charYield,10)
    expect(t.energyJ-initial.energyJ).toBeCloseTo(l.reactionJ,7)
    expect(l.reactionJ).toBeCloseTo(l.reactedPeatKg*MATERIAL.heatJPerKg,8)
    for(const field of [f.temperature,f.oxygen,f.fuel,f.char])expect([...field].every(v=>Number.isFinite(v)&&v>=0)).toBe(true)
  })
  it('includes open oxygen and heat fluxes in the component/energy ledgers',()=>{
    const solver=new PeatSolver(settings({initialK:500,initialOxygenKgM3:.05,heatTransfer:10,massTransferMS:.002,chemistry:false})),initial=totals(solver.mesh,solver.frame)
    for(let j=0;j<10;j++)solver.advance();const f=solver.frame,t=totals(solver.mesh,f)
    expect(t.componentsKg-initial.componentsKg-f.ledger.oxygenInKg).toBeCloseTo(0,9)
    expect(Math.abs(t.energyJ-initial.energyJ+f.ledger.heatOutJ)/Math.max(1,Math.abs(initial.energyJ))).toBeLessThan(1e-7)
  })
  it('rejects and adapts inaccurate split steps and preserves a failed checkpoint',()=>{
    const solver=new PeatSolver(settings({initialK:490,maxStepS:20,toleranceScale:1e-4}));solver.advance()
    expect(solver.frame.rejectedSteps).toBeGreaterThan(0);expect(solver.frame.stepS).toBeLessThan(20);expect(solver.frame.splittingError).toBeLessThanOrEqual(1)
    const failed=new PeatSolver(settings({maxIterations:0,ignitionW:100}));const before=failed.snapshot()
    expect(()=>failed.advance()).toThrow();expect(failed.status).toBe('failed');expect(failed.frame.timeS).toBe(before.timeS);expect(failed.frame.temperature).toEqual(before.temperature)
  })
  it('restarts deterministically, isolates snapshots and has an identical empty intervention seam',()=>{
    const a=new PeatSolver(settings({ignitionW:8})),b=new PeatSolver(settings({ignitionW:8}))
    for(let i=0;i<8;i++){a.advance();b.advance(undefined,[])}expect(a.frame).toEqual(b.frame)
    const shot=a.snapshot();shot.temperature.fill(0);expect(a.frame.temperature[0]).toBeGreaterThan(0)
    const reset=new PeatSolver(settings({ignitionW:8}));for(let i=0;i<8;i++)reset.advance();expect(reset.frame).toEqual(a.frame)
    expect(()=>new PeatSolver(settings({oxygenKgM3:-1}))).toThrow()
  })
})
