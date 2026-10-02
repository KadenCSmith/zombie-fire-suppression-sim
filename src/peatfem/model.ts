/** Reduced dry Irish-peat oxidation fixture; see docs/PEAT_FIRE_FEM_MODEL.md. */
export const MATERIAL = Object.freeze({ rho: 123, cp: 1840, phi: 1 - 123 / 1500,
  conductivity: 123 / 1500, diffusivity: 2e-5, gasReferenceDensity: 1.2,
  log10A: 16.8, activationJMol: 195000, fuelOrder: 2.33, oxygenOrder: .24,
  oxygenPerFuel: .89, charYield: .61, heatJPerKg: 11.6e6 })
export const SOURCE = { title: 'Huang & Rein (2017), Irish moss peat',
  url: 'https://doi.org/10.1071/WF16198', locator: 'Eqns 4c, 5a–5c; Table 1 po column; Table 2 peat row',
  status: 'Transferred peat-oxidation subset; fixed-property/diffusion adaptation; unvalidated' }
export interface Settings { n: number; lengthM: number; ambientK: number; oxygenKgM3: number;
  ignitionW: number; ignitionS: number; ignitionWidthM: number; heatTransfer: number;
  massTransferMS: number; maxStepS: number; endS: number; chemistry: boolean;
  initialK?: number; initialOxygenKgM3?: number; toleranceScale?: number; maxIterations?: number }
export const DEFAULT_SETTINGS: Settings = { n: 4, lengthM: .1, ambientK: 300,
  oxygenKgM3: .233 * MATERIAL.gasReferenceDensity, ignitionW: 8, ignitionS: 180,
  ignitionWidthM: .025, heatTransfer: 10, massTransferMS: .002, maxStepS: 2,
  endS: 600, chemistry: true }
export interface Sparse { offsets: Int32Array; columns: Int32Array; values: Float64Array }
export interface Mesh { n: number; lengthM: number; h: number; coordinates: Float64Array;
  connectivity: Int32Array; weights: Float64Array; topArea: Float64Array;
  ignitionShape: Float64Array; stiffness: Sparse; elementMass: Float64Array;
  elementStiffness: Float64Array }
const SIGNS = Array.from({ length: 8 }, (_, a) => [a & 1 ? 1 : -1, a & 2 ? 1 : -1, a & 4 ? 1 : -1])
export function basis(x: number, y: number, z: number) {
  const shape = new Float64Array(8), gradients = new Float64Array(24)
  SIGNS.forEach(([s, t, u], a) => { shape[a] = (1 + s*x)*(1+t*y)*(1+u*z)/8;
    gradients[3*a] = s*(1+t*y)*(1+u*z)/8; gradients[3*a+1] = t*(1+s*x)*(1+u*z)/8;
    gradients[3*a+2] = u*(1+s*x)*(1+t*y)/8 })
  return { shape, gradients }
}
export function elementOperators(h: number) {
  const mass = new Float64Array(64), stiffness = new Float64Array(64), q = 1/Math.sqrt(3)
  for (const x of [-q,q]) for (const y of [-q,q]) for (const z of [-q,q]) {
    const { shape, gradients } = basis(x,y,z), jacobian = h**3/8
    for (let a=0;a<8;a++) for (let b=0;b<8;b++) {
      mass[8*a+b] += shape[a]*shape[b]*jacobian
      for (let d=0;d<3;d++) stiffness[8*a+b] += gradients[3*a+d]*gradients[3*b+d]*4/h**2*jacobian
    }
  }
  return { mass, stiffness }
}
export function createMesh(n: number, lengthM: number, ignitionWidthM=.025): Mesh {
  if (!Number.isInteger(n)||n<1||n>32||!(lengthM>0)||!(ignitionWidthM>0)) throw new Error('Invalid cubic FE mesh')
  const h=lengthM/n, count=(n+1)**3, coordinates=new Float64Array(count*3), connectivity=new Int32Array(n**3*8)
  const weights=new Float64Array(count), topArea=new Float64Array(count), ignitionShape=new Float64Array(count)
  const rows=Array.from({length:count},()=>new Map<number,number>()), operators=elementOperators(h)
  const node=(i:number,j:number,k:number)=>i+(n+1)*(j+(n+1)*k), q=1/Math.sqrt(3)
  for(let k=0;k<=n;k++)for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)coordinates.set([i*h,j*h,k*h],3*node(i,j,k))
  let e=0
  for(let k=0;k<n;k++)for(let j=0;j<n;j++)for(let i=0;i<n;i++,e++) {
    const nodes=SIGNS.map(([s,t,u])=>node(i+(s+1)/2,j+(t+1)/2,k+(u+1)/2));connectivity.set(nodes,8*e)
    for(let a=0;a<8;a++)for(let b=0;b<8;b++) {
      weights[nodes[a]]+=operators.mass[8*a+b]
      rows[nodes[a]].set(nodes[b],(rows[nodes[a]].get(nodes[b])??0)+operators.stiffness[8*a+b])
    }
    if(k===n-1)for(const xi of [-q,q])for(const eta of [-q,q]) {
      const {shape}=basis(xi,eta,1), x=(i+(xi+1)/2)*h, y=(j+(eta+1)/2)*h
      const profile=Math.exp(-((x-lengthM/2)**2+(y-lengthM/2)**2)/ignitionWidthM**2)
      for(let a=0;a<8;a++){topArea[nodes[a]]+=shape[a]*h*h/4;ignitionShape[nodes[a]]+=shape[a]*h*h/4*profile}
    }
  }
  const norm=ignitionShape.reduce((a,b)=>a+b,0);for(let i=0;i<count;i++)ignitionShape[i]/=norm
  const offsets=new Int32Array(count+1), columns:number[]=[], values:number[]=[]
  rows.forEach((row,i)=>{offsets[i]=columns.length;[...row].sort(([a],[b])=>a-b).forEach(([column,value])=>{columns.push(column);values.push(value)})});offsets[count]=columns.length
  return {n,lengthM,h,coordinates,connectivity,weights,topArea,ignitionShape,
    stiffness:{offsets,columns:Int32Array.from(columns),values:Float64Array.from(values)},elementMass:operators.mass,elementStiffness:operators.stiffness}
}
export function sparseAction(matrix: Sparse, x: Float64Array) {
  const out=new Float64Array(x.length)
  for(let i=0;i<x.length;i++)for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++)out[i]+=matrix.values[p]*x[matrix.columns[p]]
  return out
}
const dot=(a:Float64Array,b:Float64Array)=>a.reduce((sum,v,i)=>sum+v*b[i],0)
export interface LinearEvidence { iterations:number; relativeResidual:number; absoluteResidual:number }
export function transport(mesh:Mesh, old:Float64Array, storage:number, diffusion:number,
  robin:Float64Array, forcing:Float64Array, dt:number, maxIterations=1000,
  dirichlet:Map<number,number>=new Map()): {field:Float64Array;evidence:LinearEvidence} {
  const count=old.length, diagonal=new Float64Array(count), rhs=new Float64Array(count)
  const apply=(x:Float64Array)=>{
    const out=new Float64Array(count), K=mesh.stiffness
    for(let i=0;i<count;i++) {
      if(dirichlet.has(i)){out[i]=x[i];continue}
      out[i]=(storage*mesh.weights[i]+dt*robin[i])*x[i]
      for(let p=K.offsets[i];p<K.offsets[i+1];p++)if(!dirichlet.has(K.columns[p]))out[i]+=dt*diffusion*K.values[p]*x[K.columns[p]]
    }return out
  }
  for(let i=0;i<count;i++) {
    rhs[i]=storage*mesh.weights[i]*old[i]+forcing[i];diagonal[i]=storage*mesh.weights[i]+dt*robin[i]
    const K=mesh.stiffness
    for(let p=K.offsets[i];p<K.offsets[i+1];p++){
      const j=K.columns[p];if(j===i)diagonal[i]+=dt*diffusion*K.values[p]
      if(dirichlet.has(j)&&!dirichlet.has(i))rhs[i]-=dt*diffusion*K.values[p]*dirichlet.get(j)!
    }
    if(dirichlet.has(i)){diagonal[i]=1;rhs[i]=dirichlet.get(i)!}
  }
  const x=old.slice();dirichlet.forEach((value,i)=>{x[i]=value})
  const Ax=apply(x), r=Float64Array.from(rhs,(v,i)=>v-Ax[i]), z=Float64Array.from(r,(v,i)=>v/diagonal[i]), p=z.slice()
  const rhsNorm=Math.sqrt(dot(rhs,rhs)), tolerance=1e-12+1e-10*rhsNorm
  let rz=dot(r,z), iterations=0
  while(Math.sqrt(dot(r,r))>tolerance&&iterations<maxIterations){
    const Ap=apply(p), denom=dot(p,Ap);if(!(denom>0)||!Number.isFinite(denom))throw new Error('CG operator lost positive definiteness')
    const alpha=rz/denom;for(let i=0;i<count;i++){x[i]+=alpha*p[i];r[i]-=alpha*Ap[i];z[i]=r[i]/diagonal[i]}
    const next=dot(r,z), beta=next/rz;for(let i=0;i<count;i++)p[i]=z[i]+beta*p[i];rz=next;iterations++
  }
  const actual=apply(x), residual=Float64Array.from(rhs,(v,i)=>v-actual[i]), absoluteResidual=Math.sqrt(dot(residual,residual))
  if(!Number.isFinite(absoluteResidual)||absoluteResidual>tolerance*1.1)throw new Error(`CG did not converge (${iterations} iterations, residual ${absoluteResidual})`)
  return {field:x,evidence:{iterations,absoluteResidual,relativeResidual:absoluteResidual/Math.max(rhsNorm,1e-30)}}
}
export function sample(mesh:Mesh, field:Float64Array, x:number,y:number,z:number) {
  if([x,y,z].some(v=>!Number.isFinite(v)||v<0||v>mesh.lengthM))throw new Error('Probe outside FE domain')
  const cell=[x,y,z].map(v=>Math.min(mesh.n-1,Math.floor(v/mesh.h))), local=[x,y,z].map((v,d)=>2*(v/mesh.h-cell[d])-1)
  const {shape}=basis(local[0],local[1],local[2]), e=cell[0]+mesh.n*(cell[1]+mesh.n*cell[2]);let value=0
  for(let a=0;a<8;a++)value+=shape[a]*field[mesh.connectivity[8*e+a]];return value
}
export function oxidationRate(T:number, fuel:number, oxygen:number) {
  if(T<=0||fuel<0||oxygen<0||![T,fuel,oxygen].every(Number.isFinite))throw new Error('Invalid reaction state')
  if(fuel===0||oxygen===0)return 0
  return MATERIAL.rho*Math.exp(MATERIAL.log10A*Math.LN10-MATERIAL.activationJMol/(8.314462618*T))
    *(fuel/MATERIAL.rho)**MATERIAL.fuelOrder*Math.expm1(MATERIAL.oxygenOrder*Math.log1p(oxygen/MATERIAL.gasReferenceDensity))
}
export interface Ledger { ignitionJ:number; reactionJ:number; heatOutJ:number; oxygenInKg:number;
  oxygenUsedKg:number; reactedPeatKg:number; productGasKg:number; inventoryLimited:number }
export interface Frame { timeS:number; temperature:Float64Array; oxygen:Float64Array; fuel:Float64Array;
  char:Float64Array; ledger:Ledger; stepS:number; splittingError:number; rejectedSteps:number;
  heatSolve:LinearEvidence; oxygenSolve:LinearEvidence; peak:{temperatureK:number;node:number;timeS:number} }
export interface ExternalExchange { id:string; timeS:number; positionM:[number,number,number];
  energyJ:number; speciesKg:{oxygen:number;peat:number;char:number;releasedGas:number};
  inventoryId:string; inventoryBeforeKg:number; inventoryAfterKg:number; signConvention:'positive into domain' }
export const EMPTY_INTERVENTIONS:readonly ExternalExchange[]=Object.freeze([])
const zeroEvidence=()=>({iterations:0,relativeResidual:0,absoluteResidual:0})
function copy(frame:Frame):Frame{return {...frame,temperature:frame.temperature.slice(),oxygen:frame.oxygen.slice(),fuel:frame.fuel.slice(),char:frame.char.slice(),ledger:{...frame.ledger},peak:{...frame.peak}}}
export function totals(mesh:Mesh, frame:Frame) {
  const mass=(field:Float64Array,scale=1)=>field.reduce((sum,v,i)=>sum+v*mesh.weights[i]*scale,0)
  let maximum=-Infinity,node=0;frame.temperature.forEach((v,i)=>{if(v>maximum){maximum=v;node=i}})
  const peatKg=mass(frame.fuel),charKg=mass(frame.char),oxygenKg=mass(frame.oxygen,MATERIAL.phi)
  const energyJ=frame.temperature.reduce((sum,v,i)=>sum+(v-300)*MATERIAL.rho*MATERIAL.cp*mesh.weights[i],0)
  return {peatKg,charKg,oxygenKg,energyJ,maximumK:maximum,maximumNode:node,
    componentsKg:peatKg+charKg+oxygenKg+frame.ledger.productGasKg}
}
export class PeatSolver {
  readonly mesh:Mesh;readonly settings:Settings;frame:Frame;nextStepS:number;status:'paused'|'failed'='paused';error=''
  private heatRobin:Float64Array;private oxygenRobin:Float64Array
  constructor(settings:Settings){
    if(!Object.values(settings).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)))throw new Error('Nonfinite settings')
    if(settings.ambientK<=0||settings.oxygenKgM3<0||settings.ignitionW<0||settings.ignitionS<0||settings.heatTransfer<0||settings.massTransferMS<0||settings.maxStepS<=0||settings.endS<=0||(settings.initialK??300)<=0||(settings.initialOxygenKgM3??0)<0||(settings.toleranceScale??1)<=0)throw new Error('Invalid physical or numerical settings')
    this.settings={...settings};this.mesh=createMesh(settings.n,settings.lengthM,settings.ignitionWidthM);this.nextStepS=settings.maxStepS
    const count=this.mesh.weights.length
    this.heatRobin=Float64Array.from(this.mesh.topArea,v=>v*settings.heatTransfer)
    this.oxygenRobin=Float64Array.from(this.mesh.topArea,v=>v*MATERIAL.phi*settings.massTransferMS)
    const initial=settings.initialK??settings.ambientK
    this.frame={timeS:0,temperature:new Float64Array(count).fill(initial),oxygen:new Float64Array(count).fill(settings.initialOxygenKgM3??settings.oxygenKgM3),fuel:new Float64Array(count).fill(MATERIAL.rho),char:new Float64Array(count),ledger:{ignitionJ:0,reactionJ:0,heatOutJ:0,oxygenInKg:0,oxygenUsedKg:0,reactedPeatKg:0,productGasKg:0,inventoryLimited:0},stepS:0,splittingError:0,rejectedSteps:0,heatSolve:zeroEvidence(),oxygenSolve:zeroEvidence(),peak:{temperatureK:initial,node:0,timeS:0}}
  }
  private split(start:Frame,dt:number):Frame {
    const out=copy(start), s=this.settings, m=this.mesh, C=MATERIAL.rho*MATERIAL.cp
    const ignitionDt=Math.max(0,Math.min(start.timeS+dt,s.ignitionS)-Math.min(start.timeS,s.ignitionS))
    const heatLoad=Float64Array.from(this.heatRobin,(v,i)=>dt*v*s.ambientK+s.ignitionW*ignitionDt*m.ignitionShape[i])
    const oxygenLoad=Float64Array.from(this.oxygenRobin,v=>dt*v*s.oxygenKgM3)
    const heat=transport(m,start.temperature,C,MATERIAL.conductivity,this.heatRobin,heatLoad,dt,s.maxIterations??1000)
    const oxygen=transport(m,start.oxygen,MATERIAL.phi,MATERIAL.phi*MATERIAL.diffusivity,this.oxygenRobin,oxygenLoad,dt,s.maxIterations??1000)
    out.temperature=heat.field;out.oxygen=oxygen.field;out.heatSolve=heat.evidence;out.oxygenSolve=oxygen.evidence
    out.ledger.ignitionJ+=s.ignitionW*ignitionDt
    for(let i=0;i<m.weights.length;i++){
      out.ledger.heatOutJ+=dt*this.heatRobin[i]*(out.temperature[i]-s.ambientK)
      out.ledger.oxygenInKg+=dt*this.oxygenRobin[i]*(s.oxygenKgM3-out.oxygen[i])
      if(s.chemistry){
        const f=out.fuel[i], c=out.oxygen[i], rate=oxidationRate(out.temperature[i],f,c), n=MATERIAL.fuelOrder
        const proposed=f>0?-f*Math.expm1(-Math.log1p((n-1)*rate*dt/f)/(n-1)):0
        const oxygenBound=MATERIAL.phi*c/MATERIAL.oxygenPerFuel, extent=Math.min(proposed,f,oxygenBound)
        const oxygenExhausted=proposed>oxygenBound
        // Exact inventory exhaustion is a constrained reaction, never post-solve clipping.
        out.oxygen[i]=oxygenExhausted?0:c-extent*MATERIAL.oxygenPerFuel/MATERIAL.phi
        out.fuel[i]-=extent;out.char[i]+=extent*MATERIAL.charYield;out.temperature[i]+=extent*MATERIAL.heatJPerKg/C
        out.ledger.inventoryLimited+=oxygenExhausted?1:0
        const kg=extent*m.weights[i];out.ledger.reactedPeatKg+=kg;out.ledger.oxygenUsedKg+=kg*MATERIAL.oxygenPerFuel
        out.ledger.reactionJ+=kg*MATERIAL.heatJPerKg;out.ledger.productGasKg+=kg*(1+MATERIAL.oxygenPerFuel-MATERIAL.charYield)
      }
      if(![out.temperature[i],out.oxygen[i],out.fuel[i],out.char[i]].every(Number.isFinite)||out.temperature[i]<=0||out.oxygen[i]<0||out.fuel[i]<0||out.char[i]<0)throw new Error('Nonpositive/nonfinite accepted-state candidate')
    }
    out.timeS+=dt;out.stepS=dt;const t=totals(m,out)
    if(t.maximumK>out.peak.temperatureK)out.peak={temperatureK:t.maximumK,node:t.maximumNode,timeS:out.timeS}
    return out
  }
  advance(maxDt=this.settings.maxStepS,interventions=EMPTY_INTERVENTIONS):Frame {
    if(interventions.length)throw new Error('Suppression interventions are disabled; conservative physics and evidence required')
    if(this.status==='failed')throw new Error(this.error)
    const remaining=this.settings.endS-this.frame.timeS;if(remaining<=1e-9)return this.snapshot()
    let dt=Math.min(maxDt,this.nextStepS,remaining), rejected=0, lastError=''
    if(!(dt>0))throw new Error('Time step must be positive')
    for(let attempt=0;attempt<24;attempt++){
      try {
        const full=this.split(this.frame,dt), firstHalf=this.split(this.frame,dt/2), half=this.split(firstHalf,dt/2)
        let error=0;const scale=this.settings.toleranceScale??1
        for(let i=0;i<half.temperature.length;i++){
          error=Math.max(error,Math.abs(half.temperature[i]-full.temperature[i])/(scale*(.25+.001*Math.abs(half.temperature[i]))),Math.abs(half.oxygen[i]-full.oxygen[i])/(scale*(1e-6+.002*this.settings.oxygenKgM3)),Math.abs(half.fuel[i]-full.fuel[i])/(scale*(.001+.002*MATERIAL.rho)))
        }
        if(error>1){lastError=`Splitting error ${error}`;rejected++;dt*=Math.max(.2,.8/Math.sqrt(error));continue}
        half.splittingError=error;half.stepS=dt;half.rejectedSteps=this.frame.rejectedSteps+rejected
        // Evidence reports both accepted half-step systems' largest residual/iterations.
        for(const key of ['heatSolve','oxygenSolve'] as const)half[key]={iterations:firstHalf[key].iterations+half[key].iterations,relativeResidual:Math.max(firstHalf[key].relativeResidual,half[key].relativeResidual),absoluteResidual:Math.max(firstHalf[key].absoluteResidual,half[key].absoluteResidual)}
        this.frame=half
        this.nextStepS=Math.min(this.settings.maxStepS,dt*Math.min(2,Math.max(.5,.8/Math.sqrt(Math.max(error,1e-10)))))
        return this.snapshot()
      }catch(error){lastError=String(error);rejected++;dt*=.5}
      if(dt<1e-7)break
    }
    this.status='failed';this.error=`Solver stopped at ${this.frame.timeS.toFixed(6)} s: ${lastError}`;throw new Error(this.error)
  }
  snapshot():Frame{return copy(this.frame)}
  restore(frame:Frame) {
    const count=this.mesh.weights.length
    if(frame.timeS<0||frame.timeS>this.settings.endS||!Number.isFinite(frame.timeS)||frame.peak.node<0||frame.peak.node>=count)throw new Error('Invalid checkpoint metadata')
    for(const key of ['temperature','oxygen','fuel','char'] as const)if(frame[key].length!==count||![...frame[key]].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Invalid checkpoint field')
    if([...frame.temperature].some(v=>v<=0)||Object.values(frame.ledger).some(v=>!Number.isFinite(v)))throw new Error('Invalid checkpoint thermodynamic state')
    this.frame=copy(frame);this.nextStepS=frame.stepS>0?Math.min(this.settings.maxStepS,frame.stepS*Math.min(2,Math.max(.5,.8/Math.sqrt(Math.max(frame.splittingError,1e-10))))):this.settings.maxStepS
    this.status='paused';this.error=''
  }
}
