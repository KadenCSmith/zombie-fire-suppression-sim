/** Small-strain, three-displacement, eight-node brick mechanics benchmark.
 * Coordinates are x/y horizontal and z positive downward. Stress is tension positive.
 * The reference geostatic state is equilibrated before incremental loads are applied.
 */
export interface ContinuumMaterial {
  youngsPa: number
  poisson: number
  cohesionPa: number
  frictionSlope: number
  dilationSlope: number
  hardeningPa: number
}

export interface ContinuumResult {
  displacementM: Float64Array
  stressPa: Float64Array
  strain: Float64Array
  plasticStrain: Float64Array
  accumulatedPlasticStrain: Float64Array
  yielded: Uint8Array
  iterations: number
  residualN: number
  reactionN: [number, number, number]
  appliedForceN: [number, number, number]
  geostaticResidualN: number
  geostaticBaseReactionN: number
}

export const DEFAULT_CONTINUUM_MATERIAL: ContinuumMaterial = {
  youngsPa: 1_000_000, poisson: 0.3, cohesionPa: 8_000,
  frictionSlope: 0.35, dilationSlope: 0.05, hardeningPa: 20_000,
}

const NODE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] as const
const GAUSS = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)]
type Point = { B: Float64Array; weight: number; depthM: number }
type Element = { nodes: number[]; points: Point[]; stiffness: Float64Array }

function elasticMatrix(m: ContinuumMaterial): Float64Array {
  const D = new Float64Array(36)
  const lambda = m.youngsPa * m.poisson / ((1 + m.poisson) * (1 - 2 * m.poisson))
  const G = m.youngsPa / (2 * (1 + m.poisson))
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) D[i * 6 + j] = lambda + (i === j ? 2 * G : 0)
  for (let i = 3; i < 6; i++) D[i * 6 + i] = G
  return D
}

function stressFromStrain(D: Float64Array, strain: ArrayLike<number>): Float64Array {
  const stress = new Float64Array(6)
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) stress[i] += D[i * 6 + j] * strain[j]
  return stress
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/** Drucker-Prager shear cone with linear hardening. Engineering shear strain is used. */
export function returnMap(
  totalStrain: ArrayLike<number>, oldPlastic: ArrayLike<number>, oldHardening: number,
  m: ContinuumMaterial,
): { stress: Float64Array; plastic: Float64Array; hardening: number; yielded: boolean } {
  const D = elasticMatrix(m)
  const elastic = Float64Array.from(totalStrain, (v, i) => v - oldPlastic[i])
  const trial = stressFromStrain(D, elastic)
  const mean = (trial[0] + trial[1] + trial[2]) / 3
  const dev = Float64Array.from(trial)
  for (let i = 0; i < 3; i++) dev[i] -= mean
  const q = Math.sqrt(1.5 * (dev[0] ** 2 + dev[1] ** 2 + dev[2] ** 2 + 2 * (dev[3] ** 2 + dev[4] ** 2 + dev[5] ** 2)))
  const pressure = -mean
  const f = q - m.frictionSlope * pressure - m.cohesionPa - m.hardeningPa * oldHardening
  if (f <= 1e-9) return { stress: trial, plastic: Float64Array.from(oldPlastic), hardening: oldHardening, yielded: false }
  const G = m.youngsPa / (2 * (1 + m.poisson))
  const K = m.youngsPa / (3 * (1 - 2 * m.poisson))
  const gamma = f / (3 * G + m.frictionSlope * K * m.dilationSlope + m.hardeningPa)
  if (q < 1e-12 || gamma >= q / (3 * G)) throw new Error('Drucker-Prager cone apex or tensile state: outside supported mechanics regime.')
  const stress = new Float64Array(6)
  const plastic = Float64Array.from(oldPlastic)
  const factor = 1 - 3 * G * gamma / q
  for (let i = 0; i < 6; i++) {
    stress[i] = dev[i] * factor + (i < 3 ? mean - K * m.dilationSlope * gamma : 0)
    plastic[i] += gamma * (1.5 * dev[i] / q * (i < 3 ? 1 : 2) + (i < 3 ? m.dilationSlope / 3 : 0))
  }
  return { stress, plastic, hardening: oldHardening + gamma, yielded: true }
}

export class ContinuumMechanics {
  readonly nx: number; readonly ny: number; readonly nz: number
  readonly widthM: number; readonly lengthM: number; readonly depthM: number
  readonly material: ContinuumMaterial
  readonly nodeCount: number
  readonly elementCount: number
  readonly bulkDensityKgM3: number
  readonly geostaticResidualN: number
  readonly geostaticBaseReactionN: number
  readonly displacement: Float64Array
  private readonly elements: Element[] = []
  private readonly fixed: Uint8Array
  private readonly plastic: Float64Array
  private readonly hardening: Float64Array
  private readonly D: Float64Array

  constructor(nx: number, ny: number, nz: number, widthM: number, lengthM: number, depthM: number, material: ContinuumMaterial = DEFAULT_CONTINUUM_MATERIAL, bulkDensityKgM3 = 1200) {
    if (![nx, ny, nz].every(v => Number.isInteger(v) && v >= 1 && v <= 16)) throw new Error('Mechanics requires 1–16 elements on every axis.')
    if (![widthM, lengthM, depthM, material.youngsPa].every(v => Number.isFinite(v) && v > 0) || material.poisson <= -0.9 || material.poisson >= 0.49) throw new Error('Invalid mechanics dimensions or elastic material.')
    if ([material.cohesionPa, material.frictionSlope, material.dilationSlope, material.hardeningPa].some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid plastic material.')
    if (!Number.isFinite(bulkDensityKgM3) || bulkDensityKgM3 <= 0) throw new Error('Invalid soil bulk density.')
    this.nx = nx; this.ny = ny; this.nz = nz; this.widthM = widthM; this.lengthM = lengthM; this.depthM = depthM; this.material = { ...material }
    this.nodeCount = (nx + 1) * (ny + 1) * (nz + 1)
    this.elementCount = nx * ny * nz
    this.bulkDensityKgM3 = bulkDensityKgM3
    this.displacement = new Float64Array(this.nodeCount * 3)
    this.fixed = new Uint8Array(this.displacement.length)
    this.plastic = new Float64Array(this.elementCount * 8 * 6)
    this.hardening = new Float64Array(this.elementCount * 8)
    this.D = elasticMatrix(material)
    const dx = widthM / nx, dy = lengthM / ny, dz = depthM / nz
    for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      // Roller base: no vertical displacement; anchor two horizontal rigid modes.
      const node = this.node(i, j, k)
      if (k === nz) this.fixed[node * 3 + 2] = 1
      if (i === 0 && j === 0 && k === nz) { this.fixed[node * 3] = 1; this.fixed[node * 3 + 1] = 1 }
      if (i === nx && j === 0 && k === nz) this.fixed[node * 3 + 1] = 1
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const nodes = NODE.map(([a, b, c]) => this.node(i + a, j + b, k + c))
      const points: Point[] = []
      const stiffness = new Float64Array(24 * 24)
      for (const zeta of GAUSS) for (const eta of GAUSS) for (const xi of GAUSS) {
        const B = new Float64Array(6 * 24)
        for (let a = 0; a < 8; a++) {
          const sx = NODE[a][0] ? 1 : -1, sy = NODE[a][1] ? 1 : -1, sz = NODE[a][2] ? 1 : -1
          const gx = sx * (1 + sy * eta) * (1 + sz * zeta) / (4 * dx)
          const gy = sy * (1 + sx * xi) * (1 + sz * zeta) / (4 * dy)
          const gz = sz * (1 + sx * xi) * (1 + sy * eta) / (4 * dz)
          const c = a * 3
          B[c] = gx; B[24 + c + 1] = gy; B[48 + c + 2] = gz
          B[72 + c] = gy; B[72 + c + 1] = gx
          B[96 + c + 1] = gz; B[96 + c + 2] = gy
          B[120 + c] = gz; B[120 + c + 2] = gx
        }
        const weight = dx * dy * dz / 8
        points.push({ B, weight, depthM: k * dz + (1 + zeta) * dz / 2 })
        for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) {
          let kab = 0
          for (let r = 0; r < 6; r++) for (let s = 0; s < 6; s++) kab += B[r * 24 + a] * this.D[r * 6 + s] * B[s * 24 + b]
          stiffness[a * 24 + b] += weight * kab
        }
      }
      this.elements.push({ nodes, points, stiffness })
    }
    const gravity = new Float64Array(this.displacement.length)
    const referenceInternal = new Float64Array(this.displacement.length)
    for (const e of this.elements) {
      for (const node of e.nodes) gravity[node * 3 + 2] += bulkDensityKgM3 * 9.80665 * dx * dy * dz / 8
      for (const point of e.points) {
        const referenceVerticalStressPa = -bulkDensityKgM3 * 9.80665 * point.depthM
        for (let a = 0; a < 24; a++) referenceInternal[this.dof(e, a)] += point.B[2 * 24 + a] * referenceVerticalStressPa * point.weight
      }
    }
    let residual = 0, baseReaction = 0
    for (let i = 0; i < gravity.length; i++) {
      const balance = referenceInternal[i] - gravity[i]
      if (this.fixed[i]) baseReaction += i % 3 === 2 ? balance : 0
      else residual = Math.max(residual, Math.abs(balance))
    }
    this.geostaticResidualN = residual
    this.geostaticBaseReactionN = baseReaction
  }

  private node(i: number, j: number, k: number) { return (k * (this.ny + 1) + j) * (this.nx + 1) + i }
  private dof(element: Element, a: number) { return element.nodes[Math.floor(a / 3)] * 3 + a % 3 }

  private multiply(x: Float64Array): Float64Array {
    const y = new Float64Array(x.length)
    for (const e of this.elements) for (let a = 0; a < 24; a++) {
      const ga = this.dof(e, a)
      if (this.fixed[ga]) continue
      let v = 0
      for (let b = 0; b < 24; b++) if (!this.fixed[this.dof(e, b)]) v += e.stiffness[a * 24 + b] * x[this.dof(e, b)]
      y[ga] += v
    }
    return y
  }

  private linearSolve(rhs: Float64Array, toleranceN: number): Float64Array {
    const x = new Float64Array(rhs.length), r = Float64Array.from(rhs), p = Float64Array.from(r)
    for (let i = 0; i < r.length; i++) if (this.fixed[i]) r[i] = p[i] = 0
    let rr = dot(r, r)
    if (Math.sqrt(rr) <= toleranceN) return x
    for (let n = 0; n < rhs.length * 3; n++) {
      const Ap = this.multiply(p), denom = dot(p, Ap)
      if (denom <= 0) throw new Error('Mechanics stiffness is not positive definite.')
      const alpha = rr / denom
      for (let i = 0; i < rhs.length; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i] }
      const next = dot(r, r)
      if (Math.sqrt(next) <= toleranceN) return x
      const beta = next / rr
      for (let i = 0; i < p.length; i++) p[i] = r[i] + beta * p[i]
      rr = next
    }
    throw new Error('Mechanics linear solve did not converge.')
  }

  private state(u: Float64Array, commit: boolean) {
    const internal = new Float64Array(u.length)
    const stress = new Float64Array(this.elementCount * 6)
    const strain = new Float64Array(this.elementCount * 6)
    const yielded = new Uint8Array(this.elementCount)
    let ep = 0
    for (let eId = 0; eId < this.elements.length; eId++) {
      const e = this.elements[eId]
      for (let gp = 0; gp < 8; gp++) {
        const { B, weight } = e.points[gp]
        const eps = new Float64Array(6)
        for (let a = 0; a < 6; a++) for (let b = 0; b < 24; b++) eps[a] += B[a * 24 + b] * u[this.dof(e, b)]
        const offset = (eId * 8 + gp) * 6
        const mapped = returnMap(eps, this.plastic.subarray(offset, offset + 6), this.hardening[eId * 8 + gp], this.material)
        if (commit) { this.plastic.set(mapped.plastic, offset); this.hardening[eId * 8 + gp] = mapped.hardening }
        if (mapped.yielded || this.hardening[eId * 8 + gp] > 0) yielded[eId] = 1
        ep += mapped.hardening
        for (let a = 0; a < 6; a++) { stress[eId * 6 + a] += mapped.stress[a] / 8; strain[eId * 6 + a] += eps[a] / 8 }
        for (let a = 0; a < 24; a++) for (let b = 0; b < 6; b++) internal[this.dof(e, a)] += B[b * 24 + a] * mapped.stress[b] * weight
      }
    }
    return { internal, stress, strain, yielded, ep }
  }

  /** Apply a prescribed uniform vertical traction on the free top, positive downward. */
  solveTopTraction(tractionPa: number, toleranceN = 0.05): ContinuumResult {
    if (!Number.isFinite(tractionPa)) throw new Error('Invalid top traction.')
    const force = new Float64Array(this.displacement.length)
    const areaPerElement = this.widthM / this.nx * this.lengthM / this.ny
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) {
      force[this.node(a, b, 0) * 3 + 2] += tractionPa * areaPerElement / 4
    }
    // Reference gravity stress is an initially equilibrated state; force is its perturbation.
    let u = Float64Array.from(this.displacement), state = this.state(u, false), iterations = 0
    const scale = Math.max(1, Math.sqrt(dot(force, force)))
    for (; iterations < 200; iterations++) {
      const residual = Float64Array.from(force, (v, i) => this.fixed[i] ? 0 : v - state.internal[i])
      const norm = Math.sqrt(dot(residual, residual))
      if (norm <= Math.max(toleranceN, 1e-7 * scale)) break
      const correction = this.linearSolve(residual, Math.max(1e-8, norm * 1e-9))
      let accepted = false
      for (let factor = 16; factor >= 1 / 1024; factor /= 2) {
        const candidate = Float64Array.from(u, (v, i) => v + factor * correction[i])
        try {
          const next = this.state(candidate, false)
          const nextResidual = Float64Array.from(force, (v, i) => this.fixed[i] ? 0 : v - next.internal[i])
          if (Math.sqrt(dot(nextResidual, nextResidual)) < norm) { u = candidate; state = next; accepted = true; break }
        } catch { /* Smaller step may remain in the supported cone branch. */ }
      }
      if (!accepted) throw new Error('Mechanics nonlinear solve did not reduce force residual.')
    }
    if (iterations === 200) {
      const remainder = Float64Array.from(force, (v, i) => this.fixed[i] ? 0 : v - state.internal[i])
      throw new Error(`Mechanics nonlinear solve did not converge: residual ${Math.sqrt(dot(remainder, remainder))} N.`)
    }
    this.displacement.set(u)
    state = this.state(u, true)
    const reaction: [number, number, number] = [0, 0, 0], applied: [number, number, number] = [0, 0, 0]
    let residualN = 0
    for (let i = 0; i < force.length; i++) {
      const axis = i % 3
      applied[axis] += force[i]
      if (this.fixed[i]) reaction[axis] += state.internal[i] - force[i]
      else residualN = Math.max(residualN, Math.abs(state.internal[i] - force[i]))
    }
    return { displacementM: Float64Array.from(u), stressPa: state.stress, strain: state.strain,
      plasticStrain: Float64Array.from(this.plastic), accumulatedPlasticStrain: Float64Array.from(this.hardening), yielded: state.yielded,
      iterations, residualN, reactionN: reaction, appliedForceN: applied,
      geostaticResidualN: this.geostaticResidualN, geostaticBaseReactionN: this.geostaticBaseReactionN }
  }

  checkpoint() { return { schemaVersion: 1 as const, nx: this.nx, ny: this.ny, nz: this.nz,
    displacementM: Array.from(this.displacement), plasticStrain: Array.from(this.plastic), hardening: Array.from(this.hardening) } }

  restore(data: ReturnType<ContinuumMechanics['checkpoint']>) {
    if (data.schemaVersion !== 1 || data.nx !== this.nx || data.ny !== this.ny || data.nz !== this.nz ||
      data.displacementM.length !== this.displacement.length || data.plasticStrain.length !== this.plastic.length || data.hardening.length !== this.hardening.length ||
      [...data.displacementM, ...data.plasticStrain, ...data.hardening].some(v => !Number.isFinite(v))) throw new Error('Invalid mechanics checkpoint.')
    this.displacement.set(data.displacementM); this.plastic.set(data.plasticStrain); this.hardening.set(data.hardening)
  }
}
