import type {Scenario} from '../sim/types'
import {CoupledTransport,coupledScenario,type CoupledInputs,type CoupledFrame} from './model'
import {PoroMechanics,type MechanicalState} from './mechanics'
/** One grid and SI state. Mechanical Picard trials restore histories before every trial. */
export class CoupledEngine {
  readonly transport:CoupledTransport;readonly mechanics:PoroMechanics|null;readonly referencePressure:Float64Array
  mechanical:MechanicalState|null=null;couplingIterations=0;mechanicalBalanceJ=0;referenceBoundaryWorkJ=0
  constructor(readonly inputs:CoupledInputs,scenario?:Scenario){
    this.transport=new CoupledTransport(scenario??coupledScenario(inputs));const t=this.transport,d=t.scenario.domain
    this.referencePressure=t.pressure.slice()
    this.mechanics=inputs.mechanics?new PoroMechanics(d.nx,d.ny,d.nz,d.widthM,d.lengthM,d.depthM,Array.from({length:t.n},(_,i)=>({
      youngsPa:inputs.youngsPa*(t.peat[i]?1:10),poisson:0.25,densityKgM3:(t.fuel[i]+t.mineral[i]+t.water[i])/t.volume,biot:0.8,fractureEnergyJm2:inputs.fractureEnergyJm2*(t.peat[i]?1:4)
    })),inputs.lengthScaleM,inputs.roots):null
  }
  step(requested:number){
    const t=this.transport,m=this.mechanics,before=t.checkpoint(),oldPressure=t.pressure.slice(),oldPore=t.pore.slice()
    const u=m?.u.slice(),d=m?.damage.slice(),h=m?.history.slice(),previous=this.mechanical
    const step=t.step(requested);if(!m)return step
    const flowed=t.checkpoint();let guessed=t.pressure.slice()
    try{
      for(let iteration=0;iteration<30;iteration++){
        m.u.set(u!);m.damage.set(d!);m.history.set(h!)
        const state=m.solve(Float64Array.from(guessed,(v,i)=>v-this.referencePressure[i]),this.inputs.fracture)
        const nextPore=Float64Array.from(t.porosity0,(phi,i)=>phi*t.volume+0.8*t.volume*(state.strain[6*i]+state.strain[6*i+1]+state.strain[6*i+2]))
        t.restore(flowed);t.setPoreVolumes(nextPore,oldPressure)
        let error=0;for(let i=0;i<t.n;i++)error=Math.max(error,Math.abs(t.pressure[i]-guessed[i]));this.couplingIterations++
        if(error<1e-4){
          this.mechanical=state
          let gaugeWork=0,referenceWork=0
          for(let i=0;i<t.n;i++){const dv=nextPore[i]-oldPore[i];gaugeWork+=0.5*(oldPressure[i]+t.pressure[i]-2*this.referencePressure[i])*dv;referenceWork+=this.referencePressure[i]*dv}
          this.referenceBoundaryWorkJ+=referenceWork
          this.mechanicalBalanceJ+=gaugeWork-(state.elasticJ-(previous?.elasticJ??0))-(state.fractureJ-(previous?.fractureJ??0))
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
    if(s){frame.damage=Float32Array.from(s.damage);frame.displacementM=Float32Array.from(s.u);frame.mechanical={elasticJ:s.elasticJ,fractureJ:s.fractureJ,residualN:s.residualN,maxStrain:s.maxStrain,iterations:s.iterations,maxDamage:s.maxDamage,pressureWorkJ:s.pressureWorkJ}}
    return frame
  }
  advance(seconds:number){const end=this.transport.time+seconds;while(this.transport.time<end-1e-9)this.step(end-this.transport.time);return this.frame()}
}
