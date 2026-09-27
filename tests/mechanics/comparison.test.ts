import { describe, expect, it } from 'vitest'
import { ContinuumMechanics, DEFAULT_CONTINUUM_MATERIAL } from '../../src/mechanics/continuum'
import { DEFAULT_BENCHMARK, fieldValues, maxPrincipalStrain, peakDisplacement, runMechanicsBenchmark } from '../../src/mechanics/comparison'

describe('paired constitutive benchmark', () => {
  it('uses explicit elasticity even at low yield intercept and recovers after unloading', () => {
    const m = new ContinuumMechanics(2,2,2,2,2,1,{...DEFAULT_CONTINUUM_MATERIAL,cohesionPa:1,constitutiveLaw:'elastic'})
    const loaded=m.solveTopTraction(9000,1e-5)
    for (let q=2;q<loaded.strain.length;q+=6) expect(loaded.strain[q]).toBeCloseTo(-0.009,8)
    expect(loaded.accumulatedPlasticStrain.every(v=>v===0)).toBe(true)
    expect(loaded.reactionN[2]).toBeCloseTo(-36000,3)
    expect(peakDisplacement(m.solveTopTraction(0,1e-5))).toBeLessThan(1e-8)
  })
  it('matches an independent uniaxial plastic solution and retains permanent strain', () => {
    const run=runMechanicsBenchmark(DEFAULT_BENCHMARK,'drucker-prager')
    expect(run.status, `${run.message}; stage ${run.frames.at(-1)?.stage}`).toBe('complete')
    const peak=run.frames[DEFAULT_BENCHMARK.increments].result
    const m=DEFAULT_BENCHMARK.material, p=DEFAULT_BENCHMARK.tractionPa
    // Uniaxial compression: q=p and mean pressure=p/3; alpha follows f=0.
    const alpha=(p*(1-m.frictionSlope/3)-m.cohesionPa)/m.hardeningPa
    expect(alpha).toBeGreaterThan(0)
    for (const v of peak.accumulatedPlasticStrain) expect(v).toBeCloseTo(alpha,7)
    const epsZ=-p/m.youngsPa-alpha*(1-m.dilationSlope/3)
    expect(peak.strain[2]).toBeCloseTo(epsZ,7)
    const last=run.frames.at(-1)!.result
    expect(last.strain[2]).toBeCloseTo(-alpha*(1-m.dilationSlope/3),7)
    expect(peakDisplacement(last)).toBeGreaterThan(0.005)
    for (const frame of run.frames) {
      expect(frame.result.residualN).toBeLessThan(0.0001)
      expect(frame.result.reactionN[2]+frame.result.appliedForceN[2]).toBeCloseTo(0,3)
      expect(frame.result.geostaticResidualN).toBeLessThan(1e-8)
    }
  })
  it('compares identical load stages on 1³, 2³ and 4³ meshes and refined load increments', () => {
    const runs=[1,2,4].map(resolution=>runMechanicsBenchmark({...DEFAULT_BENCHMARK,resolution},'drucker-prager'))
    const refined=runMechanicsBenchmark({...DEFAULT_BENCHMARK,increments:20},'drucker-prager')
    for (const run of [...runs,refined]) {
      expect(run.status, `${run.message}; stage ${run.frames.at(-1)?.stage}`).toBe('complete')
      expect(run.frames.at(-1)!.result.strain[2]).toBeCloseTo(runs[0].frames.at(-1)!.result.strain[2],7)
    }
    const elastic=runMechanicsBenchmark(DEFAULT_BENCHMARK,'elastic')
    expect(elastic.frames.map(f=>f.tractionPa)).toEqual(runs[1].frames.map(f=>f.tractionPa))
    expect(elastic.frames.at(-1)!.result.strain[2]).toBeCloseTo(0,8)
    const original=runs[1].frames[10].result.displacementM.slice()
    fieldValues(runs[1].frames[20],'stress',2);fieldValues(runs[1].frames[0],'mesh',2)
    expect(runs[1].frames[10].result.displacementM).toEqual(original)
  },20000)
  it('stops before accepting a large-strain frame and reports the last valid stage', () => {
    const run=runMechanicsBenchmark({...DEFAULT_BENCHMARK,tractionPa:20000},'drucker-prager')
    expect(run.status).toBe('limited')
    expect(run.frames.length).toBeLessThan(21)
    expect(run.message).toContain('2%')
    for (const f of run.frames) expect(maxPrincipalStrain(f.result.strain)).toBeLessThanOrEqual(0.02)
    expect(maxPrincipalStrain([0,0,0,0.06,0,0])).toBeCloseTo(0.03,10)
  })
  it('rejects invalid inputs and mismatched checkpoint laws without changing legacy restart', () => {
    expect(()=>runMechanicsBenchmark({...DEFAULT_BENCHMARK,tractionPa:NaN},'elastic')).toThrow()
    expect(()=>runMechanicsBenchmark({...DEFAULT_BENCHMARK,material:{...DEFAULT_BENCHMARK.material,dilationSlope:0.8}},'elastic')).toThrow()
    const plastic=new ContinuumMechanics(1,1,1,1,1,1)
    const {constitutiveLaw: _law,...oldCheckpoint}=plastic.checkpoint()
    plastic.restore(oldCheckpoint)
    const elastic=new ContinuumMechanics(1,1,1,1,1,1,{...DEFAULT_CONTINUUM_MATERIAL,constitutiveLaw:'elastic'})
    expect(()=>elastic.restore(oldCheckpoint)).toThrow('constitutive law')
    elastic.restore(elastic.checkpoint())
  })
})
