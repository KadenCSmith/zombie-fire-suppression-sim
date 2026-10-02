import { PeatSolver, type Settings, type Frame } from '../peatfem/coupled'
let solver:PeatSolver|undefined,runId=0,running=false,timer:ReturnType<typeof setTimeout>|undefined
let start=0,origin=0,pace=10,lastPost=0,solveMs=0,physicalSolvedS=0
const post=(type:string)=>{if(solver)self.postMessage({type,runId,frame:solver.snapshot(),running,error:solver.error,solveMs,physicalSolvedS})}
function advance(){if(!solver)return;const began=performance.now(),before=solver.frame.timeS;try{solver.advance()}finally{solveMs+=performance.now()-began;physicalSolvedS+=solver.frame.timeS-before}}
function stop(){running=false;if(timer)clearTimeout(timer)}
function tick(){
  if(!running||!solver)return
  try{
    const desired=Math.min(solver.settings.endS,origin+(performance.now()-start)*pace/1000),batchStart=performance.now()
    let steps=0
    while(solver.frame.timeS+1e-8<desired&&steps<4&&performance.now()-batchStart<8){
      // Pace schedules deterministic accepted steps; it never changes their dt.
      if(desired-solver.frame.timeS<solver.nextStepS&&desired<solver.settings.endS)break
      advance();steps++
    }
    if(solver.frame.timeS>=solver.settings.endS-1e-8){stop();post('complete');return}
    if(performance.now()-lastPost>=150){post('snapshot');lastPost=performance.now()}
    timer=setTimeout(tick,20)
  }catch(error){stop();self.postMessage({type:'failed',runId,frame:solver.snapshot(),running:false,error:String(error)})}
}
self.onmessage=(event:MessageEvent<{type:string;runId:number;settings?:Settings;frame?:Frame;pace?:number}>)=>{
  const data=event.data
  if(data.type==='init'){
    stop();runId=data.runId;solveMs=0;physicalSolvedS=0
    try{solver=new PeatSolver(data.settings!);if(data.frame)solver.restore(data.frame);post('ready')}
    catch(error){self.postMessage({type:'failed',runId,error:String(error),running:false})}return
  }
  if(data.runId!==runId||!solver)return
  if(data.type==='pause'){stop();post('paused')}
  if(data.type==='run'){
    stop();pace=data.pace??10;if(!Number.isFinite(pace)||pace<=0)return
    origin=solver.frame.timeS;start=performance.now();lastPost=0;running=true;tick()
  }
  if(data.type==='step'){
    stop();try{advance();post('paused')}catch(error){self.postMessage({type:'failed',runId,frame:solver.snapshot(),running:false,error:String(error)})}
  }
}
