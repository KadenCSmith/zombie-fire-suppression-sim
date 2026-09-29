/** Reproducible short accepted solver history for checking the Blender pipeline.
 * Run from repo root. This is an uncalibrated numerical example, not an experiment.
 */
import {createServer} from 'vite'
import {writeFile,mkdir,readFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const output=resolve(process.argv[2]??'integrations/blender-study/accepted-example.json')
const sourceFiles=['engine','model','source','thermodynamics','mechanics','linear','sparse','remap','cap'].map(name=>`src/coupled/${name}.ts`)
const sourceSha256=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))
const gitHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gitDirty=Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true},appType:'custom'})
try{
 const {CoupledEngine}=await server.ssrLoadModule('/src/coupled/engine.ts')
 const {DEFAULT_COUPLED}=await server.ssrLoadModule('/src/coupled/model.ts')
 const inputs={...DEFAULT_COUPLED,fidelity:'precision2560',reaction:false,initialization:'conservative',mechanicalBackend:'optimized',durationS:2}
 const start=performance.now(),engine=new CoupledEngine(inputs),setupMs=performance.now()-start,frames=[engine.frame()],solveStart=performance.now()
 for(const target of [.5,1,1.5,2]){while(engine.transport.time<target-1e-9)engine.step(target-engine.transport.time);frames.push(engine.frame())}
 const scenario=engine.transport.scenario
 const data={format:'zombie-coupled',version:2,inputs,grid:scenario.domain,source:{centerXM:scenario.source.centerXM,centerYM:scenario.source.centerYM,centerDepthM:scenario.source.centerDepthM,densityKgM3:scenario.source.densityKgM3},
  provenance:{kind:'numerical-pipeline-example',generatedAt:new Date().toISOString(),gitHead,gitDirty,sourceSha256,scope:'Short uncalibrated 2560-cell solver run. Oxidation disabled; conservative material/inventory initialization; optimized verified equivalent mechanics backend.'},
  runs:{coupled:{status:'complete',mode:'coupled',frames,setupMs,solveMs:performance.now()-solveStart,couplingIterations:engine.couplingIterations,mechanicalBalanceJ:engine.mechanicalBalanceJ,referenceBoundaryWorkJ:engine.referenceBoundaryWorkJ,geostaticResidualN:engine.mechanics?.geostaticResidualN??0}}}
 await mkdir(dirname(output),{recursive:true})
 await writeFile(output,JSON.stringify(data,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v)+'\n')
 console.log(JSON.stringify({output,cells:engine.transport.n,frames:frames.length,seconds:frames.at(-1).timeS,solveMs:data.runs.coupled.solveMs}))
}finally{await server.close()}
