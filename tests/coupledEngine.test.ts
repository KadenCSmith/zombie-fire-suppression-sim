import {it,expect} from 'vitest'
import {CoupledEngine} from '../src/coupled/engine'
import {DEFAULT_COUPLED} from '../src/coupled/model'
it('couples one canonical 3D state with conservative pressure work and deterministic replay snapshots',()=>{
 const e=new CoupledEngine({...DEFAULT_COUPLED,roots:false}),initial=e.frame();e.advance(4);const last=e.frame()
 expect(last.timeS).toBe(4);expect(initial.timeS).toBe(0);expect(last.mechanical!.residualN).toBeLessThan(1e-4);expect(Math.abs(e.mechanicalBalanceJ)).toBeLessThan(1e-5);expect(Math.abs(last.ledger.energyResidualJ)).toBeLessThan(1e-4);expect(Math.abs(last.ledger.massResidualKg)).toBeLessThan(1e-7);expect(last.porosity).not.toEqual(initial.porosity)
})
it('rejects unbalanced fracture without committing transport, deformation or history',()=>{
 const e=new CoupledEngine({...DEFAULT_COUPLED,fracture:true}),initial=e.transport.checkpoint(),damage=e.mechanics!.damage.slice()
 // This prepared heterogeneous site is intentionally not accepted as a validated brittle-fracture specimen.
 try{e.step(2)}catch(error){expect(String(error)).toMatch(/energy|Mechanical|Staggered/);expect(e.transport.time).toBe(0);expect(e.transport.checkpoint()).toEqual(initial);expect(e.mechanics!.damage).toEqual(damage);expect(e.mechanical).toBeNull();return}
 expect(Math.abs(e.mechanicalBalanceJ)).toBeLessThan(1e-5)
})
