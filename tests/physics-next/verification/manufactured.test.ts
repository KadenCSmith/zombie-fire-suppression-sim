import { describe, expect, it } from 'vitest';
import {
  manufacturedFixtures, manufacturedExactValue, evaluateManufactured, runManufacturedFixture,
  type FixturePoint, type FixtureRequest, type ManufacturedRun,
} from '../../../src/physics-next/verification/manufactured';
import {
  C_BASELINE_COMMIT, BASELINE_MECHANICS_FILES, BASELINE_MECHANICS_BUNDLE_SHA256,
  baselineMechanicalRequest, createBaselineMechanicalAdapter,
} from '../../fixtures/physics-next/baselineAdapters';
const point = (xM = 0.5, timeS = 1, zM = 0.5): FixturePoint =>
  ({ id: `point-${xM}-${timeS}-${zM}`, xM, yM: 0.5, zM, timeS, weight: 1 });
function pair(id: string) {
  const f = manufacturedFixtures().find(value => value.id === id)!;
  const request: FixtureRequest = {
    id: `self-${id}`, fixtureId: id, points: [point()], weightUnit: '1', resolutionM: 0.25, timeStepS: 0.1,
    baselineCommit: 'synthetic-baseline', solverHash: 'analytic-oracle', fixedSettingsHash: 'synthetic-fixed',
  };
  const run: ManufacturedRun = {
    fixtureId: id, requestId: request.id, state: 'complete', reason: null, origin: 'analytic-self-test',
    baselineCommit: request.baselineCommit, solverHash: request.solverHash, fixedSettingsHash: request.fixedSettingsHash,
    sampleIds: request.points.map(p => p.id),
    fields: f.observables.map(o => ({ name: o.name, unit: o.unit,
      values: Float64Array.from(o.sampling === 'global' ? request.points.slice(0, 1) : request.points,
        p => manufacturedExactValue(id, o.name, p)) })), evidence: ['synthetic://oracle-self-test'],
  }; return { request, run };
}
describe('analytic/manufactured fixtures and adapters', () => {
  it('declares equations, initial/boundary data, units, norms, order and applicability for six fixtures', () => {
    const fixtures = manufacturedFixtures(); expect(fixtures).toHaveLength(6); expect(new Set(fixtures.map(f => f.id)).size).toBe(6);
    for (const f of fixtures) {
      for (const text of [f.equation, f.initialCondition, f.boundaryCondition, f.forcing, f.applicability, f.norm, f.expectedOrder.rationale]) expect(text.length).toBeGreaterThan(0);
      for (const o of f.observables) expect(o.absoluteTolerance).toBeGreaterThan(0);
      const p = pair(f.id), result = evaluateManufactured(p.request, p.run);
      expect(result.status).toBe('pass'); expect(result.claim).toBe('analytic-oracle-self-test-only');
    }
  });
  it('satisfies initial/boundary conditions and a finite-difference heat PDE identity', () => {
    const id = 'heat.dirichlet-mode', name = 'temperature';
    expect(manufacturedExactValue(id, name, point(0, 100))).toBe(300);
    expect(manufacturedExactValue(id, name, point(1, 100))).toBeCloseTo(300, 12);
    expect(manufacturedExactValue(id, name, point(0.5, 0))).toBe(310);
    const x = 0.4, t = 1000, dx = 1e-3, dt = 1, q = (xx: number, tt: number) => manufacturedExactValue(id, name, point(xx, tt));
    const dTime = (q(x, t + dt) - q(x, t - dt)) / (2 * dt);
    const dSpace = (q(x + dx, t) - 2 * q(x, t) + q(x - dx, t)) / dx ** 2;
    expect(Math.abs(dTime - 1e-6 * dSpace)).toBeLessThan(1e-9);
  });
  it('uses periodic boundaries and translates the advected mode in the correct direction', () => {
    for (const id of ['gas.periodic-diffusion', 'gas.periodic-advection-diffusion']) {
      expect(manufacturedExactValue(id, 'concentration', point(0, 1))).toBeCloseTo(manufacturedExactValue(id, 'concentration', point(1, 1)), 12);
    }
    const maximum = manufacturedExactValue('gas.periodic-advection-diffusion', 'concentration', point(0.35, 1));
    expect(maximum).toBeCloseTo(2 + 0.25 * Math.exp(-0.001 * (2 * Math.PI) ** 2), 12);
  });
  it('balances Darcy gravity with z increasing downward', () => {
    const p0 = manufacturedExactValue('darcy.hydrostatic', 'pressure', point(0.5, 0, 0));
    const p1 = manufacturedExactValue('darcy.hydrostatic', 'pressure', point(0.5, 0, 1));
    expect(Math.abs(-(1e-12 / 0.001) * (p1 - p0 - 1000 * 9.80665))).toBeLessThan(1e-18);
    expect(manufacturedExactValue('darcy.hydrostatic', 'darcyFluxZ', point())).toBe(0);
  });
  it('checks confined strain, fixed-bottom displacement and stored work without doubling it', () => {
    const id = 'mechanics.confined-one-element', strain = manufacturedExactValue(id, 'strainZZ', point());
    const top = manufacturedExactValue(id, 'displacementZ', point(0.5, 0, 0));
    expect(manufacturedExactValue(id, 'displacementZ', point(0.5, 0, 1))).toBe(0); expect(top).toBe(-strain);
    expect(manufacturedExactValue(id, 'elasticEnergy', point())).toBe(0.5 * 1000 * strain);
  });
  it('conserves mass for a finite prescribed source without asserting peat kinetics', () => {
    const id = 'source.closed-box';
    const mass = (t: number) => {
      const exact = (n: string) => manufacturedExactValue(id, n, point(0.5, t));
      return exact('fuel') + 0.031998 * exact('O2') + 0.0440095 * exact('CO2') + 0.0280134 * exact('N2') + 0.01801528 * exact('H2O');
    };
    expect(Math.abs(mass(4) - mass(0))).toBeLessThan(1e-14);
    expect(() => manufacturedExactValue(id, 'O2', point(0.5, 8))).toThrow(/domain\/time/);
  });
  it('fails wrong dimensions, missing fields, wrong sample IDs and nonfinite values', () => {
    const p = pair('heat.dirichlet-mode');
    for (const run of [{ ...p.run, fields: [] }, { ...p.run, sampleIds: ['wrong'] },
      { ...p.run, fields: [{ ...p.run.fields[0], unit: 'Pa' }] },
      { ...p.run, fields: [{ ...p.run.fields[0], values: new Float64Array([NaN]) }] }]) {
      expect(evaluateManufactured(p.request, run).status).toBe('fail');
    }
  });
  it('uses Linf in addition to RMS so a local error cannot hide among many exact points', () => {
    const p = pair('heat.dirichlet-mode'), points = Array.from({ length: 100 }, (_, i) => ({ ...point(i / 100), id: `${i}` }));
    const request = { ...p.request, points }, values = Float64Array.from(points, q => manufacturedExactValue(request.fixtureId, 'temperature', q));
    values[1] += 0.1;
    const run = { ...p.run, sampleIds: points.map(q => q.id), fields: [{ name: 'temperature', unit: 'K', values }] };
    const r = evaluateManufactured(request, run);
    expect(r.status).toBe('fail'); expect(r.norms[0].rms!).toBeLessThan(0.02); expect(r.norms[0].linf!).toBeGreaterThan(0.02);
  });
  it('distinguishes missing provenance and unexecuted/failed adapters', () => {
    const p = pair('heat.dirichlet-mode');
    expect(evaluateManufactured(p.request, { ...p.run, evidence: [] }).status).toBe('unknown');
    for (const [state, status] of [['unknown', 'unknown'], ['not-run', 'not-run'], ['failed', 'fail']] as const) {
      expect(evaluateManufactured(p.request, { ...p.run, state, reason: 'Fixture state' }).status).toBe(status);
    }
    expect(evaluateManufactured(p.request, { ...p.run, solverHash: 'other' }).status).toBe('fail');
  });
  it('requires a common time for global quantities and positive weights for norms', () => {
    const p = pair('source.closed-box');
    expect(evaluateManufactured({ ...p.request, points: [point(0, 0), point(1, 1)] }, p.run).status).toBe('fail');
    const heat = pair('heat.dirichlet-mode');
    expect(evaluateManufactured({ ...heat.request, points: [{ ...point(), weight: 0 }] }, heat.run).status).toBe('fail');
  });
  it('invokes an adapter once, isolates request mutation and reports exceptions', () => {
    const p = pair('heat.dirichlet-mode'), before = JSON.stringify(p.request); let calls = 0;
    const r = runManufacturedFixture(p.request, request => {
      calls++; expect(request).not.toBe(p.request); expect(Object.isFrozen(request.points)).toBe(true); return p.run;
    });
    expect(r.status).toBe('pass'); expect(calls).toBe(1); expect(JSON.stringify(p.request)).toBe(before);
    expect(runManufacturedFixture(p.request, () => { throw new Error('Expected rejection'); }).status).toBe('fail');
  });
});
describe('pinned baseline mechanics adapter', () => {
  it('compares actual one-element baseline outputs to the independent analytic oracle', () => {
    const request = baselineMechanicalRequest();
    const adapter = createBaselineMechanicalAdapter({ verifiedByRunner: true, baselineCommit: C_BASELINE_COMMIT,
      solverHash: BASELINE_MECHANICS_BUNDLE_SHA256, files: BASELINE_MECHANICS_FILES,
      evidence: ['author-fixture://pinned-archive-mechanics-binding'] });
    const result = runManufacturedFixture(request, adapter);
    expect(result.status).toBe('pass'); expect(result.claim).toBe('analytic-fixture-comparison-only'); expect(result.norms).toHaveLength(3);
  });
  it('does not run a changed/unattested backend or synthesize unsupported observations', () => {
    const request = baselineMechanicalRequest();
    const binding = { verifiedByRunner: false, baselineCommit: C_BASELINE_COMMIT, solverHash: BASELINE_MECHANICS_BUNDLE_SHA256,
      files: BASELINE_MECHANICS_FILES, evidence: ['synthetic://binding-test'] };
    expect(runManufacturedFixture(request, createBaselineMechanicalAdapter(binding)).status).toBe('unknown');
    expect(runManufacturedFixture(request, createBaselineMechanicalAdapter({ ...binding, verifiedByRunner: true, files: [] })).status).toBe('unknown');
    expect(runManufacturedFixture({ ...request, resolutionM: 0.5 }, createBaselineMechanicalAdapter({ ...binding, verifiedByRunner: true })).status).toBe('not-run');
  });
});
