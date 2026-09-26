import { describe, expect, it } from 'vitest'
import { createDefaultScenario, createSimulation, scenarioFromJSON, scenarioToJSON, Simulation, validateScenario } from '../../src/sim'
import { DEFAULT_MATERIALS, continuumMaterial, dryBasisMoisture, peatPorosity, resolveMaterials, saturationFromDryBasis } from '../../src/sim/materials'
import { applyPropertyEdits, editableProperties, MATERIAL_SOURCES, parameterAudit } from '../../src/sim/materialEvidence'
import { RESEARCH_PROFILES, stageResearchProfile } from '../../src/sim/researchProfiles'
import { ContinuumMechanics } from '../../src/mechanics/continuum'
import { runFastEvent } from '../../src/fastEvent'

function small() {
  const s = createDefaultScenario()
  s.domain.nx = 4; s.domain.ny = 4; s.domain.nz = 4
  return s
}

describe('material inputs and evidence', () => {
  it('uses additive solid specific volumes and round-trips dry-mass moisture', () => {
    const phi = peatPorosity(500, 0.5, DEFAULT_MATERIALS)
    expect(phi).toBeCloseTo(1 - 500 * (0.5 / 1500 + 0.5 / 2650), 14)
    const mc = dryBasisMoisture(0.3, phi, 500, 1000)
    expect(saturationFromDryBasis(mc, phi, 500, 1000)).toBeCloseTo(0.3, 14)
    expect(peatPorosity(50, 0.98, DEFAULT_MATERIALS)).toBeGreaterThan(0.95)
    const s = small(); s.peatRegions[0].bulkDensityKgM3 = 50
    expect(validateScenario(s).errors.join(' ')).toMatch(/porosity/)
  })

  it('preserves legacy material values and reproducible checkpoint continuation', () => {
    for (const legacy of [false, true]) {
      const s = small()
      if (legacy) delete s.materialProperties
      else s.materialProperties = { gasViscosityPaS: 3e-5, waterHeatCapacityJKgK: 4300 }
      const run = createSimulation(s); run.advance(20)
      const restored = Simulation.restore(JSON.parse(JSON.stringify(run.serialize())))
      run.advance(20); restored.advance(20)
      expect(restored.serialize()).toEqual(run.serialize())
      expect(run.materials.waterHeatCapacityJKgK).toBe(legacy ? 4180 : 4300)
      expect(scenarioFromJSON(scenarioToJSON(s))).toEqual(s)
    }
  })

  it('books edited latent heat into the finite-source energy ledger exactly once', () => {
    const a = small(); const b = structuredClone(a)
    b.materialProperties!.co2SublimationJkg = 610000
    const sa = createSimulation(a).convertRemainingDryIce()
    const sb = createSimulation(b).convertRemainingDryIce()
    expect(sa.dryIceMassKg).toBe(0); expect(sb.dryIceMassKg).toBe(0)
    expect(sb.diagnostics.cumulativeInterventionEnergyJ - sa.diagnostics.cumulativeInterventionEnergyJ)
      .toBeCloseTo(a.source.initialMassKg * (610000 - resolveMaterials(a).co2SublimationJkg), 6)
    expect(Math.abs(sb.diagnostics.sourceEnergyResidualJ)).toBeLessThan(1e-7)
    expect(sb.fields.co2).toEqual(sa.fields.co2)
  })

  it('rejects invalid materials and malformed metadata without throwing during import validation', () => {
    for (const materialProperties of [null, [], { femPoisson: NaN }, { gasViscosityPaS: 0 }, { fake: 1 }]) {
      expect(validateScenario({ ...small(), materialProperties }).valid).toBe(false)
    }
    for (const researchSelection of [null, [], { id: 'bad' }, { id: 'bad', target: 'soil', sourceIds: [], appliedValues: { x: Infinity } }]) {
      expect(validateScenario({ ...small(), researchSelection }).valid).toBe(false)
    }
    for (const field of ['peatRegions', 'hotRegions', 'soilLayers', 'pathways']) {
      expect(validateScenario({ ...small(), [field]: [null] }).valid).toBe(false)
    }
  })

  it('limits editing to registered properties, keeps drafts isolated, and exports changed evidence', () => {
    const original = small(), copy = structuredClone(original)
    expect(() => applyPropertyEdits(original, { '__proto__.polluted': '1' })).toThrow(/Unknown/)
    expect(() => applyPropertyEdits(original, { 'soil.porosity': '' })).toThrow(/finite/)
    const profiled = stageResearchProfile(original, 'lowland-peat-20', 'soil')
    const next = applyPropertyEdits(profiled, { 'soil.bulkDensityKgM3': '900', 'materialProperties.femYoungsPa': '2e6' })
    expect(original).toEqual(copy)
    expect(next.soil.bulkDensityKgM3).toBe(900)
    expect(parameterAudit(next).editableProperties.find(p => p.path === 'soil.bulkDensityKgM3')!.evidence).toMatch(/Edited after/)
    expect(parameterAudit(next).scenario.researchSelection!.appliedValues['soil.bulkDensityKgM3']).toBe(870)
    const known = new Set<string>(MATERIAL_SOURCES.map(s => s.id))
    for (const property of editableProperties(next)) for (const id of property.sourceIds) expect(known.has(id)).toBe(true)
    const invalid = applyPropertyEdits(original, { 'soil.sandFraction': '0.99' })
    expect(validateScenario(invalid).errors.join(' ')).toMatch(/sum to 1/)
  })

  it('passes custom stiffness through the FEM material mapping to the analytical elastic response', () => {
    const soft = small(), stiff = small()
    soft.materialProperties!.femYoungsPa = 1e6; stiff.materialProperties!.femYoungsPa = 2e6
    const a = new ContinuumMechanics(1, 1, 1, 1, 1, 1, continuumMaterial(soft)).solveTopTraction(100)
    const b = new ContinuumMechanics(1, 1, 1, 1, 1, 1, continuumMaterial(stiff)).solveTopTraction(100)
    expect(a.strain[2]).toBeCloseTo(-100 / 1e6, 9)
    expect(b.strain[2]).toBeCloseTo(a.strain[2] / 2, 9)
  })

  it('respects a tightened short-event pressure ceiling', () => {
    const s = small(); s.materialProperties!.fastMaxPressurePa = 150000
    const event = runFastEvent(s, createSimulation(s).convertRemainingDryIce(), { durationS: 0.1, frameCount: 3 })
    expect(event.status).toBe('validity-paused')
  })
})

describe('research composition menu', () => {
  it.each(RESEARCH_PROFILES)('$name applies to base soil and a peat region with finite inventories', profile => {
    for (const target of ['soil', 'peat:0'] as const) {
      const original = small(), copy = structuredClone(original)
      const scenario = stageResearchProfile(original, profile.id, target)
      expect(original).toEqual(copy)
      expect(validateScenario(scenario).errors).toEqual([])
      const snap = createSimulation(scenario).advance(0.1)
      for (const field of Object.values(snap.fields)) expect(Array.from(field).every(Number.isFinite)).toBe(true)
      expect(scenarioFromJSON(scenarioToJSON(scenario))).toEqual(scenario)
      const phi = target === 'soil' ? scenario.soil.porosity : peatPorosity(profile.density, profile.organicFraction, resolveMaterials(scenario))
      const saturation = target === 'soil' ? scenario.soil.moistureSaturation : scenario.peatRegions[0].moistureSaturation
      expect(dryBasisMoisture(saturation, phi, profile.density, resolveMaterials(scenario).waterDensityKgM3)).toBeCloseTo(profile.dryBasisMoisture, 12)
    }
  })

  it('keeps peat blend fraction separate from estimated organic fraction and converts volumetric heat capacity', () => {
    const s = stageResearchProfile(small(), 'lowland-peat-20', 'soil')
    expect(s.soil.bulkDensityKgM3).toBe(870)
    expect(s.soil.organicFraction).toBe(0.159)
    expect(s.soil.thermalConductivityWmK).toBe(0.108)
    expect(s.soil.solidHeatCapacityJKgK * s.soil.bulkDensityKgM3).toBeCloseTo(772000, 6)
    expect(s.soilLayers.every(l => l.porosityOffset === 0 && l.dryDensityMultiplier === 1)).toBe(true)
    expect(s.researchSelection!.propertyNotes!['soilLayers.0.porosityOffset']).toMatch(/not a study measurement/)
  })
})
