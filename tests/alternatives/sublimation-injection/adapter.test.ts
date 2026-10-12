import { describe, expect, it } from 'vitest'
import { createRun, duplicatePanel, freshPanel, type PanelConfig } from '../../../src/alternatives/model'
import { methodModule, sublimationPresentation, variants, THERMAL_LIMITS } from '../../../src/alternatives/sublimation-injection'
import { PARAMETERS } from '../../../src/alternatives/registry'
import { allocatedWaterCostUSD } from '../../../src/alternatives/sublimation-injection/evidence'

const config = () => freshPanel('sublimation-test', 'sublimation-injection')
function finalState(panel = config()) { return createRun(panel).advanceTo(panel.thermal.endS) }

describe('4.2.1 boundary and scientific scope', () => {
  it('declares the frozen API, stable method, generic sentinel and unvalidated contact scope', () => {
    expect(methodModule.apiVersion).toBe('v21.2')
    expect(variants.map(v => [v.id, v.method, v.number])).toEqual([['sublimation-injection', '4.2.1', '4.2.1']])
    expect(variants[0].media).toContain('unspecified')
    expect(variants[0].engines).toEqual(['contact', 'concept'])
    expect(variants[0].status.experimentallyValidated).toBe(false)
  })

  it('keeps private boundary checks identical to the frozen shared parameter bounds', () => {
    expect(THERMAL_LIMITS).toEqual(Object.fromEntries(PARAMETERS.map(p => [p.key, [p.min, p.max]])))
  })

  it('rejects a foreign identity before calling the shared hook', () => {
    const panel = config(); panel.variantId = 'pressure-only'
    expect(() => createRun(panel)).toThrow()
    expect(() => methodModule.createRun(panel, { supportedRun: () => { throw new Error('hook must not be reached') } })).toThrow('requires sublimation-injection identity')
  })

  it('rejects unsupported coupling and unspecified thermodynamics', () => {
    const panel = config(); panel.engine = 'peat-fem'
    expect(() => createRun(panel)).toThrow('no supported')
    panel.engine = 'contact'; panel.medium = 'unspecified'
    expect(() => createRun(panel)).toThrow('no thermodynamic')
    panel.engine = 'concept'
    const state = finalState(panel)
    expect(state.metrics).toBeNull(); expect(state.contact).toBeUndefined(); expect(state.fem).toBeUndefined()
  })

  it.each(['initialK', 'waterKg', 'flowKgS', 'inletK', 'contactStartS', 'conductanceWK', 'dryIceKg', 'endS'] as const)('rejects nonfinite %s before computation', key => {
    const panel = config(); panel.thermal[key] = NaN
    expect(() => createRun(panel)).toThrow(`Unsupported ${key}`)
  })

  it('rejects out-of-schema, malformed and physically reversed hot-contact inputs', () => {
    const panel = config(); panel.thermal.waterKg = -1
    expect(() => createRun(panel)).toThrow('Unsupported waterKg')
    panel.thermal.waterKg = .5; panel.thermal.initialK = 300; panel.thermal.inletK = 350
    expect(() => createRun(panel)).toThrow('hot-contact proxy')
    panel.thermal.inletK = 300; panel.thermal.seed = .5
    expect(() => createRun(panel)).toThrow('integer seed')
    panel.thermal.seed = 21; panel.id = ' '
    expect(() => createRun(panel)).toThrow('panel identity')
    panel.id = 'a'; (panel.thermal as unknown as { enabled: string }).enabled = 'false'
    expect(() => createRun(panel)).toThrow('boolean intervention')
  })

  it('passes independently owned serializable configuration to the approved hook', () => {
    const panel = config(); let forwarded: PanelConfig | undefined
    methodModule.createRun(panel, { supportedRun: received => {
      forwarded = received
      return { endS: received.thermal.endS, snapshot: () => ({ timeS: 0, metrics: null }), advanceTo: timeS => ({ timeS, metrics: null }) }
    } })
    expect(forwarded).toEqual(panel); expect(forwarded).not.toBe(panel)
    forwarded!.thermal.waterKg = 0; forwarded!.fem.n = 2
    expect(panel.thermal.waterKg).toBe(.5); expect(panel.fem.n).not.toBe(2)
  })
})

describe('4.2.1 accepted runs and source ledgers', () => {
  it('keeps two simultaneous runs and duplicated settings independent', () => {
    const p = config(), q = duplicatePanel(p, 'second')
    q.thermal.waterKg = .1; q.thermal.contactStartS = 0
    const a = createRun(p), b = createRun(q)
    const aAtTen = a.advanceTo(10)
    expect(b.snapshot().timeS).toBe(0)
    b.advanceTo(60)
    expect(a.snapshot()).toEqual(aAtTen)
    expect(a.advanceTo(60).metrics!.waterUsedKg).toBeCloseTo(.5, 12)
    expect(b.snapshot().metrics!.waterUsedKg).toBeCloseTo(.1, 12)
    expect(p.thermal.waterKg).toBe(.5)
  })

  it('owns every returned snapshot, including nested ledgers and metrics', () => {
    const run = createRun(config()), state = run.advanceTo(20), expected = run.snapshot()
    state.contact!.patches[0].temperatureK = 9999
    state.contact!.ledger.waterRemainingSupplyKg = 9999
    state.metrics!.energyJ = 9999
    expect(run.snapshot()).toEqual(expected)
  })

  it.each(['water', 'co2-water'] as const)('intervention off removes every %s source and matches an isolated baseline', medium => {
    const panel = config(); panel.medium = medium; panel.thermal.enabled = false
    const state = finalState(panel), untreated = finalState(freshPanel('baseline', 'baseline'))
    expect(state.metrics).toEqual(untreated.metrics)
    expect(state.contact!.ledger).toEqual(untreated.contact!.ledger)
    expect(state.contact!.patches.every(p => p.waterReceivedKg === 0 && p.heatToDryIceJ === 0 && p.heatToWaterJ === 0)).toBe(true)
  })

  it('closes water, CO₂ and energy ledgers with finite small inventories', () => {
    const panel = config(); panel.medium = 'co2-water'
    Object.assign(panel.thermal, { waterKg: .03, dryIceKg: .001, flowKgS: .2, conductanceWK: 100, endS: 120 })
    const state = finalState(panel), ledger = state.contact!.ledger
    expect(ledger.waterSuppliedKg).toBeCloseTo(.03, 12)
    expect(ledger.waterRemainingSupplyKg).toBeCloseTo(0, 12)
    expect(ledger.dryIceSublimatedKg).toBeCloseTo(.001, 12)
    expect(ledger.dryIceRemainingKg).toBeCloseTo(0, 12)
    expect(Math.abs(ledger.waterMassResidualKg)).toBeLessThan(1e-12)
    expect(Math.abs(ledger.dryIceMassResidualKg)).toBeLessThan(1e-12)
    expect(Math.abs(ledger.energyResidualJ)).toBeLessThan(1e-7)
    expect(state.contact!.patches.every(p => p.temperatureK >= panel.thermal.inletK - 1e-9)).toBe(true)
    expect(state.metrics!.oxygenKg).toBeNull(); expect(state.metrics!.fuelKg).toBeNull(); expect(state.metrics!.reactionW).toBeNull()
  })

  it('does not treat direct solid contact as predicted water pre-cooling', () => {
    const panel = config(); panel.medium = 'co2-water'
    const state = createRun(panel).advanceTo(1)
    expect(state.metrics!.dryIceUsedKg).toBeGreaterThan(0)
    expect(state.metrics!.waterUsedKg).toBe(0)
    expect(state.contact!.patches[0].temperatureK).toBeLessThan(panel.thermal.initialK)
    expect(state.contact!.patches[1].temperatureK).toBe(panel.thermal.initialK)
    expect(state.contact!.patches.every(p => p.waterTemperatureK === panel.thermal.inletK)).toBe(true)
  })

  it('recovers zero-inventory, zero-delivery, zero-conductance and delayed-arrival limits', () => {
    for (const setting of [{ waterKg: 0 }, { flowKgS: 0 }, { conductanceWK: 0 }, { contactStartS: 50, endS: 10 }]) {
      const panel = config(); Object.assign(panel.thermal, setting)
      const state = finalState(panel)
      expect(state.metrics!.energyJ).toBe(0)
      expect(state.metrics!.maximumK).toBe(panel.thermal.initialK)
    }
    const noSolid = config(); noSolid.medium = 'co2-water'; noSolid.thermal.dryIceKg = 0
    expect(finalState(noSolid).metrics).toEqual(finalState().metrics)
  })

  it('recovers zero sensible driving temperature and equal water mass shares', () => {
    const panel = config(); panel.thermal.initialK = 300; panel.thermal.inletK = 300
    const state = finalState(panel)
    expect(state.metrics!.energyJ).toBe(0)
    expect(state.contact!.patches.every(p => Math.abs(p.waterReceivedKg - panel.thermal.waterKg / 3) < 1e-12)).toBe(true)
  })

  it('reproduces accepted state regardless of output partition or presentation sampling', () => {
    const a = createRun(config()), b = createRun(config())
    for (const t of [.037, .5, 8, 12.345, 20, 45, 60]) { sublimationPresentation(t * 1.5); a.advanceTo(t) }
    expect(a.snapshot()).toEqual(b.advanceTo(60))
    expect(() => a.advanceTo(59)).toThrow(); expect(() => a.advanceTo(61)).toThrow()
    expect(() => a.advanceTo(Infinity)).toThrow()
  })

  it('gives authored phase cues no numerical pressure, vibration or suppression effect', () => {
    for (const time of [0, 22.5, 45, 67.4, 67.5, 90, NaN, Infinity]) {
      const pose = sublimationPresentation(time)
      expect(pose.pulse).toBe(false); expect(pose.waves).toBe(false); expect(pose.vibration).toBe(0)
      expect(Number.isFinite(pose.contextTime)).toBe(true)
    }
    expect(sublimationPresentation(55.9).injection).toBe(false)
    expect(sublimationPresentation(56).injection).toBe(true)
    const run = createRun(config()), before = run.snapshot()
    for (let t = 0; t <= 90; t += .1) sublimationPresentation(t)
    expect(run.snapshot()).toEqual(before)
  })
})

describe('4.2.1 preliminary cost allocation', () => {
  it('distinguishes allocated consumed water from one-jug purchase', () => {
    expect(allocatedWaterCostUSD(.5)).toBeCloseTo(.1902, 4)
    expect(allocatedWaterCostUSD(0)).toBe(0)
    for (const bad of [-1, NaN, Infinity]) expect(() => allocatedWaterCostUSD(bad)).toThrow()
  })
})
