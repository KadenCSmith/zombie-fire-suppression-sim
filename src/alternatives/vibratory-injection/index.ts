import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { createVibratoryRun, defaultSettings, PREDICTION_UNAVAILABLE, vibratoryPresentation } from './model'
export { capabilities, parameterProvenance } from './model'
const status = (modeled: string) => ({ illustrative: true, modeled, experimentallyValidated: false as const })
const provenance = 'User-supplied Version21 work pack; capstone concepts, not measured performance'
export const variants: readonly Variant[] = [
  { id: 'vibratory-injection', method: '4.2.4', number: '4.2.4', label: 'Earthquake Extinguisher', subtitle: 'Vibratory drilling · vibration only', engines: [], media: ['none'], defaultMedium: 'none', defaultEngine: 'concept', stages: ['Original fire and drilling', 'Illustrative vibration', 'Illustrated soil rearrangement and fire-out'], limitation: PREDICTION_UNAVAILABLE, status: status('Unavailable — vibration mechanics unsupported'), provenance },
]
export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.4', variants,
  defaultSettings: () => ({ ...defaultSettings }),
  createRun: createVibratoryRun,
  presentation: vibratoryPresentation,
}
