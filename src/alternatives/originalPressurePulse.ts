import type { Variant } from './registry'

/** Metadata only. The existing implementation stays at its original entry point.
 * Do not put a replacement model or presentation clock behind this descriptor. */
export const ORIGINAL_PRESSURE_PULSE: Variant = {
  id: 'pressure-pulse', method: '4.2.3', number: '4.2.3', label: 'Subsurface Pressure Pulse',
  subtitle: 'Original rapid dry-ice release & connected water render',
  engines: [], media: ['none'], defaultMedium: 'none', defaultEngine: 'concept',
  stages: ['Original fire sequence', 'Original rapid release', 'Original connected water'],
  limitation: 'Protected original render. Its existing accepted fields and separate contact readout remain available through the original workspace. An independent live-comparison adapter is unavailable; new comparison metrics are N/A. Open 4.2.3 in Simulation Version to use the original unchanged.',
  status: { illustrative: true, modeled: 'Existing accepted numerical history and separate contact model; no new live comparison adapter', experimentallyValidated: false },
  provenance: 'Verified V20 original: 161e7a4a1f8c35765e1878c132db79977be1f5ea; source/hash baseline in docs/review/version21/original-preservation.json',
}
export const ORIGINAL_ENTRY_POINT = 'src/ui/FireSequenceWorkspace.tsx' as const
