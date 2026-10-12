import {describe,expect,it} from 'vitest'
import {FIELD_DEFAULTS,VibratoryFieldRun} from '../../../src/alternatives/vibratory-injection/field'
import {fieldRequestKey,pendingFieldSession,receiveFieldMessage,visibleFieldSession} from '../../../src/alternatives/vibratory-injection/session'

describe('private calculated-field session lifecycle',()=>{
  const settings={...FIELD_DEFAULTS,endS:.125},key=fieldRequestKey(settings,0)
  const sample=new VibratoryFieldRun(settings).snapshot()
  it('hides accepted history synchronously under changed settings or recalculation',()=>{
    const old=receiveFieldMessage(pendingFieldSession(key),key,{jobId:'old',type:'state',state:sample})
    const changed=fieldRequestKey({...settings,waterKg:1},0)
    expect(visibleFieldSession(old,changed).history).toEqual([])
    expect(visibleFieldSession(old,changed).status).toBe('calculating')
    expect(visibleFieldSession(old,fieldRequestKey(settings,1)).history).toEqual([])
    expect(visibleFieldSession(old,key).history).toEqual([sample])
  })
  it('ignores old job state and does not rewind duplicate/out-of-order checkpoints',()=>{
    const initial=pendingFieldSession(key)
    expect(receiveFieldMessage(initial,'superseded',{jobId:'old',type:'state',state:sample})).toBe(initial)
    const later={...sample,timeS:1},accepted=receiveFieldMessage(initial,key,{jobId:'new',type:'state',state:later})
    expect(receiveFieldMessage(accepted,key,{jobId:'new',type:'state',state:sample}).history).toEqual([later])
    expect(receiveFieldMessage(accepted,key,{jobId:'new',type:'state',state:later}).history).toEqual([later])
  })
  it('preserves the last accepted state on failure and reports failure without history',()=>{
    const accepted=receiveFieldMessage(pendingFieldSession(key),key,{jobId:'a',type:'state',state:sample})
    const failed=receiveFieldMessage(accepted,key,{jobId:'a',type:'failed',error:'Rejected source'})
    expect(failed.history).toEqual([sample]);expect(failed.status).toBe('failed');expect(failed.error).toBe('Rejected source')
    const empty=receiveFieldMessage(pendingFieldSession(key),key,{jobId:'b',type:'failed',error:'Initialization failed'})
    expect(empty.history).toEqual([]);expect(empty.status).toBe('failed')
    expect(receiveFieldMessage(failed,key,{jobId:'a',type:'state',state:{...sample,timeS:2}})).toBe(failed)
  })
  it('ignores late messages after cancellation/completion and resets to a clean owned session',()=>{
    const cancelled={...pendingFieldSession(key),status:'cancelled' as const}
    expect(receiveFieldMessage(cancelled,key,{jobId:'a',type:'state',state:sample})).toBe(cancelled)
    const complete=receiveFieldMessage(pendingFieldSession(key),key,{jobId:'a',type:'complete',state:sample})
    expect(complete.status).toBe('complete')
    expect(receiveFieldMessage(complete,key,{jobId:'a',type:'failed'})).toBe(complete)
    expect(pendingFieldSession(key).history).toEqual([])
  })
})
