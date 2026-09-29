import type { CoupledPrimaryState, Grid3D } from './contracts'

/** Every public operation uses sigmaEffective = sigmaTotal + alpha*pB*I:
 * tension-positive solid stress, compression-positive pore pressure.
 * All pressure values must use one explicitly chosen, consistent datum.
 */
export type CellScalar = number | Float64Array
export type StressSignConvention = 'tension-positive' | 'compression-positive'
export type PressurePrimaryState = Readonly<Pick<
  CoupledPrimaryState, 'grid' | 'gasPressurePa' | 'liquidPressurePa'
>>

export interface PorePressureInput {
  readonly primary: PressurePrimaryState
  readonly liquidSaturation: Float64Array
  readonly biotCoefficient: CellScalar
}

export interface PorePressureFields {
  /** Bishop approximation chi=Sl; unscaled, compression-positive Pa. */
  readonly porePressurePa: Float64Array
  /** alpha*pB in Pa; do not multiply this field by alpha again. */
  readonly biotPressurePa: Float64Array
}

export interface SmallStrainPressureWorkInput {
  readonly grid: Readonly<Grid3D>
  /** Dimensionless [xx,yy,zz,xy,yz,xz]; shear components are engineering shear.
   * Both strain states must use the same fixed reference configuration.
   */
  readonly previousEngineeringStrain: Float64Array
  readonly trialEngineeringStrain: Float64Array
  /** Unscaled pB, not alpha*pB. Evaluate each endpoint with its own saturation. */
  readonly previousPorePressurePa: Float64Array
  readonly trialPorePressurePa: Float64Array
  /** Fixed over this step and its strain reference; scalar or one per cell. */
  readonly biotCoefficient: CellScalar
  /** Explicit fixed geostatic/reference pB; same datum as endpoint pressures. */
  readonly referencePorePressurePa: CellScalar
}

export interface SmallStrainPressureWorkResult {
  readonly deltaVolumetricStrain: Float64Array
  readonly mechanicalPoreVolumeIncrementM3: Float64Array
  /** Positive for fluid-to-skeleton work, not a nonnegative dissipation. */
  readonly pressureWorkByCellJ: Float64Array
  readonly referencePressureWorkByCellJ: Float64Array
  readonly incrementalPressureWorkByCellJ: Float64Array
  /** Opposite of full pressure work; not an additional independent source. */
  readonly thermalEnergyTransferByCellJ: Float64Array
  readonly pressureWorkJ: number
  readonly referencePressureWorkJ: number
  readonly incrementalPressureWorkJ: number
  readonly thermalEnergyTransferJ: number
}

const VOLUME_RELATIVE_TOLERANCE = 1e-12

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`)
  return value
}

function validateGrid(grid: Readonly<Grid3D>): number {
  for (const key of ['nx', 'ny', 'nz'] as const) {
    if (!Number.isSafeInteger(grid[key]) || grid[key] <= 0) {
      throw new RangeError(`grid.${key} must be a positive safe integer`)
    }
  }
  const n = grid.nx * grid.ny * grid.nz
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(6 * n)) {
    throw new RangeError('grid cell and six-component counts must be safe integers')
  }
  for (const key of ['dxM', 'dyM', 'dzM', 'cellVolumeM3'] as const) {
    if (!(finite(grid[key], `grid.${key}`) > 0)) {
      throw new RangeError(`grid.${key} must be positive`)
    }
  }
  const product = finite(grid.dxM * grid.dyM * grid.dzM, 'grid spacing product')
  if (!(product > 0)) throw new RangeError('grid spacing product underflowed to zero')
  const scale = Math.max(product, grid.cellVolumeM3)
  if (Math.abs(product - grid.cellVolumeM3) / scale > VOLUME_RELATIVE_TOLERANCE) {
    throw new RangeError('grid.cellVolumeM3 must agree with dxM*dyM*dzM')
  }
  return n
}

function validateArray(values: Float64Array, length: number, name: string): void {
  if (!(values instanceof Float64Array)) {
    throw new TypeError(`${name} must be a Float64Array`)
  }
  if (values.length !== length) {
    throw new RangeError(`${name} length must be ${length}; got ${values.length}`)
  }
  for (let i = 0; i < values.length; i++) finite(values[i], `${name}[${i}]`)
}

function unitInterval(value: number, name: string): void {
  finite(value, name)
  if (value < 0 || value > 1) throw new RangeError(`${name} must be in [0,1]`)
}

function validateCellScalar(
  values: CellScalar, n: number, name: string, bounded: boolean,
): void {
  if (typeof values === 'number') {
    if (bounded) unitInterval(values, name)
    else finite(values, name)
    return
  }
  validateArray(values, n, name)
  if (bounded) {
    for (let q = 0; q < n; q++) unitInterval(values[q], `${name}[${q}]`)
  }
}

function cellValue(values: CellScalar, q: number): number {
  return typeof values === 'number' ? values : values[q]
}

function sumFinite(values: Float64Array, name: string): number {
  // Neumaier compensation; deterministic cell order, no silent overflow.
  let sum = 0
  let correction = 0
  for (const value of values) {
    const next = finite(sum + value, `${name} partial sum`)
    const error = Math.abs(sum) >= Math.abs(value)
      ? (sum - next) + value : (value - next) + sum
    correction = finite(correction + error, `${name} correction`)
    sum = next
  }
  return finite(sum + correction, name)
}

/** Tension-positive convention: sigmaEffective = sigmaTotal + alpha*pB*I;
 * pore pressures are compression-positive in one consistent datum.
 * Returns newly owned pB=(1-Sl)*pg+Sl*pl and alpha*pB arrays.
 * Signed pressures are permitted; this is not a phase-admissibility check.
 */
export function evaluatePorePressure(input: PorePressureInput): PorePressureFields {
  const n = validateGrid(input.primary.grid)
  const pg = input.primary.gasPressurePa
  const pl = input.primary.liquidPressurePa
  validateArray(pg, n, 'gasPressurePa')
  validateArray(pl, n, 'liquidPressurePa')
  validateArray(input.liquidSaturation, n, 'liquidSaturation')
  validateCellScalar(input.biotCoefficient, n, 'biotCoefficient', true)
  for (let q = 0; q < n; q++) unitInterval(input.liquidSaturation[q], `liquidSaturation[${q}]`)
  const porePressurePa = new Float64Array(n)
  const biotPressurePa = new Float64Array(n)
  for (let q = 0; q < n; q++) {
    const sl = input.liquidSaturation[q]
    // Endpoint/equality branches preserve exact limits and avoid subtracting
    // opposite large pressures, which could overflow an interpolation formula.
    const pressure = pg[q] === pl[q] || sl === 0 ? pg[q]
      : sl === 1 ? pl[q] : (1 - sl) * pg[q] + sl * pl[q]
    porePressurePa[q] = finite(pressure, `porePressurePa[${q}]`)
    biotPressurePa[q] = finite(cellValue(input.biotCoefficient, q) * pressure, `biotPressurePa[${q}]`)
  }
  return { porePressurePa, biotPressurePa }
}

/** Converts the ENTIRE tensor to tension-positive stress, for which
 * sigmaEffective = sigmaTotal + alpha*pB*I, with compression-positive pB.
 * 'compression-positive' means the input tensor is the negative of this
 * convention, including shear; this function does not rotate coordinates.
 * The result owns its storage even when no sign conversion is required.
 */
export function toTensionPositiveStress(
  grid: Readonly<Grid3D>, stressPa: Float64Array, from: StressSignConvention,
): Float64Array {
  const n = validateGrid(grid)
  validateArray(stressPa, 6 * n, 'stressPa')
  if (from !== 'tension-positive' && from !== 'compression-positive') {
    throw new RangeError('unknown stress sign convention')
  }
  const result = new Float64Array(stressPa)
  if (from === 'compression-positive') {
    for (let i = 0; i < result.length; i++) result[i] = -result[i]
  }
  return result
}

function shiftNormalStress(
  grid: Readonly<Grid3D>, stressPa: Float64Array,
  biotPressurePa: Float64Array, sign: 1 | -1,
): Float64Array {
  const n = validateGrid(grid)
  validateArray(stressPa, 6 * n, 'stressPa')
  validateArray(biotPressurePa, n, 'biotPressurePa')
  const result = new Float64Array(stressPa)
  for (let q = 0; q < n; q++) {
    const shift = sign * biotPressurePa[q]
    for (let c = 0; c < 3; c++) {
      result[6 * q + c] = finite(stressPa[6 * q + c] + shift, `stressPa[${6 * q + c}] after pressure shift`)
    }
  }
  return result
}

/** Returns sigmaEffective = sigmaTotal + alpha*pB*I. Both stresses are
 * tension-positive; pB is compression-positive. biotPressurePa is ALREADY
 * alpha*pB. Do not call this on the baseline's existing skeleton stress.
 * Pressure shifts only normals; all returned storage is newly owned.
 */
export function totalToEffectiveStress(
  grid: Readonly<Grid3D>, totalStressPa: Float64Array, biotPressurePa: Float64Array,
): Float64Array {
  return shiftNormalStress(grid, totalStressPa, biotPressurePa, 1)
}

/** Returns sigmaTotal = sigmaEffective - alpha*pB*I, the inverse of
 * sigmaEffective = sigmaTotal + alpha*pB*I for tension-positive stresses
 * and compression-positive pB. biotPressurePa is ALREADY alpha*pB.
 * Shear is unchanged; all returned storage is newly owned.
 */
export function effectiveToTotalStress(
  grid: Readonly<Grid3D>, effectiveStressPa: Float64Array, biotPressurePa: Float64Array,
): Float64Array {
  return shiftNormalStress(grid, effectiveStressPa, biotPressurePa, -1)
}

/** Returns expansion-positive SMALL-STRAIN trace, not mean strain or log(J).
 * Conjugate pressure convention: sigmaEffective = sigmaTotal + alpha*pB*I,
 * with tension-positive stresses and compression-positive pB.
 * Engineering shear is validated but contributes nothing to this trace.
 */
export function volumetricStrainFromEngineering(
  grid: Readonly<Grid3D>, engineeringStrain: Float64Array,
): Float64Array {
  const n = validateGrid(grid)
  validateArray(engineeringStrain, 6 * n, 'engineeringStrain')
  const result = new Float64Array(n)
  for (let q = 0; q < n; q++) {
    const i = 6 * q
    result[q] = finite(engineeringStrain[i] + engineeringStrain[i + 1] + engineeringStrain[i + 2], `volumetricStrain[${q}]`)
  }
  return result
}

/** SMALL-STRAIN pressure work with sigmaEffective = sigmaTotal + alpha*pB*I:
 * tension-positive stresses, compression-positive pB, expansion-positive strain.
 * dVp_mech=alpha*Vref*d(trace(eps)); W=mean(pB)*dVp_mech is positive into
 * the skeleton, and the thermal coupling transfer is -W. This is a signed
 * transfer, not dissipation, a full porosity law, or an equilibrium solution.
 * Endpoint pressures are UNSCALED pB. Alpha and the strain/pressure reference
 * must remain fixed over the step. No dt multiplication or input mutation.
 */
export function smallStrainPressureWork(
  input: SmallStrainPressureWorkInput,
): SmallStrainPressureWorkResult {
  const n = validateGrid(input.grid)
  validateArray(input.previousEngineeringStrain, 6 * n, 'previousEngineeringStrain')
  validateArray(input.trialEngineeringStrain, 6 * n, 'trialEngineeringStrain')
  validateArray(input.previousPorePressurePa, n, 'previousPorePressurePa')
  validateArray(input.trialPorePressurePa, n, 'trialPorePressurePa')
  validateCellScalar(input.biotCoefficient, n, 'biotCoefficient', true)
  validateCellScalar(input.referencePorePressurePa, n, 'referencePorePressurePa', false)
  const deltaVolumetricStrain = new Float64Array(n)
  const mechanicalPoreVolumeIncrementM3 = new Float64Array(n)
  const pressureWorkByCellJ = new Float64Array(n)
  const referencePressureWorkByCellJ = new Float64Array(n)
  const incrementalPressureWorkByCellJ = new Float64Array(n)
  const thermalEnergyTransferByCellJ = new Float64Array(n)
  for (let q = 0; q < n; q++) {
    const i = 6 * q
    let deltaTrace = 0
    for (let c = 0; c < 3; c++) {
      const delta = finite(input.trialEngineeringStrain[i + c] - input.previousEngineeringStrain[i + c], `strain increment[${i + c}]`)
      deltaTrace = finite(deltaTrace + delta, `deltaVolumetricStrain[${q}]`)
    }
    const dv = finite(cellValue(input.biotCoefficient, q) * input.grid.cellVolumeM3 * deltaTrace, `mechanicalPoreVolumeIncrementM3[${q}]`)
    const meanPressure = finite(0.5 * input.previousPorePressurePa[q] + 0.5 * input.trialPorePressurePa[q], `mean pressure[${q}]`)
    const reference = cellValue(input.referencePorePressurePa, q)
    const incrementalPressure = finite(meanPressure - reference, `incremental pressure[${q}]`)
    const work = finite(meanPressure * dv, `pressureWorkByCellJ[${q}]`)
    deltaVolumetricStrain[q] = deltaTrace
    mechanicalPoreVolumeIncrementM3[q] = dv
    pressureWorkByCellJ[q] = work
    referencePressureWorkByCellJ[q] = finite(reference * dv, `referencePressureWorkByCellJ[${q}]`)
    incrementalPressureWorkByCellJ[q] = finite(incrementalPressure * dv, `incrementalPressureWorkByCellJ[${q}]`)
    thermalEnergyTransferByCellJ[q] = -work
  }
  const pressureWorkJ = sumFinite(pressureWorkByCellJ, 'pressureWorkJ')
  return {
    deltaVolumetricStrain,
    mechanicalPoreVolumeIncrementM3,
    pressureWorkByCellJ,
    referencePressureWorkByCellJ,
    incrementalPressureWorkByCellJ,
    thermalEnergyTransferByCellJ,
    pressureWorkJ,
    referencePressureWorkJ: sumFinite(referencePressureWorkByCellJ, 'referencePressureWorkJ'),
    incrementalPressureWorkJ: sumFinite(incrementalPressureWorkByCellJ, 'incrementalPressureWorkJ'),
    thermalEnergyTransferJ: -pressureWorkJ,
  }
}
