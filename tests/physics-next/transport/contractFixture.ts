import {
  B_TRANSPORT_CONTRACT_VERSION, B_SPECIES, B_GASES, BContractError,
  type BContext, type BState, type BExchangePlan, type BRecovery,
  cloneBState, validateBContext, validateBState, bGasVolumesM3,
  stageBExchange, checkpointBOwner, restoreBOwner,
} from '../../../src/physics-next/transport/contract'

let assertions=0
function ok(value:boolean,message:string):void {assertions++;if(!value)throw new Error(message)}
function equal(a:unknown,b:unknown,message:string):void {ok(JSON.stringify(a)===JSON.stringify(b),message)}
function near(a:number,b:number,tolerance:number,message:string):void {ok(Math.abs(a-b)<=tolerance,message)}
function throws(fn:()=>unknown,code?:string):void {
  let error:unknown
  try{fn()}catch(e){error=e}
  ok(error instanceof Error,'expected rejection')
  if(code)ok(error instanceof BContractError&&error.code===code,`expected ${code}, got ${String(error)}`)
}
function context():BContext {
  return {
    version:B_TRANSPORT_CONTRACT_VERSION,
    identity:{sourceKind:'synthetic-fixture',sourceRevision:'manufactured-B-contract-fixture-v1',
      geometryRevision:'fixture-grid-1',materialSetId:'fixture-materials',materialSetRevision:1,
      materialAuditId:'fixture-audit',constitutiveRevision:'manufactured-ideal-gas-only-v1',
      numericsRevision:'fixture-no-estimator'},
    grid:{nx:2,ny:1,nz:1,originM:[0,0,0],spacingM:[1,1,1]},
    cells:[0,1].map(cell=>({cell,volumeM3:1,resolvedVoidFraction:0.5,materials:[{
      materialId:'synthetic-host',bulkFraction:0.5,intrinsicPorosity:0.2,
      projection:{ok:true,setId:'fixture-materials',setRevision:1,requestId:'fixture-porosity',
        auditId:'fixture-audit',recordIds:['synthetic-porosity'],check:'software-gates-only-not-physical-validation'},
    }]})),
    faces:[
      {id:'0-to-1',cellA:0,cellB:1,kind:'interior',normalFromAToB:[1,0,0],centerDistanceM:1,
        nominalAreaM2:1,openAreaM2:0.25,hydraulicApertureM:null,portalId:null,exteriorStateId:null},
      {id:'bore-out',cellA:0,cellB:null,kind:'bore-open',normalFromAToB:[0,0,-1],centerDistanceM:0.5,
        nominalAreaM2:1,openAreaM2:0.01,hydraulicApertureM:0.05,portalId:'fixture-bore',exteriorStateId:'air'},
    ],
    exterior:[{id:'air',temperatureK:300,gasPressurePa:8000,gasMoleFractions:[0.2,0,0.8,0,0]}],
    molarMassKgMol:[0.032,0.044,0.028,0.018,0.028],liquidDensityKgM3:1000,iceDensityKgM3:900,
    bounds:{minTemperatureK:150,maxTemperatureK:1200,minGasPressurePa:1000,maxGasPressurePa:300000,
      minimumGasVolumeM3:1e-8,maxOutgoingFraction:0.25,massAbsoluteToleranceKg:1e-12,
      energyAbsoluteToleranceJ:1e-8,volumeAbsoluteToleranceM3:1e-12,relativeTolerance:1e-12},
  }
}
function state(c:BContext):BState {
  const kg=new Float64Array(26);kg[10]=0.056;kg[23]=0.056 // two moles synthetic N2 per cell
  return {version:B_TRANSPORT_CONTRACT_VERSION,identity:{...c.identity},timeS:0,
    speciesKg:kg,internalEnergyJ:new Float64Array([12000,12000]),
    sources:[{id:'source-0',cell:0,densityKgM3:1000,nodeMassKg:new Float64Array([0.25,0.25]),
      nodeEnergyJ:new Float64Array([100,100])}],
    ledger:{boundaryOutMol:new Float64Array(5),boundaryLiquidOutKg:0,boundaryEnergyOutJ:0,heaterIntoJ:0}}
}
function plan():BExchangePlan {
  return {startTimeS:0,endTimeS:1,faces:[],sources:[],cellHeatIntoJ:new Float64Array(2)}
}
/**
 * Manufactured EOS/caloric fixture only: R_test=8 J/(mol K), Cv_test=20 J/(mol K).
 * It omits inert-host thermal capacity, chemistry and phase equilibrium.
 * These constants are explicit test numbers, NOT F data or real peat calibration.
 */
const recover:BRecovery=(s,c)=>{
  const v=bGasVolumesM3(c,s),temperatureK=new Float64Array(2),gasPressurePa=new Float64Array(2)
  for(let cell=0;cell<2;cell++){
    let mol=0
    for(let j=0;j<5;j++)mol+=s.speciesKg[13*cell+8+j]/c.molarMassKgMol[j]
    temperatureK[cell]=s.internalEnergyJ[cell]/(20*mol)
    gasPressurePa[cell]=mol*8*temperatureK[cell]/v[cell]
  }
  return {temperatureK,gasPressurePa,liquidPressurePa:new Float64Array(gasPressurePa),gasVolumeM3:v}
}
function transfer(faceId='0-to-1',mol=0.1){
  return {faceId,gasMol:new Float64Array([0,0,mol,0,0]),liquidKg:0,totalEnergyJ:mol*20*300}
}
function sourceExchange(){
  return {sourceId:'source-0',nodeMassDeltaKg:new Float64Array([-0.00022,-0.00022]),
    nodeEnergyDeltaJ:new Float64Array([-10,-10]),co2IntoCellMol:0.01,energyIntoCellJ:20,externalHeaterJ:0}
}
type Case={name:string;run:()=>void}
const cases:Case[]=[
  {name:'unknown exchange fields and unsupported hidden state are rejected',run(){
    const c=context(),s=state(c)
    const extra={...plan(),unappliedReactionHeatJ:100}
    throws(()=>stageBExchange(c,s,extra,'candidate',recover),'SHAPE')
    const hidden={...s,previousThermalCache:[]}
    throws(()=>checkpointBOwner(c,hidden),'SHAPE')
    const f={...transfer(),untrackedBoundaryFlux:1}
    throws(()=>stageBExchange(c,s,{...plan(),faces:[f]},'candidate',recover),'SHAPE')
  }},

  {name:'explicit species order, gas order and context',run(){
    equal(B_GASES,['O2','CO2','N2','H2O','CO'],'five gas identities')
    ok(B_SPECIES.length===13,'all 13 pools retained')
    const c=context(),s=state(c);validateBState(c,s)
    near(bGasVolumesM3(c,s)[0],0.5995,1e-14,'source occupies pore space once')
  }},
  {name:'closed face conservation and manufactured expected output',run(){
    const c=context(),s=state(c),before=checkpointBOwner(c,s)
    const t=stageBExchange(c,s,{...plan(),faces:[transfer()]},'candidate',recover)
    near(t.next.speciesKg[10],0.0532,1e-15,'cell A N2 kg')
    near(t.next.speciesKg[23],0.0588,1e-15,'cell B N2 kg')
    near(t.next.internalEnergyJ[0],11400,1e-12,'cell A total U')
    near(t.next.internalEnergyJ[1],12600,1e-12,'cell B total U')
    near(t.fields!.temperatureK[0],300,1e-12,'consistent manufactured temperature')
    near(t.massResidualKg,0,1e-12,'mass closes')
    near(t.energyResidualJ,0,1e-8,'energy closes')
    equal(checkpointBOwner(c,s),before,'input unchanged')
    ok(t.next.timeS===0&&t.proposedEndTimeS===1,'coordinator advances clock once')
    ok(t.errorRatio===null&&!t.eligibleForAutomaticPublication,'no fake G estimator or publication')
  }},
  {name:'outward open-bore mass and energy ledger',run(){
    const c=context(),s=state(c)
    const t=stageBExchange(c,s,{...plan(),faces:[transfer('bore-out')]},'candidate',recover)
    near(t.next.ledger.boundaryOutMol[2],0.1,1e-15,'outward positive mol')
    near(t.next.ledger.boundaryEnergyOutJ,600,1e-12,'outward positive energy')
    near(t.massResidualKg,0,1e-12,'open mass balance')
    near(t.energyResidualJ,0,1e-8,'open energy balance')
  }},
  {name:'specified wet-gas inflow, including separate CO',run(){
    const c=context(),s=state(c),gasMol=new Float64Array([-0.01,0,-0.04,0,-0.001])
    const energy=-0.051*20*300
    const t=stageBExchange(c,s,{...plan(),faces:[{faceId:'bore-out',gasMol,liquidKg:0,totalEnergyJ:energy}]},'candidate',recover)
    near(t.next.speciesKg[12],0.000028,1e-16,'CO not folded into N2')
    near(t.next.ledger.boundaryOutMol[4],-0.001,1e-16,'negative outward means inflow')
    near(t.energyResidualJ,0,1e-8,'inflow energy balance')
  }},
  {name:'local source phase exchange closes mass, energy and occupied volume',run(){
    const c=context(),s=state(c),t=stageBExchange(c,s,{...plan(),sources:[sourceExchange()]},'candidate',recover)
    near(t.next.speciesKg[9],0.00044,1e-16,'source CO2 gas mass')
    near(t.next.sources[0].nodeMassKg[0],0.24978,1e-15,'core mass')
    near(t.sourceOccupiedVolumeDeltaM3[0],-0.00000044,1e-16,'source occupancy decrease')
    near(t.fields!.gasVolumeM3[0],0.59950044,1e-13,'gas volume increases exactly once')
    near(t.massResidualKg,0,1e-12,'source mass closes')
    near(t.energyResidualJ,0,1e-8,'source energy closes')
  }},
  {name:'explicit heater terms are the only net energy source',run(){
    const c=context(),s=state(c),x={...sourceExchange(),externalHeaterJ:3,energyIntoCellJ:23}
    const t=stageBExchange(c,s,{...plan(),sources:[x],cellHeatIntoJ:new Float64Array([5,0])},'candidate',recover)
    near(t.next.ledger.heaterIntoJ,8,1e-12,'two distinct external heater terms')
    near(t.energyResidualJ,0,1e-8,'heater included in total balance')
  }},
  {name:'no-intervention bypass leaves data and clocks bitwise unchanged',run(){
    const c=context(),s=state(c),bytes=Array.from(new Uint8Array(s.speciesKg.buffer))
    let called=false
    const t=stageBExchange(c,s,plan(),'preserve-existing',()=>{called=true;throw new Error('must not run')})
    ok(!called,'no solver callback on bypass');ok(t.status==='bypassed','bypass route')
    equal(checkpointBOwner(c,t.next),checkpointBOwner(c,s),'entire owner unchanged')
    equal(Array.from(new Uint8Array(t.next.speciesKg.buffer)),bytes,'same numeric bytes')
    ok(t.proposedEndTimeS===0,'no independent clock advance')
  }},
  {name:'disabled mode cannot silently swallow a requested exchange',run(){
    const c=context();throws(()=>stageBExchange(c,state(c),{...plan(),faces:[transfer()]},'preserve-existing',recover),'ACTIVATION')
  }},
  {name:'zero plan in candidate mode has no hidden source',run(){
    const c=context(),s=state(c),t=stageBExchange(c,s,plan(),'candidate',recover)
    equal(checkpointBOwner(c,t.next),checkpointBOwner(c,s),'no unrequested flux or phase conversion')
  }},
  {name:'closed apertures reject prescribed flux, not clip it',run(){
    const c=context(),s=state(c)
    const closed={...c,faces:c.faces.map(f=>f.id==='0-to-1'?{...f,openAreaM2:0}:f)}
    throws(()=>stageBExchange(closed,s,{...plan(),faces:[transfer()]},'candidate',recover),'FACE_CLOSED')
    const zeroA={...c,faces:c.faces.map(f=>f.id==='0-to-1'?{...f,hydraulicApertureM:0}:f)}
    throws(()=>stageBExchange(zeroA,s,{...plan(),faces:[transfer()]},'candidate',recover),'FACE_CLOSED')
  }},
  {name:'material volume fractions cannot serve as missing face apertures',run(){
    const c=context(),f={...c.faces[0]}
    Reflect.deleteProperty(f,'openAreaM2')
    throws(()=>validateBContext({...c,faces:[f]}),'SHAPE')
  }},
  {name:'open bore requires external state and portal identity',run(){
    const c=context()
    throws(()=>validateBContext({...c,faces:c.faces.map(f=>f.kind==='bore-open'?{...f,portalId:null}:f)}),'BOUNDARY')
    throws(()=>validateBContext({...c,exterior:[]}),'BOUNDARY')
  }},
  {name:'duplicate oriented faces are not double counted',run(){
    const c=context()
    throws(()=>validateBContext({...c,faces:[...c.faces,{...c.faces[0],id:'same-other-name'}]}),'GEOMETRY')
    throws(()=>stageBExchange(c,state(c),{...plan(),faces:[transfer(),transfer()]},'candidate',recover),'FACE')
  }},
  {name:'all outgoing faces share the same donor budget',run(){
    const c=context(),s=state(c),saved=checkpointBOwner(c,s)
    throws(()=>stageBExchange(c,s,{...plan(),faces:[transfer('0-to-1',0.3),transfer('bore-out',0.3)]},'candidate',recover),'DONOR_BUDGET')
    equal(checkpointBOwner(c,s),saved,'rejected trial did not mutate accepted data')
  }},
  {name:'new source inflow cannot finance same-trial gross outflow',run(){
    const c=context(),s=state(c)
    const face={faceId:'bore-out',gasMol:new Float64Array([0,0.005,0,0,0]),liquidKg:0,totalEnergyJ:10}
    throws(()=>stageBExchange(c,s,{...plan(),faces:[face],sources:[sourceExchange()]},'candidate',recover),'DONOR_BUDGET')
  }},
  {name:'source mass or energy imbalance is rejected before publication',run(){
    const c=context(),s=state(c),saved=checkpointBOwner(c,s)
    throws(()=>stageBExchange(c,s,{...plan(),sources:[{...sourceExchange(),co2IntoCellMol:0.02}]},'candidate',recover),'SOURCE_MASS')
    throws(()=>stageBExchange(c,s,{...plan(),sources:[{...sourceExchange(),energyIntoCellJ:999}]},'candidate',recover),'SOURCE_ENERGY')
    equal(checkpointBOwner(c,s),saved,'source mismatch leaves input unchanged')
  }},
  {name:'source and condensate volume is never double subtracted',run(){
    const c=context(),s=state(c),t=stageBExchange(c,s,{...plan(),sources:[sourceExchange()]},'candidate',recover)
    const total=t.fields!.gasVolumeM3[0]+t.next.sources[0].nodeMassKg.reduce((a,b)=>a+b,0)/1000
    near(total,0.6,1e-13,'host pore capacity invariant')
    throws(()=>stageBExchange(c,s,plan(),'candidate',(x,k)=>{
      const f=recover(x,k);f.gasVolumeM3[0]-=0.0005;return f
    }),'RECOVERY')
  }},
  {name:'unresolved or stale F projection data does not default to a number',run(){
    const c=context(),a=JSON.parse(JSON.stringify(c)) as BContext
    Reflect.set(a.cells[0].materials[0].projection,'ok',false)
    throws(()=>validateBContext(a),'MATERIAL')
    const b=JSON.parse(JSON.stringify(c)) as BContext
    Reflect.set(b.cells[0].materials[0].projection,'setRevision',2)
    throws(()=>validateBContext(b),'MATERIAL')
  }},
  {name:'owned state and derived arrays cannot alias inputs or callback storage',run(){
    const c=context(),s=state(c);let returned:ReturnType<BRecovery>|null=null
    const copied=cloneBState(s);copied.sources[0].nodeMassKg[0]=8
    near(s.sources[0].nodeMassKg[0],0.25,0,'public clone owns source arrays')
    const t=stageBExchange(c,s,plan(),'candidate',(a,b)=>{returned=recover(a,b);return returned})
    t.next.speciesKg[10]=99;t.next.sources[0].nodeMassKg[0]=99;t.next.ledger.boundaryOutMol[2]=99
    near(s.speciesKg[10],0.056,0,'species ownership');near(s.sources[0].nodeMassKg[0],0.25,0,'source ownership')
    near(s.ledger.boundaryOutMol[2],0,0,'ledger ownership')
    if(returned!==null)(returned as ReturnType<BRecovery>).temperatureK[0]=999
    near(t.fields!.temperatureK[0],300,1e-12,'derived output owned')
  }},
  {name:'throwing and mutating recovery never publishes partial state',run(){
    const c=context(),s=state(c),saved=checkpointBOwner(c,s)
    throws(()=>stageBExchange(c,s,{...plan(),faces:[transfer()]},'candidate',()=>{throw new Error('injected recovery failure')}))
    throws(()=>stageBExchange(c,s,plan(),'candidate',(a,b)=>{a.speciesKg[10]+=0.001;return recover(a,b)}),'RECOVERY_MUTATION')
    equal(checkpointBOwner(c,s),saved,'input survived exceptional paths')
  }},
  {name:'strict owner checkpoint rejects identity changes, extra fields and numeric coercion',run(){
    const c=context(),s=state(c),checkpoint=checkpointBOwner(c,s)
    equal(checkpointBOwner(c,restoreBOwner(c,checkpoint)),checkpoint,'numeric round trip')
    throws(()=>restoreBOwner({...c,identity:{...c.identity,geometryRevision:'different'}},checkpoint),'IDENTITY')
    const extra=JSON.parse(checkpoint);extra.staleCache=1
    throws(()=>restoreBOwner(c,JSON.stringify(extra)),'SNAPSHOT')
    const coercion=JSON.parse(checkpoint);coercion.speciesKg[10]='0.056'
    throws(()=>restoreBOwner(c,JSON.stringify(coercion)),'INVALID_INPUT')
  }},
  {name:'restart reproduces the same accepted numeric owner and ledgers',run(){
    const c=context(),initial=state(c)
    const first=stageBExchange(c,initial,{...plan(),faces:[transfer()]},'candidate',recover)
    // This line represents the coordinator's single accepted-time publication, not B's.
    const accepted:BState={...first.next,timeS:first.proposedEndTimeS}
    const restored=restoreBOwner(c,checkpointBOwner(c,accepted))
    const second={...plan(),startTimeS:1,endTimeS:2,faces:[transfer('bore-out',0.05)]}
    const a=stageBExchange(c,accepted,second,'candidate',recover),b=stageBExchange(c,restored,second,'candidate',recover)
    equal(checkpointBOwner(c,a.next),checkpointBOwner(c,b.next),'replayed owner and ledger')
    equal(a.fields,b.fields,'replayed recovered quantities')
  }},
  {name:'invalid clocks, NaNs, material partitions and bounds reject explicitly',run(){
    const c=context(),s=state(c)
    throws(()=>stageBExchange(c,s,{...plan(),startTimeS:0.1},'candidate',recover),'CLOCK')
    throws(()=>stageBExchange(c,s,{...plan(),endTimeS:0},'candidate',recover),'CLOCK')
    throws(()=>stageBExchange(c,s,{...plan(),cellHeatIntoJ:new Float64Array([NaN,0])},'candidate',recover),'INVALID_INPUT')
    const bad=JSON.parse(JSON.stringify(c)) as BContext;Reflect.set(bad.cells[0],'resolvedVoidFraction',0.1)
    throws(()=>validateBContext(bad),'GEOMETRY')
    throws(()=>validateBContext({...c,bounds:{...c.bounds,maxOutgoingFraction:1}}),'INVALID_INPUT')
  }},
  {name:'recovered thermodynamic fields must satisfy declared bounds',run(){
    const c=context(),s=state(c)
    throws(()=>stageBExchange(c,s,plan(),'candidate',(a,b)=>{const f=recover(a,b);f.temperatureK[0]=2000;return f}),'INVALID_INPUT')
    throws(()=>stageBExchange(c,s,plan(),'candidate',(a,b)=>{const f=recover(a,b);f.gasPressurePa[0]=Infinity;return f}),'INVALID_INPUT')
  }},
]
export function runBContractFixture():{
  kind:'manufactured-numerical-contract-checks';tests:number;assertions:number;
  passed:number;failed:readonly {name:string;message:string}[];
  currentMainVerified:false;experimentalSupport:false
}{
  assertions=0
  const failed:{name:string;message:string}[]=[]
  for(const t of cases){try{t.run()}catch(e){failed.push({name:t.name,message:String(e)})}}
  return {kind:'manufactured-numerical-contract-checks',tests:cases.length,assertions,
    passed:cases.length-failed.length,failed,currentMainVerified:false,experimentalSupport:false}
}
