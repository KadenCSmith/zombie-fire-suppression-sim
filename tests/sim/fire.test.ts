import { describe, expect, it } from 'vitest'
import { createDefaultScenario, Simulation } from '../../src/sim'
import type { Scenario } from '../../src/sim'

function fireScenario(): Scenario {
  const s = createDefaultScenario()
  s.domain.nx = 4; s.domain.ny = 4; s.domain.nz = 4
  s.source.initialMassKg = 0; s.source.enabled = false
  s.hotRegions[0].shape = 'slab'
  s.hotRegions[0].sizeXM = 3; s.hotRegions[0].sizeYM = 3; s.hotRegions[0].thicknessM = 1.5
  s.model.maxStepS = 10
  return s
}

const sum = (a: ArrayLike<number>) => Array.from(a).reduce((x, y) => x + y, 0)

describe('fixed-geometry heterogeneous fire benchmark', () => {
  it('keeps mineral inventory inert and exposes actual oxidative activity', () => {
    const sim = new Simulation(fireScenario())
    const before = sim.snapshot()
    const after = sim.advance(10)
    expect(after.diagnostics.cumulativeFuelConsumedKg).toBeGreaterThan(0)
    expect(sum(after.fields.mineralKg)).toBeCloseTo(sum(before.fields.mineralKg), 5)
    expect(sum(after.fields.rootFuelKg)).toBeLessThan(sum(before.fields.rootFuelKg))
    expect(after.diagnostics.cumulativeRootFuelConsumedKg).toBeGreaterThan(0)
    expect(after.fields.reactionRateKgS.some(v => v > 0)).toBe(true)
    expect(after.fields.reactionPowerWm3.some(v => v > 0)).toBe(true)
    expect(sum(after.fields.reactionRateKgS) * 10).toBeCloseTo(after.diagnostics.cumulativeFuelConsumedKg, 5)
    expect(Math.abs(after.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-6)
  })

  it('permits inhibition and renewed oxidation after a budgeted prescribed oxygen exchange', () => {
    const sim = new Simulation(fireScenario())
    const initial = sim.advance(10)
    expect(initial.diagnostics.lastReactionPowerW).toBeGreaterThan(0)
    sim.setUniformOxygenFraction(0)
    const inhibited = sim.advance(10)
    expect(inhibited.diagnostics.lastReactionPowerW).toBe(0)
    expect(inhibited.diagnostics.reactingCellCount).toBe(0)
    expect(inhibited.peakTemperatureK).toBeGreaterThan(sim.scenario.model.minimumReactionTemperatureK)
    const removed = sim.diagnostics.cumulativeOxygenInterventionMol
    expect(removed).toBeLessThan(0)
    sim.setUniformOxygenFraction(0.2095)
    const recovered = sim.advance(10)
    expect(recovered.diagnostics.lastReactionPowerW).toBeGreaterThan(0)
    expect(sim.events.at(-1)?.type).toBe('oxygen-inventory-benchmark')
    expect(sim.events.at(-1)?.externalOxygenMol).toBeGreaterThan(0)
    expect(sim.events.at(-1)?.externalEnergyJ).toBe(0)
    expect(Math.abs(recovered.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-6)
    const restored = Simulation.restore(sim.serialize())
    expect(restored.snapshot().fields.reactionPowerWm3).toEqual(recovered.fields.reactionPowerWm3)
  })

  it('responds to a changed atmospheric oxygen boundary without changing interior inventory instantly', () => {
    const sim = new Simulation(fireScenario())
    const before = sim.snapshot()
    sim.setAtmosphericOxygen(0)
    expect(sim.snapshot().fields.oxygen).toEqual(before.fields.oxygen)
    expect(sim.events.at(-1)).toMatchObject({ type: 'atmospheric-oxygen', value: 0 })
    sim.advance(10)
    sim.setAtmosphericOxygen(0.2095)
    expect(Simulation.restore(sim.serialize()).scenario.atmosphere.oxygenMoleFraction).toBe(0.2095)
  })

  it('distinguishes dry and moist cases through explicit water and evaporation energy', () => {
    const dry = fireScenario(), wet = fireScenario()
    for (const s of [dry, wet]) {
      s.model.maxStepS = 10
      for (const layer of s.soilLayers) layer.moistureSaturationOffset = 0
    }
    dry.soil.moistureSaturation = 0; dry.peatRegions[0].moistureSaturation = 0
    wet.soil.moistureSaturation = 0.5; wet.peatRegions[0].moistureSaturation = 0.5
    const dryRun = new Simulation(dry).advance(600)
    const wetRun = new Simulation(wet).advance(600)
    expect(dryRun.diagnostics.cumulativeWaterEvaporatedKg).toBe(0)
    expect(wetRun.diagnostics.cumulativeWaterEvaporatedKg).toBeGreaterThan(0)
    expect(wetRun.peakTemperatureK).not.toBe(dryRun.peakTemperatureK)
    expect(Number.isFinite(wetRun.diagnostics.resolvedHeatResidualJ)).toBe(true)
  })

  it('does not ignite a cold state or consume absent fuel', () => {
    const cold = fireScenario()
    cold.hotRegions = []
    const coldRun = new Simulation(cold).advance(600)
    expect(coldRun.diagnostics.cumulativeFuelConsumedKg).toBe(0)
    const empty = fireScenario()
    empty.soil.organicFraction = 0; empty.peatRegions = []; empty.root.amountKgM3 = 0
    const emptyRun = new Simulation(empty).advance(600)
    expect(emptyRun.diagnostics.cumulativeFuelConsumedKg).toBe(0)
    expect(emptyRun.diagnostics.cumulativeReactionHeatJ).toBe(0)
  })

  it('records timestep and 3D mesh sensitivity without claiming convergence', () => {
    const coarse = fireScenario()
    const fineTime = fireScenario(); fineTime.model.maxStepS = 5
    const fineMesh = fireScenario(); fineMesh.domain.nx = 6; fineMesh.domain.ny = 6; fineMesh.domain.nz = 6
    const a = new Simulation(coarse).advance(600)
    const b = new Simulation(fineTime).advance(600)
    const c = new Simulation(fineMesh).advance(600)
    const relTime = Math.abs(a.diagnostics.cumulativeFuelConsumedKg - b.diagnostics.cumulativeFuelConsumedKg) /
      Math.max(1e-12, b.diagnostics.cumulativeFuelConsumedKg)
    const relMesh = Math.abs(a.diagnostics.cumulativeFuelConsumedKg - c.diagnostics.cumulativeFuelConsumedKg) /
      Math.max(1e-12, c.diagnostics.cumulativeFuelConsumedKg)
    console.log('FIRE_SENSITIVITY', JSON.stringify({
      coarse: { grid: '4x4x4', maxStepS: 10, fuelConsumedKg: a.diagnostics.cumulativeFuelConsumedKg, peakTemperatureK: a.peakTemperatureK },
      fineTime: { grid: '4x4x4', maxStepS: 5, fuelConsumedKg: b.diagnostics.cumulativeFuelConsumedKg, peakTemperatureK: b.peakTemperatureK },
      fineMesh: { grid: '6x6x6', maxStepS: 10, fuelConsumedKg: c.diagnostics.cumulativeFuelConsumedKg, peakTemperatureK: c.peakTemperatureK },
      relativeFuelDifferenceTime: relTime, relativeFuelDifferenceMesh: relMesh,
    }))
    expect(relTime).toBeLessThan(0.05)
    expect(Number.isFinite(relMesh)).toBe(true)
    expect(c.diagnostics.status).toBe('running')
  })
})
