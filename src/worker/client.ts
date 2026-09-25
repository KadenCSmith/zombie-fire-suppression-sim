import type { Scenario, Snapshot } from '../sim/types'
import type { FastEventOptions, FastEventRun } from '../fastEvent'
import type { SolverCommand, SolverResponse } from './protocol'
import SolverWorker from './solver.worker.ts?worker'
import type { MechanicsChecks, MechanicsFrame, MechanicsResolution } from '../mechanics/model'
import type { ContinuumResult } from '../mechanics/continuum'

export interface SolverProgress {
  timeSeconds: number
  targetTimeSeconds: number
  /** Achieved physical seconds per wall-clock second for the current run. */
  throughput: number
  running: boolean
}

export interface SimulationClient {
  init: (scenario: Scenario) => void
  advance: (seconds: number) => void
  step: () => void
  runTo: (targetTimeSeconds: number) => void
  setComputeRate: (simSecondsPerWallSecond: number) => void
  convertRemainingDryIce: () => void
  startFastEvent: (options?: FastEventOptions & { convertRemainingDryIce?: boolean }) => void
  startMechanics: (resolution: MechanicsResolution) => void
  solveContinuum: (tractionPa: number) => void
  resumeMechanics: () => void
  pauseMechanics: () => void
  cancelMechanics: () => void
  pause: () => void
  setHeater: (enabled: boolean) => void
  setHeaterGeneration: (heatGenerationWm3: number) => void
  setAtmosphericOxygen: (moleFraction: number) => void
  snapshot: () => void
  dispose: () => void
}

export function createSimulationClient(handlers: {
  onSnapshot: (snapshot: Snapshot) => void
  onError: (message: string) => void
  onProgress?: (progress: SolverProgress) => void
  onFastEvent?: (run: FastEventRun) => void
  onMechanicsFrame?: (frame: MechanicsFrame, checks: MechanicsChecks) => void
  onContinuumResult?: (result: ContinuumResult, tractionPa: number) => void
  onMechanicsProgress?: (progress: { running: boolean; cancelled: boolean; progress: number; achievedSpeed: number }) => void
}): SimulationClient {
  const worker = new SolverWorker()
  let disposed = false

  worker.onmessage = (event: MessageEvent<SolverResponse>) => {
    const result = event.data
    if (result.type === 'snapshot') {
      handlers.onSnapshot(result.snapshot)
    } else if (result.type === 'fastEvent') {
      handlers.onFastEvent?.(result.run)
    } else if (result.type === 'mechanicsFrame') {
      handlers.onMechanicsFrame?.(result.frame, result.checks)
    } else if (result.type === 'continuumResult') {
      handlers.onContinuumResult?.(result.result, result.tractionPa)
    } else if (result.type === 'mechanicsProgress') {
      handlers.onMechanicsProgress?.(result)
    } else if (result.type === 'progress') {
      handlers.onProgress?.(result)
    } else {
      handlers.onError(result.message)
    }
  }
  worker.onerror = (event: ErrorEvent) => {
    handlers.onError(event.message || 'The solver worker stopped unexpectedly.')
  }

  const send = (message: SolverCommand) => {
    if (!disposed) worker.postMessage(message)
  }

  return {
    init(scenario) { send({ type: 'init', scenario }) },
    advance(seconds) { send({ type: 'advance', seconds }) },
    step() { send({ type: 'step' }) },
    runTo(targetTimeSeconds) { send({ type: 'runTo', targetTimeSeconds }) },
    setComputeRate(simSecondsPerWallSecond) { send({ type: 'computeRate', simSecondsPerWallSecond }) },
    convertRemainingDryIce() { send({ type: 'convertRemainingDryIce' }) },
    startFastEvent(options) {
      send({ type: 'startFastEvent', convertRemainingDryIce: options?.convertRemainingDryIce,
        options: options && { durationS: options.durationS, frameCount: options.frameCount } })
    },
    startMechanics(resolution) { send({ type: 'startMechanics', resolution }) },
    solveContinuum(tractionPa) { send({ type: 'solveContinuum', tractionPa }) },
    resumeMechanics() { send({ type: 'resumeMechanics' }) },
    pauseMechanics() { send({ type: 'pauseMechanics' }) },
    cancelMechanics() { send({ type: 'cancelMechanics' }) },
    pause() { send({ type: 'pause' }) },
    setHeater(enabled) { send({ type: 'heater', enabled }) },
    setHeaterGeneration(heatGenerationWm3) { send({ type: 'heaterGeneration', heatGenerationWm3 }) },
    setAtmosphericOxygen(moleFraction) { send({ type: 'atmosphericOxygen', moleFraction }) },
    snapshot() { send({ type: 'snapshot' }) },
    dispose() { disposed = true; worker.terminate() }
  }
}
