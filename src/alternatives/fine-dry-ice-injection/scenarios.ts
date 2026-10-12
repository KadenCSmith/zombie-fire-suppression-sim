import type { PanelConfig } from '../model'
export type ParticleScenario = 'conduction-reference' | 'film-sensitivity' | 'water-only' | 'pre-sublimated' | 'off' | 'freezing-stop'
export function particleScenario(input: PanelConfig, scenario: ParticleScenario): PanelConfig {
  const config = structuredClone(input), p = config.particleInjection!
  if (scenario === 'film-sensitivity') { p.effectiveConductivityWmK = .006; p.hoseResidenceS = .01; p.probeResidenceS = .01; config.thermal.contactStartS = 0 }
  if (scenario === 'water-only') { config.medium = 'water'; config.thermal.dryIceKg = 0 }
  if (scenario === 'pre-sublimated') p.initialPhase = 'pre-sublimated'
  if (scenario === 'off') config.thermal.enabled = false
  if (scenario === 'freezing-stop') { config.thermal.inletK = 274; config.thermal.dryIceKg = .1 }
  return config
}
export function matchedWaterOnly(input: PanelConfig, id: string): PanelConfig { const next = particleScenario(input,'water-only'); next.id = id; return next }
