import {describe,it,expect} from 'vitest'
import {PeatSolver,DEFAULT_SETTINGS} from '../src/peatfem/coupled'
import {CONSTITUENTS,REACTIONS} from '../src/peatfem/chemistry'
import {readRecording,RECORDING_REVISION} from '../src/peatfem/recording'
function fixture(){
  const solver=new PeatSolver({...DEFAULT_SETTINGS,n:4}),history=[solver.snapshot(),solver.advance(.01)]
  const text=JSON.stringify({format:'peat-fire-q1-fem',schema:2,solverRevision:RECORDING_REVISION,settings:solver.settings,material:CONSTITUENTS,reactions:REACTIONS,history},(_,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as ArrayLike<number>):v)
  return {solver,text}
}
describe('FEM recording replay and deterministic continuation',()=>{
  it('round-trips typed inventories and reproduces the next accepted state',()=>{
    const {solver,text}=fixture(),record=readRecording(text),restored=new PeatSolver(record.settings)
    restored.restore(record.history.at(-1)!);solver.advance(.01);restored.advance(.01)
    expect(Array.from(restored.frame.temperature)).toEqual(Array.from(solver.frame.temperature))
    expect(Array.from(restored.frame.gas[2])).toEqual(Array.from(solver.frame.gas[2]))
  })
  it('rejects unsupported equations, EOS corruption and nonconservative ledgers',()=>{
    const {text}=fixture(),data=JSON.parse(text)
    expect(()=>readRecording(text.replace(RECORDING_REVISION,'old-unknown'))).toThrow('revision')
    const unknown=JSON.parse(text);unknown.settings.constructor={};expect(()=>readRecording(JSON.stringify(unknown))).toThrow('settings')
    data.history[1].pressure[0]*=2;expect(()=>readRecording(JSON.stringify(data))).toThrow('EOS')
    data.history[1].pressure[0]/=2;data.history[1].ledger.reactionJ+=100;expect(()=>readRecording(JSON.stringify(data))).toThrow('ledger')
  })
  it('rejects incomplete pools, nonfinite fields and duplicate times',()=>{
    const {text}=fixture(),data=JSON.parse(text)
    data.history[1].gas.pop();expect(()=>readRecording(JSON.stringify(data))).toThrow('Four gas')
    const duplicate=JSON.parse(text);duplicate.history[1].timeS=0;expect(()=>readRecording(JSON.stringify(duplicate))).toThrow('times')
    const invalid=JSON.parse(text);invalid.history[1].water[0]=null;expect(()=>readRecording(JSON.stringify(invalid))).toThrow('field')
  })
})
