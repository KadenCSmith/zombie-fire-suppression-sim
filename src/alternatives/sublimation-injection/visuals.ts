import { PRESENTATION_TIMING } from './index'

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const ease = (time: number, start: number, end: number) => {
  const x = clamp((time - start) / (end - start))
  return x * x * (3 - 2 * x)
}

/** Authored presentation only. These fractions are never mass, temperature,
 * pressure, wetting or solver results. Seeking/restarting is deterministic. */
export function preparationVisuals(timeS: number) {
  const time = Number.isFinite(timeS) ? Math.max(0, Math.min(PRESENTATION_TIMING.endS, timeS)) : 0
  return {
    time,
    phaseChange: ease(time, PRESENTATION_TIMING.preparationS, 53),
    delivery: ease(time, PRESENTATION_TIMING.injectionS, 78),
    contact: ease(time, 77, 84),
    // No predicted volume decrease or pre-cooling temperature is depicted.
    surfaceOffset: .006 * Math.sin(time * .8),
    solidScale: 1 - .16 * ease(time, 45, 64),
  }
}
