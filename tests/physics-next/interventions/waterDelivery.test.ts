import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, ok, throws } from 'node:assert/strict'
import type {
  HosePlacementCommand, IgnitionCommand, InterventionCommand, WaterDeliveryCommand,
} from '../../../src/physics-next/interventions/types'
import { createSchedule, parseSchedule, serializeSchedule } from '../../../src/physics-next/interventions/schedule'
import {
  materialAccountingInternals as m, type MaterialApplicationReport,
} from '../../../src/physics-next/interventions/dryIcePlacement'
import {
  createWaterCheckpoint, getWaterProfile, isWaterMassRequest, parseWaterCheckpoint,
  planWaterStep, requestedWaterKgAt, serializeWaterCheckpoint, stageWaterStep,
  type HosePlacementCallback, type WaterOffer,
} from '../../../src/physics-next/interventions/waterDelivery'
import { isIgnitionEnergyRequest } from '../../../src/physics-next/interventions/ignition'

const hose = (changes: Partial<HosePlacementCommand> = {}): HosePlacementCommand => ({
  kind: 'hose-placement', id: 'place', sequence: 0, interval: { startS: 0, endS: 1 }, hoseId: 'hose',
  location: { kind: 'point', frameId: 'domain', xM: 0, yM: 0, depthM: 1 }, ...changes,
})
const water = (changes: Partial<WaterDeliveryCommand> = {}): WaterDeliveryCommand => ({
  kind: 'water-delivery', id: 'water', sequence: 0, interval: { startS: 0, endS: 4 },
  hoseId: 'hose', placementCommandId: 'place', reservoirId: 'tank', massFlowKgS: 1, massLimitKg: 100,
  inletTemperatureK: 293.15, supplyPressurePa: null, ...changes,
})
const schedule = (commands: readonly InterventionCommand[] = [hose(), water()]) =>
  createSchedule({ schemaVersion: 1, id: 'run', commands })
const place: HosePlacementCallback = req => ({ requestId: req.requestId, status: 'placed', reason: null })
/** Deliberately explicit fixture; production never defaults a requested amount to applied. */
const accept = (o: WaterOffer): MaterialApplicationReport => ({
  requestId: o.requestId, drawnKg: o.offeredKg, rejectedKg: o.requestedKg - o.offeredKg,
  appliedKg: o.offeredKg, returnedKg: 0, externalLossKg: 0, unresolvedKg: 0,
  energy: { referenceId: null, requestedJ: null, drawnJ: null, rejectedJ: null,
    appliedJ: null, returnedJ: null, externalLossJ: null, unresolvedJ: null },
  workIntoDomainJ: 0, reason: 'test fixture: thermal energy is not evaluated',
})
const callbacks = { placeHose: place, deliverWater: accept }

describe('finite water profiles and full event refinement', () => {
  it('integrates adjacent rate changes and turns off exactly at schedule end', () => {
    const s = schedule([hose(),
      water({ interval: { startS: 0, endS: 2 } }),
      water({ id: 'water-2', interval: { startS: 2, endS: 4 }, massFlowKgS: 2 }),
    ])
    const before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 20 }])
    const trial = stageWaterStep(s, before, { startS: 0, endS: 6 }, callbacks)
    ok(trial.candidate)
    deepStrictEqual(trial.receipts.map(r => [r.interval.startS, r.interval.endS, r.accounting.requestedKg]),
      [[0, 2, 2], [2, 4, 4]])
    strictEqual(m.sum(trial.receipts.map(r => r.accounting.appliedKg!)), 6)
    strictEqual(trial.candidate.reservoirs[0].remainingMassKg, 14)
  })
  it('splits a mid-step finite mass cutoff and pins the exact declared kilograms', () => {
    const s = schedule([hose(), water({ interval: { startS: 0, endS: 100 }, massFlowKgS: 0.22, massLimitKg: 5 })])
    const plan = planWaterStep(s, { startS: 0, endS: 100 })
    strictEqual(getWaterProfile(s, 'water').massBudgetCutoffS, 5 / 0.22)
    strictEqual(plan.slices[0].interval.endS, 5 / 0.22)
    const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 5 }]),
      { startS: 0, endS: 100 }, callbacks)
    ok(trial.candidate)
    strictEqual(m.sum(trial.receipts.map(r => r.accounting.appliedKg!)), 5)
    strictEqual(trial.candidate.reservoirs[0].remainingMassKg, 0)
  })
  it('keeps ignition budget cutoffs and registered ignition requests in the combined plan', () => {
    const heat: IgnitionCommand = {
      kind: 'ignition', id: 'heat', sequence: 0, interval: { startS: 0, endS: 10 },
      sourceId: 'heater', location: hose().location, input: { kind: 'power', powerW: 8, energyLimitJ: 20 },
    }
    const s = schedule([hose(), water({ massLimitKg: 3 }), heat])
    const plan = planWaterStep(s, { startS: 0, endS: 5 })
    deepStrictEqual(plan.slices.map(x => [x.interval.startS, x.interval.endS]), [[0, 2.5], [2.5, 3], [3, 4], [4, 5]])
    const heating = plan.slices.flatMap(x => x.requests).filter(isIgnitionEnergyRequest)
    strictEqual(heating[0].requestedJ, 20)
    strictEqual(plan.slices.flatMap(x => x.requests).filter(isWaterMassRequest)
      .reduce((n, r) => n + r.requestedKg, 0), 3)
  })
  it('supports explicit zero duration/rate/budget without invoking water delivery', () => {
    for (const change of [
      { interval: { startS: 0, endS: 0 } }, { massFlowKgS: 0 }, { massLimitKg: 0 },
    ]) {
      const s = schedule([hose(), water(change)])
      const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 10 }]),
        { startS: 0, endS: 5 }, { placeHose: place, deliverWater: () => { throw new Error('must not be called') } })
      strictEqual(trial.receipts.length, 0); ok(trial.candidate)
    }
  })
  it('honors an exact cancellation cutoff without redistributing rejected flow', () => {
    const c: InterventionCommand = { kind: 'cancel', id: 'stop', sequence: 0,
      interval: { startS: 1.5, endS: 2 }, targetCommandId: 'water' }
    const s = schedule([hose(), water(), c])
    strictEqual(requestedWaterKgAt(s, 'water', 100), 1.5)
    const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 0 }]),
      { startS: 0, endS: 5 }, callbacks)
    strictEqual(m.sum(trial.receipts.map(r => r.accounting.rejectedKg!)), 1.5)
    strictEqual(m.sum(trial.receipts.map(r => r.accounting.appliedKg!)), 0)
  })
  it('rejects overlapping commands for the same hose', () => {
    throws(() => schedule([hose(), water(), water({ id: 'other', interval: { startS: 1, endS: 5 } })]))
  })
  it('rejects unrepresentable cutoff times and invalid time queries', () => {
    const s = schedule([hose(), water({
      interval: { startS: 1e16, endS: 1e16 + 10 }, massFlowKgS: 1, massLimitKg: 1,
    })])
    throws(() => createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 1 }]))
    throws(() => requestedWaterKgAt(schedule(), 'water', NaN))
    throws(() => requestedWaterKgAt(schedule(), 'missing', 1))
  })
  it('exposes mass-integral roundoff without inferring instantaneous flow', () => {
    const r = planWaterStep(schedule([hose(), water({ massFlowKgS: 0.1 })]),
      { startS: 3.1, endS: 3.2 }).slices[0].requests.filter(isWaterMassRequest)[0]
    strictEqual(r.requestedKg, r.cumulativeEndKg - r.cumulativeStartKg)
    strictEqual(r.roundoffKg, r.requestedKg - r.nominalMassFlowKgS * (r.interval.endS - r.interval.startS))
  })
})

describe('hose prerequisites and finite shared reservoirs', () => {
  it('rejects a schedule with water before its declared placement', () => {
    throws(() => schedule([hose({ interval: { startS: 1, endS: 2 } }), water()]))
  })
  it('requires an actual placed report before offering water at the same time', () => {
    const s = schedule(), before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }])
    const order: string[] = []
    const trial = stageWaterStep(s, before, { startS: 0, endS: 4 }, {
      placeHose: req => { order.push('place'); return place(req) },
      deliverWater: offer => {
        order.push('water'); ok(offer.confirmedPlacementRequestId); strictEqual(offer.offeredKg, 4)
        return accept(offer)
      },
    })
    deepStrictEqual(order, ['place', 'water']); ok(trial.candidate)
  })
  it('does not draw water after rejected placement or when that placement was cancelled', () => {
    const cancel: InterventionCommand = { kind: 'cancel', id: 'cancel', sequence: 0,
      interval: { startS: 0, endS: 1 }, targetCommandId: 'place' }
    for (const s of [schedule(), schedule([hose(), water(), cancel])]) {
      const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }]),
        { startS: 0, endS: 4 }, {
          placeHose: req => ({ requestId: req.requestId, status: 'rejected', reason: 'geometry unavailable' }),
          deliverWater: offer => {
            strictEqual(offer.offeredKg, 0); strictEqual(offer.confirmedPlacementRequestId, null)
            return accept(offer)
          },
        })
      ok(trial.candidate)
      strictEqual(trial.candidate.reservoirs[0].remainingMassKg, 4)
      strictEqual(trial.receipts[0].accounting.rejectedKg, 4)
    }
  })
  it('blocks uncertain placement instead of converting uncertainty into failure or success', () => {
    const s = schedule()
    const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }]),
      { startS: 0, endS: 4 }, {
        placeHose: req => ({ requestId: req.requestId, status: 'unknown', reason: 'capacity solve incomplete' }),
        deliverWater: () => { throw new Error('must not deliver') },
      })
    strictEqual(trial.candidate, null); strictEqual(trial.blockedAtS, 0)
    strictEqual(trial.placements[0].status, 'unknown'); strictEqual(trial.receipts.length, 0)
  })
  it('does not remove an already placed hose when its placement declaration is cancelled later', () => {
    const cancel: InterventionCommand = { kind: 'cancel', id: 'cancel', sequence: 0,
      interval: { startS: 1, endS: 2 }, targetCommandId: 'place' }
    const s = schedule([hose(), water(), cancel])
    const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }]),
      { startS: 0, endS: 4 }, callbacks)
    strictEqual(m.sum(trial.receipts.map(r => r.accounting.appliedKg!)), 4)
  })
  it('reserves a scarce common reservoir proportionally before collecting reports', () => {
    const commands = [
      hose(), water(), hose({ id: 'place-2', hoseId: 'hose-2' }),
      water({ id: 'water-2', hoseId: 'hose-2', placementCommandId: 'place-2' }),
    ]
    const run = (cs: readonly InterventionCommand[]) => {
      const s = schedule(cs), trial = stageWaterStep(s,
        createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 6 }]), { startS: 0, endS: 4 }, callbacks)
      ok(trial.candidate); return trial.candidate
    }
    const a = run(commands), b = run([...commands].reverse())
    deepStrictEqual(a.receipts.map(r => [r.accounting.offeredKg, r.accounting.appliedKg]), [[3, 3], [3, 3]])
    strictEqual(a.reservoirs[0].remainingMassKg, 0)
    strictEqual(serializeWaterCheckpoint(a), serializeWaterCheckpoint(b))
  })
  it('does not reoffer another hose return within the same interval', () => {
    const s = schedule([hose(), water(),
      hose({ id: 'place-2', hoseId: 'hose-2' }),
      water({ id: 'water-2', hoseId: 'hose-2', placementCommandId: 'place-2' }),
    ])
    const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 6 }]),
      { startS: 0, endS: 4 }, {
        placeHose: place,
        deliverWater: offer => offer.command.id === 'water'
          ? { ...accept(offer), appliedKg: 0, returnedKg: offer.offeredKg, reason: 'all drawn water returned' }
          : accept(offer),
      })
    ok(trial.candidate)
    strictEqual(trial.receipts[1].accounting.offeredKg, 3)
    strictEqual(trial.receipts[0].accounting.returnedKg, 3)
    strictEqual(trial.candidate.reservoirs[0].remainingMassKg, 3)
  })
  it('keeps delivery, never-drawn rejection, return, and external loss separate', () => {
    const s = schedule()
    const t = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 10 }]),
      { startS: 0, endS: 4 }, {
        placeHose: place, deliverWater: o => ({
          ...accept(o), drawnKg: 3, rejectedKg: 1, appliedKg: 1, returnedKg: 1, externalLossKg: 1,
        }),
      })
    ok(t.candidate)
    strictEqual(t.candidate.reservoirs[0].remainingMassKg, 8)
    strictEqual(t.receipts[0].accounting.transferResidualKg, 0)
  })
  it('preserves unknown losses and thermal energy; unknown mass blocks reuse', () => {
    const s = schedule(), before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 10 }])
    const trial = stageWaterStep(s, before, { startS: 0, endS: 4 }, {
      placeHose: place,
      deliverWater: o => ({ ...accept(o), appliedKg: null, externalLossKg: null, reason: 'unmeasured delivery/loss' }),
    })
    strictEqual(trial.candidate, null); strictEqual(trial.receipts[0].reservoirAfterKg, null)
    strictEqual(trial.receipts[0].accounting.externalLossKg, null)
    strictEqual(trial.receipts[0].accounting.energy.appliedJ, null)
    strictEqual(before.reservoirs[0].remainingMassKg, 10)
  })
  it('passes pressure and inlet temperature as metadata without a hydraulic/cooling result', () => {
    for (const supplyPressurePa of [null, 101325, 200000]) {
      const s = schedule([hose(), water({ supplyPressurePa, inletTemperatureK: 290 })])
      stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 2 }]),
        { startS: 0, endS: 4 }, {
          placeHose: place, deliverWater: o => {
            strictEqual(o.command.supplyPressurePa, supplyPressurePa)
            strictEqual(o.command.inletTemperatureK, 290)
            strictEqual(o.maximumMeanDrawKgS, 0.5)
            return accept(o)
          },
        })
    }
  })
  it('requires explicit finite reservoir declarations and rejects overdraw or fake placement reports', () => {
    const s = schedule()
    throws(() => createWaterCheckpoint(s, []))
    throws(() => createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: Infinity }]))
    throws(() => createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 1 }, { reservoirId: 'tank', massKg: 1 }]))
    const before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 1 }])
    throws(() => stageWaterStep(s, before, { startS: 0, endS: 4 }, {
      placeHose: place, deliverWater: o => ({ ...accept(o), drawnKg: 2, appliedKg: 2, rejectedKg: 2 }),
    }))
    throws(() => stageWaterStep(s, before, { startS: 0, endS: 4 }, {
      placeHose: req => ({ requestId: req.requestId, status: 'unknown', reason: null }), deliverWater: accept,
    }))
  })
})

describe('water rollback, exact prefix mass and restart', () => {
  it('recomputes a 1 kg cumulative flow across 100 accepted partitions', () => {
    const s = schedule([hose(), water({ interval: { startS: 0, endS: 10 }, massFlowKgS: 0.1, massLimitKg: 1 })])
    let state = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 1 }])
    for (let i = 0; i < 100; i++) {
      const t = stageWaterStep(s, state, { startS: i / 10, endS: (i + 1) / 10 }, callbacks)
      ok(t.candidate); state = t.candidate
    }
    strictEqual(m.sum(state.receipts.map(r => r.accounting.requestedKg)), 1)
    strictEqual(m.sum(state.receipts.map(r => r.accounting.appliedKg!)), 1)
    strictEqual(state.reservoirs[0].remainingMassKg, 0)
    strictEqual(requestedWaterKgAt(s, 'water', 10), 1)
  })
  it('restores identical reservations and results using the original accepted partitions', () => {
    const s = schedule(), initial = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 3 }])
    const first = stageWaterStep(s, initial, { startS: 0, endS: 1.25 }, callbacks)
    ok(first.candidate)
    const s2 = parseSchedule(serializeSchedule(s))
    const restored = parseWaterCheckpoint(s2, serializeWaterCheckpoint(first.candidate))
    const a = stageWaterStep(s, first.candidate, { startS: 1.25, endS: 5 }, callbacks)
    const b = stageWaterStep(s2, restored, { startS: 1.25, endS: 5 }, callbacks)
    ok(a.candidate); ok(b.candidate)
    strictEqual(serializeWaterCheckpoint(a.candidate), serializeWaterCheckpoint(b.candidate))
  })
  it('rejects altered stocks, duplicate/missing receipts, prerequisite claims and partition histories', () => {
    const s = schedule()
    const trial = stageWaterStep(s, createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }]),
      { startS: 0, endS: 4 }, callbacks)
    ok(trial.candidate)
    const text = serializeWaterCheckpoint(trial.candidate)
    const mutate = (fn: (d: Record<string, unknown>) => void) => {
      const d = JSON.parse(text) as Record<string, unknown>; fn(d)
      throws(() => parseWaterCheckpoint(s, JSON.stringify(d)))
    }
    mutate(d => { d.receipts = [] })
    mutate(d => { d.placements = [] })
    mutate(d => { d.receipts = [...d.receipts as unknown[], ...d.receipts as unknown[]] })
    mutate(d => { d.partitionEndsS = [2, 4] })
    mutate(d => { d.partitionEndsS = [] })
    mutate(d => { (d.reservoirs as { remainingMassKg: number }[])[0].remainingMassKg = 4 })
    mutate(d => { (d.receipts as { confirmedPlacementRequestId: string }[])[0].confirmedPlacementRequestId = 'fake' })
    mutate(d => { d.throughS = 3 })
    mutate(d => { d.extra = true })
    throws(() => parseWaterCheckpoint(schedule([hose(), water({ massFlowKgS: 2 })]), text))
  })
  it('leaves the initial state unchanged on throwing callbacks and deterministic retry', () => {
    const s = schedule(), before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }])
    const original = serializeWaterCheckpoint(before)
    throws(() => stageWaterStep(s, before, { startS: 0, endS: 4 }, {
      placeHose: place, deliverWater: () => { throw new Error('detached physical solve rejected') },
    }))
    const a = stageWaterStep(s, before, { startS: 0, endS: 4 }, callbacks)
    const b = stageWaterStep(s, before, { startS: 0, endS: 4 }, callbacks)
    ok(a.candidate); ok(b.candidate)
    strictEqual(serializeWaterCheckpoint(a.candidate), serializeWaterCheckpoint(b.candidate))
    strictEqual(serializeWaterCheckpoint(before), original)
    ok(Object.isFrozen(a.candidate.receipts[0].accounting))
  })
  it('requires validated checkpoints and contiguous time; empty intervals do nothing', () => {
    const s = schedule(), before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }])
    throws(() => stageWaterStep(s, { ...before }, { startS: 0, endS: 4 }, callbacks))
    throws(() => stageWaterStep(s, before, { startS: 1, endS: 4 }, callbacks))
    const t = stageWaterStep(s, before, { startS: 0, endS: 0 }, callbacks)
    strictEqual(t.receipts.length, 0); strictEqual(t.placements.length, 0)
    ok(t.candidate); deepStrictEqual(t.candidate.partitionEndsS, [])
  })
})

describe('water callback binding', () => {
  it('snapshots validated callback references before any user callback is evaluated', () => {
    const s = schedule(), before = createWaterCheckpoint(s, [{ reservoirId: 'tank', massKg: 4 }])
    const mutable = { placeHose: place, deliverWater: accept }
    mutable.placeHose = r => {
      mutable.deliverWater = () => { throw new Error('mutated callback must not be observed') }
      return place(r)
    }
    const trial = stageWaterStep(s, before, { startS: 0, endS: 4 }, mutable)
    ok(trial.candidate); strictEqual(trial.receipts[0].accounting.appliedKg, 4)
  })
})
