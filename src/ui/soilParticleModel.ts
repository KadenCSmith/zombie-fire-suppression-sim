/** Assumed unit-thickness cross-section: bonded particles, incremental motion
 * about a supported state. This is not calibrated DEM/peridynamics or gas CFD. */
import { STUDY_GRAVITY, STUDY_RELEASE_TIME, STUDY_SOURCE, studyTime } from './studyModel'
export const SOIL_GRID = { nx: 49, ny: 25, left: -4, bottom: -3.2, width: 8, height: 3.2 }
export const WIDE_PEAT = { x: 0, y: -1.5, rx: 3.35, ry: 0.65 }
export const BURIED_PEAT = { x: 1.35, y: -1.65, rx: 1.2, ry: 0.5 }
export type SoilParticleOptions = { pressurePa: number; densityGradient: number; peatDensity: number }
export const SOIL_PARTICLE_DEFAULTS: SoilParticleOptions = { pressurePa: 18000, densityGradient: 220, peatDensity: 300 }
export function peatFraction(x: number, y: number, wide = false) {
  const peat = wide ? WIDE_PEAT : BURIED_PEAT
  return ((x - peat.x) / peat.rx) ** 2 + ((y - peat.y) / peat.ry) ** 2 <= 1
}
export function soilDensity(x: number, y: number, options = SOIL_PARTICLE_DEFAULTS, wide = false) {
  return peatFraction(x, y, wide) ? options.peatDensity : 1050 + Math.max(0, -y) * options.densityGradient
}
/** Prescribed lateral pressure footprint widens and moves upward; this is an input,
 * not an emergent fracture direction and not a conserved gas inventory. */
export function assumedPressure(x: number, y: number, age: number, peak: number, wide = false) {
  if (age <= 0) return 0
  const sx = wide ? 0.6 + Math.min(age, 4) * 1.35 : 0.35 + Math.min(age, 3) * 0.9
  const sy = wide ? 0.35 + Math.min(age, 4) * 0.22 : 0.2 + Math.min(age, 4) * 0.25
  const centerY = STUDY_SOURCE[1] + Math.min(age, 4) * (wide ? 0.37 : 0.24)
  const envelope = (1 - Math.exp(-age * 10)) * Math.exp(-age / (wide ? 4.5 : 2.4))
  return peak * envelope * Math.exp(-(((x - STUDY_SOURCE[0]) / sx) ** 2) - ((y - centerY) / sy) ** 2)
}
export function shellPlacement(time: number) {
  const start = 4.35, initial = 0.65, seat = -2.04
  return Math.max(seat, initial - 0.5 * STUDY_GRAVITY * Math.max(0, studyTime(time) - start) ** 2)
}
export function buildSoilReplay(options: SoilParticleOptions = SOIL_PARTICLE_DEFAULTS, wide = false) {
  if (!Number.isFinite(options.pressurePa) || options.pressurePa < 0 || options.pressurePa > 30000 || !Number.isFinite(options.densityGradient) || options.densityGradient < 0 || options.densityGradient > 350 || !Number.isFinite(options.peatDensity) || options.peatDensity < 150 || options.peatDensity > 600) throw new Error('Unsupported particle scenario inputs.')
  const { nx, ny, left, bottom, width, height } = SOIL_GRID, count = nx * ny
  const dx = width / (nx - 1), dy = height / (ny - 1), volume = dx * dy
  const rest = new Float32Array(count * 2), active = new Uint8Array(count), fixed = new Uint8Array(count), masses = new Float64Array(count)
  const displacements = new Float64Array(count * 2), velocity = new Float64Array(count * 2), forces = new Float64Array(count * 2)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = j * nx + i, x = left + i * dx, y = bottom + j * dy
    rest[n * 2] = x; rest[n * 2 + 1] = y
    active[n] = Math.abs(x - STUDY_SOURCE[0]) < 0.34 && y > -2.44 ? 0 : 1
    fixed[n] = j === 0 || i === 0 || i === nx - 1 ? 1 : 0
    masses[n] = soilDensity(x, y, options, wide) * volume
  }
  const bonds: { a: number; b: number; length: number; k: number; critical: number; breakTime: number }[] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * nx + i
    if (!active[a]) continue
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const ni = i + di, nj = j + dj
      if (ni < 0 || ni >= nx || nj >= ny) continue
      const b = nj * nx + ni
      if (!active[b]) continue
      const x = (rest[a * 2] + rest[b * 2]) / 2, y = (rest[a * 2 + 1] + rest[b * 2 + 1]) / 2
      const peat = peatFraction(x, y, wide), depth = Math.max(0, -y)
      // Assumed effective stiffness/stretch; depth strengthens confinement.
      // Weaker vertical bonds represent bedding that favors horizontal openings.
      bonds.push({ a, b, length: Math.hypot(di * dx, dj * dy), k: (peat ? 9000 : 45000) * (wide ? 0.65 : 1),
        critical: ((peat ? 0.009 : 0.014) + 0.003 * depth) * (wide ? 0.65 + 0.7 * ((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453 % 1 + 1) % 1) : di === 0 ? 0.6 : 1), breakTime: Infinity })
    }
  }
  const fps = 30, frameCount = 11 * fps + 1, substeps = 8, dt = 1 / (fps * substeps)
  const frames = new Float32Array(frameCount * count * 2), damage = new Float32Array(frameCount * count)
  const cap = new Float32Array(frameCount), energy = new Float64Array(frameCount)
  let capPosition = 0, capVelocity = 0
  for (let frame = 1; frame < frameCount; frame++) {
    for (let sub = 0; sub < substeps; sub++) {
      const age = ((frame - 1) * substeps + sub + 1) * dt
      forces.fill(0)
      for (let n = 0; n < count; n++) {
        if (!active[n] || fixed[n]) continue
        const x = rest[n * 2], y = rest[n * 2 + 1], epsilon = 0.01
        forces[n * 2] = -(assumedPressure(x + epsilon, y, age, options.pressurePa, wide) - assumedPressure(x - epsilon, y, age, options.pressurePa, wide)) / (2 * epsilon) * volume
        forces[n * 2 + 1] = -(assumedPressure(x, y + epsilon, age, options.pressurePa, wide) - assumedPressure(x, y - epsilon, age, options.pressurePa, wide)) / (2 * epsilon) * volume
        // Distributed elastic confinement to the surrounding out-of-plane soil.
        const confinement = wide ? 450 + 500 * Math.max(0, -y) : 4500 + 3000 * Math.max(0, -y)
        forces[n * 2] -= confinement * displacements[n * 2]
        forces[n * 2 + 1] -= confinement * displacements[n * 2 + 1]
      }
      for (const bond of bonds) {
        const ax = bond.a * 2, bx = bond.b * 2
        const rx = rest[bx] + displacements[bx] - rest[ax] - displacements[ax]
        const ry = rest[bx + 1] + displacements[bx + 1] - rest[ax + 1] - displacements[ax + 1]
        const length = Math.max(1e-8, Math.hypot(rx, ry)), extension = length - bond.length
        if (extension / bond.length > bond.critical && !Number.isFinite(bond.breakTime)) bond.breakTime = age
        // Broken bonds retain compression contact, never tensile attraction.
        const force = Number.isFinite(bond.breakTime) ? Math.min(0, extension) * bond.k : extension * bond.k
        const fx = force * rx / length, fy = force * ry / length
        forces[ax] += fx; forces[ax + 1] += fy; forces[bx] -= fx; forces[bx + 1] -= fy
      }
      for (let n = 0; n < count; n++) if (active[n] && !fixed[n]) {
        for (let axis = 0; axis < 2; axis++) {
          const k = n * 2 + axis
          velocity[k] = (velocity[k] + forces[k] / masses[n] * dt) * Math.exp(-5 * dt)
          displacements[k] += velocity[k] * dt
        }
      }
      // One deforming cap mode: assumed fixed rim, spring stiffness, damping and mass.
      const p = assumedPressure(STUDY_SOURCE[0], STUDY_SOURCE[1], age, options.pressurePa, wide)
      capVelocity += (p * Math.PI * 0.32 ** 2 - 42000 * capPosition - 180 * capVelocity) / 8 * dt
      capPosition += capVelocity * dt
    }
    frames.set(displacements, frame * count * 2); cap[frame] = capPosition
    const totals = new Uint8Array(count), broken = new Uint8Array(count)
    for (const bond of bonds) {
      totals[bond.a]++; totals[bond.b]++
      if (bond.breakTime <= frame / fps) { broken[bond.a]++; broken[bond.b]++ }
    }
    for (let n = 0; n < count; n++) {
      damage[frame * count + n] = totals[n] ? broken[n] / totals[n] : 0
      energy[frame] += 0.5 * masses[n] * (velocity[n * 2] ** 2 + velocity[n * 2 + 1] ** 2)
    }
  }
  return { rest, active, fixed, masses, bonds, count, fps, frameCount, frames, damage, cap, energy, options, wide }
}
export type SoilReplay = ReturnType<typeof buildSoilReplay>
export function soilFrame(replay: SoilReplay, time: number) {
  const age = Math.max(0, studyTime(time) - STUDY_RELEASE_TIME)
  const f = Math.min(replay.frameCount - 1, age * replay.fps), first = Math.floor(f)
  return { age, first, second: Math.min(first + 1, replay.frameCount - 1), mix: f - first }
}
export function sampleSoil(replay: SoilReplay, x: number, y: number, time: number): [number, number] {
  const { nx, ny, left, bottom, width, height } = SOIL_GRID
  const gx = Math.max(0, Math.min(nx - 1, (x - left) / width * (nx - 1))), gy = Math.max(0, Math.min(ny - 1, (y - bottom) / height * (ny - 1)))
  const i = Math.min(nx - 2, Math.floor(gx)), j = Math.min(ny - 2, Math.floor(gy)), tx = gx - i, ty = gy - j
  const frame = soilFrame(replay, time), result: [number, number] = [0, 0]
  for (const [di, dj, weight] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
    const n = (j + dj) * nx + i + di
    for (let a = 0; a < 2; a++) result[a] += weight * (replay.frames[(frame.first * replay.count + n) * 2 + a] * (1 - frame.mix) + replay.frames[(frame.second * replay.count + n) * 2 + a] * frame.mix)
  }
  return result
}
