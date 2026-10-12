import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { methodPresentationBase } from '../presentationBase'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'pressure-pulse', method: '4.2.3', number: '4.2.3', label: 'Subsurface Pressure Pulse', subtitle: 'Abstract disturbance, then liquid at multiple depths', engines: ['contact', 'concept'], media: ['water', 'unspecified'], defaultMedium: 'water', defaultEngine: 'contact', stages: ['Excavator-drilled access', 'Abstract phase-change event', 'Prescribed multi-depth liquid contact'], limitation: 'Pressure event is illustrative only. No shock, fracture, rearrangement or permeability enhancement is solved. Three independent thermal specimens represent prescribed contacts, not predicted penetration.', status: status('Post-event liquid contact only'), provenance },
  { id: 'liquid-waves', method: '4.2.3', number: '4.2.3.1', label: 'Liquid-pressure waves then injection', subtitle: 'Descriptive draft label · supplied subsection untitled', draft: true, engines: ['contact', 'concept'], media: ['water', 'unspecified'], defaultMedium: 'water', defaultEngine: 'contact', stages: ['Excavator-drilled access', 'Illustrative liquid-pressure waves', 'Ordinary prescribed liquid contact'], limitation: 'Waves have no numerical source term or credited thermal benefit. A later contact start is an editable scenario assumption, not measured wave behavior.', status: status('Ordinary liquid contact only'), provenance },
  { id: 'pressure-only', method: '4.2.3', number: '4.2.3.2', label: 'Rapid pressure change without liquid', subtitle: 'Descriptive draft label · no liquid injection', draft: true, engines: ['concept'], media: ['none', 'unspecified'], defaultMedium: 'none', defaultEngine: 'concept', stages: ['Excavator-drilled access', 'Abstract rapid pressure change', 'Soil rearrangement hypothesis'], limitation: 'Collapse or rearrangement is a hypothesis. No constitutive model supports a predicted outcome; no liquid, cooling curve or suppression ranking is generated.', status: status('Unavailable — environmental response not coupled'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.3', variants,
  defaultSettings: id => ({contactStartS: id === 'liquid-waves' ? 12 : 8}),
  createRun: (config, hooks) => hooks.supportedRun(config),
  presentation: methodPresentationBase,
}
