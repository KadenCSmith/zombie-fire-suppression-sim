import { describe, expect, it } from 'vitest';
import { evaluateConvergence, type ConvergenceStudy, type RefinementRun } from '../../../src/physics-next/verification/convergence';
function analytic(axis: 'mesh' | 'time' = 'mesh', order = 2) {
  const decision = () => ({ value: true, evidence: ['synthetic://analytic-leading-error'] });
  const study: ConvergenceStudy = {
    id: `analytic-${axis}`, axis, resolutionUnit: axis === 'mesh' ? 'm' : 's',
    observable: 'Declared scalar analytic mode', observableUnit: 'K',
    problemHash: 'synthetic-problem', solverHash: 'synthetic-model', fixedSettingsHash: 'synthetic-fixed',
    refinementDescription: 'h or dt halves; all other numerical/physical settings held fixed.',
    assumptions: { sameContinuumProblem: decision(), systematicRefinement: decision(), otherAxisControlled: decision(), smoothRegime: decision() },
    policy: { expectedOrder: order, orderTolerance: 0.01, maxOrderSpread: 0.01, ratioTolerance: 1e-12,
      absoluteNoiseFloor: 1e-12, relativeNoiseFloor: 1e-14, absoluteError: 1, relativeError: 0, reference: 2,
      rationale: 'Synthetic estimator regression only.', referenceRationale: 'Exact limit 2 K.' },
  };
  const runs: RefinementRun[] = [1, 0.5, 0.25, 0.125].map((resolution, i) => ({
    id: `level-${i}`, status: 'complete', reason: null, resolution, value: 2 + 3 * resolution ** order,
    observableUnit: 'K', physicalTimeS: 1, problemHash: study.problemHash, solverHash: study.solverHash,
    fixedSettingsHash: study.fixedSettingsHash, evidence: ['synthetic://analytic-leading-error'],
  }));
  return { study, runs };
}
describe('ordered, conditional convergence', () => {
  for (const [axis, p] of [['mesh', 2], ['time', 1]] as const) {
    it(`recovers order ${p} and the analytic limit for ${axis}`, () => {
      const f = analytic(axis, p), r = evaluateConvergence(f.study, f.runs);
      expect(r.status).toBe('pass'); expect(r.observedOrders).toHaveLength(2);
      for (const order of r.observedOrders) expect(Math.abs(order - p)).toBeLessThan(1e-12);
      expect(r.richardsonLimit).toBeCloseTo(2, 12); expect(r.estimatedFineError).toBeCloseTo(f.runs[3].value! - 2, 12);
      expect(r.claim).toBe('conditional-discretization-estimate-only');
    });
  }
  it('retains an error-budget failure without deleting the valid conditional estimate', () => {
    const f = analytic(); f.study = { ...f.study, policy: { ...f.study.policy, absoluteError: 0.001 } };
    const r = evaluateConvergence(f.study, f.runs);
    expect(r.status).toBe('fail'); expect(r.estimatedFineError!).toBeGreaterThan(0.001);
  });
  it('requires four levels to test order stability', () => {
    const f = analytic(), r = evaluateConvergence(f.study, f.runs.slice(0, 3));
    expect(r.status).toBe('inconclusive'); expect(r.richardsonLimit).toBeNull();
  });
  it('does not invent accuracy for nonmonotone, noisy or constant sequences', () => {
    for (const values of [[5, 2.75, 3, 2.1], [5, 3, 2.9, 2.899], [2, 2, 2, 2]]) {
      const f = analytic(), r = evaluateConvergence(f.study, f.runs.map((run, i) => ({ ...run, value: values[i] })));
      expect(r.status).toBe('inconclusive'); expect(r.richardsonLimit).toBeNull();
    }
  });
  it('rejects reordered runs and duplicate identities rather than silently sorting', () => {
    const f = analytic();
    expect(evaluateConvergence(f.study, [...f.runs].reverse()).status).toBe('fail');
    expect(evaluateConvergence(f.study, f.runs.map(r => ({ ...r, id: 'same' }))).status).toBe('fail');
  });
  it('does not apply a uniform-ratio formula to nonuniform refinement', () => {
    const f = analytic(); f.runs[2] = { ...f.runs[2], resolution: 0.3 };
    expect(evaluateConvergence(f.study, f.runs).status).toBe('inconclusive');
  });
  it('fails the expected-order gate even for a stable wrong order', () => {
    const f = analytic('mesh', 1); f.study = { ...f.study, policy: { ...f.study.policy, expectedOrder: 2 } };
    const r = evaluateConvergence(f.study, f.runs); expect(r.status).toBe('fail'); expect(r.richardsonLimit).toBeNull();
  });
  it('keeps unknown, failed, unrun and incomplete sequences distinct', () => {
    const f = analytic(); expect(evaluateConvergence(f.study, []).status).toBe('not-run');
    for (const [status, expected] of [['unknown', 'unknown'], ['failed', 'fail'], ['not-run', 'inconclusive']] as const) {
      const runs = f.runs.map((r, i) => i === 2 ? { ...r, status, value: null, reason: 'Fixture state' } : r);
      const result = evaluateConvergence(f.study, runs); expect(result.status).toBe(expected); expect(result.richardsonLimit).toBeNull();
    }
    expect(evaluateConvergence(f.study, f.runs.map(r => ({ ...r, status: 'not-run', value: null, reason: 'Not executed' }))).status).toBe('not-run');
  });
  it('rejects incompatible lineage, physical times and units; missing provenance stays unknown', () => {
    const f = analytic();
    for (const patch of [{ solverHash: 'other' }, { problemHash: 'other' }, { fixedSettingsHash: 'other' }, { physicalTimeS: 2 }, { observableUnit: 'm' }]) {
      expect(evaluateConvergence(f.study, f.runs.map((r, i) => i === 0 ? { ...r, ...patch } : r)).status).toBe('fail');
    }
    expect(evaluateConvergence(f.study, f.runs.map(r => ({ ...r, evidence: [] }))).status).toBe('unknown');
    expect(evaluateConvergence(f.study, f.runs.map(r => ({ ...r, value: null }))).status).toBe('unknown');
  });
  it('does not infer asymptotic assumptions from decreasing numbers alone', () => {
    const f = analytic();
    for (const [value, expected] of [[null, 'unknown'], [false, 'inconclusive']] as const) {
      const study = { ...f.study, assumptions: { ...f.study.assumptions, smoothRegime: { value, evidence: ['synthetic://nonsmooth-regime'] } } };
      expect(evaluateConvergence(study, f.runs).status).toBe(expected);
    }
  });
  it('fails invalid numerical policies and keeps serialized result numbers finite', () => {
    const f = analytic(), r = evaluateConvergence(f.study, f.runs.map((run, i) => i === 3 ? { ...run, value: Infinity } : run));
    expect(r.status).toBe('fail'); expect(r.runs[3].value).toBeNull(); expect(JSON.stringify(r)).not.toContain('Infinity');
    expect(evaluateConvergence({ ...f.study, policy: { ...f.study.policy, absoluteError: -1 } }, f.runs).status).toBe('fail');
  });
  it('preserves frozen inputs and returns detached evidence/runs', () => {
    const f = analytic(), before = JSON.stringify(f);
    for (const run of f.runs) { Object.freeze(run.evidence); Object.freeze(run); } Object.freeze(f.runs);
    const r = evaluateConvergence(f.study, f.runs);
    expect(r.status).toBe('pass'); expect(JSON.stringify(f)).toBe(before); expect(r.runs).not.toBe(f.runs); expect(r.evidence).not.toBe(f.runs[0].evidence);
  });
});
