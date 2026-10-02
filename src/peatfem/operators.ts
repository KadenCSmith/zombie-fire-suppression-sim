import { type Mesh, type Sparse, type LinearEvidence, sparseAction } from './model.ts'
import { R, CONSTITUENTS } from './chemistry.ts'

const mappings=new WeakMap<Mesh,Int32Array>()
function elementMap(mesh:Mesh) {
  let map=mappings.get(mesh);if(map)return map
  map=new Int32Array(mesh.connectivity.length*8)
  const lookup=Array.from({length:mesh.weights.length},(_,i)=>{
    const row=new Map<number,number>();for(let p=mesh.stiffness.offsets[i];p<mesh.stiffness.offsets[i+1];p++)row.set(mesh.stiffness.columns[p],p);return row
  })
  for(let e=0;e<mesh.n**3;e++)for(let a=0;a<8;a++)for(let b=0;b<8;b++)map[64*e+8*a+b]=lookup[mesh.connectivity[8*e+a]].get(mesh.connectivity[8*e+b])!
  mappings.set(mesh,map);return map
}
/** Q1 Galerkin stiffness with cell-mean, piecewise constant coefficient. */
export function diffusionMatrix(mesh:Mesh,coefficient:Float64Array):Sparse {
  const values=new Float64Array(mesh.stiffness.values.length),map=elementMap(mesh)
  for(let e=0;e<mesh.n**3;e++) {
    let mean=0;for(let a=0;a<8;a++)mean+=coefficient[mesh.connectivity[8*e+a]]/8
    if(mean<0||!Number.isFinite(mean))throw new Error('Invalid FE diffusion coefficient')
    for(let k=0;k<64;k++)values[map[64*e+k]]+=mean*mesh.elementStiffness[k]
  }
  return {...mesh.stiffness,values}
}
const dot=(a:Float64Array,b:Float64Array)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum}
function norm(a:Float64Array){return Math.sqrt(dot(a,a))}
export function solveSPD(matrix:Sparse,rhs:Float64Array,initial:Float64Array,dirichlet=new Map<number,number>(),maxIterations=1000,relativeTolerance=1e-10) {
  const values=matrix.values.slice(),b=rhs.slice(),n=rhs.length,diagonal=new Float64Array(n)
  const boundaryScale=new Float64Array(n)
  for(let i=0;i<n;i++)for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++)if(matrix.columns[p]===i)boundaryScale[i]=matrix.values[p]
  for(let i=0;i<n;i++)for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++) {
    const j=matrix.columns[p]
    // Retain physical row scaling: identity rows in Pa would dominate the
    // mass-balance residual norm and could falsely accept unconverged interiors.
    if(dirichlet.has(i)){values[p]=j===i?boundaryScale[i]:0;b[i]=dirichlet.get(i)!*boundaryScale[i]}
    else if(dirichlet.has(j)){b[i]-=values[p]*dirichlet.get(j)!;values[p]=0}
    if(j===i)diagonal[i]=values[p]
  }
  const A={...matrix,values},x=initial.slice();dirichlet.forEach((v,i)=>{x[i]=v})
  const ax=sparseAction(A,x),r=Float64Array.from(b,(v,i)=>v-ax[i]),z=Float64Array.from(r,(v,i)=>v/diagonal[i]),p=z.slice()
  const rhsNorm=norm(b),tolerance=1e-14+relativeTolerance*rhsNorm
  let rz=dot(r,z),iterations=0
  while(norm(r)>tolerance&&iterations<maxIterations) {
    const ap=sparseAction(A,p),denominator=dot(p,ap)
    if(!(denominator>0)||!Number.isFinite(denominator))throw new Error('Pressure/heat CG lost positive definiteness')
    const alpha=rz/denominator
    for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diagonal[i]}
    const next=dot(r,z),beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next;iterations++
  }
  const action=sparseAction(A,x),residual=Float64Array.from(b,(v,i)=>v-action[i]),absoluteResidual=norm(residual)
  if(!Number.isFinite(absoluteResidual)||absoluteResidual>tolerance*1.2)throw new Error(`CG residual failed after ${iterations} iterations: ${absoluteResidual}`)
  return {field:x,evidence:{iterations,absoluteResidual,relativeResidual:absoluteResidual/Math.max(rhsNorm,1e-30)}}
}
/** Monotone algebraically stabilized Galerkin transport. No FVM assembly. */
export function solveMonotone(matrix:Sparse,rhs:Float64Array[],initial:Float64Array[],maxIterations=2000,tolerance=1e-10) {
  const n=rhs[0].length,diagonal=new Float64Array(n),fields=initial.map(x=>x.slice())
  for(let i=0;i<n;i++)for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++) {
    if(matrix.columns[p]===i)diagonal[i]=matrix.values[p]
    else if(matrix.values[p]>1e-18)throw new Error('Transport operator is not monotone')
  }
  if([...diagonal].some(v=>v<=0||!Number.isFinite(v)))throw new Error('Nonpositive transport diagonal')
  const scale=rhs.map(x=>Math.max(norm(x),1e-30));let iterations=0,relativeResidual=Infinity,absoluteResidual=Infinity
  while(iterations<maxIterations) {
    for(let i=0;i<n;i++)for(let k=0;k<fields.length;k++) {
      let value=rhs[k][i]
      for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++)if(matrix.columns[p]!==i)value-=matrix.values[p]*fields[k][matrix.columns[p]]
      fields[k][i]=value/diagonal[i]
    }
    iterations++;relativeResidual=0;absoluteResidual=0
    for(let k=0;k<fields.length;k++) {
      const ax=sparseAction(matrix,fields[k]),res=Float64Array.from(rhs[k],(v,i)=>v-ax[i]),absolute=norm(res)
      relativeResidual=Math.max(relativeResidual,absolute/scale[k]);absoluteResidual=Math.max(absoluteResidual,absolute)
    }
    if(relativeResidual<tolerance||absoluteResidual<1e-14)break
  }
  if(!Number.isFinite(relativeResidual)||(relativeResidual>tolerance&&absoluteResidual>1e-14))throw new Error(`Monotone solve did not converge: ${iterations}, residual ${relativeResidual}`)
  return {fields,evidence:{iterations,relativeResidual,absoluteResidual}}
}
export interface Edge {i:number;j:number;ij:number;ji:number;conductance:number}
export function edges(matrix:Sparse):Edge[] {
  const list:Edge[]=[]
  for(let i=0;i<matrix.offsets.length-1;i++)for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++) {
    const j=matrix.columns[p];if(j<=i)continue
    let reverse=matrix.offsets[j];while(matrix.columns[reverse]!==i&&reverse<matrix.offsets[j+1])reverse++
    const value=-matrix.values[p]
    if(value<-1e-16)throw new Error('Q1 cubic stiffness has positive off-diagonal')
    if(value>0)list.push({i,j,ij:p,ji:reverse,conductance:value})
  }
  return list
}
export function addDiagonal(matrix:Sparse,diagonal:Float64Array) {
  const values=matrix.values.slice()
  for(let i=0;i<diagonal.length;i++)for(let p=matrix.offsets[i];p<matrix.offsets[i+1];p++)if(matrix.columns[p]===i)values[p]+=diagonal[i]
  return {...matrix,values}
}
export function upwindOperator(diffusion:Sparse,edgeList:Edge[],flux:Float64Array,boundary:Float64Array,storage:Float64Array,dt:number,scale=1) {
  const values=Float64Array.from(diffusion.values,v=>dt*v),diagonal=storage.slice()
  edgeList.forEach((e,k)=>{
    const f=dt*flux[k]*scale
    if(f>=0){diagonal[e.i]+=f;values[e.ji]-=f}
    else{diagonal[e.j]-=f;values[e.ij]+=f}
  })
  for(let i=0;i<storage.length;i++)if(boundary[i]>0)diagonal[i]+=dt*boundary[i]*scale
  return addDiagonal({...diffusion,values},diagonal)
}
export interface FlowOptions { viscosity:number; diffusivity:number; ambientPressure:number; ambientY:Float64Array; transferKgM2S:number; gravity:number; closed:boolean; pressureBoundary?:Map<number,number>; maxIterations?:number; solveTolerance?:number }
export interface FlowResult { gas:Float64Array[];pressure:Float64Array;massFlux:Float64Array;boundaryMassFlux:Float64Array;edgeList:Edge[];pressureSolve:LinearEvidence;speciesSolve:LinearEvidence;picardIterations:number;picardError:number }
function gasR(gas:Float64Array[],i:number) {
  let mass=0,moles=0;for(let j=0;j<4;j++){mass+=gas[j][i];moles+=gas[j][i]/CONSTITUENTS.molecularKgMol[j]}
  if(!(mass>0))throw new Error('Gas inventory vanished');return R*moles/mass
}
const logMean=(a:number,b:number)=>Math.abs(a-b)<1e-8*Math.max(a,b)?(a+b)/2:(a-b)/Math.log(a/b)
/** Frozen-temperature compressible Darcy and species substep; EOS Picard coupling. */
export function gasStep(mesh:Mesh,old:Float64Array[],temperature:Float64Array,theta:Float64Array,permeability:Float64Array,dt:number,options:FlowOptions):FlowResult {
  const n=theta.length,mass=Float64Array.from(theta,(_,i)=>old.reduce((sum,g)=>sum+g[i],0))
  let gas=old.map(g=>g.slice()),pressure=Float64Array.from(theta,(v,i)=>mass[i]/v*gasR(old,i)*temperature[i])
  const stiffness=diffusionMatrix(mesh,permeability),edgeList=edges(stiffness),rho=new Float64Array(n)
  const dirichlet=new Map<number,number>(options.pressureBoundary);if(!options.closed&&!options.pressureBoundary)mesh.topArea.forEach((v,i)=>{if(v>0)dirichlet.set(i,options.ambientPressure)})
  const diffusion=diffusionMatrix(mesh,Float64Array.from(mass,v=>v*options.diffusivity))
  let pressureSolve:LinearEvidence={iterations:0,relativeResidual:0,absoluteResidual:0},speciesSolve={...pressureSolve}
  let massFlux=new Float64Array(edgeList.length),boundaryMassFlux=new Float64Array(n),picardError=Infinity
  for(let iteration=0;iteration<50;iteration++) {
    const chi=Float64Array.from(theta,(v,i)=>v/(gasR(gas,i)*temperature[i]))
    for(let i=0;i<n;i++)rho[i]=chi[i]*pressure[i]/theta[i]
    const values=new Float64Array(stiffness.values.length),rhs=Float64Array.from(mass,(v,i)=>v*mesh.weights[i]),diagonal=Float64Array.from(chi,(v,i)=>v*mesh.weights[i])
    const conductance=new Float64Array(edgeList.length),gravity=new Float64Array(edgeList.length)
    edgeList.forEach((e,k)=>{
      const density=(rho[e.i]+rho[e.j])/2,G=e.conductance*density/options.viscosity
      conductance[k]=G;gravity[k]=-logMean(rho[e.i],rho[e.j])*options.gravity*(mesh.coordinates[3*e.j+2]-mesh.coordinates[3*e.i+2])
      values[e.ij]-=dt*G;values[e.ji]-=dt*G;diagonal[e.i]+=dt*G;diagonal[e.j]+=dt*G
      rhs[e.i]-=dt*G*gravity[k];rhs[e.j]+=dt*G*gravity[k]
    })
    const solved=solveSPD(addDiagonal({...stiffness,values},diagonal),rhs,pressure,dirichlet,options.maxIterations??1000,options.solveTolerance??1e-10)
    pressureSolve=solved.evidence
    const newMass=Float64Array.from(chi,(v,i)=>v*solved.field[i]),outgoing=new Float64Array(n)
    massFlux=Float64Array.from(edgeList,(e,k)=>conductance[k]*(solved.field[e.i]-solved.field[e.j]+gravity[k]))
    edgeList.forEach((e,k)=>{outgoing[e.i]+=massFlux[k];outgoing[e.j]-=massFlux[k]})
    boundaryMassFlux=new Float64Array(n)
    dirichlet.forEach((_,i)=>{boundaryMassFlux[i]=(mass[i]-newMass[i])*mesh.weights[i]/dt-outgoing[i]})
    const storage=Float64Array.from(newMass,(v,i)=>v*mesh.weights[i]),robin=Float64Array.from(mesh.topArea,v=>options.closed?0:dt*v*options.transferKgM2S)
    const matrix=addDiagonal(upwindOperator(diffusion,edgeList,massFlux,boundaryMassFlux,storage,dt),robin)
    const speciesRhs=old.map((field,j)=>Float64Array.from(field,(v,i)=>v*mesh.weights[i]+(dt*Math.max(0,-boundaryMassFlux[i])+robin[i])*options.ambientY[j]))
    const initial=gas.map(g=>Float64Array.from(g,(v,i)=>v/gas.reduce((sum,f)=>sum+f[i],0)))
    const transported=solveMonotone(matrix,speciesRhs,initial,options.maxIterations??2000,options.solveTolerance??1e-10)
    speciesSolve=transported.evidence
    const next=transported.fields.map(Y=>Float64Array.from(Y,(v,i)=>v*newMass[i]))
    picardError=0
    for(let i=0;i<n;i++) {
      if(!(solved.field[i]>0)||next.some(g=>g[i]<0||!Number.isFinite(g[i])))throw new Error('Invalid gas-flow candidate')
      const actual=next.reduce((sum,g)=>sum+g[i],0)/theta[i]*gasR(next,i)*temperature[i]
      picardError=Math.max(picardError,Math.abs(actual-solved.field[i])/actual,Math.abs(solved.field[i]-pressure[i])/solved.field[i])
    }
    if(picardError>=1e-8){
      // Damping is applied to the nonlinear iterates only. Accepted species are
      // always the conservative linear solve, never a blended physical state.
      gas=next.map((g,j)=>Float64Array.from(g,(v,i)=>(v+gas[j][i])/2))
      pressure=Float64Array.from(solved.field,(v,i)=>(v+pressure[i])/2)
    }else{gas=next;pressure=solved.field}
    if(picardError<1e-8)return {gas,pressure,massFlux,boundaryMassFlux,edgeList,pressureSolve,speciesSolve,picardIterations:iteration+1,picardError}
  }
  throw new Error(`Gas EOS/continuity Picard did not converge: ${picardError}`)
}
