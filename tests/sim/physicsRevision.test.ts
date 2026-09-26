import { describe, it, expect } from 'vitest'
import { Simulation, createDefaultScenario, validateScenario } from '../../src/sim'

function dryBox() {
  const s = createDefaultScenario()
  s.domain = { widthM: 1, lengthM: 1, depthM: 0.5, nx: 4, ny: 4, nz: 4 }
  s.source.centerXM = 0.5; s.source.centerYM = 0.5; s.source.centerDepthM = 0.25
  s.source.initialMassKg = 0; s.source.enabled = false
  s.peatRegions = []; s.hotRegions = []; s.root.amountKgM3 = 0
  s.soil.bulkDensityKgM3 = 50; s.soil.porosity = 0.9; s.soil.moistureSaturation = 0
  s.soil.solidHeatCapacityJKgK = 100; s.soil.thermalConductivityWmK = 0.01
  s.soilLayers = [{ ...s.soilLayers[0], thicknessM: 0.5, dryDensityMultiplier: 1, porosityOffset: 0,
    moistureSaturationOffset: 0, thermalConductivityMultiplier: 1, permeabilityMultiplier: 1 }]
  s.model.smolderRateS = 0; s.model.evaporationRateS = 0; s.model.maxStepS = 3600
  s.atmosphere.temperatureC = 20; s.atmosphere.deepTemperatureC = 20
  s.atmosphere.bottomHeatTransferWm2K = 0
  return s
}

describe('physics revision safeguards', () => {
  it('bounds explicit surface cooling by the cell heat capacity and Robin conductance', () => {
    const s = dryBox(); s.atmosphere.surfaceHeatTransferWm2K = 100
    s.hotRegions = [{ id: 'top', shape: 'slab', centerXM: 0.5, centerYM: 0.5, centerDepthM: 0.0625,
      sizeXM: 1, sizeYM: 1, thicknessM: 0.125, temperatureC: 80, fuelFraction: 1 }]
    const sim = new Simulation(s), snap = sim.step(3600)
    expect(snap.diagnostics.status).toBe('running')
    expect(snap.timeSeconds).toBeLessThan(10)
    expect(Math.min(...snap.fields.temperatureK)).toBeGreaterThanOrEqual(293.15 - 1e-4)
    expect(Math.max(...snap.fields.temperatureK)).toBeLessThan(353.15)
    expect(Math.abs(snap.diagnostics.resolvedHeatResidualJ)).toBeLessThan(1e-8)
  })
  it('keeps the same molar O2:CO2:H2O reaction proportions while retaining historical imports', () => {
    for (const revision of [undefined, 2] as const) {
      const s = dryBox(); s.numericalRevision = revision
      s.atmosphere.topGasBoundary = 'noFlux'; s.atmosphere.sideGasBoundary = 'noFlux'
      s.atmosphere.surfaceHeatTransferWm2K = 0; s.model.smolderRateS = 1e-4
      s.hotRegions = [{ id: 'fire', shape: 'slab', centerXM: 0.5, centerYM: 0.5, centerDepthM: 0.25,
        sizeXM: 1, sizeYM: 1, thicknessM: 0.5, temperatureC: 270, fuelFraction: 1 }]
      const sim = new Simulation(s), before = sim.serialize(); sim.advance(0.01); const after = sim.serialize()
      const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)
      const usedO2 = sum(before.arrays.oxygen) - sum(after.arrays.oxygen)
      const addedCO2 = sum(after.arrays.co2) - sum(before.arrays.co2)
      const addedWater = sum(after.arrays.vapor) - sum(before.arrays.vapor)
      const fuel = sum(before.arrays.fuel) - sum(after.arrays.fuel)
      expect(fuel).toBeGreaterThan(0)
      if (revision === 2) {
        expect(addedCO2 / usedO2).toBeCloseTo(1, 9)
        expect(addedWater / usedO2).toBeCloseTo(5 / 6, 9)
      } else expect(usedO2 * 0.031998 / fuel).toBeCloseTo(192 / 162, 8)
      const restored = Simulation.restore(after)
      restored.advance(0.01); sim.advance(0.01)
      expect(restored.serialize()).toEqual(sim.serialize())
    }
    expect(validateScenario({ ...dryBox(), numericalRevision: 99 }).valid).toBe(false)
  })
})
