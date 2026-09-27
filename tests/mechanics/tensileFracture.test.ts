import { expect,it } from 'vitest'
import { DEFAULT_TENSILE,compareTensileObservations,parseTensileCsv,runTensileFracture,tensileScales } from '../../src/mechanics/tensileFracture'
it('separates with the specified fracture energy and conserves external work',()=>{
 const p=DEFAULT_TENSILE,frames=runTensileFracture(p),s=tensileScales(p)
 for(const f of frames){expect(Math.abs(f.energyResidualJ)).toBeLessThan(1e-12);expect(f.forceN).toBeGreaterThanOrEqual(0);expect(f.damage).toBeGreaterThanOrEqual(0);expect(f.damage).toBeLessThanOrEqual(1)}
 expect(frames.at(-1)!.fractureDissipationJ).toBeCloseTo(p.fractureEnergyJm2*s.areaM2,12)
 expect(frames.at(-1)!.storedEnergyJ).toBe(0)
 expect(frames.at(-1)!.damage).toBe(1)
 expect(frames.at(-1)!.forceN).toBe(0)
 for(let i=1;i<frames.length;i++) expect(frames[i].damage).toBeGreaterThanOrEqual(frames[i-1].damage)
})
it('is objective to bar mesh and load-increment refinement',()=>{
 const runs=[2,4,8,32].map(elements=>runTensileFracture({...DEFAULT_TENSILE,elements}))
 for(const run of runs) for(let i=0;i<run.length;i++){expect(run[i].forceN).toBeCloseTo(runs[0][i].forceN,10);expect(run[i].openingM).toBeCloseTo(runs[0][i].openingM,12)}
 const fine=runTensileFracture({...DEFAULT_TENSILE,increments:200})
 for(let i=0;i<runs[0].length;i++)expect(fine[2*i].forceN).toBeCloseTo(runs[0][i].forceN,10)
})
it('rejects snap-back and excessive bulk strain instead of inventing a branch',()=>{
 expect(()=>runTensileFracture({...DEFAULT_TENSILE,fractureEnergyJm2:0.1})).toThrow('Snap-back')
 expect(()=>runTensileFracture({...DEFAULT_TENSILE,youngsPa:10000,fractureEnergyJm2:100})).toThrow('2%')
 expect(()=>runTensileFracture({...DEFAULT_TENSILE,strengthPa:NaN})).toThrow()
})
it('reports observation errors without extrapolation or a circular validation claim',()=>{
 const frames=runTensileFracture(DEFAULT_TENSILE)
 const points=frames.slice(0,101).filter((_,i)=>i%10===0).map(f=>({extensionM:f.extensionM,forceN:f.forceN}))
 expect(compareTensileObservations(frames,points).rmseN).toBeLessThan(1e-12)
 expect(compareTensileObservations(frames,points.map(p=>({...p,forceN:p.forceN*1.2}))).rmseN).toBeGreaterThan(0)
 expect(()=>compareTensileObservations(frames,[...points,{extensionM:1,forceN:0}])).toThrow('no extrapolation')
 expect(()=>compareTensileObservations(frames,[points[1],points[0],points[2]])).toThrow()
})

it('recovers the independent bilinear force law and irreversible partial unloading',()=>{
 const p=DEFAULT_TENSILE,A=Math.PI*p.diameterM**2/4,C=p.lengthM/p.youngsPa
 const d0=p.strengthPa/p.interfaceStiffnessPam,dc=2*p.fractureEnergyJm2/p.strengthPa
 const openings=[0,d0/2,d0,(d0+dc)/2,dc]
 const tractions=[0,p.strengthPa/2,p.strengthPa,p.strengthPa/2,0]
 const targets=openings.map((d,i)=>d+C*tractions[i])
 const frames=runTensileFracture(p,targets)
 frames.forEach((f,i)=>{expect(f.openingM).toBeCloseTo(openings[i],12);expect(f.forceN).toBeCloseTo(tractions[i]*A,10)})
 const peak=targets[3],partial=runTensileFracture(p,[0,peak,peak/2,0,peak/2,peak])
 expect(partial[2].forceN).toBeCloseTo(partial[1].forceN/2,10)
 expect(partial[3].forceN).toBe(0)
 expect(partial[5].forceN).toBeCloseTo(partial[1].forceN,10)
 for(const f of partial.slice(1)){expect(f.damage).toBe(partial[1].damage);expect(f.fractureDissipationJ).toBeCloseTo(partial[1].fractureDissipationJ,12);expect(Math.abs(f.energyResidualJ)).toBeLessThan(1e-12)}
 expect(()=>runTensileFracture(p,[0,-1])).toThrow('Compression/contact')
})
it('converts measurement units and rejects malformed or nonfinite CSV observations',()=>{
 const frames=runTensileFracture(DEFAULT_TENSILE)
 const points=parseTensileCsv('extension_mm,force_N\r\n0,0\r\n0.2,3\r\n0.4,9\r\n')
 expect(points[1]).toEqual({extensionM:0.0002,forceN:3})
 expect(compareTensileObservations(frames,points).rmseN).toBeGreaterThan(0)
 expect(()=>parseTensileCsv('extension_m,force_N\n0,0')).toThrow('header')
 expect(()=>parseTensileCsv('extension_mm,force_N\n,0')).toThrow('numeric')
 expect(()=>compareTensileObservations(frames,parseTensileCsv('extension_mm,force_N\n0,0\n0.2,NaN\n0.4,9'))).toThrow('nonnegative')
})
