import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { PRESENTATION_TIMING } from '../../story/firePresentation'

/** Authored additions to the unchanged original animation. These are
 * presentation seconds and dimensionless effects, never pump settings,
 * pressure, fracture mechanics, permeability or a physical source schedule. */
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const cycle = (n: number) => n - Math.floor(n)
export const HYDRAULIC_PULSES = [[76, 78], [82, 84], [87, 89]] as const
export const LIQUID_SEQUENCE = { injectionStart: PRESENTATION_TIMING.waterStart, end: 90 } as const

export function liquidAnimationFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const injection = time >= PRESENTATION_TIMING.waterStart
  const pulseIndex = HYDRAULIC_PULSES.findIndex(([start, end]) => time >= start && time < end)
  const waves = pulseIndex >= 0
  const progress = waves ? (time - HYDRAULIC_PULSES[pulseIndex][0]) / 2 : 0
  const strength = Math.sin(Math.PI * progress) ** 2
  const opening = HYDRAULIC_PULSES.reduce((sum, [start, end]) => sum + clamp((time - start) / (end - start)), 0) / HYDRAULIC_PULSES.length
  const accelerated = HYDRAULIC_PULSES.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(time, end) - start), 0)
  const flowClock = Math.max(0, time - PRESENTATION_TIMING.waterStart) * .55 + accelerated * .65
  const arrival = clamp(time - PRESENTATION_TIMING.waterStart)
  return {
    time, waves, injection, pulseIndex, progress, strength, opening,
    stage: time < 44 ? 'Original fire and drilled access' : time < 57 ? 'Original dry-ice pressure release' : time < 72 ? 'Original truck and hose deployment' : waves ? 'Illustrative hydraulic pulse' : 'Normal pumping',
    fronts: waves ? Array.from({ length: 3 }, (_, i) => {
      const front = clamp(progress * 1.5 - i * .18)
      return { radius: .18 + front * 2.15, opacity: Math.sin(Math.PI * front) * .8 }
    }) : [],
    drops: injection ? Array.from({ length: 32 }, (_, i) => {
      const progress = cycle(flowClock + i / 32)
      const below = clamp((progress - .84) / .16)
      return { x: Math.sin(i * 2.4) * .035 + (i % 2 ? 1 : -1) * below * .35,
        y: .14 - Math.min(progress / .84, 1) * (G.sourceDepthM + .14),
        opacity: arrival * (1 - below * .65), scale: .7 + .3 * Math.sin(i * 1.9) ** 2 }
    }) : [],
    contact: injection ? arrival : 0, flowClock,
    extinguishing: clamp((time - PRESENTATION_TIMING.waterStart) / 17),
  }
}

/** Independently authored branch routes, not cracks computed by a solver.
 * The base scene's original crack and water paths remain unchanged. */
export function liquidContactPath(branch: number, fraction: number): [number, number, number] {
  const u = clamp(fraction), side = branch < 0 ? -1 : 1
  const reach = .8 + Math.abs(branch) * .43
  return [G.sourceX + side * reach * u,
    -G.sourceDepthM - .12 * Math.sin(u * Math.PI) + Math.sin(u * 8 + branch) * .045 * u + branch * .045 * u,
    .17 + Math.sin(u * Math.PI) * .018]
}
