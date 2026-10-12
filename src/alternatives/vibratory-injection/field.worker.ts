/** HISTORICAL V2 liquid experiment. Inactive in the current vibration-only workspace; not vibration validation. */
import { VibratoryFieldRun, type FieldSettings, type FieldState } from './field'

export type FieldMessage = { jobId: string; type: 'state' | 'complete' | 'failed'; state?: FieldState; error?: string }
self.onmessage = async (event: MessageEvent<{ jobId:string; settings:FieldSettings }>) => {
  const {jobId,settings}=event.data
  let run:VibratoryFieldRun|undefined
  try {
    run=new VibratoryFieldRun(settings)
    self.postMessage({jobId,type:'state',state:run.snapshot()} satisfies FieldMessage)
    for(let target=1;target<=Math.ceil(settings.endS);target++) {
      self.postMessage({jobId,type:'state',state:run.advanceTo(Math.min(target,settings.endS))} satisfies FieldMessage)
      await new Promise(resolve=>setTimeout(resolve,0))
    }
    self.postMessage({jobId,type:'complete',state:run.snapshot()} satisfies FieldMessage)
  } catch(error) {
    self.postMessage({jobId,type:'failed',state:run?.snapshot(),error:error instanceof Error?error.message:String(error)} satisfies FieldMessage)
  }
}
