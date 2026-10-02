import { describe, expect, it } from 'vitest'
import { buildPeatAppearance, buildStoryWettingGrid, storyRupture, storyRuptureOffset } from '../src/story/fireAppearance'
import { FIRE_SEQUENCE_GEOMETRY as G, illustratedPeatCoverage } from '../src/story/fireSequence'

describe('connected, reproducible presentation appearance', () => {
  const field = buildPeatAppearance()
  it('starts at the surface entry and reaches each patch from an earlier neighbour', () => {
    expect(field.mask[field.source]).toBe(1)
    for(let id=0;id<field.arrival.length;id++)if(field.mask[id]&&id!==field.source){
      const parent=field.predecessor[id]
      expect(parent).toBeGreaterThanOrEqual(0)
      expect(field.arrival[parent]).toBeLessThan(field.arrival[id])
      expect(Math.abs(id%field.nx-parent%field.nx)).toBeLessThanOrEqual(1)
      expect(Math.abs(Math.floor(id/field.nx)-Math.floor(parent/field.nx))).toBeLessThanOrEqual(1)
    }
    expect(Array.from(field.arrival)).toEqual(Array.from(buildPeatAppearance().arrival))
  })
  it('delays peat spread until entry and gates treatment at70% sampled area', () => {
    const fraction=(time:number)=>Array.from(field.arrival).filter((a,id)=>field.mask[id]&&a<=illustratedPeatCoverage(time)).length/field.peatPixels
    expect(fraction(12)).toBe(0)
    expect(fraction(20)).toBeLessThan(.7)
    expect(Math.abs(fraction(24)-.7)).toBeLessThan(1/field.peatPixels)
    expect(fraction(90)).toBe(fraction(24))
  })
  it('retains installation clearance in the smaller authored bore', () => {
    const sphereRadius=Math.cbrt(3*G.sourceInitialMassKg/(4*Math.PI*G.sourceDensityKgM3))
    expect(G.boreRadiusM).toBe(.24)
    expect(G.augerRadiusM).toBeLessThan(G.boreRadiusM)
    expect(G.capFoldedRadiusM).toBeLessThan(G.boreRadiusM)
    expect(G.capDepthM+G.capRiseM).toBeLessThan(G.sourceDepthM-sphereRadius)
  })
  it('keeps the rapid visual pulse independent from gradual physics and leaves lasting gaps', () => {
    for(const t of [0,54.99,55,55.3,61,90])expect(storyRupture(t,'gradual')).toEqual({pulse:0,damage:0})
    expect(storyRupture(55,'rapid').pulse).toBe(0)
    expect(storyRupture(55.3,'rapid').pulse).toBeGreaterThan(.8)
    expect(storyRupture(61,'rapid').pulse).toBeLessThan(.001)
    expect(storyRupture(90,'rapid').damage).toBe(1)
    const peak=storyRupture(55.3,'rapid')
    expect(storyRuptureOffset(.4,0,0,peak.pulse,peak.damage)[1]).toBeGreaterThan(.5)
    expect(storyRuptureOffset(.4,-3.2,0,peak.pulse,peak.damage)).toEqual([0,0,-0])
  })
})

describe('limited local soil wetting appearance',()=>{
  it('has no pre-water stain and never wets most of the section',()=>{
    expect(Array.from(buildStoryWettingGrid(71.99).data).every(v=>v===0)).toBe(true)
    const late=buildStoryWettingGrid(90),early=buildStoryWettingGrid(73)
    const count=(data:Float32Array)=>Array.from(data).filter((v,i)=>i%4===0&&v>.05).length
    expect(count(late.data)).toBeGreaterThan(count(early.data))
    expect(count(late.data)/(late.width*late.height)).toBeLessThan(.15)
  })
  it('fills only short current-scenario branches after the hose arrives',()=>{
    const early=buildStoryWettingGrid(71,true),late=buildStoryWettingGrid(90,true)
    const count=(data:Float32Array)=>Array.from(data).filter((v,i)=>i%4===0&&v>.05).length
    expect(count(early.data)).toBe(0)
    expect(count(late.data)).toBeGreaterThan(0)
    expect(count(late.data)/(late.width*late.height)).toBeLessThan(.08)
    expect(count(buildStoryWettingGrid(90,true,'gradual').data)).toBe(0)
  })
})
