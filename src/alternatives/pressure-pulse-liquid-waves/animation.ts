/** Authored presentation coordinates, never physical distance, pressure or inventory. */
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const cycle = (n: number) => n - Math.floor(n)
export const LIQUID_SEQUENCE = { wavesStart: 38, injectionStart: 56, end: 90 } as const

export function liquidAnimationFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const waves = time >= 38 && time < 56, injection = time >= 56
  const arrival = clamp((time - 56) / 2)
  return {
    time, waves, injection,
    stage: time < 38 ? 'Drilled access' : waves ? 'Liquid-pressure waves' : 'Liquid injection',
    fronts: waves ? Array.from({ length: 4 }, (_, i) => {
      const progress = cycle((time - 38) * .42 + i / 4)
      return { radius: .16 + progress * 1.9, opacity: (1 - progress) * .78, angle: progress * Math.PI * 1.4 + i * Math.PI / 2 }
    }) : [],
    drops: injection ? Array.from({ length: 24 }, (_, i) => {
      const progress = cycle((time - 56) * .5 + i / 24)
      const below = clamp((progress - .76) / .24)
      return { x: Math.sin(i * 2.4) * .035 + (i % 2 ? 1 : -1) * below * .52,
        y: .14 - Math.min(progress / .76, 1) * (G.sourceDepthM + .14) - Math.sin(below * Math.PI) * .09,
        opacity: arrival * (1 - below * .65), scale: .7 + .3 * Math.sin(i * 1.9) ** 2 }
    }) : [],
    contact: injection ? arrival : 0,
    ripples: injection ? [0, 1, 2].map(i => {
      const progress = cycle((time - 56) * .7 + i / 3)
      return { radius: .08 + progress * .56, opacity: arrival * (1 - progress) * .65 }
    }) : [],
  }
}

/** Presentation-only reuse of existing truck/hose choreography, not equipment
 * design or a pressure source. No original timing/defaults are changed. */
export function liquidAssetTime(time: number) {
  if (time < 46) return 56
  if (time < 54) return 57 + time - 46
  if (time < 56) return 65 + (time - 54) * 3.5
  return Math.min(90, 72 + time - 56)
}

/** Independently authored flow route, not a crack, permeability or transport solution. */
export function liquidContactPath(branch: number, fraction: number): [number, number, number] {
  const u = clamp(fraction), side = Math.sign(branch), reach = .55 + Math.abs(branch) * .42
  return [G.sourceX + side * reach * u,
    -G.sourceDepthM + Math.sin(u * Math.PI) * .12 - (.1 + Math.abs(branch) * .05) * u,
    .14 + Math.sin(u * Math.PI) * .015]
}
