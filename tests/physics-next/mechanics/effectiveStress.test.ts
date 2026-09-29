import { describe, it, expect } from 'vitest'
import * as api from '../../../src/physics-next/mechanics/effectiveStress'
import type {
  Grid3D, CoupledPrimaryState,
} from '../../../src/physics-next/mechanics/contracts'

/**
 * Analytic algebra fixtures, NOT calibrated peat data or coupled-solver tests.
 * Solid stress is tension-positive, pore pressure is compression-positive:
 * sigmaEffective = sigmaTotal + alpha * pB * I.
 * SI units; engineering strains [xx,yy,zz,xy,yz,xz]; fixed reference volume.
 * Deliberately extreme fixtures below test guards, not physical admissibility.
 */
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type PressureFixture = Mutable<api.PorePressureInput> & {
  primary: Mutable<api.PressurePrimaryState>
}
type WorkFixture = Mutable<api.SmallStrainPressureWorkInput>

const F = (values: readonly number[]): Float64Array => Float64Array.from(values)
const g1: Grid3D = Object.freeze({
  nx: 1, ny: 1, nz: 1, dxM: 1, dyM: 1, dzM: 1, cellVolumeM3: 1,
})
const g2: Grid3D = Object.freeze({ ...g1, dxM: 2, cellVolumeM3: 2 })
const pressureInput = (
  pg: readonly number[], pl: readonly number[], sl: readonly number[],
  alpha: api.CellScalar = 1, grid: Grid3D = { ...g1, nx: pg.length },
): PressureFixture => ({
  primary: { grid, gasPressurePa: F(pg), liquidPressurePa: F(pl) },
  liquidSaturation: F(sl), biotCoefficient: alpha,
})
const workInput = (
  override: Partial<api.SmallStrainPressureWorkInput> = {},
): WorkFixture => ({
  grid: g2, previousEngineeringStrain: F([0, 0, 0, 0, 0, 0]),
  trialEngineeringStrain: F([0.01, 0, 0, 0, 0, 0]),
  previousPorePressurePa: F([100000]), trialPorePressurePa: F([200000]),
  biotCoefficient: 0.8, referencePorePressurePa: 100000, ...override,
})

// Deliberate malformed-boundary fixtures only; never use these casts in adapters.
function malformedArray(value: unknown): Float64Array {
  return value as Float64Array
}
function ok(condition: boolean, message?: string): void {
  expect(condition, message).toBe(true)
}
function exact(actual: unknown, expected: unknown): void {
  expect(actual).toEqual(expected)
}
function near(actual: number, expected: number, atol = 1e-12): void {
  expect(Number.isFinite(actual), 'actual must be finite').toBe(true)
  expect(Number.isFinite(expected), 'analytic expectation must be finite').toBe(true)
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + 1e-12 * Math.abs(expected))
}
function throws(fn: () => unknown, pattern: RegExp): void {
  let error: unknown
  try { fn() } catch (caught) { error = caught }
  expect(error instanceof TypeError || error instanceof RangeError).toBe(true)
  if (!(error instanceof Error)) throw new Error('Expected a validation error')
  expect(error.message).toMatch(pattern)
}
/** Preserve typed-array bytes, including signed zero and NaN payloads. */
function snapshot(value: unknown): string {
  const encoded = JSON.stringify(value, (_key: string, item: unknown) => {
    if (ArrayBuffer.isView(item)) {
      return {
        dtype: item.constructor.name,
        bytes: Array.from(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)),
      }
    }
    return item
  })
  if (encoded === undefined) throw new Error('Snapshot fixture must be serializable')
  return encoded
}
function arrayOutputs(value: object): Float64Array[] {
  return Object.values(value).filter((item: unknown): item is Float64Array =>
    item instanceof Float64Array)
}
/** Execute a rejected call once, checking error class, useful field, and purity. */
function rejected(
  fn: () => unknown, kind: TypeErrorConstructor | RangeErrorConstructor,
  field: RegExp, input: unknown,
): void {
  const before = snapshot(input)
  let caught: unknown
  try { fn() } catch (error) { caught = error }
  expect(caught).toBeInstanceOf(kind)
  if (!(caught instanceof Error)) throw new Error('Expected validation rejection')
  expect(caught.message).toMatch(field)
  expect(snapshot(input)).toBe(before)
}
function independent(outputs: readonly Float64Array[], inputs: readonly Float64Array[]): void {
  expect(new Set(outputs.map(value => value.buffer)).size).toBe(outputs.length)
  for (const out of outputs) {
    expect(out).toBeInstanceOf(Float64Array)
    for (const input of inputs) expect(out.buffer === input.buffer).toBe(false)
  }
}

describe('effective stress: analytic limits, signs, work and ownership', () => {
  it('zero pressure preserves all total-stress components', () => {
    const total = F([-100000, -80000, -60000, 7, -9, 11])
    for (const sl of [0, 0.25, 0.9, 1]) for (const alpha of [0, 0.8, 1]) {
      const p = api.evaluatePorePressure(pressureInput([0], [0], [sl], alpha))
      exact([...api.totalToEffectiveStress(g1, total, p.biotPressurePa)], [...total])
    }
  })
  it('equal phases are saturation-independent, including signed pressures', () => {
    for (const pressure of [-1000, 0, 100000, 1e100]) for (const sl of [0, 1e-12, 0.25, 0.5, 0.99, 1]) {
      const p = api.evaluatePorePressure(pressureInput([pressure], [pressure], [sl], 0.8))
      exact(p.porePressurePa[0], pressure)
      exact(p.biotPressurePa[0], 0.8 * pressure)
    }
  })
  it('dry and fully saturated endpoints select exactly one phase', () => {
    exact(api.evaluatePorePressure(pressureInput([123], [-456], [0])).porePressurePa[0], 123)
    exact(api.evaluatePorePressure(pressureInput([123], [-456], [1])).porePressurePa[0], -456)
  })
  it('analytic mixture and normal-only effective-stress correction', () => {
    const p = api.evaluatePorePressure(pressureInput([100000], [60000], [0.25], 0.8))
    exact([...p.porePressurePa], [90000]); exact([...p.biotPressurePa], [72000])
    exact([...api.totalToEffectiveStress(g1, F([-100000, -100000, -100000, 3, -7, 11]), p.biotPressurePa)], [-28000, -28000, -28000, 3, -7, 11])
  })
  it('zero Biot coefficient removes coupling, not the unscaled pressure', () => {
    const p = api.evaluatePorePressure(pressureInput([100000], [60000], [0.25], 0))
    exact(p.porePressurePa[0], 90000); exact(p.biotPressurePa[0], 0)
    const w = api.smallStrainPressureWork(workInput({ biotCoefficient: 0 }))
    near(w.pressureWorkJ, 0); near(w.mechanicalPoreVolumeIncrementM3[0], 0)
  })
  it('negative liquid pressure is retained rather than clamped', () => {
    const p = api.evaluatePorePressure(pressureInput([0], [-4000], [0.75], 0.8))
    exact(p.porePressurePa[0], -3000); exact(p.biotPressurePa[0], -2400)
  })
  it('full-tensor sign conversion includes shear and returns a copy', () => {
    const stress = F([-1, -2, -3, 4, -5, 6])
    exact([...api.toTensionPositiveStress(g1, stress, 'compression-positive')], [1, 2, 3, -4, 5, -6])
    const same = api.toTensionPositiveStress(g1, stress, 'tension-positive')
    exact([...same], [...stress]); ok(same.buffer !== stress.buffer)
  })
  it('two-cell effective/total conversion round-trips', () => {
    const grid = { ...g1, nx: 2 }
    const stress = F([-100000, -20000, 300, 1, 2, -3, -4, 5, -6, 7, 8, 9])
    const pressure = F([20000, -300])
    const effective = api.totalToEffectiveStress(grid, stress, pressure)
    const total = api.effectiveToTotalStress(grid, effective, pressure)
    for (let i = 0; i < 12; i++) near(total[i], stress[i], 1e-9)
  })
  it('engineering-strain trace excludes shear and division by three', () => {
    near(api.volumetricStrainFromEngineering(g1, F([0.01, 0.02, -0.005, 7, 8, 9]))[0], 0.025, 1e-14)
    exact(api.volumetricStrainFromEngineering(g1, F([0, 0, 0, 7, 8, 9]))[0], 0)
  })
  it('one-cell expansion work, reference split and opposite thermal transfer', () => {
    const w = api.smallStrainPressureWork(workInput())
    near(w.deltaVolumetricStrain[0], 0.01, 1e-14)
    near(w.mechanicalPoreVolumeIncrementM3[0], 0.016, 1e-14)
    exact(w.pressureWorkJ, 2400); exact(w.referencePressureWorkJ, 1600)
    exact(w.incrementalPressureWorkJ, 800); exact(w.thermalEnergyTransferJ, -2400)
    exact([...w.thermalEnergyTransferByCellJ], [-2400])
  })
  it('compression reverses volume/work/thermal signs', () => {
    const w = api.smallStrainPressureWork(workInput({ trialEngineeringStrain: F([-0.01, 0, 0, 0, 0, 0]) }))
    near(w.mechanicalPoreVolumeIncrementM3[0], -0.016, 1e-14)
    exact(w.pressureWorkJ, -2400); exact(w.thermalEnergyTransferJ, 2400)
    exact(w.referencePressureWorkJ, -1600); exact(w.incrementalPressureWorkJ, -800)
  })
  it('zero trace increment gives no deformation work despite shear or pressure changes', () => {
    const w = api.smallStrainPressureWork(workInput({ trialEngineeringStrain: F([0.01, -0.01, 0, 9, 8, 7]) }))
    near(w.pressureWorkJ, 0); near(w.thermalEnergyTransferJ, 0)
  })
  it('heterogeneous alpha and reference arrays use consistent per-cell volume units', () => {
    const w = api.smallStrainPressureWork(workInput({
      grid: { ...g2, nx: 2 }, previousEngineeringStrain: new Float64Array(12),
      trialEngineeringStrain: F([0.01, 0, 0, 0, 0, 0, -0.02, 0, 0, 0, 0, 0]),
      previousPorePressurePa: F([100000, 200000]), trialPorePressurePa: F([100000, 200000]),
      biotCoefficient: F([0.25, 0.75]), referencePorePressurePa: F([20000, 50000]),
    }))
    near(w.mechanicalPoreVolumeIncrementM3[0], 0.005, 1e-14)
    near(w.mechanicalPoreVolumeIncrementM3[1], -0.03, 1e-14)
    near(w.pressureWorkJ, -5500); near(w.referencePressureWorkJ, -1400)
    near(w.incrementalPressureWorkJ, -4100)
  })
  it('subdividing a uniform volume preserves summed coupling work', () => {
    const one = api.smallStrainPressureWork(workInput({ grid: g1 }))
    const two = api.smallStrainPressureWork(workInput({
      grid: { ...g1, nx: 2, dxM: 0.5, cellVolumeM3: 0.5 },
      previousEngineeringStrain: new Float64Array(12),
      trialEngineeringStrain: F([0.01, 0, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 0]),
      previousPorePressurePa: F([100000, 100000]), trialPorePressurePa: F([200000, 200000]),
    }))
    near(two.pressureWorkJ, one.pressureWorkJ)
    near(two.referencePressureWorkJ, one.referencePressureWorkJ)
  })
  it('a common pressure-datum shift changes full/reference work but not incremental work', () => {
    const a = api.smallStrainPressureWork(workInput())
    const b = api.smallStrainPressureWork(workInput({
      previousPorePressurePa: F([200000]), trialPorePressurePa: F([300000]), referencePorePressurePa: 200000,
    }))
    near(b.incrementalPressureWorkJ, a.incrementalPressureWorkJ)
    near(b.pressureWorkJ - a.pressureWorkJ, 100000 * a.mechanicalPoreVolumeIncrementM3[0])
    near(b.referencePressureWorkJ - a.referencePressureWorkJ, 100000 * a.mechanicalPoreVolumeIncrementM3[0])
  })
  it('changing saturation is evaluated at each endpoint, including the geostatic reference', () => {
    const before = api.evaluatePorePressure(pressureInput([100000], [60000], [0.25], 0.8))
    const after = api.evaluatePorePressure(pressureInput([100000], [60000], [0.75], 0.8))
    exact(before.porePressurePa[0], 90000); exact(after.porePressurePa[0], 70000)
    exact(after.biotPressurePa[0] - before.biotPressurePa[0], -16000)
    const w = api.smallStrainPressureWork(workInput({
      grid: g1, previousPorePressurePa: before.porePressurePa,
      trialPorePressurePa: after.porePressurePa, referencePorePressurePa: before.porePressurePa,
    }))
    exact(w.pressureWorkJ, 640); exact(w.referencePressureWorkJ, 720)
    exact(w.incrementalPressureWorkJ, -80)
  })
  it('pressure output arrays neither alias inputs nor each other', () => {
    const input = pressureInput([100000], [60000], [0.25], F([0.8]))
    const before = snapshot(input)
    const out = api.evaluatePorePressure(input)
    ok(out.porePressurePa.buffer !== out.biotPressurePa.buffer)
    const originalBiot = out.biotPressurePa[0]
    out.porePressurePa[0] = 123; exact(out.biotPressurePa[0], originalBiot)
    out.biotPressurePa[0] = 456; exact(snapshot(input), before)
  })
  it('stress and trace outputs do not mutate their sources', () => {
    const input = F([1, 2, 3, 4, 5, 6]); const shift = F([7])
    const before = snapshot({ input, shift })
    const outputs = [api.totalToEffectiveStress(g1, input, shift), api.effectiveToTotalStress(g1, input, shift),
      api.toTensionPositiveStress(g1, input, 'tension-positive'), api.volumetricStrainFromEngineering(g1, input)]
    for (const out of outputs) out[0] = 999
    exact(snapshot({ input, shift }), before)
    exact(new Set(outputs.map(out => out.buffer)).size, outputs.length)
  })
  it('work outputs own six independent buffers; input bytes are preserved', () => {
    const input = workInput({ biotCoefficient: F([0.8]), referencePorePressurePa: F([100000]) })
    const before = snapshot(input); const out = api.smallStrainPressureWork(input)
    const arrays = arrayOutputs(out)
    exact(arrays.length, 6); exact(new Set(arrays.map(value => value.buffer)).size, 6)
    for (const value of arrays) value[0] = 999
    exact(snapshot(input), before)
  })
  it('all phase arrays must be finite even in inactive saturation limits', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      throws(() => api.evaluatePorePressure(pressureInput([bad], [1], [1])), /gasPressurePa/)
      throws(() => api.evaluatePorePressure(pressureInput([1], [bad], [0])), /liquidPressurePa/)
    }
  })
  it('pressure-array lengths and Float64 dtype are strict', () => {
    for (const field of ['gasPressurePa', 'liquidPressurePa'] as const) {
      const input = pressureInput([1], [2], [0.5]); input.primary[field] = F([])
      throws(() => api.evaluatePorePressure(input), /length/)
      input.primary[field] = malformedArray(new Float32Array([1]))
      throws(() => api.evaluatePorePressure(input), /Float64Array/)
    }
    const input = pressureInput([1], [2], [])
    throws(() => api.evaluatePorePressure(input), /liquidSaturation length/)
    input.liquidSaturation = malformedArray(new Float32Array([0.5]))
    throws(() => api.evaluatePorePressure(input), /Float64Array/)
  })
  it('scalar and array Biot coefficients and saturation enforce closed [0,1] bounds', () => {
    for (const bad of [-0.01, 1.01, NaN, Infinity]) {
      throws(() => api.evaluatePorePressure(pressureInput([1], [2], [bad])), /liquidSaturation/)
      throws(() => api.evaluatePorePressure(pressureInput([1], [2], [0.5], bad)), /biotCoefficient/)
      throws(() => api.evaluatePorePressure(pressureInput([1], [2], [0.5], F([bad]))), /biotCoefficient/)
    }
    throws(() => api.evaluatePorePressure(pressureInput([1], [2], [0.5], F([]))), /length/)
    throws(() => api.evaluatePorePressure(pressureInput([1], [2], [0.5], malformedArray(new Float32Array([0.8])))), /Float64Array/)
  })
  it('grid dimensions and component counts must be positive safe integers', () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      for (const key of ['nx', 'ny', 'nz']) {
        const input = pressureInput([1], [2], [0.5], 1, { ...g1, [key]: value })
        throws(() => api.evaluatePorePressure(input), /grid/)
      }
    }
    throws(() => api.volumetricStrainFromEngineering({ ...g1, nx: Number.MAX_SAFE_INTEGER }, F([])), /counts/)
  })
  it('grid lengths, volume and spacing-product overflow/underflow are guarded', () => {
    for (const key of ['dxM', 'dyM', 'dzM', 'cellVolumeM3']) for (const value of [0, -1, NaN, Infinity]) {
      throws(() => api.volumetricStrainFromEngineering({ ...g1, [key]: value }, new Float64Array(6)), /grid/)
    }
    for (const grid of [
      { ...g1, dxM: 1e308, dyM: 1e308 },
      { ...g1, dxM: 1e-200, dyM: 1e-200 },
      { ...g1, cellVolumeM3: 2 },
      { ...g1, dxM: 1e-12, dyM: 1e-12, dzM: 1e-12, cellVolumeM3: 2e-36 },
    ]) throws(() => api.volumetricStrainFromEngineering(grid, new Float64Array(6)), /grid/)
    exact(api.volumetricStrainFromEngineering({ ...g1, dxM: 0.1, dyM: 0.2, dzM: 0.3, cellVolumeM3: 0.006 }, new Float64Array(6))[0], 0)
    exact(api.volumetricStrainFromEngineering({ ...g1, cellVolumeM3: 1 + 5e-13 }, new Float64Array(6))[0], 0)
  })
  it('stress/strain shape, sign label, ignored-shear finiteness and dtype are validated', () => {
    throws(() => api.toTensionPositiveStress(g1, F([1]), 'tension-positive'), /length/)
    throws(() => api.toTensionPositiveStress(g1, new Float64Array(6), 'unknown' as api.StressSignConvention), /convention/)
    throws(() => api.totalToEffectiveStress(g1, new Float64Array(6), F([])), /length/)
    throws(() => api.effectiveToTotalStress(g1, new Float64Array(6), F([NaN])), /finite/)
    throws(() => api.volumetricStrainFromEngineering(g1, malformedArray(new Float32Array(6))), /Float64Array/)
    throws(() => api.volumetricStrainFromEngineering(g1, F([0, 0, 0, 0, 0, NaN])), /finite/)
    throws(() => api.totalToEffectiveStress(g1, F([0, 0, 0, 0, Infinity, 0]), F([1])), /finite/)
  })
  it('work-state arrays and scalar/array references enforce dimensions and finiteness', () => {
    for (const field of ['previousEngineeringStrain', 'trialEngineeringStrain', 'previousPorePressurePa', 'trialPorePressurePa'] as const) {
      const input = workInput(); input[field] = F([])
      throws(() => api.smallStrainPressureWork(input), /length/)
      input[field] = malformedArray(new Float32Array(field.includes('Strain') ? 6 : 1))
      throws(() => api.smallStrainPressureWork(input), /Float64Array/)
      input[field] = new Float64Array(field.includes('Strain') ? 6 : 1); input[field][input[field].length - 1] = NaN
      throws(() => api.smallStrainPressureWork(input), /finite/)
    }
    for (const value of [NaN, Infinity, F([NaN]), F([]), malformedArray(new Float32Array([1]))]) {
      throws(() => api.smallStrainPressureWork(workInput({ referencePorePressurePa: value })), /referencePorePressurePa/)
    }
    throws(() => api.smallStrainPressureWork(workInput({ biotCoefficient: -1 })), /biotCoefficient/)
  })
  it('arithmetic overflow is rejected; pressure mean avoids unnecessary sum overflow', () => {
    const max = Number.MAX_VALUE
    throws(() => api.totalToEffectiveStress(g1, F([max, 0, 0, 0, 0, 0]), F([max])), /finite/)
    throws(() => api.volumetricStrainFromEngineering(g1, F([max, max, 0, 0, 0, 0])), /finite/)
    throws(() => api.smallStrainPressureWork(workInput({
      previousEngineeringStrain: F([-max, 0, 0, 0, 0, 0]), trialEngineeringStrain: F([max, 0, 0, 0, 0, 0]),
    })), /finite/)
    throws(() => api.smallStrainPressureWork(workInput({
      trialEngineeringStrain: F([1, 0, 0, 0, 0, 0]), biotCoefficient: 1,
      previousPorePressurePa: F([max]), trialPorePressurePa: F([max]), referencePorePressurePa: 0,
    })), /finite/)
    const valid = api.smallStrainPressureWork(workInput({
      grid: g1, trialEngineeringStrain: F([1e-6, 0, 0, 0, 0, 0]), biotCoefficient: 1,
      previousPorePressurePa: F([max]), trialPorePressurePa: F([max]), referencePorePressurePa: 0,
    }))
    near(valid.pressureWorkJ, max * 1e-6)
    const pressure = api.evaluatePorePressure(pressureInput([max], [-max], [0.5]))
    exact(pressure.porePressurePa[0], 0)
  })
  it('compensated totals retain cancellation residuals and reject total overflow', () => {
    const input = workInput({
      grid: { ...g1, nx: 3 }, previousEngineeringStrain: new Float64Array(18),
      trialEngineeringStrain: F([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
      previousPorePressurePa: F([1e16, 1, -1e16]), trialPorePressurePa: F([1e16, 1, -1e16]),
      biotCoefficient: 1, referencePorePressurePa: 0,
    })
    exact(api.smallStrainPressureWork(input).pressureWorkJ, 1)
    input.previousPorePressurePa.fill(Number.MAX_VALUE)
    input.trialPorePressurePa.fill(Number.MAX_VALUE)
    throws(() => api.smallStrainPressureWork(input), /partial sum/)
  })
  it('validation failure preserves input bytes, including NaN payload representation', () => {
    const input = workInput(); input.trialEngineeringStrain[5] = NaN
    const before = snapshot(input)
    throws(() => api.smallStrainPressureWork(input), /finite/)
    exact(snapshot(input), before)
  })
  it('repeated trials are deterministic and independent', () => {
    const input = workInput(); const before = snapshot(input)
    const first = api.smallStrainPressureWork(input); const second = api.smallStrainPressureWork(input)
    exact(snapshot(first), snapshot(second)); exact(snapshot(input), before)
    first.deltaVolumetricStrain[0] = 999
    near(second.deltaVolumetricStrain[0], 0.01, 1e-14)
  })
  it('eight-cell xyz layout retains the contract flat-cell order', () => {
    const pg = Array.from({ length: 8 }, (_v, q) => 1000 * (q + 1))
    const pl = pg.map(value => value / 2)
    const sl = pg.map((_value, q) => q / 7)
    const alpha = F(pg.map((_value, q) => (q + 1) / 8))
    const out = api.evaluatePorePressure(pressureInput(pg, pl, sl, alpha, { ...g1, nx: 2, ny: 2, nz: 2 }))
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const q = (z * 2 + y) * 2 + x
      near(out.porePressurePa[q], (1 - sl[q]) * pg[q] + sl[q] * pl[q], 1e-9)
      near(out.biotPressurePa[q], alpha[q] * out.porePressurePa[q], 1e-9)
    }
  })
  it('128 deterministic fixtures satisfy pressure virtual work and work decomposition', () => {
    let state = 20260929
    function random() { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296 }
    for (let k = 0; k < 128; k++) {
      const alpha = random(); const volume = 0.1 + 2 * random()
      const grid = { ...g1, dxM: volume, cellVolumeM3: volume }
      const before = api.evaluatePorePressure(pressureInput([400000 * random()], [-2000 + 200000 * random()], [random()], alpha, grid))
      const after = api.evaluatePorePressure(pressureInput([400000 * random()], [-2000 + 200000 * random()], [random()], alpha, grid))
      const previous = F(Array.from({ length: 6 }, () => 0.005 * (random() - 0.5)))
      const trial = F([...previous].map(value => value + 0.003 * (random() - 0.5)))
      const input = workInput({ grid, previousEngineeringStrain: previous, trialEngineeringStrain: trial,
        previousPorePressurePa: before.porePressurePa, trialPorePressurePa: after.porePressurePa,
        biotCoefficient: alpha, referencePorePressurePa: before.porePressurePa })
      const w = api.smallStrainPressureWork(input)
      const trace = (trial[0] - previous[0]) + (trial[1] - previous[1]) + (trial[2] - previous[2])
      const mean = 0.5 * before.porePressurePa[0] + 0.5 * after.porePressurePa[0]
      // Independent explicit contraction of mean hydrostatic coupling stress
      // with the three normal engineering-strain increments, times Vref.
      let conjugateWork = 0
      for (let c = 0; c < 3; c++) conjugateWork += alpha * mean * (trial[c] - previous[c]) * volume
      near(w.deltaVolumetricStrain[0], trace, 1e-14)
      near(w.mechanicalPoreVolumeIncrementM3[0], alpha * volume * trace, 1e-14)
      near(w.pressureWorkJ, conjugateWork, 1e-10)
      near(w.pressureWorkJ, w.referencePressureWorkJ + w.incrementalPressureWorkJ, 1e-10)
      near(w.thermalEnergyTransferJ, -w.pressureWorkJ)
    }
  })
})

describe('effective stress: contract-shaped fixtures and independent identities', () => {
  it('accepts a full frozen primary object without touching unrelated state arrays', () => {
    const primary: CoupledPrimaryState = Object.freeze({
      timeS: 12, grid: g1, temperatureK: F([293.15]),
      gasPressurePa: F([100000]), liquidPressurePa: F([60000]),
      porosity: F([0.8]), liquidKg: F([20]), iceKg: F([0]),
      gasMol: [F([1]), F([2]), F([3]), F([4])] as const,
    })
    const input = Object.freeze({
      primary, liquidSaturation: F([0.25]), biotCoefficient: F([0.8]),
    })
    const before = snapshot(input)
    const result = api.evaluatePorePressure(input)
    exact([...result.porePressurePa], [90000])
    exact([...result.biotPressurePa], [72000])
    independent(arrayOutputs(result), [
      primary.temperatureK, primary.gasPressurePa, primary.liquidPressurePa,
      primary.porosity, primary.liquidKg, primary.iceKg, ...primary.gasMol,
      input.liquidSaturation, input.biotCoefficient,
    ])
    for (const array of arrayOutputs(result)) array.fill(-999)
    expect(snapshot(input)).toBe(before)
  })

  it('uses endpoint saturation before pressure averaging, not products of averages', () => {
    const oldP = api.evaluatePorePressure(pressureInput([100000], [20000], [0], 0.8))
    const newP = api.evaluatePorePressure(pressureInput([300000], [60000], [1], 0.8))
    // pB endpoints 100 kPa and 60 kPa give mean 80 kPa, not 120 kPa.
    const input = workInput({
      previousPorePressurePa: oldP.porePressurePa,
      trialPorePressurePa: newP.porePressurePa,
    })
    const result = api.smallStrainPressureWork(input)
    near(result.pressureWorkJ, 1280)
    near(result.referencePressureWorkJ, 1600)
    near(result.incrementalPressureWorkJ, -320)
    near(result.thermalEnergyTransferJ, -1280)
  })

  it('matches a direct normal-stress contraction without multiplying alpha twice', () => {
    const input = workInput({
      previousEngineeringStrain: F([0.003, -0.002, 0.001, 0.004, 0.003, -0.002]),
      trialEngineeringStrain: F([0.005, -0.001, 0.004, -0.004, 0.008, 0.001]),
    })
    const total = F([-100000, -90000, -80000, 50, -60, 70])
    const effective = api.totalToEffectiveStress(g2, total, F([120000]))
    let contractionJ = 0
    for (let c = 0; c < 6; c++) {
      contractionJ += (effective[c] - total[c])
        * (input.trialEngineeringStrain[c] - input.previousEngineeringStrain[c])
        * g2.cellVolumeM3
    }
    near(contractionJ, 1440)
    near(api.smallStrainPressureWork(input).pressureWorkJ, contractionJ)
  })

  it('preserves effective stress under a consistently transformed pressure datum', () => {
    const old = pressureInput([100000], [60000], [0.25], 0.8)
    const shifted = pressureInput([130000], [90000], [0.25], 0.8)
    const sigma = F([-100000, -90000, -80000, 11, -22, 33])
    const shiftedSigma = F([-124000, -114000, -104000, 11, -22, 33])
    exact(
      api.totalToEffectiveStress(g1, shiftedSigma, api.evaluatePorePressure(shifted).biotPressurePa),
      api.totalToEffectiveStress(g1, sigma, api.evaluatePorePressure(old).biotPressurePa),
    )
  })

  it('reverses every transfer when old and new states are swapped', () => {
    const forward = workInput({
      previousEngineeringStrain: F([0.002, -0.001, 0.004, 0.01, 0, 0]),
      trialEngineeringStrain: F([0.006, -0.002, 0.009, 0, 0.01, 0]),
    })
    const reverse = workInput({
      ...forward,
      previousEngineeringStrain: forward.trialEngineeringStrain,
      trialEngineeringStrain: forward.previousEngineeringStrain,
      previousPorePressurePa: forward.trialPorePressurePa,
      trialPorePressurePa: forward.previousPorePressurePa,
    })
    const a = api.smallStrainPressureWork(forward)
    const b = api.smallStrainPressureWork(reverse)
    const aa = arrayOutputs(a), bb = arrayOutputs(b)
    for (let i = 0; i < aa.length; i++) near(bb[i][0], -aa[i][0])
    near(b.pressureWorkJ, -a.pressureWorkJ)
    near(b.referencePressureWorkJ, -a.referencePressureWorkJ)
    near(b.incrementalPressureWorkJ, -a.incrementalPressureWorkJ)
    near(b.thermalEnergyTransferJ, -a.thermalEnergyTransferJ)
  })

  it('adds exactly over a split linear pressure-versus-strain path within tolerance', () => {
    const whole = workInput()
    const halfStrain = F([0.005, 0, 0, 0, 0, 0])
    const halfPressure = F([150000])
    const a = api.smallStrainPressureWork(workInput({
      trialEngineeringStrain: halfStrain, trialPorePressurePa: halfPressure,
    }))
    const b = api.smallStrainPressureWork(workInput({
      previousEngineeringStrain: halfStrain, previousPorePressurePa: halfPressure,
    }))
    const c = api.smallStrainPressureWork(whole)
    near(a.pressureWorkJ + b.pressureWorkJ, c.pressureWorkJ)
    near(a.referencePressureWorkJ + b.referencePressureWorkJ, c.referencePressureWorkJ)
    near(a.incrementalPressureWorkJ + b.incrementalPressureWorkJ, c.incrementalPressureWorkJ)
    near(a.thermalEnergyTransferJ + b.thermalEnergyTransferJ, c.thermalEnergyTransferJ)
  })

  it('scalar and constant per-cell alpha/reference inputs are equivalent', () => {
    const scalar = workInput()
    const field = workInput({
      biotCoefficient: F([0.8]), referencePorePressurePa: F([100000]),
    })
    expect(snapshot(api.smallStrainPressureWork(scalar)))
      .toBe(snapshot(api.smallStrainPressureWork(field)))
    const a = pressureInput([100000, 120000], [60000, 80000], [0.25, 0.75], 0.8)
    const b = { ...a, biotCoefficient: F([0.8, 0.8]) }
    expect(snapshot(api.evaluatePorePressure(a))).toBe(snapshot(api.evaluatePorePressure(b)))
  })

  it('respects 6*q stress/strain strides and q=(z*ny+y)*nx+x on a noncubic grid', () => {
    const grid: Grid3D = {
      nx: 2, ny: 3, nz: 2, dxM: 0.5, dyM: 2, dzM: 3, cellVolumeM3: 3,
    }
    const count = 12
    const pg = F(Array.from({ length: count }, (_, q) => 1000 * (q + 1)))
    const pl = F(Array.from({ length: count }, (_, q) => 200 * (q + 1)))
    const sl = F(Array.from({ length: count }, (_, q) => q / 11))
    const alpha = F(Array.from({ length: count }, (_, q) => (q + 1) / 12))
    const stress = new Float64Array(6 * count)
    const previous = new Float64Array(6 * count)
    const trial = new Float64Array(6 * count)
    for (let q = 0; q < count; q++) for (let c = 0; c < 6; c++) {
      stress[6 * q + c] = -10000 - 100 * q - c
      previous[6 * q + c] = 0.0001 * (q + c)
      trial[6 * q + c] = previous[6 * q + c] + 0.00001 * (q + 1) * (c + 1)
    }
    const pressure = api.evaluatePorePressure({
      primary: { grid, gasPressurePa: pg, liquidPressurePa: pl },
      liquidSaturation: sl, biotCoefficient: alpha,
    })
    const effective = api.totalToEffectiveStress(grid, stress, pressure.biotPressurePa)
    const trace = api.volumetricStrainFromEngineering(grid, trial)
    const work = api.smallStrainPressureWork({
      grid, previousEngineeringStrain: previous, trialEngineeringStrain: trial,
      previousPorePressurePa: pressure.porePressurePa, trialPorePressurePa: pressure.porePressurePa,
      biotCoefficient: alpha, referencePorePressurePa: 0,
    })
    let analyticWork = 0
    for (let z = 0; z < grid.nz; z++) for (let y = 0; y < grid.ny; y++) {
      for (let x = 0; x < grid.nx; x++) {
        const q = (z * grid.ny + y) * grid.nx + x
        const p = (1 - sl[q]) * pg[q] + sl[q] * pl[q]
        for (let c = 0; c < 6; c++) {
          near(effective[6 * q + c], stress[6 * q + c] + (c < 3 ? alpha[q] * p : 0), 1e-9)
        }
        near(trace[q], trial[6 * q] + trial[6 * q + 1] + trial[6 * q + 2], 1e-14)
        const dv = alpha[q] * 3 * 0.00006 * (q + 1)
        near(work.mechanicalPoreVolumeIncrementM3[q], dv, 1e-14)
        near(work.pressureWorkByCellJ[q], p * dv)
        analyticWork += p * dv
      }
    }
    near(work.pressureWorkJ, analyticWork)
  })

  it('handles subarray inputs sharing one backing buffer without corrupting sentinels', () => {
    const storage = F([777, 100000, 60000, 0.25, 0.8, 888])
    const input: api.PorePressureInput = Object.freeze({
      primary: Object.freeze({
        grid: g1, gasPressurePa: storage.subarray(1, 2),
        liquidPressurePa: storage.subarray(2, 3),
      }),
      liquidSaturation: storage.subarray(3, 4), biotCoefficient: storage.subarray(4, 5),
    })
    const before = snapshot(storage)
    const result = api.evaluatePorePressure(input)
    independent(arrayOutputs(result), [storage])
    near(result.porePressurePa[0], 90000, 1e-9)
    for (const out of arrayOutputs(result)) out.fill(-1)
    expect(snapshot(storage)).toBe(before)
  })

  it('allows aliased read-only input endpoints but returns independent output storage', () => {
    const pressure = F([100000])
    const strain = F([0.002, 0.003, 0.001, 0, 0, 0])
    const input = workInput({
      previousEngineeringStrain: strain, trialEngineeringStrain: strain,
      previousPorePressurePa: pressure, trialPorePressurePa: pressure,
    })
    const result = api.smallStrainPressureWork(input)
    near(result.pressureWorkJ, 0)
    independent(arrayOutputs(result), [pressure, strain])
  })

  it('preserves a nondefault NaN payload and surrounding bytes on rejection', () => {
    const storage = new ArrayBuffer(8 * 8)
    const words = new BigUint64Array(storage)
    words.fill(0x3ff0000000000000n)
    words[6] = 0x7ff8000000001234n
    const badStrain = new Float64Array(storage, 8, 6)
    const input = workInput({ trialEngineeringStrain: badStrain })
    const before = Array.from(new Uint8Array(storage))
    rejected(() => api.smallStrainPressureWork(input), RangeError, /trialEngineeringStrain/, input)
    expect(Array.from(new Uint8Array(storage))).toEqual(before)
  })

  it('computes component increments before summing, retaining cancellation residuals', () => {
    // Extreme strain offsets test arithmetic only, not admissible deformation.
    const result = api.smallStrainPressureWork(workInput({
      grid: g1, biotCoefficient: 1, referencePorePressurePa: 0,
      previousEngineeringStrain: F([1e16, 1, -1e16, 0, 0, 0]),
      trialEngineeringStrain: F([1e16, 2, -1e16, 0, 0, 0]),
      previousPorePressurePa: F([1]), trialPorePressurePa: F([1]),
    }))
    near(result.deltaVolumetricStrain[0], 1)
    near(result.pressureWorkJ, 1)
  })

  for (const values of [[1e16, 1, -1e16], [1, 1e16, -1e16], [-1e16, 1, 1e16]]) {
    it(`compensates full/reference/incremental sums for ordering ${values.join(',')}`, () => {
      const result = api.smallStrainPressureWork(workInput({
        grid: { ...g1, nx: 3 }, biotCoefficient: 1,
        previousEngineeringStrain: new Float64Array(18),
        trialEngineeringStrain: F([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
        previousPorePressurePa: F(values), trialPorePressurePa: F(values),
        referencePorePressurePa: F(values.map(value => value / 2)),
      }))
      near(result.pressureWorkJ, 1)
      near(result.referencePressureWorkJ, 0.5)
      near(result.incrementalPressureWorkJ, 0.5)
      near(result.thermalEnergyTransferJ, -1)
    })
  }
})

interface ArrayBoundary {
  name: string
  length: number
  field: RegExp
  make: (values: Float64Array) => { input: unknown; run: () => unknown }
}
const boundaries: ArrayBoundary[] = []
for (const key of ['gasPressurePa', 'liquidPressurePa'] as const) {
  boundaries.push({
    name: `evaluatePorePressure.${key}`, length: 1, field: new RegExp(key),
    make: values => {
      const input = pressureInput([1], [2], [0.5])
      input.primary[key] = values
      return { input, run: () => api.evaluatePorePressure(input) }
    },
  })
}
for (const key of ['liquidSaturation', 'biotCoefficient'] as const) {
  boundaries.push({
    name: `evaluatePorePressure.${key}`, length: 1, field: new RegExp(key),
    make: values => {
      const input = { ...pressureInput([1], [2], [0.5]), [key]: values }
      return { input, run: () => api.evaluatePorePressure(input) }
    },
  })
}
for (const [name, convert] of [
  ['totalToEffectiveStress', api.totalToEffectiveStress],
  ['effectiveToTotalStress', api.effectiveToTotalStress],
] as const) {
  for (const key of ['stressPa', 'biotPressurePa'] as const) boundaries.push({
    name: `${name}.${key}`, length: key === 'stressPa' ? 6 : 1, field: new RegExp(key),
    make: values => {
      const input = { grid: g1, stressPa: new Float64Array(6), biotPressurePa: F([1]), [key]: values }
      return { input, run: () => convert(input.grid, input.stressPa, input.biotPressurePa) }
    },
  })
}
boundaries.push({
  name: 'toTensionPositiveStress.stressPa', length: 6, field: /stressPa/,
  make: values => ({
    input: { grid: g1, stressPa: values },
    run: () => api.toTensionPositiveStress(g1, values, 'tension-positive'),
  }),
}, {
  name: 'volumetricStrainFromEngineering.engineeringStrain', length: 6, field: /engineeringStrain/,
  make: values => ({
    input: { grid: g1, engineeringStrain: values },
    run: () => api.volumetricStrainFromEngineering(g1, values),
  }),
})
for (const key of [
  'previousEngineeringStrain', 'trialEngineeringStrain', 'previousPorePressurePa',
  'trialPorePressurePa', 'biotCoefficient', 'referencePorePressurePa',
] as const) boundaries.push({
  name: `smallStrainPressureWork.${key}`,
  length: key.includes('Strain') ? 6 : 1, field: new RegExp(key),
  make: values => {
    const input = workInput({ [key]: values })
    return { input, run: () => api.smallStrainPressureWork(input) }
  },
})

describe('effective stress: complete array-boundary validation and failure purity', () => {
  for (const boundary of boundaries) {
    for (const length of [0, boundary.length + 1]) {
      it(`${boundary.name} rejects length ${length}`, () => {
        const fixture = boundary.make(new Float64Array(length))
        rejected(fixture.run, RangeError, boundary.field, fixture.input)
      })
    }
    for (const [name, bad] of [
      ['Float32Array', new Float32Array(boundary.length)],
      ['number[]', Array(boundary.length).fill(0)],
      ['null', null],
      ['undefined', undefined],
    ] as const) {
      it(`${boundary.name} rejects ${name} instead of Float64Array`, () => {
        const fixture = boundary.make(malformedArray(bad))
        rejected(fixture.run, TypeError, boundary.field, fixture.input)
      })
    }
    for (const bad of [NaN, Infinity, -Infinity]) {
      for (let index = 0; index < boundary.length; index++) {
        it(`${boundary.name} rejects ${String(bad)} at component ${index}`, () => {
          const values = new Float64Array(boundary.length)
          values[index] = bad
          const fixture = boundary.make(values)
          rejected(fixture.run, RangeError, boundary.field, fixture.input)
        })
      }
    }
  }

  for (const bad of [-Number.EPSILON, 1 + Number.EPSILON, NaN, Infinity, -Infinity]) {
    it(`rejects scalar and field alpha ${String(bad)} consistently in pressure and work`, () => {
      for (const alpha of [bad, F([bad])]) {
        const pressure = pressureInput([1], [2], [0.5], alpha)
        rejected(() => api.evaluatePorePressure(pressure), RangeError, /biotCoefficient/, pressure)
        const work = workInput({ biotCoefficient: alpha })
        rejected(() => api.smallStrainPressureWork(work), RangeError, /biotCoefficient/, work)
      }
    })
  }
  for (const bad of [NaN, Infinity, -Infinity]) {
    it(`rejects nonfinite scalar reference ${String(bad)} without mutating inputs`, () => {
      const input = workInput({ referencePorePressurePa: bad })
      rejected(() => api.smallStrainPressureWork(input), RangeError, /referencePorePressurePa/, input)
    })
  }
  for (const bad of [-Number.EPSILON, 1 + Number.EPSILON]) {
    it(`rejects saturation ${bad} instead of clipping`, () => {
      const input = pressureInput([1], [2], [bad])
      rejected(() => api.evaluatePorePressure(input), RangeError, /liquidSaturation/, input)
    })
  }
})

const gridOperations: readonly [string, (grid: Grid3D) => unknown][] = [
  ['evaluatePorePressure', grid => api.evaluatePorePressure(pressureInput([1], [2], [0.5], 1, grid))],
  ['toTensionPositiveStress', grid => api.toTensionPositiveStress(grid, new Float64Array(6), 'tension-positive')],
  ['totalToEffectiveStress', grid => api.totalToEffectiveStress(grid, new Float64Array(6), F([1]))],
  ['effectiveToTotalStress', grid => api.effectiveToTotalStress(grid, new Float64Array(6), F([1]))],
  ['volumetricStrainFromEngineering', grid => api.volumetricStrainFromEngineering(grid, new Float64Array(6))],
  ['smallStrainPressureWork', grid => api.smallStrainPressureWork(workInput({ grid }))],
]
describe('effective stress: every public entry validates grid units and counts', () => {
  const invalid: readonly [string, Partial<Grid3D>][] = [
    ['zero nx', { nx: 0 }], ['negative ny', { ny: -1 }], ['fractional nz', { nz: 1.5 }],
    ['unsafe component count', { nx: Number.MAX_SAFE_INTEGER }],
    ['unsafe cell product', { nx: 2 ** 27, ny: 2 ** 27 }],
    ['nonfinite count', { nz: Infinity }],
    ['negative spacing', { dxM: -1 }], ['zero spacing', { dyM: 0 }],
    ['nonfinite spacing', { dzM: NaN }], ['nonfinite volume', { cellVolumeM3: Infinity }],
    ['negative volume', { cellVolumeM3: -1 }],
    ['relative volume mismatch', { cellVolumeM3: 1 + 2e-12 }],
    ['tiny relative mismatch', { dxM: 1e-12, dyM: 1e-12, dzM: 1e-12, cellVolumeM3: 2e-36 }],
    ['spacing overflow', { dxM: 1e308, dyM: 1e308 }],
    ['spacing underflow', { dxM: 1e-200, dyM: 1e-200 }],
  ]
  for (const [name, run] of gridOperations) {
    for (const [label, patch] of invalid) {
      it(`${name} rejects ${label}`, () => {
        const grid = { ...g1, ...patch }
        rejected(() => run(grid), RangeError, /grid/, grid)
      })
    }
    it(`${name} accepts a geometrically consistent noncubic cell`, () => {
      const grid = Object.freeze({ ...g1, dxM: 0.1, dyM: 0.2, dzM: 0.3, cellVolumeM3: 0.006 })
      const before = snapshot(grid)
      run(grid)
      expect(snapshot(grid)).toBe(before)
    })
  }
})

describe('effective stress: derived-arithmetic rejection is atomic', () => {
  const max = Number.MAX_VALUE
  const workOverflowCases: readonly [string, Partial<api.SmallStrainPressureWorkInput>, RegExp][] = [
    ['normal increment subtraction', {
      previousEngineeringStrain: F([-max, 0, 0, 0, 0, 0]),
      trialEngineeringStrain: F([max, 0, 0, 0, 0, 0]),
    }, /strain increment/],
    ['normal increment sum', { trialEngineeringStrain: F([max, max, 0, 0, 0, 0]) }, /deltaVolumetricStrain/],
    ['mechanical pore-volume increment', {
      biotCoefficient: 1, trialEngineeringStrain: F([max, 0, 0, 0, 0, 0]),
    }, /mechanicalPoreVolumeIncrement/],
    ['reference-subtracted pressure, even with zero displacement', {
      trialEngineeringStrain: new Float64Array(6),
      previousPorePressurePa: F([max]), trialPorePressurePa: F([max]),
      referencePorePressurePa: -max,
    }, /incremental pressure/],
    ['full cell work', {
      biotCoefficient: 1, trialEngineeringStrain: F([1, 0, 0, 0, 0, 0]),
      previousPorePressurePa: F([max]), trialPorePressurePa: F([max]),
      referencePorePressurePa: 0,
    }, /pressureWorkByCell/],
    ['reference cell work', {
      biotCoefficient: 1, trialEngineeringStrain: F([1, 0, 0, 0, 0, 0]),
      previousPorePressurePa: F([0]), trialPorePressurePa: F([0]),
      referencePorePressurePa: max,
    }, /referencePressureWorkByCell/],
    ['incremental cell work', {
      biotCoefficient: 1, trialEngineeringStrain: F([1, 0, 0, 0, 0, 0]),
      previousPorePressurePa: F([max / 2]), trialPorePressurePa: F([max / 2]),
      referencePorePressurePa: -max / 2,
    }, /incrementalPressureWorkByCell/],
  ]
  for (const [name, patch, field] of workOverflowCases) {
    it(`rejects overflow of ${name}`, () => {
      const input = workInput(patch)
      rejected(() => api.smallStrainPressureWork(input), RangeError, field, input)
    })
  }
  for (const [label, pressure, reference, field] of [
    ['full', max, 0, /pressureWorkJ partial sum/],
    ['reference', 0, max, /referencePressureWorkJ partial sum/],
    ['incremental', max / 2, -max / 2, /incrementalPressureWorkJ partial sum/],
  ] as const) {
    it(`rejects ${label} total overflow despite finite individual cells`, () => {
      const input = workInput({
        grid: { ...g1, nx: 2 }, biotCoefficient: 1,
        previousEngineeringStrain: new Float64Array(12),
        trialEngineeringStrain: F([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
        previousPorePressurePa: F([pressure, pressure]), trialPorePressurePa: F([pressure, pressure]),
        referencePorePressurePa: reference,
      })
      rejected(() => api.smallStrainPressureWork(input), RangeError, field, input)
    })
  }

  it('rejects inverse effective-to-total overflow without modifying either input', () => {
    const stress = F([-max, 0, 0, 7, 8, 9]), pressure = F([max])
    rejected(() => api.effectiveToTotalStress(g1, stress, pressure), RangeError,
      /after pressure shift/, { stress, pressure })
  })

  for (const sign of [-1, 1]) {
    it(`keeps equal extreme phase pressures exact for sign ${sign}`, () => {
      for (const saturation of [0, 1e-12, 0.3, 0.9, 1]) {
        const result = api.evaluatePorePressure(
          pressureInput([sign * max], [sign * max], [saturation], 1),
        )
        expect(result.porePressurePa[0]).toBe(sign * max)
        expect(result.biotPressurePa[0]).toBe(sign * max)
      }
    })
  }
})
