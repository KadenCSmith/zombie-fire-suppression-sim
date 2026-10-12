import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { methodPresentationBase } from '../presentationBase'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'vibratory-injection', method: '4.2.4', number: '4.2.4', label: 'Earthquake Extinguisher', subtitle: 'Vibratory drilling + continuous injection', engines: ['contact', 'concept'], media: ['water', 'unspecified'], defaultMedium: 'water', defaultEngine: 'contact', stages: ['Vibratory access concept', 'Simultaneous continuous liquid contact', 'Observe competing soil hypotheses'], limitation: 'Vibration is illustrative. Loosening and compaction compete; neither changes calculated permeability. Only prescribed continuous contact is modeled.', status: status('Continuous liquid contact only'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.4', variants,
  defaultSettings: () => ({contactStartS: 0}),
  createRun: (config, hooks) => hooks.supportedRun(config),
  presentation: methodPresentationBase,
}
