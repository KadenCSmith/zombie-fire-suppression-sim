import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { methodPresentationBase } from '../presentationBase'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'sublimation-injection', method: '4.2.1', number: '4.2.1', label: 'Extinguishing Medium Sublimation and Injection', subtitle: 'Surface phase change → liquid delivery → subsurface contact', engines: ['contact', 'concept'], media: ['water', 'co2-water', 'unspecified'], defaultMedium: 'water', defaultEngine: 'contact', stages: ['Excavator-drilled access', 'Surface solid + liquid concept', 'Proposed pressurization / cooling', 'Prescribed liquid contact'], limitation: 'Tank thermodynamics, pressurization, penetration and cost advantages are unverified. Contact proxy does not simulate the tank or injection transport; CO₂ option is separate direct contact, not predicted liquid pre-cooling.', status: status('Finite contact heat / inventory only'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.1', variants,
  defaultSettings: () => ({contactStartS: 8}),
  createRun: (config, hooks) => hooks.supportedRun(config),
  presentation: methodPresentationBase,
}
