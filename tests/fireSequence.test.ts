import { describe, expect, it } from 'vitest'
import { CatmullRomCurve3, Vector3 } from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G, storyCapShape, constrainedCapShape, fixedBoreCapShape, sourceContactFracture, rapidFractureProgress, rapidWettingProgress, rapidGasPulse, rapidGasQuench, constrainedSoilLiftAt, constrainedWettingProgress, openPitDepthAt, openPitRadiusAtY, CONSTRAINED_CRACK_PATHS, SOURCE_CONTACT_CRACK_PATHS, RAPID_PEAT_CRACK_PATHS, storyHosePoints, STORY_HOSE_POINTS, STORY_CRACK_PATHS, storyWettingProgress, acceptedFireFrame, fireSequencePose, illustratedPeatCoverage, illustratedPeatFront, storyToPlayback, playbackToStory } from '../src/story/fireSequence'

describe('story and accepted-state separation', () => {
  const frames = [
    { timeS: 0, phase: 'forced-ignition', dryIceKg: 0 },
    { timeS: 86400, phase: 'unforced-reaction', dryIceKg: 0 },
    { timeS: 86400, phase: 'treatment', dryIceKg: 4 },
    { timeS: 86402, phase: 'treatment', dryIceKg: 3.99 },
    { timeS: 86430, phase: 'treatment', dryIceKg: 3.85 },
  ]
  it('keeps the pre-insertion state before the story intervention', () => {
    expect(acceptedFireFrame(frames, 54.9)).toBe(frames[1])
    expect(acceptedFireFrame(frames, 55)).toBe(frames[2])
  })
  it('selects accepted frames without scalar or mass interpolation', () => {
    expect(acceptedFireFrame(frames, 56)).toBe(frames[2])
    expect(acceptedFireFrame(frames, 57)).toBe(frames[3])
    expect(acceptedFireFrame(frames, 85)).toBe(frames[4])
    expect(acceptedFireFrame(frames, 90)).toBe(frames[4])
  })
  it('retains the final growth result when treatment was not accepted', () => {
    expect(acceptedFireFrame(frames.slice(0, 2), 80)).toBe(frames[1])
    expect(acceptedFireFrame([], 80)).toBeUndefined()
  })
  it('matches the film ignition and later growth clocks', () => {
    const history = [
      { timeS:0,phase:'forced-ignition' },
      { timeS:3600,phase:'forced-ignition' },
      { timeS:7200,phase:'unforced-reaction' },
      { timeS:86400,phase:'unforced-reaction' },
      { timeS:86400,phase:'treatment' },
    ]
    expect(acceptedFireFrame(history,5,7200)).toBe(history[1])
    expect(acceptedFireFrame(history,10,7200)).toBe(history[2])
    expect(acceptedFireFrame(history,24,7200)).toBe(history[3])
    expect(acceptedFireFrame(history,54.9,7200)).toBe(history[3])
    expect(acceptedFireFrame(history,55,7200)).toBe(history[4])
  })
  it('clamps the ignition cutoff to the last accepted early-stop state', () => {
    const partial = [
      { timeS:0,phase:'forced-ignition' },
      { timeS:1800,phase:'forced-ignition' },
      { timeS:3600,phase:'forced-ignition' },
    ]
    expect(acceptedFireFrame(partial,5,7200)).toBe(partial[1])
    for(const time of [10,24,55,90]) expect(acceptedFireFrame(partial,time,7200)).toBe(partial[2])
  })
  it('does not excavate before contact and clears the drill before source entry', () => {
    expect(fireSequencePose(25, 'gradual').drillDepth).toBe(0)
    expect(fireSequencePose(31, 'gradual').drillDepth).toBeCloseTo(1.385)
    const drop = fireSequencePose(39, 'gradual')
    expect(drop.drillVisible).toBe(false)
    expect(drop.sourceVisible).toBe(true)
    expect(drop.drillDepth).toBeCloseTo(1.385)
  })
})

describe('constrained current cap and water illustration',()=>{
  it('opens an excavated pit before placement and backfills it before pressure',()=>{
    expect(openPitDepthAt(23.9)).toBe(0)
    expect(openPitDepthAt(34)).toBeCloseTo(G.pitDepthM)
    expect(openPitDepthAt(52)).toBeCloseTo(G.pitDepthM)
    expect(openPitDepthAt(55)).toBe(0)
    expect(openPitRadiusAtY(0,G.pitDepthM)).toBeCloseTo(G.pitTopRadiusM)
    expect(openPitRadiusAtY(-G.pitDepthM,G.pitDepthM)).toBeCloseTo(G.pitBottomRadiusM)
    expect(openPitRadiusAtY(-.98,G.pitDepthM)).toBeGreaterThan(constrainedCapShape(58,'rapid').radiusM)
  })
  it('starts concave, then flattens with a bounded diameter increase',()=>{
    const before=constrainedCapShape(54,'rapid'),after=constrainedCapShape(58,'rapid')
    expect(before.depthM).toBeCloseTo(.22)
    expect(after.depthM).toBe(0)
    expect(before.radiusM).toBeCloseTo(.49)
    expect(after.radiusM).toBeCloseTo(before.meridianLengthM)
    expect(after.radiusM).toBeGreaterThan(before.radiusM)
    expect(after.radiusM).toBeLessThan(G.cavityRadiusM*.92)
    expect(constrainedCapShape(90,'gradual').depthM).toBeCloseTo(.22)
  })
  it('lifts only nearby overburden and finishes wetting short branches after the hose enters',()=>{
    expect(constrainedSoilLiftAt(G.sourceX,0,0,58,'rapid')).toBeCloseTo(.04)
    expect(constrainedSoilLiftAt(3,0,0,58,'rapid')).toBe(0)
    expect(constrainedSoilLiftAt(G.sourceX,0,0,58,'gradual')).toBe(0)
    expect(CONSTRAINED_CRACK_PATHS).toHaveLength(3)
    for(let i=0;i<CONSTRAINED_CRACK_PATHS.length;i++){
      expect(constrainedWettingProgress(71,i)).toBe(0)
      expect(constrainedWettingProgress(90,i)).toBe(1)
    }
  })
})

describe('straight-bore animation variant',()=>{
  it('uses the original fixed bore and keeps the cap inside it throughout descent and treatment',()=>{
    const cap=fixedBoreCapShape()
    expect(G.augerRadiusM).toBeLessThan(G.boreRadiusM)
    expect(cap.radiusM).toBeLessThan(G.boreRadiusM)
    expect(cap.depthM).toBeGreaterThan(0)
    for(const time of [47,48,50,51.5,55,65,90]){
      expect(fixedBoreCapShape()).toEqual(cap)
      expect(fireSequencePose(time,'rapid').drillDepth).toBeCloseTo(G.boreDepthM)
    }
    expect(fireSequencePose(48,'rapid').capY).toBeGreaterThan(fireSequencePose(51.5,'rapid').capY)
  })
  it('retains short contact fractures for the gradual scene',()=>{
    expect(fireSequencePose(44,'rapid').sourceY).toBeCloseTo(-G.sourceDepthM)
    expect(sourceContactFracture(43.9)).toBe(0)
    expect(sourceContactFracture(44.8)).toBeGreaterThan(0)
    expect(sourceContactFracture(45.5)).toBe(1)
    expect(SOURCE_CONTACT_CRACK_PATHS).toHaveLength(3)
    expect(SOURCE_CONTACT_CRACK_PATHS[0].at(-1)![1]).toBeGreaterThan(-1)
  })
  it('orders the rapid release after the fixed cap and before peat-wide water entry',()=>{
    expect(fireSequencePose(44,'rapid').sourceY).toBeCloseTo(-G.sourceDepthM)
    expect(fireSequencePose(51.5,'rapid').capY).toBeCloseTo(-G.capDepthM)
    expect(RAPID_PEAT_CRACK_PATHS.length).toBeGreaterThanOrEqual(10)
    expect(RAPID_PEAT_CRACK_PATHS.map(path=>path.at(-1)![0]).some(x=>x < -1.8)).toBe(true)
    expect(RAPID_PEAT_CRACK_PATHS.map(path=>path.at(-1)![0]).some(x=>x > 3)).toBe(true)
    expect(rapidFractureProgress(54.99,0)).toBe(0)
    expect(rapidGasPulse(55.3)).toBeGreaterThan(0)
    expect(rapidFractureProgress(56,0)).toBeGreaterThan(0)
    expect(rapidGasQuench(57.1)).toBe(1)
    expect(rapidWettingProgress(71.99,0)).toBe(0)
    expect(rapidWettingProgress(90,RAPID_PEAT_CRACK_PATHS.length-1)).toBe(1)
    expect(fixedBoreCapShape().radiusM).toBeLessThan(G.boreRadiusM)
  })
})

describe('variable playback clock and illustrated treatment trigger', () => {
  it('plays the release interval 1:1 and completes the 90-second story in 36 seconds', () => {
    expect(storyToPlayback(90)).toBeCloseTo(36, 12)
    expect(storyToPlayback(61)-storyToPlayback(55)).toBeCloseTo(6, 12)
    expect(playbackToStory(1)).toBeCloseTo(2.8, 12)
    for(const t of [0,8,12,24,37,47,55,58,61,69,85,90]) expect(playbackToStory(storyToPlayback(t))).toBeCloseTo(t, 10)
  })
  it('locks drilling until 70% illustrated coverage and keeps substantial fire after treatment', () => {
    for(const time of [0,8,12,18,23.999]) {
      expect(illustratedPeatCoverage(time)).toBeLessThan(.7)
      expect(fireSequencePose(time,'rapid').drillVisible).toBe(false)
      expect(fireSequencePose(time,'rapid').sourceVisible).toBe(false)
      expect(fireSequencePose(time,'rapid').capVisible).toBe(false)
    }
    expect(illustratedPeatCoverage(24)).toBe(.7)
    expect(fireSequencePose(24,'rapid').drillVisible).toBe(true)
    expect(illustratedPeatCoverage(90)).toBe(.7)
    const q=illustratedPeatFront(.7)
    expect((Math.acos(q)-q*Math.sqrt(1-q*q))/Math.PI).toBeCloseTo(.7, 8)
  })
  it('seats the inverted plate below ground and inverts it only in the illustrative rapid mode', () => {
    const initial=fireSequencePose(54,'rapid'),inverted=fireSequencePose(61,'rapid')
    expect(initial.capY).toBeCloseTo(-.98)
    expect(initial.capY-G.capRiseM+initial.bend).toBeCloseTo(-1.14)
    expect(inverted.capY-G.capRiseM+inverted.bend).toBeCloseTo(-.82)
    expect(fireSequencePose(90,'gradual').bend).toBe(0)
  })
})

describe('coherent authored intervention geometry', () => {
  it('opens the buried chamber before lowering a folded shell through the original shaft', () => {
    expect(G.boreRadiusM).toBe(.24)
    expect(G.capFoldedRadiusM).toBeLessThan(G.boreRadiusM)
    expect(G.capRadiusM).toBeGreaterThan(G.boreRadiusM*2)
    expect(fireSequencePose(31,'gradual').underream).toBe(0)
    expect(fireSequencePose(33,'gradual').underream).toBe(1)
    expect(fireSequencePose(34,'gradual').cutterExtension).toBe(0)
    expect(fireSequencePose(39,'gradual').drillVisible).toBe(false)
    for(let t=47;t<=54;t+=.05){
      const cap=storyCapShape(t,'gradual')
      if(cap.rimY>-.67)expect(cap.radiusM).toBeLessThan(G.boreRadiusM)
      for(let q=.04;q<=1;q+=.02){
        const radius=cap.radiusM*q,y=cap.rimY+.38*(1-q)*(1-cap.deployment)-cap.riseM*(1-q*q)*cap.deployment
        if(y>=0)continue
        const inShaft=radius<G.boreRadiusM&&y>-G.boreDepthM
        const inPocket=(radius/G.cavityRadiusM)**2+((y-G.cavityCenterY)/G.cavityHalfHeightM)**2<1
        expect(inShaft||inPocket).toBe(true)
      }
    }
  })
  it('leaves room for the source and hose, then engages the chamber shoulder only at the rapid event', () => {
    const sourceRadius=Math.cbrt(3*G.sourceInitialMassKg/(4*Math.PI*G.sourceDensityKgM3))
    expect(-G.capDepthM-G.capRiseM).toBeGreaterThan(-G.sourceDepthM+sourceRadius)
    for(const[x,y,z]of STORY_HOSE_POINTS.filter(p=>p[1]<0)){
      const radial=Math.hypot(x-G.sourceX,z)+G.hoseRadiusM
      const pocketRadius=G.cavityRadiusM*Math.sqrt(Math.max(0,1-((y-G.cavityCenterY)/G.cavityHalfHeightM)**2))
      expect(radial).toBeLessThan(Math.max(G.boreRadiusM,pocketRadius))
      if(y<-.7&&y>-1.2)expect(Math.abs(Math.atan2(x-G.sourceX,z)-G.capGapCenterRad)+Math.asin(G.hoseRadiusM/Math.hypot(x-G.sourceX,z))).toBeLessThan(G.capGapHalfAngleRad)
      expect(Math.hypot(x-G.sourceX,y+G.sourceDepthM,z-.012)).toBeGreaterThan(sourceRadius+G.hoseRadiusM)
    }
    expect(storyCapShape(54.99,'rapid').wedgeRadiusM).toBeLessThan(G.cavityRadiusM)
    expect(storyCapShape(55.65,'rapid').wedgeRadiusM).toBeGreaterThan(G.cavityRadiusM)
    for(const t of [0,44,54.999,55])expect(fireSequencePose(t,'rapid').crack).toBe(0)
    expect(fireSequencePose(55.01,'rapid').crack).toBeGreaterThan(0)
    for(const t of [55,55.65,70,90])expect(fireSequencePose(t,'gradual').crack).toBe(0)
  })
  it('advances a slow, partial water front only after hose insertion and staggers branches', () => {
    expect(fireSequencePose(72,'rapid').hoseInsertion).toBe(1)
    for(let i=0;i<STORY_CRACK_PATHS.length;i++){
      expect(storyWettingProgress(72,i)).toBe(0)
      let previous=0
      for(let t=72;t<=90;t+=.25){const f=storyWettingProgress(t,i);expect(f).toBeGreaterThanOrEqual(previous);expect(f).toBeLessThanOrEqual(.66);previous=f}
    }
    expect(storyWettingProgress(74,0)).toBeGreaterThan(storyWettingProgress(74,4))
    expect(storyWettingProgress(90,0)).toBeCloseTo(.66)
  })
})

it('densely samples the exact rendered hose throughout insertion for shaft, source and shell-gap clearance',()=>{
  const sourceRadius=Math.cbrt(3*G.sourceInitialMassKg/(4*Math.PI*G.sourceDensityKgM3))
  let minimumWall=Infinity,minimumSource=Infinity,minimumGap=Infinity
  for(let t=69;t<=72.001;t+=.05){
    const curve=new CatmullRomCurve3(storyHosePoints(t).map(p=>new Vector3(...p)),false,'centripetal')
    for(const p of curve.getSpacedPoints(500)){
      if(p.y>=0)continue
      const radial=Math.hypot(p.x-G.sourceX,p.z),pocketRadius=G.cavityRadiusM*Math.sqrt(Math.max(0,1-((p.y-G.cavityCenterY)/G.cavityHalfHeightM)**2))
      minimumWall=Math.min(minimumWall,Math.max(G.boreRadiusM,pocketRadius)-radial-G.hoseRadiusM)
      minimumSource=Math.min(minimumSource,Math.hypot(p.x-G.sourceX,p.y+G.sourceDepthM,p.z-.012)-G.hoseRadiusM-sourceRadius)
      if(p.y<-.77&&p.y>-1.17)minimumGap=Math.min(minimumGap,G.capGapHalfAngleRad-Math.abs(Math.atan2(p.x-G.sourceX,p.z)-G.capGapCenterRad)-Math.asin(G.hoseRadiusM/radial))
    }
  }
  expect(minimumWall).toBeGreaterThan(.01)
  expect(minimumSource).toBeGreaterThan(.015)
  expect(minimumGap).toBeGreaterThan(.05)
})
