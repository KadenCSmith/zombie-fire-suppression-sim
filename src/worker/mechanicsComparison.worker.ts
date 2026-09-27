/// <reference lib="webworker" />
import { runMechanicsBenchmark, type BenchmarkInputs, type MechanicsLaw } from '../mechanics/comparison'
self.onmessage = (event: MessageEvent<{ inputs: BenchmarkInputs; laws: MechanicsLaw[] }>) => {
  try {
    for (const law of event.data.laws) {
      const run = runMechanicsBenchmark(event.data.inputs, law, frame => self.postMessage({ type: 'progress', law, stage: frame.stage }))
      self.postMessage({ type: 'result', run })
    }
    self.postMessage({ type: 'done' })
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }) }
}
