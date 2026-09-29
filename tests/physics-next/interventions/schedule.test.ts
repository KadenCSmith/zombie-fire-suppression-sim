import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, notStrictEqual, ok, throws } from 'node:assert/strict'
import type {
  CancelCommand, DryIcePlacementCommand, ExcavationCommand, HosePlacementCommand,
  IgnitionCommand, InterventionCommand, InterventionSchedule, PointLocation,
  StartRequest, StepPlan, WaterDeliveryCommand, WindowRequest,
} from '../../../src/physics-next/interventions/types'
import {
  ScheduleValidationError, createCommand, createSchedule, clipScheduleToStep,
  compareCommands, parseSchedule, serializeSchedule,
} from '../../../src/physics-next/interventions/schedule'

const point = (): PointLocation => ({
  kind: 'point', frameId: 'domain-1', xM: 1, yM: 2, depthM: 1,
})
const heat = (id = 'heat', startS = 0, endS = 10, sourceId = 'source-1'): IgnitionCommand => ({
  kind: 'ignition', id, sequence: 0, interval: { startS, endS }, sourceId,
  location: point(), input: { kind: 'power', powerW: 8, energyLimitJ: 1000 },
})
const solid = (id = 'solid', startS = 2, endS = 3): DryIcePlacementCommand => ({
  kind: 'dry-ice-placement', id, sequence: 0, interval: { startS, endS },
  sourceId: 'source-1', inventoryId: 'stock-1', location: point(), massKg: 4,
  thermal: { kind: 'temperature', temperatureK: 194.65 },
})
const hose = (startS = 0): HosePlacementCommand => ({
  kind: 'hose-placement', id: 'place-hose', sequence: 0,
  interval: { startS, endS: startS + 1 }, hoseId: 'hose-1', location: point(),
})
const water = (id = 'water', startS = 0, endS = 10): WaterDeliveryCommand => ({
  kind: 'water-delivery', id, sequence: 0, interval: { startS, endS },
  hoseId: 'hose-1', placementCommandId: 'place-hose', reservoirId: 'tank-1',
  massFlowKgS: 0.22, massLimitKg: 5, inletTemperatureK: 293.15, supplyPressurePa: null,
})
const dig = (id = 'dig', startS = 0, endS = 2): ExcavationCommand => ({
  kind: 'excavation', id, sequence: 0, interval: { startS, endS }, operationId: 'operation-1',
  location: { kind: 'geometry-reference', geometryId: 'domain-1', revisionId: 'v1', featureId: 'bore' },
})
const cancel = (targetCommandId: string, startS: number, id = 'cancel'): CancelCommand => ({
  kind: 'cancel', id, sequence: 0, interval: { startS, endS: startS + 1 }, targetCommandId,
})
const schedule = (commands: readonly InterventionCommand[], id = 'run-1') =>
  createSchedule({ schemaVersion: 1, id, commands })
const plan = (commands: readonly InterventionCommand[], startS = 0, endS = 12) =>
  clipScheduleToStep(schedule(commands), { startS, endS })
const requests = (value: StepPlan) => value.slices.flatMap(slice => slice.requests)
const starts = (value: StepPlan): StartRequest[] =>
  requests(value).filter((request): request is StartRequest => request.dispatch === 'at-start')
const windows = (value: StepPlan, id?: string): WindowRequest[] =>
  requests(value).filter((request): request is WindowRequest =>
    request.dispatch === 'over-interval' && (id === undefined || request.command.id === id))
const spans = (value: StepPlan) =>
  value.slices.map(slice => [slice.interval.startS, slice.interval.endS])
const duration = (values: readonly WindowRequest[]) =>
  values.reduce((sum, value) => sum + value.interval.endS - value.interval.startS, 0)
const reject = (raw: unknown) => throws(() => createCommand(raw), ScheduleValidationError)

describe('schedule validation', () => {
  it('accepts an empty schedule with no guessed defaults', () => {
    deepStrictEqual(schedule([]).commands, [])
    throws(() => createSchedule({ id: 'run-1', commands: [] }), ScheduleValidationError)
    throws(() => createSchedule({ schemaVersion: 1, commands: [] }), ScheduleValidationError)
  })

  it('rejects unsupported versions and unknown schedule keys', () => {
    for (const schemaVersion of [0, 2, '1', null, NaN]) {
      throws(() => createSchedule({ schemaVersion, id: 'run-1', commands: [] }), ScheduleValidationError)
    }
    throws(() => createSchedule({ schemaVersion: 1, id: 'run-1', commands: [], applied: true }), ScheduleValidationError)
  })

  it('rejects duplicate command IDs, including duplicates with identical payloads', () => {
    throws(() => schedule([heat(), heat()]), /duplicate command ID/)
    throws(() => schedule([heat('same'), solid('same')]), /duplicate command ID/)
  })

  it('rejects malformed identifiers without rewriting them', () => {
    for (const id of ['', ' x', 'x ', 'a/b', '☃', '_x', 'x'.repeat(129), 1, null]) {
      reject({ ...heat(), id })
    }
    strictEqual(createCommand({ ...heat(), id: 'A0.z:-_' }).id, 'A0.z:-_')
    strictEqual(createCommand({ ...heat(), id: 'x'.repeat(128) }).id.length, 128)
  })

  it('requires finite nonnegative safe-integer sequence numbers', () => {
    for (const sequence of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0']) {
      reject({ ...heat(), sequence })
    }
    strictEqual(createCommand({ ...heat(), sequence: Number.MAX_SAFE_INTEGER }).sequence, Number.MAX_SAFE_INTEGER)
  })

  it('rejects malformed times and preserves exactly specified finite endpoints', () => {
    for (const value of [NaN, Infinity, -Infinity, -1, '1', null]) {
      reject({ ...heat(), interval: { startS: value, endS: 10 } })
      reject({ ...heat(), interval: { startS: 0, endS: value } })
    }
    reject({ ...heat(), interval: { startS: 2, endS: 1 } })
    reject({ ...heat(), interval: { startS: 0, endS: 1, units: 'minutes' } })
    deepStrictEqual(createCommand(heat('h', 0.1, 0.3)).interval, { startS: 0.1, endS: 0.3 })
  })

  it('treats empty window commands as no-ops, never impulses', () => {
    const value = plan([heat('h', 2, 2), dig('d', 2, 2), hose(), water('w', 2, 2)])
    strictEqual(windows(value).length, 0)
    strictEqual(starts(value).length, 1) // Only the actual hose-placement action.
    createCommand({ ...heat('e', 2, 2), input: { kind: 'energy', energyJ: 0 } })
    reject({ ...heat('e', 2, 2), input: { kind: 'energy', energyJ: 1 } })
  })

  it('requires nonempty envelopes for discrete start actions', () => {
    reject(solid('s', 2, 2))
    reject({ ...hose(), interval: { startS: 0, endS: 0 } })
    reject({ ...cancel('heat', 0), interval: { startS: 0, endS: 0 } })
  })

  it('rejects unknown kinds, extra fields, and ambiguous ignition inputs', () => {
    reject({ ...heat(), kind: 'combustion' })
    reject({ ...heat(), appliedEnergyJ: 10 })
    reject({ ...heat(), input: { kind: 'power', powerW: 1, energyLimitJ: 1, energyJ: 1 } })
    reject({ ...heat(), input: { kind: 'energy', energyJ: 1, powerW: 1 } })
    reject({ ...heat(), input: { kind: 'instant', energyJ: 1 } })
  })

  it('rejects nonfinite or negative heater work and mass-rate declarations', () => {
    for (const value of [NaN, Infinity, -Infinity, -1, '1']) {
      reject({ ...heat(), input: { kind: 'power', powerW: value, energyLimitJ: 1 } })
      reject({ ...heat(), input: { kind: 'power', powerW: 1, energyLimitJ: value } })
      reject({ ...heat(), input: { kind: 'energy', energyJ: value } })
      reject({ ...water(), massFlowKgS: value })
      reject({ ...water(), massLimitKg: value })
    }
  })

  it('rejects overflowing potential amounts and implied power', () => {
    reject({ ...heat('h', 0, 2), input: { kind: 'power', powerW: Number.MAX_VALUE, energyLimitJ: 1 } })
    reject({ ...water('w', 0, 2), massFlowKgS: Number.MAX_VALUE })
    reject({ ...heat('h', 0, Number.MIN_VALUE), input: { kind: 'energy', energyJ: 1 } })
  })

  it('rejects positive derived quantities that underflow to zero', () => {
    reject({
      ...heat('h', 0, Number.MIN_VALUE),
      input: { kind: 'power', powerW: Number.MIN_VALUE, energyLimitJ: 1 },
    })
    reject({ ...water('w', 0, Number.MIN_VALUE), massFlowKgS: Number.MIN_VALUE })
    reject({
      ...heat('h', 0, Number.MAX_VALUE),
      input: { kind: 'energy', energyJ: Number.MIN_VALUE },
    })
    createCommand({
      ...heat('zero', 0, Number.MIN_VALUE),
      input: { kind: 'power', powerW: 0, energyLimitJ: 0 },
    })
  })

  it('rejects zero/negative/nonfinite placement mass and malformed thermal data', () => {
    for (const massKg of [0, -1, NaN, Infinity]) reject({ ...solid(), massKg })
    for (const temperatureK of [0, -1, NaN, Infinity]) {
      reject({ ...solid(), thermal: { kind: 'temperature', temperatureK } })
      reject({ ...water(), inletTemperatureK: temperatureK })
    }
    reject({ ...solid(), thermal: { kind: 'temperature', temperatureC: -78 } })
    reject({ ...solid(), thermal: { kind: 'internal-energy', internalEnergyJ: 1 } })
    reject({ ...solid(), thermal: { kind: 'internal-energy', internalEnergyJ: NaN, referenceId: 'datum' } })
  })

  it('requires explicit unknown pressure and otherwise positive absolute pressure', () => {
    createCommand({ ...water(), supplyPressurePa: null })
    createCommand({ ...water(), supplyPressurePa: 101325 })
    for (const supplyPressurePa of [0, -1, NaN, Infinity, undefined]) {
      reject({ ...water(), supplyPressurePa })
    }
  })

  it('validates location descriptors without guessing a mesh or a datum', () => {
    reject({ ...heat(), location: { kind: 'cell', cellId: 3 } })
    reject({ ...heat(), location: { ...point(), depthM: -1 } })
    reject({ ...heat(), location: { ...point(), xM: NaN } })
    reject({ ...heat(), location: { ...point(), frameId: '' } })
    reject({ ...dig(), location: point() })
    reject({ ...dig(), location: { ...dig().location, revisionId: '' } })
    createCommand({ ...heat(), location: { ...point(), xM: -2, yM: -3 } })
  })

  it('rejects non-data objects, accessors, symbols, and sparse/extended arrays', () => {
    reject(null)
    reject([])
    reject(new Date(0))
    reject(Object.assign(Object.create({ inherited: true }), heat()))
    const accessor = { ...heat() }
    Object.defineProperty(accessor, 'id', { get() { throw new Error('must not run') } })
    reject(accessor)
    const symbolic = { ...heat(), [Symbol('extra')]: 1 }
    reject(symbolic)
    const sparse: InterventionCommand[] = new Array(1)
    throws(() => schedule(sparse), ScheduleValidationError)
    const extended = Object.assign([heat()], { extra: true })
    throws(() => schedule(extended), ScheduleValidationError)
    const accessorArray = [heat()]
    Object.defineProperty(accessorArray, '0', { get() { throw new Error('must not run') } })
    throws(() => schedule(accessorArray), ScheduleValidationError)
  })

  it('accepts null-prototype plain records and canonicalizes negative zero', () => {
    const raw = Object.assign(Object.create(null), heat(), {
      sequence: -0, interval: { startS: -0, endS: 1 },
      location: { ...point(), xM: -0 },
    })
    const command = createCommand(raw)
    strictEqual(Object.is(command.sequence, -0), false)
    strictEqual(Object.is(command.interval.startS, -0), false)
    if (command.kind !== 'ignition' || command.location.kind !== 'point') throw new Error('wrong kind')
    strictEqual(Object.is(command.location.xM, -0), false)
  })

  it('validates cancelled commands instead of silently dropping malformed payloads', () => {
    throws(() => createSchedule({
      schemaVersion: 1, id: 'run-1', commands: [
        { ...heat(), input: { kind: 'power', powerW: NaN, energyLimitJ: 1 } }, cancel('heat', 0),
      ],
    }), ScheduleValidationError)
  })
})

describe('cross-command links and collisions', () => {
  it('requires a real matching hose-placement declaration before water starts', () => {
    throws(() => schedule([water()]), /requires a hose-placement/)
    throws(() => schedule([heat('place-hose'), water()]), /requires a hose-placement/)
    throws(() => schedule([{ ...hose(), hoseId: 'other' }, water()]), /does not match/)
    throws(() => schedule([hose(2), water('w', 1, 3)]), /before its placement/)
    schedule([hose(2), water('w', 2, 3)])
  })

  it('does not equate a cancelled placement declaration with an applied placement', () => {
    const value = plan([hose(2), cancel('place-hose', 1), water('w', 2, 3)], 0, 4)
    strictEqual(starts(value).some(request => request.command.kind === 'hose-placement'), false)
    strictEqual(windows(value, 'w').length, 1)
    const request = windows(value, 'w')[0]
    if (request.command.kind !== 'water-delivery') throw new Error('wrong kind')
    strictEqual(request.command.placementCommandId, 'place-hose')
    strictEqual(Object.hasOwn(request, 'appliedMassKg'), false)
  })

  it('rejects multiple placement declarations for one hose identity', () => {
    throws(() => schedule([hose(), { ...hose(2), id: 'place-again' }]), /one placement per hose/)
  })

  it('rejects missing cancellation targets, self-cancellation, and cancelling a cancel', () => {
    throws(() => schedule([cancel('missing', 1)]), /unknown target/)
    throws(() => schedule([cancel('cancel', 1)]), /cancelling a cancellation/)
    throws(() => schedule([heat(), cancel('heat', 1), cancel('cancel', 2, 'undo')]), /cancelling a cancellation/)
  })

  it('rejects overlapping windows on the same heater but allows independent sources', () => {
    throws(() => schedule([heat('a', 0, 2), heat('b', 1, 3)]), /overlaps exclusive resource/)
    schedule([heat('a', 0, 2, 'source-a'), heat('b', 1, 3, 'source-b')])
    schedule([heat('a', 0, 2), heat('b', 2, 3)])
  })

  it('rejects even a representable tiny overlap without a fuzzy timing epsilon', () => {
    throws(() => schedule([heat('a', 0, 0.1 + 0.2), heat('b', 0.3, 1)]), /overlaps/)
    schedule([heat('a', 0, 0.3), heat('b', 0.3, 1)])
  })

  it('uses cancellation cutoffs to release a window resource, without resuming it', () => {
    const commands = [heat('a', 0, 10), cancel('a', 2), heat('b', 2, 4)]
    const value = plan(commands, 0, 12)
    strictEqual(duration(windows(value, 'a')), 2)
    strictEqual(duration(windows(value, 'b')), 2)
    strictEqual(windows(plan(commands, 10, 12)).length, 0)
  })

  it('allows adjacent water rate changes and rejects overlapping use of one hose', () => {
    schedule([hose(), water('w1', 0, 2), { ...water('w2', 2, 4), massFlowKgS: 0.5 }])
    throws(() => schedule([hose(), water('w1', 0, 3), water('w2', 2, 4)]), /overlaps/)
  })

  it('rejects simultaneous reuse of an excavation operation, not independent operations', () => {
    throws(() => schedule([dig('d1', 0, 3), dig('d2', 2, 4)]), /overlaps/)
    schedule([dig('d1', 0, 3), { ...dig('d2', 2, 4), operationId: 'operation-2' }])
  })

  it('does not reject empty or wholly pre-cancelled windows as active collisions', () => {
    schedule([heat('a', 0, 5), heat('zero', 1, 1)])
    schedule([heat('a', 0, 5), heat('b', 2, 4), cancel('b', 1)])
  })
})

describe('canonical order and serialization', () => {
  it('orders by timestamp, kind priority, explicit sequence, then ASCII ID', () => {
    const input = [
      { ...heat('a', 2, 3, 'sa'), sequence: 1 },
      { ...heat('Z', 2, 3, 'sZ'), sequence: 1 },
      { ...heat('early-sequence', 2, 3, 'se'), sequence: 0 },
      heat('earlier-time', 0, 1),
    ]
    const value = schedule(input)
    deepStrictEqual(value.commands.map(c => c.id), ['earlier-time', 'early-sequence', 'Z', 'a'])
    deepStrictEqual([...input].sort(compareCommands).map(c => c.id), value.commands.map(c => c.id))
    deepStrictEqual(input.map(c => c.id), ['a', 'Z', 'early-sequence', 'earlier-time'])
  })

  it('stages all equal-time command kinds in their declared order, with cancellation first', () => {
    const commands = [
      water('water', 2, 3), heat('live', 2, 3, 'live-source'), solid(), hose(2),
      dig('dig', 2, 3), { ...cancel('old', 2), sequence: 999 }, heat('old', 0, 10),
    ]
    const value = plan(commands, 2, 3)
    deepStrictEqual(value.slices[0].requests.map(r => r.command.kind), [
      'cancel', 'excavation', 'hose-placement', 'dry-ice-placement', 'ignition', 'water-delivery',
    ])
    strictEqual(value.slices[0].requests.some(r => r.command.id === 'old'), false)
  })

  it('uses per-slice order rather than the historical start time of continuing sources', () => {
    const commands = [
      { ...heat('older', 0, 5, 'a'), sequence: 10 },
      { ...heat('newer', 2, 5, 'b'), sequence: 0 },
    ]
    deepStrictEqual(plan(commands, 2, 3).slices[0].requests.map(r => r.command.id), ['newer', 'older'])
  })

  it('produces identical canonical bytes for reordered arrays and object keys', () => {
    const commands = [heat('a', 0, 5), cancel('a', 2), solid('b', 3, 4)]
    const reordered = JSON.parse(JSON.stringify(commands.map(c =>
      Object.fromEntries(Object.entries(c).reverse())).reverse())) as InterventionCommand[]
    strictEqual(serializeSchedule(schedule(commands)), serializeSchedule(schedule(reordered)))
  })

  it('restarts from canonical JSON with identical plans and request IDs', () => {
    const original = schedule([heat(), cancel('heat', 3), solid('s', 3, 5)])
    const bytes = serializeSchedule(original), restored = parseSchedule(bytes)
    notStrictEqual(original, restored)
    strictEqual(serializeSchedule(restored), bytes)
    deepStrictEqual(
      clipScheduleToStep(restored, { startS: 2, endS: 6 }),
      clipScheduleToStep(original, { startS: 2, endS: 6 }),
    )
  })

  it('rejects invalid JSON and uncompiled schedule objects', () => {
    throws(() => parseSchedule('{'), SyntaxError)
    throws(() => parseSchedule('{"schemaVersion":99,"id":"x","commands":[]}'), ScheduleValidationError)
    const fake = { schemaVersion: 1, id: 'fake', commands: [] } as unknown as InterventionSchedule
    throws(() => clipScheduleToStep(fake, { startS: 0, endS: 1 }), /use createSchedule/)
    throws(() => serializeSchedule(fake), /use createSchedule/)
  })

  it('includes schedule identity in unambiguous request-ID tuples', () => {
    const a = clipScheduleToStep(schedule([solid('c')], 'a:b'), { startS: 2, endS: 3 })
    const b = clipScheduleToStep(schedule([solid('b:c')], 'a'), { startS: 2, endS: 3 })
    notStrictEqual(starts(a)[0].requestId, starts(b)[0].requestId)
    deepStrictEqual(JSON.parse(starts(a)[0].requestId), [
      'intervention-request', 1, 'a:b', 'c', 'at-start', 2,
    ])
  })
})

describe('closed-open clipping and cancellation', () => {
  it('splits a solver step exactly at source start and cutoff, including idle spans', () => {
    const value = plan([heat('h', 0.25, 0.75)], 0, 1)
    deepStrictEqual(spans(value), [[0, 0.25], [0.25, 0.75], [0.75, 1]])
    deepStrictEqual(value.slices.map(s => s.requests.length), [0, 1, 0])
    deepStrictEqual(windows(value)[0].interval, { startS: 0.25, endS: 0.75 })
  })

  it('includes left-edge events and defers right-edge events to the next step', () => {
    const commands = [solid('left', 0, 2), solid('right', 1, 2)]
    deepStrictEqual(starts(plan(commands, 0, 1)).map(r => r.command.id), ['left'])
    deepStrictEqual(starts(plan(commands, 1, 2)).map(r => r.command.id), ['right'])
  })

  it('emits a placement only at its left edge, not later in its envelope', () => {
    const commands = [solid('s', 2, 8)]
    strictEqual(starts(plan(commands, 0, 10)).length, 1)
    strictEqual(starts(plan(commands, 3, 5)).length, 0)
    deepStrictEqual(spans(plan(commands, 0, 10)), [[0, 2], [2, 10]])
  })

  it('does not activate a rate whose start is the solver step end', () => {
    strictEqual(windows(plan([heat('h', 1, 3)], 0, 1)).length, 0)
    strictEqual(windows(plan([heat('h', 1, 3)], 1, 2)).length, 1)
    strictEqual(windows(plan([heat('h', 1, 3)], 3, 4)).length, 0)
  })

  it('returns no slices or start actions for an empty solver step', () => {
    deepStrictEqual(plan([solid('s', 2, 3)], 2, 2).slices, [])
    deepStrictEqual(plan([], 0, 0).slices, [])
  })

  it('retains an idle solver interval even with no commands', () => {
    const value = plan([], 1, 5)
    deepStrictEqual(spans(value), [[1, 5]])
    deepStrictEqual(value.slices[0].requests, [])
  })

  it('pre-cancels future windows and start actions without deleting their declarations', () => {
    const commands = [heat('h', 3, 6), solid('s', 4, 5), cancel('h', 1, 'c1'), cancel('s', 2, 'c2')]
    const value = plan(commands, 0, 8)
    strictEqual(windows(value).length, 0)
    deepStrictEqual(starts(value).map(r => r.command.id), ['c1', 'c2'])
    strictEqual(schedule(commands).commands.length, 4)
  })

  it('cancellation at an action timestamp wins regardless of sequence or input order', () => {
    for (const commands of [
      [solid('s', 2, 3), { ...cancel('s', 2), sequence: 999 }],
      [{ ...cancel('s', 2), sequence: 999 }, solid('s', 2, 3)],
    ]) deepStrictEqual(starts(plan(commands, 2, 3)).map(r => r.command.kind), ['cancel'])
  })

  it('clips a mid-step cutoff without retroactive loss or post-cutoff resumption', () => {
    const commands = [heat('h', 0, 10), cancel('h', 3.5)]
    deepStrictEqual(spans(plan(commands, 2, 5)), [[2, 3.5], [3.5, 5]])
    strictEqual(duration(windows(plan(commands, 2, 5))), 1.5)
    strictEqual(duration(windows(plan(commands, 0, 2))), 2)
    strictEqual(windows(plan(commands, 5, 9)).length, 0)
  })

  it('a later cancellation does not retract a previously offered placement', () => {
    const value = plan([solid('s', 2, 8), cancel('s', 3)], 0, 9)
    deepStrictEqual(starts(value).map(r => [r.command.kind, r.atS]), [
      ['dry-ice-placement', 2], ['cancel', 3],
    ])
    strictEqual(starts(value).some(r => Object.hasOwn(r, 'removeMassKg')), false)
  })

  it('retains a late no-op cancellation as an auditable control request', () => {
    const value = plan([heat('h', 0, 1), cancel('h', 2)], 1, 4)
    strictEqual(windows(value).length, 0)
    deepStrictEqual(starts(value).map(r => r.command.kind), ['cancel'])
  })

  it('uses the earliest of repeated cancellations and retains their distinct IDs', () => {
    const value = plan([heat(), cancel('heat', 4, 'late'), cancel('heat', 2, 'early')], 0, 8)
    strictEqual(duration(windows(value)), 2)
    deepStrictEqual(starts(value).map(r => r.command.id), ['early', 'late'])
  })

  it('cancels exactly at the right edge only in the following query', () => {
    const commands = [heat('h', 0, 5), cancel('h', 2)]
    const before = plan(commands, 0, 2), after = plan(commands, 2, 3)
    strictEqual(duration(windows(before)), 2)
    strictEqual(starts(before).length, 0)
    strictEqual(windows(after).length, 0)
    strictEqual(starts(after).length, 1)
  })

  it('does not merge distinct representable floating-point timestamps', () => {
    const a = 0.3, b = 0.1 + 0.2
    ok(a < b)
    const value = plan([solid('a', a, 1), solid('b', b, 1)], 0, 1)
    deepStrictEqual(spans(value), [[0, a], [a, b], [b, 1]])
    deepStrictEqual(starts(value).map(r => r.atS), [a, b])
  })

  it('handles large representable times without advancing in fixed ticks', () => {
    const startS = 1e12
    const value = plan([heat('h', startS, startS + 0.25)], startS - 1, startS + 1)
    strictEqual(value.slices.length, 3)
    strictEqual(duration(windows(value)), 0.25)
    strictEqual(plan([heat('h', 1e9, 1e9 + 100)], 0, 1e9 + 200).slices.length, 3)
  })

  it('rejects malformed solver windows instead of clipping or clamping them', () => {
    const value = schedule([])
    for (const bad of [
      { startS: 1, endS: 0 }, { startS: -1, endS: 0 },
      { startS: NaN, endS: 1 }, { startS: 0, endS: Infinity },
      { startS: 0, endS: 1, dtS: 1 },
    ]) throws(() => clipScheduleToStep(value, bad), ScheduleValidationError)
  })
})

describe('replay, rollback boundaries, and independent timing checks', () => {
  it('repeats identical requests after a discarded attempt without consuming anything', () => {
    const value = schedule([heat(), solid(), cancel('heat', 5)])
    const before = serializeSchedule(value)
    const first = clipScheduleToStep(value, { startS: 0, endS: 6 })
    clipScheduleToStep(value, { startS: 9, endS: 12 })
    const retried = clipScheduleToStep(value, { startS: 0, endS: 6 })
    deepStrictEqual(retried, first)
    strictEqual(serializeSchedule(value), before)
  })

  it('returns plans independent of query order or a presumed execution cursor', () => {
    const value = schedule([heat(), solid(), cancel('heat', 5)])
    const late = clipScheduleToStep(value, { startS: 8, endS: 9 })
    const early = clipScheduleToStep(value, { startS: 0, endS: 4 })
    deepStrictEqual(clipScheduleToStep(value, { startS: 8, endS: 9 }), late)
    deepStrictEqual(clipScheduleToStep(parseSchedule(serializeSchedule(value)), { startS: 0, endS: 4 }), early)
  })

  it('gives a discrete event one stable ID independent of step partition', () => {
    const value = schedule([solid('s', 2, 5)])
    const broad = clipScheduleToStep(value, { startS: 0, endS: 10 })
    const narrow = clipScheduleToStep(value, { startS: 2, endS: 2.5 })
    strictEqual(starts(broad)[0].requestId, starts(narrow)[0].requestId)
    strictEqual(starts(clipScheduleToStep(value, { startS: 2.5, endS: 3 })).length, 0)
  })

  it('uses interval-qualified IDs for windows, not false partition-independent receipts', () => {
    const value = schedule([heat('h', 0, 2)])
    const wide = windows(clipScheduleToStep(value, { startS: 0, endS: 2 }))[0]
    const half = windows(clipScheduleToStep(value, { startS: 0, endS: 1 }))[0]
    notStrictEqual(wide.requestId, half.requestId)
    deepStrictEqual(JSON.parse(half.requestId).slice(-3), ['over-interval', 0, 1])
  })

  it('cannot consume a shared reservoir or invent an applied ledger', () => {
    const commands = [
      hose(), water(),
      { ...hose(), id: 'place-other', hoseId: 'hose-2' },
      { ...water('other'), hoseId: 'hose-2', placementCommandId: 'place-other' },
    ]
    const value = schedule(commands), before = serializeSchedule(value)
    for (let i = 0; i < 3; i++) {
      const result = clipScheduleToStep(value, { startS: 0, endS: 2 })
      for (const request of requests(result)) {
        for (const key of ['appliedKg', 'appliedJ', 'remainingKg', 'success', 'receipt']) {
          strictEqual(Object.hasOwn(request, key), false)
        }
      }
    }
    strictEqual(serializeSchedule(value), before)
  })

  it('is additive in timing coverage under a dyadic partition, including cancellation', () => {
    const value = schedule([heat('h', 0.25, 7.75), solid('s', 2, 5), cancel('h', 5.25)])
    const broad = clipScheduleToStep(value, { startS: 0, endS: 8 })
    const parts = [0, 1, 2, 2.5, 5, 6, 8]
    const narrow = parts.slice(1).map((endS, i) =>
      clipScheduleToStep(value, { startS: parts[i], endS }))
    strictEqual(duration(windows(broad)), 5)
    strictEqual(narrow.reduce((sum, p) => sum + duration(windows(p)), 0), 5)
    deepStrictEqual(narrow.flatMap(starts).map(r => r.requestId), starts(broad).map(r => r.requestId))
  })

  it('matches an independent timing oracle over 40 reproducible generated schedules', () => {
    // Integer/dyadic arithmetic makes these equality checks exact, not tolerance-based.
    for (let seed = 1; seed <= 40; seed++) {
      const commands: InterventionCommand[] = []
      for (let i = 0; i < 6; i++) {
        const startS = ((seed * 5 + i * 7) % 20) / 4
        const endS = startS + 0.5 + ((seed + i) % 6) / 4
        const id = `h-${i}`
        commands.push(heat(id, startS, endS, `source-${i}`))
        if ((seed + i) % 2 === 0) {
          commands.push(cancel(id, ((seed * 3 + i * 11) % 32) / 4, `c-${i}`))
        }
      }
      commands.push(solid('solid-oracle', (seed % 24) / 4, 9))
      const value = schedule(commands)
      let splitDuration = 0
      const splitStartIds: string[] = []
      for (let k = 0; k < 36; k++) {
        const startS = k / 4, endS = (k + 1) / 4, midpoint = (startS + endS) / 2
        const chunk = clipScheduleToStep(value, { startS, endS })
        const expected = commands.filter(c => {
          if (c.kind !== 'ignition') return false
          const cutoffs = commands.filter((v): v is CancelCommand =>
            v.kind === 'cancel' && v.targetCommandId === c.id).map(v => v.interval.startS)
          const cutoff = Math.min(c.interval.endS, ...cutoffs)
          return c.interval.startS <= midpoint && midpoint < cutoff
        }).map(c => c.id).sort()
        deepStrictEqual(windows(chunk).map(r => r.command.id).sort(), expected)
        splitDuration += duration(windows(chunk))
        splitStartIds.push(...starts(chunk).map(r => r.requestId))
      }
      const broad = clipScheduleToStep(value, { startS: 0, endS: 9 })
      strictEqual(splitDuration, duration(windows(broad)))
      deepStrictEqual(splitStartIds, starts(broad).map(r => r.requestId))
      const reversed = schedule([...commands].reverse())
      strictEqual(serializeSchedule(value), serializeSchedule(reversed))
    }
  })
})
