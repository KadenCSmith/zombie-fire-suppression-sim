import { FIRE_SEQUENCE_DURATION, FIRE_SEQUENCE_STAGES, STORY_HOSE_POINTS, eased, fireSequencePose, pointAlongStoryPath, type StoryPoint } from './fireSequence'

/** Current authored presentation only. Neither these rates nor equipment poses drive a solver. */
export const PRESENTATION_TIMING = {
  spreadStart: 12, spreadEnd: 40,
  excavatorEnter: 18, excavatorPark: 24,
  drillStart: 24, drillFullDepth: 31, drillRetract: 34, drillClear: 36.5, excavatorExit: 40,
  sourceContact: 44, capSeated: 51.5, gasRelease: 55,
  truckEnter: 57, truckPark: 65, hoseDeploy: 65, hoseAtBore: 69, hoseConnected: 72,
  waterStart: 72, review: 85,
} as const
export const PRESENTATION_SPEED = { early: 3.2, equipment: 1.2, placement: 2, release: 1, finish: 2 } as const
/** Smooth story-seconds per real second at the user's 1× speed setting. */
export function presentationRate(time: number) {
  const s = PRESENTATION_SPEED, t = PRESENTATION_TIMING
  let rate = s.early + (s.equipment - s.early) * eased(time, t.excavatorEnter, t.excavatorPark)
  rate += (s.placement - s.equipment) * eased(time, t.drillClear, t.excavatorExit)
  rate += (s.release - s.placement) * eased(time, 53, t.gasRelease)
  rate += (s.finish - s.release) * eased(time, 56.5, 58.5)
  return rate
}
// Integrate reciprocal speed once; invert the same monotone table for frame-rate-independent replay.
// 20 ms story intervals, Simpson quadrature. No simulation timestep is modified.
const CLOCK_STEP = .02
const clock = new Float64Array(Math.round(FIRE_SEQUENCE_DURATION / CLOCK_STEP) + 1)
for (let i = 1; i < clock.length; i++) {
  const a = (i - 1) * CLOCK_STEP, b = i * CLOCK_STEP
  clock[i] = clock[i - 1] + CLOCK_STEP / 6 * (1 / presentationRate(a) + 4 / presentationRate((a + b) / 2) + 1 / presentationRate(b))
}
export const PRESENTATION_PLAYBACK_DURATION = clock[clock.length - 1]
export function currentStoryToPlayback(time: number) {
  const q = Math.max(0, Math.min(FIRE_SEQUENCE_DURATION, time)) / CLOCK_STEP, i = Math.min(clock.length - 2, Math.floor(q))
  return clock[i] + (clock[i + 1] - clock[i]) * (q - i)
}
export function currentPlaybackToStory(time: number) {
  const t = Math.max(0, Math.min(PRESENTATION_PLAYBACK_DURATION, time))
  let lo = 0, hi = clock.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (clock[mid] <= t) lo = mid; else hi = mid }
  return (lo + (t - clock[lo]) / (clock[hi] - clock[lo])) * CLOCK_STEP
}
/** Reuses the existing connected arrival map; its continuous growth now overlaps drilling. */
export const currentPeatCoverage = (time: number) => .7 * eased(time, PRESENTATION_TIMING.spreadStart, PRESENTATION_TIMING.spreadEnd)

export const WATER_TRUCK = {
  parked: [2.35, 0, -1.15] as StoryPoint,
  outletLocal: [-1.27, .63, .61] as StoryPoint,
  wheelRadiusM: .29,
} as const
const parkedOutlet: StoryPoint = WATER_TRUCK.parked.map((v, i) => v + WATER_TRUCK.outletLocal[i]) as StoryPoint
/** Surface route stays behind the exposed face and clear of the left-hand excavator and tree. */
export const CONNECTED_HOSE_ROUTE: StoryPoint[] = [
  parkedOutlet, [.96, .22, -.52], [.80, .13, -.46], [.63, .13, -.36],
  [.52, .14, -.26], [.42, .22, -.13], ...STORY_HOSE_POINTS.slice(6),
]
export function currentEquipmentState(time: number) {
  const t = PRESENTATION_TIMING, drill = fireSequencePose(time, 'gradual')
  const travel = 6 * (1 - eased(time, t.truckEnter, t.truckPark))
  const truckPosition: StoryPoint = [WATER_TRUCK.parked[0] + travel, 0, WATER_TRUCK.parked[2]]
  return {
    excavatorVisible: time >= t.excavatorEnter && time < t.excavatorExit,
    excavatorTravel: -6 * (1 - eased(time, t.excavatorEnter, t.excavatorPark)) - 6 * eased(time, t.drillClear, t.excavatorExit),
    drilling: time >= t.drillStart && time < t.drillRetract && drill.drillDepth > .005,
    drillClear: time >= t.drillClear,
    truckVisible: time >= t.truckEnter, truckParked: time >= t.truckPark, truckPosition, truckTravel: travel,
    truckOutlet: truckPosition.map((v, i) => v + WATER_TRUCK.outletLocal[i]) as StoryPoint,
    hoseProgress: eased(time, t.hoseDeploy, t.hoseAtBore), hoseInsertion: eased(time, t.hoseAtBore, t.hoseConnected),
    hoseConnected: time >= t.hoseConnected,
    waterOn: time >= t.waterStart && time >= t.hoseConnected && time >= t.drillClear,
  }
}
/** Arc-length prefix preserves a fixed supply end while the hose's free tip advances continuously. */
function pathPrefix(points: StoryPoint[], fraction: number): StoryPoint[] {
  if (fraction <= 0) return [points[0]]
  if (fraction >= 1) return points
  const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(...p.map((v, j) => v - points[i][j])), 0)
  let traversed = 0
  const visible: StoryPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    traversed += Math.hypot(...points[i].map((v, j) => v - points[i - 1][j]))
    if (traversed < length * fraction) visible.push(points[i]); else break
  }
  visible.push(pointAlongStoryPath(points, fraction))
  return visible
}
/** Connected surface prefix, then the original verified bore/cap-gap route. */
export function connectedHosePoints(time: number): StoryPoint[] {
  const state = currentEquipmentState(time)
  if (time <= PRESENTATION_TIMING.hoseDeploy) return []
  const surface = CONNECTED_HOSE_ROUTE.slice(0, 8)
  if (time < PRESENTATION_TIMING.hoseAtBore) return pathPrefix(surface, state.hoseProgress)
  return [...surface.slice(0, -1), ...pathPrefix(CONNECTED_HOSE_ROUTE.slice(7), state.hoseInsertion)]
}

export const CURRENT_FIRE_STAGES = FIRE_SEQUENCE_STAGES.map(stage => stage.id === 'drilling'
  ? { ...stage, description: 'The parked excavator turns its auger into the bore while the continuous illustrated peat front keeps advancing. Soil-colored cuttings mark drilling; no water is applied.' }
  : stage.id === 'treatment'
    ? { ...stage, description: 'After the cap lands, rapid mode depicts a brief gas release. A water truck enters and parks, then its reel extends a connected hose toward the access point. Gradual mode retains finite contact cooling.' }
    : stage.id === 'water'
      ? { ...stage, description: 'The supply end stays attached to the truck. The hose clears the retracted drill, enters the cap service opening, then supplies the established progressive wetting sequence after connection at 72 s.' }
      : stage)
export const currentSequenceStage = (time: number) => CURRENT_FIRE_STAGES.find(stage => time >= stage.start && time < stage.end) ?? CURRENT_FIRE_STAGES[CURRENT_FIRE_STAGES.length - 1]
export function advancePresentationTime(storyTime: number, realSeconds: number, speed: number, loop = false) {
  const next = currentStoryToPlayback(storyTime) + Math.max(0, realSeconds) * speed
  return currentPlaybackToStory(loop ? next % PRESENTATION_PLAYBACK_DURATION : next)
}
