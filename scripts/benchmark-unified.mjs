import {createServer} from 'vite';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {cpus,totalmem} from 'node:os';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {CoupledEngine}=await server.ssrLoadModule('/src/coupled/engine.ts');
 const {LAB_DEFAULT_COUPLED}=await server.ssrLoadModule('/src/coupled/model.ts');
 const sourceHashes={};
 for(const name of ['model','engine','mechanics','sparse','source','thermodynamics','linear','remap','cap']){
  sourceHashes[name]=createHash('sha256').update(await readFile(`src/coupled/${name}.ts`)).digest('hex');
 }
 const records=[];
 const fidelities=(process.env.FIDELITIES??'preview,precision2560').split(',');
 const durationS=Number(process.env.SIM_SECONDS??2);
 if(!Number.isFinite(durationS)||durationS<=0)throw new Error('SIM_SECONDS must be finite and positive.');
 const backend=process.env.BACKEND??'reference';
 if(!['reference','optimized'].includes(backend))throw new Error('BACKEND must be reference or optimized.');
 const benchmarkCase=process.env.BENCH_CASE??'cold-source';
 if(!['cold-source','prepared-dry-smoldering'].includes(benchmarkCase))throw new Error('Unsupported BENCH_CASE.');
 const acceptance={massResidualKg:1e-7,energyResidualJ:1e-4,forceResidualN:1e-4};
 for(const fidelity of fidelities)for(let repeat=0;repeat<Number(process.env.REPEATS??1);repeat++){
  // Explicit override stays last, regardless of the release's lab default.
  const inputs={...LAB_DEFAULT_COUPLED,reaction:benchmarkCase==='prepared-dry-smoldering',fidelity,durationS,mechanicalBackend:backend};
  const start=performance.now(),engine=new CoupledEngine(inputs),setupMs=performance.now()-start,solveStart=performance.now();
  engine.advance(inputs.durationS);
  const f=engine.frame();
  if(!f.mechanical)throw new Error('The benchmark did not produce an accepted mechanical state.');
  const record={fidelity,backend:inputs.mechanicalBackend,benchmarkCase,repeat,inputs,cells:engine.transport.n,maxStepS:engine.transport.scenario.model.maxStepS,setupMs,solveMs:performance.now()-solveStart,simulatedS:f.timeS,steps:f.ledger.steps,rejectedSteps:f.ledger.rejectedSteps,massResidualKg:f.ledger.massResidualKg,energyResidualJ:f.ledger.energyResidualJ,forceResidualN:f.mechanical.residualN,maxPressurePa:Math.max(...f.pressurePa),maxTemperatureK:Math.max(...f.temperatureK),dryIceKg:f.dryIceKg,reactionEnergyJ:f.ledger.reactionJ,preparedWaterRemovedKg:f.initialization?.preparedWaterRemovedKg??null,mechanicalWorkBalanceJ:engine.mechanicalBalanceJ,memory:process.memoryUsage()};
  record.gates=Object.fromEntries(Object.entries(acceptance).map(([key,limit])=>[key,Number.isFinite(record[key])&&Math.abs(record[key])<=limit]));
  records.push(record);console.log(JSON.stringify(record));
 }
 const report=process.env.REPORT??'work/verification/reference-benchmark.json';
 await mkdir(dirname(report),{recursive:true});
 await writeFile(report,JSON.stringify({date:new Date().toISOString(),host:{cpu:cpus()[0].model,memory:totalmem(),node:process.version},scope:'Serial worker-equivalent CPU solve including final snapshot; excludes browser/render/GPU/shared memory.',benchmarkCase,sourceHashes,acceptance,records},null,2)+'\n');
 if(records.some(record=>Object.values(record.gates).some(passed=>!passed)))throw new Error('Benchmark acceptance gate failed; report retained.');
}finally{await server.close()}
