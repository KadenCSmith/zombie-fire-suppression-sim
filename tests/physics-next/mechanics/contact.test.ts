import { describe, it, expect } from 'vitest'
import { evaluateContact, initialContactState } from '../../../src/physics-next/mechanics/contact'
import type { ContactTrial, ContactInterfaceKind } from '../../../src/physics-next/mechanics/contact'
const F = (v: readonly number[]) => Float64Array.from(v)
const parameters = {
  normalPenaltyPaPerM: 1e8, tangentialPenaltyPaPerM: 1e7,
  frictionCoefficient: 0.5, penetrationToleranceM: 1e-5,
}
const near = (a: number, b: number, tol = 1e-10): void =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
function trial(overrides: Partial<ContactTrial> = {}): ContactTrial {
  return {
    kind: 'soil-soil', gapM: -1e-5, tangentialIncrementM: F([0, 0]),
    // n=+z, t1=+x, t2=+y; proper orthonormal frame.
    frame: F([0, 1, 0, 0, 0, 1, 1, 0, 0]), referenceAreaM2: 2,
    previous: initialContactState(), parameters, ...overrides,
  }
}
describe('local penalty contact with Coulomb friction', () => {
  for (const kind of ['soil-soil', 'soil-cap', 'soil-root', 'excavation'] as ContactInterfaceKind[]) {
    it(`${kind}: open contact has no tensile traction or force`, () => {
      const r = evaluateContact(trial({ kind, gapM: 0.001, tangentialIncrementM: F([1, 2]) }))
      for (const x of r.tractionOnBPa) near(x, 0)
      expect(r.next.active).toBe(false); expect(r.normalPressurePa).toBe(0)
      near(r.frictionDissipationJ, 0)
    })
  }
  it('analytic normal penalty equilibrium meets the declared penetration tolerance', () => {
    const imposedPressure = 500
    const r = evaluateContact(trial({ gapM: -imposedPressure / parameters.normalPenaltyPaPerM }))
    near(r.normalPressurePa, imposedPressure)
    near(r.forceOnBN[2], imposedPressure * 2)
    expect(r.withinPenetrationTolerance).toBe(true)
    const failed = evaluateContact(trial({ gapM: -1e-3 }))
    expect(failed.withinPenetrationTolerance).toBe(false)
    // A failed flag is NOT relabeled as an equilibrium solve.
  })
  it('stick stores energy; action/reaction are exactly opposite', () => {
    const r = evaluateContact(trial({ tangentialIncrementM: F([1e-6, -2e-6]) }))
    expect(r.sliding).toBe(false); near(r.forceOnBN[0], -20); near(r.forceOnBN[1], 40)
    for (let c = 0; c < 3; c++) near(r.forceOnAN[c] + r.forceOnBN[c], 0)
    near(r.frictionDissipationJ, 0)
    near(r.recoverableEnergyJ, (0.5 * 1e8 * 1e-10 + 0.5 * 1e7 * 5e-12) * 2)
  })
  it('sliding caps traction and has nonnegative Coulomb dissipation', () => {
    const r = evaluateContact(trial({ tangentialIncrementM: F([0.001, 0]) }))
    expect(r.sliding).toBe(true)
    near(Math.hypot(r.tractionOnBPa[0], r.tractionOnBPa[1]), 500)
    near(r.next.elasticSlipM[0], 500 / 1e7)
    near(r.frictionDissipationJ, 500 * (0.001 - 500 / 1e7) * 2)
    expect(r.frictionDissipationJ).toBeGreaterThanOrEqual(0)
  })
  it('zero friction permits free slip with no friction heat', () => {
    const r = evaluateContact(trial({
      tangentialIncrementM: F([0.001, 0.002]), parameters: { ...parameters, frictionCoefficient: 0 },
    }))
    near(r.forceOnBN[0], 0); near(r.forceOnBN[1], 0)
    near(r.frictionDissipationJ, 0)
    expect(r.next.accumulatedPlasticSlipM).toBeGreaterThan(0)
  })
  it('tracks separation release instead of silently deleting spring energy', () => {
    const closed = evaluateContact(trial({ tangentialIncrementM: F([1e-6, 2e-6]) }))
    const opened = evaluateContact(trial({ gapM: 1e-4, previous: closed.next }))
    near(opened.separationReleaseJ, 0.5 * 1e7 * 5e-12 * 2)
    near(opened.recoverableEnergyJ, 0)
    expect([...opened.next.elasticSlipM]).toEqual([0, 0])
    expect(opened.next.active).toBe(false)
  })
  it('tangential discrete work splits into storage, friction and numerical loss', () => {
    const a = evaluateContact(trial({ tangentialIncrementM: F([1e-6, 2e-6]) }))
    const b = evaluateContact(trial({ previous: a.next, tangentialIncrementM: F([0.001, -0.002]) }))
    const w = -2 * (b.tractionOnBPa[0] * 0.001 + b.tractionOnBPa[1] * -0.002)
    near(w, b.recoverableEnergyJ - a.recoverableEnergyJ
      + b.frictionDissipationJ + b.algorithmicDissipationJ)
  })
  it('rotating the frame rotates forces without changing local history/energy', () => {
    const a = evaluateContact(trial({ tangentialIncrementM: F([1e-6, -2e-6]) }))
    // Rotate original frame +90 degrees about global z.
    const b = evaluateContact(trial({ frame: F([0, 0, -1, 0, 1, 0, 1, 0, 0]), tangentialIncrementM: F([1e-6, -2e-6]) }))
    near(b.forceOnBN[0], -a.forceOnBN[1]); near(b.forceOnBN[1], a.forceOnBN[0])
    near(b.forceOnBN[2], a.forceOnBN[2]); near(a.recoverableEnergyJ, b.recoverableEnergyJ)
    expect([...a.next.elasticSlipM]).toEqual([...b.next.elasticSlipM])
  })
  for (const slip of [[1e-6, 2e-6], [0.001, 0.002]]) {
    it(`local tangent agrees with finite differences for slip ${slip}`, () => {
      const input = trial({ tangentialIncrementM: F(slip) }), r = evaluateContact(input), h = 1e-9
      const resisting = (v: ReturnType<typeof evaluateContact>) => [-v.normalPressurePa, -v.tractionOnBPa[0], -v.tractionOnBPa[1]]
      for (let dof = 0; dof < 3; dof++) {
        const ps = F(slip), ms = F(slip)
        if (dof > 0) { ps[dof - 1] += h; ms[dof - 1] -= h }
        const p = resisting(evaluateContact({ ...input, gapM: input.gapM + (dof === 0 ? h : 0), tangentialIncrementM: ps }))
        const m = resisting(evaluateContact({ ...input, gapM: input.gapM - (dof === 0 ? h : 0), tangentialIncrementM: ms }))
        for (let row = 0; row < 3; row++) near((p[row] - m[row]) / (2 * h), r.resistingTangentPaPerM[3 * row + dof], 2e-7)
      }
    })
  }
  it('repeated trials are deterministic, do not consume history and own storage', () => {
    const previous = evaluateContact(trial({ tangentialIncrementM: F([1e-6, 2e-6]) })).next
    const before = [...previous.elasticSlipM], input = trial({ previous, tangentialIncrementM: F([0.001, 0]) })
    const a = evaluateContact(input), b = evaluateContact(input)
    expect(a).toEqual(b); expect([...previous.elasticSlipM]).toEqual(before)
    const arrays = [a.next.elasticSlipM, a.forceOnAN, a.forceOnBN, a.tractionOnBPa, a.resistingTangentPaPerM]
    expect(new Set(arrays.map(x => x.buffer)).size).toBe(arrays.length)
    for (const x of arrays) expect(x.buffer === previous.elasticSlipM.buffer).toBe(false)
    a.next.elasticSlipM.fill(100); expect([...previous.elasticSlipM]).toEqual(before)
  })
  it('rejects malformed frames, histories, lengths, nonfinite values and parameters', () => {
    for (const overrides of [
      { gapM: NaN }, { referenceAreaM2: 0 }, { tangentialIncrementM: F([1]) },
      { frame: F([1, 0, 0, 0, 1, 0, 0, 0, -1]) }, { frame: new Float64Array(9) },
      { previous: { ...initialContactState(), elasticSlipM: F([1, 0]) } },
      { previous: { ...initialContactState(), accumulatedPlasticSlipM: -1 } },
      { parameters: { ...parameters, frictionCoefficient: -1 } },
      { parameters: { ...parameters, tangentialPenaltyPaPerM: 0 } },
      { parameters: { ...parameters, penetrationToleranceM: -1 } },
      { gapM: -1e308 },
    ]) expect(() => evaluateContact(trial(overrides))).toThrow()
  })
})
