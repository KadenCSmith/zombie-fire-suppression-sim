/** Display coordinates and authored seconds only. These are not equipment
 * dimensions, physical rates, pressure, cooling, or transport predictions. */
export const WORLD_STAGING = {
  arrive: 38, parked: 48, hoseStart: 48, hoseReady: 56,
  liftStart: 55, liftEnd: 59, iceStart: 59, iceEnd: 66,
  boostStart: 64, boostEnd: 72, end: 90,
} as const
export const TRUCK_PARKED = [2.15, 0, -2.05] as const
export const MEDIA_MOUNT = [.4, 1.6, 0] as const
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
  const rampIntegral = 8 * (q ** 3 - .5 * q ** 4) + Math.max(0, time - WORLD_STAGING.boostEnd)
  return {
    time,
    arrival,
    truckTravel: 6 * (1 - arrival),
    hose: ease(time, WORLD_STAGING.hoseStart, WORLD_STAGING.hoseReady),
    lift: ease(time, WORLD_STAGING.liftStart, WORLD_STAGING.liftEnd),
    loading: ease(time, WORLD_STAGING.iceStart, WORLD_STAGING.iceEnd),
    phaseChange: ease(time, WORLD_STAGING.boostStart, 70),
    delivery: ease(time, WORLD_STAGING.hoseReady, 60),
    contact: ease(time, 60, 64),
    boost,
    quench: ease(time, 68, 85),
    steam: Math.sin(Math.PI * ease(time, 60, 87)),
    flowTravel: .08 * Math.max(0, time - WORLD_STAGING.hoseReady) + .18 * rampIntegral,
    surfaceOffset: .006 * Math.sin(time * .8),
    solidScale: 1 - .16 * ease(time, 68, 84),
  }
}

/** Individual dry-ice chunks leave a lifted tray and enter the water. */
export function solidCuePosition(timeS: number, index: number) {
  const v = preparationVisuals(timeS)
  const q = clamp((v.loading - index * .025) / .8)
  const angle = index * 2.39996, radius = .12 + (index % 3) * .14
  const startY = -.3 + v.lift * 1.48 + (index % 3) * .09
  const endY = -.09 - (index % 3) * .065
  return [
    .88 * (1 - q) + Math.cos(angle) * radius * q,
    startY * (1 - q) + endY * q + .16 * Math.sin(q * Math.PI),
    Math.sin(angle) * (.12 * (1 - q) + radius * q),
  ] as [number, number, number]
}
