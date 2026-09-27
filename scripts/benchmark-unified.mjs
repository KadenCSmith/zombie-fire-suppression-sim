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
 for(const fidelity of fidelities)for(let repeat=0;repeat<Number(process.env.REPEATS??1);repeat++){
  const inputs={...LAB_DEFAULT_COUPLED,reaction:false,fidelity,durationS,mechanicalBackend:process.env.BACKEND??'reference'};
  const start=performance.now(),engine=new CoupledEngine(inputs),setupMs=performance.now()-start,solveStart=performance.now();
  engine.advance(inputs.durationS);
  const f=engine.frame(),record={fidelity,backend:inputs.mechanicalBackend,repeat,inputs,cells:engine.transport.n,setupMs,solveMs:performance.now()-solveStart,simulatedS:f.timeS,steps:f.ledger.steps,rejectedSteps:f.ledger.rejectedSteps,massResidualKg:f.ledger.massResidualKg,energyResidualJ:f.ledger.energyResidualJ,forceResidualN:f.mechanical.residualN,maxPressurePa:Math.max(...f.pressurePa),dryIceKg:f.dryIceKg,memory:process.memoryUsage()};
  records.push(record);console.log(JSON.stringify(record));
 }
 const report=process.env.REPORT??'work/verification/reference-benchmark.json';
 await mkdir(dirname(report),{recursive:true});
 await writeFile(report,JSON.stringify({date:new Date().toISOString(),host:{cpu:cpus()[0].model,memory:totalmem(),node:process.version},scope:'Serial worker-equivalent CPU solve; excludes browser/render/GPU/shared memory. Cold source-only case.',sourceHashes,records},null,2)+'\n');
}finally{await server.close()}
