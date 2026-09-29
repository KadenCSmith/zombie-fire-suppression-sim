import { describe, expect, it } from 'vitest'
import { MOLAR, R } from '../../../src/coupled/thermodynamics'
import {
  ELEMENTS, GAS_IDS, LEDGER_ATOMIC_KG_MOL, SPECIES_IDS,
  assertNoUnsupportedCO, auditReaction, compileNetwork, compileReaction,
  copyInventoryKg, createSpeciesRegistry, evaluateRate, inventoryFromWetPeat,
  inventoryTotals, speciesIndex,
  advanceChemistryCell, checkpointChemistryCell, compileChemistryModel,
  createChemistryCell, inspectChemistryCell, reactionInternalEnergyReleaseJkg,
  restoreChemistryCell, trialDryingExtent, ChemistryStepRejected,
  type CaloricInput, type ChemistryControls, type ChemistryModel, type ChemistryCellState,
  type SpeciesCaloricInput,
  type ArrheniusParameters, type Evidence, type MassVector,
  type OrganicDefinitions, type ReactionDefinition, type ReactionStage, type SpeciesId,
} from '../../../src/physics-next/transport/chemistry'

/** ALL formulas, yields and kinetics below are manufactured TEST inputs, not peat data. */
const evidence: Evidence = {
  kind: 'synthetic-test',
  source: 'Manufactured atom-balanced equations in AGENT_B_IMPLEMENTATION.md Task 1',
  specimen: 'None: algebraic verification only',
  limits: 'No measured kinetics, gas yields, heat release, or suppression prediction',
}
function organics(): OrganicDefinitions {
  return {
    fuel: { formula: { C: 6, H: 10, O: 5, N: 0 }, evidence: { ...evidence } },
    pyrolysate: { formula: { C: 4, H: 6, O: 3, N: 0 }, evidence: { ...evidence } },
    charAlpha: { formula: { C: 1, H: 0, O: 0, N: 0 }, evidence: { ...evidence } },
    charBeta: { formula: { C: 1, H: 0, O: 0, N: 0 }, evidence: { ...evidence } },
  }
}
const registry = createSpeciesRegistry(organics())
function vector(values: Partial<MassVector>): MassVector {
  // Sparse-to-zero conversion exists ONLY in this explicitly synthetic test fixture.
  return Object.assign(Object.fromEntries(SPECIES_IDS.map(id => [id, 0])), values) as MassVector
}
function parameters(oxidizing: boolean): ArrheniusParameters {
  return {
    preExponentialPerS: 0.5, activationEnergyJMol: 0,
    solidOrder: 1, oxygenOrder: oxidizing ? 1 : 0, oxygenReferencePa: 10000,
    minTemperatureK: 150, maxTemperatureK: 1200, minPressurePa: 1000, maxPressurePa: 300000,
  }
}
function definition(stage: ReactionStage, stoichiometry: MassVector): ReactionDefinition {
  const oxidizing = stage === 'peat-oxidation' || stage.startsWith('char-')
  return { id: stage, stage, stoichiometry, kinetics: parameters(oxidizing), evidence: { ...evidence } }
}
function fixtures(): ReactionDefinition[] {
  const f = registry.fuel.molarMassKgMol!, p = registry.pyrolysate.molarMassKgMol!
  const c = registry.charAlpha.molarMassKgMol!, o2 = MOLAR[0], co2 = MOLAR[1], w = MOLAR[3]
  const co = registry.CO.molarMassKgMol!
  return [
    definition('drying', vector({ liquidWater: -1, H2O: 1 })),
    // C6H10O5 -> 2 C(alpha) + C4H6O3(intermediate) + 2 H2O
    definition('peat-pyrolysis', vector({ fuel: -1, charAlpha: 2 * c / f, pyrolysate: p / f, H2O: 2 * w / f })),
    // C6H10O5 + 3 O2 -> 3 C(beta) + 3 CO2 + 5 H2O
    definition('peat-oxidation', vector({ fuel: -1, O2: -3 * o2 / f, charBeta: 3 * c / f, CO2: 3 * co2 / f, H2O: 5 * w / f })),
    // C4H6O3 -> 4 C(alpha) + 3 H2O
    definition('pyrolysate-conversion', vector({ pyrolysate: -1, charAlpha: 4 * c / p, H2O: 3 * w / p })),
    // C(alpha) + O2 -> CO2; coupled release of existing inert mineral to ash
    definition('char-alpha-oxidation', vector({ charAlpha: -1, O2: -o2 / c, CO2: co2 / c, mineral: -0.25, ash: 0.25 })),
    // C(beta) + 3/4 O2 -> 1/2 CO2 + 1/2 CO; a manufactured incomplete-oxidation branch
    definition('char-beta-oxidation', vector({ charBeta: -1, O2: -0.75 * o2 / c, CO2: 0.5 * co2 / c, CO: 0.5 * co / c })),
  ]
}
const rateInput = () => ({
  temperatureK: 500, totalPressurePa: 101325, oxygenPartialPressurePa: 10000,
  reactantKg: 0.4, referenceReactantKg: 1,
})

describe('Task 1: explicit transport/chemistry inventory, not an integrated solver', () => {
  it('preserves the first four gas identities and uses baseline molar masses', () => {
    expect(GAS_IDS.slice(0, 4)).toEqual(['O2', 'CO2', 'N2', 'H2O'])
    for (let index = 0; index < 4; index++) expect(registry[GAS_IDS[index]].molarMassKgMol).toBe(MOLAR[index])
    expect(registry.pyrolysate.phase).toBe('condensed-intermediate')
    expect(registry.ash.molarMassKgMol).toBe(null)
  })

  it('normalizes every species mass from CHON plus the separate inert invariant', () => {
    for (const id of SPECIES_IDS) {
      const species = registry[id]
      const mass = ELEMENTS.reduce((sum, element) =>
        sum + species.atomsMolPerKg[element] * LEDGER_ATOMIC_KG_MOL[element], species.inertKgPerKg)
      expect(Math.abs(mass - 1)).toBeLessThan(1e-14)
    }
  })

  it('splits wet peat once and allows dry-basis moisture above 100 percent', () => {
    const inventory = inventoryFromWetPeat({
      wetPeatKg: 4, moistureDryBasis: 1.5, mineralFractionOfDryPeat: 0.25, liquidFractionOfWater: 0.25,
    })
    expect(inventory[speciesIndex('fuel')]).toBeCloseTo(1.2, 14)
    expect(inventory[speciesIndex('mineral')]).toBeCloseTo(0.4, 14)
    expect(inventory[speciesIndex('liquidWater')]).toBeCloseTo(0.6, 14)
    expect(inventory[speciesIndex('ice')]).toBeCloseTo(1.8, 14)
    const totals = inventoryTotals(registry, inventory)
    expect(totals.totalMassKg).toBeCloseTo(4, 14)
    expect(totals.waterAllPhasesKg).toBeCloseTo(2.4, 14)
    expect(totals.inertKg).toBeCloseTo(0.4, 14)
  })

  it('handles dry, empty, and all-mineral initial aggregates without imaginary fuel', () => {
    for (const wetPeatKg of [0, 2]) {
      const inventory = inventoryFromWetPeat({
        wetPeatKg, moistureDryBasis: 0, mineralFractionOfDryPeat: 1, liquidFractionOfWater: 1,
      })
      expect(inventory[speciesIndex('fuel')]).toBe(0)
      expect(inventoryTotals(registry, inventory).totalMassKg).toBe(wetPeatKg)
    }
  })

  it('rejects missing formulas and unsupported sulfur rather than losing atoms', () => {
    const missing = organics()
    Reflect.deleteProperty(missing.pyrolysate.formula, 'H')
    expect(() => createSpeciesRegistry(missing)).toThrow(/explicitly required/)
    const sulfur = organics()
    Object.assign(sulfur.fuel.formula, { S: 0.01 })
    expect(() => createSpeciesRegistry(sulfur)).toThrow(/unsupported field/)
  })

  it('rejects absent organic pools, noncarbon formulas, and missing provenance', () => {
    const absent = organics()
    Reflect.deleteProperty(absent, 'charBeta')
    expect(() => createSpeciesRegistry(absent)).toThrow()
    const noCarbon = organics()
    Object.assign(noCarbon.fuel.formula, { C: 0 })
    expect(() => createSpeciesRegistry(noCarbon)).toThrow()
    const noEvidence = organics()
    Object.assign(noEvidence.fuel.evidence, { source: '' })
    expect(() => createSpeciesRegistry(noEvidence)).toThrow()
  })

  it('closes all six manufactured reaction vectors including ash and CO', () => {
    const network = compileNetwork(registry, fixtures())
    expect(network.length).toBe(6)
    for (const reaction of network) {
      expect(reaction.balance.passed).toBe(true)
      expect(Math.abs(reaction.balance.massResidualKgPerKgExtent)).toBeLessThan(1e-12)
      expect(Math.abs(reaction.balance.inertResidualKgPerKgExtent)).toBeLessThan(1e-12)
      for (const element of ELEMENTS) {
        expect(Math.abs(reaction.balance.atomResidualMolPerKgExtent[element])).toBeLessThan(1e-10)
      }
    }
    expect(network[0].owner).toBe('water')
    expect(network[1].owner).toBe('chemistry')
  })

  it('checks nonzero nitrogen inventory rather than only all-zero N fixtures', () => {
    const input = organics()
    Object.assign(input.fuel.formula, { N: 2 })
    const nitrogenRegistry = createSpeciesRegistry(input)
    const f = nitrogenRegistry.fuel.molarMassKgMol!
    const nitrogenPyrolysis = definition('peat-pyrolysis', vector({
      fuel: -1, charAlpha: 2 * nitrogenRegistry.charAlpha.molarMassKgMol! / f,
      pyrolysate: nitrogenRegistry.pyrolysate.molarMassKgMol! / f,
      H2O: 2 * MOLAR[3] / f, N2: MOLAR[2] / f,
    }))
    expect(compileReaction(nitrogenRegistry, nitrogenPyrolysis).balance.passed).toBe(true)
    const wrong = { ...nitrogenPyrolysis, stoichiometry: { ...nitrogenPyrolysis.stoichiometry, N2: 0 } }
    expect(() => compileReaction(nitrogenRegistry, wrong)).toThrow(/imbalance/)
  })

  it('rejects a total-mass-balanced substitution that destroys carbon and oxygen', () => {
    const original = fixtures()[4]
    const amount = original.stoichiometry.CO2
    const wrong = { ...original, stoichiometry: { ...original.stoichiometry, CO2: 0, N2: amount } }
    expect(Math.abs(Object.values(wrong.stoichiometry).reduce((sum, value) => sum + value, 0))).toBeLessThan(1e-12)
    expect(auditReaction(registry, wrong.stoichiometry).passed).toBe(false)
    expect(() => compileReaction(registry, wrong)).toThrow(/imbalance/)
  })

  it('cannot create ash by turning carbon into an unspecified inert substance', () => {
    const original = fixtures()[4]
    const wrong = {
      ...original, stoichiometry: {
        ...original.stoichiometry, CO2: original.stoichiometry.CO2 - 0.1, ash: original.stoichiometry.ash + 0.1,
      },
    }
    const balance = auditReaction(registry, wrong.stoichiometry)
    expect(Math.abs(balance.massResidualKgPerKgExtent)).toBeLessThan(1e-12)
    expect(balance.inertResidualKgPerKgExtent).toBeCloseTo(0.1, 14)
    expect(() => compileReaction(registry, wrong)).toThrow(/imbalance/)
  })

  it('requires explicit zero yields and rejects unknown methane channels', () => {
    const missing = fixtures()[1]
    Reflect.deleteProperty(missing.stoichiometry, 'CO')
    expect(() => compileReaction(registry, missing)).toThrow(/explicitly required/)
    const unknown = fixtures()[1]
    Object.assign(unknown.stoichiometry, { CH4: 0 })
    expect(() => compileReaction(registry, unknown)).toThrow(/unsupported field/)
  })

  it('requires measured-or-declared kinetic inputs even when a channel would be inactive', () => {
    const missing = fixtures()[1]
    Reflect.deleteProperty(missing.kinetics, 'activationEnergyJMol')
    expect(() => compileReaction(registry, missing)).toThrow(/explicitly required/)
    for (const preExponentialPerS of [NaN, Infinity, -1]) {
      const original = fixtures()[1]
      expect(() => compileReaction(registry, {
        ...original, kinetics: { ...original.kinetics, preExponentialPerS },
      })).toThrow()
    }
  })

  it('requires normalized reaction extent and consistent oxygen-stage semantics', () => {
    const original = fixtures()[1]
    const scaled = Object.fromEntries(SPECIES_IDS.map(id => [id, 2 * original.stoichiometry[id]])) as MassVector
    expect(() => compileReaction(registry, { ...original, stoichiometry: scaled })).toThrow(/exactly -1/)
    expect(() => compileReaction(registry, {
      ...original, kinetics: { ...original.kinetics, oxygenOrder: 1 },
    })).toThrow(/oxygen order|explicit zero/)
    const oxidative = fixtures()[4]
    expect(() => compileReaction(registry, {
      ...oxidative, kinetics: { ...oxidative.kinetics, oxygenOrder: 0 },
    })).toThrow(/oxygen order/)
  })

  it('does not mislabel an alpha-char pathway as beta-char oxidation', () => {
    const original = fixtures()[4]
    expect(() => compileReaction(registry, { ...original, stage: 'char-beta-oxidation' })).toThrow(/primary-reactant/)
  })

  it('compiles copies without freezing or aliasing mutable caller-owned configuration', () => {
    const original = fixtures()[1]
    const compiled = compileReaction(registry, original)
    Object.assign(original.stoichiometry, { pyrolysate: 0 })
    Object.assign(original.kinetics, { preExponentialPerS: 12 })
    Object.assign(original.evidence, { source: 'changed caller' })
    expect(compiled.stoichiometry.pyrolysate).toBeGreaterThan(0)
    expect(compiled.kinetics.preExponentialPerS).toBe(0.5)
    expect(compiled.evidence.source).toBe(evidence.source)
    expect(Object.isFrozen(compiled.stoichiometry)).toBe(true)
    expect(Object.isFrozen(compiled.kinetics)).toBe(true)
  })

  it('recompiles serialized configuration deterministically, not a physical-state restart test', () => {
    const definitions = fixtures()
    const restored = JSON.parse(JSON.stringify(definitions)) as ReactionDefinition[]
    expect(compileNetwork(registry, restored)).toEqual(compileNetwork(registry, definitions))
    expect(() => compileNetwork(registry, [definitions[0], definitions[0]])).toThrow(/duplicate/)
    expect(() => compileNetwork(registry, [])).toThrow(/nonempty/)
  })

  it('recovers a first-order analytical rate independent of reference-mass normalization', () => {
    const reaction = compileReaction(registry, fixtures()[4])
    expect(evaluateRate(reaction, rateInput()).extentKgPerS).toBeCloseTo(0.2, 14)
    expect(evaluateRate(reaction, { ...rateInput(), referenceReactantKg: 2 }).extentKgPerS).toBeCloseTo(0.2, 14)
  })

  it('separates oxygen starvation, absent driver, and an explicitly disabled channel', () => {
    const oxidative = compileReaction(registry, fixtures()[4])
    const pyrolysis = compileReaction(registry, fixtures()[1])
    expect(evaluateRate(oxidative, { ...rateInput(), oxygenPartialPressurePa: 0 }).extentKgPerS).toBe(0)
    expect(evaluateRate(pyrolysis, { ...rateInput(), oxygenPartialPressurePa: 0 }).extentKgPerS).toBeGreaterThan(0)
    for (const reaction of [oxidative, pyrolysis]) {
      expect(evaluateRate(reaction, { ...rateInput(), reactantKg: 0 }).extentKgPerS).toBe(0)
    }
    const original = fixtures()[1]
    const disabled = compileReaction(registry, {
      ...original, kinetics: { ...original.kinetics, preExponentialPerS: 0 },
    })
    expect(evaluateRate(disabled, rateInput()).extentKgPerS).toBe(0)
  })

  it('returns finite nonnegative rates in a 1152-state grid over declared domains', () => {
    let cases = 0
    for (const original of fixtures()) {
      const reaction = compileReaction(registry, {
        ...original, kinetics: {
          ...original.kinetics, activationEnergyJMol: 50000, solidOrder: 0.5,
          oxygenOrder: original.kinetics.oxygenOrder === 0 ? 0 : 0.5,
        },
      })
      for (const temperatureK of [150, 273.15, 600, 1200]) {
        for (const totalPressurePa of [1000, 101325, 300000]) {
          for (const fraction of [0, 1e-12, 0.2095, 1]) {
            for (const reactantKg of [0, 1e-9, 0.5, 1]) {
              const result = evaluateRate(reaction, {
                temperatureK, totalPressurePa, oxygenPartialPressurePa: fraction * totalPressurePa,
                reactantKg, referenceReactantKg: 1,
              })
              expect(Number.isFinite(result.extentKgPerS)).toBe(true)
              expect(result.extentKgPerS).toBeGreaterThanOrEqual(0)
              cases++
            }
          }
        }
      }
    }
    expect(cases).toBe(1152)
  })

  it('keeps the extreme supported numerical rate finite without a hidden rate cap', () => {
    const original = fixtures()[4]
    const reaction = compileReaction(registry, {
      ...original, kinetics: {
        ...original.kinetics, preExponentialPerS: 1e30, oxygenReferencePa: 1, solidOrder: 10, oxygenOrder: 10,
      },
    })
    const result = evaluateRate(reaction, {
      temperatureK: 1200, totalPressurePa: 300000, oxygenPartialPressurePa: 300000,
      reactantKg: 1e12, referenceReactantKg: 1e12,
    })
    const analytical = 1e12 * 1e30 * 300000 ** 10
    expect(Math.abs(result.extentKgPerS / analytical - 1)).toBeLessThan(1e-12)
  })

  it('avoids premature underflow of a fractional-order remaining-mass factor', () => {
    const original = fixtures()[1]
    const reaction = compileReaction(registry, {
      ...original, kinetics: { ...original.kinetics, preExponentialPerS: 1, solidOrder: 0.5 },
    })
    const result = evaluateRate(reaction, {
      ...rateInput(), reactantKg: Number.MIN_VALUE, referenceReactantKg: 1e12,
    })
    expect(Number.isFinite(result.extentKgPerS)).toBe(true)
    expect(result.extentKgPerS).toBeGreaterThan(0)
    expect(result.underflowed).toBe(false)
  })

  it('reports final exponential underflow separately from true zero reactants', () => {
    const original = fixtures()[1]
    const reaction = compileReaction(registry, {
      ...original, kinetics: { ...original.kinetics, activationEnergyJMol: 1e7 },
    })
    expect(evaluateRate(reaction, { ...rateInput(), temperatureK: 150 }).underflowed).toBe(true)
    expect(evaluateRate(reaction, { ...rateInput(), reactantKg: 0 }).underflowed).toBe(false)
  })

  it('rejects extrapolation, impossible oxygen pressure, and invalid normalization', () => {
    const reaction = compileReaction(registry, fixtures()[4])
    const bad = [
      { temperatureK: 149 }, { temperatureK: 1201 }, { totalPressurePa: 300001 },
      { oxygenPartialPressurePa: 101326 }, { oxygenPartialPressurePa: -1 },
      { referenceReactantKg: 0 }, { reactantKg: 2 }, { reactantKg: NaN },
    ]
    for (const change of bad) expect(() => evaluateRate(reaction, { ...rateInput(), ...change })).toThrow()
  })

  it('copies and audits local kg inventories without aliasing or summing water twice', () => {
    const original = new Float64Array(SPECIES_IDS.length)
    original[speciesIndex('charAlpha')] = 0.2
    original[speciesIndex('charBeta')] = 0.3
    original[speciesIndex('liquidWater')] = 1
    original[speciesIndex('H2O')] = MOLAR[3]
    const copy = copyInventoryKg(original)
    copy[speciesIndex('charAlpha')] = 0
    expect(original[speciesIndex('charAlpha')]).toBe(0.2)
    expect(inventoryTotals(registry, original).charKg).toBe(0.5)
    expect(inventoryTotals(registry, original).waterAllPhasesKg).toBe(1 + MOLAR[3])
    expect(() => copyInventoryKg(new Float64Array(1))).toThrow()
    for (const value of [-1, NaN, Infinity]) {
      const invalid = original.slice()
      invalid[0] = value
      expect(() => copyInventoryKg(invalid)).toThrow()
    }
  })

  it('rejects CO in either a source recipe or stored inventory before four-gas adaptation', () => {
    const network = compileNetwork(registry, fixtures())
    const empty = new Float64Array(SPECIES_IDS.length)
    expect(() => assertNoUnsupportedCO(network, empty)).toThrow(/integrator-owned/)
    const compatible = network.filter(reaction => reaction.stoichiometry.CO === 0)
    expect(() => assertNoUnsupportedCO(compatible, empty)).not.toThrow()
    const trace = empty.slice()
    trace[speciesIndex('CO')] = Number.MIN_VALUE
    expect(() => assertNoUnsupportedCO(compatible, trace)).toThrow(/integrator-owned/)
  })

  it('rejects invalid initial moisture and phase fractions rather than clipping them', () => {
    const base = { wetPeatKg: 4, moistureDryBasis: 1.5, mineralFractionOfDryPeat: 0.25, liquidFractionOfWater: 1 }
    for (const change of [{ wetPeatKg: -1 }, { moistureDryBasis: NaN }, { mineralFractionOfDryPeat: 1.01 }, { liquidFractionOfWater: -0.1 }]) {
      expect(() => inventoryFromWetPeat({ ...base, ...change })).toThrow()
    }
  })

  it('uses the declared deterministic kg-vector indexing for all species', () => {
    const used = new Set<number>()
    for (const id of SPECIES_IDS) used.add(speciesIndex(id as SpeciesId))
    expect(used.size).toBe(13)
    expect(() => speciesIndex('CH4' as SpeciesId)).toThrow(/unsupported species/)
  })
})

/** Task-2 thermal numbers are manufactured algebraic fixtures, NOT measured peat properties. */
function caloricFixture(
  changes: Partial<Record<SpeciesId, Partial<SpeciesCaloricInput>>> = {},
): CaloricInput {
  const species = {} as Record<SpeciesId, SpeciesCaloricInput>
  const chemical: Partial<Record<SpeciesId, number>> = {
    fuel: 3e6, pyrolysate: 5e6, charAlpha: 2e6, charBeta: 2e6, CO: 5e5,
  }
  for (const id of SPECIES_IDS) {
    species[id] = {
      cvJkgK: 3000, phaseReferenceJkg: id === 'H2O' ? 2e6 : id === 'ice' ? -3e5 : 0,
      chemicalReferenceJkg: chemical[id] ?? 0, evidence: { ...evidence }, ...changes[id],
    }
  }
  return {
    referenceTemperatureK: 300, minTemperatureK: 200, maxTemperatureK: 1100,
    minPressurePa: 1000, maxPressurePa: 300000, liquidDensityKgM3: 1000, iceDensityKgM3: 900,
    species, evidence: { ...evidence },
  }
}
function controlsFixture(changes: Partial<ChemistryControls> = {}): ChemistryControls {
  return {
    maxSubstepS: 0.1, minSubstepS: 1e-12, maxSubsteps: 10000, maxBacktracks: 40,
    maxConsumedFraction: 0.2, maxTemperatureChangeK: 5,
    massAbsoluteToleranceKg: 1e-12, atomAbsoluteToleranceMol: 1e-10,
    energyAbsoluteToleranceJ: 1e-7, relativeTolerance: 1e-12, ...changes,
  }
}
function modelFixture(
  reactions: ReactionDefinition[] = fixtures(), controls: Partial<ChemistryControls> = {},
  caloric: CaloricInput = caloricFixture(),
): ChemistryModel {
  return compileChemistryModel(organics(), reactions, caloric, controlsFixture(controls))
}
function cellFixture(
  model: ChemistryModel, changes: Partial<Record<SpeciesId, number>> = {},
  temperatureK = 500, pressurePa = 60000, referenceKg = 10,
): ChemistryCellState {
  const values: Partial<Record<SpeciesId, number>> = { N2: 0.2, O2: 0.01, ...changes }
  const massKg = Float64Array.from(SPECIES_IDS, id => values[id] ?? 0)
  const gasMoles = GAS_IDS.reduce((n, id) =>
    n + massKg[speciesIndex(id)] / model.registry[id].molarMassKgMol!, 0)
  const poreVolumeM3 = gasMoles * R * temperatureK / pressurePa
    + massKg[speciesIndex('liquidWater')] / model.caloric.liquidDensityKgM3
    + massKg[speciesIndex('ice')] / model.caloric.iceDensityKgM3
  return createChemistryCell(model, {
    timeS: 0, massKg, temperatureK, poreVolumeM3,
    referenceReactantKg: Object.fromEntries(model.reactions.map(r => [r.id, referenceKg])),
  })
}
function extentOf(model: ChemistryModel, extents: Float64Array, id: string): number {
  return extents[model.reactions.findIndex(r => r.id === id)]
}
function expectClosed(model: ChemistryModel, before: ChemistryCellState, after: ChemistryCellState): void {
  const a = inventoryTotals(model.registry, before.massKg), b = inventoryTotals(model.registry, after.massKg)
  expect(Math.abs(b.totalMassKg - a.totalMassKg)).toBeLessThan(1e-10)
  for (const element of ELEMENTS) expect(Math.abs(b.atomsMol[element] - a.atomsMol[element])).toBeLessThan(1e-8)
  expect(Math.abs(b.inertKg - a.inertKg)).toBeLessThan(1e-10)
  const ua = inspectChemistryCell(model, before).totalInternalEnergyJ
  const ub = inspectChemistryCell(model, after).totalInternalEnergyJ
  expect(Math.abs(ub - ua)).toBeLessThan(1e-6 + 1e-12 * Math.abs(ua))
  for (const m of after.massKg) { expect(Number.isFinite(m)).toBe(true); expect(m).toBeGreaterThanOrEqual(0) }
}

describe('Task 2: required caloric data and nonaliasing cell state', () => {
  it('requires every caloric field and explicit water/ash energy consistency', () => {
    const missing = caloricFixture()
    Reflect.deleteProperty(missing.species.CO, 'cvJkgK')
    expect(() => modelFixture(fixtures(), {}, missing)).toThrow(/explicitly required/)
    expect(() => modelFixture(fixtures(), {}, caloricFixture({ ice: { chemicalReferenceJkg: 1 } }))).toThrow(/water phases/)
    expect(() => modelFixture(fixtures(), {}, caloricFixture({ ash: { cvJkgK: 3001 } }))).toThrow(/mineral and ash/)
    expect(() => modelFixture(fixtures(), {}, caloricFixture({ H2O: { phaseReferenceJkg: -1 } }))).toThrow(/ordering/)
    expect(() => modelFixture(fixtures(), {}, caloricFixture({ fuel: { cvJkgK: NaN } }))).toThrow()
  })

  it('requires numerical controls without silently accepting unsafe limits', () => {
    const missing = controlsFixture()
    Reflect.deleteProperty(missing, 'relativeTolerance')
    expect(() => compileChemistryModel(organics(), fixtures(), caloricFixture(), missing)).toThrow(/explicitly required/)
    for (const bad of [
      { maxConsumedFraction: 1 }, { maxSubsteps: 1.5 }, { minSubstepS: 1 },
      { energyAbsoluteToleranceJ: -1 }, { relativeTolerance: Infinity }, { maxTemperatureChangeK: 0 },
    ]) expect(() => modelFixture(fixtures(), bad)).toThrow()
  })

  it('rejects chemistry-owned condensed water production instead of bypassing phase ownership', () => {
    const f = fixtures()[1]
    const invalid = { ...f, stoichiometry: { ...f.stoichiometry, liquidWater: f.stoichiometry.H2O, H2O: 0 } }
    expect(() => compileReaction(registry, invalid)).toThrow(/water-owned/)
  })

  it('recovers one consistent temperature, phase energy, total energy and five-gas pressure', () => {
    const model = modelFixture()
    const state = cellFixture(model, { fuel: 0.2, liquidWater: 0.1, ice: 0.02, H2O: 0.001, CO: 0.03 })
    const t = inspectChemistryCell(model, state)
    expect(t.temperatureK).toBeCloseTo(500, 11)
    expect(t.totalPressurePa).toBeCloseTo(60000, 8)
    const expectedU = SPECIES_IDS.reduce((u, id, i) => {
      const s = model.caloric.species[id]
      return u + state.massKg[i] * (s.phaseReferenceJkg + s.chemicalReferenceJkg + 200 * s.cvJkgK)
    }, 0)
    expect(t.totalInternalEnergyJ).toBeCloseTo(expectedU, 7)
    const totalN = GAS_IDS.reduce((n, id) => n + state.massKg[speciesIndex(id)] / model.registry[id].molarMassKgMol!, 0)
    expect(t.oxygenPartialPressurePa / t.totalPressurePa).toBeCloseTo((0.01 / MOLAR[0]) / totalN, 14)
  })

  it('rejects overfilled pores, vacuum/out-of-range pressure, invalid capacities and nonfinite energy', () => {
    const model = modelFixture(), state = cellFixture(model, { fuel: 0.2 })
    for (const bad of [
      { poreVolumeM3: 1e-9 }, { poreVolumeM3: 1e12 }, { thermalEnergyJ: NaN },
      { referenceReactantKg: new Float64Array(model.reactions.length) },
    ]) expect(() => inspectChemistryCell(model, { ...state, ...bad })).toThrow()
    const wet = cellFixture(model, { liquidWater: 1 })
    expect(() => inspectChemistryCell(model, { ...wet, poreVolumeM3: 1e-5 })).toThrow(/gas volume/)
    expect(() => cellFixture(model, { fuel: 11 })).toThrow(/capacity/)
  })

  it('returns owned no-op state, reference, source and extent arrays', () => {
    const model = modelFixture(), before = cellFixture(model, { fuel: 0.2 })
    const snapshot = checkpointChemistryCell(model, before)
    const result = advanceChemistryCell(model, before, 0)
    expect(result.next.massKg).not.toBe(before.massKg)
    expect(result.next.referenceReactantKg).not.toBe(before.referenceReactantKg)
    expect(result.sources.speciesKgDelta).not.toBe(result.next.massKg)
    expect(result.sources.gasMolDelta).not.toBe(result.sources.speciesKgDelta)
    expect(result.sources.energyJ).toBe(0)
    result.next.massKg[0] = 0
    result.next.referenceReactantKg[0] = 1
    expect(checkpointChemistryCell(model, before)).toBe(snapshot)
  })

  it('makes configuration independent of reaction-list order and owns original input data', () => {
    const inputs = fixtures(), c = caloricFixture(), controls = controlsFixture()
    const a = compileChemistryModel(organics(), inputs, c, controls)
    const b = compileChemistryModel(organics(), [...inputs].reverse(), caloricFixture(), controlsFixture())
    expect(a.configurationKey).toBe(b.configurationKey)
    Object.assign(inputs[1].kinetics, { preExponentialPerS: 9 })
    Object.assign(c.species.fuel, { chemicalReferenceJkg: 999 })
    Object.assign(controls, { maxSubsteps: 1 })
    expect(a.configurationKey).toBe(b.configurationKey)
    expect(a.reactions.map(r => r.kinetics)).toEqual(b.reactions.map(r => r.kinetics))
    expect(a.caloric.species.fuel.chemicalReferenceJkg).toBe(3e6)
  })
})

describe('Task 2: drying extent, thermal/source signs and limiting chemistry', () => {
  it('never automatically executes water-owned drying with nonzero drying fixture kinetics', () => {
    const model = modelFixture([fixtures()[0]])
    const before = cellFixture(model, { liquidWater: 0.2 })
    const result = advanceChemistryCell(model, before, 1)
    expect(result.next.massKg).toEqual(before.massKg)
    expect(result.sources.energyJ).toBe(0)
    expect(result.sources.reactionExtentKg[0]).toBe(0)
    expect(result.next.timeS).toBe(1)
  })

  it('drying conserves water and total energy, cools the cell, and adds no external or chemical heat', () => {
    const model = modelFixture([fixtures()[0]])
    const before = cellFixture(model, { liquidWater: 0.2 })
    const result = trialDryingExtent(model, before, 0.001)
    expect(result.appliedExtentKg).toBe(0.001)
    expect(result.unappliedExtentKg).toBe(0)
    expect(result.next.timeS).toBe(before.timeS)
    expect(result.sources.energyJ).toBe(0)
    expect(result.sources.externalEnergyJ).toBe(0)
    expect(result.sources.fixedTemperatureReleaseJ).toBeLessThan(0)
    expect(result.sources.gasMolDelta[3]).toBeCloseTo(0.001 / MOLAR[3], 14)
    expect(inspectChemistryCell(model, result.next).temperatureK).toBeLessThan(500)
    expectClosed(model, before, result.next)
  })

  it('returns unperformed drying rather than clipping temperature or manufacturing latent energy', () => {
    const model = modelFixture([fixtures()[0]])
    const before = cellFixture(model, { liquidWater: 0.2 }, 200.1)
    const result = trialDryingExtent(model, before, 1)
    expect(result.appliedExtentKg).toBeGreaterThan(0)
    expect(result.appliedExtentKg).toBeLessThan(0.001)
    expect(result.limited).toBe(true)
    expect(result.appliedExtentKg + result.unappliedExtentKg).toBe(1)
    expect(inspectChemistryCell(model, result.next).temperatureK).toBeGreaterThanOrEqual(200)
    expectClosed(model, before, result.next)
  })

  it('zero water, zero request and zero available sensible energy give zero drying', () => {
    const model = modelFixture([fixtures()[0]])
    const a = cellFixture(model), b = cellFixture(model, { liquidWater: 0.2 }, 200)
    expect(trialDryingExtent(model, a, 1).appliedExtentKg).toBe(0)
    expect(trialDryingExtent(model, b, 1).appliedExtentKg).toBe(0)
    expect(trialDryingExtent(model, b, 0).next.massKg).toEqual(b.massKg)
    expect(() => trialDryingExtent(model, b, -1)).toThrow()
  })

  it('drying respects inventory fractions and updates gas volume as liquid volume is released', () => {
    const model = modelFixture([fixtures()[0]], { maxConsumedFraction: 0.001, maxTemperatureChangeK: 100 })
    const before = cellFixture(model, { liquidWater: 0.2 })
    const result = trialDryingExtent(model, before, 10)
    expect(result.appliedExtentKg).toBeCloseTo(0.0002, 14)
    const ta = inspectChemistryCell(model, before), tb = inspectChemistryCell(model, result.next)
    expect(tb.gasVolumeM3 - ta.gasVolumeM3).toBeCloseTo(result.appliedExtentKg / 1000, 14)
    expectClosed(model, before, result.next)
  })

  it('oxygen-free pyrolysis proceeds, makes intermediate/alpha-char and cools this endothermic fixture', () => {
    const model = modelFixture([fixtures()[1]])
    const before = cellFixture(model, { fuel: 0.1, O2: 0 })
    const result = advanceChemistryCell(model, before, 0.05)
    expect(result.sources.speciesKgDelta[speciesIndex('fuel')]).toBeLessThan(0)
    expect(result.next.massKg[speciesIndex('pyrolysate')]).toBeGreaterThan(0)
    expect(result.next.massKg[speciesIndex('charAlpha')]).toBeGreaterThan(0)
    expect(result.next.massKg[speciesIndex('O2')]).toBe(0)
    expect(result.sources.energyJ).toBeLessThan(0)
    expect(result.sources.fixedTemperatureReleaseJ).toBeLessThan(0)
    expect(inspectChemistryCell(model, result.next).temperatureK).toBeLessThan(500)
    expectClosed(model, before, result.next)
  })

  it('oxygen starvation switches off every oxidation path without a guessed oxygen floor', () => {
    const reactions = fixtures().filter(r => r.stage === 'peat-oxidation' || r.stage.startsWith('char-'))
    const model = modelFixture(reactions)
    const before = cellFixture(model, { fuel: 0.1, charAlpha: 0.1, charBeta: 0.1, mineral: 0.1, O2: 0 })
    const result = advanceChemistryCell(model, before, 1)
    expect(result.next.massKg).toEqual(before.massKg)
    expect(result.sources.energyJ).toBe(0)
    expect(result.sources.reactionExtentKg.every(x => x === 0)).toBe(true)
  })

  it('zero driver or required mineral prevents reaction rather than creating negative co-reactants', () => {
    const model = modelFixture([fixtures()[4]])
    for (const values of [{ charAlpha: 0, mineral: 0.1 }, { charAlpha: 0.1, mineral: 0 }]) {
      const before = cellFixture(model, values), result = advanceChemistryCell(model, before, 1)
      expect(result.next.massKg).toEqual(before.massKg)
      expect(result.next.massKg[speciesIndex('ash')]).toBe(0)
    }
  })

  it('alpha-char oxidation consumes O2, relabels the exact mineral mass and heats the closed cell', () => {
    const model = modelFixture([fixtures()[4]])
    const before = cellFixture(model, { charAlpha: 0.1, mineral: 0.1 })
    const result = advanceChemistryCell(model, before, 0.1)
    expect(result.sources.speciesKgDelta[speciesIndex('O2')]).toBeLessThan(0)
    expect(result.sources.speciesKgDelta[speciesIndex('CO2')]).toBeGreaterThan(0)
    expect(result.sources.speciesKgDelta[speciesIndex('ash')]).toBeGreaterThan(0)
    expect(result.sources.energyJ).toBeGreaterThan(0)
    expect(result.sources.fixedTemperatureReleaseJ).toBeGreaterThan(0)
    expect(inspectChemistryCell(model, result.next).temperatureK).toBeGreaterThan(500)
    expectClosed(model, before, result.next)
  })

  it('beta-char oxidation retains the explicitly produced CO in its own fifth gas source', () => {
    const model = modelFixture([fixtures()[5]])
    const before = cellFixture(model, { charBeta: 0.1 })
    const result = advanceChemistryCell(model, before, 0.1)
    expect(result.sources.gasMolDelta.length).toBe(5)
    expect(result.sources.gasMolDelta[4]).toBeGreaterThan(0)
    expect(result.sources.gasMolDelta[4]).toBeCloseTo(result.sources.gasMolDelta[1], 12)
    expect(result.sources.gasMolDelta[2]).toBe(0)
    expectClosed(model, before, result.next)
  })

  it('intermediate conversion needs no O2 and consumes the retained pool, not original fuel', () => {
    const model = modelFixture([fixtures()[3]])
    const before = cellFixture(model, { pyrolysate: 0.1, O2: 0 })
    const result = advanceChemistryCell(model, before, 0.01)
    expect(result.next.massKg[speciesIndex('pyrolysate')]).toBeLessThan(0.1)
    expect(result.next.massKg[speciesIndex('charAlpha')]).toBeGreaterThan(0)
    expect(result.next.massKg[speciesIndex('fuel')]).toBe(0)
    expectClosed(model, before, result.next)
  })

  it('evaluates energy release from the same species energies, not an independent heat input', () => {
    const model = modelFixture()
    expect(reactionInternalEnergyReleaseJkg(model, 'drying', 500)).toBe(-2e6)
    expect(reactionInternalEnergyReleaseJkg(model, 'char-alpha-oxidation', 500)).toBeCloseTo(2e6, 7)
    const pyrolysis = model.reactions.find(r => r.stage === 'peat-pyrolysis')!
    const chemicalSourcePerKg = -SPECIES_IDS.reduce((q, id) =>
      q + pyrolysis.stoichiometry[id] * model.caloric.species[id].chemicalReferenceJkg, 0)
    const fullRelease = reactionInternalEnergyReleaseJkg(model, pyrolysis.id, 500)
    expect(fullRelease).toBeLessThan(chemicalSourcePerKg)
    expect(Math.abs(fullRelease - chemicalSourcePerKg + pyrolysis.stoichiometry.H2O * 2e6)).toBeLessThan(1e-8)
  })
})


describe('Task 2: shared-reactant bounds, rejection and numerical limiting tests', () => {
  it('bounds competing fuel channels together and preserves their frozen-rate branching ratio', () => {
    const base = fixtures()[1]
    const a = { ...base, id: 'a', kinetics: { ...base.kinetics, preExponentialPerS: 1 } }
    const b = { ...base, id: 'b', kinetics: { ...base.kinetics, preExponentialPerS: 2 } }
    const model = modelFixture([b, a], { maxSubstepS: 1, maxTemperatureChangeK: 100 })
    const before = cellFixture(model, { fuel: 0.2, O2: 0 })
    const result = advanceChemistryCell(model, before, 0.1)
    expect(result.substeps).toBeGreaterThan(1)
    const x = extentOf(model, result.sources.reactionExtentKg, 'a')
    const y = extentOf(model, result.sources.reactionExtentKg, 'b')
    expect(y / x).toBeCloseTo(2, 12)
    expect(x + y).toBeLessThan(0.2)
    expectClosed(model, before, result.next)
  })

  it('does not let newly produced intermediate/char finance consumption in that same Euler substep', () => {
    const model = modelFixture([fixtures()[1], fixtures()[3]], { maxSubstepS: 0.0001 })
    const before = cellFixture(model, { fuel: 0.1, O2: 0 })
    const first = advanceChemistryCell(model, before, 0.0001)
    expect(first.substeps).toBe(1)
    expect(extentOf(model, first.sources.reactionExtentKg, 'pyrolysate-conversion')).toBe(0)
    const second = advanceChemistryCell(model, first.next, 0.0001)
    expect(extentOf(model, second.sources.reactionExtentKg, 'pyrolysate-conversion')).toBeGreaterThan(0)
  })

  it('bounds shared oxygen using gross consumption across both char branches', () => {
    const model = modelFixture([fixtures()[4], fixtures()[5]], { maxSubstepS: 10, maxTemperatureChangeK: 100 })
    const before = cellFixture(model, { charAlpha: 0.01, charBeta: 0.01, mineral: 0.1, O2: 0.0001 })
    const t = inspectChemistryCell(model, before)
    const demand = model.reactions.reduce((loss, r, j) => loss - r.stoichiometry.O2 * evaluateRate(r, {
      temperatureK: t.temperatureK, totalPressurePa: t.totalPressurePa,
      oxygenPartialPressurePa: t.oxygenPartialPressurePa,
      reactantKg: before.massKg[speciesIndex(r.driver)], referenceReactantKg: before.referenceReactantKg[j],
    }).extentKgPerS, 0)
    const h = 0.9 * model.controls.maxConsumedFraction * 0.0001 / demand
    const first = advanceChemistryCell(model, before, h)
    expect(first.substeps).toBe(1)
    expect(-first.sources.speciesKgDelta[speciesIndex('O2')] / 0.0001).toBeLessThan(0.200000000001)
    const result = advanceChemistryCell(model, before, 2 * h)
    expect(result.substeps).toBeGreaterThan(1)
    expect(result.next.massKg[speciesIndex('O2')]).toBeGreaterThanOrEqual(0)
    expectClosed(model, before, result.next)
  })

  it('bounds a tiny mineral co-reactant before it could become negative', () => {
    const model = modelFixture([fixtures()[4]], { maxSubstepS: 1, maxTemperatureChangeK: 100 })
    const before = cellFixture(model, { charAlpha: 0.1, mineral: 1e-6, O2: 0.1 })
    const result = advanceChemistryCell(model, before, 1e-5)
    expect(result.substeps).toBeGreaterThan(1)
    expect(result.next.massKg[speciesIndex('mineral')]).toBeGreaterThanOrEqual(0)
    expect(result.next.massKg[speciesIndex('ash')]).toBeLessThan(1e-6)
    expectClosed(model, before, result.next)
  })

  it('backtracks a hot candidate without changing its reaction heats or clipping temperature', () => {
    const model = modelFixture([fixtures()[4]], { maxTemperatureChangeK: 1 },
      caloricFixture({ charAlpha: { chemicalReferenceJkg: 1e9 } }))
    const before = cellFixture(model, { charAlpha: 0.1, mineral: 0.1 })
    const result = advanceChemistryCell(model, before, 0.001)
    expect(result.rejectedCandidates).toBeGreaterThan(0)
    expect(result.substeps).toBeGreaterThan(1)
    expect(inspectChemistryCell(model, result.next).temperatureK).toBeGreaterThan(500)
    expect(result.next.timeS).toBe(0.001)
    expectClosed(model, before, result.next)
  })

  it('rejects the whole trial at the thermal-domain edge and leaves input bytes unchanged', () => {
    const model = modelFixture([fixtures()[4]], { minSubstepS: 1e-8, maxBacktracks: 20 })
    const before = cellFixture(model, { charAlpha: 0.1, mineral: 0.1 }, 1100)
    const snapshot = checkpointChemistryCell(model, before)
    expect(() => advanceChemistryCell(model, before, 0.01)).toThrow(ChemistryStepRejected)
    expect(checkpointChemistryCell(model, before)).toBe(snapshot)
  })

  it('rejects impossible stiffness rather than raising dt to a floor or silently reducing rates', () => {
    const f = fixtures()[1], model = modelFixture([
      { ...f, kinetics: { ...f.kinetics, preExponentialPerS: 1e30 } },
    ], { minSubstepS: 1e-9 })
    const before = cellFixture(model, { fuel: 0.1 })
    const snapshot = checkpointChemistryCell(model, before)
    expect(() => advanceChemistryCell(model, before, 1)).toThrow(/substep/)
    expect(checkpointChemistryCell(model, before)).toBe(snapshot)
  })

  it('rejects after a partly computed trial exhausts its budget, with no partial state exposed', () => {
    const model = modelFixture([fixtures()[1]], { maxSubsteps: 1, maxSubstepS: 0.005 })
    const before = cellFixture(model, { fuel: 0.1 }), snapshot = checkpointChemistryCell(model, before)
    expect(() => advanceChemistryCell(model, before, 0.1)).toThrow(/budget exhausted/)
    expect(checkpointChemistryCell(model, before)).toBe(snapshot)
    const retry = advanceChemistryCell(model, before, 0.001)
    const fresh = advanceChemistryCell(model, restoreChemistryCell(model, snapshot), 0.001)
    expect(checkpointChemistryCell(model, retry.next)).toBe(checkpointChemistryCell(model, fresh.next))
  })

  it('reports rate underflow explicitly instead of presenting it as physical extinction', () => {
    const f = fixtures()[1], model = modelFixture([
      { ...f, kinetics: { ...f.kinetics, activationEnergyJMol: 1e7 } },
    ])
    const before = cellFixture(model, { fuel: 0.1 }, 200)
    const result = advanceChemistryCell(model, before, 1)
    expect(result.underflowedRateEvaluations).toBe(1)
    expect(result.next.massKg).toEqual(before.massKg)
    expect(result.next.timeS).toBe(1)
  })

  it('rejects invalid dt and time increments too small for the physical clock', () => {
    const model = modelFixture(), before = cellFixture(model, { fuel: 0.1 })
    for (const dt of [-1, NaN, Infinity]) expect(() => advanceChemistryCell(model, before, dt)).toThrow()
    const later = { ...before, timeS: 1e9 }
    expect(() => advanceChemistryCell(model, later, Number.MIN_VALUE)).toThrow(/representable/)
  })

  it('shows first-order convergence to an exactly thermoneutral first-order decay fixture', () => {
    const reaction = fixtures()[1]
    // Required explicit synthetic fuel energy makes this manufactured pathway thermoneutral.
    const c = caloricFixture()
    const products = SPECIES_IDS.reduce((e, id) => id === 'fuel' ? e : e
      + reaction.stoichiometry[id] * (c.species[id].chemicalReferenceJkg + c.species[id].phaseReferenceJkg), 0)
    const neutral = caloricFixture({ fuel: { chemicalReferenceJkg: products } })
    const errors: number[] = []
    for (const h of [0.1, 0.05, 0.025]) {
      const model = modelFixture([reaction], { maxSubstepS: h }, neutral)
      const before = cellFixture(model, { fuel: 0.1, O2: 0 })
      const result = advanceChemistryCell(model, before, 1)
      expect(inspectChemistryCell(model, result.next).temperatureK).toBeCloseTo(500, 9)
      errors.push(Math.abs(result.next.massKg[speciesIndex('fuel')] - 0.1 * Math.exp(-0.5)))
      expectClosed(model, before, result.next)
    }
    expect(errors[0] / errors[1]).toBeGreaterThan(1.9)
    expect(errors[0] / errors[1]).toBeLessThan(2.2)
    expect(errors[1] / errors[2]).toBeGreaterThan(1.9)
    expect(errors[1] / errors[2]).toBeLessThan(2.2)
  })

  it('preserves closure and nonnegative states over a deterministic multi-inventory test matrix', () => {
    const model = modelFixture()
    for (let k = 1; k <= 36; k++) {
      const before = cellFixture(model, {
        fuel: 0.002 * k, pyrolysate: 0.0003 * (k % 5),
        charAlpha: 0.0002 * k, charBeta: 0.0001 * k, mineral: 0.01,
        liquidWater: 0.0001 * k, ice: 0.00002 * k, CO: 0.00001 * k,
        O2: k % 3 === 0 ? 0 : 0.001 * k,
      }, 400 + 3 * k)
      const result = advanceChemistryCell(model, before, 0.001)
      expect(result.closure.passed).toBe(true)
      expectClosed(model, before, result.next)
      expect(result.next.timeS).toBe(0.001)
    }
  })
})

describe('Task 2: physical-state restart, rejection and configuration determinism', () => {
  it('round-trips all species, thermal energy, geometry and fixed normalization capacities exactly', () => {
    const model = modelFixture()
    const before = cellFixture(model, {
      fuel: 0.1, pyrolysate: 0.01, charAlpha: 0.01, charBeta: 0.01, mineral: 0.03,
      liquidWater: 0.01, ice: 0.002, H2O: 0.001, CO: 0.001, CO2: 0.001, ash: 0.01,
    })
    const saved = checkpointChemistryCell(model, before), restored = restoreChemistryCell(model, saved)
    expect(checkpointChemistryCell(model, restored)).toBe(saved)
    expect(restored.massKg).not.toBe(before.massKg)
    expect(restored.referenceReactantKg).not.toBe(before.referenceReactantKg)
    restored.massKg[0] = 0
    expect(checkpointChemistryCell(model, before)).toBe(saved)
  })

  it('matches uninterrupted continuation bit-for-bit with the same call schedule and accumulated sources', () => {
    const model = modelFixture()
    let straight = cellFixture(model, {
      fuel: 0.1, pyrolysate: 0.01, charAlpha: 0.01, charBeta: 0.01, mineral: 0.1,
      liquidWater: 0.01, ice: 0.002, CO: 0.001,
    })
    let resumed = restoreChemistryCell(model, checkpointChemistryCell(model, straight))
    const sourceA = new Float64Array(SPECIES_IDS.length), sourceB = new Float64Array(SPECIES_IDS.length)
    let energyA = 0, energyB = 0
    for (let step = 0; step < 12; step++) {
      const a = advanceChemistryCell(model, straight, 0.02), b = advanceChemistryCell(model, resumed, 0.02)
      for (let i = 0; i < sourceA.length; i++) {
        sourceA[i] += a.sources.speciesKgDelta[i]; sourceB[i] += b.sources.speciesKgDelta[i]
      }
      energyA += a.sources.energyJ; energyB += b.sources.energyJ
      straight = a.next; resumed = b.next
      if (step === 5) resumed = restoreChemistryCell(model, checkpointChemistryCell(model, resumed))
    }
    expect(checkpointChemistryCell(model, resumed)).toBe(checkpointChemistryCell(model, straight))
    expect(sourceA).toEqual(sourceB)
    expect(energyA).toBe(energyB)
  })

  it('rejects missing, reordered, nonnumeric and stale-cache checkpoint fields', () => {
    const model = modelFixture(), saved = checkpointChemistryCell(model, cellFixture(model, { fuel: 0.1 }))
    for (const mutate of [
      (v: Record<string, unknown>) => { delete v.thermalEnergyJ },
      (v: Record<string, unknown>) => { v.speciesOrder = [...SPECIES_IDS].reverse() },
      (v: Record<string, unknown>) => { v.reactionOrder = [] },
      (v: Record<string, unknown>) => { v.temperatureK = 500 },
      (v: Record<string, unknown>) => { v.massKg = Array(SPECIES_IDS.length).fill('0') },
      (v: Record<string, unknown>) => { v.referenceReactantKg = Array(model.reactions.length).fill('10') },
      (v: Record<string, unknown>) => { v.thermalEnergyJ = null },
    ]) {
      const decoded = JSON.parse(saved) as Record<string, unknown>
      mutate(decoded)
      expect(() => restoreChemistryCell(model, JSON.stringify(decoded))).toThrow()
    }
    expect(() => restoreChemistryCell(model, '{')).toThrow(/JSON/)
  })

  it('rejects a changed rate, caloric parameter or solver control even with identical reaction IDs', () => {
    const model = modelFixture(), saved = checkpointChemistryCell(model, cellFixture(model, { fuel: 0.1 }))
    const reactions = fixtures()
    Object.assign(reactions[1].kinetics, { preExponentialPerS: 0.6 })
    const changed = [
      modelFixture(reactions), modelFixture(fixtures(), { maxSubstepS: 0.05 }),
      modelFixture(fixtures(), {}, caloricFixture({ fuel: { cvJkgK: 3001 } })),
    ]
    for (const other of changed) expect(() => restoreChemistryCell(other, saved)).toThrow(/configuration mismatch/)
  })

  it('preserves fixed capacities for initially empty products and rejects capacity exhaustion', () => {
    const model = modelFixture(), before = cellFixture(model, { fuel: 0.1, mineral: 0.1 }, 500, 60000, 1)
    const result = advanceChemistryCell(model, before, 0.01)
    expect(result.next.referenceReactantKg).toEqual(before.referenceReactantKg)
    expect(result.next.massKg[speciesIndex('pyrolysate')]).toBeGreaterThan(0)
    const invalid = result.next.referenceReactantKg.slice()
    invalid[model.reactions.findIndex(r => r.driver === 'pyrolysate')] = 1e-20
    expect(() => inspectChemistryCell(model, { ...result.next, referenceReactantKg: invalid })).toThrow(/capacity/)
  })

  it('gives the same result when the model is recompiled from a different reaction-list order', () => {
    const a = modelFixture(), b = modelFixture(fixtures().reverse())
    const before = cellFixture(a, { fuel: 0.1, mineral: 0.01 })
    const saved = checkpointChemistryCell(a, before)
    const x = advanceChemistryCell(a, before, 0.02)
    const y = advanceChemistryCell(b, restoreChemistryCell(b, saved), 0.02)
    expect(checkpointChemistryCell(a, x.next)).toBe(checkpointChemistryCell(b, y.next))
  })
})


describe('Task 2 cumulative review regressions', () => {
  it('canonicalizes signed-zero inventories and time before lossless checkpointing', () => {
    const model = modelFixture(), before = cellFixture(model, { fuel: -0 })
    expect(Object.is(before.massKg[speciesIndex('fuel')], -0)).toBe(false)
    const result = advanceChemistryCell(model, { ...before, timeS: -0 }, 0)
    expect(Object.is(result.next.timeS, -0)).toBe(false)
    const restored = restoreChemistryCell(model, checkpointChemistryCell(model, result.next))
    expect(restored).toEqual(result.next)
  })

  it('rejects conflicting caloric and kinetic validity intervals', () => {
    const f = fixtures()[1]
    const reaction = { ...f, kinetics: { ...f.kinetics, minTemperatureK: 900, maxTemperatureK: 1000 } }
    const caloric = { ...caloricFixture(), maxTemperatureK: 800 }
    expect(() => modelFixture([reaction], {}, caloric)).toThrow(/no common/)
  })

  it('rolls back pressure-limited gas generation instead of hiding extra vapor in background gas', () => {
    const model = modelFixture([fixtures()[1]], { minSubstepS: 1e-8, maxBacktracks: 24 })
    const before = cellFixture(model, { fuel: 0.1, N2: 0.005, O2: 0 }, 500, 299999)
    const saved = checkpointChemistryCell(model, before)
    expect(() => advanceChemistryCell(model, before, 0.01)).toThrow(ChemistryStepRejected)
    expect(checkpointChemistryCell(model, before)).toBe(saved)
  })

  it('restarts after actual drying without reapplying the phase-energy transfer', () => {
    const model = modelFixture()
    const initial = cellFixture(model, { fuel: 0.1, liquidWater: 0.05, mineral: 0.01 })
    const dry = trialDryingExtent(model, initial, 0.0001)
    const restored = restoreChemistryCell(model, checkpointChemistryCell(model, dry.next))
    const a = advanceChemistryCell(model, dry.next, 0.01)
    const b = advanceChemistryCell(model, restored, 0.01)
    expect(checkpointChemistryCell(model, a.next)).toBe(checkpointChemistryCell(model, b.next))
    expectClosed(model, initial, b.next)
  })

  it('advances a nonzero-nitrogen reaction with explicit N2 release and atom closure', () => {
    const organic = organics()
    Object.assign(organic.fuel.formula, { N: 2 })
    const reg = createSpeciesRegistry(organic), f = reg.fuel.molarMassKgMol!
    const reaction = definition('peat-pyrolysis', vector({
      fuel: -1, charAlpha: 2 * reg.charAlpha.molarMassKgMol! / f,
      pyrolysate: reg.pyrolysate.molarMassKgMol! / f,
      H2O: 2 * MOLAR[3] / f, N2: MOLAR[2] / f,
    }))
    const model = compileChemistryModel(organic, [reaction], caloricFixture(), controlsFixture())
    const before = cellFixture(model, { fuel: 0.1, O2: 0 })
    const result = advanceChemistryCell(model, before, 0.01)
    expect(result.sources.gasMolDelta[2]).toBeGreaterThan(0)
    expect(result.closure.atomResidualMol.N).toBeCloseTo(0, 12)
    expectClosed(model, before, result.next)
  })
})
