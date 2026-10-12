/** Authored dimensionless disturbance, never a pressure law or soil response. */
const clamp = (n: number) => Math.max(0, Math.min(1, n))
export const PRESSURE_SEQUENCE = { start: 38, release: 44, observe: 66, end: 90 } as const

export function pressureAnimationFrame(presentationS: number) {
  const time = Number.isFinite(presentationS) ? Math.max(0, Math.min(90, presentationS)) : 0
  const elapsed = time - 38, active = elapsed >= 0 && time < 66
  const expansion = 1 - Math.exp(-Math.max(0, elapsed) * .22)
  const fade = active ? Math.min(1, Math.max(0, elapsed) / .7) * (1 - clamp((time - 57) / 9)) : 0
  return {
    time, active,
    stage: time < 38 ? 'Drilled access' : time < 44 ? 'Rapid pressure change' : time < 66 ? 'Transient relaxation' : 'Observe · no liquid injected',
    fronts: active ? Array.from({ length: 5 }, (_, i) => ({
      radius: .12 + expansion * (.42 + i * .32) + Math.sin(elapsed * 2.7 - i * .8) * .055 * Math.exp(-elapsed * .055),
      opacity: fade * (.75 - i * .09),
      angle: i * Math.PI * .4 + elapsed * .22,
    })) : [],
    direction: active && time < 41 ? -1 : 1,
    indicator: active ? .3 + .7 * Math.sin(elapsed * 2.7) ** 2 : 0,
    observationCursor: time >= 66 ? clamp((time - 66) / 24) : 0,
  }
}
