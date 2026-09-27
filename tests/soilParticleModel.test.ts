import { describe, expect, it } from 'vitest'
import { BURIED_PEAT, SOIL_GRID, buildSoilReplay, sampleSoil, shellPlacement, soilDensity, soilFrame } from '../src/ui/soilParticleModel'

describe('bonded soil cross-section', () => {
  it('places a lower-density peat lens deeper underground and seats the falling cap', () => {
    expect(BURIED_PEAT.y).toBeLessThan(-1.5)
    expect(soilDensity(BURIED_PEAT.x, BURIED_PEAT.y)).toBeLessThan(soilDensity(-3, BURIED_PEAT.y))
    expect(soilDensity(-3, -3)).toBeGreaterThan(soilDensity(-3, -0.5))
    expect(shellPlacement(4)).toBe(0.65)
    expect(shellPlacement(5.2)).toBe(-2.04)
    expect(shellPlacement(20)).toBe(-2.04)
  })
  it('keeps the initially equilibrated soil unchanged without the imposed load', () => {
    const replay = buildSoilReplay({ pressurePa: 0, densityGradient: 220, peatDensity: 300 })
    expect(replay.frames.every(value => Math.abs(value) < 1e-6)).toBe(true)
    expect(replay.bonds.every(bond => !Number.isFinite(bond.breakTime))).toBe(true)
    expect(replay.cap.every(value => value === 0)).toBe(true)
  })
  it('rejects unsupported inputs and remains finite at the highest UI load', () => {
    expect(() => buildSoilReplay({ pressurePa: NaN, densityGradient: 220, peatDensity: 300 })).toThrow()
    const high = buildSoilReplay({ pressurePa: 30000, densityGradient: 220, peatDensity: 300 })
    expect(high.frames.every(Number.isFinite)).toBe(true)
    expect(high.frames.every(value => Math.abs(value) < 1)).toBe(true)
    expect(high.cap.every(value => Number.isFinite(value) && value < 0.3)).toBe(true)
    for (let n = 0; n < high.count; n++) {
      for (let frame = 1; frame < high.frameCount; frame++) expect(high.damage[frame * high.count + n]).toBeGreaterThanOrEqual(high.damage[(frame - 1) * high.count + n])
    }
  })
  it('produces finite irreversible bond damage, surface uplift and repeatable playback', () => {
    const replay = buildSoilReplay()
    expect(replay.frames.every(Number.isFinite)).toBe(true)
    const broken = replay.bonds.filter(bond => Number.isFinite(bond.breakTime))
    expect(broken.length).toBeGreaterThan(0)
    const peak = Math.max(...Array.from({ length: replay.frameCount }, (_, frame) => Math.max(...Array.from({ length: SOIL_GRID.nx }, (_, i) => replay.frames[(frame * replay.count + (SOIL_GRID.ny - 1) * SOIL_GRID.nx + i) * 2 + 1]))))
    expect(peak).toBeGreaterThan(0.002)
    expect(peak).toBeLessThan(0.3)
    expect(Math.max(...replay.cap)).toBeGreaterThan(0.01)
    expect(Math.max(...replay.cap)).toBeLessThan(0.3)
    const first = sampleSoil(replay, -1, -1, 10.5)
    sampleSoil(replay, -1, -1, 20)
    expect(sampleSoil(replay, -1, -1, 10.5)).toEqual(first)
    expect(sampleSoil(replay, -1, -1, 8.9)).toEqual([0, 0])
    expect(soilFrame(replay, 9).age).toBe(0)
    for (let n = 0; n < replay.count; n++) if (replay.fixed[n]) expect(sampleSoil(replay, replay.rest[n * 2], replay.rest[n * 2 + 1], 20).every(value => Math.abs(value) < 1e-6)).toBe(true)
    console.log('PARTICLE_CHECK', { particles: replay.active.filter(Boolean).length, broken: broken.length, bonds: replay.bonds.length, peakUpliftM: peak, peakCapM: Math.max(...replay.cap), maxMotionM: replay.frames.reduce((max, value, i) => i % 2 === 0 ? Math.max(max, value) : max, 0), endKineticJ: replay.energy.at(-1), damageX: [Math.min(...broken.map(b => replay.rest[b.a * 2])), Math.max(...broken.map(b => replay.rest[b.a * 2]))], damageY: [Math.min(...broken.map(b => replay.rest[b.a * 2 + 1])), Math.max(...broken.map(b => replay.rest[b.a * 2 + 1]))] })
  })
})
