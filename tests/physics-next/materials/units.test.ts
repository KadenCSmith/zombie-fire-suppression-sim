import { describe, expect, it } from 'vitest'
import {
  DIMENSIONS, KIND_DIMENSIONS, SI_UNITS, UNITS, UNIT_CATALOG_VERSION,
  UnitError, convertValue, normalizeQuantity, parseReportedQuantity,
} from '../../../src/physics-next/materials/units'
import type {
  QuantityKind, ReportedValue, ReportingPrecision, SIValue, UnitConversion,
  UnitErrorCode, UnitId,
} from '../../../src/physics-next/materials/units'

/** Deliberate type bypass solely to exercise hostile/untyped caller boundaries. */
const rawConvert = convertValue as unknown as (
  kind: unknown, value: unknown, from: unknown, to: unknown,
) => UnitConversion<QuantityKind>
function rejects(action: () => unknown, code: UnitErrorCode) {
  let error: unknown
  try { action() } catch (caught) { error = caught }
  expect(error).toBeInstanceOf(UnitError)
  expect((error as UnitError).code).toBe(code)
}
/** No unit-sized absolute floor: tiny permeability errors must not disappear. */
function close(actual: number, expected: number, relative = 2e-12, absolute = 0) {
  expect(Number.isFinite(actual)).toBe(true)
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    Math.max(absolute, relative * Math.abs(expected)),
  )
}
function densityReport(): ReportedValue<'bulkDensity'> {
  return {
    value: 0.135, unit: 'g/cm3', numericText: '0.135', unitText: 'g/cm³',
    precision: { kind: 'significant-figures', digits: 3 },
    basis: 'Dry specimen mass per bulk specimen volume.',
  }
}

describe('SI dimension tags and catalog invariants', () => {
  it('uses all seven SI exponents with independently stated expectations', () => {
    expect(DIMENSIONS).toEqual({
      dimensionless: [0, 0, 0, 0, 0, 0, 0],
      length: [0, 1, 0, 0, 0, 0, 0], area: [0, 2, 0, 0, 0, 0, 0],
      volume: [0, 3, 0, 0, 0, 0, 0], mass: [1, 0, 0, 0, 0, 0, 0],
      time: [0, 0, 1, 0, 0, 0, 0], amount: [0, 0, 0, 0, 0, 1, 0],
      absoluteTemperature: [0, 0, 0, 0, 1, 0, 0],
      temperatureDifference: [0, 0, 0, 0, 1, 0, 0],
      pressure: [1, -1, -2, 0, 0, 0, 0], density: [1, -3, 0, 0, 0, 0, 0],
      velocity: [0, 1, -1, 0, 0, 0, 0], acceleration: [0, 1, -2, 0, 0, 0, 0],
      diffusivity: [0, 2, -1, 0, 0, 0, 0], dynamicViscosity: [1, -1, -1, 0, 0, 0, 0],
      energy: [1, 2, -2, 0, 0, 0, 0], power: [1, 2, -3, 0, 0, 0, 0],
      volumetricPower: [1, -1, -3, 0, 0, 0, 0],
      specificEnergy: [0, 2, -2, 0, 0, 0, 0], molarEnergy: [1, 2, -2, 0, 0, -1, 0],
      specificHeatCapacity: [0, 2, -2, 0, -1, 0, 0],
      molarHeatCapacity: [1, 2, -2, 0, -1, -1, 0],
      volumetricHeatCapacity: [1, -1, -2, 0, -1, 0, 0],
      thermalConductivity: [1, 1, -3, 0, -1, 0, 0],
      heatTransferCoefficient: [1, 0, -3, 0, -1, 0, 0],
      force: [1, 1, -2, 0, 0, 0, 0], fractureEnergy: [1, 0, -2, 0, 0, 0, 0],
      molarMass: [1, 0, 0, 0, 0, -1, 0], rate: [0, 0, -1, 0, 0, 0, 0],
      angle: [0, 0, 0, 0, 0, 0, 0], massFlux: [1, -2, -1, 0, 0, 0, 0],
    })
  })
  it('has a same-dimension, zero-offset, unit-scale canonical SI unit for every kind', () => {
    for (const dimension of Object.values(KIND_DIMENSIONS)) {
      const definition = UNITS[SI_UNITS[dimension]]
      expect(definition.dimension).toBe(dimension)
      expect(definition.scaleToSI).toBe(1)
      expect(definition.offsetToSI).toBe(0)
    }
    for (const definition of Object.values(UNITS)) {
      expect(Number.isFinite(definition.scaleToSI) && definition.scaleToSI > 0).toBe(true)
      expect(Number.isFinite(definition.offsetToSI)).toBe(true)
      if (definition.dimension !== 'absoluteTemperature')
        expect(definition.offsetToSI).toBe(0)
    }
  })
  it('freezes the whole catalog including dimension arrays and unit definitions', () => {
    for (const object of [DIMENSIONS, KIND_DIMENSIONS, UNITS, SI_UNITS,
      ...Object.values(DIMENSIONS), ...Object.values(UNITS)])
      expect(Object.isFrozen(object)).toBe(true)
  })
})

describe('explicit arithmetic conversions', () => {
  const cases: readonly [QuantityKind, number, UnitId, UnitId, number][] = [
    ['length', 20, 'ft', 'm', 6.096],
    ['length', 250, 'mm', 'm', 0.25],
    ['area', 10, 'cm2', 'm2', 0.001],
    ['intrinsicPermeability', 1e-12, 'm2', 'mm2', 1e-6],
    ['volume', 2, 'L', 'm3', 0.002],
    ['volume', 100, 'cm3', 'm3', 0.0001],
    ['mass', 4, 'g', 'kg', 0.004],
    ['time', 2, 'min', 's', 120],
    ['time', 3, 'h', 's', 10800],
    ['time', 7, 'd', 's', 604800],
    ['amount', 0.2, 'mol', 'mol', 0.2],
    ['stress', 1, 'MPa', 'Pa', 1000000],
    ['stress', 8, 'kPa', 'Pa', 8000],
    ['pressureDifference', -5, 'kPa', 'Pa', -5000],
    ['absolutePressure', 1.01325, 'bar', 'Pa', 101325],
    ['bulkDensity', 0.135, 'g/cm3', 'kg/m3', 135],
    ['particleDensity', 1.5, 'g/cm3', 'kg/m3', 1500],
    ['fluidDensity', 1, 'g/cm3', 'kg/m3', 1000],
    ['velocity', 14.7, 'mm/s', 'm/s', 0.0147],
    ['hydraulicConductivity', 1, 'cm/s', 'm/s', 0.01],
    ['acceleration', 9.80665, 'm/s2', 'm/s2', 9.80665],
    ['gasDiffusivity', 0.16, 'cm2/s', 'm2/s', 1.6e-5],
    ['thermalDiffusivity', 0.2, 'cm2/s', 'm2/s', 2e-5],
    ['dynamicViscosity', 0.018, 'mPa*s', 'Pa*s', 1.8e-5],
    ['energy', 2, 'kJ', 'J', 2000],
    ['power', 2, 'kW', 'W', 2000],
    ['volumetricPower', 2500, 'W/m3', 'W/m3', 2500],
    ['specificEnergy', 2260, 'kJ/kg', 'J/kg', 2260000],
    ['molarEnergy', 6030, 'cal_th/mol', 'J/mol', 25229.52],
    ['molarEnergy', 25.2, 'kJ/mol', 'J/mol', 25200],
    ['specificHeatCapacity', 1.84, 'kJ/(kg*K)', 'J/(kg*K)', 1840],
    ['molarHeatCapacity', 29, 'J/(mol*K)', 'J/(mol*K)', 29],
    ['volumetricHeatCapacity', 0.772, 'MJ/(m3*K)', 'J/(m3*K)', 772000],
    ['thermalConductivity', 0.16, 'W/(m*K)', 'W/(m*K)', 0.16],
    ['heatTransferCoefficient', 1.5, 'W/(m2*K)', 'W/(m2*K)', 1.5],
    ['force', 2, 'kN', 'N', 2000],
    ['fractureEnergy', 5, 'J/m2', 'J/m2', 5],
    ['molarMass', 44.0095, 'g/mol', 'kg/mol', 0.0440095],
    ['rate', 2e-6, '1/s', '1/s', 2e-6],
    ['angle', 180, 'deg', 'rad', Math.PI],
    ['massFlux', 0.08, 'g/(m2*s)', 'kg/(m2*s)', 0.00008],
    ['dryMassMoisture', 114.5, '%', '1', 1.145],
    ['moleFraction', 21, '%', '1', 0.21],
    ['poreSaturation', 20, '%', '1', 0.2],
  ]
  for (const [kind, value, from, to, expected] of cases)
    it(`${kind}: ${value} ${from} to ${to}`, () => {
      close(rawConvert(kind, value, from, to).valueOut, expected)
    })
  it('records two explicit transforms starting from the original input', () => {
    const converted = convertValue('stress', 2, 'MPa', 'kPa')
    expect(converted.catalogVersion).toBe(UNIT_CATALOG_VERSION)
    expect(converted.arithmetic).toBe('IEEE-754 binary64')
    expect(converted.valueSI).toBe(2e6)
    expect(converted.toSI).toEqual({
      formula: 'output = input * scale + offset', scale: 1e6, offset: 0, exactDefinition: true,
    })
    expect(converted.toTarget).toEqual({
      formula: 'output = input * scale + offset', scale: 1000, offset: 0, exactDefinition: true,
    })
  })
  it('records the rounded irrational angular scale without claiming measured precision', () => {
    const conversion = convertValue('angle', 180, 'deg', 'rad')
    expect(conversion.toSI.exactDefinition).toBe(false)
    expect(conversion.toTarget.exactDefinition).toBe(false)
    expect(convertValue('angle', 180, 'deg', 'deg').toTarget.exactDefinition).toBe(true)
  })
})

describe('absolute and difference temperatures', () => {
  it('uses affine Celsius offsets only for absolute temperatures', () => {
    expect(convertValue('absoluteTemperature', 0, 'degC', 'K').valueOut).toBe(273.15)
    close(convertValue('absoluteTemperature', 194.67, 'K', 'degC').valueOut, -78.48)
    expect(convertValue('absoluteTemperature', -273.15, 'degC', 'K').valueOut).toBe(0)
    expect(convertValue('temperatureDifference', 10, 'delta_degC', 'delta_K').valueOut).toBe(10)
    expect(convertValue('temperatureDifference', -10, 'delta_K', 'delta_degC').valueOut).toBe(-10)
    const conversion = convertValue('absoluteTemperature', 20, 'degC', 'K')
    expect(conversion.toSI.offset).toBe(273.15)
    expect(conversion.toTarget.offset).toBe(273.15)
  })
  it('rejects absolute/difference substitution even with identical dimension vectors', () => {
    expect(DIMENSIONS.absoluteTemperature).toEqual(DIMENSIONS.temperatureDifference)
    for (const [kind, from, to] of [
      ['absoluteTemperature', 'degC', 'delta_K'],
      ['temperatureDifference', 'delta_degC', 'K'],
      ['temperatureDifference', 'degC', 'delta_K'],
    ]) rejects(() => rawConvert(kind, 10, from, to), 'INCOMPATIBLE_UNIT')
  })
  it('rejects below-zero absolutes without silently clamping; differences remain signed', () => {
    rejects(() => convertValue('absoluteTemperature', -1, 'K', 'degC'), 'NEGATIVE_ABSOLUTE')
    rejects(() => convertValue('absoluteTemperature', -273.150001, 'degC', 'K'), 'NEGATIVE_ABSOLUTE')
    rejects(() => convertValue('absolutePressure', -1, 'Pa', 'kPa'), 'NEGATIVE_ABSOLUTE')
    expect(convertValue('pressureDifference', -1, 'Pa', 'kPa').valueOut).toBe(-0.001)
    expect(convertValue('stress', -1, 'Pa', 'kPa').valueOut).toBe(-0.001)
  })
  it('keeps Celsius identity conversions exact instead of subtracting two large offsets', () => {
    expect(convertValue('absoluteTemperature', 1e-12, 'degC', 'degC').valueOut).toBe(1e-12)
  })
})

describe('round trips and pairwise dimensional rejection', () => {
  for (const kind of Object.keys(KIND_DIMENSIONS) as QuantityKind[]) {
    it(`round-trips every registered unit for ${kind}`, () => {
      const dimension = KIND_DIMENSIONS[kind], si = SI_UNITS[dimension]
      const units = (Object.keys(UNITS) as UnitId[]).filter(u => UNITS[u].dimension === dimension)
      const values = kind === 'absoluteTemperature' ? [0, 194.67, 273.15, 300.25, 1000]
        : kind === 'absolutePressure' ? [0, 1000, 101325, 3e5]
        : [-1234.5, -1e-16, 0, 1e-16, 1.2345, 1e12]
      for (const u of units) for (const value of values) {
        const encoded = rawConvert(kind, value, si, u)
        const decoded = rawConvert(kind, encoded.valueOut, u, si)
        close(decoded.valueOut, value, 2e-12, kind === 'absoluteTemperature' ? 1e-10 : 0)
        expect(decoded.kind).toBe(kind)
      }
    })
  }
  it('rejects every incompatible kind/unit pair at runtime', () => {
    for (const kind of Object.keys(KIND_DIMENSIONS) as QuantityKind[]) {
      const dimension = KIND_DIMENSIONS[kind], si = SI_UNITS[dimension]
      for (const id of Object.keys(UNITS) as UnitId[])
        if (UNITS[id].dimension !== dimension) {
          rejects(() => rawConvert(kind, 1, id, si), 'INCOMPATIBLE_UNIT')
          rejects(() => rawConvert(kind, 1, si, id), 'INCOMPATIBLE_UNIT')
        }
    }
  })
  it('does not implement material-dependent basis conversions', () => {
    for (const [kind, from, to] of [
      ['specificEnergy', 'J/mol', 'J/kg'],
      ['specificHeatCapacity', 'J/(m3*K)', 'J/(kg*K)'],
      ['intrinsicPermeability', 'm/s', 'm2'],
      ['angle', 'deg', '1'],
    ]) rejects(() => rawConvert(kind, 1, from, to), 'INCOMPATIBLE_UNIT')
  })
})

describe('no unit guessing, coercion, or erased tiny numbers', () => {
  it('rejects missing/unknown kinds and unit spellings, including display labels', () => {
    for (const kind of [undefined, null, '', 'temperature', 'Moisture', '__proto__', 'toString'])
      rejects(() => rawConvert(kind, 1, 'm', 'm'), 'UNKNOWN_KIND')
    for (const unit of [undefined, null, 1, '', ' m', 'm ', 'M', 'kg/m³', 'm²',
      '°C', 'C', 'c', 'kelvin', 'Pa absolute', 'Pa gauge', 'psi', 'cal/mol', '__proto__', 'toString'])
      rejects(() => rawConvert('length', 1, unit, 'm'), 'UNKNOWN_UNIT')
    rejects(() => rawConvert('length', 1, 'm', undefined), 'UNKNOWN_UNIT')
  })
  it('rejects nonfinite values and every nonnumber rather than defaulting to zero', () => {
    for (const value of [NaN, Infinity, -Infinity, undefined, null, true, '1', '', [], {}, 1n])
      rejects(() => rawConvert('mass', value, 'kg', 'kg'), 'NONFINITE_VALUE')
  })
  it('rejects overflow in either canonical SI storage or requested output', () => {
    rejects(() => convertValue('stress', Number.MAX_VALUE, 'MPa', 'Pa'), 'OVERFLOW')
    rejects(() => convertValue('length', Number.MAX_VALUE, 'm', 'mm'), 'OVERFLOW')
  })
  it('rejects underflow to zero, but retains meaningful tiny permeability values', () => {
    rejects(() => convertValue('length', Number.MIN_VALUE, 'mm', 'm'), 'UNDERFLOW')
    close(convertValue('intrinsicPermeability', 1e-16, 'm2', 'cm2').valueOut, 1e-12)
  })
  it('normalizes numeric negative zero for JSON while retaining its reported token', () => {
    const q = parseReportedQuantity('mass', {
      ...densityReport(), value: -0, unit: 'kg', numericText: '-0.0', unitText: 'kg',
    })
    expect(Object.is(q.valueSI, -0)).toBe(false)
    expect(Object.is(q.reported.value, -0)).toBe(false)
    expect(q.reported.numericText).toBe('-0.0')
  })
})

describe('reporting metadata, strict boundaries and immutable JSON records', () => {
  it('retains reported units, token, significant figures and denominator without rounding SI', () => {
    const input: ReportedValue<'bulkDensity'> = {
      ...densityReport(), value: 1.500, numericText: '1.500',
      precision: { kind: 'significant-figures', digits: 4 },
    }
    const result = normalizeQuantity('bulkDensity', input)
    expect(result.valueSI).toBe(1500)
    expect(result.unitSI).toBe('kg/m3')
    expect(result.reported).toEqual(input)
    expect(result.reported === input).toBe(false)
    expect(result.reported.precision === input.precision).toBe(false)
  })
  it('preserves unknown precision and original-text absence explicitly', () => {
    const result = normalizeQuantity('bulkDensity', {
      ...densityReport(), numericText: null, unitText: null, precision: { kind: 'unknown' },
    })
    expect(result.reported.precision).toEqual({ kind: 'unknown' })
    expect(result.reported.numericText).toBe(null)
    expect(result.reported.unitText).toBe(null)
  })
  it('records a declared exact value only with an explicit justification', () => {
    const precision: ReportingPrecision = { kind: 'exact', justification: 'Prescribed numerical fixture value, not a measurement.' }
    const result = normalizeQuantity('bulkDensity', { ...densityReport(), precision })
    expect(result.reported.precision).toEqual(precision)
    rejects(() => parseReportedQuantity('bulkDensity', {
      ...densityReport(), precision: { kind: 'exact', justification: '' },
    }), 'INVALID_REPORT')
  })
  it('allows more than 100 percent dry-basis moisture without turning it into saturation', () => {
    const result = normalizeQuantity('dryMassMoisture', {
      value: 114.5, unit: '%', numericText: '114.5', unitText: '% dry basis',
      precision: { kind: 'unknown' }, basis: 'Water mass / oven-dry total specimen mass.',
    })
    close(result.valueSI, 1.145)
    expect(result.kind).toBe('dryMassMoisture')
    expect(result.reported.basis).toBe('Water mass / oven-dry total specimen mass.')
  })
  it('preserves distinct semantic kinds for identical SI exponents and units', () => {
    const common = { value: 20, unit: '%' as const, numericText: '20', unitText: '%',
      precision: { kind: 'unknown' as const } }
    const a = normalizeQuantity('poreSaturation', { ...common, basis: 'Liquid volume / pore volume.' })
    const b = normalizeQuantity('moleFraction', { ...common, basis: 'O2 moles / total mixture moles.' })
    expect(a.valueSI).toBe(b.valueSI)
    expect(a.kind === (b.kind as string)).toBe(false)
    expect(a.reported.basis === b.reported.basis).toBe(false)
  })
  it('does not mistake a successful unit conversion for physical fraction admissibility', () => {
    const q = normalizeQuantity('poreSaturation', {
      value: 150, unit: '%', numericText: '150', unitText: '%',
      precision: { kind: 'unknown' }, basis: 'Intentionally invalid physical fixture: liquid / pores.',
    })
    expect(q.valueSI).toBe(1.5) // Task 2/5 must reject for applicability, not silently clip.
  })
  it('creates a deeply frozen JSON-safe result without freezing the caller', () => {
    const input = densityReport(), result = normalizeQuantity('bulkDensity', input)
    for (const object of [result, result.reported, result.reported.precision,
      result.conversion, result.conversion.dimensionTag, result.conversion.toSI, result.conversion.toTarget])
      expect(Object.isFrozen(object)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.precision)).toBe(false)
    const decoded = JSON.parse(JSON.stringify(result))
    expect(decoded).toEqual(result)
    expect(parseReportedQuantity('bulkDensity', decoded.reported)).toEqual(result)
  })
  it('rejects null, missing fields, extra fields, arrays, custom prototypes and accessors', () => {
    for (const value of [null, undefined, [], {}, new Date(0)])
      rejects(() => parseReportedQuantity('bulkDensity', value), 'INVALID_REPORT')
    for (const field of Object.keys(densityReport())) {
      const input: Record<string, unknown> = { ...densityReport() }
      delete input[field]
      rejects(() => parseReportedQuantity('bulkDensity', input), 'INVALID_REPORT')
    }
    rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), measured: true }), 'INVALID_REPORT')
    rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), [Symbol('extra')]: true }), 'INVALID_REPORT')
    let accessed = false
    const input = densityReport()
    Object.defineProperty(input, 'value', { enumerable: true, get() { accessed = true; return 0.135 } })
    rejects(() => parseReportedQuantity('bulkDensity', input), 'INVALID_REPORT')
    expect(accessed).toBe(false)
    const hidden = densityReport()
    Object.defineProperty(hidden, 'basis', { enumerable: false, value: 'hidden' })
    rejects(() => parseReportedQuantity('bulkDensity', hidden), 'INVALID_REPORT')
  })
  it('accepts an explicit null-prototype plain report without inheriting properties', () => {
    const report = Object.assign(Object.create(null), densityReport())
    expect(parseReportedQuantity('bulkDensity', report).valueSI).toBe(135)
  })
  it('rejects mismatched or ambiguous original numeric tokens', () => {
    for (const numericText of ['', ' 0.135', '0.135 ', '135', '0,135', '0.135 kg',
      'NaN', 'Infinity', '0x10', '1/2', '1.35e999', true])
      rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), numericText }), 'INVALID_REPORT')
    rejects(() => parseReportedQuantity('bulkDensity', {
      ...densityReport(), value: 0, numericText: '1e-400',
    }), 'INVALID_REPORT')
    for (const numericText of ['+0.135', '.135', '1.35e-1', '0.1350'])
      expect(parseReportedQuantity('bulkDensity', { ...densityReport(), numericText }).valueSI).toBe(135)
  })
  it('rejects nonfinite report values and unsupported or wrong-dimension explicit units', () => {
    for (const value of [NaN, Infinity, null, '0.135'])
      rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), value }), 'NONFINITE_VALUE')
    rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), unit: null }), 'UNKNOWN_UNIT')
    rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), unit: 'kg/m³' }), 'UNKNOWN_UNIT')
    rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), unit: 'Pa' }), 'INCOMPATIBLE_UNIT')
  })
  it('rejects non-string unit IDs without executing caller conversion hooks', () => {
    let calls = 0
    const hostile = { toString() { calls++; throw new Error('Must not execute.') } }
    for (const unit of [hostile, Object.create(null), [], 1, null, undefined]) {
      rejects(() => rawConvert('length', 1, unit, 'm'), 'UNKNOWN_UNIT')
      rejects(() => rawConvert('length', 1, 'm', unit), 'UNKNOWN_UNIT')
    }
    expect(calls).toBe(0)
  })
  it('rejects unsupported precision shapes, invalid digits and missing bases', () => {
    for (const precision of [null, undefined, {}, { kind: 'measured' },
      { kind: 'unknown', digits: 2 }, { kind: 'exact' },
      { kind: 'significant-figures', digits: 0 }, { kind: 'significant-figures', digits: -2 },
      { kind: 'significant-figures', digits: 1.5 }, { kind: 'significant-figures', digits: NaN },
      { kind: 'significant-figures', digits: Infinity }, { kind: 'significant-figures', digits: '3' },
      { kind: 'significant-figures', digits: Number.MAX_SAFE_INTEGER + 1 }])
      rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), precision }), 'INVALID_REPORT')
    for (const basis of ['', '   ', null, 1])
      rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), basis }), 'INVALID_REPORT')
    for (const unitText of ['', '  ', undefined, 1])
      rejects(() => parseReportedQuantity('bulkDensity', { ...densityReport(), unitText }), 'INVALID_REPORT')
  })
})

/** Compiled by npm run typecheck; never executed. No testing-only source export. */
function compileTimeContracts() {
  const density = normalizeQuantity('bulkDensity', densityReport())
  const pressure = convertValue('absolutePressure', 1, 'bar', 'Pa')
  const valid: SIValue<'bulkDensity'> = density.valueSI
  void valid
  // @ts-expect-error a length input cannot use kilograms
  convertValue('length', 1, 'kg', 'm')
  // @ts-expect-error temperature differences cannot use an absolute Celsius unit
  convertValue('temperatureDifference', 5, 'degC', 'delta_K')
  // @ts-expect-error kind inference must not widen to accommodate a wrong report unit
  normalizeQuantity('bulkDensity', { ...densityReport(), unit: 'Pa' })
  // @ts-expect-error equal numeric representations do not authorize kind replacement
  const wrong: SIValue<'stress'> = pressure.valueSI
  // @ts-expect-error unknown values are not numeric measured defaults
  const missing: ReportedValue<'bulkDensity'> = { ...densityReport(), value: null }
  void wrong
  void missing
}
void compileTimeContracts
