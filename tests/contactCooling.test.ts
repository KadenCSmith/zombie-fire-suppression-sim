import { describe, expect, it } from 'vitest'
import { CONTACT_COOLING_CONFIG as C, CONTACT_COOLING_PATCHES, contactCoolingState, simulateContactCooling, type ContactPatchSpec } from '../src/story/contactCooling'
import { storyWettingProgress } from '../src/story/fireSequence'

const specimen: ContactPatchSpec = { id: 'analytic', xM: 0, yM: 0, radiusM: .1, peatMassKg: 1,
  dryIceConductanceWK: 10, waterConductanceWK: 0, waterArrivalTimeS: 72, waterShare: 1 }
const expectConserved = (state: ReturnType<typeof simulateContactCooling>) => {
  const l = state.ledger
  expect(Math.abs(l.energyResidualJ)).toBeLessThan(1e-6)
  expect(Math.abs(l.dryIceMassResidualKg)).toBeLessThan(1e-12)
  expect(Math.abs(l.waterMassResidualKg)).toBeLessThan(1e-12)
  expect(l.heatToWaterJ).toBeCloseTo(l.waterStoredSensibleJ + l.vaporEnthalpyJ, 6)
  expect(l.heatToDryIceJ).toBeCloseTo(l.dryIceSublimatedKg * C.dryIceLatentHeatJkg, 6)
}

describe('separate finite-inventory contact calorimeter', () => {
  it('recovers the analytic isolated hot-body / constant-temperature sublimation solution', () => {
    const t = 51.37, state = simulateContactCooling(t, 'gradual', { waterInitialKg: 0 }, [specimen])
    const capacity = specimen.peatMassKg * C.peatHeatCapacityJkgK
    const expected = C.dryIceTemperatureK + (C.initialTemperatureK - C.dryIceTemperatureK) * Math.exp(-specimen.dryIceConductanceWK * (t - C.startTimeS) / capacity)
    expect(state.patches[0].temperatureK).toBeCloseTo(expected, 9)
    expectConserved(state)
  })
  it('cannot remove more heat than the finite dry-ice latent budget', () => {
    const tinyMass = .0001, state = simulateContactCooling(90, 'gradual', { dryIceInitialKg: tinyMass, waterInitialKg: 0 }, [specimen])
    expect(state.ledger.dryIceRemainingKg).toBe(0)
    expect(state.ledger.heatToDryIceJ).toBeCloseTo(tinyMass * C.dryIceLatentHeatJkg, 9)
    expect(state.patches[0].temperatureK).toBeCloseTo(C.initialTemperatureK - tinyMass * C.dryIceLatentHeatJkg / C.peatHeatCapacityJkgK, 10)
    expectConserved(state)
  })
  it('flags and stops subambient dry cooling as outside its validity domain', () => {
    const state = simulateContactCooling(90, 'gradual', { waterInitialKg: 0 }, [{ ...specimen, dryIceConductanceWK: 1e8 }])
    expect(state.patches[0].temperatureK).toBeCloseTo(C.waterInletK, 10)
    expect(state.patches[0].dryCoolingDomainLimitReached).toBe(true)
    expect(state.ledger.dryIceRemainingKg).toBeGreaterThan(0)
    expectConserved(state)
    for (const p of simulateContactCooling(90, 'gradual').patches) expect(p.dryCoolingDomainLimitReached).toBe(false)
  })
  it('exports rapid residual without adding sublimation heat or cooling distant peat', () => {
    const before = simulateContactCooling(55, 'gradual'), rapid = simulateContactCooling(70, 'rapid')
    expect(rapid.ledger.dryIceExportedKg).toBeCloseTo(before.ledger.dryIceRemainingKg, 12)
    expect(rapid.ledger.dryIceRemainingKg).toBe(0)
    expect(rapid.ledger.heatToDryIceJ).toBeCloseTo(before.ledger.heatToDryIceJ, 8)
    for (const p of rapid.patches.slice(1)) expect(p.temperatureK).toBe(C.initialTemperatureK)
    expectConserved(rapid)
  })
  it('cannot cool before source contact or water arrival', () => {
    for (const time of [0, 24, 39, 43.999, 44]) {
      const s = contactCoolingState(time, 'rapid')
      expect(s.ledger.heatToDryIceJ).toBe(0)
      expect(s.ledger.waterSuppliedKg).toBe(0)
    }
    for (const p of CONTACT_COOLING_PATCHES.slice(1)) {
      const state = simulateContactCooling(p.waterArrivalTimeS, 'rapid')
      expect(state.patches.find(q => q.id === p.id)!.waterReceivedKg).toBe(0)
      const [, branch, node] = p.id.split('-')
      expect(storyWettingProgress(p.waterArrivalTimeS, Number(branch))).toBeCloseTo(Number(node) ? .45 : .20, 10)
    }
  })
  it('balances every inventory and heat destination over both complete histories', () => {
    for (const mode of ['gradual', 'rapid'] as const) for (let time = 44; time <= 90; time += .5) {
      const state = contactCoolingState(time, mode)
      expectConserved(state)
      expect(state.ledger.dryIceRemainingKg).toBeGreaterThanOrEqual(0)
      expect(state.ledger.waterRemainingSupplyKg).toBeGreaterThanOrEqual(0)
      for (const p of state.patches) {
        expect(p.temperatureK).toBeGreaterThanOrEqual(C.waterInletK - 1e-10)
        expect(p.waterTemperatureK).toBeLessThanOrEqual(C.waterBoilingK + 1e-8)
        expect(p.waterReceivedKg).toBeCloseTo(p.liquidWaterKg + p.waterVaporKg, 12)
      }
    }
  })
  it('keeps a finite water reservoir and books uncontacted delivery separately', () => {
    const s = simulateContactCooling(90, 'rapid', { waterInitialKg: .07 })
    expect(s.ledger.waterSuppliedKg).toBeCloseTo(.07, 12)
    expect(s.ledger.waterRemainingSupplyKg).toBe(0)
    expect(s.ledger.waterBypassKg).toBeGreaterThan(0)
    expectConserved(s)
  })
  it('recovers analytic sensible exchange without vaporizing sub-boiling water', () => {
    const patch = { ...specimen, dryIceConductanceWK: 0, waterConductanceWK: 100, waterArrivalTimeS: 0 }
    const s = simulateContactCooling(1, 'gradual', { startTimeS: 0, waterStartTimeS: 0, stepS: 1, initialTemperatureK: 350, waterFlowKgS: 1 }, [patch])
    const cp = C.peatHeatCapacityJkgK, cw = C.waterHeatCapacityJkgK
    const equilibrium = (cp * 350 + cw * C.waterInletK) / (cp + cw)
    const expectedPeat = equilibrium + (350 - equilibrium) * Math.exp(-patch.waterConductanceWK * (1 / cp + 1 / cw))
    expect(s.patches[0].temperatureK).toBeCloseTo(expectedPeat, 10)
    expect(s.ledger.waterVaporKg).toBe(0)
    expectConserved(s)
  })
  it('pays sensible warming and latent vaporization for every evaporated kilogram', () => {
    const patch = { ...specimen, dryIceConductanceWK: 0, waterConductanceWK: 1e9, waterArrivalTimeS: 0 }
    const s = simulateContactCooling(1, 'gradual', { startTimeS: 0, waterStartTimeS: 0, stepS: 1, initialTemperatureK: 1000, waterFlowKgS: .1 }, [patch])
    const expectedHeat = .1 * (C.waterHeatCapacityJkgK * (C.waterBoilingK - C.waterInletK) + C.waterLatentHeatJkg)
    expect(s.ledger.waterVaporKg).toBeCloseTo(.1, 12)
    expect(s.ledger.waterLiquidKg).toBeCloseTo(0, 12)
    expect(s.ledger.heatToWaterJ).toBeCloseTo(expectedHeat, 7)
    expect(s.patches[0].temperatureK).toBeCloseTo(1000 - expectedHeat / C.peatHeatCapacityJkgK, 10)
    expectConserved(s)
  })
  it('does nothing with zero thermal contact even if water is delivered', () => {
    const s = simulateContactCooling(90, 'gradual', {}, [{ ...specimen, dryIceConductanceWK: 0 }])
    expect(s.ledger.heatToDryIceJ).toBe(0)
    expect(s.ledger.heatToWaterJ).toBe(0)
    expect(s.ledger.waterVaporKg).toBe(0)
    expect(s.patches[0].temperatureK).toBe(C.initialTemperatureK)
    expectConserved(s)
  })
  it('converges under timestep refinement for coupled contact and incoming water', () => {
    const reference = simulateContactCooling(90, 'gradual', { stepS: .00625 })
    const errors = [.2, .1, .05, .025].map(stepS => {
      const s = simulateContactCooling(90, 'gradual', { stepS })
      expectConserved(s)
      return Math.max(...s.patches.map((p, i) => Math.abs(p.temperatureK - reference.patches[i].temperatureK)))
    })
    for (let i = 1; i < errors.length; i++) expect(errors[i]).toBeLessThan(errors[i - 1])
    expect(errors[2]).toBeLessThan(.2)
  })
  it('cached scrubbing agrees with reference integration and cannot corrupt another call', () => {
    for (const mode of ['rapid', 'gradual'] as const) for (const time of [44, 54.997, 55, 73.721, 82.41, 90]) {
      const cached = contactCoolingState(time, mode), reference = simulateContactCooling(time, mode)
      cached.patches.forEach((p, i) => expect(p.temperatureK).toBeCloseTo(reference.patches[i].temperatureK, 8))
      expect(cached.ledger.heatToWaterJ).toBeCloseTo(reference.ledger.heatToWaterJ, 6)
      cached.patches[0].temperatureK = -1
      expect(contactCoolingState(time, mode).patches[0].temperatureK).toBeGreaterThan(0)
    }
  })
  it('rejects nonfinite/unsupported inputs and water over-allocation', () => {
    expect(() => simulateContactCooling(NaN, 'rapid')).toThrow()
    expect(() => simulateContactCooling(90, 'rapid', { stepS: 0 })).toThrow()
    expect(() => simulateContactCooling(90, 'rapid', { waterInletK: 260 })).toThrow()
    expect(() => simulateContactCooling(90, 'rapid', {}, [{ ...specimen, waterShare: 1.1 }])).toThrow()
  })
})
