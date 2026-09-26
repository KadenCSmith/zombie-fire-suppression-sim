/** Presentation time is independent of every physical solver clock. */
export type StudyView = 'cutaway' | 'thermal' | 'top' | 'root'
export const STUDY_DURATION = 20
export const STUDY_SOURCE = [-1.4, -2.19, 0] as const
export const STUDY_PEAT = [1.4, -0.68, -0.72] as const

export function studyTime(time: number): number {
  return Number.isFinite(time) ? Math.min(STUDY_DURATION, Math.max(0, time)) : 0
}

export function smoothPhase(time: number, start: number, end: number): number {
  const x = Math.min(1, Math.max(0, (studyTime(time) - start) / (end - start)))
  return x * x * (3 - 2 * x)
}

export function studyAnimation(time: number) {
  const t = studyTime(time)
  return {
    // The exported sphere is already at its approved final position.
    sourceOffsetY: 3.5 * (1 - smoothPhase(t, 0, 4)),
    cold: smoothPhase(t, 4, 8),
    transport: smoothPhase(t, 8, 14),
    // A visible residual hotspot prevents an implied claim of extinction.
    warmth: 1 - 0.38 * smoothPhase(t, 14, 20),
  }
}

export function studyObjectRole(name: string): 'source' | 'peat' | 'soil' | 'natural' {
  const plain = name.replaceAll('_', ' ')
  if (/^DRY ICE/i.test(plain)) return 'source'
  if (/^Peat lens/i.test(plain)) return 'peat'
  if (/^0[1-4](?:\s|$)/.test(plain)) return 'soil'
  return 'natural'
}
