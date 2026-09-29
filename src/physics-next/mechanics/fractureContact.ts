/**
 * Irreversible cohesive surface law with a constant mixed-mode fracture energy.
 * Tension-positive solid convention: sigmaEffective=sigmaTotal+alpha*pB*I.
 * Separation=[normal,tangent1,tangent2], normal>0 open, normal<0 compressed.
 * This is a pre-existing/prescribed interface kernel, not crack-path discovery.
 * Tractions/contactPressurePa are nominal per reference area; converting to
 * current-area traction requires the caller's surface-geometry Jacobian.
 * Closure is frictionless after complete decohesion; do not add duplicate normal contact.
 */
export interface FractureParameters {
  readonly normalStiffnessPaPerM: number
  /** Kt/Kn; effective opening sqrt(<gn>+^2 + shearWeight*(gt1^2+gt2^2)). */
  readonly shearWeight: number
  readonly peakNormalTractionPa: number
  /** Same fracture work per reference area in pure I, pure II and mixed loading. */
  readonly fractureEnergyJm2: number
  readonly closurePenaltyPaPerM: number
  readonly penetrationToleranceM: number
  readonly maxSeparationM: number
  readonly parameterSetId: string
  readonly sourceReference: string
  readonly calibrationStatus: 'uncalibrated' | 'candidate-fit'
}
export interface FractureHistory {
  readonly schemaVersion: 1
  readonly parameterSignature: string
  readonly referenceAreaM2: number
  /** Capped at complete-failure separation; sufficient irreversible history. */
  readonly maximumEffectiveSeparationM: number
  readonly previousSeparationLocalM: Float64Array
}
export interface FractureTrial {
  readonly separationLocalM: Float64Array
  /** Proper orthonormal columns [normal(A->B), tangent1, tangent2]. */
  readonly frame: Float64Array
  readonly previous: Readonly<FractureHistory>
  readonly parameters: Readonly<FractureParameters>
}
export interface FractureResponse {
  readonly next: FractureHistory
  readonly damage: number
  readonly resistingTractionLocalPa: Float64Array
  readonly resistingTangentPaPerM: Float64Array
  readonly tractionOnBPa: Float64Array
  readonly forceOnAN: Float64Array
  readonly forceOnBN: Float64Array
  /** Positive signed-face gap: resolved kinematics only, NOT calibrated hydraulic aperture. */
  readonly crackApertureM: number
  readonly contactPressurePa: number
  readonly withinPenetrationTolerance: boolean
  readonly recoverableEnergyJ: number
  readonly fractureDissipationIncrementJ: number
  readonly cumulativeFractureDissipationJ: number
  /** State-energy identity; not independent boundary/solver-work validation. */
  readonly constitutiveWorkJ: number
  /** Independent endpoint work quadrature; refine steps near onset/failure/closure. */
  readonly trapezoidalWorkJ: number
  readonly workQuadratureResidualJ: number
}
interface Validated {
  readonly onset: number
  readonly failure: number
  readonly signature: string
}
const KIND = ['uncalibrated', 'candidate-fit']
function finite(x: number, name: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${name} must be finite`)
  return x
}
function vector(x: Float64Array, n: number, name: string): void {
  if (!(x instanceof Float64Array)) throw new TypeError(`${name} must be Float64Array`)
  if (x.length !== n) throw new RangeError(`${name} length must be ${n}`)
  for (const v of x) finite(v, name)
}
function checkFrame(r: Float64Array): void {
  vector(r, 9, 'frame')
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let dot = 0
    for (let k = 0; k < 3; k++) dot += r[3 * k + i] * r[3 * k + j]
    if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-10) throw new RangeError('frame must be orthonormal')
  }
  const det = r[0] * (r[4] * r[8] - r[5] * r[7])
    - r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6])
  if (Math.abs(det - 1) > 1e-10) throw new RangeError('frame must be right-handed')
}
function parameters(p: Readonly<FractureParameters>): Validated {
  for (const key of ['normalStiffnessPaPerM', 'shearWeight', 'peakNormalTractionPa',
    'fractureEnergyJm2', 'closurePenaltyPaPerM', 'maxSeparationM'] as const) {
    if (!(finite(p[key], key) > 0)) throw new RangeError(`${key} must be positive`)
  }
  if (finite(p.penetrationToleranceM, 'penetrationToleranceM') < 0) throw new RangeError('negative penetration tolerance')
  if (!p.parameterSetId?.trim() || !p.sourceReference?.trim() || !KIND.includes(p.calibrationStatus)) {
    throw new RangeError('explicit fracture parameter provenance required')
  }
  const onset = finite(p.peakNormalTractionPa / p.normalStiffnessPaPerM, 'onset separation')
  const failure = finite(2 * (p.fractureEnergyJm2 / p.peakNormalTractionPa), 'failure separation')
  if (!(onset > 0 && failure > onset * (1 + 1e-8) && failure <= p.maxSeparationM)) {
    throw new RangeError('require 0<onset<failure<=maxSeparation with resolved softening interval')
  }
  const signature = JSON.stringify({
    id: p.parameterSetId, stiffness: p.normalStiffnessPaPerM, shear: p.shearWeight,
    strength: p.peakNormalTractionPa, gc: p.fractureEnergyJm2, closure: p.closurePenaltyPaPerM,
    tolerance: p.penetrationToleranceM, limit: p.maxSeparationM,
  })
  return { onset, failure, signature }
}
function effectiveOpening(g: Float64Array, p: Readonly<FractureParameters>): number {
  if (Math.hypot(...g) > p.maxSeparationM) throw new RangeError('separation exceeds applicability bound')
  const weight = Math.sqrt(p.shearWeight)
  return finite(Math.hypot(Math.max(0, g[0]), weight * g[1], weight * g[2]), 'effective opening')
}
function damageAt(kappa: number, v: Validated): number {
  if (kappa <= v.onset) return 0
  if (kappa >= v.failure) return 1
  return Math.min(1, Math.max(0, v.failure / (v.failure - v.onset) * ((kappa - v.onset) / kappa)))
}
function dissipationAt(kappa: number, p: Readonly<FractureParameters>, v: Validated): number {
  if (kappa <= v.onset) return 0
  if (kappa >= v.failure) return p.fractureEnergyJm2
  return p.fractureEnergyJm2 * ((kappa - v.onset) / (v.failure - v.onset))
}
function stateAt(g: Float64Array, kappa: number, p: Readonly<FractureParameters>, v: Validated) {
  const d = damageAt(kappa, v), opening = Math.max(0, g[0]), closing = Math.min(0, g[0])
  const traction = Float64Array.of(
    (1 - d) * p.normalStiffnessPaPerM * opening + p.closurePenaltyPaPerM * closing,
    (1 - d) * p.normalStiffnessPaPerM * p.shearWeight * g[1],
    (1 - d) * p.normalStiffnessPaPerM * p.shearWeight * g[2],
  )
  const elastic = finite(0.5 * (1 - d) * p.normalStiffnessPaPerM *
    (opening * opening + p.shearWeight * (g[1] * g[1] + g[2] * g[2]))
    + 0.5 * p.closurePenaltyPaPerM * closing * closing, 'cohesive/contact energy')
  vector(traction, 3, 'cohesive traction')
  return { damage: d, traction, elastic }
}

/** Creates a pristine, owned interface history; normal separation tensile-positive.
 * Solid convention is tension-positive; no fluid-pressure shift is applied.
 */
export function initialFractureHistory(
  p: Readonly<FractureParameters>, referenceAreaM2: number,
): FractureHistory {
  const v = parameters(p)
  if (!(finite(referenceAreaM2, 'referenceAreaM2') > 0)) throw new RangeError('positive reference area required')
  return {
    schemaVersion: 1, parameterSignature: v.signature, referenceAreaM2,
    maximumEffectiveSeparationM: 0, previousSeparationLocalM: new Float64Array(3),
  }
}

/** Tension-positive resistance under opening; compression-positive contact pressure.
 * Traction on B is negative resisting traction transformed to the spatial frame.
 * History is irreversible in effective opening; compressive closure cannot heal it.
 * All arrays newly owned; total jump is evaluated from committed interface history.
 */
export function evaluateFractureContact(input: FractureTrial): FractureResponse {
  const p = input.parameters, v = parameters(p), old = input.previous
  vector(input.separationLocalM, 3, 'separationLocalM')
  vector(old.previousSeparationLocalM, 3, 'previousSeparationLocalM'); checkFrame(input.frame)
  if (old.schemaVersion !== 1 || old.parameterSignature !== v.signature) throw new RangeError('fracture history signature mismatch')
  const area = finite(old.referenceAreaM2, 'referenceAreaM2')
  const oldMax = finite(old.maximumEffectiveSeparationM, 'maximumEffectiveSeparationM')
  if (!(area > 0) || oldMax < 0 || oldMax > v.failure) throw new RangeError('invalid fracture history')
  const oldEffective = effectiveOpening(old.previousSeparationLocalM, p)
  const historyTolerance = 64 * Number.EPSILON * Math.max(v.failure, oldMax)
  if (Math.min(v.failure, oldEffective) > oldMax + historyTolerance) throw new RangeError('history maximum is inconsistent with previous separation')
  const g = input.separationLocalM, effective = effectiveOpening(g, p)
  const maximum = Math.min(v.failure, Math.max(oldMax, effective))
  const current = stateAt(g, maximum, p, v), previous = stateAt(old.previousSeparationLocalM, oldMax, p, v)
  const tangent = new Float64Array(9), kn = p.normalStiffnessPaPerM
  tangent[0] = g[0] < 0 ? p.closurePenaltyPaPerM : (1 - current.damage) * kn
  tangent[4] = tangent[8] = (1 - current.damage) * kn * p.shearWeight
  if (effective > oldMax && effective > v.onset && effective < v.failure) {
    const dd = finite(v.failure / (v.failure - v.onset) * (v.onset / effective) / effective, 'damage derivative')
    const gradient = Float64Array.of(
      g[0] > 0 ? g[0] / effective : 0, p.shearWeight * g[1] / effective, p.shearWeight * g[2] / effective,
    )
    const base = Float64Array.of(kn * Math.max(0, g[0]), kn * p.shearWeight * g[1], kn * p.shearWeight * g[2])
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tangent[3 * i + j] -= base[i] * dd * gradient[j]
  }
  const tractionOnBPa = new Float64Array(3), forceOnBN = new Float64Array(3), forceOnAN = new Float64Array(3)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) tractionOnBPa[i] -= input.frame[3 * i + j] * current.traction[j]
    forceOnBN[i] = finite(area * tractionOnBPa[i], 'forceOnB')
    forceOnAN[i] = -forceOnBN[i]
  }
  const cumulative = finite(dissipationAt(maximum, p, v) * area, 'cumulative fracture dissipation')
  const increment = finite((dissipationAt(maximum, p, v) - dissipationAt(oldMax, p, v)) * area, 'fracture dissipation increment')
  if (increment < 0) throw new RangeError('fracture dissipation must not decrease')
  const energy = finite(current.elastic * area, 'recoverableEnergyJ')
  const exactStateWork = finite((current.elastic - previous.elastic) * area + increment, 'constitutive work')
  let trapezoid = 0
  for (let i = 0; i < 3; i++) {
    trapezoid += (0.5 * previous.traction[i] + 0.5 * current.traction[i]) *
      (g[i] - old.previousSeparationLocalM[i]) * area
  }
  vector(tangent, 9, 'cohesive tangent'); vector(tractionOnBPa, 3, 'tractionOnB')
  return {
    next: {
      schemaVersion: 1, parameterSignature: v.signature, referenceAreaM2: area,
      maximumEffectiveSeparationM: maximum, previousSeparationLocalM: new Float64Array(g),
    },
    damage: current.damage, resistingTractionLocalPa: current.traction,
    resistingTangentPaPerM: tangent, tractionOnBPa, forceOnAN, forceOnBN,
    crackApertureM: Math.max(0, g[0]), contactPressurePa: finite(p.closurePenaltyPaPerM * Math.max(0, -g[0]), 'contactPressurePa'),
    withinPenetrationTolerance: Math.max(0, -g[0]) <= p.penetrationToleranceM,
    recoverableEnergyJ: energy, fractureDissipationIncrementJ: increment,
    cumulativeFractureDissipationJ: cumulative, constitutiveWorkJ: exactStateWork,
    trapezoidalWorkJ: finite(trapezoid, 'trapezoidal work'),
    workQuadratureResidualJ: finite(trapezoid - exactStateWork, 'work quadrature residual'),
  }
}
