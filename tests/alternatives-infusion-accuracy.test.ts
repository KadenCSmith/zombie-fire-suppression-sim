import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../src/alternatives/model'

// Independent continuous-inflow solution frozen by reviewer B in round 0.
// Cp*Tp'=-UA*(Tp-Tw); d(r*t*cw*(Tw-Tin))/dt=UA*(Tp-Tw).
function reference(elapsedS: number, inletK: number) {
  const capacity = .5 * 1840, waterCp = 4186, rate = .025 / 3, ua = 24
  const depletionS = .5 / .025, interval = Math.min(elapsedS, depletionS)
  const alpha = ua / capacity, beta = ua / (rate * waterCp)
  let poisson = 1, sum = 1
  for (let n = 1; n < 100; n++) {
    poisson *= alpha * interval / n
    const term = poisson * beta / (beta + n)
    sum += term
    if (term < 1e-16) break
  }
  let peatK = inletK + (360 - inletK) * Math.exp(-alpha * interval) * sum
  const waterCapacity = rate * interval * waterCp
  let waterK = inletK + capacity * (360 - peatK) / waterCapacity
  if (elapsedS > depletionS) {
    const equilibriumK = (capacity * peatK + waterCapacity * waterK) / (capacity + waterCapacity)
    const delta = (peatK - waterK) * Math.exp(-ua * (1 / capacity + 1 / waterCapacity) * (elapsedS - depletionS))
    peatK = equilibriumK + waterCapacity / (capacity + waterCapacity) * delta
    waterK = equilibriumK - capacity / (capacity + waterCapacity) * delta
  }
  return { peatK, waterK }
}

describe('new-alternative continuous-fill accuracy', () => {
  it.each([273.15, 293.15, 350])('meets the frozen 0.2 K reference tolerance at inlet %s K', inletK => {
    const config = freshPanel('infusion-reference', 'liquid-waves')
    Object.assign(config.thermal, { initialK: 360, inletK, waterKg: .5, flowKgS: .025, conductanceWK: 24, contactStartS: 12, endS: 60 })
    const run = createRun(config)
    for (const elapsedS of [1, 5, 20, 48]) {
      const state = run.advanceTo(12 + elapsedS), expected = reference(elapsedS, inletK)
      for (const patch of state.contact!.patches) {
        expect(Math.abs(patch.temperatureK - expected.peatK)).toBeLessThanOrEqual(.2)
        expect(Math.abs(patch.waterTemperatureK - expected.waterK)).toBeLessThanOrEqual(.2)
      }
      const ledger = state.contact!.ledger
      expect(Math.abs(ledger.waterMassResidualKg)).toBeLessThanOrEqual(1.5e-9)
      expect(Math.abs(ledger.energyResidualJ)).toBeLessThanOrEqual(1e-4 + 1e-9 * ledger.initialPeatEnergyJ)
      expect(ledger.waterSuppliedKg).toBeCloseTo(Math.min(.5, .025 * elapsedS), 9)
    }
  })
})
