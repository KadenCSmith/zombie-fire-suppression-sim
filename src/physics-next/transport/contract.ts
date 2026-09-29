/**
 * B-owned contract candidate, NOT a binding verified against current main.
 * Integrated face exchanges are supplied by a future B solver; this module does
 * not invent flux laws, material coefficients, event handling or a G commit.
 */
export const B_TRANSPORT_CONTRACT_VERSION = 'b-transport-port/1' as const
export const B_SPECIES = [
  'fuel','pyrolysate','charAlpha','charBeta','mineral','ash',
  'liquidWater','ice','O2','CO2','N2','H2O','CO',
] as const
export const B_GASES = ['O2','CO2','N2','H2O','CO'] as const
export type BSpecies = typeof B_SPECIES[number]
export type BVec3 = readonly [number,number,number]

export interface BIdentity {
  readonly sourceKind: 'synthetic-fixture' | 'git'
  /** Exact SHA for git; an explicit label for fixtures. Syntax is not ancestry proof. */
  readonly sourceRevision: string
  readonly geometryRevision: string
  readonly materialSetId: string
  readonly materialSetRevision: number
  readonly materialAuditId: string
  readonly constitutiveRevision: string
  readonly numericsRevision: string
}
export interface BMaterialSlice {
  readonly materialId: string
  /** Host bulk fractions before insertion of separately tracked source solid. */
  readonly bulkFraction: number
  readonly intrinsicPorosity: number
  readonly projection: {
    readonly ok: true
    readonly requestId: string
    readonly setId: string
    readonly setRevision: number
    readonly auditId: string
    readonly recordIds: readonly string[]
    readonly check: 'software-gates-only-not-physical-validation'
  }
}
export interface BCellGeometry {
  readonly cell: number
  readonly volumeM3: number
  /** Host open void, NOT inferred from a material's porosity. */
  readonly resolvedVoidFraction: number
  readonly materials: readonly BMaterialSlice[]
}
export interface BFace {
  readonly id: string
  readonly cellA: number
  /** Null for an exterior face; never use an out-of-range cell sentinel. */
  readonly cellB: number | null
  readonly kind: 'interior' | 'wall' | 'bore-open' | 'atmosphere'
  /** A->B internally, outward externally; +z is down. */
  readonly normalFromAToB: BVec3
  readonly centerDistanceM: number
  readonly nominalAreaM2: number
  readonly openAreaM2: number
  /** Null explicitly for a porous face without a hydraulic-aperture law. */
  readonly hydraulicApertureM: number | null
  /** Required only for bore-open. Not a duplicate nominal disk assigned to each face. */
  readonly portalId: string | null
  readonly exteriorStateId: string | null
}
export interface BExteriorState {
  readonly id: string
  readonly temperatureK: number
  readonly gasPressurePa: number
  readonly gasMoleFractions: readonly number[]
}
export interface BBounds {
  readonly minTemperatureK: number
  readonly maxTemperatureK: number
  readonly minGasPressurePa: number
  readonly maxGasPressurePa: number
  readonly minimumGasVolumeM3: number
  readonly maxOutgoingFraction: number
  readonly massAbsoluteToleranceKg: number
  readonly energyAbsoluteToleranceJ: number
  readonly volumeAbsoluteToleranceM3: number
  readonly relativeTolerance: number
}
export interface BContext {
  readonly version: typeof B_TRANSPORT_CONTRACT_VERSION
  readonly identity: BIdentity
  readonly grid: {
    readonly nx: number; readonly ny: number; readonly nz: number
    readonly originM: BVec3
    readonly spacingM: BVec3
  }
  readonly cells: readonly BCellGeometry[]
  readonly faces: readonly BFace[]
  readonly exterior: readonly BExteriorState[]
  /** B_GASES order. All numbers explicitly supplied; no molar-mass defaults. */
  readonly molarMassKgMol: readonly number[]
  readonly liquidDensityKgM3: number
  readonly iceDensityKgM3: number
  readonly bounds: BBounds
}
export interface BSourceState {
  readonly id: string
  readonly cell: number
  readonly densityKgM3: number
  /** Core/shell kg and TOTAL internal energies, not just temperature. */
  readonly nodeMassKg: Float64Array
  readonly nodeEnergyJ: Float64Array
}
export interface BLedger {
  readonly boundaryOutMol: Float64Array
  readonly boundaryLiquidOutKg: number
  readonly boundaryEnergyOutJ: number
  readonly heaterIntoJ: number
}
export interface BState {
  readonly version: typeof B_TRANSPORT_CONTRACT_VERSION
  readonly identity: BIdentity
  readonly timeS: number
  /** Cell-major: 13*cell + species index; EVERY entry is kg. */
  readonly speciesKg: Float64Array
  /** Per-cell TOTAL chemical + phase + sensible internal energy, J. */
  readonly internalEnergyJ: Float64Array
  readonly sources: readonly BSourceState[]
  readonly ledger: BLedger
}
export interface BFaceExchange {
  readonly faceId: string
  /** Integrated mol over this trial, positive A->B or outward. */
  readonly gasMol: Float64Array
  readonly liquidKg: number
  /** Integrated TOTAL energy J, including matter enthalpy, positive A->B/outward. */
  readonly totalEnergyJ: number
}
export interface BSourceExchange {
  readonly sourceId: string
  readonly nodeMassDeltaKg: Float64Array
  readonly nodeEnergyDeltaJ: Float64Array
  readonly co2IntoCellMol: number
  /** Local phase/heat transfer into gas cell; not automatically enthalpy injection. */
  readonly energyIntoCellJ: number
  readonly externalHeaterJ: number
}
export interface BExchangePlan {
  readonly startTimeS: number
  readonly endTimeS: number
  readonly faces: readonly BFaceExchange[]
  readonly sources: readonly BSourceExchange[]
  /** Pure external heat into each cell, distinct from source heater entries. */
  readonly cellHeatIntoJ: Float64Array
}
export interface BRecoveredFields {
  readonly temperatureK: Float64Array
  readonly gasPressurePa: Float64Array
  readonly liquidPressurePa: Float64Array
  readonly gasVolumeM3: Float64Array
}
export type BRecovery = (ownedState: Readonly<BState>, ownedContext: Readonly<BContext>) => BRecoveredFields
export interface BGuard { readonly id: string; readonly passed: boolean; readonly retryable: boolean }
export interface BTrial {
  readonly status: 'bypassed' | 'trial'
  readonly next: BState
  readonly fields: BRecoveredFields | null
  readonly proposedEndTimeS: number
  readonly numericalGuards: readonly BGuard[]
  /** A closure residual is not a timestep error estimator. G requires a real one. */
  readonly errorRatio: null
  readonly massResidualKg: number
  readonly energyResidualJ: number
  readonly sourceOccupiedVolumeDeltaM3: Float64Array
  readonly eligibleForAutomaticPublication: false
}
export class BContractError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, message: string) {
    super(message); this.name = 'BContractError'
  }
}
function bad(code: string, message: string, retryable=false): never { throw new BContractError(code,retryable,message) }
function finite(x:number,lo:number,hi:number,label:string):void {
  if(!Number.isFinite(x)||x<lo||x>hi)bad('INVALID_INPUT',label)
}
function text(x:string,label:string):void { if(typeof x!=='string'||!x.trim())bad('INVALID_INPUT',label) }
function vector(a:ArrayLike<number>,n:number,lo:number,hi:number,label:string):void {
  if(a==null||a.length!==n)bad('SHAPE',label)
  for(let i=0;i<n;i++)finite(a[i],lo,hi,label)
}
function sum(a:ArrayLike<number>):number {
  let total=0,correction=0
  for(let i=0;i<a.length;i++){const v=a[i]-correction,n=total+v;correction=(n-total)-v;total=n}
  return total
}
function identityKey(x:BIdentity):string {
  exact(x,['sourceKind','sourceRevision','geometryRevision','materialSetId','materialSetRevision','materialAuditId','constitutiveRevision','numericsRevision'],'identity fields')
  for(const k of ['sourceRevision','geometryRevision','materialSetId','materialAuditId','constitutiveRevision','numericsRevision'] as const)text(x[k],k)
  if(x.sourceKind!=='synthetic-fixture'&&x.sourceKind!=='git')bad('IDENTITY','source kind')
  if(x.sourceKind==='git'&&!/^[0-9a-f]{40}$/.test(x.sourceRevision))bad('IDENTITY','full git SHA required')
  if(!Number.isSafeInteger(x.materialSetRevision)||x.materialSetRevision<1)bad('IDENTITY','material revision')
  return JSON.stringify([x.sourceKind,x.sourceRevision,x.geometryRevision,x.materialSetId,
    x.materialSetRevision,x.materialAuditId,x.constitutiveRevision,x.numericsRevision])
}
function exact(value:unknown,keys:readonly string[],label:string):void {
  if(value===null||typeof value!=='object'||Array.isArray(value)
    ||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))bad('SHAPE',label)
}
function typed(a:ArrayLike<number>):Float64Array { return Float64Array.from(a,v=>v===0?0:v) }
export function cloneBState(s:BState):BState {
  return {version:s.version,identity:{...s.identity},timeS:s.timeS===0?0:s.timeS,
    speciesKg:typed(s.speciesKg),internalEnergyJ:typed(s.internalEnergyJ),
    sources:s.sources.map(v=>({...v,nodeMassKg:typed(v.nodeMassKg),nodeEnergyJ:typed(v.nodeEnergyJ)})),
    ledger:{...s.ledger,boundaryOutMol:typed(s.ledger.boundaryOutMol)}}
}
function cellCount(c:BContext):number {
  const {nx,ny,nz}=c.grid
  for(const n of [nx,ny,nz])if(!Number.isSafeInteger(n)||n<1)bad('SHAPE','grid counts')
  const n=nx*ny*nz
  if(!Number.isSafeInteger(n)||n>131072)bad('SHAPE','cell budget')
  return n
}
export function validateBContext(c:BContext):void {
  exact(c,['version','identity','grid','cells','faces','exterior','molarMassKgMol','liquidDensityKgM3','iceDensityKgM3','bounds'],'context fields')
  exact(c.grid,['nx','ny','nz','originM','spacingM'],'grid fields')
  exact(c.bounds,['minTemperatureK','maxTemperatureK','minGasPressurePa','maxGasPressurePa','minimumGasVolumeM3',
    'maxOutgoingFraction','massAbsoluteToleranceKg','energyAbsoluteToleranceJ','volumeAbsoluteToleranceM3','relativeTolerance'],'bound fields')
  if(c.version!==B_TRANSPORT_CONTRACT_VERSION)bad('VERSION','context version')
  identityKey(c.identity)
  const n=cellCount(c),b=c.bounds
  vector(c.grid.originM,3,-1e9,1e9,'origin');vector(c.grid.spacingM,3,1e-12,1e9,'spacing')
  vector(c.molarMassKgMol,5,1e-6,1e3,'molar masses')
  finite(c.liquidDensityKgM3,1,1e5,'liquid density');finite(c.iceDensityKgM3,1,1e5,'ice density')
  finite(b.minTemperatureK,1,1e4,'min T');finite(b.maxTemperatureK,b.minTemperatureK,1e4,'max T')
  finite(b.minGasPressurePa,1,1e9,'min p');finite(b.maxGasPressurePa,b.minGasPressurePa,1e9,'max p')
  finite(b.minimumGasVolumeM3,1e-20,1e12,'gas-volume floor')
  finite(b.maxOutgoingFraction,1e-12,0.25,'outgoing fraction')
  finite(b.massAbsoluteToleranceKg,0,1e-3,'mass tolerance')
  finite(b.energyAbsoluteToleranceJ,0,1,'energy tolerance')
  finite(b.volumeAbsoluteToleranceM3,0,1e-3,'volume tolerance')
  finite(b.relativeTolerance,0,1e-6,'relative tolerance')
  if(c.cells.length!==n)bad('SHAPE','geometry cell count')
  const nominal=c.grid.spacingM[0]*c.grid.spacingM[1]*c.grid.spacingM[2]
  c.cells.forEach((cell,i)=>{
    exact(cell,['cell','volumeM3','resolvedVoidFraction','materials'],'cell geometry fields')
    if(cell.cell!==i)bad('GEOMETRY','x-fastest cell numbering')
    finite(cell.volumeM3,1e-20,1e12,'cell volume')
    if(Math.abs(cell.volumeM3-nominal)>b.volumeAbsoluteToleranceM3+b.relativeTolerance*nominal)bad('GEOMETRY','cell volume/spacing mismatch')
    finite(cell.resolvedVoidFraction,0,1,'void fraction')
    let fraction=cell.resolvedVoidFraction;const seen=new Set<string>()
    for(const m of cell.materials){
      exact(m,['materialId','bulkFraction','intrinsicPorosity','projection'],'material slice fields')
      exact(m.projection,['ok','requestId','setId','setRevision','auditId','recordIds','check'],'projection receipt fields')
      text(m.materialId,'material id');if(seen.has(m.materialId))bad('MATERIAL','duplicate material');seen.add(m.materialId)
      finite(m.bulkFraction,0,1,'bulk fraction');finite(m.intrinsicPorosity,0,1,'intrinsic porosity')
      if(m.projection?.ok!==true||m.projection.check!=='software-gates-only-not-physical-validation')bad('MATERIAL','approved numeric projection receipt required')
      if(m.projection.setId!==c.identity.materialSetId||m.projection.setRevision!==c.identity.materialSetRevision)bad('MATERIAL','projection set identity mismatch')
      text(m.projection.requestId,'projection request');text(m.projection.auditId,'projection audit')
      if(!m.projection.recordIds.length)bad('MATERIAL','record provenance required')
      m.projection.recordIds.forEach(id=>text(id,'record id'));fraction+=m.bulkFraction
    }
    if(Math.abs(fraction-1)>1e-12)bad('GEOMETRY','host material/void partition')
  })
  const external=new Set<string>()
  c.exterior.forEach(e=>{
    exact(e,['id','temperatureK','gasPressurePa','gasMoleFractions'],'external state fields')
    text(e.id,'exterior id');if(external.has(e.id))bad('BOUNDARY','duplicate exterior id');external.add(e.id)
    finite(e.temperatureK,b.minTemperatureK,b.maxTemperatureK,'ambient T');finite(e.gasPressurePa,b.minGasPressurePa,b.maxGasPressurePa,'ambient p')
    vector(e.gasMoleFractions,5,0,1,'ambient fractions')
    if(Math.abs(sum(e.gasMoleFractions)-1)>1e-12)bad('BOUNDARY','ambient composition sum')
  })
  const ids=new Set<string>(), pairs=new Set<string>()
  c.faces.forEach(f=>{
    exact(f,['id','cellA','cellB','kind','normalFromAToB','centerDistanceM','nominalAreaM2','openAreaM2',
      'hydraulicApertureM','portalId','exteriorStateId'],'face fields')
    text(f.id,'face id');if(ids.has(f.id))bad('GEOMETRY','duplicate physical face');ids.add(f.id)
    if(!Number.isInteger(f.cellA)||f.cellA<0||f.cellA>=n)bad('GEOMETRY','cell A')
    vector(f.normalFromAToB,3,-1,1,'normal')
    if(Math.abs(Math.hypot(...f.normalFromAToB)-1)>1e-12)bad('GEOMETRY','unit normal')
    finite(f.centerDistanceM,1e-12,1e12,'face distance');finite(f.nominalAreaM2,0,1e12,'nominal area')
    finite(f.openAreaM2,0,f.nominalAreaM2,'open area')
    if(f.hydraulicApertureM!==null)finite(f.hydraulicApertureM,0,1e6,'hydraulic aperture')
    if(f.kind==='interior'){
      if(f.cellB===null||!Number.isInteger(f.cellB)||f.cellB<0||f.cellB>=n||f.cellB===f.cellA)bad('GEOMETRY','interior neighbour')
      const key=[Math.min(f.cellA,f.cellB),Math.max(f.cellA,f.cellB)].join(':')
      if(pairs.has(key))bad('GEOMETRY','duplicate pair; aggregate physical subfaces explicitly');pairs.add(key)
      if(f.portalId!==null||f.exteriorStateId!==null)bad('GEOMETRY','interior/exterior mismatch')
    }else{
      if(!['wall','bore-open','atmosphere'].includes(f.kind)||f.cellB!==null)bad('BOUNDARY','external face')
      if(f.kind==='wall'){
        if(f.openAreaM2!==0||f.exteriorStateId!==null||f.portalId!==null)bad('BOUNDARY','impermeable wall contract')
      }else{
        if(f.exteriorStateId===null||!external.has(f.exteriorStateId))bad('BOUNDARY','explicit exterior required')
        if(f.kind==='bore-open'){if(f.portalId===null)bad('BOUNDARY','open-bore portal required');text(f.portalId,'portal')}
        else if(f.portalId!==null)bad('BOUNDARY','unexpected portal')
      }
    }
  })
}
function gasVolumesUnchecked(c:BContext,s:BState):Float64Array {
  const v=Float64Array.from(c.cells,cell=>cell.volumeM3*(cell.resolvedVoidFraction+
    cell.materials.reduce((a,m)=>a+m.bulkFraction*m.intrinsicPorosity,0)))
  for(let i=0;i<v.length;i++)v[i]-=s.speciesKg[13*i+6]/c.liquidDensityKgM3+s.speciesKg[13*i+7]/c.iceDensityKgM3
  for(const source of s.sources)v[source.cell]-=sum(source.nodeMassKg)/source.densityKgM3
  return v
}
export function validateBState(c:BContext,s:BState):void {
  exact(s,['version','identity','timeS','speciesKg','internalEnergyJ','sources','ledger'],'state fields')
  validateBContext(c)
  if(s.version!==B_TRANSPORT_CONTRACT_VERSION||identityKey(s.identity)!==identityKey(c.identity))bad('IDENTITY','state/context identity mismatch')
  const n=cellCount(c)
  finite(s.timeS,0,1e12,'time');vector(s.speciesKg,n*13,0,1e12,'species kg')
  vector(s.internalEnergyJ,n,-1e25,1e25,'cell total energy')
  if(!Array.isArray(s.sources))bad('SHAPE','sources array')
  exact(s.ledger,['boundaryOutMol','boundaryLiquidOutKg','boundaryEnergyOutJ','heaterIntoJ'],'ledger fields')
  const ids=new Set<string>()
  for(const src of s.sources){
    exact(src,['id','cell','densityKgM3','nodeMassKg','nodeEnergyJ'],'source fields')
    text(src.id,'source id');if(ids.has(src.id))bad('SOURCE','duplicate source');ids.add(src.id)
    if(!Number.isInteger(src.cell)||src.cell<0||src.cell>=n)bad('SOURCE','source cell')
    vector(src.nodeMassKg,2,0,1e12,'source masses');vector(src.nodeEnergyJ,2,-1e25,1e25,'source energies')
    finite(src.densityKgM3,1,1e5,'source density')
    for(let i=0;i<2;i++)if(src.nodeMassKg[i]===0&&src.nodeEnergyJ[i]!==0)bad('SOURCE','empty node retains energy')
  }
  vector(s.ledger.boundaryOutMol,5,-1e25,1e25,'boundary mol ledger')
  for(const k of ['boundaryLiquidOutKg','boundaryEnergyOutJ','heaterIntoJ'] as const)finite(s.ledger[k],-1e25,1e25,k)
  if(gasVolumesUnchecked(c,s).some(v=>!Number.isFinite(v)||v<c.bounds.minimumGasVolumeM3))bad('GAS_VOLUME','insufficient gas volume')
}
export function bGasVolumesM3(c:BContext,s:BState):Float64Array {
  validateBState(c,s)
  return gasVolumesUnchecked(c,s)
}
function totalMass(s:BState):number {return sum(s.speciesKg)+sum(s.sources.map(src=>sum(src.nodeMassKg)))}
function totalEnergy(s:BState):number {return sum(s.internalEnergyJ)+sum(s.sources.map(src=>sum(src.nodeEnergyJ)))}
function close(error:number,absolute:number,relative:number,scale:number):boolean {
  return Number.isFinite(error)&&Math.abs(error)<=absolute+relative*scale
}
export function checkpointBOwner(c:BContext,s:BState):string {
  validateBState(c,s)
  return JSON.stringify(cloneBState(s),(_key,value)=>value instanceof Float64Array?Array.from(value):value)
}
export function restoreBOwner(c:BContext,payload:string):BState {
  const raw=JSON.parse(payload) as BState
  if(raw==null||typeof raw!=='object'||Array.isArray(raw))bad('SNAPSHOT','owner snapshot object')
  const keys=['version','identity','timeS','speciesKg','internalEnergyJ','sources','ledger']
  if(Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k)))bad('SNAPSHOT','owner snapshot fields')
  // Validate numeric arrays BEFORE Float64Array conversion can coerce strings.
  validateBState(c,raw)
  return cloneBState(raw)
}
export function validateBDerivedFields(c:BContext,s:BState,f:BRecoveredFields):void {
  const n=cellCount(c),b=c.bounds
  vector(f.temperatureK,n,b.minTemperatureK,b.maxTemperatureK,'recovered T')
  vector(f.gasPressurePa,n,b.minGasPressurePa,b.maxGasPressurePa,'recovered gas p')
  vector(f.liquidPressurePa,n,-1e10,1e10,'recovered liquid p')
  vector(f.gasVolumeM3,n,b.minimumGasVolumeM3,1e12,'recovered gas volume')
  const actual=bGasVolumesM3(c,s)
  actual.forEach((v,i)=>{
    if(!close(f.gasVolumeM3[i]-v,b.volumeAbsoluteToleranceM3,b.relativeTolerance,Math.abs(v)))bad('RECOVERY','source/condensate volume mismatch')
  })
}
/**
 * Stage explicitly supplied integrated exchanges, not a flux-law implementation.
 * All faces read the same pretrial state; no net-inflow credit for gross outflow.
 * Clock stays at startTimeS. G and the coordinator own acceptance/publication.
 */
export function stageBExchange(
  c:BContext,input:BState,plan:BExchangePlan,
  mode:'preserve-existing'|'candidate',recover:BRecovery,
):BTrial {
  validateBState(c,input)
  exact(plan,['startTimeS','endTimeS','faces','sources','cellHeatIntoJ'],'exchange plan fields')
  finite(plan.startTimeS,0,1e12,'start');finite(plan.endTimeS,plan.startTimeS,1e12,'end')
  if(plan.startTimeS!==input.timeS)bad('CLOCK','G plan/start mismatch')
  const n=cellCount(c),before=cloneBState(input),next=cloneBState(input),b=c.bounds
  vector(plan.cellHeatIntoJ,n,-1e25,1e25,'cell heat')
  if(mode==='preserve-existing'){
    if(plan.faces.length||plan.sources.length||plan.cellHeatIntoJ.some(x=>x!==0))bad('ACTIVATION','cannot silently ignore a proposed exchange')
    return {status:'bypassed',next,fields:null,proposedEndTimeS:input.timeS,numericalGuards:[],errorRatio:null,
      massResidualKg:0,energyResidualJ:0,sourceOccupiedVolumeDeltaM3:new Float64Array(n),eligibleForAutomaticPublication:false}
  }
  if(mode!=='candidate'||plan.endTimeS<=plan.startTimeS)bad('CLOCK','positive candidate interval required')
  const dm=new Float64Array(n*13),de=typed(plan.cellHeatIntoJ),outgoing=new Float64Array(n*13)
  const boundaryMol=new Float64Array(5),volumeDelta=new Float64Array(n)
  let boundaryLiquid=0,boundaryEnergy=0,heater=sum(plan.cellHeatIntoJ)
  const faceMap=new Map(c.faces.map(f=>[f.id,f])),used=new Set<string>()
  for(const exchange of plan.faces){
    exact(exchange,['faceId','gasMol','liquidKg','totalEnergyJ'],'face exchange fields')
    const f=faceMap.get(exchange.faceId)
    if(!f||used.has(exchange.faceId))bad('FACE','unknown or repeated face exchange')
    used.add(exchange.faceId);vector(exchange.gasMol,5,-1e20,1e20,'face mol')
    finite(exchange.liquidKg,-1e12,1e12,'liquid transfer');finite(exchange.totalEnergyJ,-1e25,1e25,'face energy')
    if((f.kind==='wall'||f.openAreaM2===0||f.hydraulicApertureM===0)&&
      (exchange.gasMol.some(v=>v!==0)||exchange.liquidKg!==0||exchange.totalEnergyJ!==0))bad('FACE_CLOSED','closed face has nonzero exchange')
    if(f.cellB===null&&exchange.liquidKg!==0)bad('BOUNDARY','liquid exterior transfer requires a separate approved law')
    const move=(species:number,kg:number)=>{
      dm[13*f.cellA+species]-=kg
      if(kg>0)outgoing[13*f.cellA+species]+=kg
      if(f.cellB!==null){dm[13*f.cellB+species]+=kg;if(kg<0)outgoing[13*f.cellB+species]-=kg}
    }
    exchange.gasMol.forEach((mol,j)=>{move(8+j,mol*c.molarMassKgMol[j]);if(f.cellB===null)boundaryMol[j]+=mol})
    move(6,exchange.liquidKg);de[f.cellA]-=exchange.totalEnergyJ
    if(f.cellB!==null)de[f.cellB]+=exchange.totalEnergyJ
    else{boundaryLiquid+=exchange.liquidKg;boundaryEnergy+=exchange.totalEnergyJ}
  }
  const sourceMap=new Map(next.sources.map(src=>[src.id,src])),seenSources=new Set<string>()
  for(const exchange of plan.sources){
    exact(exchange,['sourceId','nodeMassDeltaKg','nodeEnergyDeltaJ','co2IntoCellMol','energyIntoCellJ','externalHeaterJ'],'source exchange fields')
    const source=sourceMap.get(exchange.sourceId)
    if(!source||seenSources.has(exchange.sourceId))bad('SOURCE','unknown or repeated source exchange')
    seenSources.add(exchange.sourceId)
    vector(exchange.nodeMassDeltaKg,2,-1e12,1e12,'source mass delta')
    vector(exchange.nodeEnergyDeltaJ,2,-1e25,1e25,'source energy delta')
    for(const v of [exchange.co2IntoCellMol,exchange.energyIntoCellJ,exchange.externalHeaterJ])finite(v,-1e25,1e25,'source exchange')
    const gasKg=exchange.co2IntoCellMol*c.molarMassKgMol[1],solidKg=sum(exchange.nodeMassDeltaKg)
    if(!close(gasKg+solidKg,b.massAbsoluteToleranceKg,b.relativeTolerance,Math.abs(gasKg)+Math.abs(solidKg)))bad('SOURCE_MASS','source phase exchange does not close')
    if(!close(sum(exchange.nodeEnergyDeltaJ)+exchange.energyIntoCellJ-exchange.externalHeaterJ,
      b.energyAbsoluteToleranceJ,b.relativeTolerance,sum(Array.from(exchange.nodeEnergyDeltaJ,Math.abs))+Math.abs(exchange.energyIntoCellJ)+Math.abs(exchange.externalHeaterJ)))bad('SOURCE_ENERGY','source energy exchange does not close')
    for(let k=0;k<2;k++){
      if(-exchange.nodeMassDeltaKg[k]>b.maxOutgoingFraction*source.nodeMassKg[k])bad('SOURCE_BUDGET','source node donor budget',true)
      source.nodeMassKg[k]+=exchange.nodeMassDeltaKg[k];source.nodeEnergyJ[k]+=exchange.nodeEnergyDeltaJ[k]
    }
    dm[13*source.cell+9]+=gasKg;if(gasKg<0)outgoing[13*source.cell+9]-=gasKg
    de[source.cell]+=exchange.energyIntoCellJ;heater+=exchange.externalHeaterJ
    volumeDelta[source.cell]+=solidKg/source.densityKgM3
  }
  outgoing.forEach((v,i)=>{if(v>b.maxOutgoingFraction*before.speciesKg[i])bad('DONOR_BUDGET','summed gross outgoing inventory',true)})
  for(let i=0;i<dm.length;i++)next.speciesKg[i]+=dm[i]
  for(let i=0;i<n;i++)next.internalEnergyJ[i]+=de[i]
  const ledger:BLedger={boundaryOutMol:typed(next.ledger.boundaryOutMol.map((v,i)=>v+boundaryMol[i])),
    boundaryLiquidOutKg:next.ledger.boundaryLiquidOutKg+boundaryLiquid,
    boundaryEnergyOutJ:next.ledger.boundaryEnergyOutJ+boundaryEnergy,heaterIntoJ:next.ledger.heaterIntoJ+heater}
  const staged:BState={...next,ledger}
  try{validateBState(c,staged)}catch(e){if(e instanceof BContractError)bad(e.code,e.message,true);throw e}
  const massOut=sum(boundaryMol.map((v,i)=>v*c.molarMassKgMol[i]))+boundaryLiquid
  const massResidualKg=totalMass(staged)-totalMass(before)+massOut
  const energyResidualJ=totalEnergy(staged)-totalEnergy(before)+boundaryEnergy-heater
  if(!close(massResidualKg,b.massAbsoluteToleranceKg,b.relativeTolerance,totalMass(before)+totalMass(staged)+Math.abs(massOut)))bad('MASS_CLOSURE','combined mass residual',true)
  if(!close(energyResidualJ,b.energyAbsoluteToleranceJ,b.relativeTolerance,Math.abs(totalEnergy(before))+Math.abs(totalEnergy(staged))+Math.abs(boundaryEnergy)+Math.abs(heater)))bad('ENERGY_CLOSURE','combined energy residual',true)
  const recoveryInput=cloneBState(staged),receipt=checkpointBOwner(c,recoveryInput)
  // Context is plain finite data; provide an owned graph, not mutable caller metadata.
  const recoveryContext=JSON.parse(JSON.stringify(c)) as BContext
  const fields=recover(recoveryInput,recoveryContext)
  if(checkpointBOwner(c,recoveryInput)!==receipt||JSON.stringify(recoveryContext)!==JSON.stringify(c))bad('RECOVERY_MUTATION','recovery mutated its supposedly read-only input')
  validateBDerivedFields(c,staged,fields)
  return {status:'trial',next:cloneBState(staged),
    fields:{temperatureK:typed(fields.temperatureK),gasPressurePa:typed(fields.gasPressurePa),
      liquidPressurePa:typed(fields.liquidPressurePa),gasVolumeM3:typed(fields.gasVolumeM3)},
    proposedEndTimeS:plan.endTimeS,errorRatio:null,massResidualKg,energyResidualJ,
    sourceOccupiedVolumeDeltaM3:volumeDelta,
    numericalGuards:[{id:'B-contract-and-conservation',passed:true,retryable:false}],
    eligibleForAutomaticPublication:false}
}
