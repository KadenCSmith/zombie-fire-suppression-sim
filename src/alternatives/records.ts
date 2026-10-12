import type { PanelConfig } from './model'
import { PARTICLE_RECORD_UNITS } from './fine-dry-ice-injection/config'

/** Never export accepted states under settings that did not produce them. */
export function currentRecord<T extends { configurationKey?: string }>(config: PanelConfig, result: T | undefined): T | null {
  return result?.configurationKey?.startsWith(JSON.stringify(config) + ':') ? result : null
}

export const RECORD_UNITS = {
  particleInjection: PARTICLE_RECORD_UNITS,
  temperature: 'K', time: 's', mass: 'kg', energy: 'J', reactionW: 'W',
  oxygen: 'kg O2', oxygenMassFraction: 'kg O2 / kg total gas',
  runtime: { solveMs: 'ms', wallMs: 'ms' },
  contact: { coordinates: 'm', radiusM: 'm', conductance: 'W/K', waterShare: 'dimensionless', wetness: 'retained liquid kg / 0.15 kg display scale; not pore saturation' },
  fem: {
    temperature: 'K', pressure: 'Pa absolute',
    water: 'kg water / m3 bulk', fuel: 'kg peat / m3 bulk',
    alphaChar: 'kg alpha-char / m3 bulk', char: 'kg beta-char / m3 bulk', ash: 'kg ash / m3 bulk',
    gas: 'kg species / m3 bulk', oxygen: 'kg O2 / kg total gas',
    porosity: 'm3 pore / m3 bulk', darcyFlux: 'm/s superficial', darcySpeed: 'm/s superficial', peclet: 'dimensionless',
    gasOrder: ['oxygen', 'nitrogen', 'water vapor', 'lumped emissions (air-like surrogate, not resolved CO/CO2)'],
    nodeOrder: 'i + (n+1)*(j + (n+1)*k); x fastest, then y, z; coordinates [i,j,k]*lengthM/n',
    darcyFluxOrder: 'flat [qx,qy,qz] per zero-based node',
    reactionExtentsOrder: ['drying', 'peat pyrolysis', 'peat oxidation', 'beta-char oxidation', 'alpha-char oxidation'],
    ledger: { energies: 'J', gasBoundaryKg: 'kg species, positive outward; gasOrder', reactionExtentsKg: 'kg reactant extent; reactionExtentsOrder', inventoryLimited: 'count' },
    linearSolves: { heatAbsoluteResidual: 'J, assembled energy L2 norm', oxygenAbsoluteResidual: 'kg, maximum species assembled mass L2 norm', pressureAbsoluteResidual: 'kg, assembled mixture-mass L2 norm (not Pa)', relativeResidual: 'dimensionless', iterations: 'count' },
    splittingError: 'dimensionless normalized maximum', nonlinearError: 'dimensionless maximum relative temperature/EOS error',
    counters: 'count', timeS: 's', stepS: 's', peak: { temperatureK: 'K', timeS: 's', node: 'zero-based node index' },
  },
} as const
