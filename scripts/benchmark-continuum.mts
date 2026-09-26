/** Compare the preserved pre-optimization solver with the current implementation.
 * node --experimental-strip-types scripts/benchmark-continuum.mts [baseline.ts] [output.json]
 * Baseline copies belong in ignored work/, never in the distributed application.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { cpus, platform, release, arch } from 'node:os'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { serialize } from 'node:v8'
import { performance } from 'node:perf_hooks'
import type { ContinuumMechanics, ContinuumMaterial, ContinuumResult } from '../src/mechanics/continuum.ts'

type Constructor = typeof ContinuumMechanics
type Case = {
  name: string
  grid: [number, number, number]
  dimensionsM: [number, number, number]
  material: ContinuumMaterial
  bulkDensityKgM3: number
  tractionPa: number
  unloadAndRestart?: boolean
}
type Stage = { operation: string; result: ContinuumResult; checkpoint: ReturnType<ContinuumMechanics['checkpoint']> }
type Difference = { numericValuesCompared: number; unequalNumericValues: number; maxAbsoluteDifference: number; maxNormalizedDifference: number }
const freshDifference = (): Difference => ({ numericValuesCompared: 0, unequalNumericValues: 0, maxAbsoluteDifference: 0, maxNormalizedDifference: 0 })
const root = resolve(import.meta.dirname, '..')
const baselinePath = resolve(root, process.argv[2] ?? 'work/continuum-before.ts')
const currentPath = resolve(root, 'src/mechanics/continuum.ts')
const outputPath = resolve(root, process.argv[3] ?? 'examples/continuumOptimizationBenchmark.json')
const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')
const beforeBytes = await readFile(baselinePath).catch(() => {
  throw new Error(`Missing baseline ${baselinePath}. Extract src/mechanics/continuum.ts from commit 371a68af76a3c83f94173b0a4a36fddf464a481b into ignored work/continuum-before.ts before running.`)
})
const afterBytes = await readFile(currentPath)
const Before: Constructor = (await import(pathToFileURL(baselinePath).href)).ContinuumMechanics
const After: Constructor = (await import(pathToFileURL(currentPath).href)).ContinuumMechanics
const material: ContinuumMaterial = {
  youngsPa: 1_000_000, poisson: 0.3, cohesionPa: 8_000,
  frictionSlope: 0.35, dilationSlope: 0.05, hardeningPa: 20_000,
}
const cases: Case[] = [
  { name: 'uniform-4-cubed', grid: [4, 4, 4], dimensionsM: [6.096, 6.096, 3], material, bulkDensityKgM3: 1200, tractionPa: 1000 },
  { name: 'uniform-6-cubed', grid: [6, 6, 6], dimensionsM: [6.096, 6.096, 3], material, bulkDensityKgM3: 1200, tractionPa: 1000 },
  { name: 'non-cubic-distinct-material', grid: [2, 3, 2], dimensionsM: [1.4, 2.7, 0.8], material: { ...material, youngsPa: 2_500_000, poisson: 0.22, cohesionPa: 1e7 }, bulkDensityKgM3: 950, tractionPa: 1400 },
  { name: 'plastic-load-unload-restart', grid: [1, 1, 1], dimensionsM: [1, 1, 1], material, bulkDensityKgM3: 1200, tractionPa: 18_000, unloadAndRestart: true },
]

function compare(before: unknown, after: unknown, difference: Difference, path = 'result'): void {
  if (typeof before === 'number' && typeof after === 'number') {
    if (!Number.isFinite(before) || !Number.isFinite(after)) throw new Error(`Nonfinite value at ${path}`)
    difference.numericValuesCompared++
    if (!Object.is(before, after)) difference.unequalNumericValues++
    const delta = Math.abs(before - after)
    difference.maxAbsoluteDifference = Math.max(difference.maxAbsoluteDifference, delta)
    difference.maxNormalizedDifference = Math.max(difference.maxNormalizedDifference, delta / Math.max(1, Math.abs(before), Math.abs(after)))
    return
  }
  if (ArrayBuffer.isView(before) && ArrayBuffer.isView(after)) {
    if (before.constructor.name !== after.constructor.name) throw new Error(`Typed array mismatch at ${path}`)
    const a = before as unknown as ArrayLike<number>, b = after as unknown as ArrayLike<number>
    if (a.length !== b.length) throw new Error(`Array length mismatch at ${path}`)
    for (let i = 0; i < a.length; i++) compare(a[i], b[i], difference, `${path}[${i}]`)
    return
  }
  if (before !== null && after !== null && typeof before === 'object' && typeof after === 'object') {
    const a = before as Record<string, unknown>, b = after as Record<string, unknown>
    const keys = Object.keys(a)
    if (keys.join('|') !== Object.keys(b).join('|')) throw new Error(`Object shape mismatch at ${path}`)
    for (const key of keys) compare(a[key], b[key], difference, `${path}.${key}`)
    return
  }
  if (before !== after) throw new Error(`Value mismatch at ${path}`)
}

function run(Model: Constructor, spec: Case) {
  const construct = () => new Model(...spec.grid, ...spec.dimensionsM, spec.material, spec.bulkDensityKgM3)
  const start = performance.now()
  const model = construct()
  const setupMs = performance.now() - start
  let solveMs = 0, restartSetupMs = 0, restartRestoreMs = 0
  const stages: Stage[] = []
  function solve(target: ContinuumMechanics, tractionPa: number, operation: string) {
    const tick = performance.now()
    const result = target.solveTopTraction(tractionPa)
    solveMs += performance.now() - tick
    stages.push({ operation, result, checkpoint: target.checkpoint() })
  }
  solve(model, spec.tractionPa, 'load')
  let restartDifference: Difference | null = null
  if (spec.unloadAndRestart) {
    const tick = performance.now()
    const restarted = construct()
    restartSetupMs = performance.now() - tick
    const restoreTick = performance.now()
    restarted.restore(stages[0].checkpoint)
    restartRestoreMs = performance.now() - restoreTick
    solve(model, 0, 'unload')
    solve(restarted, 0, 'restart-and-unload')
    restartDifference = freshDifference()
    compare(stages[1].result, stages[2].result, restartDifference)
    compare(stages[1].checkpoint, stages[2].checkpoint, restartDifference)
    if (restartDifference.unequalNumericValues !== 0) throw new Error('Checkpoint restart changed the unloading trajectory.')
  }
  return { setupMs, solveMs, restartSetupMs, restartRestoreMs, stages, restartDifference }
}

function median(values: number[]) { return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] }
function summary(values: number[]) { return { median: median(values), minimum: Math.min(...values), maximum: Math.max(...values) } }
const totals = freshDifference()
const results = []
const repetitions = 3
for (const spec of cases) {
  // Warm both implementations on this case; measured order alternates below.
  run(Before, spec)
  run(After, spec)
  const measurements = []
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const first = repetition % 2 === 0 ? run(Before, spec) : run(After, spec)
    const second = repetition % 2 === 0 ? run(After, spec) : run(Before, spec)
    const before = repetition % 2 === 0 ? first : second
    const after = repetition % 2 === 0 ? second : first
    const difference = freshDifference()
    compare(before.stages, after.stages, difference)
    if (difference.unequalNumericValues !== 0) throw new Error(`Exact equality failed for ${spec.name}: ${JSON.stringify(difference)}`)
    totals.numericValuesCompared += difference.numericValuesCompared
    totals.unequalNumericValues += difference.unequalNumericValues
    totals.maxAbsoluteDifference = Math.max(totals.maxAbsoluteDifference, difference.maxAbsoluteDifference)
    totals.maxNormalizedDifference = Math.max(totals.maxNormalizedDifference, difference.maxNormalizedDifference)
    const compact = (value: ReturnType<typeof run>) => ({
      setupMs: value.setupMs, solveMs: value.solveMs, restartSetupMs: value.restartSetupMs, restartRestoreMs: value.restartRestoreMs,
      fullOutputSha256: sha(serialize(value.stages)), restartDifference: value.restartDifference,
      nonlinearIterations: value.stages.map(stage => stage.result.iterations),
      forceResidualsN: value.stages.map(stage => stage.result.residualN),
    })
    measurements.push({ repetition: repetition + 1, order: repetition % 2 === 0 ? 'before-after' : 'after-before', before: compact(before), after: compact(after), difference })
  }
  const elementCount = spec.grid.reduce((a, b) => a * b, 1)
  const beforeSetup = measurements.map(m => m.before.setupMs), afterSetup = measurements.map(m => m.after.setupMs)
  const beforeSolve = measurements.map(m => m.before.solveMs), afterSolve = measurements.map(m => m.after.solveMs)
  const timing = {
    beforeSetupMs: summary(beforeSetup), afterSetupMs: summary(afterSetup),
    beforeSolveMs: summary(beforeSolve), afterSolveMs: summary(afterSolve),
    setupMedianRatioBeforeOverAfter: median(beforeSetup) / median(afterSetup),
    solveMedianRatioBeforeOverAfter: median(beforeSolve) / median(afterSolve),
  }
  results.push({ ...spec, elementCount, nodeCount: spec.grid.reduce((a, b) => a * (b + 1), 1), timing,
    operatorPayloadEstimateBytes: { before: elementCount * (24 * 24 + 8 * 6 * 24) * 8, afterIncludingDofCache: (24 * 24 + 8 * 6 * 24) * 8 + elementCount * 24 * 4 }, measurements })
  console.log(`${spec.name}: setup ${timing.beforeSetupMs.median.toFixed(3)} → ${timing.afterSetupMs.median.toFixed(3)} ms; solve ${timing.beforeSolveMs.median.toFixed(3)} → ${timing.afterSolveMs.median.toFixed(3)} ms; all values identical`)
}
const report = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  baselineCommit: '371a68af76a3c83f94173b0a4a36fddf464a481b',
  before: { path: relative(root, baselinePath), sha256: sha(beforeBytes) },
  after: { path: relative(root, currentPath), sha256: sha(afterBytes) },
  benchmarkScriptSha256: sha(await readFile(new URL(import.meta.url))),
  environment: { node: process.version, platform: platform(), arch: arch(), osRelease: release(), cpuModel: cpus()[0]?.model, logicalCpus: cpus().length },
  method: { warmupsPerImplementationPerCase: 1, measuredRepetitionsPerImplementationPerCase: repetitions, ordering: 'Alternating paired before/after runs',
    setup: 'Fresh constructor only. Restart construction separately reported for plastic case.',
    solve: 'Sum of solveTopTraction calls; plastic case includes load, unload, and restored unload. Checkpoint serialization/comparison excluded.',
    exactEquality: 'Object.is for every finite numeric scalar/array entry, including signed zero; shapes and nonnumeric metadata match. Full result and checkpoint at every stage.',
    normalizedDifference: '|after-before| / max(1, |before|, |after|)',
    limitations: 'Single machine and Node runtime; three repeats with other app work potentially active. No browser-wide speedup, transport timing, measured heap peak, or experimental physics validation. Payload estimates exclude JS overhead, state/history, and frame storage. No performance threshold is a test gate.' },
  totals,
  cases: results,
}
// Detect a concurrently edited implementation before publishing provenance.
if (sha(await readFile(currentPath)) !== report.after.sha256 || sha(await readFile(baselinePath)) !== report.before.sha256) throw new Error('Solver file changed while benchmark was running.')
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Recorded ${totals.numericValuesCompared} exactly matching numeric values in ${relative(root, outputPath)}.`)
