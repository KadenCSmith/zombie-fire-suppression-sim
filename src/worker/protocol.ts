import type { Scenario, Snapshot } from '../sim/types'
import type { FastEventOptions, FastEventRun } from '../fastEvent'
import type { MechanicsChecks, MechanicsFrame, MechanicsResolution } from '../mechanics/model'

export type SolverCommand =
  | { type: 'init'; scenario: Scenario }
  | { type: 'advance'; seconds: number }
  | { type: 'step' }
  | { type: 'runTo'; targetTimeSeconds: number }
  | { type: 'computeRate'; simSecondsPerWallSecond: number }
  | { type: 'convertRemainingDryIce' }
  | { type: 'startFastEvent'; convertRemainingDryIce?: boolean; options?: FastEventOptions }
  | { type: 'startMechanics'; resolution: MechanicsResolution }
  | { type: 'resumeMechanics' }
  | { type: 'pauseMechanics' }
  | { type: 'cancelMechanics' }
  | { type: 'pause' }
  | { type: 'heater'; enabled: boolean }
  | { type: 'heaterGeneration'; heatGenerationWm3: number }
  | { type: 'snapshot' }
  | { type: 'dispose' }

export type SolverResponse =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'fastEvent'; run: FastEventRun }
  | { type: 'mechanicsFrame'; frame: MechanicsFrame; checks: MechanicsChecks }
  | { type: 'mechanicsProgress'; running: boolean; cancelled: boolean; progress: number; achievedSpeed: number }
  | { type: 'progress'; timeSeconds: number; targetTimeSeconds: number; throughput: number; running: boolean }
  | { type: 'error'; message: string }
