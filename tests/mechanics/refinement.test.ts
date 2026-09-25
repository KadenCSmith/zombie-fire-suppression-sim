import { expect, it } from 'vitest'
import { createDefaultScenario, Simulation } from '../../src/sim'
import { runFastEvent } from '../../src/fastEvent'
import { SoilMechanics, type MechanicsResolution } from '../../src/mechanics/model'

it('compares coarse and medium meshes and records medium runtime, memory, stability', () => {
  const scenario = createDefaultScenario()
  const gas = runFastEvent(scenario, new Simulation(scenario).snapshot(), { durationS: 0.6, frameCount: 31 })
  const atm = scenario.atmosphere.pressurePa
  const run = { ...gas, frames: gas.frames.map(frame => ({ ...frame,
    shellPressurePa: Float32Array.from(gas.shellRadiusM.map((_, s) => atm + 50_000 * Math.max(0, Math.sin(Math.PI * frame.eventTimeS / 0.36)) * (s === 0 ? 1 : 0.45))) })) }
  function measure(resolution: MechanicsResolution) {
    const model = new SoilMechanics(scenario, run, resolution)
    const startMs = performance.now()
    const startRss = process.memoryUsage().rss
    let peakDisplacementM = 0
    let final = model.advanceTo(run.frames[0])
    for (const frame of run.frames.slice(1)) {
      final = model.advanceTo(frame)
      peakDisplacementM = Math.max(peakDisplacementM, final.maxDisplacementM)
    }
    return { resolution, runtimeMs: performance.now() - startMs, processRssMiB: process.memoryUsage().rss / 2 ** 20,
      processRssDeltaMiB: (process.memoryUsage().rss - startRss) / 2 ** 20,
      estimatedStateKiB: model.checks.estimatedMemoryBytes / 1024, stableStepS: model.checks.stableStepS,
      expectedSteps: model.checks.expectedSteps, maxMomentumResidualN: model.checks.maxMomentumResidualN,
      peakDisplacementM, finalDisplacementM: final.maxDisplacementM, yieldedElements: final.yieldedElements,
      massResidualKg: model.checks.massResidualKg, finalStatus: final.status }
  }
  const coarse = measure(4)
  const medium = measure(6)
  const relativeDifference = Math.abs(medium.peakDisplacementM - coarse.peakDisplacementM) / Math.max(1e-12, coarse.peakDisplacementM)
  console.log('MECHANICS_REFINEMENT_BENCHMARK', JSON.stringify({ coarse, medium, relativePeakDisplacementDifference: relativeDifference }))
  expect(coarse.finalStatus).toBe('complete')
  expect(medium.finalStatus).toBe('complete')
  expect(medium.maxMomentumResidualN).toBeLessThan(1e-5)
  expect(medium.massResidualKg).toBeLessThan(1e-6)
  expect(Number.isFinite(relativeDifference)).toBe(true)
})
