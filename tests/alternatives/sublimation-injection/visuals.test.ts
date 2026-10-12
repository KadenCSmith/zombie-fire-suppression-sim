import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'
import { DELIVERY_ROUTE, MEDIA_MOUNT, TRUCK_PARKED, WORLD_STAGING, preparationVisuals, solidCuePosition } from '../../../src/alternatives/sublimation-injection/visuals'

describe('4.2.1 authored world sequence', () => {
  it('supports arbitrary seeking, restart and invalid inputs without persistent animation state', () => {
    const target = preparationVisuals(73.25)
    for (const time of [90, 0, 55, -20, NaN, Infinity, 73.25]) {
      expect(Object.values(preparationVisuals(time)).every(Number.isFinite)).toBe(true)
    }
    expect(preparationVisuals(73.25)).toEqual(target)
    expect(preparationVisuals(0)).toEqual(preparationVisuals(-1))
    expect(preparationVisuals(90)).toEqual(preparationVisuals(120))
  })

  it('parks on the grass before connecting the hose or adding dry ice', () => {
    expect(preparationVisuals(WORLD_STAGING.arrive).truckTravel).toBeGreaterThan(0)
    expect(preparationVisuals(WORLD_STAGING.parked).truckTravel).toBe(0)
    expect(WORLD_STAGING.parked).toBeLessThan(WORLD_STAGING.iceStart)
    for (let time = 0; time <= WORLD_STAGING.parked; time += .25) {
      expect(preparationVisuals(time).hose).toBe(0)
      expect(preparationVisuals(time).loading).toBe(0)
    }
    expect(TRUCK_PARKED[1]).toBe(0)
    expect(TRUCK_PARKED[0] + 1.5).toBeLessThan(4)
    expect(TRUCK_PARKED[2] + .72).toBeLessThan(0)
    expect(TRUCK_PARKED[2] - .72).toBeGreaterThan(-4)
  })

  it('connects the payload outlet continuously to the original drilled access', () => {
    const outlet = [.56, -.38, .4]
    DELIVERY_ROUTE[0].forEach((coordinate, i) => {
      expect(coordinate).toBeCloseTo(TRUCK_PARKED[i] + MEDIA_MOUNT[i] + outlet[i], 12)
    })
    expect(DELIVERY_ROUTE.at(-1)).toEqual([.4, -1.3, .08])
    for (let time = 0; time <= WORLD_STAGING.hoseReady; time += .25) {
      expect(preparationVisuals(time).delivery).toBe(0)
    }
  })

  it('visibly loads each solid into water before the flow acceleration finishes', () => {
    for (let i = 0; i < 9; i++) {
      const before = solidCuePosition(WORLD_STAGING.iceStart, i)
      const after = solidCuePosition(WORLD_STAGING.iceEnd, i)
      expect(before[1]).toBeGreaterThan(.65)
      expect(after[1]).toBeLessThan(0)
      expect(after[1]).toBeGreaterThan(-.55)
      expect(Math.hypot(after[0], after[2])).toBeLessThan(.685)
      expect(before.every(Number.isFinite) && after.every(Number.isFinite)).toBe(true)
    }
    expect(WORLD_STAGING.iceEnd).toBeLessThan(WORLD_STAGING.boostEnd)
  })

  it('increases the authored particle speed continuously after loading begins', () => {
    const phase = (time: number) => preparationVisuals(time).flowTravel
    const speed = (time: number) => (phase(time + .001) - phase(time)) / .001
    expect(speed(75)).toBeGreaterThan(speed(58) * 2)
    for (const boundary of [WORLD_STAGING.boostStart, WORLD_STAGING.boostEnd]) {
      expect(Math.abs(speed(boundary - .001) - speed(boundary + .001))).toBeLessThan(.0001)
    }
    expect(preparationVisuals(WORLD_STAGING.iceStart).boost).toBe(0)
    expect(preparationVisuals(90).boost).toBe(1)
  })

  it('scrubs smoothly through truck, loading, phase-change and water transitions', () => {
    let previous = preparationVisuals(0)
    for (let frame = 1; frame <= 90 * 30; frame++) {
      const next = preparationVisuals(frame / 30)
      for (const key of ['arrival', 'hose', 'loading', 'phaseChange', 'delivery', 'contact', 'boost'] as const) {
        expect(next[key]).toBeGreaterThanOrEqual(previous[key])
        expect(next[key]).toBeGreaterThanOrEqual(0)
        expect(next[key]).toBeLessThanOrEqual(1)
        expect(next[key] - previous[key]).toBeLessThan(.02)
      }
      previous = next
    }
  })

  it('never turns the illustrated flow increase into a physical source or ledger change', () => {
    const run = createRun(freshPanel('world-cue-test', 'sublimation-injection'))
    const before = run.snapshot()
    for (let time = 0; time <= 90; time += .1) {
      preparationVisuals(time)
      for (let i = 0; i < 9; i++) solidCuePosition(time, i)
    }
    expect(run.snapshot()).toEqual(before)
    expect(Object.keys(preparationVisuals(90)).some(key => /kg|kelvin|pressure|temperature|oxygen|fuel|energy/i.test(key))).toBe(false)
  })
})
