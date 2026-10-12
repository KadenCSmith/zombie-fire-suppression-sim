import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { FinderPortal, ToolboxPortal, useCinematicUI } from '../../ui/CinematicUI'
import { FIELD_DEFAULTS, type FieldSettings, type FieldState } from './field'
import type { FieldMessage } from './field.worker'
import { VibratoryFieldScene, type FieldView } from './field-scene'
import './workspace.css'

const number=(value:number,places=2)=>value.toLocaleString(undefined,{maximumFractionDigits:places})
const physicalAt=(sceneTime:number)=>Math.min(60,Math.max(0,(sceneTime-24)*2))
function stageAt(time:number){return time<10?'Surface ignition':time<24?'Fire enters the peat':time<31?'Vibratory drilling':time<43?'Inject outward at multiple depths':time<54?'Wet peat · fading embers':'Treatment complete · inspect the field'}

export default function VibratoryWorkspace({onCompare,onDetails}:{onCompare:()=>void;onDetails:()=>void}) {
  const {open,panel}=useCinematicUI()
  const [settings,setSettings]=useState<FieldSettings>({...FIELD_DEFAULTS})
  const [history,setHistory]=useState<FieldState[]>([]),[status,setStatus]=useState<'calculating'|'complete'|'failed'|'cancelled'>('calculating')
  const [error,setError]=useState(''),[generation,setGeneration]=useState(0)
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[view,setView]=useState<FieldView>('natural')
  const [vibration,setVibration]=useState(true),[cameraDistance,setCameraDistance]=useState(15.75),[resetToken,setResetToken]=useState(0)
  const available=useRef(24),statusRef=useRef(status),workerRef=useRef<Worker|null>(null)
  useEffect(()=>{
    const worker=new Worker(new URL('./field.worker.ts',import.meta.url),{type:'module'})
    const jobId=crypto.randomUUID();workerRef.current=worker
    setHistory([]);setStatus('calculating');statusRef.current='calculating';setError('');setTime(0);available.current=24
    worker.onmessage=(event:MessageEvent<FieldMessage>)=>{
      const message=event.data
      if(message.jobId!==jobId||workerRef.current!==worker)return
      if(message.state){const state=message.state;setHistory(previous=>previous.at(-1)?.timeS===state.timeS?previous:[...previous,state]);available.current=24+state.timeS/2}
      if(message.type==='complete'){setStatus('complete');statusRef.current='complete';available.current=90;workerRef.current=null;worker.terminate()}
      if(message.type==='failed'){setStatus('failed');statusRef.current='failed';setError(message.error??'Calculation stopped at its last accepted state.');workerRef.current=null;worker.terminate()}
    }
    worker.onerror=event=>{if(workerRef.current!==worker)return;setStatus('failed');statusRef.current='failed';setError(event.message||'The calculation worker stopped.');setPlaying(false);workerRef.current=null;worker.terminate()}
    worker.postMessage({jobId,settings})
    return()=>{workerRef.current=null;worker.terminate()}
  },[settings,generation])
  useEffect(()=>{if(panel)setPlaying(false)},[panel])
  useEffect(()=>{
    if(!playing)return
    let request=0,last=performance.now(),elapsed=0
    const tick=(now:number)=>{
      elapsed+=Math.min(.1,(now-last)/1000);last=now
      if(elapsed>=1/30){const step=elapsed;elapsed=0;setTime(t=>Math.min(statusRef.current==='complete'?90:available.current,t+step*(t<18?2.8:1.4)))}
      request=requestAnimationFrame(tick)
    }
    request=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(request)
  },[playing])
  useEffect(()=>{if(time>=90)setPlaying(false)},[time])
  const target=physicalAt(time),state=[...history].reverse().find(s=>s.timeS<=target+1e-8)??history[0]
  const latest=history.at(-1),inField=time>=24
  const config=(key:'waterKg'|'flowKgS'|'inletK',value:number)=>setSettings(s=>({...s,[key]:value}))
  const cancel=()=>{workerRef.current?.terminate();workerRef.current=null;setStatus('cancelled');statusRef.current='cancelled';setPlaying(false)}
  const chart=history.map(s=>`${s.timeS/60*240},${44-Math.min(1,Math.max(0,(s.maximumK-280)/300))*40}`).join(' ')
  return <div className="vib-workspace" data-render-variant="vibratory-injection" data-vibratory-version="2" data-worker-status={status}>
    <VibratoryFieldScene time={time} state={state} view={view} vibration={vibration} enabled={settings.enabled&&settings.waterKg>0&&settings.flowKgS>0} cameraDistance={cameraDistance} resetToken={resetToken}/>
    <header className="vib-heading"><span>4.2.4 / EARTHQUAKE EXTINGUISHER</span><h1>Drill. Vibrate. Inject.</h1><p>Continuous liquid delivery into reacting peat.</p></header>
    <div className="vib-status"><i className={status}/><span>{status==='calculating'?`Calculating · ${number(latest?.timeS??0,0)} / 60 s`:status==='complete'?'Field calculation complete':status==='cancelled'?'Calculation cancelled':'Calculation stopped'}</span><button aria-label="Open earthquake simulation settings" onClick={()=>open('toolbox')}><SlidersHorizontal size={17}/></button></div>
    <div className="vib-view-tabs" role="group" aria-label="Earthquake field view">{(['natural','temperature','oxygen','water'] as const).map(id=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);if(time<24)setTime(24)}}>{id==='natural'?'Site':id==='water'?'Retained liquid':id[0].toUpperCase()+id.slice(1)}</button>)}</div>
    {inField&&view==='natural'&&<aside className="vib-site-key"><span>ILLUSTRATIVE TREATMENT</span><p>Vibrating access<br/>Injection at multiple depths<br/>Wetting and fading embers</p><small>Switch views to inspect the calculated field.</small></aside>}
    {inField&&view!=='natural'&&state&&<aside className="vib-readouts" aria-label="Accepted physical field measurements">
      <span className="vib-eyebrow">CALCULATED FIELD · EXPERIMENTAL</span>
      <div><small>Physical time</small><strong>{number(state.timeS,1)} <em>s</em></strong></div>
      <div><small>Peak peat temperature</small><strong>{number(state.maximumK-273.15,1)} <em>°C</em></strong></div>
      <div><small>Liquid delivered</small><strong>{number(state.deliveredKg,3)} <em>kg</em></strong></div>
      <div><small>Reservoir remaining</small><strong>{number(state.remainingKg,3)} <em>kg</em></strong></div>
      <svg viewBox="0 0 240 48" role="img" aria-label="Calculated peak temperature history"><line x1="0" x2="240" y1="46" y2="46" stroke="#ffffff20"/><polyline points={chart} fill="none" stroke="#d99b67" strokeWidth="1.5"/></svg>
      <small>Peak temperature · accepted history, 0–60 s</small>
    </aside>}
    {error&&<div className="vib-error" role="status">{error} Last accepted states are retained. <button onClick={()=>setGeneration(n=>n+1)}>Recalculate</button></div>}
    <footer className="vib-transport"><div className="vib-transport-head"><span>{stageAt(time)}</span><small>{inField?(view==='natural'?'Illustrative treatment sequence':'Calculated reacting peat field'):'Original 4.2.3 fire animation'}</small></div>
      <div className="vib-play-row"><button aria-label={playing?'Pause earthquake animation':'Play earthquake animation'} onClick={()=>{if(time>=90)setTime(0);setPlaying(p=>!p)}}>{playing?<Pause size={20}/>:<Play size={20}/>}</button><button aria-label="Restart earthquake animation" onClick={()=>{setTime(0);setPlaying(false);setResetToken(n=>n+1)}}><RotateCcw size={17}/></button><input aria-label="Earthquake animation time" type="range" min={0} max={90} step={.1} value={time} onChange={e=>{setPlaying(false);setTime(Math.min(Number(e.target.value),available.current))}}/><span>{number(time,1)} <small>/ 90 s</small></span></div>
      <div className="vib-bottom-note"><span>{view==='natural'?'Ground motion and fire-out choreography are illustrative.':'Temperature, gas transport, evaporation and reaction are computed.'}</span><button onClick={()=>open('toolbox')}>Model & limits ↗</button></div>
    </footer>
    <ToolboxPortal><section className="vib-tools"><h3>Earthquake Extinguisher · version 2</h3><p>Original fire opening, then an independently calculated 1,280-cell peat field with continuous finite liquid delivery. The ignition animation is illustrative; the treatment calculation begins from the inherited hot-peat initial condition.</p>
      {status==='calculating'?<button onClick={cancel}>Cancel calculation</button>:<button onClick={()=>setGeneration(n=>n+1)}>Recalculate field</button>}
      <label className="vib-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))}/>Continuous injection</label>
      <label>Total liquid supply <strong>{number(settings.waterKg)} kg</strong><input aria-label="Field liquid inventory" type="range" min={0} max={2} step={.05} value={settings.waterKg} onChange={e=>config('waterKg',Number(e.target.value))}/></label>
      <label>Prescribed liquid flow <strong>{number(settings.flowKgS,3)} kg/s</strong><input aria-label="Field liquid flow" type="range" min={0} max={.05} step={.005} value={settings.flowKgS} onChange={e=>config('flowKgS',Number(e.target.value))}/></label>
      <label>Inlet temperature <strong>{number(settings.inletK-273.15,1)} °C</strong><input aria-label="Field inlet temperature" type="range" min={273.15} max={323.15} step={1} value={settings.inletK} onChange={e=>config('inletK',Number(e.target.value))}/></label>
      <label className="vib-check"><input type="checkbox" checked={vibration} onChange={e=>setVibration(e.target.checked)}/>Show illustrative vibration</label><p>The Site view follows the reference sketch: shaking soil, disturbed clods, four lateral injection levels, wetting and disappearing embers. These are authored motion and treatment cues. Compaction, loosening, permeability changes, lateral liquid migration and drill forces are not calculated. The numerical liquid source is deposited at the prescribed advancing tip.</p>
      <label>Camera distance <input aria-label="Earthquake camera distance" type="range" min={5} max={19} step={.05} value={cameraDistance} onChange={e=>setCameraDistance(Number(e.target.value))}/></label><button onClick={()=>setResetToken(n=>n+1)}>Reset camera</button>
      <h4>Conservation at the displayed physical time</h4>{state&&<p>Mass residual {state.massResidualKg.toExponential(2)} kg. Energy residual {state.energyResidualJ.toExponential(2)} J. Imported enthalpy {number(state.inletEnergyJ)} J, including {number(state.liquidFlowWorkJ)} J of flow work. Water-species residual {state.waterSpeciesResidualKg.toExponential(2)} kg.</p>}
      <p>The calculated default 60 s run retains hot, reacting peat. The illustrative fire-out is not a calculated extinction result. Temperature, oxygen and retained-liquid views always show accepted numerical states. No treatment ranking or experimental validation is claimed.</p><button onClick={onCompare}>Compare supported contact components ↗</button><button onClick={onDetails}>Equations and evidence ↗</button>
    </section></ToolboxPortal>
    <FinderPortal><section className="vib-tools"><h3>4.2.4 · Vibratory drilling + continuous injection</h3><p>This revision uses the original initial fire animation without editing it. The following scene renders accepted spatial temperature, oxygen and liquid fields from the existing conservative gas/thermal/reaction solver with a new external liquid source.</p><p>One-step inherited peat oxidation; constant-property water calorics; ideal-gas/Darcy validity limits. Source mass and inlet enthalpy enter once. The liquid source follows assumed access geometry. Field liquid migration and vibration-induced mechanics remain unavailable.</p><p><a href="https://iapws.org/technical-guidance/release/IAPWS-95" target="_blank" rel="noreferrer">IAPWS reference properties</a> support auditing the inherited simplified water approximation; a full IAPWS equation of state is not implemented. <a href="https://doi.org/10.1071/WF16198" target="_blank" rel="noreferrer">Huang & Rein (2017)</a> provides peat-fire context; this reduced one-step field does not reproduce that multistep experiment.</p><button onClick={onDetails}>Read method evidence ↗</button></section></FinderPortal>
  </div>
}
