/** Canonical presentation clock. Staged geometry never feeds the numerical solver. */
export const FIRE_SEQUENCE_DURATION = 90
export type FireSourceMode = 'gradual' | 'rapid'
export type FireSequenceView = 'natural' | 'temperature' | 'oxygen' | 'co2'
export const FIRE_SEQUENCE_GEOMETRY = { sourceX: 0.4, sourceDepthM: 1.3, sourceInitialMassKg: 4, sourceDensityKgM3: 1560, boreRadiusM: 0.24, boreDepthM: 1.385, capRadiusM: 0.58, capFoldedRadiusM: 0.15, capRiseM: 0.16, capDepthM: 0.98, capInversionM: 0.32, capWedgeRadiusM: 0.69, capGapCenterRad: Math.PI / 4, capGapHalfAngleRad: 0.40, cavityRadiusM: 0.65, cavityCenterY: -0.95, cavityHalfHeightM: 0.28, pitDepthM: 1.30, pitBottomRadiusM: .66, pitTopRadiusM: .98, hoseRadiusM: 0.055, augerRadiusM: 0.20, domain: { widthM: 8, lengthM: 8, depthM: 3.2 } } as const
export const FIRE_SEQUENCE_STAGES = [
  { id: 'surface', start: 0, end: 10, title: 'A small surface fire', short: 'Ignition', description: 'A localized ignition starts the story above organic ground.', evidence: 'Flames are a visual cue. The field view shows the numerical temperature state.' },
  { id: 'underground', start: 10, end: 24, title: 'The fire moves underground', short: 'Subsurface spread', description: 'The story illustrates a buried peat fire. A moving underground front is not resolved by this calculation.', evidence: 'Underground spread is prescribed in the natural story. Accepted numerical fields show heating and oxidation without a resolved moving subsurface front.' },
  { id: 'drilling', start: 24, end: 37, title: 'Drill a straight bore', short: 'Straight bore', description: 'At 70% illustrated peat involvement, the tracked excavator turns a fixed-width auger into the peat.', evidence: 'Auger motion and the cylindrical bore are staged. Soil stability, root contact and excavation forces are not solved.' },
  { id: 'source', start: 37, end: 47, title: 'Lower the dry-ice sphere', short: 'Dry ice', description: 'The dry-ice sphere settles at the bottom of the straight bore.', evidence: 'Placement is authored. Natural-view source mass follows a separate finite contact-model inventory.' },
  { id: 'dome', start: 47, end: 55, title: 'Lower the fixed-size metal cap', short: 'Metal cap', description: 'A small metal cap drops into the original bore. Its width and profile stay fixed.', evidence: 'The cap is staged geometry. Fit, sealing and structural loading have not been validated.' },
  { id: 'treatment', start: 55, end: 69, title: 'Rapid gas release and peat fractures', short: 'Gas release', description: 'In rapid mode, the sphere vanishes into a depicted CO₂ release. A brief soil jolt sends fine fractures across the peat and dims nearby embers. The metal cap and bore keep their original size.', evidence: 'Gas conversion, oxygen displacement, fracture growth and visual quenching are authored. The contact ledger exports residual dry ice; pressure and field suppression are not calculated.' },
  { id: 'water', start: 69, end: 85, title: 'Water follows the fractures', short: 'Water stage', description: 'A woven hose enters through the cap gap. Water follows the illustrated fracture network, darkening peat and extinguishing the remaining depicted embers.', evidence: 'Wetting routes and visual ember extinction are authored. Local contact cooling has a separate finite budget; infiltration and field suppression are not predicted.' },
  { id: 'review', start: 85, end: 90, title: 'Inspect the illustrated outcome', short: 'Review', description: 'Compare the darkened peat and remaining accepted numerical field evidence.', evidence: 'Visual extinguishment is staged. It is not a validated treatment procedure or a prediction of extinguishment.' },
] as const
export function sequenceStage(time: number) { return FIRE_SEQUENCE_STAGES.find(stage => time >= stage.start && time < stage.end) ?? FIRE_SEQUENCE_STAGES[FIRE_SEQUENCE_STAGES.length - 1] }
export const phase = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)))
export const eased = (time: number, start: number, end: number) => { const p = phase(time, start, end); return p * p * (3 - 2 * p) }
/** Preserved v0.18.1 open-excavation replay. */
export function openPitDepthAt(time:number){return FIRE_SEQUENCE_GEOMETRY.pitDepthM*eased(time,24,34)*(1-eased(time,54,55))}
export function openPitRadiusAtY(y:number,depth:number){return FIRE_SEQUENCE_GEOMETRY.pitBottomRadiusM+(FIRE_SEQUENCE_GEOMETRY.pitTopRadiusM-FIRE_SEQUENCE_GEOMETRY.pitBottomRadiusM)*Math.max(0,Math.min(1,(y+depth)/Math.max(depth,1e-6)))}
export function fireSequencePose(time: number, mode: FireSourceMode) {
  const drillDown = eased(time, 24, 31), drillOut = eased(time, 34, 36.5)
  const drop = phase(time, 39, 44), gas = eased(time, 55, mode === 'rapid' ? 58 : 69), water = eased(time, 72, 90)
  return { drillVisible: illustratedPeatCoverage(time) >= .7 && time >= 24 && time < 36.8, drillY: 1.55 - 2.95 * drillDown * (1 - drillOut), drillDepth: Math.min(FIRE_SEQUENCE_GEOMETRY.boreDepthM, Math.max(0, 2.95 * drillDown - 1.55)), sourceY: 2.2 - 3.5 * drop * drop, sourceVisible: time >= 39, capY: 2.5 - (2.5 + FIRE_SEQUENCE_GEOMETRY.capDepthM) * eased(time, 48, 51.5), capDeployment: eased(time, 51.5, 54), underream: eased(time, 31, 33), cutterExtension: eased(time, 31, 33) * (1 - eased(time, 33, 34)), hoseInsertion: eased(time, 69, 72), capVisible: time >= 47, gas, water, bend: mode === 'rapid' ? FIRE_SEQUENCE_GEOMETRY.capInversionM * eased(time, 55, 55.65) : 0, crack: mode === 'rapid' ? eased(time, 55, 55.65) : 0, fire: eased(time, 0, 10), underground: eased(time, 10, 24) }
}


export type StoryPoint = [number, number, number]
/** Authored paths, shared by the live scene and Blender. Metres, [x, vertical y, z]. */
export const STORY_CRACK_PATHS: StoryPoint[][] = [
  [[.4,-1.28,.035],[.9,-1.4,.045],[1.25,-1.1,.04],[1.85,-1.32,.045],[2.48,-.82,.04],[3.1,-.68,.04]],
  [[.4,-1.28,.04],[.1,-1.64,.04],[-.5,-1.78,.04],[-1.02,-2.1,.04],[-1.9,-2.0,.04],[-2.75,-2.5,.04]],
  [[.4,-1.28,.04],[.78,-1.9,.04],[1.4,-2.08,.04],[1.7,-2.55,.04],[2.6,-2.8,.04]],
  [[.4,-1.28,.04],[-.15,-.84,.04],[-.82,-.63,.04],[-1.15,-.24,.04],[-1.65,-.04,.04]],
  [[.4,-1.28,.04],[1.25,-1.1,.04],[1.42,-.55,.04],[1.15,-.18,.04]],
  [[.4,-1.28,.04],[.1,-1.64,.04],[-.1,-2.16,.04],[-.66,-2.62,.04]],
]
/** Short visible fracture branches for the current constrained illustration. */
export const CONSTRAINED_CRACK_PATHS: StoryPoint[][] = [
  [[.515,-1.265,.115],[.78,-1.35,.08],[1.12,-1.52,.045]],
  [[.515,-1.265,.115],[.12,-1.42,.075],[-.38,-1.62,.045]],
  [[.515,-1.265,.115],[.52,-1.63,.08],[.72,-1.92,.045]],
]
/** Short contact fractures for the straight bore. One reaches the pale soil so onset is legible. */
export const SOURCE_CONTACT_CRACK_PATHS: StoryPoint[][] = [
  [[.55,-1.27,.12],[.82,-.98,.085],[1.04,-.66,.055],[1.18,-.38,.048]],
  [[.55,-1.27,.12],[.08,-1.14,.13],[-.29,-.86,.13],[-.72,-.49,.13]],
  [[.55,-1.27,.12],[.24,-1.68,.13],[-.11,-2.19,.13]],
]
/** Fine, branching rapid-release fractures on the visible peat cut face. Authored, not a failure solve. */
export const RAPID_PEAT_CRACK_PATHS: StoryPoint[][] = [
  [[.55,-1.28,.14],[.92,-1.14,.14],[1.32,-1.25,.14],[1.78,-1.12,.14],[2.20,-1.20,.14],[2.70,-1.08,.14],[3.16,-1.24,.14]],
  [[.55,-1.28,.14],[.91,-1.54,.14],[1.31,-1.50,.14],[1.76,-1.68,.14],[2.22,-1.58,.14],[2.66,-1.76,.14],[3.18,-1.66,.14]],
  [[.55,-1.28,.14],[.48,-1.65,.14],[.80,-1.89,.14],[1.12,-2.00,.14],[1.57,-2.12,.14],[1.93,-2.16,.14]],
  [[.55,-1.28,.14],[.12,-1.35,.14],[-.35,-1.30,.14],[-.77,-1.43,.14],[-1.24,-1.39,.14],[-1.72,-1.54,.14],[-2.22,-1.49,.14]],
  [[.55,-1.28,.14],[.15,-1.58,.14],[-.24,-1.74,.14],[-.64,-1.70,.14],[-1.01,-1.90,.14],[-1.42,-1.88,.14],[-1.86,-2.06,.14]],
  [[.55,-1.28,.14],[.18,-1.11,.14],[-.26,-1.00,.14],[-.68,-1.14,.14],[-1.10,-1.00,.14],[-1.57,-1.13,.14],[-2.05,-1.04,.14]],
  [[1.30,-1.25,.145],[1.52,-.95,.145],[1.85,-.83,.145],[2.23,-.92,.145],[2.56,-.86,.145]],
  [[1.76,-1.68,.145],[2.05,-1.91,.145],[2.40,-1.96,.145],[2.81,-1.89,.145]],
  [[-.77,-1.43,.145],[-1.02,-1.18,.145],[-1.36,-.98,.145],[-1.74,-.89,.145]],
  [[-.64,-1.70,.145],[-.88,-2.03,.145],[-1.14,-2.17,.145],[-1.49,-2.20,.145]],
  [[.80,-1.89,.145],[.64,-2.14,.145],[.33,-2.24,.145],[-.02,-2.18,.145]],
  [[2.22,-1.58,.145],[2.47,-1.37,.145],[2.88,-1.39,.145],[3.20,-1.49,.145]],
]
/** A sequential visual front: release first, branch tips next, water last. */
export function rapidFractureProgress(time:number,branch:number){return eased(time,55.06+branch*.07,58.25+branch*.10)}
export function rapidWettingProgress(time:number,branch:number){return eased(time,72+branch*.12,86+branch*.18)}
export function rapidGasQuench(time:number){return eased(time,55.15,57.1)}
export function rapidGasPulse(time:number){const age=time-55;if(age<=0)return 0;return (1-Math.exp(-16*age))*Math.exp(-1.12*age)}
/** A shallow concave panel gains projected radius as it flattens; no pressure is inferred. */
export function constrainedCapShape(time:number,mode:FireSourceMode) {
  const initialRadiusM=.49,initialDepthM=.22,flatten=mode==='rapid'?eased(time,55,58):0
  const slope=2*initialDepthM/initialRadiusM
  const meridianLengthM=initialRadiusM*(Math.sqrt(1+slope*slope)+Math.asinh(slope)/slope)/2
  return {radiusM:initialRadiusM+(meridianLengthM-initialRadiusM)*flatten,depthM:initialDepthM*(1-flatten),flatten,meridianLengthM,soilLiftM:.04*flatten}
}
export function constrainedSoilLiftAt(x:number,y:number,z:number,time:number,mode:FireSourceMode){
  const smooth=(a:number,b:number,v:number)=>{const q=Math.max(0,Math.min(1,(v-a)/(b-a)));return q*q*(3-2*q)}
  return constrainedCapShape(time,mode).soilLiftM*(1-smooth(.2,.9,Math.hypot(x-FIRE_SEQUENCE_GEOMETRY.sourceX,z)))*smooth(-1.16,-.25,y)
}
export function constrainedWettingProgress(time:number,branch:number){return eased(time,72+branch*.7,84)}
/** Current straight-bore scene: a constant-size cap fits within the original shaft. */
export function fixedBoreCapShape(){return {radiusM:FIRE_SEQUENCE_GEOMETRY.boreRadiusM*.91,depthM:.055}}
/** Prescribed fracture onset coincides with dry-ice contact at story second 44. */
export function sourceContactFracture(time:number){return eased(time,44,45.5)}
export const STORY_HOSE_POINTS: StoryPoint[] = [[-4.4,.15,-.8],[-3.5,.16,-.4],[-2.7,.16,-.72],[-1.9,.16,-.32],[-1.1,.16,-.50],[-.20,.19,-.12],[.34,.32,.10],[.51,.15,.11],[.49,-.3,.09],[.52,-.85,.12],[.515,-1.265,.115]]
export const STORY_WATER_START = 72
export function storyHosePoints(time: number): StoryPoint[] {
  const insertion = eased(time, 69, 72)
  return STORY_HOSE_POINTS.map(([x,y,z],index) => [x,index > 7 ? .10 + (y-.10) * Math.max(.002,insertion) : y,z])
}
export function storyCapShape(time: number, mode: FireSourceMode) {
  const pose=fireSequencePose(time,mode),damage=mode==='rapid'?eased(time,55,55.65):0
  return { rimY:pose.capY, radiusM:FIRE_SEQUENCE_GEOMETRY.capFoldedRadiusM+(FIRE_SEQUENCE_GEOMETRY.capRadiusM-FIRE_SEQUENCE_GEOMETRY.capFoldedRadiusM)*pose.capDeployment+.065*damage, riseM:FIRE_SEQUENCE_GEOMETRY.capRiseM, deployment:pose.capDeployment, inversionM:pose.bend, wedgeRadiusM:.58+.11*damage, damage }
}
/** Slow, branch-dependent prescribed arrival: no Darcy infiltration is calculated. */
export function storyWettingProgress(time: number, branch: number) { return .66 * Math.sqrt(Math.max(0, Math.min(1,(time-STORY_WATER_START-branch*.65)/18))) }
export function pointAlongStoryPath(points: StoryPoint[], fraction: number): StoryPoint {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j]))),total=lengths.reduce((a,b)=>a+b,0)
  let distance=Math.max(0,Math.min(1,fraction))*total
  for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const f=distance/lengths[i];return points[i].map((v,j)=>v+(points[i+1][j]-v)*f) as StoryPoint}distance-=lengths[i]}
  return points[0]
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
