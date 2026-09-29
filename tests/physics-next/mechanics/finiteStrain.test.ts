import { describe, it, expect } from 'vitest'
import * as mechanics from '../../../src/physics-next/mechanics/index'
import * as pressure from '../../../src/physics-next/mechanics/effectiveStress'
import * as finite from '../../../src/physics-next/mechanics/finiteStrain'
import * as contact from '../../../src/physics-next/mechanics/contact'
import * as peat from '../../../src/physics-next/mechanics/constitutive'
import * as fracture from '../../../src/physics-next/mechanics/fractureContact'
import {
  finiteStrainKinematics, neoHookeanPoint, assembleFiniteStrainHex8, finiteStrainPressureTransfer,
} from '../../../src/physics-next/mechanics/finiteStrain'
const F = (x: readonly number[]): Float64Array => Float64Array.from(x)
const identity = (): Float64Array => F([1, 0, 0, 0, 1, 0, 0, 0, 1])
const mat = { shearModulusPa: 40000, lameLambdaPa: 60000 }
const near = (a: number, b: number, tol = 1e-8): void =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
const dims = [2, 3, 4] as const
function affine(f: Float64Array, translation = [0, 0, 0]): Float64Array {
  const u = new Float64Array(24)
  for (let a = 0; a < 8; a++) for (let i = 0; i < 3; i++) {
    u[3 * a + i] = translation[i] - corners[a][i] * dims[i]
    for (let j = 0; j < 3; j++) u[3 * a + i] += f[3 * i + j] * corners[a][j] * dims[j]
  }
  return u
}
function assemble(u: Float64Array, pressure = 0) {
  return assembleFiniteStrainHex8({
    displacementM: u, dimensionsM: dims,
    material: f => neoHookeanPoint(f, mat), biotPressurePa: pressure,
  })
}
function multiply(a: Float64Array, b: Float64Array): Float64Array {
  const c = new Float64Array(9)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    c[3 * i + j] += a[3 * i + k] * b[3 * k + j]
  }
  return c
}
describe('finite-strain material and total-Lagrangian Hex8', () => {
  it('identity has zero strain, stress and energy', () => {
    const r = neoHookeanPoint(identity(), mat), k = finiteStrainKinematics(identity())
    near(k.jacobian, 1)
    for (const x of r.pk1Pa) near(x, 0)
    for (const x of k.greenEngineeringStrain) near(x, 0)
    near(r.storedEnergyJm3, 0)
  })
  for (const angle of [0.1, 0.7, Math.PI / 2, Math.PI]) {
    it(`rigid rotation/translation has zero energy at angle ${angle}`, () => {
      const c = Math.cos(angle), s = Math.sin(angle), f = F([c, -s, 0, s, c, 0, 0, 0, 1])
      const r = assemble(affine(f, [0.2, -0.3, 0.4]))
      near(r.elasticEnergyJ, 0, 1e-8)
      for (const x of r.greenEngineeringStrain) near(x, 0)
      for (const x of r.internalForceN) near(x, 0, 2e-8)
    })
  }
  it('homogeneous extension matches analytic energy and PK1', () => {
    const stretch = 1.2, f = identity(); f[0] = stretch
    const r = neoHookeanPoint(f, mat), log = Math.log(stretch)
    near(r.storedEnergyJm3, 0.5 * mat.shearModulusPa * (stretch ** 2 - 1)
      - mat.shearModulusPa * log + 0.5 * mat.lameLambdaPa * log ** 2)
    near(r.pk1Pa[0], mat.shearModulusPa * stretch + (mat.lameLambdaPa * log - mat.shearModulusPa) / stretch)
    const a = assemble(affine(f))
    near(a.elasticEnergyJ, 24 * r.storedEnergyJm3)
    near(a.currentVolumeM3, 24 * stretch)
    near(a.greenEngineeringStrain[0], 0.5 * (stretch ** 2 - 1))
  })
  it('superposed rotation gives P*=Q P and invariant material energy', () => {
    const f = F([1.1, 0.03, 0.01, 0.02, 0.98, 0.04, 0, 0.01, 1.03])
    const q = F([0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1])
    const a = neoHookeanPoint(f, mat), b = neoHookeanPoint(multiply(q, f), mat)
    const rotated = multiply(q, a.pk1Pa)
    near(a.storedEnergyJm3, b.storedEnergyJm3)
    for (let i = 0; i < 9; i++) near(b.pk1Pa[i], rotated[i])
  })
  it('material tangent matches all 81 finite-difference entries', () => {
    const f = F([1.1, 0.03, 0.01, 0.02, 0.98, 0.04, 0, 0.01, 1.03])
    const r = neoHookeanPoint(f, mat), h = 1e-6
    for (let k = 0; k < 9; k++) {
      const plus = f.slice(), minus = f.slice(); plus[k] += h; minus[k] -= h
      const p = neoHookeanPoint(plus, mat), m = neoHookeanPoint(minus, mat)
      near((p.storedEnergyJm3 - m.storedEnergyJm3) / (2 * h), r.pk1Pa[k], 2e-7)
      for (let i = 0; i < 9; i++) near((p.pk1Pa[i] - m.pk1Pa[i]) / (2 * h), r.tangentPa[9 * i + k], 3e-7)
    }
  })
  for (const pressure of [0, 12000]) {
    it(`assembled tangent/energy derivatives and force balance at frozen pressure ${pressure}`, () => {
      const u = affine(F([1.1, 0.04, 0, 0, 0.98, 0.02, 0, 0, 1.02]))
      // Nonaffine perturbation tests the eight distinct quadrature evaluations.
      u[7] += 0.005; u[19] -= 0.002
      const a = assemble(u, pressure), h = 1e-6
      for (let dof = 0; dof < 24; dof++) {
        const p = u.slice(), m = u.slice(); p[dof] += h; m[dof] -= h
        const plus = assemble(p, pressure), minus = assemble(m, pressure)
        near((plus.elasticEnergyJ + plus.pressurePotentialJ - minus.elasticEnergyJ - minus.pressurePotentialJ) / (2 * h),
          a.internalForceN[dof], 3e-6)
        for (let r = 0; r < 24; r++) {
          near((plus.internalForceN[r] - minus.internalForceN[r]) / (2 * h), a.tangentNm[r * 24 + dof], 3e-6)
          near(a.tangentNm[r * 24 + dof], a.tangentNm[dof * 24 + r], 1e-9)
        }
      }
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let node = 0; node < 8; node++) sum += a.internalForceN[3 * node + c]
        near(sum, 0, 1e-7)
      }
    })
  }
  it('pressure subtracts normals only and is not hidden in skeleton energy', () => {
    const a = assemble(affine(identity()), 1000)
    for (let q = 0; q < 8; q++) for (let c = 0; c < 6; c++) {
      near(a.totalCauchyPa[6 * q + c], c < 3 ? -1000 : 0)
      near(a.effectiveCauchyPa[6 * q + c], 0)
    }
    near(a.elasticEnergyJ, 0); near(a.pressurePotentialJ, 0)
  })
  it('rejects inverted, singular, overcompressed and ill-conditioned F', () => {
    for (const f of [F([-1, 0, 0, 0, 1, 0, 0, 0, 1]), F([0, 0, 0, 0, 1, 0, 0, 0, 1]),
      F([0.01, 0, 0, 0, 1, 0, 0, 0, 1]), F([1e-7, 0, 0, 0, 1e7, 0, 0, 0, 1])]) {
      expect(() => finiteStrainKinematics(f)).toThrow(RangeError)
      expect(() => assemble(affine(f))).toThrow(RangeError)
    }
  })
  it('rejects malformed dimensions, material outputs and parameters', () => {
    expect(() => neoHookeanPoint(new Float64Array(8), mat)).toThrow()
    const bad = identity(); bad[3] = NaN
    expect(() => neoHookeanPoint(bad, mat)).toThrow()
    expect(() => neoHookeanPoint(identity(), { ...mat, shearModulusPa: 0 })).toThrow()
    expect(() => neoHookeanPoint(identity(), { ...mat, lameLambdaPa: -1 })).toThrow()
    expect(() => finiteStrainKinematics(identity(), { minJ: 0, maxJ: 2, maxCondition: 100 })).toThrow()
    expect(() => assembleFiniteStrainHex8({
      displacementM: new Float64Array(24), dimensionsM: [1, 0, 1],
      material: f => neoHookeanPoint(f, mat),
    })).toThrow()
    expect(() => assembleFiniteStrainHex8({
      displacementM: new Float64Array(24), dimensionsM: [1, 1, 1],
      material: () => ({ pk1Pa: new Float64Array(8), tangentPa: new Float64Array(81), storedEnergyJm3: 0 }),
    })).toThrow()
  })
  it('owns returned buffers and preserves input on success and failure', () => {
    const u = affine(identity()), before = [...u], a = assemble(u)
    expect([...u]).toEqual(before)
    const arrays = [a.internalForceN, a.tangentNm, a.deformationGradient, a.greenEngineeringStrain,
      a.effectiveCauchyPa, a.totalCauchyPa, a.jacobian]
    expect(new Set(arrays.map(x => x.buffer)).size).toBe(arrays.length)
    for (const array of arrays) expect(array.buffer === u.buffer).toBe(false)
    const f = identity(), k = finiteStrainKinematics(f)
    k.deformationGradient[0] = 9; k.inverseF[0] = 2
    expect([...f]).toEqual([...identity()])
    expect(() => assembleFiniteStrainHex8({
      displacementM: u, dimensionsM: [1, -1, 1], material: v => neoHookeanPoint(v, mat),
    })).toThrow()
    expect([...u]).toEqual(before)
  })
})

describe('finite pressure/volume work', () => {
  const fixture = {
    previousJ: 1, trialJ: 1.1, referenceVolumeM3: 2,
    previousPorePressurePa: 100000, trialPorePressurePa: 200000,
    referencePorePressurePa: 100000, biotCoefficient: 0.8,
  }
  it('uses deltaJ, fixed alpha and opposite thermal transfer', () => {
    const a = finiteStrainPressureTransfer(fixture)
    near(a.mechanicalPoreVolumeIncrementM3, 0.16)
    near(a.pressureWorkJ, 24000); near(a.thermalEnergyTransferJ, -24000)
    near(a.referencePressureWorkJ, 16000); near(a.incrementalPressureWorkJ, 8000)
    const b = finiteStrainPressureTransfer({ ...fixture, previousJ: 1.1, trialJ: 1 })
    near(b.pressureWorkJ, -a.pressureWorkJ)
  })
  it('matches frozen pressure load potential change with opposite sign', () => {
    const u0 = affine(identity()), f = identity(); f[0] = 1.1
    const before = assemble(u0, 80000), after = assemble(affine(f), 80000)
    const w = finiteStrainPressureTransfer({
      ...fixture, referenceVolumeM3: 24, trialPorePressurePa: 100000,
    })
    near(w.pressureWorkJ, -(after.pressurePotentialJ - before.pressurePotentialJ))
  })
  it('rejects nonfinite/invalid scalars and finite-input arithmetic overflow', () => {
    for (const key of Object.keys(fixture) as Array<keyof typeof fixture>) {
      expect(() => finiteStrainPressureTransfer({ ...fixture, [key]: NaN })).toThrow()
    }
    for (const bad of [{ trialJ: -1 }, { referenceVolumeM3: 0 }, { biotCoefficient: 1.1 },
      { referenceVolumeM3: 1e308, trialJ: 20 }]) {
      expect(() => finiteStrainPressureTransfer({ ...fixture, ...bad })).toThrow()
    }
    expect(finiteStrainPressureTransfer({ ...fixture, biotCoefficient: 0 }).pressureWorkJ).toBe(0)
  })
})

describe('mechanics public exports', () => {
  it('re-exports exactly the local implementations without activating a solver', () => {
    const expected = { ...pressure, ...finite, ...contact, ...peat, ...fracture }
    expect(Object.keys(mechanics).sort()).toEqual(Object.keys(expected).sort())
    for (const name of Object.keys(expected) as Array<keyof typeof expected>) {
      expect(mechanics[name]).toBe(expected[name])
    }
  })
})
