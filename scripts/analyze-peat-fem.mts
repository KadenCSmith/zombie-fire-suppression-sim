/** Separate physics analysis suite: node --experimental-strip-types scripts/analyze-peat-fem.mts profile|convergence */
import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {performance} from 'node:perf_hooks'
import {PeatSolver,DEFAULT_SETTINGS,totals,type Settings} from '../src/peatfem/coupled.ts'
import {sample} from '../src/peatfem/model.ts'
import {localInitial} from '../src/peatfem/chemistry.ts'
const folder=resolve('docs/review/peat-fem'),mode=process.argv[2]??'profile'
await mkdir(folder,{recursive:true})
const codePaths=['model','chemistry','operators','coupled'].map(name=>`src/peatfem/${name}.ts`)
const codeHash=createHash('sha256');for(const path of [...codePaths,'scripts/analyze-peat-fem.mts'])codeHash.update(await readFile(path))
const hash=codeHash.digest('hex')
const matrix=mode==='pilot'?[4].map(n=>({n,dt:.125,end:.5,fixture:'localized-dry-hot'})):mode==='profile'?[4,8,16].map(n=>({n,dt:.125,end:1,fixture:'ambient-ignition'})):
  [...[4,8,16].map(n=>({n,dt:.125,end:6,fixture:'localized-dry-hot'})),...[.5,.25].map(dt=>({n:16,dt,end:6,fixture:'localized-dry-hot'})),{n:8,dt:.125,end:6,fixture:'localized-dry-hot',solveTolerance:1e-12,toleranceScale:.25}]
if(mode==='transport-convergence'){matrix.splice(0,matrix.length,...[4,8,16].map(n=>({n,dt:.005,end:.25,fixture:'localized-dry-hot'})),...[.02,.01].map(dt=>({n:16,dt,end:.25,fixture:'localized-dry-hot'})),{n:8,dt:.005,end:.25,fixture:'localized-dry-hot',solveTolerance:1e-12,toleranceScale:.25})}
const seedPeakK=mode==='transport-convergence'?650:850
const inputHash=createHash('sha256').update(JSON.stringify({matrix,seedPeakK,defaults:DEFAULT_SETTINGS})).digest('hex')
const output=resolve(folder,`${mode}.json`)
if(process.argv.includes('--reuse')){
  const cached=JSON.parse(await readFile(output,'utf8'))
  if(cached.codeHash!==hash||cached.inputHash!==inputHash)throw new Error('Cached results do not match code, inputs and configuration')
  cached.reused=true;await writeFile(output,JSON.stringify(cached,null,2));console.log(JSON.stringify({status:'reused matching result',output,codeHash:hash,inputHash}));process.exit(0)
}
const report:any={mode,codeHash:hash,inputHash,reused:false,host:process.platform,node:process.version,generated:new Date().toISOString(),settings:DEFAULT_SETTINGS,seedPeakK,matrix,cases:[],differences:[],limits:{coarseTemperatureK:5,coarseRemainingMassRelative:.05,contourDepthM:.002},status:'running'}
async function save(){await writeFile(output,JSON.stringify(report,null,2)+'\n')}
function observation(solver:PeatSolver){
  const f=solver.frame,m=solver.mesh,t=totals(m,f),center=[m.lengthM/2,m.lengthM/2] as const
  let deepest500=0,deepestDepletion=0
  for(let j=0;j<=1000;j++){const z=m.lengthM*(1-j/1000),depth=m.lengthM-z;if(sample(m,f.temperature,...center,z)>=500)deepest500=depth;if(sample(m,f.fuel,...center,z)<=.95*solver.settings.dryDensityKgM3)deepestDepletion=depth}
  return {timeS:f.timeS,...t,peakK:f.peak.temperatureK,peakTimeS:f.peak.timeS,oxygenProbe:sample(m,f.oxygen,...center,m.lengthM*.8),pressureProbePa:sample(m,f.pressure,...center,m.lengthM*.8),probeK:[.9,.8,.5].map(fraction=>sample(m,f.temperature,...center,m.lengthM*fraction)),contour500KDepthM:deepest500,peatDepletion5pctDepthM:deepestDepletion,
    massResidualKg:t.componentsKg-solverBase.get(solver)!.componentsKg+f.ledger.gasBoundaryKg.reduce((a,b)=>a+b,0),energyResidualJ:t.energyJ-solverBase.get(solver)!.energyJ-f.ledger.ignitionJ-f.ledger.reactionJ+f.ledger.heatOutJ+f.ledger.gasEnthalpyOutJ,linearResidual:Math.max(f.heatSolve.relativeResidual,f.oxygenSolve.relativeResidual,f.pressureSolve.relativeResidual),splitError:f.splittingError,rejected:f.rejectedSteps,gasEnthalpyOutJ:f.ledger.gasEnthalpyOutJ,maxPeclet:Math.max(...f.peclet)}
}
const solverBase=new WeakMap<PeatSolver,ReturnType<typeof totals>>()
for(const row of matrix){
  const settings:Settings={...DEFAULT_SETTINGS,n:row.n,maxStepS:row.dt,endS:row.end,...('solveTolerance' in row?{solveTolerance:row.solveTolerance,toleranceScale:row.toleranceScale}:{})}
  if(row.fixture==='localized-dry-hot')settings.ignitionW=0
  const start=performance.now(),solver=new PeatSolver(settings)
  if(row.fixture==='localized-dry-hot'){
    const f=solver.snapshot(),m=solver.mesh
    f.temperature.forEach((_,i)=>{
      const [x,y,z]=m.coordinates.subarray(3*i,3*i+3),radius2=((x-.05)**2+(y-.05)**2+(z-.05)**2)/.035**2,T=300+(seedPeakK-300)*Math.max(0,1-radius2)**2
      // Prepared dry-hot seed with wet surroundings, each node initially at
      // ambient EOS pressure. Removed seed water is part of the initial condition,
      // not a simulated evaporation event or unrecorded source term.
      const local=localInitial(settings.dryDensityKgM3,settings.moistureRatio*Math.max(0,Math.min(1,(373-T)/73)),T,settings.ambientPressurePa,settings.oxygenMassFraction)
      f.temperature[i]=T;f.water[i]=local.solid[0];f.gas.forEach((g,j)=>{g[i]=local.gas[j]})
    })
    const maximumK=Math.max(...f.temperature);f.peak={temperatureK:maximumK,node:f.temperature.indexOf(maximumK),timeS:0}
    solver.restore(f)
  }
  solverBase.set(solver,totals(solver.mesh,solver.frame))
  const result:any={...row,settings,status:'running',samples:[observation(solver)],acceptedSteps:0,minimumStepS:Infinity,maximumStepS:0,wallS:0};report.cases.push(result);await save()
  try{
    for(let target=row.end/4;target<=row.end+1e-9;target+=row.end/4){while(solver.frame.timeS<target-1e-9){const f=solver.advance(target-solver.frame.timeS);result.acceptedSteps++;if(result.acceptedSteps%10===0){result.wallS=(performance.now()-start)/1000;result.lastAccepted=observation(solver);await save();console.log(JSON.stringify({progress:true,n:row.n,timeS:solver.frame.timeS,acceptedSteps:result.acceptedSteps,wallS:result.wallS}))}if(performance.now()-start>(mode==='pilot'?120000:600000)){result.lastAccepted=observation(solver);throw new Error('Analysis exceeded predeclared wall budget for one case (pilot 120 s; other modes 600 s); accepted state retained')}result.minimumStepS=Math.min(result.minimumStepS,f.stepS);result.maximumStepS=Math.max(result.maximumStepS,f.stepS)}result.samples.push(observation(solver))}
    result.status='passed execution'
  }catch(e){result.status='failed';result.error=String(e);result.lastAccepted=observation(solver)}
  result.wallS=(performance.now()-start)/1000;result.physicalThroughput=solver.frame.timeS/result.wallS;await save()
  console.log(JSON.stringify({n:row.n,maxStepS:row.dt,status:result.status,physicalTimeS:solver.frame.timeS,wallS:result.wallS,throughput:result.physicalThroughput,error:result.error,last:result.samples.at(-1)}))
}
if(mode==='convergence'||mode==='transport-convergence'){
  const reference=report.cases[2]
  for(const result of report.cases.filter((c:any)=>c.status==='passed execution'&&reference.status==='passed execution')){
    const paired=result.samples.map((s:any,i:number)=>({timeS:s.timeS,currentMaximumDifferenceK:Math.abs(s.maximumK-reference.samples[i].maximumK),energyDifferenceJ:Math.abs(s.energyJ-reference.samples[i].energyJ),componentsMassDifferenceKg:Math.abs(s.componentsKg-reference.samples[i].componentsKg),oxygenMassDifferenceKg:Math.abs(s.oxygenKg-reference.samples[i].oxygenKg),waterMassDifferenceKg:Math.abs(s.waterKg-reference.samples[i].waterKg),charMassDifferenceKg:Math.abs(s.charKg-reference.samples[i].charKg),ashMassDifferenceKg:Math.abs(s.ashKg-reference.samples[i].ashKg),peakTimeDifferenceS:Math.abs(s.peakTimeS-reference.samples[i].peakTimeS),probeMaxDifferenceK:Math.max(...s.probeK.map((v:number,j:number)=>Math.abs(v-reference.samples[i].probeK[j]))),peakDifferenceK:Math.abs(s.peakK-reference.samples[i].peakK),oxygenDifference:Math.abs(s.oxygenProbe-reference.samples[i].oxygenProbe),massRelativeDifference:Math.abs(s.peatKg-reference.samples[i].peatKg)/reference.samples[i].peatKg,contourDepthDifferenceM:Math.abs(s.contour500KDepthM-reference.samples[i].contour500KDepthM),depletionDepthDifferenceM:Math.abs(s.peatDepletion5pctDepthM-reference.samples[i].peatDepletion5pctDepthM)}))
    report.differences.push({n:result.n,maxStepS:result.dt,rows:paired,maxProbeDifferenceK:Math.max(...paired.map((p:any)=>p.probeMaxDifferenceK)),maxMassRelativeDifference:Math.max(...paired.map((p:any)=>p.massRelativeDifference)),maxContourDepthDifferenceM:Math.max(...paired.map((p:any)=>p.contourDepthDifferenceM))})
  }
  const coarse=report.differences[0];report.coarseAccuracyGate=coarse?{passed:coarse.maxProbeDifferenceK<=report.limits.coarseTemperatureK&&coarse.maxMassRelativeDifference<=report.limits.coarseRemainingMassRelative&&coarse.maxContourDepthDifferenceM<=report.limits.contourDepthM,...report.limits,status:'comparison to 16³ only; grid independence and error order not established'}:{passed:false,status:'unresolved: reference execution failed'}
  const ordinary=report.cases[1],strict=report.cases.at(-1);report.strictToleranceControl=ordinary.status==='passed execution'&&strict.status==='passed execution'?{maximumProbeDifferenceK:Math.max(...ordinary.samples.flatMap((o:any,i:number)=>o.probeK.map((T:number,j:number)=>Math.abs(T-strict.samples[i].probeK[j])))),sameMesh:ordinary.n,limits:'stricter linear and splitting tolerances, same maximum step; time-error control is not an independent analytical solution'}:{status:'unresolved'}
  report.actualTimeSteps=report.cases.map((c:any)=>({n:c.n,nominalMaximum:c.dt,minimumAccepted:c.minimumStepS,maximumAccepted:c.maximumStepS,accepted:c.acceptedSteps}));
  report.interpretation='A finite short prepared localized dry-hot seed in wet surroundings, initialized at ambient pressure, 3D fixture. The 650 K / 0.25 s transport study is separate from the 850 K / 6 s hot study, not a validated smouldering-front study. 500 K is a temperature contour; 5% peat depletion also includes pyrolysis. No measured spread-rate equivalence or asymptotic order is assumed. The 16³ result is a comparison reference, not established grid independence.'
}
report.status=report.cases.some((c:any)=>c.status==='failed')?'failed cases retained':'completed';await save()
if(report.status==='failed cases retained')process.exitCode=1
