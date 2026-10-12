import { createRun, type RunMessage, type WorkerCommand } from '../alternatives/model'
let run: ReturnType<typeof createRun> | undefined, panelId = '', runId = '', running = false
let timer: ReturnType<typeof setTimeout> | undefined, solveMs = 0, wallMs = 0, started = 0
function stop() { if (running) wallMs += performance.now() - started; running = false; if (timer) clearTimeout(timer) }
function post(type: RunMessage['type'], error?: string) {
  self.postMessage({ type, panelId, runId, state: run?.snapshot(), running, solveMs,
    wallMs: wallMs + (running ? performance.now() - started : 0), error } satisfies RunMessage)
}
function advance(target: number) { const start = performance.now(); try { run!.advanceTo(target) } finally { solveMs += performance.now() - start } }
function tick() {
  if (!running || !run) return
  try {
    // Fixed physical checkpoints; wall time schedules jobs only. Never frame dt.
    advance(Math.min(run.endS, run.snapshot().timeS + .5))
    if (run.snapshot().timeS >= run.endS - 1e-8) { stop(); post('complete'); return }
    post('state'); timer = setTimeout(tick, 50)
  } catch (error) { stop(); post('failed', String(error)) }
}
self.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const m = event.data
  if (m.type === 'init') {
    stop(); run = undefined; panelId = m.panelId; runId = m.runId; solveMs = wallMs = 0
    try { run = createRun(m.config!); post('ready') } catch (error) { post('failed', String(error)) }
    return
  }
  if (m.panelId !== panelId || m.runId !== runId || !run) return
  if (m.type === 'pause') { stop(); post('paused') }
  if (m.type === 'run') { stop(); started = performance.now(); running = true; tick() }
  if (m.type === 'advance') {
    stop(); const start = performance.now()
    try { advance(m.targetS!); wallMs += performance.now() - start; post(run.snapshot().timeS >= run.endS - 1e-8 ? 'complete' : 'state') }
    catch (error) { post('failed', String(error)) }
  }
}
