import { createFireProtocol, type FireProtocolFrame, type FireProtocolOptions } from './fireProtocol'

export type FireProtocolStatus = 'completed' | 'time-budget-stopped' | 'physics-stopped'
export type FireProtocolCachedFrame = FireProtocolFrame & { event?: 'dry-ice-insertion' }
export interface FireProtocolProgress {
  type: 'progress'
  phase: 'ignition' | 'treatment'
  timeS: number
  targetTimeS: number
  elapsedS: number
  frame: FireProtocolFrame
}
export interface FireProtocolCache {
  schemaVersion: 1
  kind: 'surface-ignition-protocol'
  generatedAt: string
  sourceHashes?: Record<string, string>
  provenance: { mode: 'live-worker' | 'offline'; applicationVersion: string; generationCommit?: string }
  domain: ReturnType<typeof createFireProtocol>['scenario']['domain']
  coordinateConvention: string
  source: { xM: number; yM: number; depthM: number; initialMassKg: number; initialTemperatureK: number }
  ignitionSource: { xM: number; yM: number; depthM: number; powerW: number }
  treatmentSource: FireProtocolCache['source']
  treatmentDurationS: number
  initialization: { method: string; preparedWaterRemovedKg: number; atlasCells: number }
  config: FireProtocolOptions
  scenario: ReturnType<typeof createFireProtocol>['scenario']
  status: FireProtocolStatus
  stopReason: string | null
  elapsedS: number
  ignitionEndS: number
  treatmentStartS: number | null
  propagationResolved: false
  assumptions: string[]
  evidence: { title: string; url: string; role: string }[]
  frames: FireProtocolCachedFrame[]
}
export interface FireProtocolRunSettings {
  wallLimitS?: number
  treatmentDurationS?: number
  applicationVersion?: string
  mode?: 'live-worker' | 'offline'
  onProgress?: (progress: FireProtocolProgress) => void
  yieldControl?: () => Promise<void>
}

/** Shared offline/live experiment driver. Only accepted conservative states become frames. */
export async function runFireProtocol(options: Partial<FireProtocolOptions> = {}, settings: FireProtocolRunSettings = {}): Promise<FireProtocolCache> {
  const wallLimitS = settings.wallLimitS ?? 300, treatmentDurationS = settings.treatmentDurationS ?? 30
  if (!Number.isFinite(wallLimitS) || wallLimitS <= 0) throw new Error('Positive wall limit required.')
  if (!Number.isFinite(treatmentDurationS) || treatmentDurationS < 0 || treatmentDurationS > 3600) throw new Error('Treatment duration must be 0–3600 s.')
  const run = createFireProtocol(options), { sim, config, scenario } = run
  const frames: FireProtocolCachedFrame[] = [run.capture()], start = performance.now()
  let status: FireProtocolStatus = 'completed', stopReason: string | null = null
  let nextCaptureS = config.captureEveryS, treatmentStartS: number | null = null, lastProgressMs = -Infinity
  const treatmentSource = { xM: 4.4, yM: 4, depthM: 1.3, initialMassKg: 4, initialTemperatureK: 194.65 }
  const elapsedS = () => (performance.now() - start) / 1000
  const withinBudget = () => {
    if (elapsedS() <= wallLimitS) return true
    status = 'time-budget-stopped'; stopReason = 'Offline calculation reached its wall-clock budget; accepted earlier states retained and remaining frames were not invented.'
    return false
  }
  const capture = (): FireProtocolCachedFrame => ({ ...run.capture(), ...(treatmentStartS === null ? {} : { phase: 'treatment' as const }) })
  const conserved = () => Number.isFinite(sim.ledger.massResidualKg) && Number.isFinite(sim.ledger.energyResidualJ)
    && Math.abs(sim.ledger.massResidualKg) <= 1e-7 && Math.abs(sim.ledger.energyResidualJ) <= 1e-4
  const progress = async (force = false) => {
    if (!force && performance.now() - lastProgressMs < 300) return
    lastProgressMs = performance.now()
    settings.onProgress?.({ type: 'progress', phase: treatmentStartS === null ? 'ignition' : 'treatment', timeS: sim.time,
      targetTimeS: config.durationS + treatmentDurationS, elapsedS: elapsedS(), frame: capture() })
    await settings.yieldControl?.()
  }
  const conservativeStep = (seconds: number) => {
    const before = sim.checkpoint()
    sim.step(seconds)
    if (!conserved()) {
      sim.restore(before); throw new Error('Conservation acceptance threshold exceeded; last candidate rolled back.')
    }
  }
  const saveFinal = () => { if (frames.at(-1)!.timeS !== sim.time) frames.push(capture()) }
  try {
    await progress(true)
    while (sim.time < config.durationS - 1e-8) {
      if (!withinBudget()) break
      conservativeStep(Math.min(config.maxStepS, config.durationS - sim.time, nextCaptureS - sim.time))
      if (sim.time >= nextCaptureS - 1e-8) { frames.push(capture()); nextCaptureS += config.captureEveryS }
      await progress()
    }
    saveFinal()
    if (status === 'completed' && treatmentDurationS > 0 && withinBudget()) {
      const before = sim.checkpoint()
      sim.insertDryIce(treatmentSource.initialMassKg, treatmentSource.initialTemperatureK, treatmentSource)
      if (!conserved()) {
        sim.restore(before); throw new Error('Insertion conservation threshold exceeded; intervention rolled back.')
      }
      treatmentStartS = sim.time
      frames.push({ ...capture(), event: 'dry-ice-insertion' })
      await progress(true)
      const end = sim.time + treatmentDurationS
      let captureAt = Math.min(end, sim.time + 2)
      while (sim.time < end - 1e-8) {
        if (!withinBudget()) break
        conservativeStep(Math.min(0.125, end - sim.time, captureAt - sim.time))
        if (sim.time >= captureAt - 1e-8) { frames.push(capture()); captureAt = Math.min(end, captureAt + 2) }
        await progress()
      }
    }
  } catch (error) { status = 'physics-stopped'; stopReason = error instanceof Error ? error.message : String(error) }
  saveFinal()
  await progress(true)
  return { schemaVersion: 1, kind: 'surface-ignition-protocol', generatedAt: new Date().toISOString(),
    provenance: { mode: settings.mode ?? 'live-worker', applicationVersion: settings.applicationVersion ?? 'unspecified' }, domain: scenario.domain,
    coordinateConvention: 'x-fastest, then y, then depth-positive-down; cell-centred SI values', source: treatmentSource,
    ignitionSource: { xM: scenario.source.centerXM, yM: scenario.source.centerYM, depthM: scenario.source.centerDepthM, powerW: config.ignitionPowerW },
    treatmentSource, treatmentDurationS, initialization: { method: sim.initializationMethod, preparedWaterRemovedKg: sim.preparedWaterRemovedKg, atlasCells: sim.atlasCells },
    config, scenario, status, stopReason, elapsedS: elapsedS(), ignitionEndS: config.ignitionDurationS, treatmentStartS, propagationResolved: false,
    assumptions: [
      'Surface-connected peat throughout the 8 by 8 by 3.2 m domain replaces the separate buried lens; this is an assumed experiment, not a surveyed site.',
      'Cold initial state; all water retained. Moisture is kg water per kg dry peat, converted to pore saturation. No prepared hot region or dry halo.',
      'A finite external heater deposits energy into the top grid cell. This is a surrogate for surface ignition, not a resolved flame or measured ignition source.',
      `Surface mass exchange is an assumed ${config.surfaceExchangeVelocityMS} m/s boundary coefficient. The default 0.0016 m/s represents diffusivity divided by an assumed 1 cm air film, not measured wind.`,
      'Original one-step reaction kinetics, heat conduction and gas transport retained; no fitted spread speed or fabricated growth field.',
      'A 0.5 by 0.5 by 0.32 m cell cannot resolve centimetre-scale smouldering fronts; heated/reacting cell depth is not a measured front location.',
      'Treatment, when reached, imports a finite 4 kg dry-ice source at the original study coordinate, with mass/internal-energy/compression-work bookkeeping. It is not a drilling or falling-contact calculation.',
      'Mechanics, cap, drilling, liquid infiltration and fractures are absent from this protocol. Animation of those actions is illustrative.',
      'No extinction is prescribed: the source is about 1.3 m from the reacting surface cell. Treatment may leave oxidation continuing.',
      'Physical elapsed time is separate from presentation time. Successful conservation does not establish material or field validation.'
    ], evidence: [{ title: 'Huang and Rein (2017), downward spread of smouldering peat fire', url: 'https://doi.org/10.1071/WF16198',
      role: 'Establishes centimetres-per-hour/time-scale and multistep-chemistry limitations. This run does not reproduce that experiment.' }], frames }
}

export interface FireProtocolWorkerRequest { type: 'run'; options: Partial<FireProtocolOptions>; applicationVersion: string }
export type FireProtocolWorkerMessage = FireProtocolProgress | { type: 'result'; cache: FireProtocolCache } | { type: 'error'; message: string }
