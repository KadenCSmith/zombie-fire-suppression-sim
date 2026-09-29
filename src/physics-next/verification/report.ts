import type { ConservationResult } from './conservation';
import type { ConvergenceResult, VerificationStatus } from './convergence';
import type { ManufacturedResult } from './manufactured';
import { evaluateParameterEvidence, type ParameterEvidence, type ValidationResult } from './validation';

export interface ResponseRun {
  readonly id: string; readonly state: 'complete' | 'failed' | 'unknown' | 'not-run'; readonly reason: string | null;
  readonly response: number | null; readonly outputUnit: string; readonly baselineCommit: string; readonly solverHash: string;
  readonly fixedSettingsHash: string; readonly inputSampleHash: string; readonly evidence: readonly string[];
}
export interface SensitivityStudy {
  readonly id: string; readonly parameter: string; readonly parameterUnit: string; readonly outputUnit: string;
  readonly baselineCommit: string; readonly solverHash: string; readonly fixedSettingsHash: string;
  readonly spacingTolerance: { readonly value: number; readonly unit: string; readonly rationale: string };
  readonly minus: { readonly value: number; readonly run: ResponseRun };
  readonly center: { readonly value: number; readonly run: ResponseRun };
  readonly plus: { readonly value: number; readonly run: ResponseRun };
}
export interface SensitivitySummary {
  readonly id: string; readonly status: VerificationStatus; readonly claim: 'local-three-point-sensitivity-only';
  readonly derivative: number | null; readonly derivativeUnit: string; readonly curvature: number | null;
  readonly curvatureUnit: string; readonly elasticity: number | null; readonly reasons: readonly string[]; readonly evidence: readonly string[];
}
export interface UncertaintyEnsemble {
  readonly id: string; readonly design: 'probabilistic' | 'scenario-sweep'; readonly outputUnit: string;
  readonly baselineCommit: string; readonly solverHash: string; readonly fixedSettingsHash: string;
  readonly expectedSampleIds: readonly string[]; readonly parameters: readonly ParameterEvidence[];
  readonly dependence: { readonly kind: 'independent' | 'specified-joint' | 'unknown'; readonly rationale: string; readonly evidence: readonly string[] };
  readonly seedOrReplayId: string | null; readonly samplingEvidence: readonly string[];
  /** Equal-weight samples only; weighted output designs need a different estimator. */
  readonly samples: readonly ResponseRun[];
}
export interface UncertaintySummary {
  readonly id: string; readonly status: VerificationStatus; readonly claim: 'empirical-supplied-ensemble-only' | 'scenario-range-only';
  readonly unit: string; readonly expectedCount: number; readonly completeCount: number;
  readonly min: number | null; readonly max: number | null; readonly mean: number | null; readonly sampleStandardDeviation: number | null;
  readonly p05: number | null; readonly median: number | null; readonly p95: number | null;
  readonly reasons: readonly string[]; readonly evidence: readonly string[];
  readonly sampleStates: readonly { readonly id: string; readonly state: ResponseRun['state'] }[];
}
const lexical = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const nonblank = (s: string): boolean => s.trim().length > 0;
const uniqueText = (v: readonly string[]): string[] => [...new Set(v)].sort(lexical);
const hasEvidence = (v: readonly string[]): boolean => v.length > 0 && v.every(nonblank);
const finite = (n: number): number | null => Number.isFinite(n) ? n : null;
const sha = (s: string): boolean => /^[0-9a-f]{64}$/i.test(s);
const gitHash = (s: string): boolean => /^[0-9a-f]{40}$/i.test(s);
function identityMatched(expected: { readonly baselineCommit: string; readonly solverHash: string; readonly fixedSettingsHash: string }, actual: ResponseRun): boolean {
  return actual.baselineCommit === expected.baselineCommit && actual.solverHash === expected.solverHash && actual.fixedSettingsHash === expected.fixedSettingsHash;
}
function responseState(runs: readonly ResponseRun[]): VerificationStatus {
  if (runs.some(r => r.state === 'failed')) return 'fail';
  if (runs.length === 0 || runs.every(r => r.state === 'not-run')) return 'not-run';
  if (runs.some(r => r.state === 'unknown' || r.state === 'complete' && r.response === null)) return 'unknown';
  return runs.some(r => r.state === 'not-run') ? 'inconclusive' : 'pass';
}
export function summarizeSensitivity(s: SensitivityStudy): SensitivitySummary {
  const points = [s.minus, s.center, s.plus], runs = points.map(p => p.run);
  const evidence = uniqueText(runs.flatMap(r => r.evidence)), reasons: string[] = [];
  let derivative: number | null = null, curvature: number | null = null, elasticity: number | null = null;
  const finish = (status: VerificationStatus, reason?: string): SensitivitySummary => ({
    id: s.id, status, claim: 'local-three-point-sensitivity-only', derivative, derivativeUnit: `${s.outputUnit}/(${s.parameterUnit})`,
    curvature, curvatureUnit: `${s.outputUnit}/(${s.parameterUnit})^2`, elasticity,
    reasons: reason ? [...reasons, reason] : [...reasons], evidence: [...evidence],
  });
  if (![s.id, s.parameter, s.parameterUnit, s.outputUnit, s.spacingTolerance.rationale].every(nonblank)
    || !gitHash(s.baselineCommit) || !sha(s.solverHash) || !sha(s.fixedSettingsHash) || !points.every(p => Number.isFinite(p.value))
    || !Number.isFinite(s.spacingTolerance.value) || s.spacingTolerance.value < 0 || s.spacingTolerance.unit !== s.parameterUnit
    || new Set(runs.map(r => r.id)).size !== 3 || runs.some(r => !nonblank(r.id))) return finish('fail', 'Invalid sensitivity identity, units, finite perturbations, or spacing tolerance.');
  if (runs.some(r => !identityMatched(s, r) || r.outputUnit !== s.outputUnit)) return finish('fail', 'Sensitivity runs vary undeclared settings, solver identity or output units.');
  if (runs.some(r => r.response !== null && !Number.isFinite(r.response))) return finish('fail', 'Nonfinite sensitivity response.');
  if (runs.some(r => r.state !== 'complete' && (r.reason === null || !nonblank(r.reason)))) return finish('fail', 'Incomplete sensitivity run lacks a reason.');
  const state = responseState(runs); if (state !== 'pass') return finish(state, 'The declared three-point run set is not complete and successful.');
  if (runs.some(r => !hasEvidence(r.evidence) || !sha(r.inputSampleHash))) return finish('unknown', 'Sensitivity run or varied-input provenance is missing.');
  const hm = s.center.value - s.minus.value, hp = s.plus.value - s.center.value;
  if (!(hm > 0 && hp > 0) || !Number.isFinite(hm + hp)) return finish('fail', 'Perturbations must bracket the center with finite positive spacing.');
  if (s.spacingTolerance.value > 1e-6 * Math.min(hm, hp)) return finish('fail', 'Spacing tolerance may cover rounding, not genuinely asymmetric perturbations.');
  if (Math.abs(hm - hp) > s.spacingTolerance.value) return finish('inconclusive', 'Asymmetric perturbations do not satisfy this central-difference estimator.');
  const ym = runs[0].response!, y0 = runs[1].response!, yp = runs[2].response!, h = 0.5 * (hp + hm);
  derivative = finite((yp - ym) / (hp + hm)); curvature = finite(((yp - y0) / h - (y0 - ym) / h) / h);
  if (derivative === null || curvature === null) return finish('fail', 'Sensitivity arithmetic is outside finite range.');
  if (s.center.value !== 0 && y0 !== 0) {
    elasticity = finite(derivative * (s.center.value / y0));
    if (elasticity === null) reasons.push('Elasticity overflow; dimensional derivative remains available.');
  } else reasons.push('Elasticity undefined at a zero parameter/response reference; no arbitrary unit floor was introduced.');
  return finish('pass', 'Local derivative only; nonlinear regimes and interactions require additional designs.');
}
export function summarizeUncertainty(s: UncertaintyEnsemble): UncertaintySummary {
  let min: number | null = null, max: number | null = null, mean: number | null = null;
  let sd: number | null = null, p05: number | null = null, median: number | null = null, p95: number | null = null, completeCount = 0;
  const reasons: string[] = [], evidence = uniqueText([...s.samplingEvidence, ...s.dependence.evidence,
    ...s.parameters.flatMap(p => p.evidence), ...s.samples.flatMap(r => r.evidence)]);
  const finish = (status: VerificationStatus, reason?: string): UncertaintySummary => ({
    id: s.id, status, claim: s.design === 'probabilistic' ? 'empirical-supplied-ensemble-only' : 'scenario-range-only',
    unit: s.outputUnit, expectedCount: s.expectedSampleIds.length, completeCount, min, max, mean, sampleStandardDeviation: sd, p05, median, p95,
    reasons: uniqueText(reason ? [...reasons, reason] : reasons), evidence: [...evidence],
    sampleStates: s.expectedSampleIds.map(id => ({ id, state: s.samples.find(r => r.id === id)?.state ?? 'not-run' as const })).sort((a, b) => lexical(a.id, b.id)),
  });
  if (![s.id, s.outputUnit].every(nonblank) || !gitHash(s.baselineCommit) || !sha(s.solverHash) || !sha(s.fixedSettingsHash)
    || s.expectedSampleIds.length === 0 || !s.expectedSampleIds.every(nonblank) || new Set(s.expectedSampleIds).size !== s.expectedSampleIds.length
    || new Set(s.samples.map(r => r.id)).size !== s.samples.length || s.samples.some(r => !s.expectedSampleIds.includes(r.id))) return finish('fail', 'Malformed ensemble identity or duplicate/unplanned sample IDs.');
  if (s.samples.some(r => !identityMatched(s, r) || r.outputUnit !== s.outputUnit)) return finish('fail', 'Ensemble output units or frozen solver/configuration identities disagree.');
  if (s.samples.some(r => r.response !== null && !Number.isFinite(r.response))) return finish('fail', 'Nonfinite sample is an error, not a droppable outlier.');
  if (s.samples.some(r => r.state !== 'complete' && (r.reason === null || !nonblank(r.reason)))) return finish('fail', 'Incomplete ensemble member lacks a reason.');
  const values = s.samples.filter(r => r.state === 'complete' && r.response !== null).map(r => r.response!).sort((a, b) => a - b);
  completeCount = values.length;
  if (values.length) {
    min = values[0]; max = values[values.length - 1]; const scale = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    mean = scale === 0 ? 0 : finite(scale * (values.reduce((sum, v) => sum + v / scale, 0) / values.length));
    if (mean === null) return finish('fail', 'Sample mean overflow.');
    if (values.length > 1) {
      const deviations = values.map(v => v - mean!);
      if (!deviations.every(Number.isFinite)) return finish('fail', 'Sample deviation overflow.');
      const dScale = deviations.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      sd = dScale === 0 ? 0 : finite(dScale * Math.sqrt(deviations.reduce((sum, v) => sum + (v / dScale) ** 2, 0) / (values.length - 1)));
      if (sd === null) return finish('fail', 'Sample standard deviation overflow.');
    }
  }
  const state = responseState(s.samples);
  if (state !== 'pass') return finish(state, 'Incomplete/failed draws remain listed; available-sample moments are not a predictive distribution.');
  if (s.samples.length !== s.expectedSampleIds.length) return finish('inconclusive', 'Planned draws are missing; no quantiles from a success-only subset.');
  if (s.samples.some(r => !hasEvidence(r.evidence) || !sha(r.inputSampleHash))) return finish('unknown', 'Retained run/input-sample provenance is missing.');
  if (s.design === 'scenario-sweep') return finish('inconclusive', 'Deterministic scenario spread is not probabilistic uncertainty; percentile claims are withheld.');
  const parameters = evaluateParameterEvidence(s.parameters);
  if (s.parameters.length === 0 || parameters.status !== 'pass') {
    reasons.push(...parameters.reasons); return finish(parameters.status === 'fail' ? 'fail' : 'unknown', 'Explicit parameter distributions are required for probabilistic UQ.');
  }
  if (s.dependence.kind === 'unknown' || !nonblank(s.dependence.rationale) || !hasEvidence(s.dependence.evidence)
    || s.seedOrReplayId === null || !nonblank(s.seedOrReplayId) || !hasEvidence(s.samplingEvidence)) return finish('unknown', 'Dependence, sampling method, and seed/replay evidence must be supplied, not inferred.');
  if (values.length < 2) return finish('inconclusive', 'At least two supplied draws are needed for sample spread; Monte Carlo accuracy is not established.');
  const quantile = (probability: number): number => {
    const rank = (values.length - 1) * probability, lower = Math.floor(rank), weight = rank - lower;
    return (1 - weight) * values[lower] + weight * values[Math.min(lower + 1, values.length - 1)];
  };
  p05 = finite(quantile(0.05)); median = finite(quantile(0.5)); p95 = finite(quantile(0.95));
  if (p05 === null || median === null || p95 === null) return finish('fail', 'Empirical quantile arithmetic overflow.');
  return finish('pass', 'Linear-interpolated empirical quantiles of the supplied equal-weight draws; NOT a confidence interval, validated prediction interval, or claim of Monte Carlo convergence.');
}
export type ReportKind = 'conservation' | 'convergence' | 'manufactured' | 'validation' | 'sensitivity' | 'uncertainty';
export interface ReportIdentity {
  readonly reportId: string; readonly createdUtc: string; readonly baselineCommit: string; readonly archiveSha256: string;
  readonly solverHash: string; readonly hashDefinition: string;
  readonly solverFiles: readonly { readonly path: string; readonly sha256: string }[];
  readonly execution: 'proposal' | 'author-check' | 'solver-run';
}
export interface ReportEvidence {
  readonly id: string; readonly kind: 'source-inspection' | 'test-definition' | 'author-check' | 'solver-run' | 'archived-run' | 'experimental' | 'synthetic';
  readonly locator: string; readonly description: string; readonly availability: 'available' | 'unavailable' | 'unknown';
  readonly sha256: string | null; readonly baselineCommit: string | null; readonly solverHash: string | null;
}
interface EntryBase { readonly caseId: string; readonly evidenceIds: readonly string[] }
export type ReportEntry = EntryBase & (
  | { readonly kind: 'conservation'; readonly result: ConservationResult }
  | { readonly kind: 'convergence'; readonly result: ConvergenceResult }
  | { readonly kind: 'manufactured'; readonly result: ManufacturedResult }
  | { readonly kind: 'validation'; readonly result: ValidationResult }
  | { readonly kind: 'sensitivity'; readonly result: SensitivitySummary }
  | { readonly kind: 'uncertainty'; readonly result: UncertaintySummary }
);
export interface PlannedCheck { readonly kind: ReportKind; readonly caseId: string; readonly resultId: string; readonly required: boolean }
export interface VerificationReportInput {
  readonly identity: ReportIdentity; readonly plan: readonly PlannedCheck[];
  readonly evidence: readonly ReportEvidence[]; readonly entries: readonly ReportEntry[];
}
export type JsonValue = null | boolean | string | number | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export interface ReportRow {
  readonly key: string; readonly kind: ReportKind; readonly caseId: string; readonly resultId: string; readonly required: boolean;
  readonly reportedStatus: VerificationStatus; readonly status: VerificationStatus;
  readonly evidenceScope: 'solver-run' | 'author-check' | 'historical' | 'unknown'; readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly metrics: readonly { readonly name: string; readonly value: number | null; readonly unit: string; readonly limit: number | null }[];
  readonly details: JsonValue;
}
export interface RenderedVerificationReport {
  readonly data: JsonValue; readonly json: string; readonly markdown: string;
  readonly rows: readonly ReportRow[]; readonly serializationIssues: readonly string[];
}
/** Ordered arrays preserved; unsupported/nonfinite data become disclosed nulls. */
export function safeCanonicalData(value: unknown): { readonly value: JsonValue; readonly issues: readonly string[] } {
  const issues: string[] = [], active = new WeakSet<object>();
  function walk(v: unknown, path: string): JsonValue {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    if (typeof v === 'number') {
      if (Number.isFinite(v)) return Object.is(v, -0) ? 0 : v;
      issues.push(`${path}: nonfinite number replaced by null`); return null;
    }
    if (typeof v !== 'object') { issues.push(`${path}: unsupported ${typeof v} replaced by null`); return null; }
    if (active.has(v)) { issues.push(`${path}: cyclic reference replaced by null`); return null; } active.add(v);
    try {
      if (ArrayBuffer.isView(v)) {
        if (v instanceof DataView) { issues.push(`${path}: DataView replaced by null`); return null; }
        return Array.from(v as unknown as ArrayLike<unknown>, (item, i) => walk(item, `${path}[${i}]`));
      }
      if (Array.isArray(v)) return Array.from(v, (item, i) => walk(item, `${path}[${i}]`));
      if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) { issues.push(`${path}: non-plain object replaced by null`); return null; }
      const out: { [key: string]: JsonValue } = Object.create(null), descriptors = Object.getOwnPropertyDescriptors(v);
      for (const key of Object.keys(descriptors).sort(lexical)) {
        const d = descriptors[key]; if (!d.enumerable) continue;
        if (d.get || d.set) { issues.push(`${path}.${key}: accessor replaced by null`); out[key] = null; }
        else out[key] = walk(d.value, `${path}.${key}`);
      } return out;
    } finally { active.delete(v); }
  } return { value: walk(value, '$'), issues: uniqueText(issues) };
}
export function combineVerificationStatuses(statuses: readonly VerificationStatus[]): VerificationStatus {
  if (statuses.length === 0) return 'not-run';
  if (statuses.includes('fail')) return 'fail'; if (statuses.includes('unknown')) return 'unknown';
  if (statuses.includes('inconclusive')) return 'inconclusive';
  if (statuses.every(s => s === 'not-run')) return 'not-run'; return statuses.includes('not-run') ? 'inconclusive' : 'pass';
}
const checkKey = (kind: ReportKind, caseId: string, resultId: string): string => [kind, caseId, resultId].map(encodeURIComponent).join('/');
const escapeMarkdown = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').replace(/`/g, "'").replace(/\[/g, '\\[').replace(/\]/g, '\\]');
function linkDestination(locator: string): string | null {
  if (/[\u0000-\u0020\u007f]/.test(locator)) return null;
  if (/^https?:\/\//i.test(locator)) {
    try { const u = new URL(locator);
      if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
      return u.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
    } catch { return null; }
  }
  if (/^(?:docs|reports|tests)\/[a-zA-Z0-9_./%-]+$/.test(locator) && !locator.split('/').includes('..')) return locator;
  return null;
}
function validTimestamp(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)) return false;
  const time = Date.parse(s);
  return Number.isFinite(time) && new Date(time).toISOString() === (s.includes('.') ? s : s.replace('Z', '.000Z'));
}
function entryMetrics(entry: ReportEntry): ReportRow['metrics'] {
  if (entry.kind === 'conservation') return [{ name: 'physical residual', value: entry.result.physicalResidual, unit: entry.result.unit, limit: entry.result.tolerance.allowedResidual }];
  if (entry.kind === 'convergence') return [{ name: 'conditional fine-level error', value: entry.result.estimatedFineError, unit: entry.result.observableUnit, limit: entry.result.allowance }];
  if (entry.kind === 'manufactured') return entry.result.norms.flatMap(n => [
    { name: `${n.name} RMS`, value: n.rms, unit: n.unit, limit: n.tolerance }, { name: `${n.name} Linf`, value: n.linf, unit: n.unit, limit: n.tolerance }]);
  if (entry.kind === 'validation') return entry.result.metrics.flatMap(m => [
    { name: `${m.quantity} maximum error`, value: m.maxAbsoluteError, unit: m.unit, limit: m.gate.maximumAbsoluteError },
    { name: `${m.quantity} group RMS scaled`, value: m.groupBalancedRmsScaledError, unit: '1', limit: m.gate.maximumGroupRmsScaledError }]);
  if (entry.kind === 'sensitivity') return [
    { name: 'local derivative', value: entry.result.derivative, unit: entry.result.derivativeUnit, limit: null },
    { name: 'local curvature', value: entry.result.curvature, unit: entry.result.curvatureUnit, limit: null },
    { name: 'elasticity', value: entry.result.elasticity, unit: '1', limit: null }];
  return [{ name: 'sample mean', value: entry.result.mean, unit: entry.result.unit, limit: null },
    { name: 'empirical p05', value: entry.result.p05, unit: entry.result.unit, limit: null },
    { name: 'empirical p95', value: entry.result.p95, unit: entry.result.unit, limit: null }];
}
/** Runner must authenticate hashes/access and complete source dependency closure. */
export function buildVerificationReport(input: VerificationReportInput): RenderedVerificationReport {
  const { identity } = input;
  if (!nonblank(identity.reportId) || !nonblank(identity.hashDefinition) || !validTimestamp(identity.createdUtc)
    || !gitHash(identity.baselineCommit) || !sha(identity.archiveSha256) || !sha(identity.solverHash)
    || identity.solverFiles.length === 0 || new Set(identity.solverFiles.map(f => f.path)).size !== identity.solverFiles.length
    || identity.solverFiles.some(f => !nonblank(f.path) || f.path.startsWith('/') || f.path.split('/').includes('..') || !sha(f.sha256))) {
    throw new Error('Report requires an explicit valid timestamp, baseline/archive/solver identity and unique source-file hash manifest.');
  }
  const evidence = [...input.evidence].sort((a, b) => lexical(a.id, b.id));
  if (new Set(evidence.map(e => e.id)).size !== evidence.length || evidence.some(e => !nonblank(e.id))) throw new Error('Evidence registry IDs must be unique and nonblank.');
  const plans = new Map<string, PlannedCheck>();
  for (const plan of input.plan) {
    if (![plan.caseId, plan.resultId].every(nonblank)) throw new Error('Planned check identities must be nonblank.');
    const key = checkKey(plan.kind, plan.caseId, plan.resultId);
    if (plans.has(key)) throw new Error('Duplicate planned check.'); plans.set(key, plan);
  }
  if (plans.size === 0) throw new Error('Explicit planned checks are required, even for an unrun report.');
  const byKey = new Map<string, ReportEntry>();
  for (const entry of input.entries) {
    const key = checkKey(entry.kind, entry.caseId, entry.result.id);
    if (byKey.has(key)) throw new Error('Duplicate result; use an explicit distinct case/interval ID.');
    if (!plans.has(key)) throw new Error('Unplanned result; amend the declared campaign rather than silently omitting or cherry-picking checks.');
    byKey.set(key, entry);
  }
  const serializationIssues: string[] = [], rows: ReportRow[] = [];
  for (const [key, plan] of [...plans].sort(([a], [b]) => lexical(a, b))) {
    const entry = byKey.get(key);
    if (!entry) {
      rows.push({ key, kind: plan.kind, caseId: plan.caseId, resultId: plan.resultId, required: plan.required,
        reportedStatus: 'not-run', status: 'not-run', evidenceScope: 'unknown', reasons: ['Planned result was not supplied.'],
        evidenceIds: [], metrics: [], details: null }); continue;
    }
    const reportedStatus: VerificationStatus = entry.kind === 'validation' ? entry.result.validationStatus : entry.result.status;
    const converted = safeCanonicalData(entry.result), issues = converted.issues.map(issue => `${key}: ${issue}`);
    serializationIssues.push(...issues); let status = reportedStatus; const reasons: string[] = [], evidenceIds = uniqueText(entry.evidenceIds);
    const records = evidenceIds.map(id => evidence.find(e => e.id === id)), knownRecords = records.filter((e): e is ReportEvidence => e !== undefined);
    const available = records.length > 0 && records.every(e => e !== undefined && e.availability === 'available'
      && nonblank(e.description) && nonblank(e.locator) && e.sha256 !== null && sha(e.sha256)
      && (linkDestination(e.locator) !== null || e.kind === 'synthetic' || e.kind === 'author-check'));
    const runtime = knownRecords.filter(e => ['solver-run', 'author-check', 'archived-run'].includes(e.kind));
    const matched = runtime.length > 0 && runtime.every(e => e.baselineCommit === identity.baselineCommit && e.solverHash === identity.solverHash);
    const hasSolver = knownRecords.some(e => e.kind === 'solver-run') && matched;
    const selfTest = entry.kind === 'manufactured' && entry.result.claim === 'analytic-oracle-self-test-only'
      || entry.kind === 'validation' && entry.result.claim === 'schema-gate-self-test-only';
    let evidenceScope: ReportRow['evidenceScope'] = 'unknown';
    if (identity.execution === 'solver-run' && hasSolver && !selfTest) evidenceScope = 'solver-run';
    else if (identity.execution === 'author-check' && matched && knownRecords.some(e => e.kind === 'author-check')) evidenceScope = 'author-check';
    else if (knownRecords.some(e => e.kind === 'archived-run')) evidenceScope = 'historical';
    if (reportedStatus !== 'not-run' && (!available || !matched)) {
      status = 'unknown'; reasons.push('Result status is retained, but accessible evidence is missing or belongs to a different solver/source identity.');
    }
    if (reportedStatus === 'pass' && entry.kind === 'validation'
      && (evidenceScope !== 'solver-run' || !knownRecords.some(e => e.kind === 'experimental' && e.availability === 'available'))) {
      status = 'unknown'; reasons.push('Experimental validation requires matching solver-run and accessible experimental evidence, not author checks.');
    }
    if (issues.length) { status = 'fail'; reasons.push('Nonfinite or unsupported result data were replaced by null and explicitly recorded; the row cannot pass.'); }
    const rawMetrics = entryMetrics(entry);
    if (rawMetrics.some(m => m.value !== null && !Number.isFinite(m.value) || m.limit !== null && !Number.isFinite(m.limit))) {
      status = 'fail'; reasons.push('Nonfinite metric/tolerance encountered.');
    }
    rows.push({ key, kind: entry.kind, caseId: entry.caseId, resultId: entry.result.id, required: plan.required,
      reportedStatus, status, evidenceScope, reasons, evidenceIds,
      metrics: rawMetrics.map(m => ({ ...m, value: m.value === null ? null : finite(m.value), limit: m.limit === null ? null : finite(m.limit) }))
        .sort((a, b) => lexical(a.name, b.name)), details: converted.value });
  }
  const required = rows.filter(r => r.required);
  const current = (kinds: readonly ReportKind[]): VerificationStatus => combineVerificationStatuses(required.filter(r => kinds.includes(r.kind))
    .map(r => r.evidenceScope === 'solver-run' ? r.status : r.status === 'not-run' || r.evidenceScope === 'author-check' ? 'not-run' : 'unknown'));
  const summary = {
    currentSolverNumerical: current(['conservation', 'convergence', 'manufactured']),
    experimentalValidation: combineVerificationStatuses(required.filter(r => r.kind === 'validation').map(r => r.status)),
    currentSolverSensitivity: current(['sensitivity']), currentSolverUncertainty: current(['uncertainty']),
    observedAuthorChecks: combineVerificationStatuses(rows.filter(r => r.evidenceScope === 'author-check' && r.kind !== 'validation').map(r => r.status)),
    requiredChecks: required.length, suppliedRequiredChecks: required.filter(r => r.details !== null).length,
  };
  const payload = {
    schema: 'agent-c-verification-report/v1', identity: { ...identity, solverFiles: [...identity.solverFiles].sort((a, b) => lexical(a.path, b.path)) },
    summary, rows, evidence: evidence.map(e => ({ ...e })), serializationIssues: uniqueText(serializationIssues),
    boundaries: ['No overall combined pass is emitted: numerical verification and experimental validation are separate.',
      'Author-check and historical evidence cannot certify the current integrated solver.',
      'Sensitivity is local; empirical sample quantiles are not confidence or validated prediction intervals.',
      'Hashes and access flags must be authenticated by the actual acquisition/execution runner.'],
  };
  const converted = safeCanonicalData(payload), allIssues = uniqueText([...serializationIssues, ...converted.issues]);
  const completeData = safeCanonicalData({ ...payload, serializationIssues: allIssues }).value, json = JSON.stringify(completeData, null, 2) + '\n';
  const evidenceLabel = new Map(evidence.map((e, i) => [e.id, `E${String(i + 1).padStart(3, '0')}`]));
  const evidenceLink = (id: string): string => {
    const record = evidence.find(e => e.id === id), label = evidenceLabel.get(id) ?? `missing:${id}`, destination = record ? linkDestination(record.locator) : null;
    return destination ? `[${escapeMarkdown(label)}](${destination})` : escapeMarkdown(label);
  };
  const number = (value: number | null): string => value === null ? 'unknown / not applicable' : value.toPrecision(9).replace(/(?:\.0+|(\.\d*?)0+)(e|$)/, '$1$2');
  const lines = [
    `# Verification report — ${escapeMarkdown(identity.reportId)}`, '',
    `Execution class: **${identity.execution}**. Created: ${identity.createdUtc}.`,
    `Baseline: \`${identity.baselineCommit}\`. Archive SHA-256: \`${identity.archiveSha256}\`.`,
    `Solver SHA-256: \`${identity.solverHash}\`. Hash definition: ${escapeMarkdown(identity.hashDefinition)}.`, '',
    '| Evidence-bound summary | Status |', '|---|---|',
    `| Current-solver numerical verification | ${summary.currentSolverNumerical} |`,
    `| Experimental holdout validation | ${summary.experimentalValidation} |`,
    `| Current-solver local sensitivity | ${summary.currentSolverSensitivity} |`,
    `| Current-solver supplied-ensemble UQ | ${summary.currentSolverUncertainty} |`,
    `| Observed author-only checks | ${summary.observedAuthorChecks} |`, '',
    `Supplied required results: ${summary.suppliedRequiredChecks}/${summary.requiredChecks}. A supplied result is not automatically a pass.`,
    '', '| Check | Effective / reported status | Evidence scope | Values and dimensioned limits | Evidence |', '|---|---|---|---|---|',
    ...rows.map(row => {
      const values = row.metrics.map(m => `${escapeMarkdown(m.name)}: ${number(m.value)} ${escapeMarkdown(m.unit)}`
        + (m.limit === null ? '' : `; limit ${number(m.limit)} ${escapeMarkdown(m.unit)}`)).join('; ') || 'No evaluated metric';
      return `| ${escapeMarkdown(row.key)} | ${row.status} / ${row.reportedStatus} | ${row.evidenceScope} | ${values} | ${row.evidenceIds.map(evidenceLink).join(', ') || 'None'} |`;
    }), '', '## Evidence', '',
    ...evidence.map(e => {
      const destination = linkDestination(e.locator), label = evidenceLabel.get(e.id)!;
      const location = destination ? `[${escapeMarkdown(e.description)}](${destination})` : `${escapeMarkdown(e.description)} — ${escapeMarkdown(e.locator)}`;
      return `**${label} — ${escapeMarkdown(e.id)}** (${e.kind}; ${e.availability}): ${location}. SHA-256: ${e.sha256 && sha(e.sha256) ? `\`${e.sha256}\`` : 'unknown'}.`;
    }), '', '## Limits and unresolved evidence', '',
    ...rows.flatMap(row => row.reasons.map(reason => `${escapeMarkdown(row.key)}: ${escapeMarkdown(reason)}`)),
    ...payload.boundaries.map(escapeMarkdown),
    ...(allIssues.length ? ['', '## Serialization issues', '', ...allIssues.map(escapeMarkdown)] : []), '',
    'The JSON retains all available residuals, norm/gate details, sample states and provenance. No pass here establishes performance outside the declared evidence and applicability.', '',
  ];
  return { data: completeData, json, markdown: lines.join('\n'), rows: rows.map(r => ({ ...r })), serializationIssues: allIssues };
}
