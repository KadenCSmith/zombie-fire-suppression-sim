/** Display coordinates and authored seconds only. These are not equipment
 * dimensions, physical rates, pressure, cooling, or transport predictions. */
export const WORLD_STAGING = {
  arrive: 38, parked: 48, hoseStart: 48, hoseReady: 56,
  liftStart: 55, liftEnd: 59, iceStart: 59, iceEnd: 66,
  lidStart: 68.5, lidClosed: 71.3, boostStart: 71.5, boostEnd: 77.5, end: 90,
} as const
export const TRUCK_PARKED = [2.15, 0, -2.05] as const
export const MEDIA_MOUNT = [.4, 1.6, 0] as const
export const SOLID_COUNT = 9
/** Authored display timing, not a physical loading schedule. */
export const LOADING_CUE = { reachStart: 58.5, reachEnd: 60.5, tipEnd: 62.5, firstRelease: 62.3, fallDuration: .55, upright: 67, retract: 68.5, returned: 70 } as const
export const DELIVERY_ROUTE: readonly [number, number, number][] = [
  [3.11, 1.22, -1.65], [3.1, .45, -1.3], [2.45, .18, -1.22],
  [.95, .16, -.6], [.4, .23, -.15], [.4, -.1, .06], [.4, -1.3, .08],
]
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const ease = (time: number, start: number, end: number) => {
  const x = clamp((time - start) / (end - start))
  return x * x * (3 - 2 * x)
}

/** Stateless authored choreography. The integrated visual flow phase avoids
 * particle jumps when the display speed increases or the user seeks backward.
 * No value here is passed to the physical adapter or inventory ledger. */
export function preparationVisuals(timeS: number) {
  const time = Number.isFinite(timeS) ? Math.max(0, Math.min(WORLD_STAGING.end, timeS)) : 0
  const arrival = ease(time, WORLD_STAGING.arrive, WORLD_STAGING.parked)
  const boost = ease(time, WORLD_STAGING.boostStart, WORLD_STAGING.boostEnd)
  const q = clamp((time - WORLD_STAGING.boostStart) / (WORLD_STAGING.boostEnd - WORLD_STAGING.boostStart))
  const rampIntegral = (WORLD_STAGING.boostEnd - WORLD_STAGING.boostStart) * (q ** 3 - .5 * q ** 4) + Math.max(0, time - WORLD_STAGING.boostEnd)
  return {
    time,
    arrival,
    truckTravel: 6 * (1 - arrival),
    hose: ease(time, WORLD_STAGING.hoseStart, WORLD_STAGING.hoseReady),
    lift: ease(time, WORLD_STAGING.liftStart, WORLD_STAGING.liftEnd),
    loading: ease(time, WORLD_STAGING.iceStart, WORLD_STAGING.iceEnd),
    phaseChange: ease(time, LOADING_CUE.firstRelease + LOADING_CUE.fallDuration, 70),
    delivery: ease(time, WORLD_STAGING.hoseReady, 60),
    contact: ease(time, 60, 64),
    boost,
    lid: ease(time, WORLD_STAGING.lidStart, WORLD_STAGING.lidClosed),
    quench: ease(time, 72, 85),
    steam: Math.sin(Math.PI * ease(time, 60, 87)),
    flowTravel: .08 * Math.max(0, time - WORLD_STAGING.hoseReady) + .18 * rampIntegral,
    surfaceOffset: .006 * Math.sin(time * .8),
    solidScale: 1 - .16 * ease(time, 68, 84),
  }
}

function displayTime(time: number) {
  return Number.isFinite(time) ? Math.max(0, Math.min(WORLD_STAGING.end, time)) : 0
}

/** Lift beside the tank, traverse above its rim, tip, retract, then lower.
 * These coordinates belong to the illustration, not a device specification. */
export function loadingBucketPose(timeS: number) {
  const time = displayTime(timeS)
  const lift = ease(time, WORLD_STAGING.liftStart, LOADING_CUE.reachStart)
  const reach = ease(time, LOADING_CUE.reachStart, LOADING_CUE.reachEnd)
  const retract = ease(time, LOADING_CUE.upright, LOADING_CUE.retract)
  const lower = ease(time, LOADING_CUE.retract, LOADING_CUE.returned)
  return {
    position: [1.1 - .92 * reach * (1 - retract), -.22 + 1.65 * lift * (1 - lower), 0] as [number, number, number],
    tilt: 1.92 * ease(time, LOADING_CUE.reachEnd, LOADING_CUE.tipEnd) * (1 - ease(time, WORLD_STAGING.iceEnd, LOADING_CUE.upright)),
  }
}

export function bucketPoint(timeS: number, local: readonly [number, number, number]): [number, number, number] {
  const { position, tilt } = loadingBucketPose(timeS), c = Math.cos(tilt), s = Math.sin(tilt)
  return [position[0] + local[0] * c - local[1] * s, position[1] + local[0] * s + local[1] * c, position[2] + local[2]]
}

/** Solids stay inside the bucket until its opening faces downward, leave that
 * opening continuously, accelerate in air, then slow and settle in water.
 * No mass, momentum or sublimation balance is inferred from these poses. */
export function solidLoadingPose(timeS: number, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= SOLID_COUNT) throw new Error('Unknown illustrated solid.')
  const time = displayTime(timeS)
  const releaseS = LOADING_CUE.firstRelease + index * .3 + (index % 2) * .02
  const impactS = releaseS + LOADING_CUE.fallDuration
  const z = (Math.floor(index / 3) - 1) * .12
  const slot: [number, number, number] = [(index % 3 - 1) * .15, -.1 + (index % 2) * .045, z]
  const lip: [number, number, number] = [(index % 3 - 1) * .075, .24, z]
  const slide = ease(time, releaseS - .25, releaseS)
  const release = bucketPoint(releaseS, lip)
  const air = clamp((time - releaseS) / LOADING_CUE.fallDuration)
  const landing: [number, number, number] = [release[0] - .07, 0, release[2] + .025 * Math.sin(index)]
  const settle = ease(time, impactS, impactS + .85)
  const position: [number, number, number] = time < releaseS
    ? bucketPoint(time, slot.map((value, i) => value + (lip[i] - value) * slide) as [number, number, number])
    : time < impactS
      ? [release[0] - .07 * air, release[1] * (1 - air * air), release[2] + .025 * Math.sin(index) * air]
      : [landing[0], -(.37 + (index % 3) * .03) * settle, landing[2]]
  const carriedTilt = loadingBucketPose(Math.min(time, releaseS)).tilt
  const turn = air + settle * .2
  return {
    position, releaseS, impactS, landing,
    rotation: [index * .17 + turn * .7, index * .41 + turn * .3, carriedTilt + index * .13 + turn] as [number, number, number],
    scale: (.062 + (index % 3) * .006) * (1 - .38 * ease(time, impactS + 1, 85)),
    submerged: time >= impactS,
  }
}

export function solidCuePosition(timeS: number, index: number) {
  return solidLoadingPose(timeS, index).position
}
