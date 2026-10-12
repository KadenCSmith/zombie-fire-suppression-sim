import { CoupledTransport, coupledScenario, DEFAULT_COUPLED, type CoupledFrame } from '../../coupled/model'
import { MOLAR, T0, saturationPressure } from '../../coupled/thermodynamics'
import { fireSequencePose } from '../../story/fireSequence'

export interface FieldSettings {
  enabled: boolean; waterKg: number; flowKgS: number; inletK: number; endS: number; stepS: number
}
export const FIELD_DEFAULTS: FieldSettings = { enabled: true, waterKg: .5, flowKgS: .025, inletK: 293.15, endS: 60, stepS: .125 }
export interface FieldNumerics { nx:number; ny:number; nz:number; supportCells:number }
export interface FieldState {
  timeS: number; frame: CoupledFrame; grid: { nx: number; ny: number; nz: number }
  deliveredKg: number; remainingKg: number; inletEnergyJ: number; liquidFlowWorkJ: number
  massResidualKg: number; energyResidualJ: number; waterSpeciesResidualKg: number
  rawMassResidualKg: number; rawEnergyResidualJ: number; rawSpeciesResidualMol: number[]
  maximumK: number; oxygenKg: number; reactedFuelKg: number; reactionW: number
  sourceDepthM: number; addedWaterKg: Float64Array; initialLiquidKg: Float32Array
}

/** Prescribed delivery into an owned reacting grid; not a hydraulic or drilling solve.
 * The existing transport/phase/reaction implementation is imported unchanged.
 * Its ledger excludes this external liquid source; this adapter closes that
 * open-system balance explicitly instead of resetting its initial baseline. */
export class VibratoryFieldRun {
  readonly settings: FieldSettings
  readonly sim: CoupledTransport
  private deliveredKg = 0
  private inletEnergyJ = 0
  private liquidFlowWorkJ = 0
  private reactionW = 0
  private initialFuelKg: number
  private initialLiquidKg: Float32Array
  private addedWaterKg: Float64Array
  private depthM = 0
  private readonly supportCells: number
  private readonly tipEvents: number[]
  constructor(settings: Partial<FieldSettings> = {}, numerics:Partial<FieldNumerics> = {}) {
    this.settings = { ...FIELD_DEFAULTS, ...settings }
    const s = this.settings
    if (![s.waterKg,s.flowKgS,s.inletK,s.endS,s.stepS].every(Number.isFinite)
      || s.waterKg < 0 || s.waterKg > 5 || s.flowKgS < 0 || s.flowKgS > .1
      || s.inletK < 273.15 || s.inletK > 333.15 || s.endS <= 0 || s.endS > 120
      || s.stepS <= 0 || s.stepS > .25) throw new Error('Liquid field settings outside the declared experimental range.')
    const grid={nx:16,ny:8,nz:10,supportCells:1,...numerics}
    if(![grid.nx,grid.ny,grid.nz].every(v=>Number.isInteger(v)&&v>=4&&v<=32)||grid.nx*grid.ny*grid.nz>20480||![1,2].includes(grid.supportCells))
      throw new Error('Unsupported private field resolution or source support.')
    this.supportCells=grid.supportCells
    const scenario = coupledScenario({ ...DEFAULT_COUPLED, fidelity: 'preview', dryIceKg: 0, heaterW: 0,
      reaction: true, mechanics: false, fracture: false, cap: false, roots: false })
    Object.assign(scenario.domain, { nx:grid.nx, ny:grid.ny, nz:grid.nz })
    // Schema requires a >=.1 s ceiling; the owned driver can request smaller steps.
    scenario.model.maxStepS = Math.max(.1,s.stepS)
    scenario.name = '4.2.4 prescribed-liquid reacting peat field'
    scenario.description = 'Assumed hot peat initial condition; continuous finite liquid deposition. No liquid transport or vibration mechanics.'
    // Project the existing fixed material atlas conservatively so coarse grids
    // retain the same prepared fuel, water and thermal inventories.
    this.sim = new CoupledTransport(scenario,true)
    this.initialFuelKg = this.sim.fuel.reduce((a,b) => a+b,0)
    this.initialLiquidKg = this.sim.frame().liquidKg
    this.addedWaterKg = new Float64Array(this.sim.n)
    // Split at traversed cell faces and interpolation-support boundaries.
    this.tipEvents=[14]
    for(let k=1;k<2*grid.nz;k++) {
      const depth=k*this.sim.dz/2
      if(depth>=fireSequencePose(31,'gradual').drillDepth)break
      let lo=0,hi=14
      for(let n=0;n<45;n++){const mid=(lo+hi)/2;if(fireSequencePose(24+mid/2,'gradual').drillDepth<depth)lo=mid;else hi=mid}
      this.tipEvents.push((lo+hi)/2)
    }
    this.tipEvents.sort((a,b)=>a-b)
  }
  private weights(timeS: number) {
    // Prescribed access depth, not computed penetration. Surface entry at x=.4 m.
    this.depthM = fireSequencePose(24+Math.min(7,timeS/2),'gradual').drillDepth
    const sim = this.sim, d = sim.scenario.domain
    const f = [4.4/sim.dx-.5, 4/sim.dy-.5, Math.max(sim.dz/2,this.depthM)/sim.dz-.5]
    const points: { i:number; w:number }[] = []
    const r=this.supportCells
    for(let z=Math.floor(f[2])-r+1;z<=Math.floor(f[2])+r;z++)for(let y=Math.floor(f[1])-r+1;y<=Math.floor(f[1])+r;y++)for(let x=Math.floor(f[0])-r+1;x<=Math.floor(f[0])+r;x++) {
      const w=Math.max(0,1-Math.abs(x-f[0])/r)*Math.max(0,1-Math.abs(y-f[1])/r)*Math.max(0,1-Math.abs(z-f[2])/r)
      if(x>=0&&x<d.nx&&y>=0&&y<d.ny&&z>=0&&z<d.nz&&w>0)points.push({i:(z*d.ny+y)*d.nx+x,w})
    }
    const total=points.reduce((a,b)=>a+b.w,0)
    return points.map(p=>({i:p.i,w:p.w/total}))
  }
  private step(dt: number) {
    const sim=this.sim, saved=sim.checkpoint(), oldDepth=this.depthM
    const old={delivered:this.deliveredKg,energy:this.inletEnergyJ,work:this.liquidFlowWorkJ,added:this.addedWaterKg.slice(),reaction:this.reactionW}
    try {
      const reactionJ=sim.ledger.reactionJ
      const accepted=sim.step(dt)
      this.reactionW=(sim.ledger.reactionJ-reactionJ)/accepted
      const mass=this.settings.enabled?Math.min(Math.max(0,this.settings.waterKg-this.deliveredKg),this.settings.flowKgS*accepted):0
      const points=this.weights(sim.time-accepted/2)
      for(const p of points) {
        if(mass>0&&(!Number.isFinite(sim.pressure[p.i])||sim.pressure[p.i]<saturationPressure(this.settings.inletK)))
          throw new Error('Pure-liquid inlet is invalid at the assumed local interface pressure.')
        const dm=mass*p.w, work=dm*sim.pressure[p.i]/1000
        const enthalpy=dm*4186*(this.settings.inletK-T0)+work
        sim.water[p.i]+=dm; sim.energy[p.i]+=enthalpy
        this.addedWaterKg[p.i]+=dm; this.inletEnergyJ+=enthalpy; this.liquidFlowWorkJ+=work
      }
      this.deliveredKg+=mass
      sim.resolve(); sim.updateLedger()
      if(points.some(p=>!Number.isFinite(sim.water[p.i])||sim.water[p.i]<0||!Number.isFinite(sim.gasVolume[p.i])||sim.gasVolume[p.i]<=1e-6*sim.volume))
        throw new Error('Liquid source requires finite inventory and available gas pore space.')
      const massResidual=sim.ledger.massResidualKg-this.deliveredKg
      const energyResidual=sim.ledger.energyResidualJ-this.inletEnergyJ
      const species=sim.ledger.speciesResidualMol[3]*MOLAR[3]-this.deliveredKg
      if(![massResidual,energyResidual,species].every(Number.isFinite)||Math.abs(massResidual)>1e-7||Math.abs(energyResidual)>1e-4||Math.abs(species)>1e-7)
        throw new Error('Liquid-source conservation acceptance threshold exceeded.')
    } catch(error) {
      sim.restore(saved); this.depthM=oldDepth; this.deliveredKg=old.delivered; this.inletEnergyJ=old.energy
      this.liquidFlowWorkJ=old.work; this.addedWaterKg=old.added; this.reactionW=old.reaction
      throw error
    }
  }
  advanceTo(targetS: number): FieldState {
    if(!Number.isFinite(targetS)||targetS<this.sim.time-1e-9||targetS>this.settings.endS+1e-9)throw new Error('Invalid accepted physical time.')
    while(this.sim.time<targetS-1e-9) {
      const toBoundary=this.settings.stepS-(this.sim.time%this.settings.stepS)
      const untilEmpty=this.settings.enabled&&this.settings.flowKgS>0?(this.settings.waterKg-this.deliveredKg)/this.settings.flowKgS:Infinity
      const nextTip=this.tipEvents.find(t=>t>this.sim.time+1e-9)
      this.step(Math.min(targetS-this.sim.time,toBoundary>1e-9?toBoundary:this.settings.stepS,untilEmpty>1e-9?untilEmpty:Infinity,nextTip===undefined?Infinity:nextTip-this.sim.time))
    }
    return this.snapshot()
  }
  snapshot(): FieldState {
    const sim=this.sim
    return {timeS:sim.time,frame:sim.frame(),grid:{nx:sim.scenario.domain.nx,ny:sim.scenario.domain.ny,nz:sim.scenario.domain.nz},
      deliveredKg:this.deliveredKg,remainingKg:Math.max(0,this.settings.waterKg-this.deliveredKg),inletEnergyJ:this.inletEnergyJ,
      liquidFlowWorkJ:this.liquidFlowWorkJ,massResidualKg:sim.ledger.massResidualKg-this.deliveredKg,
      rawMassResidualKg:sim.ledger.massResidualKg,rawEnergyResidualJ:sim.ledger.energyResidualJ,rawSpeciesResidualMol:[...sim.ledger.speciesResidualMol],
      energyResidualJ:sim.ledger.energyResidualJ-this.inletEnergyJ,waterSpeciesResidualKg:sim.ledger.speciesResidualMol[3]*MOLAR[3]-this.deliveredKg,
      maximumK:Math.max(...sim.temperature),oxygenKg:sim.gas[0].reduce((a,b)=>a+b,0)*MOLAR[0],
      reactedFuelKg:this.initialFuelKg-sim.fuel.reduce((a,b)=>a+b,0),reactionW:this.reactionW,sourceDepthM:this.depthM,
      addedWaterKg:this.addedWaterKg.slice(),initialLiquidKg:this.initialLiquidKg.slice()}
  }
}
