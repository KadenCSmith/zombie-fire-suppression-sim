import { serializeSchedule } from './schedule'
import {
  createIgnitionCheckpoint, parseIgnitionCheckpoint, stageIgnitionStep, summarizeIgnitionReceipts,
  type IgnitionCheckpoint, type IgnitionReceipt, type IgnitionReportCallback, type IgnitionTotals,
} from './ignition'
import {
  createDryIceCheckpoint, materialAccountingInternals as m, parseDryIceCheckpoint, stageDryIceStep,
  type DryIceCheckpoint, type DryIceInventorySeed, type DryIcePlacementCallback, type DryIceReceipt,
  type MaterialAccounting, type MaterialEnergyReport,
} from './dryIcePlacement'
import {
  createWaterCheckpoint, parseWaterCheckpoint, planWaterStep, stageWaterStep, waterAccountingInternals,
  type HosePlacementCallback, type HosePlacementReceipt, type HosePlacementReport,
  type WaterCheckpoint, type WaterDeliveryCallback, type WaterDeliveryReceipt, type WaterReservoirSeed,
} from './waterDelivery'
import {
  COMMAND_KIND_ORDER, type CancelCommand, type ExcavationCommand, type HosePlacementCommand,
  type InterventionSchedule, type StartRequest, type TimeInterval, type WindowRequest,
} from './types'

export interface QuantityTotal {
  readonly total: number | null
  readonly knownTotal: number
  readonly unknownCount: number
}
function quantity(values: readonly (number | null)[]): QuantityTotal {
  const knownTotal = m.sum(values.filter((v): v is number => v !== null))
  const unknownCount = values.filter(v => v === null).length
  return Object.freeze({ total: unknownCount ? null : knownTotal, knownTotal, unknownCount })
}
export interface MaterialMassTotals {
  readonly requestedKg: QuantityTotal
  readonly drawnKg: QuantityTotal
  readonly rejectedKg: QuantityTotal
  readonly appliedKg: QuantityTotal
  readonly returnedKg: QuantityTotal
  readonly externalLossKg: QuantityTotal
  readonly unresolvedKg: QuantityTotal
  readonly admissionResidualKg: number | null
  readonly transferResidualKg: number | null
}
function massTotals(records: readonly MaterialAccounting[]): MaterialMassTotals {
  const requestedKg = quantity(records.map(r => r.requestedKg))
  const drawnKg = quantity(records.map(r => r.drawnKg)), rejectedKg = quantity(records.map(r => r.rejectedKg))
  const appliedKg = quantity(records.map(r => r.appliedKg)), returnedKg = quantity(records.map(r => r.returnedKg))
  const externalLossKg = quantity(records.map(r => r.externalLossKg))
  const unresolvedKg = quantity(records.map(r => r.unresolvedKg))
  return Object.freeze({
    requestedKg, drawnKg, rejectedKg, appliedKg, returnedKg, externalLossKg, unresolvedKg,
    admissionResidualKg: m.balance(requestedKg.total, [drawnKg.total, rejectedKg.total], 'aggregate mass admission'),
    transferResidualKg: m.balance(drawnKg.total,
      [appliedKg.total, returnedKg.total, externalLossKg.total, unresolvedKg.total], 'aggregate mass disposition'),
  })
}
export interface MaterialEnergyTotals {
  readonly material: 'dry-ice' | 'water'
  readonly referenceId: string | null
  readonly requestedJ: QuantityTotal
  readonly drawnJ: QuantityTotal
  readonly rejectedJ: QuantityTotal
  readonly appliedJ: QuantityTotal
  readonly returnedJ: QuantityTotal
  readonly externalLossJ: QuantityTotal
  readonly unresolvedJ: QuantityTotal
  readonly admissionResidualJ: number | null
  readonly transferResidualJ: number | null
}
function energyTotals(
  material: MaterialEnergyTotals['material'], referenceId: string | null, entries: readonly MaterialEnergyReport[],
): MaterialEnergyTotals {
  const requestedJ = quantity(entries.map(e => e.requestedJ)), drawnJ = quantity(entries.map(e => e.drawnJ))
  const rejectedJ = quantity(entries.map(e => e.rejectedJ)), appliedJ = quantity(entries.map(e => e.appliedJ))
  const returnedJ = quantity(entries.map(e => e.returnedJ)), externalLossJ = quantity(entries.map(e => e.externalLossJ))
  const unresolvedJ = quantity(entries.map(e => e.unresolvedJ))
  return Object.freeze({
    material, referenceId, requestedJ, drawnJ, rejectedJ, appliedJ, returnedJ, externalLossJ, unresolvedJ,
    admissionResidualJ: m.balance(requestedJ.total, [drawnJ.total, rejectedJ.total], 'aggregate energy admission'),
    transferResidualJ: m.balance(drawnJ.total,
      [appliedJ.total, returnedJ.total, externalLossJ.total, unresolvedJ.total], 'aggregate energy disposition'),
  })
}

export interface ExcavateReport {
  readonly requestId: string
  /** Acceptance of this WINDOW only, never a claim the whole operation finished. */
  readonly status: 'accepted-window' | 'rejected' | 'unknown'
  readonly reason: string | null
}
export type ExcavationReportCallback = (
  request: Omit<WindowRequest, 'command'> & { readonly command: ExcavationCommand },
) => ExcavateReport
export interface ExcavationReceipt extends ExcavateReport {
  readonly kind: 'excavation-window'
  readonly commandId: string
  readonly operationId: string
  readonly interval: TimeInterval
  /** No quantitative excavation source was declared. Agent A/D must report exports/work separately. */
  readonly requestedMassKg: null
  readonly appliedMassKg: null
  readonly requestedEnergyJ: null
  readonly appliedEnergyJ: null
}
export interface CancellationReceipt {
  readonly kind: 'cancellation'
  readonly requestId: string
  readonly commandId: string
  readonly targetCommandId: string
  readonly atS: number
  /** An audit of schedule intent, NOT a physical undo or a material-delivery receipt. */
  readonly status: 'scheduled-cutoff-recorded'
}
export type OperationReceipt = ExcavationReceipt | CancellationReceipt
export type LedgerReceipt =
  | { readonly kind: 'ignition'; readonly receipt: IgnitionReceipt }
  | DryIceReceipt | WaterDeliveryReceipt | HosePlacementReceipt | OperationReceipt

function cancellation(r: StartRequest & { readonly command: CancelCommand }): CancellationReceipt {
  return Object.freeze({
    kind: 'cancellation' as const, requestId: r.requestId, commandId: r.command.id,
    targetCommandId: r.command.targetCommandId, atS: r.atS, status: 'scheduled-cutoff-recorded' as const,
  })
}
function excavation(
  r: Omit<WindowRequest, 'command'> & { readonly command: ExcavationCommand }, report: ExcavateReport,
): ExcavationReceipt {
  const d = m.dataObject(report, ['requestId', 'status', 'reason'], 'excavation report'), reason = m.reason(d.reason)
  if (d.requestId !== r.requestId || !['accepted-window', 'rejected', 'unknown'].includes(d.status as string)) {
    m.fail('Invalid excavation window report')
  }
  if (d.status !== 'accepted-window' && reason === null) m.fail('Unaccepted excavation requires a reason')
  return Object.freeze({
    kind: 'excavation-window' as const, requestId: r.requestId, commandId: r.command.id,
    operationId: r.command.operationId, interval: r.interval,
    status: d.status as ExcavateReport['status'], reason,
    requestedMassKg: null, appliedMassKg: null, requestedEnergyJ: null, appliedEnergyJ: null,
  })
}
function identity(r: LedgerReceipt): { readonly requestId: string; readonly commandId: string; readonly startS: number; readonly endS: number } {
  if (r.kind === 'ignition') return { ...r.receipt, startS: r.receipt.interval.startS, endS: r.receipt.interval.endS }
  if (r.kind === 'water' || r.kind === 'excavation-window') {
    return { ...r, startS: r.interval.startS, endS: r.interval.endS }
  }
  return { ...r, startS: r.atS, endS: r.atS }
}
function orderReceipts(schedule: InterventionSchedule, receipts: readonly LedgerReceipt[]): readonly LedgerReceipt[] {
  const commands = new Map(schedule.commands.map(c => [c.id, c]))
  const values = [...receipts].sort((a, b) => {
    const ia = identity(a), ib = identity(b), ca = commands.get(ia.commandId)!, cb = commands.get(ib.commandId)!
    if (!ca || !cb) return m.fail('Ledger receipt refers to an unknown command')
    return ia.startS - ib.startS || COMMAND_KIND_ORDER[ca.kind] - COMMAND_KIND_ORDER[cb.kind]
      || ca.sequence - cb.sequence || m.compare(ca.id, cb.id) || ia.endS - ib.endS
  })
  const ids = new Set<string>(), through = new Map<string, number>()
  for (const r of values) {
    const i = identity(r)
    if (!commands.has(i.commandId) || ids.has(i.requestId)) m.fail('Unknown/duplicate ledger receipt identity')
    ids.add(i.requestId)
    if (i.endS > i.startS) {
      if ((through.get(i.commandId) ?? -Infinity) > i.startS) m.fail('Overlapping ledger interval coverage')
      through.set(i.commandId, i.endS)
    }
  }
  return Object.freeze(values)
}

export interface InventoryBalance {
  readonly material: 'dry-ice' | 'water'
  readonly inventoryId: string
  readonly initialMassKg: number
  readonly drawnKg: QuantityTotal
  readonly returnedKg: QuantityTotal
  /** Independently recomputed from total draw and total return, not stored stock. */
  readonly remainingMassKg: number | null
  readonly reportedRemainingMassKg: number | null
  readonly balanceResidualKg: number | null
}
export interface LedgerSummary {
  readonly scope: 'scheduled-source-accounting-only'
  readonly receiptCount: number
  readonly ignition: IgnitionTotals
  readonly dryIce: MaterialMassTotals
  readonly water: MaterialMassTotals
  /** Never collapse different materials/datums into a misleading common energy total. */
  readonly materialEnergy: readonly MaterialEnergyTotals[]
  /** Heater work plus explicit dry-ice/water source work ONLY; excludes unspecified operation work. */
  readonly sourceExternalWorkJ: QuantityTotal
  readonly inventories: readonly InventoryBalance[]
  /** Hose/excavation commands specify actions, not material/energy magnitudes. */
  readonly unquantifiedActionCount: number
  readonly hasUnknownSourceQuantities: boolean
  readonly physicalConservationVerified: false
}
interface Seeds { readonly dryIce: readonly DryIceInventorySeed[]; readonly water: readonly WaterReservoirSeed[] }
function summaryFromReceipts(schedule: InterventionSchedule, seeds: Seeds, input: readonly LedgerReceipt[]): LedgerSummary {
  const receipts = orderReceipts(schedule, input)
  const ignition = receipts.filter((r): r is Extract<LedgerReceipt, { kind: 'ignition' }> => r.kind === 'ignition')
  const dry = receipts.filter((r): r is DryIceReceipt => r.kind === 'dry-ice')
  const water = receipts.filter((r): r is WaterDeliveryReceipt => r.kind === 'water')
  const ignitionTotals = summarizeIgnitionReceipts(ignition.map(r => r.receipt))
  const dryIce = massTotals(dry.map(r => r.accounting)), waterMass = massTotals(water.map(r => r.accounting))
  const materialEnergy: MaterialEnergyTotals[] = [], inventories: InventoryBalance[] = []
  for (const material of ['dry-ice', 'water'] as const) {
    const records: readonly (DryIceReceipt | WaterDeliveryReceipt)[] = material === 'dry-ice' ? dry : water
    const groups = new Map<string | null, MaterialEnergyReport[]>()
    for (const r of records) {
      const key = r.accounting.energy.referenceId, group = groups.get(key) ?? []
      group.push(r.accounting.energy); groups.set(key, group)
    }
    const keys = [...groups.keys()].sort((a, b) => a === null ? (b === null ? 0 : -1) : b === null ? 1 : m.compare(a, b))
    for (const key of keys) materialEnergy.push(energyTotals(material, key, groups.get(key)!))
    const inventorySeeds = material === 'dry-ice'
      ? seeds.dryIce.map(s => ({ inventoryId: s.inventoryId, massKg: s.massKg }))
      : seeds.water.map(s => ({ inventoryId: s.reservoirId, massKg: s.massKg }))
    for (const seed of inventorySeeds) {
      const rs = records.filter(r => (r.kind === 'dry-ice' ? r.inventoryId : r.reservoirId) === seed.inventoryId)
      const drawnKg = quantity(rs.map(r => r.accounting.drawnKg))
      const returnedKg = quantity(rs.map(r => r.accounting.returnedKg))
      const remainingMassKg = drawnKg.total === null || returnedKg.total === null ? null
        : m.finite(m.sum([seed.massKg, -drawnKg.total, returnedKg.total]), 'independent stock')
      const last = rs.at(-1)
      const reportedRemainingMassKg = last === undefined ? seed.massKg
        : last.kind === 'dry-ice' ? last.inventoryAfterKg : last.reservoirAfterKg
      const residual = remainingMassKg === null || reportedRemainingMassKg === null ? null
        : m.finite(reportedRemainingMassKg - remainingMassKg, 'stock residual')
      const scale = Math.max(seed.massKg, drawnKg.knownTotal, returnedKg.knownTotal)
      if (residual !== null && Math.abs(residual) > m.tolerance(scale)) m.fail('Independent stock reconciliation failed')
      if (remainingMassKg !== null && remainingMassKg < -m.tolerance(scale)) m.fail('Negative independent stock')
      inventories.push(Object.freeze({
        material, inventoryId: seed.inventoryId, initialMassKg: seed.massKg, drawnKg, returnedKg,
        remainingMassKg, reportedRemainingMassKg, balanceResidualKg: residual === 0 ? 0 : residual,
      }))
    }
  }
  const sourceExternalWorkJ = quantity([
    ...ignition.map(r => r.receipt.appliedJ), ...dry.map(r => r.accounting.workIntoDomainJ),
    ...water.map(r => r.accounting.workIntoDomainJ),
  ])
  const massUnknown = [dryIce, waterMass].some(t => [
    t.requestedKg, t.drawnKg, t.rejectedKg, t.appliedKg, t.returnedKg, t.externalLossKg, t.unresolvedKg,
  ].some(q => q.unknownCount > 0))
  const hasUnknownSourceQuantities = massUnknown || sourceExternalWorkJ.unknownCount > 0
    || ignitionTotals.appliedJ === null || ignitionTotals.rejectedJ === null || ignitionTotals.unresolvedJ === null
    || materialEnergy.some(e => [e.requestedJ, e.drawnJ, e.rejectedJ, e.appliedJ,
      e.returnedJ, e.externalLossJ, e.unresolvedJ].some(q => q.unknownCount > 0))
  return Object.freeze({
    scope: 'scheduled-source-accounting-only' as const, receiptCount: receipts.length, ignition: ignitionTotals,
    dryIce, water: waterMass, materialEnergy: Object.freeze(materialEnergy), sourceExternalWorkJ,
    inventories: Object.freeze(inventories),
    unquantifiedActionCount: receipts.filter(r => r.kind === 'hose-placement' || r.kind === 'excavation-window').length,
    hasUnknownSourceQuantities, physicalConservationVerified: false as const,
  })
}

declare const ledgerCheckpointBrand: unique symbol
export interface LedgerCheckpoint {
  readonly kind: 'intervention-ledger'
  readonly schemaVersion: 1
  readonly scheduleJSON: string
  readonly throughS: number
  readonly ignition: IgnitionCheckpoint
  readonly dryIce: DryIceCheckpoint
  readonly water: WaterCheckpoint
  readonly operations: readonly OperationReceipt[]
  readonly summary: LedgerSummary
  readonly [ledgerCheckpointBrand]: true
}
const checkpoints = new WeakSet<LedgerCheckpoint>()
function allReceipts(
  ignition: IgnitionCheckpoint, dryIce: DryIceCheckpoint, water: WaterCheckpoint,
  operations: readonly OperationReceipt[],
): readonly LedgerReceipt[] {
  return [
    ...ignition.receipts.map(receipt => Object.freeze({ kind: 'ignition' as const, receipt })),
    ...dryIce.receipts, ...water.placements, ...water.receipts, ...operations,
  ]
}
function checkpoint(
  schedule: InterventionSchedule, ignition: IgnitionCheckpoint, dryIce: DryIceCheckpoint,
  water: WaterCheckpoint, operations: readonly OperationReceipt[],
): LedgerCheckpoint {
  const scheduleJSON = serializeSchedule(schedule), throughS = ignition.throughS
  if ([ignition, dryIce, water].some(s => s.scheduleJSON !== scheduleJSON || s.throughS !== throughS)) {
    m.fail('Subsystem checkpoints do not share an accepted time and schedule')
  }
  const receipts = allReceipts(ignition, dryIce, water, operations)
  const summary = summaryFromReceipts(schedule, { dryIce: dryIce.seeds, water: water.seeds }, receipts)
  const result = Object.freeze({
    kind: 'intervention-ledger' as const, schemaVersion: 1 as const, scheduleJSON, throughS,
    ignition, dryIce, water, operations: Object.freeze([...operations]), summary,
  }) as LedgerCheckpoint
  checkpoints.add(result); return result
}
export function createLedgerCheckpoint(
  schedule: InterventionSchedule,
  seeds: { readonly dryIceInventories: readonly DryIceInventorySeed[]; readonly waterReservoirs: readonly WaterReservoirSeed[] },
): LedgerCheckpoint {
  m.dataObject(seeds, ['dryIceInventories', 'waterReservoirs'], 'ledger seeds')
  return checkpoint(schedule, createIgnitionCheckpoint(schedule),
    createDryIceCheckpoint(schedule, seeds.dryIceInventories), createWaterCheckpoint(schedule, seeds.waterReservoirs), [])
}
function requireCheckpoint(schedule: InterventionSchedule, state: LedgerCheckpoint): void {
  if (!checkpoints.has(state) || state.scheduleJSON !== serializeSchedule(schedule)) {
    m.fail('Use a validated ledger checkpoint for identical schedule content')
  }
}
export function ledgerReceipts(schedule: InterventionSchedule, state: LedgerCheckpoint): readonly LedgerReceipt[] {
  requireCheckpoint(schedule, state)
  return orderReceipts(schedule, allReceipts(state.ignition, state.dryIce, state.water, state.operations))
}
/** Independent of saved summary/stock fields: aggregate the accepted receipts again. */
export function recomputeLedgerSummary(schedule: InterventionSchedule, state: LedgerCheckpoint): LedgerSummary {
  requireCheckpoint(schedule, state)
  return summaryFromReceipts(schedule, { dryIce: state.dryIce.seeds, water: state.water.seeds }, ledgerReceipts(schedule, state))
}
export interface LedgerReportCallbacks {
  readonly ignition: IgnitionReportCallback
  readonly dryIce: DryIcePlacementCallback
  readonly placeHose: HosePlacementCallback
  readonly water: WaterDeliveryCallback
  readonly excavation: ExcavationReportCallback
}
export interface LedgerTrial {
  readonly before: LedgerCheckpoint
  readonly interval: TimeInterval
  readonly receiptDeltas: readonly LedgerReceipt[]
  /** These planned requests lack receipts in an incomplete/blocked trial. Not a claim they ran. */
  readonly unaccountedRequestIds: readonly string[]
  readonly receiptCoverage: 'complete' | 'partial'
  readonly provisionalSummary: LedgerSummary
  readonly blockedReason: string | null
  readonly candidate: LedgerCheckpoint | null
}
const trials = new WeakSet<LedgerTrial>()
/**
 * One canonical solver slice only. Split a larger interval with planWaterStep first.
 * All callbacks report detached source/geometry proposals; none may advance accepted physics.
 * This function advances ACCOUNTING candidates only. Physical acceptance belongs to the integrator.
 */
export function stageLedgerStep(
  schedule: InterventionSchedule, before: LedgerCheckpoint, step: TimeInterval, callbacks: LedgerReportCallbacks,
): LedgerTrial {
  requireCheckpoint(schedule, before)
  const plan = planWaterStep(schedule, step)
  if (plan.interval.startS !== before.throughS) m.fail('Ledger step must begin at throughS')
  if (plan.slices.length > 1) m.fail('Split at every combined schedule/energy/mass boundary before staging the ledger')
  const cb = m.dataObject(callbacks, ['ignition', 'dryIce', 'placeHose', 'water', 'excavation'], 'ledger callbacks')
  if (Object.values(cb).some(v => typeof v !== 'function')) m.fail('Every ledger report callback must be explicit')
  const handlers = Object.freeze({ ...cb }) as unknown as LedgerReportCallbacks
  const requests = plan.slices.flatMap(s => s.requests), deltas: LedgerReceipt[] = []
  const operations: OperationReceipt[] = []
  const finish = (candidate: LedgerCheckpoint | null, blockedReason: string | null): LedgerTrial => {
    const ordered = orderReceipts(schedule, deltas), seen = new Set(ordered.map(r => identity(r).requestId))
    const unaccountedRequestIds = Object.freeze(requests.filter(r => !seen.has(r.requestId)).map(r => r.requestId))
    const provisionalSummary = summaryFromReceipts(schedule,
      { dryIce: before.dryIce.seeds, water: before.water.seeds }, [...ledgerReceipts(schedule, before), ...ordered])
    const result: LedgerTrial = Object.freeze({
      before, interval: plan.interval, receiptDeltas: ordered, unaccountedRequestIds,
      receiptCoverage: unaccountedRequestIds.length ? 'partial' : 'complete',
      provisionalSummary, blockedReason, candidate,
    })
    trials.add(result); return result
  }
  for (const r of requests) {
    if (r.dispatch === 'at-start' && r.command.kind === 'cancel') {
      const receipt = cancellation(r as StartRequest & { readonly command: CancelCommand })
      operations.push(receipt); deltas.push(receipt)
    } else if (r.dispatch === 'over-interval' && r.command.kind === 'excavation') {
      const request = r as Omit<WindowRequest, 'command'> & { readonly command: ExcavationCommand }
      const receipt = excavation(request, handlers.excavation(request))
      operations.push(receipt); deltas.push(receipt)
      if (receipt.status === 'unknown') return finish(null, 'Excavation window acceptance is unknown')
    }
  }
  const hoseReports = new Map<string, HosePlacementReport>()
  for (const r of requests) if (r.dispatch === 'at-start' && r.command.kind === 'hose-placement') {
    const request = r as StartRequest & { readonly command: HosePlacementCommand }
    const receipt = waterAccountingInternals.placedReceipt(request, handlers.placeHose(request))
    deltas.push(receipt)
    hoseReports.set(r.requestId, { requestId: receipt.requestId, status: receipt.status, reason: receipt.reason })
    if (receipt.status === 'unknown') return finish(null, 'Hose placement is unknown')
  }
  const dry = stageDryIceStep(schedule, before.dryIce, plan.interval, handlers.dryIce)
  deltas.push(...dry.receipts)
  if (dry.candidate === null) return finish(null, 'Dry-ice mass disposition is unresolved')
  const ignition = stageIgnitionStep(schedule, before.ignition, plan.interval, handlers.ignition)
  deltas.push(...ignition.receipts.map(receipt => Object.freeze({ kind: 'ignition' as const, receipt })))
  if (ignition.candidate === null) return finish(null, 'Ignition energy disposition is unresolved')
  const water = stageWaterStep(schedule, before.water, plan.interval, {
    placeHose: r => hoseReports.get(r.requestId) ?? m.fail('Missing staged hose report'),
    deliverWater: handlers.water,
  })
  deltas.push(...water.receipts) // Placement deltas were already collected in global order.
  if (water.candidate === null) return finish(null, 'Water mass disposition is unresolved')
  const candidate = checkpoint(schedule, ignition.candidate, dry.candidate, water.candidate,
    [...before.operations, ...operations])
  return finish(candidate, null)
}
/**
 * Pure compare-and-swap of an ACCOUNTING pointer. Does not commit physical state, files or I/O.
 * Supply the actual current checkpoint, not a stale saved pointer. The integrator must perform
 * its physical and accounting pointer swap as ONE outer accepted transaction.
 */
export function commitLedgerTrial(current: LedgerCheckpoint, trial: LedgerTrial): LedgerCheckpoint {
  if (!checkpoints.has(current) || !trials.has(trial) || trial.before !== current) {
    return m.fail('Unknown or stale accounting transaction')
  }
  if (trial.candidate === null) return m.fail('Cannot commit an unresolved accounting transaction')
  return trial.candidate
}
export function serializeLedgerCheckpoint(state: LedgerCheckpoint): string {
  if (!checkpoints.has(state)) m.fail('Unvalidated ledger checkpoint')
  return JSON.stringify(state)
}

/** Reconstruct nested source histories, operation coverage and all totals; no physical callbacks run. */
export function parseLedgerCheckpoint(schedule: InterventionSchedule, text: string): LedgerCheckpoint {
  if (typeof text !== 'string') m.fail('Ledger checkpoint must be JSON text')
  const raw = JSON.parse(text) as unknown
  const d = m.dataObject(raw, [
    'kind', 'schemaVersion', 'scheduleJSON', 'throughS', 'ignition', 'dryIce', 'water', 'operations', 'summary',
  ], 'ledger checkpoint')
  if (d.kind !== 'intervention-ledger' || d.schemaVersion !== 1
      || d.scheduleJSON !== serializeSchedule(schedule)) m.fail('Ledger schema/schedule content mismatch')
  const throughS = m.nonnegative(d.throughS, 'throughS')
  const ignition = parseIgnitionCheckpoint(schedule, JSON.stringify(d.ignition))
  const dryIce = parseDryIceCheckpoint(schedule, JSON.stringify(d.dryIce))
  const water = parseWaterCheckpoint(schedule, JSON.stringify(d.water))
  if ([ignition, dryIce, water].some(s => s.throughS !== throughS)) m.fail('Mixed subsystem checkpoint times')
  const rawOperations = new Map<string, Record<string, unknown>>()
  for (const entry of m.dataArray(d.operations)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return m.fail('Invalid operation receipt')
    const obj = entry as Record<string, unknown>
    const keys = obj.kind === 'cancellation'
      ? ['kind', 'requestId', 'commandId', 'targetCommandId', 'atS', 'status']
      : ['kind', 'requestId', 'commandId', 'operationId', 'interval', 'status', 'reason',
        'requestedMassKg', 'appliedMassKg', 'requestedEnergyJ', 'appliedEnergyJ']
    const op = m.dataObject(entry, keys, 'operation receipt')
    if (typeof op.requestId !== 'string' || rawOperations.has(op.requestId)) return m.fail('Duplicate/invalid operation receipt')
    rawOperations.set(op.requestId, op)
  }
  const operations: OperationReceipt[] = [], expectedIgnition = new Set<string>()
  let at = 0
  for (const endS of water.partitionEndsS) {
    const plan = planWaterStep(schedule, { startS: at, endS })
    if (plan.slices.length !== 1) m.fail('Checkpoint omitted a required joint solver boundary')
    for (const r of plan.slices[0].requests) {
      if (r.command.kind === 'ignition') expectedIgnition.add(r.requestId)
      if (r.command.kind !== 'cancel' && r.command.kind !== 'excavation') continue
      const stored = rawOperations.get(r.requestId)
      if (!stored) return m.fail('Missing operation receipt')
      rawOperations.delete(r.requestId)
      if (r.dispatch === 'at-start' && r.command.kind === 'cancel') {
        operations.push(cancellation(r as StartRequest & { readonly command: CancelCommand }))
      } else if (r.dispatch === 'over-interval' && r.command.kind === 'excavation') {
        const op = excavation(r as Omit<WindowRequest, 'command'> & { readonly command: ExcavationCommand }, {
          requestId: r.requestId, status: stored.status as ExcavateReport['status'], reason: stored.reason as string | null,
        })
        if (op.status === 'unknown') m.fail('Unresolved excavation cannot be an accepted checkpoint')
        operations.push(op)
      }
    }
    at = endS
  }
  if (at !== throughS || rawOperations.size) m.fail('Incomplete or extra operation history')
  for (const r of ignition.receipts) if (!expectedIgnition.delete(r.requestId)) m.fail('Ignition history uses different joint slices')
  if (expectedIgnition.size) m.fail('Missing joint-slice ignition history')
  const result = checkpoint(schedule, ignition, dryIce, water, operations)
  if (m.canonicalJSON(result) !== m.canonicalJSON(raw)) m.fail('Ledger receipt/summary independent recomputation mismatch')
  return result
}
