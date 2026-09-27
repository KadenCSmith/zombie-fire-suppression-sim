import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {DEFAULT_TENSILE,runTensileFracture,tensileScales}=await server.ssrLoadModule('/src/mechanics/tensileFracture.ts');
 const cases=[];
 for(const increments of [100,400,1000]) {
  const inputs={...DEFAULT_TENSILE,increments};
  for(let i=0;i<10;i++)runTensileFracture(inputs);
  const timings=[];
  for(let i=0;i<25;i++){const start=performance.now();runTensileFracture(inputs);timings.push(performance.now()-start)}
  timings.sort((a,b)=>a-b);
  const frames=runTensileFracture(inputs),scale=tensileScales(inputs);
  cases.push({increments,frames:frames.length,medianSolveMs:timings[12],maximumSolveMs:timings.at(-1),peakSampledForceN:Math.max(...frames.map(f=>f.forceN)),exactPeakForceN:inputs.strengthPa*scale.areaM2,maximumAbsEnergyResidualJ:Math.max(...frames.map(f=>Math.abs(f.energyResidualJ))),finalDissipationJ:frames.at(-1).fractureDissipationJ,expectedDissipationJ:inputs.fractureEnergyJm2*scale.areaM2});
 }
 const sourceHash=createHash('sha256').update(await readFile('src/mechanics/tensileFracture.ts')).digest('hex');
 const report={generatedAt:new Date().toISOString(),node:process.version,cpu:os.cpus()[0].model,source:'src/mechanics/tensileFracture.ts',sourceSha256:sourceHash,warmups:10,repetitions:25,scope:'Scalar series-bar/cohesive-interface calculation only; excludes rendering, CSV import and startup. Numerical verification, not experimental validation.',cases};
 await writeFile('examples/tensileFractureBenchmark.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
} finally {await server.close()}
