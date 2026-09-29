import {describe,it,expect} from 'vitest'
import {conservativeRemap} from '../src/coupled/remap'
import {CoupledTransport,coupledScenario,DEFAULT_COUPLED,PRESETS,type Fidelity} from '../src/coupled/model'
const sum=(a:Float64Array)=>a.reduce((s,x)=>s+x,0)
describe('common physical initialization',()=>{
 it('conserves extensive quantities between non-nested grids and uniform densities',()=>{
  const from={nx:7,ny:5,nz:3},to={nx:12,ny:4,nz:8},a=Float64Array.from({length:105},(_,i)=>0.3+i/13)
  const b=conservativeRemap(a,from,to)
  expect(sum(b)).toBeCloseTo(sum(a),10)
  const uniform=conservativeRemap(new Float64Array(105).fill(1/105),from,to)
  for(const v of uniform)expect(v).toBeCloseTo(1/(12*4*8),14)
 })
 it('keeps mass, fuel, water and energy identical across all five fidelities',()=>{
  const values=(Object.keys(PRESETS) as Fidelity[]).map(fidelity=>{
   const t=new CoupledTransport(coupledScenario({...DEFAULT_COUPLED,fidelity}),true)
   return [t.totalMass(),sum(t.fuel),sum(t.water),t.totalEnergy()]
  })
  for(const v of values)for(let i=0;i<v.length;i++)expect(Math.abs(v[i]-values[0][i])/Math.abs(values[0][i])).toBeLessThan(1e-12)
 },30000)
 it('projects the same finite source support across meshes',()=>{
  const fine=new CoupledTransport(coupledScenario({...DEFAULT_COUPLED,reaction:false,fidelity:'precision20480'}),true)
  const finePartition=new Float64Array(fine.n);for(const p of fine.sourceWeights)finePartition[p.i]=p.w
  const coarse=new CoupledTransport(coupledScenario({...DEFAULT_COUPLED,reaction:false,fidelity:'preview'}),true)
  const projected=conservativeRemap(finePartition,PRESETS.precision20480,PRESETS.preview),actual=new Float64Array(coarse.n)
  for(const p of coarse.sourceWeights)actual[p.i]=p.w
  for(let i=0;i<coarse.n;i++)expect(actual[i]).toBeCloseTo(projected[i],14)
  expect(coarse.frame().initialization!.preparedWaterRemovedKg).toBe(0)
 })
 it('provides exactly ten times the old preview and research cell counts',()=>{
  const n=(f:Fidelity)=>PRESETS[f].nx*PRESETS[f].ny*PRESETS[f].nz
  expect(n('precision2560')).toBe(10*n('preview'));expect(n('precision20480')).toBe(10*n('research'))
 })
 it('makes source-only cases cold and terrain choices change physical properties',()=>{
  const cold=coupledScenario({...DEFAULT_COUPLED,reaction:false})
  expect(cold.hotRegions).toHaveLength(0)
  expect(coupledScenario({...DEFAULT_COUPLED,terrain:'layered'}).peatRegions[0].shape).toBe('slab')
  expect(coupledScenario({...DEFAULT_COUPLED,terrain:'rocky'}).soilLayers.at(-1)!.permeabilityMultiplier).toBe(0.05)
 })
})
