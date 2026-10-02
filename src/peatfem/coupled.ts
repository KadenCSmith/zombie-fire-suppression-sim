/** Conservative fixed-geometry 3D reacting porous FEM. See the model document. */
import {createMesh,basis,type Mesh,type LinearEvidence,type ExternalExchange,EMPTY_INTERVENTIONS} from './model.ts'
import {localInitial,properties,reactLocal,energy,REACTIONS,CONSTITUENTS,T_REF,type LocalState} from './chemistry.ts'
import {diffusionMatrix,gasStep,upwindOperator,addDiagonal,solveMonotone,type FlowOptions,type FlowResult} from './operators.ts'
export interface Settings {
  n:number;lengthM:number;ambientK:number;oxygenMassFraction:number;moistureRatio:number;dryDensityKgM3:number;
  ambientPressurePa:number;ignitionW:number;ignitionS:number;ignitionWidthM:number;heatTransfer:number;
  transferKgM2S:number;permeabilityM2:number;poreRadiationM:number;gasDiffusivityM2S:number;gasViscosityPaS:number;
  emissivity:number;gravityMS2:number;maxStepS:number;endS:number;chemistry:boolean;closed:boolean;
  initialK?:number;initialPressurePa?:number;toleranceScale?:number;solveTolerance?:number;maxIterations?:number;
}
export const DEFAULT_SETTINGS:Settings={n:4,lengthM:.1,ambientK:300,oxygenMassFraction:.233,moistureRatio:.1,dryDensityKgM3:123,
  ambientPressurePa:101325,ignitionW:8,ignitionS:180,ignitionWidthM:.025,heatTransfer:10,transferKgM2S:.01,
  permeabilityM2:1e-12,poreRadiationM:.0005,gasDiffusivityM2S:2e-5,gasViscosityPaS:1.8e-5,emissivity:.95,gravityMS2:0,
  maxStepS:1,endS:600,chemistry:true,closed:false}
export const SOURCE={title:'Huang & Rein (2017), Irish-moss column kinetics',url:'https://doi.org/10.1071/WF16198',locator:'Eq 4–8; Tables 1–2; C3 Eq 15–18 normalization',status:'Five-step column kinetics transferred; fixed-geometry LTE and gas surrogate adaptations; not experimentally validated'}
export interface Ledger {
  ignitionJ:number;reactionJ:number;heatOutJ:number;gasEnthalpyOutJ:number;oxygenInKg:number;oxygenUsedKg:number;
  reactedPeatKg:number;productGasKg:number;inventoryLimited:number;gasBoundaryKg:Float64Array;reactionExtentsKg:Float64Array;
}
export interface Frame {
  timeS:number;temperature:Float64Array;oxygen:Float64Array;fuel:Float64Array;char:Float64Array;
  water:Float64Array;alphaChar:Float64Array;ash:Float64Array;gas:Float64Array[];pressure:Float64Array;
  porosity:Float64Array;darcySpeed:Float64Array;darcyFlux:Float64Array;peclet:Float64Array;
  ledger:Ledger;stepS:number;splittingError:number;rejectedSteps:number;heatSolve:LinearEvidence;oxygenSolve:LinearEvidence;
  pressureSolve:LinearEvidence;nonlinearIterations:number;nonlinearError:number;chemistrySubsteps:number;
  peak:{temperatureK:number;node:number;timeS:number};
}
const zero=():LinearEvidence=>({iterations:0,relativeResidual:0,absoluteResidual:0})
function copy(f:Frame):Frame {
  const out={...f,gas:f.gas.map(g=>g.slice()),ledger:{...f.ledger,gasBoundaryKg:f.ledger.gasBoundaryKg.slice(),reactionExtentsKg:f.ledger.reactionExtentsKg.slice()},peak:{...f.peak}}
  for(const key of ['temperature','oxygen','fuel','char','water','alphaChar','ash','pressure','porosity','darcySpeed','darcyFlux','peclet'] as const)out[key]=f[key].slice()
  return out
}
const solids=(f:Frame)=>[f.water,f.fuel,f.alphaChar,f.char,f.ash]
function local(f:Frame,i:number):LocalState{return {temperature:f.temperature[i],solid:Float64Array.from(solids(f),a=>a[i]),gas:Float64Array.from(f.gas,a=>a[i])}}
const opts=(s:Settings)=>({poreRadiationM:s.poreRadiationM,permeabilityM2:s.permeabilityM2})
export function totals(mesh:Mesh,f:Frame) {
  let energyJ=0,gasKg=0,maximumK=-Infinity,maximumNode=0,oxygenKg=0,peatKg=0,charKg=0,waterKg=0,ashKg=0
  for(let i=0;i<mesh.weights.length;i++){
    const w=mesh.weights[i];energyJ+=energy(local(f,i))*w;gasKg+=f.gas.reduce((sum,g)=>sum+g[i],0)*w
    oxygenKg+=f.gas[0][i]*w;peatKg+=f.fuel[i]*w;charKg+=(f.char[i]+f.alphaChar[i])*w;waterKg+=f.water[i]*w;ashKg+=f.ash[i]*w
    if(f.temperature[i]>maximumK){maximumK=f.temperature[i];maximumNode=i}
  }
  return {energyJ,gasKg,oxygenKg,peatKg,charKg,waterKg,ashKg,maximumK,maximumNode,componentsKg:gasKg+peatKg+charKg+waterKg+ashKg}
}
export class PeatSolver {
  readonly mesh:Mesh;readonly settings:Settings;frame:Frame;nextStepS:number;status:'paused'|'failed'='paused';error=''
  constructor(settings:Settings) {
    if(Object.values(settings).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error('Nonfinite settings')
    if(settings.ambientK<=0||settings.oxygenMassFraction<0||settings.oxygenMassFraction>1||settings.moistureRatio<0||settings.dryDensityKgM3<=0||settings.ambientPressurePa<=0||settings.ignitionW<0||settings.ignitionS<0||settings.heatTransfer<0||settings.transferKgM2S<0||settings.permeabilityM2<=0||settings.poreRadiationM<0||settings.gasDiffusivityM2S<0||settings.gasViscosityPaS<=0||settings.emissivity<0||settings.emissivity>1||settings.maxStepS<=0||settings.endS<=0||(settings.initialK??300)<=0||(settings.initialPressurePa??101325)<=0||(settings.toleranceScale??1)<=0||(settings.solveTolerance??1e-10)<=0)throw new Error('Invalid physical/numerical settings')
    this.settings={...settings};this.mesh=createMesh(settings.n,settings.lengthM,settings.ignitionWidthM);this.nextStepS=settings.maxStepS
    const state=localInitial(settings.dryDensityKgM3,settings.moistureRatio,settings.initialK??settings.ambientK,settings.initialPressurePa??settings.ambientPressurePa,settings.oxygenMassFraction),n=this.mesh.weights.length
    const array=(v=0)=>new Float64Array(n).fill(v)
    this.frame={timeS:0,temperature:array(state.temperature),water:array(state.solid[0]),fuel:array(state.solid[1]),alphaChar:array(),char:array(),ash:array(),
      gas:Array.from(state.gas,v=>array(v)),oxygen:array(),pressure:array(),porosity:array(),darcySpeed:array(),darcyFlux:new Float64Array(3*n),peclet:array(),
      ledger:{ignitionJ:0,reactionJ:0,heatOutJ:0,gasEnthalpyOutJ:0,oxygenInKg:0,oxygenUsedKg:0,reactedPeatKg:0,productGasKg:0,inventoryLimited:0,gasBoundaryKg:new Float64Array(4),reactionExtentsKg:new Float64Array(5)},
      stepS:0,splittingError:0,rejectedSteps:0,heatSolve:zero(),oxygenSolve:zero(),pressureSolve:zero(),nonlinearIterations:0,nonlinearError:0,chemistrySubsteps:0,peak:{temperatureK:state.temperature,node:0,timeS:0}}
    this.derive(this.frame)
  }
  private derive(f:Frame) {
    const m=this.mesh,s=this.settings,n=m.weights.length,weight=new Float64Array(n),rho=new Float64Array(n),K=new Float64Array(n)
    f.darcyFlux.fill(0)
    for(let i=0;i<n;i++){
      const p=properties(local(f,i),opts(s));f.pressure[i]=p.pressure;f.porosity[i]=p.porosity;f.oxygen[i]=f.gas[0][i]/p.gasMass;rho[i]=p.gasDensity;K[i]=p.permeability
    }
    // Volume-weighted projection of the genuine Q1 pressure gradient at each
    // element center. Diagnostics are constitutive flux at the accepted state;
    // integrated substep edge fluxes drive the conservative balance.
    const gradients=basis(0,0,0).gradients
    for(let e=0;e<m.n**3;e++) {
      const gradient=[0,0,0];let permeability=0,density=0
      for(let a=0;a<8;a++){const i=m.connectivity[8*e+a];permeability+=K[i]/8;density+=rho[i]/8;for(let d=0;d<3;d++)gradient[d]+=gradients[3*a+d]*2/m.h*f.pressure[i]}
      for(let a=0;a<8;a++){
        const i=m.connectivity[8*e+a];weight[i]++
        for(let d=0;d<3;d++)f.darcyFlux[3*i+d]+=-permeability/s.gasViscosityPaS*(gradient[d]+(d===2?density*s.gravityMS2:0))
      }
    }
    for(let i=0;i<n;i++){for(let d=0;d<3;d++)f.darcyFlux[3*i+d]/=weight[i];f.darcySpeed[i]=Math.hypot(...f.darcyFlux.subarray(3*i,3*i+3));const theta=properties(local(f,i),opts(s)).theta;f.peclet[i]=s.gasDiffusivityM2S>0?f.darcySpeed[i]*m.h/(theta*s.gasDiffusivityM2S):0}
  }
  private split(start:Frame,dt:number):Frame {
    const f=copy(start),s=this.settings,m=this.mesh,n=m.weights.length,Cbefore=new Float64Array(n),theta=new Float64Array(n),K=new Float64Array(n)
    const reference={peat:s.dryDensityKgM3,water:s.dryDensityKgM3*s.moistureRatio}
    for(let i=0;i<n;i++){
      const next=reactLocal(local(f,i),dt,reference,s.chemistry),w=m.weights[i]
      f.temperature[i]=next.state.temperature;solids(f).forEach((a,j)=>{a[i]=next.state.solid[j]});f.gas.forEach((a,j)=>{a[i]=next.state.gas[j]})
      f.ledger.reactionJ+=next.heatJ*w;f.chemistrySubsteps+=next.substeps
      next.extents.forEach((e,k)=>{f.ledger.reactionExtentsKg[k]+=e*w;f.ledger.oxygenUsedKg+=e*w*REACTIONS[k].oxygen;if(k===1||k===2)f.ledger.reactedPeatKg+=e*w;if(k>0)f.ledger.productGasKg+=e*w*(1+REACTIONS[k].oxygen-REACTIONS[k].yield)})
      const p=properties(next.state,opts(s));Cbefore[i]=p.heatCapacity;theta[i]=p.theta;K[i]=p.permeability
    }
    const flowOptions:FlowOptions={viscosity:s.gasViscosityPaS,diffusivity:s.gasDiffusivityM2S,ambientPressure:s.ambientPressurePa,ambientY:Float64Array.from([s.oxygenMassFraction,1-s.oxygenMassFraction,0,0]),transferKgM2S:s.transferKgM2S,gravity:s.gravityMS2,closed:s.closed,maxIterations:s.maxIterations,solveTolerance:s.solveTolerance}
    const initialTemperature=f.temperature.slice(),initialGas=f.gas.map(g=>g.slice())
    const Cafter=new Float64Array(n),conductivity=new Float64Array(n),robin=new Float64Array(n),rhs=new Float64Array(n)
    const ignitionDt=Math.max(0,Math.min(start.timeS+dt,s.ignitionS)-Math.min(start.timeS,s.ignitionS))
    const heatCp=CONSTITUENTS.gasCp
    let flow:FlowResult|undefined,thermalError=Infinity,thermalIterations=0
    // Iterate transport/enthalpy from the same reacted checkpoint. This closes
    // thermal expansion with pressure boundary values at the accepted time,
    // rather than resetting pressure independently after changing temperature.
    for(;thermalIterations<40;thermalIterations++) {
      const guess=f.temperature.slice()
      flow=gasStep(m,initialGas,guess,theta,K,dt,flowOptions)
      f.gas=flow.gas
      for(let i=0;i<n;i++){
        const p=properties(local(f,i),opts(s));Cafter[i]=p.heatCapacity;conductivity[i]=p.conductivity
        const radiation=s.closed?0:s.emissivity*5.670374419e-8*(guess[i]+s.ambientK)*(guess[i]**2+s.ambientK**2)
        robin[i]=s.closed?0:m.topArea[i]*(s.heatTransfer+radiation)
        rhs[i]=Cbefore[i]*(initialTemperature[i]-T_REF)*m.weights[i]+dt*robin[i]*(s.ambientK-T_REF)+s.ignitionW*ignitionDt*m.ignitionShape[i]
        if(flow.boundaryMassFlux[i]<0)rhs[i]-=dt*flow.boundaryMassFlux[i]*heatCp*(s.ambientK-T_REF)
      }
      const storage=Float64Array.from(Cafter,(v,i)=>v*m.weights[i]),diffusion=diffusionMatrix(m,conductivity)
      const heatMatrix=addDiagonal(upwindOperator(diffusion,flow.edgeList,flow.massFlux,flow.boundaryMassFlux,storage,dt,heatCp),Float64Array.from(robin,v=>dt*v))
      const solved=solveMonotone(heatMatrix,[rhs],[Float64Array.from(guess,T=>T-T_REF)],s.maxIterations??2000,s.solveTolerance??1e-10)
      f.temperature=Float64Array.from(solved.fields[0],v=>v+T_REF);f.heatSolve=solved.evidence
      thermalError=0;for(let i=0;i<n;i++)thermalError=Math.max(thermalError,Math.abs(f.temperature[i]-guess[i])/Math.max(1,f.temperature[i]))
      if(thermalError<1e-8)break
    }
    if(!flow||thermalError>=1e-8)throw new Error(`Thermal/pressure Picard failed: ${thermalError}`)
    f.pressureSolve=flow.pressureSolve;f.oxygenSolve=flow.speciesSolve;f.nonlinearIterations=flow.picardIterations+thermalIterations+1;f.nonlinearError=Math.max(flow.picardError,thermalError)
    f.ledger.ignitionJ+=s.ignitionW*ignitionDt
    for(let i=0;i<n;i++){
      f.ledger.heatOutJ+=dt*robin[i]*(f.temperature[i]-s.ambientK)
      f.ledger.gasEnthalpyOutJ+=dt*flow.boundaryMassFlux[i]*heatCp*((flow.boundaryMassFlux[i]>0?f.temperature[i]:s.ambientK)-T_REF)
      const total=f.gas.reduce((a,g)=>a+g[i],0)
      for(let j=0;j<4;j++){
        const Y=f.gas[j][i]/total,out=flow.boundaryMassFlux[i]*(flow.boundaryMassFlux[i]>0?Y:flowOptions.ambientY[j])+(s.closed?0:m.topArea[i]*s.transferKgM2S*(Y-flowOptions.ambientY[j]))
        f.ledger.gasBoundaryKg[j]+=dt*out
      }
    }
    f.ledger.oxygenInKg=-f.ledger.gasBoundaryKg[0]
    f.timeS+=dt;f.stepS=dt;this.derive(f)
    const t=totals(m,f);if(t.maximumK>f.peak.temperatureK)f.peak={temperatureK:t.maximumK,node:t.maximumNode,timeS:f.timeS}
    return f
  }
  advance(maxDt=this.settings.maxStepS,interventions:readonly ExternalExchange[]=EMPTY_INTERVENTIONS) {
    if(interventions.length)throw new Error('Suppression interventions remain disabled')
    if(this.status==='failed')throw new Error(this.error)
    const remaining=this.settings.endS-this.frame.timeS;if(remaining<1e-9)return this.snapshot()
    let dt=Math.min(maxDt,this.nextStepS,remaining),rejected=0,last=''
    if(!(dt>0))throw new Error('Invalid step')
    for(let attempt=0;attempt<24&&dt>=1e-7;attempt++)try {
      const full=this.split(this.frame,dt),half1=this.split(this.frame,dt/2),half=this.split(half1,dt/2);let error=0
      const scale=this.settings.toleranceScale??1
      for(let i=0;i<this.mesh.weights.length;i++){
        error=Math.max(error,Math.abs(half.temperature[i]-full.temperature[i])/(scale*(.1+.001*half.temperature[i])),Math.abs(half.pressure[i]-full.pressure[i])/(scale*(1+.0005*half.pressure[i])))
        for(const key of ['water','fuel','alphaChar','char','ash'] as const)error=Math.max(error,Math.abs(half[key][i]-full[key][i])/(scale*(1e-5+.002*this.settings.dryDensityKgM3)))
        for(let j=0;j<4;j++)error=Math.max(error,Math.abs(half.gas[j][i]-full.gas[j][i])/(scale*(1e-7+.001*half.gas.reduce((sum,g)=>sum+g[i],0))))
      }
      if(error>1){last=`split error ${error}`;rejected++;dt*=Math.max(.2,.8/Math.sqrt(error));continue}
      half.splittingError=error;half.stepS=dt;half.rejectedSteps=this.frame.rejectedSteps+rejected
      for(const key of ['heatSolve','oxygenSolve','pressureSolve'] as const)half[key]={iterations:half1[key].iterations+half[key].iterations,relativeResidual:Math.max(half1[key].relativeResidual,half[key].relativeResidual),absoluteResidual:Math.max(half1[key].absoluteResidual,half[key].absoluteResidual)}
      this.frame=half;this.nextStepS=Math.min(this.settings.maxStepS,dt*Math.min(2,Math.max(.5,.8/Math.sqrt(Math.max(error,1e-10)))));return this.snapshot()
    }catch(e){last=String(e);rejected++;dt*=.5}
    this.status='failed';this.error=`Solver stopped at ${this.frame.timeS.toFixed(6)} physical s: ${last}`;throw new Error(this.error)
  }
  snapshot(){return copy(this.frame)}
  restore(f:Frame) {
    if(!Number.isFinite(f.timeS)||f.timeS<0||f.timeS>this.settings.endS||!Number.isFinite(f.splittingError)||f.splittingError<0||!Number.isFinite(f.stepS)||f.stepS<0||f.peak.node<0||f.peak.node>=this.mesh.weights.length||f.peak.timeS>f.timeS)throw new Error('Invalid checkpoint metadata')
    const n=this.mesh.weights.length
    for(const a of [...solids(f),...f.gas,f.temperature])if(a.length!==n||[...a].some(v=>v<0||!Number.isFinite(v)))throw new Error('Invalid checkpoint field')
    for(let i=0;i<n;i++)properties(local(f,i),opts(this.settings))
    this.frame=copy(f);this.derive(this.frame);this.nextStepS=f.stepS>0?Math.min(this.settings.maxStepS,f.stepS*Math.min(2,Math.max(.5,.8/Math.sqrt(Math.max(f.splittingError,1e-10))))):this.settings.maxStepS;this.status='paused';this.error=''
  }
}
