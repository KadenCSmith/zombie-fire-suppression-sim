/**
 * Total-Lagrangian, reference-configuration Hex8 building blocks, not a solver.
 * Coordinates +z downward. Solid stresses tension-positive; compression-positive
 * fluid pressure gives sigmaEffective = sigmaTotal + alpha*pB*I.
 * F, PK1 and its derivative are row-major; symmetric stresses use
 * [xx,yy,zz,xy,yz,xz]; Green strain uses engineering shear 2*Eij.
 * No baseline import, constitutive history mutation, preload or global solve.
 */
export interface DeformationBounds {
  readonly minJ: number
  readonly maxJ: number
  readonly maxCondition: number
}
export interface NeoHookeanParameters {
  readonly shearModulusPa: number
  readonly lameLambdaPa: number
}
export interface FiniteKinematics {
  readonly deformationGradient: Float64Array
  readonly inverseF: Float64Array
  readonly greenEngineeringStrain: Float64Array
  readonly jacobian: number
}
export interface TotalLagrangianPoint {
  readonly pk1Pa: Float64Array
  /** d(P[i,J])/d(F[k,L]), index (3*i+J)*9 + (3*k+L), Pa. */
  readonly tangentPa: Float64Array
  /** Recoverable skeleton energy per reference volume, J/m^3. */
  readonly storedEnergyJm3: number
}
export interface Hex8Trial {
  readonly displacementM: Float64Array
  readonly dimensionsM: readonly [number, number, number]
  /** Pure callback; point index follows zeta/eta/xi quadrature order. */
  readonly material: (F: Float64Array, point: number) => TotalLagrangianPoint
  /** Already alpha*pB; held fixed while differentiating this trial. */
  readonly biotPressurePa?: number
  readonly bounds?: Readonly<DeformationBounds>
}
export interface Hex8Assembly {
  readonly internalForceN: Float64Array
  /** Dense local 24x24 matrix, row-major, N/m; NOT assumed SPD. */
  readonly tangentNm: Float64Array
  readonly deformationGradient: Float64Array
  readonly greenEngineeringStrain: Float64Array
  readonly effectiveCauchyPa: Float64Array
  readonly totalCauchyPa: Float64Array
  readonly jacobian: Float64Array
  readonly elasticEnergyJ: number
  /** Frozen-pressure load potential, NOT accepted-step fluid work. */
  readonly pressurePotentialJ: number
  readonly currentVolumeM3: number
}
const DEFAULT_BOUNDS: Readonly<DeformationBounds> = Object.freeze({
  minJ: 0.05, maxJ: 20, maxCondition: 100000,
})
const CORNERS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
] as const
const SYM = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 2], [0, 2]] as const
function finite(x: number, name: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${name} must be finite`)
  return x
}
function vector(x: Float64Array, length: number, name: string): void {
  if (!(x instanceof Float64Array)) throw new TypeError(`${name} must be Float64Array`)
  if (x.length !== length) throw new RangeError(`${name} length must be ${length}`)
  for (const value of x) finite(value, name)
}
function validateBounds(b: Readonly<DeformationBounds>): void {
  if (!(finite(b.minJ, 'minJ') > 0 && b.minJ < 1 &&
        finite(b.maxJ, 'maxJ') > 1 && finite(b.maxCondition, 'maxCondition') >= 3)) {
    throw new RangeError('invalid deformation bounds')
  }
}
function determinant(f: Float64Array): number {
  return finite(f[0] * (f[4] * f[8] - f[5] * f[7])
    - f[1] * (f[3] * f[8] - f[5] * f[6])
    + f[2] * (f[3] * f[7] - f[4] * f[6]), 'det(F)')
}
function gradientAt(u: Float64Array, grad: Float64Array): Float64Array {
  const f = Float64Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1)
  for (let a = 0; a < 8; a++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    f[3 * i + j] += u[3 * a + i] * grad[3 * a + j]
  }
  return f
}
function shapeGradient(d: readonly number[], xi: number, eta: number, zeta: number): Float64Array {
  const g = new Float64Array(24)
  for (let a = 0; a < 8; a++) {
    const [sx, sy, sz] = CORNERS[a]
    g[3 * a] = sx * (1 + sy * eta) * (1 + sz * zeta) / (4 * d[0])
    g[3 * a + 1] = sy * (1 + sx * xi) * (1 + sz * zeta) / (4 * d[1])
    g[3 * a + 2] = sz * (1 + sx * xi) * (1 + sy * eta) / (4 * d[2])
  }
  return g
}

/** Tension-positive stress convention as above; geometric arrays are dimensionless.
 * Computes E=(F^T F-I)/2 and guards sampled inversion/conditioning. New storage.
 */
export function finiteStrainKinematics(
  F: Float64Array, bounds: Readonly<DeformationBounds> = DEFAULT_BOUNDS,
): FiniteKinematics {
  vector(F, 9, 'F'); validateBounds(bounds)
  const j = determinant(F)
  if (j < bounds.minJ || j > bounds.maxJ) throw new RangeError('det(F) outside admissible bounds')
  const inverseF = Float64Array.of(
    F[4] * F[8] - F[5] * F[7], F[2] * F[7] - F[1] * F[8], F[1] * F[5] - F[2] * F[4],
    F[5] * F[6] - F[3] * F[8], F[0] * F[8] - F[2] * F[6], F[2] * F[3] - F[0] * F[5],
    F[3] * F[7] - F[4] * F[6], F[1] * F[6] - F[0] * F[7], F[0] * F[4] - F[1] * F[3],
  )
  for (let i = 0; i < 9; i++) inverseF[i] = finite(inverseF[i] / j, 'inverseF')
  const condition = finite(Math.hypot(...F) * Math.hypot(...inverseF), 'F condition')
  if (condition > bounds.maxCondition * (1 + 32 * Number.EPSILON)) {
    throw new RangeError('F condition exceeds bound')
  }
  const greenEngineeringStrain = new Float64Array(6)
  for (let c = 0; c < 6; c++) {
    const [i, k] = SYM[c]
    let value = i === k ? -1 : 0
    for (let a = 0; a < 3; a++) value += F[3 * a + i] * F[3 * a + k]
    greenEngineeringStrain[c] = finite((c < 3 ? 0.5 : 1) * value, 'Green strain')
  }
  return { deformationGradient: new Float64Array(F), inverseF, greenEngineeringStrain, jacobian: j }
}

/** Effective/skeleton hyperelastic PK1; tension-positive, no pore-pressure subtraction.
 * psi=mu/2*(F:F-3)-mu*ln(J)+lambda/2*ln(J)^2. Objective by dependence on C,J.
 * This baseline comparison material is NOT a calibrated finite-strain peat law.
 */
export function neoHookeanPoint(
  F: Float64Array, material: Readonly<NeoHookeanParameters>,
  bounds: Readonly<DeformationBounds> = DEFAULT_BOUNDS,
): TotalLagrangianPoint {
  const kinematics = finiteStrainKinematics(F, bounds)
  const mu = finite(material.shearModulusPa, 'shearModulusPa')
  const lambda = finite(material.lameLambdaPa, 'lameLambdaPa')
  if (!(mu > 0) || lambda < 0) throw new RangeError('require mu>0 and lambda>=0')
  const logJ = Math.log(kinematics.jacobian), h = lambda * logJ - mu
  const inverse = kinematics.inverseF, pk1Pa = new Float64Array(9), tangentPa = new Float64Array(81)
  let norm2 = 0
  for (let i = 0; i < 9; i++) norm2 += F[i] * F[i]
  const energy = finite(0.5 * mu * (norm2 - 3) - mu * logJ + 0.5 * lambda * logJ * logJ, 'stored energy')
  const roundoff = 64 * Number.EPSILON * Math.max(mu, lambda, Math.abs(energy), 1)
  if (energy < -roundoff) throw new RangeError('negative hyperelastic stored energy')
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const ij = 3 * i + j
    pk1Pa[ij] = finite(mu * F[ij] + h * inverse[3 * j + i], 'PK1')
    for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) {
      tangentPa[ij * 9 + 3 * k + l] = finite(
        (i === k && j === l ? mu : 0) + lambda * inverse[3 * j + i] * inverse[3 * l + k]
        - h * inverse[3 * l + i] * inverse[3 * j + k], 'material tangent')
    }
  }
  return { pk1Pa, tangentPa, storedEnergyJm3: Math.max(0, energy) }
}

/** Tension-positive PK1/Cauchy; total = effective - alpha*pB*I.
 * Self-contained 2x2x2 Gauss assembly for an axis-aligned reference brick.
 * No boundary conditions, Newton solve, cap/root geometry or global residual gate.
 * Pure material callback receives a disposable F copy; never commit history here.
 */
export function assembleFiniteStrainHex8(input: Hex8Trial): Hex8Assembly {
  vector(input.displacementM, 24, 'displacementM')
  const dimensions = input.dimensionsM
  if (dimensions.length !== 3 || dimensions.some(v => !(finite(v, 'dimension') > 0))) {
    throw new RangeError('three positive brick dimensions required')
  }
  const volume = finite(dimensions[0] * dimensions[1] * dimensions[2], 'reference volume')
  if (!(volume > 0) || !(volume / 8 > 0)) throw new RangeError('reference volume underflow')
  const pressure = finite(input.biotPressurePa ?? 0, 'biotPressurePa')
  const bounds = input.bounds ?? DEFAULT_BOUNDS
  validateBounds(bounds)
  // Extra corner/center checks are conservative sampling, NOT an injectivity proof.
  for (const [xi, eta, zeta] of [...CORNERS, [0, 0, 0]]) {
    finiteStrainKinematics(gradientAt(input.displacementM, shapeGradient(dimensions, xi, eta, zeta)), bounds)
  }
  const internalForceN = new Float64Array(24), tangentNm = new Float64Array(576)
  const deformationGradient = new Float64Array(72), greenEngineeringStrain = new Float64Array(48)
  const effectiveCauchyPa = new Float64Array(48), totalCauchyPa = new Float64Array(48)
  const jacobian = new Float64Array(8), gauss = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)]
  let elasticEnergyJ = 0, pressurePotentialJ = 0, currentVolumeM3 = 0, point = 0
  for (const zeta of gauss) for (const eta of gauss) for (const xi of gauss) {
    const gradient = shapeGradient(dimensions, xi, eta, zeta)
    const f = gradientAt(input.displacementM, gradient)
    const kin = finiteStrainKinematics(f, bounds)
    const response = input.material(new Float64Array(f), point)
    vector(response.pk1Pa, 9, 'material.pk1Pa'); vector(response.tangentPa, 81, 'material.tangentPa')
    if (finite(response.storedEnergyJm3, 'material.storedEnergyJm3') < 0) throw new RangeError('negative stored energy')
    const p = new Float64Array(response.pk1Pa), tangent = new Float64Array(response.tangentPa)
    const inv = kin.inverseF, j = kin.jacobian, w = volume / 8
    deformationGradient.set(f, point * 9); greenEngineeringStrain.set(kin.greenEngineeringStrain, point * 6)
    jacobian[point] = j
    elasticEnergyJ += response.storedEnergyJm3 * w
    pressurePotentialJ -= pressure * (j - 1) * w
    currentVolumeM3 += j * w
    for (let c = 0; c < 6; c++) {
      const [a, b] = SYM[c]
      let ab = 0, ba = 0
      for (let k = 0; k < 3; k++) {
        ab += response.pk1Pa[3 * a + k] * f[3 * b + k] / j
        ba += response.pk1Pa[3 * b + k] * f[3 * a + k] / j
      }
      if (Math.abs(ab - ba) > 1e-9 * Math.max(1, Math.abs(ab), Math.abs(ba))) {
        throw new RangeError('material violates symmetric Cauchy stress')
      }
      effectiveCauchyPa[point * 6 + c] = finite(0.5 * ab + 0.5 * ba, 'effective Cauchy')
      totalCauchyPa[point * 6 + c] = finite(effectiveCauchyPa[point * 6 + c] - (c < 3 ? pressure : 0), 'total Cauchy')
    }
    // Exact derivative of -alpha*pB*J*F^{-T} for this frozen-pressure trial.
    for (let i = 0; i < 3; i++) for (let jj = 0; jj < 3; jj++) {
      p[3 * i + jj] -= pressure * j * inv[3 * jj + i]
      for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) {
        tangent[(3 * i + jj) * 9 + 3 * k + l] -= pressure * j *
          (inv[3 * jj + i] * inv[3 * l + k] - inv[3 * l + i] * inv[3 * jj + k])
      }
    }
    for (let a = 0; a < 8; a++) for (let i = 0; i < 3; i++) {
      for (let jj = 0; jj < 3; jj++) internalForceN[3 * a + i] += p[3 * i + jj] * gradient[3 * a + jj] * w
      for (let b = 0; b < 8; b++) for (let k = 0; k < 3; k++) {
        let entry = 0
        for (let jj = 0; jj < 3; jj++) for (let l = 0; l < 3; l++) {
          entry += gradient[3 * a + jj] * tangent[(3 * i + jj) * 9 + 3 * k + l] * gradient[3 * b + l]
        }
        tangentNm[(3 * a + i) * 24 + 3 * b + k] += entry * w
      }
    }
    point++
  }
  vector(internalForceN, 24, 'assembled force'); vector(tangentNm, 576, 'assembled tangent')
  return {
    internalForceN, tangentNm, deformationGradient, greenEngineeringStrain, effectiveCauchyPa, totalCauchyPa, jacobian,
    elasticEnergyJ: finite(elasticEnergyJ, 'elasticEnergyJ'),
    pressurePotentialJ: finite(pressurePotentialJ, 'pressurePotentialJ'),
    currentVolumeM3: finite(currentVolumeM3, 'currentVolumeM3'),
  }
}

export interface FinitePressureTransferInput {
  readonly previousJ: number
  readonly trialJ: number
  readonly referenceVolumeM3: number
  readonly previousPorePressurePa: number
  readonly trialPorePressurePa: number
  readonly referencePorePressurePa: number
  readonly biotCoefficient: number
}
export interface FinitePressureTransfer {
  readonly mechanicalPoreVolumeIncrementM3: number
  readonly pressureWorkJ: number
  readonly referencePressureWorkJ: number
  readonly incrementalPressureWorkJ: number
  readonly thermalEnergyTransferJ: number
}
/** Tension-positive solid stress; sigmaTotal=sigmaEffective-alpha*pB*I.
 * Finite-kinematic work conjugate to -alpha*pB*J*F^{-T}: dVp=alpha*V0*dJ.
 * Fixed alpha and V0; pressures are UNSCALED weighted pB in a common datum.
 * This declared mechanical porosity approximation is not a storage/ice law.
 * Positive fluid-to-solid transfer has an equal negative thermal transfer.
 */
export function finiteStrainPressureTransfer(input: FinitePressureTransferInput): FinitePressureTransfer {
  for (const name of ['previousJ', 'trialJ', 'referenceVolumeM3', 'previousPorePressurePa',
    'trialPorePressurePa', 'referencePorePressurePa', 'biotCoefficient'] as const) finite(input[name], name)
  if (!(input.previousJ > 0 && input.trialJ > 0 && input.referenceVolumeM3 > 0)) {
    throw new RangeError('positive previousJ, trialJ and referenceVolumeM3 required')
  }
  if (!(input.biotCoefficient >= 0 && input.biotCoefficient <= 1)) {
    throw new RangeError('biotCoefficient must be in [0,1]')
  }
  const mean = finite(0.5 * input.previousPorePressurePa + 0.5 * input.trialPorePressurePa, 'mean pressure')
  const dv = finite(input.biotCoefficient * input.referenceVolumeM3 *
    finite(input.trialJ - input.previousJ, 'deltaJ'), 'mechanical pore volume')
  const work = finite(mean * dv, 'pressure work')
  return {
    mechanicalPoreVolumeIncrementM3: dv, pressureWorkJ: work,
    referencePressureWorkJ: finite(input.referencePorePressurePa * dv, 'reference work'),
    incrementalPressureWorkJ: finite(finite(mean - input.referencePorePressurePa, 'incremental pressure') * dv, 'incremental work'),
    thermalEnergyTransferJ: -work,
  }
}
