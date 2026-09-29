import {
  clipScheduleToStep, serializeSchedule,
} from './schedule'
import type {
  IgnitionCommand, InterventionSchedule, StartRequest,
  TimeInterval, WindowCommand, WindowRequest,
} from './types'

/** Only scheduling/accounting errors; no source law is evaluated here. */
export class IgnitionAccountingError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'IgnitionAccountingError'
  }
}

function fail(detail: string): never { throw new IgnitionAccountingError(detail) }
function nonnegative(raw: unknown, label: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return fail(`${label}: expected a finite nonnegative number`)
  }
  return raw === 0 ? 0 : raw
}
function positive(raw: number, label: string): number {
  nonnegative(raw, label)
  if (raw === 0) fail(`${label}: positive quantity is not representable`)
  return raw
}
function record(raw: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(`${label}: expected a plain data object`)
  }
  const proto = Object.getPrototypeOf(raw)
  if (proto !== Object.prototype && proto !== null) fail(`${label}: unsupported prototype`)
  const own = Reflect.ownKeys(raw)
  if (own.length !== keys.length) fail(`${label}: missing or extra fields`)
  for (const key of own) {
    if (typeof key !== 'string' || !keys.includes(key)) fail(`${label}: unknown field`)
    if (!('value' in Object.getOwnPropertyDescriptor(raw, key)!)) {
      fail(`${label}: accessors are unsupported`)
    }
  }
  for (const key of keys) if (!Object.hasOwn(raw, key)) fail(`${label}: missing ${key}`)
  return raw as Record<string, unknown>
}
function dataArray(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype
      || Reflect.ownKeys(raw).length !== raw.length + 1) fail('Expected a dense data array')
  for (let i = 0; i < raw.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(i))
    if (!descriptor || !('value' in descriptor)) fail('Array holes/accessors are unsupported')
  }
  return raw
}
function timeInterval(raw: unknown): TimeInterval {
  const data = record(raw, ['startS', 'endS'], 'interval')
  const startS = nonnegative(data.startS, 'startS'), endS = nonnegative(data.endS, 'endS')
  if (endS < startS) fail('Interval end precedes start')
  return Object.freeze({ startS, endS })
}

export interface IgnitionProfile {
  readonly command: IgnitionCommand
  readonly nominalPowerW: number
  readonly requestBudgetJ: number
  /** Empty when no positive energy can be requested. Includes cancellation. */
  readonly activeInterval: TimeInterval
  /** A representable internal power-budget cutoff, before cancellation; otherwise null. */
  readonly budgetCutoffS: number | null
  readonly totalScheduledJ: number
}
interface Index {
  readonly scheduleJSON: string
  readonly profiles: ReadonlyMap<string, IgnitionProfile>
}
const indices = new WeakMap<InterventionSchedule, Index>()

/** Raw cumulative integral over the original declaration, not accepted delivery. */
function rawCumulative(command: IgnitionCommand, t: number): number {
  const duration = command.interval.endS - command.interval.startS
  const elapsed = Math.max(0, Math.min(duration, t - command.interval.startS))
  if (duration === 0) return 0
  if (command.input.kind === 'energy') {
    // Pin the terminal total; avoid accumulating power * dt over solver steps.
    return elapsed === duration ? command.input.energyJ
      : command.input.energyJ * (elapsed / duration)
  }
  return Math.min(command.input.energyLimitJ, command.input.powerW * elapsed)
}

function indexFor(schedule: InterventionSchedule): Index {
  const cached = indices.get(schedule)
  if (cached) return cached
  const scheduleJSON = serializeSchedule(schedule) // Enforces the schedule factory boundary.
  const cancels = new Map<string, number>()
  for (const command of schedule.commands) if (command.kind === 'cancel') {
    cancels.set(command.targetCommandId,
      Math.min(cancels.get(command.targetCommandId) ?? Infinity, command.interval.startS))
  }
  const profiles = new Map<string, IgnitionProfile>()
  for (const command of schedule.commands) {
    if (command.kind !== 'ignition') continue
    const { startS, endS } = command.interval, duration = endS - startS
    const budget = command.input.kind === 'energy' ? command.input.energyJ : command.input.energyLimitJ
    const power = command.input.kind === 'energy'
      ? (duration === 0 ? 0 : command.input.energyJ / duration) : command.input.powerW
    let cutoff: number | null = null, end = endS
    if (duration === 0 || power === 0 || budget === 0) end = startS
    else if (command.input.kind === 'power' && budget < power * duration) {
      const runS = positive(budget / power, `${command.id} budget duration`)
      cutoff = startS + runS
      // Never round a positive pulse to an impulse, or silently move it to the declared end.
      if (!Number.isFinite(cutoff) || cutoff <= startS || cutoff >= endS) {
        fail(`${command.id}: budget cutoff is not representable inside its interval`)
      }
      if (Math.abs(power * (cutoff - startS) - budget) > toleranceJ(budget)) {
        fail(`${command.id}: time resolution materially distorts the power-budget cutoff`)
      }
      end = cutoff
    }
    end = Math.max(startS, Math.min(end, cancels.get(command.id) ?? end))
    const total = end === startS ? 0 : end === cutoff ? budget : rawCumulative(command, end)
    if (end > startS) positive(total, `${command.id} scheduled energy`)
    const profile: IgnitionProfile = Object.freeze({
      command, nominalPowerW: power, requestBudgetJ: budget,
      activeInterval: Object.freeze({ startS, endS: end }),
      budgetCutoffS: cutoff, totalScheduledJ: total,
    })
    profiles.set(command.id, profile)
  }
  const result: Index = { scheduleJSON, profiles }
  indices.set(schedule, result)
  return result
}

export function getIgnitionProfile(schedule: InterventionSchedule, commandId: string): IgnitionProfile {
  const profile = indexFor(schedule).profiles.get(commandId)
  if (!profile) return fail('Unknown ignition command ID')
  return profile
}
function cumulative(profile: IgnitionProfile, t: number): number {
  if (t <= profile.activeInterval.startS) return 0
  if (t >= profile.activeInterval.endS) return profile.totalScheduledJ
  return Math.min(profile.totalScheduledJ, rawCumulative(profile.command, t))
}

/** Canonical requested prefix in joules; independent of solver history and callback outcomes. */
export function requestedIgnitionJAt(
  schedule: InterventionSchedule, commandId: string, timeS: number,
): number {
  return cumulative(getIgnitionProfile(schedule, commandId), nonnegative(timeS, 'timeS'))
}

export interface IgnitionEnergyRequest extends Omit<WindowRequest, 'command'> {
  readonly command: IgnitionCommand
  readonly cumulativeStartJ: number
  readonly cumulativeEndJ: number
  readonly requestedJ: number
  readonly nominalPowerW: number
  /** Use requestedJ, not a recomputed nominal power product, for application accounting. */
  readonly meanRequestedPowerW: number
  /** Explicit floating-point difference: requestedJ - nominalPowerW * durationS. */
  readonly roundoffJ: number
}
type OtherWindowRequest = Omit<WindowRequest, 'command'> & {
  readonly command: Exclude<WindowCommand, IgnitionCommand>
}
export type IgnitionPlannedRequest = StartRequest | OtherWindowRequest | IgnitionEnergyRequest
export interface IgnitionStepSlice {
  readonly interval: TimeInterval
  /** Original global staging order; exhausted ignition windows have been removed. */
  readonly requests: readonly IgnitionPlannedRequest[]
}
export interface IgnitionStepPlan {
  readonly scheduleId: string
  readonly interval: TimeInterval
  readonly slices: readonly IgnitionStepSlice[]
}
const requestSchedules = new WeakMap<IgnitionEnergyRequest, string>()
export function isIgnitionEnergyRequest(request: IgnitionPlannedRequest): request is IgnitionEnergyRequest {
  return request.dispatch === 'over-interval' && request.command.kind === 'ignition'
}

/** Refines Task-1 boundaries, retaining ALL other intervention requests and their ordering. */
export function planIgnitionStep(schedule: InterventionSchedule, rawStep: TimeInterval): IgnitionStepPlan {
  const index = indexFor(schedule), base = clipScheduleToStep(schedule, rawStep)
  const cuts = new Set<number>([base.interval.startS, base.interval.endS])
  for (const slice of base.slices) { cuts.add(slice.interval.startS); cuts.add(slice.interval.endS) }
  for (const profile of index.profiles.values()) {
    const t = profile.activeInterval.endS
    if (t > base.interval.startS && t < base.interval.endS) cuts.add(t)
  }
  const sorted = [...cuts].sort((a, b) => a - b), slices: IgnitionStepSlice[] = []
  for (let i = 1; i < sorted.length; i++) {
    const interval = Object.freeze({ startS: sorted[i - 1], endS: sorted[i] })
    const original = clipScheduleToStep(schedule, interval)
    if (original.slices.length !== 1) fail('Internal boundary refinement mismatch')
    const requests: IgnitionPlannedRequest[] = []
    for (const raw of original.slices[0].requests) {
      if (raw.dispatch !== 'over-interval' || raw.command.kind !== 'ignition') {
        requests.push(raw as StartRequest | OtherWindowRequest)
        continue
      }
      const profile = index.profiles.get(raw.command.id)!
      if (interval.startS >= profile.activeInterval.endS) continue
      const cumulativeStartJ = cumulative(profile, interval.startS)
      const cumulativeEndJ = cumulative(profile, interval.endS)
      const requestedJ = positive(cumulativeEndJ - cumulativeStartJ, 'requested energy resolution')
      const dt = interval.endS - interval.startS
      const meanRequestedPowerW = positive(requestedJ / dt, 'mean requested power')
      const roundoffJ = requestedJ - profile.nominalPowerW * dt
      if (!Number.isFinite(roundoffJ)) fail('Nonfinite rate-integral roundoff')
      const request: IgnitionEnergyRequest = Object.freeze({
        ...raw, command: raw.command, cumulativeStartJ, cumulativeEndJ, requestedJ,
        nominalPowerW: profile.nominalPowerW, meanRequestedPowerW, roundoffJ,
      })
      requestSchedules.set(request, index.scheduleJSON)
      requests.push(request)
    }
    slices.push(Object.freeze({ interval, requests: Object.freeze(requests) }))
  }
  return Object.freeze({
    scheduleId: schedule.id, interval: base.interval, slices: Object.freeze(slices),
  })
}

/**
 * This callback REPORTS staged integrator results; it must not mutate live physical state,
 * advance the solver, or assume every request was delivered. It is synchronous.
 * null means unknown. A positive unresolvedJ is known energy with unclassified disposition.
 */
export interface IgnitionApplicationReport {
  readonly requestId: string
  readonly appliedJ: number | null
  readonly rejectedJ: number | null
  readonly unresolvedJ: number | null
  readonly reason: string | null
}
export type IgnitionReportCallback = (request: IgnitionEnergyRequest) => IgnitionApplicationReport

export interface IgnitionReceipt {
  readonly requestId: string
  readonly commandId: string
  readonly sourceId: string
  readonly interval: TimeInterval
  readonly requestedJ: number
  readonly appliedJ: number | null
  readonly rejectedJ: number | null
  readonly unresolvedJ: number | null
  readonly reason: string | null
  /** R - A - J - U when every term is known; otherwise null. */
  readonly balanceResidualJ: number | null
}
const receiptSchedules = new WeakMap<IgnitionReceipt, string>()
const REPORT_KEYS = ['requestId', 'appliedJ', 'rejectedJ', 'unresolvedJ', 'reason'] as const
const RECEIPT_KEYS = [
  'requestId', 'commandId', 'sourceId', 'interval', 'requestedJ',
  'appliedJ', 'rejectedJ', 'unresolvedJ', 'reason', 'balanceResidualJ',
] as const

function knownAmount(raw: unknown, label: string): number | null {
  return raw === null ? null : nonnegative(raw, label)
}
/** Relative roundoff allowance only; no absolute floor and NEVER a timing epsilon. */
function toleranceJ(scale: number): number { return 64 * Number.EPSILON * scale }

/** Neumaier summation. Reject overflow instead of returning Infinity/null through JSON. */
function sum(values: readonly number[]): number {
  let total = 0, correction = 0
  for (const value of values) {
    const next = total + value
    if (!Number.isFinite(next)) fail('Energy total overflows')
    correction += Math.abs(total) >= Math.abs(value)
      ? (total - next) + value : (value - next) + total
    total = next
  }
  const result = total + correction
  nonnegative(result, 'energy total')
  return result
}

export function reconcileIgnitionRequest(
  request: IgnitionEnergyRequest, rawReport: IgnitionApplicationReport,
): IgnitionReceipt {
  const scheduleJSON = requestSchedules.get(request)
  if (scheduleJSON === undefined) return fail('Use planIgnitionStep to obtain a request')
  const report = record(rawReport, REPORT_KEYS, 'application report')
  if (report.requestId !== request.requestId) fail('Application report request ID mismatch')
  const appliedJ = knownAmount(report.appliedJ, 'appliedJ')
  const rejectedJ = knownAmount(report.rejectedJ, 'rejectedJ')
  const unresolvedJ = knownAmount(report.unresolvedJ, 'unresolvedJ')
  const reason = report.reason
  if (reason !== null && (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 512)) {
    fail('reason must be null or 1-512 characters of nonblank text')
  }
  const amounts = [appliedJ, rejectedJ, unresolvedJ]
  const known = amounts.filter((v): v is number => v !== null)
  if (known.some(v => v > request.requestedJ)) fail('Reported amount exceeds requested joules')
  const knownSum = sum(known), residual = request.requestedJ - knownSum
  const complete = known.length === 3
  if (residual < -toleranceJ(request.requestedJ)
      || (complete && Math.abs(residual) > toleranceJ(request.requestedJ))) {
    fail('Application report does not reconcile requested energy')
  }
  if ((!complete || rejectedJ !== 0 || unresolvedJ !== 0) && reason === null) {
    fail('Rejection or unresolved disposition requires a reason')
  }
  const receipt: IgnitionReceipt = Object.freeze({
    requestId: request.requestId, commandId: request.command.id,
    sourceId: request.command.sourceId, interval: request.interval, requestedJ: request.requestedJ,
    appliedJ, rejectedJ, unresolvedJ, reason: reason as string | null,
    balanceResidualJ: complete ? (residual === 0 ? 0 : residual) : null,
  })
  receiptSchedules.set(receipt, scheduleJSON)
  return receipt
}

function settled(receipt: IgnitionReceipt): boolean {
  return receipt.appliedJ !== null && receipt.rejectedJ !== null && receipt.unresolvedJ === 0
}
function compareReceipts(a: IgnitionReceipt, b: IgnitionReceipt): number {
  return a.interval.startS - b.interval.startS
    || (a.commandId < b.commandId ? -1 : a.commandId > b.commandId ? 1 : 0)
    || a.interval.endS - b.interval.endS
}
/** This is a serialization/aggregation order, not a replacement for global staging order. */
function checkedReceipts(raw: readonly IgnitionReceipt[], scheduleJSON?: string): IgnitionReceipt[] {
  const values = dataArray(raw) as readonly IgnitionReceipt[]
  for (const value of values) {
    if (!receiptSchedules.has(value)) fail('Use reconciled or parsed ignition receipts')
  }
  const sorted = [...values].sort(compareReceipts)
  const ids = new Set<string>(), endByCommand = new Map<string, number>()
  let binding = scheduleJSON
  for (const receipt of sorted) {
    const registered = receiptSchedules.get(receipt)
    if (registered === undefined) fail('Use reconciled or parsed ignition receipts')
    binding ??= registered
    if (registered !== binding) fail('Receipt schedule content collision')
    if (ids.has(receipt.requestId)) fail('Duplicate receipt ID')
    ids.add(receipt.requestId)
    if ((endByCommand.get(receipt.commandId) ?? -Infinity) > receipt.interval.startS) {
      fail('Overlapping committed/requested interval coverage')
    }
    endByCommand.set(receipt.commandId, receipt.interval.endS)
  }
  return sorted
}

export interface IgnitionTotals {
  readonly requestedJ: number
  readonly appliedJ: number | null
  readonly rejectedJ: number | null
  readonly unresolvedJ: number | null
  readonly knownAppliedJ: number
  readonly knownRejectedJ: number
  readonly knownUnresolvedJ: number
  readonly unknownAppliedCount: number
  readonly unknownRejectedCount: number
  readonly unknownUnresolvedCount: number
  readonly balanceResidualJ: number | null
}
/** Ignition receipts only. General mass/material/source ledgers remain Task 5. */
export function summarizeIgnitionReceipts(receipts: readonly IgnitionReceipt[]): IgnitionTotals {
  const ordered = checkedReceipts(receipts)
  const requestedJ = sum(ordered.map(r => r.requestedJ))
  const knownAppliedJ = sum(ordered.flatMap(r => r.appliedJ === null ? [] : [r.appliedJ]))
  const knownRejectedJ = sum(ordered.flatMap(r => r.rejectedJ === null ? [] : [r.rejectedJ]))
  const knownUnresolvedJ = sum(ordered.flatMap(r => r.unresolvedJ === null ? [] : [r.unresolvedJ]))
  const unknownAppliedCount = ordered.filter(r => r.appliedJ === null).length
  const unknownRejectedCount = ordered.filter(r => r.rejectedJ === null).length
  const unknownUnresolvedCount = ordered.filter(r => r.unresolvedJ === null).length
  const appliedJ = unknownAppliedCount ? null : knownAppliedJ
  const rejectedJ = unknownRejectedCount ? null : knownRejectedJ
  const unresolvedJ = unknownUnresolvedCount ? null : knownUnresolvedJ
  const residual = appliedJ === null || rejectedJ === null || unresolvedJ === null ? null
    : requestedJ - sum([appliedJ, rejectedJ, unresolvedJ])
  return Object.freeze({
    requestedJ, appliedJ, rejectedJ, unresolvedJ, knownAppliedJ, knownRejectedJ, knownUnresolvedJ,
    unknownAppliedCount, unknownRejectedCount, unknownUnresolvedCount,
    balanceResidualJ: residual === 0 ? 0 : residual,
  })
}

declare const checkpointBrand: unique symbol
export interface IgnitionCheckpoint {
  readonly kind: 'ignition-checkpoint'
  readonly schemaVersion: 1
  readonly scheduleJSON: string
  /** Complete accepted accounting prefix [0, throughS); not a query cursor. */
  readonly throughS: number
  readonly receipts: readonly IgnitionReceipt[]
  readonly [checkpointBrand]: true
}
const checkpoints = new WeakSet<IgnitionCheckpoint>()
function checkpoint(index: Index, throughS: number, receipts: readonly IgnitionReceipt[]): IgnitionCheckpoint {
  const ordered = checkedReceipts(receipts, index.scheduleJSON)
  if (ordered.some(r => !settled(r) || r.interval.endS > throughS)) {
    fail('Checkpoint cannot contain unresolved or future receipts')
  }
  for (const profile of index.profiles.values()) {
    let at = profile.activeInterval.startS
    const end = Math.max(at, Math.min(throughS, profile.activeInterval.endS))
    for (const receipt of ordered.filter(r => r.commandId === profile.command.id)) {
      if (receipt.interval.startS !== at || receipt.interval.endS > end) {
        fail('Checkpoint has a coverage gap, overlap, or extra receipt')
      }
      at = receipt.interval.endS
    }
    if (at !== end) fail('Checkpoint omits requested interval coverage')
    const matching = ordered.filter(r => r.commandId === profile.command.id)
    const expected = cumulative(profile, throughS)
    const requested = sum(matching.map(r => r.requestedJ))
    const applied = sum(matching.map(r => r.appliedJ!))
    if (Math.abs(requested - expected) > toleranceJ(expected)
        || applied - expected > toleranceJ(expected)) {
      fail('Checkpoint command budget does not reconcile')
    }
  }
  // Checks aggregate overflow before granting a reusable checkpoint.
  summarizeIgnitionReceipts(ordered)
  const result = Object.freeze({
    kind: 'ignition-checkpoint' as const, schemaVersion: 1 as const,
    scheduleJSON: index.scheduleJSON, throughS, receipts: Object.freeze(ordered),
  }) as IgnitionCheckpoint
  checkpoints.add(result)
  return result
}
export function createIgnitionCheckpoint(schedule: InterventionSchedule): IgnitionCheckpoint {
  return checkpoint(indexFor(schedule), 0, [])
}
function requireCheckpoint(schedule: InterventionSchedule, state: IgnitionCheckpoint): Index {
  if (!checkpoints.has(state)) return fail('Use createIgnitionCheckpoint or parseIgnitionCheckpoint')
  const index = indexFor(schedule)
  if (state.scheduleJSON !== index.scheduleJSON) fail('Checkpoint schedule content collision')
  return index
}
export interface IgnitionTrial {
  readonly before: IgnitionCheckpoint
  readonly plan: IgnitionStepPlan
  readonly receipts: readonly IgnitionReceipt[]
  readonly totals: IgnitionTotals
  /** Accounting candidate only, never a physical commit; null if any disposition is unresolved. */
  readonly candidate: IgnitionCheckpoint | null
}

/**
 * Produces a detached accounting candidate from REPORTS of an integrator's staged work.
 * No live source/solver is invoked. The outer owner must accept physical time, all other
 * events, state, and this candidate atomically. Discard the entire trial on a shorter dt.
 */
export function stageIgnitionStep(
  schedule: InterventionSchedule, before: IgnitionCheckpoint,
  step: TimeInterval, report: IgnitionReportCallback,
): IgnitionTrial {
  const index = requireCheckpoint(schedule, before)
  const plan = planIgnitionStep(schedule, step)
  if (plan.interval.startS !== before.throughS) fail('Step must begin at checkpoint throughS')
  if (typeof report !== 'function') fail('An explicit report callback is required')
  const receipts: IgnitionReceipt[] = []
  for (const slice of plan.slices) for (const request of slice.requests) {
    if (isIgnitionEnergyRequest(request)) receipts.push(reconcileIgnitionRequest(request, report(request)))
  }
  const candidate = receipts.every(settled)
    ? checkpoint(index, plan.interval.endS, [...before.receipts, ...receipts]) : null
  return Object.freeze({
    before, plan, receipts: Object.freeze(receipts),
    totals: summarizeIgnitionReceipts(receipts), candidate,
  })
}

export function serializeIgnitionCheckpoint(state: IgnitionCheckpoint): string {
  if (!checkpoints.has(state)) return fail('Unvalidated ignition checkpoint')
  return JSON.stringify(state)
}

/** Rebuild all requests/receipts from the pinned schedule; reject missing and overlapping coverage. */
export function parseIgnitionCheckpoint(schedule: InterventionSchedule, text: string): IgnitionCheckpoint {
  if (typeof text !== 'string') fail('Checkpoint JSON must be text')
  const index = indexFor(schedule)
  const data = record(JSON.parse(text) as unknown,
    ['kind', 'schemaVersion', 'scheduleJSON', 'throughS', 'receipts'], 'checkpoint')
  if (data.kind !== 'ignition-checkpoint' || data.schemaVersion !== 1) fail('Unsupported checkpoint schema')
  if (data.scheduleJSON !== index.scheduleJSON) fail('Checkpoint schedule content collision')
  const throughS = nonnegative(data.throughS, 'throughS'), receipts: IgnitionReceipt[] = []
  for (const raw of dataArray(data.receipts)) {
    const r = record(raw, RECEIPT_KEYS, 'receipt'), interval = timeInterval(r.interval)
    const plan = planIgnitionStep(schedule, interval)
    const matches = plan.slices.flatMap(slice => slice.requests)
      .filter(isIgnitionEnergyRequest).filter(req => req.command.id === r.commandId)
    if (matches.length !== 1) fail('Receipt does not match one canonical request')
    const req = matches[0]
    if (req.interval.startS !== interval.startS || req.interval.endS !== interval.endS
        || req.requestId !== r.requestId || req.command.sourceId !== r.sourceId
        || req.requestedJ !== r.requestedJ) fail('Receipt request fields do not match the schedule')
    const receipt = reconcileIgnitionRequest(req, {
      requestId: req.requestId,
      appliedJ: r.appliedJ as number | null, rejectedJ: r.rejectedJ as number | null,
      unresolvedJ: r.unresolvedJ as number | null, reason: r.reason as string | null,
    })
    if (receipt.balanceResidualJ !== r.balanceResidualJ) fail('Receipt residual mismatch')
    receipts.push(receipt)
  }
  return checkpoint(index, throughS, receipts)
}
