import { R } from '../../coupled/thermodynamics'
import {
  GAS_IDS, SPECIES_IDS, speciesIndex, inspectChemistryCell, exchangeCellInventory,
  speciesEnthalpyJkg, ChemistryStepRejected,
  type ChemistryModel, type ChemistryCellState,
} from './chemistry'

export interface GasTransportInput {
  /** All five pure-species viscosities at the evaluated face state, Pa s. */
  readonly pureViscosityPaS: readonly number[]
  /** Symmetric molecular binary D_ij at face T,p, m^2/s; zero diagonal. */
  readonly binaryDiffusionM2S: readonly (readonly number[])[]
  readonly meanFreePathM: number
  readonly minTemperatureK: number
  readonly maxTemperatureK: number
  readonly minPressurePa: number
  readonly maxPressurePa: number
  readonly maxMach: number
  readonly maxKnudsen: number
  readonly maxPoreReynolds: number
  readonly thermalDiffusion: 'neglected-explicitly'
  readonly evidence: string
}
export interface GasFace {
  readonly a: number
  readonly b: number
  readonly areaM2: number
  readonly distanceM: number
  /** Effective gas-phase Darcy permeability, after relative-permeability correction. */
  readonly permeabilityM2: number
  readonly gasPorosity: number
  readonly poreDiameterM: number
  /** E.g. connected gas fraction / tortuosity; explicit and not applied twice to D. */
  readonly diffusionScale: number
  /** Total separately supplied face heat conductance, W/K; do not also apply legacy conduction. */
  readonly heatConductanceWK: number
}
function bounded(x: number, lo: number, hi: number, name: string): void {
  if (!Number.isFinite(x) || x < lo || x > hi) throw new Error(`gas ${name}: outside [${lo},${hi}]`)
}
function positive(x: number, name: string): void {
  if (!Number.isFinite(x) || x <= 0) throw new Error(`gas ${name}: positive required`)
}
function checkedProperties(p: GasTransportInput): void {
  if (!p || p.pureViscosityPaS.length !== 5 || p.binaryDiffusionM2S.length !== 5) throw new Error('gas property dimensions')
  for (let i=0;i<5;i++) {
    positive(p.pureViscosityPaS[i], 'pure viscosity')
    if (p.binaryDiffusionM2S[i].length !== 5) throw new Error('gas diffusion dimensions')
    for (let j=0;j<5;j++) {
      const d=p.binaryDiffusionM2S[i][j]
      if (i===j ? d!==0 : !Number.isFinite(d) || d<=0 || d!==p.binaryDiffusionM2S[j]?.[i]) throw new Error('gas binary diffusion symmetry/positivity')
    }
  }
  bounded(p.meanFreePathM,0,1,'mean free path')
  bounded(p.minTemperatureK,150,1200,'min T'); bounded(p.maxTemperatureK,p.minTemperatureK,1200,'max T')
  bounded(p.minPressurePa,1000,300000,'min p'); bounded(p.maxPressurePa,p.minPressurePa,300000,'max p')
  positive(p.maxMach,'max Mach'); bounded(p.maxMach,0,0.1,'max Mach')
  positive(p.maxKnudsen,'max Kn'); bounded(p.maxKnudsen,0,0.01,'max Kn')
  positive(p.maxPoreReynolds,'max Re'); bounded(p.maxPoreReynolds,0,1,'max Re')
  if (p.thermalDiffusion!=='neglected-explicitly' || typeof p.evidence!=='string' || !p.evidence.trim()) throw new Error('explicit transport model/evidence required')
}
function composition(x: readonly number[]): void {
  if (x.length!==5) throw new Error('five gas fractions required')
  x.forEach(v=>bounded(v,0,1,'mole fraction'))
  if (Math.abs(x.reduce((a,b)=>a+b,0)-1)>1e-12) throw new Error('gas mole fractions must sum to one')
}
function masses(model: ChemistryModel): number[] {
  return GAS_IDS.map(id=>model.registry[id].molarMassKgMol!)
}
/** Wilke dilute-gas mixture rule; coefficients must already correspond to face T. */
export function mixtureViscosityPaS(
  moleFractions: readonly number[], molarMassesKgMol: readonly number[], pureViscosityPaS: readonly number[],
): number {
  composition(moleFractions)
  if (molarMassesKgMol.length!==5 || pureViscosityPaS.length!==5) throw new Error('Wilke input dimensions')
  molarMassesKgMol.forEach(v=>positive(v,'molar mass'));pureViscosityPaS.forEach(v=>positive(v,'viscosity'))
  const mu=moleFractions.reduce((total,xi,i)=>{
    if (xi===0) return total
    const denominator=moleFractions.reduce((s,xj,j)=>{
      const phi=(1+Math.sqrt(pureViscosityPaS[i]/pureViscosityPaS[j])*(molarMassesKgMol[j]/molarMassesKgMol[i])**0.25)**2
        /Math.sqrt(8*(1+molarMassesKgMol[i]/molarMassesKgMol[j]))
      return s+xj*phi
    },0)
    return total+xi*pureViscosityPaS[i]/denominator
  },0)
  positive(mu,'mixture viscosity');return mu
}
export function gasMixtureState(model: ChemistryModel, state: ChemistryCellState): {
  temperatureK:number; pressurePa:number; densityKgM3:number; moleFractions:number[];
  molarConcentrationMolM3:number; meanMolarMassKgMol:number; soundSpeedMS:number
} {
  const t=inspectChemistryCell(model,state), molarMass=masses(model)
  const n=GAS_IDS.map((id,i)=>state.massKg[speciesIndex(id)]/molarMass[i])
  const total=n.reduce((a,b)=>a+b,0), x=n.map(v=>v/total)
  const mean=x.reduce((s,v,i)=>s+v*molarMass[i],0)
  const cv=x.reduce((s,v,i)=>s+v*molarMass[i]*model.caloric.species[GAS_IDS[i]].cvJkgK,0)/mean
  return {temperatureK:t.temperatureK,pressurePa:t.totalPressurePa,
    densityKgM3:total*mean/t.gasVolumeM3,moleFractions:x,
    molarConcentrationMolM3:total/t.gasVolumeM3,meanMolarMassKgMol:mean,
    soundSpeedMS:Math.sqrt((1+R/(mean*cv))*R*t.temperatureK/mean)}
}
/** Logarithmic mean with the correct nonnegative trace limit. */
function logMean(a:number,b:number):number {
  if(a===b)return a
  if(a===0 || b===0)return 0
  const d=(b-a)/a
  return Math.abs(d)<1e-4 ? (b-a)/Math.log1p(d) : (b-a)/(Math.log(b)-Math.log(a))
}
/** Pivoted 5x5 solve; singular systems reject rather than yield NaN. */
function solve(a:number[][], rhs:number[]):number[] {
  const n=rhs.length, matrix=a.map((r,i)=>[...r,rhs[i]])
  for(let col=0;col<n;col++){
    let pivot=col
    for(let row=col+1;row<n;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row
    if(!(Math.abs(matrix[pivot][col])>1e-25))throw new Error('singular Maxwell-Stefan matrix')
    ;[matrix[pivot],matrix[col]]=[matrix[col],matrix[pivot]]
    const v=matrix[col][col]
    for(let j=col;j<=n;j++)matrix[col][j]/=v
    for(let row=0;row<n;row++)if(row!==col){
      const f=matrix[row][col]
      for(let j=col;j<=n;j++)matrix[row][j]-=f*matrix[col][j]
    }
  }
  const result=matrix.map(r=>r[n])
  if(result.some(v=>!Number.isFinite(v)))throw new Error('Maxwell-Stefan overflow')
  return result
}
/**
 * Solve sum_j (x_j*J_i-x_i*J_j)/D_ij = -c*d_i
 * with mass-average constraint sum_i M_i J_i=0.
 * d_i is 1/m and must sum to zero. J_i is mol/(m^2 s).
 */
export function maxwellStefanFlux(
  x:readonly number[], m:readonly number[], binaryD:readonly (readonly number[])[],
  concentrationMolM3:number, driving:readonly number[],
):Float64Array {
  composition(x);positive(concentrationMolM3,'concentration')
  if(m.length!==5 || driving.length!==5 || binaryD.length!==5)throw new Error('MS dimensions')
  m.forEach(v=>positive(v,'molar mass'))
  const mag=driving.reduce((s,v)=>s+Math.abs(v),0)
  if(driving.some(v=>!Number.isFinite(v)) || Math.abs(driving.reduce((a,b)=>a+b,0))>1e-12*(1+mag))throw new Error('MS driving must sum to zero')
  binaryD.forEach((row,i)=>{
    if(row.length!==5 || row[i]!==0)throw new Error('MS binary D shape/diagonal')
    row.forEach((d,j)=>{
      if(i!==j && (!(d>0) || !Number.isFinite(d) || d!==binaryD[j]?.[i]))throw new Error('MS D symmetry')
    })
  })
  const rows=x.map((xi,i)=>x.map((_,j)=>
    i===j ? x.reduce((s,xk,k)=>s+(k===i?0:xk/binaryD[i][k]),0) : -xi/binaryD[i][j]
  ))
  const originalRows=rows.map(row=>row.slice())
  const rhs=driving.map(d=>-concentrationMolM3*d)
  let replaced=0
  for(let i=1;i<5;i++)if(x[i]>x[replaced])replaced=i
  rows[replaced]=m.map(mi=>mi/m[replaced]);rhs[replaced]=0
  const flux=Float64Array.from(solve(rows,rhs))
  const residual=flux.reduce((s,v,i)=>s+v*m[i],0)
  if(Math.abs(residual)>1e-12*(1+flux.reduce((s,v,i)=>s+Math.abs(v*m[i]),0)))throw new Error('MS mass frame closure')
  for(let i=0;i<5;i++){
    const terms=originalRows[i].map((coefficient,j)=>coefficient*flux[j])
    const target=-concentrationMolM3*driving[i],actual=terms.reduce((a,b)=>a+b,0)
    const scale=Math.abs(target)+terms.reduce((a,b)=>a+Math.abs(b),0)
    if(Math.abs(actual-target)>1e-10*(1+scale))throw new Error('MS equation residual')
  }
  return flux
}
export interface GasFaceFlux {
  readonly speciesMolPerS:Float64Array
  readonly enthalpyW:number
  readonly conductiveHeatW:number
  readonly darcyVelocityMS:number
  readonly diffusiveMolPerM2S:Float64Array
  readonly mach:number
  readonly knudsen:number
  readonly poreReynolds:number
}
/** Finite-volume gas flux; one explicit frozen face evaluation, positive a->b. */
export function gasFaceFlux(
  model:ChemistryModel, stateA:ChemistryCellState, stateB:ChemistryCellState,
  depthA:number, depthB:number, gravityMS2:number, face:GasFace, property:GasTransportInput,
):GasFaceFlux {
  checkedProperties(property)
  for(const v of [depthA,depthB])bounded(v,-1e6,1e6,'depth')
  bounded(gravityMS2,0,100,'g');positive(face.distanceM,'distance')
  bounded(face.areaM2,0,1e12,'area');bounded(face.permeabilityM2,0,1,'permeability')
  positive(face.gasPorosity,'gas porosity');bounded(face.gasPorosity,0,1,'gas porosity')
  positive(face.poreDiameterM,'pore diameter');bounded(face.diffusionScale,0,1,'diffusion scale')
  bounded(face.heatConductanceWK,0,1e15,'heat conductance')
  if(Math.abs(depthB-depthA)>face.distanceM*(1+1e-12))throw new Error('gas face geometry')
  const a=gasMixtureState(model,stateA),b=gasMixtureState(model,stateB)
  for(const s of [a,b]){
    bounded(s.temperatureK,property.minTemperatureK,property.maxTemperatureK,'property T')
    bounded(s.pressurePa,property.minPressurePa,property.maxPressurePa,'property p')
  }
  const m=masses(model),t=(a.temperatureK+b.temperatureK)/2,p=(a.pressurePa+b.pressurePa)/2
  const partialA=a.moleFractions.map(x=>x*a.pressurePa),partialB=b.moleFractions.map(x=>x*b.pressurePa)
  const x=partialA.map((v,i)=>(v+partialB[i])/(2*p)), mean=x.reduce((s,v,i)=>s+v*m[i],0)
  const y=x.map((v,i)=>v*m[i]/mean), mu=mixtureViscosityPaS(x,m,property.pureViscosityPaS)
  // Log means well-balance exact isothermal partial-pressure barometric profiles.
  const rhoGravity=partialA.reduce((s,v,i)=>s+m[i]*logMean(v,partialB[i])/(R*t),0)
  const driveP=(b.pressurePa-a.pressurePa-rhoGravity*gravityMS2*(depthB-depthA))/face.distanceM
  const velocity=-face.permeabilityM2/mu*driveP, poreSpeed=Math.abs(velocity)/face.gasPorosity
  const mach=poreSpeed/Math.min(a.soundSpeedMS,b.soundSpeedMS)
  const knudsen=property.meanFreePathM/face.poreDiameterM
  const poreReynolds=Math.max(a.densityKgM3,b.densityKgM3)*poreSpeed*face.poreDiameterM/mu
  if(!Number.isFinite(velocity) || mach>property.maxMach || knudsen>property.maxKnudsen || poreReynolds>property.maxPoreReynolds){
    throw new ChemistryStepRejected('gas low-Mach/continuum/Darcy applicability guard')
  }
  const raw=partialA.map((v,i)=>(partialB[i]-v-m[i]*gravityMS2*(depthB-depthA)*logMean(v,partialB[i])/(R*t))/(p*face.distanceM))
  const rawSum=raw.reduce((s,v)=>s+v,0), driving=raw.map((v,i)=>v-y[i]*rawSum)
  const diffusion=face.diffusionScale===0 ? new Float64Array(5) :
    Float64Array.from(maxwellStefanFlux(x,m,property.binaryDiffusionM2S,p/(R*t),driving),v=>v*face.diffusionScale)
  const donor=velocity>=0?a:b
  const speciesMolPerS=Float64Array.from(x,(_,i)=>face.areaM2*
    (velocity*donor.molarConcentrationMolM3*donor.moleFractions[i]+diffusion[i]))
  const enthalpyW=speciesMolPerS.reduce((s,rate,i)=>s+rate*m[i]*speciesEnthalpyJkg(model,GAS_IDS[i],
    rate>=0?a.temperatureK:b.temperatureK,rate>=0?a.pressurePa:b.pressurePa),0)
  const conductiveHeatW=face.heatConductanceWK*(a.temperatureK-b.temperatureK)
  if(!Number.isFinite(enthalpyW) || speciesMolPerS.some(v=>!Number.isFinite(v)))throw new Error('gas flux overflow')
  return {speciesMolPerS,enthalpyW,conductiveHeatW,darcyVelocityMS:velocity,
    diffusiveMolPerM2S:diffusion,mach,knudsen,poreReynolds}
}
/** Exact isothermal binary Stefan film with stagnant species B; A flow positive left->right. */
export function stefanBinaryFilmMolPerM2S(
  concentrationMolM3:number,diffusionM2S:number,lengthM:number,xAleft:number,xAright:number,
):number {
  positive(concentrationMolM3,'Stefan concentration');bounded(diffusionM2S,0,1,'Stefan D');positive(lengthM,'Stefan length')
  bounded(xAleft,0,1,'Stefan xleft');bounded(xAright,0,1,'Stefan xright')
  if(xAleft===1 || xAright===1)throw new Error('pure-species endpoint has no finite stagnant-carrier film')
  return concentrationMolM3*diffusionM2S/lengthM*(Math.log1p(-xAright)-Math.log1p(-xAleft))
}
export interface GasColumnTrial {
  readonly next:readonly ChemistryCellState[]
  readonly physicalDurationS:number
  readonly faceFluxes:readonly GasFaceFlux[]
  readonly speciesResidualMol:Float64Array
  readonly energyResidualJ:number
}
/** All faces use the same pretrial states; shared outgoing budgets precede any returned update. */
export function trialGasColumn(
  model:ChemistryModel,input:readonly ChemistryCellState[],depths:readonly number[],
  faces:readonly GasFace[],properties:readonly GasTransportInput[],dtS:number,gravityMS2:number,
):GasColumnTrial {
  bounded(dtS,0,1e6,'dt');bounded(gravityMS2,0,100,'g')
  if(!input.length || input.length!==depths.length || faces.length!==properties.length)throw new Error('gas column lengths')
  input.forEach((s,i)=>{bounded(depths[i],-1e6,1e6,'depth');inspectChemistryCell(model,s);if(s.timeS!==input[0].timeS)throw new Error('gas clocks differ')})
  const delta=input.map(()=>new Float64Array(SPECIES_IDS.length)), outgoing=input.map(()=>new Float64Array(5))
  const energy=new Float64Array(input.length),m=masses(model),fluxes:GasFaceFlux[]=[],seen=new Set<string>()
  faces.forEach((face,f)=>{
    const {a,b}=face
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=input.length||b>=input.length||a===b)throw new Error('gas face indices')
    const key=`${Math.min(a,b)}:${Math.max(a,b)}`
    if(seen.has(key))throw new Error('duplicate gas face');seen.add(key)
    const flux=gasFaceFlux(model,input[a],input[b],depths[a],depths[b],gravityMS2,face,properties[f]);fluxes.push(flux)
    let massMoved=0
    for(let j=0;j<5;j++){
      const kg=dtS*flux.speciesMolPerS[j]*m[j],index=speciesIndex(GAS_IDS[j])
      delta[a][index]-=kg;delta[b][index]+=kg;outgoing[kg>=0?a:b][j]+=Math.abs(kg);massMoved+=kg
    }
    const zf=(depths[a]+depths[b])/2
    const ej=dtS*(flux.enthalpyW+flux.conductiveHeatW)-massMoved*gravityMS2*zf
    energy[a]-=ej+massMoved*gravityMS2*depths[a];energy[b]+=ej+massMoved*gravityMS2*depths[b]
  })
  const next=input.map((s,i)=>{
    for(let j=0;j<5;j++)if(outgoing[i][j]>model.controls.maxConsumedFraction*s.massKg[speciesIndex(GAS_IDS[j])])throw new ChemistryStepRejected('gas outgoing budget; reduce whole dt')
    const result=exchangeCellInventory(model,s,delta[i],energy[i])
    if(Math.abs(inspectChemistryCell(model,result).temperatureK-inspectChemistryCell(model,s).temperatureK)>model.controls.maxTemperatureChangeK)throw new ChemistryStepRejected('gas heat step; reduce dt')
    return result
  })
  const speciesResidualMol=Float64Array.from(GAS_IDS,(id,j)=>next.reduce((s,c,i)=>s+(c.massKg[speciesIndex(id)]-input[i].massKg[speciesIndex(id)])/m[j],0))
  const energyResidualJ=next.reduce((s,c,i)=>s+inspectChemistryCell(model,c).totalInternalEnergyJ-inspectChemistryCell(model,input[i]).totalInternalEnergyJ
    -gravityMS2*depths[i]*GAS_IDS.reduce((v,id)=>v+c.massKg[speciesIndex(id)]-input[i].massKg[speciesIndex(id)],0),0)
  const massScale=input.reduce((s,c)=>s+GAS_IDS.reduce((v,id)=>v+c.massKg[speciesIndex(id)],0),0)
  const energyScale=input.reduce((s,c)=>s+Math.abs(inspectChemistryCell(model,c).totalInternalEnergyJ),0)
  if(speciesResidualMol.some((v,j)=>Math.abs(v)*m[j]>input.length*model.controls.massAbsoluteToleranceKg+model.controls.relativeTolerance*massScale)
    ||Math.abs(energyResidualJ)>input.length*model.controls.energyAbsoluteToleranceJ+model.controls.relativeTolerance*energyScale)throw new ChemistryStepRejected('gas column closure')
  return {next,physicalDurationS:dtS,faceFluxes:fluxes,speciesResidualMol,energyResidualJ}
}
