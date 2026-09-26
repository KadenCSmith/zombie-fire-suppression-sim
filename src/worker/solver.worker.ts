import { continuumMaterial } from '../sim/materials'
import { Simulation } from '../sim/index'
import { runFastEvent } from '../fastEvent'
import { SoilMechanics, type MechanicsResolution } from '../mechanics/model'
import { ContinuumMechanics } from '../mechanics/continuum'
import type { FastEventRun } from '../fastEvent'
import type { Snapshot, MechanicsMassGrid } from '../sim/types'
import type { SolverCommand, SolverResponse } from './protocol'

const scope = self as unknown as {
  postMessage: (message: SolverResponse, transfer?: Transferable[]) => void
  onmessage: ((event: MessageEvent<SolverCommand>) => void) | null
}

let simulation: Simulation | null = null
let runGeneration = 0
let activeTarget = 0
let startWallMs = 0
let startSimSeconds = 0
let lastFrameWallMs = 0
let lastFrameSimSeconds = 0
let computeRate = 30
let runActive = false
let pacedUntilTimeSeconds = 0
let lastPaceWallMs = 0
let gasEvent: FastEventRun | null = null
let eventMass: MechanicsMassGrid | null = null
let mechanics: SoilMechanics | null = null
let continuum: ContinuumMechanics | null = null
let mechanicsGeneration = 0
let mechanicsFrameIndex = 0
let mechanicsStartWallMs = 0

function beginMechanics(resolution: MechanicsResolution) {
  if (!simulation || !gasEvent || !eventMass) throw new Error('Compute a gas event before starting mechanics.')
  mechanicsGeneration++
  mechanics = new SoilMechanics(simulation.scenario, gasEvent, resolution, eventMass)
  mechanicsFrameIndex = 0
  mechanicsStartWallMs = performance.now()
  runMechanicsChunk(mechanicsGeneration)
}

function runMechanicsChunk(generation: number) {
  if (!mechanics || !gasEvent || generation !== mechanicsGeneration) return
  try {
    const gas = gasEvent.frames[mechanicsFrameIndex]
    if (!gas) { scope.postMessage({ type: 'mechanicsProgress', running: false, cancelled: false, progress: 1, achievedSpeed: 0 }); return }
    const elapsed = Math.max(0.001, (performance.now() - mechanicsStartWallMs) / 1000)
    const frame = mechanics.advanceTo(gas, gas.eventTimeS / elapsed)
    scope.postMessage({ type: 'mechanicsFrame', frame, checks: { ...mechanics.checks, warnings: [...mechanics.checks.warnings] } },
      [frame.displacementM.buffer, frame.yielded.buffer, frame.effectiveStressPa.buffer, frame.pressurePa.buffer])
    mechanicsFrameIndex++
    const running = mechanicsFrameIndex < gasEvent.frames.length && gas.status !== 'validity-paused'
    scope.postMessage({ type: 'mechanicsProgress', running, cancelled: false, progress: frame.progress, achievedSpeed: frame.achievedSpeed })
    // Stream observable frames while leaving room for pause/cancel messages.
    if (running) setTimeout(() => runMechanicsChunk(generation), 25)
  } catch (error) {
    mechanicsGeneration++
    scope.postMessage({ type: 'error', message: `Mechanics stopped: ${error instanceof Error ? error.message : String(error)}` })
    scope.postMessage({ type: 'mechanicsProgress', running: false, cancelled: false, progress: mechanics?.checks ? mechanicsFrameIndex / (gasEvent?.frames.length ?? 1) : 0, achievedSpeed: 0 })
  }
}

function emitSnapshot(snapshot: Snapshot): void {
  const transfer = Object.values(snapshot.fields).map(field => field.buffer as ArrayBuffer)
  scope.postMessage({ type: 'snapshot', snapshot }, transfer)
}

function emitProgress(running: boolean): void {
  if (!simulation) return
  const now = performance.now()
  const elapsedWall = Math.max((now - startWallMs) / 1000, 0.001)
  const timeSeconds = simulation.timeSeconds
  scope.postMessage({
    type: 'progress',
    timeSeconds,
    targetTimeSeconds: activeTarget,
    throughput: (timeSeconds - startSimSeconds) / elapsedWall,
    running
  })
}

function runChunk(generation: number): void {
  if (!simulation || generation !== runGeneration || !runActive) return
  try {
    const before = simulation.timeSeconds
    if (activeTarget - before <= 1e-8) {
      runActive = false
      emitSnapshot(simulation.snapshot())
      emitProgress(false)
      return
    }
    // Cap elapsed wall time per tick. A throttled background tab must not accrue
    // minutes of physical time and then silently jump forward when restored.
    const nowForPace = performance.now()
    const elapsedWallMs = Math.min(100, Math.max(0, nowForPace - lastPaceWallMs))
    lastPaceWallMs = nowForPace
    pacedUntilTimeSeconds = Math.min(activeTarget, pacedUntilTimeSeconds + elapsedWallMs * computeRate / 1000)
    const permittedTime = pacedUntilTimeSeconds
    const delta = Math.min(permittedTime - before, 300)
    if (delta <= 1e-8) {
      setTimeout(() => runChunk(generation), 25)
      return
    }
    simulation.advanceUntil(before + delta, simulation.cellCount > 50_000 ? 1 : 24)
    if (simulation.timeSeconds <= before + 1e-10) {
      if (simulation.diagnostics.status !== 'running') {
        runActive = false
        emitSnapshot(simulation.snapshot())
        emitProgress(false)
        return
      }
      throw new Error('Solver did not advance; inspect diagnostics.')
    }
    const now = performance.now()
    const minFrameWallMs = simulation.cellCount > 50_000 ? 500 : 100
    if (now - lastFrameWallMs >= minFrameWallMs || simulation.timeSeconds - lastFrameSimSeconds >= 1800 || simulation.timeSeconds >= activeTarget || simulation.diagnostics.status !== 'running') {
      emitSnapshot(simulation.snapshot())
      lastFrameWallMs = now
      lastFrameSimSeconds = simulation.timeSeconds
      emitProgress(simulation.timeSeconds < activeTarget && simulation.diagnostics.status === 'running')
    }
    if (simulation.timeSeconds < activeTarget && simulation.diagnostics.status === 'running') {
      setTimeout(() => runChunk(generation), simulation.timeSeconds >= permittedTime - 1e-8 ? 25 : 0)
    } else {
      runActive = false
    }
  } catch (error) {
    runActive = false
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    emitProgress(false)
  }
}

function startRun(target: number): void {
  if (!simulation || !Number.isFinite(target)) return
  runGeneration++
  activeTarget = Math.max(target, simulation.timeSeconds)
  runActive = activeTarget > simulation.timeSeconds + 1e-8
  startSimSeconds = simulation.timeSeconds
  startWallMs = performance.now()
  lastFrameWallMs = 0
  lastFrameSimSeconds = startSimSeconds
  pacedUntilTimeSeconds = startSimSeconds
  lastPaceWallMs = startWallMs
  if (runActive) setTimeout(() => runChunk(runGeneration), 0)
  else emitProgress(false)
}

scope.onmessage = (event: MessageEvent<SolverCommand>) => {
  const command = event.data
  try {
    if (command.type === 'init') {
      runGeneration++
      mechanicsGeneration++; gasEvent = null; eventMass = null; mechanics = null
      continuum = null
      runActive = false
      simulation = new Simulation(command.scenario)
      activeTarget = 0
      emitSnapshot(simulation.snapshot())
    } else if (command.type === 'dispose') {
      runGeneration++
      mechanicsGeneration++; gasEvent = null; eventMass = null; mechanics = null
      continuum = null
      runActive = false
      simulation = null
    } else if (command.type === 'pause') {
      runGeneration++
      runActive = false
      emitProgress(false)
    } else if (command.type === 'computeRate') {
      if (!Number.isFinite(command.simSecondsPerWallSecond) || command.simSecondsPerWallSecond <= 0 || command.simSecondsPerWallSecond > 1e6) {
        throw new Error('Solver pace must be a positive, finite rate no greater than 1,000,000 simulated seconds per wall second.')
      }
      computeRate = command.simSecondsPerWallSecond
      if (runActive && simulation) {
        startSimSeconds = simulation.timeSeconds
        startWallMs = performance.now()
        pacedUntilTimeSeconds = startSimSeconds
        lastPaceWallMs = startWallMs
      }
    } else if (command.type === 'convertRemainingDryIce') {
      runGeneration++
      runActive = false
      if (simulation) {
        emitSnapshot(simulation.convertRemainingDryIce())
        emitProgress(false)
      }
    } else if (command.type === 'startFastEvent') {
      runGeneration++
      mechanicsGeneration++
      runActive = false
      if (simulation) {
        if (command.convertRemainingDryIce && simulation.dryIceMassKg > 0) {
          emitSnapshot(simulation.convertRemainingDryIce())
        }
        eventMass = simulation.mechanicsMassState()
        gasEvent = runFastEvent(simulation.scenario, simulation.snapshot(), command.options)
        scope.postMessage({ type: 'fastEvent', run: gasEvent })
        if (gasEvent.status === 'complete') beginMechanics(4)
        emitProgress(false)
      }
    } else if (command.type === 'startMechanics') {
      beginMechanics(command.resolution)
    } else if (command.type === 'solveContinuum') {
      if (!simulation) throw new Error('Initialize a scenario before calculating soil mechanics.')
      if (!continuum) {
        const domain = simulation.scenario.domain
        continuum = new ContinuumMechanics(4, 4, 4, domain.widthM, domain.lengthM, domain.depthM,
          continuumMaterial(simulation.scenario), simulation.scenario.soil.bulkDensityKgM3)
      }
      const result = continuum.solveTopTraction(command.tractionPa)
      scope.postMessage({ type: 'continuumResult', result, tractionPa: command.tractionPa, resolution: 4 },
        [result.displacementM.buffer, result.stressPa.buffer, result.strain.buffer, result.plasticStrain.buffer,
          result.accumulatedPlasticStrain.buffer, result.yielded.buffer])
    } else if (command.type === 'resumeMechanics') {
      if (mechanics && gasEvent && mechanicsFrameIndex < gasEvent.frames.length) {
        mechanicsGeneration++
        mechanicsStartWallMs = performance.now() - mechanics.timeSeconds * 1000
        runMechanicsChunk(mechanicsGeneration)
      }
    } else if (command.type === 'pauseMechanics') {
      mechanicsGeneration++
      scope.postMessage({ type: 'mechanicsProgress', running: false, cancelled: false, progress: mechanicsFrameIndex / (gasEvent?.frames.length ?? 1), achievedSpeed: 0 })
    } else if (command.type === 'cancelMechanics') {
      mechanicsGeneration++; mechanics = null
      scope.postMessage({ type: 'mechanicsProgress', running: false, cancelled: true, progress: 0, achievedSpeed: 0 })
    } else if (command.type === 'snapshot') {
      if (simulation) emitSnapshot(simulation.snapshot())
    } else if (command.type === 'heater') {
      if (simulation) {
        simulation.setHeater(command.enabled)
        emitSnapshot(simulation.snapshot())
      }
    } else if (command.type === 'heaterGeneration') {
      if (simulation) {
        simulation.setHeaterGeneration(command.heatGenerationWm3)
        emitSnapshot(simulation.snapshot())
      }
    } else if (command.type === 'atmosphericOxygen') {
      if (simulation) {
        simulation.setAtmosphericOxygen(command.moleFraction)
        emitSnapshot(simulation.snapshot())
      }
    } else if (command.type === 'advance') {
      if (simulation && command.seconds > 0) startRun(simulation.timeSeconds + command.seconds)
    } else if (command.type === 'step') {
      if (simulation) {
        runGeneration++
        runActive = false
        emitSnapshot(simulation.step())
      }
    } else if (command.type === 'runTo') {
      startRun(command.targetTimeSeconds)
    }
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
