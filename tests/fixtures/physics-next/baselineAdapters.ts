import { PoroMechanics } from '../../../src/coupled/mechanics';
import type { FixtureRequest, ManufacturedAdapter, ManufacturedRun } from '../../../src/physics-next/verification/manufactured';
export const C_BASELINE_COMMIT = '4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3';
export const BASELINE_MECHANICS_FILES = [
  {
    "path": "src/coupled/linear.ts",
    "sha256": "13795e6f0d3ec545a9bfb70b0f04c988fe1728c39d28467f1bf11b962ee650bd"
  },
  {
    "path": "src/coupled/mechanics.ts",
    "sha256": "72ad40c79e9d5fcfa29e8248a56ff420051b766596b29e60b534ba2d461596d3"
  },
  {
    "path": "src/coupled/sparse.ts",
    "sha256": "af2f54c5528f4d489782f1550ed0779109c4c90b33c72adb4124c730fe2d76c2"
  }
] as const;
/** SHA-256 of compact JSON [{path,sha256}, ...] in lexical path order. */
export const BASELINE_MECHANICS_BUNDLE_SHA256 = '4989231de6a0683164f0f47196a7e3b73b98c8ac2ed3d6a445614a44674f985c';
export interface BaselineSourceBinding {
  readonly verifiedByRunner: boolean; readonly baselineCommit: string; readonly solverHash: string;
  readonly files: readonly { readonly path: string; readonly sha256: string }[]; readonly evidence: readonly string[];
}
export function baselineMechanicalRequest(): FixtureRequest {
  return { id: 'baseline-confined-one-element', fixtureId: 'mechanics.confined-one-element',
    resolutionM: 1, timeStepS: 1, weightUnit: '1', baselineCommit: C_BASELINE_COMMIT,
    solverHash: BASELINE_MECHANICS_BUNDLE_SHA256, fixedSettingsHash: 'confined-E1e6-nu0.25-alpha1-p1000-rho0-no-fracture-v1',
    points: Array.from({ length: 8 }, (_, n) => ({ id: `node-${n}`, xM: n % 2, yM: Math.floor(n / 2) % 2,
      zM: Math.floor(n / 4), timeS: 0, weight: 1 })) };
}
/** Actual baseline solver output, never the oracle. Source authentication is runner-owned. */
export function createBaselineMechanicalAdapter(binding: BaselineSourceBinding): ManufacturedAdapter {
  return (request): ManufacturedRun => {
    const base = { fixtureId: request.fixtureId, requestId: request.id, origin: 'solver-run' as const,
      baselineCommit: binding.baselineCommit, solverHash: binding.solverHash,
      fixedSettingsHash: request.fixedSettingsHash, sampleIds: request.points.map(p => p.id), evidence: [...binding.evidence] };
    const unavailable = (state: 'unknown' | 'not-run', reason: string): ManufacturedRun => ({ ...base, state, reason, fields: [] });
    if (!binding.verifiedByRunner || binding.evidence.length === 0 || binding.evidence.some(e => !e.trim())) return unavailable('unknown', 'Actual source hash/access attestation is missing.');
    if (binding.baselineCommit !== C_BASELINE_COMMIT || binding.solverHash !== BASELINE_MECHANICS_BUNDLE_SHA256
      || binding.files.length !== BASELINE_MECHANICS_FILES.length || new Set(binding.files.map(f => f.path)).size !== binding.files.length
      || BASELINE_MECHANICS_FILES.some(expected => !binding.files.some(f => f.path === expected.path && f.sha256 === expected.sha256))) {
      return unavailable('unknown', 'Runtime mechanics dependency hashes differ from the pinned fixture baseline.');
    }
    if (request.baselineCommit !== binding.baselineCommit || request.solverHash !== binding.solverHash) return unavailable('unknown', 'Request and verified runtime source binding do not match.');
    if (request.fixtureId !== 'mechanics.confined-one-element' || request.resolutionM !== 1
      || request.points.some(p => p.timeS !== 0 || ![p.xM, p.yM, p.zM].every(v => v === 0 || v === 1))) {
      return unavailable('not-run', 'This adapter supports the one-element static nodal patch only; it does not invent interpolation or other backends.');
    }
    if (request.fixedSettingsHash !== baselineMechanicalRequest().fixedSettingsHash) return unavailable('unknown', 'Confined-patch settings identity mismatch.');
    try {
      const material = { youngsPa: 1e6, poisson: 0.25, densityKgM3: 0, biot: 1, fractureEnergyJm2: 5 };
      const fem = new PoroMechanics(1, 1, 1, 1, 1, 1, [material], 0.5), pressure = new Float64Array([1000]), state = fem.solve(pressure, false);
      return { ...base, state: 'complete', reason: null, fields: [
        { name: 'strainZZ', unit: '1', values: Float64Array.from(request.points, () => state.strain[2]) },
        { name: 'displacementZ', unit: 'm', values: Float64Array.from(request.points, p => {
          const n = (p.zM * 2 + p.yM) * 2 + p.xM; return state.u[3 * n + 2];
        }) }, { name: 'elasticEnergy', unit: 'J', values: new Float64Array([state.elasticJ]) },
      ] };
    } catch (error) { return { ...base, state: 'failed', reason: String(error), fields: [] }; }
  };
}
