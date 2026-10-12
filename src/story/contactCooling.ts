import { FIRE_SEQUENCE_DURATION, STORY_CRACK_PATHS, STORY_WATER_START, pointAlongStoryPath, storyWettingProgress, type FireSourceMode } from './fireSequence'

/** A separate, uncalibrated hot-contact calorimeter. Never added to accepted fire fields. */
export const CONTACT_COOLING_CONFIG = {
  startTimeS: 44, rapidRemovalTimeS: 55, endTimeS: FIRE_SEQUENCE_DURATION, stepS: .05,
  initialTemperatureK: 823.15, waterInletK: 293.15, waterBoilingK: 373.15,
  peatHeatCapacityJkgK: 1840, waterHeatCapacityJkgK: 4186, waterLatentHeatJkg: 2260000,
  dryIceInitialKg: 4, dryIceTemperatureK: 194.67, dryIceLatentHeatJkg: 6030 * 4.184 / .0440095,
  waterInitialKg: 5, waterFlowKgS: .22, waterStartTimeS: STORY_WATER_START,
} as const
export type ContactCoolingConfig = { [K in keyof typeof CONTACT_COOLING_CONFIG]: number }
export interface ContactPatchSpec {
  id: string; xM: number; yM: number; radiusM: number
  /** Independent small contact specimens, not overlapping spatial control volumes. */
  peatMassKg: number; dryIceConductanceWK: number; waterConductanceWK: number
  waterArrivalTimeS: number; waterShare: number
}
const share = 1 / (1 + STORY_CRACK_PATHS.length * 2)
export const CONTACT_COOLING_PATCHES: readonly ContactPatchSpec[] = [
  { id: 'bore-base', xM: .4, yM: -1.44, radiusM: .20, peatMassKg: .5, dryIceConductanceWK: 8,
    waterConductanceWK: 48, waterArrivalTimeS: STORY_WATER_START, waterShare: share },
  ...STORY_CRACK_PATHS.flatMap((points, branch) => [.20, .45].map((fraction, index) => {
    const [xM, yM] = pointAlongStoryPath(points, fraction)
    // Invert the same monotone, prescribed arrival used by both presentations.
    let lo = STORY_WATER_START, hi = FIRE_SEQUENCE_DURATION
    for (let i = 0; i < 45; i++) { const mid = (lo + hi) / 2; if (storyWettingProgress(mid, branch) < fraction) lo = mid; else hi = mid }
    return { id: `branch-${branch}-${index}`, xM, yM, radiusM: index ? .17 : .14,
      peatMassKg: .5, dryIceConductanceWK: 0, waterConductanceWK: 48,
      waterArrivalTimeS: (lo + hi) / 2, waterShare: share }
  })),
]
export interface ContactPatchState extends ContactPatchSpec {
  temperatureK: number; heatRemovedJ: number; heatToDryIceJ: number; heatToWaterJ: number
  waterReceivedKg: number; liquidWaterKg: number; waterVaporKg: number
  liquidWaterSensibleJ: number; vaporEnthalpyJ: number; waterTemperatureK: number
  /** Liquid retained / 0.15 kg display scale; not pore saturation. */
  wetness: number
  /** Term stopped at the lower validity boundary; not a predicted equilibrium. */
  dryCoolingDomainLimitReached: boolean
}
export interface ContactCoolingState {
  storyTimeS: number; modelTimeS: number; initialTemperatureK: number
  patches: ContactPatchState[]
  ledger: {
    initialPeatEnergyJ: number; peatEnergyJ: number; heatToDryIceJ: number; heatToWaterJ: number
    waterStoredSensibleJ: number; vaporEnthalpyJ: number; energyResidualJ: number
    dryIceInitialKg: number; dryIceRemainingKg: number; dryIceSublimatedKg: number; dryIceExportedKg: number; dryIceMassResidualKg: number
    waterInitialKg: number; waterRemainingSupplyKg: number; waterSuppliedKg: number; waterBypassKg: number
    waterLiquidKg: number; waterVaporKg: number; waterMassResidualKg: number
  }
}

function validate(config: ContactCoolingConfig, patches: readonly ContactPatchSpec[]) {
  for (const value of Object.values(config)) if (!Number.isFinite(value)) throw new Error('Contact parameters must be finite.')
  if (config.stepS <= 0 || config.stepS > 1 || config.startTimeS < 0 || config.endTimeS < config.startTimeS ||
    config.rapidRemovalTimeS < config.startTimeS || config.waterStartTimeS < config.startTimeS ||
    config.initialTemperatureK < config.waterInletK || config.waterInletK < 273.15 ||
    config.waterBoilingK <= config.waterInletK || config.dryIceTemperatureK <= 0 || config.dryIceTemperatureK >= config.waterInletK ||
    config.peatHeatCapacityJkgK <= 0 || config.waterHeatCapacityJkgK <= 0 || config.waterLatentHeatJkg <= 0 || config.dryIceLatentHeatJkg <= 0 ||
    config.dryIceInitialKg < 0 || config.waterInitialKg < 0 || config.waterFlowKgS < 0) throw new Error('Unsupported contact-model parameters.')
  let shares = 0
  for (const p of patches) {
    if (Object.entries(p).some(([key, value]) => key !== 'id' && (typeof value !== 'number' || !Number.isFinite(value))) ||
      p.peatMassKg <= 0 || p.radiusM <= 0 || p.dryIceConductanceWK < 0 || p.waterConductanceWK < 0 ||
      p.waterArrivalTimeS < config.waterStartTimeS || p.waterShare < 0) throw new Error('Unsupported contact patch.')
    shares += p.waterShare
  }
  if (!patches.length || shares > 1 + 1e-12) throw new Error('Water shares must sum to at most one.')
}
function initialState(config: ContactCoolingConfig, patches: readonly ContactPatchSpec[]): ContactCoolingState {
  const energy = patches.reduce((sum, p) => sum + p.peatMassKg * config.peatHeatCapacityJkgK * (config.initialTemperatureK - config.waterInletK), 0)
  return {
    storyTimeS: config.startTimeS, modelTimeS: 0, initialTemperatureK: config.initialTemperatureK,
    patches: patches.map(p => ({ ...p, temperatureK: config.initialTemperatureK, heatRemovedJ: 0, heatToDryIceJ: 0, heatToWaterJ: 0,
      waterReceivedKg: 0, liquidWaterKg: 0, waterVaporKg: 0, liquidWaterSensibleJ: 0, vaporEnthalpyJ: 0, waterTemperatureK: config.waterInletK, wetness: 0, dryCoolingDomainLimitReached: false })),
    ledger: { initialPeatEnergyJ: energy, peatEnergyJ: energy, heatToDryIceJ: 0, heatToWaterJ: 0, waterStoredSensibleJ: 0, vaporEnthalpyJ: 0, energyResidualJ: 0,
      dryIceInitialKg: config.dryIceInitialKg, dryIceRemainingKg: config.dryIceInitialKg, dryIceSublimatedKg: 0, dryIceExportedKg: 0, dryIceMassResidualKg: 0,
      waterInitialKg: config.waterInitialKg, waterRemainingSupplyKg: config.waterInitialKg, waterSuppliedKg: 0, waterBypassKg: 0, waterLiquidKg: 0, waterVaporKg: 0, waterMassResidualKg: 0 },
  }
}

/** Exact two-capacitance sensible exchange, followed by a boiling plateau.
 * Water is retained locally; vapor leaves at Tb with its sensible + latent enthalpy.
 */
function exchangeWater(p: ContactPatchState, dt: number, config: ContactCoolingConfig) {
  if (p.liquidWaterKg <= 0 || p.waterConductanceWK === 0) return
  const cp = p.peatMassKg * config.peatHeatCapacityJkgK, cw = p.liquidWaterKg * config.waterHeatCapacityJkgK
  const tw = config.waterInletK + p.liquidWaterSensibleJ / cw
  const qEquilibrium = (p.temperatureK - tw) / (1 / cp + 1 / cw)
  const rate = p.waterConductanceWK * (1 / cp + 1 / cw)
  const qRequested = qEquilibrium * -Math.expm1(-rate * dt)
  const qToBoil = Math.max(0, cw * (config.waterBoilingK - tw))
  const qs = Math.min(qRequested, qToBoil)
  p.temperatureK -= qs / cp; p.liquidWaterSensibleJ += qs; p.heatToWaterJ += qs
  if (qRequested > qToBoil && qEquilibrium > 0) {
    const sensibleTime = qToBoil > 0 ? -Math.log1p(-qToBoil / qEquilibrium) / rate : 0
    const latentTime = Math.max(0, dt - sensibleTime)
    const qLatent = Math.min(p.liquidWaterKg * config.waterLatentHeatJkg,
      Math.max(0, cp * (p.temperatureK - config.waterBoilingK) * -Math.expm1(-p.waterConductanceWK * latentTime / cp)))
    const evaporated = qLatent / config.waterLatentHeatJkg
    const sensibleOut = evaporated * config.waterHeatCapacityJkgK * (config.waterBoilingK - config.waterInletK)
    p.temperatureK -= qLatent / cp; p.heatToWaterJ += qLatent
    p.liquidWaterKg -= evaporated; p.waterVaporKg += evaporated
    p.liquidWaterSensibleJ = Math.max(0, p.liquidWaterSensibleJ - sensibleOut)
    p.vaporEnthalpyJ += sensibleOut + qLatent
  }
}
function finish(state: ContactCoolingState, config: ContactCoolingConfig, mode: FireSourceMode, time: number) {
  const l = state.ledger
  // Prescribed rapid removal is an exported residual, never free sublimation energy.
  if (mode === 'rapid' && time >= config.rapidRemovalTimeS && l.dryIceRemainingKg > 0) {
    l.dryIceExportedKg += l.dryIceRemainingKg; l.dryIceRemainingKg = 0
  }
  l.peatEnergyJ = 0; l.heatToDryIceJ = 0; l.heatToWaterJ = 0; l.waterStoredSensibleJ = 0; l.vaporEnthalpyJ = 0; l.waterLiquidKg = 0; l.waterVaporKg = 0
  for (const p of state.patches) {
    p.heatRemovedJ = p.heatToDryIceJ + p.heatToWaterJ
    p.waterTemperatureK = p.liquidWaterKg > 1e-15 ? config.waterInletK + p.liquidWaterSensibleJ / (p.liquidWaterKg * config.waterHeatCapacityJkgK) : config.waterInletK
    p.wetness = Math.min(1, p.liquidWaterKg / .15)
    l.peatEnergyJ += p.peatMassKg * config.peatHeatCapacityJkgK * (p.temperatureK - config.waterInletK)
    l.heatToDryIceJ += p.heatToDryIceJ; l.heatToWaterJ += p.heatToWaterJ
    l.waterStoredSensibleJ += p.liquidWaterSensibleJ; l.vaporEnthalpyJ += p.vaporEnthalpyJ
    l.waterLiquidKg += p.liquidWaterKg; l.waterVaporKg += p.waterVaporKg
  }
  l.energyResidualJ = l.initialPeatEnergyJ - l.peatEnergyJ - l.heatToDryIceJ - l.waterStoredSensibleJ - l.vaporEnthalpyJ
  l.dryIceMassResidualKg = l.dryIceInitialKg - l.dryIceRemainingKg - l.dryIceSublimatedKg - l.dryIceExportedKg
  l.waterMassResidualKg = l.waterInitialKg - l.waterRemainingSupplyKg - l.waterBypassKg - l.waterLiquidKg - l.waterVaporKg
  state.storyTimeS = time; state.modelTimeS = Math.max(0, time - config.startTimeS)
  return state
}
function advance(state: ContactCoolingState, time: number, config: ContactCoolingConfig, mode: FireSourceMode) {
  let t = Math.max(config.startTimeS, state.storyTimeS)
  const end = Math.min(config.endTimeS, Math.max(config.startTimeS, time))
  const boundaries = [config.rapidRemovalTimeS, config.waterStartTimeS, ...state.patches.map(p => p.waterArrivalTimeS)]
  while (t < end - 1e-10) {
    const gridNext = config.startTimeS + (Math.floor((t - config.startTimeS + 1e-9) / config.stepS) + 1) * config.stepS
    let next = Math.min(end, gridNext)
    for (const boundary of boundaries) if (boundary > t + 1e-10 && boundary < next) next = boundary
    const dt = next - t, l = state.ledger
    finish(state, config, mode, t)
    const requests = state.patches.map(p => {
      const c = p.peatMassKg * config.peatHeatCapacityJkgK
      const available = Math.max(0, c * (p.temperatureK - config.waterInletK))
      const request = Math.max(0, c * (p.temperatureK - config.dryIceTemperatureK) * -Math.expm1(-p.dryIceConductanceWK * dt / c))
      // Explicitly stop this term at the ambient hot-calorimeter validity boundary.
      // Subambient phase changes/freezing require a different model; this is not equilibrium.
      if (request > available && l.dryIceRemainingKg * config.dryIceLatentHeatJkg > available) p.dryCoolingDomainLimitReached = true
      return Math.min(available, request)
    })
    const requested = requests.reduce((a, b) => a + b, 0)
    const scale = requested > 0 ? Math.min(1, l.dryIceRemainingKg * config.dryIceLatentHeatJkg / requested) : 0
    let usedDryIceKg = 0
    state.patches.forEach((p, i) => {
      const q = requests[i] * scale
      p.temperatureK -= q / (p.peatMassKg * config.peatHeatCapacityJkgK); p.heatToDryIceJ += q
      usedDryIceKg += q / config.dryIceLatentHeatJkg
    })
    l.dryIceRemainingKg = Math.max(0, l.dryIceRemainingKg - usedDryIceKg); l.dryIceSublimatedKg += usedDryIceKg
    const supply = t >= config.waterStartTimeS - 1e-10 ? Math.min(l.waterRemainingSupplyKg, config.waterFlowKgS * dt) : 0
    l.waterRemainingSupplyKg -= supply; l.waterSuppliedKg += supply
    let contacted = 0
    for (const p of state.patches) {
      const water = t >= p.waterArrivalTimeS - 1e-10 ? supply * p.waterShare : 0
      p.waterReceivedKg += water; p.liquidWaterKg += water; contacted += water
      exchangeWater(p, dt, config)
    }
    l.waterBypassKg += Math.max(0, supply - contacted)
    t = next
  }
  return finish(state, config, mode, Math.max(0, Math.min(config.endTimeS, time)))
}

/** Deterministic reference integration; configurable for independent limit tests. */
export function simulateContactCooling(storyTimeS: number, mode: FireSourceMode,
  overrides: Partial<ContactCoolingConfig> = {}, patches: readonly ContactPatchSpec[] = CONTACT_COOLING_PATCHES) {
  if (!Number.isFinite(storyTimeS)) throw new Error('Contact time must be finite.')
  const config: ContactCoolingConfig = { ...CONTACT_COOLING_CONFIG, ...overrides }
  validate(config, patches)
  return advance(initialState(config, patches), storyTimeS, config, mode)
}

const cached: Partial<Record<FireSourceMode, ContactCoolingState[]>> = {}
/** Stable half-second checkpoints keep scrubbing inexpensive; subframes integrate
 * from the preceding checkpoint. Every caller receives its own mutable copy.
 */
export function contactCoolingState(storyTimeS: number, mode: FireSourceMode): ContactCoolingState {
  if (!Number.isFinite(storyTimeS)) throw new Error('Contact time must be finite.')
  let states = cached[mode]
  if (!states) {
    states = [initialState(CONTACT_COOLING_CONFIG, CONTACT_COOLING_PATCHES)]
    for (let t = CONTACT_COOLING_CONFIG.startTimeS + .5; t <= FIRE_SEQUENCE_DURATION; t += .5)
      states.push(advance(structuredClone(states[states.length - 1]), t, CONTACT_COOLING_CONFIG, mode))
    cached[mode] = states
  }
  const t = Math.max(0, Math.min(FIRE_SEQUENCE_DURATION, storyTimeS))
  const index = Math.max(0, Math.floor((t - CONTACT_COOLING_CONFIG.startTimeS) / .5))
  return advance(structuredClone(states[index]), t, CONTACT_COOLING_CONFIG, mode)
}
