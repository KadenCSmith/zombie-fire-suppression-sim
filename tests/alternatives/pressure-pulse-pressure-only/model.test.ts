import { describe, expect, it, vi } from 'vitest'
import { createRun, duplicatePanel, freshPanel, type PanelConfig } from '../../../src/alternatives/model'
import { methodModule, variants } from '../../../src/alternatives/pressure-pulse-pressure-only'
import { createPressureOnlyRun, pressureCueEnvelope, pressureOnlyPresentation } from '../../../src/alternatives/pressure-pulse-pressure-only/model'
const configured = (id = 'a') => freshPanel(id, 'pressure-only')
describe('4.2.3.2 pressure-only child', () => {
  it('exports its child identity, source-free conceptual capabilities and frozen interface', () => {
    expect(methodModule.apiVersion).toBe('v21.2')
    expect(variants.map(v => [v.id, v.number, v.method])).toEqual([['pressure-only', '4.2.3.2', '4.2.3']])
    expect(variants[0].engines).toEqual(['concept']); expect(variants[0].media).toEqual(['none', 'unspecified'])
    expect(variants[0].status.experimentallyValidated).toBe(false)
  })
  it('rejects liquid/solid, physical engines and foreign identity before invoking a hook', () => {
    const supportedRun = vi.fn()
    expect(() => createPressureOnlyRun({ ...configured(), variantId: 'liquid-waves' }, { supportedRun })).toThrow('identity')
    for (const engine of ['contact', 'peat-fem'] as const) expect(() => createPressureOnlyRun({ ...configured(), engine }, { supportedRun })).toThrow('N/A')
    for (const medium of ['water', 'co2-water'] as const) expect(() => createPressureOnlyRun({ ...configured(), medium }, { supportedRun })).toThrow('never injects')
    expect(supportedRun).not.toHaveBeenCalled()
  })
  it('forwards zero sources even with stale water settings through an independent config', () => {
    const config = configured(), before = structuredClone(config)
    const supportedRun = vi.fn((_config: PanelConfig) => ({ endS: 60, snapshot: () => ({ timeS: 0, metrics: null }), advanceTo: (timeS: number) => ({ timeS, metrics: null }) }))
    createPressureOnlyRun(config, { supportedRun })
    const forwarded = supportedRun.mock.calls[0][0]
    expect(forwarded.thermal).toMatchObject({ enabled: false, waterKg: 0, flowKgS: 0, dryIceKg: 0, conductanceWK: 0 })
    forwarded.thermal.initialK = 0; expect(config).toEqual(before)
  })
  it('has no physical metrics, water ledger, field state or suppression curves', () => {
    const run = createRun(configured())
    for (const t of [0, 12, 48, 51, 54, 60]) expect(run.advanceTo(t)).toEqual({ timeS: t, metrics: null })
  })
  it('is identical with intervention off and owns state/snapshots independently', () => {
    const config = configured(), copy = duplicatePanel(config, 'b'); copy.thermal.enabled = false
    const a = createRun(config), b = createRun(copy)
    expect(a.advanceTo(30)).toEqual(b.advanceTo(30))
    const state = a.snapshot(); state.timeS = 900; b.advanceTo(60)
    expect(a.snapshot().timeS).toBe(30); expect(b.snapshot().timeS).toBe(60)
    expect(() => a.advanceTo(29)).toThrow(); expect(() => a.advanceTo(Infinity)).toThrow(); expect(() => a.advanceTo(61)).toThrow()
  })
  it('accepts unspecified environmental source without inventing thermodynamics', () => {
    const config = configured(); config.medium = 'unspecified'
    expect(createRun(config).advanceTo(60)).toEqual({ timeS: 60, metrics: null })
  })
  it('never displays injection, waves, collapse displacement or liquid contact', () => {
    for (let time = 0; time <= 90; time += .5) expect(pressureOnlyPresentation('pressure-only', time)).toMatchObject({ waves: false, injection: false, contacts: 0, vibration: 0 })
    expect(pressureOnlyPresentation('pressure-only', 37).pulse).toBe(false)
    expect(pressureOnlyPresentation('pressure-only', 38).pulse).toBe(true)
    expect(pressureOnlyPresentation('pressure-only', 66).pulse).toBe(false)
    expect(pressureCueEnvelope(48)).toBe(0); expect(pressureCueEnvelope(51)).toBeCloseTo(1); expect(pressureCueEnvelope(54)).toBeCloseTo(0)
    expect(pressureOnlyPresentation('pressure-only', NaN).pulse).toBe(false)
  })
})
