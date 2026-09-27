import { describe, expect, it } from 'vitest'
import { buildDebrisReplay, contactVelocity, debrisPose, DEBRIS_DEFAULTS, stepDebris, type DebrisState } from '../src/ui/studyDynamics'
import { DEFAULT_STUDY_CAGE, STUDY_FRAGMENTS, STUDY_GRAVITY, studyAnimation } from '../src/ui/studyModel'

describe('reduced studio debris dynamics', () => {
  it('matches free-fall acceleration and improves with timestep refinement', () => {
    const run = (hz: number) => {
      let state: DebrisState = { position: [0, 10, 0], velocity: [2, 0, 0], radius: 0.05, density: 1800 }
      for (let i = 0; i < hz; i++) state = stepDebris(state, 1 / hz, -100, [], { ...DEBRIS_DEFAULTS, airDensity: 0 })
      return state
    }
    const exact = 10 - STUDY_GRAVITY / 2, coarse = run(120), fine = run(240)
    expect(fine.position[0]).toBeCloseTo(2, 9)
    expect(fine.velocity[1]).toBeCloseTo(-STUDY_GRAVITY, 9)
    expect(Math.abs(fine.position[1] - exact)).toBeLessThan(Math.abs(coarse.position[1] - exact) * 0.51)
    expect(Math.abs(fine.position[1] - exact)).toBeLessThan(0.021)
  })
  it('drag dissipates kinetic energy and affects small/light particles more', () => {
    const state: DebrisState = { position: [0, 10, 0], velocity: [5, 0, 0], radius: 0.05, density: 1800 }
    const options = { ...DEBRIS_DEFAULTS, gravity: 0 }
    const dense = stepDebris(state, 0.01, -100, [], options)
    const light = stepDebris({ ...state, density: 300 }, 0.01, -100, [], options)
    expect(dense.velocity[0]).toBeLessThan(5)
    expect(light.velocity[0]).toBeLessThan(dense.velocity[0])
  })
  it('contacts dissipate energy without reversing tangential velocity', () => {
    const result = contactVelocity([2, -3, 1], [0, 1, 0], 0.22, 0.6)
    expect(result[1]).toBeCloseTo(0.66)
    expect(result[0]).toBeGreaterThanOrEqual(0)
    expect(Math.hypot(...result)).toBeLessThan(Math.sqrt(14))
    expect(contactVelocity([0, 3, 0], [0, 1, 0], 0.22, 0.6)).toEqual([0, 3, 0])
  })
  it('resolves cage-bar contact and keeps settled debris on its support', () => {
    const state: DebrisState = { position: [0.05, 0.5, 0], velocity: [-1, 0, 0], radius: 0.05, density: 1800 }
    const hit = stepDebris(state, 1 / 240, -1, [{ start: [0, 0, 0], end: [0, 1, 0] }])
    expect(hit.position[0]).toBeGreaterThanOrEqual(0.056 - 1e-10)
    expect(hit.velocity[0]).toBeGreaterThan(0)
    let resting = { ...state, position: [1, 0.05, 0] as [number, number, number], velocity: [0, 0, 0] as [number, number, number] }
    for (let i = 0; i < 1000; i++) resting = stepDebris(resting, 1 / 240, 0, [])
    expect(resting.position[1]).toBe(0.05)
    expect(resting.velocity).toEqual([0, 0, 0])
  })
  it('replays finite, grounded results deterministically with no motion before release', () => {
    const replay = buildDebrisReplay(DEFAULT_STUDY_CAGE)
    for (let i = 0; i < replay.count; i++) {
      expect(debrisPose(replay, i, 8.999)).toEqual(debrisPose(replay, i, 0))
      const middle = debrisPose(replay, i, 9.6)
      debrisPose(replay, i, 20)
      expect(debrisPose(replay, i, 9.6)).toEqual(middle)
      for (const time of [9.1, 10, 12, 20]) {
        const pose = debrisPose(replay, i, time)
        expect(pose.every(Number.isFinite)).toBe(true)
        const floor = STUDY_FRAGMENTS[i].surface ? 0 : -3.16
        expect(pose[1]).toBeGreaterThanOrEqual(floor + STUDY_FRAGMENTS[i].size * 0.7 - 1e-6)
      }
      expect(debrisPose(replay, i, 19)).toEqual(debrisPose(replay, i, 20))
    }
  })
  it('preserves earlier sequences and gives the latest drop physical acceleration', () => {
    expect(studyAnimation(12, 'original').sourceVisible).toBe(true)
    expect(studyAnimation(12, 'release').sourceVisible).toBe(false)
    expect(studyAnimation(8.999, 'dynamics').sourceVisible).toBe(true)
    expect(studyAnimation(9, 'dynamics').sourceVisible).toBe(false)
    expect(studyAnimation(4, 'dynamics').sourceOffsetY).toBeCloseTo(0, 10)
    const start = 4 - Math.sqrt(7 / STUDY_GRAVITY)
    expect(studyAnimation(start + 0.2, 'dynamics').sourceOffsetY).toBeCloseTo(3.5 - STUDY_GRAVITY * 0.2 ** 2 / 2)
    expect(studyAnimation(10, 'original').transport).toBeGreaterThan(studyAnimation(10, 'release').transport)
  })
})
