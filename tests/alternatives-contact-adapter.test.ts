import { describe, expect, it } from 'vitest'
import { createContactCoolingSession } from '../src/alternatives/contactAdapter'
import { simulateContactCooling, type ContactPatchSpec } from '../src/story/contactCooling'
const patches: ContactPatchSpec[]=[{id:'test',xM:0,yM:0,radiusM:.04,peatMassKg:.5,dryIceConductanceWK:8,waterConductanceWK:24,waterArrivalTimeS:8,waterShare:1}]
const config={startTimeS:0,endTimeS:60,rapidRemovalTimeS:60,waterStartTimeS:8,waterInitialKg:.5,dryIceInitialKg:.05}
describe('external adapter over unchanged original API',()=>{
  it('exactly matches public reference at accepted targets regardless of partition',()=>{
    const run=createContactCoolingSession(config,patches)
    for(const t of [0,.5,8,12.5,30,60])expect(run.advanceTo(t)).toEqual(simulateContactCooling(t,'gradual',config,patches))
  })
  it('owns input and output objects and independent simultaneous instances',()=>{
    const input=structuredClone(config),specs=structuredClone(patches)
    const a=createContactCoolingSession(input,specs),b=createContactCoolingSession(config,patches)
    input.waterInitialKg=0;specs[0].waterShare=0
    const snapshot=a.advanceTo(30);snapshot.patches[0].temperatureK=9999
    expect(a.snapshot()).toEqual(simulateContactCooling(30,'gradual',config,patches))
    expect(b.snapshot().storyTimeS).toBe(0)
  })
  it('rejects backward, nonfinite and out-of-window targets',()=>{
    const run=createContactCoolingSession(config,patches);run.advanceTo(10)
    for(const t of [9,NaN,Infinity,61])expect(()=>run.advanceTo(t)).toThrow()
  })
})
