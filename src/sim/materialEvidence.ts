import { PARAMETER_REGISTRY } from './parameters'
import { MATERIAL_DEFINITIONS, MATERIAL_KEYS, resolveMaterials } from './materials'
import type { Scenario } from './types'

export const MATERIAL_SOURCES = [
  { id: 'D25', citation: 'Decharme, B. (2025). “A process-based modeling of soil organic matter physical properties for land surface models – Part 1: Soil mixture theory.” Geoscientific Model Development, 18, 9349–9384.', doi: '10.5194/gmd-18-9349-2025',
    finding: 'Table 4 supplies ten lowland peat–sand compositions, with observed dry density and estimated organic matter, dry conductivity and volumetric heat capacity. The profile menu preserves that observed/estimated distinction.',
    why: 'Provides an auditable mixture dataset and distinguishes organic carbon from organic matter. Its dry-property estimates are not wet or burning-peat calibration.' },
  { id: 'AT23', citation: 'Arkhangelskaya, T. A., and Telyatnikova, E. V. (2023). “Thermal diffusivity of peat-sand mixtures with different peat and sand contents.” Eurasian Soil Science, 56(4), 428–433.', doi: '10.1134/S1064229322602463',
    finding: 'Original laboratory peat–sand mixture dataset used in Decharme Table 4. Values here were retrieved through that published reanalysis, not independently re-extracted from the original article.',
    why: 'Identifies the original measurements behind the mixture menus and makes the data lineage explicit. Bibliographic metadata was checked against the publisher’s Crossref record.' },
  { id: 'P17', citation: 'Pastor, E., Oliveras, I., Urquiaga-Flores, E., Quintano-Loayza, J. A., Manta, M. I., and Planas, E. (2017). “A new method for performing smouldering combustion field experiments in peatlands and rich-organic soils.” International Journal of Wildland Fire, 26, 1040–1052.', doi: '10.1071/WF17033',
    finding: 'Peruvian field soils: dry density 188–355 kg/m³, inorganic content 6.0–10.6%, mean dry-basis moisture 114.5%, and mineral texture 66% sand, 22% silt, 12% clay.',
    why: 'Adds an organic field-soil composition. The menu uses explicitly labeled range midpoints, not a fictitious paired sample. The wet-density entry is excluded from dry-mass calculations.' },
  { id: 'HR17', citation: 'Huang, X., and Rein, G. (2017). “Downward spread of smouldering peat fire: the role of moisture, density and oxygen supply.” International Journal of Wildland Fire, 26(11), 907–918.', doi: '10.1071/WF16198',
    finding: 'Tables 1–2: peat solid density 1500 kg/m³ and specific heat 1840 J/(kg·K); water density 1000 kg/m³, specific heat 4186 J/(kg·K), and drying enthalpy 2.26 MJ/kg. These are adopted model inputs. The tested oven-dry moss peat bulk density was 135 ± 5 kg/m³.',
    why: 'Separates particle density from bulk density and gives explicit heat-storage coefficients. The five-step chemistry and solid conductivity cannot be substituted directly into this one-step, bulk-cell model.' },
  { id: 'GE37', citation: 'Giauque, W. F., and Egan, C. J. (1937). “Carbon dioxide. The heat capacity and vapor pressure of the solid. The heat of sublimation. Thermodynamic and spectroscopic values of the entropy.” The Journal of Chemical Physics, 5(1), 45–54.', doi: '10.1063/1.1749929',
    finding: 'Measured sublimation point 194.67 K and latent heat 6030 cal/mol. Conversion: 6030 × 4.184 / 0.0440095 = 573274.4067 J/kg.',
    why: 'Anchors the finite dry-ice energy budget near atmospheric pressure. Does not validate a constant heat capacity, buried pressure behavior or soil-contact conductance.' },
  { id: 'OD09', citation: 'O’Donnell, J. A., Romanovsky, V. E., Harden, J. W., and McGuire, A. D. (2009). “The effect of moisture content on the thermal conductivity of moss and organic soil horizons from black spruce ecosystems in interior Alaska.” Soil Science, 174(12), 646–651.', doi: '10.1097/SS.0b013e3181c4a7f8',
    finding: 'Thawed organic-horizon conductivity depends strongly on volumetric water content, with horizon-dependent relationships.',
    why: 'Shows why this app’s assumed saturation-based conductivity is not a verified universal law. Full regression coefficients were not reliably retrieved; none are invented or applied.' },
  { id: 'MA07', citation: 'Mesri, G., and Ajlouni, M. (2007). “Engineering properties of fibrous peats.” Journal of Geotechnical and Geoenvironmental Engineering, 133(7), 850–866.', doi: '10.1061/(ASCE)1090-0241(2007)133:7(850)',
    finding: 'Fibrous peat stiffness and strength depend on specimen, stress path and test interpretation. The review reports triaxial friction angles of 40–60° and undrained modulus/strength ratios of 20–80.',
    why: 'Prevents assigning mineral-soil constants to peat without calibration. Friction angles are not Drucker–Prager slopes. No numerical mechanics default is confirmed by this review.' },
  { id: 'B41', citation: 'Biot, M. A. (1941). “General theory of three-dimensional consolidation.” Journal of Applied Physics, 12(2), 155–164.', doi: '10.1063/1.1712886',
    finding: 'Provides the theoretical basis for coupled stress and pore-pressure response.',
    why: 'Supports the form of an effective-stress coupling, not the assumed coefficient 0.8 or validation of the present dry-gas spring model.' },
  { id: 'Q22', citation: 'Qin, Y., Chen, Y., Lin, S., and Huang, X. (2022). “Limiting oxygen concentration and supply rate of smoldering propagation.” Combustion and Flame, 245, 112380.', doi: '10.1016/j.combustflame.2022.112380',
    finding: 'Tests span 2–21% oxygen and internal flow up to 14.7 mm/s. At oxygen above 10%, the minimum supply approaches 0.08 ± 0.01 g/(m²·s). The concentration limit depends on flow.',
    why: 'From the working document. Supports tracking oxygen transport and supply; does not justify a universal 2% extinction switch or the app’s half-saturation coefficient.' },
  { id: 'LH21', citation: 'Lin, S., and Huang, X. (2021). “Quenching of smoldering: Effect of wall cooling on extinction.” Proceedings of the Combustion Institute, 38(3), 5015–5022.', doi: '10.1016/j.proci.2020.05.017',
    finding: 'Near quenching, minimum smoldering temperature was about 250 °C in the tested dry-organic-soil reactors; quenching diameter was about 10 cm.',
    why: 'From the working document. Demonstrates dependence on heat loss and oxygen. A measured front temperature is not a universal local Arrhenius reaction cutoff.' },
  { id: 'HR15', citation: 'Huang, X., and Rein, G. (2015). “Computational study of critical moisture and depth of burn in peat fires.” International Journal of Wildland Fire, 24(6), 798–808.', doi: '10.1071/WF14178',
    finding: 'For particular low-inorganic-content modeled beds, extinction moisture reached 2.56 kg water/kg dry peat versus an ignition threshold of 1.17 kg/kg.',
    why: 'From the working document. Requires a dry-mass moisture conversion and separate ignition/extinction interpretation. These numbers are not pore saturations or universal constraints.' },
  { id: 'S21', citation: 'Santoso, M. A., Cui, W., Amin, H. M. F., Christensen, E. G., Nugroho, Y. S., and Rein, G. (2021). “Laboratory study on the suppression of smouldering peat wildfires: effects of flow rate and wetting agent.” International Journal of Wildland Fire, 30(5), 378–390.', doi: '10.1071/WF20117',
    finding: 'Laboratory suppression evaluated treatment through cooling and extinction; a 50 °C observation criterion was used.',
    why: 'From the working document. Supports checking multiple locations and later recovery. A single cold cell or visual smoke reduction is insufficient.' },
  { id: 'S22', citation: 'Santoso, M. A., Christensen, E. G., Amin, H. M. F., Palamba, P., Hu, Y., Purnomo, D. M. J., Cui, W., Pamitran, A. S., Richter, F., Smith, T. E. L., Nugroho, Y. S., and Rein, G. (2022). “GAMBUT field experiment of peatland wildfires in Sumatra: from ignition to spread and suppression.” International Journal of Wildland Fire, 31, 949–966.', doi: '10.1071/WF21135',
    finding: 'Field suppression used in-depth temperature surveys. Local remaining hot spots required follow-up despite initial readings below 50 °C.',
    why: 'From the working document. Establishes the need for spatial coverage and reassessment; it does not calibrate this app’s buried source.' },
  { id: 'Z26', citation: 'Zhang, Y., Chen, Y., Qin, Y., Li, Y., Zhou, Y., Zhang, Z., Jiang, Y., Lin, S., and Huang, X. (2026). “Suppressing underground peat fire and smoldering spread via water, ice, dry ice, and liquid nitrogen.” Fire Safety Journal, 162, 104772.', doi: '10.1016/j.firesaf.2026.104772',
    finding: 'Direct peat-fire experiments compare cooling treatments and persistence. The working document reports 41 kg/m² dry ice and up to 175 minutes cooling for its air-dried test condition; these specific figures remain pending full-table verification here.',
    why: 'From the working document and earlier review. Relevant suppression benchmark, but surface treatment geometry and subzero phase behavior differ from this model. No loading or success threshold is installed.' },
  { id: 'M22', citation: 'Mulyasih, H., Akbar, L. A., Ramadhan, M. L., Cesnanda, A. F., Putra, R. A., Irwansyah, R., and Nugroho, Y. S. (2022). “Experimental study on peat fire suppression through water injection in laboratory scale.” Alexandria Engineering Journal, 61(12), 12525–12537.', doi: '10.1016/j.aej.2022.06.036',
    finding: 'Laboratory water injection is compared with surface delivery.',
    why: 'From the working document. Relevant to delivery/contact and future benchmarking, but the current solver has no liquid-water injection network; its parameters are not copied into dry-ice transport.' },
  { id: 'DB25', citation: 'Densmore, V. S., and Barnesby, T. K. (2025). “For peat’s sake! Peat type influences critical moisture thresholds that prevent combustion of organic soils in Western Australia.” International Journal of Wildland Fire, 34, WF24204.', doi: '10.1071/WF24204',
    finding: 'Critical moisture varies by peat type, including differences in density and carbon content.',
    why: 'From the working document. Supports specimen-specific constraints and explicit uncalibrated labels, rather than a single peat moisture limit.' },
] as const

export interface EditableProperty { path: string; name: string; units: string; group: string; value: number; range: readonly [number, number]; evidence: string; sourceIds: readonly string[] }
export function readSetting(object: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((at, key) => at && typeof at === 'object' && Object.hasOwn(at, key) ? (at as Record<string, unknown>)[key] : undefined, object)
}
export function writeSetting(scenario: Scenario, path: string, value: number): void {
  const parts = path.split('.')
  let at = scenario as unknown as Record<string, unknown>
  for (const part of parts.slice(0, -1)) {
    if (!Object.hasOwn(at, part) || !at[part] || typeof at[part] !== 'object') throw new Error('Unknown setting path.')
    at = at[part] as Record<string, unknown>
  }
  const last = parts.at(-1)!
  if (!Object.hasOwn(at, last)) throw new Error('Unknown setting path.')
  at[last] = value
}
function baseEvidence(path: string): { group: string; evidence: string; sourceIds: string[] } | null {
  const leaf = path.split('.').at(-1)!
  if (/^(center|size|thickness|rotation|seed|id|shape|meanDepth|distributionDepth)/.test(leaf)) return null
  if (path.startsWith('soilLayers.')) return { group: 'Layers and roots', evidence: 'Assumed layer modifier; no measured layer profile is supplied.', sourceIds: ['OD09'] }
  if (path.startsWith('peatRegions.')) return { group: 'Peat', evidence: leaf === 'moistureSaturation' ? 'Liquid volume / pore volume. Literature dry-basis moisture is shown separately; neither ignition nor extinction has a universal saturation threshold.' : 'Site-specific assumption. Irish moss peat measurements provide context, not confirmation of this mixed soil deposit.', sourceIds: ['HR17', 'HR15', 'DB25'] }
  if (path.startsWith('soil.')) return { group: 'Ground', evidence: 'Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative.', sourceIds: ['OD09', 'DB25'] }
  if (path.startsWith('root.')) return { group: 'Layers and roots', evidence: 'Assumed extra dry root fuel; no site-specific root survey or separate root chemistry is supplied.', sourceIds: [] }
  if (path.startsWith('source.')) return { group: 'Source', evidence: 'Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls.', sourceIds: ['GE37', 'Z26'] }
  if (path.startsWith('model.')) return { group: /Pressure|Velocity|maxStep/.test(leaf) ? 'Solver limits' : 'Reaction', evidence: /Pressure|Velocity|maxStep/.test(leaf) ? 'Supported numerical range. Limits may be tightened; changing a limit does not extend the physical model.' : 'One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients.', sourceIds: ['HR17', 'LH21', 'Q22'] }
  if (path.startsWith('atmosphere.')) return { group: 'Boundary', evidence: 'Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one.', sourceIds: ['Q22'] }
  if (path.startsWith('pathways.')) return { group: 'Layers and roots', evidence: 'Assumed permeability multiplier under hypothetical geometry; not predicted fracture.', sourceIds: [] }
  if (path.startsWith('hotRegions.') && /temperatureC|fuelFraction/.test(leaf)) return { group: 'Reaction', evidence: 'Prescribed ignition state; no thermocouple or fuel inventory measurement supplied.', sourceIds: ['LH21'] }
  return null
}
export function editableProperties(scenario: Scenario): EditableProperty[] {
  const properties: EditableProperty[] = []
  for (const entry of PARAMETER_REGISTRY) {
    if (!Array.isArray(entry.range)) continue
    const array = entry.path.split('[]')[0]
    const items = entry.path.includes('[]') ? readSetting(scenario, array) : null
    const paths = entry.path.includes('[]') ? (Array.isArray(items) ? items.map((_, i) => entry.path.replace('[]', `.${i}`)) : []) : [entry.path]
    for (const path of paths) {
      const value = readSetting(scenario, path), review = baseEvidence(path)
      if (typeof value !== 'number' || !review) continue
      const index = path.match(/\.(\d+)\./)?.[1]
      properties.push({ path, name: entry.name + (index !== undefined ? ` · ${Number(index) + 1}` : ''), value, units: entry.units, range: entry.range, ...review })
    }
  }
  const materials = resolveMaterials(scenario)
  for (const key of MATERIAL_KEYS) properties.push({ path: `materialProperties.${key}`, value: materials[key], ...MATERIAL_DEFINITIONS[key] })
  const selection = scenario.researchSelection
  if (selection) for (const property of properties) {
    if (!Object.hasOwn(selection.appliedValues, property.path)) continue
    const unchanged = selection.appliedValues[property.path] === property.value
    property.evidence = unchanged
      ? `Profile ${selection.id}: ${selection.propertyNotes?.[property.path] ?? 'Recorded reference value; see the profile interpretation.'}`
      : `Edited after profile ${selection.id}; this value is now a user assumption. ${property.evidence}`
    property.sourceIds = [...new Set([...selection.sourceIds, ...property.sourceIds])]
  }
  return properties
}
export function applyPropertyEdits(scenario: Scenario, changes: Record<string, string>): Scenario {
  const next = structuredClone(scenario)
  const allowed = new Set(editableProperties(scenario).map(p => p.path))
  for (const [path, raw] of Object.entries(changes)) {
    if (!allowed.has(path)) throw new Error(`Unknown editable setting: ${path}`)
    if (!raw.trim() || !Number.isFinite(Number(raw))) throw new Error(`${path} requires a finite number.`)
    if (path.startsWith('materialProperties.') && !next.materialProperties) next.materialProperties = resolveMaterials(scenario)
    // Partial material extensions are valid: materialize missing defaults before editing.
    if (path.startsWith('materialProperties.')) next.materialProperties = resolveMaterials(next)
    writeSetting(next, path, Number(raw))
    next.provenance[path] = 'assumed'
  }
  return next
}
export function parameterAudit(scenario: Scenario) {
  const edits = editableProperties(scenario)
  return { format: 'zombie-fire-material-audit', version: 1, scenario: structuredClone(scenario),
    note: 'Allowed input ranges are software support guards. A citation is not site validation. Legacy imports retain old coefficients until materialProperties is added.',
    editableProperties: edits, otherSettings: PARAMETER_REGISTRY.filter(p => !edits.some(e => e.path.replace(/\.\d+\./g, '[].') === p.path))
      .map(p => ({ ...p, evidence: p.status === 'illustrative only' ? 'Display or illustration only.' : 'Geometry, numerical choice, derived quantity or nonnumeric control; not a measured material property.' })),
    sources: MATERIAL_SOURCES }
}
