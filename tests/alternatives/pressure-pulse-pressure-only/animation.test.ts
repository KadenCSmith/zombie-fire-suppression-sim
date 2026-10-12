import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'
import { pressureAnimationFrame } from '../../../src/alternatives/pressure-pulse-pressure-only/animation'
import { pressureBankVertices } from '../../../src/alternatives/pressure-pulse-pressure-only/groundResponse'

describe('pressure-only animation regressions', () => {
  it('waits for the original release, jolts quickly and lets soil settle without liquid', () => {
    expect(pressureAnimationFrame(54.9).active).toBe(false)
    expect(pressureAnimationFrame(55)).toMatchObject({ active: true, jolt: 0, settled: 0 })
    expect(pressureAnimationFrame(55.1).jolt).toBeGreaterThan(pressureAnimationFrame(55.8).jolt)
    expect(pressureAnimationFrame(55.1).tremor).not.toBe(pressureAnimationFrame(55.2).tremor)
    expect(pressureAnimationFrame(58)).toMatchObject({ jolt: 0, fragments: false })
    expect(pressureAnimationFrame(62).settled).toBe(1)
    expect(pressureAnimationFrame(62).opening).toBeLessThan(pressureAnimationFrame(55.8).opening)
    expect(pressureAnimationFrame(70).stage).toBe('Observe · no liquid injected')
  })
  it('moves owned earth meshes outward then settles, with finite geometry throughout', () => {
    const burst = pressureAnimationFrame(55.1), rest = pressureAnimationFrame(62)
    for (let branch = 0; branch < 8; branch++) {
      const a = pressureBankVertices(branch, burst.opening, burst.jolt, burst.settled, 1)
      const b = pressureBankVertices(branch, rest.opening, rest.jolt, rest.settled, 1)
      expect(a.every(Number.isFinite)).toBe(true)
      expect(b.every(Number.isFinite)).toBe(true)
      expect(Math.max(...a.filter((_, i) => i % 3 === 2))).toBeGreaterThan(Math.max(...b.filter((_, i) => i % 3 === 2)))
      expect(a).not.toEqual(b)
    }
  })
  it('replays the same frame after out-of-order seeks without inventing a physical result', () => {
    const paused = pressureAnimationFrame(55.2)
    pressureAnimationFrame(70); pressureAnimationFrame(0)
    expect(pressureAnimationFrame(55.2)).toEqual(paused)
    const run = createRun(freshPanel('pressure', 'pressure-only'))
    for (let time = 0; time <= 90; time += .25) pressureAnimationFrame(time)
    expect(run.advanceTo(60)).toEqual({ timeS: 60, metrics: null })
    expect(pressureAnimationFrame(NaN)).toEqual(pressureAnimationFrame(0))
    expect(pressureAnimationFrame(Infinity)).toEqual(pressureAnimationFrame(0))
  })
})
