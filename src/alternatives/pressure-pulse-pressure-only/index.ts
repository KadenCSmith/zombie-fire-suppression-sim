import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { createPressureOnlyRun, pressureOnlyPresentation } from './model'

export const variants: readonly Variant[] = [{
  id: 'pressure-only', method: '4.2.3', number: '4.2.3.2',
  label: 'Rapid pressure change without liquid', subtitle: 'Descriptive draft label · no liquid injection', draft: true,
  engines: ['concept'], media: ['none', 'unspecified'], defaultMedium: 'none', defaultEngine: 'concept',
  stages: ['Excavator-drilled access', 'Abstract rapid pressure change', 'Observe an unresolved soil-response hypothesis'],
  limitation: 'No liquid or thermal source is instantiated. Pressure propagation, soil rearrangement/collapse and suppression remain unavailable without a constitutive and transport model; all physical metrics are N/A.',
  status: { illustrative: true, modeled: 'Unavailable — pressure/soil response not coupled', experimentallyValidated: false },
  provenance: 'User capstone subsection; generic environmental input with unspecified source properties. No device, pressure law or measured outcome is inferred.',
}]

export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.3', variants,
  defaultSettings: () => ({ contactStartS: 8 }),
  createRun: createPressureOnlyRun,
  presentation: pressureOnlyPresentation,
}
