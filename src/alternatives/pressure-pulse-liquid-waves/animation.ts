import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { PRESENTATION_TIMING } from '../../story/firePresentation'

/** Authored presentation only. No pump, pressure, fracture or source settings. */
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const cycle = (n: number) => n - Math.floor(n)
const smooth = (time: number, start: number, end: number) => {
  const u = clamp((time - start) / (end - start))
  return u * u * (3 - 2 * u)
}
export const HYDRAULIC_PULSES = [[76, 78], [82, 84], [87, 89]] as const
export const LIQUID_SEQUENCE = { injectionStart: PRESENTATION_TIMING.waterStart, end: 90 } as const

export function liquidAnimationFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const injection = time >= PRESENTATION_TIMING.waterStart
  const pulseIndex = HYDRAULIC_PULSES.findIndex(([start, end]) => time >= start && time < end)
  const waves = pulseIndex >= 0
  const age = waves ? time - HYDRAULIC_PULSES[pulseIndex][0] : 0
  const progress = age / 2
  // A fast jolt followed by settling, replacing the old expanding circles.
  const strength = waves ? clamp((1 - Math.exp(-age * 30)) * Math.exp(-age * 4) * 1.8) : 0
  const tremor = waves ? Math.sin(age * 34) * Math.exp(-age * 4) * .035 : 0
  const opening = HYDRAULIC_PULSES.reduce((sum, [start]) => sum + smooth(time, start, start + .55), 0) / HYDRAULIC_PULSES.length
  const accelerated = HYDRAULIC_PULSES.reduce((sum, [start, end]) => sum + Math.max(0, Math.min(time, end) - start), 0)
  const flowClock = Math.max(0, time - PRESENTATION_TIMING.waterStart) * .55 + accelerated * .65
  const arrival = clamp(time - PRESENTATION_TIMING.waterStart)
  return {
    time, waves, injection, pulseIndex, progress, strength, tremor, opening,
    stage: time < 44 ? 'Original fire and drilled access' : time < 57 ? 'Original dry-ice pressure release' : time < 65 ? 'Two trucks approach' : time < 72 ? 'Rigid pipe and water hose deployment' : waves ? 'Illustrative ground pulse' : 'Normal water pumping',
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

/** Independently authored service vehicle and installation choreography.
 * Positions and lengths are display geometry, never equipment specifications. */
export function pipeTruckFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const travel = 6 * (1 - smooth(time, 57, 65))
  const lower = smooth(time, 68, 72)
  return {
    visible: time >= 57,
    position: [-2.35 - travel, 0, -.95] as [number, number, number],
    travel, arm: smooth(time, 65, 68) * (1 - smooth(time, 72, 74)),
    pipeVisible: time >= 67, pipeBottom: 1.8 * (1 - lower) - G.sourceDepthM * lower,
    connected: time >= 72,
  }
}

/** Independently authored branch routes, not cracks computed by a solver. */
export function liquidContactPath(branch: number, fraction: number): [number, number, number] {
  const u = clamp(fraction), side = branch < 0 ? -1 : 1
  const reach = .8 + Math.abs(branch) * .43
  return [G.sourceX + side * reach * u,
    -G.sourceDepthM - .12 * Math.sin(u * Math.PI) + Math.sin(u * 8 + branch) * .045 * u + branch * .045 * u,
    .17 + Math.sin(u * Math.PI) * .018]
}
