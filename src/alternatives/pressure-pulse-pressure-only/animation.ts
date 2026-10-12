import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'

/** Presentation timing only; no pressure, stress, energy or displacement law. */
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const ease = (time: number, start: number, end: number) => {
  const u = clamp((time - start) / (end - start))
  return u * u * (3 - 2 * u)
}
export const PRESSURE_SEQUENCE = { start: 38, release: 55, settle: 58, observe: 62, end: 90 } as const

export function pressureAnimationFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const age = Math.max(0, time - PRESSURE_SEQUENCE.release)
  const active = time >= PRESSURE_SEQUENCE.release
  const jolt = active && age < 3 ? clamp((1 - Math.exp(-age * 32)) * Math.exp(-age * 3.7) * 1.8) : 0
  const settled = ease(time, 56, PRESSURE_SEQUENCE.observe)
  return {
    time, age, active, jolt, settled,
    opening: ease(time, 55, 55.5) * (1 - settled * .65),
    tremor: active && age < 3 ? Math.sin(age * 31) * Math.exp(-age * 3.7) * .035 : 0,
    fragments: active && age < 3,
    stage: time < 38 ? 'Original fire and drilled access' : time < 55 ? 'Original dry-ice placement and pressure release' : time < 56 ? 'Illustrative ground jolt' : time < 62 ? 'Soil fragments fall and settle' : 'Observe · no liquid injected',
  }
}

/** Irregular authored earth seams, never computed fracture trajectories. */
export function pressureSoilPoint(branch: number, fraction: number): [number, number, number] {
  const u = clamp(fraction), angle = branch * Math.PI / 4 + .13
  return [G.sourceX + Math.cos(angle) * (1.55 + (branch % 3) * .28) * u,
    -G.sourceDepthM + Math.sin(angle) * (.35 + (branch % 2) * .12) * u + Math.sin(u * 15 + branch) * .035 * u,
    .15]
}
