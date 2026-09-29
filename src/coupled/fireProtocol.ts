import { CoupledTransport, coupledScenario, LAB_DEFAULT_COUPLED, type Ledger } from './model'
import { peatPorosity, resolveMaterials, saturationFromDryBasis } from '../sim/materials'

/** Assumed macroscopic ignition experiment, not a measured site or a resolved flame. */
export interface FireProtocolOptions {
  durationS: number
  ignitionDurationS: number
  ignitionPowerW: number
  moistureDryBasis: number
  maxStepS: number
  captureEveryS: number
  surfaceExchangeVelocityMS: number
}
export const DEFAULT_FIRE_PROTOCOL: FireProtocolOptions = {
  durationS: 86400, ignitionDurationS: 7200, ignitionPowerW: 2500,
  moistureDryBasis: 0.1, maxStepS: 20, captureEveryS: 1800, surfaceExchangeVelocityMS: 0.0016,
}
export interface FireProtocolFrame {
  timeS: number
  phase: 'forced-ignition' | 'unforced-reaction' | 'treatment'
  temperatureK: number[]
  pressurePa: number[]
  oxygen: number[]
  co2: number[]
  fuelKg: number[]
  liquidKg: number[]
  dryIceKg: number
  dryIceTemperatureK: number
  ledger: Ledger
  metrics: { maxTemperatureK: number; reactedFuelKg: number; reactingCellDepthM: number; heatedCellDepthM: number }
}
export function createFireProtocol(options: Partial<FireProtocolOptions> = {}) {
  const config = { ...DEFAULT_FIRE_PROTOCOL, ...options }
  if (Object.values(config).some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Fire protocol values must be finite and positive.')
  if (config.moistureDryBasis > 2 || config.ignitionDurationS > config.durationS) throw new Error('Unsupported moisture or ignition duration.')
  const scenario = coupledScenario({ ...LAB_DEFAULT_COUPLED, reaction: true, mechanics: false, cap: false, roots: false, dryIceKg: 0 })
  scenario.name = 'Cold surface-connected peat ignition experiment'
  scenario.description = 'Assumed surface-connected peat, initial 10 C, external ignition energy explicitly booked. Coarse cells do not resolve centimetre-scale smouldering fronts.'
  scenario.hotRegions = []
  scenario.root.amountKgM3 = 0
  scenario.atmosphere.deepTemperatureC = scenario.atmosphere.temperatureC
  scenario.atmosphere.exchangeVelocityMS = config.surfaceExchangeVelocityMS
  const peat = scenario.peatRegions[0], material = resolveMaterials(scenario)
  const porosity = peatPorosity(peat.bulkDensityKgM3, peat.organicFraction, material)
  Object.assign(peat, { shape: 'slab', centerXM: 4, centerYM: 4, centerDepthM: 1.6, sizeXM: 8, sizeYM: 8, thicknessM: 3.2, rotationDeg: 0,
    moistureSaturation: saturationFromDryBasis(config.moistureDryBasis, porosity, peat.bulkDensityKgM3, material.waterDensityKgM3) })
  // Top cell centre; the canonical source kernel projects into this single 0.5 m square cell.
  // Zero dry ice means the existing source operator deposits external heat in the peat.
  Object.assign(scenario.source, { centerXM: 3.75, centerYM: 4.25, centerDepthM: 0.08, initialMassKg: 0,
    enabled: true, startTimeS: 0, durationS: config.ignitionDurationS,
    heatGenerationWm3: config.ignitionPowerW / (4 / 3 * Math.PI * scenario.source.supportRadiusM ** 3) })
  scenario.model.maxStepS = config.maxStepS
  const sim = new CoupledTransport(scenario, true)
  const initialFuel = sim.fuel.slice()
  const capture = (): FireProtocolFrame => {
    const frame = sim.frame()
    let reactedFuelKg = 0, reactingCellDepthM = 0, heatedCellDepthM = 0
    for (let i = 0; i < sim.n; i++) {
      const consumed = initialFuel[i] - sim.fuel[i]
      reactedFuelKg += consumed
      const depth = (Math.floor(i / (scenario.domain.nx * scenario.domain.ny)) + 0.5) * sim.dz
      if (sim.temperature[i] >= scenario.model.minimumReactionTemperatureK && consumed > initialFuel[i] * 1e-4) reactingCellDepthM = Math.max(reactingCellDepthM, depth)
      if (sim.temperature[i] >= 333.15) heatedCellDepthM = Math.max(heatedCellDepthM, depth)
    }
    return { timeS: frame.timeS, phase: frame.timeS < config.ignitionDurationS ? 'forced-ignition' : 'unforced-reaction',
      temperatureK: Array.from(frame.temperatureK), pressurePa: Array.from(frame.pressurePa), oxygen: Array.from(frame.oxygen), co2: Array.from(frame.co2), fuelKg: Array.from(frame.fuelKg), liquidKg: Array.from(frame.liquidKg),
      dryIceKg: frame.dryIceKg, dryIceTemperatureK: frame.dryIceTemperatureK, ledger: frame.ledger,
      metrics: { maxTemperatureK: Math.max(...sim.temperature), reactedFuelKg, reactingCellDepthM, heatedCellDepthM } }
  }
  return { config, scenario, sim, capture, initialFuel }
}
