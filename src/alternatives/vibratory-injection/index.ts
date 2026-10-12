import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { createVibratoryRun, defaultSettings, vibratoryPresentation } from './model'
export { capabilities, parameterProvenance } from './model'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'vibratory-injection', method: '4.2.4', number: '4.2.4', label: 'Earthquake Extinguisher', subtitle: 'Vibratory drilling + continuous injection', engines: ['contact', 'concept'], media: ['water', 'unspecified'], defaultMedium: 'water', defaultEngine: 'contact', stages: ['Access concept', 'Simultaneous vibration and liquid delivery', 'Review competing soil hypotheses'], limitation: 'Drilling and vibration are illustrative. Loosening and compaction compete; neither changes calculated permeability. Only continuous prescribed contact with finite water is modeled. Field penetration, oxygen, suppression and vibration energy are unavailable.', status: status('Finite continuous liquid contact only; unvalidated'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.4', variants,
  defaultSettings: () => ({ ...defaultSettings }),
  createRun: createVibratoryRun,
  presentation: vibratoryPresentation,
}
