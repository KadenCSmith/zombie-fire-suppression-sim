import {CoupledEngine} from '../coupled/engine'
import type {CoupledInputs} from '../coupled/model'
self.onmessage=async(event:MessageEvent<{inputs:CoupledInputs;compare:boolean}>)=>{
  const {inputs,compare}=event.data
  let active:CoupledEngine|undefined,activeFrames:ReturnType<CoupledEngine['frame']>[]=[],activeMode='coupled',activeStart=performance.now(),activeSetup=0
  try{
    for(const mode of(compare?['coupled','rigid']:['coupled'])){
      const begin=performance.now(),engine=new CoupledEngine({...inputs,mechanics:mode==='rigid'?false:inputs.mechanics}),frames=[engine.frame()],setupMs=performance.now()-begin,start=performance.now()
      active=engine;activeFrames=frames;activeMode=mode;activeStart=start;activeSetup=setupMs
      let capture=inputs.durationS/60
      while(engine.transport.time<inputs.durationS-1e-9){
        engine.step(inputs.durationS-engine.transport.time)
        if(engine.transport.time<capture-1e-9&&engine.transport.time<inputs.durationS-1e-9)continue
        frames.push(engine.frame());capture=(Math.floor(engine.transport.time/(inputs.durationS/60))+1)*inputs.durationS/60
        self.postMessage({type:'progress',mode,timeS:engine.transport.time,elapsedMs:performance.now()-start,frame:frames.at(-1)})
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      self.postMessage({type:'result',status:'complete',mode,frames,setupMs,solveMs:performance.now()-start,couplingIterations:engine.couplingIterations,mechanicalBalanceJ:engine.mechanicalBalanceJ,referenceBoundaryWorkJ:engine.referenceBoundaryWorkJ,geostaticResidualN:engine.mechanics?.geostaticResidualN??0})
    }
    self.postMessage({type:'done'})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    if(active){const frame=active.frame();if(frame.timeS>(activeFrames.at(-1)?.timeS??-1))activeFrames.push(frame);self.postMessage({type:'result',status:'limited',message,mode:activeMode,frames:activeFrames,setupMs:activeSetup,solveMs:performance.now()-activeStart,couplingIterations:active.couplingIterations,mechanicalBalanceJ:active.mechanicalBalanceJ,referenceBoundaryWorkJ:active.referenceBoundaryWorkJ,geostaticResidualN:active.mechanics?.geostaticResidualN??0})}
    self.postMessage({type:'error',message})
  }
}
