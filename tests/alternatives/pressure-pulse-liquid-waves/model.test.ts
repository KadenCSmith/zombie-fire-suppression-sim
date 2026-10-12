import { describe, expect, it, vi } from 'vitest'
import { createRun, duplicatePanel, freshPanel, type PanelConfig } from '../../../src/alternatives/model'
import { methodModule, variants } from '../../../src/alternatives/pressure-pulse-liquid-waves'
import { createLiquidWavesRun, liquidWavesPresentation } from '../../../src/alternatives/pressure-pulse-liquid-waves/model'
const configured = (id = 'a') => freshPanel(id, 'liquid-waves')
describe('4.2.3.1 liquid-waves child', () => {
  it('exports its child identity and the frozen interface without claiming validation', () => {
    expect(methodModule.apiVersion).toBe('v21.2')
    expect(variants.map(v => [v.id, v.number, v.method])).toEqual([['liquid-waves', '4.2.3.1', '4.2.3']])
    expect(variants[0].engines).toEqual(['contact', 'concept'])
    expect(variants[0].status.experimentallyValidated).toBe(false)
    expect(methodModule.defaultSettings('liquid-waves')).toEqual({ contactStartS: 12 })
  })
  it('rejects foreign identity, coupled engines and unsupported materials before invoking a hook', () => {
    const supportedRun = vi.fn()
    expect(() => createLiquidWavesRun({ ...configured(), variantId: 'pressure-pulse' }, { supportedRun })).toThrow('identity')
    expect(() => createLiquidWavesRun({ ...configured(), engine: 'peat-fem' }, { supportedRun })).toThrow('coupled')
    expect(() => createLiquidWavesRun({ ...configured(), medium: 'co2-water' }, { supportedRun })).toThrow('ordinary water')
    expect(() => createLiquidWavesRun({ ...configured(), medium: 'unspecified' }, { supportedRun })).toThrow('thermodynamic')
    expect(supportedRun).not.toHaveBeenCalled()
  })
  it('owns forwarded settings and removes unused solid inventory without mutating callers', () => {
    const config = configured(), before = structuredClone(config)
    const supportedRun = vi.fn((_config: PanelConfig) => ({ endS: 60, snapshot: () => ({ timeS: 0, metrics: null }), advanceTo: (timeS: number) => ({ timeS, metrics: null }) }))
    createLiquidWavesRun(config, { supportedRun })
    const forwarded = supportedRun.mock.calls[0][0]
    expect(forwarded.thermal.dryIceKg).toBe(0)
    forwarded.thermal.waterKg = 0
    expect(config).toEqual(before)
  })
  it('has no liquid before arrival and conserves finite water and enthalpy afterward', () => {
    const config = configured(), run = createRun(config)
    const before = run.advanceTo(config.thermal.contactStartS)
    expect(before.metrics!.waterUsedKg).toBe(0); expect(before.metrics!.energyJ).toBe(0)
    const state = run.advanceTo(config.thermal.endS), m = state.metrics!, l = state.contact!.ledger
    expect(m.waterUsedKg).toBeGreaterThan(0)
    expect(m.waterUsedKg).toBeLessThanOrEqual(config.thermal.waterKg + 1e-12)
    expect(m.dryIceUsedKg).toBe(0); expect(l.dryIceInitialKg).toBe(0)
    expect(Math.abs(l.waterMassResidualKg)).toBeLessThan(1e-12)
    expect(Math.abs(l.energyResidualJ)).toBeLessThan(1e-7)
    expect(l.waterInitialKg).toBeCloseTo(l.waterRemainingSupplyKg + l.waterBypassKg + l.waterLiquidKg + l.waterVaporKg, 12)
    expect(l.initialPeatEnergyJ).toBeCloseTo(l.peatEnergyJ + l.waterStoredSensibleJ + l.vaporEnthalpyJ, 7)
    expect(m.oxygenKg).toBeNull(); expect(m.fuelKg).toBeNull(); expect(m.reactionW).toBeNull()
    for (const p of state.contact!.patches) {
      expect(p.temperatureK).toBeGreaterThanOrEqual(config.thermal.inletK)
      expect(p.temperatureK).toBeLessThanOrEqual(config.thermal.initialK)
      expect(p.waterTemperatureK).toBeLessThanOrEqual(373.15 + 1e-9)
    }
  })
  it('matches the untreated reference exactly with intervention off', () => {
    const config = configured(); config.thermal.enabled = false
    const base = freshPanel('base', 'baseline'); base.thermal.contactStartS = config.thermal.contactStartS
    expect(createRun(config).advanceTo(60)).toEqual(createRun(base).advanceTo(60))
  })
  it.each(['inventory', 'flow', 'conductance'] as const)('keeps zero %s heat transfer bounded', key => {
    const config = configured()
    if (key === 'inventory') config.thermal.waterKg = 0
    if (key === 'flow') config.thermal.flowKgS = 0
    if (key === 'conductance') config.thermal.conductanceWK = 0
    const state = createRun(config).advanceTo(60)
    expect(state.metrics!.energyJ).toBe(0); expect(state.metrics!.maximumK).toBe(config.thermal.initialK)
    expect(Math.abs(state.metrics!.massResidualKg)).toBeLessThan(1e-12)
  })
  it('owns independent state and caller-owned snapshots', () => {
    const config = configured(), copy = duplicatePanel(config, 'b'); copy.thermal.waterKg = .05
    const a = createRun(config), b = createRun(copy), first = a.advanceTo(20)
    expect(b.snapshot().timeS).toBe(0); b.advanceTo(60); expect(a.snapshot().timeS).toBe(20)
    first.contact!.patches[0].temperatureK = -99
    expect(a.snapshot().contact!.patches[0].temperatureK).toBeGreaterThan(0)
    expect(b.snapshot().metrics!.waterUsedKg).toBeLessThanOrEqual(.05 + 1e-12)
    expect(config.thermal.waterKg).toBe(.5)
  })
  it('is deterministic across checkpoints and unaffected by visual wave calls', () => {
    const a = createRun(configured()), b = createRun(configured('b'))
    for (let t = .5; t <= 20; t += .5) { liquidWavesPresentation('liquid-waves', t * 3); a.advanceTo(t) }
    expect(a.snapshot()).toEqual(b.advanceTo(20))
    expect(() => a.advanceTo(19)).toThrow(); expect(() => a.advanceTo(NaN)).toThrow(); expect(() => a.advanceTo(61)).toThrow()
  })
  it('separates authored stages and unavailable conceptual outcomes', () => {
    expect(liquidWavesPresentation('liquid-waves', 44).waves).toBe(true)
    expect(liquidWavesPresentation('liquid-waves', 55).injection).toBe(false)
    expect(liquidWavesPresentation('liquid-waves', 64)).toMatchObject({ waves: false, injection: true, contacts: 1 })
    expect(liquidWavesPresentation('liquid-waves', NaN).waves).toBe(false)
    const config = configured(); config.engine = 'concept'; config.medium = 'unspecified'
    expect(createRun(config).advanceTo(30)).toEqual({ timeS: 30, metrics: null })
  })
})
