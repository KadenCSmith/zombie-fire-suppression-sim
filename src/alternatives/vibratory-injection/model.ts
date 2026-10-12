import type { AlternativeRun, MethodPresentation, SupportedAdapterHooks } from '../contract'
import type { PanelConfig } from '../model'
import type { ThermalSettings, VariantId } from '../registry'

/** Explanatory metadata only. Shared ranges and numerical defaults stay authoritative. */
export const parameterProvenance = [
  { key: 'contactStartS', unit: 's', default: 0, basis: 'Prescribed continuous specimen contact from physical time zero; editable assumption.' },
  { key: 'waterKg', unit: 'kg', default: .5, basis: 'Finite total liquid supply; no recharge or predicted pore inventory.' },
  { key: 'flowKgS', unit: 'kg/s', default: .025, basis: 'Prescribed total allocation to three independent specimens, not a hydraulic flow solution.' },
  { key: 'conductanceWK', unit: 'W/K', default: 24, basis: 'Assumed per-specimen UA; uncalibrated, independent of vibration.' },
  { key: 'initialK', unit: 'K', default: 823.15, basis: 'Isolated hot-specimen initial condition, not a solved fire field.' },
  { key: 'inletK', unit: 'K', default: 293.15, basis: 'Prescribed liquid boundary temperature; no source prechilling.' },
  { key: 'endS', unit: 's', default: 60, basis: 'Observation window; no claim about sustained suppression or re-ignition.' },
] as const

export const capabilities = {
  modeled: ['Finite liquid inventory', 'Continuous prescribed thermal contact', 'Liquid sensible heat and boiling enthalpy', 'Owned mass and energy ledgers'],
  illustrative: ['Excavator-drilled access concept', 'Simultaneous drill vibration and liquid markers'],
  unavailable: ['Field infiltration', 'Vibration-dependent permeability', 'Compaction or loosening', 'Mechanical energy consumption', 'Oxygen, reactive fuel and suppression/re-ignition outcomes'],
  experimentallyValidated: false,
} as const

export const defaultSettings: Partial<ThermalSettings> = { contactStartS: 0 }

/** Owns the serializable input and snapshots; shared worker owns job lifecycle.
 * The unchanged public contact reference supplies all numerical physics. */
export function createVibratoryRun(config: PanelConfig, hooks: SupportedAdapterHooks): AlternativeRun {
  if (config.variantId !== 'vibratory-injection') throw new Error('Vibratory adapter requires its own variant identity.')
  const run = hooks.supportedRun(structuredClone(config))
  return {
    endS: run.endS,
    snapshot: () => structuredClone(run.snapshot()),
    advanceTo: targetS => structuredClone(run.advanceTo(targetS)),
  }
}

/** Independent authored presentation seconds, never physical solver inputs.
 * These small display motions have no calibrated physical amplitude/frequency. */
export function vibratoryPresentation(id: VariantId, timeS: number): MethodPresentation {
  if (id !== 'vibratory-injection') throw new Error('Vibratory presentation requires its own variant identity.')
  const time = Number.isFinite(timeS) ? Math.max(0, Math.min(90, timeS)) : 0
  const active = time >= 24 && time < 60
  return { contextTime: Math.min(time, 36), access: time >= 18, pulse: false, waves: false,
    injection: active, vibration: active ? Math.sin(time * 24) * .006 : 0, contacts: active ? 3 : 0 }
}
