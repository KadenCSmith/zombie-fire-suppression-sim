/** Conditional scalar refinement diagnostics; never an experimental claim. */
export type VerificationStatus = 'pass' | 'fail' | 'inconclusive' | 'unknown' | 'not-run';
export interface EvidenceDecision { readonly value: boolean | null; readonly evidence: readonly string[] }
export interface ConvergenceStudy {
  readonly id: string; readonly axis: 'mesh' | 'time'; readonly resolutionUnit: 'm' | 's';
  readonly observable: string; readonly observableUnit: string;
  readonly problemHash: string; readonly solverHash: string; readonly fixedSettingsHash: string;
  readonly refinementDescription: string;
  readonly assumptions: {
    readonly sameContinuumProblem: EvidenceDecision; readonly systematicRefinement: EvidenceDecision;
    readonly otherAxisControlled: EvidenceDecision; readonly smoothRegime: EvidenceDecision;
  };
  readonly policy: {
    readonly expectedOrder: number; readonly orderTolerance: number; readonly maxOrderSpread: number;
    readonly ratioTolerance: number; readonly absoluteNoiseFloor: number; readonly relativeNoiseFloor: number;
    readonly absoluteError: number; readonly relativeError: number; readonly reference: number;
    readonly rationale: string; readonly referenceRationale: string;
  };
}
export interface RefinementRun {
  readonly id: string; readonly status: 'complete' | 'failed' | 'unknown' | 'not-run';
  readonly reason: string | null; readonly resolution: number; readonly value: number | null;
  readonly observableUnit: string; readonly physicalTimeS: number;
  readonly problemHash: string; readonly solverHash: string; readonly fixedSettingsHash: string;
  readonly evidence: readonly string[];
}
export interface ConvergenceResult {
  readonly id: string; readonly status: VerificationStatus;
  readonly claim: 'conditional-discretization-estimate-only';
  readonly axis: ConvergenceStudy['axis']; readonly resolutionUnit: ConvergenceStudy['resolutionUnit'];
  readonly observableUnit: string; readonly observedOrders: readonly number[]; readonly refinementRatios: readonly number[];
  readonly richardsonLimit: number | null; readonly estimatedFineError: number | null; readonly allowance: number | null;
  readonly reasons: readonly string[]; readonly evidence: readonly string[];
  readonly runs: readonly {
    readonly id: string; readonly status: RefinementRun['status']; readonly resolution: number | null;
    readonly value: number | null; readonly physicalTimeS: number | null; readonly reason: string | null;
  }[];
}
const nonblank = (s: string): boolean => s.trim().length > 0;
const finiteOrNull = (n: number): number | null => Number.isFinite(n) ? n : null;
const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const uniqueText = (s: readonly string[]): string[] => [...new Set(s)].sort(lexical);
/** Coarse-to-fine order is mandatory. Four complete levels test two observed orders. */
export function evaluateConvergence(study: ConvergenceStudy, runs: readonly RefinementRun[]): ConvergenceResult {
  const reasons: string[] = [], evidence: string[] = [], orders: number[] = [], ratios: number[] = [];
  let richardsonLimit: number | null = null, estimatedFineError: number | null = null, allowance: number | null = null;
  const finish = (status: VerificationStatus, reason?: string): ConvergenceResult => ({
    id: study.id, status, claim: 'conditional-discretization-estimate-only', axis: study.axis,
    resolutionUnit: study.resolutionUnit, observableUnit: study.observableUnit, observedOrders: [...orders],
    refinementRatios: [...ratios], richardsonLimit, estimatedFineError, allowance,
    reasons: uniqueText(reason ? [...reasons, reason] : reasons), evidence: uniqueText(evidence),
    runs: runs.map(r => ({ id: r.id, status: r.status, resolution: finiteOrNull(r.resolution),
      value: r.value === null ? null : finiteOrNull(r.value), physicalTimeS: finiteOrNull(r.physicalTimeS), reason: r.reason })),
  });
  const p = study.policy;
  if (![study.id, study.observable, study.observableUnit, study.refinementDescription, p.rationale, p.referenceRationale].every(nonblank)) {
    return finish('fail', 'Study identity, units, refinement description and policy rationales are required.');
  }
  if (study.resolutionUnit !== (study.axis === 'mesh' ? 'm' : 's')) return finish('fail', 'Refinement axis and dimension disagree.');
  if (![p.expectedOrder, p.orderTolerance, p.maxOrderSpread, p.ratioTolerance, p.absoluteNoiseFloor,
    p.relativeNoiseFloor, p.absoluteError, p.relativeError, p.reference].every(n => Number.isFinite(n) && n >= 0)
    || p.expectedOrder <= 0 || p.absoluteNoiseFloor <= 0 || p.ratioTolerance > 1e-6) {
    return finish('fail', 'Invalid policy; order/noise floor must be positive and ratio tolerance at most 1e-6.');
  }
  allowance = finiteOrNull(Math.max(p.absoluteError, p.relativeError * p.reference));
  if (allowance === null || allowance <= 0) return finish('fail', 'Error allowance must be finite and positive.');
  const ids = new Set<string>(); let unavailable = false, incompatible = false, invalid = false, incompleteReason = false;
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]; evidence.push(...r.evidence);
    if (!nonblank(r.id) || ids.has(r.id)) invalid = true; ids.add(r.id);
    if (!Number.isFinite(r.resolution) || r.resolution <= 0 || !Number.isFinite(r.physicalTimeS) || r.physicalTimeS < 0
      || r.value !== null && !Number.isFinite(r.value)) invalid = true;
    if (i > 0 && !(r.resolution < runs[i - 1].resolution)) return finish('fail', 'Runs are not strictly ordered coarse to fine.');
    if (r.observableUnit !== study.observableUnit) incompatible = true;
    for (const key of ['problemHash', 'solverHash', 'fixedSettingsHash'] as const) {
      if (!nonblank(r[key]) || !nonblank(study[key])) unavailable = true;
      else if (r[key] !== study[key]) incompatible = true;
    }
    if (i > 0 && r.physicalTimeS !== runs[0].physicalTimeS) incompatible = true;
    if (r.status === 'complete' && (r.value === null || r.evidence.length === 0 || !r.evidence.every(nonblank))) unavailable = true;
    if (r.status !== 'complete' && (r.reason === null || !nonblank(r.reason))) incompleteReason = true;
  }
  if (invalid) return finish('fail', 'Malformed run identity, resolution, physical time, or nonfinite value.');
  if (incompatible) return finish('fail', 'Unmatched problem, solver, fixed settings, observable units or physical time.');
  if (incompleteReason) return finish('fail', 'Every incomplete run must declare its reason.');
  if (runs.some(r => r.status === 'failed')) return finish('fail', 'At least one run explicitly failed; no extrapolation.');
  if (runs.length === 0 || runs.every(r => r.status === 'not-run')) return finish('not-run', 'No completed study was executed.');
  if (unavailable || runs.some(r => r.status === 'unknown')) return finish('unknown', 'Required run value or provenance is unavailable.');
  if (runs.some(r => r.status === 'not-run')) return finish('inconclusive', 'The planned sequence is incomplete.');
  let unknownAssumption = false, falseAssumption = false;
  for (const [name, a] of Object.entries(study.assumptions)) {
    evidence.push(...a.evidence);
    if (a.value === false) { falseAssumption = true; reasons.push(`Assumption not satisfied: ${name}.`); }
    if (a.value === null || a.evidence.length === 0 || !a.evidence.every(nonblank)) {
      unknownAssumption = true; reasons.push(`Assumption lacks evidence: ${name}.`);
    }
  }
  if (falseAssumption) return finish('inconclusive');
  if (unknownAssumption) return finish('unknown');
  if (runs.length < 4) return finish('inconclusive', 'Fewer than four complete refinement levels; order stability is untested.');
  for (let i = 1; i < runs.length; i++) {
    const ratio = runs[i - 1].resolution / runs[i].resolution;
    if (!Number.isFinite(ratio) || ratio <= 1) return finish('fail', 'Invalid finite refinement ratio.');
    ratios.push(ratio);
  }
  if (ratios.some(r => Math.abs(r / ratios[0] - 1) > p.ratioTolerance)) {
    return finish('inconclusive', 'Nonconstant refinement ratios require a different predeclared estimator.');
  }
  const values = runs.map(r => r.value!), scale = Math.max(p.reference, ...values.map(Math.abs));
  const noise = Math.max(p.absoluteNoiseFloor, p.relativeNoiseFloor * scale);
  if (!Number.isFinite(noise)) return finish('fail', 'Noise scale overflow.');
  const differences = values.slice(0, -1).map((v, i) => v - values[i + 1]);
  if (!differences.every(Number.isFinite)) return finish('fail', 'Successive difference overflow.');
  if (differences.some(d => Math.abs(d) <= noise)) return finish('inconclusive', 'Refinement signal is at or below its declared noise/roundoff floor.');
  if (differences.some(d => Math.sign(d) !== Math.sign(differences[0]))) return finish('inconclusive', 'Nonmonotone or oscillatory sequence; no Richardson accuracy claim.');
  for (let i = 0; i < differences.length - 1; i++) {
    const order = (Math.log(Math.abs(differences[i])) - Math.log(Math.abs(differences[i + 1]))) / Math.log(ratios[i]);
    if (!Number.isFinite(order)) return finish('inconclusive', 'Observed order is numerically unresolved.');
    orders.push(order);
  }
  if (orders.some(order => order <= 0)) return finish('inconclusive', 'Errors are not contracting at positive observed order.');
  if (Math.max(...orders) - Math.min(...orders) > p.maxOrderSpread) return finish('inconclusive', 'Observed orders are not stable over the submitted sequence.');
  if (orders.some(order => Math.abs(order - p.expectedOrder) > p.orderTolerance)) return finish('fail', 'Stable observed order violates the predeclared expected-order gate.');
  const order = orders[orders.length - 1], ratio = ratios[ratios.length - 1], denominator = Math.expm1(order * Math.log(ratio));
  const correction = (values[values.length - 1] - values[values.length - 2]) / denominator;
  if (!Number.isFinite(denominator) || denominator <= 0 || !Number.isFinite(correction)) {
    return finish('inconclusive', 'Richardson arithmetic is ill-conditioned or outside finite range.');
  }
  richardsonLimit = finiteOrNull(values[values.length - 1] + correction); estimatedFineError = finiteOrNull(Math.abs(correction));
  if (richardsonLimit === null || estimatedFineError === null) {
    richardsonLimit = null; estimatedFineError = null; return finish('fail', 'Extrapolated quantity overflow.');
  }
  return finish(estimatedFineError <= allowance ? 'pass' : 'fail', estimatedFineError <= allowance
    ? 'Conditional fine-grid/time error estimate meets the declared allowance; not measured true error.'
    : 'Conditional fine-grid/time error estimate exceeds the declared allowance.');
}
