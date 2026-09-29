import {
  baselineCoupledBalances, evaluateConservation,
  type BalanceDefinition, type BalanceKind, type BalanceObservation,
  type BalanceTolerance, type ConservationUnit, type CorrectionLimit, type Quantity,
} from '../../../src/physics-next/verification/conservation';
import {
  CoupledTransport, DEFAULT_COUPLED, coupledScenario, type CoupledInputs, type Ledger,
} from '../../../src/coupled/model';
import { CoupledEngine } from '../../../src/coupled/engine';

export const FIXTURE_EVIDENCE =
  'C-T2 controlled fixture; baseline 4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3';
export const NO_INSERTION_HISTORY =
  `${FIXTURE_EVIDENCE}: captured from a fresh constructor; no earlier insertion`;
export const NO_INVENTORY_CORRECTIONS =
  `${FIXTURE_EVIDENCE}: inspected coupled path has no primary-inventory clipping; no injected corrections`;
export const MOLAR_KG_MOL = [0.031998, 0.0440095, 0.0280134, 0.01801528] as const;

export function known(value: number, unit: ConservationUnit, evidence = FIXTURE_EVIDENCE): Quantity {
  return { state: 'known', value, unit, evidence: [evidence] };
}
export function unknown(reason: string, unit: ConservationUnit): Quantity {
  return { state: 'unknown', reason, unit, evidence: [] };
}
export interface LedgerFixture {
  definition: BalanceDefinition;
  observation: BalanceObservation;
  tolerance: BalanceTolerance;
  correctionLimit: CorrectionLimit;
}
export function scalarFixture(unit: ConservationUnit = 'kg', kind: BalanceKind = 'mass'): LedgerFixture {
  return {
    definition: {
      id: `synthetic.${kind}`, kind, unit, controlVolume: 'Synthetic closed accounting domain',
      storageBasis: 'Declared extensive storage change, not a solver observation',
      requiredTerms: [
        { id: 'storage', role: 'storage-change', description: 'After minus before' },
        { id: 'boundary', role: 'boundary-out', description: 'Signed integrated outward transfer' },
        { id: 'source', role: 'source-in', description: 'Signed integrated inward source' },
      ],
    },
    observation: {
      id: `synthetic.${kind}`, interval: { startTimeS: 0, endTimeS: 1, kind: 'advance' },
      coverage: { state: 'complete', evidence: [FIXTURE_EVIDENCE] },
      terms: [
        { id: 'storage', quantity: known(3, unit) },
        { id: 'boundary', quantity: known(2, unit) },
        { id: 'source', quantity: known(5, unit) },
      ],
      corrections: {
        netInput: known(0, unit), grossAdjustment: known(0, unit),
        rationale: 'Exact synthetic arithmetic has no correction operations.',
      },
    },
    tolerance: {
      unit, absolute: 1e-9, relative: 0, reference: 5,
      rationale: 'Arithmetic-fixture allowance only; not a production threshold.',
      referenceRationale: 'Fixed synthetic source magnitude in the same unit.',
    },
    correctionLimit: { unit, maxGross: 0, rationale: 'This exact synthetic fixture forbids corrections.' },
  };
}
export function runFixture(f: LedgerFixture) {
  return evaluateConservation(f.definition, f.observation, f.tolerance, f.correctionLimit);
}
export function setTerm(f: LedgerFixture, id: string, quantity: Quantity): void {
  if (!f.observation.terms.some(term => term.id === id)) throw new Error(`Missing fixture term ${id}`);
  f.observation = {
    ...f.observation,
    terms: f.observation.terms.map(term => term.id === id ? { id, quantity } : term),
  };
}
export function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
  Object.values(value).forEach(deepFreeze); Object.freeze(value);
}
export function allNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value !== 'object') return true;
  return Object.values(value).every(allNumbersFinite);
}
/** Independent pairwise extensive reduction; never a production residual helper. */
export function extensiveSum(values: ArrayLike<number>): number {
  function part(lo: number, hi: number): number {
    if (lo === hi) return 0;
    if (hi - lo === 1) {
      if (!Number.isFinite(values[lo])) throw new Error('Nonfinite extensive inventory');
      return values[lo];
    }
    const mid = lo + Math.floor((hi - lo) / 2), result = part(lo, mid) + part(mid, hi);
    if (!Number.isFinite(result)) throw new Error('Extensive sum overflow');
    return result;
  }
  return part(0, values.length);
}
/** Transcription of the pinned caloric reference, not an independently validated EOS. */
export function baselineSolidU(tK: number): number {
  const subT = 194.67, t0 = 273.15, r = 8.314462618;
  return (28.8 * (subT - t0) + r * subT) / MOLAR_KG_MOL[1]
    - 6030 * 4.184 / MOLAR_KG_MOL[1] + 850 * (tK - subT);
}
export interface InventoryArrays {
  readonly grid: readonly [number, number, number];
  readonly fuelKg: Float64Array;
  readonly mineralKg: Float64Array;
  /** Coupled ALL-phase water; do not add gasMol[3] mass twice. */
  readonly waterAllPhasesKg: Float64Array;
  readonly gasMol: readonly [Float64Array, Float64Array, Float64Array, Float64Array];
  readonly cellEnergyJ: Float64Array;
  readonly solidCO2Kg: number;
  readonly solidCO2TemperatureK: number;
}
export interface IndependentTotals {
  readonly massKg: number;
  readonly speciesMol: readonly [number, number, number, number];
  readonly cellEnergyJ: number;
  readonly solidEnergyJ: number;
}
export function recomputeInventories(a: InventoryArrays): IndependentTotals {
  if (!a.grid.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid cell grid');
  const count = a.grid[0] * a.grid[1] * a.grid[2];
  if (!Number.isSafeInteger(count)) throw new Error('Invalid cell count');
  if (a.gasMol.length !== 4) throw new Error('Four species in O2/CO2/N2/H2O order required');
  const positiveFields = [a.fuelKg, a.mineralKg, a.waterAllPhasesKg, ...a.gasMol];
  for (const field of [...positiveFields, a.cellEnergyJ]) {
    if (!(field instanceof Float64Array) || field.length !== count) throw new Error('Cell inventory must be a correctly sized Float64Array');
    if (!field.every(Number.isFinite)) throw new Error('Nonfinite cell inventory');
  }
  if (positiveFields.some(field => field.some(value => value < 0))) throw new Error('Negative primary inventory requires explicit disclosure, not clipping');
  if (!Number.isFinite(a.solidCO2Kg) || a.solidCO2Kg < 0
    || !Number.isFinite(a.solidCO2TemperatureK) || a.solidCO2TemperatureK <= 0) throw new Error('Invalid finite-source inventory');
  const gas = a.gasMol.map(extensiveSum), water = extensiveSum(a.waterAllPhasesKg);
  const massKg = extensiveSum([
    extensiveSum(a.fuelKg), extensiveSum(a.mineralKg), water, a.solidCO2Kg,
    gas[0] * MOLAR_KG_MOL[0], gas[1] * MOLAR_KG_MOL[1], gas[2] * MOLAR_KG_MOL[2],
  ]);
  const speciesMol = [gas[0], gas[1], gas[2], water / MOLAR_KG_MOL[3]] as const;
  const solidEnergyJ = a.solidCO2Kg * baselineSolidU(a.solidCO2TemperatureK);
  if (![...speciesMol, solidEnergyJ].every(Number.isFinite)) throw new Error('Inventory conversion overflow');
  return { massKg, speciesMol, cellEnergyJ: extensiveSum(a.cellEnergyJ), solidEnergyJ };
}
export function tinyInventory(): InventoryArrays {
  return {
    grid: [2, 1, 1], fuelKg: new Float64Array([1, 2]), mineralKg: new Float64Array([4, 8]),
    waterAllPhasesKg: new Float64Array([2 * MOLAR_KG_MOL[3], 3 * MOLAR_KG_MOL[3]]),
    gasMol: [
      new Float64Array([1, 2]), new Float64Array([3, 4]),
      new Float64Array([5, 6]), new Float64Array([0.25, 0.5]),
    ],
    cellEnergyJ: new Float64Array([16, -4]), solidCO2Kg: 0.125, solidCO2TemperatureK: 194.67,
  };
}
export interface CoupledAuditSnapshot {
  readonly timeS: number;
  readonly arrays: InventoryArrays;
  readonly totals: IndependentTotals;
  readonly ledger: Ledger;
  readonly boundaryMol: readonly number[];
  readonly sourceMol: readonly number[];
  readonly absentInsertionZeroEvidence: string | null;
}
export function captureAudit(t: CoupledTransport, absentInsertionZeroEvidence: string | null = null): CoupledAuditSnapshot {
  if (absentInsertionZeroEvidence !== null && !absentInsertionZeroEvidence.trim()) throw new Error('Blank insertion-lineage evidence');
  if (t.gas.length !== 4) throw new Error('Unexpected gas order/count');
  const d = t.scenario.domain, cp = t.checkpoint();
  const arrays: InventoryArrays = {
    grid: [d.nx, d.ny, d.nz], fuelKg: t.fuel.slice(), mineralKg: t.mineral.slice(),
    waterAllPhasesKg: t.water.slice(),
    gasMol: [t.gas[0].slice(), t.gas[1].slice(), t.gas[2].slice(), t.gas[3].slice()],
    cellEnergyJ: t.energy.slice(), solidCO2Kg: t.dryIce, solidCO2TemperatureK: t.dryIceT,
  };
  if (cp.boundary.length !== 4 || cp.sources.length !== 4
    || ![...cp.boundary, ...cp.sources].every(Number.isFinite)) throw new Error('Malformed checkpoint species transfers');
  return {
    timeS: t.time, arrays, totals: recomputeInventories(arrays), ledger: structuredClone(cp.ledger),
    boundaryMol: [...cp.boundary], sourceMol: [...cp.sources], absentInsertionZeroEvidence,
  };
}
type InsertionField = 'externalSolidMassInKg' | 'externalSolidEnergyInJ' | 'insertionWorkJ';
function insertionValue(s: CoupledAuditSnapshot, key: InsertionField, unit: ConservationUnit): Quantity {
  const value = s.ledger[key];
  if (value !== undefined) return known(value, unit, `${FIXTURE_EVIDENCE}: ledger.${key}`);
  if (s.absentInsertionZeroEvidence !== null) return known(0, unit, s.absentInsertionZeroEvidence);
  return unknown(`Missing ${key}; no evidence for historical zero`, unit);
}
function difference(a: Quantity, b: Quantity): Quantity {
  if (a.unit !== b.unit) throw new Error('Fixture quantity dimension mismatch');
  return a.state === 'known' && b.state === 'known'
    ? known(b.value - a.value, a.unit, [...a.evidence, ...b.evidence].join('; '))
    : unknown('Endpoint transfer history unknown', a.unit);
}
/** Six baseline balances. Mechanics requires its own accepted incremental work. */
export function coupledObservations(
  before: CoupledAuditSnapshot, after: CoupledAuditSnapshot, correctionEvidence: string | null,
): readonly BalanceObservation[] {
  if (before.arrays.grid.some((n, i) => n !== after.arrays.grid[i])) throw new Error('Interval crosses a grid change; a conservative remap audit is required');
  if (correctionEvidence !== null && !correctionEvidence.trim()) throw new Error('Blank correction evidence');
  const optionalDelta = (key: InsertionField, unit: ConservationUnit) =>
    difference(insertionValue(before, key, unit), insertionValue(after, key, unit));
  const massIn = optionalDelta('externalSolidMassInKg', 'kg');
  const importedEnergy = optionalDelta('externalSolidEnergyInJ', 'J');
  const insertion = optionalDelta('insertionWorkJ', 'J');
  const poreNet = after.ledger.pressureWorkJ - before.ledger.pressureWorkJ;
  const poreWork = insertion.state === 'known'
    ? known(poreNet + insertion.value, 'J') : unknown('Insertion/pore work split unavailable', 'J');
  const make = (id: string, unit: ConservationUnit, terms: readonly (readonly [string, Quantity])[]): BalanceObservation => ({
    id, interval: { startTimeS: before.timeS, endTimeS: after.timeS, kind: after.timeS === before.timeS ? 'event' : 'advance' },
    coverage: { state: 'complete', evidence: [`${FIXTURE_EVIDENCE}: declared baseline inventory and matching transfer interval`] },
    terms: terms.map(([termId, quantity]) => ({ id: termId, quantity })),
    corrections: {
      netInput: correctionEvidence === null ? unknown('No correction audit', unit) : known(0, unit, correctionEvidence),
      grossAdjustment: correctionEvidence === null ? unknown('No correction audit', unit) : known(0, unit, correctionEvidence),
      rationale: 'Zero is allowed only for a fixture-controlled, independently inspected no-correction path.',
    },
  });
  const definitions = baselineCoupledBalances();
  return [
    make(definitions[0].id, 'kg', [
      ['storage-change', known(after.totals.massKg - before.totals.massKg, 'kg')],
      ['boundary-out', known(after.ledger.boundaryMassOutKg - before.ledger.boundaryMassOutKg, 'kg')],
      ['source-in', massIn],
    ]),
    ...[0, 1, 2, 3].map(s => make(definitions[1 + s].id, 'mol', [
      ['storage-change', known(after.totals.speciesMol[s] - before.totals.speciesMol[s], 'mol')],
      ['boundary-out', known(after.boundaryMol[s] - before.boundaryMol[s], 'mol')],
      ['source-in', known(after.sourceMol[s] - before.sourceMol[s], 'mol')],
    ])),
    make('coupled.thermal-energy', 'J', [
      ['cell-energy-change', known(after.totals.cellEnergyJ - before.totals.cellEnergyJ, 'J')],
      ['solid-source-energy-change', known(after.totals.solidEnergyJ - before.totals.solidEnergyJ, 'J')],
      ['boundary-energy-out', known(after.ledger.boundaryEnergyOutJ - before.ledger.boundaryEnergyOutJ, 'J')],
      ['heater-in', known(after.ledger.heaterJ - before.ledger.heaterJ, 'J')],
      ['reaction-in', known(after.ledger.reactionJ - before.ledger.reactionJ, 'J')],
      ['gravity-work-in', known(after.ledger.gravityWorkJ - before.ledger.gravityWorkJ, 'J')],
      ['pore-work-out', poreWork], ['insertion-work-in', insertion], ['external-solid-energy-in', importedEnergy],
    ]),
  ];
}
/** Baseline controlled-case ceilings; not changes to any existing solver gate. */
export function evaluateControlledInterval(before: CoupledAuditSnapshot, after: CoupledAuditSnapshot) {
  return coupledObservations(before, after, NO_INVENTORY_CORRECTIONS).map(observation => {
    const definition = baselineCoupledBalances().find(d => d.id === observation.id);
    if (!definition) throw new Error('Missing baseline definition');
    const absolute = definition.unit === 'kg' ? 1e-9 : definition.unit === 'mol' ? 1e-8 : 1e-5;
    return evaluateConservation(definition, observation, {
      unit: definition.unit, absolute, relative: 0, reference: 0,
      rationale: 'Controlled small-fixture ceilings from baseline tests/coupled.test.ts; not a new solver gate.',
      referenceRationale: 'Absolute-only check; reference zero contributes no relative allowance.',
    }, { unit: definition.unit, maxGross: 0, rationale: 'No primary-inventory correction operation in this controlled coupled fixture.' });
  });
}
export function fixtureInputs(overrides: Partial<CoupledInputs> = {}): CoupledInputs {
  return { ...DEFAULT_COUPLED, dryIceKg: 0, heaterW: 0, reaction: false,
    mechanics: true, fracture: false, roots: false, cap: false,
    capRadiusM: 0.2, capRiseM: 0.02, capThicknessM: 0.002, ...overrides };
}
export function closedScenario() {
  const s = coupledScenario(fixtureInputs());
  s.domain = { nx: 4, ny: 4, nz: 4, widthM: 1, lengthM: 1, depthM: 1 };
  s.source.centerXM = 0.5; s.source.centerYM = 0.5; s.source.centerDepthM = 0.5;
  s.source.startTimeS = 0; s.source.durationS = 10;
  s.peatRegions = []; s.hotRegions = []; s.root.amountKgM3 = 0;
  s.soilLayers = [{ ...s.soilLayers[0], thicknessM: 1, moistureSaturationOffset: 0, porosityOffset: 0 }];
  s.atmosphere.topGasBoundary = 'noFlux'; s.atmosphere.sideGasBoundary = 'noFlux';
  s.atmosphere.surfaceHeatTransferWm2K = 0; s.atmosphere.bottomHeatTransferWm2K = 0;
  s.atmosphere.deepTemperatureC = s.atmosphere.temperatureC; return s;
}
export function makeTransport() { const t = new CoupledTransport(closedScenario()); t.gasGravityMS2 = 0; return t; }
export function makeEngine(overrides: Partial<CoupledInputs> = {}) {
  const e = new CoupledEngine(fixtureInputs(overrides), closedScenario()); e.transport.gasGravityMS2 = 0; return e;
}
export function byteImage(array: Float64Array): readonly number[] {
  return Array.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
}
export function assertSeparateBuffers(inputs: readonly Float64Array[], outputs: readonly Float64Array[]): void {
  const buffers = new Set(inputs.map(a => a.buffer));
  for (const output of outputs) {
    if (buffers.has(output.buffer)) throw new Error('Returned state shares an input/output buffer');
    buffers.add(output.buffer);
  }
}
export function captureTransportPhysical(t: CoupledTransport) {
  const named = { temperature: t.temperature, pressure: t.pressure, liquid: t.liquid, ice: t.ice,
    gasVolume: t.gasVolume, mineral: t.mineral, solidCp: t.solidCp, porosity0: t.porosity0,
    kh: t.kh, kv: t.kv, conductivity: t.conductivity, peat: t.peat };
  return {
    checkpoint: t.checkpoint(), primaryBytes: [...t.gas, t.water, t.fuel, t.energy, t.pore].map(byteImage),
    derivedAndMaterialBytes: Object.fromEntries(Object.entries(named).map(([key, a]) => [key, byteImage(a)])),
    scenario: structuredClone(t.scenario), gravityMS2: t.gasGravityMS2,
    boundaryControls: t.faces.map(({ a, b, axis, area, distance, thermal, capFraction, ventGap, ventRadius }) =>
      ({ a, b, axis, area, distance, thermal, capFraction, ventGap, ventRadius })),
    initialization: [t.preparedWaterRemovedKg, t.initializationMethod, t.atlasCells],
  };
}
export function captureEnginePhysical(e: CoupledEngine) {
  return {
    transport: captureTransportPhysical(e.transport), inputs: structuredClone(e.inputs),
    mechanics: e.mechanics ? { u: byteImage(e.mechanics.u), damage: byteImage(e.mechanics.damage), history: byteImage(e.mechanics.history) } : null,
    committedMechanical: structuredClone(e.mechanical), capState: structuredClone(e.capState),
    referencePressure: byteImage(e.referencePressure), mechanicalBalanceJ: e.mechanicalBalanceJ,
    referenceBoundaryWorkJ: e.referenceBoundaryWorkJ,
  };
}
