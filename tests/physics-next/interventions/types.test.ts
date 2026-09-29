import { describe, it } from 'vitest'
import { deepStrictEqual, strictEqual, notStrictEqual, ok, throws } from 'node:assert/strict'
import {
  COMMAND_KIND_ORDER,
  type IgnitionCommand,
  type InterventionCommand,
  type InterventionSchedule,
  type StepPlan,
} from '../../../src/physics-next/interventions/types'
import {
  createCommand, createSchedule, clipScheduleToStep,
} from '../../../src/physics-next/interventions/schedule'

// These expressions must fail type checking. The function is deliberately never invoked.
function readonlyContract(command: IgnitionCommand, schedule: InterventionSchedule, plan: StepPlan): void {
  // @ts-expect-error Commands are immutable.
  command.id = 'replacement'
  // @ts-expect-error Nested intervals are immutable.
  command.interval.endS = 10
  // @ts-expect-error Nested inputs are immutable.
  command.input.kind = 'energy'
  // @ts-expect-error Schedule command arrays are immutable.
  schedule.commands.push(command)
  // @ts-expect-error Plan slices are immutable.
  plan.slices.push(plan.slices[0])
  // @ts-expect-error Slice request arrays are immutable.
  plan.slices[0].requests.length = 0
  // @ts-expect-error A compiled schedule cannot be constructed as a plain definition.
  const forged: InterventionSchedule = { schemaVersion: 1, id: 'forged', commands: [] }
  void forged
}
void readonlyContract

function ignition() {
  return {
    kind: 'ignition' as const,
    id: 'heater', sequence: 0, interval: { startS: 0, endS: 2 },
    sourceId: 'source-1',
    location: { kind: 'point' as const, frameId: 'domain-1', xM: 1, yM: 2, depthM: 1 },
    input: { kind: 'power' as const, powerW: 10, energyLimitJ: 20 },
  }
}

describe('intervention type and immutability contracts', () => {
  it('publishes the complete immutable six-kind ordering', () => {
    deepStrictEqual(COMMAND_KIND_ORDER, {
      cancel: 0, excavation: 10, 'hose-placement': 20,
      'dry-ice-placement': 30, ignition: 40, 'water-delivery': 50,
    })
    ok(Object.isFrozen(COMMAND_KIND_ORDER))
    strictEqual(Reflect.set(COMMAND_KIND_ORDER, 'cancel', 100), false)
  })

  it('detaches and recursively freezes a command without freezing the input', () => {
    const raw = ignition(), before = structuredClone(raw), command = createCommand(raw)
    deepStrictEqual(raw, before)
    notStrictEqual(command, raw)
    notStrictEqual(command.interval, raw.interval)
    ok(Object.isFrozen(command))
    ok(Object.isFrozen(command.interval))
    if (command.kind !== 'ignition') throw new Error('wrong kind')
    ok(Object.isFrozen(command.input))
    ok(Object.isFrozen(command.location))
    strictEqual(Object.isFrozen(raw), false)
    strictEqual(Object.isFrozen(raw.input), false)
    raw.interval.endS = 99
    raw.input.powerW = 99
    raw.location.xM = 99
    deepStrictEqual(command.interval, { startS: 0, endS: 2 })
    if (command.input.kind !== 'power') throw new Error('wrong input')
    strictEqual(command.input.powerW, 10)
    if (command.location.kind !== 'point') throw new Error('wrong location')
    strictEqual(command.location.xM, 1)
  })

  it('preserves an explicitly signed material energy and its datum without conversion', () => {
    const command = createCommand({
      kind: 'dry-ice-placement', id: 'solid', sequence: 0,
      interval: { startS: 2, endS: 3 }, sourceId: 'source-1', inventoryId: 'stock-1',
      location: ignition().location, massKg: 4,
      thermal: { kind: 'internal-energy', internalEnergyJ: -2_400_000, referenceId: 'declared-datum-v1' },
    })
    if (command.kind !== 'dry-ice-placement') throw new Error('wrong kind')
    deepStrictEqual(command.thermal, {
      kind: 'internal-energy', internalEnergyJ: -2_400_000, referenceId: 'declared-datum-v1',
    })
    ok(Object.isFrozen(command.thermal))
    strictEqual(command.massKg, 4)
    strictEqual(Object.hasOwn(command, 'appliedMassKg'), false)
  })

  it('keeps temperature-only placement energy unspecified', () => {
    const command = createCommand({
      kind: 'dry-ice-placement', id: 'solid', sequence: 0,
      interval: { startS: 2, endS: 3 }, sourceId: 'source-1', inventoryId: 'stock-1',
      location: ignition().location, massKg: 4,
      thermal: { kind: 'temperature', temperatureK: 194.65 },
    })
    if (command.kind !== 'dry-ice-placement') throw new Error('wrong kind')
    deepStrictEqual(command.thermal, { kind: 'temperature', temperatureK: 194.65 })
    strictEqual(Object.hasOwn(command.thermal, 'internalEnergyJ'), false)
  })

  it('does not infer water pressure, reservoir balance, or delivery from a declaration', () => {
    const command = createCommand({
      kind: 'water-delivery', id: 'water', sequence: 0,
      interval: { startS: 2, endS: 3 },
      hoseId: 'hose-1', placementCommandId: 'place-hose', reservoirId: 'tank-1',
      massFlowKgS: 0.22, massLimitKg: 5, inletTemperatureK: 293.15, supplyPressurePa: null,
    })
    if (command.kind !== 'water-delivery') throw new Error('wrong kind')
    strictEqual(command.supplyPressurePa, null)
    strictEqual(command.massLimitKg, 5)
    for (const key of ['appliedMassKg', 'remainingKg', 'infiltrationKg', 'success']) {
      strictEqual(Object.hasOwn(command, key), false)
    }
  })

  it('freezes every level of returned plans, including request lists', () => {
    const raw = ignition()
    const schedule = createSchedule({ schemaVersion: 1, id: 'run-1', commands: [raw] })
    const plan = clipScheduleToStep(schedule, { startS: 0, endS: 1 })
    for (const value of [
      schedule, schedule.commands, schedule.commands[0],
      plan, plan.interval, plan.slices, plan.slices[0],
      plan.slices[0].interval, plan.slices[0].requests, plan.slices[0].requests[0],
    ]) ok(Object.isFrozen(value))
    strictEqual(Reflect.set(plan.slices[0].requests, 'length', 0), false)
    throws(() => Object.defineProperty(schedule.commands[0], 'id', { value: 'oops' }))
    strictEqual(clipScheduleToStep(schedule, { startS: 0, endS: 1 }).slices[0].requests.length, 1)
  })

  it('accepts pinned geometry references without resolving or mutating geometry', () => {
    const location = {
      kind: 'geometry-reference', geometryId: 'domain-1', revisionId: 'mesh-4', featureId: 'bore-bottom',
    } as const
    const command = createCommand({
      kind: 'excavation', id: 'dig', sequence: 0,
      interval: { startS: 1, endS: 3 }, operationId: 'operation-1', location,
    })
    if (command.kind !== 'excavation') throw new Error('wrong kind')
    deepStrictEqual(command.location, location)
    notStrictEqual(command.location, location)
    ok(Object.isFrozen(command.location))
    strictEqual(Object.hasOwn(command, 'removedSoilKg'), false)
  })

  it('makes all command variants data-only and JSON-compatible', () => {
    const h = ignition()
    const commands: InterventionCommand[] = [
      h,
      { kind: 'cancel', id: 'stop', sequence: 0, interval: { startS: 1, endS: 2 }, targetCommandId: h.id },
      { kind: 'hose-placement', id: 'hose', sequence: 0, interval: { startS: 0, endS: 1 },
        hoseId: 'hose-1', location: h.location },
      { kind: 'water-delivery', id: 'water', sequence: 0, interval: { startS: 0, endS: 2 },
        hoseId: 'hose-1', placementCommandId: 'hose', reservoirId: 'tank-1',
        massFlowKgS: 0, massLimitKg: 0, inletTemperatureK: 293.15, supplyPressurePa: null },
      { kind: 'dry-ice-placement', id: 'solid', sequence: 0, interval: { startS: 2, endS: 3 },
        sourceId: 'source-1', inventoryId: 'stock-1', location: h.location, massKg: 4,
        thermal: { kind: 'temperature', temperatureK: 194.65 } },
      { kind: 'excavation', id: 'dig', sequence: 0, interval: { startS: 3, endS: 4 },
        operationId: 'operation-1',
        location: { kind: 'geometry-reference', geometryId: 'domain-1', revisionId: 'v1', featureId: 'bore' } },
    ]
    const schedule = createSchedule({ schemaVersion: 1, id: 'run-1', commands })
    deepStrictEqual(JSON.parse(JSON.stringify(schedule.commands)), schedule.commands)
    strictEqual(new Set(schedule.commands.map(command => command.kind)).size, 6)
  })
})
