// Profile the actual workbench solver before considering further optimization.
import { createServer } from 'vite';
import { cpus, platform, arch } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {runMechanicsBenchmark,DEFAULT_BENCHMARK}=await server.ssrLoadModule('/src/mechanics/comparison.ts');
  const records=[];
  for(const resolution of [1,2,4]) for(const law of ['elastic','drucker-prager']) {
    const inputs={...DEFAULT_BENCHMARK,resolution};
    runMechanicsBenchmark(inputs,law);
    const samples=[];
    let last;
    for(let repeat=0;repeat<3;repeat++) {
      last=runMechanicsBenchmark(inputs,law);
      if(last.status!=='complete') throw new Error(last.message);
      samples.push({setupMs:last.setupMs,solveMs:last.solveMs});
    }
    const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[1];
    const final=last.frames.at(-1).result;
    const a=(inputs.tractionPa*(1-inputs.material.frictionSlope/3)-inputs.material.cohesionPa)/inputs.material.hardeningPa;
    const expected=law==='elastic'?0:-a*(1-inputs.material.dilationSlope/3);
    let error=0;for(let q=2;q<final.strain.length;q+=6)error=Math.max(error,Math.abs(final.strain[q]-expected));
    records.push({resolution,law,samples,medianSetupMs:median('setupMs'),medianSolveMs:median('solveMs'),frames:last.frames.length,maxResidualN:Math.max(...last.frames.map(f=>f.result.residualN)),finalVerticalStrain:final.strain[2],maxAnalyticalFinalStrainError:error});
  }
  const hashes={};for(const file of ['src/mechanics/continuum.ts','src/mechanics/comparison.ts'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  const report={createdAt:new Date().toISOString(),host:{cpu:cpus()[0].model,platform:platform(),arch:arch(),node:process.version},inputs:DEFAULT_BENCHMARK,sourceHashes:hashes,notes:'One warmup, three measured runs per case. Solver setup and solve only; excludes worker transfer/rendering. No optimization speedup claimed.',records};
  await writeFile('examples/mechanicsComparisonBenchmark.json',JSON.stringify(report,null,2)+'\n');
  console.log(records.map(r=>({mesh:r.resolution,law:r.law,setup:r.medianSetupMs,solve:r.medianSolveMs,residual:r.maxResidualN,error:r.maxAnalyticalFinalStrainError})));
} finally {await server.close()}
