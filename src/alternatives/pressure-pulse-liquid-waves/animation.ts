import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { PRESENTATION_TIMING } from '../../story/firePresentation'

/** Authored presentation only. No pump, pressure, fracture or source settings. */
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (time: number, start: number, end: number) => {
  const u = clamp((time - start) / (end - start))
  return u * u * (3 - 2 * u)
}
export const HYDRAULIC_PULSES = [[76, 78], [82, 84], [87, 89]] as const
export const LIQUID_SEQUENCE = { injectionStart: PRESENTATION_TIMING.waterStart, end: 90 } as const
export const DRILL_SECTION_STARTS = [68, 68 + 4 / 3, 68 + 8 / 3] as const

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
    stage: time < 44 ? 'Original fire and drilled access' : time < 57 ? 'Original dry-ice pressure release' : time < 65 ? 'Pump truck reverses into position' : time < 68 ? 'Drilling mast rises' : time < 72 ? 'Rigid drill pipe advances into the bore' : waves ? 'Illustrative ground pulse' : 'Normal water pumping',
    contact: injection ? arrival : 0, flowClock,
    extinguishing: clamp((time - PRESENTATION_TIMING.waterStart) / 17),
  }
}

/** Independently authored service vehicle and installation choreography.
 * Positions and lengths are display geometry, never equipment specifications. */
export function pipeTruckFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const travel = 6 * (1 - smooth(time, 57, 65))
  const deployment = smooth(time, 65, 68)
  const position: [number, number, number] = [-2.35 - travel, 0, -.95]
  const activeSection = DRILL_SECTION_STARTS.reduce((index, start, i) => time >= start ? i : index, 0)
  const sectionStart = DRILL_SECTION_STARTS[activeSection]
  const joining = 1 - smooth(time, sectionStart, sectionStart + .45)
  const lower = smooth(time, sectionStart + .45, sectionStart + 4 / 3)
  const depths = [.25, -.25, -.8, -G.sourceDepthM]
  const pipeBottom = depths[activeSection] + (depths[activeSection + 1] - depths[activeSection]) * lower
  const drillRotation = DRILL_SECTION_STARTS.reduce((angle, start) => angle +
    (time >= start + 4 / 3 ? 4 / 3 - .45 : Math.max(0, time - start - .45)) * 10, 0)
  return {
    visible: time >= 57,
    position, heading: Math.PI, travel, deployment,
    rigPosition: [position[0] + 1.4 + (G.sourceX - .11 - position[0] - 1.4) * deployment,
      1.58 - deployment * 1.08, position[2] + .15 + (.09 - position[2] - .15) * deployment] as [number, number, number],
    mastAngle: (1 - deployment) * Math.PI / 2,
    pipeVisible: time >= 68, pipeBottom, pipeTop: pipeBottom + activeSection + 1,
    sectionCount: activeSection + 1, joining: time >= 72 ? 0 : joining,
    incomingPosition: [G.sourceX - .11 + (position[0] + 1.25 - G.sourceX + .11) * joining,
      pipeBottom + activeSection + (.7 - pipeBottom - activeSection) * joining,
      .09 + (position[2] - (-.2 + activeSection * .2) - .09) * joining] as [number, number, number],
    drilling: time >= 68 && time < 72 && joining === 0,
    drillRotation,
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
