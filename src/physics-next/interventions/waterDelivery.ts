import { serializeSchedule } from './schedule'
import {
  isIgnitionEnergyRequest, planIgnitionStep, type IgnitionEnergyRequest,
} from './ignition'
import {
  materialAccountingInternals as m, type MaterialAccounting, type MaterialApplicationReport,
} from './dryIcePlacement'
import type {
  HosePlacementCommand, IgnitionCommand, InterventionSchedule, StartRequest,
  TimeInterval, WaterDeliveryCommand, WindowCommand, WindowRequest,
} from './types'

export interface WaterProfile {
  readonly command: WaterDeliveryCommand
  readonly activeInterval: TimeInterval
  readonly massBudgetCutoffS: number | null
  readonly totalScheduledKg: number
}
interface Index { readonly scheduleJSON: string; readonly profiles: ReadonlyMap<string, WaterProfile> }
const indices = new WeakMap<InterventionSchedule, Index>()
function rawPrefix(c: WaterDeliveryCommand, t: number): number {
  return Math.min(c.massLimitKg, c.massFlowKgS * Math.max(0, Math.min(
    c.interval.endS - c.interval.startS, t - c.interval.startS,
  )))
}
function indexFor(schedule: InterventionSchedule): Index {
  const cached = indices.get(schedule)
  if (cached) return cached
  const scheduleJSON = serializeSchedule(schedule), cancellations = new Map<string, number>()
  for (const c of schedule.commands) if (c.kind === 'cancel') {
    cancellations.set(c.targetCommandId,
      Math.min(cancellations.get(c.targetCommandId) ?? Infinity, c.interval.startS))
  }
  const profiles = new Map<string, WaterProfile>()
  for (const c of schedule.commands) {
    if (c.kind !== 'water-delivery') continue
    const { startS, endS } = c.interval, dt = endS - startS
    let cutoff: number | null = null, end = endS
    if (dt === 0 || c.massFlowKgS === 0 || c.massLimitKg === 0) end = startS
    else if (c.massLimitKg < c.massFlowKgS * dt) {
      cutoff = startS + c.massLimitKg / c.massFlowKgS
      if (!Number.isFinite(cutoff) || cutoff <= startS || cutoff >= endS
          || Math.abs(c.massFlowKgS * (cutoff - startS) - c.massLimitKg) > m.tolerance(c.massLimitKg)) {
        m.fail(`${c.id}: finite mass-budget cutoff is not representable`)
      }
      end = cutoff
    }
    end = Math.max(startS, Math.min(end, cancellations.get(c.id) ?? end))
    const total = end === startS ? 0 : end === cutoff ? c.massLimitKg : rawPrefix(c, end)
    if (end > startS && !(total > 0 && Number.isFinite(total))) m.fail('Positive scheduled water mass is unrepresentable')
    profiles.set(c.id, Object.freeze({
      command: c, activeInterval: Object.freeze({ startS, endS: end }),
      massBudgetCutoffS: cutoff, totalScheduledKg: total,
    }))
  }
  const result = { scheduleJSON, profiles }
  indices.set(schedule, result); return result
}
export function getWaterProfile(schedule: InterventionSchedule, commandId: string): WaterProfile {
  const profile = indexFor(schedule).profiles.get(commandId)
  if (!profile) return m.fail('Unknown water command')
  return profile
}
function prefix(profile: WaterProfile, t: number): number {
  if (t <= profile.activeInterval.startS) return 0
  if (t >= profile.activeInterval.endS) return profile.totalScheduledKg
  return Math.min(profile.totalScheduledKg, rawPrefix(profile.command, t))
}
export function requestedWaterKgAt(schedule: InterventionSchedule, commandId: string, timeS: number): number {
  return prefix(getWaterProfile(schedule, commandId), m.nonnegative(timeS, 'timeS'))
}
export interface WaterMassRequest extends Omit<WindowRequest, 'command'> {
  readonly command: WaterDeliveryCommand
  readonly cumulativeStartKg: number
  readonly cumulativeEndKg: number
  readonly requestedKg: number
  readonly nominalMassFlowKgS: number
  readonly meanRequestedMassFlowKgS: number
  readonly roundoffKg: number
}
type OtherWindowRequest = Omit<WindowRequest, 'command'> & {
  readonly command: Exclude<WindowCommand, WaterDeliveryCommand | IgnitionCommand>
}
export type WaterPlannedRequest = StartRequest | OtherWindowRequest | IgnitionEnergyRequest | WaterMassRequest
export interface WaterStepSlice {
  readonly interval: TimeInterval
  readonly requests: readonly WaterPlannedRequest[]
}
export interface WaterStepPlan {
  readonly scheduleId: string
  readonly interval: TimeInterval
  readonly slices: readonly WaterStepSlice[]
}
export function isWaterMassRequest(r: WaterPlannedRequest): r is WaterMassRequest {
  return r.dispatch === 'over-interval' && r.command.kind === 'water-delivery'
}
/** A combined nominal planner: retains ignition budgets, all other events, and global order. */
export function planWaterStep(schedule: InterventionSchedule, step: TimeInterval): WaterStepPlan {
  const index = indexFor(schedule), base = planIgnitionStep(schedule, step)
  const cuts = new Set<number>([base.interval.startS, base.interval.endS])
  for (const s of base.slices) { cuts.add(s.interval.startS); cuts.add(s.interval.endS) }
  for (const p of index.profiles.values()) {
    const t = p.activeInterval.endS
    if (t > base.interval.startS && t < base.interval.endS) cuts.add(t)
  }
  const sorted = [...cuts].sort((a, b) => a - b), slices: WaterStepSlice[] = []
  for (let i = 1; i < sorted.length; i++) {
    const interval = Object.freeze({ startS: sorted[i - 1], endS: sorted[i] })
    const original = planIgnitionStep(schedule, interval)
    if (original.slices.length !== 1) m.fail('Water boundary refinement mismatch')
    const requests: WaterPlannedRequest[] = []
    for (const r of original.slices[0].requests) {
      if (r.dispatch !== 'over-interval' || r.command.kind !== 'water-delivery') {
        // Preserve the exact registered ignition objects, not a fabricated rewrapping.
        if (isIgnitionEnergyRequest(r)) requests.push(r)
        else requests.push(r as StartRequest | OtherWindowRequest)
        continue
      }
      const profile = index.profiles.get(r.command.id)!
      if (interval.startS >= profile.activeInterval.endS) continue
      const cumulativeStartKg = prefix(profile, interval.startS), cumulativeEndKg = prefix(profile, interval.endS)
      const requestedKg = cumulativeEndKg - cumulativeStartKg, dt = interval.endS - interval.startS
      if (!(requestedKg > 0) || !(requestedKg / dt > 0) || !Number.isFinite(requestedKg / dt)) m.fail('Water request resolution failure')
      requests.push(Object.freeze({
        ...r, command: r.command, cumulativeStartKg, cumulativeEndKg, requestedKg,
        nominalMassFlowKgS: r.command.massFlowKgS, meanRequestedMassFlowKgS: requestedKg / dt,
        roundoffKg: requestedKg - r.command.massFlowKgS * dt,
      }))
    }
    slices.push(Object.freeze({ interval, requests: Object.freeze(requests) }))
  }
  return Object.freeze({ scheduleId: schedule.id, interval: base.interval, slices: Object.freeze(slices) })
}

export interface HosePlacementReport {
  readonly requestId: string
  readonly status: 'placed' | 'rejected' | 'unknown'
  readonly reason: string | null
}
export interface HosePlacementReceipt extends HosePlacementReport {
  readonly kind: 'hose-placement'
  readonly commandId: string
  readonly hoseId: string
  readonly atS: number
}
export type HosePlacementCallback = (
  request: StartRequest & { readonly command: HosePlacementCommand },
) => HosePlacementReport
export interface WaterReservoirSeed { readonly reservoirId: string; readonly massKg: number }
export interface WaterReservoirState {
  readonly reservoirId: string
  readonly initialMassKg: number
  readonly remainingMassKg: number
}
export interface WaterOffer extends WaterMassRequest {
  readonly offeredKg: number
  readonly unavailableKg: number
  readonly availableAtReservationKg: number
  readonly confirmedPlacementRequestId: string | null
  /** Upper bound on the time-AVERAGED draw, not a predicted hydraulic flow. */
  readonly maximumMeanDrawKgS: number
  readonly reservationPolicy: 'proportional-per-slice-v1'
}
export type WaterDeliveryCallback = (offer: WaterOffer) => MaterialApplicationReport
export interface WaterDeliveryReceipt {
  readonly kind: 'water'
  readonly requestId: string
  readonly commandId: string
  readonly hoseId: string
  readonly reservoirId: string
  readonly placementCommandId: string
  readonly confirmedPlacementRequestId: string | null
  readonly interval: TimeInterval
  readonly availableAtReservationKg: number
  readonly reservoirBeforeKg: number
  readonly reservoirAfterKg: number | null
  readonly accounting: MaterialAccounting
}
declare const waterCheckpointBrand: unique symbol
export interface WaterCheckpoint {
  readonly kind: 'water-checkpoint'
  readonly schemaVersion: 1
  readonly scheduleJSON: string
  readonly throughS: number
  readonly seeds: readonly WaterReservoirSeed[]
  readonly reservoirs: readonly WaterReservoirState[]
  /**
   * Canonical slice ends, including caller-introduced solver boundaries.
   * Reservations/return reuse depend on these accepted intervals; replay must retain them.
   */
  readonly partitionEndsS: readonly number[]
  readonly placements: readonly HosePlacementReceipt[]
  readonly receipts: readonly WaterDeliveryReceipt[]
  readonly [waterCheckpointBrand]: true
}
const checkpoints = new WeakSet<WaterCheckpoint>()
function seedsFor(raw: unknown, schedule: InterventionSchedule): readonly WaterReservoirSeed[] {
  const seeds = m.dataArray(raw).map(value => {
    const d = m.dataObject(value, ['reservoirId', 'massKg'], 'water reservoir')
    return Object.freeze({ reservoirId: m.id(d.reservoirId, 'reservoirId'), massKg: m.nonnegative(d.massKg, 'massKg') })
  }).sort((a, b) => m.compare(a.reservoirId, b.reservoirId))
  const ids = new Set<string>()
  for (const seed of seeds) {
    if (ids.has(seed.reservoirId)) m.fail('Duplicate reservoir ID')
    ids.add(seed.reservoirId)
  }
  for (const c of schedule.commands) if (c.kind === 'water-delivery' && !ids.has(c.reservoirId)) {
    m.fail('Missing finite reservoir declaration')
  }
  return Object.freeze(seeds)
}
function checkpoint(
  scheduleJSON: string, throughS: number, seeds: readonly WaterReservoirSeed[],
  reservoirs: readonly WaterReservoirState[], partitionEndsS: readonly number[],
  placements: readonly HosePlacementReceipt[], receipts: readonly WaterDeliveryReceipt[],
): WaterCheckpoint {
  const result = Object.freeze({
    kind: 'water-checkpoint' as const, schemaVersion: 1 as const, scheduleJSON, throughS, seeds,
    reservoirs: Object.freeze([...reservoirs]), partitionEndsS: Object.freeze([...partitionEndsS]),
    placements: Object.freeze([...placements]), receipts: Object.freeze([...receipts]),
  }) as WaterCheckpoint
  checkpoints.add(result); return result
}
export function createWaterCheckpoint(
  schedule: InterventionSchedule, reservoirSeeds: readonly WaterReservoirSeed[],
): WaterCheckpoint {
  const { scheduleJSON } = indexFor(schedule), seeds = seedsFor(reservoirSeeds, schedule)
  return checkpoint(scheduleJSON, 0, seeds, seeds.map(s => Object.freeze({
    reservoirId: s.reservoirId, initialMassKg: s.massKg, remainingMassKg: s.massKg,
  })), [], [], [])
}
function placedReceipt(
  req: StartRequest & { readonly command: HosePlacementCommand }, raw: HosePlacementReport,
): HosePlacementReceipt {
  const d = m.dataObject(raw, ['requestId', 'status', 'reason'], 'hose report'), reason = m.reason(d.reason)
  if (d.requestId !== req.requestId || !['placed', 'rejected', 'unknown'].includes(d.status as string)) {
    m.fail('Invalid hose-placement status/identity')
  }
  if (d.status !== 'placed' && reason === null) m.fail('Unplaced hose requires a reason')
  return Object.freeze({
    kind: 'hose-placement' as const, requestId: req.requestId, commandId: req.command.id,
    hoseId: req.command.hoseId, atS: req.atS, status: d.status as HosePlacementReport['status'], reason,
  })
}
/** Internal reuse by ledger.ts; not the public barrel API or a physical commit. */
export const waterAccountingInternals = Object.freeze({ placedReceipt })

/**
 * Reserve available stock proportionally for eligible requests on ONE common time slice.
 * All shares are determined before reports; rejected/returned shares are not reallocated
 * until the next slice. This is a deterministic authoring policy, not hydraulics.
 */
function reservations(
  requests: readonly WaterMassRequest[], stock: ReadonlyMap<string, number>,
  placements: ReadonlyMap<string, HosePlacementReceipt>,
): ReadonlyMap<string, number> {
  const groups = new Map<string, WaterMassRequest[]>(), result = new Map<string, number>()
  for (const r of requests) {
    const p = placements.get(r.command.placementCommandId)
    if (!p || p.status !== 'placed' || p.atS > r.interval.startS) { result.set(r.requestId, 0); continue }
    const group = groups.get(r.command.reservoirId) ?? []
    group.push(r); groups.set(r.command.reservoirId, group)
  }
  for (const [reservoirId, group] of groups) {
    const available = stock.get(reservoirId)!
    const total = m.sum(group.map(r => r.requestedKg))
    if (available >= total) {
      for (const r of group) result.set(r.requestId, r.requestedKg)
      continue
    }
    let remaining = available
    for (let i = 0; i < group.length; i++) {
      const r = group[i]
      const provisional = i === group.length - 1 ? remaining : available * (r.requestedKg / total)
      if (available > 0 && provisional === 0 && r.requestedKg > 0) {
        m.fail('Proportional reservoir share is below representable resolution')
      }
      const share = Math.min(r.requestedKg, remaining, provisional)
      result.set(r.requestId, share)
      remaining = m.nonnegative(remaining - share, 'remaining reservation')
    }
  }
  return result
}
export interface WaterTrial {
  readonly before: WaterCheckpoint
  readonly plan: WaterStepPlan
  readonly placements: readonly HosePlacementReceipt[]
  readonly receipts: readonly WaterDeliveryReceipt[]
  readonly blockedAtS: number | null
  readonly candidate: WaterCheckpoint | null
}
/** A pure accounting transaction around explicit reports of DETACHED physical trials. */
export function stageWaterStep(
  schedule: InterventionSchedule, before: WaterCheckpoint, step: TimeInterval,
  callbacks: { readonly placeHose: HosePlacementCallback; readonly deliverWater: WaterDeliveryCallback },
): WaterTrial {
  if (!checkpoints.has(before) || before.scheduleJSON !== serializeSchedule(schedule)) {
    m.fail('Use a validated water checkpoint with identical schedule content')
  }
  const plan = planWaterStep(schedule, step)
  if (plan.interval.startS !== before.throughS) m.fail('Water step must begin at throughS')
  const cb = m.dataObject(callbacks, ['placeHose', 'deliverWater'], 'water callbacks')
  if (typeof cb.placeHose !== 'function' || typeof cb.deliverWater !== 'function') m.fail('Explicit water callbacks required')
  const handlers = Object.freeze({
    placeHose: cb.placeHose as HosePlacementCallback, deliverWater: cb.deliverWater as WaterDeliveryCallback,
  })
  const stock = new Map(before.reservoirs.map(s => [s.reservoirId, s.remainingMassKg]))
  const initial = new Map(before.seeds.map(s => [s.reservoirId, s.massKg]))
  const netDraws = new Map(before.seeds.map(s => [s.reservoirId, [] as number[]]))
  for (const r of before.receipts) netDraws.get(r.reservoirId)!.push(r.accounting.drawnKg! - r.accounting.returnedKg!)
  const placed = new Map(before.placements.map(p => [p.commandId, p]))
  const placements: HosePlacementReceipt[] = [], receipts: WaterDeliveryReceipt[] = []
  const ends = [...before.partitionEndsS]
  let blockedAtS: number | null = null
  for (const slice of plan.slices) {
    for (const r of slice.requests) if (r.dispatch === 'at-start' && r.command.kind === 'hose-placement') {
      const request = r as StartRequest & { readonly command: HosePlacementCommand }
      const receipt = placedReceipt(request, handlers.placeHose(request))
      placements.push(receipt)
      if (receipt.status === 'unknown') { blockedAtS = slice.interval.startS; break }
      placed.set(receipt.commandId, receipt)
    }
    if (blockedAtS !== null) break
    const water = slice.requests.filter(isWaterMassRequest)
    const shares = reservations(water, stock, placed)
    const atReservation = new Map(stock)
    for (const r of water) {
      const c = r.command, p = placed.get(c.placementCommandId)
      const offeredKg = shares.get(r.requestId)!
      const confirmedPlacementRequestId = p?.status === 'placed' ? p.requestId : null
      const availableAtReservationKg = atReservation.get(c.reservoirId)!
      const mean = offeredKg / (r.interval.endS - r.interval.startS)
      if (!Number.isFinite(mean) || (offeredKg > 0 && mean === 0)) m.fail('Offered mean flow is unrepresentable')
      const offer: WaterOffer = Object.freeze({
        ...r, offeredKg, unavailableKg: r.requestedKg - offeredKg, availableAtReservationKg,
        confirmedPlacementRequestId, maximumMeanDrawKgS: mean, reservationPolicy: 'proportional-per-slice-v1',
      })
      const accounting = m.validateApplication(r.requestId, r.requestedKg, offeredKg, null, handlers.deliverWater(offer))
      const reservoirBeforeKg = stock.get(c.reservoirId)!, history = netDraws.get(c.reservoirId)!
      const reservoirAfterKg = m.remainingMass(reservoirBeforeKg, accounting, initial.get(c.reservoirId)!, history)
      receipts.push(Object.freeze({
        kind: 'water' as const, requestId: r.requestId, commandId: c.id, hoseId: c.hoseId,
        reservoirId: c.reservoirId, placementCommandId: c.placementCommandId, confirmedPlacementRequestId,
        interval: r.interval, availableAtReservationKg, reservoirBeforeKg, reservoirAfterKg, accounting,
      }))
      if (reservoirAfterKg === null) { blockedAtS = slice.interval.startS; break }
      stock.set(c.reservoirId, reservoirAfterKg)
      history.push(accounting.drawnKg! - accounting.returnedKg!)
    }
    if (blockedAtS !== null) break
    ends.push(slice.interval.endS)
  }
  const candidate = blockedAtS !== null ? null : checkpoint(
    before.scheduleJSON, plan.interval.endS, before.seeds,
    before.reservoirs.map(s => Object.freeze({ ...s, remainingMassKg: stock.get(s.reservoirId)! })),
    ends, [...before.placements, ...placements], [...before.receipts, ...receipts],
  )
  return Object.freeze({
    before, plan, placements: Object.freeze(placements), receipts: Object.freeze(receipts), blockedAtS, candidate,
  })
}
export function serializeWaterCheckpoint(state: WaterCheckpoint): string {
  if (!checkpoints.has(state)) m.fail('Unvalidated water checkpoint')
  return JSON.stringify(state)
}
export function parseWaterCheckpoint(schedule: InterventionSchedule, text: string): WaterCheckpoint {
  if (typeof text !== 'string') m.fail('Water checkpoint must be JSON text')
  const raw = JSON.parse(text) as unknown
  const d = m.dataObject(raw, [
    'kind', 'schemaVersion', 'scheduleJSON', 'throughS', 'seeds', 'reservoirs',
    'partitionEndsS', 'placements', 'receipts',
  ], 'water checkpoint')
  if (d.kind !== 'water-checkpoint' || d.schemaVersion !== 1
      || d.scheduleJSON !== serializeSchedule(schedule)) m.fail('Water checkpoint schema/schedule mismatch')
  const throughS = m.nonnegative(d.throughS, 'throughS')
  let state = createWaterCheckpoint(schedule, seedsFor(d.seeds, schedule))
  const placementReports = new Map<string, HosePlacementReport>(), reports = new Map<string, MaterialApplicationReport>()
  for (const entry of m.dataArray(d.placements)) {
    const r = m.dataObject(entry, ['kind', 'requestId', 'commandId', 'hoseId', 'atS', 'status', 'reason'], 'hose receipt')
    if (typeof r.requestId !== 'string' || placementReports.has(r.requestId)) return m.fail('Duplicate/invalid hose receipt ID')
    placementReports.set(r.requestId, {
      requestId: r.requestId, status: r.status as HosePlacementReport['status'], reason: r.reason as string | null,
    })
  }
  for (const entry of m.dataArray(d.receipts)) {
    const r = m.dataObject(entry, [
      'kind', 'requestId', 'commandId', 'hoseId', 'reservoirId', 'placementCommandId',
      'confirmedPlacementRequestId', 'interval', 'availableAtReservationKg',
      'reservoirBeforeKg', 'reservoirAfterKg', 'accounting',
    ], 'water receipt')
    if (typeof r.requestId !== 'string' || reports.has(r.requestId)) return m.fail('Duplicate/invalid water receipt ID')
    reports.set(r.requestId, m.reportOf(r.accounting as MaterialAccounting))
  }
  for (const rawEnd of m.dataArray(d.partitionEndsS)) {
    const endS = m.nonnegative(rawEnd, 'partition end')
    if (endS <= state.throughS || endS > throughS) m.fail('Invalid restart partition')
    const trial = stageWaterStep(schedule, state, { startS: state.throughS, endS }, {
      placeHose: req => {
        const r = placementReports.get(req.requestId)
        if (!r) return m.fail('Missing hose placement receipt')
        placementReports.delete(req.requestId); return r
      },
      deliverWater: offer => {
        const r = reports.get(offer.requestId)
        if (!r) return m.fail('Missing water receipt')
        reports.delete(offer.requestId); return r
      },
    })
    if (trial.candidate === null) return m.fail('Unresolved water checkpoint')
    state = trial.candidate
  }
  if (state.throughS !== throughS || placementReports.size || reports.size) m.fail('Incomplete/extra water history')
  if (m.canonicalJSON(state) !== m.canonicalJSON(raw)) m.fail('Water checkpoint independent recomputation mismatch')
  return state
}
