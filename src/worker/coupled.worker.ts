import {CoupledEngine} from '../coupled/engine'
import type {CoupledInputs} from '../coupled/model'
self.onmessage=async(event:MessageEvent<{inputs:CoupledInputs;compare:boolean}>)=>{
  const {inputs,compare}=event.data
  try{
    for(const mode of(compare?['coupled','rigid']:['coupled'])){
      const begin=performance.now(),engine=new CoupledEngine({...inputs,mechanics:mode==='rigid'?false:inputs.mechanics}),frames=[engine.frame()],setupMs=performance.now()-begin,start=performance.now()
      let capture=inputs.durationS/60
      while(engine.transport.time<inputs.durationS-1e-9){
        engine.step(inputs.durationS-engine.transport.time)
        if(engine.transport.time<capture-1e-9&&engine.transport.time<inputs.durationS-1e-9)continue
        frames.push(engine.frame());capture=(Math.floor(engine.transport.time/(inputs.durationS/60))+1)*inputs.durationS/60
        self.postMessage({type:'progress',mode,timeS:engine.transport.time,elapsedMs:performance.now()-start,frame:frames.at(-1)})
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      self.postMessage({type:'result',mode,frames,setupMs,solveMs:performance.now()-start,couplingIterations:engine.couplingIterations,mechanicalBalanceJ:engine.mechanicalBalanceJ,referenceBoundaryWorkJ:engine.referenceBoundaryWorkJ,geostaticResidualN:engine.mechanics?.geostaticResidualN??0})
    }
    self.postMessage({type:'done'})
  }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)})}
}
