import type { ValidationAssessment, ValidationObservation } from '../../../src/physics-next/verification/validation';
/** ALL values, source IDs, dates and hexadecimal strings below are synthetic schema-test mocks. */
export function syntheticValidationAssessment(mode: ValidationAssessment['mode'] = 'self-test'): ValidationAssessment {
  const E = ['synthetic://agent-c/validation-fixture'];
  const baselineCommit = 'a'.repeat(40), solverHash = 'b'.repeat(64), configurationHash = 'c'.repeat(64), parameterSetHash = 'd'.repeat(64), caseHash = 'e'.repeat(64);
  const observation = (id: string, sourceId: string, group: string, timeS: number, value: number): ValidationObservation => ({
    id, sourceId, rawRecordKey: id, independenceGroup: group, independenceEvidence: [...E], caseHash,
    quantity: 'temperature', unit: 'K', timeS, positionM: [0.5, 0.5, 0.5], value,
    uncertainty: { kind: 'standard', magnitude: 0.5, unit: 'K', basis: 'Fictional standard uncertainty for code tests.',
      coverageDescription: 'One synthetic standard scale; no confidence probability inferred.', evidence: [...E] },
  });
  const observations = [observation('c1', 'calibration-source', 'calibration-trial', 1, 300),
    observation('c2', 'calibration-source', 'calibration-trial', 2, 301),
    observation('h1', 'holdout-source', 'holdout-trial-1', 1, 302), observation('h2', 'holdout-source', 'holdout-trial-2', 2, 303)];
  return {
    mode, plan: {
      id: 'synthetic-holdout-schema-test', applicability: 'Synthetic temperature gate tests only; NOT field peat validation.',
      independenceRationale: 'Fictional separate trials; same calibration trajectory remains in calibration.',
      baselineCommit, solverHash, configurationHash, parameterSetHash,
      registeredUtc: '2020-01-02T00:00:00Z', modelFrozenUtc: '2020-01-03T00:00:00Z',
      firstHoldoutResponseAccessUtc: '2020-01-04T00:00:00Z', frozenModelEvidence: [...E],
      calibrationObservationIds: ['c1', 'c2'], holdoutObservationIds: ['h1', 'h2'],
      requiredParameterIds: ['controlled-alpha'], requiredVerificationIds: ['synthetic-numerical-check'],
      gates: [{ quantity: 'temperature', unit: 'K', minimumObservations: 2, minimumIndependentGroups: 2,
        maximumAbsoluteError: 1, maximumScaledError: 2, maximumGroupRmsScaledError: 1.5, maximumNumericalUncertaintyFraction: 0.25,
        rationale: 'Predeclared synthetic regression thresholds, not a physical acceptance recommendation.', preregistrationEvidence: [...E] }],
    },
    sources: [
      { id: 'calibration-source', kind: 'synthetic', citation: 'C synthetic calibration fixture', locator: E[0], sha256: '1'.repeat(64),
        availability: 'accessible', firstResponseAccessUtc: '2020-01-01T00:00:00Z', accessEvidence: [...E] },
      { id: 'holdout-source', kind: 'synthetic', citation: 'C synthetic holdout fixture', locator: E[0], sha256: '2'.repeat(64),
        availability: 'accessible', firstResponseAccessUtc: '2020-01-04T00:00:00Z', accessEvidence: [...E] },
    ],
    observations, parameters: [{ id: 'controlled-alpha', unit: 'm2/s', role: 'controlled', fittedObservationIds: [],
      distribution: { kind: 'fixed', value: 1e-6 }, evidence: [...E] }],
    run: {
      state: 'complete', reason: null, baselineCommit, solverHash, configurationHash, parameterSetHash,
      generatedUtc: '2020-01-03T01:00:00Z', fittedObservationIds: [], modelSelectionObservationIds: [],
      predictions: observations.filter(o => o.id.startsWith('h')).map(o => ({
        observationId: o.id, quantity: o.quantity, unit: o.unit, caseHash, timeS: o.timeS,
        positionM: o.positionM === null ? null : [...o.positionM] as [number, number, number], value: o.value + 0.25,
        numericalError: { kind: 'conditional-estimate', magnitude: 0.05, unit: 'K', evidence: [...E] }, matchingEvidence: [...E],
      })), evidence: [...E],
    },
    verification: [{ id: 'synthetic-numerical-check', status: 'pass', origin: 'author-self-test', baselineCommit, solverHash, evidence: [...E] }],
  };
}
