import type { Scenario } from './types'
import { DEFAULT_MATERIALS, peatPorosity, resolveMaterials, saturationFromDryBasis } from './materials'
import { validateScenario } from './scenario'

export interface ResearchProfile {
  id: string; name: string; family: 'Moss peat' | 'Organic field soil' | 'Peat and sand mixtures'
  sourceIds: string[]; density: number; organicFraction: number; dryBasisMoisture: number
  conductivity?: number; heatCapacity?: number
  reported: string; interpretation: string; missing: string
}
// Decharme (2025), Table 4 XLSX; original measurements Arkhangelskaya &
// Telyatnikova (2023). SOM, dry conductivity and heat capacity are estimates.
// Order: peat dry-mass %, observed dry bulk density, estimated SOM fraction,
// estimated dry bulk conductivity, estimated dry volumetric heat capacity.
const MIXTURES = [
  [100, 310, 0.734, 0.050, 499000], [80, 370, 0.592, 0.049, 525000],
  [60, 460, 0.450, 0.042, 562000], [40, 460, 0.305, 0.095, 766000],
  [20, 870, 0.159, 0.108, 772000], [10, 930, 0.082, 0.151, 960000],
  [5, 1130, 0.044, 0.206, 1042000], [3, 1340, 0.028, 0.233, 1080000],
  [1, 1400, 0.013, 0.557, 1138000], [0, 1630, 0.0045, 0.630, 1172000],
] as const
export const RESEARCH_PROFILES: ResearchProfile[] = [
  { id: 'irish-moss-dry', name: 'Irish moss peat', family: 'Moss peat', sourceIds: ['HR17'], density: 135,
    organicFraction: 0.98, dryBasisMoisture: 0, heatCapacity: 1840,
    reported: 'Oven-dry bulk density 135 ± 5 kg/m³; inorganic content about 2%; modeled peat heat capacity 1840 J/(kg·K).',
    interpretation: 'Dry-property reference. Organic fraction is approximated as one minus inorganic content; initial water is set to zero for this dry case. Particle density uses the paper’s model input.',
    missing: 'Conductivity, permeability, reaction and strength retain explicit assumptions. The app does not reproduce the 30 cm column experiment.' },
  { id: 'andean-organic-midpoint', name: 'Andean organic soil', family: 'Organic field soil', sourceIds: ['P17'], density: (188 + 355) / 2,
    organicFraction: 1 - (0.06 + 0.106) / 2, dryBasisMoisture: 1.145,
    reported: 'Field ranges: dry density 188–355 kg/m³, inorganic content 6.0–10.6%; average moisture 1.145 kg/kg dry soil; mineral texture 66/22/12% sand/silt/clay.',
    interpretation: 'Illustrative midpoint of unpaired field ranges, not a measured specimen. Organic matter is approximated as one minus inorganic residue, not from organic carbon. Wet density in the table is not used as dry density.',
    missing: 'Porosity is derived; thermal, gas transport and strength settings remain assumptions. A hot buried block is not the field ignition protocol.' },
  ...MIXTURES.map(([peatPercent, density, organicFraction, conductivity, capacity]) => ({
    id: `lowland-peat-${peatPercent}`, name: peatPercent === 100 ? 'Lowland peat' : peatPercent === 0 ? 'Quarry sand' : `${peatPercent}% lowland peat · ${100 - peatPercent}% sand`,
    family: 'Peat and sand mixtures' as const, sourceIds: ['D25', 'AT23'], density, organicFraction,
    dryBasisMoisture: 0, conductivity, heatCapacity: capacity / density,
    reported: `Table 4: dry bulk density ${density} kg/m³; estimated organic matter ${Number((organicFraction * 100).toFixed(2))}% by dry mass; dry conductivity ${conductivity} W/(m·K).`,
    interpretation: 'Peat-to-sand ratio is dry sample mass, not organic-matter fraction. Specific heat = estimated dry volumetric capacity / measured density. Zero water approximates the air-dry reference, whose residual water is not supplied here.',
    missing: 'These are dry thermal reference cases. Constant conductivity is not calibrated at smoldering temperatures or wet conditions. Mineral gradation, gas transport, reactions and strength remain assumptions.',
  })),
]
export type ResearchTarget = 'soil' | `peat:${number}`
export interface ResearchSelection { id: string; target: ResearchTarget; sourceIds: string[]; appliedValues: Record<string, number>; propertyNotes?: Record<string, string> }
export function stageResearchProfile(scenario: Scenario, id: string, target: ResearchTarget): Scenario {
  const profile = RESEARCH_PROFILES.find(p => p.id === id)
  if (!profile) throw new Error('Unknown research profile.')
  const next = structuredClone(scenario)
  next.materialProperties = resolveMaterials(scenario)
  // Shared end-member values are model assumptions where the selected study
  // supplies no particle densities; their independent provenance stays visible.
  if (id === 'irish-moss-dry') next.materialProperties.peatOrganicParticleDensityKgM3 = DEFAULT_MATERIALS.peatOrganicParticleDensityKgM3
  const m = resolveMaterials(next)
  const phi = peatPorosity(profile.density, profile.organicFraction, m)
  const saturation = saturationFromDryBasis(profile.dryBasisMoisture, phi, profile.density, m.waterDensityKgM3)
  const applied: Record<string, number> = {}
  const notes: Record<string, string> = {}
  const record = (path: string, value: number, note?: string) => {
    applied[path] = value
    const leaf = path.split('.').at(-1)!
    notes[path] = note ?? (leaf === 'bulkDensityKgM3'
      ? id === 'andean-organic-midpoint' ? 'Derived midpoint of unpaired observed dry-density bounds; not a measured specimen.' : 'Observed dry bulk density for the study material.'
      : leaf === 'organicFraction' ? 'Estimated or inferred organic dry-mass fraction; see the profile interpretation.'
      : leaf === 'porosity' ? 'Derived from dry density and assumed particle specific volumes; not measured porosity.'
      : leaf === 'moistureSaturation' ? 'Converted from the profile’s water/dry-mass ratio. Dry references use an assumed zero-water limit.'
      : /HeatCapacity|heatCapacity|Conductivity|conductivity/.test(leaf) ? 'Published model input or dry thermal estimate; not a measured wet/high-temperature coefficient.'
      : 'Composition from the reference profile; see the study and its stated interpretation.')
    next.provenance[path] = 'literature-default'
  }
  if (id === 'irish-moss-dry') record('materialProperties.peatOrganicParticleDensityKgM3', m.peatOrganicParticleDensityKgM3, 'Adopted peat particle density from Huang and Rein Table 2; shared by all peat regions.')
  if (target === 'soil') {
    Object.assign(next.soil, { bulkDensityKgM3: profile.density, organicFraction: profile.organicFraction,
      porosity: phi, moistureSaturation: saturation })
    for (const key of ['bulkDensityKgM3', 'organicFraction', 'porosity', 'moistureSaturation'] as const) record(`soil.${key}`, next.soil[key])
    if (profile.conductivity !== undefined) { next.soil.thermalConductivityWmK = profile.conductivity; record('soil.thermalConductivityWmK', profile.conductivity) }
    if (profile.heatCapacity !== undefined) { next.soil.solidHeatCapacityJKgK = profile.heatCapacity; record('soil.solidHeatCapacityJKgK', profile.heatCapacity) }
    if (profile.id === 'lowland-peat-0') {
      next.soil.sandFraction = 1; next.soil.siltFraction = 0; next.soil.clayFraction = 0
      for (const key of ['sandFraction', 'siltFraction', 'clayFraction'] as const) record(`soil.${key}`, next.soil[key])
    }
    if (profile.id === 'andean-organic-midpoint') {
      next.soil.sandFraction = 0.66; next.soil.siltFraction = 0.22; next.soil.clayFraction = 0.12
      for (const key of ['sandFraction', 'siltFraction', 'clayFraction'] as const) record(`soil.${key}`, next.soil[key])
    }
    // Neutral layer modifiers are necessary to apply a bulk sample consistently.
    next.soilLayers = next.soilLayers.map((l, i) => {
      const neutral = { dryDensityMultiplier: 1, porosityOffset: 0, moistureSaturationOffset: 0,
        permeabilityMultiplier: 1, thermalConductivityMultiplier: 1 }
      for (const [key, value] of Object.entries(neutral)) {
        record(`soilLayers.${i}.${key}`, value, 'Neutral layer modifier chosen to represent a uniform bulk sample; not a study measurement.')
        next.provenance[`soilLayers.${i}.${key}`] = 'assumed'
      }
      return { ...l, ...neutral }
    })
  } else {
    if (!/^peat:\d+$/.test(target)) throw new Error('Unknown profile target.')
    const index = Number(target.slice(5)), peat = next.peatRegions[index]
    if (!peat) throw new Error('Choose an existing peat region.')
    Object.assign(peat, { bulkDensityKgM3: profile.density, organicFraction: profile.organicFraction, moistureSaturation: saturation })
    for (const key of ['bulkDensityKgM3', 'organicFraction', 'moistureSaturation'] as const) record(`peatRegions.${index}.${key}`, peat[key])
    if (profile.heatCapacity !== undefined) { next.materialProperties.peatHeatCapacityJKgK = profile.heatCapacity; record('materialProperties.peatHeatCapacityJKgK', profile.heatCapacity) }
    if (profile.conductivity !== undefined) {
      next.materialProperties.peatDryConductivityWmK = profile.conductivity; next.materialProperties.peatSaturationConductivityWmK = 0
      record('materialProperties.peatDryConductivityWmK', profile.conductivity); record('materialProperties.peatSaturationConductivityWmK', 0)
    }
  }
  next.researchSelection = { id, target, sourceIds: [...profile.sourceIds], appliedValues: applied, propertyNotes: notes }
  next.name = `${profile.name} · research comparison`
  const validation = validateScenario(next)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  return next
}
