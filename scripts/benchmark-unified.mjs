import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
import {cpus,totalmem} from 'node:os';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'});
try{
 const {CoupledEngine}=await server.ssrLoadModule('/src/coupled/engine.ts');
 const {DEFAULT_COUPLED}=await server.ssrLoadModule('/src/coupled/model.ts');
 const records=[];
 const fidelities=(process.env.FIDELITIES??'preview,precision2560').split(',');
 for(const fidelity of fidelities)for(let repeat=0;repeat<Number(process.env.REPEATS??1);repeat++){
  const inputs={...DEFAULT_COUPLED,fidelity,durationS:Number(process.env.SECONDS??2),mechanicalBackend:process.env.BACKEND??'reference'};
  const start=performance.now(),engine=new CoupledEngine(inputs),setupMs=performance.now()-start,solveStart=performance.now();
  engine.advance(inputs.durationS);
  const f=engine.frame(),record={fidelity,backend:inputs.mechanicalBackend,repeat,cells:engine.transport.n,setupMs,solveMs:performance.now()-solveStart,simulatedS:f.timeS,steps:f.ledger.steps,rejectedSteps:f.ledger.rejectedSteps,massResidualKg:f.ledger.massResidualKg,energyResidualJ:f.ledger.energyResidualJ,forceResidualN:f.mechanical.residualN,maxPressurePa:Math.max(...f.pressurePa),dryIceKg:f.dryIceKg,memory:process.memoryUsage()};
  records.push(record);console.log(JSON.stringify(record));
 }
 await writeFile(process.env.REPORT??'work/verification/reference-benchmark.json',JSON.stringify({date:new Date().toISOString(),host:{cpu:cpus()[0].model,memory:totalmem(),node:process.version},records},null,2)+'\n');
}finally{await server.close()}
