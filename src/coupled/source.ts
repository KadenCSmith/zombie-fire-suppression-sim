import { CO2_SOLID_CP, CO2_SUB_H, CO2_SUB_T, MOLAR, R, co2SolidU, gasH } from './thermodynamics'

/** Reduced spherical film model. The effective diffusivity/contact coefficient are
 * scenario assumptions, not calibrated buried-peat properties. See CO2_SOURCE_MODEL.md. */
export interface DryIceSourceInput {
  massKg: number
  temperatureK: number
  densityKgM3: number
  dtS: number
  heaterJ: number
  ambientTemperatureK: number
  ambientPressurePa: number
  ambientCO2MoleFraction: number
  contactConductanceWm2K: number
  effectiveDiffusivityM2S: number
}

export interface DryIceSourceResult {
  massKg: number
  temperatureK: number
  emittedKg: number
  /** Net energy delivered by phase transfer, including any heat after exhaustion. */
  emittedEnergyJ: number
  /** Positive means the surrounding cells lose heat to the source. */
  contactHeatJ: number
  surfaceAreaM2: number
  massTransferCoefficientMS: number
  surfaceCO2PressurePa: number
  /** Independent residual of the temperature/mass constitutive solve, before roundoff closure. */
  caloricResidualJ: number
  /** This source cannot deposit CO2 from the surrounding gas. */
  depositionSuppressed: boolean
}

export const CO2_SOURCE_MIN_K = 150
export const CO2_TRIPLE_K = 216.58

/** Existing constant-latent-enthalpy Clausius–Clapeyron approximation. */
export function co2SaturationPressurePa(temperatureK: number): number {
  if (!Number.isFinite(temperatureK) || temperatureK < CO2_SOURCE_MIN_K || temperatureK >= CO2_TRIPLE_K) {
    throw new Error('CO₂ solid-vapor temperature outside the supported 150–216.58 K range.')
  }
  return 101325 * Math.exp(CO2_SUB_H * MOLAR[1] / R * (1 / CO2_SUB_T - 1 / temperatureK))
}

export function co2SaturationTemperatureK(pressurePa: number): number {
  if (!Number.isFinite(pressurePa) || pressurePa <= 0) throw new Error('Positive CO₂ pressure required.')
  return 1 / (1 / CO2_SUB_T - R / (CO2_SUB_H * MOLAR[1]) * Math.log(pressurePa / 101325))
}

/** One mass/energy-conservative backward-Euler source update.
 * Surface equilibrium is applied to local CO2 vapor; the far field enters a
 * finite Stefan film flux. It is not imposed as the solid temperature.
 * No negative sublimation, nucleation, liquid CO2, or internal solid gradients. */
export function advanceDryIceSource(input: DryIceSourceInput): DryIceSourceResult {
  const { massKg: oldMass, temperatureK: oldTemperature, densityKgM3: density, dtS: dt,
    heaterJ, ambientTemperatureK: ambientT, ambientPressurePa: pressure,
    ambientCO2MoleFraction: farFraction, contactConductanceWm2K: conductance,
    effectiveDiffusivityM2S: diffusivity } = input
  if (Object.values(input).some(value => !Number.isFinite(value)) || oldMass < 0 || density <= 0 || dt <= 0
    || heaterJ < 0 || pressure < 1000 || pressure > 300000 || farFraction < 0 || farFraction > 1
    || conductance < 0 || diffusivity < 0 || ambientT < 150 || ambientT > 1200) {
    throw new Error('Invalid finite dry-ice source inputs or unsupported pressure/temperature.')
  }
  co2SaturationPressurePa(oldTemperature)
  const zero = { massKg: 0, temperatureK: oldTemperature, emittedKg: 0, emittedEnergyJ: heaterJ,
    contactHeatJ: 0, surfaceAreaM2: 0, massTransferCoefficientMS: 0,
    surfaceCO2PressurePa: 0, caloricResidualJ: 0, depositionSuppressed: false }
  if (oldMass === 0) return zero

  const radius = Math.cbrt(3 * oldMass / (4 * Math.PI * density))
  const area = 4 * Math.PI * radius * radius
  // Sh = 2 for a quiescent spherical film: k_m = Sh D / (2 r) = D/r.
  const massCoefficient = diffusivity / radius
  const thermalCoefficient = conductance * area * dt
  const oldEnergy = oldMass * co2SolidU(oldTemperature)
  const saturationT = co2SaturationTemperatureK(pressure)
  if (saturationT < CO2_SOURCE_MIN_K || saturationT >= CO2_TRIPLE_K) {
    throw new Error('CO₂ source requires an equation of state outside the supported solid-vapor range.')
  }
  const contactHeat = (temperature: number) => thermalCoefficient * (ambientT - temperature)
  // Moving solid/gas interface: vapor enthalpy less work to open solid volume.
  const emittedSpecificEnergy = (temperature: number) => gasH(1, temperature) / MOLAR[1] - pressure / density
  const pureCO2 = farFraction >= 1 - 1e-12
  const sensibleTemperature = (oldMass * CO2_SOLID_CP * oldTemperature + heaterJ + thermalCoefficient * ambientT)
    / (oldMass * CO2_SOLID_CP + thermalCoefficient)

  let temperature = saturationT, emitted = 0, excess = 0
  if (pureCO2) {
    // With no noncondensing carrier, transport is heat limited at coexistence.
    const available = oldEnergy + heaterJ + contactHeat(saturationT) - oldMass * co2SolidU(saturationT)
    if (available >= 0) {
      const latent = emittedSpecificEnergy(saturationT) - co2SolidU(saturationT)
      emitted = Math.min(oldMass, available / latent)
      if (emitted === oldMass) excess = available - oldMass * latent
    } else {
      // Below coexistence, deposition is outside this one-way source model.
      temperature = sensibleTemperature
    }
  } else {
    if (sensibleTemperature < CO2_SOURCE_MIN_K) throw new Error('retry: source cooling would leave the 150 K caloric range')
    const noSublimation = sensibleTemperature < CO2_TRIPLE_K
      && co2SaturationPressurePa(sensibleTemperature) <= farFraction * pressure
    if (noSublimation || diffusivity === 0) {
      if (sensibleTemperature > saturationT && diffusivity === 0) {
        throw new Error('CO₂ film mobility is zero at the source saturation limit.')
      }
      temperature = sensibleTemperature
    } else {
      // Solve in log carrier depletion, L = log[(1-y∞)/(1-ys)], rather
      // than T. Near pure surface vapor, the required 1-ys can be smaller
      // than float64 epsilon even though mass flux and energy are finite.
      // Retaining L avoids a singular temperature inversion or a flux cap.
      const transferFactor = dt * area * massCoefficient * pressure * MOLAR[1] / R
      const film = (logarithm: number) => {
        const surfaceFraction = farFraction + (1 - farFraction) * (-Math.expm1(-logarithm))
        const candidate = Math.max(CO2_SOURCE_MIN_K, co2SaturationTemperatureK(pressure * surfaceFraction))
        const mass = Math.min(oldMass, transferFactor * logarithm / ((ambientT + candidate) / 2))
        return { temperature: candidate, mass,
          residual: (oldMass - mass) * co2SolidU(candidate) + mass * emittedSpecificEnergy(candidate)
            - oldEnergy - heaterJ - contactHeat(candidate) }
      }
      const minimumFraction = co2SaturationPressurePa(CO2_SOURCE_MIN_K) / pressure
      const minimumLogarithm = Math.max(0, Math.log1p(-farFraction) - Math.log1p(-minimumFraction))
      const lower = film(minimumLogarithm)
      if (lower.residual > 0) throw new Error('retry: source cooling would leave the 150 K caloric range')
      const exhaustionResidual = oldMass * emittedSpecificEnergy(saturationT)
        - oldEnergy - heaterJ - contactHeat(saturationT)
      if (exhaustionResidual < 0) {
        emitted = oldMass
        excess = -exhaustionResidual
      } else {
        let low = minimumLogarithm, high = Math.max(1, minimumLogarithm * 2)
        // Bracket the finite mass/energy root without constraining the carrier
        // fraction to a representable distance from unity.
        for (let expansion = 0; film(high).residual < 0; expansion++) {
          if (expansion > 1023 || !Number.isFinite(high * 2)) throw new Error('retry: source film root could not be bracketed')
          high *= 2
        }
        for (let iteration = 0; iteration < 64; iteration++) {
          const middle = (low + high) / 2
          if (film(middle).residual > 0) high = middle
          else low = middle
        }
        const result = film((low + high) / 2)
        temperature = result.temperature
        emitted = result.mass
      }
    }
  }
  if (temperature < CO2_SOURCE_MIN_K || temperature >= CO2_TRIPLE_K) {
    throw new Error('retry: source temperature would leave the solid caloric range')
  }
  const mass = oldMass - emitted, heat = contactHeat(temperature)
  const constitutiveEnergy = emitted * emittedSpecificEnergy(temperature) + excess
  const netEnergy = oldEnergy + heaterJ + heat - mass * co2SolidU(temperature)
  const caloricResidual = constitutiveEnergy - netEnergy
  if (Math.abs(caloricResidual) > 1e-7 * Math.max(1, Math.abs(netEnergy))) {
    throw new Error('retry: finite source energy solve did not converge')
  }
  return { massKg: mass, temperatureK: temperature, emittedKg: emitted,
    emittedEnergyJ: netEnergy, contactHeatJ: heat, surfaceAreaM2: area,
    massTransferCoefficientMS: massCoefficient, surfaceCO2PressurePa: co2SaturationPressurePa(temperature),
    caloricResidualJ: caloricResidual,
    depositionSuppressed: farFraction * pressure > co2SaturationPressurePa(temperature) * (1 + 1e-10) }
}
