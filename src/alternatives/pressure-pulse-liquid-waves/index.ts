import { ALTERNATIVE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { createLiquidWavesRun, liquidWavesPresentation } from './model'

export const variants: readonly Variant[] = [{
  id: 'liquid-waves', method: '4.2.3', number: '4.2.3.1',
  label: 'Liquid-pressure waves then injection',
  subtitle: 'Original 4.2.3 sequence · opposing trucks, rigid pipe and intermittent ground pulses', draft: true,
  engines: ['contact', 'concept'], media: ['water', 'unspecified'],
  defaultMedium: 'water', defaultEngine: 'contact',
  stages: ['Original fire and access sequence', 'Original dry-ice release and truck deployment', 'Normal pumping with hydraulic pulses'],
  limitation: 'Pressure-wave propagation, infiltration and structural response are unavailable. The user-requested fracture and extinguishing sequence is an authored illustration, not a predicted outcome. Only the separate finite ordinary-water contact calorimeter is modeled; added visual pulses contribute no modeled source, cooling or permeability benefit. The editable 12 s contact arrival is a scenario assumption, separate from the presentation clock.',
  status: { illustrative: true, modeled: 'Finite liquid-water contact calorimeter only', experimentallyValidated: false },
  provenance: 'User capstone subsection; unchanged external contact reference with constant-property approximations. See method evidence for assumptions and official water-property references.',
}]

export const methodModule: AlternativeModule = {
  apiVersion: ALTERNATIVE_API_VERSION, method: '4.2.3', variants,
  defaultSettings: () => ({ contactStartS: 12 }),
  createRun: createLiquidWavesRun,
  presentation: liquidWavesPresentation,
}
