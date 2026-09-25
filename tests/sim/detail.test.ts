import { describe, expect, it } from 'vitest'
import { createDefaultScenario, Simulation, validateScenario } from '../../src/sim'

describe('10 cm material-aware finite volumes', () => {
  it('resolves the full default domain, assigns local properties, and advances one physical step', () => {
    const s = createDefaultScenario()
    s.domain.nx = Math.ceil(s.domain.widthM / 0.1)
    s.domain.ny = Math.ceil(s.domain.lengthM / 0.1)
    s.domain.nz = Math.ceil(s.domain.depthM / 0.1)
    s.source.initialMassKg = 0; s.source.enabled = false
    expect(validateScenario(s).valid).toBe(true)
    const start = performance.now()
    const sim = new Simulation(s)
    const initializedMs = performance.now() - start
    expect(sim.cellCount).toBe(111630)
    expect(Math.max(sim.dx, sim.dy, sim.dz)).toBeLessThanOrEqual(0.1)
    const initial = sim.snapshot()
    const peatIndex = initial.fields.materialClass.findIndex(value => value === 2)
    const mixedIndex = initial.fields.materialClass.findIndex(value => value === 1)
    expect(peatIndex).toBeGreaterThanOrEqual(0)
    expect(mixedIndex).toBeGreaterThanOrEqual(0)
    expect(initial.fields.dryDensityKgM3[peatIndex]).not.toBe(initial.fields.dryDensityKgM3[mixedIndex])
    expect(initial.fields.thermalConductivityWmK[peatIndex]).not.toBe(initial.fields.thermalConductivityWmK[mixedIndex])
    expect(initial.fields.porosity[peatIndex]).not.toBe(initial.fields.porosity[mixedIndex])
    expect(initial.fields.intrinsicPermeability[peatIndex]).not.toBe(initial.fields.intrinsicPermeability[mixedIndex])
    expect(initial.fields.rootFuelKg.some(value => value > 0)).toBe(true)
    const px = peatIndex % sim.nx
    const py = Math.floor(peatIndex / sim.nx) % sim.ny
    const pz = Math.floor(peatIndex / (sim.nx * sim.ny))
    const sample = sim.sampleAt((px + 0.5) * sim.dx, (py + 0.5) * sim.dy, (pz + 0.5) * sim.dz)
    expect(sample.materialClass).toBe(2)
    expect(sample.dryDensityKgM3).toBeCloseTo(initial.fields.dryDensityKgM3[peatIndex], 2)
    const snapshotBytes = Object.values(initial.fields).reduce((total, field) => total + field.byteLength, 0)
    const after = sim.step(120)
    const stepMs = performance.now() - start - initializedMs
    expect(after.diagnostics.status).toBe('running')
    expect(after.timeSeconds).toBeGreaterThan(0)
    expect(Math.abs(after.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-5)
    console.log('DETAILED_GRID_BENCHMARK', JSON.stringify({
      grid: [sim.nx, sim.ny, sim.nz], cellSizeM: [sim.dx, sim.dy, sim.dz],
      cells: sim.cellCount, snapshotMiB: snapshotBytes / (1024 * 1024),
      initializedMs, oneStepMs: stepMs, processRssMiB: process.memoryUsage().rss / (1024 * 1024),
    }))
  }, 120000)

  it('identifies mineral matrix when organic and root inputs are absent', () => {
    const s = createDefaultScenario()
    s.domain.nx = 4; s.domain.ny = 4; s.domain.nz = 4
    s.soil.organicFraction = 0; s.peatRegions = []; s.root.amountKgM3 = 0
    const fields = new Simulation(s).snapshot().fields
    expect(fields.materialClass.every(value => value === 0)).toBe(true)
    expect(fields.fuel.every(value => value === 0)).toBe(true)
    expect(fields.mineralKg.every(value => value > 0)).toBe(true)
  })
})
