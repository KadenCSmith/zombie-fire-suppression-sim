/** Reduced debris dynamics for Scene studio. Initial release velocities are assumed,
 * not computed by the gas/soil solver. All lengths, masses and time are SI. */
import { STUDY_DURATION, STUDY_FRAGMENTS, STUDY_GRAVITY, STUDY_RELEASE_TIME, STUDY_SOURCE, studyCageBars, studyTime, type StudyCage } from './studyModel'
export type Vec3 = [number, number, number]
export type DebrisState = { position: Vec3; velocity: Vec3; radius: number; density: number }
export type Bar = { start: Vec3; end: Vec3 }
export const DEBRIS_DEFAULTS = { gravity: STUDY_GRAVITY, airDensity: 1.2, dragCoefficient: 0.8, restitution: 0.22, friction: 0.6, density: 1800, launchSpeed: 2.8 }
export type DebrisOptions = typeof DEBRIS_DEFAULTS

/** Inelastic normal impulse + bounded Coulomb tangential impulse, per unit mass. */
export function contactVelocity(velocity: Vec3, normal: Vec3, restitution: number, friction: number): Vec3 {
  const inward = velocity.reduce((sum, v, i) => sum + v * normal[i], 0)
  if (inward >= 0) return [...velocity]
  const tangent = velocity.map((v, i) => v - inward * normal[i]) as Vec3
  const speed = Math.hypot(...tangent)
  const scale = speed > 0 ? Math.max(0, 1 - friction * (1 + restitution) * -inward / speed) : 0
  return tangent.map((v, i) => v * scale - restitution * inward * normal[i]) as Vec3
}

export function stepDebris(state: DebrisState, dt: number, floor: number, bars: Bar[], options: DebrisOptions = DEBRIS_DEFAULTS): DebrisState {
  const p = [...state.position] as Vec3, v = [...state.velocity] as Vec3
  // Quadratic drag: Cd rho_air A |v| v / (2m), with sphere mass and area.
  const drag = 3 * options.airDensity * options.dragCoefficient / (8 * state.density * state.radius)
  const damp = 1 / (1 + drag * Math.hypot(...v) * dt)
  for (let a = 0; a < 3; a++) v[a] *= damp
  v[1] -= options.gravity * dt
  for (let a = 0; a < 3; a++) p[a] += v[a] * dt
  const contact = (normal: Vec3) => {
    const result = contactVelocity(v, normal, options.restitution, options.friction)
    for (let a = 0; a < 3; a++) v[a] = result[a]
  }
  // Three projection passes handle adjacent cage bars/corners and the floor.
  for (let pass = 0; pass < 3; pass++) {
    if (p[1] < floor + state.radius) {
      p[1] = floor + state.radius
      contact([0, 1, 0])
      if (Math.abs(v[1]) < 2 * options.gravity * dt) v[1] = 0
    }
    for (const bar of bars) {
      const radius = state.radius + 0.006
      if (p.some((value, a) => value < Math.min(bar.start[a], bar.end[a]) - radius || value > Math.max(bar.start[a], bar.end[a]) + radius)) continue
      const d = bar.end.map((value, a) => value - bar.start[a]) as Vec3
      const length2 = d.reduce((sum, value) => sum + value * value, 0)
      const projection = Math.max(0, Math.min(1, p.reduce((sum, value, a) => sum + (value - bar.start[a]) * d[a], 0) / length2))
      const delta = p.map((value, a) => value - bar.start[a] - projection * d[a]) as Vec3
      const distance = Math.hypot(...delta)
      if (distance >= radius) continue
      // At an exact centerline choose a deterministic perpendicular direction.
      const normal: Vec3 = distance > 1e-10 ? delta.map(value => value / distance) as Vec3 : Math.abs(d[1]) > 0 ? [1, 0, 0] : [0, 1, 0]
      for (let a = 0; a < 3; a++) p[a] += normal[a] * (radius - distance)
      contact(normal)
    }
  }
  return { ...state, position: p, velocity: v }
}

export function buildDebrisReplay(cage: StudyCage, launchSpeed = DEBRIS_DEFAULTS.launchSpeed, hz = 240) {
  if (!Number.isFinite(launchSpeed) || launchSpeed < 0 || launchSpeed > 5 || !Number.isFinite(hz) || hz < 60 || hz > 1000) throw new Error('Invalid debris replay settings.')
  const count = STUDY_FRAGMENTS.length, dt = 1 / hz
  const frameCount = Math.ceil((STUDY_DURATION - STUDY_RELEASE_TIME) * hz) + 1
  const positions = new Float32Array(frameCount * count * 3)
  const bars: Bar[] = cage.enabled ? studyCageBars(cage.heightM, cage.widthM).map(bar => ({
    start: [bar.start[0] + STUDY_SOURCE[0], bar.start[1] + 0.035, bar.start[2]],
    end: [bar.end[0] + STUDY_SOURCE[0], bar.end[1] + 0.035, bar.end[2]],
  })) : []
  const states: DebrisState[] = STUDY_FRAGMENTS.map(seed => {
    const radius = seed.size * 0.7
    const direction: Vec3 = [seed.direction[0], seed.surface ? 1.1 : 0.55 + seed.direction[1] * 0.3, seed.direction[2]]
    const length = Math.hypot(...direction)
    return { position: [seed.position[0], seed.surface ? radius : seed.position[1], seed.position[2]], velocity: direction.map(v => v / length * launchSpeed) as Vec3, radius, density: DEBRIS_DEFAULTS.density }
  })
  for (let frame = 0; frame < frameCount; frame++) {
    for (let i = 0; i < count; i++) {
      if (frame) states[i] = stepDebris(states[i], dt, STUDY_FRAGMENTS[i].surface ? 0 : -3.16, bars)
      positions.set(states[i].position, (frame * count + i) * 3)
    }
  }
  return { positions, count, frameCount, hz }
}
export type DebrisReplay = ReturnType<typeof buildDebrisReplay>
export function debrisPose(replay: DebrisReplay, index: number, time: number): Vec3 {
  if (!Number.isInteger(index) || index < 0 || index >= replay.count) throw new Error('Unknown debris particle.')
  const frame = Math.min(replay.frameCount - 1, Math.max(0, studyTime(time) - STUDY_RELEASE_TIME) * replay.hz)
  const first = Math.floor(frame), second = Math.min(first + 1, replay.frameCount - 1), mix = frame - first
  return [0, 1, 2].map(axis => replay.positions[(first * replay.count + index) * 3 + axis] * (1 - mix) + replay.positions[(second * replay.count + index) * 3 + axis] * mix) as Vec3
}
