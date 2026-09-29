import {
  COMMAND_KIND_ORDER,
  INTERVENTION_SCHEMA_VERSION,
  type CommandKind,
  type GeometryLocation,
  type IgnitionInput,
  type InterventionCommand,
  type InterventionLocation,
  type InterventionSchedule,
  type ScheduledRequest,
  type StartCommand,
  type StepPlan,
  type StepSlice,
  type ThermalSpecification,
  type TimeInterval,
} from './types'

export class ScheduleValidationError extends Error {
  constructor(readonly path: string, detail: string) {
    super(`${path}: ${detail}`)
    this.name = 'ScheduleValidationError'
  }
}

function fail(path: string, detail: string): never {
  throw new ScheduleValidationError(path, detail)
}

type DataObject = Record<string, unknown>

function object(value: unknown, path: string): DataObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected a plain data object')
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'expected a plain data object')
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return fail(path, 'symbol keys are unsupported')
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (!('value' in descriptor)) return fail(`${path}.${key}`, 'accessors are unsupported')
  }
  return value as DataObject
}

function exactKeys(value: DataObject, keys: readonly string[], path: string): void {
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field')
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'required field is missing')
  }
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return fail(path, 'expected a dense data array')
  }
  // Also reject extra properties and array accessors instead of silently dropping them.
  if (Reflect.ownKeys(value).length !== value.length + 1) {
    return fail(path, 'sparse arrays and extra array properties are unsupported')
  }
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i))
    if (!descriptor || !('value' in descriptor)) {
      return fail(`${path}[${i}]`, 'expected an own data element')
    }
  }
  return value as readonly unknown[]
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, 'expected a finite number')
  }
  return value === 0 ? 0 : value // Canonicalize negative zero before IDs/serialization.
}

function derivedFinite(value: number, positiveExpected: boolean, path: string): void {
  finite(value, path)
  if (positiveExpected && value === 0) {
    fail(path, 'positive derived quantity underflows to zero')
  }
}

function nonnegative(value: unknown, path: string): number {
  const result = finite(value, path)
  if (result < 0) return fail(path, 'expected a nonnegative number')
  return result
}

function positive(value: unknown, path: string): number {
  const result = finite(value, path)
  if (result <= 0) return fail(path, 'expected a positive number')
  return result
}

function identifier(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    return fail(path, 'expected 1-128 ASCII identifier characters, starting with a letter or digit')
  }
  return value
}

function sequence(value: unknown, path: string): number {
  const result = nonnegative(value, path)
  if (!Number.isSafeInteger(result)) return fail(path, 'expected a safe integer')
  return result
}

function interval(value: unknown, path: string, allowEmpty: boolean): TimeInterval {
  const data = object(value, path)
  exactKeys(data, ['startS', 'endS'], path)
  const startS = nonnegative(data.startS, `${path}.startS`)
  const endS = nonnegative(data.endS, `${path}.endS`)
  if (endS < startS || (!allowEmpty && endS === startS)) {
    return fail(path, allowEmpty ? 'endS must be >= startS' : 'endS must be > startS')
  }
  return Object.freeze({ startS, endS })
}

function location(value: unknown, path: string): InterventionLocation {
  const data = object(value, path)
  if (data.kind === 'point') {
    exactKeys(data, ['kind', 'frameId', 'xM', 'yM', 'depthM'], path)
    return Object.freeze({
      kind: 'point',
      frameId: identifier(data.frameId, `${path}.frameId`),
      xM: finite(data.xM, `${path}.xM`),
      yM: finite(data.yM, `${path}.yM`),
      depthM: nonnegative(data.depthM, `${path}.depthM`),
    })
  }
  if (data.kind === 'geometry-reference') {
    exactKeys(data, ['kind', 'geometryId', 'revisionId', 'featureId'], path)
    return Object.freeze({
      kind: 'geometry-reference',
      geometryId: identifier(data.geometryId, `${path}.geometryId`),
      revisionId: identifier(data.revisionId, `${path}.revisionId`),
      featureId: identifier(data.featureId, `${path}.featureId`),
    })
  }
  return fail(`${path}.kind`, 'unsupported location kind')
}

function geometryLocation(value: unknown, path: string): GeometryLocation {
  const result = location(value, path)
  if (result.kind !== 'geometry-reference') return fail(path, 'excavation requires a geometry reference')
  return result
}

function thermal(value: unknown, path: string): ThermalSpecification {
  const data = object(value, path)
  if (data.kind === 'temperature') {
    exactKeys(data, ['kind', 'temperatureK'], path)
    return Object.freeze({
      kind: 'temperature',
      temperatureK: positive(data.temperatureK, `${path}.temperatureK`),
    })
  }
  if (data.kind === 'internal-energy') {
    exactKeys(data, ['kind', 'internalEnergyJ', 'referenceId'], path)
    return Object.freeze({
      kind: 'internal-energy',
      internalEnergyJ: finite(data.internalEnergyJ, `${path}.internalEnergyJ`),
      referenceId: identifier(data.referenceId, `${path}.referenceId`),
    })
  }
  return fail(`${path}.kind`, 'unsupported thermal specification')
}

function ignitionInput(value: unknown, time: TimeInterval, path: string): IgnitionInput {
  const data = object(value, path)
  if (data.kind === 'power') {
    exactKeys(data, ['kind', 'powerW', 'energyLimitJ'], path)
    const powerW = nonnegative(data.powerW, `${path}.powerW`)
    const energyLimitJ = nonnegative(data.energyLimitJ, `${path}.energyLimitJ`)
    const durationS = time.endS - time.startS
    derivedFinite(powerW * durationS, powerW > 0 && durationS > 0, `${path}.uncappedEnergyJ`)
    return Object.freeze({ kind: 'power', powerW, energyLimitJ })
  }
  if (data.kind === 'energy') {
    exactKeys(data, ['kind', 'energyJ'], path)
    const energyJ = nonnegative(data.energyJ, `${path}.energyJ`)
    if (time.startS === time.endS && energyJ > 0) {
      return fail(path, 'nonzero energy cannot be assigned to an empty interval')
    }
    if (time.endS > time.startS) {
      derivedFinite(energyJ / (time.endS - time.startS), energyJ > 0, `${path}.impliedPowerW`)
    }
    return Object.freeze({ kind: 'energy', energyJ })
  }
  return fail(`${path}.kind`, 'unsupported ignition input kind')
}

const BASE_KEYS = ['kind', 'id', 'sequence', 'interval'] as const
const EXTRA_KEYS: Readonly<Record<CommandKind, readonly string[]>> = Object.freeze({
  ignition: ['sourceId', 'location', 'input'],
  'dry-ice-placement': ['sourceId', 'inventoryId', 'location', 'massKg', 'thermal'],
  'hose-placement': ['hoseId', 'location'],
  'water-delivery': [
    'hoseId', 'placementCommandId', 'reservoirId', 'massFlowKgS',
    'massLimitKg', 'inletTemperatureK', 'supplyPressurePa',
  ],
  excavation: ['operationId', 'location'],
  cancel: ['targetCommandId'],
})

/** Validation and detached, recursively frozen construction; no caller object is frozen. */
export function createCommand(raw: unknown): InterventionCommand {
  const path = 'command', data = object(raw, path)
  if (typeof data.kind !== 'string' || !Object.hasOwn(EXTRA_KEYS, data.kind)) {
    return fail(`${path}.kind`, 'unsupported command kind')
  }
  const kind = data.kind as CommandKind
  exactKeys(data, [...BASE_KEYS, ...EXTRA_KEYS[kind]], path)
  const id = identifier(data.id, `${path}.id`)
  const order = sequence(data.sequence, `${path}.sequence`)
  const time = interval(data.interval, `${path}.interval`,
    kind === 'ignition' || kind === 'water-delivery' || kind === 'excavation')
  const base = { id, sequence: order, interval: time }
  switch (kind) {
    case 'ignition':
      return Object.freeze({
        kind, ...base,
        sourceId: identifier(data.sourceId, `${path}.sourceId`),
        location: location(data.location, `${path}.location`),
        input: ignitionInput(data.input, time, `${path}.input`),
      })
    case 'dry-ice-placement':
      return Object.freeze({
        kind, ...base,
        sourceId: identifier(data.sourceId, `${path}.sourceId`),
        inventoryId: identifier(data.inventoryId, `${path}.inventoryId`),
        location: location(data.location, `${path}.location`),
        massKg: positive(data.massKg, `${path}.massKg`),
        thermal: thermal(data.thermal, `${path}.thermal`),
      })
    case 'hose-placement':
      return Object.freeze({
        kind, ...base,
        hoseId: identifier(data.hoseId, `${path}.hoseId`),
        location: location(data.location, `${path}.location`),
      })
    case 'water-delivery': {
      const massFlowKgS = nonnegative(data.massFlowKgS, `${path}.massFlowKgS`)
      const durationS = time.endS - time.startS
      derivedFinite(massFlowKgS * durationS, massFlowKgS > 0 && durationS > 0, `${path}.uncappedMassKg`)
      return Object.freeze({
        kind, ...base,
        hoseId: identifier(data.hoseId, `${path}.hoseId`),
        placementCommandId: identifier(data.placementCommandId, `${path}.placementCommandId`),
        reservoirId: identifier(data.reservoirId, `${path}.reservoirId`),
        massFlowKgS,
        massLimitKg: nonnegative(data.massLimitKg, `${path}.massLimitKg`),
        inletTemperatureK: positive(data.inletTemperatureK, `${path}.inletTemperatureK`),
        supplyPressurePa: data.supplyPressurePa === null
          ? null : positive(data.supplyPressurePa, `${path}.supplyPressurePa`),
      })
    }
    case 'excavation':
      return Object.freeze({
        kind, ...base,
        operationId: identifier(data.operationId, `${path}.operationId`),
        location: geometryLocation(data.location, `${path}.location`),
      })
    case 'cancel':
      return Object.freeze({
        kind, ...base,
        targetCommandId: identifier(data.targetCommandId, `${path}.targetCommandId`),
      })
  }
}

function lexical(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareAtSameTime(a: InterventionCommand, b: InterventionCommand): number {
  return COMMAND_KIND_ORDER[a.kind] - COMMAND_KIND_ORDER[b.kind]
    || a.sequence - b.sequence || lexical(a.id, b.id)
}

/** Only use with validated commands. No locale, RNG, wall clock, or insertion order. */
export function compareCommands(a: InterventionCommand, b: InterventionCommand): number {
  return a.interval.startS - b.interval.startS || compareAtSameTime(a, b)
}

function isStartCommand(command: InterventionCommand): command is StartCommand {
  return command.kind === 'cancel' || command.kind === 'hose-placement'
    || command.kind === 'dry-ice-placement'
}

interface CompiledSchedule {
  readonly cancellationAt: ReadonlyMap<string, number>
  readonly boundaries: readonly number[]
}

// Derived indices only. Never a delivery ledger or an execution cursor.
const compiledSchedules = new WeakMap<InterventionSchedule, CompiledSchedule>()

function effectiveEnd(command: InterventionCommand, cancellationAt: ReadonlyMap<string, number>): number {
  return Math.min(command.interval.endS, cancellationAt.get(command.id) ?? command.interval.endS)
}

function suppressedStart(command: InterventionCommand, cancellationAt: ReadonlyMap<string, number>): boolean {
  const at = cancellationAt.get(command.id)
  return at !== undefined && at <= command.interval.startS
}

function validateLinks(commands: readonly InterventionCommand[]): Map<string, number> {
  const byId = new Map<string, InterventionCommand>()
  const hoseIds = new Set<string>()
  for (const command of commands) {
    if (byId.has(command.id)) fail(`command.${command.id}`, 'duplicate command ID')
    byId.set(command.id, command)
    if (command.kind === 'hose-placement') {
      if (hoseIds.has(command.hoseId)) {
        fail(`command.${command.id}.hoseId`, 'only one placement per hose ID is supported')
      }
      hoseIds.add(command.hoseId)
    }
  }
  const cancellationAt = new Map<string, number>()
  for (const command of commands) {
    if (command.kind === 'cancel') {
      const target = byId.get(command.targetCommandId)
      if (!target) fail(`command.${command.id}.targetCommandId`, 'unknown target')
      if (target.kind === 'cancel') {
        fail(`command.${command.id}.targetCommandId`, 'cancelling a cancellation is unsupported')
      }
      const previous = cancellationAt.get(target.id)
      cancellationAt.set(target.id, previous === undefined
        ? command.interval.startS : Math.min(previous, command.interval.startS))
    }
    if (command.kind === 'water-delivery') {
      const placement = byId.get(command.placementCommandId)
      if (!placement || placement.kind !== 'hose-placement') {
        fail(`command.${command.id}.placementCommandId`, 'requires a hose-placement command')
      }
      if (placement.hoseId !== command.hoseId) {
        fail(`command.${command.id}.hoseId`, 'does not match its placement command')
      }
      if (command.interval.startS < placement.interval.startS) {
        fail(`command.${command.id}.interval`, 'water cannot start before its placement request')
      }
      // This link is NOT an applied-placement receipt. Task 4 must gate actual delivery.
    }
  }
  return cancellationAt
}

function validateExclusiveWindows(
  commands: readonly InterventionCommand[],
  cancellationAt: ReadonlyMap<string, number>,
): void {
  const groups = new Map<string, InterventionCommand[]>()
  for (const command of commands) {
    if (isStartCommand(command) || effectiveEnd(command, cancellationAt) <= command.interval.startS) continue
    const resource = command.kind === 'ignition' ? command.sourceId
      : command.kind === 'water-delivery' ? command.hoseId : command.operationId
    const key = JSON.stringify([command.kind, resource])
    const group = groups.get(key) ?? []
    group.push(command)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    // Caller has already sorted by start time.
    for (let i = 1; i < group.length; i++) {
      if (effectiveEnd(group[i - 1], cancellationAt) > group[i].interval.startS) {
        fail(`command.${group[i].id}.interval`, `overlaps exclusive resource used by ${group[i - 1].id}`)
      }
    }
  }
}

export function createSchedule(raw: unknown): InterventionSchedule {
  const data = object(raw, 'schedule')
  exactKeys(data, ['schemaVersion', 'id', 'commands'], 'schedule')
  if (data.schemaVersion !== INTERVENTION_SCHEMA_VERSION) {
    return fail('schedule.schemaVersion', 'unsupported schedule version')
  }
  const id = identifier(data.id, 'schedule.id')
  const commands = array(data.commands, 'schedule.commands').map(createCommand).sort(compareCommands)
  const cancellationAt = validateLinks(commands)
  validateExclusiveWindows(commands, cancellationAt)
  const cuts = new Set<number>()
  for (const command of commands) {
    if (isStartCommand(command)) {
      if (!suppressedStart(command, cancellationAt)) cuts.add(command.interval.startS)
    } else {
      const endS = effectiveEnd(command, cancellationAt)
      if (endS > command.interval.startS) {
        cuts.add(command.interval.startS)
        cuts.add(endS)
      }
    }
  }
  const schedule = Object.freeze({
    schemaVersion: INTERVENTION_SCHEMA_VERSION,
    id,
    commands: Object.freeze(commands),
  }) as InterventionSchedule
  compiledSchedules.set(schedule, {
    cancellationAt,
    boundaries: Object.freeze([...cuts].sort((a, b) => a - b)),
  })
  return schedule
}

function compiled(schedule: InterventionSchedule): CompiledSchedule {
  const result = compiledSchedules.get(schedule)
  if (!result) return fail('schedule', 'use createSchedule or parseSchedule before querying')
  return result
}

export function serializeSchedule(schedule: InterventionSchedule): string {
  compiled(schedule)
  return JSON.stringify(schedule)
}

export function parseSchedule(text: string): InterventionSchedule {
  if (typeof text !== 'string') return fail('scheduleJSON', 'expected text')
  return createSchedule(JSON.parse(text) as unknown)
}

function requestId(
  schedule: InterventionSchedule,
  command: InterventionCommand,
  dispatch: 'at-start' | 'over-interval',
  startS: number,
  endS?: number,
): string {
  // JSON tuples avoid delimiter collisions. A point ID never includes solver step size.
  const parts: (string | number)[] = [
    'intervention-request', INTERVENTION_SCHEMA_VERSION, schedule.id, command.id, dispatch, startS,
  ]
  if (endS !== undefined) parts.push(endS)
  return JSON.stringify(parts)
}

/**
 * Stateless query over [step.startS, step.endS). Empty steps emit nothing.
 * Each slice covers only one unchanging set of eligible window requests.
 * No request is applied, reserved, acknowledged, or remembered by this function.
 */
export function clipScheduleToStep(schedule: InterventionSchedule, step: TimeInterval): StepPlan {
  const index = compiled(schedule), time = interval(step, 'step', true)
  const cuts = [
    time.startS,
    ...index.boundaries.filter(t => t > time.startS && t < time.endS),
    time.endS,
  ]
  const slices: StepSlice[] = []
  for (let i = 1; i < cuts.length; i++) {
    const startS = cuts[i - 1], endS = cuts[i]
    if (startS === endS) continue
    const span = Object.freeze({ startS, endS })
    const requests: ScheduledRequest[] = []
    for (const command of schedule.commands) {
      if (isStartCommand(command)) {
        if (command.interval.startS === startS && !suppressedStart(command, index.cancellationAt)) {
          requests.push(Object.freeze({
            dispatch: 'at-start',
            requestId: requestId(schedule, command, 'at-start', startS),
            atS: startS,
            command,
          }))
        }
      } else if (command.interval.startS <= startS && effectiveEnd(command, index.cancellationAt) >= endS) {
        requests.push(Object.freeze({
          dispatch: 'over-interval',
          requestId: requestId(schedule, command, 'over-interval', startS, endS),
          interval: span,
          command,
        }))
      }
    }
    requests.sort((a, b) => compareAtSameTime(a.command, b.command))
    slices.push(Object.freeze({ interval: span, requests: Object.freeze(requests) }))
  }
  return Object.freeze({ scheduleId: schedule.id, interval: time, slices: Object.freeze(slices) })
}
