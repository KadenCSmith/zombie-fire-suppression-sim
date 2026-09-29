/**
 * Agent F / task 1. Pure unit boundaries; no material defaults or solver imports.
 * Quantity kinds preserve semantics in addition to SI dimension exponents.
 * A successful conversion is not evidence, applicability approval, or validation.
 */
export const UNIT_CATALOG_VERSION = 1 as const

/** Exponents in the fixed order [kg, m, s, A, K, mol, cd]. */
export type DimensionTag = readonly [
  mass: number, length: number, time: number, current: number,
  temperature: number, amount: number, luminousIntensity: number,
]
const tag = (...powers: DimensionTag): DimensionTag => Object.freeze(powers)

export const DIMENSIONS = Object.freeze({
  dimensionless: tag(0, 0, 0, 0, 0, 0, 0),
  length: tag(0, 1, 0, 0, 0, 0, 0),
  area: tag(0, 2, 0, 0, 0, 0, 0),
  volume: tag(0, 3, 0, 0, 0, 0, 0),
  mass: tag(1, 0, 0, 0, 0, 0, 0),
  time: tag(0, 0, 1, 0, 0, 0, 0),
  amount: tag(0, 0, 0, 0, 0, 1, 0),
  absoluteTemperature: tag(0, 0, 0, 0, 1, 0, 0),
  temperatureDifference: tag(0, 0, 0, 0, 1, 0, 0),
  pressure: tag(1, -1, -2, 0, 0, 0, 0),
  density: tag(1, -3, 0, 0, 0, 0, 0),
  velocity: tag(0, 1, -1, 0, 0, 0, 0),
  acceleration: tag(0, 1, -2, 0, 0, 0, 0),
  diffusivity: tag(0, 2, -1, 0, 0, 0, 0),
  dynamicViscosity: tag(1, -1, -1, 0, 0, 0, 0),
  energy: tag(1, 2, -2, 0, 0, 0, 0),
  power: tag(1, 2, -3, 0, 0, 0, 0),
  volumetricPower: tag(1, -1, -3, 0, 0, 0, 0),
  specificEnergy: tag(0, 2, -2, 0, 0, 0, 0),
  molarEnergy: tag(1, 2, -2, 0, 0, -1, 0),
  specificHeatCapacity: tag(0, 2, -2, 0, -1, 0, 0),
  molarHeatCapacity: tag(1, 2, -2, 0, -1, -1, 0),
  volumetricHeatCapacity: tag(1, -1, -2, 0, -1, 0, 0),
  thermalConductivity: tag(1, 1, -3, 0, -1, 0, 0),
  heatTransferCoefficient: tag(1, 0, -3, 0, -1, 0, 0),
  force: tag(1, 1, -2, 0, 0, 0, 0),
  fractureEnergy: tag(1, 0, -2, 0, 0, 0, 0),
  molarMass: tag(1, 0, 0, 0, 0, -1, 0),
  rate: tag(0, 0, -1, 0, 0, 0, 0),
  angle: tag(0, 0, 0, 0, 0, 0, 0),
  massFlux: tag(1, -2, -1, 0, 0, 0, 0),
})
export type Dimension = keyof typeof DIMENSIONS

/** Same dimensions do not authorize changing the kind or its reporting basis. */
export const KIND_DIMENSIONS = Object.freeze({
  dimensionless: 'dimensionless',
  dryMassMoisture: 'dimensionless',
  poreSaturation: 'dimensionless',
  porosity: 'dimensionless',
  bulkWaterVolumeFraction: 'dimensionless',
  moleFraction: 'dimensionless',
  organicDryMassFraction: 'dimensionless',
  mineralDryMassFraction: 'dimensionless',
  length: 'length', area: 'area', intrinsicPermeability: 'area',
  volume: 'volume', mass: 'mass', time: 'time', amount: 'amount',
  absoluteTemperature: 'absoluteTemperature',
  temperatureDifference: 'temperatureDifference',
  absolutePressure: 'pressure', pressureDifference: 'pressure', stress: 'pressure',
  bulkDensity: 'density', particleDensity: 'density', fluidDensity: 'density',
  velocity: 'velocity', hydraulicConductivity: 'velocity',
  acceleration: 'acceleration',
  gasDiffusivity: 'diffusivity', thermalDiffusivity: 'diffusivity',
  dynamicViscosity: 'dynamicViscosity', energy: 'energy', power: 'power',
  volumetricPower: 'volumetricPower', specificEnergy: 'specificEnergy',
  molarEnergy: 'molarEnergy', specificHeatCapacity: 'specificHeatCapacity',
  molarHeatCapacity: 'molarHeatCapacity',
  volumetricHeatCapacity: 'volumetricHeatCapacity',
  thermalConductivity: 'thermalConductivity',
  heatTransferCoefficient: 'heatTransferCoefficient',
  force: 'force', fractureEnergy: 'fractureEnergy', molarMass: 'molarMass',
  rate: 'rate', angle: 'angle', massFlux: 'massFlux',
} as const satisfies Record<string, Dimension>)
export type QuantityKind = keyof typeof KIND_DIMENSIONS
export type DimensionFor<K extends QuantityKind> = (typeof KIND_DIMENSIONS)[K]

function unit<D extends Dimension>(
  dimension: D, scaleToSI: number, offsetToSI = 0, exactDefinition = true,
) {
  return Object.freeze({ dimension, scaleToSI, offsetToSI, exactDefinition })
}

/**
 * Exact, case-sensitive IDs; no inferred aliases, prefixes or compound parser.
 * delta_K is an interval measured in kelvin, not an absolute temperature.
 * cal_th explicitly selects the thermochemical calorie used by the baseline.
 * exactDefinition describes the conversion definition, not binary64 arithmetic.
 */
export const UNITS = Object.freeze({
  '1': unit('dimensionless', 1), '%': unit('dimensionless', 0.01),
  m: unit('length', 1), cm: unit('length', 0.01), mm: unit('length', 0.001),
  ft: unit('length', 0.3048),
  m2: unit('area', 1), cm2: unit('area', 1e-4), mm2: unit('area', 1e-6),
  m3: unit('volume', 1), cm3: unit('volume', 1e-6), L: unit('volume', 1e-3),
  kg: unit('mass', 1), g: unit('mass', 1e-3),
  s: unit('time', 1), min: unit('time', 60), h: unit('time', 3600),
  d: unit('time', 86400),
  mol: unit('amount', 1),
  K: unit('absoluteTemperature', 1),
  degC: unit('absoluteTemperature', 1, 273.15),
  delta_K: unit('temperatureDifference', 1),
  delta_degC: unit('temperatureDifference', 1),
  Pa: unit('pressure', 1), kPa: unit('pressure', 1e3),
  MPa: unit('pressure', 1e6), bar: unit('pressure', 1e5),
  'kg/m3': unit('density', 1), 'g/cm3': unit('density', 1e3),
  'm/s': unit('velocity', 1), 'cm/s': unit('velocity', 0.01),
  'mm/s': unit('velocity', 0.001),
  'm/s2': unit('acceleration', 1),
  'm2/s': unit('diffusivity', 1), 'cm2/s': unit('diffusivity', 1e-4),
  'Pa*s': unit('dynamicViscosity', 1), 'mPa*s': unit('dynamicViscosity', 1e-3),
  J: unit('energy', 1), kJ: unit('energy', 1e3),
  W: unit('power', 1), kW: unit('power', 1e3),
  'W/m3': unit('volumetricPower', 1),
  'J/kg': unit('specificEnergy', 1), 'kJ/kg': unit('specificEnergy', 1e3),
  'J/mol': unit('molarEnergy', 1), 'kJ/mol': unit('molarEnergy', 1e3),
  'cal_th/mol': unit('molarEnergy', 4.184),
  'J/(kg*K)': unit('specificHeatCapacity', 1),
  'kJ/(kg*K)': unit('specificHeatCapacity', 1e3),
  'J/(mol*K)': unit('molarHeatCapacity', 1),
  'J/(m3*K)': unit('volumetricHeatCapacity', 1),
  'MJ/(m3*K)': unit('volumetricHeatCapacity', 1e6),
  'W/(m*K)': unit('thermalConductivity', 1),
  'W/(m2*K)': unit('heatTransferCoefficient', 1),
  N: unit('force', 1), kN: unit('force', 1e3),
  'J/m2': unit('fractureEnergy', 1),
  'kg/mol': unit('molarMass', 1), 'g/mol': unit('molarMass', 1e-3),
  '1/s': unit('rate', 1),
  rad: unit('angle', 1), deg: unit('angle', Math.PI / 180, 0, false),
  'kg/(m2*s)': unit('massFlux', 1), 'g/(m2*s)': unit('massFlux', 1e-3),
})
export type UnitId = keyof typeof UNITS
export type UnitFor<K extends QuantityKind> = {
  [U in UnitId]: (typeof UNITS)[U]['dimension'] extends DimensionFor<K> ? U : never
}[UnitId]

export const SI_UNITS = Object.freeze({
  dimensionless: '1', length: 'm', area: 'm2', volume: 'm3',
  mass: 'kg', time: 's', amount: 'mol',
  absoluteTemperature: 'K', temperatureDifference: 'delta_K',
  pressure: 'Pa', density: 'kg/m3', velocity: 'm/s', acceleration: 'm/s2',
  diffusivity: 'm2/s', dynamicViscosity: 'Pa*s',
  energy: 'J', power: 'W', volumetricPower: 'W/m3',
  specificEnergy: 'J/kg', molarEnergy: 'J/mol',
  specificHeatCapacity: 'J/(kg*K)', molarHeatCapacity: 'J/(mol*K)',
  volumetricHeatCapacity: 'J/(m3*K)', thermalConductivity: 'W/(m*K)',
  heatTransferCoefficient: 'W/(m2*K)', force: 'N',
  fractureEnergy: 'J/m2', molarMass: 'kg/mol', rate: '1/s',
  angle: 'rad', massFlux: 'kg/(m2*s)',
} as const satisfies Record<Dimension, UnitId>)

export type UnitErrorCode =
  | 'UNKNOWN_KIND' | 'UNKNOWN_UNIT' | 'INCOMPATIBLE_UNIT'
  | 'NONFINITE_VALUE' | 'OVERFLOW' | 'UNDERFLOW'
  | 'NEGATIVE_ABSOLUTE' | 'INVALID_REPORT'

export class UnitError extends Error {
  constructor(readonly code: UnitErrorCode, message: string) {
    super(message)
    this.name = 'UnitError'
  }
}

declare const siBrand: unique symbol
/** Type-only brand; no symbol or hidden value is written into serialized records. */
export type SIValue<K extends QuantityKind> = number & { readonly [siBrand]: K }
export type AffineTransform = Readonly<{
  formula: 'output = input * scale + offset'
  scale: number
  offset: number
  exactDefinition: boolean
}>
export interface UnitConversion<K extends QuantityKind> {
  readonly catalogVersion: typeof UNIT_CATALOG_VERSION
  readonly arithmetic: 'IEEE-754 binary64'
  readonly kind: K
  readonly dimension: DimensionFor<K>
  readonly dimensionTag: DimensionTag
  readonly fromUnit: UnitFor<K>
  readonly toUnit: UnitFor<K>
  readonly valueIn: number
  readonly valueSI: SIValue<K>
  readonly valueOut: number
  /** Both transforms start at valueIn; they are not successive operations. */
  readonly toSI: AffineTransform
  readonly toTarget: AffineTransform
}

function dimensionOf<K extends QuantityKind>(kind: K): DimensionFor<K> {
  if (typeof kind !== 'string' || !Object.hasOwn(KIND_DIMENSIONS, kind))
    throw new UnitError('UNKNOWN_KIND', 'An explicit registered quantity kind is required.')
  return KIND_DIMENSIONS[kind]
}
function definition(id: UnitId) {
  if (typeof id !== 'string' || !Object.hasOwn(UNITS, id))
    throw new UnitError('UNKNOWN_UNIT', `Unknown unit ID: ${typeof id === 'string' ? id : '(non-string)'}.`)
  return UNITS[id]
}
function compatibleUnit<K extends QuantityKind>(
  dimension: DimensionFor<K>, id: UnitId,
): UnitFor<K> {
  if (definition(id).dimension !== dimension)
    throw new UnitError('INCOMPATIBLE_UNIT', `Unit does not match dimension ${dimension}.`)
  // Narrow only after the runtime catalog check; callers cannot supply arbitrary units.
  return id as UnitFor<K>
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new UnitError('NONFINITE_VALUE', 'A finite number is required; no coercion or default is allowed.')
  return value === 0 ? 0 : value
}
function transform(scale: number, offset: number, exactDefinition: boolean): AffineTransform {
  return Object.freeze({
    formula: 'output = input * scale + offset' as const,
    scale, offset: offset === 0 ? 0 : offset, exactDefinition,
  })
}
function evaluate(value: number, operation: AffineTransform): number {
  const scaled = value * operation.scale
  if (!Number.isFinite(scaled))
    throw new UnitError('OVERFLOW', 'Unit scaling exceeds finite binary64 storage.')
  if (value !== 0 && scaled === 0)
    throw new UnitError('UNDERFLOW', 'Unit scaling would erase a nonzero value.')
  const result = scaled + operation.offset
  if (!Number.isFinite(result))
    throw new UnitError('OVERFLOW', 'Unit offset exceeds finite binary64 storage.')
  return result === 0 ? 0 : result
}

/** Pure scalar boundary operation. It cannot change kind, basis, or provenance. */
export function convertValue<K extends QuantityKind>(
  kind: K, value: number,
  fromUnit: UnitFor<NoInfer<K>>, toUnit: UnitFor<NoInfer<K>>,
): UnitConversion<K> {
  const dimension = dimensionOf(kind)
  const from = definition(fromUnit), to = definition(toUnit)
  if (from.dimension !== dimension || to.dimension !== dimension)
    throw new UnitError('INCOMPATIBLE_UNIT', `Units do not match quantity kind ${kind}.`)
  const input = finite(value)
  const toSI = transform(from.scaleToSI, from.offsetToSI, from.exactDefinition)
  const toTarget = transform(
    from.scaleToSI / to.scaleToSI,
    (from.offsetToSI - to.offsetToSI) / to.scaleToSI,
    fromUnit === toUnit || (from.exactDefinition && to.exactDefinition),
  )
  const valueSI = evaluate(input, toSI)
  if ((kind === 'absoluteTemperature' || kind === 'absolutePressure') && valueSI < 0)
    throw new UnitError('NEGATIVE_ABSOLUTE', 'Absolute kelvin temperature and absolute pressure cannot be negative.')
  const valueOut = evaluate(input, toTarget)
  return Object.freeze({
    catalogVersion: UNIT_CATALOG_VERSION, arithmetic: 'IEEE-754 binary64' as const,
    kind, dimension, dimensionTag: DIMENSIONS[dimension],
    fromUnit, toUnit, valueIn: input, valueSI: valueSI as SIValue<K>,
    valueOut, toSI, toTarget,
  })
}

/** Reporting precision is declared metadata, never inferred from a JS number. */
export type ReportingPrecision =
  | Readonly<{ kind: 'unknown' }>
  | Readonly<{ kind: 'significant-figures'; digits: number }>
  | Readonly<{ kind: 'exact'; justification: string }>

export interface ReportedValue<K extends QuantityKind> {
  readonly value: number
  readonly unit: UnitFor<K>
  /** Exact original numeric token, or null when the baseline does not retain it. */
  readonly numericText: string | null
  /** Exact original unit spelling, or null; interpretation is explicitly caller-supplied. */
  readonly unitText: string | null
  readonly precision: ReportingPrecision
  /** Specimen/species denominator or pressure reference description; never guessed. */
  readonly basis: string
}
export interface SIQuantity<K extends QuantityKind> {
  readonly format: 'zfs-material-quantity'
  readonly version: 1
  readonly kind: K
  readonly valueSI: SIValue<K>
  readonly unitSI: (typeof SI_UNITS)[DimensionFor<K>]
  readonly reported: ReportedValue<K>
  readonly conversion: UnitConversion<K>
}

/** Only ordinary own enumerable data properties; never evaluate input getters. */
function objectWithKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new UnitError('INVALID_REPORT', 'Expected a plain reporting object.')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw new UnitError('INVALID_REPORT', 'Reporting objects must not have a custom prototype.')
  const own = Reflect.ownKeys(value)
  if (own.length !== keys.length || own.some(k => typeof k !== 'string' || !keys.includes(k)))
    throw new UnitError('INVALID_REPORT', 'Missing or unexpected reporting fields.')
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
      throw new UnitError('INVALID_REPORT', 'Reporting fields must be own enumerable data properties.')
    result[key] = descriptor.value
  }
  return result
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new UnitError('INVALID_REPORT', `${label} requires nonblank text.`)
  return value
}
function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label)
}
function precisionOf(value: unknown): ReportingPrecision {
  if (!value || typeof value !== 'object')
    throw new UnitError('INVALID_REPORT', 'Precision must explicitly be unknown, significant-figures or exact.')
  const descriptor = Object.getOwnPropertyDescriptor(value, 'kind')
  if (!descriptor || !Object.hasOwn(descriptor, 'value'))
    throw new UnitError('INVALID_REPORT', 'Precision kind must be an own data property.')
  switch (descriptor.value) {
    case 'unknown':
      objectWithKeys(value, ['kind'])
      return Object.freeze({ kind: 'unknown' })
    case 'significant-figures': {
      const p = objectWithKeys(value, ['kind', 'digits'])
      if (typeof p.digits !== 'number' || !Number.isSafeInteger(p.digits) || p.digits < 1)
        throw new UnitError('INVALID_REPORT', 'Reported significant figures must be a positive safe integer.')
      return Object.freeze({ kind: 'significant-figures', digits: p.digits })
    }
    case 'exact': {
      const p = objectWithKeys(value, ['kind', 'justification'])
      return Object.freeze({ kind: 'exact', justification: text(p.justification, 'Exactness justification') })
    }
    default:
      throw new UnitError('INVALID_REPORT', 'Unknown precision kind.')
  }
}
const NUMERIC_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Runtime boundary for an untrusted numeric report, not a parameter/evidence parser.
 * Unknown parameter values belong to schema.ts later; null/NaN never become zero.
 * Only finite binary64 scalars are normalized. No rounding is applied for display.
 */
export function parseReportedQuantity<K extends QuantityKind>(
  kind: K, input: unknown,
): SIQuantity<K> {
  const dimension = dimensionOf(kind)
  const record = objectWithKeys(input, ['value', 'unit', 'numericText', 'unitText', 'precision', 'basis'])
  const value = finite(record.value)
  if (typeof record.unit !== 'string')
    throw new UnitError('UNKNOWN_UNIT', 'An explicit registered unit ID is required.')
  const id = compatibleUnit<K>(dimension, record.unit as UnitId)
  const numericText = nullableText(record.numericText, 'Numeric text')
  if (numericText !== null) {
    const parsed = Number(numericText)
    const mantissa = numericText.split(/[eE]/)[0]
    if (!NUMERIC_TOKEN.test(numericText) || !Number.isFinite(parsed) || parsed !== value
      || (parsed === 0 && /[1-9]/.test(mantissa)))
      throw new UnitError('INVALID_REPORT', 'Original numeric token must match the finite reported value without coercion or underflow.')
  }
  const reported: ReportedValue<K> = Object.freeze({
    value, unit: id, numericText,
    unitText: nullableText(record.unitText, 'Original unit text'),
    precision: precisionOf(record.precision), basis: text(record.basis, 'Reporting basis'),
  })
  const unitSI = SI_UNITS[dimension]
  const conversion = convertValue(kind, value, reported.unit, compatibleUnit<K>(dimension, unitSI))
  return Object.freeze({
    format: 'zfs-material-quantity' as const, version: 1 as const,
    kind, valueSI: conversion.valueSI, unitSI, reported, conversion,
  })
}

/** Statically typed constructor; the same strict runtime checks still apply. */
export function normalizeQuantity<K extends QuantityKind>(
  kind: K, report: ReportedValue<NoInfer<K>>,
): SIQuantity<K> {
  return parseReportedQuantity(kind, report)
}
