import { PARTICLE_API_VERSION, type AlternativeModule } from '../contract'
import type { Variant } from '../registry'
import { createParticleRun } from './physics'
export const variants: readonly Variant[] = [{
  id: 'nanoparticles', method: '4.2.2', number: '4.2.2', label: 'Solid Inert Gas Nano Particles',
  subtitle: 'Water + fine dry-ice particle injection', engines: ['particle'], media: ['water','co2-water'],
  defaultEngine: 'particle', defaultMedium: 'co2-water',
  stages: ['Continuous source sublimation', 'Hose + probe survival test', 'Conditional underground sublimation', 'Observe the thermal specimen'],
  limitation: 'Unvalidated finite-inventory thermal/entrainment sensitivity. Fine particles may disappear before the probe. Residence and film resistance are assumptions; local freezing, blockage, filtration, peat penetration, gas/O2 fields, pressure, reacting-fire suppression and re-ignition are unavailable. Warm nonreacting specimen273.15–350K only; no experimental validation.',
  status: { illustrative: true, modeled: 'Shrinking particles + finite water/gas enthalpy + prescribed residence + nominated peat calorimeter; conditional/unvalidated', experimentallyValidated: false },
  provenance: 'Human capstone description supplies mechanism only. Explicit analytical study sizes and all unmeasured transport/soil assumptions are exposed; no Nano size inference.',
}]
export const methodModule: AlternativeModule = {
  apiVersion: PARTICLE_API_VERSION, method: '4.2.2', variants,
  defaultSettings: () => ({ enabled: true, waterKg: 1, flowKgS: .1, dryIceKg: .01, initialK: 333.15, inletK: 293.15, contactStartS: 1, conductanceWK: 2, endS: 30 }),
  createRun: config => createParticleRun(config),
  presentation: (_id,time) => ({ contextTime: Math.min(Math.max(0,time),38), access: true, pulse: false, waves: false, injection: false, vibration: 0, contacts: 0 }),
}
