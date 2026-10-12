import type { AlternativeRun, MethodPresentation } from '../contract'
import type { PanelConfig } from '../model'
import type { ThermalSettings, VariantId } from '../registry'
import { vibrationPose } from './vibration'

export const PREDICTION_UNAVAILABLE = 'Vibration-only prediction is unavailable: forcing, mechanical work, cyclic peat constitutive response and independent validation are missing.'
export const parameterProvenance = [
  { key: 'contextHold', unit: 'presentation s', default: 33, basis: 'Hold the original inserted auger before unrelated later treatment; authored timing, not a physical boundary.' },
  { key: 'vibrationStart', unit: 'presentation s', default: 27, basis: 'Smooth authored motion onset during original drilling; no calibrated forcing.' },
] as const
export const capabilities = {
  modeled: [] as string[],
  illustrative: ['Original fire and drilling context', 'Bounded ground and auger vibration', 'Soil grains and dust', 'Requested fractures, compression/rearrangement and fire-out narrative'],
  unavailable: ['Vibration forces and mechanical work', 'Cyclic peat constitutive response and damping', 'Compaction, loosening and permeability changes', 'Coupled transport and reaction response', 'Suppression, re-ignition and treatment comparison'],
  experimentallyValidated: false,
} as const
export const defaultSettings: Partial<ThermalSettings> = { enabled: false, waterKg: 0, flowKgS: 0, dryIceKg: 0, conductanceWK: 0, contactStartS: 0 }

/** Fail closed even for saved configurations that previously selected liquid.
 * The direct authored scene has its own presentation clock and needs no run. */
export function createVibratoryRun(config: PanelConfig): AlternativeRun {
  if (config.variantId !== 'vibratory-injection') throw new Error('Vibratory adapter requires its own variant identity.')
  throw new Error(PREDICTION_UNAVAILABLE)
}
export function vibratoryPresentation(id: VariantId, timeS: number): MethodPresentation {
  if (id !== 'vibratory-injection') throw new Error('Vibratory presentation requires its own variant identity.')
  const pose = vibrationPose(timeS)
  return { contextTime: pose.contextTime, access: pose.time >= 24, pulse: false, waves: false, injection: false, vibration: pose.groundPosition[0], contacts: 0 }
}
