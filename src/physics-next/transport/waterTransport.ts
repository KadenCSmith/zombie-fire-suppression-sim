import { R, MOLAR, saturationPressure } from '../../coupled/thermodynamics'
import {
  SPECIES_IDS, speciesIndex, inspectChemistryCell, exchangeCellInventory,
  speciesEnthalpyJkg, ChemistryStepRejected,
  type ChemistryModel, type ChemistryCellState,
} from './chemistry'

/** Constitutive inputs are explicit specimen/model data, never defaults. */
export interface RetentionInput {
  readonly alphaPerPa: number
  readonly n: number
  readonly poreConnectivity: number
  readonly residualSaturation: number
  /** Explicit finite dry-end extension, not a fitted van Genuchten parameter. */
  readonly suctionCapPa: number
}
export interface WaterCellInput {
  readonly retention: RetentionInput
  readonly vaporConductanceKgPaS: number
  readonly phaseRelaxationPerS: number
  readonly freezingTemperatureK: number
}
export interface LiquidFace {
  readonly a: number
  readonly b: number
  readonly areaM2: number
  readonly distanceM: number
  readonly permeabilityM2: number
  readonly viscosityPaS: number
}
function check(value: number, lo: number, hi: number, name: string): void {
  if (!Number.isFinite(value) || value < lo || value > hi) throw new Error(`water ${name}: outside [${lo},${hi}]`)
}
function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`water ${name}: positive required`)
}
function retentionCheck(p: RetentionInput): void {
  positive(p.alphaPerPa, 'alpha'); check(p.n, 1.01, 20, 'n')
  check(p.poreConnectivity, 0, 10, 'connectivity')
  check(p.residualSaturation, 0, 0.99, 'residual saturation')
  positive(p.suctionCapPa, 'suction cap'); check(p.suctionCapPa, 1, 1e9, 'suction cap')
}
/** van Genuchten retention with Mualem m=1-1/n; explicit capped dry end. */
export function waterRetention(saturation: number, p: RetentionInput): {
  capillaryPressurePa: number; relativePermeability: number; effectiveSaturation: number
} {
  retentionCheck(p); check(saturation, 0, 1, 'saturation')
  const se = Math.max(0, (saturation - p.residualSaturation) / (1 - p.residualSaturation))
  if (se === 0) return { capillaryPressurePa: p.suctionCapPa, relativePermeability: 0, effectiveSaturation: 0 }
  if (se === 1) return { capillaryPressurePa: 0, relativePermeability: 1, effectiveSaturation: 1 }
  const m = 1 - 1 / p.n
  const raw = Math.expm1(-Math.log(se) / m) ** (1 / p.n) / p.alphaPerPa
  const inner = -Math.expm1(m * Math.log1p(-(se ** (1 / m))))
  const kr = se ** p.poreConnectivity * inner * inner
  if (!Number.isFinite(kr)) throw new Error('water retention arithmetic')
  return { capillaryPressurePa: Math.min(raw, p.suctionCapPa), relativePermeability: kr, effectiveSaturation: se }
}
export function waterLiquidPressurePa(model: ChemistryModel, state: ChemistryCellState, p: RetentionInput): number {
  const t = inspectChemistryCell(model, state)
  const openPore = state.poreVolumeM3 - state.massKg[speciesIndex('ice')] / model.caloric.iceDensityKgM3
  const saturation = state.massKg[speciesIndex('liquidWater')] / model.caloric.liquidDensityKgM3 / openPore
  return t.totalPressurePa - waterRetention(saturation, p).capillaryPressurePa
}
/** Positive a->b. Depth z is positive DOWN; hydrostatic p_b-p_a=rho*g*(z_b-z_a). */
export function liquidFaceMassRateKgS(
  pressureA: number, pressureB: number, relativePermeabilityA: number,
  relativePermeabilityB: number, depthA: number, depthB: number,
  densityKgM3: number, gravityMS2: number, face: LiquidFace,
): number {
  for (const value of [pressureA, pressureB, depthA, depthB]) check(value, -1e10, 1e10, 'face state')
  check(relativePermeabilityA, 0, 1, 'kr a'); check(relativePermeabilityB, 0, 1, 'kr b')
  positive(densityKgM3, 'density'); check(gravityMS2, 0, 100, 'gravity')
  check(face.areaM2, 0, 1e12, 'area'); positive(face.distanceM, 'distance')
  check(face.permeabilityM2, 0, 1, 'permeability'); positive(face.viscosityPaS, 'viscosity')
  if (Math.abs(depthB - depthA) > face.distanceM * (1 + 1e-12)) throw new Error('water face geometry')
  const driving = (pressureB - pressureA - densityKgM3 * gravityMS2 * (depthB - depthA)) / face.distanceM
  const kr = driving <= 0 ? relativePermeabilityA : relativePermeabilityB
  const rate = -densityKgM3 * face.areaM2 * face.permeabilityM2 * kr / face.viscosityPaS * driving
  if (!Number.isFinite(rate)) throw new Error('water face overflow')
  return rate === 0 ? 0 : rate
}
function phaseTransfer(
  model: ChemistryModel, input: ChemistryCellState,
  from: 'liquidWater' | 'ice' | 'H2O', to: 'liquidWater' | 'ice' | 'H2O',
  requestedKg: number, accept: (state: ChemistryCellState) => boolean,
): { next: ChemistryCellState; kg: number } {
  const start = exchangeCellInventory(model, input, new Float64Array(SPECIES_IDS.length), 0)
  const cap = Math.min(requestedKg, model.controls.maxConsumedFraction * input.massKg[speciesIndex(from)])
  if (cap === 0) return { next: start, kg: 0 }
  const candidate = (kg: number) => {
    const delta = new Float64Array(SPECIES_IDS.length)
    delta[speciesIndex(from)] = -kg; delta[speciesIndex(to)] = kg
    return exchangeCellInventory(model, start, delta, 0)
  }
  let low = 0, high = cap, next = start
  for (let k = 0; k < 54; k++) {
    const kg = k === 0 ? cap : (low + high) / 2
    try {
      const trial = candidate(kg)
      const oldT = inspectChemistryCell(model, start).temperatureK
      const newT = inspectChemistryCell(model, trial).temperatureK
      if (Math.abs(newT - oldT) <= model.controls.maxTemperatureChangeK && accept(trial)) {
        next = trial; low = kg
        if (kg === cap) break
      } else high = kg
    } catch (error) {
      if (!(error instanceof ChemistryStepRejected)) throw error
      high = kg
    }
  }
  return { next, kg: low }
}
export interface WaterColumnTrial {
  readonly next: readonly ChemistryCellState[]
  readonly physicalDurationS: number
  readonly vaporKgDelta: Float64Array
  readonly frozenKg: Float64Array
  readonly freezeExpansionM3: Float64Array
  readonly faceLiquidKg: Float64Array
  readonly totalWaterResidualKg: number
  /** Internal + gravitational energy residual. No atmospheric flux is present. */
  readonly energyResidualJ: number
}
/**
 * Frozen-geometry first-order split: freeze/thaw, vapor exchange, liquid faces.
 * A single bounded trial over dt; no internal dt floor. Oversized face fluxes REJECT.
 * Time remains t_n on returned cells; the integrator advances the shared clock once.
 * Vapor moves spatially ONLY through gasMixture, never through a second Fick operator.
 */
export function trialWaterColumn(
  model: ChemistryModel, input: readonly ChemistryCellState[], depthsM: readonly number[],
  parameters: readonly WaterCellInput[], faces: readonly LiquidFace[], dtS: number, gravityMS2: number,
): WaterColumnTrial {
  check(dtS, 0, 1e6, 'dt'); check(gravityMS2, 0, 100, 'gravity')
  if (!input.length || depthsM.length !== input.length || parameters.length !== input.length) throw new Error('water column lengths')
  const liq = speciesIndex('liquidWater'), ice = speciesIndex('ice'), vap = speciesIndex('H2O')
  const next = input.map(s => exchangeCellInventory(model, s, new Float64Array(SPECIES_IDS.length), 0))
  const vaporKgDelta = new Float64Array(input.length), frozenKg = new Float64Array(input.length)
  for (let i = 0; i < input.length; i++) {
    check(depthsM[i], -1e6, 1e6, 'depth')
    if (input[i].timeS !== input[0].timeS) throw new Error('water input clocks differ')
    const p = parameters[i]; retentionCheck(p.retention)
    check(p.vaporConductanceKgPaS, 0, 1e6, 'vapor conductance')
    check(p.phaseRelaxationPerS, 0, 1e6, 'phase relaxation')
    if (p.freezingTemperatureK !== 273.15) throw new Error('pure-water freezing point must be 273.15 K')
    let t = inspectChemistryCell(model, next[i]).temperatureK
    check(t, 200, 373.15, 'phase model temperature')
    const freezing = t < p.freezingTemperatureK
    const from = freezing ? 'liquidWater' : 'ice', to = freezing ? 'ice' : 'liquidWater'
    const phase = phaseTransfer(model, next[i], from, to,
      next[i].massKg[speciesIndex(from)] * -Math.expm1(-p.phaseRelaxationPerS * dtS),
      s => freezing ? inspectChemistryCell(model, s).temperatureK <= p.freezingTemperatureK
        : inspectChemistryCell(model, s).temperatureK >= p.freezingTemperatureK)
    next[i] = phase.next; frozenKg[i] = (freezing ? 1 : -1) * phase.kg
    t = inspectChemistryCell(model, next[i]).temperatureK
    const condensed = t < p.freezingTemperatureK ? 'ice' : 'liquidWater'
    // Pure-water correlation; salinity, cryosuction and pressure melting are omitted.
    const driving = (s: ChemistryCellState) => {
      const th = inspectChemistryCell(model, s)
      if (th.temperatureK < 200 || th.temperatureK > 373.15) throw new ChemistryStepRejected('water phase temperature')
      return saturationPressure(th.temperatureK) - s.massKg[vap] / MOLAR[3] * R * th.temperatureK / th.gasVolumeM3
    }
    const d = driving(next[i]), evaporating = d >= 0
    const exchange = phaseTransfer(model, next[i], evaporating ? condensed : 'H2O',
      evaporating ? 'H2O' : condensed, Math.abs(d) * p.vaporConductanceKgPaS * dtS,
      s => evaporating ? driving(s) >= 0 : driving(s) <= 0)
    next[i] = exchange.next; vaporKgDelta[i] = (evaporating ? 1 : -1) * exchange.kg
  }
  const massDelta = next.map(() => new Float64Array(SPECIES_IDS.length)), energy = new Float64Array(next.length)
  const outgoing = new Float64Array(next.length), faceLiquidKg = new Float64Array(faces.length)
  const seen = new Set<string>()
  for (let f = 0; f < faces.length; f++) {
    const face = faces[f], { a, b } = face
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= next.length || b >= next.length || a === b) throw new Error('water face index')
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`
    if (seen.has(key)) throw new Error('duplicate water face'); seen.add(key)
    const pressures = [a, b].map(i => waterLiquidPressurePa(model, next[i], parameters[i].retention))
    const kr = [a, b].map(i => waterRetention(next[i].massKg[liq] / model.caloric.liquidDensityKgM3 /
      (next[i].poreVolumeM3 - next[i].massKg[ice] / model.caloric.iceDensityKgM3), parameters[i].retention).relativePermeability)
    const dm = dtS * liquidFaceMassRateKgS(pressures[0], pressures[1], kr[0], kr[1],
      depthsM[a], depthsM[b], model.caloric.liquidDensityKgM3, gravityMS2, face)
    faceLiquidKg[f] = dm
    const donor = dm >= 0 ? a : b
    outgoing[donor] += Math.abs(dm); massDelta[a][liq] -= dm; massDelta[b][liq] += dm
    const td = inspectChemistryCell(model, next[donor]).temperatureK
    const pd = pressures[dm >= 0 ? 0 : 1], zf = (depthsM[a] + depthsM[b]) / 2
    const transported = dm * (speciesEnthalpyJkg(model, 'liquidWater', td, pd) - gravityMS2 * zf)
    energy[a] -= transported + dm * gravityMS2 * depthsM[a]
    energy[b] += transported + dm * gravityMS2 * depthsM[b]
  }
  for (let i = 0; i < next.length; i++) {
    if (outgoing[i] > model.controls.maxConsumedFraction * next[i].massKg[liq]) throw new ChemistryStepRejected('liquid outgoing budget; reduce whole dt')
    const oldT = inspectChemistryCell(model, next[i]).temperatureK
    next[i] = exchangeCellInventory(model, next[i], massDelta[i], energy[i])
    if (Math.abs(inspectChemistryCell(model, next[i]).temperatureK - oldT) > model.controls.maxTemperatureChangeK) throw new ChemistryStepRejected('liquid thermal step; reduce dt')
  }
  const water = (s: ChemistryCellState) => s.massKg[liq] + s.massKg[ice] + s.massKg[vap]
  const totalWaterResidualKg = next.reduce((v, s, i) => v + water(s) - water(input[i]), 0)
  const energyResidualJ = next.reduce((v, s, i) => v
    + inspectChemistryCell(model, s).totalInternalEnergyJ - inspectChemistryCell(model, input[i]).totalInternalEnergyJ
    - gravityMS2 * depthsM[i] * (water(s) - water(input[i])), 0)
  const massScale = input.reduce((s, cell) => s + water(cell), 0)
  const energyScale = input.reduce((s, cell) => s + Math.abs(inspectChemistryCell(model, cell).totalInternalEnergyJ), 0)
  if (Math.abs(totalWaterResidualKg) > model.controls.massAbsoluteToleranceKg * input.length + model.controls.relativeTolerance * massScale
    || Math.abs(energyResidualJ) > model.controls.energyAbsoluteToleranceJ * input.length + model.controls.relativeTolerance * energyScale) {
    throw new ChemistryStepRejected('water column closure')
  }
  const freezeExpansionM3 = Float64Array.from(frozenKg, kg =>
    kg * (1 / model.caloric.iceDensityKgM3 - 1 / model.caloric.liquidDensityKgM3))
  return { next, physicalDurationS: dtS, vaporKgDelta, frozenKg, freezeExpansionM3,
    faceLiquidKg, totalWaterResidualKg, energyResidualJ }
}
