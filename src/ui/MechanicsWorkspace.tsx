import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { BENCHMARK_SIZE, DEFAULT_BENCHMARK, MECHANICS_FIELDS, fieldValues, peakDisplacement, type BenchmarkInputs, type BenchmarkRun, type MechanicsField, type MechanicsLaw } from '../mechanics/comparison'
import ComparisonWorker from '../worker/mechanicsComparison.worker.ts?worker'
import { ModelSelector, type PhysicsWorkspace } from './ModelSelector'
import { ParameterSlider } from './ParameterSlider'
import { MechanicsScene, type CameraMemory, type MechanicsCamera } from './MechanicsScene'
import { StudyVersions } from './StudyVersions'
import type { StudyVersion } from './studyModel'

export interface MechanicsSession {
  inputs: BenchmarkInputs; runs: Partial<Record<MechanicsLaw, BenchmarkRun>>; stage: number; field: MechanicsField; view: MechanicsCamera; compare: boolean; law: MechanicsLaw; amplification: number; mesh: boolean
}
const NAMES: Record<MechanicsLaw,string> = { elastic: 'Linear elastic', 'drucker-prager': 'Frictional plasticity' }
export default function MechanicsWorkspace({ onWorkspace, version, onVersion, session, camera }: {
  onWorkspace: (value: PhysicsWorkspace) => void; version: StudyVersion; onVersion: (version: StudyVersion) => void;
  session: MutableRefObject<MechanicsSession | undefined>; camera: MutableRefObject<CameraMemory | undefined>
}) {
  const saved = session.current
  const [inputs,setInputs] = useState(saved?.inputs ?? structuredClone(DEFAULT_BENCHMARK))
  const [runs,setRuns] = useState<Partial<Record<MechanicsLaw,BenchmarkRun>>>(saved?.runs ?? {})
  const [stage,setStage] = useState(saved?.stage ?? 0)
  const [field,setField] = useState<MechanicsField>(saved?.field ?? 'displacement')
  const [view,setView] = useState<MechanicsCamera>(saved?.view ?? 'orbit')
  const [compare,setCompare] = useState(saved?.compare ?? true)
  const [law,setLaw] = useState<MechanicsLaw>(saved?.law ?? 'drucker-prager')
  const [amplification,setAmplification] = useState(saved?.amplification ?? 8)
  const [mesh,setMesh] = useState(saved?.mesh ?? true)
  const [running,setRunning] = useState(false)
  const [progress,setProgress] = useState('')
  const [error,setError] = useState('')
  const [playing,setPlaying] = useState(false)
  const [rate,setRate] = useState(3)
  const [probe,setProbe] = useState('Click an element to inspect its value.')
  const worker = useRef<Worker | null>(null)
  useEffect(() => { session.current = { inputs,runs,stage,field,view,compare,law,amplification,mesh } }, [inputs,runs,stage,field,view,compare,law,amplification,mesh,session])
  useEffect(() => () => worker.current?.terminate(), [])
  const laws: MechanicsLaw[] = compare ? ['elastic','drucker-prager'] : [law]
  const frameCount = Math.min(...laws.map(key => runs[key]?.frames.length ?? 0))
  const shownStage = Math.min(stage,Math.max(0,frameCount-1))
  const frames = laws.map(key => runs[key]?.frames[shownStage])
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setStage(old => { if (old >= frameCount-1) { setPlaying(false); return old }; return old+1 }), 1000/rate)
    return () => window.clearInterval(id)
  },[playing,frameCount,rate])
  const range = useMemo<[number,number]>(() => {
    if (field === 'mesh') return [1,inputs.resolution**3]
    let lo=0,hi=0
    for (const run of Object.values(runs)) for (const frame of run.frames) for (const value of fieldValues(frame,field,inputs.resolution)) { lo=Math.min(lo,value); hi=Math.max(hi,value) }
    return lo===hi ? [0,field === 'plastic' ? 0.001 : 1] : [lo,hi]
  },[runs,field,inputs.resolution])
  const stop = () => { worker.current?.terminate(); worker.current=null; setRunning(false); setPlaying(false) }
  const update = (next: BenchmarkInputs) => { stop(); setInputs(next); setRuns({}); setStage(0); setError(''); setProgress('Inputs changed · calculate a new sequence'); setProbe('Click an element to inspect its value.') }
  const material = (key: keyof BenchmarkInputs['material'], value: number) => {
    const next = { ...inputs.material,[key]:value }
    if (key === 'frictionSlope') next.dilationSlope=Math.min(next.dilationSlope,value)
    update({ ...inputs,material:next })
  }
  const calculate = () => {
    stop(); setRuns({}); setStage(0); setError(''); setRunning(true); setProgress('Preparing paired calculations…')
    const instance = new ComparisonWorker(); worker.current=instance
    instance.onmessage = event => {
      if (worker.current !== instance) return
      const data = event.data
      if (data.type==='result') setRuns(old => ({ ...old,[data.run.law]:data.run }))
      if (data.type==='progress') setProgress(`${NAMES[data.law as MechanicsLaw]} · equilibrium ${data.stage}/${2*inputs.increments}`)
      if (data.type==='done') { setRunning(false); setProgress('Calculation finished'); instance.terminate(); worker.current=null }
      if (data.type==='error') { setError(data.message); setRunning(false); instance.terminate(); worker.current=null }
    }
    instance.onerror = event => { setError(event.message || 'The mechanics worker stopped unexpectedly.'); setRunning(false); instance.terminate(); worker.current=null }
    // Calculate both from fresh, identical inputs so comparison can be toggled without re-solving.
    instance.postMessage({ inputs,laws:['elastic','drucker-prager'] })
  }
  const exportResults = () => {
    const blob = new Blob([JSON.stringify({ format:'zombie-fire-mechanics-comparison',version:1,geometry:BENCHMARK_SIZE,inputs,runs,clock:'quasi-static load stages; no physical elapsed time',scope:'homogeneous incremental benchmark; no pore-pressure coupling or predicted fracture' },(_key,value) => ArrayBuffer.isView(value) ? Array.from(value as unknown as ArrayLike<number>) : value,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mechanics-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const info=MECHANICS_FIELDS[field]
  return <div className="ops-shell">
    <header className="ops-header"><div className="ops-brand"><strong>ZOMBIE FIRE</strong><span>SIMULATION ENVIRONMENT / 0.10</span></div><ModelSelector value="mechanics" onChange={onWorkspace} /><StudyVersions version={version} onSelect={onVersion} /></header>
    <div className="ops-title"><div><span className="ops-eyebrow">MECHANICS / VERIFICATION FIXTURE 01</span><h1>Load. Deform. Recover.</h1></div><span className="ops-status">{running ? 'CALCULATING' : frameCount ? 'RESULTS READY' : 'AWAITING CALCULATION'}<i /></span></div>
    <main className="ops-main">
      <aside className="ops-controls" aria-label="Mechanics scenario controls">
        <h2>Scenario controls</h2><p>Homogeneous 2 × 2 × 1 m block. Both laws use identical inputs, roller base and free sides.</p>
        <ParameterSlider label="Peak top traction" value={inputs.tractionPa/1000} min={0} max={20} step={0.1} unit="kPa" defaultValue={9.2} note="Compression; uniform applied load" onChange={v=>update({...inputs,tractionPa:v*1000})} />
        <ParameterSlider label="Young’s modulus" value={inputs.material.youngsPa/1e6} min={0.5} max={10} step={0.1} unit="MPa" defaultValue={1} note="Assumed stiffness" onChange={v=>material('youngsPa',v*1e6)} />
        <ParameterSlider label="Yield intercept" value={inputs.material.cohesionPa/1000} min={1} max={20} step={0.1} unit="kPa" defaultValue={8} note="Drucker–Prager; not measured cohesion" onChange={v=>material('cohesionPa',v*1000)} />
        <details className="ops-details"><summary>Developer tools · material coefficients</summary>
          <ParameterSlider label="Poisson ratio" value={inputs.material.poisson} min={0} max={0.45} step={0.01} unit="1" defaultValue={0.3} onChange={v=>material('poisson',v)} />
          <ParameterSlider label="Friction slope" value={inputs.material.frictionSlope} min={0} max={1} step={0.01} unit="1" defaultValue={0.35} note="Not an angle; bounds dilation" onChange={v=>material('frictionSlope',v)} />
          <ParameterSlider label="Dilation slope" value={inputs.material.dilationSlope} min={0} max={inputs.material.frictionSlope} step={0.01} unit="1" defaultValue={Math.min(0.05,inputs.material.frictionSlope)} onChange={v=>material('dilationSlope',v)} />
          <ParameterSlider label="Hardening modulus" value={inputs.material.hardeningPa/1000} min={10} max={200} step={1} unit="kPa" defaultValue={20} onChange={v=>material('hardeningPa',v*1000)} />
        </details>
        <details className="ops-details"><summary>Numerical resolution</summary><label>Elements per axis<select aria-label="Elements per axis" value={inputs.resolution} onChange={e=>update({...inputs,resolution:Number(e.target.value)})}>{[1,2,4].map(n=><option key={n} value={n}>{n} · {n**3} bricks</option>)}</select></label>
          <ParameterSlider label="Increments per loading leg" value={inputs.increments} min={5} max={40} step={1} unit="steps" defaultValue={10} onChange={v=>update({...inputs,increments:Math.round(v)})} />
          <p>Refine the mesh and load increments independently. A 2% principal-strain guard bounds the small-deformation demonstration.</p>
        </details>
        <button className="ops-primary" onClick={running ? stop : calculate}>{running ? 'Cancel calculation' : 'Calculate both models'}</button>
        <button className="ops-secondary" onClick={()=>update(structuredClone(DEFAULT_BENCHMARK))}>Reset physical inputs</button>
        <p className="ops-restart-note">Physical edits clear results and reset the load sequence. Appearance and playback controls preserve them.</p>
        {error && <p role="alert" className="ops-warning">{error}</p>}
        <p role="status" className="ops-progress">{progress}</p>
      </aside>
      <section className="ops-visual" aria-label="Mechanics results">
        <div className="ops-toolbar"><label>Rendering view<select aria-label="Rendering view" value={field} onChange={e=>{setField(e.target.value as MechanicsField);setProbe('Click an element to inspect its value.')}}>{Object.entries(MECHANICS_FIELDS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label><label className="ops-check"><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)} />Compare models</label>{!compare && <select aria-label="Constitutive model" value={law} onChange={e=>setLaw(e.target.value as MechanicsLaw)}>{Object.entries(NAMES).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>}</div>
        <div className="ops-viewport">
          <div className="ops-scene-labels">{laws.map((key,index)=><span key={key}>{compare ? `${index===0?'A':'B'} / ` : ''}{NAMES[key]}<small>{key==='elastic' ? 'Reversible strain' : 'Yield + irreversible strain'}</small></span>)}</div>
          <MechanicsScene frames={frames} n={inputs.resolution} field={field} range={range} amplification={amplification} mesh={mesh} view={view} memory={camera} onInspect={(id,value)=>setProbe(`Element ${id+1} · ${value.toPrecision(4)} ${info.unit}`)} />
          <div className="ops-scene-foot"><span>Scale bar: 2 m · divisions 1 m</span><span>Deformation ×{amplification} · display only</span></div>
        </div>
        <div className="ops-view-controls"><div>{(['orbit','front','top'] as const).map(key=><button key={key} aria-pressed={view===key} onClick={()=>{camera.current=undefined;setView(key)}}>{key==='orbit'?'3D orbit':key==='front'?'Front':'Top'}</button>)}</div><label><input type="checkbox" checked={mesh} onChange={e=>setMesh(e.target.checked)} />Mesh</label><label>Deformation ×<input aria-label="Deformation amplification" type="number" min={1} max={20} value={amplification} onChange={e=>{const v=Number(e.target.value);if(v>=1&&v<=20)setAmplification(v)}} /></label></div>
        <div className="ops-legend"><span>{(Math.abs(range[0])<1e-8?0:range[0]).toPrecision(3)}</span><i /><span>{(Math.abs(range[1])<1e-8?0:range[1]).toPrecision(3)} {info.unit}</span><small>{field==='displacement'?'Mean nodal magnitude per cell':field==='plastic'?'Mean of 8 integration points':field==='stress'?'Cell mean; gravity reference excluded':'Click a visible element'}</small></div>
        <p className="ops-probe" aria-live="polite">{probe}</p>
        <div className="ops-telemetry">{laws.map(key=>{
          const run=runs[key],f=run?.frames[shownStage]
          return <article key={key}><h3>{NAMES[key]}</h3><dl><div><dt>Peak displacement</dt><dd>{f ? (peakDisplacement(f.result)*1000).toFixed(3) : '—'} <small>mm</small></dd></div><div><dt>Plastic history</dt><dd>{f ? f.result.yielded.reduce((a,b)=>a+b,0) : '—'} <small>/ {inputs.resolution**3} elements</small></dd></div><div><dt>Force residual</dt><dd>{f?.result.residualN.toExponential(1) ?? '—'} <small>N</small></dd></div><div><dt>Setup / solve</dt><dd>{run ? `${run.setupMs.toFixed(0)} / ${run.solveMs.toFixed(0)}` : '—'} <small>ms</small></dd></div></dl>{run && run.status!=='complete' && <p className="ops-warning" role="status">{run.message}</p>}</article>
        })}</div>
      </section>
    </main>
    <footer className="ops-playback"><div><button className="ops-primary" disabled={frameCount<2 || running} onClick={()=>{if(shownStage>=frameCount-1)setStage(0);setPlaying(v=>!v)}}>{playing?'Pause replay':'Play load cycle'}</button><label>Replay speed<select aria-label="Mechanics replay speed" value={rate} onChange={e=>setRate(Number(e.target.value))}>{[1,3,6].map(n=><option key={n} value={n}>{n} stages/s</option>)}</select></label><button className="ops-secondary" disabled={!frameCount} onClick={exportResults}>Export results</button></div><label className="ops-timeline">Equilibrium stage <output>{shownStage} / {Math.max(0,frameCount-1)} · {((frames[0]?.tractionPa??0)/1000).toFixed(2)} kPa</output><input aria-label="Mechanics load stage" type="range" min={0} max={Math.max(0,frameCount-1)} step={1} value={shownStage} disabled={!frameCount} onChange={e=>{setPlaying(false);setStage(Number(e.target.value))}} /></label><p>Quasi-static load → unload. Physical elapsed time: not modeled. Shared camera, stage and color scale.</p></footer>
    <div className="ops-scope">BENCHMARK, NOT A SITE PREDICTION · Incremental stress only; gravity is a separate reference balance. No pore-pressure feedback, roots, cap contact, cracks or fire in this fixture. Material constants are assumptions. Coupled fracture is not available.</div>
  </div>
}
