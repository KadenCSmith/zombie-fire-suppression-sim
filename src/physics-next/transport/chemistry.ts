import { MOLAR, R } from '../../coupled/thermodynamics'

/**
 * Inventory, rates, bounded closed-cell chemistry, and restart primitives.
 * Local kg state and energy convention are NOT the frozen shared state schema.
 * Extent basis: kg of the named primary reactant consumed; its coefficient is -1.
 * Every stoichiometric coefficient is kg species / kg reaction extent.
 * Organic formula units are dry, ash-free CHON lumps, not measured peat defaults.
 */
export const CHEMISTRY_SCHEMA = 'agent-b-inventory-v1' as const
export const ELEMENTS = ['C', 'H', 'O', 'N'] as const
export type Element = typeof ELEMENTS[number]
export const ORGANIC_IDS = ['fuel', 'pyrolysate', 'charAlpha', 'charBeta'] as const
export type OrganicId = typeof ORGANIC_IDS[number]
export const GAS_IDS = ['O2', 'CO2', 'N2', 'H2O', 'CO'] as const
export const SPECIES_IDS = [
  ...ORGANIC_IDS, 'mineral', 'ash', 'liquidWater', 'ice', ...GAS_IDS,
] as const
export type SpeciesId = typeof SPECIES_IDS[number]
export type Formula = Readonly<Record<Element, number>>
export type MassVector = Readonly<Record<SpeciesId, number>>

/**
 * Derived from the baseline's molar masses to preserve its mass ledgers.
 * These are bookkeeping weights, NOT a new table of measured atomic weights.
 * A later change of molar-mass convention needs a versioned integrator migration.
 */
export const LEDGER_ATOMIC_KG_MOL: Formula = Object.freeze({
  O: MOLAR[0] / 2,
  C: MOLAR[1] - MOLAR[0],
  H: (MOLAR[3] - MOLAR[0] / 2) / 2,
  N: MOLAR[2] / 2,
})

export interface Evidence {
  readonly kind: 'measured' | 'literature-input' | 'model-definition' | 'synthetic-test'
  readonly source: string
  readonly specimen: string
  readonly limits: string
}
export interface OrganicDefinition {
  readonly formula: Formula
  readonly evidence: Evidence
}
export type OrganicDefinitions = Readonly<Record<OrganicId, OrganicDefinition>>
export interface SpeciesDefinition {
  readonly id: SpeciesId
  readonly phase: 'solid' | 'condensed-intermediate' | 'liquid' | 'ice' | 'gas'
  readonly atomsMolPerKg: Formula
  readonly inertKgPerKg: number
  /** Null for chemically unchanged mineral/ash; never interpret kg of ash as mol. */
  readonly molarMassKgMol: number | null
  readonly evidence: Evidence
}
export type SpeciesRegistry = Readonly<Record<SpeciesId, SpeciesDefinition>>

export class ChemistryInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChemistryInputError'
  }
}
function fail(message: string): never { throw new ChemistryInputError(message) }

function exactKeys(value: unknown, keys: readonly string[], label: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label}: object required`)
  }
  const object = value as Record<string, unknown>
  for (const key of keys) {
    if (!Object.hasOwn(object, key)) fail(`${label}.${key}: explicitly required`)
  }
  for (const key of Object.keys(object)) {
    if (!keys.includes(key)) fail(`${label}.${key}: unsupported field`)
  }
}
function bounded(value: number, low: number, high: number, label: string): void {
  if (!Number.isFinite(value) || value < low || value > high) {
    fail(`${label}: finite value in [${low}, ${high}] required`)
  }
}
function positive(value: number, high: number, label: string): void {
  bounded(value, 0, high, label)
  if (value === 0) fail(`${label}: positive value required`)
}
function text(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label}: text required`)
}
function copyEvidence(value: Evidence): Evidence {
  exactKeys(value, ['kind', 'source', 'specimen', 'limits'], 'evidence')
  if (!['measured', 'literature-input', 'model-definition', 'synthetic-test'].includes(value.kind)) {
    fail('evidence.kind: unsupported provenance')
  }
  text(value.source, 'evidence.source')
  text(value.specimen, 'evidence.specimen')
  text(value.limits, 'evidence.limits')
  return Object.freeze({ ...value })
}
function zeroFormula(): Record<Element, number> { return { C: 0, H: 0, O: 0, N: 0 } }

function molecularSpecies(
  id: SpeciesId, phase: SpeciesDefinition['phase'], formula: Formula,
  evidence: Evidence, fixedMolarMass?: number,
): SpeciesDefinition {
  exactKeys(formula, ELEMENTS, `${id}.formula`)
  let mass = 0
  for (const element of ELEMENTS) {
    bounded(formula[element], 0, 1e6, `${id}.formula.${element}`)
    mass += formula[element] * LEDGER_ATOMIC_KG_MOL[element]
  }
  positive(mass, 1e6, `${id}.formula mass`)
  if (fixedMolarMass !== undefined) {
    if (Math.abs(mass - fixedMolarMass) > 1e-12 * fixedMolarMass) {
      fail(`${id}: inconsistent molar-mass convention`)
    }
    mass = fixedMolarMass
  }
  const atoms = zeroFormula()
  for (const element of ELEMENTS) atoms[element] = formula[element] / mass
  return Object.freeze({
    id, phase, atomsMolPerKg: Object.freeze(atoms),
    inertKgPerKg: 0, molarMassKgMol: mass, evidence: copyEvidence(evidence),
  })
}
function inertSpecies(id: 'mineral' | 'ash', evidence: Evidence): SpeciesDefinition {
  return Object.freeze({
    id, phase: 'solid', atomsMolPerKg: Object.freeze(zeroFormula()),
    inertKgPerKg: 1, molarMassKgMol: null, evidence: copyEvidence(evidence),
  })
}

/** Requires formulas for all four organic pools; contains no peat calibration. */
export function createSpeciesRegistry(input: OrganicDefinitions): SpeciesRegistry {
  exactKeys(input, ORGANIC_IDS, 'organic definitions')
  const result = {} as Record<SpeciesId, SpeciesDefinition>
  for (const id of ORGANIC_IDS) {
    exactKeys(input[id], ['formula', 'evidence'], id)
    exactKeys(input[id].formula, ELEMENTS, `${id}.formula`)
    positive(input[id].formula.C, 1e6, `${id}.formula.C`)
    result[id] = molecularSpecies(
      id, id === 'pyrolysate' ? 'condensed-intermediate' : 'solid',
      input[id].formula, input[id].evidence,
    )
  }
  const known: Evidence = {
    kind: 'model-definition',
    source: 'Pinned src/coupled/thermodynamics.ts:3-4; stoichiometric identities',
    specimen: 'Molecular definitions only; not a peat measurement',
    limits: 'Baseline-compatible molar weights; no caloric or transport properties supplied',
  }
  result.O2 = molecularSpecies('O2', 'gas', { C: 0, H: 0, O: 2, N: 0 }, known, MOLAR[0])
  result.CO2 = molecularSpecies('CO2', 'gas', { C: 1, H: 0, O: 2, N: 0 }, known, MOLAR[1])
  result.N2 = molecularSpecies('N2', 'gas', { C: 0, H: 0, O: 0, N: 2 }, known, MOLAR[2])
  result.CO = molecularSpecies('CO', 'gas', { C: 1, H: 0, O: 1, N: 0 }, known)
  const water = { C: 0, H: 2, O: 1, N: 0 }
  result.H2O = molecularSpecies('H2O', 'gas', water, known, MOLAR[3])
  result.liquidWater = molecularSpecies('liquidWater', 'liquid', water, known, MOLAR[3])
  result.ice = molecularSpecies('ice', 'ice', water, known, MOLAR[3])
  const inert: Evidence = {
    kind: 'model-definition',
    source: 'Agent B invariant-pool bookkeeping proposal; baseline inert mineral inventory',
    specimen: 'Chemically unchanged mineral component of this specimen',
    limits: 'Not mineral chemistry; no mineral gas release, dissolution or changing composition',
  }
  result.mineral = inertSpecies('mineral', inert)
  result.ash = inertSpecies('ash', inert)
  return Object.freeze(result)
}

export interface BalanceAudit {
  readonly massResidualKgPerKgExtent: number
  readonly atomResidualMolPerKgExtent: Formula
  readonly inertResidualKgPerKgExtent: number
  readonly maxScaledResidual: number
  readonly passed: boolean
}
/** Roundoff gates, not experimental accuracy or a permission to clip inventories. */
export const BALANCE_ABS = 1e-12
export const BALANCE_REL = 1e-12

/** Inputs must state a coefficient, including explicit zero, for every species. */
export function auditReaction(registry: SpeciesRegistry, vector: MassVector): BalanceAudit {
  exactKeys(vector, SPECIES_IDS, 'stoichiometry')
  let mass = 0, throughput = 0, inert = 0, inertThroughput = 0
  const atoms = zeroFormula(), atomThroughput = zeroFormula()
  for (const id of SPECIES_IDS) {
    const coefficient = vector[id], species = registry[id]
    bounded(coefficient, -1e6, 1e6, `stoichiometry.${id}`)
    mass += coefficient
    throughput += Math.abs(coefficient)
    inert += coefficient * species.inertKgPerKg
    inertThroughput += Math.abs(coefficient * species.inertKgPerKg)
    for (const element of ELEMENTS) {
      const contribution = coefficient * species.atomsMolPerKg[element]
      atoms[element] += contribution
      atomThroughput[element] += Math.abs(contribution)
    }
  }
  const scaled = (residual: number, scale: number) =>
    Math.abs(residual) / (BALANCE_ABS + BALANCE_REL * scale)
  let maximum = Math.max(scaled(mass, throughput), scaled(inert, inertThroughput))
  for (const element of ELEMENTS) maximum = Math.max(maximum, scaled(atoms[element], atomThroughput[element]))
  return Object.freeze({
    massResidualKgPerKgExtent: mass,
    atomResidualMolPerKgExtent: Object.freeze(atoms),
    inertResidualKgPerKgExtent: inert,
    maxScaledResidual: maximum, passed: Number.isFinite(maximum) && maximum <= 1,
  })
}

export const STAGES = [
  'drying', 'peat-pyrolysis', 'peat-oxidation', 'pyrolysate-conversion',
  'char-alpha-oxidation', 'char-beta-oxidation',
] as const
export type ReactionStage = typeof STAGES[number]
const DRIVER: Readonly<Record<ReactionStage, SpeciesId>> = Object.freeze({
  drying: 'liquidWater', 'peat-pyrolysis': 'fuel', 'peat-oxidation': 'fuel',
  'pyrolysate-conversion': 'pyrolysate',
  'char-alpha-oxidation': 'charAlpha', 'char-beta-oxidation': 'charBeta',
})
export interface ArrheniusParameters {
  readonly preExponentialPerS: number
  readonly activationEnergyJMol: number
  readonly solidOrder: number
  readonly oxygenOrder: number
  readonly oxygenReferencePa: number
  readonly minTemperatureK: number
  readonly maxTemperatureK: number
  readonly minPressurePa: number
  readonly maxPressurePa: number
}
export interface ReactionDefinition {
  readonly id: string
  readonly stage: ReactionStage
  readonly stoichiometry: MassVector
  readonly kinetics: ArrheniusParameters
  readonly evidence: Evidence
}
export interface CompiledReaction extends ReactionDefinition {
  readonly driver: SpeciesId
  readonly balance: BalanceAudit
  /** Drying is a water-operator request, not a second chemistry heat source. */
  readonly owner: 'water' | 'chemistry'
}
function copyKinetics(value: ArrheniusParameters): ArrheniusParameters {
  exactKeys(value, [
    'preExponentialPerS', 'activationEnergyJMol', 'solidOrder', 'oxygenOrder',
    'oxygenReferencePa', 'minTemperatureK', 'maxTemperatureK', 'minPressurePa', 'maxPressurePa',
  ], 'kinetics')
  // Broad numerical support bounds. None is a measured confidence interval.
  bounded(value.preExponentialPerS, 0, 1e30, 'preExponentialPerS')
  bounded(value.activationEnergyJMol, 0, 1e7, 'activationEnergyJMol')
  bounded(value.solidOrder, 0, 10, 'solidOrder')
  bounded(value.oxygenOrder, 0, 10, 'oxygenOrder')
  bounded(value.oxygenReferencePa, 1, 300000, 'oxygenReferencePa')
  bounded(value.minTemperatureK, 150, 1200, 'minTemperatureK')
  bounded(value.maxTemperatureK, value.minTemperatureK, 1200, 'maxTemperatureK')
  bounded(value.minPressurePa, 1000, 300000, 'minPressurePa')
  bounded(value.maxPressurePa, value.minPressurePa, 300000, 'maxPressurePa')
  return Object.freeze({ ...value })
}

export function compileReaction(registry: SpeciesRegistry, input: ReactionDefinition): CompiledReaction {
  exactKeys(input, ['id', 'stage', 'stoichiometry', 'kinetics', 'evidence'], 'reaction')
  text(input.id, 'reaction.id')
  if (!STAGES.includes(input.stage)) fail('reaction.stage: unsupported stage')
  const driver = DRIVER[input.stage], coefficients = input.stoichiometry
  const balance = auditReaction(registry, coefficients)
  if (coefficients[driver] !== -1) fail('primary-reactant coefficient must be exactly -1 kg/kg extent')
  if (!balance.passed) fail(`reaction ${input.id}: atom/mass/inert imbalance`)
  const kinetics = copyKinetics(input.kinetics)
  const evidence = copyEvidence(input.evidence)
  if (coefficients.O2 > 0 || coefficients.mineral > 0 || coefficients.ash < 0) {
    fail('unsupported oxygen production or reverse mineral/ash transfer')
  }
  for (const id of SPECIES_IDS) {
    if (coefficients[id] < 0 && ![driver, 'O2', 'mineral'].includes(id)) {
      fail(`unsupported co-reactant ${id}`)
    }
  }
  const oxidizing = input.stage === 'peat-oxidation'
    || input.stage === 'char-alpha-oxidation' || input.stage === 'char-beta-oxidation'
  if (oxidizing ? coefficients.O2 >= 0 : coefficients.O2 !== 0) {
    fail('stage oxygen stoichiometry does not match oxidation/nonoxidation role')
  }
  if (oxidizing ? kinetics.oxygenOrder <= 0 : kinetics.oxygenOrder !== 0) {
    fail('oxidation needs positive oxygen order; nonoxidation needs explicit zero')
  }
  if (input.stage === 'drying') {
    for (const id of SPECIES_IDS) {
      const expected = id === 'liquidWater' ? -1 : id === 'H2O' ? 1 : 0
      if (coefficients[id] !== expected) fail('drying must transfer only liquid water to vapor')
    }
  }
  if (input.stage !== 'drying' && (coefficients.liquidWater !== 0 || coefficients.ice !== 0)) {
    fail('chemistry water products must be explicit vapor; condensed phase changes are water-owned')
  }
  const allowedOrganicProducts: readonly OrganicId[] =
    input.stage === 'peat-pyrolysis' ? ['pyrolysate', 'charAlpha']
      : input.stage === 'peat-oxidation' ? ['charBeta']
        : input.stage === 'pyrolysate-conversion' ? ['charAlpha'] : []
  for (const id of ORGANIC_IDS) {
    if (coefficients[id] > 0 && !allowedOrganicProducts.includes(id)) {
      fail(`unsupported organic product ${id} for ${input.stage}`)
    }
  }
  if (allowedOrganicProducts.length > 0 && !allowedOrganicProducts.some(id => coefficients[id] > 0)) {
    fail('stage requires an explicit intermediate/char yield')
  }
  return Object.freeze({
    id: input.id, stage: input.stage, stoichiometry: Object.freeze({ ...coefficients }),
    kinetics, evidence, driver, balance, owner: input.stage === 'drying' ? 'water' : 'chemistry',
  })
}
export function compileNetwork(
  registry: SpeciesRegistry, definitions: readonly ReactionDefinition[],
): readonly CompiledReaction[] {
  if (!Array.isArray(definitions) || definitions.length === 0) fail('nonempty reaction list required')
  const seen = new Set<string>()
  const reactions = definitions.map(definition => {
    const reaction = compileReaction(registry, definition)
    if (seen.has(reaction.id)) fail(`duplicate reaction id ${reaction.id}`)
    seen.add(reaction.id)
    return reaction
  })
  return Object.freeze(reactions)
}

export interface RateInput {
  readonly temperatureK: number
  readonly totalPressurePa: number
  readonly oxygenPartialPressurePa: number
  readonly reactantKg: number
  /** Fixed positive normalization capacity, not the current shrinking mass. */
  readonly referenceReactantKg: number
}
export interface RateEvaluation {
  readonly extentKgPerS: number
  readonly underflowed: boolean
}
/**
 * r = m_ref A exp(-E/RT) (m/m_ref)^n (pO2/p_ref)^nO, in kg extent/s.
 * This is NOT the baseline Monod-like mole-fraction law or a copied peat fit.
 * Validating a rate does not bound a timestep or shared-reactant depletion.
 */
export function evaluateRate(reaction: CompiledReaction, input: RateInput): RateEvaluation {
  exactKeys(input, [
    'temperatureK', 'totalPressurePa', 'oxygenPartialPressurePa',
    'reactantKg', 'referenceReactantKg',
  ], 'rate input')
  const k = reaction.kinetics
  bounded(input.temperatureK, k.minTemperatureK, k.maxTemperatureK, 'temperatureK')
  bounded(input.totalPressurePa, k.minPressurePa, k.maxPressurePa, 'totalPressurePa')
  bounded(input.oxygenPartialPressurePa, 0, input.totalPressurePa, 'oxygenPartialPressurePa')
  positive(input.referenceReactantKg, 1e12, 'referenceReactantKg')
  bounded(input.reactantKg, 0, input.referenceReactantKg, 'reactantKg')
  if (k.preExponentialPerS === 0 || input.reactantKg === 0
    || (k.oxygenOrder > 0 && input.oxygenPartialPressurePa === 0)) {
    return { extentKgPerS: 0, underflowed: false }
  }
  // Difference of logs avoids premature underflow of m/m_ref.
  const solidLog = k.solidOrder === 0 ? 0
    : k.solidOrder * (Math.log(input.reactantKg) - Math.log(input.referenceReactantKg))
  const oxygenLog = k.oxygenOrder === 0 ? 0
    : k.oxygenOrder * (Math.log(input.oxygenPartialPressurePa) - Math.log(k.oxygenReferencePa))
  const logRate = Math.log(input.referenceReactantKg) + Math.log(k.preExponentialPerS)
    - k.activationEnergyJMol / (R * input.temperatureK) + solidLog + oxygenLog
  const rate = Math.exp(logRate)
  if (!Number.isFinite(rate) || rate < 0) fail('rate left supported numerical envelope')
  return { extentKgPerS: rate, underflowed: rate === 0 }
}

export function speciesIndex(id: SpeciesId): number {
  const index = SPECIES_IDS.indexOf(id)
  if (index < 0) fail(`unsupported species id ${String(id)}`)
  return index
}

/** Local bookkeeping vector, kg for EVERY entry, including gas; not primary state. */
export function copyInventoryKg(input: ArrayLike<number>): Float64Array {
  if (input == null || input.length !== SPECIES_IDS.length) fail('inventory length mismatch')
  const result = new Float64Array(SPECIES_IDS.length)
  for (let index = 0; index < result.length; index++) {
    bounded(input[index], 0, 1e12, `inventory[${index}]`)
    result[index] = input[index] === 0 ? 0 : input[index]
  }
  return result
}
export interface InventoryTotals {
  readonly totalMassKg: number
  readonly atomsMol: Formula
  readonly inertKg: number
  readonly charKg: number
  readonly waterAllPhasesKg: number
}
export function inventoryTotals(registry: SpeciesRegistry, input: ArrayLike<number>): InventoryTotals {
  const mass = copyInventoryKg(input), atoms = zeroFormula()
  let total = 0, inert = 0
  for (const id of SPECIES_IDS) {
    const amount = mass[speciesIndex(id)]
    total += amount
    inert += amount * registry[id].inertKgPerKg
    for (const element of ELEMENTS) atoms[element] += amount * registry[id].atomsMolPerKg[element]
  }
  return Object.freeze({
    totalMassKg: total, atomsMol: Object.freeze(atoms), inertKg: inert,
    charKg: mass[speciesIndex('charAlpha')] + mass[speciesIndex('charBeta')],
    waterAllPhasesKg: mass[speciesIndex('liquidWater')] + mass[speciesIndex('ice')] + mass[speciesIndex('H2O')],
  })
}

export interface WetPeatInput {
  readonly wetPeatKg: number
  /** Condensed water / total dry peat (organic + mineral), kg/kg; may exceed 1. */
  readonly moistureDryBasis: number
  readonly mineralFractionOfDryPeat: number
  /** Caller-specified initial phase partition; NOT a freezing/equilibrium model. */
  readonly liquidFractionOfWater: number
}
/** Wet peat is an initialization aggregate, never an independently stored species. */
export function inventoryFromWetPeat(input: WetPeatInput): Float64Array {
  exactKeys(input, [
    'wetPeatKg', 'moistureDryBasis', 'mineralFractionOfDryPeat', 'liquidFractionOfWater',
  ], 'wet peat')
  bounded(input.wetPeatKg, 0, 1e12, 'wetPeatKg')
  bounded(input.moistureDryBasis, 0, 1e6, 'moistureDryBasis')
  bounded(input.mineralFractionOfDryPeat, 0, 1, 'mineralFractionOfDryPeat')
  bounded(input.liquidFractionOfWater, 0, 1, 'liquidFractionOfWater')
  const dry = input.wetPeatKg / (1 + input.moistureDryBasis)
  const water = input.wetPeatKg - dry
  const mineral = dry * input.mineralFractionOfDryPeat
  const liquid = water * input.liquidFractionOfWater
  const result = new Float64Array(SPECIES_IDS.length)
  result[speciesIndex('fuel')] = dry - mineral
  result[speciesIndex('mineral')] = mineral
  result[speciesIndex('liquidWater')] = liquid
  result[speciesIndex('ice')] = water - liquid
  return result
}

/** Exact guard; never drop CO, fold it into N2/CO2, or renormalize four-gas fractions. */
export function assertNoUnsupportedCO(
  reactions: readonly CompiledReaction[], inventoryKg: ArrayLike<number>,
): void {
  const inventory = copyInventoryKg(inventoryKg)
  if (inventory[speciesIndex('CO')] !== 0 || reactions.some(reaction => reaction.stoichiometry.CO !== 0)) {
    fail('CO requires an integrator-owned extended species/storage/energy schema')
  }
}

/** Task 2: local, adiabatic, frozen-geometry chemistry; no spatial transport. */
export const CHEMISTRY_STATE_SCHEMA = 'agent-b-chemistry-cell-v2' as const
export const CHEMISTRY_METHOD = 'bounded-forward-euler-internal-energy-v1' as const

export interface SpeciesCaloricInput {
  /** Constant mass-specific heat capacity for internal energy, J/(kg K). */
  readonly cvJkgK: number
  /** Phase/sensible-reference contribution at common reference temperature, J/kg. */
  readonly phaseReferenceJkg: number
  /** Chemical reference contribution at that same temperature, J/kg. */
  readonly chemicalReferenceJkg: number
  readonly evidence: Evidence
}
export interface CaloricInput {
  readonly referenceTemperatureK: number
  readonly minTemperatureK: number
  readonly maxTemperatureK: number
  readonly minPressurePa: number
  readonly maxPressurePa: number
  readonly liquidDensityKgM3: number
  readonly iceDensityKgM3: number
  readonly species: Readonly<Record<SpeciesId, SpeciesCaloricInput>>
  readonly evidence: Evidence
}
export interface ChemistryControls {
  readonly maxSubstepS: number
  readonly minSubstepS: number
  readonly maxSubsteps: number
  readonly maxBacktracks: number
  /** Strictly below 1; applies to GROSS consumption, not net species loss. */
  readonly maxConsumedFraction: number
  readonly maxTemperatureChangeK: number
  readonly massAbsoluteToleranceKg: number
  readonly atomAbsoluteToleranceMol: number
  readonly energyAbsoluteToleranceJ: number
  readonly relativeTolerance: number
}
export interface ChemistryModel {
  readonly registry: SpeciesRegistry
  /** Canonical binary lexicographic ID order, independent of input list order. */
  readonly reactions: readonly CompiledReaction[]
  readonly caloric: CaloricInput
  readonly controls: ChemistryControls
  readonly minTemperatureK: number
  readonly maxTemperatureK: number
  readonly minPressurePa: number
  readonly maxPressurePa: number
  /** Full canonical configuration text, not a security hash or a user-supplied label. */
  readonly configurationKey: string
}
export class ChemistryStepRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChemistryStepRejected'
  }
}
function reject(message: string): never { throw new ChemistryStepRejected(message) }

/** Compensated summation; no mass clipping or closure repair. */
function sum(values: readonly number[]): number {
  let total = 0, correction = 0
  for (const value of values) {
    const next = total + value
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total
    total = next
  }
  return total + correction
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`
  }
  const encoded = JSON.stringify(value)
  if (encoded === undefined) fail('configuration contains an unserializable value')
  return encoded
}
function copyCaloric(input: CaloricInput): CaloricInput {
  exactKeys(input, [
    'referenceTemperatureK', 'minTemperatureK', 'maxTemperatureK', 'minPressurePa',
    'maxPressurePa', 'liquidDensityKgM3', 'iceDensityKgM3', 'species', 'evidence',
  ], 'caloric')
  bounded(input.minTemperatureK, 150, 1200, 'caloric.minTemperatureK')
  bounded(input.maxTemperatureK, input.minTemperatureK, 1200, 'caloric.maxTemperatureK')
  bounded(input.referenceTemperatureK, input.minTemperatureK, input.maxTemperatureK, 'referenceTemperatureK')
  bounded(input.minPressurePa, 1000, 300000, 'caloric.minPressurePa')
  bounded(input.maxPressurePa, input.minPressurePa, 300000, 'caloric.maxPressurePa')
  bounded(input.liquidDensityKgM3, 1, 1e5, 'liquidDensityKgM3')
  bounded(input.iceDensityKgM3, 1, 1e5, 'iceDensityKgM3')
  exactKeys(input.species, SPECIES_IDS, 'caloric.species')
  const species = {} as Record<SpeciesId, SpeciesCaloricInput>
  for (const id of SPECIES_IDS) {
    const entry = input.species[id]
    exactKeys(entry, ['cvJkgK', 'phaseReferenceJkg', 'chemicalReferenceJkg', 'evidence'], `caloric.${id}`)
    bounded(entry.cvJkgK, 1e-6, 1e6, `${id}.cvJkgK`)
    bounded(entry.phaseReferenceJkg, -1e10, 1e10, `${id}.phaseReferenceJkg`)
    bounded(entry.chemicalReferenceJkg, -1e10, 1e10, `${id}.chemicalReferenceJkg`)
    species[id] = Object.freeze({ ...entry, evidence: copyEvidence(entry.evidence) })
  }
  // Relabeling the SAME unchanged mineral cannot manufacture a heat source.
  for (const key of ['cvJkgK', 'phaseReferenceJkg', 'chemicalReferenceJkg'] as const) {
    if (species.mineral[key] !== species.ash[key]) fail('mineral and ash caloric properties must match')
  }
  for (const id of ['ice', 'H2O'] as const) {
    if (species[id].chemicalReferenceJkg !== species.liquidWater.chemicalReferenceJkg) {
      fail('water phases must share one chemical reference; latent energy belongs in phase references')
    }
  }
  for (const t of [input.minTemperatureK, input.maxTemperatureK]) {
    const phaseU = (id: SpeciesId) => species[id].phaseReferenceJkg
      + species[id].cvJkgK * (t - input.referenceTemperatureK)
    if (!(phaseU('H2O') > phaseU('liquidWater') && phaseU('liquidWater') > phaseU('ice'))) {
      fail('water phase internal-energy ordering must hold across the declared caloric interval')
    }
  }
  return Object.freeze({ ...input, species: Object.freeze(species), evidence: copyEvidence(input.evidence) })
}
function copyControls(input: ChemistryControls): ChemistryControls {
  exactKeys(input, [
    'maxSubstepS', 'minSubstepS', 'maxSubsteps', 'maxBacktracks', 'maxConsumedFraction',
    'maxTemperatureChangeK', 'massAbsoluteToleranceKg', 'atomAbsoluteToleranceMol',
    'energyAbsoluteToleranceJ', 'relativeTolerance',
  ], 'controls')
  positive(input.maxSubstepS, 1e6, 'maxSubstepS')
  positive(input.minSubstepS, input.maxSubstepS, 'minSubstepS')
  bounded(input.maxSubsteps, 1, 100000, 'maxSubsteps')
  bounded(input.maxBacktracks, 1, 60, 'maxBacktracks')
  if (!Number.isInteger(input.maxSubsteps) || !Number.isInteger(input.maxBacktracks)) fail('iteration limits must be integers')
  positive(input.maxConsumedFraction, 0.25, 'maxConsumedFraction')
  positive(input.maxTemperatureChangeK, 100, 'maxTemperatureChangeK')
  bounded(input.massAbsoluteToleranceKg, 0, 1e-6, 'massAbsoluteToleranceKg')
  bounded(input.atomAbsoluteToleranceMol, 0, 1e-3, 'atomAbsoluteToleranceMol')
  bounded(input.energyAbsoluteToleranceJ, 0, 1e-2, 'energyAbsoluteToleranceJ')
  bounded(input.relativeTolerance, 0, 1e-6, 'relativeTolerance')
  return Object.freeze({ ...input })
}

/** No coefficient defaults, fitted mechanism, inferred phase data, or heat-of-combustion input. */
export function compileChemistryModel(
  organic: OrganicDefinitions, definitions: readonly ReactionDefinition[],
  caloricInput: CaloricInput, controlsInput: ChemistryControls,
): ChemistryModel {
  const registry = createSpeciesRegistry(organic)
  const reactions = Object.freeze([...compileNetwork(registry, definitions)].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (reactions.length > 64) fail('at most 64 local reactions supported')
  if (reactions.filter(r => r.owner === 'water').length > 1) fail('at most one water-owned drying primitive supported')
  const caloric = copyCaloric(caloricInput), controls = copyControls(controlsInput)
  const chemistry = reactions.filter(r => r.owner === 'chemistry')
  const minTemperatureK = Math.max(caloric.minTemperatureK, ...chemistry.map(r => r.kinetics.minTemperatureK))
  const maxTemperatureK = Math.min(caloric.maxTemperatureK, ...chemistry.map(r => r.kinetics.maxTemperatureK))
  const minPressurePa = Math.max(caloric.minPressurePa, ...chemistry.map(r => r.kinetics.minPressurePa))
  const maxPressurePa = Math.min(caloric.maxPressurePa, ...chemistry.map(r => r.kinetics.maxPressurePa))
  if (minTemperatureK > maxTemperatureK || minPressurePa > maxPressurePa) fail('no common chemistry/caloric validity interval')
  const configurationKey = canonical({
    schema: CHEMISTRY_STATE_SCHEMA, method: CHEMISTRY_METHOD, registry, reactions, caloric, controls,
    gasConstant: R, speciesOrder: SPECIES_IDS,
  })
  return Object.freeze({
    registry, reactions, caloric, controls, minTemperatureK, maxTemperatureK,
    minPressurePa, maxPressurePa, configurationKey,
  })
}
export interface ChemistryCellState {
  readonly schema: typeof CHEMISTRY_STATE_SCHEMA
  readonly configurationKey: string
  readonly timeS: number
  readonly massKg: Float64Array
  /** Sensible + phase energy only, J. Chemical reference energy is separately reconstructible. */
  readonly thermalEnergyJ: number
  /** Integrator-supplied frozen pore volume, excluding the solid skeleton, m^3. */
  readonly poreVolumeM3: number
  /** Fixed capacities in model.reactions order; include initially empty produced pools. */
  readonly referenceReactantKg: Float64Array
}
export interface CellThermodynamics {
  readonly temperatureK: number
  readonly gasVolumeM3: number
  readonly totalPressurePa: number
  readonly oxygenPartialPressurePa: number
  readonly capacityJK: number
  readonly chemicalEnergyJ: number
  readonly totalInternalEnergyJ: number
}
function thermalAt(model: ChemistryModel, mass: ArrayLike<number>, temperatureK: number): number {
  return sum(SPECIES_IDS.map((id, i) => mass[i] * (
    model.caloric.species[id].phaseReferenceJkg
    + model.caloric.species[id].cvJkgK * (temperatureK - model.caloric.referenceTemperatureK)
  )))
}
function recover(model: ChemistryModel, state: ChemistryCellState): CellThermodynamics {
  const c = model.caloric, mass = state.massKg
  const capacityJK = sum(SPECIES_IDS.map((id, i) => mass[i] * c.species[id].cvJkgK))
  positive(capacityJK, 1e20, 'cell heat capacity')
  const phaseJ = sum(SPECIES_IDS.map((id, i) => mass[i] * c.species[id].phaseReferenceJkg))
  const temperatureK = c.referenceTemperatureK + (state.thermalEnergyJ - phaseJ) / capacityJK
  bounded(temperatureK, model.minTemperatureK, model.maxTemperatureK, 'recovered temperatureK')
  const gasVolumeM3 = state.poreVolumeM3
    - mass[speciesIndex('liquidWater')] / c.liquidDensityKgM3
    - mass[speciesIndex('ice')] / c.iceDensityKgM3
  positive(gasVolumeM3, 1e12, 'gas volume')
  const gasMoles = GAS_IDS.map(id => mass[speciesIndex(id)] / model.registry[id].molarMassKgMol!)
  const totalMoles = sum(gasMoles)
  const totalPressurePa = totalMoles * R * temperatureK / gasVolumeM3
  bounded(totalPressurePa, model.minPressurePa, model.maxPressurePa, 'recovered totalPressurePa')
  const oxygenPartialPressurePa = totalPressurePa * (gasMoles[0] / totalMoles)
  const chemicalEnergyJ = sum(SPECIES_IDS.map((id, i) => mass[i] * c.species[id].chemicalReferenceJkg))
  return Object.freeze({
    temperatureK, gasVolumeM3, totalPressurePa, oxygenPartialPressurePa, capacityJK,
    chemicalEnergyJ, totalInternalEnergyJ: state.thermalEnergyJ + chemicalEnergyJ,
  })
}
function ownedState(model: ChemistryModel, input: ChemistryCellState): ChemistryCellState {
  exactKeys(input, [
    'schema', 'configurationKey', 'timeS', 'massKg', 'thermalEnergyJ', 'poreVolumeM3', 'referenceReactantKg',
  ], 'chemistry state')
  if (input.schema !== CHEMISTRY_STATE_SCHEMA || input.configurationKey !== model.configurationKey) {
    fail('chemistry schema/configuration mismatch; explicit migration required')
  }
  bounded(input.timeS, 0, 1e12, 'timeS')
  bounded(input.thermalEnergyJ, -1e30, 1e30, 'thermalEnergyJ')
  positive(input.poreVolumeM3, 1e12, 'poreVolumeM3')
  const massKg = copyInventoryKg(input.massKg)
  if (input.referenceReactantKg == null || input.referenceReactantKg.length !== model.reactions.length) {
    fail('reference capacity count mismatch')
  }
  for (let j = 0; j < model.reactions.length; j++) positive(input.referenceReactantKg[j], 1e12, `reference capacity ${j}`)
  const referenceReactantKg = Float64Array.from(input.referenceReactantKg)
  for (let j = 0; j < model.reactions.length; j++) {
    positive(referenceReactantKg[j], 1e12, `reference capacity ${j}`)
    bounded(massKg[speciesIndex(model.reactions[j].driver)], 0, referenceReactantKg[j], `driver capacity ${j}`)
  }
  const result = Object.freeze({
    ...input, massKg, referenceReactantKg,
    timeS: input.timeS === 0 ? 0 : input.timeS,
    thermalEnergyJ: input.thermalEnergyJ === 0 ? 0 : input.thermalEnergyJ,
  })
  recover(model, result)
  return result
}
export function inspectChemistryCell(model: ChemistryModel, input: ChemistryCellState): CellThermodynamics {
  return recover(model, ownedState(model, input))
}
export interface ChemistryCellInput {
  readonly timeS: number
  readonly massKg: ArrayLike<number>
  readonly temperatureK: number
  readonly poreVolumeM3: number
  readonly referenceReactantKg: Readonly<Record<string, number>>
}
export function createChemistryCell(model: ChemistryModel, input: ChemistryCellInput): ChemistryCellState {
  exactKeys(input, ['timeS', 'massKg', 'temperatureK', 'poreVolumeM3', 'referenceReactantKg'], 'cell input')
  bounded(input.temperatureK, model.minTemperatureK, model.maxTemperatureK, 'initial temperatureK')
  exactKeys(input.referenceReactantKg, model.reactions.map(r => r.id), 'referenceReactantKg')
  const massKg = copyInventoryKg(input.massKg)
  return ownedState(model, {
    schema: CHEMISTRY_STATE_SCHEMA, configurationKey: model.configurationKey, timeS: input.timeS,
    massKg, poreVolumeM3: input.poreVolumeM3, thermalEnergyJ: thermalAt(model, massKg, input.temperatureK),
    referenceReactantKg: Float64Array.from(model.reactions, r => input.referenceReactantKg[r.id]),
  })
}

/** Diagnostic release at fixed T, J/kg extent: -sum(nu_s u_s(T)).
 * It is NOT an additional source to add to thermalEnergyJ.
 */
export function reactionInternalEnergyReleaseJkg(
  model: ChemistryModel, reactionId: string, temperatureK: number,
): number {
  bounded(temperatureK, model.minTemperatureK, model.maxTemperatureK, 'reaction energy temperatureK')
  const reaction = model.reactions.find(r => r.id === reactionId)
  if (!reaction) fail(`unknown reaction ${reactionId}`)
  return -sum(SPECIES_IDS.map(id => {
    const c = model.caloric.species[id]
    return reaction.stoichiometry[id] * (
      c.chemicalReferenceJkg + c.phaseReferenceJkg + c.cvJkgK * (temperatureK - model.caloric.referenceTemperatureK)
    )
  }))
}


export interface ChemistryClosure {
  readonly massResidualKg: number
  readonly atomResidualMol: Formula
  readonly inertResidualKg: number
  readonly energyResidualJ: number
  readonly maxScaledResidual: number
  readonly passed: boolean
}
export interface ChemistryCellSources {
  /** All 13 species, kg; signed into each local inventory. */
  readonly speciesKgDelta: Float64Array
  /** Five gases in GAS_IDS order, mol, NOT the frozen four-array contract. */
  readonly gasMolDelta: Float64Array
  /** Source into the sensible+phase energy reservoir, J; add at most once. */
  readonly energyJ: number
  readonly externalEnergyJ: 0
  /** Diagnostic only; must NOT be added to energyJ. */
  readonly fixedTemperatureReleaseJ: number
  readonly reactionExtentKg: Float64Array
}
export interface ChemistryCellTrial {
  readonly next: ChemistryCellState
  readonly sources: ChemistryCellSources
  readonly closure: ChemistryClosure
  readonly substeps: number
  readonly rejectedCandidates: number
  readonly underflowedRateEvaluations: number
}
function closureOf(
  model: ChemistryModel, before: ChemistryCellState, after: ChemistryCellState,
  extents: Float64Array,
): ChemistryClosure {
  const controls = model.controls
  const delta = SPECIES_IDS.map((_, i) => after.massKg[i] - before.massKg[i])
  const scale = (error: number, absolute: number, magnitude: number) => {
    const tolerance = absolute + controls.relativeTolerance * magnitude
    return tolerance === 0 ? (error === 0 ? 0 : Infinity) : Math.abs(error) / tolerance
  }
  const massResidualKg = sum(delta)
  const massScale = sum(Array.from(before.massKg)) + sum(Array.from(after.massKg))
  let maxScaledResidual = scale(massResidualKg, controls.massAbsoluteToleranceKg, massScale)
  for (let i = 0; i < SPECIES_IDS.length; i++) {
    const id = SPECIES_IDS[i]
    const contributions = model.reactions.map((r, j) => r.stoichiometry[id] * extents[j])
    const expected = sum(contributions)
    const magnitude = Math.abs(before.massKg[i]) + Math.abs(after.massKg[i])
      + sum(contributions.map(Math.abs))
    maxScaledResidual = Math.max(maxScaledResidual,
      scale(delta[i] - expected, controls.massAbsoluteToleranceKg, magnitude))
  }
  const atomResidualMol = zeroFormula()
  for (const element of ELEMENTS) {
    atomResidualMol[element] = sum(SPECIES_IDS.map((id, i) => delta[i] * model.registry[id].atomsMolPerKg[element]))
    const magnitude = sum(SPECIES_IDS.map((id, i) =>
      (before.massKg[i] + after.massKg[i]) * model.registry[id].atomsMolPerKg[element]))
    maxScaledResidual = Math.max(maxScaledResidual,
      scale(atomResidualMol[element], controls.atomAbsoluteToleranceMol, magnitude))
  }
  const inertResidualKg = sum(SPECIES_IDS.map((id, i) => delta[i] * model.registry[id].inertKgPerKg))
  maxScaledResidual = Math.max(maxScaledResidual,
    scale(inertResidualKg, controls.massAbsoluteToleranceKg, massScale))
  const chemicalDelta = SPECIES_IDS.map((id, i) => delta[i] * model.caloric.species[id].chemicalReferenceJkg)
  const energyResidualJ = sum([after.thermalEnergyJ - before.thermalEnergyJ, ...chemicalDelta])
  const energyScale = Math.abs(before.thermalEnergyJ) + Math.abs(after.thermalEnergyJ)
    + sum(SPECIES_IDS.map((id, i) => (before.massKg[i] + after.massKg[i])
      * Math.abs(model.caloric.species[id].chemicalReferenceJkg)))
  maxScaledResidual = Math.max(maxScaledResidual,
    scale(energyResidualJ, controls.energyAbsoluteToleranceJ, energyScale))
  return Object.freeze({
    massResidualKg, atomResidualMol: Object.freeze(atomResidualMol), inertResidualKg,
    energyResidualJ, maxScaledResidual,
    passed: Number.isFinite(maxScaledResidual) && maxScaledResidual <= 1,
  })
}
function makeTrial(
  model: ChemistryModel, before: ChemistryCellState, after: ChemistryCellState,
  extents: Float64Array, diagnosticJ: number, substeps: number,
  rejectedCandidates: number, underflowedRateEvaluations: number,
): ChemistryCellTrial {
  const next = ownedState(model, after)
  const closure = closureOf(model, before, next, extents)
  if (!closure.passed) reject('chemistry closure gate failed; no state committed')
  const speciesKgDelta = Float64Array.from(next.massKg, (m, i) => m - before.massKg[i])
  const gasMolDelta = Float64Array.from(GAS_IDS, id =>
    speciesKgDelta[speciesIndex(id)] / model.registry[id].molarMassKgMol!)
  return Object.freeze({
    next, closure, substeps, rejectedCandidates, underflowedRateEvaluations,
    sources: Object.freeze({
      speciesKgDelta, gasMolDelta, energyJ: next.thermalEnergyJ - before.thermalEnergyJ,
      externalEnergyJ: 0 as const, fixedTemperatureReleaseJ: diagnosticJ,
      reactionExtentKg: extents.slice(),
    }),
  })
}

/** Apply all extents simultaneously; products cannot finance same-substep consumption. */
function extentCandidate(
  model: ChemistryModel, before: ChemistryCellState, extents: Float64Array,
  owner: CompiledReaction['owner'],
): ChemistryCellState {
  const delta = new Float64Array(SPECIES_IDS.length)
  let hasExtent = false
  for (let j = 0; j < model.reactions.length; j++) {
    bounded(extents[j], 0, 1e16, `extent ${j}`)
    if (extents[j] !== 0) {
      hasExtent = true
      if (model.reactions[j].owner !== owner) fail('reaction operator ownership violation')
    }
  }
  for (let i = 0; i < SPECIES_IDS.length; i++) {
    const id = SPECIES_IDS[i]
    const contributions = model.reactions.map((r, j) => r.stoichiometry[id] * extents[j])
    const consumption = sum(contributions.map(v => v < 0 ? -v : 0))
    const limit = model.controls.maxConsumedFraction * before.massKg[i]
    if (consumption > limit * (1 + 32 * Number.EPSILON)) reject(`gross reactant bound: ${id}`)
    delta[i] = sum(contributions)
  }
  const massKg = Float64Array.from(before.massKg, (m, i) => m + delta[i])
  if (hasExtent && massKg.every((m, i) => m === before.massKg[i])) {
    reject('reaction extent is below state resolution; no invisible progress accepted')
  }
  const chemicalToThermalJ = -sum(SPECIES_IDS.map((id, i) =>
    delta[i] * model.caloric.species[id].chemicalReferenceJkg))
  let after: ChemistryCellState
  try {
    after = ownedState(model, {
      ...before, massKg, thermalEnergyJ: before.thermalEnergyJ + chemicalToThermalJ,
    })
  } catch (error) {
    if (error instanceof ChemistryInputError) reject(`candidate outside admissible state: ${error.message}`)
    throw error
  }
  const oldT = recover(model, before).temperatureK, newT = recover(model, after).temperatureK
  if (Math.abs(newT - oldT) > model.controls.maxTemperatureChangeK) reject('temperature-change bound')
  if (!closureOf(model, before, after, extents).passed) reject('substep conservation/stoichiometry gate')
  return after
}

/**
 * Advance the ENTIRE requested physical duration or throw without returning partial state.
 * First-order forward Euler with simultaneous extents, gross-loss limits and backtracking.
 * Positivity is not an error estimator: callers must run timestep-refinement studies.
 * Every rate, oxygen partial pressure and temperature is recomputed per accepted substep.
 * Water-owned drying is never applied here, even if its fixture kinetics are nonzero.
 */
export function advanceChemistryCell(
  model: ChemistryModel, input: ChemistryCellState, dtS: number,
): ChemistryCellTrial {
  const before = ownedState(model, input), controls = model.controls
  bounded(dtS, 0, 1e6, 'dtS')
  const targetTimeS = before.timeS + dtS
  bounded(targetTimeS, 0, 1e12, 'target timeS')
  if (dtS > 0 && (targetTimeS <= before.timeS || Math.abs((targetTimeS - before.timeS) / dtS - 1) > 1e-8)) {
    reject('requested time increment is not adequately representable at this clock origin')
  }
  let current = before, elapsed = 0, substeps = 0, rejectedCandidates = 0, underflows = 0
  let diagnosticJ = 0
  const cumulativeExtents = new Float64Array(model.reactions.length)
  while (elapsed < dtS) {
    if (substeps >= controls.maxSubsteps) reject('substep budget exhausted; retry whole trial with a smaller dt')
    const thermo = recover(model, current)
    const rates = new Float64Array(model.reactions.length)
    for (let j = 0; j < model.reactions.length; j++) {
      const reaction = model.reactions[j]
      if (reaction.owner !== 'chemistry') continue
      const blocked = SPECIES_IDS.some(id =>
        reaction.stoichiometry[id] < 0 && current.massKg[speciesIndex(id)] === 0)
      if (blocked) continue
      const evaluation = evaluateRate(reaction, {
        temperatureK: thermo.temperatureK, totalPressurePa: thermo.totalPressurePa,
        oxygenPartialPressurePa: thermo.oxygenPartialPressurePa,
        reactantKg: current.massKg[speciesIndex(reaction.driver)],
        referenceReactantKg: current.referenceReactantKg[j],
      })
      rates[j] = evaluation.extentKgPerS
      if (evaluation.underflowed) underflows++
    }
    if (rates.every(rate => rate === 0)) { elapsed = dtS; break }
    const remaining = dtS - elapsed
    let h = Math.min(remaining, controls.maxSubstepS)
    for (let i = 0; i < SPECIES_IDS.length; i++) {
      const id = SPECIES_IDS[i]
      const grossLossPerS = sum(model.reactions.map((r, j) => Math.max(0, -r.stoichiometry[id]) * rates[j]))
      if (grossLossPerS > 0) {
        // 10% numerical margin below the caller's bound, not altered kinetics.
        h = Math.min(h, 0.9 * controls.maxConsumedFraction * current.massKg[i] / grossLossPerS)
      }
    }
    let accepted: ChemistryCellState | undefined, acceptedExtents: Float64Array | undefined
    for (let attempt = 0; attempt <= controls.maxBacktracks; attempt++) {
      if (!(h > 0) || elapsed + h === elapsed || (h < controls.minSubstepS && h !== remaining)) {
        reject('required substep is below minimum/resolution; no timestep floor or lost reaction')
      }
      const extents = Float64Array.from(rates, rate => rate * h)
      if (extents.every(value => value === 0)) reject('all positive rates underflowed when multiplied by dt')
      try {
        accepted = extentCandidate(model, current, extents, 'chemistry')
        acceptedExtents = extents
        break
      } catch (error) {
        if (!(error instanceof ChemistryStepRejected)) throw error
        rejectedCandidates++
        if (attempt === controls.maxBacktracks) reject(`backtracking exhausted: ${error.message}`)
        h /= 2
      }
    }
    if (!accepted || !acceptedExtents) reject('no accepted chemistry candidate')
    diagnosticJ += sum(model.reactions.map((r, j) => acceptedExtents![j] === 0 ? 0 :
      acceptedExtents![j] * reactionInternalEnergyReleaseJkg(model, r.id, thermo.temperatureK)))
    for (let j = 0; j < cumulativeExtents.length; j++) cumulativeExtents[j] += acceptedExtents[j]
    current = accepted
    elapsed = h === remaining ? dtS : elapsed + h
    substeps++
  }
  return makeTrial(model, before, { ...current, timeS: targetTimeS }, cumulativeExtents,
    diagnosticJ, substeps, rejectedCandidates, underflows)
}

export interface DryingExtentTrial extends ChemistryCellTrial {
  readonly requestedExtentKg: number
  readonly appliedExtentKg: number
  readonly unappliedExtentKg: number
  readonly limited: boolean
}
/**
 * Algebraic water-owned liquid->vapor extent primitive; NOT a drying rate/transport model.
 * It does not advance time, infer evaporation from Arrhenius kinetics, or impose saturation.
 * Requests are bounded by inventory, available sensible energy and pressure; remainder is explicit.
 */
export function trialDryingExtent(
  model: ChemistryModel, input: ChemistryCellState, requestedExtentKg: number,
): DryingExtentTrial {
  bounded(requestedExtentKg, 0, 1e12, 'requested drying extent')
  const before = ownedState(model, input), thermo = recover(model, before)
  const j = model.reactions.findIndex(r => r.owner === 'water')
  if (j < 0) fail('no water-owned drying primitive in this model')
  const c = model.caloric
  const lowT = Math.max(model.minTemperatureK, thermo.temperatureK - model.controls.maxTemperatureChangeK)
  const latentAtLowT = c.species.H2O.phaseReferenceJkg - c.species.liquidWater.phaseReferenceJkg
    + (c.species.H2O.cvJkgK - c.species.liquidWater.cvJkgK) * (lowT - c.referenceTemperatureK)
  const availableJ = thermo.capacityJK * (thermo.temperatureK - lowT)
  let extent = Math.min(requestedExtentKg,
    model.controls.maxConsumedFraction * before.massKg[speciesIndex('liquidWater')],
    availableJ / latentAtLowT)
  const extents = new Float64Array(model.reactions.length)
  let after = before, rejections = 0
  if (extent > 0) {
    for (let attempt = 0; attempt <= model.controls.maxBacktracks; attempt++) {
      extents[j] = extent
      try { after = extentCandidate(model, before, extents, 'water'); break }
      catch (error) {
        if (!(error instanceof ChemistryStepRejected)) throw error
        rejections++
        if (attempt === model.controls.maxBacktracks) reject(`drying backtracking exhausted: ${error.message}`)
        extent /= 2
        if (extent === 0) reject('drying extent underflow')
      }
    }
  }
  const diagnosticJ = extent * reactionInternalEnergyReleaseJkg(model, model.reactions[j].id, thermo.temperatureK)
  const trial = makeTrial(model, before, after, extents, diagnosticJ, extent > 0 ? 1 : 0, rejections, 0)
  return Object.freeze({
    ...trial, requestedExtentKg, appliedExtentKg: extent,
    unappliedExtentKg: requestedExtentKg - extent, limited: extent < requestedExtentKg,
  })
}

/** Lossless JSON numeric round-trip; redundant pressure/temperature caches are not persisted. */
export function checkpointChemistryCell(model: ChemistryModel, input: ChemistryCellState): string {
  const state = ownedState(model, input)
  return JSON.stringify({
    schema: state.schema, configurationKey: state.configurationKey,
    speciesOrder: [...SPECIES_IDS], reactionOrder: model.reactions.map(r => r.id),
    timeS: state.timeS, massKg: Array.from(state.massKg), thermalEnergyJ: state.thermalEnergyJ,
    poreVolumeM3: state.poreVolumeM3, referenceReactantKg: Array.from(state.referenceReactantKg),
  })
}
export function restoreChemistryCell(model: ChemistryModel, serialized: string): ChemistryCellState {
  text(serialized, 'checkpoint')
  let decoded: unknown
  try { decoded = JSON.parse(serialized) } catch { fail('checkpoint JSON is invalid') }
  exactKeys(decoded, [
    'schema', 'configurationKey', 'speciesOrder', 'reactionOrder', 'timeS',
    'massKg', 'thermalEnergyJ', 'poreVolumeM3', 'referenceReactantKg',
  ], 'checkpoint')
  const value = decoded as {
    schema: typeof CHEMISTRY_STATE_SCHEMA; configurationKey: string; speciesOrder: unknown;
    reactionOrder: unknown; timeS: number; massKg: number[]; thermalEnergyJ: number;
    poreVolumeM3: number; referenceReactantKg: number[];
  }
  if (canonical(value.speciesOrder) !== canonical([...SPECIES_IDS])
    || canonical(value.reactionOrder) !== canonical(model.reactions.map(r => r.id))) {
    fail('checkpoint species/reaction order mismatch')
  }
  if (!Array.isArray(value.massKg) || !Array.isArray(value.referenceReactantKg)) fail('checkpoint inventories must be arrays')
  if (value.referenceReactantKg.length !== model.reactions.length) fail('checkpoint reference capacity count mismatch')
  for (const capacity of value.referenceReactantKg) positive(capacity, 1e12, 'checkpoint reference capacity')
  return ownedState(model, {
    schema: value.schema, configurationKey: value.configurationKey, timeS: value.timeS,
    massKg: copyInventoryKg(value.massKg), thermalEnergyJ: value.thermalEnergyJ,
    poreVolumeM3: value.poreVolumeM3, referenceReactantKg: Float64Array.from(value.referenceReactantKg),
  })
}


/** Total specific INTERNAL energy, J/kg, on this model's common reference. */
export function speciesInternalEnergyJkg(model: ChemistryModel, id: SpeciesId, temperatureK: number): number {
  speciesIndex(id)
  bounded(temperatureK, model.caloric.minTemperatureK, model.caloric.maxTemperatureK, 'species temperature')
  const c = model.caloric.species[id]
  return c.chemicalReferenceJkg + c.phaseReferenceJkg
    + c.cvJkgK * (temperatureK - model.caloric.referenceTemperatureK)
}
/** Total specific enthalpy, J/kg. Liquid pressure may be tensile (negative). */
export function speciesEnthalpyJkg(
  model: ChemistryModel, id: SpeciesId, temperatureK: number, pressurePa: number,
): number {
  bounded(pressurePa, -1e10, 3e5, 'enthalpy pressure')
  const u = speciesInternalEnergyJkg(model, id, temperatureK)
  if ((GAS_IDS as readonly string[]).includes(id)) return u + R * temperatureK / model.registry[id].molarMassKgMol!
  if (id === 'liquidWater') return u + pressurePa / model.caloric.liquidDensityKgM3
  fail('enthalpy transport supports gas or liquid water only')
}
/**
 * Transport-owned exchange primitive. totalEnergyIntoJ is TOTAL internal-energy
 * transfer including chemical reference carried by matter, NOT thermal-only heat.
 * This is NOT a chemistry reaction, not a boundary law and not a time advance.
 * The caller owns paired-face/global conservation and gross outgoing-mass bounds.
 * Optional pore delta is ONLY for locally reserved external condensed-source volume,
 * not skeleton deformation or pressure work. Dry-ice integration must reserve it once.
 */
export function exchangeCellInventory(
  model: ChemistryModel, input: ChemistryCellState,
  speciesKgDelta: ArrayLike<number>, totalEnergyIntoJ: number,
  availablePoreVolumeDeltaM3 = 0,
): ChemistryCellState {
  const before = ownedState(model, input)
  if (speciesKgDelta.length !== SPECIES_IDS.length) fail('exchange species count')
  for (let i = 0; i < SPECIES_IDS.length; i++) bounded(speciesKgDelta[i], -1e12, 1e12, 'exchange delta')
  bounded(totalEnergyIntoJ, -1e25, 1e25, 'exchange energy')
  bounded(availablePoreVolumeDeltaM3, -1e12, 1e12, 'available pore volume delta')
  const deltaChemical = sum(SPECIES_IDS.map((id, i) =>
    speciesKgDelta[i] * model.caloric.species[id].chemicalReferenceJkg))
  let next: ChemistryCellState
  try {
    next = ownedState(model, {
      ...before, massKg: Float64Array.from(before.massKg, (m, i) => m + speciesKgDelta[i]),
      poreVolumeM3: before.poreVolumeM3 + availablePoreVolumeDeltaM3,
      thermalEnergyJ: before.thermalEnergyJ + totalEnergyIntoJ - deltaChemical,
    })
  } catch (error) {
    if (error instanceof ChemistryInputError) reject(`inadmissible exchange: ${error.message}`)
    throw error
  }
  const actualChemical = sum(SPECIES_IDS.map((id, i) =>
    (next.massKg[i] - before.massKg[i]) * model.caloric.species[id].chemicalReferenceJkg))
  const residual = sum([next.thermalEnergyJ - before.thermalEnergyJ, actualChemical, -totalEnergyIntoJ])
  const tolerance = model.controls.energyAbsoluteToleranceJ + model.controls.relativeTolerance
    * (Math.abs(before.thermalEnergyJ) + Math.abs(next.thermalEnergyJ)
      + Math.abs(actualChemical) + Math.abs(totalEnergyIntoJ))
  if (Math.abs(residual) > tolerance) reject('exchange energy closure')
  return next
}
