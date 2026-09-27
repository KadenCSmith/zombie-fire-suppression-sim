import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { LAB_DEFAULT_COUPLED, PRESETS, TERRAIN_CASES, type CoupledInputs, type CoupledFrame, type Fidelity } from '../coupled/model'
import CoupledWorker from '../worker/coupled.worker.ts?worker'
import { ModelSelector, type PhysicsWorkspace } from './ModelSelector'
import { ParameterSlider } from './ParameterSlider'
import { CoupledScene, COUPLED_FIELDS, createCameraLink, type CoupledField } from './CoupledScene'
import './coupled.css'

interface Run { status?: string; message?: string; mode: string; frames: CoupledFrame[]; setupMs: number; solveMs: number; couplingIterations: number; mechanicalBalanceJ: number; referenceBoundaryWorkJ: number; geostaticResidualN: number }
interface PreviousResult { inputs: CoupledInputs; runs: Record<string, Run> }
type Presentation = 'natural' | 'scientific' | 'blender' | 'split'
export interface CoupledSession { inputs: CoupledInputs; runs: Record<string, Run>; index: number; field: CoupledField; cut: boolean; context: boolean; amplification: number; compare: boolean; mode: string; presentation?: Presentation; playbackRate?: number; comparisonTarget?: 'scientific' | 'blender'; previous?: PreviousResult }
const TERRAIN_OPTIONS = (Object.keys(TERRAIN_CASES) as Array<keyof typeof TERRAIN_CASES>).map(id => ({ id, ...TERRAIN_CASES[id] }))
const format = (value: number | undefined, digits = 2) => value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits)
const exponential = (value: number | undefined) => value === undefined || !Number.isFinite(value) ? '—' : value.toExponential(2)
function closestFrame(frames: CoupledFrame[], time: number) { let closest = 0; for (let i = 1; i < frames.length; i++) if (Math.abs(frames[i].timeS - time) < Math.abs(frames[closest].timeS - time)) closest = i; return closest }
function peak(values?: Float32Array) { if (!values?.length) return undefined; let result = -Infinity; for (const value of values) result = Math.max(result, value); return result }

export default function CoupledWorkspace({ onWorkspace, session }: { onWorkspace: (v: PhysicsWorkspace) => void; session: MutableRefObject<CoupledSession | undefined> }) {
  const saved = session.current
  const [inputs, setInputs] = useState<CoupledInputs>(saved?.inputs ?? { ...LAB_DEFAULT_COUPLED })
  const [runs, setRuns] = useState<Record<string, Run>>(saved?.runs ?? {})
  const [previous, setPrevious] = useState<PreviousResult | undefined>(saved?.previous)
  const [index, setIndex] = useState(saved?.index ?? 0)
  const [field, setField] = useState<CoupledField>(saved?.field ?? 'temperatureK')
  const [cut, setCut] = useState(saved?.cut ?? true), [context, setContext] = useState(saved?.context ?? true)
  const [amplification, setAmplification] = useState(saved?.amplification ?? 1)
  const [compare, setCompare] = useState(saved?.compare ?? false), [mode, setMode] = useState(saved?.mode ?? 'coupled')
  const [presentation, setPresentation] = useState<Presentation>(saved?.presentation ?? 'natural')
  const [comparisonTarget, setComparisonTarget] = useState<'scientific' | 'blender'>(saved?.comparisonTarget ?? 'scientific')
  const [playbackRate, setPlaybackRate] = useState(saved?.playbackRate ?? 1)
  const [running, setRunning] = useState(false), [status, setStatus] = useState(Object.keys(saved?.runs ?? {}).length ? 'Saved accepted states restored' : 'Ready for the first calculation')
  const [error, setError] = useState(''), [live, setLive] = useState<{ mode: string; frame: CoupledFrame }>()
  const [playing, setPlaying] = useState(false), [probe, setProbe] = useState<number | null>(null), [throughput, setThroughput] = useState(0)
  const [cameraReset, setCameraReset] = useState(0), [terrainMenu, setTerrainMenu] = useState(false)
  const worker = useRef<Worker | null>(null), cameraLink = useRef(createCameraLink()), menuRef = useRef<HTMLDivElement>(null)
  const activeMode = running && live ? live.mode : mode, run = runs[activeMode]
  const acceptedIndex = Math.min(index, Math.max(0, (run?.frames.length ?? 1) - 1))
  const frame = running ? live?.frame : run?.frames[acceptedIndex]
  const grid = PRESETS[inputs.fidelity], count = grid.nx * grid.ny * grid.nz, info = COUPLED_FIELDS[field]
  const terrain = TERRAIN_OPTIONS.find(item => item.id === inputs.terrain) ?? TERRAIN_OPTIONS[0]
  const progress = Math.min(100, (frame?.timeS ?? 0) / inputs.durationS * 100)
  const selectedProbe = probe === null ? null : Math.min(probe, count - 1)
  const sourceDiameter = Math.cbrt(6 * inputs.dryIceKg / (Math.PI * 1560))

  useEffect(() => { session.current = { inputs, runs, index, field, cut, context, amplification, compare, mode, presentation, playbackRate, comparisonTarget, previous } }, [inputs, runs, index, field, cut, context, amplification, compare, mode, presentation, playbackRate, comparisonTarget, previous, session])
  useEffect(() => () => worker.current?.terminate(), [])
  useEffect(() => {
    if (!playing || !run) return
    const timer = setTimeout(() => {
      if (acceptedIndex >= run.frames.length - 1) setPlaying(false)
      else setIndex(acceptedIndex + 1)
    }, 120 / playbackRate)
    return () => clearTimeout(timer)
  }, [playing, run, acceptedIndex, playbackRate])
  useEffect(() => {
    if (!terrainMenu) return
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setTerrainMenu(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTerrainMenu(false) }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [terrainMenu])

  const stop = () => {
    worker.current?.terminate(); worker.current = null; setRunning(false); setPlaying(false); setLive(undefined)
    setStatus('Calculation stopped. Completed runs remain available.')
  }
  const update = (next: CoupledInputs) => {
    if (JSON.stringify(next) === JSON.stringify(inputs)) return
    if (Object.keys(runs).length) setPrevious({ inputs, runs })
    stop(); setInputs(next); setRuns({}); setIndex(0); setProbe(null); setMode('coupled'); setError(''); setThroughput(0)
    setStatus('Scenario changed. Calculate to generate new states.')
  }
  const restorePrevious = () => {
    if (!previous) return
    stop(); setInputs(previous.inputs); setRuns(previous.runs); setIndex(Number.MAX_SAFE_INTEGER); setMode(previous.runs.coupled ? 'coupled' : Object.keys(previous.runs)[0]); setError(''); setProbe(null)
    setPrevious(Object.keys(runs).length ? { inputs, runs } : undefined); setStatus('Previous scenario and accepted states restored together.')
  }
  const calculate = () => {
    if (Object.keys(runs).length) setPrevious({ inputs, runs })
    stop(); setRuns({}); setIndex(0); setProbe(null); setMode('coupled'); setError(''); setThroughput(0); setRunning(true); setStatus('Preparing the material atlas and gravity equilibrium. Fine meshes may take a moment…')
    const w = new CoupledWorker(); worker.current = w
    w.onmessage = event => {
      if (worker.current !== w) return
      const data = event.data
      if (data.type === 'progress') {
        setLive({ mode: data.mode, frame: data.frame })
        setStatus(`${data.mode === 'rigid' ? 'Rigid-pore baseline' : 'Coupled physics'} · ${data.timeS.toFixed(2)} / ${inputs.durationS} s`)
        setThroughput(data.elapsedMs > 0 ? data.timeS / (data.elapsedMs / 1000) : 0)
      } else if (data.type === 'result') {
        setRuns(old => ({ ...old, [data.mode]: data })); setMode(data.mode); setIndex(Math.max(0, data.frames.length - 1))
      } else if (data.type === 'done') {
        setRunning(false); setLive(undefined); setMode('coupled'); setIndex(Number.MAX_SAFE_INTEGER)
        setStatus('Calculation complete. Accepted states are ready to inspect.'); w.terminate(); worker.current = null
      } else if (data.type === 'error') {
        setRunning(false); setLive(undefined); setError(data.message); setStatus('Stopped at a model or numerical limit. Accepted states retained.')
        w.terminate(); worker.current = null
      }
    }
    w.onerror = event => {
      if (worker.current !== w) return
      setError(event.message || 'The calculation worker could not continue.'); setStatus('Calculation interrupted'); setRunning(false); setLive(undefined); w.terminate(); worker.current = null
    }
    w.postMessage({ inputs, compare })
  }
  const selectMode = (target: string) => {
    const frames = runs[target]?.frames
    setPlaying(false); if (frames && frame) setIndex(closestFrame(frames, frame.timeS)); setMode(target)
  }
  const download = () => {
    const text = JSON.stringify({ format: 'zombie-coupled', version: 2, exportedAt: new Date().toISOString(), inputs, runs, grid: { nx: grid.nx, ny: grid.ny, nz: grid.nz, widthM: 8, lengthM: 8, depthM: 3.2 }, source: { centerXM: 4.4, centerYM: 4, centerDepthM: 1.3, densityKgM3: 1560 }, coordinates: { x: 'horizontal', y: 'horizontal', z: 'depth-positive' }, presentation: { field, index: acceptedIndex, mode: activeMode, amplification, view: presentation }, provenance: { physics: 'Accepted solver snapshots only. No experimental validation or statistical uncertainty assessment.', blender: 'Reference animation from dry-ice-peat-study. Presentation progress is normalized; animation motion is not solver output.' }, scope: 'Conservative porous transport, equilibrium water phase change, finite dry ice, reduced oxidation and small-strain thermoporoelastic mechanics. No liquid infiltration, calibrated rupture, or field suppression prediction.' }, (_, value) => ArrayBuffer.isView(value) ? Array.from(value as unknown as ArrayLike<number>) : value, 2)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), anchor = document.createElement('a')
    anchor.href = url; anchor.download = `zombie-fire-${inputs.fidelity}-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const replay = () => { if (!playing && acceptedIndex >= (run?.frames.length ?? 1) - 1) setIndex(0); setPlaying(value => !value) }
  const sceneProps = { terrain: inputs.terrain, capEnabled: inputs.cap, capRadius: inputs.capRadiusM, capRise: inputs.capRiseM, dryIceKg: inputs.dryIceKg, frame, fidelity: inputs.fidelity, field, cut, context, amplification, onProbe: setProbe, cameraLink: cameraLink.current, resetToken: cameraReset }

  const panes: Array<'natural' | 'scientific' | 'blender'> = presentation === 'split' ? [comparisonTarget === 'blender' ? 'blender' : 'natural', 'scientific'] : [presentation]

  return <div className="ops-shell coupled-shell">
    <header className="ops-header"><div className="ops-brand"><span className="coupled-brand-mark">Z</span><div><strong>ZOMBIE FIRE</strong><span>UNIFIED PHYSICS LAB</span></div></div><ModelSelector value="coupled" onChange={onWorkspace} /><button className="ops-secondary" onClick={download} disabled={!Object.keys(runs).length || running}>Export accepted states ↗</button></header>
    <div className="ops-title"><div><span className="ops-eyebrow">POROUS TRANSPORT / THERMAL ENERGY / SOIL MECHANICS</span><h1>The underground, made visible.</h1></div><div className="coupled-title-meta"><span className="coupled-research-badge">Research model</span><span>Numerical verification ≠ experimental validation</span></div></div>
    <main className="coupled-main">
      <aside className="ops-controls">
        <div className="coupled-section-heading"><div><span className="coupled-kicker">01 / SCENARIO</span><h2>{terrain.label}</h2></div><div className="coupled-terrain-menu" ref={menuRef}><button className="coupled-icon-button" aria-label="Choose terrain scenario" aria-expanded={terrainMenu} onClick={() => setTerrainMenu(value => !value)}>•••</button>{terrainMenu && <div className="coupled-terrain-options" role="group" aria-label="Terrain scenarios">{TERRAIN_OPTIONS.map(item => <button key={item.id} aria-pressed={terrain.id === item.id} onClick={() => { update({ ...inputs, terrain: item.id }); setTerrainMenu(false) }}><strong>{item.label}</strong><span>{item.description}</span></button>)}<p>Assumed material cases. No matched site measurements.</p></div>}</div></div>
        <p>8 × 8 × 3.2 m domain. Finite dry ice and initialized gravity. {inputs.reaction ? 'Prepared dry smoldering specimen; initial water is removed from an assumed hot-region halo.' : 'Cold source-only experiment; no initialized fire.'}</p>
        <label className="coupled-select-label">Spatial resolution<select aria-label="Coupled fidelity" value={inputs.fidelity} onChange={event => update({ ...inputs, fidelity: event.target.value as Fidelity })}>{Object.entries(PRESETS).map(([key, preset]) => <option key={key} value={key}>{key === 'precision2560' ? 'Precision · 10× original default' : key === 'precision20480' ? 'Ultra · 10× original research' : key.charAt(0).toUpperCase() + key.slice(1)} · {(preset.nx * preset.ny * preset.nz).toLocaleString()}</option>)}</select></label>
        <div className="coupled-grid-note"><strong>{count.toLocaleString()} elements</strong><span>{grid.nx} × {grid.ny} × {grid.nz} · {(8 / grid.nx).toFixed(2)} × {(8 / grid.ny).toFixed(2)} × {(3.2 / grid.nz).toFixed(2)} m</span></div>
        <p className="coupled-small-note">More elements resolve smaller spatial scales. Accuracy still depends on convergence, constitutive laws and input data.</p>
        <button className={`ops-primary ${running ? 'is-running' : ''}`} onClick={running ? stop : calculate}>{running ? '■  Stop calculation' : '▶  Calculate scenario'}</button>
        <div className="coupled-run-progress"><i style={{ width: `${progress}%` }} /></div>
        <p className="coupled-run-status" role="status">{status}</p>{error && <p role="alert" className="coupled-error">{error}</p>}{previous && <button className="coupled-restore" onClick={restorePrevious} disabled={running}>↶ Restore previous accepted run <span>{previous.inputs.fidelity} · {previous.inputs.durationS} s</span></button>}
        <ParameterSlider label="Physical duration" value={inputs.durationS} min={10} max={3600} step={10} unit="s" defaultValue={LAB_DEFAULT_COUPLED.durationS} onChange={value => update({ ...inputs, durationS: value })} />
        <ParameterSlider label="Dry ice inventory" value={inputs.dryIceKg} min={0} max={20} step={0.1} unit="kg" defaultValue={4} note={`Equivalent sphere Ø ${sourceDiameter.toFixed(3)} m at 1560 kg/m³`} onChange={value => update({ ...inputs, dryIceKg: value })} />
        <ParameterSlider label="Heater power" value={inputs.heaterW} min={0} max={500} step={1} unit="W" defaultValue={0} onChange={value => update({ ...inputs, heaterW: value })} />
        <ParameterSlider label="Peat water saturation" value={inputs.moisture} min={0} max={0.8} step={0.01} unit="pore vol." defaultValue={0.2} onChange={value => update({ ...inputs, moisture: value })} />
        <details className="ops-details" open><summary>Physical coupling</summary>
          <label><input type="checkbox" checked={inputs.reaction} onChange={event => update({ ...inputs, reaction: event.target.checked })} /> Prepared dry smoldering specimen</label><p>Includes reduced oxygen-limited oxidation. Selects an assumed initially dry halo, not a measured natural field state.</p>
          <label><input type="checkbox" checked={inputs.mechanics} onChange={event => update({ ...inputs, mechanics: event.target.checked })} /> Deformation and pressure work</label>
          <label><input type="checkbox" checked={inputs.cap} onChange={event => update({ ...inputs, cap: event.target.checked })} /> Reduced cap / rim contact</label>
          <label><input type="checkbox" checked={inputs.roots} onChange={event => update({ ...inputs, roots: event.target.checked })} /> Bonded root trusses</label>
          <label><input type="checkbox" checked={compare} disabled={running} onChange={event => setCompare(event.target.checked)} /> Also calculate rigid-pore baseline</label><p>Baseline uses the same physical inputs with ground and cap motion disabled. Recalculate to include it.</p>
        </details>
        <details className="ops-details"><summary>Material and cap parameters</summary>
          <ParameterSlider label="Cap diameter" value={2 * inputs.capRadiusM} min={0.5} max={2} step={0.05} unit="m" defaultValue={0.95} onChange={value => update({ ...inputs, capRadiusM: value / 2, capRiseM: Math.min(inputs.capRiseM, 0.15 * value) })} />
          <ParameterSlider label="Cap rise" value={inputs.capRiseM} min={0.02} max={Math.min(0.2, 0.3 * inputs.capRadiusM)} step={0.01} unit="m" defaultValue={0.1} onChange={value => update({ ...inputs, capRiseM: value })} />
          <ParameterSlider label="Cap thickness" value={1000 * inputs.capThicknessM} min={1} max={10} step={0.5} unit="mm" defaultValue={5} note="Assumed elastic steel and rim anchors" onChange={value => update({ ...inputs, capThicknessM: value / 1000 })} />
          <ParameterSlider label="Peat elastic modulus" value={inputs.youngsPa / 1e6} min={0.5} max={10} step={0.1} unit="MPa" defaultValue={1} note="Uncalibrated" onChange={value => update({ ...inputs, youngsPa: value * 1e6 })} />
          <ParameterSlider label="Vertical permeability" value={inputs.permeabilityM2 / 1e-12} min={0.1} max={100} step={0.1} unit="10⁻¹² m²" defaultValue={8} onChange={value => update({ ...inputs, permeabilityM2: value * 1e-12 })} />
        </details>
        <details className="ops-details"><summary>Numerical implementation</summary><label className="coupled-backend">Mechanical solver<select aria-label="Mechanical solver implementation" value={inputs.mechanicalBackend ?? 'reference'} onChange={event => update({ ...inputs, mechanicalBackend: event.target.value as 'reference' | 'optimized' })}><option value="reference">Reference · element operator</option><option value="optimized">Optimized · sparse operator</option></select></label><p>Same model and float64 precision. Compare implementations against matched reference cases; faster execution does not improve calibration.</p></details>
        <details className="ops-details"><summary>Research fracture model</summary><p>Experimental feature. Previous mesh and coupled energy gates failed. A completed rupture prediction is unavailable.</p>
          <label><input type="checkbox" checked={inputs.fracture} onChange={event => update({ ...inputs, fracture: event.target.checked })} /> Enable diffuse fracture research</label>
          <ParameterSlider label="Fracture energy" value={inputs.fractureEnergyJm2} min={1} max={100} step={1} unit="J/m²" defaultValue={5} note="Unmeasured; no calibrated strength" onChange={value => update({ ...inputs, fractureEnergyJm2: value })} />
          <ParameterSlider label="Fracture length scale" value={inputs.lengthScaleM} min={0.2} max={2} step={0.1} unit="m" defaultValue={1} note="Resolved band requires spacing ≤ length / 2" onChange={value => update({ ...inputs, lengthScaleM: value })} />
        </details>
      </aside>
      <section className="coupled-view" aria-label="Simulation visualization and results">
        <div className="coupled-view-header"><div className="coupled-segments" role="group" aria-label="Presentation mode">{([['natural', 'Natural cutaway'], ['scientific', 'Scientific'], ['split', 'Compare views'], ['blender', 'Blender reference']] as const).map(([key, label]) => <button key={key} aria-pressed={presentation === key} onClick={() => setPresentation(key)}>{label}</button>)}</div><button className="coupled-camera-reset" onClick={() => setCameraReset(value => value + 1)}>↺ Reset camera</button></div>
        <div className="coupled-render">{presentation === 'split' && <label>Compare with<select aria-label="Comparison view" value={comparisonTarget} onChange={event => setComparisonTarget(event.target.value as 'scientific' | 'blender')}><option value="scientific">Scientific fields</option><option value="blender">Original Blender</option></select></label>}<label>Field<select aria-label="Coupled field" value={field} disabled={!panes.includes('scientific')} onChange={event => setField(event.target.value as CoupledField)}>{Object.entries(COUPLED_FIELDS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><label><input type="checkbox" checked={cut} disabled={presentation === 'blender'} onChange={event => setCut(event.target.checked)} /> Cutaway</label><label><input type="checkbox" checked={context} disabled={presentation === 'blender'} onChange={event => setContext(event.target.checked)} /> Context</label><label>Motion<select aria-label="Displacement display" value={amplification} disabled={presentation === 'blender'} onChange={event => setAmplification(Number(event.target.value))}>{[1, 10, 100].map(value => <option key={value} value={value}>{value}× display</option>)}</select></label>{runs.rigid && <label>Run<select aria-label="Coupled comparison" value={activeMode} disabled={running} onChange={event => selectMode(event.target.value)}><option value="coupled">Coupled</option><option value="rigid">Rigid baseline</option></select></label>}</div>
        <div className={`coupled-canvases ${presentation === 'split' ? 'is-split' : ''}`}>
          {panes.map((kind, pane) => kind === 'blender' ? <div key={kind} className="coupled-canvas coupled-reference-canvas"><CoupledScene {...sceneProps} kind="blender" referenceProgress={(frame?.timeS ?? 0) / inputs.durationS} /><div className="coupled-scene-label"><span className="coupled-kicker">{pane ? 'B' : 'A'} / BLENDER STUDY</span><strong>Original concept animation</strong><small>Normalized presentation progress: {format(progress, 0)}%</small></div><div className="coupled-reference-note"><strong>Illustrative motion</strong><span>Historical Ø 0.5 m source (~102 kg), separate from this scenario. Scripted motion; not solver output.</span></div><div className="coupled-scene-foot">Same replay control · different physical basis</div></div> : <div key={kind} className="coupled-canvas"><CoupledScene {...sceneProps} kind={kind} /><div className="coupled-scene-label"><span className="coupled-kicker">{pane ? 'B' : 'A'} / {kind === 'natural' ? 'NATURAL CUTAWAY' : activeMode === 'rigid' ? 'RIGID-PORE BASELINE' : 'SCIENTIFIC FIELDS'}</span><strong>{frame ? `${format(frame.timeS)} s · accepted ${activeMode === 'rigid' ? 'rigid' : 'coupled'} state` : 'Scenario geometry'}</strong><small>{frame ? `${count.toLocaleString()} elements · ${terrain.label}` : 'Calculate to see physical fields'}</small></div>{kind === 'natural' ? <div className="coupled-natural-note"><strong>Natural material view</strong><span>Calculated ground motion · illustrative anatomy and aggregates</span></div> : <div className="coupled-legend"><strong>{info.label} <span>{info.unit}</span></strong><i /><div><span>{info.range[0]}</span><span>{info.range[1]}</span></div><small>Fixed scale · end colors include out-of-range values</small></div>}<div className="coupled-scene-foot">Drag to orbit · scroll to zoom · select a cell<span>{inputs.mechanics && activeMode !== 'rigid' ? `Deformation ${amplification}×` : 'Rigid geometry'}</span></div></div>)}
        </div>
        <div className="coupled-timeline"><button aria-label={playing ? 'Pause recorded replay' : 'Play recorded replay'} onClick={replay} disabled={!run || running}>{playing ? 'Ⅱ' : '▶'}</button><div><div className="coupled-timeline-label"><span>{running ? 'CALCULATING PHYSICAL TIME' : 'ACCEPTED STATE REPLAY'}</span><strong>{format(frame?.timeS ?? 0)} <small>/ {inputs.durationS} s</small></strong></div><input aria-label="Coupled replay time" type="range" min={0} max={Math.max(0, (run?.frames.length ?? 1) - 1)} value={acceptedIndex} onChange={event => { setPlaying(false); setIndex(Number(event.target.value)) }} disabled={running || !run} /></div><label>Replay<select aria-label="Replay speed" value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))}>{[0.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}×</option>)}</select></label></div>
        <div className="coupled-instruments"><div><span>Peak temperature</span><strong>{format(peak(frame?.temperatureK) === undefined ? undefined : peak(frame?.temperatureK)! - 273.15, 1)} <small>°C</small></strong></div><div><span>Dry ice remaining</span><strong>{format(frame?.dryIceKg, 4)} <small>kg</small></strong></div><div><span>Maximum pressure</span><strong>{format(peak(frame?.pressurePa) === undefined ? undefined : peak(frame?.pressurePa)! / 1000, 3)} <small>kPa absolute</small></strong></div><div className="coupled-probe-card"><span>{selectedProbe === null ? 'Virtual probe' : `Cell ${selectedProbe} · ${info.label}`}</span><strong>{selectedProbe === null ? 'Select a cell' : frame?.[field][selectedProbe]?.toPrecision(5) ?? 'No state yet'} {selectedProbe !== null && frame && <small>{info.unit}</small>}</strong></div></div>
        <details className="coupled-scope coupled-diagnostics"><summary><span>Numerical diagnostics</span><span>{run?.status === 'limited' ? 'Stopped at validity limit' : run ? 'Accepted solver states' : 'Awaiting calculation'}</span></summary><div className="coupled-diagnostic-grid"><div><span>Thermal + phase energy residual</span><strong>{exponential(frame?.ledger.energyResidualJ)} J</strong></div><div><span>Total mass residual</span><strong>{exponential(frame?.ledger.massResidualKg)} kg</strong></div><div><span>Mechanical force residual</span><strong>{exponential(frame?.mechanical?.residualN)} N</strong></div><div><span>Incremental principal strain</span><strong>{format(frame?.mechanical ? frame.mechanical.maxStrain * 100 : undefined, 5)} %</strong></div><div><span>Cap contact / flex</span><strong>{frame?.cap ? `${format(frame.cap.contactN)} N / ${format(frame.cap.flexM * 1e6, 3)} µm` : '—'}</strong></div><div><span>Pressure / mechanics work mismatch</span><strong>{exponential(run?.mechanicalBalanceJ)} J</strong></div><div><span>Measured solve throughput</span><strong>{format(running ? throughput : run && run.solveMs > 0 ? (run.frames.at(-1)?.timeS ?? 0) / (run.solveMs / 1000) : undefined, 2)} sim s / wall s</strong></div><div><span>Uncertainty</span><strong>Not assessed</strong></div><div><span>Initial preparation · water removed</span><strong>{format(frame?.initialization?.preparedWaterRemovedKg, 3)} kg</strong></div><div><span>Initialization</span><strong>{frame?.initialization?.method ?? 'Awaiting calculation'}</strong></div></div><p>Residuals describe numerical consistency. They are not an uncertainty percentage or evidence of experimental agreement. Replay speed does not change solver steps.</p></details>
        <details className="coupled-scope"><summary><span>Model scope & evidence</span><span>No matched experiment</span></summary><div className="coupled-scope-grid"><div><h3>Calculated</h3><p>Four gas species, compressible Darcy flow, anisotropic permeability, gas enthalpy, water phase equilibrium, finite dry ice, reduced oxidation, heterogeneous small-strain effective stress, gravity, pore-volume feedback, bonded roots and a reduced cap model.</p></div><div><h3>Still unresolved</h3><p>Liquid-water infiltration and injection, pyrolysis and char, cryosuction and ice heave, finite-deformation rupture, calibrated root pullout and frictional contact. No field suppression or rupture outcome is validated.</p></div><div><h3>Visual provenance</h3><p>Scientific colors and terrain deformation use accepted states. Natural peat shading interpolates solver material fractions; decorative strata, fixed-seed aggregates, tree anatomy and the source guide are illustrative. Aggregate geometry does not add solver elements or predicted fractures. The Blender reference retains its own historical geometry and scripted motion; replay is normalized to the selected run duration.</p></div></div><p>Fracture remains off by default. Historical fracture mesh energy and coupled energy gates failed; a refined mesh alone does not resolve that failure. Each run retains up to 61 regular snapshots plus a terminal accepted state. Changes to physical inputs invalidate the current display. One previous scenario and its accepted results can be restored together.</p></details>
      </section>
    </main>
    <footer className="coupled-footer"><span><i /> Solver snapshots drive scientific fields</span><span>Float64 calculations · SI units · bounded replay</span><span>One workspace / two source repositories</span></footer>
  </div>
}
