import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Layers, Thermometer, Wind, Cloud, Tags, RotateCcw, Play, Pause, Crosshair } from 'lucide-react'
import { type PhysicsWorkspace } from './ModelSelector'
import { FireSequenceScene, type FireFieldSnapshot, type FireSequenceLayers } from './FireSequenceScene'
import { FIRE_SEQUENCE_DURATION as DURATION, acceptedFireFrame,  type FireSourceMode, type FireSequenceView } from '../story/fireSequence'
import { CURRENT_FIRE_STAGES as STAGES, currentSequenceStage as sequenceStage, currentPeatCoverage, advancePresentationTime, PRESENTATION_TIMING, PRESENTATION_PLAYBACK_DURATION } from '../story/firePresentation'
import type { FireProtocolCache } from '../coupled/fireProtocolRunner'
import { FireExperimentControls, DEFAULT_FIRE_SETTINGS, type FireExperimentSettings } from './FireExperimentControls'
import { contactCoolingState } from '../story/contactCooling'
import './fire-sequence.css'
import { FinderPortal, ToolboxPortal, useCinematicUI } from './CinematicUI'

export type ProtocolCache = FireProtocolCache
export interface FireSequenceSession { time:number;speed:number;mode:FireSourceMode;view:FireSequenceView;layers:FireSequenceLayers;loop:boolean;cache?:ProtocolCache;settings?:FireExperimentSettings;labels?:boolean;cameraDistance?:number }
const clock=(seconds:number)=>seconds>=3600?`${(seconds/3600).toFixed(2)} h`:seconds>=60?`${(seconds/60).toFixed(1)} min`:`${seconds.toFixed(1)} s`
function validCache(value:unknown):value is ProtocolCache {
  if(!value||typeof value!=='object')return false
  const cache=value as ProtocolCache,d=cache.domain,n=d?d.nx*d.ny*d.nz:0
  if(cache.schemaVersion!==1||cache.kind!=='surface-ignition-protocol'||!d||![d.nx,d.ny,d.nz].every(value=>Number.isInteger(value)&&value>0)||n>100000||d.widthM!==8||d.lengthM!==8||d.depthM!==3.2||!Array.isArray(cache.frames)||!cache.frames.length)return false
  return cache.frames.every((frame,index)=>Number.isFinite(frame.timeS)&&frame.timeS>=0&&(index===0||frame.timeS>=cache.frames[index-1].timeS)&&Number.isFinite(frame.dryIceKg)&&[frame.temperatureK,frame.oxygen,frame.co2].every(values=>Array.isArray(values)&&values.length===n&&values.every(Number.isFinite))&&(!frame.metrics||[frame.metrics.maxTemperatureK,frame.metrics.reactedFuelKg].every(Number.isFinite)))
}
export default function FireSequenceWorkspace({onWorkspace,session}:{onWorkspace:(workspace:PhysicsWorkspace)=>void;session?:MutableRefObject<FireSequenceSession|undefined>}){
  const { panel, open, query } = useCinematicUI()
  const [scrollProgress,setScrollProgress]=useState(0)
  const hero=useRef<HTMLDivElement>(null),entered=useRef(false)
  const saved=session?.current,[time,setTime]=useState(saved?.time??0),[speed,setSpeed]=useState(saved?.speed??1),[mode,setMode]=useState<FireSourceMode>(saved?.mode??'rapid'),[view,setView]=useState<FireSequenceView>(saved?.view??'natural')
  const [playing,setPlaying]=useState(false),[loop,setLoop]=useState(saved?.loop??false),[layers,setLayers]=useState<FireSequenceLayers>(saved?.layers??{fire:true,gas:true,water:true,anatomy:true}),[resetToken,setResetToken]=useState(0),[cache,setCache]=useState<ProtocolCache|undefined>(saved?.cache),[cacheStatus,setCacheStatus]=useState('Loading accepted calculation…')
  const bundledCache=useRef<ProtocolCache|undefined>(undefined),acceptedCacheRef=useRef(saved?.cache)
  const [settings,setSettings]=useState<FireExperimentSettings>(saved?.settings??DEFAULT_FIRE_SETTINGS)
  const [cameraDistance,setCameraDistance]=useState(saved?.cameraDistance??15.75)
  const [labels,setLabels]=useState(saved?.labels??true)
  useEffect(()=>{
    let request=0
    const scroll=()=>{cancelAnimationFrame(request);request=requestAnimationFrame(()=>{
      const node=hero.current;if(!node)return
      const span=Math.max(1,node.offsetHeight-window.innerHeight)
      const progress=Math.max(0,Math.min(1,-node.getBoundingClientRect().top/span))
      setScrollProgress(progress)
      if(progress>=.995&&!entered.current){entered.current=true;setPlaying(true)}
    })}
    scroll();window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll)
    return()=>{cancelAnimationFrame(request);window.removeEventListener('scroll',scroll);window.removeEventListener('resize',scroll)}
  },[])
  useEffect(()=>{if(panel)setPlaying(false)},[panel])
  const timeRef=useRef(time),stage=sequenceStage(time),stageIndex=STAGES.findIndex(item=>item.id===stage.id)
  useEffect(()=>{if(session)session.current={time,speed,mode,view,layers,loop,cache,settings,labels,cameraDistance}},[session,time,speed,mode,view,layers,loop,cache,settings,labels,cameraDistance])
  useEffect(()=>{
    const controller=new AbortController()
    fetch(`${import.meta.env.BASE_URL}fire-sequence-cache.json`,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('cache unavailable');return response.json()}).then(value=>{if(!validCache(value))throw new Error('cache format mismatch');bundledCache.current=value;if(!acceptedCacheRef.current){acceptedCacheRef.current=value;setCache(value);setCacheStatus('Bundled numerical history loaded')}else setCacheStatus('Retained numerical history loaded')}).catch(error=>{if(error.name!=='AbortError')setCacheStatus(acceptedCacheRef.current?'Retained history available · bundled reference unavailable':'Numerical history unavailable · story remains illustrative')})
    return()=>controller.abort()
  },[])
  useEffect(()=>{
    if(!playing)return
    let request=0,last=performance.now(),paint=last
    const tick=(now:number)=>{const elapsed=Math.min(.2,(now-last)/1000);last=now;timeRef.current=advancePresentationTime(timeRef.current,elapsed,speed,loop);if(timeRef.current>=DURATION){if(loop)timeRef.current=0;else{timeRef.current=DURATION;setTime(DURATION);setPlaying(false);return}}if(now-paint>=1000/30){setTime(timeRef.current);paint=now}request=requestAnimationFrame(tick)}
    request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request)
  },[playing,speed,loop])
  const seek=(next:number)=>{const bounded=Math.max(0,Math.min(DURATION,next));timeRef.current=bounded;setTime(bounded)}
  const play=()=>{if(time>=DURATION)seek(0);setPlaying(value=>!value)}
  const displayCache=cache
  const cacheFrame=useMemo(()=>displayCache?acceptedFireFrame(displayCache.frames,mode==='rapid'&&time>=55?54.9:time,displayCache.ignitionEndS,PRESENTATION_TIMING.spreadEnd):undefined,[displayCache,time,mode])
  const fieldFrame=useMemo<FireFieldSnapshot|undefined>(()=>displayCache&&cacheFrame?{...cacheFrame,dryIceKg:cacheFrame.phase==='treatment'?cacheFrame.dryIceKg:undefined,nx:displayCache.domain.nx,ny:displayCache.domain.ny,nz:displayCache.domain.nz}:undefined,[displayCache,cacheFrame])
  const contact=useMemo(()=>contactCoolingState(time,mode),[time,mode])
  const gap=time>=69?(mode==='rapid'?'The woven hose feeds a connected fracture network. Water advances from the hose through reached junctions, darkening peat and extinguishing depicted embers. Field suppression is not predicted.':'The woven hose feeds short illustrated fractures. Wet peat darkens where the assumed water front reaches. Field suppression is not predicted.'):time>=55?(mode==='rapid'?'After the fixed-size cap lands, a brief illustrated CO₂ release jolts soil, depicts local oxygen displacement, dims nearby embers and opens fine fractures. Pressure and oxygen changes are not solved.':'The fixed-size cap remains seated while a separate finite contact model tracks gradual dry-ice cooling.'):time>=44?(mode==='rapid'?'The enlarged display sphere settles at the bottom of the straight bore; the fixed-size concave cap drops next.':'Dry ice reaches the bottom of the bore and short illustrated contact fractures appear.'):'The illustrated peat front advances continuously during excavator arrival and drilling. Excavation forces and soil stability are not calculated.'
  const coverage=currentPeatCoverage(time)
  const viewCards = [
    { key:'natural', label:'Natural cutaway', detail:'Terrain, roots & staged operations', icon:Layers },
    { key:'temperature', label:'Temperature', detail:'Accepted thermal field', icon:Thermometer },
    { key:'oxygen', label:'Oxygen', detail:'Accepted oxygen concentration', icon:Wind },
    { key:'co2', label:'CO₂', detail:'Accepted carbon dioxide field', icon:Cloud },
  ] as const
  const frameStatus=view==='natural'?'Illustrated sequence':cacheFrame?(mode==='rapid'&&time>=55?'Accepted pre-treatment reference':'Accepted numerical field'):'Numerical field unavailable'
  const frameDetail=view==='natural'?'Spread and wetting paths are authored; local cooling has a separate contact budget.':cacheFrame?`${clock(cacheFrame.timeS)} physical time · ${displayCache!.domain.nx*displayCache!.domain.ny*displayCache!.domain.nz} cells · propagation unresolved`:'Switch to Natural cutaway to inspect the story.'
  return <div className="fire-sequence-shell cinematic-sequence">
    <div ref={hero} className="cinematic-hero-scroll" style={{'--scroll-progress':scrollProgress} as import('react').CSSProperties}>
      <main className="cinematic-hero-sticky" aria-label="Full fire and treatment animation">
        <div className="cinematic-render">
          <FireSequenceScene time={time} mode={mode} view={view} layers={layers} frame={fieldFrame} resetToken={resetToken} realistic straightBore cinematic connectedSupply cameraDistance={cameraDistance}/>
        </div>
        <div className="cinematic-scroll-hint" style={{opacity:1-scrollProgress}}><span>SCROLL TO ENTER THE SIMULATION</span><span>↓</span></div>
        {labels&&<div className="cinematic-scene-meta" style={{opacity:scrollProgress}}><span>{String(stageIndex+1).padStart(2,'0')} / {STAGES.length} <b>{stage.short}</b></span><span>{view==='natural'?'Illustrated sequence':frameStatus}</span></div>}
        {view!=='natural'&&<div className="fire-field-legend"><span>{view==='temperature'?'Temperature · K':view==='oxygen'?'O₂ · mole fraction':'CO₂ · mole fraction'}</span><i/><div><span>{view==='temperature'?'273':0}</span><span>{view==='temperature'?'≥873':view==='oxygen'?'0.209':'0.5'}</span></div></div>}
        <div className="cinematic-transport" style={{transform:`translateY(${(1-scrollProgress)*105}%)`,opacity:scrollProgress}} aria-label="Simulation playback" inert={scrollProgress<.1}>
          <button aria-label={playing?'Pause fire sequence':'Play fire sequence'} onClick={play}>{playing?<Pause size={20} strokeWidth={1.2}/>:<Play size={20} strokeWidth={1.2}/>}</button>
          <button aria-label="Rewind fire sequence" onClick={()=>{setPlaying(false);seek(Math.max(0,time-5))}}><RotateCcw size={19} strokeWidth={1.2}/></button>
          <div className="cinematic-timeline fire-timeline-track"><div><span>{stage.short.toLowerCase()}</span><strong>{time.toFixed(1)} <small>/ {DURATION} s</small></strong></div><input type="range" aria-label="Fire sequence time" min={0} max={DURATION} step={.1} value={time} onChange={event=>{setPlaying(false);seek(Number(event.target.value))}}/></div>
          <label className="cinematic-speed"><select aria-label="Fire sequence speed" value={speed} onChange={event=>setSpeed(Number(event.target.value))}>{[.5,1,1.5,2,3].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
          <button aria-label="Restart fire sequence" onClick={()=>{seek(0);setPlaying(true)}}>↤</button>
          <button aria-label="Open sequence controls" onClick={()=>open('toolbox')}>↗</button>
        </div>
      </main>
    </div>
    <ToolboxPortal>
      <button className="sequence-lab-shortcut" onClick={()=>onWorkspace('coupled')}>Open FEA / FVM physics ↗</button>
      <div className="fire-context-label">VIEW</div><nav className="fire-view-switch" aria-label="Sequence view">{viewCards.map(({key,label,icon:Icon})=><button key={key} aria-label={label} aria-pressed={view===key} onClick={()=>setView(key)}><Icon size={16} strokeWidth={1}/><strong>{label}</strong></button>)}</nav>
      <div className="fire-scene-tools"><button aria-label="Toggle scene labels" aria-pressed={labels} onClick={()=>setLabels(value=>!value)}><Tags size={14}/>Labels</button><button aria-label="Reset camera" onClick={()=>{setCameraDistance(15.75);setResetToken(value=>value+1)}}><Crosshair size={14}/>Reset camera</button></div>
<details><summary>Display layers</summary><div className="fire-layer-controls">{([['fire','Fire / smoke cues'],['gas','CO₂ release tracers'],['water','Hose illustration'],['anatomy','Tree / root context']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={layers[key]} onChange={event=>setLayers(old=>({...old,[key]:event.target.checked}))}/>{label}</label>)}</div></details>
      <label className="cinematic-camera-distance">Camera distance <output>{cameraDistance.toFixed(2)} m</output><input aria-label="Camera distance" type="range" min={5} max={19} step={.05} value={cameraDistance} onChange={event=>setCameraDistance(Number(event.target.value))}/></label>
      <label className="fire-loop"><input type="checkbox" checked={loop} onChange={event=>setLoop(event.target.checked)}/> Loop sequence</label>
      <details open><summary>Experiment variables</summary>
        <FireExperimentControls settings={settings} onSettings={setSettings} cache={displayCache} canRestore={!!bundledCache.current} onResult={value=>{if(validCache(value)){acceptedCacheRef.current=value;setCache(value);setCacheStatus(value.status==='completed'?'New accepted numerical history':'Accepted partial numerical history');setPlaying(false);seek(0);return true}return false}} onRestore={()=>{if(bundledCache.current){acceptedCacheRef.current=bundledCache.current;setCache(bundledCache.current);setCacheStatus('Bundled numerical history restored');setPlaying(false);seek(0)}}}/>
      </details>
    </ToolboxPortal>
        <ToolboxPortal><div className="fire-context-label">SOURCE BEHAVIOR</div>
        <div className="fire-mode-switch" role="group" aria-label="Dry ice release presentation"><button aria-pressed={mode==='gradual'} onClick={()=>setMode('gradual')}><strong>Gradual</strong><span>Finite contact-model mass</span></button><button aria-pressed={mode==='rapid'} onClick={()=>setMode('rapid')}><strong>Rapid release</strong><span>Illustrative source behavior</span></button></div>
        </ToolboxPortal>
    <FinderPortal>
      {(!query||/fire|sequence|peat|dry|water|source|bore|cap|heat|temperature|oxygen|co2|co₂|guide|layer/.test(query.toLowerCase()))&&<>
      <aside className="fire-sequence-rail" aria-label="Sequence context">
        <div className="fire-context-heading"><span>IN THIS CHAPTER</span><span>{String(stageIndex+1).padStart(2,'0')} / 08</span></div>
        <div className="fire-stage-caption"><h2>{stage.id==='treatment'&&mode==='gradual'?'Finite contact cooling':stage.title}</h2><p>{stage.id==='treatment'&&mode==='gradual'?'The source cools nearby peat gradually in the separate finite contact calculation. No rapid gas pulse is staged in this mode.':stage.description}</p></div>
        <div className="fire-coverage"><div><span>Illustrated peat involvement</span><strong>{(coverage*100).toFixed(0)}%</strong></div><progress aria-label="Illustrated peat involvement" max={100} value={coverage*100}/><small>{time<24?'Continuous authored spread · equipment approaches':'The authored front keeps advancing during drilling'}</small></div>
<div className="fire-context-label fire-chapters-heading">SEQUENCE <span>{PRESENTATION_PLAYBACK_DURATION.toFixed(1)} s at 1×</span></div>
        <nav className="fire-stage-list" aria-label="Sequence chapters">{STAGES.map((item,i)=><button key={item.id} aria-current={i===stageIndex?'step':undefined} className={i<stageIndex?'is-past':''} onClick={()=>{setPlaying(false);seek(item.start)}}><span className="fire-stage-number">{String(i+1).padStart(2,'0')}</span><strong>{item.short}</strong><small>{item.start} s</small></button>)}</nav>
        <div className="fire-context-evidence"><strong>{frameStatus}</strong><p>{frameDetail}</p></div>
        <p className="fire-story-scope">The story clock compresses events. Physical timestamps describe the calculation separately.</p>
      </aside>
        <div className="fire-evidence-strip"><div><span>Accepted experiment time</span><strong>{cacheFrame?clock(cacheFrame.timeS):'Not loaded'}</strong></div><div><span>Accepted peak temperature</span><strong>{cacheFrame?.metrics?`${(cacheFrame.metrics.maxTemperatureK-273.15).toFixed(1)} °C`:'—'}</strong></div><div><span>Accepted fuel consumed</span><strong>{cacheFrame?.metrics?`${cacheFrame.metrics.reactedFuelKg.toPrecision(3)} kg`:'—'}</strong></div><div><span>Accepted source inventory</span><strong>{cacheFrame?`${cacheFrame.dryIceKg.toFixed(4)} kg`:'—'}</strong></div><div><span>Field validation</span><strong>Not established</strong></div></div>
        <div className="fire-contact-readout"><strong>CONTACT MODEL</strong><span>Separate assumed hot specimens</span><span>Dry ice {contact.ledger.dryIceRemainingKg.toFixed(3)} kg</span><span>Water supplied {contact.ledger.waterSuppliedKg.toFixed(2)} / 5 kg</span><span>Local heat removed {((contact.ledger.heatToDryIceJ+contact.ledger.heatToWaterJ)/1000).toFixed(1)} kJ</span></div>
        <details className="fire-evidence-details"><summary>Layers &amp; calculation provenance <span>{cacheStatus}</span></summary><p>{stage.evidence}</p><p><strong>Underground propagation:</strong> {displayCache?.propagationResolved?'See the accepted numerical history and its stated resolution limits.':'Not resolved as a verified moving smoldering front in the current calculation. Natural-view spread is a prescribed illustration.'} No matched experiment establishes treatment success.</p><p><strong>Geometry:</strong> The natural view shows a tracked auger making a fixed-width cylindrical bore, the dry-ice sphere settling, then a small concave metal cap dropping without widening or flattening. Rapid mode visually jolts the surrounding peat and grows fine fractures only after the cap lands. The numerical experiment assumes surface-connected peat throughout the domain; its exposed cell values are shown without illustrative anatomy or actions. Excavation, soil failure, cap fit and seal loading are not solved.</p><p><strong>Contact budget:</strong> Local heat loss equals dry-ice sublimation energy plus water sensible and vapor enthalpy. Model seconds follow story seconds after contact at 44 s; this is not the accepted experiment clock. Contact temperatures are illustrative hot specimens, with assumed conductance, no continuing oxidation or heat replenishment. Hose insertion and wetting routes are prescribed. In rapid mode, water starts at the hose and reaches secondary cracks only after it passes their connected junctions; local retained liquid is not a solved pore-saturation field.</p><p><strong>Source modes:</strong> The natural view uses a separate uncalibrated contact model: thirteen fixed hot peat specimens, one finite 4 kg dry-ice inventory and a 5 kg water supply. Its local glow follows that model. The straight-bore sphere is drawn at twice the contact-model diameter for visibility, while its 4 kg ledger is unchanged; accepted experiment fields and inventory remain separate. Rapid mode depicts an instantaneous CO₂ release, local oxygen displacement, soil motion and nearby ember extinction; these are animation, not outputs of the contact or field solvers. The contact ledger exports residual dry ice at 55 s without phase-conversion credit, so its readout cannot quantify the depicted gas. Numerical fields hold the accepted pre-treatment reference after the intervention chapter. Neither source mode expands the bore or cap. Older authored versions remain in Previous simulations.</p>{displayCache?.stopReason&&<p className="fire-cache-warning">Calculation limit: {displayCache.stopReason}</p>}{displayCache?.assumptions?.map((text,i)=><p key={i} className="fire-cache-assumption">{text}</p>)}</details>
      <p className="finder-context-gap">{gap}</p>
      </>}
    </FinderPortal>
  </div>
}
