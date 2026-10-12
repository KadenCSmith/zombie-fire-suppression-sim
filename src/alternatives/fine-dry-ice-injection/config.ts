import type { PanelConfig } from '../model'
import type { ParticleInjectionSettings } from './types'
export const PARTICLE_PENDING = 'Particle delivery is defined; a reviewed particle model is not registered. Pressure, penetration and suppression predictions are unavailable.'
export function defaultParticleInjectionSettings(): ParticleInjectionSettings { return {} }
// Fail closed until D defines and validates its actual input schema.
export function restoreParticleInjectionSettings(_raw: unknown): ParticleInjectionSettings { return {} }
export function particleObservationWindowS(config: PanelConfig): number { return config.thermal.endS }
export function particleLinkedCompatibility(_configs: readonly PanelConfig[]): string | null { return PARTICLE_PENDING }
export const PARTICLE_RECORD_UNITS = {} as const
