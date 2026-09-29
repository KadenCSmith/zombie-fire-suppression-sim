import {CapShell,DEFAULT_CAP,type CapState} from './cap'
import type {Scenario} from '../sim/types'
import {CoupledTransport,coupledScenario,type CoupledInputs,type CoupledFrame} from './model'
import {PoroMechanics,type MechanicalState} from './mechanics'
/** One grid and SI state. Mechanical Picard trials restore histories before every trial. */
export class CoupledEngine {
  readonly transport:CoupledTransport;readonly mechanics:PoroMechanics|null;readonly referencePressure:Float64Array;readonly cap:CapShell|null;capState:CapState|null=null
  mechanical:MechanicalState|null=null;couplingIterations=0;mechanicalBalanceJ=0;referenceBoundaryWorkJ=0
  constructor(readonly inputs:CoupledInputs,scenario?:Scenario){
    this.transport=new CoupledTransport(scenario??coupledScenario(inputs),!scenario&&inputs.initialization!=='legacy');const t=this.transport,d=t.scenario.domain
    this.referencePressure=t.pressure.slice()
    this.cap=inputs.cap?new CapShell(d.nx,d.ny,d.nz,d.widthM,d.lengthM,t.scenario.source.centerXM,t.scenario.source.centerYM,{...DEFAULT_CAP,radiusM:inputs.capRadiusM,riseM:inputs.capRiseM,thicknessM:inputs.capThicknessM}):null
    if(this.cap)this.capState=this.cap.evaluate(new Float64Array(t.n)).state
    if(this.cap)for(const f of t.faces)if(f.b<0&&f.axis===2){f.capFraction=Math.min(1,this.cap.covered[f.a]/f.area);f.ventRadius=this.cap.parameters.radiusM}
    this.mechanics=inputs.mechanics?new PoroMechanics(d.nx,d.ny,d.nz,d.widthM,d.lengthM,d.depthM,Array.from({length:t.n},(_,i)=>({
      youngsPa:inputs.youngsPa*(10-9*t.peat[i]),poisson:0.25,densityKgM3:(t.fuel[i]+t.mineral[i]+t.water[i])/t.volume,biot:0.8,fractureEnergyJm2:inputs.fractureEnergyJm2*(4-3*t.peat[i])
    })),inputs.lengthScaleM,inputs.roots&&(inputs.terrain===undefined||inputs.terrain==='rooted-peat'),this.cap?.preload(),inputs.mechanicalBackend??'reference'):null
  }
  step(requested:number){
    const t=this.transport,m=this.mechanics,before=t.checkpoint(),oldPressure=t.pressure.slice(),oldPore=t.pore.slice()
    const u=m?.u.slice(),d=m?.damage.slice(),h=m?.history.slice(),previous=this.mechanical
    const step=t.step(requested);if(!m)return step
    const flowed=t.checkpoint();let guessed=t.pressure.slice()
    try{
      for(let iteration=0;iteration<30;iteration++){
        m.u.set(u!);m.damage.set(d!);m.history.set(h!)
        const gauge=Float64Array.from(guessed,(v,i)=>v-this.referencePressure[i]),capLoad=this.cap?.evaluate(gauge)
        const state=m.solve(gauge,this.inputs.fracture,0,capLoad?.force),cap=this.cap?.evaluate(gauge,state.u)
        const nextPore=Float64Array.from(t.porosity0,(phi,i)=>phi*t.volume+0.8*t.volume*(state.strain[6*i]+state.strain[6*i+1]+state.strain[6*i+2]))
        if(cap)for(let i=0;i<t.n;i++)nextPore[i]+=cap.volume[i]
        t.restore(flowed);t.setPoreVolumes(nextPore,oldPressure)
        let error=0;for(let i=0;i<t.n;i++)error=Math.max(error,Math.abs(t.pressure[i]-guessed[i]));this.couplingIterations++
        if(error<1e-4){
          this.mechanical=state
          let gaugeWork=0,referenceWork=0
          for(let i=0;i<t.n;i++){const dv=nextPore[i]-oldPore[i];gaugeWork+=0.5*(oldPressure[i]+t.pressure[i]-2*this.referencePressure[i])*dv;referenceWork+=this.referencePressure[i]*dv}
          const mismatch=gaugeWork-(state.elasticJ-(previous?.elasticJ??0))-(state.fractureJ-(previous?.fractureJ??0))-((cap?.state.energyJ??0)-(this.capState?.energyJ??0))
          if(this.inputs.fracture&&Math.abs(mismatch)>Math.max(1e-5,1e-3*Math.abs(gaugeWork)))throw new Error(`Coupled fracture energy increment mismatch ${mismatch.toExponential(3)} J exceeds the 0.1% / 10 µJ gate. Dynamic fracture or smaller load increments required.`)
          this.referenceBoundaryWorkJ+=referenceWork
          this.mechanicalBalanceJ+=mismatch
          this.capState=cap?.state??null
          if(this.capState)for(const face of t.faces)if(face.b<0&&face.axis===2)face.ventGap=this.capState.gapM
          // Cubic-law crack mobility requires a resolved aperture; no damage-only multiplier.
          return step
        }
        for(let i=0;i<t.n;i++)guessed[i]=t.pressure[i]
      }
      throw new Error('Two-way pressure/displacement coupling did not converge to 1e-4 Pa.')
    }catch(error){t.restore(before);m.u.set(u!);m.damage.set(d!);m.history.set(h!);this.mechanical=previous;throw error}
  }
  frame():CoupledFrame{
    const frame=this.transport.frame(),s=this.mechanical
    if(this.capState)frame.cap={...this.capState}
    if(s){frame.damage=Float32Array.from(s.damage);frame.displacementM=Float32Array.from(s.u);frame.mechanical={elasticJ:s.elasticJ,fractureJ:s.fractureJ,residualN:s.residualN,maxStrain:s.maxStrain,iterations:s.iterations,maxDamage:s.maxDamage,pressureWorkJ:s.pressureWorkJ}}
    return frame
  }
  advance(seconds:number){const end=this.transport.time+seconds;while(this.transport.time<end-1e-9)this.step(end-this.transport.time);return this.frame()}
}
