import fs from 'node:fs'
import { freshPanel } from '../../../src/alternatives/model'
import { simulateParticle } from '../../../src/alternatives/fine-dry-ice-injection/physics'
import { particleScenario } from '../../../src/alternatives/fine-dry-ice-injection/scenarios'
const rows=[]
for(const scenario of ['conduction-reference','film-sensitivity','water-only','pre-sublimated','off'] as const) {
 const config=particleScenario(freshPanel('D-evidence','nanoparticles'),scenario)
 const state=simulateParticle(config,30)
 rows.push({scenario,config,summary:state})
}
const convergence=[]
for(const stepS of [.02,.01,.005,.0025,.00125]) {
 const c=particleScenario(freshPanel('D-time-convergence','nanoparticles'),'film-sensitivity');c.particleInjection!.stepS=stepS;c.particleInjection!.parcelStepS=.025
 const s=simulateParticle(c,30);convergence.push({stepS,solidEnteringGroundKg:s.solidEnteringGroundKg,undergroundSublimatedKg:s.undergroundSublimatedKg,peatTemperatureK:s.peatTemperatureK,energyResidualJ:s.energyResidualJ})
}
const parcels=[]
for(const parcelStepS of [.2,.1,.05,.025,.0125,.00625]) {
 const c=particleScenario(freshPanel('D-parcel-convergence','nanoparticles'),'film-sensitivity');c.particleInjection!.stepS=.00125;c.particleInjection!.parcelStepS=parcelStepS
 try { const s=simulateParticle(c,30);parcels.push({parcelStepS,solidEnteringGroundKg:s.solidEnteringGroundKg,undergroundSublimatedKg:s.undergroundSublimatedKg,peatTemperatureK:s.peatTemperatureK,energyResidualJ:s.energyResidualJ}) }
 catch(error) { parcels.push({parcelStepS,rejected:String(error instanceof Error?error.message:error)}) }
}
const output={executor:'D implementer; independent reviewer re-execution required',runId:'D-owned-benchmarks-2026-10-12',rows,convergence,parcels}
fs.writeFileSync(process.argv[2]??'/tmp/agent-d-benchmarks.json',JSON.stringify(output,null,2))
console.log(JSON.stringify({rows:rows.map(r=>({scenario:r.scenario,solidGroundKg:r.summary.solidEnteringGroundKg,upstreamKg:r.summary.upstreamSublimatedKg,undergroundKg:r.summary.undergroundSublimatedKg,peatK:r.summary.peatTemperatureK,massResidualKg:Math.max(Math.abs(r.summary.waterMassResidualKg),Math.abs(r.summary.co2MassResidualKg)),energyResidualJ:r.summary.energyResidualJ})),convergence,parcels},null,2))
