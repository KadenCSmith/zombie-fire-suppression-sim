import { describe, expect, it } from 'vitest'
import { advanceDryIceSource, co2SaturationPressurePa, co2SaturationTemperatureK, type DryIceSourceInput } from '../src/coupled/source'
import { CO2_SUB_T, co2SolidU, gasH, MOLAR } from '../src/coupled/thermodynamics'

const source = (overrides: Partial<DryIceSourceInput> = {}): DryIceSourceInput => ({
  massKg: 0.1, temperatureK: CO2_SUB_T, densityKgM3: 1560, dtS: 1, heaterJ: 0,
  ambientTemperatureK: 293.15, ambientPressurePa: 101325, ambientCO2MoleFraction: 0.0004,
  contactConductanceWm2K: 10, effectiveDiffusivityM2S: 1.5e-5, ...overrides,
})

describe('finite CO₂ heat and mass transfer source', () => {
  it('retains the declared coexistence reference and inverts the pressure curve', () => {
    expect(co2SaturationPressurePa(CO2_SUB_T)).toBeCloseTo(101325, 8)
    for (const pressure of [60000, 101325, 130000, 250000]) {
      expect(co2SaturationPressurePa(co2SaturationTemperatureK(pressure))).toBeCloseTo(pressure, 7)
    }
  })

  it('cools by sublimation in CO₂-poor gas even without external heat', () => {
    const input = source({ contactConductanceWm2K: 0 })
    const result = advanceDryIceSource(input)
    expect(result.emittedKg).toBeGreaterThan(0)
    expect(result.temperatureK).toBeLessThan(input.temperatureK)
    expect(result.massKg + result.emittedKg).toBe(input.massKg)
    expect(Math.abs(result.massKg * co2SolidU(result.temperatureK) + result.emittedEnergyJ
      - input.massKg * co2SolidU(input.temperatureK))).toBeLessThan(1e-9)
    expect(Math.abs(result.caloricResidualJ)).toBeLessThan(1e-7)
  })

  it('reduces sublimation as ambient CO₂ increases at fixed total pressure', () => {
    const run = (fraction: number) => advanceDryIceSource(source({
      temperatureK: 190, ambientCO2MoleFraction: fraction, contactConductanceWm2K: 0,
    }))
    const dilute = run(0.0004), concentrated = run(0.5), saturated = run(1)
    expect(dilute.emittedKg).toBeGreaterThan(concentrated.emittedKg)
    expect(concentrated.emittedKg).toBeGreaterThan(saturated.emittedKg)
    expect(saturated.emittedKg).toBe(0)
    expect(saturated.depositionSuppressed).toBe(true)
  })

  it('recovers heat-limited sublimation in pure CO₂ with moving-interface energy accounting', () => {
    const input = source({ heaterJ: 100, ambientCO2MoleFraction: 1, contactConductanceWm2K: 0 })
    const result = advanceDryIceSource(input)
    const latent = gasH(1, CO2_SUB_T) / MOLAR[1] - input.ambientPressurePa / input.densityKgM3 - co2SolidU(CO2_SUB_T)
    expect(result.temperatureK).toBeCloseTo(CO2_SUB_T, 12)
    expect(result.emittedKg).toBeCloseTo(input.heaterJ / latent, 12)
    expect(result.emittedEnergyJ).toBeCloseTo(result.emittedKg * (gasH(1, CO2_SUB_T) / MOLAR[1]
      - input.ambientPressurePa / input.densityKgM3), 8)
  })

  it('cannot consume more solid than exists and returns every joule after exhaustion', () => {
    for (const fraction of [0.0004, 1]) {
      const input = source({ massKg: 0.001, heaterJ: 10000, ambientCO2MoleFraction: fraction })
      const result = advanceDryIceSource(input)
      expect(result.massKg).toBe(0)
      expect(result.emittedKg).toBe(input.massKg)
      expect(result.emittedEnergyJ - result.contactHeatJ).toBeCloseTo(input.massKg * co2SolidU(input.temperatureK) + input.heaterJ, 8)
    }
    expect(advanceDryIceSource(source({ massKg: 0, heaterJ: 20 })).emittedEnergyJ).toBe(20)
  })

  it('resolves finite film flux when the surface carrier fraction is below machine epsilon', () => {
    const input = source({ massKg: 0.01, dtS: 2, heaterJ: 720,
      contactConductanceWm2K: 0, effectiveDiffusivityM2S: 1.6e-5 / 3 })
    const result = advanceDryIceSource(input)
    const latent = gasH(1, CO2_SUB_T) / MOLAR[1] - input.ambientPressurePa / input.densityKgM3 - co2SolidU(CO2_SUB_T)
    expect(result.temperatureK).toBeCloseTo(CO2_SUB_T, 11)
    expect(result.emittedKg).toBeCloseTo(input.heaterJ / latent, 11)
    expect(result.massKg).toBeGreaterThan(0)
    expect(Math.abs(result.caloricResidualJ)).toBeLessThan(1e-8)
    expect(result.massKg * co2SolidU(result.temperatureK) + result.emittedEnergyJ).toBeCloseTo(
      input.massKg * co2SolidU(input.temperatureK) + input.heaterJ, 8)
  })

  it('converges under timestep refinement with an independent energy balance over the trajectory', () => {
    const run = (dtS: number) => {
      let state = source({ dtS, massKg: 0.01, contactConductanceWm2K: 8 }), transferred = 0
      const initialEnergy = state.massKg * co2SolidU(state.temperatureK)
      for (let step = 0; step < 20 / dtS; step++) {
        const next = advanceDryIceSource(state)
        transferred += next.emittedEnergyJ - next.contactHeatJ
        state = { ...state, massKg: next.massKg, temperatureK: next.temperatureK }
      }
      expect(Math.abs(state.massKg * co2SolidU(state.temperatureK) + transferred - initialEnergy)).toBeLessThan(1e-7)
      return state
    }
    const coarse = run(1), medium = run(0.5), fine = run(0.25), reference = run(0.03125)
    expect(Math.abs(medium.temperatureK - reference.temperatureK)).toBeLessThan(Math.abs(coarse.temperatureK - reference.temperatureK))
    expect(Math.abs(fine.temperatureK - reference.temperatureK)).toBeLessThan(Math.abs(medium.temperatureK - reference.temperatureK))
    expect(Math.abs(fine.massKg - reference.massKg)).toBeLessThan(Math.abs(medium.massKg - reference.massKg))
  })

  it('rejects unsupported states instead of clipping energy or fabricating mass', () => {
    expect(() => advanceDryIceSource(source({ ambientCO2MoleFraction: -0.1 }))).toThrow()
    expect(() => advanceDryIceSource(source({ temperatureK: 220 }))).toThrow(/solid-vapor/)
    expect(() => advanceDryIceSource(source({ ambientPressurePa: 600000 }))).toThrow(/unsupported/)
  })
})
