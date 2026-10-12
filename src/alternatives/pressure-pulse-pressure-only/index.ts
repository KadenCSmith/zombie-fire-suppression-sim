import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { methodPresentationBase } from '../presentationBase'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'pressure-only', method: '4.2.3', number: '4.2.3.2', label: 'Rapid pressure change without liquid', subtitle: 'Descriptive draft label · no liquid injection', draft: true, engines: ['concept'], media: ['none', 'unspecified'], defaultMedium: 'none', defaultEngine: 'concept', stages: ['Excavator-drilled access', 'Abstract rapid pressure change', 'Soil rearrangement hypothesis'], limitation: 'Collapse or rearrangement is a hypothesis. No constitutive model supports a predicted outcome; no liquid, cooling curve or suppression ranking is generated.', status: status('Unavailable — environmental response not coupled'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.3', variants,
  defaultSettings: () => ({contactStartS: 8}),
  createRun: (config, hooks) => hooks.supportedRun(config),
  presentation: methodPresentationBase,
}
