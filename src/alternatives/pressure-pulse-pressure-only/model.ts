import type { AlternativeRun, MethodPresentation, SupportedAdapterHooks } from '../contract'
import type { PanelConfig } from '../model'
import type { VariantId } from '../registry'

export const PRESSURE_ONLY_CAPABILITIES = {
  liquidSource: 'absent', thermalSource: 'absent', pressureTransport: 'unavailable',
  soilMechanics: 'unavailable', reactionOrSuppression: 'unavailable', experimentalValidation: 'not performed',
} as const

/** Concept lifecycle only. Remove stale calorimeter settings from the private
 * forwarded copy; no physical engine can be invoked by this child. */
export function createPressureOnlyRun(config: PanelConfig, hooks: SupportedAdapterHooks): AlternativeRun {
  if (config.variantId !== 'pressure-only') throw new Error('4.2.3.2 adapter requires pressure-only identity.')
  if (config.engine !== 'concept') throw new Error('4.2.3.2 has no supported physical adapter; outcomes are N/A.')
  if (config.medium !== 'none' && config.medium !== 'unspecified') throw new Error('4.2.3.2 never injects liquid or solid treatment medium.')
  const owned = structuredClone(config)
  Object.assign(owned.thermal, { enabled: false, waterKg: 0, flowKgS: 0, dryIceKg: 0, conductanceWK: 0 })
  return hooks.supportedRun(owned)
}

export function pressureOnlyPresentation(id: VariantId, timeS: number): MethodPresentation {
  if (id !== 'pressure-only') throw new Error('4.2.3.2 presentation requires pressure-only identity.')
  const time = Number.isFinite(timeS) ? Math.max(0, Math.min(90, timeS)) : 0
  return { contextTime: Math.min(time, 36), access: true, pulse: time >= 38 && time < 66,
    waves: false, injection: false, vibration: 0, contacts: 0 }
}

/** Smooth authored visibility only, with no dimensional pressure quantity. */
export function pressureCueEnvelope(timeS: number): number {
  const u = Math.max(0, Math.min(1, (timeS - 48) / 6))
  return Math.sin(Math.PI * u) ** 2
}
