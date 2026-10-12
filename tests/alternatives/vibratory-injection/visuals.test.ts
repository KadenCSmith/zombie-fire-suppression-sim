import { describe,expect,it } from 'vitest'
import { injectionLevels,treatmentVisual } from '../../../src/alternatives/vibratory-injection/visuals'
import { VibratoryFieldRun } from '../../../src/alternatives/vibratory-injection/field'

describe('historical V2 liquid choreography — off-scope for vibration only',()=>{
  it('shakes during injection, wets the peat, removes authored embers and settles',()=>{
    expect(treatmentVisual(24).shake).toBe(0)
    expect(treatmentVisual(35).active).toBe(true)
    expect(treatmentVisual(35).shake).toBe(1)
    expect(Math.abs(treatmentVisual(35).displacementX)).toBeGreaterThan(.001)
    expect(treatmentVisual(55).fire).toBe(0)
    expect(treatmentVisual(60).shake).toBe(0)
    expect(treatmentVisual(60).settled).toBe(1)
    expect(treatmentVisual(60,false).fire).toBe(1)
    expect(treatmentVisual(35,true,false).shake).toBe(0)
  })
  it('places four distinct lateral outlet levels within the inserted shaft',()=>{
    const levels=injectionLevels(1.385)
    expect(new Set(levels).size).toBe(4)
    expect(levels.every(y=>y<0&&y>-1.385)).toBe(true)
  })
  it('seeks deterministically and never changes an accepted physical state',()=>{
    const run=new VibratoryFieldRun({endS:.125}),before=run.advanceTo(.125)
    const forward=treatmentVisual(35)
    treatmentVisual(90);treatmentVisual(0);treatmentVisual(35,true,false)
    expect(treatmentVisual(35)).toEqual(forward)
    expect(run.snapshot()).toEqual(before)
  })
})
