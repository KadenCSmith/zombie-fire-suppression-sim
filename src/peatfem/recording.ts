import {PeatSolver,totals,DEFAULT_SETTINGS,type Settings,type Frame} from './coupled'
import {CONSTITUENTS,REACTIONS} from './chemistry'
export const RECORDING_REVISION='coupled-q1-v3-linear-floor-1e-18'
const fields=['temperature','oxygen','fuel','char','water','alphaChar','ash','pressure','porosity','darcySpeed','darcyFlux','peclet'] as const
/** Data-only import; retain SI basis and reject unidentified model revisions. */
export function readRecording(text:string):{settings:Settings;history:Frame[]}{
  if(text.length>100_000_000)throw new Error('Recording exceeds the 100 MB import limit')
  const data=JSON.parse(text)
  if(data.format!=='peat-fire-q1-fem'||data.schema!==2||data.solverRevision!==RECORDING_REVISION)throw new Error('Unsupported FEM recording revision; automatic migration is unavailable')
  if(JSON.stringify(data.material)!==JSON.stringify(CONSTITUENTS)||JSON.stringify(data.reactions)!==JSON.stringify(REACTIONS))throw new Error('Recording chemistry/material configuration differs from this solver')
  const settings=data.settings as Settings
  const optional=['initialK','initialPressurePa','toleranceScale','solveTolerance','maxIterations']
  if(!settings||Object.entries(DEFAULT_SETTINGS).some(([key,value])=>typeof settings[key as keyof Settings]!==typeof value)||Object.keys(settings).some(key=>!Object.hasOwn(DEFAULT_SETTINGS,key)&&!optional.includes(key))||optional.some(key=>key in settings&&typeof settings[key as keyof Settings]!=='number'))throw new Error('Unsupported recording settings')
  const solver=new PeatSolver(settings),n=solver.mesh.weights.length
  if(![4,8,16].includes(settings.n))throw new Error('Recording mesh is not an available UI preset')
  if(!Array.isArray(data.history)||!data.history.length||data.history.length>10000)throw new Error('Invalid recording history')
  const array=(value:unknown,size:number,signed=false)=>{
    if(!Array.isArray(value)||value.length!==size||value.some(v=>typeof v!=='number'||!Number.isFinite(v)||(!signed&&v<0)))throw new Error('Invalid recording field/inventory')
    return Float64Array.from(value)
  }
  let previous=-1,previousPeak=-Infinity
  const history:Frame[]=data.history.map((raw:Frame)=>{
    const f={...raw,ledger:{...raw.ledger},peak:{...raw.peak}} as Frame
    fields.forEach(key=>{f[key]=array(raw[key],key==='darcyFlux'?3*n:n,key==='darcyFlux')})
    if(!Array.isArray(raw.gas)||raw.gas.length!==4)throw new Error('Four gas pools are required')
    f.gas=raw.gas.map(g=>array(g,n));f.ledger.gasBoundaryKg=array(raw.ledger.gasBoundaryKg,4,true);f.ledger.reactionExtentsKg=array(raw.ledger.reactionExtentsKg,5)
    for(const key of ['ignitionJ','reactionJ','heatOutJ','gasEnthalpyOutJ','oxygenInKg','oxygenUsedKg','reactedPeatKg','productGasKg','inventoryLimited'] as const)if(typeof f.ledger[key]!=='number'||!Number.isFinite(f.ledger[key]))throw new Error(`Invalid ${key} ledger`)
    for(const key of ['nonlinearError','splittingError','stepS'] as const)if(!Number.isFinite(f[key])||f[key]<0)throw new Error('Invalid nonlinear/step evidence')
    for(const key of ['nonlinearIterations','chemistrySubsteps'] as const)if(!Number.isInteger(f[key])||f[key]<0)throw new Error('Invalid iteration evidence')
    for(const solve of [f.heatSolve,f.oxygenSolve,f.pressureSolve])if(!solve||!Number.isInteger(solve.iterations)||solve.iterations<0||![solve.relativeResidual,solve.absoluteResidual].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Invalid solver evidence')
    if(!Number.isFinite(f.peak.temperatureK)||!Number.isInteger(f.peak.node)||!Number.isFinite(f.peak.timeS)||f.peak.timeS<0||f.peak.temperatureK<Math.max(previousPeak,...f.temperature)||!Number.isInteger(f.rejectedSteps)||f.rejectedSteps<0)throw new Error('Invalid peak/step evidence')
    if(!(f.timeS>previous))throw new Error('Recording times must increase');previous=f.timeS;previousPeak=f.peak.temperatureK
    solver.restore(f)
    const accepted=solver.snapshot()
    for(let i=0;i<n;i++)if(Math.abs(accepted.pressure[i]-f.pressure[i])/accepted.pressure[i]>1e-9||Math.abs(accepted.oxygen[i]-f.oxygen[i])>1e-9)throw new Error('Recording fields disagree with the gas EOS/composition')
    return accepted
  })
  if(history[0].timeS!==0)throw new Error('Recording must include its initial state')
  const initial=totals(solver.mesh,history[0])
  for(const f of history){
    const t=totals(solver.mesh,f),L=f.ledger,mass=t.componentsKg-initial.componentsKg+L.gasBoundaryKg.reduce((a,b)=>a+b,0),U=t.energyJ-initial.energyJ-L.ignitionJ-L.reactionJ+L.heatOutJ+L.gasEnthalpyOutJ
    if(Math.abs(mass)>1e-7*initial.componentsKg||Math.abs(U)>1e-6*Math.max(1,Math.abs(initial.energyJ),Math.abs(L.ignitionJ)+Math.abs(L.reactionJ)))throw new Error('Recording mass/energy ledger does not close')
  }
  return {settings:{...settings},history}
}
