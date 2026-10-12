import { eased } from '../../story/fireSequence'

/** Authored display motion only. No physical forcing, frequency, strain, work,
 * permeability change or extinction is inferred from these display choices. */
export const VIBRATION_TIMELINE = { start: 27, rampEnd: 33, holdContext: 33, taperStart: 68, stop: 74, end: 90 } as const
export function vibrationPose(time: number, enabled = true) {
  const t = Number.isFinite(time) ? Math.max(0, Math.min(VIBRATION_TIMELINE.end, time)) : 0
  const amount = enabled ? eased(t, VIBRATION_TIMELINE.start, VIBRATION_TIMELINE.rampEnd) * (1 - eased(t, VIBRATION_TIMELINE.taperStart, VIBRATION_TIMELINE.stop)) : 0
  const x = amount * (.026 * Math.sin(t * 26) + .009 * Math.sin(t * 39))
  const y = amount * .014 * Math.sin(t * 31)
  const fracture = enabled ? eased(t, 33, 46) : 0
  const compression = enabled ? eased(t, 44, 68) : 0
  const emberFade = enabled ? eased(t, 50, 74) : 0
  const shrink = compression * .028
  return {
    time: t, contextTime: Math.min(t, VIBRATION_TIMELINE.holdContext), amount, fracture, compression, emberFade,
    groundScale: [1, 1 - shrink, 1] as [number, number, number],
    surfacePosition: [x, y - 3.2 * shrink, 0] as [number, number, number],
    groundPosition: [x, y, 0] as [number, number, number],
    groundTilt: amount * .0025 * Math.sin(t * 23),
    toolPosition: [amount * .024 * Math.sin(t * 35), amount * .022 * Math.sin(t * 29), 0] as [number, number, number],
  }
}
export function vibrationStage(time: number) {
  return time < 10 ? 'Surface ignition' : time < 18 ? 'Fire enters the peat' : time < 24 ? 'Excavator approaches' : time < 33 ? 'Drilling · vibration builds' : time < 44 ? 'Fractures open' : time < 62 ? 'Soil compresses & rearranges' : time < 74 ? 'Embers fade as the soil settles' : 'Illustrated fire-out · inspect the peat'
}
