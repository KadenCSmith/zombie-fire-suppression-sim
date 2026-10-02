import { FIRE_SEQUENCE_DURATION, FIRE_SEQUENCE_STAGES } from '../story/fireSequence'
import { FRACTURE_STUDY_PHASES, STUDY_DURATION } from './studyModel'

export type SimulationMode = 'animation' | 'physics'
export type ReplayKind = 'study-scene' | 'film' | 'fire-scene' | 'unavailable'
export type SimulationVersionId = '0.8.0' | '0.9.0' | '0.10.0' | '0.11.0' | '0.12.0' | '0.13.0' | '0.14.0' | '0.15.0' | '0.16.0' | '0.17.1' | '0.18.0' | '0.18.1'

export interface SimulationVersion {
  id: SimulationVersionId
  commit: string
  title: string
  summary: string
  mode: SimulationMode
  available: boolean
  replay: ReplayKind
  durationS: number | null
  markersS: readonly number[]
  alignmentGroup: 'cap-study' | 'fire-sequence' | null
  assetBase?: string
  assetFile?: string
  limitation: string
}

const studyMarkers = [0, ...FRACTURE_STUDY_PHASES.map(phase => phase.end)]
const fireMarkers = [0, ...FIRE_SEQUENCE_STAGES.map(stage => stage.end)]

export const SIMULATION_CATALOG: readonly SimulationVersion[] = [
  { id: '0.8.0', commit: 'f3e7f16eedd0bfc0efb41b5525fa0cb1702127c4', title: 'Cap & bonded soil', summary: 'Seated cap, deeper peat, and authored particle separation.', mode: 'animation', available: true, replay: 'study-scene', durationS: STUDY_DURATION, markersS: studyMarkers, alignmentGroup: 'cap-study', limitation: 'Preserved interactive animation; pressure loading and fracture are assumed.' },
  { id: '0.9.0', commit: '3f48032c773a61611836e20f16c6d26c2d616244', title: 'Ground rupture & broad fire', summary: 'Irregular roots, separating ground, and a broader peat-fire illustration.', mode: 'animation', available: true, replay: 'study-scene', durationS: STUDY_DURATION, markersS: studyMarkers, alignmentGroup: 'cap-study', limitation: 'Preserved interactive animation; rupture and spread are authored.' },
  { id: '0.10.0', commit: 'ecc8daa557894b618c9fc1d18a2e6a37ce2a570d', title: 'Tensile coupon', summary: 'Energy-accounted peat tensile coupon and laboratory-data comparison.', mode: 'physics', available: false, replay: 'unavailable', durationS: null, markersS: [], alignmentGroup: null, limitation: 'No immutable replay bundle exists in the current app. Source history remains available at the tag.' },
  { id: '0.11.0', commit: '05d9c292476677068e9040f5843e70b8ec33ec32', title: 'Throughput verification', summary: 'Model-specific throughput and numerical status reporting.', mode: 'physics', available: false, replay: 'unavailable', durationS: null, markersS: [], alignmentGroup: null, limitation: 'No immutable replay bundle exists in the current app. Source history remains available at the tag.' },
  { id: '0.12.0', commit: '1ec0710c4addc39f8aa1c06cf2a6b06840862d38', title: 'Accepted checkpoint review', summary: 'Five preserved Blender frames, each held for half a second.', mode: 'animation', available: true, replay: 'film', durationS: 2.5, markersS: [0, .5, 1, 1.5, 2, 2.5], alignmentGroup: null, assetBase: 'history/v0.12', assetFile: 'accepted-checkpoint-review.mp4', limitation: 'Exact 2.5-second Blender review clip from v0.12; sampled checkpoints are not continuous motion or a live solver.' },
  { id: '0.13.0', commit: '6ac5b404eb2f87894704e91c876a7a05887528d2', title: 'Finer precision timesteps', summary: 'Finer numerical timesteps and expanded accepted evidence.', mode: 'physics', available: false, replay: 'unavailable', durationS: null, markersS: [], alignmentGroup: null, limitation: 'No immutable replay bundle exists in the current app. Source history remains available at the tag.' },
  { id: '0.14.0', commit: 'f97d28ac260164d4812483f9670957ec431dd2fb', title: 'Complete peat-fire films', summary: 'Versioned gradual and rapid complete-sequence rendered films.', mode: 'animation', available: true, replay: 'film', durationS: FIRE_SEQUENCE_DURATION, markersS: fireMarkers, alignmentGroup: 'fire-sequence', assetBase: 'history/v0.14', limitation: 'Exact archived film; it is an authored presentation and carries no live solver clock.' },
  { id: '0.15.0', commit: '223eda6f7a8e29291ebb5844fc2aa3f655f5d1cb', title: 'Verified complete bundle', summary: 'Verified complete films with accepted evidence bundled in the app.', mode: 'animation', available: true, replay: 'film', durationS: FIRE_SEQUENCE_DURATION, markersS: fireMarkers, alignmentGroup: 'fire-sequence', assetBase: 'renders', limitation: 'Exact archived film; it is an authored presentation and carries no live solver clock.' },
  { id: '0.16.0', commit: 'b9588aa', title: 'Contact cooling & deployable dome', summary: 'Finite contact cooling, woven hose, and deployable buried dome.', mode: 'animation', available: true, replay: 'fire-scene', durationS: FIRE_SEQUENCE_DURATION, markersS: fireMarkers, alignmentGroup: 'fire-sequence', limitation: 'Legacy interactive reconstruction using the archived authored motion. Final replacement films were not published.' },
  { id: '0.17.1', commit: 'cab4241007f15f1084318f3b4559580dbbdb965b', title: 'Unified interactive sequence', summary: 'Visible playback controls with the earlier illustrated bore and dome.', mode: 'animation', available: true, replay: 'fire-scene', durationS: FIRE_SEQUENCE_DURATION, markersS: fireMarkers, alignmentGroup: 'fire-sequence', limitation: 'Legacy authored scene retained for visual comparison; it does not represent a validated excavation or pressure event.' },
  { id: '0.18.0', commit: '4508016f19fb6e5a01b33b46e0054fb0b2045693', title: 'Underreamed cap study', summary: 'A straight bore with an expanding pocket and bounded cap flattening.', mode: 'animation', available: true, replay: 'fire-scene', durationS: FIRE_SEQUENCE_DURATION, markersS: fireMarkers, alignmentGroup: 'fire-sequence', limitation: 'Earlier illustrative reconstruction with the widening cutter; retained only for comparison.' },
  { id: '0.18.1', commit: 'ccb3fb3', title: 'Open excavation & backfill', summary: 'A fixed-width bucket digs an open pit; a concave cap is placed, buried, then flattens.', mode: 'animation', available: true, replay: 'fire-scene', durationS: FIRE_SEQUENCE_DURATION, markersS: fireMarkers, alignmentGroup: 'fire-sequence', limitation: 'Preserved historical illustration. Excavation stability, cap pressure, infiltration and suppression success are not validated.' },
] as const

export function parseSemver(version: string): [number, number, number] {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version)
  if (!match) throw new Error(`Invalid semantic version: ${version}`)
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
}

export function compareSemver(left: string, right: string): number {
  const a = parseSemver(left), b = parseSemver(right)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

export type SyncMethod = 'recorded-events' | 'duration-normalized'
export function alignedTime(reference: SimulationVersion, target: SimulationVersion, referenceTimeS: number): { timeS: number; method: SyncMethod } {
  if (!reference.durationS || !target.durationS) return { timeS: 0, method: 'duration-normalized' }
  const bounded = Math.max(0, Math.min(reference.durationS, referenceTimeS))
  if (reference.alignmentGroup && reference.alignmentGroup === target.alignmentGroup && reference.markersS.length === target.markersS.length && reference.markersS.length > 1) {
    let segment = reference.markersS.length - 2
    for (let i = 0; i < reference.markersS.length - 1; i++) if (bounded <= reference.markersS[i + 1]) { segment = i; break }
    const start = reference.markersS[segment], end = reference.markersS[segment + 1]
    const fraction = end === start ? 0 : (bounded - start) / (end - start)
    return { timeS: target.markersS[segment] + fraction * (target.markersS[segment + 1] - target.markersS[segment]), method: 'recorded-events' }
  }
  return { timeS: bounded / reference.durationS * target.durationS, method: 'duration-normalized' }
}

export function availableVersions() { return SIMULATION_CATALOG.filter(version => version.available).sort((a, b) => compareSemver(a.id, b.id)) }
