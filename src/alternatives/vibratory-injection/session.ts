import type { FieldSettings, FieldState } from './field'
import type { FieldMessage } from './field.worker'

export interface FieldSession {
  key:string; status:'calculating'|'complete'|'failed'|'cancelled'; history:FieldState[]; error:string
}
export const fieldRequestKey=(settings:FieldSettings,generation:number)=>JSON.stringify([settings,generation])
export const pendingFieldSession=(key:string):FieldSession=>({key,status:'calculating',history:[],error:''})
/** Render-time selection invalidates old data before passive worker cleanup. */
export const visibleFieldSession=(session:FieldSession,key:string)=>session.key===key?session:pendingFieldSession(key)
export function receiveFieldMessage(session:FieldSession,key:string,message:FieldMessage):FieldSession {
  if(session.key!==key||session.status!=='calculating')return session
  const last=session.history.at(-1),state=message.state
  // Do not rewind an accepted history on duplicated or out-of-order checkpoints.
  const history=state&&(!last||state.timeS>last.timeS+1e-9)?[...session.history,state]:session.history
  return {...session,history,status:message.type==='state'?'calculating':message.type==='complete'?'complete':'failed',
    error:message.type==='failed'?message.error??'Calculation stopped at its last accepted state.':''}
}
