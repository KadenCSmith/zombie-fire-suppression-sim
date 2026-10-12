import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { createRun, freshPanel, type AcceptedState } from '../../../src/alternatives/model'

const records: unknown[] = []
describe('4.2.1 physical-checkpoint ledger evidence', () => {
  it.each(['water', 'co2-water', 'off'] as const)('closes accepted ledgers through the complete %s window', selection => {
    const panel = freshPanel(`evidence-${selection}`, 'sublimation-injection')
    if (selection !== 'off') panel.medium = selection
    else { panel.medium = 'co2-water'; panel.thermal.enabled = false }
    const run = createRun(panel), history: AcceptedState[] = []
    for (const time of [0, .5, 8, 8.5, 20, 30, 60]) {
      const state = run.advanceTo(time), ledger = state.contact!.ledger
      expect(state.timeS).toBe(time)
      expect(ledger.waterSuppliedKg).toBeLessThanOrEqual(ledger.waterInitialKg + 1e-12)
      expect(ledger.dryIceSublimatedKg).toBeLessThanOrEqual(ledger.dryIceInitialKg + 1e-12)
      expect(Math.abs(ledger.energyResidualJ)).toBeLessThan(1e-7)
      expect(Math.abs(ledger.waterMassResidualKg)).toBeLessThan(1e-12)
      expect(Math.abs(ledger.dryIceMassResidualKg)).toBeLessThan(1e-12)
      history.push(state)
    }
    records.push({ selection, config: panel, history })
  })
})

afterAll(() => {
  // Explicit private capture only; ordinary test runs do not write evidence.
  if (process.env.V21_CAPTURE_SUBLIMATION_EVIDENCE === '1') writeFileSync(new URL('../../../docs/alternatives/sublimation-injection/numerical-evidence.json', import.meta.url), JSON.stringify({
    scope: 'Numerical verification of the finite-contact proxy; no experimental or field validation',
    apiVersion: 'v21.2', originalCommit: '161e7a4a1f8c35765e1878c132db79977be1f5ea',
    units: { time: 's', temperature: 'K', mass: 'kg of each pure material', energy: 'J' },
    physicalStepS: .05, method: 'External unchanged reference evaluated independently at accepted checkpoints',
    records,
  }, null, 2) + '\n')
})
