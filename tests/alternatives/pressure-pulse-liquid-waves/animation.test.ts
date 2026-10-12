import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'
import { HYDRAULIC_PULSES, liquidAnimationFrame } from '../../../src/alternatives/pressure-pulse-liquid-waves/animation'

describe('original-based liquid method animation regressions', () => {
  it('leaves the original burst/truck/hose intact and alternates normal pumping with pulses', () => {
    expect(liquidAnimationFrame(55).injection).toBe(false)
    expect(liquidAnimationFrame(65).drops).toHaveLength(0)
    expect(liquidAnimationFrame(72)).toMatchObject({ injection: true, waves: false })
    for (const [start, end] of HYDRAULIC_PULSES) {
      expect(liquidAnimationFrame(start - .1)).toMatchObject({ injection: true, waves: false })
      expect(liquidAnimationFrame(start + 1)).toMatchObject({ injection: true, waves: true })
      expect(liquidAnimationFrame(end)).toMatchObject({ injection: true, waves: false })
    }
  })
  it('moves pulse fronts, fissure overlays and liquid while deterministic seeking reproduces a frame', () => {
    expect(liquidAnimationFrame(76.3).fronts).not.toEqual(liquidAnimationFrame(76.5).fronts)
    expect(liquidAnimationFrame(75).drops).not.toEqual(liquidAnimationFrame(75.15).drops)
    expect(liquidAnimationFrame(77).opening).toBeGreaterThan(liquidAnimationFrame(76).opening)
    const paused = liquidAnimationFrame(83)
    liquidAnimationFrame(90); liquidAnimationFrame(0)
    expect(liquidAnimationFrame(83)).toEqual(paused)
    expect(liquidAnimationFrame(90).opening).toBe(1)
  })
  it('never credits illustrative fracture or pumping pulses to numerical heat or water sources', () => {
    const a = createRun(freshPanel('a', 'liquid-waves')), b = createRun(freshPanel('b', 'liquid-waves'))
    for (let t = 0; t <= 90; t += .2) liquidAnimationFrame(t)
    expect(a.advanceTo(60)).toEqual(b.advanceTo(60))
  })
  it('shows extinguishing only after water arrives and leaves it entirely in presentation state', () => {
    expect(liquidAnimationFrame(71).extinguishing).toBe(0)
    expect(liquidAnimationFrame(80).extinguishing).toBeGreaterThan(liquidAnimationFrame(75).extinguishing)
    expect(liquidAnimationFrame(89).extinguishing).toBe(1)
    const config = freshPanel('off', 'liquid-waves'); config.thermal.enabled = false
    const before = createRun(config).advanceTo(60)
    liquidAnimationFrame(90)
    expect(createRun(config).advanceTo(60)).toEqual(before)
    expect(before.metrics!.energyJ).toBe(0)
  })
})
