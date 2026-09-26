import type { Scenario } from './types'

export type MaterialGroup = 'Peat' | 'Water and dry ice' | 'Gas transport' | 'Vertical mechanics' | '3D mechanics' | 'Short event'
export interface MaterialDefinition {
  name: string; units: string; group: MaterialGroup; defaultValue: number
  range: readonly [number, number]; evidence: string; sourceIds: readonly string[]
}
const field = (name: string, units: string, group: MaterialGroup, defaultValue: number,
  range: readonly [number, number], evidence: string, sourceIds: readonly string[] = []): MaterialDefinition =>
  ({ name, units, group, defaultValue, range, evidence, sourceIds })
const assumed = 'Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.'

/** Numeric guards define the supported calculation, not universal material limits. */
export const MATERIAL_DEFINITIONS = {
  peatOrganicParticleDensityKgM3: field('Peat organic particle density', 'kg/m³', 'Peat', 1500, [1000, 2000], '1500 is a literature model input (Huang and Rein, Table 2), not a bulk density or a new measurement.', ['HR17']),
  mineralParticleDensityKgM3: field('Mineral particle density', 'kg/m³', 'Peat', 2650, [2000, 3500], 'Assumed quartz-like mineral end member. Site mineralogy is unmeasured.'),
  peatHeatCapacityJKgK: field('Peat dry solid heat capacity', 'J/(kg·K)', 'Peat', 1840, [100, 5000], '1840 is the peat input in Huang and Rein Table 2. Constant approximation; char/ash heat capacities are not represented.', ['HR17']),
  peatDryConductivityWmK: field('Peat dry bulk conductivity', 'W/(m·K)', 'Peat', 0.16, [0.01, 3], 'Assumed intercept in k = intercept + slope × initial pore saturation. No fitted relationship for this specimen. O’Donnell uses volumetric water content, a different basis.', ['OD09']),
  peatSaturationConductivityWmK: field('Peat saturation conductivity slope', 'W/(m·K)', 'Peat', 0.6, [0, 3], 'Assumed slope versus pore saturation. Fixed after initialization; excludes pore radiation and evolving conductivity.', ['OD09']),
  peatHorizontalPermeabilityFactor: field('Peat horizontal permeability factor', '× base', 'Peat', 4, [0.01, 1000], assumed),
  peatVerticalPermeabilityFactor: field('Peat vertical permeability factor', '× base', 'Peat', 2, [0.01, 1000], assumed),
  waterDensityKgM3: field('Liquid water density', 'kg/m³', 'Water and dry ice', 1000, [950, 1000], '1000 is the rounded water input in Huang and Rein Table 2. Fixed liquid value; freezing and density variation are excluded.', ['HR17']),
  waterHeatCapacityJKgK: field('Liquid water heat capacity', 'J/(kg·K)', 'Water and dry ice', 4186, [3500, 5000], '4186 is the constant water input in Huang and Rein Table 2; not a full temperature-dependent equation of state.', ['HR17']),
  waterEvaporationJkg: field('Water evaporation latent heat', 'J/kg', 'Water and dry ice', 2260000, [2e6, 2.6e6], '2.26 MJ/kg is the drying enthalpy in Huang and Rein Table 1; approximate near boiling, not all temperatures.', ['HR17']),
  co2SolidHeatCapacityJKgK: field('Solid CO₂ heat capacity', 'J/(kg·K)', 'Water and dry ice', 850, [300, 1200], '850 is retained as a constant assumption. Giauque and Egan measured temperature dependence; this single value is not a fit.', ['GE37']),
  co2SublimationK: field('CO₂ sublimation temperature', 'K', 'Water and dry ice', 194.67, [194, 195], '194.67 K measured by Giauque and Egan near atmospheric pressure. A fixed point; changing it does not implement pressure-dependent phase equilibrium.', ['GE37']),
  co2SublimationJkg: field('CO₂ sublimation latent heat', 'J/kg', 'Water and dry ice', 6030 * 4.184 / 0.0440095, [5e5, 6.5e5], '6030 cal/mol at 194.67 K converted using 4.184 J/cal and 0.0440095 kg/mol. Rounded for display only.', ['GE37']),
  gasHeatCapacityJMolK: field('Effective gas heat storage', 'J/(mol·K)', 'Gas transport', 29, [15, 60], '29 is an effective model coefficient, not a species-resolved Cp or Cv. No full compressible energy equation is solved.'),
  co2GasHeatCapacityJMolK: field('Source CO₂ sensible heat coefficient', 'J/(mol·K)', 'Gas transport', 28.5, [15, 60], '28.5 is the legacy effective source-gas coefficient. No verified temperature-dependent Cp fit is used; do not interpret it as universal Cp.'),
  gasViscosityPaS: field('Gas dynamic viscosity', 'Pa·s', 'Gas transport', 1.8e-5, [5e-6, 1e-4], 'Fixed air-like approximation. Changes with composition and temperature in reality; no mixture law is fitted.'),
  verticalYoungsPa: field('Vertical Young modulus', 'Pa', 'Vertical mechanics', 1e6, [1e4, 1e8], assumed, ['MA07']),
  verticalShearPa: field('Lateral link shear modulus', 'Pa', 'Vertical mechanics', 350000, [1e3, 1e8], 'Independent spring-network coupling, not an isotropic E–ν–G relation. Requires calibration.', ['MA07']),
  verticalBiot: field('Vertical pressure coupling', '1', 'Vertical mechanics', 0.8, [0, 1], 'Assumed effective-stress coefficient; Biot theory motivates the form, not this numerical value.', ['B41']),
  verticalTensilePa: field('Vertical tensile strength', 'Pa', 'Vertical mechanics', 20000, [1, 1e6], assumed, ['MA07']),
  verticalDampingRatio: field('Vertical damping ratio', '1', 'Vertical mechanics', 0.12, [0, 1], assumed),
  verticalYieldedFraction: field('Stiffness fraction after yield', '1', 'Vertical mechanics', 0.25, [0.01, 1], assumed),
  femYoungsPa: field('FEM Young modulus', 'Pa', '3D mechanics', 1e6, [1e4, 1e8], assumed, ['MA07']),
  femPoisson: field('FEM Poisson ratio', '1', '3D mechanics', 0.3, [0, 0.48], 'Isotropic small-strain assumption. Near-incompressible states need a different element formulation.', ['MA07']),
  femCohesionPa: field('Drucker–Prager cohesion intercept', 'Pa', '3D mechanics', 8000, [1, 1e6], 'Intercept in q − friction slope × p − cohesion. Not directly a Mohr–Coulomb cohesion measurement.', ['MA07']),
  femFrictionSlope: field('Drucker–Prager friction slope', '1', '3D mechanics', 0.35, [0, 2], 'Coefficient multiplying pressure, not a friction angle in degrees. No triaxial calibration.', ['MA07']),
  femDilationSlope: field('Plastic dilation slope', '1', '3D mechanics', 0.05, [0, 2], assumed),
  femHardeningPa: field('Plastic hardening modulus', 'Pa', '3D mechanics', 20000, [0, 1e8], assumed),
  fastCohesionPa: field('Shell index cohesion', 'Pa', 'Short event', 20000, [1, 1e6], 'Assumed denominator for the illustrative shell yield index; separate from calculated soil displacement.'),
  fastBiot: field('Shell pressure coupling', '1', 'Short event', 0.8, [0, 1], assumed, ['B41']),
  fastDamageRateS: field('Illustrative damage rate', '1/s', 'Short event', 3, [0, 10], 'Illustrative feedback on radial permeability. Does not predict fracture.'),
  fastDamagePermeabilityFactor: field('Maximum damage permeability factor', '×', 'Short event', 10, [1, 100], 'Hypothetical radial transport feedback; not measured damage.'),
  fastMaxPressurePa: field('Short-event pressure stop', 'Pa absolute', 'Short event', 5e6, [150000, 5e6], 'Numerical validity ceiling, not a soil failure or safety pressure. May be lowered, never widened beyond model support.'),
  fastMaxSpeedMS: field('Short-event gas-speed stop', 'm/s', 'Short event', 50, [0.01, 50], 'Numerical validity ceiling; not a validated compressible-flow regime.'),
} as const satisfies Record<string, MaterialDefinition>
export type MaterialKey = keyof typeof MATERIAL_DEFINITIONS
export type MaterialProperties = Record<MaterialKey, number>
export const MATERIAL_KEYS = Object.keys(MATERIAL_DEFINITIONS) as MaterialKey[]
export const DEFAULT_MATERIALS = Object.fromEntries(MATERIAL_KEYS.map(key => [key, MATERIAL_DEFINITIONS[key].defaultValue])) as MaterialProperties
/** Absent extension preserves the coefficients used by pre-0.4 scenarios/checkpoints. */
export function resolveMaterials(scenario?: Pick<Scenario, 'materialProperties' | 'soil'>): MaterialProperties {
  const legacy = { ...DEFAULT_MATERIALS, peatOrganicParticleDensityKgM3: 1400,
    peatHeatCapacityJKgK: scenario?.soil.solidHeatCapacityJKgK ?? 850, waterHeatCapacityJKgK: 4180,
    co2SublimationK: 194.65, co2SublimationJkg: 571000 }
  return scenario?.materialProperties ? { ...DEFAULT_MATERIALS, ...scenario.materialProperties } : legacy
}
export function validateMaterials(raw: unknown): string[] {
  if (raw === undefined) return []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['materialProperties must be an object.']
  const errors: string[] = []
  for (const [key, value] of Object.entries(raw)) {
    const def = Object.hasOwn(MATERIAL_DEFINITIONS, key) ? MATERIAL_DEFINITIONS[key as MaterialKey] : undefined
    if (!def) errors.push(`Unknown material property: ${key}.`)
    else if (typeof value !== 'number' || !Number.isFinite(value) || value < def.range[0] || value > def.range[1])
      errors.push(`${def.name} must be within [${def.range.join(', ')}] ${def.units}.`)
  }
  return errors
}
/** Mass fractions require additive specific volumes, not arithmetic density averaging. */
export function peatPorosity(dryDensity: number, organicFraction: number, materials: MaterialProperties, legacy = false): number {
  const particleDensity = legacy
    ? organicFraction * materials.peatOrganicParticleDensityKgM3 + (1 - organicFraction) * materials.mineralParticleDensityKgM3
    : 1 / (organicFraction / materials.peatOrganicParticleDensityKgM3 + (1 - organicFraction) / materials.mineralParticleDensityKgM3)
  const phi = 1 - dryDensity / particleDensity
  return legacy ? Math.min(0.9, Math.max(0.1, phi)) : phi
}
export function dryBasisMoisture(saturation: number, porosity: number, dryDensity: number, waterDensity: number): number {
  return saturation * porosity * waterDensity / dryDensity
}
export function saturationFromDryBasis(moisture: number, porosity: number, dryDensity: number, waterDensity: number): number {
  return moisture * dryDensity / (porosity * waterDensity)
}
export function continuumMaterial(scenario: Scenario) {
  const m = resolveMaterials(scenario)
  return { youngsPa: m.femYoungsPa, poisson: m.femPoisson, cohesionPa: m.femCohesionPa,
    frictionSlope: m.femFrictionSlope, dilationSlope: m.femDilationSlope, hardeningPa: m.femHardeningPa }
}
