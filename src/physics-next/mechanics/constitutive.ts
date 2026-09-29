import { finiteStrainKinematics } from './finiteStrain'
import type { TotalLagrangianPoint } from './finiteStrain'

/**
 * Uncalibrated orthotropic generalized-Maxwell peat surrogate in a fixed material
 * frame, using Green strain/PK2 and an objective PK1 push-forward.
 * Solid effective stress is tension-positive. Pore pressure is NOT applied here:
 * sigmaEffective = sigmaTotal + alpha*pB*I, handled by the outer assembly.
 * Valid only inside explicit moderate-strain/temperature/saturation/stress bounds.
 */
export interface MaxwellBranch {
  readonly stiffnessPa: Float64Array
  readonly relaxationTimeS: number
}
export interface PeatProvenance {
  readonly parameterSetId: string
  readonly calibrationStatus: 'uncalibrated' | 'candidate-fit'
  readonly equilibriumSource: string
  readonly branchSources: readonly string[]
  readonly materialFrameSource: string
  readonly applicabilitySource: string
}
export interface PeatParameters {
  /** Symmetric positive-definite 6x6 maps engineering Green strain to PK2, Pa. */
  readonly equilibriumStiffnessPa: Float64Array
  readonly branches: readonly MaxwellBranch[]
  /** Proper orthonormal COLUMNS: fixed material axes in the reference coordinates. */
  readonly materialFrame: Float64Array
  readonly maxGreenEngineeringNorm: number
  readonly maxAbsPK2Pa: number
  readonly temperatureRangeK: readonly [number, number]
  readonly liquidSaturationRange: readonly [number, number]
  readonly provenance: Readonly<PeatProvenance>
}
export interface PeatHistory {
  readonly schemaVersion: 1
  readonly parameterSignature: string
  readonly materialEngineeringStrain: Float64Array
  /** Branch-major, six engineering components per branch in the MATERIAL frame. */
  readonly viscousEngineeringStrain: Float64Array
  readonly accumulatedDissipationJm3: number
}
export interface PeatTrial {
  readonly deformationGradient: Float64Array
  readonly previous: Readonly<PeatHistory>
  readonly dtS: number
  readonly temperatureK: number
  readonly liquidSaturation: number
  readonly parameters: Readonly<PeatParameters>
}
export interface PeatResponse extends TotalLagrangianPoint {
  readonly next: PeatHistory
  readonly materialPK2Pa: Float64Array
  readonly effectiveCauchyPa: Float64Array
  readonly algorithmicStiffnessPa: Float64Array
  readonly physicalDissipationJm3: number
  readonly algorithmicDissipationJm3: number
  readonly backwardEulerWorkJm3: number
  readonly workBalanceResidualJm3: number
  /** BE incremental potential whose derivative is algorithmic PK1, not stored energy. */
  readonly incrementalPotentialJm3: number
}
const PAIRS = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 2], [0, 2]] as const
function finite(x: number, name: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${name} must be finite`)
  return x
}
function vector(x: Float64Array, n: number, name: string): void {
  if (!(x instanceof Float64Array)) throw new TypeError(`${name} must be Float64Array`)
  if (x.length !== n) throw new RangeError(`${name} length must be ${n}`)
  for (const v of x) finite(v, name)
}
function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return finite(sum, 'inner product')
}
function apply(c: Float64Array, e: Float64Array): Float64Array {
  const s = new Float64Array(6)
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) s[i] += c[6 * i + j] * e[j]
  vector(s, 6, 'constitutive stress')
  return s
}
function difference(a: Float64Array, b: Float64Array): Float64Array {
  return Float64Array.from(a, (v, i) => finite(v - b[i], 'strain difference'))
}
function checkStiffness(c: Float64Array, name: string): void {
  vector(c, 36, name)
  const scale = Math.max(...c.map(Math.abs))
  if (!(scale > 0)) throw new RangeError(`${name} must be positive definite`)
  const l = new Float64Array(36)
  for (let i = 0; i < 6; i++) for (let j = 0; j <= i; j++) {
    if (Math.abs(c[6 * i + j] - c[6 * j + i]) > 1e-12 * scale) throw new RangeError(`${name} must be symmetric`)
    let value = c[6 * i + j]
    for (let k = 0; k < j; k++) value -= l[6 * i + k] * l[6 * j + k]
    if (i === j) {
      if (!(value > 1e-12 * scale)) throw new RangeError(`${name} fails SPD/pivot bound`)
      l[6 * i + j] = Math.sqrt(value)
    } else l[6 * i + j] = finite(value / l[6 * j + j], 'Cholesky factor')
  }
}
function checkFrame(r: Float64Array): void {
  vector(r, 9, 'materialFrame')
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let v = 0
    for (let k = 0; k < 3; k++) v += r[3 * k + i] * r[3 * k + j]
    if (Math.abs(v - (i === j ? 1 : 0)) > 1e-10) throw new RangeError('materialFrame must be orthonormal')
  }
  const det = r[0] * (r[4] * r[8] - r[5] * r[7])
    - r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6])
  if (Math.abs(det - 1) > 1e-10) throw new RangeError('materialFrame must be right-handed')
}
function validateParameters(p: Readonly<PeatParameters>): string {
  checkStiffness(p.equilibriumStiffnessPa, 'equilibriumStiffnessPa'); checkFrame(p.materialFrame)
  if (!Array.isArray(p.branches) || p.branches.length > 16) throw new RangeError('at most 16 Maxwell branches')
  for (const branch of p.branches) {
    checkStiffness(branch.stiffnessPa, 'branch.stiffnessPa')
    if (!(finite(branch.relaxationTimeS, 'relaxationTimeS') > 0)) throw new RangeError('positive relaxationTimeS required')
  }
  if (!(finite(p.maxGreenEngineeringNorm, 'maxGreenEngineeringNorm') > 0 && p.maxGreenEngineeringNorm <= 0.25)) {
    throw new RangeError('moderate-strain guard must be in (0,0.25]')
  }
  if (!(finite(p.maxAbsPK2Pa, 'maxAbsPK2Pa') > 0)) throw new RangeError('positive maxAbsPK2Pa required')
  if (p.temperatureRangeK.length !== 2 || p.liquidSaturationRange.length !== 2) throw new RangeError('range lengths must be two')
  const [t0, t1] = p.temperatureRangeK, [s0, s1] = p.liquidSaturationRange
  for (const v of [t0, t1, s0, s1]) finite(v, 'applicability range')
  if (!(t0 > 0 && t1 >= t0 && s0 >= 0 && s1 <= 1 && s1 >= s0)) throw new RangeError('invalid applicability range')
  const provenance = p.provenance
  for (const key of ['parameterSetId', 'equilibriumSource', 'materialFrameSource', 'applicabilitySource'] as const) {
    if (typeof provenance[key] !== 'string' || provenance[key].trim().length === 0) throw new RangeError(`missing provenance.${key}`)
  }
  if (!['uncalibrated', 'candidate-fit'].includes(provenance.calibrationStatus)) throw new RangeError('unsupported calibration status')
  if (!Array.isArray(provenance.branchSources) || provenance.branchSources.length !== p.branches.length ||
      provenance.branchSources.some(v => typeof v !== 'string' || !v.trim())) throw new RangeError('branch provenance mismatch')
  // Exact signature rejects silent coefficient/frame changes across committed histories.
  return JSON.stringify({
    schema: 1, id: provenance.parameterSetId, frame: [...p.materialFrame],
    equilibrium: [...p.equilibriumStiffnessPa],
    branches: p.branches.map(b => ({ c: [...b.stiffnessPa], tau: b.relaxationTimeS })),
    maxStrain: p.maxGreenEngineeringNorm, maxStress: p.maxAbsPK2Pa,
    temperature: [...p.temperatureRangeK], saturation: [...p.liquidSaturationRange],
  })
}
function tensorFromVector(v: Float64Array, engineering: boolean): Float64Array {
  const t = new Float64Array(9)
  for (let c = 0; c < 6; c++) {
    const [i, j] = PAIRS[c], value = v[c] * (engineering && c >= 3 ? 0.5 : 1)
    t[3 * i + j] = value; t[3 * j + i] = value
  }
  return t
}
function toMaterialEngineering(t: Float64Array, r: Float64Array): Float64Array {
  const e = new Float64Array(6)
  for (let c = 0; c < 6; c++) {
    const [i, j] = PAIRS[c]
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      e[c] += r[3 * a + i] * t[3 * a + b] * r[3 * b + j]
    }
    if (c >= 3) e[c] *= 2
  }
  return e
}
function toReferenceTensor(stress: Float64Array, r: Float64Array): Float64Array {
  const local = tensorFromVector(stress, false), out = new Float64Array(9)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    out[3 * i + j] += r[3 * i + a] * local[3 * a + b] * r[3 * j + b]
  }
  return out
}
function nonnegative(x: number, scale: number, name: string): number {
  finite(x, name)
  if (x < -128 * Number.EPSILON * Math.max(1, scale)) throw new RangeError(`negative ${name}`)
  return Math.max(0, x)
}

/** Creates independent stress-free history in the fixed material frame.
 * Effective solid stresses tension-positive; no fluid-pressure correction.
 */
export function initialPeatHistory(parameters: Readonly<PeatParameters>): PeatHistory {
  const signature = validateParameters(parameters)
  return {
    schemaVersion: 1, parameterSignature: signature,
    materialEngineeringStrain: new Float64Array(6),
    viscousEngineeringStrain: new Float64Array(6 * parameters.branches.length),
    accumulatedDissipationJm3: 0,
  }
}

/** Effective stress is tension-positive (PK2 -> PK1 -> Cauchy), with no alpha*pB shift.
 * Backward-Euler Maxwell update from a committed state; returns new arrays only.
 * Temperature and saturation are applicability gates, NOT an expansion/softening law.
 * dt=0 is an instantaneous elastic trial; negative dt is rejected.
 */
export function evaluatePeatConstitutive(input: PeatTrial): PeatResponse {
  const p = input.parameters, signature = validateParameters(p), old = input.previous
  const dt = finite(input.dtS, 'dtS')
  if (dt < 0) throw new RangeError('dtS must be nonnegative')
  const temp = finite(input.temperatureK, 'temperatureK'), sat = finite(input.liquidSaturation, 'liquidSaturation')
  if (temp < p.temperatureRangeK[0] || temp > p.temperatureRangeK[1] ||
      sat < p.liquidSaturationRange[0] || sat > p.liquidSaturationRange[1]) throw new RangeError('outside applicability window')
  if (old.schemaVersion !== 1 || old.parameterSignature !== signature) throw new RangeError('history schema/parameter signature mismatch')
  vector(old.materialEngineeringStrain, 6, 'previous material strain')
  vector(old.viscousEngineeringStrain, 6 * p.branches.length, 'previous viscous strain')
  if (finite(old.accumulatedDissipationJm3, 'accumulatedDissipationJm3') < 0) throw new RangeError('negative accumulated dissipation')
  const kin = finiteStrainKinematics(input.deformationGradient)
  const e = toMaterialEngineering(tensorFromVector(kin.greenEngineeringStrain, true), p.materialFrame)
  const guard = p.maxGreenEngineeringNorm * (1 + 64 * Number.EPSILON)
  if (Math.hypot(...e) > guard || Math.hypot(...old.materialEngineeringStrain) > guard) throw new RangeError('strain exceeds applicability bound')
  const de = difference(e, old.materialEngineeringStrain)
  const stress = apply(p.equilibriumStiffnessPa, e)
  const tangentMaterial = new Float64Array(p.equilibriumStiffnessPa)
  const zNext = new Float64Array(old.viscousEngineeringStrain.length)
  let energy = 0.5 * dot(e, stress)
  let oldEnergy = 0.5 * dot(old.materialEngineeringStrain, apply(p.equilibriumStiffnessPa, old.materialEngineeringStrain))
  let potential = energy, physical = 0
  let numerical = 0.5 * dot(de, apply(p.equilibriumStiffnessPa, de))
  for (let branchIndex = 0; branchIndex < p.branches.length; branchIndex++) {
    const branch = p.branches[branchIndex], zOld = old.viscousEngineeringStrain.slice(6 * branchIndex, 6 * branchIndex + 6)
    if (Math.hypot(...zOld) > guard) throw new RangeError('viscous strain exceeds applicability bound')
    // Stable a=tau/(tau+dt), b=dt/(tau+dt), avoiding overflow of tau+dt or dt/tau.
    const ratio = dt <= branch.relaxationTimeS ? dt / branch.relaxationTimeS : branch.relaxationTimeS / dt
    const a = dt <= branch.relaxationTimeS ? 1 / (1 + ratio) : ratio / (1 + ratio)
    const b = dt <= branch.relaxationTimeS ? ratio / (1 + ratio) : 1 / (1 + ratio)
    const priorDifference = difference(e, zOld), z = Float64Array.from(zOld, (v, c) => v + b * priorDifference[c])
    const x = difference(e, z), xOld = difference(old.materialEngineeringStrain, zOld)
    const dz = difference(z, zOld), dx = difference(x, xOld), branchStress = apply(branch.stiffnessPa, x)
    zNext.set(z, 6 * branchIndex)
    const branchEnergy = 0.5 * dot(x, branchStress)
    energy += branchEnergy
    oldEnergy += 0.5 * dot(xOld, apply(branch.stiffnessPa, xOld))
    potential += 0.5 * a * dot(priorDifference, apply(branch.stiffnessPa, priorDifference))
    physical += nonnegative(dot(branchStress, dz), Math.abs(branchEnergy), 'branch dissipation')
    numerical += 0.5 * dot(dx, apply(branch.stiffnessPa, dx))
    for (let c = 0; c < 6; c++) stress[c] += branchStress[c]
    for (let c = 0; c < 36; c++) tangentMaterial[c] += a * branch.stiffnessPa[c]
  }
  vector(stress, 6, 'materialPK2Pa')
  if (Math.max(...stress.map(Math.abs)) > p.maxAbsPK2Pa) throw new RangeError('stress exceeds applicability bound')
  const S = toReferenceTensor(stress, p.materialFrame), f = input.deformationGradient
  const pk1Pa = new Float64Array(9), tangentPa = new Float64Array(81)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let a = 0; a < 3; a++) {
    pk1Pa[3 * i + j] += f[3 * i + a] * S[3 * a + j]
  }
  for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) {
    const dE = new Float64Array(9)
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      dE[3 * a + b] = 0.5 * ((a === l ? f[3 * k + b] : 0) + (b === l ? f[3 * k + a] : 0))
    }
    const dS = toReferenceTensor(apply(tangentMaterial, toMaterialEngineering(dE, p.materialFrame)), p.materialFrame)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let value = i === k ? S[3 * l + j] : 0
      for (let a = 0; a < 3; a++) value += f[3 * i + a] * dS[3 * a + j]
      tangentPa[(3 * i + j) * 9 + 3 * k + l] = finite(value, 'PK1 tangent')
    }
  }
  const effectiveCauchyPa = new Float64Array(6)
  for (let c = 0; c < 6; c++) {
    const [i, j] = PAIRS[c]
    for (let a = 0; a < 3; a++) effectiveCauchyPa[c] += pk1Pa[3 * i + a] * f[3 * j + a] / kin.jacobian
  }
  vector(pk1Pa, 9, 'PK1'); vector(effectiveCauchyPa, 6, 'Cauchy')
  const work = dot(stress, de)
  const residual = finite(work - (energy - oldEnergy) - physical - numerical, 'discrete work residual')
  const scale = Math.abs(work) + Math.abs(energy) + Math.abs(oldEnergy) + Math.abs(physical) + Math.abs(numerical)
  if (Math.abs(residual) > 1e-10 * Math.max(1, scale)) throw new RangeError('constitutive discrete work balance failed')
  return {
    next: {
      schemaVersion: 1, parameterSignature: signature,
      materialEngineeringStrain: new Float64Array(e), viscousEngineeringStrain: zNext,
      accumulatedDissipationJm3: finite(old.accumulatedDissipationJm3 + physical, 'accumulated dissipation'),
    },
    pk1Pa, tangentPa, materialPK2Pa: stress, effectiveCauchyPa,
    algorithmicStiffnessPa: tangentMaterial,
    storedEnergyJm3: nonnegative(energy, scale, 'stored energy'),
    physicalDissipationJm3: nonnegative(physical, scale, 'physical dissipation'),
    algorithmicDissipationJm3: nonnegative(numerical, scale, 'numerical dissipation'),
    backwardEulerWorkJm3: work, workBalanceResidualJm3: residual,
    incrementalPotentialJm3: finite(potential, 'incremental potential'),
  }
}
