import { describe, expect, it } from 'vitest'
import { ContinuumMechanics, DEFAULT_CONTINUUM_MATERIAL, returnMap } from '../../src/mechanics/continuum'

describe('three-dimensional brick mechanics', () => {
  it('preserves an equilibrated geostatic reference state', () => {
    const model = new ContinuumMechanics(2, 2, 2, 2, 2, 2)
    const result = model.solveTopTraction(0)
    expect(result.residualN).toBe(0)
    expect(result.geostaticResidualN).toBeLessThan(1e-8)
    expect(result.geostaticBaseReactionN).toBeCloseTo(-1200 * 9.80665 * 8, 4)
    expect(Math.max(...result.displacementM)).toBe(0)
  })

  it('passes a uniform stress/strain patch and independent uniaxial solution', () => {
    const material = { ...DEFAULT_CONTINUUM_MATERIAL, cohesionPa: 1e9 }
    const model = new ContinuumMechanics(1, 1, 1, 1, 1, 1, material)
    const result = model.solveTopTraction(1000)
    expect(result.residualN).toBeLessThan(0.05)
    expect(result.reactionN[2]).toBeCloseTo(-1000, 2)
    expect(result.stressPa[2]).toBeCloseTo(-1000, 2)
    expect(result.strain[2]).toBeCloseTo(-1000 / material.youngsPa, 6)
    expect(result.strain[0]).toBeCloseTo(material.poisson * 1000 / material.youngsPa, 6)
  })

  it('returns a frictional plastic stress to the yield surface and preserves unloading history', () => {
    const m = DEFAULT_CONTINUUM_MATERIAL
    const zero = new Float64Array(6)
    const trial = returnMap([-0.001, 0, -0.03, 0, 0, 0], zero, 0, m)
    expect(trial.yielded).toBe(true)
    expect(trial.hardening).toBeGreaterThan(0)
    const mean = (trial.stress[0] + trial.stress[1] + trial.stress[2]) / 3
    const q = Math.sqrt(1.5 * (trial.stress[0] - mean) ** 2 + 1.5 * (trial.stress[1] - mean) ** 2 + 1.5 * (trial.stress[2] - mean) ** 2)
    expect(Math.abs(q + m.frictionSlope * mean - m.cohesionPa - m.hardeningPa * trial.hardening)).toBeLessThan(1e-7)
    const unload = returnMap(trial.plastic, trial.plastic, trial.hardening, m)
    expect(unload.yielded).toBe(false)
    expect(unload.hardening).toBe(trial.hardening)
  })

  it('agrees across 3D meshes and an expanded domain for a uniform load', () => {
    const elastic = { ...DEFAULT_CONTINUUM_MATERIAL, cohesionPa: 1e9 }
    const coarse = new ContinuumMechanics(1, 1, 1, 1, 1, 1, elastic).solveTopTraction(1000)
    const fine = new ContinuumMechanics(2, 2, 2, 1, 1, 1, elastic).solveTopTraction(1000)
    const wider = new ContinuumMechanics(2, 2, 2, 2, 2, 1, elastic).solveTopTraction(1000)
    expect(Math.abs(coarse.strain[2] - fine.strain[2])).toBeLessThan(1e-8)
    expect(Math.abs(coarse.strain[2] - wider.strain[2])).toBeLessThan(1e-8)
    expect(fine.residualN).toBeLessThan(0.05)
    expect(wider.reactionN[2] + wider.appliedForceN[2]).toBeCloseTo(0, 2)
  })

  it('round trips all displacement and plastic history through a checkpoint', () => {
    const model = new ContinuumMechanics(1, 1, 1, 1, 1, 1)
    const loaded = model.solveTopTraction(18_000)
    expect(loaded.accumulatedPlasticStrain.some(v => v > 0)).toBe(true)
    const copy = new ContinuumMechanics(1, 1, 1, 1, 1, 1)
    copy.restore(model.checkpoint())
    expect(copy.checkpoint()).toEqual(model.checkpoint())
    expect(copy.solveTopTraction(18_000).displacementM).toEqual(model.solveTopTraction(18_000).displacementM)
    const unloaded = model.solveTopTraction(0)
    expect(unloaded.accumulatedPlasticStrain.some(v => v > 0)).toBe(true)
    expect(Math.max(...Array.from(unloaded.displacementM, Math.abs))).toBeGreaterThan(0)
  })

  it('keeps non-cubic geometry and distinct material instances consistent with the elastic patch solution', () => {
    const soft = { ...DEFAULT_CONTINUUM_MATERIAL, youngsPa: 800_000, poisson: 0.22, cohesionPa: 1e8 }
    const stiff = { ...DEFAULT_CONTINUUM_MATERIAL, youngsPa: 2_500_000, poisson: 0.37, cohesionPa: 1e9 }
    // Construct both before solving: shared operators must never leak across instances.
    const models = [
      new ContinuumMechanics(2, 3, 2, 1.4, 2.7, 0.8, soft, 950),
      new ContinuumMechanics(3, 2, 2, 2.1, 0.8, 1.6, stiff, 1450),
    ]
    const untouched = models[1].checkpoint()
    for (const [index, model] of models.entries()) {
      const traction = 1400
      const result = model.solveTopTraction(traction)
      const expectedVertical = -traction / model.material.youngsPa
      const expectedHorizontal = model.material.poisson * traction / model.material.youngsPa
      for (let element = 0; element < model.elementCount; element++) {
        const offset = element * 6
        expect(result.strain[offset]).toBeCloseTo(expectedHorizontal, 9)
        expect(result.strain[offset + 1]).toBeCloseTo(expectedHorizontal, 9)
        expect(result.strain[offset + 2]).toBeCloseTo(expectedVertical, 9)
        expect(result.stressPa[offset + 2]).toBeCloseTo(-traction, 4)
        for (let shear = 3; shear < 6; shear++) expect(Math.abs(result.strain[offset + shear])).toBeLessThan(1e-9)
      }
      expect(result.residualN).toBeLessThan(0.05)
      expect(result.reactionN[2]).toBeCloseTo(-traction * model.widthM * model.lengthM, 3)
      expect(result.geostaticResidualN).toBeLessThan(1e-8)
      expect(result.geostaticBaseReactionN).toBeCloseTo(-model.bulkDensityKgM3 * 9.80665 * model.widthM * model.lengthM * model.depthM, 5)
      expect(result.accumulatedPlasticStrain.every(value => value === 0)).toBe(true)
      if (index === 0) expect(models[1].checkpoint()).toEqual(untouched)
    }
  })
})
