import { describe, expect, it } from 'vitest'
import { runFireProtocol } from '../src/coupled/fireProtocolRunner'

const short = { durationS: 2, ignitionDurationS: 1, ignitionPowerW: 100, captureEveryS: 1 }
describe('shared fire experiment driver', () => {
  it('returns a wet cold-start history and an explicitly ordered finite-source insertion', async () => {
    const progress: number[] = []
    const cache = await runFireProtocol(short, { treatmentDurationS: 0.25, applicationVersion: 'test', onProgress: p => progress.push(p.timeS) })
    expect(cache.status).toBe('completed')
    expect(cache.initialization.preparedWaterRemovedKg).toBe(0)
    expect(cache.provenance).toEqual({ mode: 'live-worker', applicationVersion: 'test' })
    expect(cache.sourceHashes).toBeUndefined()
    expect(cache.treatmentStartS).toBe(2)
    const event = cache.frames.findIndex(frame => frame.event === 'dry-ice-insertion')
    expect(event).toBeGreaterThan(0)
    expect(cache.frames[event - 1].timeS).toBe(2)
    expect(cache.frames[event - 1].dryIceKg).toBe(0)
    expect(cache.frames[event].timeS).toBe(2)
    expect(cache.frames[event].phase).toBe('treatment')
    expect(cache.frames[event].dryIceKg).toBe(4)
    expect(cache.frames.at(-1)!.timeS).toBe(2.25)
    expect(cache.frames.at(-1)!.dryIceKg).toBeLessThan(4)
    expect(cache.frames.at(-1)!.ledger.heaterJ).toBeCloseTo(100, 8)
    for (const frame of cache.frames) {
      expect(Math.abs(frame.ledger.massResidualKg)).toBeLessThan(1e-7)
      expect(Math.abs(frame.ledger.energyResidualJ)).toBeLessThan(1e-4)
    }
    expect(progress.at(-1)).toBe(2.25)
  })

  it('retains only accepted initial data when its computation budget ends', async () => {
    const cache = await runFireProtocol(short, { wallLimitS: 1e-12 })
    expect(cache.status).toBe('time-budget-stopped')
    expect(cache.frames).toHaveLength(1)
    expect(cache.frames[0].timeS).toBe(0)
    expect(cache.frames[0].ledger.steps).toBe(0)
    expect(cache.treatmentStartS).toBeNull()
    expect(cache.frames[0].dryIceKg).toBe(0)
  })

  it('can calculate an ignition-only experiment without inventing a treatment event', async () => {
    const cache = await runFireProtocol(short, { treatmentDurationS: 0 })
    expect(cache.status).toBe('completed')
    expect(cache.frames.map(frame => frame.timeS)).toEqual([0, 1, 2])
    expect(cache.treatmentStartS).toBeNull()
    expect(cache.frames.every(frame => frame.dryIceKg === 0)).toBe(true)
    expect(cache.propagationResolved).toBe(false)
  })
})
