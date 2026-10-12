import { PARTICLE_API_VERSION, type AlternativeModule } from '../contract'
import { PARTICLE_PENDING } from './config'
import type { Variant } from '../registry'
export const variants: readonly Variant[] = [{
  id: 'nanoparticles', method: '4.2.2', number: '4.2.2', label: 'Solid Inert Gas Nano Particles',
  subtitle: 'Water + fine dry-ice particle injection', engines: [], media: ['water', 'co2-water'],
  defaultEngine: 'particle', defaultMedium: 'co2-water',
  stages: ['Mixing and upstream losses', 'Delivery survival at the probe', 'Conditional underground sublimation', 'Observe remaining heat'],
  limitation: PARTICLE_PENDING,
  status: { illustrative: true, modeled: 'Awaiting independently reviewed implementation', experimentallyValidated: false },
  provenance: 'Human-supplied capstone description; no measured particle sizes, flow, temperatures, pressures or experimental results supplied.',
}]
export const methodModule: AlternativeModule = {
  apiVersion: PARTICLE_API_VERSION, method: '4.2.2', variants,
  defaultSettings: () => ({ enabled: false, waterKg: 0, flowKgS: 0, dryIceKg: 0, conductanceWK: 0 }),
  createRun: () => { throw new Error(PARTICLE_PENDING) },
  presentation: (_id, time) => ({ contextTime: Math.min(Math.max(0, time), 38), access: false, pulse: false, waves: false, injection: false, vibration: 0, contacts: 0 }),
}
