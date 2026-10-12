import { describe, expect, it } from 'vitest'
import { preparationVisuals } from '../../../src/alternatives/sublimation-injection/visuals'
import { PRESENTATION_TIMING } from '../../../src/alternatives/sublimation-injection'

describe('4.2.1 authored visual sequence', () => {
  it('supports arbitrary seeking, restart and invalid inputs without persistent animation state', () => {
    const target = preparationVisuals(73.25)
    for (const time of [90, 0, 55, -20, NaN, Infinity, 73.25]) {
      const state = preparationVisuals(time)
      expect(Object.values(state).every(Number.isFinite)).toBe(true)
    }
    expect(preparationVisuals(73.25)).toEqual(target)
    expect(preparationVisuals(0)).toEqual(preparationVisuals(-1))
    expect(preparationVisuals(90)).toEqual(preparationVisuals(120))
  })

  it('does not show delivery before its authored stage or turn cues into physical measurements', () => {
    for (let time = 0; time <= PRESENTATION_TIMING.injectionS; time += .25) {
      expect(preparationVisuals(time).delivery).toBe(0)
      expect(preparationVisuals(time).contact).toBe(0)
    }
    const finished = preparationVisuals(90)
    expect(finished.delivery).toBe(1)
    expect(finished.contact).toBe(1)
    expect(Object.keys(finished).some(key => /kg|kelvin|pressure|temperature|oxygen|fuel|energy/i.test(key))).toBe(false)
  })

  it('scrubs smoothly through the phase-change and contact transitions', () => {
    let previous = preparationVisuals(0)
    for (let frame = 1; frame <= 90 * 30; frame++) {
      const next = preparationVisuals(frame / 30)
      for (const key of ['phaseChange', 'delivery', 'contact'] as const) {
        expect(next[key]).toBeGreaterThanOrEqual(previous[key])
        expect(next[key]).toBeGreaterThanOrEqual(0)
        expect(next[key]).toBeLessThanOrEqual(1)
        expect(next[key] - previous[key]).toBeLessThan(.01)
      }
      previous = next
    }
  })
})
