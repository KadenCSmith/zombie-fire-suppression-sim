import type { VerificationStatus } from './convergence';
export interface ValidationSource {
  readonly id: string; readonly kind: 'experimental' | 'synthetic'; readonly citation: string; readonly locator: string;
  readonly sha256: string; readonly availability: 'accessible' | 'unavailable' | 'unknown';
  readonly firstResponseAccessUtc: string | null; readonly accessEvidence: readonly string[];
}
export interface ObservationUncertainty {
  readonly kind: 'standard' | 'expanded'; readonly magnitude: number; readonly unit: string; readonly basis: string;
  readonly coverageDescription: string; readonly evidence: readonly string[];
}
export interface ValidationObservation {
  readonly id: string; readonly sourceId: string; readonly rawRecordKey: string; readonly independenceGroup: string;
  readonly independenceEvidence: readonly string[]; readonly caseHash: string; readonly quantity: string; readonly unit: string;
  readonly timeS: number; readonly positionM: readonly [number, number, number] | null; readonly value: number;
  readonly uncertainty: ObservationUncertainty | null;
}
export type ParameterDistribution =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'uniform'; readonly lower: number; readonly upper: number }
  | { readonly kind: 'normal'; readonly mean: number; readonly standardDeviation: number }
  | { readonly kind: 'empirical'; readonly values: readonly number[]; readonly weights: readonly number[] };
export interface ParameterEvidence {
  readonly id: string; readonly unit: string; readonly role: 'controlled' | 'calibrated' | 'measured';
  readonly fittedObservationIds: readonly string[]; readonly distribution: ParameterDistribution | null;
  readonly evidence: readonly string[];
}
export interface NumericalErrorEstimate {
  readonly kind: 'conditional-estimate' | 'certified-bound'; readonly magnitude: number; readonly unit: string;
  readonly evidence: readonly string[];
}
export interface HoldoutPrediction {
  readonly observationId: string; readonly quantity: string; readonly unit: string; readonly caseHash: string;
  readonly timeS: number; readonly positionM: readonly [number, number, number] | null; readonly value: number;
  readonly numericalError: NumericalErrorEstimate | null; readonly matchingEvidence: readonly string[];
}
export interface ValidationGate {
  readonly quantity: string; readonly unit: string; readonly minimumObservations: number; readonly minimumIndependentGroups: number;
  readonly maximumAbsoluteError: number; readonly maximumScaledError: number; readonly maximumGroupRmsScaledError: number;
  readonly maximumNumericalUncertaintyFraction: number; readonly rationale: string; readonly preregistrationEvidence: readonly string[];
}
export interface ValidationPlan {
  readonly id: string; readonly applicability: string; readonly independenceRationale: string;
  readonly baselineCommit: string; readonly solverHash: string; readonly configurationHash: string; readonly parameterSetHash: string;
  readonly registeredUtc: string | null; readonly modelFrozenUtc: string | null; readonly firstHoldoutResponseAccessUtc: string | null;
  readonly frozenModelEvidence: readonly string[]; readonly calibrationObservationIds: readonly string[];
  readonly holdoutObservationIds: readonly string[]; readonly requiredParameterIds: readonly string[];
  readonly requiredVerificationIds: readonly string[]; readonly gates: readonly ValidationGate[];
}
export interface ValidationPredictionRun {
  readonly state: 'complete' | 'failed' | 'unknown' | 'not-run'; readonly reason: string | null;
  readonly baselineCommit: string; readonly solverHash: string; readonly configurationHash: string; readonly parameterSetHash: string;
  readonly generatedUtc: string | null; readonly fittedObservationIds: readonly string[];
  readonly modelSelectionObservationIds: readonly string[]; readonly predictions: readonly HoldoutPrediction[]; readonly evidence: readonly string[];
}
export interface VerificationEvidence {
  readonly id: string; readonly status: VerificationStatus; readonly origin: 'solver-run' | 'author-self-test' | 'archived-run';
  readonly baselineCommit: string; readonly solverHash: string; readonly evidence: readonly string[];
}
export interface ValidationAssessment {
  readonly mode: 'assessment' | 'self-test'; readonly plan: ValidationPlan; readonly sources: readonly ValidationSource[];
  readonly observations: readonly ValidationObservation[]; readonly parameters: readonly ParameterEvidence[];
  readonly run: ValidationPredictionRun; readonly verification: readonly VerificationEvidence[];
}
export interface ValidationResult {
  readonly id: string; readonly status: VerificationStatus; readonly validationStatus: VerificationStatus;
  readonly claim: 'matched-holdout-in-declared-domain-only' | 'schema-gate-self-test-only' | 'no-validation-claim';
  readonly applicability: string; readonly reasons: readonly string[]; readonly evidence: readonly string[];
  readonly metrics: readonly { readonly quantity: string; readonly unit: string; readonly observations: number;
    readonly independentGroups: number; readonly maxAbsoluteError: number; readonly maxScaledError: number;
    readonly groupBalancedRmsError: number; readonly groupBalancedRmsScaledError: number;
    readonly maxNumericalFraction: number; readonly passed: boolean; readonly gate: ValidationGate }[];
}
const nonblank = (s: string): boolean => s.trim().length > 0;
const hasEvidence = (v: readonly string[]): boolean => v.length > 0 && v.every(nonblank);
const sha256 = (s: string): boolean => /^[0-9a-f]{64}$/i.test(s);
const commitHash = (s: string): boolean => /^[0-9a-f]{40}$/i.test(s);
const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const sortedUnique = (s: readonly string[]): string[] => [...new Set(s)].sort(lexical);
const uniqueIds = (ids: readonly string[]): boolean => ids.every(nonblank) && new Set(ids).size === ids.length;
function timeValue(utc: string | null): number | null {
  if (utc === null || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(utc)) return null;
  const n = Date.parse(utc); if (!Number.isFinite(n)) return null;
  const canonical = utc.includes('.') ? utc : utc.replace('Z', '.000Z');
  return new Date(n).toISOString() === canonical ? n : null;
}
const positionOK = (p: ValidationObservation['positionM']): boolean => p === null || p.length === 3 && p.every(Number.isFinite);
const samePosition = (a: ValidationObservation['positionM'], b: HoldoutPrediction['positionM']): boolean =>
  a === null ? b === null : b !== null && a.every((v, i) => v === b[i]);
function stableRms(values: readonly number[]): number {
  const scale = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return scale === 0 ? 0 : scale * Math.sqrt(values.reduce((s, v) => s + (v / scale) ** 2, 0) / values.length);
}
export function evaluateParameterEvidence(parameters: readonly ParameterEvidence[]): { readonly status: VerificationStatus; readonly reasons: readonly string[] } {
  const failures: string[] = [], unknowns: string[] = [];
  if (!uniqueIds(parameters.map(p => p.id))) failures.push('Parameter IDs must be nonblank and unique.');
  for (const p of parameters) {
    if (!nonblank(p.unit)) failures.push(`Parameter unit missing: ${p.id}.`);
    if (!uniqueIds(p.fittedObservationIds)) failures.push(`Invalid fitted-data IDs: ${p.id}.`);
    if (!hasEvidence(p.evidence)) unknowns.push(`Parameter provenance missing: ${p.id}.`);
    if (p.role === 'controlled' && p.fittedObservationIds.length > 0) failures.push(`Fitted parameter mislabeled controlled: ${p.id}.`);
    if (p.role === 'calibrated' && p.fittedObservationIds.length === 0) unknowns.push(`Calibration lineage missing: ${p.id}.`);
    const d = p.distribution;
    if (d === null) { unknowns.push(`No parameter uncertainty distribution supplied: ${p.id}.`); continue; }
    if (d.kind === 'fixed') {
      if (!Number.isFinite(d.value)) failures.push(`Nonfinite fixed parameter: ${p.id}.`);
      if (p.role !== 'controlled') unknowns.push(`A fixed fitted/measured value does not disclose uncertainty: ${p.id}.`);
    } else if (d.kind === 'uniform') {
      if (!Number.isFinite(d.lower) || !Number.isFinite(d.upper) || d.upper <= d.lower) failures.push(`Invalid uniform distribution: ${p.id}.`);
    } else if (d.kind === 'normal') {
      if (!Number.isFinite(d.mean) || !Number.isFinite(d.standardDeviation) || d.standardDeviation <= 0) failures.push(`Invalid normal distribution: ${p.id}.`);
    } else if (d.values.length < 2 || d.values.length !== d.weights.length || !d.values.every(Number.isFinite)
      || !d.weights.every(w => Number.isFinite(w) && w > 0) || Math.abs(d.weights.reduce((sum, w) => sum + w, 0) - 1) > 1e-12) {
      failures.push(`Invalid empirical distribution/normalized positive weights: ${p.id}.`);
    }
  }
  return { status: failures.length ? 'fail' : unknowns.length ? 'unknown' : 'pass', reasons: sortedUnique([...failures, ...unknowns]) };
}
/** Typed schema input, not a raw JSON parser/downloader. Scaled errors are not p-values. */
export function evaluateValidation(a: ValidationAssessment): ValidationResult {
  const { plan, run } = a, reasons: string[] = [], evidence: string[] = [], metrics: Array<ValidationResult['metrics'][number]> = [];
  const finish = (status: VerificationStatus, reason?: string): ValidationResult => ({
    id: plan.id, status, validationStatus: a.mode === 'self-test' ? 'not-run' : status,
    claim: a.mode === 'self-test' ? 'schema-gate-self-test-only' : status === 'pass' ? 'matched-holdout-in-declared-domain-only' : 'no-validation-claim',
    applicability: plan.applicability, reasons: sortedUnique(reason ? [...reasons, reason] : reasons), evidence: sortedUnique(evidence),
    metrics: metrics.map(m => ({ ...m, gate: { ...m.gate, preregistrationEvidence: [...m.gate.preregistrationEvidence] } })),
  });
  if (![plan.id, plan.applicability, plan.independenceRationale].every(nonblank)
    || !uniqueIds(plan.calibrationObservationIds) || !uniqueIds(plan.holdoutObservationIds)
    || !uniqueIds(plan.requiredParameterIds) || !uniqueIds(plan.requiredVerificationIds)
    || plan.requiredParameterIds.length === 0 || plan.requiredVerificationIds.length === 0 || plan.gates.length === 0
    || !uniqueIds(plan.gates.map(g => g.quantity))) return finish('fail', 'Plan identity, disjoint-set identifiers, verification requirements and quantity gates are malformed.');
  const calibration = new Set(plan.calibrationObservationIds), holdout = new Set(plan.holdoutObservationIds);
  if ([...calibration].some(id => holdout.has(id))) return finish('fail', 'Calibration/holdout observation reuse.');
  for (const key of ['fittedObservationIds', 'modelSelectionObservationIds'] as const) {
    if (!uniqueIds(run[key]) || run[key].some(id => !calibration.has(id))) return finish('fail', 'Fitting/model selection used a non-calibration response, including possible holdout leakage.');
  }
  if (a.parameters.some(p => p.fittedObservationIds.some(id => !calibration.has(id)))) return finish('fail', 'Parameter fitting reused data outside the calibration partition.');
  if (run.state !== 'complete') {
    if (run.reason === null || !nonblank(run.reason)) return finish('fail', 'Incomplete prediction run lacks a reason.');
    return finish(run.state === 'failed' ? 'fail' : run.state, run.reason);
  }
  evidence.push(...plan.frozenModelEvidence, ...run.evidence);
  if (!hasEvidence(plan.frozenModelEvidence) || !hasEvidence(run.evidence)) return finish('unknown', 'Frozen-model/run provenance is missing.');
  if (!commitHash(plan.baselineCommit) || !sha256(plan.solverHash) || !sha256(plan.configurationHash) || !sha256(plan.parameterSetHash)) {
    return finish('unknown', 'Explicit baseline commit and solver/configuration/parameter SHA-256 identities are required.');
  }
  for (const key of ['baselineCommit', 'solverHash', 'configurationHash', 'parameterSetHash'] as const) {
    if (run[key] !== plan[key]) return finish('fail', `Prediction ${key} does not match the frozen plan.`);
  }
  const registered = timeValue(plan.registeredUtc), frozen = timeValue(plan.modelFrozenUtc);
  const unblinded = timeValue(plan.firstHoldoutResponseAccessUtc), generated = timeValue(run.generatedUtc);
  if ([registered, frozen, unblinded, generated].some(t => t === null)) return finish('unknown', 'Valid UTC preregistration/freeze/access/run timestamps are required.');
  if (registered! > frozen! || frozen! >= unblinded! || generated! < frozen!) return finish('fail', 'Plan/model was not frozen before holdout response access, or run predates the frozen model.');
  if (!uniqueIds(a.sources.map(s => s.id)) || !uniqueIds(a.observations.map(o => o.id))
    || !uniqueIds(run.predictions.map(p => p.observationId)) || !uniqueIds(a.verification.map(v => v.id))) return finish('fail', 'Duplicate or blank source, observation, prediction or verification IDs.');
  const parameterCheck = evaluateParameterEvidence(a.parameters);
  if (parameterCheck.status !== 'pass') { reasons.push(...parameterCheck.reasons); return finish(parameterCheck.status); }
  if (a.parameters.length !== plan.requiredParameterIds.length || plan.requiredParameterIds.some(id => !a.parameters.some(p => p.id === id))) return finish('unknown', 'The declared complete parameter set is not available.');
  evidence.push(...a.parameters.flatMap(p => p.evidence));
  for (const id of plan.requiredVerificationIds) {
    const v = a.verification.find(value => value.id === id);
    if (!v || !hasEvidence(v.evidence)) return finish('unknown', `Missing numerical verification evidence: ${id}.`);
    evidence.push(...v.evidence);
    if (v.baselineCommit !== plan.baselineCommit || v.solverHash !== plan.solverHash) return finish('fail', `Stale numerical verification identity: ${id}.`);
    if (v.origin !== 'solver-run' && a.mode !== 'self-test') return finish('inconclusive', 'Author self-tests/archived runs do not verify this prediction solver.');
    if (v.status !== 'pass') return finish(v.status === 'unknown' ? 'unknown' : 'inconclusive', `Required numerical verification is ${v.status}: ${id}.`);
  }
  const selectedIds = [...plan.calibrationObservationIds, ...plan.holdoutObservationIds], selected: ValidationObservation[] = [];
  const rawRecords = new Set<string>(), calibrationGroups = new Set<string>(); let synthetic = false;
  for (const id of selectedIds) {
    const o = a.observations.find(v => v.id === id); if (!o) return finish('unknown', `Missing observation ${id}.`);
    const source = a.sources.find(v => v.id === o.sourceId);
    if (!source || source.availability !== 'accessible' || !hasEvidence(source.accessEvidence)
      || !nonblank(source.citation) || !nonblank(source.locator) || !sha256(source.sha256)) return finish('unknown', `Accessible retained-source provenance missing for ${id}.`);
    synthetic ||= source.kind === 'synthetic'; evidence.push(source.locator, ...source.accessEvidence, ...o.independenceEvidence);
    if (!nonblank(o.rawRecordKey) || !nonblank(o.independenceGroup) || !hasEvidence(o.independenceEvidence) || !sha256(o.caseHash)) return finish('unknown', `Raw-record/independence/matched-case provenance missing for ${id}.`);
    const access = timeValue(source.firstResponseAccessUtc);
    if (access === null) return finish('unknown', `Source first-access record missing for ${id}.`);
    if (calibration.has(id) && access > frozen!) return finish('fail', 'Calibration evidence first accessed after the claimed model freeze.');
    if (holdout.has(id) && access < unblinded!) return finish('fail', 'Holdout responses were accessed earlier than the declared unblinding time.');
    const recordKey = `${source.sha256}:${o.rawRecordKey}`;
    if (rawRecords.has(recordKey)) return finish('fail', 'The same raw response record was copied under another observation ID.');
    rawRecords.add(recordKey); if (calibration.has(id)) calibrationGroups.add(o.independenceGroup);
    if (!Number.isFinite(o.value) || !Number.isFinite(o.timeS) || o.timeS < 0 || !nonblank(o.quantity) || !nonblank(o.unit) || !positionOK(o.positionM)) return finish('fail', `Invalid observation value/units/time/location: ${id}.`);
    const u = o.uncertainty;
    if (u === null || !hasEvidence(u.evidence) || !nonblank(u.basis) || !nonblank(u.coverageDescription)) return finish('unknown', `Observation uncertainty/provenance missing: ${id}.`);
    if (u.unit !== o.unit || !Number.isFinite(u.magnitude) || u.magnitude <= 0) return finish('fail', `Invalid uncertainty scale/dimension: ${id}.`);
    evidence.push(...u.evidence); selected.push(o);
  }
  if (selected.some(o => holdout.has(o.id) && calibrationGroups.has(o.independenceGroup))) return finish('fail', 'Shared specimen/trial/trajectory group spans calibration and holdout.');
  if (run.predictions.length !== holdout.size || run.predictions.some(p => !holdout.has(p.observationId))) return finish('fail', 'Expected exactly one prediction for every held-out observation and no extra response IDs.');
  const rows: Array<{ o: ValidationObservation; error: number; scaled: number; numericalFraction: number }> = [];
  for (const o of selected.filter(value => holdout.has(value.id))) {
    const p = run.predictions.find(value => value.observationId === o.id)!;
    if (p.unit !== o.unit || p.quantity !== o.quantity || p.caseHash !== o.caseHash || p.timeS !== o.timeS
      || !positionOK(p.positionM) || !samePosition(o.positionM, p.positionM)) return finish('fail', `Prediction is not matched in case, quantity, units, time or position: ${o.id}.`);
    if (!hasEvidence(p.matchingEvidence) || p.numericalError === null || !hasEvidence(p.numericalError.evidence)) return finish('unknown', `Prediction matching/numerical-error evidence missing: ${o.id}.`);
    const n = p.numericalError;
    if (!Number.isFinite(p.value) || !Number.isFinite(n.magnitude) || n.magnitude < 0 || n.unit !== o.unit) return finish('fail', `Invalid prediction or numerical error estimate: ${o.id}.`);
    const error = Math.abs(p.value - o.value), scaled = error / o.uncertainty!.magnitude, numericalFraction = n.magnitude / o.uncertainty!.magnitude;
    if (![error, scaled, numericalFraction].every(Number.isFinite)) return finish('fail', 'Residual arithmetic overflow.');
    evidence.push(...p.matchingEvidence, ...n.evidence); rows.push({ o, error, scaled, numericalFraction });
  }
  if (rows.some(r => !plan.gates.some(g => g.quantity === r.o.quantity))) return finish('fail', 'Held-out quantity has no preregistered gate.');
  let failed = false, underpowered = false;
  for (const gate of [...plan.gates].sort((a, b) => lexical(a.quantity, b.quantity))) {
    if (!nonblank(gate.unit) || !nonblank(gate.rationale) || !hasEvidence(gate.preregistrationEvidence)
      || ![gate.minimumObservations, gate.minimumIndependentGroups].every(n => Number.isSafeInteger(n) && n > 0)
      || gate.minimumIndependentGroups > gate.minimumObservations
      || ![gate.maximumAbsoluteError, gate.maximumScaledError, gate.maximumGroupRmsScaledError,
        gate.maximumNumericalUncertaintyFraction].every(n => Number.isFinite(n) && n >= 0)) return finish('fail', 'Malformed quantity gate or missing predeclared acceptance rationale/evidence.');
    evidence.push(...gate.preregistrationEvidence); const chosen = rows.filter(row => row.o.quantity === gate.quantity);
    if (chosen.some(row => row.o.unit !== gate.unit)) return finish('fail', 'Quantity gate and observation units disagree.');
    const groups = new Map<string, typeof chosen>();
    for (const row of chosen) { const group = groups.get(row.o.independenceGroup) ?? []; group.push(row); groups.set(row.o.independenceGroup, group); }
    if (chosen.length < gate.minimumObservations || groups.size < gate.minimumIndependentGroups) {
      underpowered = true; reasons.push(`Insufficient held-out observations/independent groups for ${gate.quantity}.`);
    }
    if (chosen.length === 0) continue;
    const maxAbsoluteError = chosen.reduce((m, r) => Math.max(m, r.error), 0), maxScaledError = chosen.reduce((m, r) => Math.max(m, r.scaled), 0);
    const maxNumericalFraction = chosen.reduce((m, r) => Math.max(m, r.numericalFraction), 0);
    const groupBalancedRmsError = stableRms([...groups.values()].map(group => stableRms(group.map(r => r.error))));
    const groupBalancedRmsScaledError = stableRms([...groups.values()].map(group => stableRms(group.map(r => r.scaled))));
    const errorsPassed = maxAbsoluteError <= gate.maximumAbsoluteError && maxScaledError <= gate.maximumScaledError
      && groupBalancedRmsScaledError <= gate.maximumGroupRmsScaledError && maxNumericalFraction <= gate.maximumNumericalUncertaintyFraction;
    const passed = errorsPassed && chosen.length >= gate.minimumObservations && groups.size >= gate.minimumIndependentGroups;
    if (!errorsPassed) failed = true;
    metrics.push({ quantity: gate.quantity, unit: gate.unit, observations: chosen.length, independentGroups: groups.size,
      maxAbsoluteError, maxScaledError, groupBalancedRmsError, groupBalancedRmsScaledError, maxNumericalFraction, passed,
      gate: { ...gate, preregistrationEvidence: [...gate.preregistrationEvidence] } });
  }
  if (failed) return finish('fail', 'At least one preregistered holdout error/uncertainty-budget gate failed.');
  if (underpowered) return finish('inconclusive', 'The planned holdout campaign is incomplete; finite predictions are not validation.');
  if (synthetic && a.mode === 'assessment') return finish('inconclusive', 'Synthetic observations cannot establish experimental validation.');
  return finish('pass', 'Only the matched held-out domain and predeclared descriptive error gates were assessed; no confidence probability or extrapolated field-performance claim.');
}
