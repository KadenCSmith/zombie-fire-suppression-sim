import type { VariantId } from './registry'

/** Authored presentation only: these cues never enter a scientific solver. */
export function methodPresentationBase(id: VariantId, timeS: number) {
  const time = Math.max(0, Math.min(90, timeS))
  const access = id !== 'baseline' && id !== 'nanoparticles'
  const pulse = (id === 'pressure-pulse' || id === 'pressure-only') && time >= 48 && time < 54
  const waves = id === 'liquid-waves' && time >= 44 && time < 56
  const continuous = id === 'vibratory-injection'
  const injection = (id === 'pressure-pulse' && time >= 60) || (id === 'liquid-waves' && time >= 64) || (continuous && time >= 27)
  return {
    contextTime: Math.min(time, access ? 36 : 23), access, pulse, waves, injection,
    vibration: continuous && time >= 24 && time < 60 ? Math.sin(time * 24) * .006 : 0,
    contacts: injection ? (id === 'pressure-pulse' ? 3 : 1) : 0,
  }
}
