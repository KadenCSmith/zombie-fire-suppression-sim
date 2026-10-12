import { describe, expect, it } from 'vitest'
import { createRun, duplicatePanel, freshPanel, linkedCompatibility } from '../src/alternatives/model'
import { readComparison, serializeComparison } from '../src/alternatives/persistence'
import { currentRecord } from '../src/alternatives/records'

describe('particle integration ownership and restore', () => {
  it('restores configuration with independent nested settings and no accepted state', () => {
    const original = freshPanel('particle', 'nanoparticles')
    original.particleInjection!.particleDiameterM = 150e-6
    original.particleInjection!.sizeProvenance = 'Configured sensitivity, unmeasured'
    const restored = readComparison(serializeComparison([original]))[0]
    expect(restored).toEqual(original)
    const copy = duplicatePanel(restored, 'copy')
    copy.particleInjection!.particleDiameterM = 200e-6
    copy.thermal.initialK = 340
    expect(restored.particleInjection!.particleDiameterM).toBe(150e-6)
    expect(restored.thermal.initialK).toBe(333.15)
    expect(createRun(copy).snapshot().timeS).toBe(0)
    expect(createRun(restored).snapshot().timeS).toBe(0)
  })
  it('links only matching transport/specimen conditions while allowing disclosed resources', () => {
    const a = freshPanel('a', 'nanoparticles'), b = duplicatePanel(a, 'b')
    b.medium = 'water'; b.thermal.dryIceKg = 0
    expect(linkedCompatibility([a, b])).toBeNull()
    b.particleInjection!.hoseResidenceS += .1
    expect(linkedCompatibility([a, b])).toContain('transport')
    b.particleInjection!.hoseResidenceS = a.particleInjection!.hoseResidenceS
    b.thermal.waterKg += .1
    expect(linkedCompatibility([a, b])).toContain('water quantity')
    expect(linkedCompatibility([a, freshPanel('contact', 'baseline')])).toContain('same engine')
  })
  it('owns nested accepted inventories and exports only the configuration that produced them', () => {
    const config = freshPanel('particle', 'nanoparticles'), run = createRun(config)
    run.advanceTo(2)
    const accepted = run.snapshot(), exposed = run.snapshot()
    exposed.particleInjection!.locations.source.waterKg = 999
    exposed.particleInjection!.assumptions.push('mutated by consumer')
    expect(run.snapshot()).toEqual(accepted)
    const record = { configurationKey: JSON.stringify(config) + ':1', state: accepted }
    expect(currentRecord(config, record)).toBe(record)
    const edited = duplicatePanel(config, config.id)
    edited.particleInjection!.particleDiameterM = 200e-6
    expect(currentRecord(edited, record)).toBeNull()
  })
  it('preserves invalid saved numerical inputs for a fail-closed diagnostic', () => {
    const config = freshPanel('particle', 'nanoparticles')
    config.particleInjection!.stepS = -1
    const restored = readComparison(serializeComparison([config]))[0]
    expect(restored.particleInjection!.stepS).toBe(-1)
    expect(() => createRun(restored)).toThrow()
  })
})
