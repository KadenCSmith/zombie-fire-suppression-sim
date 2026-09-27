import { expect, it } from 'vitest'
import { buildSoilReplay, SOIL_GRID, sampleSoil } from '../src/ui/soilParticleModel'
import { soilDisplayCells } from '../src/ui/WideSoilScene'
it('opens a broad weak-soil section under the assumed load while preserving fixed supports and replay', () => {
  const r = buildSoilReplay(undefined, true)
  const surface = Array.from({ length: r.frameCount }, (_, f) => Array.from({ length: SOIL_GRID.nx }, (_, i) => r.frames[(f * r.count + (SOIL_GRID.ny - 1) * SOIL_GRID.nx + i) * 2 + 1]))
  const peak = Math.max(...surface.flat()), raised = Math.max(...surface.map(a => a.filter(v => v > 0.025).length))
  expect(r.frames.every(Number.isFinite)).toBe(true)
  expect(peak).toBeGreaterThan(0.1); expect(peak).toBeLessThan(0.6)
  expect(raised).toBeGreaterThan(35)
  const pose = sampleSoil(r, 1, -0.2, 12); sampleSoil(r, 1, -0.2, 20)
  expect(sampleSoil(r, 1, -0.2, 12)).toEqual(pose)
  for (let n = 0; n < r.count; n++) if (r.fixed[n]) expect(Math.hypot(...sampleSoil(r, r.rest[n * 2], r.rest[n * 2 + 1], 12))).toBeLessThan(1e-6)
  console.log('WIDE', { peak, raised, broken: r.bonds.filter(b => Number.isFinite(b.breakTime)).length, maxMotion: r.frames.reduce((m,v)=>Math.max(m,Math.abs(v)),0) })
})
it('stays finite at the highest editable load and stationary at zero load', () => {
  const high = buildSoilReplay({ pressurePa: 30000, densityGradient: 220, peatDensity: 300 }, true)
  expect(high.frames.every(v => Number.isFinite(v) && Math.abs(v) < 2)).toBe(true)
  const zero = buildSoilReplay({ pressurePa: 0, densityGradient: 220, peatDensity: 300 }, true)
  expect(zero.frames.every(v => Math.abs(v) < 1e-6)).toBe(true)
  expect(zero.bonds.every(b => b.breakTime === Infinity)).toBe(true)
})
it('covers the cross-section with finite reproducible irregular display cells without overlaps or gaps in area', () => {
  const cells = soilDisplayCells()
  const areas = cells.map(({ polygon: p }) => p.reduce((a, v, i) => {const q=p[(i+1)%p.length];return a+(v[0]*q[1]-q[0]*v[1])/2},0))
  expect(cells.length).toBe(377)
  expect(areas.every(a => a > 0)).toBe(true)
  expect(areas.reduce((a,b)=>a+b,0)).toBeCloseTo(8*3.2,8)
  expect(soilDisplayCells()).toEqual(cells)
})
