/**
 * Local, co-rotating, small-slip penalty contact law; not a contact-search solver.
 * Solid stresses tension-positive; sigmaEffective=sigmaTotal+alpha*pB*I.
 * Here normal contact pressure is positive in compression, gap>0 is open.
 * Fixed reference interface area and material pair identity throughout a step.
 * Tractions/normalPressurePa are nominal (per reference area), not automatically
 * current-area Cauchy tractions when the interface area changes.
 */
export type ContactInterfaceKind = 'soil-soil' | 'soil-cap' | 'soil-root' | 'excavation'
export interface ContactParameters {
  readonly normalPenaltyPaPerM: number
  readonly tangentialPenaltyPaPerM: number
  readonly frictionCoefficient: number
  readonly penetrationToleranceM: number
}
export interface ContactState {
  /** Two components in the pair's transported, co-rotating tangent frame, m. */
  readonly elasticSlipM: Float64Array
  readonly active: boolean
  readonly accumulatedPlasticSlipM: number
}
export interface ContactTrial {
  readonly kind: ContactInterfaceKind
  readonly gapM: number
  /** Total step increment from COMMITTED state, not from a previous Newton iterate. */
  readonly tangentialIncrementM: Float64Array
  /** Row-major matrix whose COLUMNS are [normal(A->B), tangent1, tangent2]. */
  readonly frame: Float64Array
  readonly referenceAreaM2: number
  readonly previous: Readonly<ContactState>
  readonly parameters: Readonly<ContactParameters>
}
export interface ContactResult {
  readonly next: ContactState
  readonly tractionOnBPa: Float64Array
  readonly forceOnAN: Float64Array
  readonly forceOnBN: Float64Array
  /** Derivative of resisting local traction [-pn,q1,q2] with respect to [g,ds1,ds2]. */
  readonly resistingTangentPaPerM: Float64Array
  readonly normalPressurePa: number
  readonly penetrationM: number
  readonly withinPenetrationTolerance: boolean
  readonly sliding: boolean
  readonly recoverableEnergyJ: number
  readonly frictionDissipationJ: number
  /** Explicit model assumption: tangential spring release on separation is dissipated. */
  readonly separationReleaseJ: number
  /** Backward-Euler tangential numerical loss, NOT physical friction heat. */
  readonly algorithmicDissipationJ: number
}
const KINDS: readonly ContactInterfaceKind[] = ['soil-soil', 'soil-cap', 'soil-root', 'excavation']
function finite(x: number, name: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${name} must be finite`)
  return x
}
function vector(x: Float64Array, n: number, name: string): void {
  if (!(x instanceof Float64Array)) throw new TypeError(`${name} must be Float64Array`)
  if (x.length !== n) throw new RangeError(`${name} length must be ${n}`)
  for (const value of x) finite(value, name)
}
function checkFrame(frame: Float64Array): void {
  vector(frame, 9, 'frame')
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    let dot = 0
    for (let i = 0; i < 3; i++) dot += frame[3 * i + a] * frame[3 * i + b]
    if (Math.abs(dot - (a === b ? 1 : 0)) > 1e-10) throw new RangeError('frame must be orthonormal')
  }
  const det = frame[0] * (frame[4] * frame[8] - frame[5] * frame[7])
    - frame[1] * (frame[3] * frame[8] - frame[5] * frame[6])
    + frame[2] * (frame[3] * frame[7] - frame[4] * frame[6])
  if (Math.abs(det - 1) > 1e-10) throw new RangeError('frame must be right-handed')
}

/** Initializes owned contact history; compression-positive normal pressure,
 * tension-positive solid stresses; no pore-pressure correction occurs here.
 */
export function initialContactState(): ContactState {
  return { elasticSlipM: new Float64Array(2), active: false, accumulatedPlasticSlipM: 0 }
}

/** Tension-positive solids; gap>0 open, pn=max(0,-kn*g) compression-positive.
 * Force on B is A*(pn*n - q1*t1 - q2*t2), force on A is its negative.
 * Trial is pure: repeated Picard/Newton evaluations must use the same committed
 * history and total step tangential increment. Never commit an intermediate result.
 */
export function evaluateContact(input: ContactTrial): ContactResult {
  if (!KINDS.includes(input.kind)) throw new RangeError('unknown contact interface kind')
  finite(input.gapM, 'gapM'); checkFrame(input.frame)
  vector(input.tangentialIncrementM, 2, 'tangentialIncrementM')
  vector(input.previous.elasticSlipM, 2, 'previous.elasticSlipM')
  const area = finite(input.referenceAreaM2, 'referenceAreaM2')
  const oldAccum = finite(input.previous.accumulatedPlasticSlipM, 'accumulatedPlasticSlipM')
  if (!(area > 0) || oldAccum < 0) throw new RangeError('invalid area or accumulated slip')
  if (typeof input.previous.active !== 'boolean') throw new TypeError('previous.active must be boolean')
  if (!input.previous.active && input.previous.elasticSlipM.some(v => v !== 0)) {
    throw new RangeError('inactive contact cannot carry elastic slip')
  }
  const p = input.parameters
  const kn = finite(p.normalPenaltyPaPerM, 'normalPenaltyPaPerM')
  const kt = finite(p.tangentialPenaltyPaPerM, 'tangentialPenaltyPaPerM')
  const mu = finite(p.frictionCoefficient, 'frictionCoefficient')
  const tolerance = finite(p.penetrationToleranceM, 'penetrationToleranceM')
  if (!(kn > 0 && kt > 0 && mu >= 0 && tolerance >= 0)) throw new RangeError('invalid contact parameters')
  const active = input.gapM < 0
  const penetration = Math.max(0, -input.gapM)
  const pn = finite(kn * penetration, 'normalPressurePa')
  const elasticSlipM = new Float64Array(2)
  const q = new Float64Array(2), tangent = new Float64Array(9)
  let plasticIncrement = 0, frictionJ = 0, releaseJ = 0, numericalJ = 0, sliding = false
  if (active) {
    tangent[0] = kn
    const trial = Float64Array.of(
      finite(input.previous.elasticSlipM[0] + input.tangentialIncrementM[0], 'trial slip'),
      finite(input.previous.elasticSlipM[1] + input.tangentialIncrementM[1], 'trial slip'),
    )
    const magnitude = finite(Math.hypot(...trial), 'trial slip magnitude')
    const trialTraction = finite(kt * magnitude, 'trial traction magnitude')
    const limit = finite(mu * pn, 'Coulomb limit')
    sliding = trialTraction > limit
    const ratio = sliding ? limit / trialTraction : 1
    for (let i = 0; i < 2; i++) {
      elasticSlipM[i] = finite(ratio * trial[i], 'elastic slip')
      q[i] = finite(kt * elasticSlipM[i], 'tangential traction')
    }
    const plastic = Float64Array.of(trial[0] - elasticSlipM[0], trial[1] - elasticSlipM[1])
    plasticIncrement = finite(Math.hypot(...plastic), 'plastic slip increment')
    frictionJ = finite(Math.hypot(...q) * plasticIncrement * area, 'friction dissipation')
    const change0 = elasticSlipM[0] - input.previous.elasticSlipM[0]
    const change1 = elasticSlipM[1] - input.previous.elasticSlipM[1]
    numericalJ = finite(0.5 * kt * (change0 * change0 + change1 * change1) * area, 'algorithmic dissipation')
    if (!sliding) {
      tangent[4] = kt; tangent[8] = kt
    } else {
      // Generalized derivative within the sliding branch; nonsymmetric g-coupling.
      const direction = Float64Array.of(trial[0] / magnitude, trial[1] / magnitude)
      for (let a = 0; a < 2; a++) {
        tangent[(a + 1) * 3] = -mu * kn * direction[a]
        for (let b = 0; b < 2; b++) {
          tangent[(a + 1) * 3 + b + 1] = kt * ratio *
            ((a === b ? 1 : 0) - direction[a] * direction[b])
        }
      }
    }
  } else {
    const old = input.previous.elasticSlipM
    releaseJ = finite(0.5 * kt * (old[0] * old[0] + old[1] * old[1]) * area, 'separation release')
  }
  const tractionOnBPa = new Float64Array(3), forceOnBN = new Float64Array(3), forceOnAN = new Float64Array(3)
  for (let c = 0; c < 3; c++) {
    tractionOnBPa[c] = finite(pn * input.frame[3 * c]
      - q[0] * input.frame[3 * c + 1] - q[1] * input.frame[3 * c + 2], 'contact traction')
    forceOnBN[c] = finite(area * tractionOnBPa[c], 'forceOnB')
    forceOnAN[c] = -forceOnBN[c]
  }
  const elasticNorm2 = elasticSlipM[0] * elasticSlipM[0] + elasticSlipM[1] * elasticSlipM[1]
  const energy = finite((0.5 * kn * penetration * penetration + 0.5 * kt * elasticNorm2) * area, 'recoverable energy')
  vector(tangent, 9, 'contact tangent')
  return {
    next: { elasticSlipM, active, accumulatedPlasticSlipM: finite(oldAccum + plasticIncrement, 'accumulated slip') },
    tractionOnBPa, forceOnAN, forceOnBN, resistingTangentPaPerM: tangent,
    normalPressurePa: pn, penetrationM: penetration,
    withinPenetrationTolerance: penetration <= tolerance, sliding,
    recoverableEnergyJ: energy, frictionDissipationJ: frictionJ,
    separationReleaseJ: releaseJ, algorithmicDissipationJ: numericalJ,
  }
}
