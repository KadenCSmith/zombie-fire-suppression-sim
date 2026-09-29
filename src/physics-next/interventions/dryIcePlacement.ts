import { clipScheduleToStep, serializeSchedule } from './schedule'
import type {
  DryIcePlacementCommand, InterventionSchedule, StartRequest, TimeInterval,
} from './types'

export class MaterialAccountingError extends Error {
  constructor(message: string) { super(message); this.name = 'MaterialAccountingError' }
}
function fail(message: string): never { throw new MaterialAccountingError(message) }
function dataObject(raw: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail(`${label}: expected plain data`)
  const proto = Object.getPrototypeOf(raw)
  if (proto !== Object.prototype && proto !== null) fail(`${label}: unsupported prototype`)
  const own = Reflect.ownKeys(raw)
  if (own.length !== keys.length) fail(`${label}: missing or extra keys`)
  for (const key of own) {
    if (typeof key !== 'string' || !keys.includes(key)) fail(`${label}: unknown key`)
    if (!('value' in Object.getOwnPropertyDescriptor(raw, key)!)) fail(`${label}: accessors are unsupported`)
  }
  for (const key of keys) if (!Object.hasOwn(raw, key)) fail(`${label}: missing ${key}`)
  return raw as Record<string, unknown>
}
function dataArray(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype
      || Reflect.ownKeys(raw).length !== raw.length + 1) fail('Expected a dense plain array')
  for (let i = 0; i < raw.length; i++) {
    const d = Object.getOwnPropertyDescriptor(raw, String(i))
    if (!d || !('value' in d)) fail('Array holes/accessors are unsupported')
  }
  return raw
}
function finite(raw: unknown, label: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) fail(`${label}: expected finite number`)
  return raw === 0 ? 0 : raw
}
function nonnegative(raw: unknown, label: string): number {
  const n = finite(raw, label)
  if (n < 0) fail(`${label}: expected nonnegative number`)
  return n
}
function id(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(raw)) {
    fail(`${label}: invalid stable ID`)
  }
  return raw
}
function reason(raw: unknown): string | null {
  if (raw === null) return null
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 512) fail('Invalid reason')
  return raw
}
function amount(raw: unknown, label: string): number | null {
  return raw === null ? null : nonnegative(raw, label)
}
function signedAmount(raw: unknown, label: string): number | null {
  return raw === null ? null : finite(raw, label)
}
function sum(values: readonly number[]): number {
  let total = 0, correction = 0
  for (const value of values) {
    finite(value, 'summand')
    const next = finite(total + value, 'sum')
    correction = finite(correction + (Math.abs(total) >= Math.abs(value)
      ? (total - next) + value : (value - next) + total), 'sum correction')
    total = next
  }
  return finite(total + correction, 'compensated sum')
}
function tolerance(scale: number): number { return 64 * Number.EPSILON * Math.abs(scale) }
function balance(lhs: number | null, terms: readonly (number | null)[], label: string): number | null {
  if (lhs === null || terms.some(x => x === null)) return null
  const known = terms as readonly number[]
  const residual = finite(lhs - sum(known), `${label} residual`)
  const scale = Math.max(Math.abs(lhs), ...known.map(Math.abs))
  if (Math.abs(residual) > tolerance(scale)) fail(`${label} does not reconcile`)
  return residual === 0 ? 0 : residual
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0 }
/** Used only with JSON-compatible validated/frozen data, never to invoke a report callback. */
function canonicalJSON(raw: unknown): string {
  const encode = (value: unknown): unknown => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') return finite(value, 'JSON number')
    if (Array.isArray(value)) return dataArray(value).map(encode)
    if (typeof value !== 'object' || value === null) fail('Not JSON data')
    const keys = Reflect.ownKeys(value)
    if (keys.some(k => typeof k !== 'string')) fail('Symbol key in JSON')
    const d = dataObject(value, keys as string[], 'JSON object')
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const key of (keys as string[]).sort(compare)) result[key] = encode(d[key])
    return result
  }
  return JSON.stringify(encode(raw))
}

/**
 * Energies are signed parcel internal energies relative to ONE explicit datum.
 * They are not heat removed, latent heat, reaction heat, or treatment efficacy.
 * null stays unknown; a known value (including zero) requires a referenceId.
 */
export interface MaterialEnergyReport {
  readonly referenceId: string | null
  readonly requestedJ: number | null
  readonly drawnJ: number | null
  readonly rejectedJ: number | null
  readonly appliedJ: number | null
  readonly returnedJ: number | null
  readonly externalLossJ: number | null
  readonly unresolvedJ: number | null
}
export interface MaterialApplicationReport {
  readonly requestId: string
  readonly drawnKg: number | null
  /** Never drawn, including any unavailable stock. Not returned water/material. */
  readonly rejectedKg: number | null
  readonly appliedKg: number | null
  readonly returnedKg: number | null
  readonly externalLossKg: number | null
  /** Drawn mass whose destination is unclassified; positive means not settled. */
  readonly unresolvedKg: number | null
  readonly energy: MaterialEnergyReport
  /** Separate externally supplied work; nonnegative into domain; null is unknown. */
  readonly workIntoDomainJ: number | null
  readonly reason: string | null
}
export interface MaterialAccounting extends MaterialApplicationReport {
  readonly requestedKg: number
  readonly offeredKg: number
  readonly unavailableKg: number
  readonly admissionResidualKg: number | null
  readonly transferResidualKg: number | null
  readonly admissionResidualJ: number | null
  readonly transferResidualJ: number | null
}
export interface DeclaredInternalEnergy {
  readonly referenceId: string
  readonly internalEnergyJ: number
}
const ENERGY_KEYS = [
  'referenceId', 'requestedJ', 'drawnJ', 'rejectedJ', 'appliedJ', 'returnedJ', 'externalLossJ', 'unresolvedJ',
] as const
const REPORT_KEYS = [
  'requestId', 'drawnKg', 'rejectedKg', 'appliedKg', 'returnedKg', 'externalLossKg', 'unresolvedKg',
  'energy', 'workIntoDomainJ', 'reason',
] as const

function validateApplication(
  requestId: string, requestedKg: number, offeredKg: number,
  declaredEnergy: DeclaredInternalEnergy | null, raw: MaterialApplicationReport,
): MaterialAccounting {
  nonnegative(requestedKg, 'requestedKg'); nonnegative(offeredKg, 'offeredKg')
  if (offeredKg > requestedKg) fail('Offer exceeds nominal request')
  const d = dataObject(raw, REPORT_KEYS, 'material report')
  if (d.requestId !== requestId) fail('Material report request ID mismatch')
  const drawnKg = amount(d.drawnKg, 'drawnKg'), rejectedKg = amount(d.rejectedKg, 'rejectedKg')
  const appliedKg = amount(d.appliedKg, 'appliedKg'), returnedKg = amount(d.returnedKg, 'returnedKg')
  const externalLossKg = amount(d.externalLossKg, 'externalLossKg')
  const unresolvedKg = amount(d.unresolvedKg, 'unresolvedKg'), why = reason(d.reason)
  const unavailableKg = requestedKg - offeredKg
  if (drawnKg !== null && drawnKg > offeredKg) fail('Draw exceeds finite offer/stock')
  if (rejectedKg !== null && (rejectedKg > requestedKg
      || unavailableKg - rejectedKg > tolerance(requestedKg))) fail('Invalid never-drawn rejection')
  const admissionKnown = [drawnKg, rejectedKg].filter((v): v is number => v !== null)
  if (sum(admissionKnown) - requestedKg > tolerance(requestedKg)) fail('Known mass exceeds request')
  const destinations = [appliedKg, returnedKg, externalLossKg, unresolvedKg]
  const known = destinations.filter((v): v is number => v !== null)
  for (const n of known) if (n > (drawnKg ?? offeredKg)) fail('Destination exceeds draw/offer')
  if (sum(known) - (drawnKg ?? offeredKg) > tolerance(drawnKg ?? offeredKg)) {
    fail('Known destinations exceed available drawn mass')
  }
  const admissionResidualKg = balance(requestedKg, [drawnKg, rejectedKg], 'request admission')
  const transferResidualKg = balance(drawnKg, destinations, 'draw disposition')
  const e = dataObject(d.energy, ENERGY_KEYS, 'material energy')
  const referenceId = e.referenceId === null ? null : id(e.referenceId, 'energy referenceId')
  const energy: MaterialEnergyReport = Object.freeze({
    referenceId, requestedJ: signedAmount(e.requestedJ, 'requestedJ'),
    drawnJ: signedAmount(e.drawnJ, 'drawnJ'), rejectedJ: signedAmount(e.rejectedJ, 'rejectedJ'),
    appliedJ: signedAmount(e.appliedJ, 'appliedJ'), returnedJ: signedAmount(e.returnedJ, 'returnedJ'),
    externalLossJ: signedAmount(e.externalLossJ, 'externalLossJ'), unresolvedJ: signedAmount(e.unresolvedJ, 'unresolvedJ'),
  })
  if (referenceId === null && ENERGY_KEYS.slice(1).some(k => energy[k] !== null)) {
    fail('Known internal energy requires an explicit reference datum')
  }
  if (declaredEnergy !== null && (referenceId !== declaredEnergy.referenceId
      || energy.requestedJ !== declaredEnergy.internalEnergyJ)) fail('Declared energy/datum was changed or erased')
  for (const [mass, joules] of [
    [requestedKg, energy.requestedJ], [drawnKg, energy.drawnJ], [rejectedKg, energy.rejectedJ],
    [appliedKg, energy.appliedJ], [returnedKg, energy.returnedJ],
    [externalLossKg, energy.externalLossJ], [unresolvedKg, energy.unresolvedJ],
  ]) if (mass === 0 && joules !== null && joules !== 0) fail('Nonzero parcel energy with explicitly zero mass')
  const admissionResidualJ = balance(energy.requestedJ, [energy.drawnJ, energy.rejectedJ], 'energy admission')
  const transferResidualJ = balance(energy.drawnJ,
    [energy.appliedJ, energy.returnedJ, energy.externalLossJ, energy.unresolvedJ], 'energy disposition')
  const workIntoDomainJ = amount(d.workIntoDomainJ, 'workIntoDomainJ')
  if (([drawnKg, rejectedKg, ...destinations].some(x => x === null)
      || rejectedKg !== 0 || returnedKg !== 0 || externalLossKg !== 0 || unresolvedKg !== 0
      || ENERGY_KEYS.slice(1).some(k => energy[k] === null) || workIntoDomainJ === null) && why === null) {
    fail('Rejected, returned, lost or unknown quantities require an explicit reason')
  }
  return Object.freeze({
    requestId, requestedKg, offeredKg, unavailableKg, drawnKg, rejectedKg, appliedKg,
    returnedKg, externalLossKg, unresolvedKg, energy, workIntoDomainJ, reason: why,
    admissionResidualKg, transferResidualKg, admissionResidualJ, transferResidualJ,
  })
}
function reportOf(a: MaterialAccounting): MaterialApplicationReport {
  return {
    requestId: a.requestId, drawnKg: a.drawnKg, rejectedKg: a.rejectedKg, appliedKg: a.appliedKg,
    returnedKg: a.returnedKg, externalLossKg: a.externalLossKg, unresolvedKg: a.unresolvedKg,
    energy: a.energy, workIntoDomainJ: a.workIntoDomainJ, reason: a.reason,
  }
}
function massSettled(a: MaterialAccounting): boolean {
  return [a.drawnKg, a.rejectedKg, a.appliedKg, a.returnedKg, a.externalLossKg, a.unresolvedKg]
    .every(x => x !== null) && a.unresolvedKg === 0
}
function remainingMass(
  beforeKg: number, a: MaterialAccounting, initialKg = beforeKg,
  priorNetDraws: readonly number[] = [],
): number | null {
  if (!massSettled(a)) return null
  const netDraw = a.drawnKg! - a.returnedKg!
  const afterKg = nonnegative(initialKg - sum([...priorNetDraws, netDraw]), 'remaining stock')
  if (afterKg > beforeKg) fail('A report cannot create stock')
  if (netDraw > 0 && afterKg === beforeKg) fail('Stock decrement is below representable resolution')
  return afterKg
}

/**
 * Shared implementation helpers for the allowed water/ledger files.
 * Not the public barrel API, not an authorization or physical-commit interface.
 * Reusers must reconstruct offers from canonical schedules and accepted finite stock.
 */
export const materialAccountingInternals = Object.freeze({
  fail, dataObject, dataArray, finite, nonnegative, id, reason, amount, sum, tolerance, balance,
  compare, canonicalJSON, validateApplication, reportOf, massSettled, remainingMass,
})

export interface DryIceInventorySeed {
  readonly inventoryId: string
  readonly massKg: number
}
export interface DryIceInventoryState {
  readonly inventoryId: string
  readonly initialMassKg: number
  readonly remainingMassKg: number
}
export interface DryIceOffer {
  readonly requestId: string
  readonly atS: number
  readonly command: DryIcePlacementCommand
  readonly requestedKg: number
  readonly offeredKg: number
  readonly unavailableKg: number
  readonly availableBeforeKg: number
  /** Total declaration for requestedKg, NOT scaled into an applied-energy guess. */
  readonly declaredEnergy: DeclaredInternalEnergy | null
}
export type DryIcePlacementCallback = (offer: DryIceOffer) => MaterialApplicationReport
export interface DryIceReceipt {
  readonly kind: 'dry-ice'
  readonly requestId: string
  readonly commandId: string
  readonly sourceId: string
  readonly inventoryId: string
  readonly atS: number
  readonly inventoryBeforeKg: number
  readonly inventoryAfterKg: number | null
  readonly accounting: MaterialAccounting
}
declare const dryCheckpointBrand: unique symbol
export interface DryIceCheckpoint {
  readonly kind: 'dry-ice-checkpoint'
  readonly schemaVersion: 1
  readonly scheduleJSON: string
  readonly throughS: number
  readonly seeds: readonly DryIceInventorySeed[]
  readonly inventories: readonly DryIceInventoryState[]
  readonly receipts: readonly DryIceReceipt[]
  readonly [dryCheckpointBrand]: true
}
const checkpoints = new WeakSet<DryIceCheckpoint>()
function stocks(raw: unknown, schedule: InterventionSchedule): readonly DryIceInventorySeed[] {
  const seeds = dataArray(raw).map(value => {
    const d = dataObject(value, ['inventoryId', 'massKg'], 'dry-ice seed')
    return Object.freeze({ inventoryId: id(d.inventoryId, 'inventoryId'), massKg: nonnegative(d.massKg, 'massKg') })
  }).sort((a, b) => compare(a.inventoryId, b.inventoryId))
  const names = new Set<string>()
  for (const seed of seeds) {
    if (names.has(seed.inventoryId)) fail('Duplicate dry-ice inventory ID')
    names.add(seed.inventoryId)
  }
  for (const c of schedule.commands) {
    if (c.kind === 'dry-ice-placement' && !names.has(c.inventoryId)) fail('Missing declared dry-ice inventory')
  }
  return Object.freeze(seeds)
}
function checkpoint(
  scheduleJSON: string, throughS: number, seeds: readonly DryIceInventorySeed[],
  inventories: readonly DryIceInventoryState[], receipts: readonly DryIceReceipt[],
): DryIceCheckpoint {
  const value = Object.freeze({
    kind: 'dry-ice-checkpoint' as const, schemaVersion: 1 as const, scheduleJSON, throughS,
    seeds, inventories: Object.freeze([...inventories]), receipts: Object.freeze([...receipts]),
  }) as DryIceCheckpoint
  checkpoints.add(value)
  return value
}
export function createDryIceCheckpoint(
  schedule: InterventionSchedule, inventorySeeds: readonly DryIceInventorySeed[],
): DryIceCheckpoint {
  const scheduleJSON = serializeSchedule(schedule), seeds = stocks(inventorySeeds, schedule)
  return checkpoint(scheduleJSON, 0, seeds, seeds.map(s => Object.freeze({
    inventoryId: s.inventoryId, initialMassKg: s.massKg, remainingMassKg: s.massKg,
  })), [])
}
function assertCheckpoint(schedule: InterventionSchedule, before: DryIceCheckpoint): void {
  if (!checkpoints.has(before) || before.scheduleJSON !== serializeSchedule(schedule)) {
    fail('Use a validated dry-ice checkpoint with identical schedule content')
  }
}
export interface DryIceTrial {
  readonly before: DryIceCheckpoint
  readonly interval: TimeInterval
  readonly receipts: readonly DryIceReceipt[]
  /** Nonempty when a prior unresolved mass report prevents safe later stock offers. */
  readonly unattemptedRequestIds: readonly string[]
  readonly candidate: DryIceCheckpoint | null
}
function isDryIceStart(r: StartRequest): r is StartRequest & { readonly command: DryIcePlacementCommand } {
  return r.command.kind === 'dry-ice-placement'
}

/**
 * Reports are for detached staged physical work. No mutation of live state is permitted.
 * No sublimation law, geometry/capacity prediction or automatic rejection is calculated here.
 * Every eligible placement, including an empty-stock offer, needs an explicit callback report.
 */
export function stageDryIceStep(
  schedule: InterventionSchedule, before: DryIceCheckpoint, step: TimeInterval,
  report: DryIcePlacementCallback,
): DryIceTrial {
  assertCheckpoint(schedule, before)
  const plan = clipScheduleToStep(schedule, step)
  if (plan.interval.startS !== before.throughS) fail('Dry-ice step must begin at throughS')
  if (typeof report !== 'function') fail('Dry-ice callback is required')
  const requests = plan.slices.flatMap(s => s.requests)
    .filter((r): r is StartRequest => r.dispatch === 'at-start').filter(isDryIceStart)
  const remaining = new Map(before.inventories.map(s => [s.inventoryId, s.remainingMassKg]))
  const initial = new Map(before.seeds.map(s => [s.inventoryId, s.massKg]))
  const netDraws = new Map(before.seeds.map(s => [s.inventoryId, [] as number[]]))
  for (const r of before.receipts) netDraws.get(r.inventoryId)!.push(r.accounting.drawnKg! - r.accounting.returnedKg!)
  const receipts: DryIceReceipt[] = [], unattemptedRequestIds: string[] = []
  let blocked = false
  for (const req of requests) {
    if (blocked) { unattemptedRequestIds.push(req.requestId); continue }
    const c = req.command, availableBeforeKg = remaining.get(c.inventoryId)!
    const offeredKg = Math.min(c.massKg, availableBeforeKg)
    const declaredEnergy = c.thermal.kind === 'internal-energy' ? Object.freeze({
      referenceId: c.thermal.referenceId, internalEnergyJ: c.thermal.internalEnergyJ,
    }) : null
    const offer: DryIceOffer = Object.freeze({
      requestId: req.requestId, atS: req.atS, command: c, requestedKg: c.massKg, offeredKg,
      unavailableKg: c.massKg - offeredKg, availableBeforeKg, declaredEnergy,
    })
    const accounting = validateApplication(req.requestId, c.massKg, offeredKg, declaredEnergy, report(offer))
    const history = netDraws.get(c.inventoryId)!
    const inventoryAfterKg = remainingMass(availableBeforeKg, accounting, initial.get(c.inventoryId)!, history)
    receipts.push(Object.freeze({
      kind: 'dry-ice' as const, requestId: req.requestId, commandId: c.id,
      sourceId: c.sourceId, inventoryId: c.inventoryId, atS: req.atS,
      inventoryBeforeKg: availableBeforeKg, inventoryAfterKg, accounting,
    }))
    if (inventoryAfterKg === null) blocked = true
    else {
      remaining.set(c.inventoryId, inventoryAfterKg)
      history.push(accounting.drawnKg! - accounting.returnedKg!)
    }
  }
  const candidate = blocked ? null : checkpoint(before.scheduleJSON, plan.interval.endS, before.seeds,
    before.inventories.map(s => Object.freeze({ ...s, remainingMassKg: remaining.get(s.inventoryId)! })),
    [...before.receipts, ...receipts])
  return Object.freeze({
    before, interval: plan.interval, receipts: Object.freeze(receipts),
    unattemptedRequestIds: Object.freeze(unattemptedRequestIds), candidate,
  })
}
export function serializeDryIceCheckpoint(state: DryIceCheckpoint): string {
  if (!checkpoints.has(state)) fail('Unvalidated dry-ice checkpoint')
  return JSON.stringify(state)
}
/** Recompute initial stock, every eligible event and every receipt; never trust stored totals. */
export function parseDryIceCheckpoint(schedule: InterventionSchedule, text: string): DryIceCheckpoint {
  if (typeof text !== 'string') fail('Checkpoint must be JSON text')
  const raw = JSON.parse(text) as unknown
  const d = dataObject(raw,
    ['kind', 'schemaVersion', 'scheduleJSON', 'throughS', 'seeds', 'inventories', 'receipts'], 'dry-ice checkpoint')
  if (d.kind !== 'dry-ice-checkpoint' || d.schemaVersion !== 1
      || d.scheduleJSON !== serializeSchedule(schedule)) fail('Dry-ice checkpoint schema/schedule mismatch')
  const throughS = nonnegative(d.throughS, 'throughS')
  const before = createDryIceCheckpoint(schedule, stocks(d.seeds, schedule))
  const reports = new Map<string, MaterialApplicationReport>()
  for (const entry of dataArray(d.receipts)) {
    const r = dataObject(entry, [
      'kind', 'requestId', 'commandId', 'sourceId', 'inventoryId', 'atS',
      'inventoryBeforeKg', 'inventoryAfterKg', 'accounting',
    ], 'dry-ice receipt')
    if (typeof r.requestId !== 'string' || reports.has(r.requestId)) fail('Duplicate/invalid dry-ice receipt ID')
    // reportOf selects report fields; the complete stored accounting is compared after recomputation.
    reports.set(r.requestId, reportOf(r.accounting as MaterialAccounting))
  }
  const trial = stageDryIceStep(schedule, before, { startS: 0, endS: throughS }, offer => {
    const report = reports.get(offer.requestId)
    if (!report) fail('Checkpoint omits an eligible dry-ice placement')
    reports.delete(offer.requestId)
    return report
  })
  if (reports.size || trial.candidate === null) fail('Extra or unresolved dry-ice checkpoint receipts')
  if (canonicalJSON(trial.candidate) !== canonicalJSON(raw)) fail('Dry-ice stock/receipt recomputation mismatch')
  return trial.candidate
}
