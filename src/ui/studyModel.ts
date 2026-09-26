/** Presentation time is independent of every physical solver clock. */
export type StudyView = 'cutaway' | 'thermal' | 'top' | 'root'
export const STUDY_DURATION = 20
export const STUDY_LANDING_TIME = 4
export const STUDY_RELEASE_DELAY = 5
export const STUDY_RELEASE_TIME = STUDY_LANDING_TIME + STUDY_RELEASE_DELAY
export const STUDY_SOURCE = [-1.4, -2.19, 0] as const
export const STUDY_PEAT = [1.4, -0.68, -0.72] as const
export type StudyCage = { enabled: boolean; heightM: number; widthM: number }
export const DEFAULT_STUDY_CAGE: StudyCage = { enabled: true, heightM: 0.1, widthM: 0.95 }
export function studyCageBars(heightM: number, widthM: number) {
  if (!Number.isFinite(heightM) || heightM < 0.01 || heightM > 1 || !Number.isFinite(widthM) || widthM < 0.1 || widthM > 2)
    throw new Error('Cage dimensions are outside the illustration range.')
  type Point = [number, number, number]
  const bars: { start: Point; end: Point }[] = []
  const half = widthM / 2
  const divisions = Math.max(2, Math.ceil(widthM / 0.1))
  for (let i = 0; i <= divisions; i++) {
    const offset = -half + widthM * i / divisions
    bars.push({ start: [-half, heightM, offset], end: [half, heightM, offset] })
    bars.push({ start: [offset, heightM, -half], end: [offset, heightM, half] })
    bars.push({ start: [-half, 0, offset], end: [-half, heightM, offset] })
    bars.push({ start: [half, 0, offset], end: [half, heightM, offset] })
    if (i > 0 && i < divisions) {
      bars.push({ start: [offset, 0, -half], end: [offset, heightM, -half] })
      bars.push({ start: [offset, 0, half], end: [offset, heightM, half] })
    }
  }
  // Bottom perimeter only: the underside stays open, like an inverted basket.
  bars.push({ start: [-half, 0, -half], end: [half, 0, -half] },
    { start: [-half, 0, half], end: [half, 0, half] },
    { start: [-half, 0, -half], end: [-half, 0, half] },
    { start: [half, 0, -half], end: [half, 0, half] })
  return bars
}
export const STUDY_PHASES = [
  { start: 0, end: STUDY_LANDING_TIME, title: 'Source placement', short: 'Place', description: 'The dry-ice sphere falls to the base of the crater.' },
  { start: STUDY_LANDING_TIME, end: STUDY_RELEASE_TIME, title: 'Five-second hold', short: 'Wait', description: 'The dry ice rests in the crater for five seconds.' },
  { start: STUDY_RELEASE_TIME, end: 12, title: 'Instant gas release', short: 'Expand', description: 'The solid disappears. Gas tracers expand rapidly and soil and rock fragments move outward.' },
  { start: 12, end: STUDY_DURATION, title: 'Fragments settle', short: 'Settle', description: 'Displaced grains and rocks settle as the gas tracers disperse.' },
] as const

export function studyTime(time: number): number {
  return Number.isFinite(time) ? Math.min(STUDY_DURATION, Math.max(0, time)) : 0
}

export function smoothPhase(time: number, start: number, end: number): number {
  const x = Math.min(1, Math.max(0, (studyTime(time) - start) / (end - start)))
  return x * x * (3 - 2 * x)
}

export function studyAnimation(time: number) {
  const t = studyTime(time)
  const releaseAge = Math.max(0, t - STUDY_RELEASE_TIME)
  return {
    // The exported sphere is already at its approved final position.
    sourceOffsetY: 3.5 * (1 - smoothPhase(t, 0, STUDY_LANDING_TIME)),
    sourceVisible: t < STUDY_RELEASE_TIME,
    releaseAge,
    // Authored display radius, not a pressure front or gas-volume prediction.
    expansionRadius: t < STUDY_RELEASE_TIME ? 0 : 0.25 + 1.5 * (1 - Math.exp(-5 * releaseAge)),
    cold: smoothPhase(t, 4, 8),
    transport: smoothPhase(t, STUDY_RELEASE_TIME, 14),
    // A visible residual hotspot prevents an implied claim of extinction.
    warmth: 1 - 0.38 * smoothPhase(t, 14, 20),
  }
}

/** Deterministic illustration fragments; their trajectories do not load a solver. */
export const STUDY_FRAGMENTS = Array.from({ length: 88 }, (_, index) => {
  const surface = index >= 64
  const local = surface ? index - 64 : index
  const angle = surface ? Math.PI * (0.08 + local / 24 * 0.84) : local * 2.399963
  const radius = surface ? 0.48 + (local % 4) * 0.09 : 0.40 + (local % 5) * 0.067
  const dx = Math.cos(angle), dy = Math.sin(angle)
  return {
    surface,
    position: [STUDY_SOURCE[0] + dx * radius, surface ? 0.025 : STUDY_SOURCE[1] + dy * radius,
      surface ? -dy * radius : 0.09 + (local % 3) * 0.018] as [number, number, number],
    direction: [dx, surface ? 1 : dy, surface ? -dy : 0.30] as [number, number, number],
    size: (surface ? 0.035 : 0.024) + (index % 4) * 0.013,
    spin: [index * 1.47, index * 0.73, index * 2.19] as [number, number, number],
  }
})

export function studyFragmentPose(index: number, time: number) {
  const seed = STUDY_FRAGMENTS[index]
  if (!seed) throw new Error('Unknown study fragment.')
  const age = Math.max(0, studyTime(time) - STUDY_RELEASE_TIME)
  const push = 1 - Math.exp(-4 * age)
  // Each display fragment has a prescribed support height. This is an animation,
  // not a collision/fracture model of the static geological mesh or a cage.
  const lift = seed.surface ? Math.max(0, 2.2 * age - 1.7 * age * age) : 0.35 * Math.sin(Math.min(1, age / 1.6) * Math.PI)
  return {
    position: [seed.position[0] + seed.direction[0] * push * 0.55,
      seed.position[1] + (seed.surface ? lift : seed.direction[1] * push * 0.24 + lift),
      seed.position[2] + seed.direction[2] * push * (seed.surface ? 0.55 : 0.4)] as [number, number, number],
    rotation: seed.spin.map((value, axis) => value + push * (axis + 1) + Math.min(age, 1.4) * (index % 2 ? 1 : -1)) as [number, number, number],
  }
}

export function studyObjectRole(name: string): 'source' | 'peat' | 'soil' | 'natural' {
  const plain = name.replaceAll('_', ' ')
  if (/^DRY ICE/i.test(plain)) return 'source'
  if (/^Peat lens/i.test(plain)) return 'peat'
  if (/^0[1-4](?:\s|$)/.test(plain)) return 'soil'
  return 'natural'
}
