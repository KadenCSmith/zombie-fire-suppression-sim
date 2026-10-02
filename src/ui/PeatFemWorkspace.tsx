import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import PeatWorker from '../worker/peatFem.worker.ts?worker'
import { DEFAULT_SETTINGS, MATERIAL, SOURCE, PeatSolver, createMesh, sample, totals, oxidationRate, type Frame, type Settings } from '../peatfem/model'
import { PeatFemScene, FIELD_INFO, type PeatField } from './PeatFemScene'
import { ToolboxPortal, FinderPortal, useCinematicUI } from './CinematicUI'
import './peat-fem.css'
export interface PeatFemSession { settings:Settings; history:Frame[]; index:number; field:PeatField; probe:[number,number,number]; wireframe:boolean; nodes:boolean; overlay:boolean }
const fmt=(v:number)=>Number.isFinite(v)?v.toPrecision(4):'—'
export default function PeatFemWorkspace({session}:{session:MutableRefObject<PeatFemSession|undefined>}){
  const saved=session.current,ui=useCinematicUI()
  const [settings,setSettings]=useState<Settings>(saved?.settings??DEFAULT_SETTINGS)
  const [history,setHistory]=useState<Frame[]>(saved?.history??[]),[index,setIndex]=useState(saved?.index??0)
  const [field,setField]=useState<PeatField>(saved?.field??'temperature'),[probe,setProbe]=useState<[number,number,number]>(saved?.probe??[.05,0,.05])
  const [wireframe,setWireframe]=useState(saved?.wireframe??true),[nodes,setNodes]=useState(saved?.nodes??true),[overlay,setOverlay]=useState(saved?.overlay??true)
  const [status,setStatus]=useState('Starting worker…'),[running,setRunning]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('')
  const [pace,setPace]=useState(10),[replay,setReplay]=useState(false),[replaySpeed,setReplaySpeed]=useState(10),[reset,setReset]=useState(0)
  const worker=useRef<Worker|null>(null),runId=useRef(0),initialSaved=useRef(saved?.history.at(-1)),follow=useRef(true)
  const mesh=useMemo(()=>createMesh(settings.n,settings.lengthM,settings.ignitionWidthM),[settings])
  const frame=history[Math.min(index,history.length-1)],latest=history.at(-1)
  useEffect(()=>{session.current={settings,history,index,field,probe,wireframe,nodes,overlay}},[session,settings,history,index,field,probe,wireframe,nodes,overlay])
  useEffect(()=>{
    const w=new PeatWorker(),id=++runId.current;worker.current=w;setReady(false);setError('');setRunning(false);setReplay(false);setStatus('Starting worker…')
    w.onmessage=(event:MessageEvent<{type:string;runId:number;frame?:Frame;running:boolean;error?:string}>)=>{
      if(worker.current!==w||event.data.runId!==id)return
      const data=event.data;setReady(data.type!=='failed');setRunning(data.running);setError(data.error??'')
      setStatus(data.type==='failed'?'Solver stopped':data.type==='complete'?'Complete / paused':data.running?'Solving':'Ready / paused')
      if(data.frame){const next=data.frame;setHistory(old=>{
        const frames=old.length&&Math.abs(old.at(-1)!.timeS-next.timeS)<1e-10?[...old.slice(0,-1),next]:[...old,next]
        if(follow.current)setIndex(frames.length-1);return frames
      })}
    }
    w.onerror=event=>{if(worker.current!==w)return;setError(event.message||'Worker startup failed');setStatus('Worker failed');setReady(false);setRunning(false);w.terminate()}
    w.postMessage({type:'init',runId:id,settings,frame:initialSaved.current});initialSaved.current=undefined
    return()=>{w.terminate();if(worker.current===w)worker.current=null}
  },[settings,reset])
  useEffect(()=>{
    if(!replay||!frame||!latest)return
    const began=performance.now(),base=frame.timeS;let request=0
    const tick=(now:number)=>{const desired=base+(now-began)/1000*replaySpeed;let next=0;while(next+1<history.length&&history[next+1].timeS<=desired)next++;setIndex(next);if(desired>=latest.timeS){setReplay(false);return}request=requestAnimationFrame(tick)}
    request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request)
  },[replay,replaySpeed,history,latest])
  const send=(type:string)=>worker.current?.postMessage({type,runId:runId.current,pace})
  const pause=()=>{send('pause');setReplay(false)}
  const update=(partial:Partial<Settings>)=>{pause();follow.current=true;setHistory([]);setIndex(0);setSettings(old=>({...old,...partial}));setError('')}
  const resetRun=()=>{pause();follow.current=true;initialSaved.current=undefined;setHistory([]);setIndex(0);setReset(v=>v+1)}
  const view=frame?totals(mesh,frame):undefined,base=useMemo(()=>totals(mesh,new PeatSolver(settings).frame),[settings,mesh])
  const range:[number,number]=field==='temperature'?[300,Math.max(600,Math.ceil((view?.maximumK??600)/100)*100)]:field==='oxygen'?[0,settings.oxygenKgM3||.2796]:field==='fuel'?[0,MATERIAL.rho]:[0,MATERIAL.rho*MATERIAL.charYield]
  const values=frame?{T:sample(mesh,frame.temperature,...probe),oxygen:sample(mesh,frame.oxygen,...probe),fuel:sample(mesh,frame.fuel,...probe)}:undefined
  const energyError=view&&frame?view.energyJ-base.energyJ-frame.ledger.ignitionJ-frame.ledger.reactionJ+frame.ledger.heatOutJ:0
  const componentError=view&&frame?view.componentsKg-base.componentsKg-frame.ledger.oxygenInKg:0
  const docs=()=>{ui.setFinderTab('docs');ui.open('finder')}
  const download=()=>{
    const text=JSON.stringify({format:'peat-fire-q1-fem',schema:1,baseCommit:'161e7a4a1f8c35765e1878c132db79977be1f5ea',settings,source:SOURCE,material:MATERIAL,scope:'3D fixed-property dry peat oxidation subset; O2 diffusion only; no experimental validation',history},(_,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as ArrayLike<number>):v,2)
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='peat-fire-fem-recording.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const histories=history.filter(h=>h.timeS<=(frame?.timeS??0)),tempHistory=histories.map(h=>sample(mesh,h.temperature,...probe)),maxHistory=Math.max(600,...tempHistory)
  const curve=tempHistory.map((T,i)=>`${i?'L':'M'}${20+(histories[i].timeS/Math.max(1,latest?.timeS??1))*550},${110-(T-300)/(maxHistory-300)*95}`).join(' ')
  const node=probe.map(v=>Math.round(v/mesh.h)),nodeId=node[0]+(mesh.n+1)*(node[1]+(mesh.n+1)*node[2])
  const cell=probe.map(v=>Math.min(mesh.n-1,Math.floor(v/mesh.h))),elementId=cell[0]+mesh.n*(cell[1]+mesh.n*cell[2])
  return <main className="fem-shell" data-fem-time={frame?.timeS??0}>
    <header className="fem-heading"><div><span>3D FINITE ELEMENTS · DEVELOPER VIEW</span><h1>Peat Fire FEM.</h1><p>Heat · oxygen diffusion · finite peat oxidation</p></div><button onClick={docs}>Physical formulas ↗</button></header>
    <p className="fem-scope">Reduced dry-peat model · fixed properties · passive β-char · no Darcy flow, drying or char oxidation. Numerical verification is separate from experimental validation.</p>
    <section className="fem-controls" aria-label="Peat FEM run controls">
      <button disabled={!ready||!!error||latest?.timeS===settings.endS} onClick={()=>{setReplay(false);follow.current=true;setIndex(history.length-1);send(running?'pause':'run')}}>{running?'Pause Peat Fire FEM':'Run Peat Fire FEM'}</button>
      <button disabled={!ready||running||!!error} onClick={()=>{follow.current=true;setReady(false);send('step')}}>Single FEM step</button><button onClick={resetRun}>Reset FEM</button>
      <label>Solver pace<select aria-label="FEM solver pace" value={pace} onChange={e=>{const v=Number(e.target.value);setPace(v);if(running)worker.current?.postMessage({type:'run',runId:runId.current,pace:v})}}>{[1,10,30].map(v=><option key={v} value={v}>{v} simulated s / wall s</option>)}</select></label>
      <button onClick={()=>ui.open('toolbox')}>Model & display settings</button><output role="status">{status}</output>
    </section>
    {error&&<p className="fem-error" role="alert">{error} · Last accepted state retained. Reset or change settings to continue.</p>}
    <section className="fem-stage">
      <div className="fem-viewport">{frame&&<PeatFemScene mesh={mesh} frame={frame} field={field} wireframe={wireframe} nodes={nodes} overlay={overlay} range={range} onProbe={setProbe}/>}
        <div className="fem-scene-caption">Full 3D domain solved · half-volume cutaway displayed · drag to orbit / scroll to zoom / click to probe</div>
        <div className="fem-legend"><strong>{FIELD_INFO[field].label}</strong><span>{FIELD_INFO[field].unit}</span><div className="fem-color-ramp"/><div><span>{fmt(range[0])}</span><span>{fmt(range[1])}</span></div><small>Q1 interpolation of accepted nodal fields; color display uses float32.</small></div>
      </div>
      <aside className="fem-readouts"><dl>
        <div><dt>Physical simulation time</dt><dd>{frame?.timeS.toFixed(3)??'0'} s</dd></div>
        <div><dt>Current spatial maximum</dt><dd>{view?.maximumK.toFixed(2)??'—'} K</dd><small>node {view?.maximumNode} · {view&&Array.from(mesh.coordinates.subarray(3*view.maximumNode,3*view.maximumNode+3)).map(fmt).join(', ')} m</small></div>
        <div><dt>Peak so far</dt><dd>{frame?.peak.temperatureK.toFixed(2)??'—'} K</dd><small>node {frame?.peak.node} at {frame?.peak.timeS.toFixed(3)} physical s</small></div>
        <div><dt>Actual FEM mesh</dt><dd>{mesh.n**3} Q1 hexes · {(mesh.n+1)**3} nodes</dd><small>{2*(mesh.n+1)**3} transport DOFs · h={mesh.h.toFixed(5)} m</small></div>
        <div><dt>Oxygen inventory</dt><dd>{fmt(view?.oxygenKg??0)} kg O₂</dd><small>φ c storage, c in kg/m³ gas · oxygen-only transport</small></div>
        <div><dt>Dry peat / passive char</dt><dd>{fmt(view?.peatKg??0)} / {fmt(view?.charKg??0)} kg</dd><small>Released lumped product gas: {fmt(frame?.ledger.productGasKg??0)} kg</small></div>
        <div><dt>Accepted outer step / split error</dt><dd>{fmt(frame?.stepS??0)} s / {fmt(frame?.splittingError??0)}</dd><small>two half steps accepted · {frame?.rejectedSteps??0} rejected candidates</small></div>
        <div><dt>CG heat / oxygen iterations</dt><dd>{frame?.heatSolve.iterations??0} / {frame?.oxygenSolve.iterations??0}</dd><small>Relative residuals: {fmt(frame?.heatSolve.relativeResidual??0)} / {fmt(frame?.oxygenSolve.relativeResidual??0)} · chemistry uses frozen-rate splitting, no Newton solve</small></div>
        <div><dt>Reduced energy residual</dt><dd>{fmt(energyError)} J</dd><small>Ignition {fmt(frame?.ledger.ignitionJ??0)} J; reaction {fmt(frame?.ledger.reactionJ??0)} J; outward heat {fmt(frame?.ledger.heatOutJ??0)} J</small></div>
        <div><dt>Modeled component residual</dt><dd>{fmt(componentError)} kg</dd><small>Includes O₂ boundary exchange {fmt(frame?.ledger.oxygenInKg??0)} kg; not full gas-mixture closure</small></div>
      </dl></aside>
    </section>
    <section className="fem-probe"><div><strong>FE probe · ({probe.map(v=>v.toFixed(4)).join(', ')}) m</strong><p>{fmt(values?.T??0)} K · {fmt(values?.oxygen??0)} kg O₂/m³ gas · {fmt(values?.fuel??0)} kg peat/m³ bulk</p><small>Element {elementId}; nearest node {nodeId}: {frame?.temperature[nodeId].toFixed(2)} K. Sample grid and probe use the actual Q1 basis.</small></div><svg viewBox="0 0 600 140" role="img" aria-label="Probe temperature history in kelvin against physical seconds"><path d="M20 10V110H570" stroke="#50696a" fill="none"/><path d={curve} stroke="#eecc7a" fill="none" strokeWidth="2"/><text x="20" y="135">0 s · 300 K</text><text x="360" y="135">{latest?.timeS.toFixed(2)} s · upper {maxHistory.toFixed(0)} K</text></svg></section>
    <section className="fem-replay"><button disabled={running||history.length<2} onClick={()=>{follow.current=false;if(index>=history.length-1)setIndex(0);setReplay(v=>!v)}}>{replay?'Pause recorded replay':'Replay solved states'}</button><label>Recorded state<input aria-label="FEM recorded state" type="range" min={0} max={Math.max(0,history.length-1)} value={index} disabled={running||!history.length} onChange={e=>{follow.current=false;setReplay(false);setIndex(Number(e.target.value))}}/></label><label>Replay rate<select value={replaySpeed} onChange={e=>setReplaySpeed(Number(e.target.value))}>{[.5,1,10,30].map(v=><option value={v} key={v}>{v} physical s / wall s</option>)}</select></label><span>{history.length} recorded accepted states · no temporal field interpolation</span></section>
    <p className="fem-evidence">Element, diffusion, positivity, ignition, depletion and ledger tests implemented. Reaction-front convergence and matched experimental validation remain incomplete. Coarse h={mesh.h.toFixed(4)} m may miss a thin reaction front. Render FPS / 40 FPS acceptance: unmeasured.</p>
    <ToolboxPortal><section className="fem-toolbox"><h2>Peat FEM settings</h2>
      <label>Analysis mesh<select aria-label="FEM mesh" value={settings.n} onChange={e=>update({n:Number(e.target.value)})}>{[4,8,16].map(n=><option value={n} key={n}>{n}³ Q1 hexes · {(n+1)**3} nodes</option>)}</select></label>
      <label>Field<select aria-label="FEM field" value={field} onChange={e=>setField(e.target.value as PeatField)}>{Object.entries(FIELD_INFO).map(([key,value])=><option key={key} value={key}>{value.label} · {value.unit}</option>)}</select></label>
      <label><input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/> Actual FE mesh wireframe</label><label><input type="checkbox" checked={nodes} onChange={e=>setNodes(e.target.checked)}/> FE nodes</label><label><input aria-label="FEM temperature grid" type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/> Sampled temperature grid (25 FE samples, K)</label>
      {([['oxygenKgM3','Ambient oxygen [kg O₂/m³ gas]',0,1.2,.01],['ignitionW','Localized ignition [W]',0,30,.5],['ignitionS','Ignition duration [s]',0,600,10],['maxStepS','Maximum numerical step [s]',.125,5,.125]] as const).map(([key,label,min,max,step])=><label key={key}>{label}<input aria-label={label} type="number" value={settings[key]} min={min} max={max} step={step} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>=min&&v<=max)update({[key]:v})}}/></label>)}
      <p>Physical edits reset the run. Camera, field, grid, pace and replay controls do not change the solver's accepted-step trajectory. 25 grid samples are a display aid, not an independent mesh.</p><button onClick={download} disabled={!history.length}>Export FEM recording</button><button onClick={docs}>Physical formulas</button>
    </section></ToolboxPortal>
    <FinderPortal documentation>{ui.finderTab==='docs'&&<article className="fem-formulas"><h2>Peat Fire FEM · implemented equations</h2><p>{SOURCE.status}. Fixed 0.10 m cube; dry peat; local thermal-equilibrium effective medium. All numerical state is SI.</p>
      <pre>{'C ∂T/∂t − div(k grad T) = Q r\nφ ∂c/∂t − div(φ D grad c) = −ν r\nḟ = −r; ḃ = 0.61 r\nQ = 11.60 MJ/kg; ν = 0.89 kg O₂/kg peat\nr = ρ₀ 10^16.80 exp(−195000/(RT))\n    (f/ρ₀)^2.33 [(1+c/ρg,ref)^0.24−1]'}</pre>
      <p>c: kg O₂ per m³ gas; f,b: kg per m³ bulk. c/ρg,ref is a mass fraction relative to a fixed dry carrier, not ambient oxygen volume percent. Gas-mixture pressure and product transport are omitted. The original model includes five reactions; only its peat oxidation step is transferred.</p>
      <h3>Weak form and actual FEM</h3><pre>{'∫ w C Ṫ + ∫ k ∇w·∇T + ∫top w h(T−Ta)\n  −∫ w Qr −∫top w P a = 0\nNₐ = (1+sₐξ)(1+tₐη)(1+uₐζ)/8\nMab = ∫ Na Nb; Kab = ∫ ∇Na·∇Nb\n(Mlumped + dt K + dt B) znew = rhs'}</pre>
      <p>Continuous trilinear Q1 hexes; diagonal Jacobian h/2, positive determinant h³/8; 2×2×2 volume and 2×2 face Gauss quadrature. Row-sum mass and Robin lumping on a cubic isotropic mesh give a monotone transport operator. Backward Euler transport, bounded CG residual, local conservative reaction and step-doubling error control. No runtime Dirichlet boundary: top Robin oxygen/heat and finite Gaussian ignition; other faces sealed/insulated. Verification uses symmetric Dirichlet elimination.</p>
      <h3>Current-case worked example</h3><p>At the current FE probe and timestamp {frame?.timeS.toFixed(3)} s, T={fmt(values?.T??300)} K, c={fmt(values?.oxygen??0)} kg/m³ gas, f={fmt(values?.fuel??0)} kg/m³ bulk. The actual runtime <code>oxidationRate</code> returns {fmt(values?oxidationRate(values.T,values.fuel,values.oxygen):0)} kg peat/(m³ bulk s). Accepted heat uses the inventory-constrained extent, not this unbounded instantaneous rate.</p>
      <h3>Source, parameters and evidence</h3><p><a href={SOURCE.url} target="_blank" rel="noreferrer">{SOURCE.title}</a>: {SOURCE.locator}; images inspected. Density 123, cp 1840 and intrinsic conductivity 1 are transferred; fixed φ=0.918 and k=0.082 are adaptations. D=2×10⁻⁵ m²/s, reference gas density 1.2 kg/m³ and mass transfer speed 0.002 m/s are illustrative. No measurements match this reduced fixture.</p><p>Runtime: <code>src/peatfem/model.ts</code> (basis, elementOperators, transport, oxidationRate, PeatSolver, sample). Checks: <code>tests/peatfem.test.ts</code>. Specification and evidence: <code>docs/PEAT_FIRE_FEM_MODEL.md</code>. Historical formulas remain available through the historical formula route.</p>
      <h3>Future suppression seam</h3><p>All interventions are disabled. The empty external-exchange ledger is tested for identity. Water would need infiltration, retention, multiphase/latent heat and changed transport; CO₂ would need mixture enthalpy and pressure flow; dry ice additionally needs finite conservative phase change. These are unimplemented requirements.</p>
    </article>}</FinderPortal>
  </main>
}
