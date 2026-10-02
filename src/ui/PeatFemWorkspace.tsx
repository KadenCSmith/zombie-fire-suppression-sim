import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import PeatWorker from '../worker/peatFem.worker.ts?worker'
import { DEFAULT_SETTINGS, SOURCE, PeatSolver, totals, type Frame, type Settings } from '../peatfem/coupled'
import { createMesh, sample } from '../peatfem/model'
import { CONSTITUENTS, REACTIONS } from '../peatfem/chemistry'
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
  const [throughput,setThroughput]=useState(0)
  const worker=useRef<Worker|null>(null),runId=useRef(0),initialSaved=useRef(saved?.history.at(-1)),follow=useRef(true)
  const mesh=useMemo(()=>createMesh(settings.n,settings.lengthM,settings.ignitionWidthM),[settings])
  const frame=history[Math.min(index,history.length-1)],latest=history.at(-1)
  useEffect(()=>{session.current={settings,history,index,field,probe,wireframe,nodes,overlay}},[session,settings,history,index,field,probe,wireframe,nodes,overlay])
  useEffect(()=>{
    const w=new PeatWorker(),id=++runId.current;worker.current=w;setReady(false);setError('');setRunning(false);setReplay(false);setStatus('Starting worker…')
    w.onmessage=(event:MessageEvent<{type:string;runId:number;frame?:Frame;running:boolean;error?:string;solveMs?:number;physicalSolvedS?:number}>)=>{
      if(worker.current!==w||event.data.runId!==id)return
      const data=event.data;setReady(data.type!=='failed');setRunning(data.running);setError(data.error??'')
      setThroughput(data.solveMs?1000*(data.physicalSolvedS??0)/data.solveMs:0)
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
  const maxima=frame?Math.max(...frame[field]):1
  const range:[number,number]=field==='temperature'?[300,Math.max(600,Math.ceil(maxima/100)*100)]:field==='oxygen'?[0,Math.max(.01,settings.oxygenMassFraction,maxima)]:field==='pressure'?[settings.ambientPressurePa*.95,Math.max(settings.ambientPressurePa*1.05,maxima)]:field==='porosity'?[0,1]:field==='darcySpeed'?[0,Math.max(1e-6,maxima)]:field==='peclet'?[0,Math.max(1,maxima)]:[0,Math.max(1,maxima,field==='fuel'?settings.dryDensityKgM3:field==='water'?settings.dryDensityKgM3*settings.moistureRatio:settings.dryDensityKgM3*.3)]
  const values=frame?{T:sample(mesh,frame.temperature,...probe),oxygen:sample(mesh,frame.oxygen,...probe),fuel:sample(mesh,frame.fuel,...probe),pressure:sample(mesh,frame.pressure,...probe),water:sample(mesh,frame.water,...probe),darcy:sample(mesh,frame.darcySpeed,...probe)}:undefined
  const energyError=view&&frame?view.energyJ-base.energyJ-frame.ledger.ignitionJ-frame.ledger.reactionJ+frame.ledger.heatOutJ+frame.ledger.gasEnthalpyOutJ:0
  const componentError=view&&frame?view.componentsKg-base.componentsKg+frame.ledger.gasBoundaryKg.reduce((a,b)=>a+b,0):0
  const docs=()=>{ui.setFinderTab('docs');ui.open('finder')}
  const download=()=>{
    const text=JSON.stringify({format:'peat-fire-q1-fem',schema:2,baseCommit:'161e7a4a1f8c35765e1878c132db79977be1f5ea',settings,source:SOURCE,material:CONSTITUENTS,reactions:REACTIONS,scope:'3D five-step fixed-geometry LTE; compressible Darcy mixture, conservative gas species and enthalpy; declared property/gas adaptations; no experimental validation',history},(_,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as ArrayLike<number>):v,2)
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='peat-fire-fem-recording.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const histories=history.filter(h=>h.timeS<=(frame?.timeS??0)),tempHistory=histories.map(h=>sample(mesh,h.temperature,...probe)),maxHistory=Math.max(600,...tempHistory)
  const curve=tempHistory.map((T,i)=>`${i?'L':'M'}${20+(histories[i].timeS/Math.max(1,latest?.timeS??1))*550},${110-(T-300)/(maxHistory-300)*95}`).join(' ')
  const node=probe.map(v=>Math.round(v/mesh.h)),nodeId=node[0]+(mesh.n+1)*(node[1]+(mesh.n+1)*node[2])
  const cell=probe.map(v=>Math.min(mesh.n-1,Math.floor(v/mesh.h))),elementId=cell[0]+mesh.n*(cell[1]+mesh.n*cell[2])
  return <main className="fem-shell" data-fem-time={frame?.timeS??0}>
    <header className="fem-heading"><div><span>3D FINITE ELEMENTS · DEVELOPER VIEW</span><h1>Peat Fire FEM.</h1><p>Drying · pyrolysis · peat / char oxidation · Darcy mixture transport</p></div><button onClick={docs}>Physical formulas ↗</button></header>
    <p className="fem-scope">Irish-moss column kinetics · five finite condensed inventories and four gas pools · evolving fixed-volume properties. Gas products use a declared thermodynamic surrogate. Shrinkage, liquid flow and condensation are omitted; experimental validation is pending.</p>
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
        <div><dt>Measured compute throughput</dt><dd>{fmt(throughput)} physical s / compute s</dd><small>Accepted advance calls including rejected candidates, since this worker started. Pace schedules work; it does not change physical time steps.</small></div>
        <div><dt>Current spatial maximum</dt><dd>{view?.maximumK.toFixed(2)??'—'} K</dd><small>node {view?.maximumNode} · {view&&Array.from(mesh.coordinates.subarray(3*view.maximumNode,3*view.maximumNode+3)).map(fmt).join(', ')} m</small></div>
        <div><dt>Peak so far</dt><dd>{frame?.peak.temperatureK.toFixed(2)??'—'} K</dd><small>node {frame?.peak.node} at {frame?.peak.timeS.toFixed(3)} physical s</small></div>
        <div><dt>Actual FEM mesh</dt><dd>{mesh.n**3} Q1 hexes · {(mesh.n+1)**3} nodes</dd><small>{6*(mesh.n+1)**3} heat / pressure / four-species nodal fields · h={mesh.h.toFixed(5)} m</small></div>
        <div><dt>Oxygen inventory</dt><dd>{fmt(view?.oxygenKg??0)} kg O₂</dd><small>True gas-mixture mass fraction; gas storage and pressure follow the ideal-mixture EOS</small></div>
        <div><dt>Dry peat / both chars</dt><dd>{fmt(view?.peatKg??0)} / {fmt(view?.charKg??0)} kg</dd><small>Cumulative generated emissions pool: {fmt(frame?.ledger.productGasKg??0)} kg</small></div>
        <div><dt>Condensed water / ash</dt><dd>{fmt(view?.waterKg??0)} / {fmt(view?.ashKg??0)} kg</dd><small>Vapor and emissions are conservative transported gas pools.</small></div>
        <div><dt>Probe pressure / Darcy flux</dt><dd>{fmt(values?.pressure??0)} Pa / {fmt(values?.darcy??0)} m/s</dd><small>Absolute pressure; superficial volume flux; pore velocity = q / gas-filled fraction.</small></div>
        <div><dt>Accepted outer step / split error</dt><dd>{fmt(frame?.stepS??0)} s / {fmt(frame?.splittingError??0)}</dd><small>two half steps accepted · {frame?.rejectedSteps??0} rejected candidates</small></div>
        <div><dt>Heat / species solve iterations</dt><dd>{frame?.heatSolve.iterations??0} / {frame?.oxygenSolve.iterations??0}</dd><small>Relative residuals: {fmt(frame?.heatSolve.relativeResidual??0)} / {fmt(frame?.oxygenSolve.relativeResidual??0)} · pressure CG {frame?.pressureSolve.iterations??0} iterations; gas/heat Picard {frame?.nonlinearIterations??0}; error {fmt(frame?.nonlinearError??0)}</small></div>
        <div><dt>LTE internal-energy residual</dt><dd>{fmt(energyError)} J</dd><small>Ignition {fmt(frame?.ledger.ignitionJ??0)} J; reaction {fmt(frame?.ledger.reactionJ??0)} J; outward heat {fmt(frame?.ledger.heatOutJ??0)} J; gas enthalpy {fmt(frame?.ledger.gasEnthalpyOutJ??0)} J</small></div>
        <div><dt>Total mixture + condensed mass residual</dt><dd>{fmt(componentError)} kg</dd><small>Includes O₂ boundary exchange {fmt(frame?.ledger.oxygenInKg??0)} kg; all four gas pools and five condensed inventories included</small></div>
      </dl></aside>
    </section>
    <section className="fem-probe"><div><strong>FE probe · ({probe.map(v=>v.toFixed(4)).join(', ')}) m</strong><p>{fmt(values?.T??0)} K · {fmt(values?.oxygen??0)} kg O₂/kg gas · {fmt(values?.fuel??0)} kg peat/m³ bulk</p><small>Element {elementId}; nearest node {nodeId}: {frame?.temperature[nodeId].toFixed(2)} K. Sample grid and probe use the actual Q1 basis.</small></div><svg viewBox="0 0 600 140" role="img" aria-label="Probe temperature history in kelvin against physical seconds"><path d="M20 10V110H570" stroke="#50696a" fill="none"/><path d={curve} stroke="#eecc7a" fill="none" strokeWidth="2"/><text x="20" y="135">0 s · 300 K</text><text x="360" y="135">{latest?.timeS.toFixed(2)} s · upper {maxHistory.toFixed(0)} K</text></svg></section>
    <section className="fem-replay"><button disabled={running||history.length<2} onClick={()=>{follow.current=false;if(index>=history.length-1)setIndex(0);setReplay(v=>!v)}}>{replay?'Pause recorded replay':'Replay solved states'}</button><label>Recorded state<input aria-label="FEM recorded state" type="range" min={0} max={Math.max(0,history.length-1)} value={index} disabled={running||!history.length} onChange={e=>{follow.current=false;setReplay(false);setIndex(Number(e.target.value))}}/></label><label>Replay rate<select value={replaySpeed} onChange={e=>setReplaySpeed(Number(e.target.value))}>{[.5,1,10,30].map(v=><option value={v} key={v}>{v} physical s / wall s</option>)}</select></label><span>{history.length} recorded accepted states · no temporal field interpolation</span></section>
    <p className="fem-evidence">Element, diffusion, positivity, ignition, depletion and ledger tests implemented. Coupled convergence and measured experiment comparison are separate analysis gates. Coarse h={mesh.h.toFixed(4)} m may miss a thin reaction front. Render FPS / 40 FPS acceptance: unmeasured.</p>
    <ToolboxPortal><section className="fem-toolbox"><h2>Peat FEM settings</h2>
      <label>Analysis mesh<select aria-label="FEM mesh" value={settings.n} onChange={e=>update({n:Number(e.target.value)})}>{[4,8,16].map(n=><option value={n} key={n}>{n}³ Q1 hexes · {(n+1)**3} nodes</option>)}</select></label>
      <label>Field<select aria-label="FEM field" value={field} onChange={e=>setField(e.target.value as PeatField)}>{Object.entries(FIELD_INFO).map(([key,value])=><option key={key} value={key}>{value.label} · {value.unit}</option>)}</select></label>
      <label><input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/> Actual FE mesh wireframe</label><label><input type="checkbox" checked={nodes} onChange={e=>setNodes(e.target.checked)}/> FE nodes</label><label><input aria-label="FEM temperature grid" type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/> Sampled temperature grid (25 FE samples, K)</label>
      {([['oxygenMassFraction','Ambient oxygen [kg O₂/kg gas]',0,1,.01],['moistureRatio','Initial water / dry peat [kg/kg]',0,1.5,.05],['dryDensityKgM3','Initial dry bulk density [kg/m³]',50,300,1],['ambientPressurePa','Ambient gas pressure [Pa absolute]',80000,120000,100],['permeabilityM2','Intrinsic gas permeability [m²]',1e-14,1e-9,1e-13],['ignitionW','Localized ignition [W]',0,30,.5],['ignitionS','Ignition duration [s]',0,600,10],['maxStepS','Maximum numerical step [s]',.125,5,.125]] as const).map(([key,label,min,max,step])=><label key={key}>{label}<input aria-label={label} type="number" value={settings[key]} min={min} max={max} step={step} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>=min&&v<=max)update({[key]:v})}}/></label>)}
      <p>Physical edits reset the run. Camera, field, grid, pace and replay controls do not change the solver's accepted-step trajectory. 25 grid samples are a display aid, not an independent mesh.</p><button onClick={download} disabled={!history.length}>Export FEM recording</button><button onClick={docs}>Physical formulas</button>
    </section></ToolboxPortal>
    <FinderPortal documentation>{ui.finderTab==='docs'&&<article className="fem-formulas"><h2>Peat Fire FEM · implemented equations</h2><p>{SOURCE.status}. All state is SI; temperature is K. The 3D cube is an illustrative verification case, not the source column experiment.</p>
      <pre>{'∂(θg ρg)/∂t + div(ρg q) = Sg\nq = −K krg / μ (grad p − ρg g)\n∂(θg ρg Yj)/∂t + div(ρg q Yj − θg ρg D grad Yj) = Sj\nΣYj=1; ΣJj=0; ΣSj=Sg\n∂U/∂t + div(ρg q cp,g (T−300)) − div(k grad T) = −Σ ΔHk rk\nU = [Σ mi cp,i + Σ gj cv,j](T−300); cv,j=cp,g−R/Mj\np = R T Σ(gj/Mj) / θg; θg=1−Σ(mi/ρs,i)'}</pre>
      <p>All inventories mi and gj are kg per m³ bulk. Oxygen, nitrogen, vapor and a lumped emissions pool are transported. Oxygen Y is kg O₂/kg total gas, not volume percent. Emissions use MW=28.97 g/mol and common cp=1000 J/(kg K), explicit illustrative thermodynamic assumptions; resolved CO₂/CO emissions are unavailable.</p>
      <h3>Five-step chemistry</h3><pre>{'rk = msource,0 10^logA exp(−Ek/(RT)) (mA/msource,0)^nk g(YO₂)\ng=1 for drying/pyrolysis; g=(1+YO₂)^nO−1 for oxidation\nWater → vapor; peat → 0.28 α-char + gas\nPeat + 0.89 O₂ → 0.61 β-char + 1.28 emissions\nβ-char + 2.21 O₂ → 0.04 ash + 3.17 emissions\nα-char + 2.12 O₂ → 0.07 ash + 3.05 emissions'}</pre>
      <p>The source mass is initial water for drying and initial dry peat for peat and both chars. The same constrained extent vector updates every source and heat; drying latent heat appears once (2.26 MJ/kg). Reaction heat is relative to the declared 300 K sensible-energy reference. Local subcycling limits thermal/source changes; stiff oxygen uses a conservative exponential inventory step. Condensation and detailed elemental emissions are not resolved.</p>
      <table><thead><tr><th>Process</th><th>log₁₀ Z [s⁻¹]</th><th>E [kJ/mol]</th><th>n / nO</th><th>ΔH [MJ/kg]</th></tr></thead><tbody>{REACTIONS.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.log10A}</td><td>{r.E/1000}</td><td>{r.n} / {r.nO}</td><td>{r.enthalpy/1e6}</td></tr>)}</tbody></table>
      <h3>FEM weak form and coupling</h3><pre>{'∫ w ∂storage/∂t − ∫ grad w·flux + ∫boundary w flux·n − ∫w source=0\nNₐ=(1+sₐξ)(1+tₐη)(1+uₐζ)/8\nKab=∫k grad Na·grad Nb; Jacobian diag(h/2), det J=h³/8'}</pre>
      <p>Continuous 3D Q1 hexahedra, 2×2×2 volume and 2×2 face quadrature, row-sum mass lumping and cell-mean variable coefficients. Pressure uses compressible storage, Galerkin Darcy stiffness and symmetric Dirichlet elimination with physical row scaling. Species and enthalpy use conservative upwind graph viscosity on the assembled FEM operator; this stabilizes advection and is spatially diffusive. Equal species diffusivities enforce zero summed diffusive mass flux. This is stabilized nodal FEM, not a relabeled finite-volume module.</p>
      <p>Operator sequence: conservative local reaction → coupled pressure/species EOS and gas enthalpy/conduction Picard iterations → exact EOS evaluation. Two half steps are accepted after a full-step error comparison. Pressure at the top is ambient; other mass boundaries are sealed. Top composition exchange sums to zero, with physical inflow composition and upwind outflow; finite Gaussian ignition and iterated nonlinear radiation/convection are integrated in the same ledgers. Closed fixtures seal and insulate all boundaries.</p>
      <h3>Properties, sources and evidence</h3><p><a href={SOURCE.url} target="_blank" rel="noreferrer">{SOURCE.title}</a>: rendered Tables 1–2 and Eq 5–8 inspected. Table porosity entries conflict with intrinsic/bulk densities, so runtime derives volume fractions from inventories. Constituent properties are constant; mixture storage, conduction, pore radiation and gas-filled space evolve. The fixed mesh does not shrink. Pore-radiation length 0.5 mm, gas D=2×10⁻⁵ m²/s, μ=1.8×10⁻⁵ Pa·s and the cubic liquid-connectivity closure are explicit assumptions. K=10⁻¹² m² is a model setting, not measured hot-peat permeability.</p>
      <p>Current probe at {frame?.timeS.toFixed(3)} physical s: T={fmt(values?.T??0)} K; oxygen={fmt(values?.oxygen??0)} kg/kg gas; water={fmt(values?.water??0)} kg/m³ bulk; p={fmt(values?.pressure??0)} Pa; q={fmt(values?.darcy??0)} m/s.</p>
      <p>Runtime: src/peatfem/coupled.ts, chemistry.ts, operators.ts. Verification: tests/peatfem-chemistry.test.ts, peatfem-flow.test.ts, peatfem-coupled.test.ts. The reduced model.ts fixture remains separately verified. docs/PEAT_FIRE_FEM_MODEL.md and docs/review/peat-fem/ contain current source registry, analysis results and limitations. Numerical verification, calibration, measured comparison and validation status are separate.</p>
      <h3>Future suppression seam</h3><p>All interventions remain disabled; empty exchanges have identity tests. Water treatment needs liquid retention, infiltration and condensation; injected gases need validated mixture yields and heat exchange; cryogenic agents need finite phase inventories and latent energy; deformation needs a verified moving-volume balance. No active suppressant is implemented.</p>
    </article>}</FinderPortal>
  </main>
}
