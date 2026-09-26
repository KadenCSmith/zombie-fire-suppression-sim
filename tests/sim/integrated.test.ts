import { describe, expect, it } from 'vitest'
import { createDefaultScenario, Simulation } from '../../src/sim'
import type { Scenario } from '../../src/sim'

function commonScenario(): Scenario {
  const s = createDefaultScenario()
  s.domain.nx = 4; s.domain.ny = 4; s.domain.nz = 4
  s.hotRegions[0].shape = 'slab'
  s.hotRegions[0].sizeXM = 3; s.hotRegions[0].sizeYM = 3; s.hotRegions[0].thicknessM = 1.5
  s.source.initialMassKg = 0.001
  s.source.enabled = true
  s.source.heatGenerationWm3 = 2500
  s.model.maxStepS = 10
  return s
}

describe('integrated reduced-model comparisons', () => {
  it('runs common-state source, moisture, permeability, and assumed-pathway variants with closed ledgers', () => {
    const cases: Array<[string, (s: Scenario) => void]> = [
      ['untreated', s => { s.source.initialMassKg = 0; s.source.enabled = false }],
      ['dry-ice-heater-off', s => { s.source.enabled = false }],
      ['dry-ice-heater-on', () => {}],
      ['wet-heater-on', s => { s.soil.moistureSaturation = 0.5; s.peatRegions[0].moistureSaturation = 0.5 }],
      ['low-permeability-heater-on', s => {
        s.soil.intrinsicPermeabilityHorizontalM2 *= 0.1
        s.soil.intrinsicPermeabilityVerticalM2 *= 0.1
      }],
      ['assumed-pathway-heater-on', s => { s.pathways = [{
        id: 'benchmark-path', centerXM: 3.05, centerYM: 3.05, centerDepthM: 1.5,
        sizeXM: 2, sizeYM: 2, thicknessM: 3, rotationDeg: 0,
        permeabilityMultiplier: 10,
      }] }],
    ]
    const results: Record<string, { fuelConsumedKg: number; remainingDryIceKg: number; peakTemperatureK: number }> = {}
    for (const [name, change] of cases) {
      const scenario = commonScenario()
      change(scenario)
      const sim = new Simulation(scenario)
      const end = sim.advance(600)
      expect(end.timeSeconds).toBe(600)
      expect(end.diagnostics.status).toBe('running')
      expect(Math.abs(end.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-7)
      expect(Math.abs(end.diagnostics.sourceEnergyResidualJ)).toBeLessThan(1e-6)
      for (const residual of Object.values(end.diagnostics.speciesBalanceResidualMol)) {
        expect(Math.abs(residual)).toBeLessThan(1e-7)
      }
      results[name] = {
        fuelConsumedKg: end.diagnostics.cumulativeFuelConsumedKg,
        remainingDryIceKg: end.dryIceMassKg,
        peakTemperatureK: end.peakTemperatureK,
      }
    }
    expect(results.untreated.remainingDryIceKg).toBe(0)
    expect(results['dry-ice-heater-on'].remainingDryIceKg).toBe(0)
    expect(results['dry-ice-heater-on'].fuelConsumedKg).toBeGreaterThan(0)
    expect(results['assumed-pathway-heater-on'].fuelConsumedKg).not.toBe(results['dry-ice-heater-on'].fuelConsumedKg)
    console.log('INTEGRATED_COMPARISON', JSON.stringify(results))
  })
})
