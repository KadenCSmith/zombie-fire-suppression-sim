import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'
import { pressureAnimationFrame } from '../../../src/alternatives/pressure-pulse-pressure-only/animation'

describe('pressure-only animation regressions', () => {
  it('starts at the drilling handoff and expands and relaxes throughout its distinct stage', () => {
    expect(pressureAnimationFrame(37.9).active).toBe(false)
    expect(pressureAnimationFrame(38).active).toBe(true)
    expect(pressureAnimationFrame(38.2).fronts).not.toEqual(pressureAnimationFrame(38.8).fronts)
    expect(pressureAnimationFrame(46).fronts).not.toEqual(pressureAnimationFrame(46.2).fronts)
    expect(pressureAnimationFrame(65).active).toBe(true)
    expect(pressureAnimationFrame(66).active).toBe(false)
    expect(pressureAnimationFrame(70).stage).toBe('Observe · no liquid injected')
  })
  it('replays the same frame after out-of-order seeks without inventing a physical result', () => {
    const paused = pressureAnimationFrame(48)
    pressureAnimationFrame(70); pressureAnimationFrame(0)
    expect(pressureAnimationFrame(48)).toEqual(paused)
    const run = createRun(freshPanel('pressure', 'pressure-only'))
    for (let time = 0; time <= 90; time += .25) pressureAnimationFrame(time)
    expect(run.advanceTo(60)).toEqual({ timeS: 60, metrics: null })
  })
})
