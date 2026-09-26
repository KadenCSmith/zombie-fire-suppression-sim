import { describe, expect, it } from 'vitest'
import { transferMass } from '../../src/mechanics/massTransfer'
import { SoilMechanics } from '../../src/mechanics/model'
import { Simulation, createDefaultScenario } from '../../src/sim'
import { runFastEvent } from '../../src/fastEvent'

describe('conservative flow-to-mechanics inventory transfer', () => {
  it('integrates a uniform density exactly on non-aligned, non-cubic meshes', () => {
    const grid = { nx: 7, ny: 5, nz: 3, widthM: 7, lengthM: 10, depthM: 1.5, timeSeconds: 0,
      massKg: new Float64Array(105).fill(1000) }
    for (const n of [4, 6, 8]) {
      const result = transferMass(grid, n)
      expect(Math.abs(result.residualKg)).toBeLessThan(1e-8)
      for (const mass of result.mass) expect(mass).toBeCloseTo(105000 / n ** 3, 9)
    }
  })
  it('preserves a sharp interface and its exact integrated mass', () => {
    const result = transferMass({ nx: 2, ny: 1, nz: 1, widthM: 2, lengthM: 1, depthM: 1, timeSeconds: 0,
      massKg: new Float64Array([100, 300]) }, 3)
    // Each y-z patch is 1/9 of the domain; the middle x brick crosses the interface.
    expect(result.mass[0]).toBeCloseTo(100 * 2 / 27, 12)
    expect(result.mass[1]).toBeCloseTo(400 / 27, 12)
    expect(result.mass[2]).toBeCloseTo(300 * 2 / 27, 12)
    expect(result.mass.reduce((a, b) => a + b)).toBeCloseTo(400, 10)
  })
  it('uses current water, fuel, mineral and root inventories without reclassifying peat geometry', () => {
    const scenario = createDefaultScenario()
    scenario.source.initialMassKg = 0; scenario.source.enabled = false
    const sim = new Simulation(scenario); sim.advance(120)
    const stored = sim.serialize()
    const expected = ['fuel', 'mineral', 'water'].reduce((sum, key) => sum + stored.arrays[key].reduce((a, b) => a + b, 0), 0)
    const event = runFastEvent(scenario, sim.snapshot(), { durationS: 0.1, frameCount: 3 })
    const mechanics = new SoilMechanics(scenario, event, 6, sim.mechanicsMassState())
    expect(mechanics.checks.initialMassKg).toBeCloseTo(expected, 7)
    expect(Math.abs(mechanics.checks.massResidualKg)).toBeLessThan(1e-7)
    expect(() => new SoilMechanics(scenario, event, 4)).toThrow(/event time/)
    const current = sim.mechanicsMassState()
    current.massKg.fill(0)
    expect(sim.mechanicsMassState().massKg[0]).toBeGreaterThan(0)
  })
  it('rejects negative or nonfinite source inventories', () => {
    const g = { nx: 1, ny: 1, nz: 1, widthM: 1, lengthM: 1, depthM: 1, timeSeconds: 0, massKg: new Float64Array([-1]) }
    expect(() => transferMass(g, 4)).toThrow(/Invalid/)
    g.massKg[0] = NaN
    expect(() => transferMass(g, 4)).toThrow(/Invalid/)
  })
})
