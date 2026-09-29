import { describe, it, expect } from 'vitest'
import { initialFractureHistory, evaluateFractureContact } from '../../../src/physics-next/mechanics/fractureContact'
import type { FractureParameters, FractureHistory, FractureTrial } from '../../../src/physics-next/mechanics/fractureContact'
const F = (v: readonly number[]) => Float64Array.from(v)
const parameters: FractureParameters = {
  normalStiffnessPaPerM: 1e7, shearWeight: 4, peakNormalTractionPa: 1000,
  fractureEnergyJm2: 1, closurePenaltyPaPerM: 1e8, penetrationToleranceM: 1e-5,
  maxSeparationM: 0.01, parameterSetId: 'ANALYTIC-COHESIVE-FIXTURE',
  sourceReference: 'synthetic positive-energy fixture; not peat calibration', calibrationStatus: 'uncalibrated',
}
const frame = () => F([0, 1, 0, 0, 0, 1, 1, 0, 0])
function trial(separation: readonly number[], overrides: Partial<FractureTrial> = {}): FractureTrial {
  return {
    separationLocalM: F(separation), frame: frame(), parameters,
    previous: initialFractureHistory(parameters, 2), ...overrides,
  }
}
const near = (a: number, b: number, tol = 1e-9): void =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
function path(r: number, angle: number): number[] {
  return [r * Math.cos(angle), r * Math.sin(angle) / Math.sqrt(parameters.shearWeight), 0]
}
describe('mixed-mode irreversible cohesive surface with closure', () => {
  it('pristine identity and elastic opening have correct units and energy', () => {
    const zero = evaluateFractureContact(trial([0, 0, 0]))
    near(zero.recoverableEnergyJ, 0); expect(zero.damage).toBe(0)
    const a = evaluateFractureContact(trial([0.00005, 0, 0]))
    near(a.resistingTractionLocalPa[0], 500); near(a.recoverableEnergyJ, 0.025)
    near(a.fractureDissipationIncrementJ, 0); near(a.crackApertureM, 0.00005)
  })
  for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
    it(`mode angle ${angle}: finite peak and integrated fracture work equals Gc*A`, () => {
      let previous = initialFractureHistory(parameters, 2), work = 0, dissipation = 0, peak = 0
      for (let k = 1; k <= 1000; k++) {
        const separation = path(0.002 * k / 1000, angle)
        const r = evaluateFractureContact(trial(separation, { previous }))
        work += r.trapezoidalWorkJ; dissipation += r.fractureDissipationIncrementJ
        const effectiveTraction = r.resistingTractionLocalPa[0] * Math.cos(angle)
          + r.resistingTractionLocalPa[1] * Math.sin(angle) / Math.sqrt(parameters.shearWeight)
        peak = Math.max(peak, effectiveTraction)
        expect(r.damage).toBeGreaterThanOrEqual(0); expect(r.damage).toBeLessThanOrEqual(1)
        expect(r.fractureDissipationIncrementJ).toBeGreaterThanOrEqual(0)
        previous = r.next
      }
      near(peak, 1000); near(work, 2, 2e-8); near(dissipation, 2)
      const final = evaluateFractureContact(trial(path(0.003, angle), { previous }))
      expect(final.damage).toBe(1); near(final.recoverableEnergyJ, 0)
      for (const x of final.resistingTractionLocalPa) near(x, 0)
    })
  }
  it('mixed loading/unloading cannot heal or refund fracture dissipation', () => {
    let previous = initialFractureHistory(parameters, 2), lastDamage = 0, lastDissipation = 0
    for (const separation of [[0.0008, 0.0001, 0], [0.0002, 0, 0], [-1e-6, 0, 0],
      [0.0003, 0.0008, 0], [0, 0, 0], [0.003, 0, 0], [-1e-6, 0, 0], [0.0005, 0, 0]]) {
      const a = evaluateFractureContact(trial(separation, { previous }))
      expect(a.damage).toBeGreaterThanOrEqual(lastDamage)
      expect(a.cumulativeFractureDissipationJ).toBeGreaterThanOrEqual(lastDissipation)
      previous = a.next; lastDamage = a.damage; lastDissipation = a.cumulativeFractureDissipationJ
    }
    expect(lastDamage).toBe(1); near(lastDissipation, 2)
  })
  it('pure compression does not initiate damage and closes without tensile traction', () => {
    const r = evaluateFractureContact(trial([-1e-6, 0, 0]))
    expect(r.damage).toBe(0); expect(r.crackApertureM).toBe(0)
    near(r.contactPressurePa, 100); expect(r.resistingTractionLocalPa[0]).toBeLessThan(0)
    expect(r.tractionOnBPa[2]).toBeGreaterThan(0)
    expect(r.withinPenetrationTolerance).toBe(true)
    expect(evaluateFractureContact(trial([-0.001, 0, 0])).withinPenetrationTolerance).toBe(false)
  })
  it('fully damaged crack carries compressive normal contact but no cohesive shear', () => {
    const failed = evaluateFractureContact(trial([0.003, 0, 0]))
    const r = evaluateFractureContact(trial([-1e-6, 0.0001, 0], { previous: failed.next }))
    expect(r.damage).toBe(1); near(r.contactPressurePa, 100)
    near(r.resistingTractionLocalPa[1], 0); near(r.fractureDissipationIncrementJ, 0)
    expect(r.crackApertureM).toBe(0)
  })
  it('action/reaction and force rotation preserve local work and history', () => {
    const a = evaluateFractureContact(trial([0.0005, 0.0001, 0.0002]))
    for (let i = 0; i < 3; i++) near(a.forceOnAN[i] + a.forceOnBN[i], 0)
    const b = evaluateFractureContact(trial([0.0005, 0.0001, 0.0002], {
      frame: F([0, 0, -1, 0, 1, 0, 1, 0, 0]),
    }))
    near(b.forceOnBN[0], -a.forceOnBN[1]); near(b.forceOnBN[1], a.forceOnBN[0])
    near(b.forceOnBN[2], a.forceOnBN[2]); near(a.constitutiveWorkJ, b.constitutiveWorkJ)
  })
  for (const stage of ['loading', 'unloading', 'closed'] as const) {
    it(`${stage}: local tangent matches all nine finite differences`, () => {
      const previous = stage === 'loading' ? initialFractureHistory(parameters, 2)
        : evaluateFractureContact(trial([0.001, 0.0001, 0])).next
      const g = stage === 'closed' ? [-1e-6, 1e-5, 2e-5] : [0.0005, 0.00005, 0.0001]
      const input = trial(g, { previous }), r = evaluateFractureContact(input), h = 1e-9
      for (let k = 0; k < 3; k++) {
        const p = F(g), m = F(g); p[k] += h; m[k] -= h
        const a = evaluateFractureContact({ ...input, separationLocalM: p })
        const b = evaluateFractureContact({ ...input, separationLocalM: m })
        for (let i = 0; i < 3; i++) near((a.resistingTractionLocalPa[i] - b.resistingTractionLocalPa[i]) / (2 * h),
          r.resistingTangentPaPerM[3 * i + k], 5e-6)
      }
    })
  }
  it('coarse onset/failure crossing exposes quadrature error rather than claiming work closure', () => {
    const jump = evaluateFractureContact(trial([0.003, 0, 0]))
    near(jump.constitutiveWorkJ, 2)
    near(jump.trapezoidalWorkJ, 0)
    expect(Math.abs(jump.workQuadratureResidualJ)).toBeGreaterThan(1)
  })
  it('full fracture energy is independent of surface tessellation (one versus 64 patches)', () => {
    function full(n: number): number {
      let energy = 0
      for (let i = 0; i < n * n; i++) {
        const previous = initialFractureHistory(parameters, 1 / (n * n))
        energy += evaluateFractureContact(trial(path(0.003, Math.PI / 4), { previous })).fractureDissipationIncrementJ
      }
      return energy
    }
    near(full(1), 1); near(full(8), 1)
  })
  it('two surface mesh sizes meet a declared 2% energy gate against an analytic nonuniform field', () => {
    // Unit-square pre-existing interface. Midpoint samples of D(x)=Gc*x^2.
    // This is a surface-energy quadrature test, NOT global crack-path convergence.
    function energy(n: number): number {
      let result = 0
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const midpoint = (x + 0.5) / n
        const effective = 0.0001 + (0.002 - 0.0001) * midpoint * midpoint
        const previous = initialFractureHistory(parameters, 1 / (n * n))
        result += evaluateFractureContact(trial(path(effective, Math.PI / 4), { previous })).fractureDissipationIncrementJ
      }
      return result
    }
    const coarse = energy(4), fine = energy(8), analytic = 1 / 3
    near(coarse, 0.328125); near(fine, 0.33203125)
    expect(Math.abs(coarse - analytic) / analytic).toBeLessThanOrEqual(0.02)
    expect(Math.abs(fine - analytic) / analytic).toBeLessThanOrEqual(0.02)
    expect(Math.abs(coarse - fine) / Math.abs(fine)).toBeLessThanOrEqual(0.02)
  })
  it('restart is deterministic and result/input buffers never alias', () => {
    const a = evaluateFractureContact(trial([0.0008, 0.0001, 0]))
    const encoded: {
      schemaVersion: 1; parameterSignature: string; referenceAreaM2: number;
      maximumEffectiveSeparationM: number; previousSeparationLocalM: number[];
    } = JSON.parse(JSON.stringify({ ...a.next, previousSeparationLocalM: [...a.next.previousSeparationLocalM] }))
    const restored: FractureHistory = { ...encoded, previousSeparationLocalM: F(encoded.previousSeparationLocalM) }
    const input = trial([0.0004, 0.0001, 0], { previous: a.next })
    const before = [...a.next.previousSeparationLocalM], b = evaluateFractureContact(input)
    const c = evaluateFractureContact({ ...input, previous: restored })
    expect(b).toEqual(c); expect([...a.next.previousSeparationLocalM]).toEqual(before)
    const arrays = [b.next.previousSeparationLocalM, b.resistingTractionLocalPa, b.resistingTangentPaPerM,
      b.tractionOnBPa, b.forceOnAN, b.forceOnBN]
    expect(new Set(arrays.map(x => x.buffer)).size).toBe(arrays.length)
    for (const x of arrays) expect(x.buffer === a.next.previousSeparationLocalM.buffer).toBe(false)
  })
  it('rejects unphysical parameters and corrupted/mismatched history without input writes', () => {
    for (const bad of [
      { shearWeight: 0 }, { fractureEnergyJm2: 0.00001 }, { normalStiffnessPaPerM: 0 },
      { peakNormalTractionPa: NaN }, { maxSeparationM: 0.0002 }, { sourceReference: '' },
      { penetrationToleranceM: -1 },
    ]) expect(() => initialFractureHistory({ ...parameters, ...bad }, 1)).toThrow()
    const input = trial([0.0005, 0, 0]), before = [...input.previous.previousSeparationLocalM]
    for (const bad of [
      { separationLocalM: F([NaN, 0, 0]) }, { separationLocalM: F([1, 0, 0]) }, { separationLocalM: F([0, 0]) },
      { frame: new Float64Array(9) }, { previous: { ...input.previous, maximumEffectiveSeparationM: -1 } },
      { previous: { ...input.previous, previousSeparationLocalM: F([0.001, 0, 0]) } },
      { parameters: { ...parameters, closurePenaltyPaPerM: 2e8 } },
    ]) expect(() => evaluateFractureContact({ ...input, ...bad })).toThrow()
    expect([...input.previous.previousSeparationLocalM]).toEqual(before)
  })
})
