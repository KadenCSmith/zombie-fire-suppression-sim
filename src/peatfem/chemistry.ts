/** C4 Irish-moss five-step column configuration, not a new fit or a TG parameter set. */
export const R = 8.31446261815324, T_REF = 300, SIGMA = 5.670374419e-8
export const SOLIDS = ['water', 'peat', 'alphaChar', 'betaChar', 'ash'] as const
export const GASES = ['oxygen', 'nitrogen', 'waterVapor', 'emissions'] as const
export const CONSTITUENTS = Object.freeze({
  density: [1000, 1500, 1300, 1300, 2500], // intrinsic kg/m³, C4 Table 2
  cp: [4186, 1840, 1260, 1260, 880], // J/(kg K), C4 Table 2
  conductivity: [.6, 1, .26, .26, 1.2], // W/(m K), C4 Table 2
  molecularKgMol: [.031998, .028014, .01801528, .02897],
  gasCp: 1000, // common-gas-cp approximation: explicit illustrative value, not measured
})
// Product pool MW=28.97 g/mol is a declared air-like surrogate. No CO/CO₂ yield claim.
export const REACTIONS = [
  { id: 'dr', reactant: 0, product: -1, log10A: 27, E: 200000, n: .5, nO: 0, yield: 0, oxygen: 0, enthalpy: 2.26e6 },
  { id: 'pp', reactant: 1, product: 2, log10A: 8.18, E: 112000, n: 5.31, nO: 0, yield: .28, oxygen: 0, enthalpy: .5e6 },
  { id: 'po', reactant: 1, product: 3, log10A: 16.8, E: 195000, n: 2.33, nO: .24, yield: .61, oxygen: .89, enthalpy: -11.6e6 },
  { id: 'bo', reactant: 3, product: 4, log10A: 8.38, E: 117000, n: 1.32, nO: .52, yield: .04, oxygen: 2.21, enthalpy: -28.9e6 },
  { id: 'ao', reactant: 2, product: 4, log10A: 13.3, E: 172000, n: 2.58, nO: .86, yield: .07, oxygen: 2.12, enthalpy: -27.8e6 },
] as const
export interface References { peat: number; water: number }
export interface LocalState { temperature: number; solid: Float64Array; gas: Float64Array }
export interface MaterialOptions { poreRadiationM: number; permeabilityM2: number }
export const DEFAULT_MATERIAL_OPTIONS: MaterialOptions = { poreRadiationM: .0005, permeabilityM2: 1e-12 }
export function properties(state: LocalState, options = DEFAULT_MATERIAL_OPTIONS) {
  let occupied = 0, liquid = 0, heatCapacity = 0, conduction = 0
  for (let j=0;j<5;j++) {
    const volume = state.solid[j]/CONSTITUENTS.density[j]
    occupied += volume; if (j===0) liquid=volume
    heatCapacity += state.solid[j]*CONSTITUENTS.cp[j]
    conduction += volume*CONSTITUENTS.conductivity[j]
  }
  const theta = 1-occupied, porosity = theta+liquid
  if (!(theta>0) || !(state.temperature>0) || [...state.solid,...state.gas].some(v=>v<0||!Number.isFinite(v))) throw new Error('Invalid fixed-volume material state')
  const gasMass=state.gas.reduce((a,b)=>a+b,0)
  let gasMoles=0
  for(let j=0;j<4;j++) {
    gasMoles+=state.gas[j]/CONSTITUENTS.molecularKgMol[j]
    heatCapacity+=state.gas[j]*(CONSTITUENTS.gasCp-R/CONSTITUENTS.molecularKgMol[j])
  }
  if (!(gasMass>0) || !(heatCapacity>0)) throw new Error('Empty gas/thermal storage')
  const gasR=R*gasMoles/gasMass, pressure=R*state.temperature*gasMoles/theta
  // Fixed geometry; liquid occupies pores. The cubic gas-connectivity closure is
  // an explicit synthetic assumption, not a measured hot-char permeability law.
  const permeability=options.permeabilityM2*(theta/porosity)**3
  const conductivity=conduction+theta*.026+options.poreRadiationM*theta*SIGMA*state.temperature**3
  return {theta,porosity,heatCapacity,conductivity,permeability,gasMass,gasR,pressure,gasDensity:gasMass/theta}
}
export function energy(state:LocalState) { return properties(state).heatCapacity*(state.temperature-T_REF) }
export function totalMass(state:LocalState) { return [...state.solid,...state.gas].reduce((a,b)=>a+b,0) }
export function localInitial(peat:number,moistureRatio:number,temperature=300,pressure=101325,oxygenMassFraction=.233):LocalState {
  if (!(peat>0)||moistureRatio<0||!(pressure>0)||oxygenMassFraction<0||oxygenMassFraction>1) throw new Error('Invalid initial inventories')
  const solid=Float64Array.from([peat*moistureRatio,peat,0,0,0]),theta=1-solid[0]/1000-peat/1500
  const gasR=R*(oxygenMassFraction/.031998+(1-oxygenMassFraction)/.028014)
  const mass=pressure*theta/(gasR*temperature)
  const out={temperature,solid,gas:Float64Array.from([mass*oxygenMassFraction,mass*(1-oxygenMassFraction),0,0])};properties(out);return out
}
export function reactionRates(state:LocalState,reference:References) {
  const mass=state.gas.reduce((a,b)=>a+b,0),Y=state.gas[0]/mass
  return Float64Array.from(REACTIONS,r=>{
    const normalization=r.reactant===0?reference.water:reference.peat
    if(normalization===0||state.solid[r.reactant]===0||(r.oxygen>0&&Y===0)) return 0
    const oxygen=r.oxygen>0?Math.expm1(r.nO*Math.log1p(Y)):1
    return normalization*Math.exp(r.log10A*Math.LN10-r.E/(R*state.temperature))*(state.solid[r.reactant]/normalization)**r.n*oxygen
  })
}
/** Accepted extents drive every mass and heat source. No post-hoc state clipping. */
export function reactLocal(start:LocalState,dt:number,reference:References,enabled=true) {
  const state={temperature:start.temperature,solid:start.solid.slice(),gas:start.gas.slice()}
  const extents=new Float64Array(5);let heatJ=0,elapsed=0,substeps=0
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid chemistry interval')
  if(!enabled)return {state,extents,heatJ,substeps}
  while(elapsed<dt) {
    if(++substeps>10000)throw new Error('Chemistry substep limit: refine outer step')
    const rates=reactionRates(state,reference),C=properties(state).heatCapacity
    const oxygenRate=REACTIONS.reduce((sum,r,k)=>sum+r.oxygen*rates[k],0)
    const heatRate=REACTIONS.reduce((sum,r,k)=>sum-r.enthalpy*rates[k],0)
    let h=dt-elapsed
    const limits=[[state.solid[1],rates[1]+rates[2]],[state.solid[2],rates[4]],[state.solid[3],rates[3]]]
    for(const [inventory,rate] of limits)if(rate>0)h=Math.min(h,.2*inventory/rate)
    if(Math.abs(heatRate)>0)h=Math.min(h,3*C/Math.abs(heatRate))
    if(!(h>0)||!Number.isFinite(h)||elapsed+h===elapsed)throw new Error('Chemistry failed to progress')
    const extent=Float64Array.from(rates,v=>v*h)
    // Exponential inventory integration treats the stiff, nearly linear oxygen
    // factor implicitly at frozen temperature/reactants. All oxidative extents
    // share this one factor, so heat, ash and gas use the same oxygen budget.
    if(oxygenRate>0){const ratio=oxygenRate*h/state.gas[0],factor=-Math.expm1(-ratio)/ratio;for(let k=2;k<5;k++)extent[k]*=factor}
    // Exact frozen-temperature n=1/2 drying integral, including the depletion event.
    if(rates[0]>0){const root=Math.sqrt(state.solid[0]),next=root-rates[0]/root*h/2;extent[0]=next<=0?state.solid[0]:state.solid[0]-next*next}
    // One constrained extent vector for shared peat and oxygen; usually inactive
    // because the substep consumption bound is stricter than the inventory bound.
    let fraction=1
    if(extent[1]+extent[2]>state.solid[1])fraction=Math.min(fraction,state.solid[1]/(extent[1]+extent[2]))
    const usedO=REACTIONS.reduce((sum,r,k)=>sum+r.oxygen*extent[k],0)
    if(usedO>state.gas[0])fraction=Math.min(fraction,state.gas[0]/usedO)
    const U=energy(state);let Q=0
    for(let k=0;k<5;k++) {
      const r=REACTIONS[k],e=extent[k]*fraction;extents[k]+=e
      state.solid[r.reactant]-=e;if(r.product>=0)state.solid[r.product]+=r.yield*e
      state.gas[0]-=r.oxygen*e
      state.gas[k===0?2:3]+=(1+r.oxygen-r.yield)*e
      Q-=r.enthalpy*e
    }
    state.temperature=T_REF+(U+Q)/properties(state).heatCapacity
    properties(state);heatJ+=Q;elapsed+=h
  }
  return {state,extents,heatJ,substeps}
}
