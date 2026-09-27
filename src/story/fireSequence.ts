/** Canonical presentation clock. Staged geometry never feeds the numerical solver. */
export const FIRE_SEQUENCE_DURATION = 90
export type FireSourceMode = 'gradual' | 'rapid'
export type FireSequenceView = 'natural' | 'temperature' | 'oxygen' | 'co2'
export const FIRE_SEQUENCE_GEOMETRY = { sourceX: 0.4, sourceDepthM: 1.3, sourceInitialMassKg: 4, sourceDensityKgM3: 1560, boreRadiusM: 0.55, boreDepthM: 1.385, capRadiusM: 0.475, capRiseM: 0.1, capDepthM: 1.05, augerRadiusM: 0.5, domain: { widthM: 8, lengthM: 8, depthM: 3.2 } } as const
export const FIRE_SEQUENCE_STAGES = [
  { id: 'surface', start: 0, end: 10, title: 'A small surface fire', short: 'Ignition', description: 'A localized ignition starts the story above organic ground.', evidence: 'Flames are a visual cue. The field view shows the numerical temperature state.' },
  { id: 'underground', start: 10, end: 24, title: 'The fire moves underground', short: 'Subsurface spread', description: 'The story illustrates a buried peat fire. A moving underground front is not resolved by this calculation.', evidence: 'Underground spread is prescribed in the natural story. Accepted numerical fields show heating and oxidation without a resolved moving subsurface front.' },
  { id: 'drilling', start: 24, end: 37, title: 'Drill, then withdraw', short: 'Borehole', description: 'At 70% illustrated peat involvement, a tracked excavator arrives, drills the opening, then withdraws.', evidence: 'Drilling, excavation and displaced cuttings are staged; not a solved excavation model.' },
  { id: 'source', start: 37, end: 47, title: 'Lower the dry ice', short: 'Dry ice', description: 'A finite dry-ice sphere enters the open borehole after the drill is removed.', evidence: 'Placement is prescribed. Gradual source mass follows accepted calculation when available.' },
  { id: 'dome', start: 47, end: 55, title: 'A buried inverted plate', short: 'Metal dome', description: 'The inverted plate lowers into the borehole above the dry-ice sphere, with clearance for both.', evidence: 'Placement is staged. The following bend is enlarged illustration, not a failure prediction.' },
  { id: 'treatment', start: 55, end: 69, title: 'The plate inverts upward', short: 'Gas & deformation', description: 'Rapid mode illustrates gas release and upward plate inversion. Gradual mode retains the calculated finite source.', evidence: 'CO₂ is invisible. Cyan tracers and cap bending are schematic, not solver-derived.' },
  { id: 'water', start: 69, end: 85, title: 'Water follows assumed paths', short: 'Water stage', description: 'Water enters the borehole and travels along a displayed network of assumed openings.', evidence: 'Crack opening, liquid flow and resulting cooling are illustrative; infiltration is not solved.' },
  { id: 'review', start: 85, end: 90, title: 'Inspect what remains', short: 'Review', description: 'Some peat can remain hot. Compare the visual narrative with the available solver evidence.', evidence: 'This is not a validated treatment procedure or a prediction of extinguishment.' },
] as const
export function sequenceStage(time: number) { return FIRE_SEQUENCE_STAGES.find(stage => time >= stage.start && time < stage.end) ?? FIRE_SEQUENCE_STAGES[FIRE_SEQUENCE_STAGES.length - 1] }
export const phase = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)))
export const eased = (time: number, start: number, end: number) => { const p = phase(time, start, end); return p * p * (3 - 2 * p) }
export function fireSequencePose(time: number, mode: FireSourceMode) {
  const drillDown = eased(time, 24, 31), drillOut = eased(time, 31, 36)
  const drop = phase(time, 39, 44), gas = eased(time, 55, mode === 'rapid' ? 58 : 69), water = eased(time, 70, 85)
  return { drillVisible: illustratedPeatCoverage(time) >= .7 && time >= 24 && time < 36.8, drillY: 1.55 - 2.95 * drillDown * (1 - drillOut), drillDepth: Math.min(FIRE_SEQUENCE_GEOMETRY.boreDepthM, Math.max(0, 2.95 * drillDown - 1.55)), sourceY: 2.2 - 3.5 * drop * drop, sourceVisible: time >= 39, capY: 2.5 - (2.5 + FIRE_SEQUENCE_GEOMETRY.capDepthM) * eased(time, 48, 53), capVisible: time >= 47, gas, water, bend: mode === 'rapid' ? .3 * eased(time, 55, 61) : 0, crack: eased(time, 61, 70), fire: eased(time, 0, 10), underground: eased(time, 10, 24) }
}

/** Select stored states, preserving the zero-time dry-ice insertion discontinuity. */
export function acceptedFireFrame<T extends { timeS: number; phase: string }>(frames: readonly T[], presentationTime: number, ignitionEndS?: number): T | undefined {
  const growth = frames.filter(frame => frame.phase !== 'treatment')
  const treatment = frames.filter(frame => frame.phase === 'treatment')
  const active = presentationTime >= 55 && treatment.length ? treatment : growth
  if (!active.length) return undefined
  const first = active[0].timeS, last = active[active.length - 1].timeS
  let requested: number
  if (presentationTime >= 55 && treatment.length) requested = first + phase(presentationTime, 55, 85) * (last - first)
  else if (ignitionEndS !== undefined && Number.isFinite(ignitionEndS)) {
    // Match the film's two physical phases without extending a partial history.
    const ignitionEnd = Math.max(first, Math.min(last, ignitionEndS))
    requested = presentationTime <= 10
      ? first + phase(presentationTime, 0, 10) * (ignitionEnd - first)
      : ignitionEnd + phase(presentationTime, 10, 24) * (last - ignitionEnd)
  } else requested = first + phase(presentationTime, 0, 24) * (last - first)
  let index = 0
  for (let i = 1; i < active.length && active[i].timeS <= requested; i++) index = i
  return active[index]
}

/** Authored coverage, not fuel mass or an accepted numerical burn fraction. */
export const illustratedPeatCoverage = (time: number) => .7 * eased(time, 12, 24)
export function illustratedPeatFront(coverage: number) {
  if (coverage <= 0) return 1
  if (coverage >= 1) return -1
  let lo = -1, hi = 1
  for (let i = 0; i < 32; i++) {
    const q = (lo + hi) / 2, fraction = (Math.acos(q) - q * Math.sqrt(1 - q * q)) / Math.PI
    if (fraction > coverage) lo = q; else hi = q
  }
  return (lo + hi) / 2
}
export const FIRE_SEQUENCE_PLAYBACK_DURATION = 36
/** The rapid release/inversion interval is 1:1; setup and review run at 2.8×. */
export function storyToPlayback(time: number) {
  const t = Math.max(0, Math.min(FIRE_SEQUENCE_DURATION, time))
  return t <= 55 ? t / 2.8 : t <= 61 ? 55 / 2.8 + t - 55 : 55 / 2.8 + 6 + (t - 61) / 2.8
}
export function playbackToStory(time: number) {
  const t = Math.max(0, Math.min(FIRE_SEQUENCE_PLAYBACK_DURATION, time)), eventStart = 55 / 2.8, eventEnd = eventStart + 6
  return t <= eventStart ? t * 2.8 : t <= eventEnd ? 55 + t - eventStart : 61 + (t - eventEnd) * 2.8
}
