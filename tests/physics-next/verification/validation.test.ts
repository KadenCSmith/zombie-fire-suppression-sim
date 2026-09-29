import { describe, expect, it } from 'vitest';
import {
  evaluateValidation, evaluateParameterEvidence, type ValidationAssessment, type ValidationObservation,
} from '../../../src/physics-next/verification/validation';
import { syntheticValidationAssessment } from '../../fixtures/physics-next/validationFixtures';
function observationPatch(a: ValidationAssessment, id: string, patch: Partial<ValidationObservation>): ValidationAssessment {
  return { ...a, observations: a.observations.map(o => o.id === id ? { ...o, ...patch } : o) };
}
describe('holdout validation and uncertainty evidence', () => {
  it('checks synthetic success logic without asserting experimental validation', () => {
    const a = syntheticValidationAssessment(), r = evaluateValidation(a);
    expect(r.status).toBe('pass'); expect(r.validationStatus).toBe('not-run'); expect(r.claim).toBe('schema-gate-self-test-only');
    expect(r.metrics[0].maxAbsoluteError).toBe(0.25); expect(r.metrics[0].groupBalancedRmsScaledError).toBe(0.5);
  });
  it('never promotes numerical self-tests or synthetic data to experimental validation', () => {
    let a = syntheticValidationAssessment('assessment'); expect(evaluateValidation(a).status).toBe('inconclusive');
    a = { ...a, verification: a.verification.map(v => ({ ...v, origin: 'solver-run' })) };
    const r = evaluateValidation(a); expect(r.status).toBe('inconclusive'); expect(r.validationStatus).not.toBe('pass'); expect(r.claim).toBe('no-validation-claim');
  });
  it('blocks missing observation uncertainty or inaccessible provenance', () => {
    const a = syntheticValidationAssessment();
    expect(evaluateValidation(observationPatch(a, 'h1', { uncertainty: null })).status).toBe('unknown');
    expect(evaluateValidation({ ...a, sources: a.sources.map(s => ({ ...s, availability: 'unavailable' })) }).status).toBe('unknown');
    expect(evaluateValidation({ ...a, sources: a.sources.map(s => ({ ...s, accessEvidence: [] })) }).status).toBe('unknown');
  });
  it('blocks calibration IDs, aliased raw records and shared trajectory groups from holdout', () => {
    const a = syntheticValidationAssessment();
    expect(evaluateValidation({ ...a, plan: { ...a.plan, holdoutObservationIds: ['c1', 'h2'] } }).status).toBe('fail');
    expect(evaluateValidation(observationPatch(a, 'h1', { independenceGroup: 'calibration-trial' })).status).toBe('fail');
    const duplicateSource = { ...a, sources: a.sources.map(s => ({ ...s, sha256: '1'.repeat(64) })) };
    expect(evaluateValidation(observationPatch(duplicateSource, 'h1', { rawRecordKey: 'c1' })).status).toBe('fail');
  });
  it('rejects fitting/model selection or parameter estimation using held-out responses', () => {
    const a = syntheticValidationAssessment();
    expect(evaluateValidation({ ...a, run: { ...a.run, fittedObservationIds: ['h1'] } }).status).toBe('fail');
    expect(evaluateValidation({ ...a, run: { ...a.run, modelSelectionObservationIds: ['h2'] } }).status).toBe('fail');
    expect(evaluateValidation({ ...a, parameters: a.parameters.map(p => ({ ...p, fittedObservationIds: ['h1'] })) }).status).toBe('fail');
  });
  it('requires frozen thresholds/model before response unblinding and preserves strict UTC dates', () => {
    const a = syntheticValidationAssessment();
    expect(evaluateValidation({ ...a, plan: { ...a.plan, modelFrozenUtc: '2020-01-05T00:00:00Z' } }).status).toBe('fail');
    expect(evaluateValidation({ ...a, plan: { ...a.plan, registeredUtc: '2020-02-30T00:00:00Z' } }).status).toBe('unknown');
    expect(evaluateValidation({ ...a, run: { ...a.run, solverHash: 'f'.repeat(64) } }).status).toBe('fail');
  });
  it('requires predictions at matching case, unit, time and position', () => {
    const a = syntheticValidationAssessment();
    for (const patch of [{ unit: 'C' }, { timeS: 100 }, { caseHash: 'f'.repeat(64) }, { positionM: null }]) {
      const run = { ...a.run, predictions: a.run.predictions.map((p, i) => i === 0 ? { ...p, ...patch } : p) };
      expect(evaluateValidation({ ...a, run }).status).toBe('fail');
    }
  });
  it('retains known holdout failures even when numerical verification passes or sample count is short', () => {
    const a = syntheticValidationAssessment(), run = { ...a.run, predictions: a.run.predictions.map(p => ({ ...p, value: p.value + 100 })) };
    expect(evaluateValidation({ ...a, run }).status).toBe('fail');
    const plan = { ...a.plan, gates: a.plan.gates.map(g => ({ ...g, minimumObservations: 10 })) };
    expect(evaluateValidation({ ...a, plan, run }).status).toBe('fail');
  });
  it('does not inflate apparent independence with repeated samples from the same holdout trial', () => {
    const a = syntheticValidationAssessment(), r = evaluateValidation(observationPatch(a, 'h2', { independenceGroup: 'holdout-trial-1' }));
    expect(r.status).toBe('inconclusive'); expect(r.metrics[0].independentGroups).toBe(1);
  });
  it('requires disclosed numerical error and enforces its separate observational-scale allocation', () => {
    const a = syntheticValidationAssessment();
    const missing = { ...a.run, predictions: a.run.predictions.map(p => ({ ...p, numericalError: null })) };
    expect(evaluateValidation({ ...a, run: missing }).status).toBe('unknown');
    const excessive = { ...a.run, predictions: a.run.predictions.map(p => ({ ...p, numericalError: { ...p.numericalError!, magnitude: 10 } })) };
    expect(evaluateValidation({ ...a, run: excessive }).status).toBe('fail');
  });
  it('never turns unspecified or fixed fitted-parameter uncertainty into a distribution', () => {
    const a = syntheticValidationAssessment();
    expect(evaluateValidation({ ...a, parameters: a.parameters.map(p => ({ ...p, distribution: null })) }).status).toBe('unknown');
    const calibrated = a.parameters.map(p => ({ ...p, role: 'calibrated' as const, fittedObservationIds: ['c1'] }));
    expect(evaluateParameterEvidence(calibrated).status).toBe('unknown');
    expect(evaluateParameterEvidence(calibrated.map(p => ({ ...p, distribution: { kind: 'normal' as const, mean: 1, standardDeviation: -1 } }))).status).toBe('fail');
  });
  it('validates explicit uniform/normal/empirical distributions and positive normalized weights', () => {
    const a = syntheticValidationAssessment(), p = a.parameters[0];
    for (const distribution of [{ kind: 'uniform' as const, lower: 1, upper: 2 },
      { kind: 'normal' as const, mean: 1, standardDeviation: 0.1 }, { kind: 'empirical' as const, values: [1, 2], weights: [0.5, 0.5] }]) {
      expect(evaluateParameterEvidence([{ ...p, role: 'measured', distribution }]).status).toBe('pass');
    }
    expect(evaluateParameterEvidence([{ ...p, distribution: { kind: 'empirical', values: [1, 2], weights: [1, 1] } }]).status).toBe('fail');
  });
  it('treats missing/failed/unrun verification and prediction runs explicitly', () => {
    const a = syntheticValidationAssessment();
    expect(evaluateValidation({ ...a, verification: [] }).status).toBe('unknown');
    expect(evaluateValidation({ ...a, verification: a.verification.map(v => ({ ...v, status: 'fail' })) }).status).toBe('inconclusive');
    for (const [state, expected] of [['unknown', 'unknown'], ['not-run', 'not-run'], ['failed', 'fail']] as const) {
      expect(evaluateValidation({ ...a, run: { ...a.run, state, reason: 'Synthetic execution state' } }).status).toBe(expected);
    }
  });
  it('rejects nonfinite/zero uncertainty and duplicate predictions without mutating inputs', () => {
    const a = syntheticValidationAssessment(), o = a.observations[2], before = JSON.stringify(a);
    expect(evaluateValidation(observationPatch(a, 'h1', { uncertainty: { ...o.uncertainty!, magnitude: 0 } })).status).toBe('fail');
    expect(evaluateValidation(observationPatch(a, 'h1', { value: Infinity })).status).toBe('fail');
    expect(evaluateValidation({ ...a, run: { ...a.run, predictions: [a.run.predictions[0], a.run.predictions[0]] } }).status).toBe('fail');
    expect(evaluateValidation(a).status).toBe('pass'); expect(JSON.stringify(a)).toBe(before);
  });
  it('weights independent groups equally rather than counting every time sample as independent', () => {
    const base = syntheticValidationAssessment();
    const h1 = { ...base.observations[2], uncertainty: { ...base.observations[2].uncertainty!, magnitude: 1 } };
    const h2 = { ...base.observations[3], uncertainty: { ...base.observations[3].uncertainty!, magnitude: 1 } };
    const h3 = { ...h1, id: 'h3', rawRecordKey: 'h3', timeS: 3 };
    const observations = [base.observations[0], base.observations[1], h1, h2, h3];
    const p1 = { ...base.run.predictions[0], value: h1.value }, p2 = { ...base.run.predictions[1], value: h2.value + 1 };
    const p3 = { ...p1, observationId: 'h3', timeS: 3, value: h3.value + 2 };
    const a = { ...base, observations, run: { ...base.run, predictions: [p1, p2, p3] },
      plan: { ...base.plan, holdoutObservationIds: ['h1', 'h2', 'h3'],
        gates: base.plan.gates.map(g => ({ ...g, minimumObservations: 3, maximumAbsoluteError: 5, maximumScaledError: 5, maximumGroupRmsScaledError: 5 })) } };
    const result = evaluateValidation(a);
    expect(result.status).toBe('pass'); expect(result.metrics[0].groupBalancedRmsError).toBeCloseTo(Math.sqrt(1.5), 12);
  });
});
