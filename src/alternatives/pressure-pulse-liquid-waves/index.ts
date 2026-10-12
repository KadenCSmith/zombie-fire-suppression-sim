import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { methodPresentationBase } from '../presentationBase'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'liquid-waves', method: '4.2.3', number: '4.2.3.1', label: 'Liquid-pressure waves then injection', subtitle: 'Descriptive draft label · supplied subsection untitled', draft: true, engines: ['contact', 'concept'], media: ['water', 'unspecified'], defaultMedium: 'water', defaultEngine: 'contact', stages: ['Excavator-drilled access', 'Illustrative liquid-pressure waves', 'Ordinary prescribed liquid contact'], limitation: 'Waves have no numerical source term or credited thermal benefit. A later contact start is an editable scenario assumption, not measured wave behavior.', status: status('Ordinary liquid contact only'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.3', variants,
  defaultSettings: () => ({contactStartS: 12}),
  createRun: (config, hooks) => hooks.supportedRun(config),
  presentation: methodPresentationBase,
}
