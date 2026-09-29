import {it,expect} from 'vitest'
import {PoroMechanics} from '../src/coupled/mechanics'
import {CoupledEngine} from '../src/coupled/engine'
import {DEFAULT_COUPLED} from '../src/coupled/model'
const maxDifference=(a:ArrayLike<number>,b:ArrayLike<number>)=>{let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,Math.abs(a[i]-b[i]));return m}
it('matches independent element-by-element nonlinear reference under heterogeneous elastic loading',()=>{
 const materials=Array.from({length:4*5*4},(_,i)=>({youngsPa:1e6*(i%4+1),poisson:0.24,densityKgM3:500+10*(i%3),biot:0.8,fractureEnergyJm2:10}))
 const reference=new PoroMechanics(4,5,4,4,5,3.2,materials,1,true,undefined,'reference')
 const fast=new PoroMechanics(4,5,4,4,5,3.2,materials,1,true,undefined,'optimized')
 for(const factor of [1,-0.5,0]){
  const p=Float64Array.from({length:80},(_,i)=>factor*500*Math.sin(i/9)),a=reference.solve(p),b=fast.solve(p)
  expect(maxDifference(a.u,b.u)).toBeLessThan(1e-9)
  expect(Math.abs(a.elasticJ-b.elasticJ)).toBeLessThan(1e-7)
  expect(b.residualN).toBeLessThan(1e-4)
 }
})
it('keeps coupled mass, heat, pressure and displacement trajectories matched',()=>{
 const ref=new CoupledEngine({...DEFAULT_COUPLED,reaction:false,mechanicalBackend:'reference'})
 const fast=new CoupledEngine({...DEFAULT_COUPLED,reaction:false,mechanicalBackend:'optimized'})
 for(let step=0;step<2;step++){
  ref.advance(1);fast.advance(1)
  expect(maxDifference(ref.transport.temperature,fast.transport.temperature)).toBeLessThan(1e-7)
  expect(maxDifference(ref.transport.pressure,fast.transport.pressure)).toBeLessThan(1e-5)
  expect(maxDifference(ref.mechanics!.u,fast.mechanics!.u)).toBeLessThan(1e-9)
  expect(Math.abs(fast.transport.ledger.massResidualKg)).toBeLessThan(1e-7)
  expect(Math.abs(fast.transport.ledger.energyResidualJ)).toBeLessThan(1e-4)
 }
},30000)
