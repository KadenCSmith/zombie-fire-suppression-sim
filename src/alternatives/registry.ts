import { METHOD_MODULES, findMethodModule } from './modules'
import { ORIGINAL_PRESSURE_PULSE } from './originalPressurePulse'
export type EngineId = 'contact' | 'peat-fem' | 'concept' | 'particle'
export type MediumId = 'none' | 'water' | 'co2-water' | 'unspecified'
export type VariantId = 'baseline' | 'sublimation-injection' | 'nanoparticles' | 'pressure-pulse' | 'liquid-waves' | 'pressure-only' | 'vibratory-injection'
export const ENGINES = [
  { id: 'contact', label: 'Finite-inventory contact calorimeter', status: 'Modeled thermal proxy · unvalidated' },
  { id: 'peat-fem', label: 'Peat Fire FEM', status: 'Modeled combustion baseline · unvalidated' },
  { id: 'concept', label: 'Conceptual stages', status: 'Illustrative · no physical predictions' },
  { id: 'particle', label: 'Particle delivery model', status: 'Method-specific capabilities and limits' },
] as const
export const MEDIA: readonly { id: MediumId; label: string; category: string; provenance: string }[] = [
  { id: 'none', label: 'No treatment medium', category: 'None', provenance: 'Untreated reference or pressure-only concept' },
  { id: 'water', label: 'Liquid water', category: 'Fluids', provenance: 'Constant cp 4186 J/(kg K), Lv 2.26 MJ/kg near atmospheric boiling; thermal approximation' },
  { id: 'co2-water', label: 'Solid CO₂ + liquid water · contact proxy', category: 'Solids + Fluids', provenance: 'NIST / Giauque & Egan, 1937: 25.2 kJ/mol near 195 K; constant latent heat approximation' },
  { id: 'unspecified', label: 'Unspecified source / medium', category: 'Unspecified', provenance: 'No material properties; thermodynamic predictions unavailable' },
]
export interface Variant {
  id: VariantId; method: string; number: string; label: string; subtitle: string; draft?: boolean;
  engines: readonly EngineId[]; media: readonly MediumId[]; stages: readonly string[];
  limitation: string; defaultMedium: MediumId; defaultEngine: EngineId;
  status: { illustrative: boolean; modeled: string; experimentallyValidated: false };
  provenance: string;
}
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const SHARED_VARIANTS: readonly Variant[] = [
  { id: 'baseline', method: 'baseline', number: '00', label: 'No-treatment baseline', subtitle: 'Untreated smoldering reference / isolated thermal reference', engines: ['peat-fem', 'contact', 'concept'], media: ['none'], defaultMedium: 'none', defaultEngine: 'contact', stages: ['Initial conditions', 'No intervention', 'Observe reference'], limitation: 'Contact reference is an isolated hot specimen with no combustion. Select Peat Fire FEM for reacting smoldering physics.', status: status('FEM combustion or isolated contact reference'), provenance: 'Existing peat FEM and contact-cooling models' },
]
export const VARIANTS: readonly Variant[] = [SHARED_VARIANTS[0], ...METHOD_MODULES[0].variants, ...METHOD_MODULES[4].variants, ORIGINAL_PRESSURE_PULSE, ...METHOD_MODULES[1].variants, ...METHOD_MODULES[2].variants, ...METHOD_MODULES[3].variants]
export const METHODS = ['4.2.1', '4.2.2', '4.2.3', '4.2.4'] as const
export function variant(id: string): Variant { return VARIANTS.find(v => v.id === id) ?? VARIANTS[0] }
export function compatible(id: VariantId, engine: EngineId, medium: MediumId): string | null {
  const v = variant(id)
  if (!v.engines.length) return v.limitation
  if (!v.engines.includes(engine)) return `${v.number} has no supported ${engine} adapter. Use conceptual stages${v.engines.includes('contact') ? ' or the limited contact proxy' : ''}.`
  if (!v.media.includes(medium)) return `${MEDIA.find(m => m.id === medium)?.label} is incompatible with ${v.label}.`
  if (engine === 'contact' && medium === 'unspecified') return 'Unspecified source has no thermodynamic properties. Select conceptual stages or a known medium.'
  if (engine === 'peat-fem' && medium !== 'none') return 'Peat FEM suppression source terms are disabled.'
  return null
}
export const PARAMETERS = [
  { key: 'initialK', label: 'Initial specimen temperature', unit: 'K', min: 300, max: 1000, step: 10, default: 823.15 },
  { key: 'waterKg', label: 'Finite liquid inventory', unit: 'kg', min: 0, max: 5, step: .1, default: .5 },
  { key: 'flowKgS', label: 'Prescribed contact delivery', unit: 'kg/s', min: 0, max: .2, step: .005, default: .025 },
  { key: 'inletK', label: 'Assumed liquid inlet temperature', unit: 'K', min: 273.15, max: 350, step: 1, default: 293.15 },
  { key: 'contactStartS', label: 'Prescribed liquid arrival', unit: 's', min: 0, max: 50, step: 1, default: 8 },
  { key: 'conductanceWK', label: 'Assumed thermal contact UA', unit: 'W/K', min: 0, max: 100, step: 1, default: 24 },
  { key: 'dryIceKg', label: 'Finite CO₂ contact-proxy inventory', unit: 'kg', min: 0, max: 1, step: .01, default: .05 },
  { key: 'endS', label: 'Observation window', unit: 's', min: 10, max: 120, step: 10, default: 60 },
] as const
export type ThermalSettings = Record<typeof PARAMETERS[number]['key'], number> & { enabled: boolean; seed: number }
export function defaultThermal(id: VariantId): ThermalSettings {
  return { ...Object.fromEntries(PARAMETERS.map(p => [p.key, p.default])), enabled: true, seed: 21, ...findMethodModule(id)?.defaultSettings(id) } as ThermalSettings
}
