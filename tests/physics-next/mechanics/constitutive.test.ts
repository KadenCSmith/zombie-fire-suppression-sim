import { describe, it, expect } from 'vitest'
import { initialPeatHistory, evaluatePeatConstitutive } from '../../../src/physics-next/mechanics/constitutive'
import { assembleFiniteStrainHex8 } from '../../../src/physics-next/mechanics/finiteStrain'
import type { PeatParameters, PeatHistory, PeatTrial } from '../../../src/physics-next/mechanics/constitutive'
const F = (x: readonly number[]) => Float64Array.from(x)
const identity = () => F([1, 0, 0, 0, 1, 0, 0, 0, 1])
function diagonal(values: readonly number[]): Float64Array {
  const c = new Float64Array(36)
  for (let i = 0; i < 6; i++) c[6 * i + i] = values[i]
  return c
}
function parameters(branches = true): PeatParameters {
  return {
    equilibriumStiffnessPa: diagonal([100000, 200000, 300000, 40000, 50000, 60000]),
    branches: branches ? [{ stiffnessPa: diagonal([50000, 100000, 150000, 20000, 25000, 30000]), relaxationTimeS: 10 }] : [],
    materialFrame: identity(), maxGreenEngineeringNorm: 0.2, maxAbsPK2Pa: 1e6,
    temperatureRangeK: [270, 320], liquidSaturationRange: [0, 1],
    provenance: {
      parameterSetId: 'ANALYTIC-FIXTURE-NOT-CALIBRATION', calibrationStatus: 'uncalibrated',
      equilibriumSource: 'positive diagonal test fixture', branchSources: branches ? ['analytic Maxwell fixture'] : [],
      materialFrameSource: 'reference-axis test fixture', applicabilitySource: 'numerical test bounds only',
    },
  }
}
function stretch(e: number): Float64Array {
  const f = identity(); f[0] = Math.sqrt(1 + 2 * e); return f
}
function trial(p = parameters(), override: Partial<PeatTrial> = {}): PeatTrial {
  return {
    parameters: p, deformationGradient: stretch(0.01), previous: initialPeatHistory(p),
    dtS: 1, temperatureK: 293, liquidSaturation: 0.5, ...override,
  }
}
const near = (a: number, b: number, tol = 1e-9): void =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
function multiply(a: Float64Array, b: Float64Array): Float64Array {
  const c = new Float64Array(9)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) c[3 * i + j] += a[3 * i + k] * b[3 * k + j]
  return c
}
describe('bounded anisotropic generalized-Maxwell peat surrogate', () => {
  it('elastic no-branch limit gives analytic anisotropic PK2 and energy', () => {
    const p = parameters(false), r = evaluatePeatConstitutive(trial(p))
    near(r.materialPK2Pa[0], 1000); near(r.storedEnergyJm3, 5)
    near(r.physicalDissipationJm3, 0)
    const f = identity(); f[4] = Math.sqrt(1.02)
    const y = evaluatePeatConstitutive(trial(p, { deformationGradient: f }))
    near(y.materialPK2Pa[1], 2000)
  })
  it('zero dt freezes viscous strain and gives instantaneous elastic stiffness', () => {
    const r = evaluatePeatConstitutive(trial(parameters(), { dtS: 0 }))
    near(r.materialPK2Pa[0], 1500); near(r.algorithmicStiffnessPa[0], 150000)
    near(r.physicalDissipationJm3, 0)
    expect([...r.next.viscousEngineeringStrain]).toEqual([0, 0, 0, 0, 0, 0])
  })
  it('constant strain relaxes according to the exact backward-Euler recurrence', () => {
    const p = parameters()
    let old = evaluatePeatConstitutive(trial(p, { dtS: 0 })).next
    for (let n = 1; n <= 20; n++) {
      const r = evaluatePeatConstitutive(trial(p, { previous: old, dtS: 10 }))
      near(r.materialPK2Pa[0], 1000 + 500 * 0.5 ** n)
      expect(r.physicalDissipationJm3).toBeGreaterThanOrEqual(0)
      old = r.next
    }
  })
  it('time refinement converges toward continuous exponential relaxation', () => {
    const p = parameters(), exact = 1000 + 500 * Math.exp(-1)
    function solve(n: number): number {
      let old = evaluatePeatConstitutive(trial(p, { dtS: 0 })).next
      let stress = 0
      for (let k = 0; k < n; k++) {
        const r = evaluatePeatConstitutive(trial(p, { previous: old, dtS: 10 / n }))
        old = r.next; stress = r.materialPK2Pa[0]
      }
      return Math.abs(stress - exact)
    }
    expect(solve(40)).toBeLessThan(solve(10))
    expect(solve(160)).toBeLessThan(solve(40))
  })
  it('creeps under prescribed material PK2 toward equilibrium compliance', () => {
    const p = parameters(), load = 1000, a = 0.5
    let old = evaluatePeatConstitutive(trial(p, { deformationGradient: stretch(load / 150000), dtS: 0 })).next
    let previousStrain = old.materialEngineeringStrain[0]
    for (let n = 0; n < 80; n++) {
      const e = (load + a * 50000 * old.viscousEngineeringStrain[0]) / (100000 + a * 50000)
      const r = evaluatePeatConstitutive(trial(p, { deformationGradient: stretch(e), previous: old, dtS: 10 }))
      near(r.materialPK2Pa[0], load)
      expect(e + 1e-14).toBeGreaterThanOrEqual(previousStrain)
      old = r.next; previousStrain = e
    }
    near(previousStrain, load / 100000, 1e-8)
  })
  it('very slow and very fast increments have bounded limiting stiffness', () => {
    const fast = evaluatePeatConstitutive(trial(parameters(), { dtS: 1e-12 }))
    const slow = evaluatePeatConstitutive(trial(parameters(), { dtS: 1e12 }))
    near(fast.materialPK2Pa[0], 1500, 1e-10)
    near(slow.materialPK2Pa[0], 1000, 1e-10)
    expect(slow.algorithmicStiffnessPa[0]).toBeGreaterThanOrEqual(100000)
    expect(fast.algorithmicStiffnessPa[0]).toBeLessThanOrEqual(150000)
  })
  it('dissipation and discrete energy balance survive nonmonotone multiaxial history', () => {
    const p = parameters()
    // Add symmetric normal coupling while retaining strict SPD.
    p.equilibriumStiffnessPa[1] = p.equilibriumStiffnessPa[6] = 10000
    let old = initialPeatHistory(p)
    for (let n = 0; n < 64; n++) {
      const f = F([1 + 0.02 * Math.sin(n), 0.01 * Math.cos(0.4 * n), 0,
        0, 1 + 0.01 * Math.cos(n), 0.005 * Math.sin(n), 0, 0, 1])
      const r = evaluatePeatConstitutive(trial(p, { previous: old, deformationGradient: f, dtS: 0.2 + (n % 5) }))
      expect(r.physicalDissipationJm3).toBeGreaterThanOrEqual(0)
      expect(r.algorithmicDissipationJm3).toBeGreaterThanOrEqual(0)
      near(r.workBalanceResidualJm3, 0, 1e-8)
      expect(r.next.accumulatedDissipationJm3).toBeGreaterThanOrEqual(old.accumulatedDissipationJm3)
      old = r.next
    }
  })
  it('rigid motion creates no material strain energy; superposed rotation is objective', () => {
    const p = parameters(), q = F([0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1])
    const rigid = evaluatePeatConstitutive(trial(p, { deformationGradient: q }))
    near(rigid.storedEnergyJm3, 0)
    const f = F([1.02, 0.01, 0, 0, 0.99, 0.005, 0, 0, 1.01])
    const a = evaluatePeatConstitutive(trial(p, { deformationGradient: f }))
    const b = evaluatePeatConstitutive(trial(p, { deformationGradient: multiply(q, f) }))
    const rotated = multiply(q, a.pk1Pa)
    for (let i = 0; i < 9; i++) near(b.pk1Pa[i], rotated[i], 2e-8)
    near(a.storedEnergyJm3, b.storedEnergyJm3)
  })
  it('material axes control anisotropy rather than following spatial rotation', () => {
    const p = parameters(false)
    const a = evaluatePeatConstitutive(trial(p))
    const rotated = { ...p, materialFrame: F([0, -1, 0, 1, 0, 0, 0, 0, 1]) }
    const b = evaluatePeatConstitutive(trial(rotated))
    near(b.storedEnergyJm3, 2 * a.storedEnergyJm3)
  })
  it('algorithmic PK1 tangent and incremental potential match finite differences', () => {
    const p = parameters(), f = F([1.02, 0.01, 0.003, 0.001, 0.99, 0.005, 0, 0.002, 1.01])
    const input = trial(p, { deformationGradient: f, dtS: 2 }), r = evaluatePeatConstitutive(input), h = 1e-6
    for (let k = 0; k < 9; k++) {
      const plus = f.slice(), minus = f.slice(); plus[k] += h; minus[k] -= h
      const a = evaluatePeatConstitutive({ ...input, deformationGradient: plus })
      const b = evaluatePeatConstitutive({ ...input, deformationGradient: minus })
      near((a.incrementalPotentialJm3 - b.incrementalPotentialJm3) / (2 * h), r.pk1Pa[k], 4e-7)
      for (let i = 0; i < 9; i++) near((a.pk1Pa[i] - b.pk1Pa[i]) / (2 * h), r.tangentPa[9 * i + k], 5e-7)
    }
  })
  it('JSON history reconstruction reproduces restart exactly and owns arrays', () => {
    const p = parameters(), a = evaluatePeatConstitutive(trial(p))
    const encoded: {
      schemaVersion: 1; parameterSignature: string; materialEngineeringStrain: number[];
      viscousEngineeringStrain: number[]; accumulatedDissipationJm3: number;
    } = JSON.parse(JSON.stringify({
      ...a.next, materialEngineeringStrain: [...a.next.materialEngineeringStrain],
      viscousEngineeringStrain: [...a.next.viscousEngineeringStrain],
    }))
    const restored: PeatHistory = {
      ...encoded, materialEngineeringStrain: F(encoded.materialEngineeringStrain),
      viscousEngineeringStrain: F(encoded.viscousEngineeringStrain),
    }
    const before = [...a.next.viscousEngineeringStrain]
    const b = evaluatePeatConstitutive(trial(p, { previous: a.next }))
    const c = evaluatePeatConstitutive(trial(p, { previous: restored }))
    expect(b).toEqual(c); expect([...a.next.viscousEngineeringStrain]).toEqual(before)
    const arrays = [b.pk1Pa, b.tangentPa, b.materialPK2Pa, b.effectiveCauchyPa, b.algorithmicStiffnessPa,
      b.next.materialEngineeringStrain, b.next.viscousEngineeringStrain]
    expect(new Set(arrays.map(v => v.buffer)).size).toBe(arrays.length)
    for (const v of arrays) expect(v.buffer === a.next.viscousEngineeringStrain.buffer).toBe(false)
  })
  it('rejects parameter changes, non-SPD stiffness, unsafe history and out-of-domain trials', () => {
    const p = parameters(), input = trial(p)
    const nonsymmetric = new Float64Array(p.equilibriumStiffnessPa); nonsymmetric[1] = 1e5
    const indefinite = new Float64Array(p.equilibriumStiffnessPa); indefinite[0] = -1
    for (const bad of [
      { equilibriumStiffnessPa: nonsymmetric }, { equilibriumStiffnessPa: indefinite },
      { maxGreenEngineeringNorm: 0.5 }, { maxAbsPK2Pa: -1 },
      { provenance: { ...p.provenance, equilibriumSource: '' } },
      { branches: [{ ...p.branches[0], relaxationTimeS: 0 }] },
      { materialFrame: F([1, 0, 0, 0, 1, 0, 0, 0, -1]) },
    ]) expect(() => initialPeatHistory({ ...p, ...bad })).toThrow()
    for (const bad of [
      { dtS: -1 }, { temperatureK: 500 }, { liquidSaturation: -0.1 },
      { deformationGradient: stretch(0.3) }, { deformationGradient: new Float64Array(8) },
      { previous: { ...input.previous, accumulatedDissipationJm3: -1 } },
      { previous: { ...input.previous, viscousEngineeringStrain: new Float64Array(5) } },
      { previous: { ...input.previous, parameterSignature: 'wrong' } },
    ]) expect(() => evaluatePeatConstitutive({ ...input, ...bad })).toThrow()
    const changed = { ...p, maxAbsPK2Pa: p.maxAbsPK2Pa + 1 }
    expect(() => evaluatePeatConstitutive({ ...input, parameters: changed })).toThrow(/signature/)
  })
})

describe('constitutive cross-module and multibranch checks', () => {
  it('two relaxation times superpose according to the analytic recurrence', () => {
    const base = parameters()
    const p: PeatParameters = {
      ...base, branches: [
        ...base.branches,
        { stiffnessPa: diagonal([20000, 30000, 40000, 10000, 12000, 14000]), relaxationTimeS: 2 },
      ],
      provenance: { ...base.provenance, branchSources: ['branch 1 fixture', 'branch 2 fixture'] },
    }
    const r = evaluatePeatConstitutive(trial(p, { dtS: 2 }))
    near(r.materialPK2Pa[0], 1000 + 500 / 1.2 + 200 / 2)
    near(r.algorithmicStiffnessPa[0], 100000 + 50000 / 1.2 + 20000 / 2)
    expect(r.next.viscousEngineeringStrain.length).toBe(12)
    near(r.workBalanceResidualJm3, 0, 1e-8)
  })
  it('feeds the owned Hex8 callback without changing shared or committed state', () => {
    const p = parameters(), old = initialPeatHistory(p)
    const nodes = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
    const u = new Float64Array(24)
    for (let a = 0; a < 8; a++) u[3 * a] = (Math.sqrt(1.02) - 1) * nodes[a][0]
    const call = (displacementM: Float64Array) => assembleFiniteStrainHex8({
      displacementM, dimensionsM: [1, 1, 1],
      material: deformationGradient => evaluatePeatConstitutive(trial(p, { previous: old, deformationGradient })),
    })
    const a = call(u), material = evaluatePeatConstitutive(trial(p))
    near(a.elasticEnergyJ, material.storedEnergyJm3)
    const h = 1e-6, plus = u.slice(), minus = u.slice(); plus[3] += h; minus[3] -= h
    const b = call(plus), c = call(minus)
    for (let i = 0; i < 24; i++) near((b.internalForceN[i] - c.internalForceN[i]) / (2 * h), a.tangentNm[i * 24 + 3], 5e-6)
    expect([...old.viscousEngineeringStrain]).toEqual([0, 0, 0, 0, 0, 0])
  })
  it('rejects a stress-domain breach without mutating inputs', () => {
    const p = { ...parameters(), maxAbsPK2Pa: 10 }, input = trial(p)
    const before = [...input.previous.materialEngineeringStrain]
    expect(() => evaluatePeatConstitutive(input)).toThrow(/stress exceeds/)
    expect([...input.previous.materialEngineeringStrain]).toEqual(before)
  })
})
