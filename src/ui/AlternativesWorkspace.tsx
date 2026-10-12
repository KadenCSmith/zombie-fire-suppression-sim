import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import AlternativeWorker from '../worker/alternatives.worker.ts?worker'
import { ALTERNATIVE_CONTACT_STEP_S } from '../alternatives/contactAdapter'
import { VARIANTS, ENGINES, MEDIA, PARAMETERS, compatible, variant, type VariantId, type EngineId, type MediumId } from '../alternatives/registry'
import { acceptsMessage, duplicatePanel, freshPanel, linkedCompatibility, observationWindowS, type AcceptedState, type PanelConfig, type RunMessage, type WorkerCommand } from '../alternatives/model'
import { ParticleComparison } from '../alternatives/fine-dry-ice-injection/comparison'
import { PARTICLE_API_VERSION } from '../alternatives/contract'
import { readComparison, serializeComparison, SESSION_KEY, SESSION_SCHEMA } from '../alternatives/persistence'
import { currentRecord, RECORD_UNITS } from '../alternatives/records'
import { createMesh } from '../peatfem/model'
import { PeatFemScene } from './PeatFemScene'
import { AlternativeScience } from './AlternativeScience'
import './alternatives.css'
const MAX_PANELS = 4
interface PanelResult { configurationKey?: string; runId: string; state?: AcceptedState; history: AcceptedState[]; running: boolean; ready: boolean; solveMs: number; wallMs: number; error?: string }
type Control = { epoch: number; type: 'run' | 'pause' | 'reset' | 'advance'; targetS?: number; exceptId?: string }
const fmt = (v: number | undefined | null, digits = 3) => v == null || !Number.isFinite(v) ? 'N/A' : v.toPrecision(digits)
let sequence = 0
const uid = () => `panel-${Date.now().toString(36)}-${++sequence}`
function stages(v: ReturnType<typeof variant>, time: number, end: number) { return Math.min(v.stages.length - 1, Math.floor(time / Math.max(1, end) * v.stages.length)) }
function ContactView({ state }: { state: AcceptedState }) {
  const patches = state.contact!.patches
  return <svg viewBox="0 0 600 270" role="img" aria-label="Independent contact specimens; temperature on shared 293 to 1000 kelvin scale">
    <path d="M25 48H575" stroke="#767469"/><text x="25" y="30" fill="#9faca7" fontSize="10" letterSpacing="2">PRESCRIBED CONTACT · NO SOLVED PENETRATION</text>
    {patches.map((p, i) => {
      const heat = Math.min(1, Math.max(0, (p.temperatureK - 293) / 707)), x = 40 + i * 185
      return <g key={p.id}><path d={`M${x + 65} 48V92`} stroke="#819b9b" strokeWidth="2" strokeDasharray="5 5"/><rect x={x} y="94" width="145" height="104" rx="4" fill={`hsl(${170 - heat * 150} 33% ${16 + heat * 16}%)`} stroke="#66726d"/>{Array.from({length:7},(_,j)=><path key={j} d={`M${x+12} ${108+j*12}h120`} stroke="#e3dfbb" opacity=".09"/>)}<text x={x+12} y="131" fill="#e2e5d9" fontSize="24">{p.temperatureK.toFixed(1)} K</text><text x={x+12} y="153" fill="#bcc6bd" fontSize="10">{p.waterReceivedKg.toFixed(3)} kg received</text><rect x={x} y="187" width={145*Math.min(1,p.liquidWaterKg/.2)} height="11" fill="#7caebc" opacity=".6"/><text x={x} y="221" fill="#88968f" fontSize="11">Specimen {i+1} · 0.5 kg peat</text><text x={x} y="240" fill="#66766e" fontSize="10">arrival prescribed at {p.waterArrivalTimeS} s</text></g>
    })}
  </svg>
}
function Panel({ config, onChange, onDuplicate, onRemove, control, onResult, onIndividual, canAdd, canRemove, coordinated, compactRender }: {
  config: PanelConfig; onChange: (next: PanelConfig) => void; onDuplicate: () => void; onRemove: () => void;
  control: Control; onResult: (id: string, result: PanelResult | undefined) => void; onIndividual: () => void; canAdd: boolean; canRemove: boolean; coordinated: boolean; compactRender: boolean
}) {
  const [storedResult, setResult] = useState<PanelResult>({ runId: '', history: [], running: false, ready: false, solveMs: 0, wallMs: 0 })
  const [generation, setGeneration] = useState(0), [plot, setPlot] = useState(true)
  const configurationKey=JSON.stringify(config)+':'+generation
  const result:PanelResult=storedResult.configurationKey===configurationKey?storedResult:{runId:'',history:[],running:false,ready:false,solveMs:0,wallMs:0}
  const worker = useRef<Worker | null>(null), runId = useRef(''), history = useRef<AcceptedState[]>([]), consumed = useRef(control.epoch)
  const reason = compatible(config.variantId, config.engine, config.medium), v = variant(config.variantId)
  const mesh = useMemo(() => config.engine === 'peat-fem' ? createMesh(config.fem.n, config.fem.lengthM, config.fem.ignitionWidthM) : undefined, [config.engine, config.fem])
  useEffect(() => {
    const id = `${config.id}-run-${++sequence}`, w = reason ? null : new AlternativeWorker()
    worker.current = w; runId.current = id; history.current = []
    const blank: PanelResult = { configurationKey, runId: id, history: [], running: false, ready: false, solveMs: 0, wallMs: 0, error: reason ?? undefined }
    let latest = blank
    setResult(blank); onResult(config.id, blank)
    if (w) {
      w.onmessage = (event: MessageEvent<RunMessage>) => {
        const d = event.data
        if (worker.current !== w || !acceptsMessage(config.id, runId.current, d)) return
        if (d.state) {
          const old = history.current, last = old.at(-1)
          history.current = last?.timeS === d.state.timeS ? [...old.slice(0,-1), d.state] : [...old, d.state]
        }
        const next = { configurationKey, runId: id, state: d.state, history: history.current, ready: d.type !== 'failed', running: d.running, solveMs: d.solveMs, wallMs: d.wallMs, error: d.error }
        latest = next
        setResult(next); onResult(config.id, next)
      }
      w.onerror = e => {
        e.preventDefault()
        if (worker.current !== w || runId.current !== id) return
        const next = { ...latest, running: false, ready: false, error: e.message || 'Worker failed' }
        setResult(next); onResult(config.id, next); w.terminate()
      }
      w.postMessage({ type: 'init', panelId: config.id, runId: id, config } satisfies WorkerCommand)
    }
    return () => { w?.terminate(); if (worker.current === w) worker.current = null; onResult(config.id, undefined) }
  }, [config, generation, reason])
  const send = (type: WorkerCommand['type'], targetS?: number) => worker.current?.postMessage({ type, panelId: config.id, runId: runId.current, targetS } satisfies WorkerCommand)
  const reset = () => { onResult(config.id, undefined); setGeneration(n => n + 1) }
  useEffect(() => {
    if (consumed.current === control.epoch) return
    consumed.current = control.epoch
    if (control.exceptId === config.id) return
    if (control.type === 'reset') reset()
    else send(control.type, control.targetS)
  }, [control])
  const state = result.state, m = state?.metrics, time = state?.timeS ?? 0, end = observationWindowS(config)
  const path = result.history.filter(h => h.metrics).map((h,i) => `${i ? 'L' : 'M'}${h.timeS/end*550+20},${130-(h.metrics!.maximumK-293)/707*100}`).join(' ')
  function changeVariant(id: VariantId) { onIndividual(); onChange(freshPanel(config.id, id)) }
  return <article className="alternative-panel" data-panel-id={config.id} data-run-id={result.runId} data-variant={config.variantId} data-time={time} data-running={result.running || coordinated}>
    <header className="alt-panel-heading"><div><span className="alt-eyebrow">{v.number} / {config.engine === 'concept' ? 'ILLUSTRATIVE' : 'LIVE COMPUTATION'}</span><h2>{v.id === 'baseline' ? 'Untreated reference' : v.label}</h2></div><span className={`alt-run-dot ${result.running ? 'running' : ''}`}/></header>
    <label className="alt-select">Method / variant<select aria-label={`Alternative ${config.id}`} value={config.variantId} onChange={e => changeVariant(e.target.value as VariantId)}>{VARIANTS.map(item => <option key={item.id} value={item.id}>{item.number} {item.label}{item.draft ? ' · draft label' : ''}</option>)}</select></label>
    <p className="alt-subtitle">{config.variantId === 'baseline' && config.engine === 'contact' ? 'Isolated hot-specimen reference · no combustion in this engine' : v.subtitle}</p><p className="alt-panel-scope">{config.engine === 'contact' ? 'THERMAL PROXY · prescribed contact only · no suppression prediction' : config.engine === 'peat-fem' ? 'MODELED COMBUSTION BASELINE · suppression interventions disabled' : config.engine === 'particle' ? 'PARTICLE DELIVERY · method-specific bounds · no suppression prediction' : 'ILLUSTRATIVE · no physical outcome'} · experimentally validated: no</p>
    <div className="alt-panel-controls"><button disabled={!result.ready || !!result.error || time >= end} onClick={() => { onIndividual(); send(result.running || coordinated ? 'pause' : 'run') }}>{result.running || coordinated ? 'Pause' : time > 0 ? 'Resume' : 'Start'}</button><button onClick={() => { onIndividual(); reset() }}>Reset</button><button disabled={!canAdd} onClick={onDuplicate}>Duplicate</button><button disabled={!canRemove} onClick={onRemove}>Remove</button><output>{result.error ? 'Unavailable' : coordinated ? 'Linked time running' : result.running ? 'Running' : time >= end ? 'Complete' : result.ready ? 'Ready / paused' : 'Starting…'}</output></div>
    {result.error && <p className="alt-error" role="alert">{result.error}</p>}
    <div className="alt-stage">{v.id === 'nanoparticles' ? <ParticleComparison config={config} onChange={next => { onIndividual(); onChange(next) }} state={state} history={result.history}/> : state?.contact ? <ContactView state={state}/> : state?.fem && mesh ? <PeatFemScene mesh={mesh} frame={state.fem} field="temperature" wireframe nodes={false} overlay={false} range={[293,1000]} onProbe={() => {}} renderBudget="comparison"/> : <div className="alt-concept"><span>CONCEPT ONLY</span><p>No physical outcome is calculated.</p></div>}</div>
    <div className="alt-stage-steps" aria-label="Conceptual method stages; presentation only">{v.stages.map((stage,i) => <span key={stage} className={config.engine === 'concept' && i === stages(v,time,end) ? 'current' : ''}><small>{String(i+1).padStart(2,'0')}</small>{stage}</span>)}</div>
    <p className="alt-time">{config.engine === 'concept' ? 'Presentation stage time' : 'Physical solver time'} <strong>{time.toFixed(2)} / {end} s</strong><span>Compute {fmt(result.solveMs/1000)} s · worker active wall {fmt(result.wallMs/1000)} s</span></p>
    <div className="alt-metrics"><div><small>Maximum temperature</small><strong>{fmt(m?.maximumK,5)} {m ? 'K' : ''}</strong></div><div><small>Water delivered / used CO₂</small><strong>{fmt(m?.waterUsedKg)} / {fmt(m?.dryIceUsedKg)} kg</strong></div><div><small>{config.engine === 'peat-fem' ? 'Internal energy' : 'Heat transferred'}</small><strong>{fmt(m?.energyJ)} J</strong></div><div><small>Energy / mass balance residual</small><strong>{fmt(m?.energyResidualJ)} J / {fmt(m?.massResidualKg)} kg</strong></div><div><small>O₂ / dry fuel inventories</small><strong>{fmt(m?.oxygenKg)} / {fmt(m?.fuelKg)} kg</strong></div><div><small>Net reaction heat rate</small><strong>{fmt(m?.reactionW)} {m?.reactionW != null ? 'W' : '· no combustion in proxy'}</strong></div></div>
    {m && <div className="alt-history">{compactRender && <small>Compact rendering budget: history chart hidden; accepted states retained.</small>}<button onClick={() => setPlot(p => !p)}>{plot ? 'Hide' : 'Show'} calculated temperature history</button>{plot && !compactRender && <svg viewBox="0 0 600 160" aria-label="Computed temperature history; common 293 to 1000 K scale"><path d="M20 20V130H570" stroke="#3f4a45" fill="none"/><path d={path} stroke="#d3bc8d" strokeWidth="1.5" fill="none"/><text x="24" y="17">1000 K</text><text x="24" y="150">293 K / 0 s</text><text x="505" y="150">{end} s</text></svg>}</div>}
    <details className="alt-config"><summary>Configure this independent instance</summary><div className="alt-config-grid">
      <label>Engine / model view<select aria-label={`Engine ${config.id}`} value={config.engine} onChange={e => { onIndividual(); onChange({ ...config, engine: e.target.value as EngineId }) }}>{ENGINES.map(e => <option value={e.id} key={e.id}>{e.label}</option>)}</select></label>
      <label>Medium · orthogonal to method<select aria-label={`Medium ${config.id}`} value={config.medium} onChange={e => { onIndividual(); onChange({ ...config, medium: e.target.value as MediumId }) }}>{MEDIA.map(medium => <option value={medium.id} key={medium.id}>{medium.category} · {medium.label}</option>)}</select></label>
      {config.engine === 'contact' && PARAMETERS.filter(p => p.key !== 'dryIceKg' || config.medium === 'co2-water').map(p => <label key={p.key}>{p.label} [{p.unit}]<input aria-label={`${p.label} ${config.id}`} type="number" min={p.min} max={p.max} step={p.step} value={config.thermal[p.key]} onChange={e => { const value = Number(e.target.value); if (!Number.isFinite(value) || value < p.min || value > p.max) return; onIndividual(); onChange({ ...config, thermal: { ...config.thermal, [p.key]: value } }) }}/></label>)}
      {config.engine === 'peat-fem' && <><label>Mesh resolution<select aria-label={`FEM mesh ${config.id}`} value={config.fem.n} onChange={e=>{onIndividual();onChange({...config,fem:{...config.fem,n:Number(e.target.value)}})}}>{[2,4,8].map(n=><option key={n} value={n}>{n}³ Q1 hexes</option>)}</select></label>{([['ignitionW','Ignition [W]',0,30,.5],['endS','FEM observation window [s]',1,600,1],['maxStepS','Maximum solver step [s]',.05,5,.05]] as const).map(([key,label,min,max,step])=><label key={key}>{label}<input aria-label={`${label} ${config.id}`} type="number" min={min} max={max} step={step} value={config.fem[key]} onChange={e=>{const value=Number(e.target.value);if(value<min||value>max||!Number.isFinite(value))return;onIndividual();onChange({...config,fem:{...config.fem,[key]:value}})}}/></label>)}</>}
      {config.engine === 'contact' && <label><input type="checkbox" checked={config.thermal.enabled} aria-label={`Enable intervention ${config.id}`} onChange={e => { onIndividual(); onChange({ ...config, thermal: { ...config.thermal, enabled: e.target.checked } }) }}/> Enable modeled intervention (contact only)</label>}
      <p>Seed {config.thermal.seed} · deterministic, no random forcing. Source: unspecified black-box disturbance; pressure-source thermodynamics N/A. Physical edits replace this run and its worker. Camera and plotting controls do not change solver accuracy.</p>
    </div></details>
    <details className="alt-limits"><summary>Scientific status & limitations</summary><p><b>Illustrative:</b> conceptual stages. <b>Modeled:</b> {v.status.modeled}. <b>Experimentally validated:</b> no.</p><p>{v.limitation}</p><p>Contact proxy: oxygen, reaction, remaining reactive fuel, re-ignition, penetration and suppression success are N/A. Source: {v.provenance}.</p></details>
  </article>
}
export default function AlternativesWorkspace({ selectedVariant, onSelectedVariant, navigation }: { navigation: {tab:'alternatives'|'compare';revision:number}; selectedVariant: VariantId; onSelectedVariant: (v: VariantId) => void }) {
  const [configs, setConfigs] = useState<PanelConfig[]>(() => readComparison(localStorage.getItem(SESSION_KEY)))
  const [tab, setTab] = useState<'alternatives' | 'compare' | 'science'>('compare')
  const [results, setResults] = useState<Record<string, PanelResult>>({}), resultRef = useRef(results)
  const [control, setControl] = useState<Control>({ epoch: 0, type: 'pause' }), [linked, setLinked] = useState(false), [linkedRunning, setLinkedRunning] = useState(false)
  const target = useRef<number | null>(null), mounted = useRef(true)
  const performanceBudget = useRenderBudget(configs.length)
  const v = variant(selectedVariant), linkReason = linkedCompatibility(configs)
  const onResult = useRef((id: string, result: PanelResult | undefined) => {
    if (!mounted.current) return
    const next = { ...resultRef.current }; if (result) next[id] = result; else delete next[id]
    resultRef.current = next; setResults(next)
  }).current
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { try { localStorage.setItem(SESSION_KEY, serializeComparison(configs)) } catch { /* Private/quota mode: current session remains usable. */ } }, [configs])
  useEffect(() => { setTab('alternatives') }, [selectedVariant])
  useEffect(() => { setTab(navigation.tab) }, [navigation])
  function command(type: Control['type'], targetS?: number, exceptId?: string) { if(type==='reset'){resultRef.current={};setResults({})} setControl(c => ({ epoch: c.epoch + 1, type, targetS, exceptId })) }
  function unlink(exceptId?: string) { if (linkedRunning) command('pause', undefined, exceptId); setLinkedRunning(false); setLinked(false); target.current = null }
  const mutate: Dispatch<SetStateAction<PanelConfig[]>> = next => { unlink(); setConfigs(next) }
  useEffect(() => {
    if (!linkedRunning || linkReason) return
    const active = configs.map(c => results[c.id])
    if (active.some(r => r?.error)) { setLinkedRunning(false); return }
    if (active.some(r => !r?.ready || !r.state)) return
    if (target.current !== null && active.some(r => r.state!.timeS < target.current! - 1e-8)) return
    const time = Math.max(...active.map(r => r.state!.timeS)), end = observationWindowS(configs[0])
    if (time >= end - 1e-8) { setLinkedRunning(false); return }
    const timer = setTimeout(() => { target.current = Math.min(end,time+.5); command('advance',target.current) }, 50)
    return () => clearTimeout(timer)
  }, [linkedRunning, results, configs, linkReason])
  function add(id: VariantId) { if (configs.length >= MAX_PANELS) return; mutate(old => [...old,freshPanel(uid(),id)]); setTab('compare') }
  function exportRun() {
    const contents = JSON.stringify({ format: 'zombie-fire-live-alternatives', schema: SESSION_SCHEMA, applicationVersion: '0.21.0', engineVersions: { contact: 'contactCooling-0.20-public-reference/v21.2', 'peat-fem': 'q1-five-step-0.20', concept: 'stages-1', particle: PARTICLE_API_VERSION },
      units: RECORD_UNITS, numerics: { contactIntegrationStepS: ALTERNATIVE_CONTACT_STEP_S, outputCheckpointStepS: .5 }, sourceStatus: 'Abstract pressure source unspecified; no thermodynamic prediction',
      linkedPhysicalTime: linked, fairness: comparisonNotes(configs), panels: configs.map(config => {
        const result=resultRef.current[config.id]
        return { config, result: currentRecord(config, result) }
      }), experimentalValidation: false }, (_,value) => ArrayBuffer.isView(value) ? Array.from(value as unknown as ArrayLike<number>) : value, 2)
    const url = URL.createObjectURL(new Blob([contents],{type:'application/json'})), a=document.createElement('a'); a.href=url; a.download='version21-alternatives.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <main className="alternatives-shell">
    <header className="alternatives-heading"><div><span className="alt-eyebrow">ZOMBIE FIRE / CAPSTONE RESEARCH / VERSION21</span><h1>Alternatives.</h1><p>Separate the concept. Compare what the model supports.</p></div><span className="alt-release">V21<span>Concepts & computation</span></span></header>
    <nav className="alternatives-tabs" aria-label="Alternatives workspace"><button aria-current={tab === 'alternatives' ? 'page' : undefined} onClick={() => setTab('alternatives')}>Alternatives</button><button aria-current={tab === 'compare' ? 'page' : undefined} onClick={() => setTab('compare')}>Compare Alternatives <small>{configs.length}</small></button><button aria-current={tab === 'science' ? 'page' : undefined} onClick={() => setTab('science')}>Mathematics & evidence</button></nav>
    {tab === 'alternatives' && <section className="alternatives-overview"><div className="alternatives-catalog">{VARIANTS.map(item => <button key={item.id} aria-pressed={item.id === selectedVariant} className={item.number.split('.').length > 3 ? 'is-child' : ''} onClick={() => onSelectedVariant(item.id)}><small>{item.number}</small><span>{item.label}<em>{item.subtitle}</em></span></button>)}</div><article className="alternative-definition"><span className="alt-eyebrow">{v.number} / {v.id === 'nanoparticles' ? 'PARTICLE DELIVERY · DECLARED MODEL SCOPE' : 'CONCEPT + DECLARED MODEL SCOPE'}</span><h2>{v.label}</h2><p>{v.subtitle}</p><div className="alt-definition-stages">{v.stages.map((stage,i) => <div key={stage}><small>{String(i+1).padStart(2,'0')}</small><span>{stage}</span></div>)}</div><p className="alt-scope-note">{v.limitation}</p><dl><div><dt>Illustrative</dt><dd>Concept stages / access into peat-root regions</dd></div><div><dt>Modeled</dt><dd>{v.status.modeled}</dd></div><div><dt>Experimentally validated</dt><dd>No</dd></div></dl><button className="alt-primary" disabled={!v.engines.length} onClick={() => {
      if (configs.length >= MAX_PANELS) mutate(old => [...old.slice(0,-1),freshPanel(old.at(-1)!.id,v.id)])
      else add(v.id)
      setTab('compare')
    }}>{v.engines.length ? configs.length >= MAX_PANELS ? 'Replace last comparison panel' : 'Add independent comparison panel' : v.id==='pressure-pulse' ? 'Live comparison unavailable · original preserved' : v.id==='vibratory-injection' ? 'Vibration comparison unavailable' : 'Particle model awaiting review'}</button><button onClick={() => setTab('science')}>Read implemented equations ↗</button></article></section>}
    <section hidden={tab !== 'compare'} className="alt-compare" aria-label="Independent live alternative comparison">
      <div className="alt-comparison-toolbar"><div><span className="alt-eyebrow">LIVE ALTERNATIVES · {configs.length} INDEPENDENT JOBS</span><p>Accepted solver states. Archived replay clocks remain in Previous simulations.</p></div><div><button onClick={() => { if (linked && !linkReason) { command('pause'); target.current=null;setLinkedRunning(true) } else command('run') }}>Start / resume all</button><button onClick={() => { setLinkedRunning(false);target.current=null;command('pause') }}>Pause all</button><button onClick={() => { setLinkedRunning(false);target.current=null;command('reset') }}>Reset all</button><button disabled={configs.length >= MAX_PANELS} onClick={() => add(selectedVariant)}>Add panel</button><button onClick={exportRun}>Export records</button></div></div>
      <div className="alt-fairness"><label><input type="checkbox" aria-label="Link physical time" checked={linked} disabled={!!linkReason} onChange={e => { command('pause');target.current=null;setLinkedRunning(false);setLinked(e.target.checked) }}/> Link accepted physical time</label><span>{linkReason ?? (linked ? 'Barrier coordination at 0.5 s checkpoints; individual control unlinks all.' : 'Same engine supports linked physical checkpoints.')}</span><button onClick={() => mutate(old => old.map(c => ({ ...c, thermal: { ...c.thermal, initialK: old[0].thermal.initialK, inletK: old[0].thermal.inletK, endS: old[0].thermal.endS, seed: old[0].thermal.seed }, fem: structuredClone(old[0].fem) })))}>Match initial conditions & window</button><button onClick={() => mutate(old => {
        const reference=old.find(c=>c.variantId!=='baseline')??old[0];return old.map(c=>({...c,thermal:{...c.thermal,waterKg:reference.thermal.waterKg,dryIceKg:reference.thermal.dryIceKg,flowKgS:reference.thermal.flowKgS}}))
      })}>Match finite supply budgets</button><p>{comparisonNotes(configs)}</p><p>Shared temperature scale 293–1000 K; charts clip outside it. Contact samples are independent lumped specimens, not a field mesh. Solver accuracy stays fixed; contact panels use lightweight SVG and FEM panels render on demand at device pixel ratio 1. No success ranking is calculated.</p></div>
      <p className="alt-performance" data-frame-p50={performanceBudget.p50} data-frame-p95={performanceBudget.p95} data-frame-samples={performanceBudget.samples}>Measured presentation frame intervals: median {fmt(performanceBudget.p50)} ms · p95 {fmt(performanceBudget.p95)} ms · {performanceBudget.samples} samples · {performanceBudget.compact ? 'compact' : 'standard'} display budget. Worker time is recorded per panel; these frame samples are not solver time or a guaranteed FPS.</p>
      <div className="alt-panel-grid">{configs.map(config => <Panel key={config.id} config={config} control={control} onResult={onResult} onIndividual={() => unlink(config.id)} coordinated={linkedRunning} compactRender={performanceBudget.compact} canAdd={configs.length < MAX_PANELS} canRemove={configs.length > 1}
        onChange={next => mutate(old => old.map(c => c.id===config.id?next:c))} onDuplicate={() => mutate(old => [...old,duplicatePanel(config,uid())])} onRemove={() => mutate(old => old.filter(c => c.id!==config.id))}/>)}</div>
      <p className="alt-footer-note">Thermal proxies can compare prescribed heat exchange and finite use only. Unknown mechanism, pressure response, fracture, collapse and vibration response have N/A predictions. Contact cooling cannot establish extinguishment or re-ignition prevention.</p>
    </section>
    {tab === 'science' && <AlternativeScience/>}
  </main>
}
function comparisonNotes(configs: PanelConfig[]) {
  const first=configs[0], sameEngine=configs.every(c=>c.engine===first.engine)
  const sameInitial=configs.every(c=>c.thermal.initialK===first.thermal.initialK&&c.thermal.inletK===first.thermal.inletK&&c.thermal.seed===first.thermal.seed&&c.thermal.endS===first.thermal.endS&&JSON.stringify(c.fem)===JSON.stringify(first.fem))
  return `${sameEngine?'Engine matched.':'Engines differ; physical metrics are not directly comparable.'} ${sameInitial?'Initial conditions, fixed geometry, seed and observation window matched.':'Initial conditions or observation windows differ; use matching controls.'} Resource differences: ${configs.map((c,i)=>`panel ${i+1}: ${c.variantId==='baseline'||!c.thermal.enabled||c.engine!=='contact'?0:c.thermal.waterKg} kg configured water, ${c.medium==='co2-water'&&c.thermal.enabled?c.thermal.dryIceKg:0} kg configured solid CO₂`).join('; ')}. Prescribed contact timing and UA may differ; pressure/vibration energy is unavailable and excluded.`
}

function useRenderBudget(panelCount: number) {
  const [result,setResult]=useState({p50:0,p95:0,samples:0,compact:false})
  useEffect(()=>{
    let request=0,last=0; const intervals:number[]=[]
    setResult({p50:0,p95:0,samples:0,compact:false})
    const tick=(now:number)=>{
      if(last && !document.hidden && now-last<1000)intervals.push(now-last)
      last=now
      if(intervals.length===120){const sorted=[...intervals].sort((a,b)=>a-b);const p50=sorted[60],p95=sorted[114];setResult(old=>({p50,p95,samples:120,compact:p95>28?true:p95<20?false:old.compact}));intervals.length=0}
      request=requestAnimationFrame(tick)
    }
    request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request)
  },[panelCount])
  return result
}
