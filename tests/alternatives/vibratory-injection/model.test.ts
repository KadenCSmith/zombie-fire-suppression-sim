import { describe, expect, it } from 'vitest'
import { createRun, duplicatePanel, freshPanel } from '../../../src/alternatives/model'
import { compatible } from '../../../src/alternatives/registry'
import { methodModule, capabilities } from '../../../src/alternatives/vibratory-injection'

describe('4.2.4 continuous-contact component', () => {
  it('accounts for continuous delivery and stops at its finite inventory', () => {
    const panel = freshPanel('continuous', 'vibratory-injection'), run = createRun(panel)
    expect(run.snapshot().contact!.ledger.waterSuppliedKg).toBe(0)
    const half = run.advanceTo(10).contact!
    expect(half.ledger.waterSuppliedKg).toBeCloseTo(.25, 12)
    expect(half.ledger.waterRemainingSupplyKg).toBeCloseTo(.25, 12)
    expect(half.ledger.waterBypassKg).toBeCloseTo(0, 12)
    expect(half.patches.every(p => Math.abs(p.waterReceivedKg - .25 / 3) < 1e-12)).toBe(true)
    const depleted = run.advanceTo(20).contact!, late = run.advanceTo(60).contact!
    expect(depleted.ledger.waterRemainingSupplyKg).toBeCloseTo(0, 12)
    expect(late.ledger.waterSuppliedKg).toBeCloseTo(.5, 12)
    expect(late.ledger.waterSuppliedKg).toBeCloseTo(depleted.ledger.waterSuppliedKg, 12)
    expect(late.ledger.waterLiquidKg + late.ledger.waterVaporKg).toBeCloseTo(.5, 12)
    expect(late.ledger.dryIceInitialKg).toBe(0)
    expect(Math.abs(late.ledger.waterMassResidualKg)).toBeLessThan(1e-12)
    expect(Math.abs(late.ledger.energyResidualJ)).toBeLessThan(1e-7)
  })

  it('treats delayed contact as a prescribed boundary, without early transfer', () => {
    const panel = freshPanel('delay', 'vibratory-injection'); panel.thermal.contactStartS = 7.3
    const run = createRun(panel)
    expect(run.advanceTo(7.3).metrics!.waterUsedKg).toBe(0)
    expect(run.snapshot().metrics!.energyJ).toBe(0)
    expect(run.advanceTo(7.5).metrics!.waterUsedKg).toBeCloseTo(.005, 12)
  })

  it('recovers the untreated contact reference when intervention is off', () => {
    const panel = freshPanel('off', 'vibratory-injection'); panel.thermal.enabled = false
    const reference = freshPanel('reference', 'baseline'); reference.thermal.contactStartS = panel.thermal.contactStartS
    const off = createRun(panel), baseline = createRun(reference)
    for (const t of [0, 7.3, 20, 60]) {
      expect(off.advanceTo(t)).toEqual(baseline.advanceTo(t))
      expect(off.snapshot().metrics!.waterUsedKg).toBe(0)
    }
  })

  it.each(['waterKg', 'flowKgS', 'conductanceWK'] as const)('has zero heat transfer when %s is zero', key => {
    const panel = freshPanel('limit', 'vibratory-injection'); panel.thermal[key] = 0
    const state = createRun(panel).advanceTo(60)
    expect(state.metrics!.maximumK).toBe(panel.thermal.initialK)
    expect(state.metrics!.energyJ).toBe(0)
    expect(Math.abs(state.metrics!.energyResidualJ)).toBeLessThan(1e-7)
  })

  it('isolates simultaneous runs, serializable inputs, duplicate configuration and returned snapshots', () => {
    const panel = freshPanel('first', 'vibratory-injection'), duplicate = duplicatePanel(panel, 'second')
    duplicate.thermal.waterKg = .1
    const a = createRun(panel), b = createRun(duplicate)
    panel.thermal.waterKg = 5; panel.thermal.endS = 10
    a.advanceTo(10)
    expect(b.snapshot().timeS).toBe(0)
    const bs = b.advanceTo(30), as = a.advanceTo(60)
    expect(bs.metrics!.waterUsedKg).toBeCloseTo(.1, 12)
    expect(as.metrics!.waterUsedKg).toBeCloseTo(.5, 12)
    expect(a.endS).toBe(60)
    as.contact!.patches[0].temperatureK = 9999
    as.contact!.ledger.waterRemainingSupplyKg = 9999
    expect(a.snapshot().contact!.patches[0].temperatureK).not.toBe(9999)
    expect(a.snapshot().contact!.ledger.waterRemainingSupplyKg).toBeLessThan(1)
    expect(b.snapshot()).toEqual(bs)
  })

  it('reproduces the same accepted state through arbitrary checkpoint partitioning', () => {
    const panel = freshPanel('reproducible', 'vibratory-injection'), a = createRun(panel), b = createRun(panel)
    for (const t of [.1, 1.17, 7.31, 20, 43.91, 60]) a.advanceTo(t)
    expect(a.snapshot()).toEqual(b.advanceTo(60))
    expect(() => a.advanceTo(59)).toThrow()
    expect(() => a.advanceTo(61)).toThrow()
    expect(() => a.advanceTo(Number.NaN)).toThrow()
  })

  it('cannot credit illustrative vibration, compaction or loosening as physical changes', () => {
    const panel = freshPanel('presentation', 'vibratory-injection'), active = createRun(panel), untouched = createRun(panel)
    for (let t = 0; t <= 90; t += .125) methodModule.presentation('vibratory-injection', t)
    expect(active.advanceTo(60)).toEqual(untouched.advanceTo(60))
    expect(active.snapshot().metrics!.oxygenKg).toBeNull()
    expect(active.snapshot().metrics!.fuelKg).toBeNull()
    expect(active.snapshot().metrics!.reactionW).toBeNull()
    expect(capabilities.experimentallyValidated).toBe(false)
  })

  it('provides no invented transport, combustion or unspecified-medium prediction', () => {
    expect(compatible('vibratory-injection', 'peat-fem', 'water')).toContain('no supported')
    expect(compatible('vibratory-injection', 'contact', 'unspecified')).toContain('no thermodynamic')
    const panel = freshPanel('concept', 'vibratory-injection'); panel.engine = 'concept'; panel.medium = 'unspecified'
    expect(createRun(panel).advanceTo(60).metrics).toBeNull()
  })
})

describe('4.2.4 authored presentation boundary', () => {
  it('shows access, simultaneous motion and liquid, then a stationary review', () => {
    expect(methodModule.presentation('vibratory-injection', 17.9).access).toBe(false)
    const access = methodModule.presentation('vibratory-injection', 23.9)
    expect(access.access).toBe(true); expect(access.injection).toBe(false)
    const simultaneous = methodModule.presentation('vibratory-injection', 28)
    expect(simultaneous.injection).toBe(true); expect(simultaneous.vibration).not.toBe(0)
    expect(simultaneous.contacts).toBe(3)
    const review = methodModule.presentation('vibratory-injection', 60)
    expect(review.vibration).toBe(0); expect(review.injection).toBe(false)
    expect(review.pulse).toBe(false); expect(review.waves).toBe(false)
  })
})
