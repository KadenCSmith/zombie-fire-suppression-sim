import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'
import { liquidAnimationFrame, liquidAssetTime } from '../../../src/alternatives/pressure-pulse-liquid-waves/animation'

describe('liquid method animation regressions', () => {
  it('continues from drilling immediately and transitions from waves to flowing liquid', () => {
    expect(liquidAnimationFrame(37.9).fronts).toHaveLength(0)
    expect(liquidAnimationFrame(38).fronts.length).toBeGreaterThan(0)
    expect(liquidAnimationFrame(55.9).drops).toHaveLength(0)
    expect(liquidAnimationFrame(56)).toMatchObject({ waves: false, injection: true })
    expect(liquidAnimationFrame(60).drops.length).toBeGreaterThan(0)
    expect(liquidAssetTime(54)).toBe(65)
    expect(liquidAssetTime(56)).toBe(72)
  })
  it('moves both wave fronts and liquid particles while deterministic seeking freezes the same frame', () => {
    expect(liquidAnimationFrame(42).fronts).not.toEqual(liquidAnimationFrame(42.2).fronts)
    expect(liquidAnimationFrame(65).drops).not.toEqual(liquidAnimationFrame(65.15).drops)
    const paused = liquidAnimationFrame(65)
    liquidAnimationFrame(87); liquidAnimationFrame(0)
    expect(liquidAnimationFrame(65)).toEqual(paused)
    expect(liquidAnimationFrame(65).ripples).not.toEqual(liquidAnimationFrame(65.2).ripples)
  })
  it('never credits animation changes to numerical heat or water sources', () => {
    const a = createRun(freshPanel('a', 'liquid-waves')), b = createRun(freshPanel('b', 'liquid-waves'))
    for (let t = 0; t <= 90; t += .2) liquidAnimationFrame(t)
    expect(a.advanceTo(60)).toEqual(b.advanceTo(60))
  })
})
