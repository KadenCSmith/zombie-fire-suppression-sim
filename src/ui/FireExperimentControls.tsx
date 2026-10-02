import { useEffect, useRef, useState } from 'react'
import { version as applicationVersion } from '../../package.json'
import type { FireProtocolCache as ProtocolCache, FireProtocolWorkerRequest, FireProtocolWorkerMessage } from '../coupled/fireProtocolRunner'

export interface FireExperimentSettings { durationHours:number;moistureDryBasis:number;ignitionMinutes:number;ignitionPowerW:number }
export const DEFAULT_FIRE_SETTINGS:FireExperimentSettings={durationHours:24,moistureDryBasis:.1,ignitionMinutes:120,ignitionPowerW:2500}
interface Progress { phase:string;timeS:number;targetTimeS:number;elapsedS:number }
const formatTime=(seconds:number)=>seconds>=3600?`${(seconds/3600).toFixed(2)} h`:`${(seconds/60).toFixed(1)} min`
export function FireExperimentControls({settings,onSettings,onResult,onRestore,canRestore,cache}:{settings:FireExperimentSettings;onSettings:(value:FireExperimentSettings)=>void;onResult:(cache:ProtocolCache)=>boolean;onRestore:()=>void;canRestore:boolean;cache?:ProtocolCache}){
  const worker=useRef<Worker|null>(null),[running,setRunning]=useState(false),[progress,setProgress]=useState<Progress>(),[notice,setNotice]=useState('The displayed result remains available while a new experiment runs.')
  useEffect(()=>()=>worker.current?.terminate(),[])
  const invalid=!Object.values(settings).every(Number.isFinite)||settings.durationHours<1||settings.durationHours>24||settings.moistureDryBasis<.05||settings.moistureDryBasis>.5||settings.ignitionMinutes<15||settings.ignitionMinutes>120||settings.ignitionPowerW<500||settings.ignitionPowerW>2500||settings.ignitionMinutes>settings.durationHours*60
  const calculate=()=>{
    if(invalid||worker.current)return
    setRunning(true);setProgress(undefined);setNotice('Preparing the conservative cold initial state…')
    let current:Worker
    try{current=new Worker(new URL('../worker/fireProtocol.worker.ts',import.meta.url),{type:'module'})}catch(error){setNotice(`Calculation could not start: ${error instanceof Error?error.message:String(error)}. Previous result retained.`);setRunning(false);return}
    worker.current=current
    const finish=()=>{current.terminate();if(worker.current===current)worker.current=null;setRunning(false)}
    current.onmessage=(event:MessageEvent<FireProtocolWorkerMessage>)=>{
      if(worker.current!==current)return
      const message=event.data
      if(message.type==='progress'){setProgress(message);setNotice('Calculating accepted heat, reaction and gas states…')}
      else if(message.type==='result'){const accepted=onResult(message.cache);setNotice(!accepted?'The result format could not be displayed. Previous accepted history retained.':message.cache.status==='completed'?'Calculation complete. The accepted history is now displayed.':`Accepted partial history displayed: ${message.cache.stopReason??message.cache.status}.`);finish()}
      else if(message.type==='error'){setNotice(`Calculation could not start: ${message.message}. Previous result retained.`);finish()}
    }
    current.onerror=event=>{if(worker.current!==current)return;setNotice(`Calculation stopped: ${event.message||'worker unavailable'}. Previous result retained.`);finish()}
    current.postMessage({type:'run',applicationVersion,options:{durationS:settings.durationHours*3600,moistureDryBasis:settings.moistureDryBasis,ignitionDurationS:settings.ignitionMinutes*60,ignitionPowerW:settings.ignitionPowerW}} satisfies FireProtocolWorkerRequest)
  }
  const cancel=()=>{worker.current?.terminate();worker.current=null;setRunning(false);setNotice('Calculation cancelled. The previous accepted history is retained.')}
  const exportHistory=()=>{
    if(!cache)return
    const blob=new Blob([JSON.stringify(cache)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a')
    link.href=url;link.download=`peat-fire-history-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000)
  }
  return <details className="fire-experiment" open><summary>Fire experiment <span>Recalculate an assumed peat specimen</span></summary><p>These settings change the numerical history. The staged drilling, dome and water sequence stays illustrative. A 24-hour calculation can take several minutes.</p><div className="fire-experiment-inputs"><label>Duration <span>hours</span><input type="number" aria-label="Fire experiment duration hours" value={settings.durationHours} min={1} max={24} step={1} disabled={running} onChange={event=>onSettings({...settings,durationHours:Number(event.target.value)})}/></label><label>Water / dry peat <span>kg / kg</span><input type="number" aria-label="Fire experiment moisture dry basis" value={settings.moistureDryBasis} min={.05} max={.5} step={.01} disabled={running} onChange={event=>onSettings({...settings,moistureDryBasis:Number(event.target.value)})}/></label><label>Ignition duration <span>minutes</span><input type="number" aria-label="Fire experiment ignition minutes" value={settings.ignitionMinutes} min={15} max={120} step={5} disabled={running} onChange={event=>onSettings({...settings,ignitionMinutes:Number(event.target.value)})}/></label><label>Ignition heater <span>watts</span><input type="number" aria-label="Fire experiment ignition power watts" value={settings.ignitionPowerW} min={500} max={2500} step={100} disabled={running} onChange={event=>onSettings({...settings,ignitionPowerW:Number(event.target.value)})}/></label></div>{invalid&&<p className="fire-cache-warning">Use the shown ranges and keep ignition duration within the experiment duration.</p>}<div className="fire-experiment-actions"><button disabled={running||invalid} onClick={calculate}>Calculate fire experiment</button>{running&&<button onClick={cancel}>Cancel calculation</button>}<button disabled={running||!canRestore} onClick={()=>{onRestore();setNotice('Bundled accepted history restored.')}}>Restore bundled result</button><button disabled={!cache} onClick={exportHistory}>Export displayed history</button></div><p role="status">{notice}{running&&progress&&` ${formatTime(progress.timeS)} accepted / ${formatTime(progress.targetTimeS)} target · ${Math.round(progress.elapsedS)} s computing.`}</p>{running&&<progress aria-label="Fire experiment calculation progress" value={progress?.timeS??0} max={progress?.targetTimeS??settings.durationHours*3600}/>}<p className="fire-experiment-displayed"><strong>Displayed history:</strong> {cache?`${cache.status} · ${formatTime(cache.frames.at(-1)!.timeS)} accepted · ${cache.domain.nx*cache.domain.ny*cache.domain.nz} cells`:'Awaiting the bundled calculation.'} Parameter edits apply only after a new calculation is accepted.</p></details>
}
