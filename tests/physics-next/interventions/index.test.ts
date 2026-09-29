import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, ok, throws } from 'node:assert/strict'
import * as api from '../../../src/physics-next/interventions/index'
import type {
  IgnitionEnergyRequest, DryIceOffer, WaterOffer, LedgerCheckpoint, LedgerTrial,
} from '../../../src/physics-next/interventions/index'

function readonlyContracts(
  state: LedgerCheckpoint, trial: LedgerTrial, heat: IgnitionEnergyRequest, ice: DryIceOffer, water: WaterOffer,
): void {
  // @ts-expect-error The accepted accounting cursor is immutable.
  state.throughS = 1
  // @ts-expect-error Nested material totals are immutable.
  state.summary.water.appliedKg.total = 1
  // @ts-expect-error Inventory snapshots cannot be edited by a consumer.
  state.dryIce.inventories[0].remainingMassKg = 1
  // @ts-expect-error Unknown quantities cannot be filled by mutating a receipt.
  state.water.receipts[0].accounting.energy.appliedJ = 0
  // @ts-expect-error A trial candidate is not a mutable commit slot.
  trial.candidate = state
  // @ts-expect-error An integrator report must not change a scheduled ignition request.
  heat.requestedJ = 0
  // @ts-expect-error Dry-ice offers expose readonly finite stock.
  ice.offeredKg = 999
  // @ts-expect-error Pressure metadata must not be rewritten by a consumer.
  water.command.supplyPressurePa = 999
}
void readonlyContracts // Compile-time checks only; never execute the intentional errors.

const location: api.PointLocation = { kind: 'point', frameId: 'domain', xM: 0, yM: 0, depthM: 0.5 }
const s = () => api.createSchedule({
  schemaVersion: 1, id: 'smoke', commands: [
    { kind: 'hose-placement', id: 'place', sequence: 0, interval: { startS: 0, endS: 1 }, hoseId: 'hose', location },
    { kind: 'water-delivery', id: 'water', sequence: 0, interval: { startS: 0, endS: 10 },
      hoseId: 'hose', placementCommandId: 'place', reservoirId: 'tank', massFlowKgS: 1, massLimitKg: 3,
      inletTemperatureK: 293.15, supplyPressurePa: null },
    { kind: 'ignition', id: 'heat', sequence: 0, interval: { startS: 0, endS: 10 }, sourceId: 'heat-source',
      location, input: { kind: 'power', powerW: 8, energyLimitJ: 20 } },
  ],
})
/** Explicit fixture, not an integrator implementation or a physical-delivery default. */
const reports: api.LedgerReportCallbacks = {
  ignition: r => ({ requestId: r.requestId, appliedJ: r.requestedJ, rejectedJ: 0, unresolvedJ: 0, reason: null }),
  placeHose: r => ({ requestId: r.requestId, status: 'placed', reason: null }),
  dryIce: () => { throw new Error('No dry-ice command in this smoke fixture') },
  excavation: () => { throw new Error('No excavation command in this smoke fixture') },
  water: o => ({
    requestId: o.requestId, drawnKg: o.offeredKg, rejectedKg: o.requestedKg - o.offeredKg,
    appliedKg: o.offeredKg, returnedKg: 0, externalLossKg: 0, unresolvedKg: 0,
    energy: { referenceId: null, requestedJ: null, drawnJ: null, rejectedJ: null,
      appliedJ: null, returnedJ: null, externalLossJ: null, unresolvedJ: null },
    workIntoDomainJ: 0, reason: 'fixture does not quantify thermal energy',
  }),
}
describe('public intervention API', () => {
  it('exports the complete stable runtime API without internal mutation/validation helpers', () => {
    const names = [
      'INTERVENTION_SCHEMA_VERSION', 'COMMAND_KIND_ORDER', 'ScheduleValidationError',
      'createCommand', 'compareCommands', 'createSchedule', 'serializeSchedule', 'parseSchedule', 'clipScheduleToStep',
      'IgnitionAccountingError', 'getIgnitionProfile', 'requestedIgnitionJAt', 'isIgnitionEnergyRequest',
      'planIgnitionStep', 'reconcileIgnitionRequest', 'summarizeIgnitionReceipts', 'createIgnitionCheckpoint',
      'stageIgnitionStep', 'serializeIgnitionCheckpoint', 'parseIgnitionCheckpoint',
      'MaterialAccountingError', 'createDryIceCheckpoint', 'stageDryIceStep',
      'serializeDryIceCheckpoint', 'parseDryIceCheckpoint',
      'getWaterProfile', 'requestedWaterKgAt', 'isWaterMassRequest', 'planWaterStep', 'planInterventionStep',
      'createWaterCheckpoint', 'stageWaterStep', 'serializeWaterCheckpoint', 'parseWaterCheckpoint',
      'createLedgerCheckpoint', 'stageLedgerStep', 'commitLedgerTrial', 'serializeLedgerCheckpoint',
      'parseLedgerCheckpoint', 'recomputeLedgerSummary', 'ledgerReceipts',
    ]
    deepStrictEqual(Object.keys(api).sort(), names.sort())
    strictEqual(api.planInterventionStep, api.planWaterStep)
    strictEqual(api.INTERVENTION_SCHEMA_VERSION, 1)
  })
  it('executes and restarts a complete UI-independent accounting flow using only barrel exports', () => {
    const schedule = s()
    let state = api.createLedgerCheckpoint(schedule, {
      dryIceInventories: [], waterReservoirs: [{ reservoirId: 'tank', massKg: 2 }],
    })
    const plan = api.planInterventionStep(schedule, { startS: 0, endS: 10 })
    deepStrictEqual(plan.slices.map(x => [x.interval.startS, x.interval.endS]), [[0, 2.5], [2.5, 3], [3, 10]])
    for (const slice of plan.slices) {
      const trial = api.stageLedgerStep(schedule, state, slice.interval, reports)
      ok(trial.candidate)
      state = api.commitLedgerTrial(state, trial)
      state = api.parseLedgerCheckpoint(schedule, api.serializeLedgerCheckpoint(state))
    }
    strictEqual(state.throughS, 10)
    strictEqual(state.summary.ignition.appliedJ, 20)
    strictEqual(state.summary.water.requestedKg.total, 3)
    strictEqual(state.summary.water.appliedKg.total, 2)
    strictEqual(state.summary.water.rejectedKg.total, 1)
    strictEqual(state.summary.materialEnergy[0].appliedJ.total, null)
    strictEqual(state.summary.physicalConservationVerified, false)
    deepStrictEqual(api.recomputeLedgerSummary(schedule, state), state.summary)
  })
  it('does not accept raw JSON or structured clones as already validated runtime state', () => {
    const schedule = s(), state = api.createLedgerCheckpoint(schedule, {
      dryIceInventories: [], waterReservoirs: [{ reservoirId: 'tank', massKg: 2 }],
    })
    const raw = JSON.parse(api.serializeLedgerCheckpoint(state)) as LedgerCheckpoint
    throws(() => api.stageLedgerStep(schedule, raw, { startS: 0, endS: 1 }, reports))
    const restored = api.parseLedgerCheckpoint(schedule, JSON.stringify(raw))
    ok(api.stageLedgerStep(schedule, restored, { startS: 0, endS: 1 }, reports).candidate)
  })
})
