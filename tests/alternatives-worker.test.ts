import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { freshPanel, type RunMessage, type WorkerCommand } from '../src/alternatives/model'
const messages: RunMessage[] = []
const scope = { postMessage: (message: RunMessage) => messages.push(structuredClone(message)), onmessage: undefined as unknown as (e: MessageEvent<WorkerCommand>) => void }
vi.stubGlobal('self', scope)
await import('../src/worker/alternatives.worker')
const send = (type: WorkerCommand['type'], runId = 'r1', panelId = 'a', extra: Partial<WorkerCommand> = {}) => scope.onmessage({ data: { type, runId, panelId, ...extra } } as MessageEvent<WorkerCommand>)
beforeEach(() => { vi.useFakeTimers(); messages.length = 0; send('init','r1','a',{config:freshPanel('a','sublimation-injection')}) })
afterEach(() => { send('pause'); vi.clearAllTimers(); vi.useRealTimers() })
describe('independent alternatives worker lifecycle', () => {
  it('pauses accepted time and resumes with deterministic physical increments', () => {
    send('run'); vi.advanceTimersByTime(150); send('pause')
    const time=messages.at(-1)!.state!.timeS
    vi.advanceTimersByTime(1000); expect(messages.at(-1)!.state!.timeS).toBe(time)
    send('run'); expect(messages.at(-1)!.state!.timeS).toBe(time+.5)
  })
  it('replaces a run atomically and ignores canceled run and foreign panel commands', () => {
    send('run'); vi.advanceTimersByTime(100)
    send('init','r2','a',{config:freshPanel('a','pressure-pulse')})
    const count=messages.length;send('run','r1');send('advance','r2','b',{targetS:20});vi.advanceTimersByTime(1000)
    expect(messages).toHaveLength(count);expect(messages.at(-1)!.state!.timeS).toBe(0)
  })
  it('acknowledges the actual accepted timestamp for a linked barrier', () => {
    send('advance','r1','a',{targetS:10});expect(messages.at(-1)!.state!.timeS).toBe(10)
    expect(messages.at(-1)!.running).toBe(false)
    send('advance','r1','a',{targetS:9});expect(messages.at(-1)!.type).toBe('failed')
  })
  it('does not leave an autonomous timer after replacement with an unavailable method', () => {
    send('run'); send('init','r2','a',{config:freshPanel('a','nanoparticles')})
    expect(messages.at(-1)!.type).toBe('failed');const count=messages.length
    vi.advanceTimersByTime(1000);expect(messages).toHaveLength(count)
  })
})
