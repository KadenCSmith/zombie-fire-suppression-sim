import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, ok, throws } from 'node:assert/strict'
import type {
  DryIcePlacementCommand, ExcavationCommand, HosePlacementCommand, IgnitionCommand,
  InterventionCommand, InterventionSchedule, WaterDeliveryCommand,
} from '../../../src/physics-next/interventions/types'
import { createSchedule, parseSchedule, serializeSchedule } from '../../../src/physics-next/interventions/schedule'
import {
  createIgnitionCheckpoint, serializeIgnitionCheckpoint, stageIgnitionStep,
} from '../../../src/physics-next/interventions/ignition'
import type { MaterialApplicationReport, MaterialEnergyReport } from '../../../src/physics-next/interventions/dryIcePlacement'
import { planWaterStep } from '../../../src/physics-next/interventions/waterDelivery'
import {
  commitLedgerTrial, createLedgerCheckpoint, ledgerReceipts, parseLedgerCheckpoint,
  recomputeLedgerSummary, serializeLedgerCheckpoint, stageLedgerStep,
  type LedgerCheckpoint, type LedgerReportCallbacks,
} from '../../../src/physics-next/interventions/ledger'

const location = { kind: 'point' as const, frameId: 'domain', xM: 1, yM: 1, depthM: 0.5 }
const heat = (changes: Partial<IgnitionCommand> = {}): IgnitionCommand => ({
  kind: 'ignition', id: 'heat', sequence: 0, interval: { startS: 0, endS: 2 },
  sourceId: 'heater', location, input: { kind: 'power', powerW: 8, energyLimitJ: 16 }, ...changes,
})
const ice = (changes: Partial<DryIcePlacementCommand> = {}): DryIcePlacementCommand => ({
  kind: 'dry-ice-placement', id: 'ice', sequence: 0, interval: { startS: 0, endS: 1 },
  inventoryId: 'ice-stock', sourceId: 'solid-source', location, massKg: 4,
  thermal: { kind: 'internal-energy', internalEnergyJ: -400, referenceId: 'co2-fixture' }, ...changes,
})
const hose = (): HosePlacementCommand => ({
  kind: 'hose-placement', id: 'place', sequence: 0, interval: { startS: 0, endS: 1 }, hoseId: 'hose', location,
})
const water = (changes: Partial<WaterDeliveryCommand> = {}): WaterDeliveryCommand => ({
  kind: 'water-delivery', id: 'water', sequence: 0, interval: { startS: 0, endS: 2 },
  hoseId: 'hose', placementCommandId: 'place', reservoirId: 'tank', massFlowKgS: 1, massLimitKg: 2,
  inletTemperatureK: 293.15, supplyPressurePa: null, ...changes,
})
const dig = (): ExcavationCommand => ({
  kind: 'excavation', id: 'dig', sequence: 0, interval: { startS: 0, endS: 1 }, operationId: 'bore',
  location: { kind: 'geometry-reference', geometryId: 'domain', revisionId: 'r1', featureId: 'bore' },
})
const schedule = (commands: readonly InterventionCommand[] = [heat(), ice(), hose(), water(), dig()]) =>
  createSchedule({ schemaVersion: 1, id: 'run', commands })
const initial = (s: InterventionSchedule) => createLedgerCheckpoint(s, {
  dryIceInventories: [{ inventoryId: 'ice-stock', massKg: 10 }],
  waterReservoirs: [{ reservoirId: 'tank', massKg: 10 }],
})
/** Artificial test energies only. No thermodynamic or hydraulic model is being asserted. */
function materialReport(
  requestId: string, requestedKg: number, offeredKg: number, specificEnergy: number,
  referenceId: string, workIntoDomainJ: number,
): MaterialApplicationReport {
  return {
    requestId, drawnKg: offeredKg, rejectedKg: requestedKg - offeredKg, appliedKg: offeredKg,
    returnedKg: 0, externalLossKg: 0, unresolvedKg: 0, workIntoDomainJ,
    energy: {
      referenceId, requestedJ: requestedKg * specificEnergy, drawnJ: offeredKg * specificEnergy,
      rejectedJ: (requestedKg - offeredKg) * specificEnergy, appliedJ: offeredKg * specificEnergy,
      returnedJ: 0, externalLossJ: 0, unresolvedJ: 0,
    },
    reason: offeredKg === requestedKg ? null : 'finite test stock',
  }
}
const unknownEnergy = (): MaterialEnergyReport => ({
  referenceId: null, requestedJ: null, drawnJ: null, rejectedJ: null, appliedJ: null,
  returnedJ: null, externalLossJ: null, unresolvedJ: null,
})
const callbacks: LedgerReportCallbacks = {
  ignition: r => ({ requestId: r.requestId, appliedJ: r.requestedJ, rejectedJ: 0, unresolvedJ: 0, reason: null }),
  dryIce: o => materialReport(o.requestId, o.requestedKg, o.offeredKg,
    o.declaredEnergy!.internalEnergyJ / o.requestedKg, o.declaredEnergy!.referenceId, 12),
  placeHose: r => ({ requestId: r.requestId, status: 'placed', reason: null }),
  water: o => materialReport(o.requestId, o.requestedKg, o.offeredKg, 100, 'water-fixture', 0),
  excavation: r => ({ requestId: r.requestId, status: 'accepted-window', reason: null }),
}
function advance(
  s: InterventionSchedule, before: LedgerCheckpoint, endS: number, reports: LedgerReportCallbacks = callbacks,
): LedgerCheckpoint {
  let state = before
  for (const slice of planWaterStep(s, { startS: before.throughS, endS }).slices) {
    const trial = stageLedgerStep(s, state, slice.interval, reports)
    ok(trial.candidate); state = commitLedgerTrial(state, trial)
  }
  return state
}

describe('receipt-derived intervention accounting', () => {
  it('reconciles source quantities without claiming physical conservation or suppression', () => {
    const s = schedule(), state = advance(s, initial(s), 2), t = state.summary
    strictEqual(t.ignition.requestedJ, 16); strictEqual(t.ignition.appliedJ, 16)
    strictEqual(t.dryIce.appliedKg.total, 4); strictEqual(t.water.appliedKg.total, 2)
    strictEqual(t.sourceExternalWorkJ.total, 28)
    strictEqual(t.inventories.find(x => x.material === 'dry-ice')!.remainingMassKg, 6)
    strictEqual(t.inventories.find(x => x.material === 'water')!.remainingMassKg, 8)
    strictEqual(t.dryIce.admissionResidualKg, 0); strictEqual(t.water.transferResidualKg, 0)
    strictEqual(t.physicalConservationVerified, false); strictEqual(t.hasUnknownSourceQuantities, false)
    strictEqual(t.unquantifiedActionCount, 2)
    const excavation = state.operations.find(r => r.kind === 'excavation-window')!
    ok(excavation.kind === 'excavation-window')
    strictEqual(excavation.requestedEnergyJ, null); strictEqual(excavation.appliedMassKg, null)
  })
  it('independently rebuilds all summary quantities from receipts, not saved summary values', () => {
    const s = schedule(), state = advance(s, initial(s), 2)
    deepStrictEqual(recomputeLedgerSummary(s, state), state.summary)
    const dry = ledgerReceipts(s, state).filter(r => r.kind === 'dry-ice')
    const water = ledgerReceipts(s, state).filter(r => r.kind === 'water')
    strictEqual(dry.reduce((n, r) => n + r.accounting.appliedKg!, 0), state.summary.dryIce.appliedKg.total)
    strictEqual(water.reduce((n, r) => n + r.accounting.appliedKg!, 0), state.summary.water.appliedKg.total)
    for (const stock of state.summary.inventories) strictEqual(stock.balanceResidualKg, 0)
  })
  it('keeps negative internal energy, water internal energy and external work distinct', () => {
    const s = schedule(), state = advance(s, initial(s), 2)
    const co2 = state.summary.materialEnergy.find(e => e.material === 'dry-ice')!
    const water = state.summary.materialEnergy.find(e => e.material === 'water')!
    strictEqual(co2.appliedJ.total, -400); strictEqual(co2.referenceId, 'co2-fixture')
    strictEqual(water.appliedJ.total, 200); strictEqual(water.referenceId, 'water-fixture')
    strictEqual(state.summary.sourceExternalWorkJ.total, 28)
    strictEqual('totalMaterialEnergyJ' in state.summary, false)
  })
  it('never merges different internal-energy reference datums', () => {
    const s = schedule([
      ice({ id: 'first', massKg: 1, thermal: { kind: 'internal-energy', internalEnergyJ: -100, referenceId: 'datum-a' } }),
      ice({ id: 'second', massKg: 1, sourceId: 'second-source',
        thermal: { kind: 'internal-energy', internalEnergyJ: 200, referenceId: 'datum-b' } }),
    ])
    const state = advance(s, initial(s), 1)
    deepStrictEqual(state.summary.materialEnergy.map(e => [e.referenceId, e.appliedJ.total]),
      [['datum-a', -100], ['datum-b', 200]])
  })
  it('keeps returns, never-drawn rejection and external loss in separate balances', () => {
    const s = schedule([ice()])
    const state = advance(s, initial(s), 1, {
      ...callbacks,
      dryIce: o => ({
        requestId: o.requestId, drawnKg: 3, rejectedKg: 1, appliedKg: 1, returnedKg: 1, externalLossKg: 1,
        unresolvedKg: 0, workIntoDomainJ: 12, reason: 'partial test transfer',
        energy: {
          referenceId: 'co2-fixture', requestedJ: -400, drawnJ: -300, rejectedJ: -100, appliedJ: -100,
          returnedJ: -100, externalLossJ: -100, unresolvedJ: 0,
        },
      }),
    })
    const t = state.summary.dryIce
    strictEqual(t.requestedKg.total, 4); strictEqual(t.drawnKg.total, 3)
    strictEqual(t.rejectedKg.total, 1); strictEqual(t.appliedKg.total, 1)
    strictEqual(t.returnedKg.total, 1); strictEqual(t.externalLossKg.total, 1)
    strictEqual(t.admissionResidualKg, 0); strictEqual(t.transferResidualKg, 0)
    strictEqual(state.summary.inventories[0].remainingMassKg, 8)
  })
  it('preserves unknown energy and work in replayable mass accounting without calling it a closed energy budget', () => {
    const s = schedule(), state = advance(s, initial(s), 2, {
      ...callbacks, water: o => ({
        ...callbacks.water(o), energy: unknownEnergy(), workIntoDomainJ: null, reason: 'thermal/work measurements missing',
      }),
    })
    strictEqual(state.summary.hasUnknownSourceQuantities, true)
    strictEqual(state.summary.materialEnergy.find(e => e.material === 'water')!.appliedJ.total, null)
    strictEqual(state.summary.sourceExternalWorkJ.total, null)
    strictEqual(state.summary.sourceExternalWorkJ.knownTotal, 28)
    strictEqual(state.summary.sourceExternalWorkJ.unknownCount, 2)
    strictEqual(state.summary.physicalConservationVerified, false)
    const restored = parseLedgerCheckpoint(s, serializeLedgerCheckpoint(state))
    deepStrictEqual(restored.summary, state.summary)
  })
  it('treats an explicit known zero differently from an unknown scalar', () => {
    const s = schedule([hose(), water()])
    const state = advance(s, initial(s), 2, {
      ...callbacks, water: o => materialReport(o.requestId, o.requestedKg, o.offeredKg, 0, 'explicit-zero-datum', 0),
    })
    const energy = state.summary.materialEnergy[0]
    strictEqual(energy.appliedJ.total, 0); strictEqual(energy.appliedJ.unknownCount, 0)
    strictEqual(state.summary.hasUnknownSourceQuantities, false)
  })
  it('records cancellation intent without undoing a prior parcel or inventing delivery', () => {
    const cancel: InterventionCommand = { kind: 'cancel', id: 'stop', sequence: 0,
      interval: { startS: 0.5, endS: 1 }, targetCommandId: 'ice' }
    const s = schedule([ice(), cancel]), state = advance(s, initial(s), 1)
    strictEqual(state.summary.dryIce.appliedKg.total, 4)
    const c = state.operations[0]
    ok(c.kind === 'cancellation'); strictEqual(c.status, 'scheduled-cutoff-recorded')
    strictEqual(state.summary.inventories[0].remainingMassKg, 6)
  })
})

describe('joint ordering and atomic accounting rollback', () => {
  it('calls report providers in canonical excavation, placement, material, ignition, water order', () => {
    const s = schedule(), calls: string[] = []
    const trial = stageLedgerStep(s, initial(s), { startS: 0, endS: 1 }, {
      excavation: r => { calls.push('dig'); return callbacks.excavation(r) },
      placeHose: r => { calls.push('hose'); return callbacks.placeHose(r) },
      dryIce: o => { calls.push('ice'); return callbacks.dryIce(o) },
      ignition: r => { calls.push('heat'); return callbacks.ignition(r) },
      water: o => { calls.push('water'); return callbacks.water(o) },
    })
    deepStrictEqual(calls, ['dig', 'hose', 'ice', 'heat', 'water'])
    strictEqual(trial.receiptCoverage, 'complete'); deepStrictEqual(trial.unaccountedRequestIds, [])
    ok(trial.candidate)
    deepStrictEqual(trial.receiptDeltas.map(r => r.kind),
      ['excavation-window', 'hose-placement', 'dry-ice', 'ignition', 'water'])
  })
  it('requires splitting at every combined interior boundary before ledger staging', () => {
    const s = schedule()
    throws(() => stageLedgerStep(s, initial(s), { startS: 0, endS: 2 }, callbacks))
    const state = advance(s, initial(s), 2)
    strictEqual(state.throughS, 2)
  })
  it('rolls back ALL subsystem candidates when a late water report is unresolved', () => {
    const s = schedule(), before = initial(s), saved = serializeLedgerCheckpoint(before)
    const trial = stageLedgerStep(s, before, { startS: 0, endS: 1 }, {
      ...callbacks, water: o => ({
        ...callbacks.water(o), appliedKg: null, externalLossKg: null,
        energy: unknownEnergy(), reason: 'late unresolved transfer',
      }),
    })
    strictEqual(trial.candidate, null); ok(trial.blockedReason)
    strictEqual(trial.provisionalSummary.water.appliedKg.total, null)
    strictEqual(trial.provisionalSummary.water.appliedKg.unknownCount, 1)
    throws(() => commitLedgerTrial(before, trial))
    strictEqual(serializeLedgerCheckpoint(before), saved)
    strictEqual(before.dryIce.inventories[0].remainingMassKg, 10)
    strictEqual(before.ignition.receipts.length, 0)
    strictEqual(before.water.placements.length, 0)
    const retry = stageLedgerStep(s, before, { startS: 0, endS: 1 }, callbacks)
    ok(retry.candidate); strictEqual(retry.candidate.summary.dryIce.appliedKg.total, 4)
  })
  it('marks incomplete coverage rather than claiming unattempted sources delivered zero', () => {
    const s = schedule(), before = initial(s)
    const trial = stageLedgerStep(s, before, { startS: 0, endS: 1 }, {
      ...callbacks, excavation: r => ({ requestId: r.requestId, status: 'unknown', reason: 'geometry pending' }),
    })
    strictEqual(trial.candidate, null); strictEqual(trial.receiptCoverage, 'partial')
    strictEqual(trial.unaccountedRequestIds.length, 4)
    strictEqual(trial.receiptDeltas.length, 1)
    strictEqual(trial.provisionalSummary.unquantifiedActionCount, 1)
  })
  it('blocks on unknown hose placement before evaluating downstream source reports', () => {
    const s = schedule(), before = initial(s)
    const trial = stageLedgerStep(s, before, { startS: 0, endS: 1 }, {
      ...callbacks,
      placeHose: r => ({ requestId: r.requestId, status: 'unknown', reason: 'incomplete placement' }),
      dryIce: () => { throw new Error('must not be reached') },
    })
    strictEqual(trial.candidate, null); strictEqual(trial.receiptCoverage, 'partial')
    strictEqual(trial.receiptDeltas.length, 2)
  })
  it('blocks positive unresolved ignition energy after preserving partial receipts', () => {
    const s = schedule(), before = initial(s)
    const trial = stageLedgerStep(s, before, { startS: 0, endS: 1 }, {
      ...callbacks,
      ignition: r => ({ requestId: r.requestId, appliedJ: 0, rejectedJ: 0, unresolvedJ: r.requestedJ, reason: 'unclassified' }),
    })
    strictEqual(trial.candidate, null)
    strictEqual(trial.provisionalSummary.ignition.unresolvedJ, 8)
    strictEqual(trial.unaccountedRequestIds.length, 1)
  })
  it('keeps the old snapshot unchanged when a callback throws after earlier successful reports', () => {
    const s = schedule(), before = initial(s), saved = serializeLedgerCheckpoint(before)
    let dryReports = 0
    throws(() => stageLedgerStep(s, before, { startS: 0, endS: 1 }, {
      ...callbacks,
      dryIce: o => { dryReports++; return callbacks.dryIce(o) },
      water: () => { throw new Error('physical gate failure') },
    }))
    strictEqual(dryReports, 1)
    strictEqual(serializeLedgerCheckpoint(before), saved)
  })
  it('discards a too-long candidate and restages a shorter physical interval without duplicate placement', () => {
    const s = schedule(), before = initial(s)
    const longer = stageLedgerStep(s, before, { startS: 0, endS: 1 }, callbacks)
    ok(longer.candidate)
    const shorter = stageLedgerStep(s, before, { startS: 0, endS: 0.5 }, callbacks)
    ok(shorter.candidate)
    const accepted = commitLedgerTrial(before, shorter)
    strictEqual(accepted.summary.ignition.appliedJ, 4)
    strictEqual(accepted.summary.water.appliedKg.total, 0.5)
    strictEqual(accepted.summary.dryIce.appliedKg.total, 4)
    const end = advance(s, accepted, 2)
    strictEqual(end.summary.dryIce.appliedKg.total, 4)
  })
  it('rejects stale, duplicate, forged or cross-checkpoint commits', () => {
    const s = schedule(), before = initial(s)
    const trial = stageLedgerStep(s, before, { startS: 0, endS: 1 }, callbacks)
    const current = commitLedgerTrial(before, trial)
    throws(() => commitLedgerTrial(current, trial))
    throws(() => commitLedgerTrial(before, { ...trial }))
    throws(() => commitLedgerTrial({ ...before }, trial))
    const restoredBefore = parseLedgerCheckpoint(s, serializeLedgerCheckpoint(before))
    throws(() => commitLedgerTrial(restoredBefore, trial))
  })
  it('requires explicit report callbacks and rejects getters or guessed defaults', () => {
    const s = schedule(), before = initial(s)
    throws(() => stageLedgerStep(s, before, { startS: 0, endS: 1 },
      { ...callbacks, water: undefined } as unknown as LedgerReportCallbacks))
    let reads = 0
    const obj = { ...callbacks }
    Object.defineProperty(obj, 'water', { enumerable: true, get() { reads++; return callbacks.water } })
    throws(() => stageLedgerStep(s, before, { startS: 0, endS: 1 }, obj)); strictEqual(reads, 0)
  })
})

describe('stable ledger checkpoint and independent replay', () => {
  it('restarts every subsystem together and yields byte-identical continuation', () => {
    const s = schedule(), first = advance(s, initial(s), 1)
    const s2 = parseSchedule(serializeSchedule(s))
    const restored = parseLedgerCheckpoint(s2, serializeLedgerCheckpoint(first))
    const a = advance(s, first, 2), b = advance(s2, restored, 2)
    strictEqual(serializeLedgerCheckpoint(a), serializeLedgerCheckpoint(b))
  })
  it('rejects altered summaries, histories, unknown-to-zero substitutions, and mixed accepted times', () => {
    const s = schedule(), state = advance(s, initial(s), 2), text = serializeLedgerCheckpoint(state)
    const mutate = (fn: (d: Record<string, unknown>) => void) => {
      const raw = JSON.parse(text) as Record<string, unknown>; fn(raw)
      throws(() => parseLedgerCheckpoint(s, JSON.stringify(raw)))
    }
    mutate(d => { (d.summary as { receiptCount: number }).receiptCount = 0 })
    mutate(d => { d.operations = [] })
    mutate(d => { d.operations = [...d.operations as unknown[], ...d.operations as unknown[]] })
    mutate(d => { (d.operations as { appliedEnergyJ: number | null }[])[0].appliedEnergyJ = 0 })
    mutate(d => { (d.ignition as { throughS: number }).throughS = 1 })
    mutate(d => { (d.summary as { physicalConservationVerified: boolean }).physicalConservationVerified = true })
    mutate(d => { d.extra = true })
  })
  it('rejects reused schedule IDs with changed content, and cloned unvalidated snapshots', () => {
    const s = schedule(), state = advance(s, initial(s), 2)
    const changed = schedule([heat({ input: { kind: 'energy', energyJ: 18 } }), ice(), hose(), water(), dig()])
    throws(() => parseLedgerCheckpoint(changed, serializeLedgerCheckpoint(state)))
    throws(() => recomputeLedgerSummary(s, { ...state }))
    throws(() => stageLedgerStep(s, { ...state }, { startS: 2, endS: 3 }, callbacks))
  })
  it('rejects individually valid ignition history that ignores water-required joint boundaries', () => {
    const s = schedule([heat(), hose(), water({ massLimitKg: 0.75 })])
    const state = advance(s, initial(s), 2)
    const standalone = stageIgnitionStep(s, createIgnitionCheckpoint(s), { startS: 0, endS: 2 }, callbacks.ignition)
    ok(standalone.candidate)
    const raw = JSON.parse(serializeLedgerCheckpoint(state)) as Record<string, unknown>
    raw.ignition = JSON.parse(serializeIgnitionCheckpoint(standalone.candidate)) as unknown
    throws(() => parseLedgerCheckpoint(s, JSON.stringify(raw)))
  })
  it('keeps every returned checkpoint, nested quantity and receipt immutable', () => {
    const s = schedule(), state = advance(s, initial(s), 2)
    ok(Object.isFrozen(state)); ok(Object.isFrozen(state.operations))
    ok(Object.isFrozen(state.summary.materialEnergy))
    ok(Object.isFrozen(state.summary.water.appliedKg))
    ok(Object.isFrozen(state.dryIce.receipts[0].accounting.energy))
    ok(Object.isFrozen(ledgerReceipts(s, state)))
  })
  it('supports an empty schedule and explicitly empty step without inventing unknown events', () => {
    const s = schedule([]), before = initial(s)
    const trial = stageLedgerStep(s, before, { startS: 0, endS: 0 }, callbacks)
    ok(trial.candidate); strictEqual(trial.receiptCoverage, 'complete')
    strictEqual(trial.provisionalSummary.receiptCount, 0)
    strictEqual(trial.provisionalSummary.ignition.appliedJ, 0)
    strictEqual(trial.provisionalSummary.water.appliedKg.total, 0)
    const after = advance(s, before, 3)
    strictEqual(after.throughS, 3)
    strictEqual(parseLedgerCheckpoint(s, serializeLedgerCheckpoint(after)).throughS, 3)
  })
})

describe('ledger final cross-module audit', () => {
  it('snapshots all report providers before invoking the first one', () => {
    const s = schedule(), mutable = { ...callbacks }
    mutable.excavation = r => {
      mutable.water = () => { throw new Error('mutated callback must not be observed') }
      return callbacks.excavation(r)
    }
    const trial = stageLedgerStep(s, initial(s), { startS: 0, endS: 1 }, mutable)
    ok(trial.candidate); strictEqual(trial.candidate.summary.water.appliedKg.total, 1)
  })
  it('matches independent finite-budget oracles across 24 dyadic mixed schedules and round-trip restarts', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const power = 2 ** (seed % 4), duration = 1 + (seed % 8) / 4
      const heatBudget = power * duration
      const flow = 2 ** (seed % 3), waterDuration = 1 + (seed % 4) / 4
      const massBudget = flow * waterDuration
      const s = schedule([
        heat({ interval: { startS: 0, endS: 4 }, input: { kind: 'power', powerW: power, energyLimitJ: heatBudget } }),
        hose(), water({ interval: { startS: 0, endS: 4 }, massFlowKgS: flow, massLimitKg: massBudget }),
        ice({ massKg: 1, thermal: { kind: 'internal-energy', internalEnergyJ: -100, referenceId: 'co2-fixture' } }),
      ])
      let state = initial(s)
      for (let i = 0; i < 16; i++) {
        state = advance(s, state, (i + 1) / 4)
        strictEqual(state.summary.ignition.requestedJ, Math.min(heatBudget, power * ((i + 1) / 4)))
        strictEqual(state.summary.water.requestedKg.total, Math.min(massBudget, flow * ((i + 1) / 4)))
        strictEqual(state.summary.dryIce.appliedKg.total, 1)
        if (i === 7) state = parseLedgerCheckpoint(s, serializeLedgerCheckpoint(state))
      }
      strictEqual(state.summary.ignition.appliedJ, heatBudget)
      strictEqual(state.summary.water.appliedKg.total, massBudget)
      strictEqual(state.summary.inventories.find(x => x.material === 'water')!.remainingMassKg, 10 - massBudget)
    }
  })
})
