import type { Variant, VariantId, ThermalSettings } from './registry'
import type { PanelConfig, AcceptedState } from './model'
export const ALTERNATIVE_API_VERSION = 'v21.2' as const
/** Additive D payloads; existing v21.2 owners and runtime semantics remain valid. */
export const PARTICLE_API_VERSION = 'v21.3' as const
export interface AlternativeRun {
  readonly endS: number
  snapshot(): AcceptedState
  advanceTo(targetS: number): AcceptedState
}
export interface SupportedAdapterHooks {
  /** Existing verified contact/concept core. Owns all mutable state; never infers unsupported sources. */
  supportedRun(config: PanelConfig): AlternativeRun
}
export interface MethodPresentation {
  contextTime: number; access: boolean; pulse: boolean; waves: boolean; injection: boolean; vibration: number; contacts: number
}
export interface AlternativeModule {
  apiVersion: typeof ALTERNATIVE_API_VERSION | typeof PARTICLE_API_VERSION
  method: '4.2.1' | '4.2.2' | '4.2.3' | '4.2.4'
  variants: readonly Variant[]
  defaultSettings(id: VariantId): Partial<ThermalSettings>
  createRun(config: PanelConfig, hooks: SupportedAdapterHooks): AlternativeRun
  presentation(id: VariantId, timeS: number): MethodPresentation
}
export interface MethodSceneProps { id: VariantId; time: number }
