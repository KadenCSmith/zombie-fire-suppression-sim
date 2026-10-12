import type { AlternativeRun, MethodPresentation, SupportedAdapterHooks } from '../contract'
import type { PanelConfig } from '../model'
import type { VariantId } from '../registry'

export const LIQUID_WAVES_CAPABILITIES = {
  pressureTransport: 'unavailable', soilMechanics: 'unavailable', infiltration: 'unavailable',
  ordinaryWaterContact: 'modeled thermal proxy', reactionOrSuppression: 'unavailable',
  experimentalValidation: 'not performed',
} as const

/** Waves are authored only. All supported source accounting stays in the
 * external unchanged-reference adapter. No pressure benefit is credited. */
export function createLiquidWavesRun(config: PanelConfig, hooks: SupportedAdapterHooks): AlternativeRun {
  if (config.variantId !== 'liquid-waves') throw new Error('4.2.3.1 adapter requires liquid-waves identity.')
  if (config.engine !== 'contact' && config.engine !== 'concept') throw new Error('4.2.3.1 has no coupled treatment engine.')
  if (config.medium !== 'water' && config.medium !== 'unspecified') throw new Error('4.2.3.1 supports ordinary water or an unspecified concept source only.')
  if (config.engine === 'contact' && config.medium !== 'water') throw new Error('Unspecified source has no thermodynamic properties.')
  const owned = structuredClone(config)
  // Ordinary liquid only: never a hidden dry-ice contact term.
  owned.thermal.dryIceKg = 0
  return hooks.supportedRun(owned)
}

export function liquidWavesPresentation(id: VariantId, timeS: number): MethodPresentation {
  if (id !== 'liquid-waves') throw new Error('4.2.3.1 presentation requires liquid-waves identity.')
  const time = Number.isFinite(timeS) ? Math.max(0, Math.min(90, timeS)) : 0
  const injection = time >= 56
  return { contextTime: Math.min(time, 36), access: true, pulse: false,
    waves: time >= 38 && time < 56, injection, vibration: 0, contacts: injection ? 1 : 0 }
}

/** Dimensionless visual envelope; neither distance nor pressure is inferred. */
export function waveCueProgress(timeS: number, ring: number): number {
  const phase = ((timeS - 44) * .65 + ring / 3) % 1
  return phase < 0 ? phase + 1 : phase
}
