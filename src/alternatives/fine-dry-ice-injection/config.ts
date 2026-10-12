import type { PanelConfig } from '../model'
import type { ParticleInjectionSettings } from './types'
export const PARTICLE_PENDING = 'Conditional thermal/transport diagnostic; unvalidated film, entrainment and peat penetration. No apparatus, pressure, oxygen or suppression prediction.'
export function defaultParticleInjectionSettings(): ParticleInjectionSettings {
  return { particleDiameterM: 100e-6, sizeProvenance: 'Configured 100 micrometre monodisperse analytical study; unmeasured, not inferred from Nano.',
    effectiveConductivityWmK: .6, heatTransferProvenance: 'Steady spherical conduction reference; effective film conductivity is an unmeasured sensitivity, not an aqueous-particle correlation.',
    solidDensityKgM3: 1560, hoseResidenceS: 1, probeResidenceS: .1, residenceProvenance: 'Prescribed ideal entrained parcel residence; no pressure, slip, filtration or blockage model.',
    dryPeatMassKg: .5, initialMoistureDryBasis: .1, dryPeatCpJkgK: 1500, soilProvenance: 'Assumed isolated warm peat specimen; finite UA sensitivity. No measured field constitutive law.',
    initialPhase: 'solid', stepS: .005, parcelStepS: .025 }
}
export function restoreParticleInjectionSettings(raw: unknown): ParticleInjectionSettings {
  const next = defaultParticleInjectionSettings()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next
  for (const key of Object.keys(next) as (keyof ParticleInjectionSettings)[]) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === typeof next[key] && (typeof v !== 'number' || Number.isFinite(v))) Object.assign(next, { [key]: v })
  }
  return next
}
export function particleObservationWindowS(config: PanelConfig): number { return config.thermal.endS }
export function particleLinkedCompatibility(configs: readonly PanelConfig[]): string | null {
  const first = configs[0]
  if (configs.some(c => c.variantId !== 'nanoparticles' || c.engine !== 'particle')) return 'Link particle runs only with the same bounded particle system.'
  const shared = ['initialK','waterKg','flowKgS','inletK','contactStartS','conductanceWK','endS','seed'] as const
  if (configs.some(c => shared.some(k => c.thermal[k] !== first.thermal[k]))) return 'Match water quantity, schedule, initial/inlet temperatures, soil contact, seed and window.'
  // Phase, particle size, conductivity and CO2 mass may differ as disclosed resources/sensitivities.
  const keys = ['hoseResidenceS','probeResidenceS','dryPeatMassKg','initialMoistureDryBasis','dryPeatCpJkgK','stepS','parcelStepS'] as const
  if (configs.some(c => keys.some(k => c.particleInjection?.[k] !== first.particleInjection?.[k]))) return 'Match transport, specimen, moisture and numerical discretization.'
  return null
}
export const PARTICLE_RECORD_UNITS = { timeS: 's', mass: 'kg', temperature: 'K', enthalpy: 'J', particleDiameterM: 'm', effectiveConductivityWmK: 'W/(m K)', moisture: 'kg water/kg dry peat', fractions: 'Initial CO2 mass, except probe survival divided by cumulative arrived CO2', pressure: 'unavailable', oxygen: 'unavailable' } as const
