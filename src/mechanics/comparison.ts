import { ContinuumMechanics, DEFAULT_CONTINUUM_MATERIAL, type ContinuumMaterial, type ContinuumResult } from './continuum'

export type MechanicsLaw = 'elastic' | 'drucker-prager'
export type MechanicsField = 'displacement' | 'stress' | 'plastic' | 'mesh'
export interface BenchmarkInputs {
  tractionPa: number
  material: ContinuumMaterial
  resolution: number
  increments: number
}
export interface BenchmarkFrame {
  stage: number
  loadFraction: number
  tractionPa: number
  result: ContinuumResult
}
export interface BenchmarkRun {
  law: MechanicsLaw
  inputs: BenchmarkInputs
  frames: BenchmarkFrame[]
  status: 'complete' | 'limited' | 'failed'
  message: string
  setupMs: number
  solveMs: number
}
export const BENCHMARK_SIZE = { widthM: 2, lengthM: 2, depthM: 1, densityKgM3: 1200 }
export const SMALL_STRAIN_LIMIT = 0.02
export const DEFAULT_BENCHMARK: BenchmarkInputs = {
  tractionPa: 9200, material: { ...DEFAULT_CONTINUUM_MATERIAL }, resolution: 2, increments: 10,
}
export const MECHANICS_FIELDS: Record<MechanicsField, { label: string; unit: string }> = {
  displacement: { label: 'Displacement magnitude', unit: 'mm' },
  stress: { label: 'Vertical incremental stress', unit: 'kPa · tension +' },
  plastic: { label: 'Accumulated plastic strain', unit: '1' },
  mesh: { label: 'Element inspection', unit: 'element ID' },
}

export function validateBenchmark(inputs: BenchmarkInputs) {
  if (!Number.isFinite(inputs.tractionPa) || inputs.tractionPa < 0 || inputs.tractionPa > 20000) throw new Error('Top traction must be 0–20000 Pa.')
  if (![1, 2, 4].includes(inputs.resolution)) throw new Error('Choose 1, 2 or 4 elements per axis.')
  if (!Number.isInteger(inputs.increments) || inputs.increments < 5 || inputs.increments > 40) throw new Error('Use 5–40 increments per loading leg.')
  const m = inputs.material
  if (!Number.isFinite(m.youngsPa) || m.youngsPa < 500000 || m.youngsPa > 10000000) throw new Error('Young’s modulus must be 0.5–10 MPa.')
  if (!Number.isFinite(m.poisson) || m.poisson < 0 || m.poisson > 0.45) throw new Error('Poisson ratio must be 0–0.45.')
  if (!Number.isFinite(m.cohesionPa) || m.cohesionPa < 1000 || m.cohesionPa > 20000) throw new Error('Yield intercept must be 1–20 kPa.')
  if (!Number.isFinite(m.frictionSlope) || m.frictionSlope < 0 || m.frictionSlope > 1 || !Number.isFinite(m.dilationSlope) || m.dilationSlope < 0 || m.dilationSlope > m.frictionSlope) throw new Error('Use 0 ≤ dilation slope ≤ friction slope ≤ 1.')
  if (!Number.isFinite(m.hardeningPa) || m.hardeningPa < 10000 || m.hardeningPa > 200000) throw new Error('Hardening modulus must be 10–200 kPa.')
}

/** Both laws receive identical geometry, inputs, supports and monotonic load/unload schedule.
 * Stages are equilibria, not dynamic seconds. Rewind only selects a stored equilibrium.
 */
export function runMechanicsBenchmark(inputs: BenchmarkInputs, law: MechanicsLaw, onFrame?: (frame: BenchmarkFrame) => void): BenchmarkRun {
  validateBenchmark(inputs)
  if (law !== 'elastic' && law !== 'drucker-prager') throw new Error('Unknown benchmark law.')
  const start = performance.now()
  const { widthM, lengthM, depthM, densityKgM3 } = BENCHMARK_SIZE
  const n = inputs.resolution
  const model = new ContinuumMechanics(n, n, n, widthM, lengthM, depthM, { ...inputs.material, constitutiveLaw: law }, densityKgM3)
  const run: BenchmarkRun = { law, inputs: structuredClone(inputs), frames: [], status: 'complete', message: 'Equilibrium sequence complete', setupMs: performance.now() - start, solveMs: 0 }
  const solveStart = performance.now()
  for (let stage = 0; stage <= 2 * inputs.increments; stage++) {
    const loadFraction = stage <= inputs.increments ? stage / inputs.increments : 2 - stage / inputs.increments
    try {
      const result = model.solveTopTraction(inputs.tractionPa * loadFraction, 0.0001, 1e-10)
      // Guard the infinitesimal-strain formulation using principal total strains,
      // including engineering shear components; this is not a measured failure limit.
      if (maxPrincipalStrain(result.strain) > SMALL_STRAIN_LIMIT) {
        run.status = 'limited'; run.message = 'Stopped before a principal strain exceeded 2%. Reduce load or increase stiffness; this solver assumes small deformation.'; break
      }
      const frame = { stage, loadFraction, tractionPa: inputs.tractionPa * loadFraction, result }
      run.frames.push(frame)
      onFrame?.(frame)
    } catch (error) {
      run.status = 'failed'; run.message = error instanceof Error ? error.message : String(error); break
    }
  }
  run.solveMs = performance.now() - solveStart
  return run
}

/** Spectral radius of symmetric strain tensor by closed-form eigenvalues. */
export function maxPrincipalStrain(values: ArrayLike<number>): number {
  let maximum = 0
  for (let q = 0; q < values.length; q += 6) {
    const a = values[q], b = values[q + 1], c = values[q + 2]
    const d = values[q + 3] / 2, e = values[q + 4] / 2, f = values[q + 5] / 2
    const mean = (a + b + c) / 3
    const p = Math.sqrt(((a - mean) ** 2 + (b - mean) ** 2 + (c - mean) ** 2 + 2 * (d*d + e*e + f*f)) / 6)
    if (p < 1e-16) { maximum = Math.max(maximum, Math.abs(mean)); continue }
    const x = (a - mean) / p, y = (b - mean) / p, z = (c - mean) / p
    const det = x*y*z + 2*d*e*f / p**3 - x*(e/p)**2 - y*(f/p)**2 - z*(d/p)**2
    const angle = Math.acos(Math.max(-1, Math.min(1, det / 2))) / 3
    maximum = Math.max(maximum, Math.abs(mean + 2*p*Math.cos(angle)), Math.abs(mean + 2*p*Math.cos(angle + 2*Math.PI/3)))
  }
  return maximum
}

export function fieldValues(frame: BenchmarkFrame, field: MechanicsField, resolution: number): Float64Array {
  const n = resolution, result = frame.result
  return Float64Array.from({ length: n**3 }, (_, element) => {
    if (field === 'stress') return result.stressPa[element*6 + 2] / 1000
    if (field === 'plastic') {
      let sum = 0
      for (let gp = 0; gp < 8; gp++) sum += result.accumulatedPlasticStrain[element*8 + gp]
      return sum / 8
    }
    if (field === 'mesh') return element + 1
    const i = element % n, j = Math.floor(element/n) % n, k = Math.floor(element/n**2)
    let sum = 0
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const q = (((k+z)*(n+1) + j+y)*(n+1) + i+x)*3
      sum += Math.hypot(result.displacementM[q], result.displacementM[q+1], result.displacementM[q+2]) * 1000
    }
    return sum/8
  })
}

export function peakDisplacement(result: ContinuumResult): number {
  let peak = 0
  for (let q = 0; q < result.displacementM.length; q += 3) peak = Math.max(peak, Math.hypot(result.displacementM[q], result.displacementM[q+1], result.displacementM[q+2]))
  return peak
}
