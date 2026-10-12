import { useEffect, useState } from 'react'
import { AlternativeScene } from '../../ui/AlternativeScene'
import { freshPanel, linkedCompatibility, type AcceptedState, type PanelConfig } from '../model'
import { createParticleRun } from './physics'
import { ParticleComparison } from './comparison'
import { matchedWaterOnly, particleScenario, type ParticleScenario } from './scenarios'
import './style.css'
function exportRun(config: PanelConfig, state: AcceptedState | undefined, runId: string, history: AcceptedState[]) {
  const contents = { format: 'zombie-fire-particle-diagnostic', engineVersion: 'v21.3/particle-delivery-d1', method: '4.2.2', registeredId: 'nanoparticles', runId, config, acceptedState: state ?? null, history,
    experimentallyValidated: false, reviewStatus: 'No verified7 realism pass; see signed D ledger by frozen source commit. Central transport/soil coupling unvalidated.', units: 'SI and kelvin; fractions carry explicit denominators', exportedAt: new Date().toISOString() }
  const url=URL.createObjectURL(new Blob([JSON.stringify(contents,null,2)],{type:'application/json'})), a=document.createElement('a')
  a.href=url; a.download=`particle-${runId}.json`; a.click(); URL.revokeObjectURL(url)
}
function Panel({ initial, label, onConfig }: { initial: PanelConfig; label: string; onConfig: (config: PanelConfig)=>void }) {
  const [config,setConfig]=useState(()=>structuredClone(initial)),[state,setState]=useState<AcceptedState>(),[history,setHistory]=useState<AcceptedState[]>([])
  const [target,setTarget]=useState(initial.thermal.endS),[error,setError]=useState(''),[runId,setRunId]=useState(()=>crypto.randomUUID())
  useEffect(()=>{setConfig(structuredClone(initial));setState(undefined);setHistory([]);setError('');setTarget(initial.thermal.endS);setRunId(crypto.randomUUID())},[initial])
  function change(next: PanelConfig) { onConfig(next);setConfig(next);setState(undefined);setHistory([]);setError('');setRunId(crypto.randomUUID()) }
  function run() {
    try { const r=createParticleRun(config), samples:AcceptedState[]=[r.snapshot()]; for(let s=1;s<target;s+=1)samples.push(r.advanceTo(s)); const next=r.advanceTo(target);samples.push(next);setState(next);setHistory(samples);setError('') }
    catch(e) { setState(undefined);setHistory([]);setError(String(e instanceof Error?e.message:e)) }
  }
  return <article className="d-card" aria-label={label} data-run-id={runId}>
    <h2>{label}</h2><p>{config.medium==='water'?'Matched water-only treatment':'Water + fine dry-ice particles'}</p>
    <div className="d-controls"><label>Observation target (s)<input aria-label={`${label} observation target`} type="number" min={0} max={config.thermal.endS} step={.5} value={target} onChange={e=>setTarget(Number(e.target.value))}/></label><button onClick={run}>Run {label}</button><button onClick={()=>{setState(undefined);setHistory([]);setError('');setRunId(crypto.randomUUID())}}>Reset {label}</button><button onClick={()=>exportRun(config,state,runId,history)}>Export {label}</button></div>
    <p className="d-note">Independent accepted state, run identity and target. Source contact begins at0s; water withdrawal starts{config.thermal.contactStartS}s at{config.thermal.flowKgS}kg/s. Inlet{config.thermal.inletK}K; specimen{config.thermal.initialK}K; window{config.thermal.endS}s.</p>
    {error && <p role="alert" className="d-error">{error} No result accepted.</p>}
    <ParticleComparison config={config} onChange={change} state={state} history={history}/>
  </article>
}
export default function ParticleWorkspace({ onCompare,onDetails }: { onCompare:()=>void;onDetails:()=>void }) {
  const [scenario,setScenario]=useState<ParticleScenario>('conduction-reference'),[pair,setPair]=useState(()=>{const a=freshPanel('particle-left','nanoparticles');return {a,b:matchedWaterOnly(a,'particle-water')}})
  const [reported,setReported]=useState(()=>pair)
  function select(value:ParticleScenario) { const a=particleScenario(freshPanel('particle-left','nanoparticles'),value);setScenario(value);const next={a,b:matchedWaterOnly(a,'particle-water')};setPair(next);setReported(next) }
  return <main className="d-workspace" data-render-variant="nanoparticles" data-particle-model="conditional-d1">
    <header><small>4.2.2 / SOLID INERT GAS NANO PARTICLES</small><h1>Water + fine dry-ice particle injection</h1><p>Test whether particles survive delivery. Full upstream loss is a valid outcome. Conditional thermal/transport sensitivity; no experimental validation or suppression prediction.</p>
      <button onClick={onCompare}>Shared comparison workspace ↗</button><button onClick={onDetails}>Equations & evidence ↗</button></header>
    <details className="d-context"><summary>Original fire-spreading and drilling context · illustrative</summary><p>Read-only original scene through38presentation seconds. This is authored context, separate from the warm numerical specimen. Treatment, pressure and extinction are not inferred from this scene.</p><div style={{height:'48vh'}}><AlternativeScene id="nanoparticles" time={38} resetToken={0} cameraDistance={14}/></div></details>
    <section className="d-scenario"><label>Analytical study scenario<select aria-label="Particle scenario" value={scenario} onChange={e=>select(e.target.value as ParticleScenario)}><option value="conduction-reference">Conduction reference · test complete upstream loss</option><option value="film-sensitivity">Unmeasured film-resistance sensitivity · test conditional survival</option><option value="pre-sublimated">Fully pre-sublimated counterfactual</option><option value="water-only">Zero particles / water-only</option><option value="off">Intervention off</option><option value="freezing-stop">Bulk-freezing rejection test</option></select></label>
      <p>Scenarios are configured examples, not measured conditions or apparatus operating instructions. The film sensitivity changes assumed heat resistance and residence; both matched panels receive the same schedule and transport conditions. All particle exposure starts in the source.</p></section>
    <p role="status">{linkedCompatibility([reported.a,reported.b])?`Comparison conditions differ: ${linkedCompatibility([reported.a,reported.b])} Restore a scenario for the matched control.`:'Water quantity/schedule, initial conditions, transport, soil and numerics are matched. CO₂ is a disclosed additional cold resource.'}</p>
    <div className="d-pair"><Panel initial={pair.a} label="Particle case" onConfig={a=>setReported(previous=>({...previous,a}))}/><Panel initial={pair.b} label="Water control" onConfig={b=>setReported(previous=>({...previous,b}))}/></div>
    <footer><p>Pressure, deposition/penetration, spatial gas/O₂, reacting-fire response, extinction and re-ignition: unavailable. Local ice shells/blockage remain unverified even in warm liquid. Neither a surviving-solid result nor cooling establishes feasible delivery or fire suppression.</p></footer>
  </main>
}
