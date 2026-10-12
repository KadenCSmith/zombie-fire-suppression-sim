import { expect,it } from 'vitest'
import { freshPanel } from '../../../src/alternatives/model'
import { simulateParticle } from '../../../src/alternatives/fine-dry-ice-injection/physics'
import { particleScenario } from '../../../src/alternatives/fine-dry-ice-injection/scenarios'
function run(stepS:number,parcelStepS:number) { const c=particleScenario(freshPanel('D-refinement','nanoparticles'),'film-sensitivity'); c.particleInjection!.stepS=stepS;c.particleInjection!.parcelStepS=parcelStepS;return simulateParticle(c,30) }
it('asymptotic time refinement is stable with shrinking changes',()=>{
 const a=run(.005,.025),b=run(.0025,.025),c=run(.00125,.025)
 for(const key of ['solidEnteringGroundKg','peatTemperatureK'] as const) {
   const first=Math.abs(b[key]-a[key]),second=Math.abs(c[key]-b[key])
   expect(second).toBeLessThan(first);expect(second/Math.abs(c[key])).toBeLessThan(.02)
 }
})
it('parcel refinement approaches a limit and the default is within frozen 2% tolerance',()=>{
 const a=run(.00125,.05),b=run(.00125,.025),c=run(.00125,.0125)
 for(const key of ['solidEnteringGroundKg','peatTemperatureK'] as const) {
   expect(Math.abs(c[key]-b[key])).toBeLessThan(Math.abs(b[key]-a[key]))
   // First-order right-endpoint Richardson estimate; no fitted physical target.
   const extrapolated=2*c[key]-b[key]
   expect(Math.abs(b[key]-extrapolated)/Math.abs(extrapolated)).toBeLessThan(.02)
 }
})
it('source continues aging during a slow withdrawal instead of forcing late solids through',()=>{
 const c=particleScenario(freshPanel('D-aging','nanoparticles'),'film-sensitivity')
 const a=simulateParticle(c,3),b=simulateParticle(c,12)
 expect(b.solidEnteringGroundKg).toBeCloseTo(a.solidEnteringGroundKg,12)
 expect(b.waterEnteringGroundKg).toBeGreaterThan(a.waterEnteringGroundKg)
 expect(b.locations.source.solidKg).toBe(0)
})
