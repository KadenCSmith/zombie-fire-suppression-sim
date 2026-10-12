import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'

it('records finite continuous-contact checkpoints with closed ledgers', () => {
  const config = freshPanel('c-evidence', 'vibratory-injection'), run = createRun(config)
  const checkpoints = [0, 10, 20, 60].map(timeS => {
    const state = run.advanceTo(timeS)
    expect(Math.abs(state.metrics!.energyResidualJ)).toBeLessThan(1e-7)
    expect(Math.abs(state.metrics!.massResidualKg)).toBeLessThan(1e-12)
    return state
  })
  expect(checkpoints[1].metrics!.waterUsedKg).toBeCloseTo(.25, 12)
  expect(checkpoints[3].metrics!.waterUsedKg).toBeCloseTo(.5, 12)
  if (process.env.V21_C_EVIDENCE_PATH) writeFileSync(process.env.V21_C_EVIDENCE_PATH, JSON.stringify({
    method: '4.2.4', apiVersion: 'v21.2', numericalVerificationOnly: true, experimentallyValidated: false,
    units: { timeS: 's', temperatureK: 'K', waterMass: 'kg', energy: 'J' },
    scope: 'Three independent finite-contact specimens; no field transport, combustion, mechanical coupling or suppression prediction.',
    config, checkpoints,
  }, null, 2) + '\n')
})
