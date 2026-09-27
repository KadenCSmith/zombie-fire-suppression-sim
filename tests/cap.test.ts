import {it,expect} from 'vitest'
import {CapShell,DEFAULT_CAP} from '../src/coupled/cap'
it('recovers the analytical clamped circular plate limit and quadrature area',()=>{
 const p={...DEFAULT_CAP,riseM:0},cap=new CapShell(8,8,4,8,8,4.4,4,p),pressure=new Float64Array(256).fill(1000),s=cap.evaluate(pressure),D=p.youngsPa*p.thicknessM**3/(12*(1-p.poisson**2)),expected=1000*p.radiusM**4/(64*D)
 expect(s.state.flexM/expected).toBeCloseTo(1,3);expect(cap.covered.reduce((a,b)=>a+b,0)).toBeCloseTo(Math.PI*p.radiusM**2,12);expect(s.state.pressureForceN).toBeCloseTo(1000*cap.area,8)
})
it('resolves compressive bedding, anchor tension and cap energy conjugacy',()=>{
 const cap=new CapShell(8,8,4,8,8,4.4,4),zero=cap.evaluate(new Float64Array(256)),loaded=cap.evaluate(new Float64Array(256).fill(10));expect(zero.state.energyJ).toBeCloseTo(0,12);expect(zero.state.gapM).toBe(0)
 const volume=loaded.volume.reduce((a,b)=>a+b,0);expect(loaded.state.energyJ).toBeCloseTo(0.5*10*volume,8)
 const lifted=cap.evaluate(new Float64Array(256).fill(1000));expect(lifted.state.contactN).toBe(0);expect(lifted.state.gapM).toBeGreaterThan(0);expect(lifted.state.anchorN).toBeCloseTo(lifted.state.pressureForceN-cap.mass*9.80665,8)
})
it('maps cap pressure forces and cavity volume by virtual work on the same nodes',()=>{
 const cap=new CapShell(8,8,4,8,8,4.4,4),p=Float64Array.from({length:256},(_,i)=>Math.sin(i)*100),u=Float64Array.from({length:cap.nodeCount*3},(_,i)=>Math.cos(i)*1e-5),a=cap.evaluate(p),b=cap.evaluate(p,u)
 let work=0,volumeWork=0;for(let i=0;i<u.length;i++)work+=a.force[i]*u[i];for(let i=0;i<p.length;i++)volumeWork+=p[i]*(b.volume[i]-a.volume[i]);expect(work).toBeCloseTo(volumeWork,12)
})
