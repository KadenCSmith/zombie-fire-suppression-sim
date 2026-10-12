import { describe, expect, it } from 'vitest'
import { VARIANTS, compatible } from '../src/alternatives/registry'
import { acceptsMessage, createRun, duplicatePanel, freshPanel, linkedCompatibility } from '../src/alternatives/model'
import { readComparison, serializeComparison } from '../src/alternatives/persistence'
import { PeatSolver } from '../src/peatfem/coupled'
describe('Version21 alternatives contract', () => {
  it('retains four methods, nested draft labels and unspecified definition', () => {
    expect(new Set(VARIANTS.filter(v => v.id !== 'baseline').map(v => v.method)).size).toBe(4)
    expect(VARIANTS.filter(v => v.method === '4.2.3')).toHaveLength(3)
    expect(VARIANTS.filter(v => v.draft)).toHaveLength(2)
    expect(compatible('nanoparticles', 'concept', 'unspecified')).toContain('reviewed particle model')
    expect(VARIANTS.every(v => !v.status.experimentallyValidated)).toBe(true)
  })
  it('rejects unsupported physical coupling and unspecified thermodynamics', () => {
    expect(compatible('sublimation-injection', 'peat-fem', 'water')).toContain('no supported')
    expect(compatible('pressure-only', 'contact', 'none')).toContain('no supported')
    expect(compatible('sublimation-injection', 'contact', 'unspecified')).toContain('no thermodynamic')
    expect(compatible('sublimation-injection', 'concept', 'unspecified')).toBeNull()
  })
  it('keeps the original render out of unsupported new live comparison', () => {
    const p=freshPanel('original','pressure-pulse')
    expect(compatible(p.variantId,p.engine,p.medium)).toContain('Protected original render')
    expect(()=>createRun(p)).toThrow('Protected original render')
  })
  it('rejects historical liquid vibration configurations after persistence restore', () => {
    // Old saved panels may still select liquid and a physical engine. They must
    // not revive the removed liquid model or invent a vibration prediction.
    for (const engine of ['contact', 'peat-fem', 'concept'] as const) {
      for (const medium of ['water', 'co2-water', 'none'] as const) {
        const old = freshPanel('historical-vibration', 'vibratory-injection')
        old.engine = engine; old.medium = medium
        old.thermal.enabled = true; old.thermal.waterKg = 1
        const restored = readComparison(serializeComparison([old]))[0]
        expect(restored.variantId).toBe('vibratory-injection')
        expect(compatible(restored.variantId, restored.engine, restored.medium)).toMatch(/unavailable/i)
        expect(() => createRun(restored)).toThrow(/unavailable/i)
        expect(linkedCompatibility([freshPanel('reference', 'baseline'), restored])).toContain('incompatible')
      }
    }
  })
  it('runs two independent computations and copies only configuration', () => {
    const p = freshPanel('a', 'sublimation-injection'), q = duplicatePanel(p, 'b')
    q.thermal.waterKg = .1
    expect(p.thermal.waterKg).toBe(.5)
    const a = createRun(p), b = createRun(q)
    a.advanceTo(10)
    expect(b.snapshot().timeS).toBe(0)
    b.advanceTo(20)
    expect(a.snapshot().timeS).toBe(10)
    const snapshot = a.snapshot(); snapshot.contact!.patches[0].temperatureK = 9999
    expect(a.snapshot().contact!.patches[0].temperatureK).not.toBe(9999)
  })
  it('rejects stale and cross-panel worker results', () => {
    expect(acceptsMessage('a', '2', { panelId: 'a', runId: '1' })).toBe(false)
    expect(acceptsMessage('a', '2', { panelId: 'b', runId: '2' })).toBe(false)
    expect(acceptsMessage('a', '2', { panelId: 'a', runId: '2' })).toBe(true)
  })
  it('has deterministic no-intervention identity and finite resource balances', () => {
    const p = freshPanel('a', 'sublimation-injection'); p.thermal.enabled = false
    const off = createRun(p), baseline = createRun(freshPanel('b', 'baseline'))
    off.advanceTo(60); baseline.advanceTo(60)
    expect(off.snapshot().metrics).toEqual(baseline.snapshot().metrics)
    const active = createRun(freshPanel('c', 'sublimation-injection')); active.advanceTo(60)
    const m = active.snapshot().metrics!
    expect(m.waterUsedKg).toBeLessThanOrEqual(.5 + 1e-12)
    expect(Math.abs(m.energyResidualJ)).toBeLessThan(1e-7)
    expect(Math.abs(m.massResidualKg)).toBeLessThan(1e-12)
    expect(m.oxygenKg).toBeNull(); expect(m.reactionW).toBeNull()
  })
  it('recovers reproducible checkpoint partitioning at fixed solver steps', () => {
    const p = freshPanel('a', 'liquid-waves'), a = createRun(p), b = createRun(p)
    for (let t = .5; t <= 20; t += .5) a.advanceTo(t)
    b.advanceTo(20)
    expect(a.snapshot().contact).toEqual(b.snapshot().contact)
  })
  it('preserves zero-transfer limits and finite CO2 contact inventory', () => {
    const zero = freshPanel('zero', 'sublimation-injection')
    zero.thermal.conductanceWK = 0
    const isolated = createRun(zero); isolated.advanceTo(60)
    expect(isolated.snapshot().metrics!.maximumK).toBe(zero.thermal.initialK)
    expect(isolated.snapshot().metrics!.energyJ).toBe(0)
    const dry = freshPanel('dry', 'sublimation-injection'); dry.medium = 'co2-water'
    const active = createRun(dry); active.advanceTo(60)
    const metrics = active.snapshot().metrics!
    expect(metrics.dryIceUsedKg).toBeGreaterThan(0)
    expect(metrics.dryIceUsedKg).toBeLessThanOrEqual(dry.thermal.dryIceKg + 1e-12)
    expect(Math.abs(metrics.energyResidualJ)).toBeLessThan(1e-7)
    expect(Math.abs(metrics.massResidualKg)).toBeLessThan(1e-12)
    dry.thermal.enabled = false
    const off = createRun(dry); off.advanceTo(60)
    expect(off.snapshot().metrics!.dryIceUsedKg).toBe(0)
    expect(off.snapshot().metrics!.energyJ).toBe(0)
  })
  it('leaves the untreated FEM trajectory identical to its existing solver', () => {
    const panel = freshPanel('fem', 'baseline'); panel.engine = 'peat-fem'
    panel.fem.n = 2
    const adapted = createRun(panel), reference = new PeatSolver(panel.fem)
    reference.advance(.5); adapted.advanceTo(.5)
    expect(adapted.snapshot().fem).toEqual(reference.snapshot())
  })
  it('never assigns physical outcome curves to pressure-only concepts', () => {
    const run = createRun(freshPanel('a', 'pressure-only')); run.advanceTo(30)
    expect(run.snapshot().metrics).toBeNull(); expect(run.snapshot().contact).toBeUndefined()
  })
  it('owns nested FEM diagnostic snapshots as well as field arrays', () => {
    const p=freshPanel('fem','baseline');p.engine='peat-fem';p.fem.n=2
    const run=createRun(p);run.advanceTo(.5)
    const expected=run.snapshot(), exposed=run.snapshot()
    exposed.fem!.heatSolve.relativeResidual=9999
    exposed.fem!.oxygenSolve.relativeResidual=9999
    exposed.fem!.pressureSolve.relativeResidual=9999
    expect(run.snapshot()).toEqual(expected)
  })
  it('repairs duplicate IDs even when saved IDs collide with migration fallbacks', () => {
    const panels=['migrated-1','migrated-1','migrated-3','migrated-3'].map(id=>freshPanel(id,'baseline'))
    const restored=readComparison(serializeComparison(panels))
    expect(new Set(restored.map(p=>p.id)).size).toBe(4)
    expect(restored[0].id).toBe('migrated-1')
    expect(restored[2].id).toBe('migrated-3')
  })
  it('links accepted physical time only for compatible models/windows', () => {
    const a = freshPanel('a', 'baseline'), b = freshPanel('b', 'sublimation-injection')
    expect(linkedCompatibility([a,b])).toBeNull()
    const ar = createRun(a), br = createRun(b); ar.advanceTo(1); br.advanceTo(1)
    expect(ar.snapshot().timeS).toBe(br.snapshot().timeS)
    b.engine = 'concept'; expect(linkedCompatibility([a,b])).toContain('presentation')
    b.engine = 'contact'; b.thermal.endS = 20; expect(linkedCompatibility([a,b])).toContain('windows')
  })
  it('migrates settings safely without touching legacy gallery selections', () => {
    const p = freshPanel('a', 'liquid-waves'); p.thermal.waterKg = .2
    expect(readComparison(serializeComparison([p]))[0]).toEqual(p)
    expect(readComparison(JSON.stringify({schema:1,panels:[{variantId:'pressure-only'}]}))[0].variantId).toBe('pressure-only')
    expect(readComparison('{bad')).toHaveLength(2)
    expect(readComparison('{"schema":99,"panels":[]}')).toHaveLength(2)
    expect(readComparison(JSON.stringify({schema:2,panels:[{variantId:'baseline',thermal:{initialK:NaN}}]}))[0].thermal.initialK).toBe(823.15)
  })
  it('requires matched initial/boundary conditions and seeds for linked contact time', () => {
    const a=freshPanel('a','baseline'),b=freshPanel('b','sublimation-injection')
    b.thermal.initialK+=1;expect(linkedCompatibility([a,b])).toContain('temperatures')
    b.thermal.initialK=a.thermal.initialK;b.thermal.inletK+=1;expect(linkedCompatibility([a,b])).toContain('temperatures')
    b.thermal.inletK=a.thermal.inletK;b.thermal.seed+=1;expect(linkedCompatibility([a,b])).toContain('seeds')
    b.thermal.seed=a.thermal.seed;b.thermal.waterKg=.1
    expect(linkedCompatibility([a,b])).toBeNull()
  })
  it('requires matched FEM geometry and physical/numerical settings for linking', () => {
    const a=freshPanel('a','baseline'),b=freshPanel('b','baseline');a.engine=b.engine='peat-fem'
    expect(linkedCompatibility([a,b])).toBeNull()
    b.fem.lengthM*=2;expect(linkedCompatibility([a,b])).toContain('FEM geometry')
    b.fem=structuredClone(a.fem);b.fem.oxygenMassFraction=.2;expect(linkedCompatibility([a,b])).toContain('initial/boundary')
    b.fem=structuredClone(a.fem);b.fem.maxStepS=.5;expect(linkedCompatibility([a,b])).toContain('numerical settings')
  })
  it('restores validated FEM settings and rejects malformed physical data', () => {
    const p = freshPanel('same', 'baseline'); p.engine = 'peat-fem'; p.fem.n = 8; p.fem.endS = 20
    expect(readComparison(serializeComparison([p]))[0]).toEqual(p)
    const malformed = { ...p, fem: {...p.fem, maxStepS: -1}, thermal: {...p.thermal, enabled: 'false'} }
    const restored = readComparison(JSON.stringify({schema:2,panels:[malformed,p]}))
    expect(restored[0].fem.maxStepS).toBe(freshPanel('a','baseline').fem.maxStepS)
    expect(restored[0].thermal.enabled).toBe(true)
    expect(restored[0].id).not.toBe(restored[1].id)
  })
})
