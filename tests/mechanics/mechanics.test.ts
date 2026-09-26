import { describe, expect, it } from 'vitest'
import { createDefaultScenario, Simulation } from '../../src/sim'
import { runFastEvent, type FastEventRun } from '../../src/fastEvent'
import { SoilMechanics, mechanicsSizing } from '../../src/mechanics/model'
import { derivePlumeSources } from '../../src/plumes/model'

function fixture(amplitudePa = 0, durationS = 0.6): { run: FastEventRun; scenario: ReturnType<typeof createDefaultScenario> } {
  const scenario = createDefaultScenario()
  const raw = runFastEvent(scenario, new Simulation(scenario).snapshot(), { durationS, frameCount: 31 })
  const atm = scenario.atmosphere.pressurePa
  return { scenario, run: { ...raw, frames: raw.frames.map(frame => {
    const pulse = Math.max(0, Math.sin(Math.PI * frame.eventTimeS / (durationS * 0.6)))
    return { ...frame, shellPressurePa: Float32Array.from(raw.shellRadiusM.map((_, shell) => atm + amplitudePa * pulse * (shell === 0 ? 1 : 0.45))) }
  }) } }
}

function solve(amplitudePa: number) {
  const { scenario, run } = fixture(amplitudePa)
  const model = new SoilMechanics(scenario, run, 4)
  const frames = run.frames.map(frame => model.advanceTo(frame))
  return { model, frames }
}

describe('small soil mechanics mesh', () => {
  it('completes the default converted-gas handoff with resolved yield', () => {
    const scenario = createDefaultScenario()
    const slow = new Simulation(scenario)
    const converted = slow.convertRemainingDryIce()
    const run = runFastEvent(scenario, converted, { durationS: 2, frameCount: 61 })
    const model = new SoilMechanics(scenario, run, 4)
    let maxYielded = 0
    let maxDisplacement = 0
    for (const gas of run.frames) {
      const frame = model.advanceTo(gas)
      maxYielded = Math.max(maxYielded, frame.yieldedElements)
      maxDisplacement = Math.max(maxDisplacement, frame.maxDisplacementM)
    }
    expect(maxYielded).toBeGreaterThan(0)
    expect(maxDisplacement).toBeGreaterThan(0)
  })
  it('starts in gravity equilibrium with finite overburden and effective stress', () => {
    const { model, frames } = solve(0)
    expect(model.checks.elements).toBe(64)
    expect(model.checks.materialPoints).toBe(64)
    expect(model.checks.initialOverburdenPa).toBeGreaterThan(0)
    expect(model.checks.initialEffectiveStressPa).toBeGreaterThan(0)
    expect(frames.at(-1)!.maxDisplacementM).toBeLessThan(1e-9)
    expect(model.checks.massResidualKg).toBeLessThan(1e-9)
    expect(model.checks.maxMomentumResidualN).toBeLessThan(1e-7)
  })

  it('responds elastically below yield and yields under stronger pressure', () => {
    const weak = solve(2_000)
    const strong = solve(100_000)
    expect(weak.frames.some(f => f.maxDisplacementM > 0)).toBe(true)
    expect(weak.frames.at(-1)!.yieldedElements).toBe(0)
    expect(strong.frames.at(-1)!.yieldedElements).toBeGreaterThan(0)
    expect(strong.frames.some(f => f.maxDisplacementM > weak.frames.at(-1)!.maxDisplacementM)).toBe(true)
    expect(strong.model.checks.maxMomentumResidualN).toBeLessThan(1e-5)
  })

  it('falls toward support after the pressure pulse and replays deterministically', () => {
    const a = solve(100_000)
    const b = solve(100_000)
    const peak = Math.max(...a.frames.map(f => f.maxDisplacementM))
    expect(peak).toBeGreaterThan(a.frames.at(-1)!.maxDisplacementM)
    expect(Array.from(a.frames.at(-1)!.displacementM)).toEqual(Array.from(b.frames.at(-1)!.displacementM))
    expect(a.model.checks.kineticEnergyJ).toBeGreaterThanOrEqual(0)
    expect(a.model.checks.pressureWorkJ).toBeTypeOf('number')
  })

  it('keeps pressure mapping in source bounds and declares memory and stable work', () => {
    const { model } = solve(10_000)
    const sizing = mechanicsSizing(4, 0.6)
    expect(sizing.estimatedMemoryBytes).toBeGreaterThan(0)
    expect(sizing.expectedSteps).toBeGreaterThan(0)
    expect(model.checks.pressureMapMinimumPa).toBeGreaterThan(0)
    expect(model.checks.pressureMapMaximumPa).toBeGreaterThanOrEqual(model.checks.pressureMapMinimumPa)
  })
})

describe('plume source accounting', () => {
  it('uses accepted slow-solver oxidation and evaporation changes', () => {
    const scenario = createDefaultScenario()
    const simulation = new Simulation(scenario)
    const before = simulation.snapshot()
    const after = simulation.step()
    const sources = derivePlumeSources(before, after, scenario.atmosphere.temperatureC + 273.15)
    expect(sources.reduce((sum, source) => sum + source.smokeKgS, 0)).toBeGreaterThan(0)
    expect(sources.reduce((sum, source) => sum + source.steamKgS, 0)).toBeGreaterThan(0)
  })
  it('separates oxidation smoke from evaporated and condensed water', () => {
    const scenario = createDefaultScenario()
    const before = new Simulation(scenario).snapshot()
    const after = structuredClone(before)
    after.timeSeconds = 10
    after.fields.peatMask[0] = 1
    before.fields.fuel[0] = 1
    after.fields.fuel[0] = 0.9
    before.fields.moisture[0] = 0.5
    after.fields.moisture[0] = 0.4
    after.fields.temperatureK[0] = 373.15
    const cold = derivePlumeSources(before, after, 273.15)
    const warm = derivePlumeSources(before, after, 330)
    expect(cold[0].smokeKgS).toBeCloseTo(0.0002)
    expect(cold[0].steamKgS).toBeGreaterThan(0)
    expect(cold[0].condensedSteamKgS).toBeGreaterThan(warm[0].condensedSteamKgS)
    expect(cold[0].riseMS).toBeGreaterThan(0)
    const noInventoryChange = structuredClone(before)
    noInventoryChange.timeSeconds = 10
    noInventoryChange.fields.co2[0] = 0.9
    expect(derivePlumeSources(before, noInventoryChange, 280)).toHaveLength(0)
  })
})
