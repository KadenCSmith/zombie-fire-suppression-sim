import { runFireProtocol, type FireProtocolWorkerRequest, type FireProtocolWorkerMessage } from '../coupled/fireProtocolRunner'

let running = false
const post = (message: FireProtocolWorkerMessage) => self.postMessage(message)
self.onmessage = async (event: MessageEvent<FireProtocolWorkerRequest>) => {
  if (running || event.data?.type !== 'run') return
  running = true
  try {
    const cache = await runFireProtocol(event.data.options, {
      applicationVersion: event.data.applicationVersion, mode: 'live-worker', wallLimitS: 300,
      onProgress: post, yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
    })
    post({ type: 'result', cache })
  } catch (error) { post({ type: 'error', message: error instanceof Error ? error.message : String(error) }) }
  finally { running = false }
}
