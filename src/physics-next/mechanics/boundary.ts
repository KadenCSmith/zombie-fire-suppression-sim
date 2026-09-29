/**
 * A mechanics boundary v1. PROVISIONAL peer-proposal binding, not verified current main.
 * SI; +x/+y horizontal, +z downward. Cauchy stress tension-positive; pore/contact
 * pressure compression-positive: sigmaEffective = sigmaTotal + alpha*pB*I.
 * Does not solve equilibrium, invent cut-cell quadrature, homogenize mixtures or
 * activate the current solver. See the executable fixture and source manifest.
 */
import { assertGeometryGrid } from '../geometry/types';
import type { GeometryVoxelization } from '../geometry/voxelize';
import type { GeometryInterfaceSample, GeometryMaterialRole } from '../geometry/interfaces';
import { parseReportedQuantity } from '../materials/units';
import type { QuantityKind } from '../materials/units';
import { MaterialRegistry } from '../materials/registry';
import { projectScalars } from '../materials/adapters';
import type {
  ProjectionAudit, ProjectionContext, ProjectionIssue, ProjectionPolicy,
  ProjectionRequest, ScalarRequirement,
} from '../materials/adapters';
import { AtomicState, cloneOwnedState } from '../numerics/transaction';
import type { TransactionSnapshot } from '../numerics/transaction';
import { evaluateResidualGroups } from '../numerics/norms';
import type { ResidualGroup, ResidualCriteriaResult } from '../numerics/norms';

export {
  finiteStrainKinematics, neoHookeanPoint, assembleFiniteStrainHex8,
  finiteStrainPressureTransfer,
} from './finiteStrain';
export type {
  FinitePressureTransferInput, FinitePressureTransfer, TotalLagrangianPoint,
  Hex8Assembly, Hex8Trial,
} from './finiteStrain';

export const MECHANICS_BOUNDARY_VERSION = 'a-mechanics-boundary-v1' as const;
export const MECHANICS_STATE_VERSION = 1 as const;
export const MECHANICS_LIMITS = Object.freeze({
  maxCells: 32768, maxNodes: 300000, maxHistoryEntries: 2000000,
  maxFractionRoundoff: 1e-10, maxShearModulusPa: 1e12,
  maxLameLambdaPa: 1e12, maxDensityKgM3: 1e5,
});
export interface BoundaryIssue {
  readonly code: string;
  readonly location: string;
  readonly detail: string;
}
export type BoundaryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly BoundaryIssue[] };
export interface DomainPolicy {
  readonly arithmeticFractionTolerance: number;
  readonly partitionToleranceM3: number;
  readonly maximumUnresolvedVolumeM3: number;
}
export interface PreparedMechanicsDomain {
  readonly version: typeof MECHANICS_BOUNDARY_VERSION;
  readonly geometryId: string;
  readonly cellCount: number;
  readonly nodeCount: number;
  /** 0=void/exterior; 1=single, numerically resolved solid material. */
  readonly activeCellMask: Uint8Array;
  readonly activeDofMask: Uint8Array;
  readonly materialIds: readonly (string | null)[];
  readonly cellVolumesM3: Float64Array;
  readonly occupiedVolumeM3: number;
  readonly voidVolumeM3: number;
  readonly partitionResidualM3: number;
  readonly topologyValidated: false;
}
const domains = new WeakMap<object, PreparedMechanicsDomain>();
function finite(x: number, name: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${name}: finite number required`);
  return x;
}
function nonnegative(x: number, name: string): number {
  if (finite(x, name) < 0) throw new RangeError(`${name}: nonnegative required`);
  return x;
}
function text(x: string, name: string): void {
  if (typeof x !== 'string' || x.trim().length === 0) throw new TypeError(`${name}: nonempty string required`);
}
function array(x: Float64Array, n: number, name: string): void {
  if (!(x instanceof Float64Array) || Object.getPrototypeOf(x) !== Float64Array.prototype) {
    throw new TypeError(`${name}: ordinary Float64Array required`);
  }
  if (x.length !== n) throw new RangeError(`${name}: expected ${n} entries`);
  if (!(x.buffer instanceof ArrayBuffer) || (x.buffer as ArrayBuffer & { resizable?: boolean }).resizable === true) {
    throw new TypeError(`${name}: fixed ordinary buffer required`);
  }
  for (const v of x) finite(v, name);
}
function issue(code: string, location: string, detail: string): BoundaryIssue {
  return Object.freeze({ code, location, detail });
}
function total(values: Iterable<number>): number {
  let sum = 0, correction = 0;
  for (const x of values) {
    const next = finite(sum + x, 'sum');
    correction += Math.abs(sum) >= Math.abs(x) ? (sum - next) + x : (x - next) + sum;
    sum = next;
  }
  return finite(sum + correction, 'compensated sum');
}
const solidRoles: readonly GeometryMaterialRole[] = ['soil', 'cap', 'root'];

/** Tension-positive solid convention. Geometry fractions are BULK region occupancy,
 * not porosity, pore saturation or mass fractions. Cut/mixed cells are refused:
 * D's volume intervals do not supply integration points or shape gradients.
 */
export function prepareMechanicsDomain(
  geometryId: string, geometry: GeometryVoxelization, policy: DomainPolicy,
): BoundaryResult<PreparedMechanicsDomain> {
  text(geometryId, 'geometryId'); assertGeometryGrid(geometry.grid);
  const g = geometry.grid, n = g.cellCount, eps = nonnegative(policy.arithmeticFractionTolerance, 'fraction tolerance');
  if (n > MECHANICS_LIMITS.maxCells || g.nodeCount > MECHANICS_LIMITS.maxNodes ||
      eps > MECHANICS_LIMITS.maxFractionRoundoff) throw new RangeError('mechanics domain limit exceeded');
  nonnegative(policy.partitionToleranceM3, 'partitionToleranceM3');
  nonnegative(policy.maximumUnresolvedVolumeM3, 'maximumUnresolvedVolumeM3');
  array(geometry.cellVolumesM3, n, 'cellVolumesM3');
  array(geometry.unresolvedFraction, n, 'unresolvedFraction');
  array(geometry.arithmeticPaddingFraction, n, 'arithmeticPaddingFraction');
  const problems: BoundaryIssue[] = [];
  if (!geometry.accepted) problems.push(issue('D_GEOMETRY_NOT_ACCEPTED', 'geometry.accepted', 'D did not accept its volume bounds.'));
  if (nonnegative(geometry.unresolvedVolumeM3, 'unresolvedVolumeM3') > policy.maximumUnresolvedVolumeM3) {
    problems.push(issue('UNRESOLVED_GEOMETRY', 'geometry.unresolvedVolumeM3', 'Explicit mechanical uncertainty bound exceeded.'));
  }
  if (geometry.materials.length === 0) throw new RangeError('empty material partition');
  const ids = new Set<string>();
  for (const m of geometry.materials) {
    text(m.material.id, 'material.id');
    if (ids.has(m.material.id)) throw new RangeError('duplicate material ID');
    ids.add(m.material.id);
    array(m.fraction, n, 'fraction'); array(m.lowerFraction, n, 'lowerFraction'); array(m.upperFraction, n, 'upperFraction');
  }
  const activeCellMask = new Uint8Array(n), activeDofMask = new Uint8Array(3 * g.nodeCount);
  const materialIds: (string | null)[] = new Array(n).fill(null);
  const occupied: number[] = [], voids: number[] = [], residuals: number[] = [];
  for (let q = 0; q < n; q++) {
    const volume = geometry.cellVolumesM3[q];
    if (!(volume > 0)) throw new RangeError('nonpositive cell volume');
    if (Math.abs(volume-g.cellVolumeM3) > 1e-12*Math.max(volume,g.cellVolumeM3)) {
      throw new RangeError('cellVolumesM3 must contain whole reference-cell volumes from D.grid');
    }
    if (geometry.unresolvedFraction[q] < 0 || geometry.unresolvedFraction[q] > 1 ||
        geometry.arithmeticPaddingFraction[q] < 0) throw new RangeError('invalid geometry uncertainty');
    let all = 0, solid = 0, empty = 0;
    const possible: typeof geometry.materials[number][] = [];
    let possibleVoid = 0;
    for (const m of geometry.materials) {
      const lo = m.lowerFraction[q], f = m.fraction[q], hi = m.upperFraction[q];
      if (!(0 <= lo && lo <= f && f <= hi && hi <= 1)) throw new RangeError('fraction interval invalid');
      all += f;
      if (solidRoles.includes(m.material.role)) {
        solid += f;
        if (hi > 0) possible.push(m);
      } else if (m.material.role === 'void' || m.material.role === 'exterior') {
        empty += f; possibleVoid += hi;
      } else if (hi > 0) {
        problems.push(issue('UNSUPPORTED_MATERIAL_ROLE', `cell[${q}]`, `No mechanics model for ${m.material.role}.`));
      }
    }
    if (Math.abs(all - 1) > eps) problems.push(issue('PARTITION_SUM', `cell[${q}]`, 'Material fractions must sum to one.'));
    occupied.push(solid * volume); voids.push(empty * volume); residuals.push((all - 1) * volume);
    if (geometry.unresolvedFraction[q] > 0) {
      problems.push(issue('CUT_CELL_QUADRATURE_REQUIRED', `cell[${q}]`, 'Unresolved geometry cannot become a full brick.'));
    }
    if (possible.length === 0) continue; // No artificial density or stiffness in a void.
    if (possible.length !== 1) {
      problems.push(issue('MIXTURE_LAW_REQUIRED', `cell[${q}]`, 'Do not average stiffness or choose the dominant material.'));
      continue;
    }
    if (possibleVoid > 0 || possible[0].lowerFraction[q] < 1 - eps) {
      problems.push(issue('CUT_CELL_QUADRATURE_REQUIRED', `cell[${q}]`, 'Positive occupied volume alone does not define a cut-cell FE operator.'));
      continue;
    }
    activeCellMask[q] = 1; materialIds[q] = possible[0].material.id;
    const x = q % g.nx, y = Math.floor(q / g.nx) % g.ny, z = Math.floor(q / (g.nx * g.ny));
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const node = ((z + dz) * (g.ny + 1) + y + dy) * (g.nx + 1) + x + dx;
      for (let c = 0; c < 3; c++) activeDofMask[3 * node + c] = 1;
    }
  }
  const residual = total(residuals);
  if (Math.abs(residual) > policy.partitionToleranceM3) {
    problems.push(issue('GEOMETRY_VOLUME_BALANCE', 'partitionResidualM3', 'Bulk geometric volume is not conserved to the selected bound.'));
  }
  if (problems.length) return { ok: false, issues: Object.freeze(problems) };
  const value: PreparedMechanicsDomain = Object.freeze({
    version: MECHANICS_BOUNDARY_VERSION, geometryId, cellCount: n, nodeCount: g.nodeCount,
    activeCellMask, activeDofMask, materialIds: Object.freeze(materialIds),
    cellVolumesM3: geometry.cellVolumesM3.slice(),
    occupiedVolumeM3: total(occupied), voidVolumeM3: total(voids),
    partitionResidualM3: residual, topologyValidated: false,
  });
  // G retains internal aliases. Keep a private detached canonical copy so callers
  // cannot change a returned typed-array mask and bypass the preparation gate.
  domains.set(value, cloneOwnedState(value));
  return { ok: true, value };
}

export type MechanicsScalarField = 'shearModulusPa' | 'lameLambdaPa' | 'biotCoefficient' | 'densityKgM3';
export interface MechanicsMaterialRequest {
  readonly version: typeof MECHANICS_BOUNDARY_VERSION;
  readonly requestId: string;
  readonly materialId: string;
  /** Explicit F property keys and exact basis labels. No guessed key or basis. */
  readonly bindings: Readonly<Record<MechanicsScalarField, Readonly<{ key: string; basis: string; requiredAxes: readonly string[] }>>>;
  readonly contexts: readonly ProjectionContext[];
  readonly policy: ProjectionPolicy;
}
export interface MechanicsMaterial {
  readonly model: 'isotropic-neo-hookean-comparison';
  readonly materialId: string;
  readonly shearModulusPa: number;
  readonly lameLambdaPa: number;
  readonly biotCoefficient: number;
  /** Density of the declared bulk material, not particle density or wet/dry conversion. */
  readonly densityKgM3: number;
  readonly audit: ProjectionAudit;
}
const scalarSpecs: readonly Readonly<{
  field: MechanicsScalarField; kind: QuantityKind; unit: string; lower: number; upper: number; lowerInclusive: boolean;
}>[] = [
  { field: 'shearModulusPa', kind: 'stress', unit: 'Pa', lower: 0, upper: 1e12, lowerInclusive: false },
  { field: 'lameLambdaPa', kind: 'stress', unit: 'Pa', lower: 0, upper: 1e12, lowerInclusive: true },
  { field: 'biotCoefficient', kind: 'dimensionless', unit: '1', lower: 0, upper: 1, lowerInclusive: true },
  { field: 'densityKgM3', kind: 'bulkDensity', unit: 'kg/m3', lower: 0, upper: 1e5, lowerInclusive: false },
];
/** Tension-positive effective-solid consumer; pB remains compression-positive.
 * F supplies scalar evidence, not an inferred isotropic fit or calibrated law.
 * Ranges/distributions/unknowns and missing state applicability are refused by F.
 */
export function projectMechanicsMaterial(
  registry: MaterialRegistry, request: MechanicsMaterialRequest,
): BoundaryResult<MechanicsMaterial> {
  if (request.version !== MECHANICS_BOUNDARY_VERSION) throw new RangeError('consumer contract version mismatch');
  text(request.requestId, 'requestId'); text(request.materialId, 'materialId');
  const requirements: ScalarRequirement[] = scalarSpecs.map(s => {
    const b = request.bindings[s.field];
    if (!b) throw new RangeError(`missing material binding: ${s.field}`);
    text(b.key, 'property key'); text(b.basis, 'basis');
    const bound = (value: number) => parseReportedQuantity(s.kind, {
      value, unit: s.unit, basis: b.basis, numericText: null, unitText: null, precision: { kind: 'unknown' },
    });
    return {
      field: s.field, key: b.key, quantityKind: s.kind, basis: b.basis, requiredAxes: b.requiredAxes,
      guard: { lower: bound(s.lower), upper: bound(s.upper), lowerInclusive: s.lowerInclusive, upperInclusive: true,
        note: 'A-boundary software support bound, not an experimental applicability range.' },
    };
  });
  const projection: ProjectionRequest = {
    format: 'zfs-scalar-projection-request', version: 1, id: request.requestId,
    targetMaterialId: request.materialId, requirements, contexts: request.contexts, policy: request.policy,
  };
  const result = projectScalars(registry, projection);
  if (!result.ok) return {
    ok: false, issues: Object.freeze(result.issues.map((i: ProjectionIssue) => issue(i.code, i.field, i.detail))),
  };
  const values = result.values;
  for (const s of scalarSpecs) finite(values[s.field] as number, s.field);
  return { ok: true, value: Object.freeze({
    model: 'isotropic-neo-hookean-comparison', materialId: request.materialId,
    shearModulusPa: values.shearModulusPa!, lameLambdaPa: values.lameLambdaPa!,
    biotCoefficient: values.biotCoefficient!, densityKgM3: values.densityKgM3!, audit: result.audit,
  }) };
}

export interface WeightedNode { readonly node: number; readonly weight: number }
export interface ContactBinding {
  readonly sampleKey: string;
  readonly decisionId: string;
  readonly modelId: string;
  /** Explicit reference measure; D.areaM2 is only its sampled-area estimate. */
  readonly referenceAreaM2: number;
  readonly sideA: readonly WeightedNode[];
  readonly sideB: readonly WeightedNode[];
}
export interface PreparedContactPair {
  readonly sampleKey: string;
  readonly materialAId: string;
  readonly materialBId: string;
  readonly normalFromAToB: readonly [number, number, number];
  readonly referenceAreaM2: number;
  readonly sampledAreaEstimateM2: number;
  readonly decisionId: string;
  readonly modelId: string;
  readonly sideA: readonly WeightedNode[];
  readonly sideB: readonly WeightedNode[];
  readonly nodeCount: number;
}
function weights(nodes: readonly WeightedNode[], count: number): void {
  if (nodes.length === 0) throw new RangeError('missing contact interpolation weights');
  const seen = new Set<number>();
  for (const v of nodes) {
    if (!Number.isSafeInteger(v.node) || v.node < 0 || v.node >= count || seen.has(v.node)) throw new RangeError('invalid contact node map');
    seen.add(v.node); nonnegative(v.weight, 'contact weight');
  }
  if (Math.abs(total(nodes.map(v => v.weight)) - 1) > 1e-12) throw new RangeError('contact weights must sum to one');
}
/** Tension-positive solid convention; D's normal is canonical A->B, not +z by default.
 * Requires explicit mechanical pair/area/model decision. Geometry labels do not
 * create cap/root DOFs, friction coefficients, tangents or a contact solve.
 */
export function prepareContactPair(
  sample: GeometryInterfaceSample, binding: ContactBinding | null, nodeCount: number,
): BoundaryResult<PreparedContactPair> {
  if (binding === null) return { ok: false, issues: [issue('CONTACT_BINDING_REQUIRED', sample.key, 'Need cap/root mechanical DOFs, model and reference-area decision.')] };
  if (!Number.isSafeInteger(nodeCount) || nodeCount <= 0 || nodeCount > MECHANICS_LIMITS.maxNodes) throw new RangeError('node count');
  if (binding.sampleKey !== sample.key) throw new RangeError('contact sample identity mismatch');
  text(binding.decisionId, 'contact decision'); text(binding.modelId, 'contact model');
  if (!(finite(binding.referenceAreaM2, 'referenceAreaM2') > 0 && finite(sample.areaM2, 'sample area') > 0)) throw new RangeError('positive contact area required');
  const normal = sample.normalFromAToB;
  if (normal.length !== 3 || normal.some(v => !Number.isFinite(v)) || Math.abs(Math.hypot(...normal) - 1) > 1e-10) throw new RangeError('unit contact normal required');
  weights(binding.sideA, nodeCount); weights(binding.sideB, nodeCount);
  const canonicalWeights = (side: readonly WeightedNode[]) =>
    JSON.stringify(side.filter(v => v.weight !== 0).map(v => [v.node,v.weight]).sort((a,b) => a[0]-b[0]));
  if (canonicalWeights(binding.sideA) === canonicalWeights(binding.sideB)) throw new RangeError('independent contact jump DOFs required');
  text(sample.materialA.id,'material A'); text(sample.materialB.id,'material B');
  if (!(sample.materialA.id < sample.materialB.id)) throw new RangeError('canonical D material A/B orientation required');
  return { ok: true, value: Object.freeze({
    sampleKey: sample.key, materialAId: sample.materialA.id, materialBId: sample.materialB.id,
    normalFromAToB: Object.freeze([...normal]) as readonly [number, number, number],
    referenceAreaM2: binding.referenceAreaM2, sampledAreaEstimateM2: sample.areaM2,
    decisionId: binding.decisionId, modelId: binding.modelId,
    sideA: Object.freeze(binding.sideA.map(v => Object.freeze({ ...v }))),
    sideB: Object.freeze(binding.sideB.map(v => Object.freeze({ ...v }))), nodeCount,
  }) };
}
/** Cauchy sign convention as above. Supplied tractionOnB is nominal Pa per
 * REFERENCE area, already oriented in global xyz; compressive pn acts +pn*n on B.
 * Returns actual physical forces; internal-residual contributions have opposite sign.
 * This is a work-conjugate scatter operator, NOT a constitutive/contact law.
 */
export function scatterContactForces(pair: PreparedContactPair, tractionOnBPa: Float64Array): Float64Array {
  array(tractionOnBPa, 3, 'tractionOnBPa');
  if (!Number.isSafeInteger(pair.nodeCount) || pair.nodeCount <= 0 || pair.nodeCount > MECHANICS_LIMITS.maxNodes) throw new RangeError('node count');
  weights(pair.sideA, pair.nodeCount); weights(pair.sideB, pair.nodeCount);
  if (!(finite(pair.referenceAreaM2, 'referenceAreaM2') > 0)) throw new RangeError('positive reference area required');
  const force = new Float64Array(3 * pair.nodeCount);
  for (const [nodes, sign] of [[pair.sideA, -1], [pair.sideB, 1]] as const) {
    for (const w of nodes) for (let c = 0; c < 3; c++) force[3 * w.node + c] += sign * w.weight * pair.referenceAreaM2 * tractionOnBPa[c];
  }
  array(force, force.length, 'scattered force');
  return force;
}

export interface MechanicsIdentity {
  readonly sourceRevision: string;
  readonly geometryId: string;
  readonly materialSetId: string;
  readonly materialRevision: number;
  readonly modelId: string;
  /** Required backend-owned packing/version ID; no guessed Maxwell/contact layout. */
  readonly historyLayoutId: string;
  readonly scenarioId: string;
}
export interface MechanicalAcceptedStateV1 {
  readonly format: 'zfs-mechanics-state';
  readonly version: typeof MECHANICS_STATE_VERSION;
  readonly identity: MechanicsIdentity;
  timeS: number;
  acceptedStep: number;
  displacementM: Float64Array;
  effectiveStressPa: Float64Array;
  poreVolumeM3: Float64Array;
  damage: Float64Array;
  contactPressurePa: Float64Array;
  crackApertureM: Float64Array;
  referencePorePressurePa: Float64Array;
  materialHistory: Float64Array;
  contactHistory: Float64Array;
  fractureHistory: Float64Array;
  recoverableEnergyJ: number;
  cumulativePressureWorkJ: number;
  cumulativeExternalWorkJ: number;
  cumulativePhysicalDissipationJ: number;
  cumulativeNumericalLossJ: number;
}
export interface MechanicalCandidate {
  readonly baseVersion: number;
  readonly next: MechanicalAcceptedStateV1;
  /** Independently recomputed by the mechanics backend; not iterate displacement change. */
  readonly forceResidualN: Float64Array;
  readonly forceReferenceN: number;
  readonly maximumPenetrationM: number;
  readonly pressureWorkJ: number;
  readonly thermalCouplingTransferJ: number;
  readonly externalWorkJ: number;
  readonly physicalDissipationJ: number;
  readonly numericalLossJ: number;
}
export interface MechanicalGatePolicy {
  readonly forceNorm: 'l2' | 'linf';
  readonly forceScaleN: number;
  readonly forceAbsoluteToleranceN: number;
  readonly forceRelativeTolerance: number;
  readonly energyScaleJ: number;
  readonly energyAbsoluteToleranceJ: number;
  readonly energyRelativeTolerance: number;
  readonly combination: 'sum' | 'max';
  readonly boundary: 'inclusive' | 'exclusive';
  readonly penetrationToleranceM: number;
}
export type MechanicalAttempt =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly dtS: number; readonly policy: MechanicalGatePolicy;
      readonly propose: (committedCopy: MechanicalAcceptedStateV1, baseVersion: number) => MechanicalCandidate };
export interface MechanicalAttemptResult {
  readonly status: 'disabled' | 'accepted' | 'rejected';
  readonly version: number;
  readonly accepted: MechanicalAcceptedStateV1;
  readonly issues: readonly BoundaryIssue[];
  readonly numerics: ResidualCriteriaResult | null;
}
export interface MechanicalCheckpointV1 {
  readonly format: 'zfs-mechanics-checkpoint';
  readonly version: 1;
  readonly contract: typeof MECHANICS_BOUNDARY_VERSION;
  /** G snapshot is a quiescent in-memory graph. Portable byte encoding is H-owned. */
  readonly transaction: TransactionSnapshot<MechanicalAcceptedStateV1>;
}
function identityKey(id: MechanicsIdentity): string {
  const keys = ['sourceRevision','geometryId','materialSetId','materialRevision','modelId','historyLayoutId','scenarioId'];
  if (Reflect.ownKeys(id).length !== keys.length || Reflect.ownKeys(id).some(k => typeof k !== 'string' || !keys.includes(k))) {
    throw new RangeError('identity fields require an explicit schema migration');
  }
  for (const k of ['sourceRevision', 'geometryId', 'materialSetId', 'modelId', 'historyLayoutId', 'scenarioId'] as const) text(id[k], k);
  if (!Number.isSafeInteger(id.materialRevision) || id.materialRevision < 1) throw new RangeError('materialRevision');
  return JSON.stringify([id.sourceRevision, id.geometryId, id.materialSetId, id.materialRevision, id.modelId, id.historyLayoutId, id.scenarioId]);
}
function validateState(s: MechanicalAcceptedStateV1, d: PreparedMechanicsDomain): void {
  const keys = ['format','version','identity','timeS','acceptedStep','displacementM','effectiveStressPa',
    'poreVolumeM3','damage','contactPressurePa','crackApertureM','referencePorePressurePa',
    'materialHistory','contactHistory','fractureHistory','recoverableEnergyJ','cumulativePressureWorkJ',
    'cumulativeExternalWorkJ','cumulativePhysicalDissipationJ','cumulativeNumericalLossJ'];
  if (Reflect.ownKeys(s).length !== keys.length || Reflect.ownKeys(s).some(k => typeof k !== 'string' || !keys.includes(k))) {
    throw new RangeError('mechanical state fields require an explicit schema migration');
  }
  if (s.format !== 'zfs-mechanics-state' || s.version !== MECHANICS_STATE_VERSION) throw new RangeError('mechanical state version');
  identityKey(s.identity);
  if (s.identity.geometryId !== d.geometryId) throw new RangeError('geometry identity mismatch');
  nonnegative(s.timeS, 'timeS');
  if (!Number.isSafeInteger(s.acceptedStep) || s.acceptedStep < 0) throw new RangeError('acceptedStep');
  array(s.displacementM, 3 * d.nodeCount, 'displacementM');
  array(s.effectiveStressPa, 6 * d.cellCount, 'effectiveStressPa');
  for (const k of ['poreVolumeM3', 'damage', 'contactPressurePa', 'crackApertureM', 'referencePorePressurePa'] as const) array(s[k], d.cellCount, k);
  for (const k of ['materialHistory', 'contactHistory', 'fractureHistory'] as const) {
    if (!(s[k] instanceof Float64Array) || s[k].length > MECHANICS_LIMITS.maxHistoryEntries) throw new RangeError('history allocation bound');
    array(s[k], s[k].length, k);
  }
  const arrays = [s.displacementM, s.effectiveStressPa, s.poreVolumeM3, s.damage,
    s.contactPressurePa, s.crackApertureM, s.referencePorePressurePa, s.materialHistory, s.contactHistory, s.fractureHistory];
  if (new Set(arrays.map(a => a.buffer)).size !== arrays.length) throw new RangeError('distinct state fields must own distinct buffers');
  for (let q = 0; q < d.cellCount; q++) {
    if (s.poreVolumeM3[q] < 0 || s.damage[q] < 0 || s.damage[q] > 1 || s.contactPressurePa[q] < 0 || s.crackApertureM[q] < 0) {
      throw new RangeError('invalid pore/damage/contact/aperture state');
    }
    if (d.activeCellMask[q] === 0 && (s.damage[q] !== 0 || s.effectiveStressPa.subarray(6*q,6*q+6).some(v => v !== 0))) {
      throw new RangeError('void cell cannot carry solid stress or damage');
    }
  }
  nonnegative(s.recoverableEnergyJ, 'recoverableEnergyJ');
  nonnegative(s.cumulativePhysicalDissipationJ, 'cumulativePhysicalDissipationJ');
  nonnegative(s.cumulativeNumericalLossJ, 'cumulativeNumericalLossJ');
  finite(s.cumulativePressureWorkJ, 'cumulativePressureWorkJ'); finite(s.cumulativeExternalWorkJ, 'cumulativeExternalWorkJ');
}

/** Decoders may return disjoint views into one packed buffer. Keep the public
 * state ownership contract by copying each logical field; reject actual overlaps.
 * This is not a byte codec or a version/physics migration.
 */
function detachDecodedMechanicalArrays(s: MechanicalAcceptedStateV1): MechanicalAcceptedStateV1 {
  const copy = cloneOwnedState(s);
  const fields = ['displacementM','effectiveStressPa','poreVolumeM3','damage','contactPressurePa',
    'crackApertureM','referencePorePressurePa','materialHistory','contactHistory','fractureHistory'] as const;
  for (const name of fields) {
    if (!(copy[name] instanceof Float64Array)) throw new TypeError(`decoded ${name}: Float64Array required`);
  }
  for (let i=0;i<fields.length;i++) for (let j=i+1;j<fields.length;j++) {
    const a=copy[fields[i]],b=copy[fields[j]];
    if (a.buffer===b.buffer && Math.max(a.byteOffset,b.byteOffset) <
        Math.min(a.byteOffset+a.byteLength,b.byteOffset+b.byteLength)) {
      throw new RangeError('overlapping decoded mechanical fields');
    }
  }
  for (const name of fields) copy[name] = new Float64Array(copy[name]);
  return copy;
}


export type MechanicalCandidateReview =
  | { readonly status:'approved'; readonly next:MechanicalAcceptedStateV1;
      readonly issues:readonly BoundaryIssue[]; readonly numerics:ResidualCriteriaResult }
  | { readonly status:'rejected'; readonly next:null;
      readonly issues:readonly BoundaryIssue[]; readonly numerics:ResidualCriteriaResult };

/** Pure candidate review: NO state publication. Cauchy solid stress tension-positive,
 * pore/contact pressures compression-positive; work/energy in J, residuals in N.
 * The coordinating integrator may apply an approved next state to its OWN combined
 * G trial, then reject the entire transport/mechanics/intervention step atomically.
 * Approval checks supplied residuals/ledgers, not independent physical validity.
 */
export function reviewMechanicalCandidate(
  domain: PreparedMechanicsDomain, accepted: MechanicalAcceptedStateV1,
  baseVersion: number, candidate: MechanicalCandidate, dtS: number, policy: MechanicalGatePolicy,
): MechanicalCandidateReview {
  const d = domains.get(domain);
  if (!d) throw new TypeError('domain must come from successful A preparation');
  if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) throw new RangeError('baseVersion');
  if (!(finite(dtS,'dtS') > 0)) throw new RangeError('positive dtS required');
  nonnegative(policy.penetrationToleranceM,'penetrationToleranceM');
  const previous = cloneOwnedState(accepted);
  validateState(previous,d);
  if (candidate && typeof candidate==='object' && 'then' in candidate) throw new TypeError('async candidate unsupported');
  const c = cloneOwnedState(candidate);
  validateState(c.next, d);
  const problems: BoundaryIssue[] = [];
  if (c.baseVersion !== baseVersion) problems.push(issue('STALE_MECHANICAL_TRIAL','baseVersion','Trial did not use this accepted state.'));
  if (identityKey(c.next.identity) !== identityKey(previous.identity)) problems.push(issue('MIGRATION_REQUIRED','identity','Geometry/material/model/history identity cannot silently change.'));
  const end = finite(previous.timeS + dtS, 'trial end time');
  if (!(end > previous.timeS) || c.next.timeS !== end || c.next.acceptedStep !== previous.acceptedStep + 1) problems.push(issue('TIME_OR_STEP','timeS','Candidate must advance the requested physical step exactly.'));
  for (const k of ['materialHistory','contactHistory','fractureHistory'] as const) if (c.next[k].length !== previous[k].length) {
    problems.push(issue('HISTORY_LAYOUT_CHANGED',k,'Restart packing requires an explicit migration.'));
  }
  for (let q=0;q<d.cellCount;q++) {
    if (c.next.damage[q] < previous.damage[q]) problems.push(issue('DAMAGE_HEALING',`damage[${q}]`,'Irreversible damage cannot decrease.'));
    if (!Object.is(c.next.referencePorePressurePa[q],previous.referencePorePressurePa[q])) problems.push(issue('REFERENCE_PRESSURE_CHANGED',`reference[${q}]`,'Fixed pressure datum cannot drift.'));
    if (d.activeCellMask[q]===0 && !Object.is(c.next.poreVolumeM3[q],previous.poreVolumeM3[q])) problems.push(issue('VOID_MECHANICAL_VOLUME',`poreVolume[${q}]`,'No solid deformation law exists in void cells.'));
  }
  for (let i=0;i<d.activeDofMask.length;i++) if (!d.activeDofMask[i] &&
      !Object.is(c.next.displacementM[i],previous.displacementM[i])) problems.push(issue('UNSUPPORTED_VOID_DOF',`u[${i}]`,'Remove/constraint unsupported DOFs; no weak material fallback.'));
  if (c.next.cumulativePhysicalDissipationJ < previous.cumulativePhysicalDissipationJ ||
      c.next.cumulativeNumericalLossJ < previous.cumulativeNumericalLossJ) {
    problems.push(issue('CUMULATIVE_LOSS_DECREASE','energy','Accumulated losses cannot decrease even under a loose residual tolerance.'));
  }
  nonnegative(c.physicalDissipationJ,'physicalDissipationJ'); nonnegative(c.numericalLossJ,'numericalLossJ');
  nonnegative(c.maximumPenetrationM,'maximumPenetrationM'); nonnegative(c.forceReferenceN,'forceReferenceN');
  if (c.maximumPenetrationM > policy.penetrationToleranceM) problems.push(issue('PENETRATION','contact','Penetration tolerance exceeded.'));
  array(c.forceResidualN,c.forceResidualN.length,'forceResidualN');
  for (const k of ['pressureWorkJ','thermalCouplingTransferJ','externalWorkJ'] as const) finite(c[k],k);
  const balance = c.externalWorkJ + c.pressureWorkJ -
    (c.next.recoverableEnergyJ - previous.recoverableEnergyJ) - c.physicalDissipationJ - c.numericalLossJ;
  const energyResidual = Float64Array.of(
    finite(balance,'mechanical work residual'), c.pressureWorkJ + c.thermalCouplingTransferJ,
    c.next.cumulativePressureWorkJ - previous.cumulativePressureWorkJ - c.pressureWorkJ,
    c.next.cumulativeExternalWorkJ - previous.cumulativeExternalWorkJ - c.externalWorkJ,
    c.next.cumulativePhysicalDissipationJ - previous.cumulativePhysicalDissipationJ - c.physicalDissipationJ,
    c.next.cumulativeNumericalLossJ - previous.cumulativeNumericalLossJ - c.numericalLossJ,
  );
  const groups: ResidualGroup[] = [
    { id:'mechanical-force',units:'N',residual:c.forceResidualN,norm:policy.forceNorm,scale:policy.forceScaleN,
      absoluteTolerance:policy.forceAbsoluteToleranceN,relativeTolerance:policy.forceRelativeTolerance,
      referenceScale:c.forceReferenceN,combination:policy.combination,boundary:policy.boundary },
    { id:'mechanical-work',units:'J',residual:energyResidual,norm:'linf',scale:policy.energyScaleJ,
      absoluteTolerance:policy.energyAbsoluteToleranceJ,relativeTolerance:policy.energyRelativeTolerance,
      referenceScale:Math.abs(c.externalWorkJ)+Math.abs(c.pressureWorkJ)+Math.abs(c.next.recoverableEnergyJ-previous.recoverableEnergyJ),
      combination:policy.combination,boundary:policy.boundary },
  ];
  const numerics = evaluateResidualGroups(groups);
  if (!numerics.ok || !numerics.passed) problems.push(issue('NUMERICAL_GATE','numerics','G rejected force/work criteria; this is not experimental evidence.'));
  return problems.length
    ? { status:'rejected',next:null,issues:Object.freeze(problems),numerics }
    : { status:'approved',next:c.next,issues:Object.freeze(problems),numerics };
}

/** A-owned transaction boundary around G.AtomicState. Tension-positive effective
 * stress; pressure/compressive contact positive. Protects ONLY the supplied
 * mechanical graph, not external transport/event state or global equation accuracy.
 */
export class MechanicalStateOwner {
  readonly #domain: PreparedMechanicsDomain;
  #store: AtomicState<MechanicalAcceptedStateV1>;
  constructor(initial: MechanicalAcceptedStateV1, domain: PreparedMechanicsDomain) {
    const canonical = domains.get(domain);
    if (!canonical) throw new TypeError('domain must come from successful A preparation');
    this.#domain = domain;
    const copy = cloneOwnedState(initial); validateState(copy, canonical);
    this.#store = new AtomicState(copy);
  }
  /** Owned copy; all stresses tension-positive and pore/contact pressures compression-positive. */
  readAccepted(): MechanicalAcceptedStateV1 { return this.#store.read(); }
  get acceptedVersion(): number { return this.#store.version; }
  /** Quiescent graph only; no byte codec/migration is inferred. Same sign conventions as state. */
  checkpoint(): MechanicalCheckpointV1 {
    return { format: 'zfs-mechanics-checkpoint', version: 1, contract: MECHANICS_BOUNDARY_VERSION, transaction: this.#store.snapshot() };
  }
  /** Exact contract/state/identity required. No migration or default values; same state signs. */
  static restore(checkpoint: MechanicalCheckpointV1, domain: PreparedMechanicsDomain, expected: MechanicsIdentity): MechanicalStateOwner {
    if (checkpoint.format !== 'zfs-mechanics-checkpoint' || checkpoint.version !== 1 ||
        checkpoint.contract !== MECHANICS_BOUNDARY_VERSION) throw new RangeError('checkpoint format/version');
    if (identityKey(checkpoint.transaction.committed.identity) !== identityKey(expected)) throw new RangeError('restart identity mismatch');
    const transaction = cloneOwnedState(checkpoint.transaction);
    const committed = detachDecodedMechanicalArrays(transaction.committed);
    const owner = new MechanicalStateOwner(committed, domain);
    owner.#store = AtomicState.restore({ ...transaction, committed });
    return owner;
  }
  /** Tension-positive solid convention. Disabled mode never invokes a backend.
   * Enabled mode only gates a supplied candidate; it does NOT compute a global solve.
   * Exceptions and rejected candidates cannot publish; dt/time/history are atomic.
   */
  attempt(input: MechanicalAttempt): MechanicalAttemptResult {
    if (input.enabled === false) return { status: 'disabled', version: this.#store.version, accepted: this.readAccepted(), issues: [], numerics: null };
    if (input.enabled !== true) throw new TypeError('enabled must be explicit boolean');
    if (!(finite(input.dtS, 'dtS') > 0)) throw new RangeError('positive dtS required');
    const policy = input.policy;
    nonnegative(policy.penetrationToleranceM, 'penetrationToleranceM');
    const result = this.#store.run(draft => {
      const baseVersion = this.#store.version;
      const candidate = input.propose(cloneOwnedState(draft), baseVersion);
      if (candidate && typeof candidate === 'object' && 'then' in candidate) throw new TypeError('async candidate unsupported');
      const review = reviewMechanicalCandidate(this.#domain,draft,baseVersion,candidate,input.dtS,policy);
      if (review.status === 'rejected') {
        const response: MechanicalAttemptResult = { status:'rejected',version:baseVersion,
          accepted:cloneOwnedState(draft),issues:review.issues,numerics:review.numerics };
        return { decision:'rollback' as const,value:response };
      }
      Object.assign(draft,review.next);
      // Construct and clone the public report BEFORE G's atomic publication.
      const response: MechanicalAttemptResult = { status:'accepted',version:baseVersion+1,
        accepted:cloneOwnedState(draft),issues:review.issues,numerics:review.numerics };
      return { decision:'commit' as const,value:response };
    });
    return result.value;
  }
}
