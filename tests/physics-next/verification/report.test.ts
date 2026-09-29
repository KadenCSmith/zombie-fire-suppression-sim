import { describe, expect, it } from 'vitest';
import {
  summarizeSensitivity, summarizeUncertainty, buildVerificationReport, safeCanonicalData, combineVerificationStatuses,
  type ResponseRun, type SensitivityStudy, type UncertaintyEnsemble, type VerificationReportInput,
} from '../../../src/physics-next/verification/report';
import { buildVerificationReport as fromIndex } from '../../../src/physics-next/verification/index';
import { scalarFixture, runFixture } from '../../fixtures/physics-next/conservationFixtures';
import { syntheticValidationAssessment } from '../../fixtures/physics-next/validationFixtures';
import { evaluateValidation } from '../../../src/physics-next/verification/validation';
// Synthetic metadata, not actual artifact/source attestations.
const BASE = 'a'.repeat(40), SOLVER = 'b'.repeat(64), FIXED = 'c'.repeat(64);
function response(id: string, value: number): ResponseRun {
  return { id, state: 'complete', reason: null, response: value, outputUnit: 'K', baselineCommit: BASE,
    solverHash: SOLVER, fixedSettingsHash: FIXED, inputSampleHash: 'd'.repeat(64), evidence: ['synthetic://response-fixture'] };
}
function sensitivity(): SensitivityStudy {
  return { id: 'local-quadratic', parameter: 'controlled-input', parameterUnit: 'm', outputUnit: 'K',
    baselineCommit: BASE, solverHash: SOLVER, fixedSettingsHash: FIXED,
    spacingTolerance: { value: 1e-12, unit: 'm', rationale: 'Synthetic rounding allowance only.' },
    minus: { value: 0, run: response('minus', 0) }, center: { value: 1, run: response('center', 1) }, plus: { value: 2, run: response('plus', 4) } };
}
function ensemble(): UncertaintyEnsemble {
  return { id: 'synthetic-supplied-ensemble', design: 'probabilistic', outputUnit: 'K',
    baselineCommit: BASE, solverHash: SOLVER, fixedSettingsHash: FIXED,
    expectedSampleIds: ['a', 'b', 'c'], samples: [response('a', 0), response('b', 1), response('c', 2)],
    parameters: [{ id: 'example-input', unit: 'm', role: 'measured', fittedObservationIds: [],
      distribution: { kind: 'uniform', lower: 0, upper: 2 }, evidence: ['synthetic://distribution'] }],
    dependence: { kind: 'independent', rationale: 'Explicit synthetic design assumption.', evidence: ['synthetic://sampling'] },
    seedOrReplayId: 'synthetic-replay-set-v1', samplingEvidence: ['synthetic://sampling'] };
}
function reportInput(): VerificationReportInput {
  const result = runFixture(scalarFixture());
  return {
    identity: { reportId: 'synthetic-author-report', createdUtc: '2020-01-01T00:00:00Z',
      baselineCommit: BASE, archiveSha256: 'e'.repeat(64), solverHash: SOLVER, hashDefinition: 'Synthetic mock bundle ID; not an actual hash computation.',
      solverFiles: [{ path: 'src/physics-next/verification/conservation.ts', sha256: 'f'.repeat(64) }], execution: 'author-check' },
    plan: [{ kind: 'conservation', caseId: 'synthetic-ledger', resultId: result.id, required: true }],
    entries: [{ kind: 'conservation', caseId: 'synthetic-ledger', result, evidenceIds: ['author-check'] }],
    evidence: [{ id: 'author-check', kind: 'author-check', description: 'Synthetic author-test record',
      locator: 'reports/synthetic-author-check.json', availability: 'available', sha256: '1'.repeat(64), baselineCommit: BASE, solverHash: SOLVER }],
  };
}
describe('local sensitivity and supplied-ensemble uncertainty', () => {
  it('recovers a dimensional local derivative/curvature without ranking global importance', () => {
    const r = summarizeSensitivity(sensitivity());
    expect(r.status).toBe('pass'); expect(r.derivative).toBe(2); expect(r.curvature).toBe(2);
    expect(r.derivativeUnit).toBe('K/(m)'); expect(r.elasticity).toBe(2); expect(r.claim).toBe('local-three-point-sensitivity-only');
  });
  it('retains zero-reference elasticity as undefined rather than adding an arbitrary scale', () => {
    const s = sensitivity(), r = summarizeSensitivity({ ...s, minus: { value: -1, run: response('minus', 1) },
      center: { value: 0, run: response('center', 0) }, plus: { value: 1, run: response('plus', 1) } });
    expect(r.status).toBe('pass'); expect(r.derivative).toBe(0); expect(r.elasticity).toBeNull();
  });
  it('distinguishes asymmetric, missing, failed and mismatched sensitivity runs', () => {
    const s = sensitivity();
    expect(summarizeSensitivity({ ...s, plus: { ...s.plus, value: 2.1 } }).status).toBe('inconclusive');
    expect(summarizeSensitivity({ ...s, spacingTolerance: { ...s.spacingTolerance, value: 1 } }).status).toBe('fail');
    for (const [state, expected] of [['unknown', 'unknown'], ['failed', 'fail'], ['not-run', 'inconclusive']] as const) {
      expect(summarizeSensitivity({ ...s, plus: { ...s.plus, run: { ...s.plus.run, state, response: null, reason: 'Fixture state' } } }).status).toBe(expected);
    }
    expect(summarizeSensitivity({ ...s, plus: { ...s.plus, run: { ...s.plus.run, fixedSettingsHash: 'f'.repeat(64) } } }).status).toBe('fail');
  });
  it('calculates descriptive equal-weight empirical quantiles without normality assumptions', () => {
    const r = summarizeUncertainty(ensemble()); expect(r.status).toBe('pass'); expect(r.mean).toBe(1); expect(r.sampleStandardDeviation).toBe(1);
    expect(r.p05).toBeCloseTo(0.1, 12); expect(r.median).toBe(1); expect(r.p95).toBeCloseTo(1.9, 12);
    expect(r.claim).toBe('empirical-supplied-ensemble-only');
  });
  it('withholds probability claims for a deterministic scenario sweep or absent input/dependence distributions', () => {
    const s = ensemble(), sweep = summarizeUncertainty({ ...s, design: 'scenario-sweep' });
    expect(sweep.status).toBe('inconclusive'); expect(sweep.min).toBe(0); expect(sweep.p95).toBeNull();
    expect(summarizeUncertainty({ ...s, parameters: s.parameters.map(p => ({ ...p, distribution: null })) }).status).toBe('unknown');
    expect(summarizeUncertainty({ ...s, dependence: { ...s.dependence, kind: 'unknown' } }).status).toBe('unknown');
  });
  it('does not drop missing/failed draws to manufacture success-only quantiles', () => {
    const s = ensemble(), missing = summarizeUncertainty({ ...s, samples: s.samples.slice(0, 2) });
    expect(missing.status).toBe('inconclusive'); expect(missing.completeCount).toBe(2); expect(missing.p95).toBeNull();
    const failed = summarizeUncertainty({ ...s, samples: s.samples.map((r, i) => i === 2 ? { ...r, state: 'failed', response: null, reason: 'Solver rejected' } : r) });
    expect(failed.status).toBe('fail'); expect(failed.p95).toBeNull(); expect(failed.sampleStates[2].state).toBe('failed');
    expect(summarizeUncertainty({ ...s, samples: [] }).status).toBe('not-run');
  });
  it('rejects duplicate draws, nonfinite outputs and inconsistent metadata explicitly', () => {
    const s = ensemble();
    expect(summarizeUncertainty({ ...s, samples: [s.samples[0], s.samples[0]] }).status).toBe('fail');
    expect(summarizeUncertainty({ ...s, samples: [response('a', Infinity)] }).status).toBe('fail');
    expect(summarizeUncertainty({ ...s, samples: s.samples.map(r => ({ ...r, outputUnit: 'm' })) }).status).toBe('fail');
  });
  it('has order-independent sample summaries and does not mutate its inputs', () => {
    const s = ensemble(), before = JSON.stringify(s), r = summarizeUncertainty(s);
    expect(summarizeUncertainty({ ...s, samples: [...s.samples].reverse(), expectedSampleIds: [...s.expectedSampleIds].reverse() })).toEqual(r);
    expect(JSON.stringify(s)).toBe(before);
  });
});
describe('deterministic evidence-bound reporting', () => {
  it('exports the public builder and keeps author checks separate from numerical/experimental certification', () => {
    expect(fromIndex).toBe(buildVerificationReport); const r = buildVerificationReport(reportInput()), data = JSON.parse(r.json);
    expect(data.summary.observedAuthorChecks).toBe('pass'); expect(data.summary.currentSolverNumerical).toBe('not-run');
    expect(data.summary.experimentalValidation).toBe('not-run'); expect(r.markdown).toContain('[E001](reports/synthetic-author-check.json)');
    expect(r.markdown).toContain(BASE); expect(r.markdown).toContain(SOLVER);
  });
  it('sorts rows and evidence while preserving scientific array order', () => {
    const f = reportInput(), second = { ...f.entries[0], caseId: 'another-case' };
    const input = { ...f, entries: [...f.entries, second], plan: [...f.plan, { ...f.plan[0], caseId: 'another-case' }],
      evidence: [...f.evidence, { ...f.evidence[0], id: 'unused-reference' }] };
    const r = buildVerificationReport(input), reversed = buildVerificationReport({ ...input, entries: [...input.entries].reverse(),
      evidence: [...input.evidence].reverse(), plan: [...input.plan].reverse() });
    expect(reversed.json).toBe(r.json); expect(reversed.markdown).toBe(r.markdown);
    expect(JSON.stringify(safeCanonicalData({ z: [3, 2, 1], a: 1 }).value)).toBe('{"a":1,"z":[3,2,1]}');
  });
  it('lists missing planned checks as not-run rather than silently omitting them', () => {
    const f = reportInput(), r = buildVerificationReport({ ...f, entries: [] });
    expect(r.rows).toHaveLength(1); expect(r.rows[0].status).toBe('not-run'); expect(JSON.parse(r.json).summary.suppliedRequiredChecks).toBe(0);
  });
  it('downgrades stale or unavailable provenance while retaining the originally reported status', () => {
    const f = reportInput();
    for (const evidence of [[], f.evidence.map(e => ({ ...e, solverHash: 'f'.repeat(64) }))]) {
      const r = buildVerificationReport({ ...f, evidence }); expect(r.rows[0].status).toBe('unknown'); expect(r.rows[0].reportedStatus).toBe('pass');
    }
  });
  it('cannot promote a successful schema self-test to experimental validation', () => {
    const f = reportInput(), result = evaluateValidation(syntheticValidationAssessment());
    const r = buildVerificationReport({ ...f, plan: [{ kind: 'validation', caseId: 'schema-test', resultId: result.id, required: true }],
      entries: [{ kind: 'validation', caseId: 'schema-test', result, evidenceIds: ['author-check'] }] });
    expect(r.rows[0].status).toBe('not-run'); expect(JSON.parse(r.json).summary.experimentalValidation).toBe('not-run');
  });
  it('serializes malformed nonfinite result numbers as disclosed nulls and fails the row', () => {
    const f = reportInput(), result = { ...runFixture(scalarFixture()), physicalResidual: Infinity };
    const r = buildVerificationReport({ ...f, entries: [{ kind: 'conservation', caseId: 'synthetic-ledger', evidenceIds: ['author-check'], result }] });
    expect(r.rows[0].status).toBe('fail'); expect(r.serializationIssues.length).toBeGreaterThan(0);
    expect(JSON.parse(r.json).rows[0].details.physicalResidual).toBeNull(); expect(JSON.parse(r.json).serializationIssues.length).toBeGreaterThan(0);
    expect(r.json).not.toContain('Infinity');
  });
  it('discloses unsupported/cyclic data instead of executing accessors or emitting invalid JSON', () => {
    const input: { values: unknown[]; cycle?: unknown } = { values: [NaN, Infinity, undefined, 1n] }; input.cycle = input;
    const r = safeCanonicalData(input); expect(r.issues).toHaveLength(5); expect(JSON.parse(JSON.stringify(r.value)).values).toEqual([null, null, null, null]);
    const object = Object.defineProperty({}, 'x', { enumerable: true, get: () => { throw new Error('Must not invoke getter'); } });
    expect(safeCanonicalData(object).issues).toHaveLength(1);
  });
  it('rejects missing identity, duplicate/unplanned results and duplicate evidence', () => {
    const f = reportInput();
    expect(() => buildVerificationReport({ ...f, identity: { ...f.identity, solverHash: '' } })).toThrow();
    expect(() => buildVerificationReport({ ...f, entries: [...f.entries, ...f.entries] })).toThrow(/Duplicate/);
    expect(() => buildVerificationReport({ ...f, entries: [{ ...f.entries[0], caseId: 'unplanned' }] })).toThrow(/Unplanned/);
    expect(() => buildVerificationReport({ ...f, evidence: [...f.evidence, ...f.evidence] })).toThrow(/unique/);
  });
  it('escapes user-provided Markdown/HTML text and does not activate unsafe evidence schemes', () => {
    const f = reportInput(), caseId = '<script>| [click](javascript:alert(1))';
    const r = buildVerificationReport({ ...f, plan: f.plan.map(p => ({ ...p, caseId })), entries: f.entries.map(e => ({ ...e, caseId })),
      evidence: f.evidence.map(e => ({ ...e, locator: 'javascript:alert(1)', description: '<script>alert(1)</script>' })) });
    expect(r.markdown).not.toContain('<script>'); expect(r.markdown).not.toContain('](javascript:');
  });
  it('keeps all five statuses distinct in aggregate gates', () => {
    expect(combineVerificationStatuses([])).toBe('not-run');
    expect(combineVerificationStatuses(['pass', 'not-run'])).toBe('inconclusive');
    expect(combineVerificationStatuses(['unknown', 'pass'])).toBe('unknown');
    expect(combineVerificationStatuses(['fail', 'unknown'])).toBe('fail');
    expect(combineVerificationStatuses(['pass', 'pass'])).toBe('pass');
  });
});
