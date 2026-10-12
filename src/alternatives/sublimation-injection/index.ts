import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant, ThermalSettings } from '../registry'
import type { PanelConfig } from '../model'

const provenance = 'User-supplied Version21 capstone concept; material references and model assumptions in method evidence. No experimental validation.'
export const variants: readonly Variant[] = [{
  id: 'sublimation-injection', method: '4.2.1', number: '4.2.1',
  label: 'Extinguishing Medium Sublimation and Injection',
  subtitle: 'Truck-delivered water + dry ice → illustrative flow and quenching',
  engines: ['contact', 'concept'], media: ['water', 'co2-water', 'unspecified'],
  defaultMedium: 'water', defaultEngine: 'contact',
  stages: ['Fire spread + access', 'Drilling + truck delivery', 'Water + dry-ice loading', 'Illustrative flow + quenching'],
  limitation: 'Truck delivery, dry-ice loading, faster water motion and visible quenching are illustrative. Finite contact heat and inventory are modeled separately in three isolated specimens; tank pressure, liquid pre-cooling, accelerated field injection, penetration, suppression, re-ignition and cost savings are unavailable predictions. The CO₂ option is direct solid contact, not predicted tank pre-cooling.',
  status: { illustrative: true, modeled: 'Finite contact heat / inventory only · unvalidated', experimentallyValidated: false },
  provenance,
}]

/** Presentation seconds only. These values never set accepted physical time. */
export const PRESENTATION_TIMING = { surfaceS: 38, preparationS: 59, injectionS: 56, endS: 90 } as const

/** Frozen v21.2 bounds mirrored for boundary validation without importing the
 * registry back into a module it registers. A regression test checks every
 * bound against the authoritative shared PARAMETERS; this is not a new schema. */
export const THERMAL_LIMITS = {
  initialK: [300, 1000], waterKg: [0, 5], flowKgS: [0, .2], inletK: [273.15, 350],
  contactStartS: [0, 50], conductanceWK: [0, 100], dryIceKg: [0, 1], endS: [10, 120],
} as const satisfies Partial<Record<keyof ThermalSettings, readonly [number, number]>>

export function sublimationPresentation(timeS: number) {
  const time = Number.isFinite(timeS) ? Math.max(0, Math.min(PRESENTATION_TIMING.endS, timeS)) : 0
  const injection = time >= PRESENTATION_TIMING.injectionS
  return { contextTime: Math.min(time, 38), access: true, pulse: false, waves: false, injection, vibration: 0, contacts: injection ? 1 : 0 }
}

/** Validate at the adapter boundary, including direct callers outside the UI.
 * Mirrored frozen bounds are checked against the shared schema in private tests. */
export function validateSublimationConfig(config: PanelConfig) {
  if (config.variantId !== 'sublimation-injection') throw new Error('4.2.1 adapter requires sublimation-injection identity.')
  if (typeof config.id !== 'string' || !config.id.trim()) throw new Error('4.2.1 requires an independent panel identity.')
  const descriptor = variants[0]
  if (!descriptor.engines.includes(config.engine)) throw new Error(`4.2.1 has no supported ${config.engine} adapter.`)
  if (!descriptor.media.includes(config.medium)) throw new Error('Unsupported 4.2.1 medium.')
  if (config.engine === 'contact' && config.medium === 'unspecified') throw new Error('Unspecified medium has no thermodynamic properties; select conceptual stages.')
  if (config.sourceStatus !== 'unspecified' && config.sourceStatus !== 'known-contact-properties') throw new Error('Unknown source-property status.')
  if (!config.thermal || typeof config.thermal.enabled !== 'boolean' || !Number.isSafeInteger(config.thermal.seed)) throw new Error('4.2.1 requires a boolean intervention flag and integer seed.')
  for (const key of Object.keys(THERMAL_LIMITS) as (keyof typeof THERMAL_LIMITS)[]) {
    const value = config.thermal[key], [minimum, maximum] = THERMAL_LIMITS[key]
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`Unsupported ${key}; expected ${minimum}–${maximum} in the documented SI unit.`)
  }
  if (config.engine === 'contact' && config.thermal.initialK < config.thermal.inletK) throw new Error('The hot-contact proxy requires initial temperature at least the liquid inlet temperature.')
}

export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.1', variants,
  defaultSettings: () => ({ contactStartS: 8 }),
  createRun(config, hooks) {
    validateSublimationConfig(config)
    // The approved external core owns every source term and energy/mass ledger.
    // Cloning prevents a caller or future hook from sharing mutable settings.
    return hooks.supportedRun(structuredClone(config))
  },
  presentation: (_id, timeS) => sublimationPresentation(timeS),
}
