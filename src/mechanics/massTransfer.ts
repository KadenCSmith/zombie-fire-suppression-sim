import type { MechanicsMassGrid } from '../sim/types'

/** Integrate piecewise-constant FV mass over each mechanics brick by exact box overlap.
 * This preserves total solid + liquid mass even when mesh boundaries do not align.
 * It transfers inventories, not stresses or displacement back to the flow solver.
 */
export function transferMass(grid: MechanicsMassGrid, n: number) {
  const dimensions = [grid.nx, grid.ny, grid.nz]
  if (!Number.isInteger(n) || n < 1 || n > 64 || dimensions.some(v => !Number.isInteger(v) || v < 1)
    || [grid.widthM, grid.lengthM, grid.depthM].some(v => !Number.isFinite(v) || v <= 0)
    || grid.massKg.length !== grid.nx * grid.ny * grid.nz
    || grid.massKg.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid mass-transfer grid.')
  const overlap = (cells: number) => Array.from({ length: n }, (_, target) => {
    const lo = target * cells / n, hi = (target + 1) * cells / n
    const parts: { source: number; fraction: number }[] = []
    for (let source = Math.floor(lo); source < Math.min(cells, Math.ceil(hi)); source++) {
      const fraction = Math.max(0, Math.min(hi, source + 1) - Math.max(lo, source))
      if (fraction > 0) parts.push({ source, fraction })
    }
    return parts
  })
  const xs = overlap(grid.nx), ys = overlap(grid.ny), zs = overlap(grid.nz)
  const mass = new Float64Array(n ** 3)
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let sum = 0
    for (const z of zs[k]) for (const y of ys[j]) for (const x of xs[i]) {
      sum += grid.massKg[(z.source * grid.ny + y.source) * grid.nx + x.source]
        * x.fraction * y.fraction * z.fraction
    }
    mass[(k * n + j) * n + i] = sum
  }
  const sourceMassKg = grid.massKg.reduce((sum, value) => sum + value, 0)
  return { mass, sourceMassKg, residualKg: mass.reduce((sum, value) => sum + value, 0) - sourceMassKg }
}
