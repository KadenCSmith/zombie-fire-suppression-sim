import { findMethodModule } from './modules'
import { createContactCoolingSession, type ContactCoolingState, type ContactPatchSpec } from '../story/contactCooling'
import { compatible, defaultThermal, variant, type VariantId, type EngineId, type MediumId, type ThermalSettings } from './registry'
import { DEFAULT_SETTINGS, PeatSolver, totals, type Settings, type Frame } from '../peatfem/coupled'
export interface PanelConfig { id: string; variantId: VariantId; engine: EngineId; medium: MediumId; sourceStatus: 'unspecified' | 'known-contact-properties'; thermal: ThermalSettings; fem: Settings }
export interface Metrics { maximumK: number; waterUsedKg: number; dryIceUsedKg: number; energyJ: number; energyResidualJ: number; massResidualKg: number; oxygenKg: number | null; fuelKg: number | null; reactionW: number | null }
export interface AcceptedState { timeS: number; contact?: ContactCoolingState; fem?: Frame; metrics: Metrics | null }
export interface RunMessage { panelId: string; runId: string; type: 'ready' | 'state' | 'paused' | 'complete' | 'failed'; state?: AcceptedState; running: boolean; solveMs: number; wallMs: number; error?: string }
export interface WorkerCommand { panelId: string; runId: string; type: 'init' | 'run' | 'pause' | 'advance'; config?: PanelConfig; targetS?: number }
export function acceptsMessage(panelId: string, runId: string, message: Pick<RunMessage, 'panelId' | 'runId'>) { return message.panelId === panelId && message.runId === runId }
export function buildContact(config: PanelConfig) {
  const { thermal: s } = config, active = s.enabled && config.variantId !== 'baseline'
  const water = active && (config.medium === 'water' || config.medium === 'co2-water')
  const dry = active && config.medium === 'co2-water'
  const multi = config.variantId === 'pressure-pulse', count = 3
  const patches: ContactPatchSpec[] = Array.from({ length: count }, (_, i) => ({
    id: `specimen-${i}`, xM: 0, yM: -(i + 1) * .1, radiusM: .04, peatMassKg: .5,
    dryIceConductanceWK: dry && i === 0 ? 8 : 0, waterConductanceWK: water ? s.conductanceWK : 0,
    waterArrivalTimeS: s.contactStartS + (multi ? i * 2 : 0), waterShare: 1 / count,
  }))
  return createContactCoolingSession({ startTimeS: 0, endTimeS: s.endS, rapidRemovalTimeS: s.endS,
    waterStartTimeS: s.contactStartS, stepS: .05, initialTemperatureK: s.initialK, waterInletK: s.inletK,
    dryIceInitialKg: dry ? s.dryIceKg : 0, waterInitialKg: water ? s.waterKg : 0, waterFlowKgS: water ? s.flowKgS : 0 }, patches)
}
function createSupportedRun(config: PanelConfig) {
  const reason = compatible(config.variantId, config.engine, config.medium)
  if (reason) throw new Error(reason)
  const contact = config.engine === 'contact' ? buildContact(config) : undefined
  const fem = config.engine === 'peat-fem' ? new PeatSolver(config.fem) : undefined
  const base = fem ? totals(fem.mesh, fem.frame) : undefined
  let timeS = 0, contactState = contact?.snapshot()
  const endS = fem ? config.fem.endS : config.thermal.endS
  function snapshot(): AcceptedState {
    if (contactState) {
      const l = contactState.ledger
      return { timeS, contact: structuredClone(contactState), metrics: { maximumK: Math.max(...contactState.patches.map(p => p.temperatureK)), waterUsedKg: l.waterSuppliedKg,
        dryIceUsedKg: l.dryIceSublimatedKg, energyJ: l.heatToWaterJ + l.heatToDryIceJ, energyResidualJ: l.energyResidualJ,
        massResidualKg: Math.max(Math.abs(l.waterMassResidualKg), Math.abs(l.dryIceMassResidualKg)), oxygenKg: null, fuelKg: null, reactionW: null } }
    }
    if (fem && base) {
      const f = fem.snapshot(), t = totals(fem.mesh, f)
      const lastReactionJ = reactionPreviousJ, lastTimeS = reactionPreviousTimeS
      return { timeS: f.timeS, fem: f, metrics: { maximumK: t.maximumK, waterUsedKg: 0, dryIceUsedKg: 0, energyJ: t.energyJ,
        energyResidualJ: t.energyJ - base.energyJ - f.ledger.ignitionJ - f.ledger.reactionJ + f.ledger.heatOutJ + f.ledger.gasEnthalpyOutJ,
        massResidualKg: t.componentsKg - base.componentsKg + f.ledger.gasBoundaryKg.reduce((a, b) => a + b, 0), oxygenKg: t.oxygenKg, fuelKg: t.peatKg,
        reactionW: f.timeS > lastTimeS ? (f.ledger.reactionJ - lastReactionJ) / (f.timeS - lastTimeS) : 0 } }
    }
    return { timeS, metrics: null }
  }
  let reactionPreviousJ = 0, reactionPreviousTimeS = 0
  return {
    endS, snapshot,
    advanceTo(targetS: number) {
      if (!Number.isFinite(targetS) || targetS < timeS - 1e-8 || targetS > endS + 1e-8) throw new Error('Invalid physical target')
      if (fem) {
        reactionPreviousJ = fem.frame.ledger.reactionJ; reactionPreviousTimeS = fem.frame.timeS
        while (fem.frame.timeS < targetS - 1e-8) fem.advance(Math.min(fem.settings.maxStepS, targetS - fem.frame.timeS))
        timeS = fem.frame.timeS
      } else {
        if (contact) contactState = contact.advanceTo(targetS)
        timeS = targetS
      }
      return snapshot()
    },
  }
}
export function createRun(config: PanelConfig) {
  const module = findMethodModule(config.variantId)
  return module ? module.createRun(config, {supportedRun:createSupportedRun}) : createSupportedRun(config)
}
export function freshPanel(id: string, variantId: VariantId): PanelConfig {
  const v = variant(variantId)
  return { id, variantId, engine: v.defaultEngine, medium: v.defaultMedium, sourceStatus: 'unspecified',
    thermal: defaultThermal(variantId), fem: { ...DEFAULT_SETTINGS } }
}
export function duplicatePanel(panel: PanelConfig, id: string): PanelConfig { return { ...structuredClone(panel), id } }
export function linkedCompatibility(configs: PanelConfig[]): string | null {
  if (configs.length < 2) return 'Select at least two panels.'
  if (configs.some(c => compatible(c.variantId, c.engine, c.medium))) return 'Resolve incompatible selections first.'
  if (configs.some(c => c.engine === 'concept')) return 'Concept stage time is presentation time, not physical time.'
  if (configs.some(c => c.engine !== configs[0].engine)) return 'Contact and FEM do not represent the same physical system.'
  if (configs.some(c => (c.engine === 'peat-fem' ? c.fem.endS : c.thermal.endS) !== (configs[0].engine === 'peat-fem' ? configs[0].fem.endS : configs[0].thermal.endS))) return 'Match observation windows first.'
  return null
}
