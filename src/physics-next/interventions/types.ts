/**
 * Authoring contract only. No physical state, source law, or delivery inference.
 * All times are physical seconds, never presentation/wall-clock seconds.
 */
export const INTERVENTION_SCHEMA_VERSION = 1 as const

/** Closed-open [startS, endS), measured in physical seconds. */
export interface TimeInterval {
  readonly startS: number
  readonly endS: number
}

export interface PointLocation {
  readonly kind: 'point'
  readonly frameId: string
  readonly xM: number
  readonly yM: number
  readonly depthM: number
}

export interface GeometryLocation {
  readonly kind: 'geometry-reference'
  readonly geometryId: string
  readonly revisionId: string
  readonly featureId: string
}

export type InterventionLocation = PointLocation | GeometryLocation

/**
 * Temperature does NOT imply a known imported energy.
 * An explicitly supplied internal energy is signed relative to referenceId.
 * The placement direction is still into the domain; this is not heater work.
 */
export type ThermalSpecification =
  | { readonly kind: 'temperature'; readonly temperatureK: number }
  | {
      readonly kind: 'internal-energy'
      readonly internalEnergyJ: number
      readonly referenceId: string
    }

export type IgnitionInput =
  | {
      readonly kind: 'power'
      readonly powerW: number
      readonly energyLimitJ: number
    }
  | {
      /** Uniform requested energy over the declared nonempty interval. */
      readonly kind: 'energy'
      readonly energyJ: number
    }

interface CommandBase {
  /** Caller-supplied, stable, case-sensitive ASCII identifier. */
  readonly id: string
  /** Explicit tie-break, not the input array position. */
  readonly sequence: number
  readonly interval: TimeInterval
}

export interface IgnitionCommand extends CommandBase {
  readonly kind: 'ignition'
  readonly sourceId: string
  readonly location: InterventionLocation
  readonly input: IgnitionInput
}

export interface DryIcePlacementCommand extends CommandBase {
  readonly kind: 'dry-ice-placement'
  readonly sourceId: string
  readonly inventoryId: string
  readonly location: InterventionLocation
  readonly massKg: number
  readonly thermal: ThermalSpecification
}

export interface HosePlacementCommand extends CommandBase {
  readonly kind: 'hose-placement'
  readonly hoseId: string
  readonly location: InterventionLocation
}

export interface WaterDeliveryCommand extends CommandBase {
  readonly kind: 'water-delivery'
  readonly hoseId: string
  readonly placementCommandId: string
  readonly reservoirId: string
  readonly massFlowKgS: number
  readonly massLimitKg: number
  readonly inletTemperatureK: number
  /** Absolute pressure metadata only; null means unknown, not zero pressure. */
  readonly supplyPressurePa: number | null
}

export interface ExcavationCommand extends CommandBase {
  readonly kind: 'excavation'
  /** An external geometry-operation reference, not a mesh mutation. */
  readonly operationId: string
  readonly location: GeometryLocation
}

export interface CancelCommand extends CommandBase {
  readonly kind: 'cancel'
  readonly targetCommandId: string
}

export type StartCommand =
  | CancelCommand
  | HosePlacementCommand
  | DryIcePlacementCommand

export type WindowCommand =
  | IgnitionCommand
  | WaterDeliveryCommand
  | ExcavationCommand

export type InterventionCommand = StartCommand | WindowCommand
export type CommandKind = InterventionCommand['kind']

export const COMMAND_KIND_ORDER: Readonly<Record<CommandKind, number>> =
  Object.freeze({
    cancel: 0,
    excavation: 10,
    'hose-placement': 20,
    'dry-ice-placement': 30,
    ignition: 40,
    'water-delivery': 50,
  })

export interface ScheduleDefinition {
  readonly schemaVersion: typeof INTERVENTION_SCHEMA_VERSION
  readonly id: string
  readonly commands: readonly InterventionCommand[]
}

/** Compile with createSchedule/parseSchedule; the brand is not serialized. */
declare const scheduleBrand: unique symbol
export type InterventionSchedule = ScheduleDefinition & {
  readonly [scheduleBrand]: true
}

export interface StartRequest {
  readonly dispatch: 'at-start'
  readonly requestId: string
  readonly atS: number
  readonly command: StartCommand
}

export interface WindowRequest {
  readonly dispatch: 'over-interval'
  readonly requestId: string
  readonly interval: TimeInterval
  readonly command: WindowCommand
}

export type ScheduledRequest = StartRequest | WindowRequest

export interface StepSlice {
  readonly interval: TimeInterval
  /**
   * Canonical staging order. All window requests share this time interval.
   * Ordering is not evidence of excavation completion or successful placement.
   */
  readonly requests: readonly ScheduledRequest[]
}

export interface StepPlan {
  readonly scheduleId: string
  readonly interval: TimeInterval
  readonly slices: readonly StepSlice[]
}
