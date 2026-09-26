import DeveloperTools from './ui/DeveloperTools'
import { resolveMaterials } from './sim/materials'
import { ChangeEvent, ReactNode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Activity from 'lucide-react/dist/esm/icons/activity.mjs'
import ArrowDownToLine from 'lucide-react/dist/esm/icons/arrow-down-to-line.mjs'
import ArrowLeftRight from 'lucide-react/dist/esm/icons/arrow-left-right.mjs'
import BookOpen from 'lucide-react/dist/esm/icons/book-open.mjs'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs'
import CircleHelp from 'lucide-react/dist/esm/icons/circle-help.mjs'
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.mjs'
import Download from 'lucide-react/dist/esm/icons/download.mjs'
import Gauge from 'lucide-react/dist/esm/icons/gauge.mjs'
import Layers3 from 'lucide-react/dist/esm/icons/layers-3.mjs'
import Leaf from 'lucide-react/dist/esm/icons/leaf.mjs'
import MousePointer2 from 'lucide-react/dist/esm/icons/mouse-pointer-2.mjs'
import Pause from 'lucide-react/dist/esm/icons/pause.mjs'
import Play from 'lucide-react/dist/esm/icons/play.mjs'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.mjs'
import Save from 'lucide-react/dist/esm/icons/save.mjs'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2.mjs'
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward.mjs'
import StepForward from 'lucide-react/dist/esm/icons/step-forward.mjs'
import Thermometer from 'lucide-react/dist/esm/icons/thermometer.mjs'
import Upload from 'lucide-react/dist/esm/icons/upload.mjs'
import Waves from 'lucide-react/dist/esm/icons/waves.mjs'
import Zap from 'lucide-react/dist/esm/icons/zap.mjs'
import { Scene, OVERLAY_INFO, type FastOverlay, type Overlay, type ProbeLocation, type View } from './ui/Scene'
import { createDefaultScenario, diameterFromMass, massFromDiameter, validateScenario, SCENARIOS } from './sim'
import { PARAMETER_REGISTRY, SOIL_PRESETS, applySoilPreset as applyPresetToScenario } from './sim/parameters'
import type { Scenario, Snapshot, ProbeSample } from './sim/types'
import type { FastEventRun } from './fastEvent'
import { createSimulationClient } from './worker/client'
import { mechanicsSizing, type MechanicsChecks, type MechanicsFrame, type MechanicsResolution } from './mechanics/model'
import type { ContinuumResult } from './mechanics/continuum'
import { derivePlumeSources, type PlumeSource } from './plumes/model'

type Checkpoint = { snapshot: Snapshot; probe: ProbeSample | null }
type Tab = 'setup' | 'simulation' | 'results' | 'event' | 'developer'
type SetupSection = 'source' | 'ground' | 'fire' | 'boundary' | 'advanced'
type ScenarioPreset = 'custom' | 'untreated' | 'cold' | 'heated' | 'wet' | 'pathway'
type SimClient = ReturnType<typeof createSimulationClient>
const StudyWorkspace = lazy(() => import('./ui/StudyWorkspace'))

const DAY = 86400
const OVERLAYS: Overlay[] = ['temperature', 'activity', 'material', 'oxygen', 'co2', 'pressure', 'moisture', 'fuel', 'porosity', 'permeability', 'effective-permeability', 'mobility']

function formatClock(seconds: number) {
  const d = Math.floor(seconds / DAY)
  const h = Math.floor((seconds % DAY) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
}

function finite(value: unknown, fallback = 0) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function formatLoad(value: number | undefined) { return value === undefined ? '—' : Math.abs(value) >= 10000 ? value.toExponential(2) : value.toFixed(2) }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function setPath(object: any, path: string, value: unknown) {
  const next = clone(object)
  const parts = path.split('.')
  let at: any = next
  for (const part of parts.slice(0, -1)) at = at[part]
  at[parts[parts.length - 1]] = value
  return next
}

function getPath(object: any, path: string): any { return path.split('.').reduce((v, p) => v?.[p], object) }

// Use the same canonical scenarios as exports, tests and documentation.
const PRESET_KEYS = { untreated: 'untreated', cold: 'dryIceOnly', heated: 'heatedDryIce',
  wet: 'wetLowPermeability', pathway: 'hypotheticalPathway' } as const

function asSceneFrame(snapshot: Snapshot | null) {
  if (!snapshot) return null
  return {
    timeSeconds: snapshot.timeSeconds,
    grid: { nx: snapshot.nx, ny: snapshot.ny, nz: snapshot.nz, dxM: snapshot.widthM / snapshot.nx, dyM: snapshot.lengthM / snapshot.ny, dzM: snapshot.depthM / snapshot.nz },
    fields: {
      temperatureC: snapshot.fields.temperatureK.map((v) => v - 273.15),
      oxygenMoleFraction: snapshot.fields.oxygen,
      co2MoleFraction: snapshot.fields.co2,
      pressurePa: snapshot.fields.pressurePa,
      moistureSaturation: snapshot.fields.moisture,
      fuelKg: snapshot.fields.fuel,
      materialClass: snapshot.fields.materialClass,
      reactionPowerWm3: snapshot.fields.reactionPowerWm3,
      porosity: snapshot.fields.porosity,
      intrinsicPermeabilityM2: snapshot.fields.intrinsicPermeability,
      effectivePermeabilityM2: snapshot.fields.effectivePermeability,
      effectiveGasDiffusivityM2S: snapshot.fields.effectiveGasDiffusivity,
      fluxXMps: snapshot.fields.fluxXMps,
      fluxYMps: snapshot.fields.fluxYMps,
      fluxZMps: snapshot.fields.fluxZMps,
    },
    source: { equivalentDiameterM: snapshot.dryIceDiameterM, remainingMassKg: snapshot.dryIceMassKg },
  }
}

function sampleSnapshot(snapshot: Snapshot | null, location: ProbeLocation | null, atmospherePa: number): ProbeSample | null {
  if (!snapshot || !location) return null
  const i = Math.min(snapshot.nx - 1, Math.max(0, Math.floor(location.xM / snapshot.widthM * snapshot.nx)))
  const j = Math.min(snapshot.ny - 1, Math.max(0, Math.floor(location.yM / snapshot.lengthM * snapshot.ny)))
  const k = Math.min(snapshot.nz - 1, Math.max(0, Math.floor(location.depthM / snapshot.depthM * snapshot.nz)))
  const q = (k * snapshot.ny + j) * snapshot.nx + i
  const p = snapshot.fields.pressurePa[q]
  return {
    xM: location.xM, yM: location.yM, depthM: location.depthM,
    materialClass: snapshot.fields.materialClass[q], dryDensityKgM3: snapshot.fields.dryDensityKgM3[q],
    thermalConductivityWmK: snapshot.fields.thermalConductivityWmK[q], porosity: snapshot.fields.porosity[q],
    intrinsicPermeabilityM2: snapshot.fields.intrinsicPermeability[q], rootFuelKg: snapshot.fields.rootFuelKg[q],
    temperatureK: snapshot.fields.temperatureK[q], oxygenMoleFraction: snapshot.fields.oxygen[q],
    co2MoleFraction: snapshot.fields.co2[q], oxygenPartialPressurePa: snapshot.fields.oxygen[q] * (p || atmospherePa),
    pressurePa: p, moistureSaturation: snapshot.fields.moisture[q], fuelKg: snapshot.fields.fuel[q],
    darcyVelocityMS: [snapshot.fields.fluxXMps[q], snapshot.fields.fluxYMps[q], snapshot.fields.fluxZMps[q]],
  }
}

function download(name: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function StatusChip({ kind, children }: { kind: 'reduced' | 'illustrative' | 'missing'; children: ReactNode }) {
  return <span className={`status-chip ${kind}`}>{children}</span>
}

function IconButton({ title, children, onClick, active, disabled }: { title: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button className={`icon-btn ${active ? 'active' : ''}`} type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}>{children}</button>
}

function Section({ title, detail, children, open = false }: { title: string; detail?: string; children: ReactNode; open?: boolean }) {
  return <details className="control-section" open={open}>
    <summary><span>{title}</span><small>{detail}</small><ChevronDown size={15} /></summary>
    <div className="section-body">{children}</div>
  </details>
}

type NumberControlProps = {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; symbol?: string; note?: string; metadataTitle?: string; log?: boolean; precision?: number; onChange: (value: number) => void
}
function NumberControl({ label, value, min, max, step = 0.01, unit = '', symbol, note, metadataTitle, log, precision, onChange }: NumberControlProps) {
  const display = precision === undefined ? Number(value.toPrecision(4)) : Number(value.toFixed(precision))
  const [draft, setDraft] = useState(String(display))
  useEffect(() => setDraft(String(display)), [display])
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(n)) { setDraft(String(display)); return }
    const bounded = Math.min(max, Math.max(min, n))
    setDraft(String(bounded))
    onChange(bounded)
  }
  const sliderValue = log ? (Math.log10(Math.max(value, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) * 1000 : value
  const sliderMin = log ? 0 : min
  const sliderMax = log ? 1000 : max
  const sliderStep = log ? 1 : step
  return <div className="number-control" title={metadataTitle ?? note}>
    <div className="control-top"><label>{label}{symbol && <span className="symbol">{symbol}</span>}</label><div className="number-entry"><input type="number" min={min} max={max} step={step} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /><span>{unit}</span></div></div>
    <input className="range" type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={sliderValue} onChange={(e) => onChange(log ? Math.pow(10, Math.log10(min) + Number(e.target.value) / 1000 * (Math.log10(max) - Math.log10(min))) : Number(e.target.value))} aria-label={label} />
    {note && <small className="control-note">{note}</small>}
  </div>
}

function MiniChart({ points, color = '#ec946a', label, unit, accessor }: { points: Checkpoint[]; color?: string; label: string; unit: string; accessor: (p: Checkpoint) => number }) {
  const values = points.map(accessor).filter(Number.isFinite)
  if (values.length < 2) return <div className="empty-chart">Run the model to record a history.</div>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1e-9, max - min)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (values.length - 1) * 280).toFixed(1)},${(54 - (v - min) / range * 48).toFixed(1)}`).join(' ')
  return <div className="mini-chart"><div className="chart-heading"><span>{label}</span><strong>{values[values.length - 1].toFixed(1)} {unit}</strong></div><svg viewBox="0 0 280 60" preserveAspectRatio="none" aria-label={`${label} history`}><path d="M0 55 H280" stroke="#556365" strokeWidth="1" /><path d={path} stroke={color} strokeWidth="2.2" fill="none" vectorEffect="non-scaling-stroke" /></svg><div className="chart-axis"><span>{min.toFixed(1)}</span><span>{max.toFixed(1)} {unit}</span></div></div>
}

function App() {
  const [workspace, setWorkspace] = useState<'study' | 'simulation'>('study')
  const initial = useMemo(() => createDefaultScenario(), [])
  const [scenario, setScenario] = useState<Scenario>(initial)
  const [preset, setPreset] = useState<ScenarioPreset>('heated')
  const [tab, setTab] = useState<Tab>('setup')
  const [setupSection, setSetupSection] = useState<SetupSection>('source')
  const [overlay, setOverlay] = useState<Overlay>('temperature')
  const [view, setView] = useState<View>('orbit')
  const [slice, setSlice] = useState(0)
  const [showRoots, setShowRoots] = useState(true)
  const [showFlow, setShowFlow] = useState(false)
  const [fixedScale, setFixedScale] = useState(true)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [compareSnapshot, setCompareSnapshot] = useState<Snapshot | null>(null)
  const [history, setHistory] = useState<Checkpoint[]>([])
  const [comparison, setComparison] = useState(false)
  const [probe, setProbe] = useState<ProbeLocation | null>(null)
  const [durationDays, setDurationDays] = useState(3)
  const [playing, setPlaying] = useState(false)
  const [playback, setPlayback] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(30)
  const [computeRate, setComputeRate] = useState(30)
  const [runToHour, setRunToHour] = useState(24)
  const [throughput, setThroughput] = useState(0)
  const [error, setError] = useState('')
  const [importError, setImportError] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [illustration, setIllustration] = useState(0)
  const [motionIntensity, setMotionIntensity] = useState(0.65)
  const [motionPlaying, setMotionPlaying] = useState(false)
  const [fastRun, setFastRun] = useState<FastEventRun | null>(null)
  const [fastMode, setFastMode] = useState(false)
  const [fastIndex, setFastIndex] = useState(0)
  const [fastPlaying, setFastPlaying] = useState(false)
  const [fastPlaybackRate, setFastPlaybackRate] = useState(1)
  const [fastDuration, setFastDuration] = useState(2)
  const [fastFrameCount, setFastFrameCount] = useState(61)
  const [fastOverlay, setFastOverlay] = useState<FastOverlay>('pressure')
  const [mechanicsResolution, setMechanicsResolution] = useState<MechanicsResolution>(4)
  const [mechanicsFrames, setMechanicsFrames] = useState<MechanicsFrame[]>([])
  const [mechanicsChecks, setMechanicsChecks] = useState<MechanicsChecks | null>(null)
  const [mechanicsRunning, setMechanicsRunning] = useState(false)
  const [mechanicsProgress, setMechanicsProgress] = useState(0)
  const [mechanicsSpeed, setMechanicsSpeed] = useState(0)
  const [smallChecksPassed, setSmallChecksPassed] = useState(false)
  const [mechanicsView, setMechanicsView] = useState<'displacement' | 'yield'>('displacement')
  const [continuumTractionPa, setContinuumTractionPa] = useState(1000)
  const [continuumResult, setContinuumResult] = useState<ContinuumResult | null>(null)
  const [showSmoke, setShowSmoke] = useState(true)
  const [showSteam, setShowSteam] = useState(true)
  const [plumeQuality, setPlumeQuality] = useState(3)
  const [plumeSources, setPlumeSources] = useState<PlumeSource[]>([])
  const [selectedPeat, setSelectedPeat] = useState(0)
  const [selectedLayer, setSelectedLayer] = useState(0)
  const [selectedHot, setSelectedHot] = useState(0)
  const [selectedPathway, setSelectedPathway] = useState(0)
  const [heaterEnabled, setHeaterEnabled] = useState(initial.source.enabled)
  const [heaterGeneration, setHeaterGeneration] = useState(initial.source.heatGenerationWm3)
  const [boundaryOxygenInput, setBoundaryOxygenInput] = useState(initial.atmosphere.oxygenMoleFraction)
  const [operationalEvents, setOperationalEvents] = useState<{ timeSeconds: number; type: string; value: unknown }[]>([])
  const clientRef = useRef<SimClient | null>(null)
  const comparisonClientRef = useRef<SimClient | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const controlsScrollRef = useRef<HTMLDivElement>(null)
  const lastRecordTime = useRef(-Infinity)
  const probeRef = useRef<ProbeLocation | null>(null)
  const atmosphereRef = useRef(initial.atmosphere.pressurePa)
  const ambientTemperatureRef = useRef(initial.atmosphere.temperatureC + 273.15)
  const durationRef = useRef(durationDays)
  const previousPlumeSnapshot = useRef<Snapshot | null>(null)
  const fastRunRef = useRef<FastEventRun | null>(null)
  const mechanicsChecksRef = useRef<MechanicsChecks | null>(null)
  const mechanicsResolutionRef = useRef<MechanicsResolution>(4)

  useEffect(() => { probeRef.current = probe }, [probe])
  useEffect(() => { atmosphereRef.current = scenario.atmosphere.pressurePa }, [scenario.atmosphere.pressurePa])
  useEffect(() => { ambientTemperatureRef.current = scenario.atmosphere.temperatureC + 273.15 }, [scenario.atmosphere.temperatureC])
  useEffect(() => { durationRef.current = durationDays }, [durationDays])

  useEffect(() => {
    const client = createSimulationClient({
      onSnapshot: (next: Snapshot) => {
        if (previousPlumeSnapshot.current) setPlumeSources(derivePlumeSources(previousPlumeSnapshot.current, next, ambientTemperatureRef.current))
        previousPlumeSnapshot.current = next
        setSnapshot(next)
        const interval = Math.max(30, next.timeSeconds / 400)
        if (next.timeSeconds === 0 || next.timeSeconds - lastRecordTime.current >= interval || next.diagnostics.status !== 'running') {
          lastRecordTime.current = next.timeSeconds
          setHistory((old) => {
            const p = sampleSnapshot(next, probeRef.current, atmosphereRef.current)
            const list = [...old, { snapshot: next, probe: p }]
            const snapshotBytes = Object.values(next.fields).reduce((total, field) => total + field.byteLength, 0)
            const capacity = Math.min(600, Math.max(2, Math.floor(60_000_000 / snapshotBytes)))
            if (list.length <= capacity) return list
            return Array.from({ length: capacity }, (_, index) =>
              list[Math.round(index * (list.length - 1) / (capacity - 1))])
          })
        }
        if (next.diagnostics.status !== 'running' || next.timeSeconds >= durationRef.current * DAY - 0.01) setPlaying(false)
      },
      onError: (message: string) => { setError(message); setPlaying(false) },
      onProgress: (progress) => { setThroughput(progress.throughput); if (!progress.running) setPlaying(false) },
      onFastEvent: (run) => { fastRunRef.current = run; setError(''); setFastRun(run); setFastMode(true); setFastIndex(0); setFastPlaying(false); setMechanicsFrames([]); setMechanicsChecks(null); setSmallChecksPassed(false); setMechanicsRunning(run.status === 'complete'); setComparison(false); setMotionPlaying(false); setIllustration(0); setTab('event') },
      onMechanicsFrame: (frame, checks) => {
        mechanicsChecksRef.current = checks
        setMechanicsChecks(checks)
        setMechanicsFrames(old => [...old, frame])
        const run = fastRunRef.current
        if (run) setFastIndex(Math.max(0, run.frames.findIndex(g => Math.abs(g.eventTimeS - frame.eventTimeS) < 1e-6)))
      },
      onMechanicsProgress: (p) => {
        setMechanicsRunning(p.running); setMechanicsProgress(p.progress); setMechanicsSpeed(p.achievedSpeed)
        if (!p.running && !p.cancelled && p.progress >= 0.999 && mechanicsResolutionRef.current === 4) {
          const c = mechanicsChecksRef.current
          if (c && Math.abs(c.massResidualKg) < 1e-6 && c.maxMomentumResidualN < 1e-5 && c.warnings.length === 0) setSmallChecksPassed(true)
        }
      },
      onContinuumResult: (result) => { setContinuumResult(result); setError(''); setFastMode(false); setTab('event') },
    })
    clientRef.current = client
    return () => { client.dispose(); clientRef.current = null }
  }, [])

  useEffect(() => { clientRef.current?.setComputeRate(computeRate) }, [computeRate])
  useEffect(() => { if (controlsScrollRef.current) controlsScrollRef.current.scrollTop = 0 }, [tab, setupSection])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      clientRef.current?.pause()
      const result = validateScenario(scenario)
      if (result.valid) clientRef.current?.init(scenario)
      else setError(result.errors.join('; '))
      setSnapshot(null)
      setHistory([])
      setPlayback(false)
      setPlaying(false)
      setFastRun(null)
      setContinuumResult(null)
      fastRunRef.current = null; previousPlumeSnapshot.current = null; setPlumeSources([]); setMechanicsFrames([]); setMechanicsChecks(null); setSmallChecksPassed(false)
      setFastMode(false)
      setFastPlaying(false)
      setHeaterEnabled(scenario.source.enabled)
      setHeaterGeneration(scenario.source.heatGenerationWm3)
      setBoundaryOxygenInput(scenario.atmosphere.oxygenMoleFraction)
      lastRecordTime.current = -Infinity
      if (result.valid) setError('')
    }, 160)
    return () => window.clearTimeout(timer)
  }, [scenario])

  useEffect(() => {
    if (!comparison) { comparisonClientRef.current?.dispose(); comparisonClientRef.current = null; setCompareSnapshot(null); return }
    const baseline = clone(scenario)
    baseline.name = `${scenario.name} · heater off comparison`
    baseline.source.enabled = false
    const client = createSimulationClient({ onSnapshot: setCompareSnapshot, onError: setError })
    comparisonClientRef.current = client
    client.setComputeRate(3600)
    client.init(baseline)
    const t = snapshot?.timeSeconds ?? 0
    if (t > 0) client.runTo(t)
    return () => { client.dispose(); comparisonClientRef.current = null }
  }, [comparison, scenario])

  useEffect(() => {
    if (comparison && snapshot && comparisonClientRef.current && snapshot.timeSeconds > (compareSnapshot?.timeSeconds ?? 0) + 300) comparisonClientRef.current.runTo(snapshot.timeSeconds)
  }, [comparison, snapshot?.timeSeconds])

  useEffect(() => {
    if (!motionPlaying) return
    let frame = 0
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = (now - start) / 1400
      const progress = Math.min(1, elapsed)
      setIllustration(Math.sin(Math.PI * progress) * motionIntensity)
      if (progress < 1) frame = requestAnimationFrame(animate)
      else { setIllustration(0); setMotionPlaying(false) }
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [motionPlaying, motionIntensity])

  useEffect(() => {
    if (!playback || history.length < 2) return
    const firstTime = history[Math.min(playbackIndex, history.length - 1)].snapshot.timeSeconds
    const startWall = performance.now()
    const id = window.setInterval(() => {
      const targetTime = firstTime + (performance.now() - startWall) / 1000 * playbackSpeed
      let index = 0
      while (index + 1 < history.length && history[index + 1].snapshot.timeSeconds <= targetTime) index++
      setPlaybackIndex(index)
      if (targetTime >= history[history.length - 1].snapshot.timeSeconds) setPlayback(false)
    }, 100)
    return () => window.clearInterval(id)
  }, [playback, playbackSpeed, history])

  useEffect(() => {
    if (!fastPlaying || !fastRun || fastRun.frames.length < 2) return
    const startTime = fastRun.frames[Math.min(fastIndex, fastRun.frames.length - 1)].eventTimeS
    const startWall = performance.now()
    const id = window.setInterval(() => {
      const targetTime = startTime + (performance.now() - startWall) / 1000 * fastPlaybackRate
      let index = 0
      while (index + 1 < fastRun.frames.length && fastRun.frames[index + 1].eventTimeS <= targetTime) index++
      setFastIndex(index)
      if (targetTime >= fastRun.frames[fastRun.frames.length - 1].eventTimeS) setFastPlaying(false)
    }, 16)
    return () => window.clearInterval(id)
  }, [fastPlaying, fastRun, fastPlaybackRate])

  const update = useCallback((path: string, value: unknown) => { setPreset('custom'); setScenario((old) => setPath(old, path, value)) }, [])
  const field = (path: string, label: string, min: number, max: number, step: number, unit = '', note = '', log = false, symbol?: string) => {
    const registryPath = path.replace(/\.\d+\./g, '[].')
    const meta = PARAMETER_REGISTRY.find((entry) => entry.path === registryPath)
    const metadataTitle = meta ? `${meta.name} (${meta.symbol}) · ${meta.units}. Basis: ${meta.basis}. Source: ${meta.source}. Dependencies: ${meta.dependencies.join(', ') || 'none'}. Status: ${meta.status}.` : note
    return <NumberControl key={path} label={label} value={finite(getPath(scenario, path))} min={min} max={max} step={step} unit={unit} note={note || meta?.basis} metadataTitle={metadataTitle} log={log} symbol={symbol ?? meta?.symbol} onChange={(v) => update(path, v)} />
  }

  const displayed = playback && history[playbackIndex] ? history[playbackIndex].snapshot : snapshot
  const alignedComparisonSnapshot = useMemo(() => {
    if (!comparison || !compareSnapshot || !history.length) return displayed
    const target = compareSnapshot.timeSeconds
    for (let i = history.length - 1; i >= 0; i--) if (history[i].snapshot.timeSeconds <= target + 1e-6) return history[i].snapshot
    return history[0].snapshot
  }, [comparison, compareSnapshot, history, displayed])
  const sceneFrame = useMemo(() => asSceneFrame(alignedComparisonSnapshot), [alignedComparisonSnapshot])
  const compareFrame = useMemo(() => asSceneFrame(compareSnapshot), [compareSnapshot])
  const fastFrame = fastRun?.frames[Math.min(fastIndex, Math.max(0, fastRun.frames.length - 1))] ?? null
  const mechanicsFrame = mechanicsFrames[Math.min(fastIndex, Math.max(0, mechanicsFrames.length - 1))] ?? null
  const mechanicsEstimate = mechanicsSizing(mechanicsResolution, fastDuration, scenario)
  const smokeRate = plumeSources.reduce((sum, p) => sum + p.smokeKgS, 0)
  const steamRate = plumeSources.reduce((sum, p) => sum + p.condensedSteamKgS, 0)
  const legendRange = useMemo(() => {
    const info = OVERLAY_INFO[overlay]
    if (!sceneFrame || fixedScale || comparison) return [info.min, info.max]
    const values = (sceneFrame.fields as Record<string, ArrayLike<number>>)[info.field]
    if (!values?.length) return [info.min, info.max]
    let lo = Infinity; let hi = -Infinity
    for (let i = 0; i < values.length; i++) {
      const raw = values[i]
      const value = overlay === 'pressure' ? raw - scenario.atmosphere.pressurePa : info.log ? Math.log10(Math.max(raw, 1e-30)) : raw
      if (Number.isFinite(value)) { lo = Math.min(lo, value); hi = Math.max(hi, value) }
    }
    return Number.isFinite(lo) && hi > lo ? [lo, hi] : [info.min, info.max]
  }, [sceneFrame, overlay, fixedScale, comparison, scenario.atmosphere.pressurePa])
  const probeValue = useMemo(() => sampleSnapshot(displayed, probe, scenario.atmosphere.pressurePa), [displayed, probe, scenario.atmosphere.pressurePa])
  const time = displayed?.timeSeconds ?? 0
  const progress = Math.min(100, time / (durationDays * DAY) * 100)
  const validation = useMemo(() => validateScenario(scenario), [scenario])
  const detailedGrid = {
    nx: Math.ceil(scenario.domain.widthM / 0.1),
    ny: Math.ceil(scenario.domain.lengthM / 0.1),
    nz: Math.ceil(scenario.domain.depthM / 0.1),
  }
  const detailedAvailable = detailedGrid.nx <= 64 && detailedGrid.ny <= 64 && detailedGrid.nz <= 48
    && detailedGrid.nx * detailedGrid.ny * detailedGrid.nz <= 131072
  const topCover = scenario.source.centerDepthM - diameterFromMass(scenario.source.initialMassKg, scenario.source.densityKgM3) / 2
  const sourcePower = heaterGeneration * (4 / 3 * Math.PI * Math.pow(scenario.source.supportRadiusM, 3))
  const pressureLoad = displayed?.diagnostics.sourcePressureLoadN
  const loadOutsideValidity = displayed?.diagnostics.sourcePressureLoadStatus === 'outside-validity'
  const shownPressureLoad = fastMode && fastFrame ? fastFrame.sourcePressureLoadN : pressureLoad
  const shownLoadOutsideValidity = fastMode && fastFrame ? fastFrame.status === 'validity-paused' || fastRun?.status === 'validity-paused' : loadOutsideValidity
  const activeSmolderCells = displayed?.diagnostics.reactingCellCount ?? 0
  const smolderStatus = activeSmolderCells > 0 ? 'Active modeled oxidation' : displayed && displayed.timeSeconds > 0 ? 'No active oxidation in latest step' : 'Initial hot peat seeded'

  const selectTab = (next: Tab) => { if (next === 'developer') { clientRef.current?.pause(); setPlaying(false); setPlayback(false) }; setTab(next); setFastMode(next === 'event' && Boolean(fastRun)); if (next === 'event') setComparison(false); else setFastPlaying(false) }

  const loadPreset = (key: ScenarioPreset) => { if (key === 'custom') return; setPreset(key); setScenario(clone(SCENARIOS[PRESET_KEYS[key]])); setOperationalEvents([]) }
  const start = () => { setPlayback(false); setPlaying(true); clientRef.current?.runTo(durationDays * DAY) }
  const pause = () => { clientRef.current?.pause(); setPlaying(false) }
  const reset = () => { pause(); setError(''); clientRef.current?.init(scenario); setSnapshot(null); setHistory([]); setPlayback(false); setOperationalEvents([]); setHeaterEnabled(scenario.source.enabled); setHeaterGeneration(scenario.source.heatGenerationWm3); setBoundaryOxygenInput(scenario.atmosphere.oxygenMoleFraction); setFastRun(null); setContinuumResult(null); setFastMode(false); setFastPlaying(false); lastRecordTime.current = -Infinity }
  const resetSettings = () => {
    pause()
    const defaults = createDefaultScenario()
    setScenario(defaults)
    setPreset('heated')
    setTab('setup')
    setSetupSection('source')
    setOverlay('temperature')
    setView('orbit')
    setSlice(0)
    setShowRoots(true)
    setShowFlow(false)
    setFixedScale(true)
    setProbe(null)
    setDurationDays(3)
    setPlayback(false)
    setPlaybackSpeed(30)
    setComputeRate(30)
    setRunToHour(24)
    setThroughput(0)
    setError('')
    setImportError('')
    setIllustration(0)
    setMotionIntensity(0.65)
    setMotionPlaying(false)
    setFastRun(null)
    setFastMode(false)
    setFastIndex(0)
    setFastPlaying(false)
    setFastPlaybackRate(1)
    setFastDuration(2)
    setFastFrameCount(61)
    setFastOverlay('pressure')
    setComparison(false)
    setSelectedPeat(0)
    setSelectedLayer(0)
    setSelectedHot(0)
    setSelectedPathway(0)
    setOperationalEvents([])
    setSnapshot(null)
    setHistory([])
    setHeaterEnabled(defaults.source.enabled)
    setHeaterGeneration(defaults.source.heatGenerationWm3)
    setBoundaryOxygenInput(defaults.atmosphere.oxygenMoleFraction)
    lastRecordTime.current = -Infinity
  }
  const toggleHeater = () => {
    const next = !heaterEnabled
    setHeaterEnabled(next)
    clientRef.current?.setHeater(next)
    setOperationalEvents((old) => [...old, { timeSeconds: snapshot?.timeSeconds ?? 0, type: 'heater-enabled', value: next }])
  }
  const changeHeaterGeneration = (value: number) => {
    if (snapshot && snapshot.timeSeconds > 0) {
      setHeaterGeneration(value)
      clientRef.current?.setHeaterGeneration(value)
      setOperationalEvents((old) => [...old, { timeSeconds: snapshot.timeSeconds, type: 'heater-generation', value }])
    } else update('source.heatGenerationWm3', value)
  }
  const applyBoundaryOxygen = () => {
    clientRef.current?.setAtmosphericOxygen(boundaryOxygenInput)
    setOperationalEvents((old) => [...old, { timeSeconds: snapshot?.timeSeconds ?? 0, type: 'atmospheric-oxygen', value: boundaryOxygenInput }])
  }
  const changeSourceDensity = (densityKgM3: number) => {
    setPreset('custom')
    setScenario((old) => {
      const diameterM = diameterFromMass(old.source.initialMassKg, old.source.densityKgM3)
      const boundedDiameterM = Math.min(diameterM, diameterFromMass(200, densityKgM3))
      return { ...old, source: { ...old.source, densityKgM3, initialMassKg: massFromDiameter(boundedDiameterM, densityKgM3) } }
    })
  }
  const triggerIllustration = () => {
    setOperationalEvents((old) => [...old, { timeSeconds: snapshot?.timeSeconds ?? 0, type: 'illustrative-soil-motion', value: { intensity: motionIntensity, status: 'illustrative only' } }])
    setMotionPlaying(true)
  }
  const convertRemainingDryIce = () => {
    if (!snapshot || snapshot.dryIceMassKg <= 0) return
    setPlayback(false)
    pause()
    clientRef.current?.startFastEvent({ convertRemainingDryIce: true, durationS: fastDuration, frameCount: fastFrameCount })
    setOperationalEvents((old) => [...old, { timeSeconds: snapshot.timeSeconds, type: 'dry-ice-convert-all', value: snapshot.dryIceMassKg }])
  }
  const runFastFromCurrent = () => {
    if (!snapshot) return
    setPlayback(false)
    pause()
    clientRef.current?.startFastEvent({ durationS: fastDuration, frameCount: fastFrameCount, convertRemainingDryIce: false })
  }
  const runSelectedMechanics = () => {
    if (!fastRun || (mechanicsResolution > 4 && !smallChecksPassed)) return
    if (mechanicsFrames.length > 0 && mechanicsProgress < 1 && mechanicsResolutionRef.current === mechanicsResolution) {
      setMechanicsRunning(true); clientRef.current?.resumeMechanics(); return
    }
    mechanicsResolutionRef.current = mechanicsResolution
    mechanicsChecksRef.current = null
    setMechanicsFrames([]); setMechanicsProgress(0); setMechanicsRunning(true); setFastPlaying(false)
    clientRef.current?.startMechanics(mechanicsResolution)
  }
  const replayFastEvent = () => { if (!fastRun) return; setTab('event'); setFastMode(true); setFastIndex(0); setFastPlaying(true); setComparison(false) }
  const exportFastEvent = () => {
    if (!fastRun) return
    download('zombie-fire-fast-event.json', JSON.stringify({ format: 'zombie-fire-fast-event', modelId: fastRun.modelId, status: fastRun.status, startSolverTimeS: fastRun.startSolverTimeS, durationS: fastRun.durationS, shellRadiusM: fastRun.shellRadiusM, sourceProjectedAreaM2: fastRun.sourceProjectedAreaM2, assumptions: fastRun.assumptions, diagnostics: fastRun.diagnostics, frames: fastRun.frames.map((frame) => ({ ...frame, shellPressurePa: Array.from(frame.shellPressurePa), shellCO2MoleFraction: Array.from(frame.shellCO2MoleFraction), shellYieldIndex: Array.from(frame.shellYieldIndex), shellDamage: Array.from(frame.shellDamage) })), note: 'Radial gas pressure and CO2 are reduced model outputs. Shell damage is illustrative. Separate calculated vertical mechanics frames use assumed parameters and do not predict validated rupture or blast.' }, null, 2), 'application/json')
  }
  const chooseProbe = (p: ProbeLocation) => { setProbe(p); setHistory((old) => old.map((item) => ({ ...item, probe: sampleSnapshot(item.snapshot, p, scenario.atmosphere.pressurePa) }))) }
  const chooseScenarioFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const candidate = parsed.scenario ?? parsed
      const result = validateScenario(candidate)
      if (!result.valid) throw new Error(result.errors.join('; '))
      setScenario(candidate)
      setPreset('custom')
      setOperationalEvents(Array.isArray(parsed.operationalEvents) ? parsed.operationalEvents : [])
      setImportError('')
    } catch (e) { setImportError(`Import rejected: ${e instanceof Error ? e.message : String(e)}`) }
    event.target.value = ''
  }
  const exportConfig = () => download('zombie-fire-scenario.json', JSON.stringify({ format: 'zombie-fire-scenario', schemaVersion: 1, scenario, operationalEvents, modelStatus: { transport: 'implemented reduced model', soilMotion: 'illustrative only', rupture: 'not modeled', pressureLoad: 'algebraic pressure-area force proxy, not soil force or blast prediction' }, units: 'SI' }, null, 2), 'application/json')
  const exportCsv = () => {
    const rows = ['time_s,dry_ice_mass_kg,heater_power_W,heater_energy_J,peak_temp_C,total_fuel_kg,fuel_consumed_kg,reaction_power_W,cumulative_reaction_heat_J,reacting_cell_count,co2_input_kg,co2_outflow_kg,gas_residual_mol,source_energy_residual_J,near_source_excess_pressure_Pa,assumed_projected_area_m2,modeled_pressure_load_N,pressure_load_status,conversion_intervention_energy_J,probe_temp_C,probe_o2_mole_fraction,probe_co2_mole_fraction']
    for (const item of history) {
      const s = item.snapshot; const p = item.probe
      rows.push([s.timeSeconds, s.dryIceMassKg, s.heaterPowerW, s.heaterEnergyJ, s.peakTemperatureK - 273.15, s.totalFuelKg, s.diagnostics.cumulativeFuelConsumedKg, s.diagnostics.lastReactionPowerW, s.diagnostics.cumulativeReactionHeatJ, s.diagnostics.reactingCellCount, s.diagnostics.cumulativeCO2InputKg, s.diagnostics.cumulativeCO2OutflowKg, s.diagnostics.gasBalanceResidualMol, s.diagnostics.sourceEnergyResidualJ, s.diagnostics.sourceExcessPressurePa, s.diagnostics.sourceProjectedAreaM2, s.diagnostics.sourcePressureLoadN, s.diagnostics.sourcePressureLoadStatus, s.diagnostics.cumulativeInterventionEnergyJ, p ? p.temperatureK - 273.15 : '', p?.oxygenMoleFraction ?? '', p?.co2MoleFraction ?? ''].join(','))
    }
    download('zombie-fire-history.csv', rows.join('\n'), 'text/csv')
  }
  const exportRecording = () => download('zombie-fire-recording.json', JSON.stringify({ format: 'zombie-fire-recording', schemaVersion: 1, scenario, operationalEvents, checkpoints: history.map((c) => ({ ...c.snapshot, fields: Object.fromEntries(Object.entries(c.snapshot.fields).map(([k, a]) => [k, Array.from(a)])), probe: c.probe })), note: 'Sparse solver checkpoints. Playback does not create new physical states. Pressure load is a pressure-area proxy and may be outside reduced-model validity.' }), 'application/json')
  const screenshot = () => {
    const canvas = document.querySelector('.scene-canvas canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'zombie-fire-scene.png'; a.click()
  }

  const setMineralFraction = (key: 'sandFraction' | 'siltFraction' | 'clayFraction', value: number) => {
    const keys = ['sandFraction', 'siltFraction', 'clayFraction'] as const
    const other = keys.filter((k) => k !== key)
    const sum = scenario.soil[other[0]] + scenario.soil[other[1]]
    const remainder = 1 - value
    const soil = { ...scenario.soil, [key]: value, [other[0]]: sum > 0 ? remainder * scenario.soil[other[0]] / sum : remainder / 2, [other[1]]: sum > 0 ? remainder * scenario.soil[other[1]] / sum : remainder / 2 }
    setPreset('custom'); setScenario((old) => ({ ...old, soil }))
  }

  const applySoilPreset = (key: keyof typeof SOIL_PRESETS) => { setPreset('custom'); setScenario((old) => applyPresetToScenario(old, key)) }

  const peat = scenario.peatRegions[selectedPeat]
  const hot = scenario.hotRegions[selectedHot]
  const path = scenario.pathways[selectedPathway]
  const addPeat = () => setScenario((old) => ({ ...old, peatRegions: [...old.peatRegions, { ...clone(old.peatRegions[0]), id: `peat-${Date.now()}`, centerXM: Math.min(4.5, 3 + old.peatRegions.length * 0.4) }] }))
  const addHot = () => setScenario((old) => ({ ...old, hotRegions: [...old.hotRegions, { ...clone(old.hotRegions[0]), id: `hot-${Date.now()}`, centerXM: Math.min(4.5, 3 + old.hotRegions.length * 0.3) }] }))
  const addPath = () => setScenario((old) => ({ ...old, pathways: [...old.pathways, { id: `path-${Date.now()}`, centerXM: 3.048, centerYM: 3.048, centerDepthM: 1.5, sizeXM: 0.3, sizeYM: 0.3, thicknessM: 1.5, rotationDeg: 0, permeabilityMultiplier: 12 }] }))
  const removeAt = (array: 'peatRegions' | 'hotRegions' | 'pathways', i: number) => setScenario((old) => ({ ...old, [array]: old[array].filter((_, n) => n !== i) }))
  const changeDepth = (value: number) => { setPreset('custom'); setScenario((old) => ({ ...old, domain: { ...old.domain, depthM: value }, soilLayers: old.soilLayers.map((layer) => ({ ...layer, thicknessM: layer.thicknessM * value / old.domain.depthM })) })) }
  const changeLayerThickness = (index: number, value: number) => {
    setPreset('custom')
    setScenario((old) => {
      const layers = old.soilLayers.map((l) => ({ ...l }))
      if (layers.length < 2) return old
      const partner = index === layers.length - 1 ? index - 1 : layers.length - 1
      const fixed = layers.reduce((sum, layer, i) => sum + (i === index || i === partner ? 0 : layer.thicknessM), 0)
      const constrained = Math.max(0.1, Math.min(old.domain.depthM - fixed - 0.1, value))
      layers[index].thicknessM = constrained
      layers[partner].thicknessM = old.domain.depthM - fixed - constrained
      return { ...old, soilLayers: layers }
    })
  }
  const addLayer = () => { setPreset('custom'); setScenario((old) => { const layers = old.soilLayers.map((l) => ({ ...l })); const last = layers[layers.length - 1]; if (last.thicknessM < 0.25) return old; last.thicknessM /= 2; layers.push({ ...last, id: `soil-layer-${Date.now()}`, thicknessM: last.thicknessM }); return { ...old, soilLayers: layers } }) }
  const removeLayer = (index: number) => { if (scenario.soilLayers.length <= 1) return; setPreset('custom'); setScenario((old) => { const layers = old.soilLayers.map((l) => ({ ...l })); const removed = layers.splice(index, 1)[0]; layers[Math.min(index, layers.length - 1)].thicknessM += removed.thicknessM; return { ...old, soilLayers: layers } }); setSelectedLayer(0) }
  const layer = scenario.soilLayers[selectedLayer]

  const openStudy = () => {
    pause()
    comparisonClientRef.current?.pause()
    setPlayback(false)
    setFastPlaying(false)
    setMotionPlaying(false)
    setWorkspace('study')
  }

  if (workspace === 'study') return <Suspense fallback={<div className="study-boot" role="status">Opening scene studio…</div>}>
    <StudyWorkspace onOpenSimulation={() => setWorkspace('simulation')} />
  </Suspense>

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Waves size={21} strokeWidth={2.1} /></span><div><strong>ZOMBIE FIRE</strong><small>SUPPRESSION SIM <span>v0.4</span></small></div></div>
      <div className="topbar-center"><span className="research-badge"><Activity size={14} /> Exploratory animation — reduced, unvalidated physics</span></div>
      <div className="topbar-actions"><button className="secondary-btn" type="button" onClick={openStudy}><Layers3 size={15} /> Scene studio</button><span className="session-time"><Clock3 size={15} /> {formatClock(time)}</span><IconButton title="Model information" onClick={() => setShowInfo(true)}><BookOpen size={18} /></IconButton></div>
    </header>

    <nav className="workflow-tabs" role="tablist" aria-label="App sections">
      {([['setup', 'Setup', 'Choose materials'], ['simulation', 'Simulation', 'Run and explore'], ['results', 'Results', 'Inspect and export'], ['event', 'Event', 'Short-time response'], ['developer', 'Developer', 'Materials & limits']] as [Tab, string, string][]).map(([id, label, detail], index) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => selectTab(id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong><small>{detail}</small></button>)}
    </nav>

    {tab === 'developer' ? <DeveloperTools scenario={scenario} onApply={next => { pause(); setPreset('custom'); setScenario(next); setOperationalEvents([]) }} /> : <div className="workspace">
      <aside className="sidebar left-sidebar">
        <div className="panel-heading"><div><small>{tab === 'setup' ? 'MODEL INPUTS' : tab === 'simulation' ? 'RUN CONTROLS' : tab === 'results' ? 'ANALYSIS' : 'SHORT-TIME MODEL'}</small><h2>{tab === 'setup' ? 'Scenario setup' : tab === 'simulation' ? 'Explore the run' : tab === 'results' ? 'Recorded results' : 'Gas and soil event'}</h2></div><Settings2 size={18} /></div>
        {tab === 'setup' && <><div className="scenario-select"><label htmlFor="scenario-preset">DEMONSTRATION SCENARIO</label><select id="scenario-preset" value={preset} onChange={(e) => loadPreset(e.target.value as ScenarioPreset)}><option value="custom">Custom scenario</option><option value="untreated">Untreated smoldering</option><option value="cold">Dry ice · heater off</option><option value="heated">Dry ice · heater on</option><option value="wet">Wet, low permeability</option><option value="pathway">Hypothetical pathway</option></select><p>{scenario.description}</p></div><div className="setup-category"><label htmlFor="setup-category">EDIT PART OF SCENARIO</label><select id="setup-category" value={setupSection} onChange={(e) => setSetupSection(e.target.value as SetupSection)}><option value="source">Dry ice and heater</option><option value="ground">Soil and peat</option><option value="fire">Smoldering and pathways</option><option value="boundary">Air and boundaries</option><option value="advanced">Advanced model</option></select></div></>}
        <div className="controls-scroll" ref={controlsScrollRef}>
          {tab === 'setup' && setupSection === 'source' && <>
            <div className="tab-intro"><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><p>Dry ice sublimates from finite stored mass. Heat is applied over a fixed numerical support volume.</p></div>
            <Section title="Buried dry ice" detail="Initial condition" open>
              {field('source.centerXM', 'East / west position', 0, 6.096, 0.05, 'm', 'Coordinates run from 0 to 6.096 m.', false, 'x')}
              {field('source.centerYM', 'North / south position', 0, 6.096, 0.05, 'm', 'Coordinates run from 0 to 6.096 m.', false, 'y')}
              {field('source.centerDepthM', 'Center burial depth', 0.2, scenario.domain.depthM - 0.1, 0.05, 'm', 'Positive downward.', false, 'z')}
              <NumberControl label="Initial sphere diameter" symbol="d₀" value={diameterFromMass(scenario.source.initialMassKg, scenario.source.densityKgM3)} min={0} max={Math.min(scenario.domain.depthM, 2, diameterFromMass(200, scenario.source.densityKgM3))} step={0.005} unit="m" note="Sphere diameter determines initial volume. Mass follows from diameter and density." onChange={(v) => update('source.initialMassKg', massFromDiameter(v, scenario.source.densityKgM3))} />
              <NumberControl label="Dry-ice density" symbol="ρ" value={scenario.source.densityKgM3} min={1200} max={1650} step={10} unit="kg/m³" note="Changing density keeps the selected diameter and recalculates mass." onChange={changeSourceDensity} />
              {field('source.initialTemperatureK', 'Initial source temperature', 150, resolveMaterials(scenario).co2SublimationK, 0.1, 'K', 'Near-atmospheric reduced sublimation range only.')}
              <div className="derived-row"><span>Top-of-sphere cover</span><strong>{topCover.toFixed(2)} m</strong></div>
            </Section>
            <Section title="Core heater" detail="Fixed support volume">
              <div className="toggle-row"><div><strong>Heater enabled</strong><small>Operational on/off event during a run</small></div><button type="button" role="switch" aria-checked={heaterEnabled} className={`switch ${heaterEnabled ? 'on' : ''}`} onClick={toggleHeater}><span /></button></div>
              <NumberControl label="Volumetric heat generation" symbol="q‴" value={heaterGeneration} min={0} max={200000} step={100} unit="W/m³" note="Fixed support volume. This is power per volume, not a temperature difference. During a run, edits are recorded as operational events." onChange={changeHeaterGeneration} />
              {field('source.supportRadiusM', 'Support radius', 0.05, 0.5, 0.01, 'm', 'Fixed during the run; independent of the shrinking source.')}
              {field('source.startTimeS', 'Start time', 0, 7 * DAY, 3600, 's', 'Heater schedule, measured from initial time.')}
              {field('source.durationS', 'Duration', 0, 7 * DAY, 3600, 's', 'Prescribed on interval.')}
              <div className="derived-row"><span>Nominal heater power</span><strong>{sourcePower.toFixed(1)} W</strong></div>
            </Section>
          </>}
          {tab === 'setup' && setupSection === 'ground' && <>
            <div className="tab-intro"><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><p>Mineral texture fractions are dry mineral mass fractions and always sum to one. Organic fraction uses total dry bulk mass.</p></div>
            <Section title="Soil volume" detail="6.096 × 6.096 m" open>
              <NumberControl label="Soil depth" value={scenario.domain.depthM} min={1} max={6} step={0.1} unit="m" note="All layer thicknesses scale with a depth edit; this is the computational vertical extent." onChange={changeDepth} />
              <div className="preset-row"><span>Property preset</span>{(['sandy', 'silty', 'clayey', 'organic'] as const).map((p) => <button key={p} type="button" onClick={() => applySoilPreset(p)}>{p}</button>)}</div>
              <button className="secondary-btn full" type="button" onClick={() => selectTab('developer')}>Choose a research material profile</button>
              {(['sandFraction', 'siltFraction', 'clayFraction'] as const).map((key) => <NumberControl key={key} label={`${key.replace('Fraction', '')} · mineral fraction`} value={scenario.soil[key]} min={0} max={1} step={0.01} unit="mass" note="Other mineral fractions renormalize proportionally." onChange={(v) => setMineralFraction(key, v)} />)}
              <div className="derived-row"><span>Mineral fraction sum</span><strong>{(scenario.soil.sandFraction + scenario.soil.siltFraction + scenario.soil.clayFraction).toFixed(3)}</strong></div>
              {field('soil.organicFraction', 'Organic matter', 0, 1, 0.01, 'dry mass', 'Root fuel supplements the organic material; it is tracked separately.')}
              {field('soil.bulkDensityKgM3', 'Dry bulk density', 50, 2500, 10, 'kg/m³')}
              {field('soil.porosity', 'Porosity', 0.051, 0.949, 0.01, 'volume')}
              {field('soil.moistureSaturation', 'Moisture saturation', 0, 0.99, 0.01, 'pore vol.')}
              {field('soil.compaction', 'Compaction modifier', 0, 1, 0.01, 'index', 'Demonstration permeability relation; not calibrated mechanics.')}
              {field('soil.intrinsicPermeabilityHorizontalM2', 'Horizontal permeability', 1e-16, 1e-9, 1e-16, 'm²', 'Intrinsic permeability; logarithmic slider.', true, 'kₕ')}
              {field('soil.intrinsicPermeabilityVerticalM2', 'Vertical permeability', 1e-16, 1e-9, 1e-16, 'm²', 'Intrinsic permeability; logarithmic slider.', true, 'kᵥ')}
            </Section>
            <Section title="Soil layers" detail={`${scenario.soilLayers.length} layers · sum ${scenario.soilLayers.reduce((sum, item) => sum + item.thicknessM, 0).toFixed(2)} m`} open>
              <div className="region-toolbar"><select aria-label="Soil layer" value={selectedLayer} onChange={(e) => setSelectedLayer(Number(e.target.value))}>{scenario.soilLayers.map((item, i) => <option key={item.id} value={i}>{item.id}</option>)}</select><button onClick={addLayer} type="button">+ Add</button><button onClick={() => removeLayer(selectedLayer)} type="button" disabled={scenario.soilLayers.length <= 1}>Remove</button></div>
              {layer && <><NumberControl label="Layer thickness" value={layer.thicknessM} min={0.1} max={scenario.domain.depthM - 0.1 * Math.max(0, scenario.soilLayers.length - 1)} step={0.01} unit="m" note="Another layer adjusts so total thickness always matches domain depth." onChange={(v) => changeLayerThickness(selectedLayer, v)} />
              {field(`soilLayers.${selectedLayer}.dryDensityMultiplier`, 'Dry density multiplier', 0.2, 3, 0.01, '×')}{field(`soilLayers.${selectedLayer}.porosityOffset`, 'Porosity offset', -0.25, 0.25, 0.01, 'fraction')}{field(`soilLayers.${selectedLayer}.moistureSaturationOffset`, 'Moisture saturation offset', -0.5, 0.5, 0.01, 'fraction')}{field(`soilLayers.${selectedLayer}.permeabilityMultiplier`, 'Permeability multiplier', 0.01, 100, 0.01, '×', 'Applied to intrinsic horizontal and vertical permeability.', true)}{field(`soilLayers.${selectedLayer}.thermalConductivityMultiplier`, 'Conductivity multiplier', 0.2, 3, 0.01, '×')}</>}
            </Section>
            <Section title="Peat regions" detail={`${scenario.peatRegions.length} region${scenario.peatRegions.length === 1 ? '' : 's'}`} open>
              <div className="region-toolbar"><select aria-label="Peat region" value={selectedPeat} onChange={(e) => setSelectedPeat(Number(e.target.value))}>{scenario.peatRegions.map((p, i) => <option key={p.id} value={i}>Peat {i + 1}</option>)}</select><button onClick={addPeat} type="button">+ Add</button><button onClick={() => { removeAt('peatRegions', selectedPeat); setSelectedPeat(0) }} type="button" disabled={scenario.peatRegions.length <= 1}>Remove</button></div>
              {peat && <><div className="select-row"><label>Shape</label><select value={peat.shape} onChange={(e) => update(`peatRegions.${selectedPeat}.shape`, e.target.value)}><option value="ellipsoid">Ellipsoid</option><option value="slab">Layer / slab</option><option value="irregular">Seeded irregular</option></select></div>
              {field(`peatRegions.${selectedPeat}.centerXM`, 'Center X', 0, 6.096, 0.05, 'm')}{field(`peatRegions.${selectedPeat}.centerYM`, 'Center Y', 0, 6.096, 0.05, 'm')}{field(`peatRegions.${selectedPeat}.centerDepthM`, 'Center depth', 0.1, scenario.domain.depthM - 0.1, 0.05, 'm')}
              {field(`peatRegions.${selectedPeat}.sizeXM`, 'Width X', 0.2, 6, 0.05, 'm')}{field(`peatRegions.${selectedPeat}.sizeYM`, 'Length Y', 0.2, 6, 0.05, 'm')}{field(`peatRegions.${selectedPeat}.thicknessM`, 'Thickness', 0.1, scenario.domain.depthM, 0.05, 'm')}{field(`peatRegions.${selectedPeat}.rotationDeg`, 'Orientation', -180, 180, 1, '°')}
              {field(`peatRegions.${selectedPeat}.organicFraction`, 'Organic fraction', 0, 1, 0.01, 'dry mass')}{field(`peatRegions.${selectedPeat}.bulkDensityKgM3`, 'Dry bulk density', 100, 1200, 10, 'kg/m³')}{field(`peatRegions.${selectedPeat}.moistureSaturation`, 'Moisture saturation', 0, 0.99, 0.01, 'pore vol.')}{field(`peatRegions.${selectedPeat}.seed`, 'Irregularity seed', 0, 99999, 1, '')}</>}
            </Section>
            <Section title="Roots" detail="Supplemental fuel">
              {field('root.amountKgM3', 'Root fuel near surface', 0, 30, 0.1, 'kg/m³', 'Additional root inventory; it does not replace peat fuel.')}
              {field('root.meanDepthM', 'Mean root depth', 0.05, 3, 0.05, 'm')}
              {field('root.distributionDepthM', 'Depth spread', 0.05, 3, 0.05, 'm')}
              {field('root.thicknessM', 'Typical thickness', 0.001, 0.05, 0.001, 'm', 'Visual and material descriptor; reduced model uses distributed fuel.')}
              {field('root.seed', 'Deterministic seed', 0, 99999, 1)}
            </Section>
          </>}
          {tab === 'setup' && setupSection === 'fire' && <>
            <div className="tab-intro"><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><p>Hot regions initialize temperature and fuel. They are not held hot after the run begins.</p></div>
            <Section title="Initial smoldering" detail={`${scenario.hotRegions.length} region${scenario.hotRegions.length === 1 ? '' : 's'}`} open>
              <div className="region-toolbar"><select aria-label="Hot region" value={selectedHot} onChange={(e) => setSelectedHot(Number(e.target.value))}>{scenario.hotRegions.map((h, i) => <option key={h.id} value={i}>Hot region {i + 1}</option>)}</select><button onClick={addHot} type="button">+ Add</button><button onClick={() => { removeAt('hotRegions', selectedHot); setSelectedHot(0) }} type="button" disabled={scenario.hotRegions.length <= 1}>Remove</button></div>
              {hot && <><div className="select-row"><label>Shape</label><select value={hot.shape} onChange={(e) => update(`hotRegions.${selectedHot}.shape`, e.target.value)}><option value="ellipsoid">Ellipsoid</option><option value="slab">Slab</option></select></div>
              {field(`hotRegions.${selectedHot}.centerXM`, 'Center X', 0, 6.096, 0.05, 'm')}{field(`hotRegions.${selectedHot}.centerYM`, 'Center Y', 0, 6.096, 0.05, 'm')}{field(`hotRegions.${selectedHot}.centerDepthM`, 'Center depth', 0.1, scenario.domain.depthM - 0.1, 0.05, 'm')}
              {field(`hotRegions.${selectedHot}.sizeXM`, 'Width X', 0.1, 3, 0.05, 'm')}{field(`hotRegions.${selectedHot}.sizeYM`, 'Length Y', 0.1, 3, 0.05, 'm')}{field(`hotRegions.${selectedHot}.thicknessM`, 'Thickness', 0.1, 2, 0.05, 'm')}
              {field(`hotRegions.${selectedHot}.temperatureC`, 'Initial temperature', 20, 500, 1, '°C')}{field(`hotRegions.${selectedHot}.fuelFraction`, 'Available local fuel', 0, 1, 0.01, 'fraction')}</>}
            </Section>
            <Section title="Modeled pathways" detail="Assumed geometry">
              <p className="control-note block">Pathway changes initialize a new transport run. They are assumptions, not predicted soil damage.</p>
              <div className="region-toolbar"><select aria-label="Pathway" value={selectedPathway} onChange={(e) => setSelectedPathway(Number(e.target.value))}>{scenario.pathways.length ? scenario.pathways.map((p, i) => <option key={p.id} value={i}>Pathway {i + 1}</option>) : <option value={0}>None</option>}</select><button type="button" onClick={addPath}>+ Add</button><button type="button" disabled={!path} onClick={() => { removeAt('pathways', selectedPathway); setSelectedPathway(0) }}>Remove</button></div>
              {path && <>{field(`pathways.${selectedPathway}.centerXM`, 'Center X', 0, 6.096, 0.05, 'm')}{field(`pathways.${selectedPathway}.centerYM`, 'Center Y', 0, 6.096, 0.05, 'm')}{field(`pathways.${selectedPathway}.centerDepthM`, 'Center depth', 0.1, scenario.domain.depthM - 0.1, 0.05, 'm')}{field(`pathways.${selectedPathway}.sizeXM`, 'Width X', 0.05, 2, 0.05, 'm')}{field(`pathways.${selectedPathway}.sizeYM`, 'Length Y', 0.05, 2, 0.05, 'm')}{field(`pathways.${selectedPathway}.thicknessM`, 'Thickness', 0.1, 3, 0.05, 'm')}{field(`pathways.${selectedPathway}.rotationDeg`, 'Orientation', -180, 180, 1, '°')}{field(`pathways.${selectedPathway}.permeabilityMultiplier`, 'Permeability multiplier', 1, 1000, 1, '×', 'Logarithmic artistic scenario control on an assumed geometry.', true)}</>}
            </Section>
          </>}
          {tab === 'setup' && setupSection === 'boundary' && <>
            <div className="tab-intro"><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><p>The default surface exchanges with the atmosphere. Side boundaries are selectable computational conditions.</p></div>
            <Section title="Initial and boundary gas" open>
              {field('atmosphere.oxygenMoleFraction', 'Atmospheric O₂', 0, 0.3, 0.001, 'mole frac.')}{field('atmosphere.co2MoleFraction', 'Atmospheric CO₂', 0, 0.1, 0.0001, 'mole frac.')}{field('atmosphere.waterVaporMoleFraction', 'Water vapor', 0, 0.1, 0.001, 'mole frac.')}{field('atmosphere.pressurePa', 'Ambient pressure', 80000, 120000, 100, 'Pa')}{field('atmosphere.exchangeVelocityMS', 'Surface gas exchange', 1e-8, 1e-3, 1e-8, 'm/s', 'Open surface exchange coefficient.', true)}
              <div className="select-row"><label>Top gas boundary</label><select value={scenario.atmosphere.topGasBoundary} onChange={(e) => update('atmosphere.topGasBoundary', e.target.value)}><option value="atmospheric">Open atmosphere</option><option value="noFlux">No flux</option></select></div>
              <div className="select-row"><label>Side gas boundary</label><select value={scenario.atmosphere.sideGasBoundary} onChange={(e) => update('atmosphere.sideGasBoundary', e.target.value)}><option value="noFlux">No flux</option><option value="atmospheric">Atmospheric exchange</option></select></div>
            </Section>
            <Section title="Thermal boundaries" open>
              {field('atmosphere.temperatureC', 'Atmospheric temperature', -20, 50, 0.5, '°C')}{field('atmosphere.deepTemperatureC', 'Deep ground temperature', -10, 40, 0.5, '°C')}{field('atmosphere.surfaceHeatTransferWm2K', 'Surface heat transfer', 0, 40, 0.1, 'W/m²/K')}{field('atmosphere.bottomHeatTransferWm2K', 'Bottom heat transfer', 0, 20, 0.1, 'W/m²/K')}
            </Section>
          </>}
          {tab === 'setup' && setupSection === 'advanced' && <>
            <div className="tab-intro"><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><p>These reduced coefficients include demonstration assumptions. See the source and parameter reference in the repository.</p></div>
            <Section title="Grid quality" detail="Reset required" open><div className="quality-grid">{([['Low', 12, 12, 8], ['Medium', 18, 18, 12], ['High', 24, 24, 16], ['Detailed ≤10 cm', detailedGrid.nx, detailedGrid.ny, detailedGrid.nz]] as const).map(([name, nx, ny, nz]) => <button className={scenario.domain.nx === nx && scenario.domain.ny === ny && scenario.domain.nz === nz ? 'selected' : ''} key={name} type="button" disabled={name === 'Detailed ≤10 cm' && !detailedAvailable} onClick={() => { setScenario((old) => ({ ...old, domain: { ...old.domain, nx, ny, nz } })); setPreset('custom') }}>{name}<small>{nx}×{ny}×{nz}</small></button>)}</div><p className="control-note block">Each volume gets properties from its soil layer, peat region, roots, and assumed pathway. Detailed mode uses cells no wider than 10 cm on the configured domain where the browser limit permits; it needs more memory and physical computation time. Editing quality restarts the run.</p></Section>
            <Section title="Material properties and physical limits" open><p className="control-note block">Use Developer tools to review sources, edit thermal, transport, reaction and mechanics values, and set supported solver limits.</p><button className="secondary-btn full" type="button" onClick={() => selectTab('developer')}>Open Developer tools</button></Section>
          </>}
          {tab === 'simulation' && <>
            <div className="tab-intro"><StatusChip kind="reduced">SLOW 3D MODEL</StatusChip><p>Start, pause, and scrub the physical run in the time bar. The cutaway shows the selected modeled field.</p></div>
            <Section title="Run controls" detail="Physical solver clock" open>
              <button className="primary-btn full" type="button" onClick={playing ? pause : start} disabled={!validation.valid}>{playing ? 'Pause simulation' : snapshot?.timeSeconds ? 'Continue simulation' : 'Start simulation'}</button>
              <button className="secondary-btn full" type="button" onClick={reset}><RotateCcw size={14} /> Reset physical run</button>
              <div className="derived-row"><span>Current solver time</span><strong>{formatClock(time)}</strong></div>
              <div className="derived-row"><span>Target duration</span><strong>{durationDays} day{durationDays === 1 ? '' : 's'}</strong></div>
              <p className="control-note block">Reset physical run restarts the current scenario. Reset settings in Setup restores all default inputs and display choices.</p>
            </Section>
            <Section title="Operational heater" detail="During the run">
              <div className="toggle-row"><div><strong>Heater enabled</strong><small>Changes are recorded as events</small></div><button type="button" role="switch" aria-checked={heaterEnabled} className={`switch ${heaterEnabled ? 'on' : ''}`} onClick={toggleHeater}><span /></button></div>
              <NumberControl label="Volumetric heat generation" symbol="q‴" value={heaterGeneration} min={0} max={200000} step={100} unit="W/m³" note="During a run, edits are recorded as operational events." onChange={changeHeaterGeneration} />
            </Section>
            <Section title="Atmospheric oxygen benchmark" detail="Prescribed boundary composition">
              <NumberControl label="Boundary oxygen" value={boundaryOxygenInput} min={0} max={0.3} step={0.001} unit="mole frac." onChange={setBoundaryOxygenInput} note="A prescribed atmosphere change; the gas field evolves by transport after applying it." />
              <button className="secondary-btn full" type="button" onClick={applyBoundaryOxygen} disabled={!snapshot || boundaryOxygenInput > 1 - scenario.atmosphere.co2MoleFraction - scenario.atmosphere.waterVaporMoleFraction}>Apply oxygen boundary</button>
              <p className="control-note block">Use a low value temporarily, then restore the initial boundary value to examine source-free recovery and possible renewed oxidation. This is a benchmark boundary, not a dry-ice prediction.</p>
            </Section>
            <div className="tab-intro"><StatusChip kind="illustrative">ILLUSTRATIVE ONLY</StatusChip><p>Manual soil-piece motion is a separate visual event. Its timing and extent are unrelated to source settings or calculated pressure.</p></div>
            <Section title="Illustrative soil rearrangement" detail="Independent event" open>
              <NumberControl label="Artistic movement" value={motionIntensity} min={0.1} max={1} step={0.01} unit="visual" onChange={setMotionIntensity} note="Uncalibrated visual amount; no displacement prediction." />
              <button className="primary-btn full" type="button" onClick={triggerIllustration} disabled={motionPlaying}>Show soil opening and settling</button>
              <p className="motion-warning">Illustration — not a calculated shockwave. This event does not change the simulation.</p>
            </Section>
            <Section title="Physics scope" open><div className="status-list"><div><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><span>Heat, porous gas transport, smoldering, finite dry-ice inventory, and event soil mechanics</span></div><div><StatusChip kind="illustrative">ILLUSTRATIVE ONLY</StatusChip><span>Separate manual soil-piece movement</span></div><div><StatusChip kind="missing">NOT MODELED</StatusChip><span>Rupture, blast, calibrated geomechanics, char yield</span></div></div></Section>
          </>}
          {tab === 'results' && <>
            <div className="tab-intro"><StatusChip kind="reduced">RECORDED SOLVER STATE</StatusChip><p>Inspect modeled fields, a virtual sensor, conservation ledgers, and saved checkpoints. Results are exploratory and unvalidated.</p></div>
            <Section title="Compare heater effect" detail="Same initial conditions" open>
              <button className="secondary-btn full" type="button" onClick={() => setComparison((v) => !v)} disabled={fastMode}><ArrowLeftRight size={14} /> {comparison ? 'Close A/B comparison' : 'Compare with heater off'}</button>
              <p className="control-note block">Both views use the same field scale and linked camera. Comparison uses matched recorded solver times.</p>
            </Section>
            <Section title="Export results" detail={`${history.length} checkpoints`} open>
              <button className="secondary-btn full" type="button" onClick={exportCsv} disabled={!history.length}><Download size={14} /> History CSV</button>
              <button className="secondary-btn full" type="button" onClick={screenshot}><ArrowDownToLine size={14} /> Scene image</button>
              <button className="secondary-btn full" type="button" onClick={exportRecording} disabled={!history.length}><Download size={14} /> Recorded states JSON</button>
            </Section>
            <Section title="Model interpretation"><p className="control-note block">Pressure load is a pressure × assumed area proxy on an imaginary plane. It does not predict soil displacement, fracture, or blast force.</p></Section>
          </>}
          {tab === 'event' && <>
            <Section title="3D soil mechanics" detail="Mechanics only · prescribed top load" open>
              <p className="control-note block">Eight-node brick FEM solves three displacement components and equilibrium on a 4 × 4 × 4 mesh. Fire and dry ice are excluded from this calculation. The initial gravity state is equilibrated; top traction is prescribed, not predicted gas pressure. Material values are demonstration assumptions.</p>
              <NumberControl label="Downward top traction" value={continuumTractionPa} min={0} max={20000} step={100} unit="Pa" onChange={setContinuumTractionPa} />
              <button className="primary-btn full" type="button" onClick={() => { setFastMode(false); clientRef.current?.solveContinuum(continuumTractionPa) }} disabled={!snapshot || !validation.valid}>Calculate 3D deformation</button>
              {continuumResult && <div className="probe-readout"><div><span>Maximum nodal displacement</span><strong>{Math.max(...Array.from(continuumResult.displacementM, Math.abs)).toExponential(2)} m</strong></div><div><span>Yielded elements</span><strong>{continuumResult.yielded.reduce((a, b) => a + b, 0)} / 64</strong></div><div><span>Largest free force residual</span><strong>{continuumResult.residualN.toExponential(2)} N</strong></div><div><span>Top force</span><strong>{continuumResult.appliedForceN[2].toFixed(1)} N</strong></div><div><span>Base reaction</span><strong>{continuumResult.reactionN[2].toFixed(1)} N</strong></div></div>}
              <p className="control-note block">Displacement is drawn at 1× physical scale. Drucker-Prager shear plasticity retains permanent strain; it does not predict cracks, peat creep, or source-driven uplift.</p>
            </Section>
            <div className="tab-intro"><StatusChip kind="reduced">REDUCED SHORT-TIME GAS MODEL</StatusChip><p>This separate radial shell calculation spans at most two simulated seconds. It starts from the current 3D slow-run state and uses its own event clock.</p><StatusChip kind="reduced">CALCULATED VERTICAL SOIL MOTION</StatusChip><p>Lumped soil elements calculate pressure loading, gravity, inertia, elastic motion, and tensile yielding with assumed properties.</p></div>
            <Section title="Short-time event" detail="Separate solver clock" open>
              <NumberControl label="Event duration" value={fastDuration} min={0.1} max={2} step={0.05} unit="s" note="Bounded short-time calculation; independent of the multiday clock." onChange={setFastDuration} />
              <NumberControl label="Recorded frames" value={fastFrameCount} min={2} max={100} step={1} unit="frames" onChange={(v) => setFastFrameCount(Math.round(v))} />
              <button className="conversion-btn" type="button" onClick={convertRemainingDryIce} disabled={!snapshot || snapshot.dryIceMassKg <= 0 || !validation.valid}>Convert remaining dry ice to CO₂ + compute event</button>
              <p className="conversion-note">One-click numerical gas release. The slow-flow solver may pause at its validity limit; the separate event is a reduced radial calculation.</p>
              <button className="primary-btn full" type="button" onClick={runFastFromCurrent} disabled={!snapshot || !validation.valid}>Compute event from current slow state</button>
              <button className="secondary-btn full" type="button" onClick={replayFastEvent} disabled={!fastRun}>Replay recorded short event</button>
              <p className="control-note block">Gas pressure drives the mechanics run. The legacy damage index remains illustrative; displacement and yield are calculated separately.</p>
            </Section>
            <Section title="Soil mechanics" detail="Worker · live frames" open>
              <label className="control-note block" htmlFor="mechanics-resolution">Resolution: {mechanicsResolution} × {mechanicsResolution} × {mechanicsResolution}</label>
              <input id="mechanics-resolution" className="timeline-range" type="range" min={0} max={2} step={1} value={[4, 6, 8].indexOf(mechanicsResolution)} onChange={e => setMechanicsResolution(([4, 6, 8] as MechanicsResolution[])[Number(e.target.value)])} />
              <p className="control-note block">{mechanicsEstimate.elements} elements · {mechanicsEstimate.materialPoints} material points · ~{(mechanicsEstimate.estimatedMemoryBytes / 1024).toFixed(1)} KiB state · ~{mechanicsEstimate.expectedSteps} steps / {(mechanicsEstimate.elements * mechanicsEstimate.expectedSteps).toLocaleString()} element updates · stable Δt ≤ {mechanicsEstimate.stableStepS.toFixed(4)} s</p>
              <button className="primary-btn full" type="button" onClick={runSelectedMechanics} disabled={!fastRun || mechanicsRunning || (mechanicsResolution > 4 && !smallChecksPassed)}>{mechanicsFrames.length > 0 && mechanicsProgress < 1 && mechanicsResolutionRef.current === mechanicsResolution ? 'Resume mechanics' : 'Run selected resolution'}</button>
              <div className="file-actions"><button type="button" onClick={() => { clientRef.current?.pauseMechanics(); setMechanicsRunning(false) }} disabled={!mechanicsRunning}>Pause</button><button type="button" onClick={() => { clientRef.current?.cancelMechanics(); setMechanicsRunning(false); setMechanicsFrames([]); setMechanicsChecks(null); mechanicsChecksRef.current = null; setMechanicsProgress(0) }} disabled={!mechanicsRunning && mechanicsProgress === 0}>Cancel</button></div>
              <p className="control-note block">{mechanicsRunning ? 'Calculating' : mechanicsProgress >= 1 ? 'Complete' : 'Ready'} · {(mechanicsProgress * 100).toFixed(0)}% · {mechanicsSpeed.toFixed(2)} simulated s / wall s. {smallChecksPassed ? 'Small-mesh mass and momentum checks passed; choose a larger resolution and click Run.' : 'Larger runs unlock after the small run passes mass, momentum, and stability checks.'}</p>
              <div className="file-actions"><button type="button" onClick={() => setMechanicsView('displacement')}>Displacement</button><button type="button" onClick={() => setMechanicsView('yield')}>Yielded regions</button></div>
              {mechanicsFrame && <div className="probe-readout"><div><span>Maximum displacement</span><strong>{mechanicsFrame.maxDisplacementM.toFixed(4)} m</strong></div><div><span>Yielded elements</span><strong>{mechanicsFrame.yieldedElements}</strong></div><div><span>Solver time</span><strong>{mechanicsFrame.eventTimeS.toFixed(3)} s</strong></div><div><span>Bottom overburden</span><strong>{mechanicsChecks?.initialOverburdenPa.toFixed(0)} Pa</strong></div><div><span>Initial effective stress</span><strong>{mechanicsChecks?.initialEffectiveStressPa.toFixed(0)} Pa</strong></div><div><span>Momentum residual</span><strong>{mechanicsChecks?.maxMomentumResidualN.toExponential(2)} N</strong></div></div>}
              <p className="control-note block">Assumed E = 1 MPa, shear modulus = 0.35 MPa, Biot coefficient = 0.8, tensile limit = 20 kPa. Horizontal deformation and rupture paths remain unresolved.</p>
            </Section>
            <Section title="Smoke and steam" detail="Modeled source rates" open>
              <div className="file-actions"><label><input type="checkbox" checked={showSmoke} onChange={e => setShowSmoke(e.target.checked)} /> Smoke</label><label><input type="checkbox" checked={showSteam} onChange={e => setShowSteam(e.target.checked)} /> Steam</label></div>
              <label className="control-note block" htmlFor="plume-quality">Visual quality: {plumeQuality}</label><input id="plume-quality" className="timeline-range" type="range" min={1} max={6} value={plumeQuality} onChange={e => setPlumeQuality(Number(e.target.value))} />
              <p className="control-note block">Smoke {smokeRate.toExponential(2)} kg/s (assumed 2% particulate yield from modeled peat oxidation). Condensed steam {steamRate.toExponential(2)} kg/s from modeled water loss and atmospheric cooling. Plume shapes and entrainment are visual approximations. CO₂ remains invisible.</p>
            </Section>
            <Section title="Event results" detail={fastRun ? fastRun.status : 'No event recorded'}>
              {fastRun && fastFrame ? <div className="probe-readout"><div><span>Event clock</span><strong>{fastFrame.eventTimeS.toFixed(3)} s</strong></div><div><span>Slow-run start time</span><strong>{formatClock(fastRun.startSolverTimeS)}</strong></div><div><span>Near-source pressure load</span><strong>{formatLoad(fastFrame.sourcePressureLoadN)} N</strong></div><div><span>Maximum shell pressure</span><strong>{Math.max(...Array.from(fastFrame.shellPressurePa)).toFixed(0)} Pa</strong></div><div><span>Maximum yield index</span><strong>{Math.max(...Array.from(fastFrame.shellYieldIndex)).toFixed(3)} assumed</strong></div><div><span>Maximum damage index</span><strong>{Math.max(...Array.from(fastFrame.shellDamage)).toFixed(3)} illustrative</strong></div><div><span>Gas balance residual</span><strong>{fastRun.diagnostics.gasBalanceResidualMol.toExponential(2)} mol</strong></div><div><span>CO₂ balance residual</span><strong>{fastRun.diagnostics.co2BalanceResidualMol.toExponential(2)} mol</strong></div></div> : <p className="control-note block">Run an event to inspect the separate pressure and CO₂ shell histories.</p>}
              {fastRun?.diagnostics.warnings.map((warning, i) => <p key={i} className="event-warning">{warning}</p>)}
              {fastRun?.limitations.map((limitation, i) => <p key={`limit-${i}`} className="control-note block">{limitation}</p>)}
              <button className="secondary-btn full" type="button" onClick={exportFastEvent} disabled={!fastRun}><Download size={14} /> Export event JSON</button>
            </Section>
            <Section title="Fixed model assumptions" open>{fastRun ? <div className="probe-readout"><div><span>Spatial reduction</span><strong>8 radial groups</strong></div><div><span>Momentum</span><strong>Finite relaxation</strong></div><div><span>Overburden assumption</span><strong>{fastRun.assumptions.overburdenPa.toFixed(0)} Pa</strong></div><div><span>Cohesion assumption</span><strong>{fastRun.assumptions.cohesionPa.toFixed(0)} Pa</strong></div><div><span>Biot coefficient</span><strong>{fastRun.assumptions.biotCoefficient.toFixed(2)}</strong></div><div><span>Max supported pressure</span><strong>{fastRun.assumptions.maxSupportedPressurePa.toFixed(0)} Pa</strong></div></div> : <p className="control-note block">Fixed coefficients are reported with the computed event.</p>}</Section>
          </>}
        </div>
        {tab === 'setup' && <div className="sidebar-footer"><button className="reset-settings-btn" type="button" onClick={resetSettings}><RotateCcw size={15} /> Reset settings to defaults</button><div className="file-actions"><button type="button" onClick={() => importRef.current?.click()}><Upload size={15} /> Import</button><button type="button" onClick={exportConfig}><Save size={15} /> Save scenario</button></div><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={chooseScenarioFile} />{importError && <p className="error-text">{importError}</p>}{!validation.valid && <p className="error-text">{validation.errors.slice(0, 2).join('; ')}</p>}</div>}
        {tab !== 'setup' && !validation.valid && <div className="sidebar-footer"><p className="error-text">{validation.errors.slice(0, 2).join('; ')}</p><button className="secondary-btn full" type="button" onClick={() => selectTab('setup')}>Fix scenario settings</button></div>}
      </aside>

      <main className="main-view">
        <div className="view-toolbar"><div className="toolbar-group"><span className="toolbar-label">VIEW</span>{([['orbit', '3D orbit'], ['top', 'Top'], ['section-x', 'X section'], ['section-y', 'Y section']] as [View, string][]).map(([id, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}</div><div className="toolbar-group right"><IconButton title="Open the separate short-time event" active={fastMode} disabled={!fastRun} onClick={() => selectTab('event')}><Zap size={17} /></IconButton><IconButton title="Show modeled flow arrows (direction amplified)" active={showFlow} disabled={fastMode} onClick={() => setShowFlow((v) => !v)}><Waves size={17} /></IconButton><IconButton title="Show roots" active={showRoots} onClick={() => setShowRoots((v) => !v)}><Leaf size={17} /></IconButton><IconButton title="A/B comparison: same initial scenario and seed, heater off baseline" active={comparison} disabled={fastMode} onClick={() => setComparison((v) => !v)}><ArrowLeftRight size={17} /></IconButton></div></div>
        <div className={`scene-area ${comparison && !fastMode ? 'comparing' : ''}`}>
          <div className="scene-panel"><Scene scenario={{ ...scenario, source: { ...scenario.source, enabled: heaterEnabled, heatGenerationWm3: heaterGeneration } }} snapshot={sceneFrame} overlay={overlay} view={view} slice={slice} showRoots={showRoots} showFlow={showFlow} fixedScale={comparison || fixedScale} illustration={illustration} probe={probe} onProbe={chooseProbe} lockCamera={comparison && !fastMode} fastEvent={fastMode && fastRun && fastFrame ? { run: fastRun, frame: fastFrame, overlay: fastOverlay } : null} mechanics={fastMode ? mechanicsFrame : null} continuum={!fastMode && tab === 'event' ? continuumResult : null} mechanicsView={mechanicsView} plumes={plumeSources} showSmoke={showSmoke} showSteam={showSteam} plumeQuality={plumeQuality} /><div className="scene-tag">{fastMode ? 'SHORT-TIME GAS + SOIL MECHANICS' : comparison ? 'A · CURRENT SCENARIO' : 'UNDERGROUND CUTAWAY'}<span>{fastMode && fastFrame ? `event clock ${fastFrame.eventTimeS.toFixed(3)} s · slow clock held at ${formatClock(fastRun?.startSolverTimeS ?? 0)}` : comparison ? `matched checkpoint ${formatClock(alignedComparisonSnapshot?.timeSeconds ?? 0)} · linked camera` : view === 'orbit' ? 'drag to orbit · choose Top / X / Y to see fields and place a sensor' : 'drag to orbit · scroll to zoom · click colored field to place sensor'}</span></div>{!fastMode && activeSmolderCells > 0 && <div className="smolder-scene-tag">● SMOLDERING PEAT <span>{displayed?.diagnostics.lastReactionPowerW.toFixed(1)} W modeled reaction heat</span></div>}{scenario.pathways.length > 0 && <div className="hypothetical-tag">Assumed pathway geometry · hypothetical transport</div>}{fastMode && <div className="illustration-tag">CALCULATED VERTICAL MOTION · ASSUMED SOIL PROPERTIES · NO VALIDATED RUPTURE / BLAST</div>}{!fastMode && illustration > 0 && <div className="illustration-tag">ILLUSTRATION — NOT A CALCULATED SHOCKWAVE</div>}</div>
          {comparison && !fastMode && <div className="scene-panel"><Scene scenario={{ ...scenario, source: { ...scenario.source, enabled: false } }} snapshot={compareFrame} overlay={overlay} view={view} slice={slice} showRoots={showRoots} showFlow={showFlow} fixedScale={true} illustration={0} probe={probe} lockCamera /><div className="scene-tag">B · HEATER OFF BASELINE <span>same seed · {formatClock(compareSnapshot?.timeSeconds ?? 0)} · linked camera</span></div></div>}
        </div>
        {fastMode && fastRun && fastFrame && <div className="fast-event-bar">
          <div className="event-clock"><Zap size={16} /><span>SHORT EVENT</span><strong>{fastFrame.eventTimeS.toFixed(3)} / {fastRun.durationS.toFixed(2)} s</strong></div>
          <button className="event-play" type="button" onClick={() => setFastPlaying((v) => !v)}>{fastPlaying ? <Pause size={15} /> : <Play size={15} />}{fastPlaying ? 'Pause' : 'Play'}</button>
          <input className="event-scrub" type="range" min={0} max={Math.max(0, fastRun.frames.length - 1)} step={1} value={fastIndex} onChange={(e) => { setFastPlaying(false); setFastIndex(Number(e.target.value)) }} aria-label="Short event frame scrubber" />
          <select aria-label="Fast event overlay" value={fastOverlay} onChange={(e) => setFastOverlay(e.target.value as FastOverlay)}><option value="pressure">Shell pressure</option><option value="co2">Shell CO₂</option><option value="damage">Damage index · illustrative</option></select>
          <select aria-label="Fast event playback rate" value={fastPlaybackRate} onChange={(e) => setFastPlaybackRate(Number(e.target.value))}><option value={0.1}>0.1×</option><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select>
          <span className="event-force" title="Radial model pressure-area proxy, not blast or fracture force">LOAD {formatLoad(fastFrame.sourcePressureLoadN)} N</span>
        </div>}
        {!fastMode && (tab === 'simulation' || tab === 'results') && <div className="overlay-toolbar"><div className="overlay-title"><Layers3 size={17} /><span>FIELD OVERLAY</span></div><select value={overlay} onChange={(e) => setOverlay(e.target.value as Overlay)} aria-label="Field overlay">{OVERLAYS.map((o) => <option key={o} value={o}>{OVERLAY_INFO[o].label}</option>)}</select><span className="overlay-separator" /><label className="tiny-check"><input type="checkbox" checked={comparison || fixedScale} disabled={comparison} onChange={(e) => setFixedScale(e.target.checked)} /> Fixed scale</label><div className="slice-control"><span>CLIP</span><input type="range" min={-1} max={1} step={0.01} value={slice} onChange={(e) => setSlice(Number(e.target.value))} aria-label="Clipping plane position" /><strong>{slice.toFixed(2)}</strong></div><div className="color-scale"><span>{Number(legendRange[0].toPrecision(3))}</span><i /><span>{Number(legendRange[1].toPrecision(3))} {OVERLAY_INFO[overlay].unit}</span></div>{overlay === 'pressure' && <div className={`overlay-load ${loadOutsideValidity ? 'outside' : ''}`} title="Excess pore pressure × fixed heater support area; pressure-area force proxy, not rupture force">LOAD {formatLoad(pressureLoad)} N{loadOutsideValidity ? ' · outside validity' : ''}</div>}</div>}
      </main>

      <aside className="sidebar right-sidebar">
        <div className="panel-heading"><div><small>{tab === 'setup' ? 'AT A GLANCE' : tab === 'results' ? 'MODEL OUTPUTS' : tab === 'event' ? 'EVENT READOUT' : 'LIVE READOUT'}</small><h2>{tab === 'setup' ? 'Ready to simulate' : tab === 'results' ? 'Measured state' : tab === 'event' ? 'Short-time response' : 'Model state'}</h2></div><Gauge size={18} /></div>
        <div className="readout-scroll">
          {tab === 'setup' && <div className="setup-overview"><span className="eyebrow">CURRENT SCENARIO</span><h3>{scenario.name}</h3><p>{scenario.description}</p><div className="probe-readout"><div><span>Dry-ice diameter</span><strong>{diameterFromMass(scenario.source.initialMassKg, scenario.source.densityKgM3).toFixed(3)} m</strong></div><div><span>Soil layers</span><strong>{scenario.soilLayers.length}</strong></div><div><span>Peat regions</span><strong>{scenario.peatRegions.length}</strong></div><div><span>Initial hot regions</span><strong>{scenario.hotRegions.length}</strong></div><div><span>Grid</span><strong>{scenario.domain.nx} × {scenario.domain.ny} × {scenario.domain.nz}</strong></div></div><button className="primary-btn full" type="button" onClick={() => selectTab('simulation')} disabled={!validation.valid}>Continue to simulation</button><p className="control-note block">This is an exploratory reduced model. Change a setting to restart the physical run.</p></div>}
          {tab !== 'setup' && <>
          <div className="run-status"><span className={`status-dot ${displayed?.diagnostics.status ?? 'idle'}`} /> <strong>{displayed?.diagnostics.status === 'validity-paused' ? 'Validity limit reached' : displayed?.diagnostics.status === 'numerical-paused' ? 'Numerical pause' : playing ? 'Computing' : playback ? 'Recorded playback' : 'Ready / paused'}</strong><span>{formatClock(time)}</span></div>
          {fastMode && fastRun && fastFrame && <div className={`fast-readout ${fastRun.status}`}><div><Zap size={15} /><strong>SHORT EVENT · {fastFrame.eventTimeS.toFixed(3)} s</strong></div><p>{fastRun.status === 'validity-paused' ? 'Short-time validity limit reached. Shown values are outside the model range.' : 'Reduced radial gas pressure with calculated vertical soil response and assumed material values.'}</p></div>}
          {error && <div className="alert-box">{error}</div>}
          {displayed?.diagnostics.warnings?.length ? <div className="alert-box">{displayed.diagnostics.warnings[displayed.diagnostics.warnings.length - 1]}</div> : null}
          {(tab === 'simulation' || tab === 'results') && <div className={`smolder-card ${activeSmolderCells > 0 ? 'active' : ''}`}><div className="smolder-title"><span className="smolder-indicator" /><strong>Smoldering peat</strong></div><p>{smolderStatus}</p><div className="probe-readout"><div><span>Reaction heat, latest step</span><strong>{displayed ? displayed.diagnostics.lastReactionPowerW.toFixed(1) : '—'} W</strong></div><div><span>Fuel consumed</span><strong>{displayed ? displayed.diagnostics.cumulativeFuelConsumedKg.toFixed(3) : '—'} kg</strong></div><div><span>Cumulative reaction heat</span><strong>{displayed ? (displayed.diagnostics.cumulativeReactionHeatJ / 1e6).toFixed(3) : '—'} MJ</strong></div><div><span>Reacting cells</span><strong>{displayed?.diagnostics.reactingCellCount ?? '—'}</strong></div></div><small>Heat and consumption come from the reduced oxidation solver, not the decorative glow.</small></div>}
          {(tab === 'simulation' || tab === 'results') && <div className="metric-grid"><div className="metric primary"><span>PEAK TEMPERATURE</span><strong>{displayed ? (displayed.peakTemperatureK - 273.15).toFixed(1) : '—'}<small> °C</small></strong><Thermometer size={19} /></div><div className="metric"><span>DRY ICE LEFT</span><strong>{displayed?.dryIceMassKg.toFixed(2) ?? '—'}<small> kg</small></strong></div><div className="metric"><span>HEATER POWER</span><strong>{displayed?.heaterPowerW.toFixed(1) ?? '—'}<small> W</small></strong></div><div className="metric"><span>FUEL REMAINING</span><strong>{displayed?.totalFuelKg.toFixed(1) ?? '—'}<small> kg</small></strong></div><div className={`metric pressure-load-metric ${shownLoadOutsideValidity ? 'outside' : ''}`} title="Excess near-source pore pressure × π × fixed heater support radius²; algebraic force proxy, not a soil displacement or blast force calculation"><span>MODELED PRESSURE LOAD · FORCE PROXY</span><strong>{formatLoad(shownPressureLoad)}<small> N</small></strong><em>{shownLoadOutsideValidity ? 'Outside reduced-model validity' : 'Assumed projected support area'}</em></div></div>}
          {(tab === 'simulation' || tab === 'results') && <Section title="Sensor 01" detail={probe ? `${probe.xM.toFixed(1)}, ${probe.yM.toFixed(1)}, −${probe.depthM.toFixed(1)} m` : 'Choose a section view'} open><div className="probe-readout">{probeValue ? <><div><span>Material matrix</span><strong>{['Mineral', 'Mixed soil', 'Peat'][probeValue.materialClass] ?? 'Unknown'}</strong></div><div><span>Dry density</span><strong>{probeValue.dryDensityKgM3.toFixed(0)} kg/m³</strong></div><div><span>Porosity</span><strong>{(probeValue.porosity * 100).toFixed(0)}%</strong></div><div><span>Conductivity</span><strong>{probeValue.thermalConductivityWmK.toFixed(2)} W/m/K</strong></div><div><span>Permeability</span><strong>{probeValue.intrinsicPermeabilityM2.toExponential(2)} m²</strong></div><div><span>Root fuel</span><strong>{probeValue.rootFuelKg.toFixed(3)} kg/cell</strong></div><div><span>Temperature</span><strong>{(probeValue.temperatureK - 273.15).toFixed(1)} °C</strong></div><div><span>O₂ / CO₂</span><strong>{(probeValue.oxygenMoleFraction * 100).toFixed(1)}% / {(probeValue.co2MoleFraction * 100).toFixed(1)}%</strong></div><div><span>O₂ partial pressure</span><strong>{(probeValue.oxygenPartialPressurePa / 1000).toFixed(1)} kPa</strong></div><div><span>Pressure</span><strong>{(probeValue.pressurePa - scenario.atmosphere.pressurePa).toFixed(1)} Pa gauge</strong></div><div><span>Moisture</span><strong>{(probeValue.moistureSaturation * 100).toFixed(0)}% pore vol.</strong></div></> : <div className="probe-prompt"><MousePointer2 size={19} /> Choose Top, X section, or Y section, then click a colored cell to place a virtual sensor.</div>}</div></Section>}
          {tab === 'results' && <Section title="Recorded histories" detail={`${history.length} checkpoints`} open><MiniChart points={history} label="Peak temperature" unit="°C" accessor={(p) => p.snapshot.peakTemperatureK - 273.15} /><MiniChart points={history} label="Smolder reaction heat" unit="W" color="#ec946a" accessor={(p) => p.snapshot.diagnostics.lastReactionPowerW} /><MiniChart points={history.filter((p) => p.probe)} label="Sensor O₂" unit="%" color="#7cbfd0" accessor={(p) => (p.probe?.oxygenMoleFraction ?? 0) * 100} /></Section>}
          {tab === 'results' && <Section title="Mass & energy ledger" detail="Diagnostics"><div className="probe-readout"><div><span>CO₂ from dry ice</span><strong>{displayed?.diagnostics.cumulativeCO2InputKg.toFixed(3) ?? '—'} kg</strong></div><div><span>CO₂ boundary outflow</span><strong>{displayed?.diagnostics.cumulativeCO2OutflowKg.toFixed(3) ?? '—'} kg</strong></div><div><span>Gas balance residual</span><strong>{displayed?.diagnostics.gasBalanceResidualMol.toExponential(2) ?? '—'} mol</strong></div><div><span>Source energy residual</span><strong>{displayed?.diagnostics.sourceEnergyResidualJ.toExponential(2) ?? '—'} J</strong></div><div><span>Conversion intervention energy</span><strong>{displayed ? (displayed.diagnostics.cumulativeInterventionEnergyJ / 1000).toFixed(2) : '—'} kJ</strong></div><div><span>Numerical correction</span><strong>{displayed?.diagnostics.correctedMoles.toExponential(2) ?? '—'} mol</strong></div><div><span>Last physical step</span><strong>{displayed?.diagnostics.lastStepS.toFixed(1) ?? '—'} s</strong></div><div><span>Peak Darcy speed</span><strong>{displayed?.diagnostics.maxDarcyVelocityMS.toExponential(2) ?? '—'} m/s</strong></div><div><span>Pressure residual</span><strong>{displayed?.diagnostics.pressureResidualPa.toExponential(2) ?? '—'} Pa</strong></div></div></Section>}
          {tab === 'event' && <div className="event-overview"><span className="eyebrow">SEPARATE EVENT CLOCK</span><h3>{fastRun && fastFrame ? `${fastFrame.eventTimeS.toFixed(3)} seconds` : 'No event computed yet'}</h3><p>{fastRun ? 'Radial gas pressure loads the vertical soil elements. Displacement and yield are calculated; the shell damage index is illustrative.' : 'Run the slow model or use its initialized state, then compute a short event from the Event controls.'}</p>{fastRun && fastFrame && <div className="probe-readout"><div><span>Shell pressure peak</span><strong>{Math.max(...Array.from(fastFrame.shellPressurePa)).toFixed(0)} Pa</strong></div><div><span>Pressure load proxy</span><strong>{formatLoad(fastFrame.sourcePressureLoadN)} N</strong></div><div><span>Maximum damage index</span><strong>{Math.max(...Array.from(fastFrame.shellDamage)).toFixed(3)}</strong></div></div>}</div>}
          {tab === 'results' && <div className="model-status-card"><div><CircleHelp size={17} /><strong>Model status</strong></div><p>Reduced porous transport and reaction; qualitative soil-motion illustration. No blast, rupture, or field outcome prediction.</p></div>}
          </>}
        </div>
        {tab === 'results' && <div className="sidebar-footer"><div className="file-actions"><button onClick={exportCsv} type="button" disabled={!history.length}><Download size={15} /> CSV</button><button onClick={screenshot} type="button"><ArrowDownToLine size={15} /> Image</button><button onClick={exportRecording} type="button" disabled={!history.length}><Download size={15} /> States</button></div></div>}
      </aside>
    </div>}

    {(tab === 'simulation' || tab === 'results') && <footer className="timeline"><div className="transport"><button className="play-btn" type="button" onClick={playing ? pause : start} disabled={!validation.valid} aria-label={playing ? 'Pause solver' : 'Run solver'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><IconButton title="One physical solver step" onClick={() => clientRef.current?.step()} disabled={!validation.valid || playing}><StepForward size={17} /></IconButton><IconButton title="Reset physical run" onClick={reset}><RotateCcw size={17} /></IconButton><IconButton title="Fast forward at up to 3600 simulated seconds per real second; physical solver steps remain stable" onClick={() => { setPlayback(false); setComputeRate(3600); clientRef.current?.setComputeRate(3600); setPlaying(true); clientRef.current?.runTo(durationDays * DAY) }} disabled={!validation.valid}><SkipForward size={17} /></IconButton></div><div className="timeline-main"><div className="timeline-head"><span>PHYSICAL SOLVER TIME <strong>{formatClock(time)}</strong></span><span>{progress.toFixed(0)}% of {durationDays}-day window</span></div><input className="timeline-range" type="range" min={0} max={Math.max(1, history.length - 1)} step={1} value={playback ? playbackIndex : Math.max(0, history.length - 1)} onChange={(e) => { pause(); setPlayback(true); setPlaybackIndex(Number(e.target.value)) }} aria-label="Recorded run playback scrubber" /><div className="timeline-ticks"><span>0</span><span>1d</span><span>{durationDays}d</span></div></div><div className="timeline-options"><div className="compute-rate"><label>SOLVER PACE</label><select aria-label="Target simulated seconds per wall second" value={computeRate} onChange={(e) => setComputeRate(Number(e.target.value))} title="Requested pace; actual throughput may be lower"><option value={30}>30 sim s / real s</option><option value={120}>120 sim s / real s</option><option value={600}>600 sim s / real s</option><option value={3600}>3600 sim s / real s</option></select></div><div className="duration-pills">{[1, 3, 7].map((d) => <button key={d} type="button" className={durationDays === d ? 'active' : ''} onClick={() => setDurationDays(d)}>{d}d</button>)}</div><div className="run-to"><label>RUN TO</label><input type="number" min={0} max={durationDays * 24} step={1} value={runToHour} onChange={(e) => setRunToHour(Number(e.target.value))} /><span>h</span><button type="button" onClick={() => { setPlayback(false); setPlaying(true); clientRef.current?.runTo(Math.min(durationDays * DAY, runToHour * 3600)) }} disabled={!validation.valid}>Go</button></div><div className="throughput">{throughput > 0 ? `${throughput.toFixed(0)} sim s / wall s` : 'Throughput measured during run'}</div></div><div className="playback-controls"><span>RECORDED PLAYBACK</span><button type="button" onClick={() => { pause(); setPlayback((v) => !v) }} disabled={history.length < 2}>{playback ? 'Pause' : 'Play'}</button><select aria-label="Recorded playback speed" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))}><option value={30}>30 sim s / real s</option><option value={120}>120 sim s / real s</option><option value={600}>600 sim s / real s</option><option value={3600}>3600 sim s / real s</option></select></div></footer>}
    {showInfo && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowInfo(false)}><div className="info-modal" role="dialog" aria-modal="true" aria-label="Model information" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setShowInfo(false)} aria-label="Close model information">×</button><span className="eyebrow">MODEL SCOPE · VERSION 0.4</span><h2>Exploratory animation</h2><p>The 3D computational field uses a reduced porous-flow, heat, moisture, oxygen, CO₂, fuel, and dry-ice source model. It is not calibrated to a site or validated against field suppression outcomes.</p><div className="status-list"><div><StatusChip kind="reduced">IMPLEMENTED REDUCED MODEL</StatusChip><span>Conservation-based coarse 3D fields and finite source inventory.</span></div><div><StatusChip kind="illustrative">ILLUSTRATIVE ONLY</StatusChip><span>Manual soil-piece motion and radial shell damage; event displacement is calculated separately.</span></div><div><StatusChip kind="missing">NOT MODELED</StatusChip><span>Blast, rupture surfaces, horizontal geomechanics, char and ash generation.</span></div></div><p>See <strong>docs/PHYSICS_MODEL.md</strong>, <strong>docs/SOURCES.md</strong>, and <strong>docs/VALIDATION_STATUS.md</strong> in the local repository for equations, sources, and limits.</p></div></div>}
  </div>
}

export default App
