import {describe,it,expect} from 'vitest'
import {PoroMechanics,splitElastic,spectral,type BrickMaterial} from '../src/coupled/mechanics'
const m:BrickMaterial={youngsPa:1e6,poisson:0.25,densityKgM3:180,biot:1,fractureEnergyJm2:5}
describe('initialized three-dimensional poromechanics',()=>{
 it('diagonalizes rotated tensors and preserves intact elastic energy',()=>{
  expect(spectral([0,0,0,2,0,0]).values.sort()).toEqual([-1,0,1])
  const e=[0.01,-0.003,0.002,0.004,0.003,-0.001],v=splitElastic(e,m,0),lambda=m.youngsPa*m.poisson/((1+m.poisson)*(1-2*m.poisson)),mu=m.youngsPa/(2*(1+m.poisson)),trace=e[0]+e[1]+e[2]
  for(let i=0;i<6;i++)expect(v.stress[i]).toBeCloseTo(i<3?lambda*trace+2*mu*e[i]:mu*e[i],7)
  expect(v.energy).toBeCloseTo(v.stress.reduce((s,x,i)=>s+0.5*x*e[i],0),8)
 })
 it('balances gravity inside the constitutive state with zero incremental displacement',()=>{
  const fem=new PoroMechanics(2,2,2,1,1,1,Array(8).fill(m),0.5),s=fem.solve(new Float64Array(8),true)
  expect(Math.max(...s.u.map(Math.abs))).toBeLessThan(1e-12);expect(s.maxDamage).toBeLessThan(1e-20);expect(s.stress[2]).toBeCloseTo(-m.densityKgM3*9.80665*0.25,7)
  expect(s.residualN).toBeLessThan(1e-6)
 })
 it('recovers the confined elastic/poroelastic solution and mesh independent energy',()=>{
  for(const n of[1,2,4]){
   const fem=new PoroMechanics(n,n,n,1,1,1,Array(n**3).fill(m),0.5),p=new Float64Array(n**3).fill(1000),s=fem.solve(p)
   const modulus=m.youngsPa*(1-m.poisson)/((1+m.poisson)*(1-2*m.poisson)),strain=1000/modulus
   for(let i=0;i<n**3;i++)expect(s.strain[i*6+2]).toBeCloseTo(strain,9)
   expect(s.elasticJ).toBeCloseTo(0.5*1000*strain,8);expect(s.pressureWorkJ).toBeCloseTo(1000*strain,8);expect(s.residualN).toBeLessThan(1e-4)
  }
 })
 it('retains compressive stiffness after tensile degradation and prevents damage healing',()=>{
  const compression=[-0.001,-0.001,-0.001,0,0,0]
  expect(splitElastic(compression,m,0.99).stress).toEqual(splitElastic(compression,m,0).stress)
  const fem=new PoroMechanics(2,2,2,1,1,1,Array(8).fill({...m,densityKgM3:0}),0.5)
  const a=fem.solve(new Float64Array(8).fill(300),true),b=fem.solve(new Float64Array(8),true)
  expect(a.maxDamage).toBeGreaterThan(0);for(let i=0;i<8;i++)expect(b.damage[i]).toBeGreaterThanOrEqual(a.damage[i]);expect(b.residualN).toBeLessThan(1e-4)
 })
})
