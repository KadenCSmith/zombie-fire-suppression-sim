import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'
import { currentEquipmentState } from '../../../src/story/firePresentation'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../../src/story/fireSequence'
import { DRILL_SECTION_STARTS, HYDRAULIC_PULSES, liquidAnimationFrame, pipeTruckFrame } from '../../../src/alternatives/pressure-pulse-liquid-waves/animation'
import { fissureVertices } from '../../../src/alternatives/pressure-pulse-liquid-waves/groundPulse'

describe('original-based liquid method animation regressions', () => {
  it('retains the original burst and water hose timing and alternates pumping with ground pulses', () => {
    expect(liquidAnimationFrame(55).injection).toBe(false)
    expect(liquidAnimationFrame(65).injection).toBe(false)
    expect(liquidAnimationFrame(72)).toMatchObject({ injection: true, waves: false })
    for (const [start, end] of HYDRAULIC_PULSES) {
      expect(liquidAnimationFrame(start - .1)).toMatchObject({ injection: true, waves: false })
      expect(liquidAnimationFrame(start + .15)).toMatchObject({ injection: true, waves: true })
      expect(liquidAnimationFrame(end)).toMatchObject({ injection: true, waves: false, strength: 0, tremor: 0 })
    }
  })
  it('moves and settles the ground while widening fissures and keeping seeking deterministic', () => {
    expect(liquidAnimationFrame(76.15).strength).toBeGreaterThan(liquidAnimationFrame(77).strength)
    expect(liquidAnimationFrame(75.15).flowClock).toBeGreaterThan(liquidAnimationFrame(75).flowClock)
    expect(liquidAnimationFrame(77).opening).toBeGreaterThan(liquidAnimationFrame(76).opening)
    const paused = liquidAnimationFrame(83)
    liquidAnimationFrame(90); liquidAnimationFrame(0)
    expect(liquidAnimationFrame(83)).toEqual(paused)
    expect(liquidAnimationFrame(90).opening).toBe(1)
  })
  it('stages two distinct trucks on opposite sides and lowers a rigid pipe before pumping', () => {
    expect(pipeTruckFrame(56.9).visible).toBe(false)
    expect(pipeTruckFrame(58).position[0]).toBeLessThan(pipeTruckFrame(65).position[0])
    expect(Math.cos(pipeTruckFrame(58).heading) * (pipeTruckFrame(65).position[0] - pipeTruckFrame(58).position[0])).toBeLessThan(0)
    expect(currentEquipmentState(58).truckPosition[0]).toBeGreaterThan(currentEquipmentState(65).truckPosition[0])
    expect(pipeTruckFrame(65).position[0]).toBeLessThan(G.sourceX)
    expect(currentEquipmentState(65).truckPosition[0]).toBeGreaterThan(G.sourceX)
    expect(pipeTruckFrame(68).pipeBottom).toBeGreaterThan(pipeTruckFrame(70).pipeBottom)
    expect(pipeTruckFrame(71).connected).toBe(false)
    expect(pipeTruckFrame(72)).toMatchObject({ connected: true, pipeBottom: -G.sourceDepthM })
    const parked = pipeTruckFrame(80)
    pipeTruckFrame(0); pipeTruckFrame(90)
    expect(pipeTruckFrame(80)).toEqual(parked)
  })
  it('joins separate pipe sections with rotation paused, then leaves the assembled string embedded for every pulse', () => {
    for (const [i, start] of DRILL_SECTION_STARTS.entries()) {
      const joining = pipeTruckFrame(start + .2), drilling = pipeTruckFrame(start + .7)
      expect(joining.sectionCount).toBe(i + 1)
      expect(joining.drilling).toBe(false)
      expect(joining.drillRotation).toBeCloseTo(pipeTruckFrame(start).drillRotation, 12)
      expect(joining.incomingPosition[0]).toBeLessThan(G.sourceX - .11)
      expect(drilling.drilling).toBe(true)
      expect(drilling.pipeBottom).toBeLessThan(joining.pipeBottom)
      expect(drilling.drillRotation).toBeGreaterThan(joining.drillRotation)
    }
    const installed = pipeTruckFrame(72)
    expect(installed).toMatchObject({ sectionCount: 3, pipeBottom: -G.sourceDepthM, connected: true, drilling: false, joining: 0, mastAngle: 0 })
    for (const [start] of HYDRAULIC_PULSES) {
      const pumping = pipeTruckFrame(start + .15)
      expect(pumping.pipeBottom).toBe(installed.pipeBottom)
      expect(pumping.pipeTop).toBe(installed.pipeTop)
      expect(pumping.drillRotation).toBe(installed.drillRotation)
    }
    const pausedJoin = pipeTruckFrame(DRILL_SECTION_STARTS[1] + .2)
    pipeTruckFrame(0); pipeTruckFrame(90)
    expect(pipeTruckFrame(DRILL_SECTION_STARTS[1] + .2)).toEqual(pausedJoin)
  })
  it('uses actual moving earth banks and increasingly extended crack meshes', () => {
    const burst = liquidAnimationFrame(76.15), settled = liquidAnimationFrame(78), final = liquidAnimationFrame(90)
    const a = fissureVertices(3, burst.opening, burst.strength, 1)
    const b = fissureVertices(3, settled.opening, settled.strength, 1)
    const c = fissureVertices(3, final.opening, final.strength, 1)
    const axis = (p: number[], index: number) => p.filter((_, i) => i % 3 === index)
    expect(a.every(Number.isFinite)).toBe(true)
    expect(Math.max(...axis(a, 2))).toBeGreaterThan(Math.max(...axis(b, 2)))
    expect(Math.max(...axis(c, 0))).toBeGreaterThan(Math.max(...axis(b, 0)))
  })
  it('never credits authored truck, fracture or pulse effects to numerical heat or water sources', () => {
    const a = createRun(freshPanel('a', 'liquid-waves')), b = createRun(freshPanel('b', 'liquid-waves'))
    for (let t = 0; t <= 90; t += .2) { liquidAnimationFrame(t); pipeTruckFrame(t) }
    expect(a.advanceTo(60)).toEqual(b.advanceTo(60))
  })
  it('shows extinguishing after water arrives and keeps it entirely in presentation state', () => {
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
