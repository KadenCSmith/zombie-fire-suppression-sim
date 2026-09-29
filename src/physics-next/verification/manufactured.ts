import type { VerificationStatus } from './convergence';
export interface FixtureObservable {
  readonly name: string; readonly unit: string; readonly sampling: 'points' | 'global';
  readonly absoluteTolerance: number; readonly toleranceRationale: string;
}
export interface ManufacturedFixture {
  readonly id: string; readonly title: string; readonly coordinates: 'SI; x/y horizontal; z positive downward';
  readonly equation: string; readonly initialCondition: string; readonly boundaryCondition: string;
  readonly forcing: string; readonly applicability: string; readonly domainM: readonly [number, number, number];
  readonly maximumTimeS: number | null;
  readonly parameters: Readonly<Record<string, { readonly value: number; readonly unit: string }>>;
  readonly norm: 'positive-weight RMS and Linf; both must pass';
  readonly expectedOrder: { readonly space: number | null; readonly time: number | null; readonly rationale: string };
  readonly observables: readonly FixtureObservable[];
}
const provenance = 'Algebraic analytic fixture, not experimental peat evidence.';
const observable = (name: string, unit: string, absoluteTolerance: number, sampling: 'points' | 'global' = 'points'): FixtureObservable =>
  ({ name, unit, sampling, absoluteTolerance, toleranceRationale: `Predeclared controlled-fixture allowance in ${unit}; not a production physics threshold.` });
const parameter = (value: number, unit: string) => ({ value, unit });
const common = { coordinates: 'SI; x/y horizontal; z positive downward' as const, domainM: [1, 1, 1] as const,
  maximumTimeS: null, norm: 'positive-weight RMS and Linf; both must pass' as const };
function makeFixtures(): readonly ManufacturedFixture[] {
  const fixtures: ManufacturedFixture[] = [
    {
      ...common, id: 'heat.dirichlet-mode', title: 'Constant-property heat equation eigenmode',
      equation: 'dT/dt = alpha*d2T/dx2; alpha=k/(rho*cp).',
      initialCondition: 'T(x,0)=300 K + 10 K*sin(pi*x/L); transverse directions uniform.',
      boundaryCondition: 'T(0,t)=T(L,t)=300 K; insulated transverse faces.', forcing: 'Zero volumetric heat source.',
      applicability: `Constant alpha; no phase change, reaction, transport, or evolving geometry. ${provenance}`,
      parameters: { alpha: parameter(1e-6, 'm2/s'), mean: parameter(300, 'K'), amplitude: parameter(10, 'K') },
      expectedOrder: { space: 2, time: 1, rationale: 'Centered uniform-grid diffusion and first-order time stepping, if that adapter declares those schemes.' },
      observables: [observable('temperature', 'K', 0.02)],
    },
    {
      ...common, id: 'gas.periodic-diffusion', title: 'Passive gas diffusion eigenmode',
      equation: 'dc/dt = D*d2c/dx2 for a prescribed passive molar concentration.',
      initialCondition: 'c(x,0)=2+0.25*sin(2*pi*x/L) mol/m3.',
      boundaryCondition: 'Periodic x; uniform/zero transverse flux.', forcing: 'Zero species source; frozen porosity and carrier state.',
      applicability: `Not compressible multicomponent pressure flow or chemistry. ${provenance}`,
      parameters: { diffusivity: parameter(0.001, 'm2/s'), velocity: parameter(0, 'm/s') },
      expectedOrder: { space: 2, time: 1, rationale: 'Centered diffusion and first-order time integration in the declared isolated adapter.' },
      observables: [observable('concentration', 'mol/m3', 1e-3)],
    },
    {
      ...common, id: 'gas.periodic-advection-diffusion', title: 'Advected and diffusing gas eigenmode',
      equation: 'dc/dt + v*dc/dx = D*d2c/dx2 for constant prescribed v and D.',
      initialCondition: 'c(x,0)=2+0.25*sin(2*pi*x/L) mol/m3.', boundaryCondition: 'Periodic x; uniform/zero transverse flux.',
      forcing: 'Zero species source; prescribed carrier velocity, no pressure feedback.',
      applicability: `Tests declared advection/diffusion discretization only. ${provenance}`,
      parameters: { diffusivity: parameter(0.001, 'm2/s'), velocity: parameter(0.1, 'm/s') },
      expectedOrder: { space: 1, time: 1, rationale: 'First-order upwind advection with centered diffusion and first-order time stepping; not a claim for other schemes.' },
      observables: [observable('concentration', 'mol/m3', 2e-3)],
    },
    {
      ...common, id: 'darcy.hydrostatic', title: 'Hydrostatic balance with downward-positive depth',
      equation: 'q_z=-(k/mu)*(dp/dz-rho*g); p(z)=p0+rho*g*z, hence q_z=0.',
      initialCondition: 'p(z)=101325 Pa + 1000 kg/m3 * 9.80665 m/s2 * z.',
      boundaryCondition: 'Consistent hydrostatic pressures on top/bottom; no lateral flux.', forcing: 'Gravity in +z; no fluid or heat source.',
      applicability: `Single incompressible constant-density fluid, constant viscosity/permeability. ${provenance}`,
      parameters: { density: parameter(1000, 'kg/m3'), gravity: parameter(9.80665, 'm/s2'),
        viscosity: parameter(0.001, 'Pa*s'), permeability: parameter(1e-12, 'm2'), p0: parameter(101325, 'Pa') },
      expectedOrder: { space: null, time: null, rationale: 'Well-balanced equilibrium patch: zero flux and exact linear pressure, not an observed-order fit.' },
      observables: [observable('pressure', 'Pa', 1e-6), observable('darcyFluxZ', 'm/s', 1e-12)],
    },
    {
      ...common, id: 'mechanics.confined-one-element', title: 'Confined linear poroelastic patch',
      equation: 'M=E*(1-nu)/((1+nu)*(1-2*nu)); epsilon_zz=alpha*p/M; u_z=epsilon_zz*(z-Lz); U=0.5*V*alpha*p*epsilon_zz.',
      initialCondition: 'Zero incremental displacement/stress; zero density/gravity; no damage/history driving.',
      boundaryCondition: 'Lateral confinement; bottom z=Lz fixed vertically; traction-free total-stress top; uniform positive pore pressure.',
      forcing: 'p=1000 Pa, alpha=1; no fracture, cap, roots, body load or plasticity.',
      applicability: `Tension-positive effective stress; +z downward; small-strain Q1 patch. ${provenance}`,
      parameters: { youngs: parameter(1e6, 'Pa'), poisson: parameter(0.25, '1'), biot: parameter(1, '1'), pressure: parameter(1000, 'Pa') },
      expectedOrder: { space: null, time: null, rationale: 'Affine one-element patch must be reproduced to arithmetic/linear-solve tolerance; no time evolution or convergence order is asserted.' },
      observables: [observable('strainZZ', '1', 1e-9), observable('displacementZ', 'm', 1e-9), observable('elasticEnergy', 'J', 1e-8, 'global')],
    },
    {
      ...common, id: 'source.closed-box', title: 'Conservative prescribed source update', maximumTimeS: 4,
      equation: 'dn_O2/dt=-r; dn_CO2/dt=r; dmf/dt=-(M_CO2-M_O2)*r; dU/dt=Q*r.',
      initialCondition: 'n=[1,0,2,0.5] mol in O2/CO2/N2/H2O order; fuel=1 kg; U=0 J.',
      boundaryCondition: 'Closed uniform unit-volume box; no boundary or mechanical transfers.',
      forcing: 'r=0.125 mol/s and Q=400000 J/mol prescribed; other species unchanged.',
      applicability: `Synthetic mass-conserving carbon-surrogate bookkeeping, NOT peat reaction kinetics or a heat-of-combustion recommendation. ${provenance}`,
      parameters: { rate: parameter(0.125, 'mol/s'), release: parameter(400000, 'J/mol'),
        molarO2: parameter(0.031998, 'kg/mol'), molarCO2: parameter(0.0440095, 'kg/mol') },
      expectedOrder: { space: null, time: null, rationale: 'Uniform constant-source update is exact for a conservative single increment; no kinetic convergence order is inferred.' },
      observables: [observable('O2', 'mol', 1e-12, 'global'), observable('CO2', 'mol', 1e-12, 'global'),
        observable('N2', 'mol', 1e-12, 'global'), observable('H2O', 'mol', 1e-12, 'global'),
        observable('fuel', 'kg', 1e-12, 'global'), observable('energy', 'J', 1e-6, 'global')],
    },
  ]; return fixtures;
}
const FIXTURES = makeFixtures();
/** Detached copies prevent callers retuning the private analytic oracle. */
export function manufacturedFixtures(): readonly ManufacturedFixture[] { return structuredClone(FIXTURES); }
export interface FixturePoint {
  readonly id: string; readonly xM: number; readonly yM: number; readonly zM: number;
  readonly timeS: number; readonly weight: number;
}
export interface FixtureRequest {
  readonly id: string; readonly fixtureId: string; readonly points: readonly FixturePoint[];
  readonly weightUnit: '1' | 'm2' | 'm3'; readonly resolutionM: number; readonly timeStepS: number;
  readonly baselineCommit: string; readonly solverHash: string; readonly fixedSettingsHash: string;
}
export interface ManufacturedRun {
  readonly fixtureId: string; readonly requestId: string; readonly state: 'complete' | 'failed' | 'unknown' | 'not-run';
  readonly reason: string | null; readonly origin: 'solver-run' | 'analytic-self-test';
  readonly baselineCommit: string; readonly solverHash: string; readonly fixedSettingsHash: string;
  readonly sampleIds: readonly string[];
  readonly fields: readonly { readonly name: string; readonly unit: string; readonly values: Float64Array }[];
  readonly evidence: readonly string[];
}
export interface ManufacturedResult {
  readonly id: string; readonly status: VerificationStatus;
  readonly claim: 'analytic-fixture-comparison-only' | 'analytic-oracle-self-test-only';
  readonly reasons: readonly string[]; readonly evidence: readonly string[];
  readonly expectedOrder: ManufacturedFixture['expectedOrder'] | null;
  readonly norms: readonly { readonly name: string; readonly unit: string; readonly rms: number | null;
    readonly linf: number | null; readonly tolerance: number; readonly passed: boolean }[];
}
export type ManufacturedAdapter = (request: FixtureRequest) => ManufacturedRun;
function findFixture(id: string): ManufacturedFixture {
  const f = FIXTURES.find(value => value.id === id); if (!f) throw new Error(`Unknown manufactured fixture: ${id}`); return f;
}
export function manufacturedExactValue(id: string, name: string, point: FixturePoint): number {
  const f = findFixture(id); if (!f.observables.some(o => o.name === name)) throw new Error(`Unknown observable ${name}`);
  const { xM: x, zM: z, timeS: t } = point;
  if (![x, point.yM, z, t].every(Number.isFinite) || x < 0 || x > 1 || point.yM < 0 || point.yM > 1 || z < 0 || z > 1 || t < 0
    || f.maximumTimeS !== null && t > f.maximumTimeS) throw new Error('Point outside fixture domain/time.');
  if (id === 'heat.dirichlet-mode') return 300 + 10 * Math.exp(-1e-6 * Math.PI ** 2 * t) * Math.sin(Math.PI * x);
  if (id.startsWith('gas.periodic-')) {
    const v = f.parameters.velocity.value, d = f.parameters.diffusivity.value;
    return 2 + 0.25 * Math.exp(-d * (2 * Math.PI) ** 2 * t) * Math.sin(2 * Math.PI * (x - v * t));
  }
  if (id === 'darcy.hydrostatic') return name === 'pressure' ? 101325 + 1000 * 9.80665 * z : 0;
  if (id === 'mechanics.confined-one-element') {
    const modulus = 1e6 * (1 - 0.25) / ((1 + 0.25) * (1 - 2 * 0.25)), strain = 1000 / modulus;
    return name === 'strainZZ' ? strain : name === 'displacementZ' ? strain * (z - 1) : 0.5 * 1000 * strain;
  }
  const consumed = 0.125 * t;
  const values: Readonly<Record<string, number>> = {
    O2: 1 - consumed, CO2: consumed, N2: 2, H2O: 0.5,
    fuel: 1 - (0.0440095 - 0.031998) * consumed, energy: 400000 * consumed,
  }; return values[name];
}
export function evaluateManufactured(request: FixtureRequest, run: ManufacturedRun): ManufacturedResult {
  const reasons: string[] = [], norms: Array<ManufacturedResult['norms'][number]> = [];
  let f: ManufacturedFixture | null = null;
  const finish = (status: VerificationStatus, reason?: string): ManufacturedResult => ({
    id: request.id, status, claim: run.origin === 'solver-run' ? 'analytic-fixture-comparison-only' : 'analytic-oracle-self-test-only',
    reasons: reason ? [...reasons, reason] : [...reasons], evidence: [...run.evidence],
    expectedOrder: f ? { ...f.expectedOrder } : null, norms: norms.map(n => ({ ...n })),
  });
  try { f = findFixture(request.fixtureId); } catch (error) { return finish('fail', String(error)); }
  if (!request.id.trim() || request.fixtureId !== run.fixtureId || request.id !== run.requestId) return finish('fail', 'Request/fixture identity mismatch.');
  if (![request.resolutionM, request.timeStepS].every(v => Number.isFinite(v) && v > 0)) return finish('fail', 'Resolution and physical time step must be finite positive SI quantities.');
  if (request.points.length === 0 || new Set(request.points.map(p => p.id)).size !== request.points.length
    || request.points.some(p => !p.id.trim() || !Number.isFinite(p.weight) || p.weight <= 0)) return finish('fail', 'Nonempty uniquely identified points with positive finite weights are required.');
  try { for (const point of request.points) manufacturedExactValue(f.id, f.observables[0].name, point); }
  catch (error) { return finish('fail', String(error)); }
  if (f.observables.some(o => o.sampling === 'global') && request.points.some(p => p.timeS !== request.points[0].timeS)) return finish('fail', 'A global quantity must be requested at a single physical time.');
  if (run.state !== 'complete') {
    if (run.reason === null || !run.reason.trim()) return finish('fail', 'Incomplete run lacks a reason.');
    return finish(run.state === 'failed' ? 'fail' : run.state, run.reason);
  }
  for (const key of ['baselineCommit', 'solverHash', 'fixedSettingsHash'] as const) {
    if (!request[key].trim() || !run[key].trim()) return finish('unknown', `Missing ${key}.`);
    if (request[key] !== run[key]) return finish('fail', `Unmatched ${key}.`);
  }
  if (run.evidence.length === 0 || run.evidence.some(e => !e.trim())) return finish('unknown', 'Run evidence is missing.');
  if (run.sampleIds.length !== request.points.length || run.sampleIds.some((id, i) => id !== request.points[i].id)) return finish('fail', 'Sample coordinates/order are not matched to the observations.');
  if (run.fields.length !== f.observables.length || new Set(run.fields.map(v => v.name)).size !== run.fields.length) return finish('fail', 'Expected exactly one field per declared observable.');
  let failed = false;
  for (const o of f.observables) {
    const field = run.fields.find(value => value.name === o.name), points = o.sampling === 'global' ? [request.points[0]] : request.points;
    if (!field || field.unit !== o.unit || !(field.values instanceof Float64Array) || field.values.length !== points.length) return finish('fail', `Missing, incorrectly shaped, or dimensionally mismatched ${o.name}.`);
    let maximum = 0;
    const errors = points.map((point, i) => {
      const e = Math.abs(field.values[i] - manufacturedExactValue(f!.id, o.name, point));
      if (Number.isFinite(e)) maximum = Math.max(maximum, e); return e;
    });
    if (!errors.every(Number.isFinite)) return finish('fail', `Nonfinite observation/error in ${o.name}.`);
    const weights = o.sampling === 'global' ? [1] : points.map(p => p.weight), weightScale = weights.reduce((a, b) => Math.max(a, b), 0);
    let weightSum = 0, squareSum = 0;
    for (let i = 0; i < errors.length; i++) {
      const w = weights[i] / weightScale; weightSum += w; squareSum += w * (maximum === 0 ? 0 : errors[i] / maximum) ** 2;
    }
    const rms = maximum * Math.sqrt(squareSum / weightSum);
    if (!Number.isFinite(rms)) return finish('fail', `Norm arithmetic overflow in ${o.name}.`);
    const passed = rms <= o.absoluteTolerance && maximum <= o.absoluteTolerance;
    if (!passed) { failed = true; reasons.push(`Norm gate failed: ${o.name}.`); }
    norms.push({ name: o.name, unit: o.unit, rms, linf: maximum, tolerance: o.absoluteTolerance, passed });
  }
  return finish(failed ? 'fail' : 'pass');
}
export function runManufacturedFixture(request: FixtureRequest, adapter: ManufacturedAdapter): ManufacturedResult {
  const detached = structuredClone(request); detached.points.forEach(Object.freeze); Object.freeze(detached.points); Object.freeze(detached);
  try { return evaluateManufactured(request, adapter(detached)); }
  catch (error) {
    return { id: request.id, status: 'fail', claim: 'analytic-fixture-comparison-only',
      reasons: [`Adapter threw: ${String(error)}`], evidence: [], expectedOrder: null, norms: [] };
  }
}
