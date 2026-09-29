import { describe, expect, it } from 'vitest'
import { createFireProtocol } from '../src/coupled/fireProtocol'

describe('cold surface ignition protocol', () => {
  it('retains wet fuel at atmospheric temperature with no hidden prepared hot region', () => {
    const run = createFireProtocol({ durationS: 2, ignitionDurationS: 1 })
    expect(run.scenario.hotRegions).toHaveLength(0)
    expect(run.sim.preparedWaterRemovedKg).toBe(0)
    expect(run.sim.dryIce).toBe(0)
    expect(Math.max(...run.sim.temperature)).toBeCloseTo(283.15, 6)
    expect(Math.min(...run.sim.liquid)).toBeGreaterThan(0)
    const water = run.sim.liquid.reduce((sum, v) => sum + v, 0)
    const dry = run.sim.fuel.reduce((sum, v, i) => sum + v + run.sim.mineral[i], 0)
    expect(water / dry).toBeCloseTo(0.1, 4)
    expect(run.capture().metrics.reactedFuelKg).toBe(0)
  })

  it('books finite ignition energy and switches it off at the requested physical event', () => {
    const run = createFireProtocol({ durationS: 2, ignitionDurationS: 1, ignitionPowerW: 100 })
    run.sim.advance(2)
    expect(run.sim.ledger.heaterJ).toBeCloseTo(100, 9)
    expect(run.sim.ledger.reactionJ).toBe(0)
    expect(Math.abs(run.sim.ledger.energyResidualJ)).toBeLessThan(1e-4)
    expect(Math.abs(run.sim.ledger.massResidualKg)).toBeLessThan(1e-7)
    expect(run.capture().phase).toBe('unforced-reaction')
    expect(run.capture().temperatureK).toHaveLength(2560)
  })

  it('rejects nonphysical protocol controls', () => {
    expect(() => createFireProtocol({ moistureDryBasis: -1 })).toThrow()
    expect(() => createFireProtocol({ durationS: 100, ignitionDurationS: 101 })).toThrow()
    expect(() => createFireProtocol({ maxStepS: NaN })).toThrow()
  })
})
