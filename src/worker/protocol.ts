import type { Scenario, Snapshot } from '../sim/types'
import type { FastEventOptions, FastEventRun } from '../fastEvent'

export type SolverCommand =
  | { type: 'init'; scenario: Scenario }
  | { type: 'advance'; seconds: number }
  | { type: 'step' }
  | { type: 'runTo'; targetTimeSeconds: number }
  | { type: 'computeRate'; simSecondsPerWallSecond: number }
  | { type: 'convertRemainingDryIce' }
  | { type: 'startFastEvent'; convertRemainingDryIce?: boolean; options?: FastEventOptions }
  | { type: 'pause' }
  | { type: 'heater'; enabled: boolean }
  | { type: 'heaterGeneration'; heatGenerationWm3: number }
  | { type: 'snapshot' }
  | { type: 'dispose' }

export type SolverResponse =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'fastEvent'; run: FastEventRun }
  | { type: 'progress'; timeSeconds: number; targetTimeSeconds: number; throughput: number; running: boolean }
  | { type: 'error'; message: string }
