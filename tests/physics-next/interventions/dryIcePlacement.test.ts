import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, ok, throws } from 'node:assert/strict'
import type { DryIcePlacementCommand, InterventionCommand } from '../../../src/physics-next/interventions/types'
import { createSchedule, parseSchedule, serializeSchedule } from '../../../src/physics-next/interventions/schedule'
import {
  createDryIceCheckpoint, parseDryIceCheckpoint, serializeDryIceCheckpoint, stageDryIceStep,
  type DryIceOffer, type MaterialApplicationReport, type MaterialEnergyReport,
} from '../../../src/physics-next/interventions/dryIcePlacement'

const solid = (changes: Partial<DryIcePlacementCommand> = {}): DryIcePlacementCommand => ({
  kind: 'dry-ice-placement', id: 'ice', sequence: 0, interval: { startS: 1, endS: 2 },
  inventoryId: 'stock', sourceId: 'source', massKg: 4,
  location: { kind: 'point', frameId: 'domain', xM: 1, yM: 2, depthM: 1 },
  thermal: { kind: 'temperature', temperatureK: 194.65 }, ...changes,
})
const schedule = (commands: readonly InterventionCommand[] = [solid()]) =>
  createSchedule({ schemaVersion: 1, id: 'run', commands })
const unknownEnergy = (): MaterialEnergyReport => ({
  referenceId: null, requestedJ: null, drawnJ: null, rejectedJ: null,
  appliedJ: null, returnedJ: null, externalLossJ: null, unresolvedJ: null,
})
/** Explicit test callback, not a production fallback. It asserts homogeneous known fixture energy. */
const accept = (offer: DryIceOffer): MaterialApplicationReport => {
  const drawnKg = offer.offeredKg, rejectedKg = offer.requestedKg - drawnKg
  const energy = offer.declaredEnergy === null ? unknownEnergy() : {
    referenceId: offer.declaredEnergy.referenceId,
    requestedJ: offer.declaredEnergy.internalEnergyJ,
    drawnJ: offer.declaredEnergy.internalEnergyJ * (drawnKg / offer.requestedKg),
    rejectedJ: offer.declaredEnergy.internalEnergyJ * (rejectedKg / offer.requestedKg),
    appliedJ: offer.declaredEnergy.internalEnergyJ * (drawnKg / offer.requestedKg),
    returnedJ: 0, externalLossJ: 0, unresolvedJ: 0,
  }
  return {
    requestId: offer.requestId, drawnKg, rejectedKg, appliedKg: drawnKg,
    returnedKg: 0, externalLossKg: 0, unresolvedKg: 0, energy, workIntoDomainJ: 0,
    reason: offer.declaredEnergy === null ? 'test fixture: energy unmeasured'
      : rejectedKg > 0 ? 'finite stock' : null,
  }
}
const reject = (offer: DryIceOffer): MaterialApplicationReport => ({
  requestId: offer.requestId, drawnKg: 0, rejectedKg: offer.requestedKg, appliedKg: 0,
  returnedKg: 0, externalLossKg: 0, unresolvedKg: 0, workIntoDomainJ: 0,
  energy: offer.declaredEnergy === null ? unknownEnergy() : {
    referenceId: offer.declaredEnergy.referenceId, requestedJ: offer.declaredEnergy.internalEnergyJ,
    drawnJ: 0, rejectedJ: offer.declaredEnergy.internalEnergyJ, appliedJ: 0,
    returnedJ: 0, externalLossJ: 0, unresolvedJ: 0,
  },
  reason: 'geometry/capacity callback explicitly declined insertion',
})

describe('finite dry-ice offers and inventory', () => {
  it('requires explicit stock for every referenced inventory, with no invented defaults', () => {
    const s = schedule()
    throws(() => createDryIceCheckpoint(s, []))
    throws(() => createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: NaN }]))
    throws(() => createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: -1 }]))
    throws(() => createDryIceCheckpoint(s, [
      { inventoryId: 'stock', massKg: 1 }, { inventoryId: 'stock', massKg: 2 },
    ]))
  })
  it('applies a reported 4 kg parcel only once at the closed-open boundary', () => {
    const s = schedule(), initial = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 6 }])
    const first = stageDryIceStep(s, initial, { startS: 0, endS: 1 }, accept)
    ok(first.candidate); strictEqual(first.receipts.length, 0)
    const at = stageDryIceStep(s, first.candidate, { startS: 1, endS: 1.5 }, accept)
    ok(at.candidate); strictEqual(at.receipts.length, 1)
    strictEqual(at.candidate.inventories[0].remainingMassKg, 2)
    const later = stageDryIceStep(s, at.candidate, { startS: 1.5, endS: 4 }, accept)
    strictEqual(later.receipts.length, 0)
  })
  it('caps the offered mass but leaves rejection and delivery to an explicit report', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 1.5 }])
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => {
      strictEqual(offer.requestedKg, 4); strictEqual(offer.offeredKg, 1.5)
      strictEqual(offer.unavailableKg, 2.5); strictEqual(offer.availableBeforeKg, 1.5)
      return accept(offer)
    })
    ok(trial.candidate)
    const a = trial.receipts[0].accounting
    strictEqual(a.requestedKg, 4); strictEqual(a.appliedKg, 1.5); strictEqual(a.rejectedKg, 2.5)
    strictEqual(trial.candidate.inventories[0].remainingMassKg, 0)
  })
  it('does not skip a stock-exhausted command or fabricate its disposition', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 0 }])
    let calls = 0
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => {
      calls++; strictEqual(offer.offeredKg, 0); return reject(offer)
    })
    strictEqual(calls, 1); ok(trial.candidate)
    strictEqual(trial.receipts[0].accounting.rejectedKg, 4)
  })
  it('shares stock deterministically across distinct placement IDs', () => {
    const commands = [solid({ id: 'ice-b' }), solid({ id: 'ice-a' })]
    const run = (cs: readonly InterventionCommand[]) => {
      const s = schedule(cs), initial = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 6 }])
      const trial = stageDryIceStep(s, initial, { startS: 0, endS: 3 }, accept)
      ok(trial.candidate); return trial.candidate
    }
    const a = run(commands), b = run([...commands].reverse())
    deepStrictEqual(a.receipts.map(r => [r.commandId, r.accounting.appliedKg]), [['ice-a', 4], ['ice-b', 2]])
    strictEqual(serializeDryIceCheckpoint(a), serializeDryIceCheckpoint(b))
  })
  it('rejects duplicate command IDs before any placement callback', () => {
    throws(() => schedule([solid(), solid()]))
  })
  it('records a capacity rejection without consuming stock or retrying the event', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, reject)
    ok(trial.candidate); strictEqual(trial.candidate.inventories[0].remainingMassKg, 4)
    strictEqual(trial.receipts[0].accounting.appliedKg, 0)
    strictEqual(stageDryIceStep(s, trial.candidate, { startS: 3, endS: 4 }, accept).receipts.length, 0)
  })
  it('distinguishes never-drawn, returned, applied, and external loss', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 10 }])
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => ({
      ...accept(offer), drawnKg: 3, rejectedKg: 1, appliedKg: 1,
      returnedKg: 1.5, externalLossKg: 0.5, reason: 'reported partial handling',
    }))
    ok(trial.candidate)
    strictEqual(trial.candidate.inventories[0].remainingMassKg, 8.5)
    strictEqual(trial.receipts[0].accounting.admissionResidualKg, 0)
    strictEqual(trial.receipts[0].accounting.transferResidualKg, 0)
  })
  it('passes both point and pinned geometry descriptors without claiming they resolve', () => {
    for (const location of [
      solid().location,
      { kind: 'geometry-reference' as const, geometryId: 'domain', revisionId: 'rev-1', featureId: 'hole' },
    ]) {
      const s = schedule([solid({ location })])
      const before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
      stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => {
        deepStrictEqual(offer.command.location, location); ok(Object.isFrozen(offer.command.location))
        return reject(offer)
      })
    }
  })
  it('honors cancellation at placement time and never reverses an earlier import', () => {
    for (const startS of [1, 1.5]) {
      const c: InterventionCommand = { kind: 'cancel', id: 'stop', sequence: 0,
        interval: { startS, endS: startS + 1 }, targetCommandId: 'ice' }
      const s = schedule([solid(), c]), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
      const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, accept)
      strictEqual(trial.receipts.length, startS === 1 ? 0 : 1)
    }
  })
})

describe('dry-ice energy, failures and immutability', () => {
  it('preserves signed declared internal energy and keeps placement work separate', () => {
    const s = schedule([solid({ thermal: { kind: 'internal-energy', internalEnergyJ: -400, referenceId: 'datum' } })])
    const before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 2 }])
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => ({
      ...accept(offer), workIntoDomainJ: 12,
    }))
    ok(trial.candidate)
    const a = trial.receipts[0].accounting
    strictEqual(a.energy.requestedJ, -400); strictEqual(a.energy.appliedJ, -200)
    strictEqual(a.energy.rejectedJ, -200); strictEqual(a.workIntoDomainJ, 12)
    strictEqual(a.admissionResidualJ, 0); strictEqual(a.transferResidualJ, 0)
  })
  it('does not calculate internal energy from a temperature-only declaration', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    const t = stageDryIceStep(s, before, { startS: 0, endS: 3 }, accept)
    ok(t.candidate); strictEqual(t.receipts[0].accounting.energy.appliedJ, null)
    strictEqual(t.receipts[0].accounting.transferResidualJ, null)
  })
  it('rejects replacing an explicit declared energy or its datum with unknown/different data', () => {
    const s = schedule([solid({ thermal: { kind: 'internal-energy', internalEnergyJ: -400, referenceId: 'datum' } })])
    const before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    for (const patch of [{ referenceId: 'other' }, { requestedJ: null }, { requestedJ: -399 }]) {
      throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 },
        o => ({ ...accept(o), energy: { ...accept(o).energy, ...patch } })))
    }
  })
  it('rejects overdraw, impossible destinations, negative amounts, missing reports and false balances', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    for (const patch of [
      { requestId: 'wrong' }, { drawnKg: 5 }, { appliedKg: 5 }, { returnedKg: 5 },
      { appliedKg: -1 }, { appliedKg: Infinity }, { drawnKg: 3 }, { rejectedKg: 1 },
      { workIntoDomainJ: -1 }, { extra: true },
    ]) throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 }, o => ({ ...accept(o), ...patch })))
    throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 }, () => undefined as unknown as MaterialApplicationReport))
  })
  it('rejects nonzero internal energy for a reported zero material quantity', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => ({
      ...reject(offer), energy: {
        referenceId: 'datum', requestedJ: 3, drawnJ: 1, rejectedJ: 2,
        appliedJ: 1, returnedJ: 0, externalLossJ: 0, unresolvedJ: 0,
      },
    })))
  })
  it('blocks further offers after unresolved mass and does not invent remaining stock', () => {
    const s = schedule([solid(), solid({ id: 'later', interval: { startS: 2, endS: 3 } })])
    const before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 8 }])
    let calls = 0
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 4 }, offer => {
      calls++
      return { ...accept(offer), appliedKg: null, externalLossKg: null, reason: 'delivery unknown' }
    })
    strictEqual(calls, 1); strictEqual(trial.candidate, null)
    strictEqual(trial.receipts[0].inventoryAfterKg, null)
    strictEqual(trial.receipts[0].accounting.appliedKg, null)
    strictEqual(trial.unattemptedRequestIds.length, 1)
    strictEqual(before.inventories[0].remainingMassKg, 8)
  })
  it('blocks a positive unresolved mass even when its amount is numerically known', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, o => ({
      ...accept(o), appliedKg: 3, unresolvedKg: 1, reason: 'one kilogram unclassified',
    }))
    strictEqual(trial.candidate, null)
  })
  it('keeps old state intact after thrown callbacks, retries, or discarded candidate states', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    const saved = serializeDryIceCheckpoint(before)
    throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 }, () => { throw new Error('capacity solve failed') }))
    const a = stageDryIceStep(s, before, { startS: 0, endS: 3 }, accept)
    const b = stageDryIceStep(s, before, { startS: 0, endS: 3 }, accept)
    ok(a.candidate); ok(b.candidate)
    strictEqual(serializeDryIceCheckpoint(before), saved)
    strictEqual(serializeDryIceCheckpoint(a.candidate), serializeDryIceCheckpoint(b.candidate))
    ok(Object.isFrozen(a.candidate.receipts[0].accounting.energy))
  })
  it('rejects accessor reports without invoking their getter', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    let reads = 0
    throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 }, offer => {
      const value = accept(offer)
      Object.defineProperty(value, 'drawnKg', { enumerable: true, get() { reads++; return 4 } })
      return value
    }))
    strictEqual(reads, 0)
  })
  it('rejects stock decrements that would round away completely', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 1e20 }])
    throws(() => stageDryIceStep(s, before, { startS: 0, endS: 3 }, accept))
  })
})

describe('dry-ice checkpoint replay', () => {
  it('restores from seeds and receipts and is independent of solver partition', () => {
    const s = schedule([solid(), solid({ id: 'second', interval: { startS: 2, endS: 3 } })])
    const before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 6 }])
    const first = stageDryIceStep(s, before, { startS: 0, endS: 2 }, accept)
    ok(first.candidate)
    const s2 = parseSchedule(serializeSchedule(s))
    const restored = parseDryIceCheckpoint(s2, serializeDryIceCheckpoint(first.candidate))
    const resumed = stageDryIceStep(s2, restored, { startS: 2, endS: 4 }, accept)
    const whole = stageDryIceStep(s, before, { startS: 0, endS: 4 }, accept)
    ok(resumed.candidate); ok(whole.candidate)
    strictEqual(serializeDryIceCheckpoint(resumed.candidate), serializeDryIceCheckpoint(whole.candidate))
  })
  it('rejects altered mass totals, receipts, IDs, checkpoint times, and schedule content', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    const trial = stageDryIceStep(s, before, { startS: 0, endS: 3 }, accept)
    ok(trial.candidate)
    const text = serializeDryIceCheckpoint(trial.candidate)
    const mutate = (fn: (raw: Record<string, unknown>) => void) => {
      const raw = JSON.parse(text) as Record<string, unknown>; fn(raw)
      throws(() => parseDryIceCheckpoint(s, JSON.stringify(raw)))
    }
    mutate(raw => { (raw.inventories as { remainingMassKg: number }[])[0].remainingMassKg = 4 })
    mutate(raw => { raw.receipts = [] })
    mutate(raw => { raw.receipts = [...raw.receipts as unknown[], ...raw.receipts as unknown[]] })
    mutate(raw => { (raw.receipts as { inventoryAfterKg: number }[])[0].inventoryAfterKg = 4 })
    mutate(raw => { raw.throughS = 1 })
    mutate(raw => { raw.extra = true })
    const changed = schedule([solid({ massKg: 3 })])
    throws(() => parseDryIceCheckpoint(changed, text))
  })
  it('requires monotone contiguous time and validated checkpoints', () => {
    const s = schedule(), before = createDryIceCheckpoint(s, [{ inventoryId: 'stock', massKg: 4 }])
    throws(() => stageDryIceStep(s, before, { startS: 1, endS: 2 }, accept))
    throws(() => stageDryIceStep(s, { ...before }, { startS: 0, endS: 2 }, accept))
    strictEqual(stageDryIceStep(s, before, { startS: 0, endS: 0 }, accept).receipts.length, 0)
  })
})
