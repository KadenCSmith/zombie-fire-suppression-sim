/**
 * Independent signed conservation accounting; no solver equations or defaults.
 * All terms are integrated over the SAME physical interval/control volume.
 * A pass verifies the declared balance only, never experimental validation.
 */
export type ConservationUnit = 'kg' | 'mol' | 'J';
export type ConservationStatus = 'pass' | 'fail' | 'unknown';
export type BalanceKind = 'mass' | 'species' | 'energy' | 'work';
export type TermRole =
  | 'storage-change'
  | 'boundary-out'
  | 'source-in'
  | 'work-out'
  | 'work-in';

export type Quantity =
  | {
      readonly state: 'known';
      readonly value: number;
      readonly unit: ConservationUnit;
      readonly evidence: readonly string[];
    }
  | {
      readonly state: 'unknown';
      readonly unit: ConservationUnit;
      readonly reason: string;
      readonly evidence: readonly string[];
    };

export type Coverage =
  | { readonly state: 'complete'; readonly evidence: readonly string[] }
  | {
      readonly state: 'unknown';
      readonly reason: string;
      readonly evidence: readonly string[];
    };

export interface RequiredTerm {
  readonly id: string;
  readonly role: TermRole;
  /** Exact inventory/transfer definition, including phase and energy basis. */
  readonly description: string;
}

export interface BalanceDefinition {
  readonly id: string;
  readonly kind: BalanceKind;
  readonly unit: ConservationUnit;
  readonly controlVolume: string;
  readonly storageBasis: string;
  /** Freeze this manifest before collecting results; do not derive it from data. */
  readonly requiredTerms: readonly RequiredTerm[];
}

export interface BalanceObservation {
  readonly id: string;
  readonly interval: {
    readonly startTimeS: number;
    readonly endTimeS: number;
    /** An intervention can have equal timestamps; an advance cannot. */
    readonly kind: 'advance' | 'event' | 'initialization';
  };
  readonly coverage: Coverage;
  readonly terms: readonly {
    readonly id: string;
    readonly quantity: Quantity;
  }[];
  readonly corrections: {
    /** Signed net inventory added by NUMERICAL interventions only. */
    readonly netInput: Quantity;
    /** Sum of absolute individual interventions, not abs(netInput). */
    readonly grossAdjustment: Quantity;
    readonly rationale: string;
  };
}

export interface BalanceTolerance {
  readonly unit: ConservationUnit;
  readonly absolute: number;
  readonly relative: number; // dimensionless
  readonly reference: number; // in unit, nonnegative, not the residual
  readonly rationale: string;
  readonly referenceRationale: string;
}

export interface CorrectionLimit {
  readonly unit: ConservationUnit;
  readonly maxGross: number;
  readonly rationale: string;
}

export interface TermAudit {
  readonly id: string;
  readonly role: TermRole;
  readonly description: string;
  readonly coefficient: 1 | -1;
  readonly value: number | null;
  readonly signedContribution: number | null;
  readonly state: 'known' | 'unknown' | 'missing' | 'invalid';
  readonly evidence: readonly string[];
  readonly reason: string | null;
}

export interface ConservationResult {
  readonly id: string;
  readonly kind: BalanceKind;
  readonly unit: ConservationUnit;
  readonly status: ConservationStatus;
  readonly controlVolume: string;
  readonly storageBasis: string;
  /** No total-energy or whole-solver pass is inferred from a subset balance. */
  readonly claim: 'declared-numerical-balance-only';
  readonly interval: {
    readonly startTimeS: number | null;
    readonly endTimeS: number | null;
    readonly kind: BalanceObservation['interval']['kind'];
  };
  readonly tolerance: {
    readonly absolute: number | null;
    readonly relative: number | null;
    readonly reference: number | null;
    readonly allowedResidual: number | null;
    readonly rationale: string;
    readonly referenceRationale: string;
  };
  /** Partial arithmetic only. NEVER use this field as a conservation gate. */
  readonly knownTermSum: number | null;
  /** Sum(storage changes + outflow + work out - sources - work in). */
  readonly physicalResidual: number | null;
  /** physicalResidual - numerical netInput; raw residual remains a gate. */
  readonly accountedResidual: number | null;
  readonly normalizedPhysical: number | null; // abs(residual) / allowance
  readonly normalizedAccounted: number | null;
  readonly correction: {
    readonly netInput: number | null;
    readonly grossAdjustment: number | null;
    readonly maxGross: number | null;
    readonly rationale: string;
    readonly limitRationale: string;
    readonly evidence: readonly string[];
  };
  readonly checks: {
    readonly physical: boolean | null;
    readonly accounted: boolean | null;
    readonly grossCorrection: boolean | null;
  };
  readonly terms: readonly TermAudit[];
  readonly evidence: readonly string[];
  readonly failures: readonly string[];
  readonly unknowns: readonly string[];
  readonly notes: readonly string[];
}

const COEFFICIENT: Readonly<Record<TermRole, 1 | -1>> = {
  'storage-change': 1,
  'boundary-out': 1,
  'source-in': -1,
  'work-out': 1,
  'work-in': -1,
};

const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const text = (value: string): boolean => value.trim().length > 0;
const finite = (value: number): number | null => Number.isFinite(value) ? value : null;
const evidenceOK = (values: readonly string[]): boolean =>
  values.length > 0 && values.every(text);
const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort(compareText);

/** Neumaier summation. Null means overflow/invalid arithmetic, NOT zero. */
function sumFinite(values: readonly number[]): number | null {
  let sum = 0;
  let correction = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return null;
    const next = sum + value;
    if (!Number.isFinite(next)) return null;
    correction += Math.abs(sum) >= Math.abs(value)
      ? (sum - next) + value
      : (value - next) + sum;
    if (!Number.isFinite(correction)) return null;
    sum = next;
  }
  return finite(sum + correction);
}

/**
 * Input objects must satisfy the exported TypeScript shapes. This function
 * validates numerical values, dimensions and ledger integrity, not arbitrary
 * unparsed JSON. A future import adapter must validate its external schema.
 * No inputs are mutated, and no input array is returned by reference.
 */
export function evaluateConservation(
  definition: BalanceDefinition,
  observation: BalanceObservation,
  tolerance: BalanceTolerance,
  correctionLimit: CorrectionLimit,
): ConservationResult {
  const failures: string[] = [];
  const unknowns: string[] = [];
  const notes: string[] = [];
  const allEvidence: string[] = [];
  const fail = (message: string): void => { failures.push(message); };
  const unknown = (message: string): void => { unknowns.push(message); };

  for (const [name, value] of [
    ['balance id', definition.id],
    ['control volume', definition.controlVolume],
    ['storage basis', definition.storageBasis],
    ['tolerance rationale', tolerance.rationale],
    ['reference rationale', tolerance.referenceRationale],
    ['correction rationale', observation.corrections.rationale],
    ['correction-limit rationale', correctionLimit.rationale],
  ] as const) {
    if (!text(value)) fail(`Missing ${name}.`);
  }
  const expectedUnit: Readonly<Record<BalanceKind, ConservationUnit>> = {
    mass: 'kg', species: 'mol', energy: 'J', work: 'J',
  };
  if (definition.unit !== expectedUnit[definition.kind]) {
    fail('Balance kind and unit disagree.');
  }
  if (observation.id !== definition.id) fail('Observation balance id mismatch.');
  if (tolerance.unit !== definition.unit) fail('Residual tolerance unit mismatch.');
  if (correctionLimit.unit !== definition.unit) fail('Correction limit unit mismatch.');

  const start = finite(observation.interval.startTimeS);
  const end = finite(observation.interval.endTimeS);
  if (start === null || end === null || start < 0 || end < start) {
    fail('Physical interval must have finite nonnegative ordered times in seconds.');
  } else if (observation.interval.kind === 'advance' && end === start) {
    fail('An advancing interval must have positive physical duration.');
  } else if (observation.interval.kind === 'initialization' && end !== start) {
    fail('An initialization comparison must have equal physical timestamps.');
  }

  const validTolerance = [tolerance.absolute, tolerance.relative, tolerance.reference]
    .every(value => Number.isFinite(value) && value >= 0);
  let allowance: number | null = null;
  if (!validTolerance) {
    fail('Residual tolerance and reference must be finite and nonnegative.');
  } else {
    const relativeAllowance = tolerance.relative * tolerance.reference;
    const candidate = Math.max(tolerance.absolute, relativeAllowance);
    if (!Number.isFinite(candidate) || candidate <= 0) {
      fail('Residual allowance must be finite and positive; no implicit unit floor.');
    } else {
      allowance = candidate;
    }
  }
  const grossLimit = finite(correctionLimit.maxGross);
  if (grossLimit === null || grossLimit < 0) {
    fail('Gross correction limit must be finite and nonnegative.');
  }

  let complete = observation.coverage.state === 'complete';
  allEvidence.push(...observation.coverage.evidence);
  if (observation.coverage.state === 'complete') {
    if (!evidenceOK(observation.coverage.evidence)) {
      fail('Complete coverage requires nonempty evidence.');
      complete = false;
    }
  } else {
    if (!text(observation.coverage.reason)) fail('Unknown coverage requires a reason.');
    unknown(`Coverage unknown: ${observation.coverage.reason}`);
  }

  const required = new Map<string, RequiredTerm>();
  for (const term of definition.requiredTerms) {
    if (!text(term.id) || !text(term.description)) fail('Every required term needs an id and description.');
    if (required.has(term.id)) fail(`Duplicate required term: ${term.id}.`);
    if (!Object.hasOwn(COEFFICIENT, term.role)) fail(`Unsupported term role: ${term.id}.`);
    if ((term.role === 'work-in' || term.role === 'work-out') && definition.unit !== 'J') {
      fail(`Work role on non-energy quantity: ${term.id}.`);
    }
    required.set(term.id, term);
  }
  if (required.size === 0) fail('A balance must declare required terms.');
  if (![...required.values()].some(term => term.role === 'storage-change')) {
    fail('A balance must explicitly declare its storage change, including a known zero.');
  }
  const observed = new Map<string, Quantity>();
  for (const term of observation.terms) {
    if (observed.has(term.id)) fail(`Duplicate observed term: ${term.id}.`);
    if (!required.has(term.id)) fail(`Undeclared observed term: ${term.id}.`);
    observed.set(term.id, term.quantity);
  }

  const readQuantity = (quantity: Quantity, label: string): number | null => {
    allEvidence.push(...quantity.evidence);
    if (quantity.unit !== definition.unit) {
      fail(`Quantity unit mismatch: ${label}.`);
      return null;
    }
    if (quantity.state === 'unknown') {
      if (!text(quantity.reason)) fail(`Unknown quantity requires a reason: ${label}.`);
      unknown(`${label}: ${quantity.reason}`);
      return null;
    }
    if (!evidenceOK(quantity.evidence)) {
      fail(`Known quantity requires nonempty evidence: ${label}.`);
      return null;
    }
    if (!Number.isFinite(quantity.value)) {
      fail(`Nonfinite quantity: ${label}.`);
      return null;
    }
    return quantity.value;
  };

  const audit: TermAudit[] = [];
  let allTermsKnown = true;
  for (const term of [...required.values()].sort((a, b) => compareText(a.id, b.id))) {
    const quantity = observed.get(term.id);
    const coefficient = COEFFICIENT[term.role];
    if (!quantity) {
      fail(`Required term omitted: ${term.id}.`);
      allTermsKnown = false;
      audit.push({
        ...term, coefficient, value: null, signedContribution: null,
        state: 'missing', evidence: [], reason: 'Required observation absent.',
      });
      continue;
    }
    const value = readQuantity(quantity, term.id);
    const contribution = value === null ? null : finite(coefficient * value);
    if (contribution === null) allTermsKnown = false;
    audit.push({
      ...term, coefficient, value, signedContribution: contribution,
      state: value !== null ? 'known' : quantity.state === 'unknown' ? 'unknown' : 'invalid',
      evidence: [...quantity.evidence],
      reason: quantity.state === 'unknown' ? quantity.reason : value === null ? 'Invalid quantity.' : null,
    });
  }

  const net = readQuantity(observation.corrections.netInput, 'numerical net input');
  const gross = readQuantity(observation.corrections.grossAdjustment, 'gross numerical adjustment');
  if (gross !== null && gross < 0) fail('Gross numerical adjustment cannot be negative.');
  // No hidden epsilon: an inconsistent disclosure is malformed evidence.
  if (net !== null && gross !== null && gross < Math.abs(net)) {
    fail('Gross numerical adjustment is smaller than abs(net input).');
  }

  const knownTermSum = sumFinite(
    audit.flatMap(term => term.signedContribution === null ? [] : [term.signedContribution]),
  );
  if (knownTermSum === null) fail('Known-term sum exceeded finite arithmetic range.');
  // Invalid manifests, dimensions or budgets must never yield a usable residual.
  const structurallyValid = failures.length === 0;
  const physical = structurallyValid && complete && allTermsKnown ? knownTermSum : null;
  const accounted = physical !== null && net !== null ? sumFinite([physical, -net]) : null;
  if (physical !== null && net !== null && accounted === null) {
    fail('Correction-accounted residual exceeded finite arithmetic range.');
  }

  const physicalPass = physical === null || allowance === null ? null : Math.abs(physical) <= allowance;
  const accountedPass = accounted === null || allowance === null ? null : Math.abs(accounted) <= allowance;
  const grossPass = gross === null || grossLimit === null || grossLimit < 0
    ? null : gross >= 0 && gross <= grossLimit;
  if (physicalPass === false) fail('Physical residual exceeds its dimensioned allowance.');
  if (accountedPass === false) fail('Correction-accounted residual exceeds its dimensioned allowance.');
  if (grossPass === false) fail('Gross numerical adjustment exceeds its independent limit.');

  const normalized = (residual: number | null, label: string): number | null => {
    if (residual === null || allowance === null) return null;
    const ratio = finite(Math.abs(residual) / allowance);
    if (ratio === null) notes.push(`${label} ratio is outside finite range; the dimensional gate remains decisive.`);
    return ratio;
  };
  const normalizedPhysical = normalized(physical, 'Physical');
  const normalizedAccounted = normalized(accounted, 'Accounted');

  if (physicalPass === null) unknown('Full physical balance is not evaluable.');
  if (accountedPass === null) unknown('Correction-accounted balance is not evaluable.');
  if (grossPass === null) unknown('Numerical-correction budget is not evaluable.');
  const status: ConservationStatus = failures.length > 0 ? 'fail'
    : unknowns.length > 0 ? 'unknown' : 'pass';

  return {
    id: definition.id, kind: definition.kind, unit: definition.unit, status,
    controlVolume: definition.controlVolume, storageBasis: definition.storageBasis,
    claim: 'declared-numerical-balance-only',
    interval: { startTimeS: start, endTimeS: end, kind: observation.interval.kind },
    tolerance: {
      absolute: finite(tolerance.absolute), relative: finite(tolerance.relative),
      reference: finite(tolerance.reference), allowedResidual: allowance,
      rationale: tolerance.rationale, referenceRationale: tolerance.referenceRationale,
    },
    knownTermSum, physicalResidual: physical, accountedResidual: accounted,
    normalizedPhysical, normalizedAccounted,
    correction: {
      netInput: net, grossAdjustment: gross, maxGross: grossLimit,
      rationale: observation.corrections.rationale, limitRationale: correctionLimit.rationale,
      evidence: uniqueSorted([
        ...observation.corrections.netInput.evidence,
        ...observation.corrections.grossAdjustment.evidence,
      ]),
    },
    checks: { physical: physicalPass, accounted: accountedPass, grossCorrection: grossPass },
    terms: audit, evidence: uniqueSorted(allEvidence),
    failures: uniqueSorted(failures), unknowns: uniqueSorted(unknowns), notes: uniqueSorted(notes),
  };
}

/**
 * Declared balances for the INSPECTED baseline CoupledTransport/CoupledEngine.
 * These are definitions, not readers of solver-private fields and not A/B laws.
 * Return fresh objects so a caller cannot mutate subsequent definitions.
 * No tolerances, zero transfers, or missing measurements are supplied here.
 */
export function baselineCoupledBalances(): readonly BalanceDefinition[] {
  const scalarTerms = (storage: string, sources: string): RequiredTerm[] => [
    { id: 'storage-change', role: 'storage-change', description: storage },
    { id: 'boundary-out', role: 'boundary-out', description: 'Integrated signed outward transfer across the modeled boundary.' },
    { id: 'source-in', role: 'source-in', description: sources },
  ];
  const mass: BalanceDefinition = {
    id: 'coupled.total-mass', kind: 'mass', unit: 'kg',
    controlVolume: 'All coupled soil cells plus the finite solid CO2 source.',
    storageBasis: 'fuel + mineral + all-phase water + solid CO2 + O2/CO2/N2 gas mass; vapor is already in all-phase water.',
    requiredTerms: scalarTerms(
      'Change of full modeled mass, kg; do not add gas H2O a second time.',
      'External imported mass only. Internal reaction/phase transfers cancel in total mass.',
    ),
  };
  const species: readonly (readonly [string, string])[] = [
    ['O2', 'Gas O2 inventory in mol.'],
    ['CO2', 'Gas CO2 inventory in mol, EXCLUDING the solid source. Sublimation is a source into this pool.'],
    ['N2-background', 'Gas background/N2 inventory in mol.'],
    ['H2O-all-phases', 'Total water kg divided by H2O molar mass; includes liquid, ice and vapor. Internal phase changes are not sources.'],
  ];
  const components = species.map(([id, basis]): BalanceDefinition => ({
    id: `coupled.species.${id}`, kind: 'species', unit: 'mol',
    controlVolume: 'The declared species pool in all coupled soil cells.',
    storageBasis: basis,
    requiredTerms: scalarTerms(
      `After minus before inventory: ${basis}`,
      'Signed reaction/phase-transfer/external sources appropriate to THIS pool; consumption is negative.',
    ),
  }));
  const thermal: BalanceDefinition = {
    id: 'coupled.thermal-energy', kind: 'energy', unit: 'J',
    controlVolume: 'Coupled thermal cells plus remaining solid CO2; chemical fuel energy is excluded.',
    storageBasis: 'Cell internal energy plus finite source solid internal energy, using the baseline thermodynamic reference.',
    requiredTerms: [
      { id: 'cell-energy-change', role: 'storage-change', description: 'Change in the sum of Float64 cell internal energies.' },
      { id: 'solid-source-energy-change', role: 'storage-change', description: 'Change in remaining solid CO2 mass times its specific internal energy.' },
      { id: 'boundary-energy-out', role: 'boundary-out', description: 'Outward boundary conduction, heat exchange and transported gas enthalpy; internal faces cancel.' },
      { id: 'heater-in', role: 'source-in', description: 'External scheduled heater energy, counted exactly once.' },
      { id: 'reaction-in', role: 'source-in', description: 'Chemical energy released into this thermal-only inventory.' },
      { id: 'gravity-work-in', role: 'work-in', description: 'Gas gravitational work added to thermal energy.' },
      { id: 'pore-work-out', role: 'work-out', description: 'Signed pore expansion work: delta pressureWorkJ plus delta insertionWorkJ in the baseline.' },
      { id: 'insertion-work-in', role: 'work-in', description: 'Signed compression work at solid insertion; already removed from the net baseline pressureWorkJ.' },
      { id: 'external-solid-energy-in', role: 'source-in', description: 'Imported solid CO2 internal energy at the declared reference; it may be negative.' },
    ],
  };
  const mechanical: BalanceDefinition = {
    id: 'coupled.mechanical-work', kind: 'work', unit: 'J',
    controlVolume: 'Incremental baseline quasi-static soil/root/fracture/cap balance under gauge pressure.',
    storageBasis: 'Changes of baseline elastic, fracture-history and cap energies; NOT a general plastic or dynamic A/B energy law.',
    requiredTerms: [
      { id: 'elastic-energy-change', role: 'storage-change', description: 'Elastic energy after minus before, including embedded roots already counted by baseline mechanics.' },
      { id: 'fracture-energy-change', role: 'storage-change', description: 'Baseline fracture energy after minus before; do not count it again as separate heat.' },
      { id: 'cap-energy-change', role: 'storage-change', description: 'Cap energy after minus before; zero only when absence/zero storage is evidenced.' },
      { id: 'gauge-pressure-work-in', role: 'work-in', description: 'Sum 0.5*(p_old+p_new-2*p_reference)*delta pore volume. Not endpoint dot(force,u).' },
    ],
  };
  return [mass, ...components, thermal, mechanical];
}
