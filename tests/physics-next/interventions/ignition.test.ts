import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, ok, throws } from 'node:assert/strict'
import type {
  IgnitionCommand, InterventionCommand, InterventionSchedule,
} from '../../../src/physics-next/interventions/types'
import { createSchedule, parseSchedule, serializeSchedule } from '../../../src/physics-next/interventions/schedule'
import {
  IgnitionAccountingError, createIgnitionCheckpoint, getIgnitionProfile,
  isIgnitionEnergyRequest, parseIgnitionCheckpoint, planIgnitionStep,
  reconcileIgnitionRequest, requestedIgnitionJAt, serializeIgnitionCheckpoint,
  stageIgnitionStep, summarizeIgnitionReceipts,
  type IgnitionApplicationReport, type IgnitionEnergyRequest, type IgnitionReceipt,
} from '../../../src/physics-next/interventions/ignition'

const heat = (changes: Partial<IgnitionCommand> = {}): IgnitionCommand => ({
  kind: 'ignition', id: 'heat', sequence: 0,
  interval: { startS: 0, endS: 10 }, sourceId: 'heater',
  location: { kind: 'point', frameId: 'domain', xM: 0, yM: 0, depthM: 0.1 },
  input: { kind: 'power', powerW: 8, energyLimitJ: 80 }, ...changes,
})
const schedule = (commands: readonly InterventionCommand[] = [heat()], id = 'run') =>
  createSchedule({ schemaVersion: 1, id, commands })
const requests = (s: InterventionSchedule, startS = 0, endS = 10) =>
  planIgnitionStep(s, { startS, endS }).slices.flatMap(slice => slice.requests).filter(isIgnitionEnergyRequest)
const applied = (r: IgnitionEnergyRequest): IgnitionApplicationReport => ({
  requestId: r.requestId, appliedJ: r.requestedJ, rejectedJ: 0, unresolvedJ: 0, reason: null,
})
const rejected = (r: IgnitionEnergyRequest): IgnitionApplicationReport => ({
  requestId: r.requestId, appliedJ: 0, rejectedJ: r.requestedJ, unresolvedJ: 0, reason: 'not admitted',
})
const cancel = (at: number): InterventionCommand => ({
  kind: 'cancel', id: 'stop', sequence: 0, interval: { startS: at, endS: at + 1 },
  targetCommandId: 'heat',
})
const parsedJSON = (s: string): Record<string, unknown> => JSON.parse(s) as Record<string, unknown>

describe('finite ignition plans', () => {
  it('integrates power and pins a finite total exactly at cutoff', () => {
    const s = schedule([heat({ input: { kind: 'power', powerW: 8, energyLimitJ: 20 } })])
    const plan = planIgnitionStep(s, { startS: 0, endS: 10 })
    deepStrictEqual(plan.slices.map(x => x.interval), [{ startS: 0, endS: 2.5 }, { startS: 2.5, endS: 10 }])
    strictEqual(requests(s)[0].requestedJ, 20)
    strictEqual(requests(s, 2.5, 10).length, 0)
    strictEqual(getIgnitionProfile(s, 'heat').budgetCutoffS, 2.5)
  })
  it('splits a mid-step declaration cutoff and keeps both idle spans', () => {
    const s = schedule([heat({ interval: { startS: 1, endS: 3 } })])
    deepStrictEqual(planIgnitionStep(s, { startS: 0, endS: 5 }).slices.map(x => [x.interval.startS, x.interval.endS]),
      [[0, 1], [1, 3], [3, 5]])
    strictEqual(requests(s, 0, 5)[0].requestedJ, 16)
  })
  it('pins energy-total joules across many partitions without accumulating a source clock', () => {
    const s = schedule([heat({ input: { kind: 'energy', energyJ: 1 } })])
    let state = createIgnitionCheckpoint(s)
    for (let i = 0; i < 100; i++) {
      const trial = stageIgnitionStep(s, state, { startS: i / 10, endS: (i + 1) / 10 }, applied)
      ok(trial.candidate); state = trial.candidate
    }
    strictEqual(summarizeIgnitionReceipts(state.receipts).requestedJ, 1)
    strictEqual(summarizeIgnitionReceipts(state.receipts).appliedJ, 1)
    strictEqual(requestedIgnitionJAt(s, 'heat', 10), 1)
  })
  it('returns a true no-op for zero duration, zero power, zero budget, and empty solver steps', () => {
    for (const c of [
      heat({ interval: { startS: 2, endS: 2 } }),
      heat({ input: { kind: 'energy', energyJ: 0 } }),
      heat({ input: { kind: 'power', powerW: 0, energyLimitJ: 12 } }),
      heat({ input: { kind: 'power', powerW: 8, energyLimitJ: 0 } }),
    ]) strictEqual(requests(schedule([c])).length, 0)
    strictEqual(planIgnitionStep(schedule(), { startS: 1, endS: 1 }).slices.length, 0)
  })
  it('does not turn positive energy in an empty interval into an impulse', () => {
    throws(() => schedule([heat({ interval: { startS: 2, endS: 2 }, input: { kind: 'energy', energyJ: 1 } })]))
  })
  it('rejects overlapping sources but allows adjacent rate changes and independent sources', () => {
    throws(() => schedule([heat(), heat({ id: 'heat-2', interval: { startS: 5, endS: 12 } })]))
    const adjacent = schedule([
      heat({ interval: { startS: 0, endS: 2 } }),
      heat({ id: 'heat-2', interval: { startS: 2, endS: 3 }, input: { kind: 'energy', energyJ: 7 } }),
    ])
    strictEqual(requests(adjacent).reduce((n, r) => n + r.requestedJ, 0), 23)
    strictEqual(requests(schedule([heat(), heat({ id: 'heat-2', sourceId: 'other' })])).length, 2)
  })
  it('uses cancellation as a hard future cutoff without redistributing total joules', () => {
    const s = schedule([heat({ input: { kind: 'energy', energyJ: 100 } }), cancel(3)])
    strictEqual(requestedIgnitionJAt(s, 'heat', 100), 30)
    strictEqual(requests(s).reduce((n, r) => n + r.requestedJ, 0), 30)
    strictEqual(requests(schedule([heat(), cancel(0)])).length, 0)
  })
  it('does not retry rejected energy after budget cutoff', () => {
    const s = schedule([heat({ input: { kind: 'power', powerW: 8, energyLimitJ: 20 } })])
    const first = stageIgnitionStep(s, createIgnitionCheckpoint(s), { startS: 0, endS: 3 }, rejected)
    ok(first.candidate)
    strictEqual(first.totals.appliedJ, 0)
    strictEqual(first.totals.rejectedJ, 20)
    const next = stageIgnitionStep(s, first.candidate, { startS: 3, endS: 20 }, applied)
    strictEqual(next.receipts.length, 0)
  })
  it('retains non-ignition requests and their order when adding budget boundaries', () => {
    const hose: InterventionCommand = {
      kind: 'hose-placement', id: 'hose', sequence: 0, hoseId: 'line',
      interval: { startS: 1, endS: 2 }, location: heat().location,
    }
    const s = schedule([heat({ input: { kind: 'power', powerW: 8, energyLimitJ: 20 } }), hose])
    const at1 = planIgnitionStep(s, { startS: 0, endS: 4 }).slices.find(x => x.interval.startS === 1)!
    deepStrictEqual(at1.requests.map(r => r.command.kind), ['hose-placement', 'ignition'])
    strictEqual(requests(s, 1, 2.5)[0].requestedJ, 12)
  })
  it('is immutable and excludes noncanonical requests from reconciliation', () => {
    const r = requests(schedule())[0]
    ok(Object.isFrozen(r)); ok(Object.isFrozen(r.command)); ok(Object.isFrozen(r.interval))
    throws(() => reconcileIgnitionRequest({ ...r }, applied(r)), IgnitionAccountingError)
  })
  it('exposes rather than hides floating-point differences in a rate integral', () => {
    const s = schedule([heat({ input: { kind: 'energy', energyJ: 1 } })])
    const r = requests(s, 3.1, 3.2)[0]
    strictEqual(r.requestedJ, r.cumulativeEndJ - r.cumulativeStartJ)
    strictEqual(r.roundoffJ, r.requestedJ - r.nominalPowerW * (r.interval.endS - r.interval.startS))
    strictEqual(r.meanRequestedPowerW, r.requestedJ / (r.interval.endS - r.interval.startS))
  })
  it('rejects an unrepresentable tiny cutoff instead of changing its time', () => {
    const s = schedule([heat({
      interval: { startS: 1e16, endS: 1e16 + 10 },
      input: { kind: 'power', powerW: 1, energyLimitJ: 1 },
    })])
    throws(() => planIgnitionStep(s, { startS: 1e16, endS: 1e16 + 10 }), IgnitionAccountingError)
  })
  it('rejects nonfinite query times and foreign schedules', () => {
    throws(() => requestedIgnitionJAt(schedule(), 'heat', NaN))
    throws(() => requestedIgnitionJAt(schedule(), 'missing', 0))
    throws(() => planIgnitionStep({ ...schedule() }, { startS: 0, endS: 1 }))
  })
})

describe('explicit ignition reports and rollback', () => {
  it('reconciles partial applied, rejected, and positive unresolved amounts', () => {
    const r = requests(schedule())[0]
    const receipt = reconcileIgnitionRequest(r, {
      requestId: r.requestId, appliedJ: 40, rejectedJ: 30, unresolvedJ: 10, reason: 'staged incomplete',
    })
    deepStrictEqual([receipt.appliedJ, receipt.rejectedJ, receipt.unresolvedJ, receipt.balanceResidualJ], [40, 30, 10, 0])
  })
  it('preserves unknown quantities and their counts rather than inferring zeros', () => {
    const r = requests(schedule())[0]
    const receipt = reconcileIgnitionRequest(r, {
      requestId: r.requestId, appliedJ: null, rejectedJ: 0, unresolvedJ: null, reason: 'unmeasured',
    })
    const t = summarizeIgnitionReceipts([receipt])
    strictEqual(t.appliedJ, null); strictEqual(t.unresolvedJ, null); strictEqual(t.balanceResidualJ, null)
    strictEqual(t.knownAppliedJ, 0); strictEqual(t.unknownAppliedCount, 1)
  })
  it('requires IDs, amounts, and reasons and rejects malformed callback outputs', () => {
    const r = requests(schedule())[0], base = applied(r)
    for (const change of [
      { requestId: 'wrong' }, { appliedJ: -1 }, { appliedJ: Infinity }, { rejectedJ: NaN },
      { appliedJ: 79 }, { appliedJ: 81 }, { extra: true }, { appliedJ: null },
      { appliedJ: 0, rejectedJ: 80 }, { reason: '' },
    ]) throws(() => reconcileIgnitionRequest(r, { ...base, ...change } as IgnitionApplicationReport))
    let reads = 0
    const accessor = { ...base }
    Object.defineProperty(accessor, 'appliedJ', { get() { reads++; return 80 }, enumerable: true })
    throws(() => reconcileIgnitionRequest(r, accessor)); strictEqual(reads, 0)
  })
  it('never grants a checkpoint while any delivery is unknown or unclassified', () => {
    const s = schedule(), before = createIgnitionCheckpoint(s)
    for (const report of [
      (r: IgnitionEnergyRequest): IgnitionApplicationReport => ({ ...applied(r), appliedJ: null, unresolvedJ: null, reason: 'unknown' }),
      (r: IgnitionEnergyRequest): IgnitionApplicationReport => ({ ...applied(r), appliedJ: 0, unresolvedJ: r.requestedJ, reason: 'unclassified' }),
    ]) strictEqual(stageIgnitionStep(s, before, { startS: 0, endS: 10 }, report).candidate, null)
    strictEqual(before.throughS, 0); strictEqual(before.receipts.length, 0)
  })
  it('keeps the before snapshot unchanged after thrown callbacks and discarded trials', () => {
    const s = schedule(), before = createIgnitionCheckpoint(s), json = serializeIgnitionCheckpoint(before)
    throws(() => stageIgnitionStep(s, before, { startS: 0, endS: 10 }, () => { throw new Error('solver refused') }))
    strictEqual(serializeIgnitionCheckpoint(before), json)
    const retry = stageIgnitionStep(s, before, { startS: 0, endS: 2 }, applied)
    ok(retry.candidate); strictEqual(retry.candidate.throughS, 2)
    strictEqual(before.throughS, 0)
  })
  it('rejects duplicate and overlapping receipt coverage even with different IDs', () => {
    const s = schedule(), a = requests(s, 0, 5)[0], b = requests(s, 4, 6)[0]
    const ra = reconcileIgnitionRequest(a, applied(a)), rb = reconcileIgnitionRequest(b, applied(b))
    throws(() => summarizeIgnitionReceipts([ra, ra]))
    throws(() => summarizeIgnitionReceipts([ra, rb]))
  })
  it('rejects cross-schedule aggregation and fabricated receipts', () => {
    const a = requests(schedule())[0], b = requests(schedule([heat()], 'other'))[0]
    throws(() => summarizeIgnitionReceipts([
      reconcileIgnitionRequest(a, applied(a)), reconcileIgnitionRequest(b, applied(b)),
    ]))
    const ra = reconcileIgnitionRequest(a, applied(a))
    throws(() => summarizeIgnitionReceipts([{ ...ra }]))
  })
  it('detects aggregate overflow while allowing independent finite sources', () => {
    const s = schedule([
      heat({ interval: { startS: 0, endS: 1 }, input: { kind: 'energy', energyJ: 1e308 } }),
      heat({ id: 'heat-2', sourceId: 'second', interval: { startS: 0, endS: 1 }, input: { kind: 'energy', energyJ: 1e308 } }),
    ])
    throws(() => stageIgnitionStep(s, createIgnitionCheckpoint(s), { startS: 0, endS: 1 }, applied))
  })
})

describe('ignition restart and independent prefix accounting', () => {
  it('round-trips a checkpoint and produces an identical resumed result', () => {
    const s = schedule([heat({ input: { kind: 'energy', energyJ: 17 } })])
    const a = stageIgnitionStep(s, createIgnitionCheckpoint(s), { startS: 0, endS: 3 }, applied)
    ok(a.candidate)
    const s2 = parseSchedule(serializeSchedule(s))
    const restored = parseIgnitionCheckpoint(s2, serializeIgnitionCheckpoint(a.candidate))
    const left = stageIgnitionStep(s, a.candidate, { startS: 3, endS: 10 }, applied)
    const right = stageIgnitionStep(s2, restored, { startS: 3, endS: 10 }, applied)
    ok(left.candidate); ok(right.candidate)
    strictEqual(serializeIgnitionCheckpoint(left.candidate), serializeIgnitionCheckpoint(right.candidate))
    strictEqual(summarizeIgnitionReceipts(right.candidate.receipts).appliedJ, 17)
  })
  it('rejects changed content under a reused schedule ID', () => {
    const s = schedule(), before = createIgnitionCheckpoint(s)
    const changed = schedule([heat({ input: { kind: 'energy', energyJ: 90 } })])
    throws(() => parseIgnitionCheckpoint(changed, serializeIgnitionCheckpoint(before)))
    throws(() => stageIgnitionStep(changed, before, { startS: 0, endS: 1 }, applied))
  })
  it('rejects restart gaps, wrong totals, future receipts, duplicates, and extra fields', () => {
    const s = schedule()
    const trial = stageIgnitionStep(s, createIgnitionCheckpoint(s), { startS: 0, endS: 5 }, applied)
    ok(trial.candidate)
    const text = serializeIgnitionCheckpoint(trial.candidate)
    const mutate = (fn: (raw: Record<string, unknown>) => void) => {
      const raw = parsedJSON(text); fn(raw); throws(() => parseIgnitionCheckpoint(s, JSON.stringify(raw)))
    }
    mutate(raw => { raw.receipts = [] })
    mutate(raw => { raw.throughS = 4 })
    mutate(raw => { raw.throughS = 6 })
    mutate(raw => { const rs = raw.receipts as IgnitionReceipt[]; raw.receipts = [...rs, ...rs] })
    mutate(raw => { (raw.receipts as { requestedJ: number }[])[0].requestedJ = 39 })
    mutate(raw => { (raw.receipts as { balanceResidualJ: number }[])[0].balanceResidualJ = 1 })
    mutate(raw => { raw.extra = 0 })
  })
  it('rejects overlapping differently partitioned histories during restart', () => {
    const s = schedule()
    const a = stageIgnitionStep(s, createIgnitionCheckpoint(s), { startS: 0, endS: 5 }, applied)
    ok(a.candidate)
    const raw = parsedJSON(serializeIgnitionCheckpoint(a.candidate))
    const b = requests(s, 4, 5)[0]
    raw.receipts = [...raw.receipts as IgnitionReceipt[], reconcileIgnitionRequest(b, applied(b))]
    throws(() => parseIgnitionCheckpoint(s, JSON.stringify(raw)))
  })
  it('requires contiguous physical time while allowing an explicit empty stage', () => {
    const s = schedule(), before = createIgnitionCheckpoint(s)
    throws(() => stageIgnitionStep(s, before, { startS: 1, endS: 2 }, applied))
    strictEqual(stageIgnitionStep(s, before, { startS: 0, endS: 0 }, applied).receipts.length, 0)
  })
  it('recomputes prefixes using an independent dyadic oracle for varied finite budgets', () => {
    for (let seed = 1; seed <= 32; seed++) {
      const start = (seed % 4) / 4, end = start + 4, p = 2 ** (seed % 5)
      const budget = p * (1 + (seed % 8) / 4)
      const s = schedule([heat({ interval: { startS: start, endS: end },
        input: { kind: 'power', powerW: p, energyLimitJ: budget } })])
      let state = createIgnitionCheckpoint(s)
      for (let i = 0; i < 24; i++) {
        const trial = stageIgnitionStep(s, state, { startS: i / 4, endS: (i + 1) / 4 }, applied)
        ok(trial.candidate); state = trial.candidate
        const oracle = Math.min(budget, p * Math.max(0, Math.min(end - start, (i + 1) / 4 - start)))
        strictEqual(summarizeIgnitionReceipts(state.receipts).requestedJ, oracle)
      }
    }
  })
})
