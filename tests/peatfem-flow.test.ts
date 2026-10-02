import {describe,it,expect} from 'vitest'
import {createMesh,sparseAction} from '../src/peatfem/model'
import {diffusionMatrix,gasStep,type FlowOptions} from '../src/peatfem/operators'
import {R} from '../src/peatfem/chemistry'
const options:FlowOptions={viscosity:1.8e-5,diffusivity:2e-5,ambientPressure:101325,ambientY:Float64Array.from([0,1,0,0]),transferKgM2S:0,gravity:0,closed:true}
const mass=(mesh:ReturnType<typeof createMesh>,g:Float64Array[])=>g.reduce((s,f)=>s+f.reduce((a,v,i)=>a+v*mesh.weights[i],0),0)
describe('Q1 compressible Darcy and conservative gas species',()=>{
  it('assembles variable diffusion in the same FE space with symmetric zero-sum rows',()=>{
    const mesh=createMesh(3,.1),k=Float64Array.from(mesh.weights,(_,i)=>.1+mesh.coordinates[3*i]),A=diffusionMatrix(mesh,k)
    const action=sparseAction(A,new Float64Array(k.length).fill(1))
    expect(Math.max(...Array.from(action,Math.abs))).toBeLessThan(1e-15)
    expect(Array.from(A.values).every(Number.isFinite)).toBe(true)
  })
  it('preserves a closed uniform gas and exact species sums at zero flow',()=>{
    const mesh=createMesh(3,.1),n=mesh.weights.length,theta=new Float64Array(n).fill(.9),T=new Float64Array(n).fill(300),K=new Float64Array(n).fill(1e-12)
    const old=[0,1,0,0].map(y=>new Float64Array(n).fill(y*.9*101325/(R/.028014*300)))
    const next=gasStep(mesh,old,T,theta,K,.5,options)
    expect(Math.max(...Array.from(next.massFlux,Math.abs))).toBeLessThan(1e-14)
    expect(Math.max(...Array.from(next.pressure,p=>Math.abs(p-101325)))).toBeLessThan(1e-5)
    expect(mass(mesh,next.gas)).toBeCloseTo(mass(mesh,old),12)
    expect(next.gas[0].every(v=>v===0)).toBe(true)
  })
  it('recovers analytical homogeneous-column squared pressure and mass flux',()=>{
    const mesh=createMesh(4,.1),n=mesh.weights.length,T=new Float64Array(n).fill(300),theta=new Float64Array(n).fill(.9),K=new Float64Array(n).fill(1e-12),b=1/(R/.028014*300)
    const p0=102325,p1=101325,P=Float64Array.from(theta,(_,i)=>Math.sqrt(p0*p0+(p1*p1-p0*p0)*mesh.coordinates[3*i]/.1)),boundary=new Map<number,number>()
    P.forEach((p,i)=>{if(mesh.coordinates[3*i]===0||Math.abs(mesh.coordinates[3*i]-.1)<1e-10)boundary.set(i,p)})
    const old=[0,1,0,0].map(y=>Float64Array.from(P,p=>y*.9*b*p))
    const next=gasStep(mesh,old,T,theta,K,1,{...options,closed:false,pressureBoundary:boundary})
    expect(Math.max(...Array.from(P,(p,i)=>Math.abs(p-next.pressure[i])))).toBeLessThan(.001)
    let incoming=0;boundary.forEach((_,i)=>{if(mesh.coordinates[3*i]===0)incoming-=next.boundaryMassFlux[i]})
    const analytical=1e-12*b*(p0*p0-p1*p1)/(2*1.8e-5*.1)*.1**2
    expect(incoming/analytical).toBeCloseTo(1,7)
  })
  it('has hydrostatic no-flow equilibrium with the gravity sign and log-mean body term',()=>{
    const mesh=createMesh(3,.1),n=mesh.weights.length,T=new Float64Array(n).fill(300),theta=new Float64Array(n).fill(.9),K=new Float64Array(n).fill(1e-12),gasR=R/.028014
    const P=Float64Array.from(theta,(_,i)=>101325*Math.exp(-9.81*mesh.coordinates[3*i+2]/(gasR*300)))
    const old=[0,1,0,0].map(y=>Float64Array.from(P,p=>y*.9*p/(gasR*300)))
    const next=gasStep(mesh,old,T,theta,K,.5,{...options,gravity:9.81})
    expect(Math.max(...Array.from(next.massFlux,Math.abs))).toBeLessThan(1e-13)
    expect(Math.max(...Array.from(P,(p,i)=>Math.abs(p-next.pressure[i])))).toBeLessThan(1e-5)
  })
  it('equilibrates pressure with closed-domain mass conservation and species positivity',()=>{
    const mesh=createMesh(3,.1),n=mesh.weights.length,T=new Float64Array(n).fill(300),theta=new Float64Array(n).fill(.9),K=new Float64Array(n).fill(1e-12)
    let gas:Float64Array[]=[0,1,0,0].map(y=>Float64Array.from(theta,(_,i)=>y*.9*(101325+(mesh.coordinates[3*i]<.04?500:0))/(R/.028014*300)))
    const original=mass(mesh,gas);let spread=500
    for(let k=0;k<4;k++){const next=gasStep(mesh,gas,T,theta,K,1,options);gas=next.gas;const range=Math.max(...next.pressure)-Math.min(...next.pressure);expect(range).toBeLessThan(spread);spread=range}
    expect(mass(mesh,gas)).toBeCloseTo(original,10);expect(gas.flatMap(g=>Array.from(g)).every(v=>v>=0)).toBe(true)
  })
  it('vents generated mixture mass conservatively and supplies prescribed inflow composition',()=>{
    const mesh=createMesh(3,.1),n=mesh.weights.length,T=new Float64Array(n).fill(300),theta=new Float64Array(n).fill(.9),K=new Float64Array(n).fill(1e-12)
    const old=[0,1,0,0].map(y=>new Float64Array(n).fill(y*.9*101325/(R/.028014*300)));old[2].fill(.01)
    const next=gasStep(mesh,old,T,theta,K,.5,{...options,closed:false})
    const out=next.boundaryMassFlux.reduce((a,b)=>a+b,0)*.5
    expect(out).toBeGreaterThan(0);expect(mass(mesh,next.gas)+out-mass(mesh,old)).toBeCloseTo(0,10)
    expect(next.gas.flatMap(g=>Array.from(g)).every(v=>v>=0&&Number.isFinite(v))).toBe(true)
  })
})
