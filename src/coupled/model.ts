import type {CapState} from './cap'
import { Simulation } from '../sim/solver'
import { createDefaultScenario } from '../sim/scenario'
import type { Scenario } from '../sim/types'
import { pcg } from './linear'
import { R,T0,MOLAR,gasU,gasH,co2SolidU,CO2_SUB_T,CO2_SUB_H,CO2_SOLID_CP,equilibrate,saturationPressure,LF } from './thermodynamics'

export type Fidelity = 'preview'|'engineering'|'research'
export const PRESETS = {preview:{nx:8,ny:8,nz:4,maxStepS:2},engineering:{nx:12,ny:12,nz:6,maxStepS:1},research:{nx:16,ny:16,nz:8,maxStepS:0.5}} as const
export interface CoupledInputs {fidelity:Fidelity;durationS:number;dryIceKg:number;heaterW:number;moisture:number;permeabilityM2:number;reaction:boolean;mechanics:boolean;fracture:boolean;roots:boolean;cap:boolean;capRadiusM:number;capRiseM:number;capThicknessM:number;youngsPa:number;fractureEnergyJm2:number;lengthScaleM:number}
export const DEFAULT_COUPLED:CoupledInputs={fidelity:'preview',durationS:120,dryIceKg:4,heaterW:0,moisture:0.2,permeabilityM2:8e-12,reaction:true,mechanics:true,fracture:false,roots:true,cap:true,capRadiusM:0.475,capRiseM:0.1,capThicknessM:0.005,youngsPa:1e6,fractureEnergyJm2:5,lengthScaleM:1}
export function coupledScenario(input:CoupledInputs):Scenario {
  const s=createDefaultScenario(),p=PRESETS[input.fidelity]
  s.name='Coupled oak-site continuum';s.domain={widthM:8,lengthM:8,depthM:3.2,nx:p.nx,ny:p.ny,nz:p.nz}
  s.soilLayers[1].thicknessM=2.4
  Object.assign(s.peatRegions[0],{shape:'ellipsoid',centerXM:4,centerYM:4,centerDepthM:1.9,sizeXM:7,sizeYM:7,thicknessM:1.8,organicFraction:0.9,bulkDensityKgM3:180,moistureSaturation:input.moisture})
  Object.assign(s.hotRegions[0],{centerXM:3,centerYM:4,centerDepthM:1.9,sizeXM:2.4,sizeYM:2.4,thicknessM:1.2})
  Object.assign(s.source,{centerXM:4.4,centerYM:4,centerDepthM:1.3,initialMassKg:input.dryIceKg,enabled:input.heaterW>0,heatGenerationWm3:input.heaterW/(4/3*Math.PI*s.source.supportRadiusM**3)})
  s.soil.intrinsicPermeabilityVerticalM2=input.permeabilityM2;s.soil.intrinsicPermeabilityHorizontalM2=3*input.permeabilityM2
  s.model.maxStepS=p.maxStepS;if(!input.reaction)s.model.smolderRateS=0
  return s
}
export interface Face {a:number;b:number;axis:number;area:number;distance:number;g:number;diff:number;thermal:number;gravity:number;capFraction:number;ventGap:number;ventRadius:number}
export interface Ledger {energyResidualJ:number;massResidualKg:number;speciesResidualMol:number[];boundaryEnergyOutJ:number;heaterJ:number;pressureWorkJ:number;gravityWorkJ:number;reactionJ:number;boundaryMassOutKg:number;maxPoreRe:number;maxMach:number;pressureResidualMol:number;steps:number;rejectedSteps:number}
export interface CoupledFrame {timeS:number;temperatureK:Float32Array;pressurePa:Float32Array;oxygen:Float32Array;co2:Float32Array;iceKg:Float32Array;liquidKg:Float32Array;fuelKg:Float32Array;porosity:Float32Array;damage:Float32Array;displacementM:Float32Array;dryIceKg:number;dryIceTemperatureK:number;ledger:Ledger;cap?:CapState;mechanical?:{elasticJ:number;fractureJ:number;residualN:number;maxStrain:number;iterations:number;maxDamage:number;pressureWorkJ:number}}
const harmonic=(a:number,b:number)=>a+b>0?2*a*b/(a+b):0
const sum=(v:ArrayLike<number>)=>{let s=0;for(let i=0;i<v.length;i++)s+=v[i];return s}
const FUEL_MOLAR=6*MOLAR[1]+5*MOLAR[3]-6*MOLAR[0]
export class CoupledTransport {
  readonly scenario:Scenario;gasGravityMS2=9.80665;readonly n:number;readonly volume:number;readonly dx:number;readonly dy:number;readonly dz:number
  readonly gas:Float64Array[];readonly water:Float64Array;readonly fuel:Float64Array;readonly mineral:Float64Array;readonly solidCp:Float64Array;readonly energy:Float64Array
  readonly temperature:Float64Array;readonly pressure:Float64Array;readonly liquid:Float64Array;readonly ice:Float64Array;readonly gasVolume:Float64Array
  readonly porosity0:Float64Array;readonly pore:Float64Array;readonly kh:Float64Array;readonly kv:Float64Array;readonly conductivity:Float64Array;readonly peat:Float64Array
  readonly faces:Face[]=[];readonly sourceWeights:{i:number;w:number}[]=[]
  time=0;dryIce:number;dryIceT:number;ledger:Ledger={energyResidualJ:0,massResidualKg:0,speciesResidualMol:[0,0,0,0],boundaryEnergyOutJ:0,heaterJ:0,pressureWorkJ:0,gravityWorkJ:0,reactionJ:0,boundaryMassOutKg:0,maxPoreRe:0,maxMach:0,pressureResidualMol:0,steps:0,rejectedSteps:0}
  private initialEnergy=0;private initialMass=0;private initialSpecies:number[]=[];private boundarySpecies=[0,0,0,0];private sources=[0,0,0,0]
  constructor(scenario:Scenario) {
    this.scenario=structuredClone(scenario);const original=new Simulation(scenario,{phaseStateOwnedExternally:true}),a=original.serialize().arrays
    this.n=original.cellCount;this.volume=original.cellVolume;this.dx=original.dx;this.dy=original.dy;this.dz=original.dz
    const take=(key:string)=>Float64Array.from(a[key]),zero=()=>new Float64Array(this.n)
    this.gas=['oxygen','co2','background','vapor'].map(take);this.water=take('water');this.fuel=take('fuel');this.mineral=take('mineral');this.solidCp=take('solidHeatCapacity')
    this.energy=zero();this.temperature=take('temperature');this.pressure=zero();this.liquid=zero();this.ice=zero();this.gasVolume=zero()
    this.porosity0=take('porosity');this.pore=Float64Array.from(this.porosity0,v=>v*this.volume);this.kh=take('intrinsicH');this.kv=take('intrinsicV');this.conductivity=take('thermalConductivity');this.peat=take('peatMask')
    this.dryIce=scenario.source.initialMassKg;this.dryIceT=scenario.source.initialTemperatureK
    const s=scenario.source,grid=scenario.domain
    // Trilinear physical support, fixed in space as the finite sphere shrinks.
    const fx=s.centerXM/this.dx-0.5,fy=s.centerYM/this.dy-0.5,fz=s.centerDepthM/this.dz-0.5
    for(let z=Math.floor(fz);z<=Math.floor(fz)+1;z++)for(let y=Math.floor(fy);y<=Math.floor(fy)+1;y++)for(let x=Math.floor(fx);x<=Math.floor(fx)+1;x++){
      const w=(1-Math.abs(fx-x))*(1-Math.abs(fy-y))*(1-Math.abs(fz-z));if(x>=0&&x<grid.nx&&y>=0&&y<grid.ny&&z>=0&&z<grid.nz&&w>0)this.sourceWeights.push({i:(z*grid.ny+y)*grid.nx+x,w})
    }
    const weights=this.sourceWeights.reduce((v,p)=>v+p.w,0);for(const p of this.sourceWeights)p.w/=weights
    for(let i=0;i<this.n;i++){
      // Prepared initial hot region is dry; superheated liquid at atmospheric pressure is not a realizable initial state.
      const t=this.temperature[i];if(t>373.15)this.water[i]=0
      const volume=this.availablePore(i)-this.water[i]/(t<T0?917:1000),pa=scenario.atmosphere.pressurePa
      const vaporPressure=this.water[i]>0?Math.min(pa*0.95,saturationPressure(t)):scenario.atmosphere.waterVaporMoleFraction*pa
      const dryTotal=this.gas[0][i]+this.gas[1][i]+this.gas[2][i]
      for(let species=0;species<3;species++)this.gas[species][i]=(pa-vaporPressure)*volume/(R*t)*this.gas[species][i]/dryTotal
      this.gas[3][i]=vaporPressure*volume/(R*t)
      this.energy[i]=this.dryCapacity(i)*(t-T0)+this.water[i]*(t<T0?2100*(t-T0)-LF:4186*(t-T0))
      for(let s=0;s<4;s++)this.energy[i]+=this.gas[s][i]*gasU(s,t)
      this.water[i]+=this.gas[3][i]*MOLAR[3]
    }
    this.resolve();this.buildFaces();this.initialEnergy=sum(this.energy)+this.dryIce*co2SolidU(this.dryIceT);this.initialMass=this.totalMass();this.initialSpecies=this.speciesTotals()
  }
  private dryCapacity(i:number){return(this.fuel[i]+this.mineral[i])*this.solidCp[i]}
  private availablePore(i:number){let v=this.pore[i];for(const p of this.sourceWeights)if(p.i===i)v-=p.w*this.dryIce/this.scenario.source.densityKgM3;return v}
  resolve(){
    const gas=[0,0,0]
    for(let i=0;i<this.n;i++){
      for(let s=0;s<3;s++)gas[s]=this.gas[s][i]
      const phase=equilibrate(this.energy[i],this.water[i],this.availablePore(i),this.dryCapacity(i),gas)
      if(!(phase.gasVolume>1e-6*this.volume))throw new Error('Gas pore space exhausted: liquid flow/ice heave required.')
      this.temperature[i]=phase.temperature;this.liquid[i]=phase.liquid;this.ice[i]=phase.ice;this.gas[3][i]=phase.vapor/MOLAR[3];this.gasVolume[i]=phase.gasVolume
      this.pressure[i]=this.totalGas(i)*R*phase.temperature/phase.gasVolume
      if(!Number.isFinite(this.pressure[i])||this.pressure[i]<1000||this.pressure[i]>3e5)throw new Error('Pore pressure outside 1–300 kPa ideal-gas/Darcy scope.')
    }
  }
  totalGas(i:number){return this.gas[0][i]+this.gas[1][i]+this.gas[2][i]+this.gas[3][i]}
  totalEnergy(){return sum(this.energy)+this.dryIce*co2SolidU(this.dryIceT)+sum(this.fuel)*this.scenario.model.heatOfCombustionJkg}
  totalMass(){let m=sum(this.water)+sum(this.fuel)+sum(this.mineral)+this.dryIce;for(let s=0;s<3;s++)m+=sum(this.gas[s])*MOLAR[s];return m}
  private speciesTotals(){return[sum(this.gas[0]),sum(this.gas[1]),sum(this.gas[2]),sum(this.water)/MOLAR[3]]}
  private buildFaces(){
    const d=this.scenario.domain,atm=this.scenario.atmosphere
    const add=(a:number,b:number,axis:number,area:number,distance:number)=>this.faces.push({a,b,axis,area,distance,g:0,diff:0,gravity:0,capFraction:0,ventGap:0,ventRadius:0,thermal:b<0?0:harmonic(this.conductivity[a],this.conductivity[b])*area/distance})
    for(let z=0;z<d.nz;z++)for(let y=0;y<d.ny;y++)for(let x=0;x<d.nx;x++){
      const i=(z*d.ny+y)*d.nx+x
      if(x+1<d.nx)add(i,i+1,0,this.dy*this.dz,this.dx)
      if(y+1<d.ny)add(i,i+d.nx,1,this.dx*this.dz,this.dy)
      if(z+1<d.nz)add(i,i+d.nx*d.ny,2,this.dx*this.dy,this.dz)
      if(z===0&&atm.topGasBoundary==='atmospheric')add(i,-1,2,this.dx*this.dy,this.dz/2)
      if(atm.sideGasBoundary==='atmospheric'){
        if(x===0)add(i,-1,0,this.dy*this.dz,this.dx/2);if(x===d.nx-1)add(i,-1,0,this.dy*this.dz,this.dx/2)
        if(y===0)add(i,-1,1,this.dx*this.dz,this.dy/2);if(y===d.ny-1)add(i,-1,1,this.dx*this.dz,this.dy/2)
      }
    }
  }
  private heatAndSource(dt:number){
    const d=this.scenario.domain,atm=this.scenario.atmosphere,t=this.temperature
    const delta=new Float64Array(this.n)
    for(const f of this.faces)if(f.b>=0){const q=f.thermal*(t[f.b]-t[f.a])*dt;delta[f.a]+=q;delta[f.b]-=q}
    for(let i=0;i<d.nx*d.ny;i++){
      const bottom=i+(d.nz-1)*d.nx*d.ny
      const q=atm.surfaceHeatTransferWm2K*this.dx*this.dy*(atm.temperatureC+T0-t[i])*dt
      const qb=atm.bottomHeatTransferWm2K*this.dx*this.dy*(atm.deepTemperatureC+T0-t[bottom])*dt
      delta[i]+=q;delta[bottom]+=qb;this.ledger.boundaryEnergyOutJ-=q+qb
    }
    const s=this.scenario.source,heater=s.enabled&&this.time>=s.startTimeS&&this.time<s.startTimeS+s.durationS?s.heatGenerationWm3*4/3*Math.PI*s.supportRadiusM**3*dt:0
    this.ledger.heaterJ+=heater
    if(this.dryIce>0){
      const radius=Math.cbrt(3*this.dryIce/(4*Math.PI*s.densityKgM3)),area=4*Math.PI*radius*radius
      let q=heater,p=0
      for(const w of this.sourceWeights){const heat=s.contactConductanceWm2K*area*w.w*(t[w.i]-this.dryIceT)*dt;delta[w.i]-=heat;q+=heat;p+=w.w*this.pressure[w.i]}
      // Clausius–Clapeyron solid/vapor curve with constant latent enthalpy.
      const ts=1/(1/CO2_SUB_T-R/(CO2_SUB_H*MOLAR[1])*Math.log(p/101325))
      if(ts>=216.58)throw new Error('CO₂ triple-point limit: a liquid CO₂ equation of state is required.')
      const sensible=this.dryIce*CO2_SOLID_CP*(ts-this.dryIceT)
      if(q<=sensible){this.dryIceT+=q/(this.dryIce*CO2_SOLID_CP)}else{
        const oldU=this.dryIce*co2SolidU(this.dryIceT),latentU=gasU(1,ts)/MOLAR[1]-co2SolidU(ts)
        const mass=Math.min(this.dryIce,(q-sensible)/latentU);this.dryIce-=mass;this.dryIceT=ts
        const excess=oldU+q-this.dryIce*co2SolidU(ts)-mass*gasU(1,ts)/MOLAR[1]
        for(const w of this.sourceWeights){this.gas[1][w.i]+=mass*w.w/MOLAR[1];delta[w.i]+=w.w*(mass*gasU(1,ts)/MOLAR[1]+excess)}
        this.sources[1]+=mass/MOLAR[1]
      }
    }else for(const w of this.sourceWeights)delta[w.i]+=heater*w.w
    const m=this.scenario.model
    for(let i=0;i<this.n;i++){
      if(t[i]>m.minimumReactionTemperatureK&&this.fuel[i]>0&&m.smolderRateS>0){
        const oxygen=this.gas[0][i]/this.totalGas(i),moisture=(this.liquid[i]+this.ice[i])/Math.max(1e-20,this.fuel[i]+this.mineral[i])
        const rate=m.smolderRateS*Math.exp(-m.activationEnergyJMol/R*(1/t[i]-1/m.referenceTemperatureK))*oxygen/(oxygen+m.oxygenHalfSaturation)*Math.exp(-moisture)
        const mass=Math.min(this.fuel[i]*(1-Math.exp(-rate*dt)),this.gas[0][i]*FUEL_MOLAR/6)
        if(mass>0.05*Math.max(1e-30,this.fuel[i]))throw new Error('retry: reaction timestep')
        const mol=mass/FUEL_MOLAR;this.fuel[i]-=mass;this.gas[0][i]-=6*mol;this.gas[1][i]+=6*mol;this.water[i]+=5*mol*MOLAR[3]
        this.sources[0]-=6*mol;this.sources[1]+=6*mol;this.sources[3]+=5*mol
        delta[i]+=mass*m.heatOfCombustionJkg;this.ledger.reactionJ+=mass*m.heatOfCombustionJkg
      }
      this.energy[i]+=delta[i]
    }
  }
  private flow(dt:number){
    const atm=this.scenario.atmosphere,ta=atm.temperatureC+T0,pa=atm.pressurePa,n=this.n,mu=1.8e-5
    const capacity=Float64Array.from(this.gasVolume,(v,i)=>v/(R*this.temperature[i])),rhs=Float64Array.from(capacity,(c,i)=>this.totalGas(i)-c*pa)
    const baseRhs=rhs.slice(),gauge=Float64Array.from(this.pressure,v=>v-pa),diagonal=new Float64Array(n)
    const mobility=(i:number,axis:number)=>{const phi=this.pore[i]/this.volume,phi0=this.porosity0[i],kc=(phi/phi0)**3*((1-phi0)/(1-phi))**2;return(axis===2?this.kv[i]:this.kh[i])*kc*(this.gasVolume[i]/this.pore[i])**3}
    // Nonlinear compressible molar mobility, Picard iterated at fixed thermal state.
    for(let iteration=0;iteration<16;iteration++){
      diagonal.set(capacity);rhs.set(baseRhs)
      for(const f of this.faces){const b=f.b,k=f.b<0?mobility(f.a,f.axis):harmonic(mobility(f.a,f.axis),mobility(b,f.axis)),temp=b<0?(this.temperature[f.a]+ta)/2:(this.temperature[f.a]+this.temperature[b])/2
        const pbar=(gauge[f.a]+pa+(b<0?pa:gauge[b]+pa))/2
        f.g=k/mu*f.area/f.distance*pbar/(R*temp)*(1-f.capFraction)
        if(b<0&&f.ventGap>0){const ventArea=f.capFraction*f.area,share=ventArea/(Math.PI*f.ventRadius**2),slot=2*Math.PI*f.ventRadius*f.ventGap,coefficient=slot*f.ventGap**2/(12*mu*0.02)*share*pbar/(R*temp),velocity=coefficient*Math.abs(gauge[f.a])*R*temp/pbar/Math.max(1e-30,slot*share),re=pbar/(R*temp)*0.029*velocity*2*f.ventGap/mu
          if(re>1000||velocity/Math.sqrt(1.4*R*temp/0.029)>0.05)throw new Error('Cap vent exceeded laminar-slot Reynolds/Mach limits.')
          f.g+=coefficient}
        const molarMass=(i:number)=>this.gas.reduce((sum,v,s)=>sum+v[i]*MOLAR[s],0)/this.totalGas(i)
        const mass=b<0?molarMass(f.a):0.5*(molarMass(f.a)+molarMass(b))
        f.gravity=f.axis===2?pbar/(R*temp)*mass*this.gasGravityMS2*f.distance*(b<0?-1:1):0
        rhs[f.a]-=dt*f.g*f.gravity;if(b>=0)rhs[b]+=dt*f.g*f.gravity
        const diff=this.scenario.soil.gasDiffusivityM2S/this.scenario.soil.tortuosity*Math.min(this.gasVolume[f.a],b<0?this.gasVolume[f.a]:this.gasVolume[b])/this.volume
        f.diff=(b<0?atm.exchangeVelocityMS:diff/f.distance)*f.area*pbar/(R*temp)*(1-f.capFraction)
        diagonal[f.a]+=dt*f.g;if(b>=0)diagonal[b]+=dt*f.g
      }
      const old=gauge.slice()
      const result=pcg((x,y)=>{for(let i=0;i<n;i++)y[i]=capacity[i]*x[i];for(const f of this.faces){const q=dt*f.g*(x[f.a]-(f.b<0?0:x[f.b]));y[f.a]+=q;if(f.b>=0)y[f.b]-=q}},rhs,diagonal,gauge,1e-10)
      this.ledger.pressureResidualMol=result.residual
      let diff=0;for(let i=0;i<n;i++)diff=Math.max(diff,Math.abs(gauge[i]-old[i]))
      if(diff<1e-5)break;if(iteration===15)throw new Error('retry: nonlinear pressure convergence')
    }
    const transfers=this.gas.map(()=>new Float64Array(n)),energy=new Float64Array(n),outgoing=this.gas.map(()=>new Float64Array(n))
    const fractions=[atm.oxygenMoleFraction,atm.co2MoleFraction,1-atm.oxygenMoleFraction-atm.co2MoleFraction-atm.waterVaporMoleFraction,atm.waterVaporMoleFraction]
    for(const f of this.faces){
      const a=f.a,b=f.b,flow=f.g*(gauge[a]-(b<0?0:gauge[b])+f.gravity),totalA=this.totalGas(a),totalB=b<0?1:this.totalGas(b)
      const rho=(pa+gauge[a])/(R*this.temperature[a])*0.029,u=Math.abs(flow)*R*this.temperature[a]/(pa+gauge[a])/f.area
      const poreRadius=Math.sqrt(8*Math.max(this.kh[a],this.kv[a])/this.porosity0[a]),re=rho*u/Math.max(0.01,this.gasVolume[a]/this.volume)*poreRadius/mu,mach=u/Math.sqrt(1.4*R*this.temperature[a]/0.029)
      this.ledger.maxPoreRe=Math.max(this.ledger.maxPoreRe,re);this.ledger.maxMach=Math.max(this.ledger.maxMach,mach)
      if(re>1||mach>0.05)throw new Error('Darcy regime exceeded (Re > 1 or Mach > 0.05): inertial flow model required.')
      for(let s=0;s<4;s++){
        const xa=this.gas[s][a]/totalA,xb=b<0?fractions[s]:this.gas[s][b]/totalB
        const transfer=dt*(flow*(flow>=0?xa:xb)+f.diff*(xa-xb))
        const upstreamT=transfer>=0?this.temperature[a]:b<0?ta:this.temperature[b],heat=transfer*gasH(s,upstreamT)
        const gravitational=transfer*MOLAR[s]*this.gasGravityMS2*(f.axis===2?f.distance*(b<0?-1:1):0)
        this.ledger.gravityWorkJ+=gravitational;energy[a]+=gravitational*(b<0?1:0.5);if(b>=0)energy[b]+=gravitational*0.5
        transfers[s][a]-=transfer;energy[a]-=heat;if(transfer>0)outgoing[s][a]+=transfer
        if(b>=0){transfers[s][b]+=transfer;energy[b]+=heat;if(transfer<0)outgoing[s][b]-=transfer}
        else{this.boundarySpecies[s]+=transfer;this.ledger.boundaryMassOutKg+=transfer*MOLAR[s];this.ledger.boundaryEnergyOutJ+=heat}
      }
    }
    for(let i=0;i<n;i++){
      for(let s=0;s<4;s++){if(outgoing[s][i]>0.2*Math.max(1e-25,this.gas[s][i]))throw new Error('retry: species turnover timestep');if(s<3)this.gas[s][i]+=transfers[s][i];else this.water[i]+=transfers[s][i]*MOLAR[s]}
      this.energy[i]+=energy[i]
    }
  }
  /** Work-conjugate gas pressure/pore-volume exchange. Mechanics supplies accepted pore volumes. */
  setPoreVolumes(next:Float64Array, previousPressure:Float64Array=this.pressure){
    for(let i=0;i<this.n;i++){
      if(next[i]<=0||next[i]>=0.99*this.volume)throw new Error('Pore volume left supported small-strain range.')
      const delta=next[i]-this.pore[i],oldEnergy=this.energy[i],gas=[this.gas[0][i],this.gas[1][i],this.gas[2][i]]
      let p=this.pressure[i],work=0
      this.pore[i]=next[i]
      for(let iter=0;iter<30;iter++){
        work=0.5*(previousPressure[i]+p)*delta
        const phase=equilibrate(oldEnergy-work,this.water[i],this.availablePore(i),this.dryCapacity(i),gas)
        const nextPressure=(gas[0]+gas[1]+gas[2]+phase.vapor/MOLAR[3])*R*phase.temperature/phase.gasVolume
        if(Math.abs(nextPressure-p)<1e-7){p=nextPressure;break}p=nextPressure
        if(iter===29)throw new Error('Pressure-work iteration failed.')
      }
      this.energy[i]=oldEnergy-work;this.ledger.pressureWorkJ+=work

    }
    this.resolve();this.updateLedger()
  }
  checkpoint(){return{arrays:this.arrays().map(a=>a.slice()),ledger:structuredClone(this.ledger),boundary:this.boundarySpecies.slice(),sources:this.sources.slice(),time:this.time,dryIce:this.dryIce,dryIceT:this.dryIceT}}
  restore(checkpoint:ReturnType<CoupledTransport['checkpoint']>){this.arrays().forEach((a,i)=>a.set(checkpoint.arrays[i]));this.ledger=structuredClone(checkpoint.ledger);this.boundarySpecies=checkpoint.boundary.slice();this.sources=checkpoint.sources.slice();this.time=checkpoint.time;this.dryIce=checkpoint.dryIce;this.dryIceT=checkpoint.dryIceT;this.resolve()}
  private arrays(){return[...this.gas,this.water,this.fuel,this.energy,this.pore]}
  step(requested:number){
    if(!Number.isFinite(requested)||requested<=0)throw new Error('Positive finite timestep required.')
    const arrays=this.arrays(),saved=arrays.map(a=>a.slice()),ledger=structuredClone(this.ledger),boundary=this.boundarySpecies.slice(),sources=this.sources.slice(),mass=this.dryIce,temp=this.dryIceT
    let dt=Math.min(requested,this.scenario.model.maxStepS)
    const losses=new Float64Array(this.n),grid=this.scenario.domain
    for(const f of this.faces)if(f.b>=0){losses[f.a]+=f.thermal;losses[f.b]+=f.thermal}
    for(let i=0;i<grid.nx*grid.ny;i++){losses[i]+=this.scenario.atmosphere.surfaceHeatTransferWm2K*this.dx*this.dy;losses[i+(grid.nz-1)*grid.nx*grid.ny]+=this.scenario.atmosphere.bottomHeatTransferWm2K*this.dx*this.dy}
    for(let i=0;i<this.n;i++)if(losses[i]>0)dt=Math.min(dt,0.5*this.dryCapacity(i)/losses[i])
    const source=this.scenario.source
    for(const end of[source.startTimeS,source.startTimeS+source.durationS])if(end>this.time)dt=Math.min(dt,end-this.time)
    for(let attempt=0;attempt<24;attempt++){
      if(attempt){arrays.forEach((a,i)=>a.set(saved[i]));this.ledger={...structuredClone(ledger),rejectedSteps:ledger.rejectedSteps+attempt};this.boundarySpecies=boundary.slice();this.sources=sources.slice();this.dryIce=mass;this.dryIceT=temp;this.resolve()}
      try{this.heatAndSource(dt);this.resolve();this.flow(dt);this.resolve();this.time+=dt;this.ledger.steps++;this.updateLedger();return dt}
      catch(error){if(!(error instanceof Error)||!error.message.startsWith('retry:')||attempt===23){arrays.forEach((a,i)=>a.set(saved[i]));this.ledger=ledger;this.boundarySpecies=boundary;this.sources=sources;this.dryIce=mass;this.dryIceT=temp;this.resolve();throw error}dt/=2}
    }
    throw new Error('Adaptive timestep exhausted.')
  }
  advance(seconds:number){const target=this.time+seconds;while(this.time<target-1e-9)this.step(target-this.time);return this.frame()}
  sealInitialState(){
    if(this.time!==0)throw new Error('Initial conditions can only be sealed at t = 0.')
    this.resolve();this.initialEnergy=sum(this.energy)+this.dryIce*co2SolidU(this.dryIceT);this.initialMass=this.totalMass();this.initialSpecies=this.speciesTotals();this.updateLedger()
  }
  updateLedger(){
    this.ledger.energyResidualJ=sum(this.energy)+this.dryIce*co2SolidU(this.dryIceT)+this.ledger.boundaryEnergyOutJ+this.ledger.pressureWorkJ-this.ledger.heaterJ-this.ledger.reactionJ-this.ledger.gravityWorkJ-this.initialEnergy
    this.ledger.massResidualKg=this.totalMass()+this.ledger.boundaryMassOutKg-this.initialMass
    const totals=this.speciesTotals();this.ledger.speciesResidualMol=totals.map((v,s)=>v+this.boundarySpecies[s]-this.sources[s]-this.initialSpecies[s])
  }
  frame():CoupledFrame{return{timeS:this.time,temperatureK:Float32Array.from(this.temperature),pressurePa:Float32Array.from(this.pressure),oxygen:Float32Array.from(this.gas[0],(v,i)=>v/this.totalGas(i)),co2:Float32Array.from(this.gas[1],(v,i)=>v/this.totalGas(i)),iceKg:Float32Array.from(this.ice),liquidKg:Float32Array.from(this.liquid),fuelKg:Float32Array.from(this.fuel),porosity:Float32Array.from(this.pore,v=>v/this.volume),damage:new Float32Array(this.n),displacementM:new Float32Array((this.scenario.domain.nx+1)*(this.scenario.domain.ny+1)*(this.scenario.domain.nz+1)*3),dryIceKg:this.dryIce,dryIceTemperatureK:this.dryIceT,ledger:structuredClone(this.ledger)}}
}
