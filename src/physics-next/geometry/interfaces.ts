import {
  GeometryError, assertGeometryGrid, createGeometryGrid, finiteNumber, positiveInteger,
  positiveLengthM, readPointM, readVector3, type GeometryGrid, type GeometrySpec, type Vec3,
} from './types';
import { compileGeometry, type GeometryField } from './signedDistance';

export type GeometryMaterialRole = 'cap' | 'root' | 'hose' | 'soil' | 'void' | 'exterior';
export interface GeometryMaterial {
  readonly id: string;
  readonly role: GeometryMaterialRole;
}
export interface GeometryRegionSpec extends GeometryMaterial {
  /** Larger value wins; priorities must be unique. This is ownership, not a constitutive law. */
  readonly priority: number;
  readonly geometry: GeometrySpec;
  /** Optional declared smallest physical feature; never inferred from a rendered mesh. */
  readonly minimumFeatureM?: number;
}
export interface CompiledGeometryRegion extends GeometryMaterial {
  readonly priority: number;
  readonly field: GeometryField;
  readonly minimumFeatureM: number | null;
}
export const INTERFACE_LIMITS = Object.freeze({
  maxRegions: 32, maxPatches: 256, maxAxisSegments: 512,
  maxSamples: 131072, maxFieldNodeVisits: 20000000,
});
const roles: readonly GeometryMaterialRole[] = ['cap', 'root', 'hose', 'soil', 'void', 'exterior'];
const exterior: GeometryMaterial = Object.freeze({ id: '__exterior__', role: 'exterior' });
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const cloneMaterial = (m: GeometryMaterial): GeometryMaterial => ({ id: m.id, role: m.role });
function material(input: GeometryMaterial): GeometryMaterial {
  if (!input || typeof input.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(input.id) ||
      !roles.includes(input.role) || input.role === 'exterior') {
    throw new GeometryError('invalid-input', 'Material needs a bounded ID and a non-exterior geometry role.');
  }
  return cloneMaterial(input);
}

/** One deterministic partition shared by interface probing and cell occupancy. */
export class GeometryPartition {
  readonly #grid: GeometryGrid;
  readonly #regions: readonly CompiledGeometryRegion[];
  readonly #background: GeometryMaterial;
  private constructor(grid: GeometryGrid, specs: readonly GeometryRegionSpec[], background: GeometryMaterial) {
    assertGeometryGrid(grid);
    if (!Array.isArray(specs) || specs.length > INTERFACE_LIMITS.maxRegions) {
      throw new GeometryError('limit', 'Invalid material region array.');
    }
    this.#grid = createGeometryGrid(grid);
    this.#background = material(background);
    const ids = new Set([this.#background.id]), priorities = new Set<number>();
    const entries: CompiledGeometryRegion[] = [];
    for (const raw of specs as readonly GeometryRegionSpec[]) {
      const label = material(raw), priority = finiteNumber(raw.priority, 'region priority');
      if (!Number.isSafeInteger(priority) || ids.has(label.id) || priorities.has(priority)) {
        throw new GeometryError('invalid-input', 'Material IDs and integer priorities must be unique.');
      }
      ids.add(label.id); priorities.add(priority);
      const minimumFeatureM = raw.minimumFeatureM === undefined ? null :
        positiveLengthM(raw.minimumFeatureM, 'minimumFeatureM');
      entries.push(Object.freeze({ ...label, priority, minimumFeatureM, field: compileGeometry(raw.geometry) }));
    }
    entries.sort((a, b) => b.priority - a.priority);
    this.#regions = Object.freeze(entries);
    Object.freeze(this);
  }
  static fromSpec(
    grid: GeometryGrid, specs: readonly GeometryRegionSpec[], background: GeometryMaterial,
  ): GeometryPartition { return new GeometryPartition(grid, specs, background); }
  grid(): GeometryGrid { return createGeometryGrid(this.#grid); }
  regions(): CompiledGeometryRegion[] { return this.#regions.map(r => ({ ...r })); }
  background(): GeometryMaterial { return cloneMaterial(this.#background); }
  materials(): GeometryMaterial[] { return [...this.#regions.map(cloneMaterial), this.background()]; }
  cellAtPoint(point: Vec3): number | null {
    const p = readPointM(point, 'partition point'), g = this.#grid;
    if (p.some((v, a) => v < g.originM[a] || v >= g.originM[a] + g.sizeM[a])) return null;
    const counts = [g.nx, g.ny, g.nz];
    const indices = p.map((v, a) => Math.min(counts[a] - 1,
      Math.floor((v - g.originM[a]) / g.sizeM[a] * counts[a])));
    return (indices[2] * g.ny + indices[1]) * g.nx + indices[0];
  }
  /** Strict interior membership; exact zero is assigned to lower priority/background. */
  materialAt(point: Vec3): GeometryMaterial {
    if (this.cellAtPoint(point) === null) return cloneMaterial(exterior);
    for (const r of this.#regions) {
      if (r.field.classify(point) === 'inside') return cloneMaterial(r);
    }
    return this.background();
  }
  classifyProbe(point: Vec3, bandM: number): { material: GeometryMaterial; ambiguous: boolean } {
    const band = finiteNumber(bandM, 'probe classification band');
    if (band < 0 || band > 1e6) throw new GeometryError('invalid-input', 'Invalid probe band.');
    if (this.cellAtPoint(point) === null) return { material: cloneMaterial(exterior), ambiguous: false };
    for (const r of this.#regions) {
      const c = r.field.classify(point, band);
      if (c === 'boundary-band') return { material: this.materialAt(point), ambiguous: true };
      if (c === 'inside') return { material: cloneMaterial(r), ambiguous: false };
    }
    return { material: this.background(), ambiguous: false };
  }
}
export function createGeometryPartition(
  grid: GeometryGrid, regions: readonly GeometryRegionSpec[], background: GeometryMaterial,
): GeometryPartition { return GeometryPartition.fromSpec(grid, regions, background); }

export type InterfacePatch =
  | { readonly id: string; readonly kind: 'rectangle'; readonly originM: Vec3;
      readonly edgeUM: Vec3; readonly edgeVM: Vec3; readonly segmentsU: number; readonly segmentsV: number }
  | { readonly id: string; readonly kind: 'annulus'; readonly centerM: Vec3;
      readonly normal: Vec3; readonly innerRadiusM: number; readonly outerRadiusM: number;
      readonly radialSegments: number; readonly angularSegments: number }
  | { readonly id: string; readonly kind: 'cylinder-side'; readonly aM: Vec3; readonly bM: Vec3;
      readonly radiusM: number; readonly axialSegments: number; readonly angularSegments: number }
  | { readonly id: string; readonly kind: 'sphere-patch'; readonly centerM: Vec3; readonly polarAxis: Vec3;
      readonly radiusM: number; readonly cosPolarRange: readonly [number, number];
      readonly polarSegments: number; readonly angularSegments: number };

export interface InterfaceSamplingOptions {
  readonly probeOffsetM: number;
  readonly classificationBandM: number;
  /** Caller assertion for sampled locations; no local separation is guessed from a mesh. */
  readonly declaredMinimumSeparationM: number;
}
export interface GeometryInterfaceSample {
  readonly key: string;
  readonly patchId: string;
  readonly ordinal: number;
  readonly pointM: Vec3;
  /** Normal from canonical material A (lexicographically smaller ID) to B. */
  readonly normalFromAToB: Vec3;
  readonly materialA: GeometryMaterial;
  readonly materialB: GeometryMaterial;
  readonly cellA: number | null;
  readonly cellB: number | null;
  /** Single-interface quadrature weight; never sum its two oriented copies as two surfaces. */
  readonly areaM2: number;
}
export interface OrientedGeometryInterfaceSample {
  readonly key: string;
  readonly pointM: Vec3;
  readonly outwardNormal: Vec3;
  readonly from: GeometryMaterial;
  readonly to: GeometryMaterial;
  readonly fromCell: number | null;
  readonly toCell: number | null;
  readonly areaM2: number;
}
export interface GeometryInterfaceReport {
  readonly grid: GeometryGrid;
  readonly samples: readonly GeometryInterfaceSample[];
  readonly candidateAreaM2: number;
  readonly acceptedAreaM2: number;
  readonly hiddenCandidateAreaM2: number;
  readonly ambiguousCandidateAreaM2: number;
  readonly duplicatePatchCount: number;
  readonly duplicateSampleCount: number;
  readonly duplicateCandidateAreaM2: number;
  readonly coverage: 'caller-supplied-patches-only';
  readonly areaMethod: 'analytic-patch-weights-with-midpoint-clipping';
  /** A two-scale sided check, not a proof of surface completeness or contact. */
  readonly probeOffsetM: number;
}
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit(a: Vec3): Vec3 {
  const magnitude = Math.hypot(...a);
  if (!(magnitude > 0) || !Number.isFinite(magnitude)) throw new GeometryError('invalid-input', 'Degenerate interface direction.');
  return [a[0] / magnitude, a[1] / magnitude, a[2] / magnitude];
}
function frame(normal: Vec3): { n: Vec3; u: Vec3; v: Vec3 } {
  const n = unit(readVector3(normal, 'normal'));
  const seed: Vec3 = Math.abs(n[0]) <= Math.abs(n[1]) && Math.abs(n[0]) <= Math.abs(n[2]) ?
    [1, 0, 0] : Math.abs(n[1]) <= Math.abs(n[2]) ? [0, 1, 0] : [0, 0, 1];
  const u = unit(cross(seed, n));
  return { n, u, v: unit(cross(n, u)) };
}
interface CompiledPatch {
  id: string; signature: string; count: number; areaM2: number;
  sample: (ordinal: number) => { pointM: Vec3; normal: Vec3 };
}
function patch(raw: InterfacePatch): CompiledPatch {
  if (!raw || typeof raw.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(raw.id)) {
    throw new GeometryError('invalid-input', 'Patch needs a bounded ID.');
  }
  const segments = (v: number) => positiveInteger(v, INTERFACE_LIMITS.maxAxisSegments, 'patch segments');
  const angles = (v: number) => {
    const n = segments(v);
    if (n < 3) throw new GeometryError('invalid-input', 'Use at least three angular segments.');
    return n;
  };
  let count: number, areaM2: number, canonical: unknown, sample: CompiledPatch['sample'];
  if (raw.kind === 'rectangle') {
    const origin = readPointM(raw.originM, 'patch origin');
    const u = readVector3(raw.edgeUM, 'edgeUM'), v = readVector3(raw.edgeVM, 'edgeVM');
    positiveLengthM(Math.hypot(...u), 'edgeUM length'); positiveLengthM(Math.hypot(...v), 'edgeVM length');
    const n = unit(cross(u, v)), nu = segments(raw.segmentsU), nv = segments(raw.segmentsV);
    areaM2 = Math.hypot(...cross(u, v)); count = nu * nv;
    canonical = ['rectangle', origin, u, v, nu, nv];
    sample = i => ({
      pointM: add(origin, add(scale(u, ((i % nu) + 0.5) / nu), scale(v, (Math.floor(i / nu) + 0.5) / nv))),
      normal: [...n] as Vec3,
    });
  } else if (raw.kind === 'annulus') {
    const center = readPointM(raw.centerM, 'annulus center'), basis = frame(raw.normal);
    const outer = positiveLengthM(raw.outerRadiusM, 'outerRadiusM'), inner = finiteNumber(raw.innerRadiusM, 'innerRadiusM');
    if (inner < 0 || inner >= outer) throw new GeometryError('invalid-input', 'Annulus needs 0 <= inner < outer.');
    const nr = segments(raw.radialSegments), na = angles(raw.angularSegments);
    areaM2 = Math.PI * (outer - inner) * (outer + inner); count = nr * na;
    canonical = ['annulus', center, basis.n, inner, outer, nr, na];
    sample = i => {
      const angle = 2 * Math.PI * ((i % na) + 0.5) / na;
      const radius = Math.sqrt(inner ** 2 + (outer ** 2 - inner ** 2) * (Math.floor(i / na) + 0.5) / nr);
      return { pointM: add(center, add(scale(basis.u, radius * Math.cos(angle)),
        scale(basis.v, radius * Math.sin(angle)))), normal: [...basis.n] as Vec3 };
    };
  } else if (raw.kind === 'cylinder-side') {
    const a = readPointM(raw.aM, 'cylinder aM'), b = readPointM(raw.bM, 'cylinder bM');
    const axis = subtract(b, a), length = positiveLengthM(Math.hypot(...axis), 'cylinder length');
    const radius = positiveLengthM(raw.radiusM, 'cylinder radius'), basis = frame(axis);
    const nz = segments(raw.axialSegments), na = angles(raw.angularSegments);
    areaM2 = 2 * Math.PI * radius * length; count = nz * na;
    canonical = ['cylinder-side', a, b, radius, nz, na];
    sample = i => {
      const angle = 2 * Math.PI * ((i % na) + 0.5) / na;
      const normal = add(scale(basis.u, Math.cos(angle)), scale(basis.v, Math.sin(angle)));
      return { pointM: add(a, add(scale(axis, (Math.floor(i / na) + 0.5) / nz), scale(normal, radius))), normal };
    };
  } else if (raw.kind === 'sphere-patch') {
    const center = readPointM(raw.centerM, 'sphere center'), basis = frame(raw.polarAxis);
    const radius = positiveLengthM(raw.radiusM, 'sphere radius');
    if (!Array.isArray(raw.cosPolarRange) || raw.cosPolarRange.length !== 2) {
      throw new GeometryError('invalid-input', 'Supply a cos-polar interval.');
    }
    const lo = finiteNumber(raw.cosPolarRange[0], 'cos min'), hi = finiteNumber(raw.cosPolarRange[1], 'cos max');
    if (lo < -1 || hi > 1 || lo >= hi) throw new GeometryError('invalid-input', 'Invalid cos-polar interval.');
    const np = segments(raw.polarSegments), na = angles(raw.angularSegments);
    areaM2 = 2 * Math.PI * radius ** 2 * (hi - lo); count = np * na;
    canonical = ['sphere-patch', center, basis.n, radius, lo, hi, np, na];
    sample = i => {
      const cos = lo + (hi - lo) * (Math.floor(i / na) + 0.5) / np, sin = Math.sqrt(Math.max(0, 1 - cos ** 2));
      const angle = 2 * Math.PI * ((i % na) + 0.5) / na;
      const normal = add(scale(basis.n, cos), add(scale(basis.u, sin * Math.cos(angle)), scale(basis.v, sin * Math.sin(angle))));
      return { pointM: add(center, scale(normal, radius)), normal };
    };
  } else {
    throw new GeometryError('invalid-input', 'Unsupported analytic patch kind.');
  }
  if (!(areaM2 > 0) || !Number.isFinite(areaM2) || count > INTERFACE_LIMITS.maxSamples) {
    throw new GeometryError('budget', 'Invalid patch area or excessive patch samples.');
  }
  return { id: raw.id, signature: JSON.stringify(canonical), count, areaM2, sample };
}

/**
 * Candidate surfaces are supplied explicitly, never inferred from rendered meshes.
 * Sided membership removes hidden/internal candidates. No forces, contact or fluxes.
 * Exact duplicate patch signatures are removed before quadrature. Partial overlapping
 * patch parameterizations must be resolved by the caller; completeness is not certified.
 */
export function sampleGeometryInterfaces(
  partition: GeometryPartition, patches: readonly InterfacePatch[], options: InterfaceSamplingOptions,
): GeometryInterfaceReport {
  if (!(partition instanceof GeometryPartition) || !Array.isArray(patches) || patches.length > INTERFACE_LIMITS.maxPatches) {
    throw new GeometryError('invalid-input', 'Partition and bounded patch array are required.');
  }
  if (!options || typeof options !== 'object') throw new GeometryError('invalid-input', 'Interface options required.');
  const offset = positiveLengthM(options.probeOffsetM, 'probeOffsetM');
  const separation = positiveLengthM(options.declaredMinimumSeparationM, 'declaredMinimumSeparationM');
  const band = finiteNumber(options.classificationBandM, 'classificationBandM');
  if (band < 0 || band >= offset / 4 || offset > separation / 8) {
    throw new GeometryError('resolution', 'Probe offset/band is inconsistent with declared interface separation.');
  }
  for (const r of partition.regions()) {
    if (r.minimumFeatureM !== null && offset > r.minimumFeatureM / 8) {
      throw new GeometryError('resolution', 'Probe may cross a declared thin material feature.');
    }
  }
  const compiled = (patches as readonly InterfacePatch[]).map(patch).sort((a, b) => compare(a.id, b.id));
  const signatures = new Set<string>(), idSignatures = new Map<string, string>(), unique: CompiledPatch[] = [];
  let duplicatePatchCount = 0, candidateCount = 0;
  for (const p of compiled) {
    if (idSignatures.has(p.id) && idSignatures.get(p.id) !== p.signature) {
      throw new GeometryError('invalid-input', 'Conflicting patch geometry under one ID.');
    }
    idSignatures.set(p.id, p.signature);
    if (signatures.has(p.signature)) { duplicatePatchCount++; continue; }
    signatures.add(p.signature); unique.push(p); candidateCount += p.count;
  }
  const nodeCost = Math.max(1, partition.regions().reduce((s, r) => s + r.field.nodeCount, 0));
  if (candidateCount > INTERFACE_LIMITS.maxSamples || candidateCount * 8 * nodeCost > INTERFACE_LIMITS.maxFieldNodeVisits) {
    throw new GeometryError('budget', 'Interface quadrature/evaluation budget exceeded.');
  }
  const samples: GeometryInterfaceSample[] = [], coincident = new Map<string, GeometryInterfaceSample>();
  let candidateAreaM2 = 0, hiddenCandidateAreaM2 = 0, ambiguousCandidateAreaM2 = 0;
  let acceptedAreaM2 = 0, duplicateSampleCount = 0, duplicateCandidateAreaM2 = 0;
  for (const p of unique) {
    candidateAreaM2 += p.areaM2;
    const weight = p.areaM2 / p.count;
    for (let ordinal = 0; ordinal < p.count; ordinal++) {
      const raw = p.sample(ordinal), pointM = readPointM(raw.pointM, 'interface point'), normal = unit(raw.normal);
      const floor = 256 * Number.EPSILON * Math.max(1, ...pointM.map(Math.abs));
      if (offset / 2 <= floor) throw new GeometryError('resolution', 'Interface probes are unresolvable at these coordinates.');
      const minus = readPointM(add(pointM, scale(normal, -offset)), 'minus probe');
      const plus = readPointM(add(pointM, scale(normal, offset)), 'plus probe');
      const nearMinus = readPointM(add(pointM, scale(normal, -offset / 2)), 'near-minus probe');
      const nearPlus = readPointM(add(pointM, scale(normal, offset / 2)), 'near-plus probe');
      const m = partition.classifyProbe(minus, band), n = partition.classifyProbe(plus, band);
      const m2 = partition.classifyProbe(nearMinus, band), n2 = partition.classifyProbe(nearPlus, band);
      if (m.ambiguous || n.ambiguous || m2.ambiguous || n2.ambiguous ||
          m.material.id !== m2.material.id || n.material.id !== n2.material.id) {
        ambiguousCandidateAreaM2 += weight; continue;
      }
      if (m.material.id === n.material.id) { hiddenCandidateAreaM2 += weight; continue; }
      const forward = compare(m.material.id, n.material.id) < 0;
      const materialA = forward ? m.material : n.material, materialB = forward ? n.material : m.material;
      const direction = scale(normal, forward ? 1 : -1);
      const signature = JSON.stringify([pointM, direction.map(v => v === 0 ? 0 : v), materialA.id, materialB.id]);
      const previous = coincident.get(signature);
      if (previous) {
        if (Math.abs(previous.areaM2 - weight) > 64 * Number.EPSILON * Math.max(previous.areaM2, weight)) {
          throw new GeometryError('invalid-input', 'Coincident samples have conflicting area weights; supply a nonoverlapping patch set.');
        }
        duplicateSampleCount++; duplicateCandidateAreaM2 += weight; continue;
      }
      const sample: GeometryInterfaceSample = {
        key: `${p.id}:${ordinal.toString().padStart(8, '0')}`, patchId: p.id, ordinal,
        pointM: [...pointM] as Vec3, normalFromAToB: [...direction] as Vec3,
        materialA: cloneMaterial(materialA), materialB: cloneMaterial(materialB),
        cellA: partition.cellAtPoint(forward ? minus : plus), cellB: partition.cellAtPoint(forward ? plus : minus),
        areaM2: weight,
      };
      coincident.set(signature, sample); samples.push(sample); acceptedAreaM2 += weight;
    }
  }
  return {
    grid: partition.grid(), samples, candidateAreaM2, acceptedAreaM2,
    hiddenCandidateAreaM2, ambiguousCandidateAreaM2, duplicatePatchCount,
    duplicateSampleCount, duplicateCandidateAreaM2, coverage: 'caller-supplied-patches-only',
    areaMethod: 'analytic-patch-weights-with-midpoint-clipping', probeOffsetM: offset,
  };
}

/** Each physical sample produces two fresh, oppositely oriented transfer descriptors. */
export function orientGeometryInterfaces(report: GeometryInterfaceReport): OrientedGeometryInterfaceSample[] {
  if (!report || typeof report !== 'object') throw new GeometryError('invalid-input', 'Interface report required.');
  assertGeometryGrid(report.grid);
  const samples = report.samples;
  if (!Array.isArray(samples) || samples.length > INTERFACE_LIMITS.maxSamples) {
    throw new GeometryError('invalid-input', 'Bounded interface sample array required.');
  }
  const output: OrientedGeometryInterfaceSample[] = [];
  for (const s of samples as readonly GeometryInterfaceSample[]) {
    const p = readPointM(s.pointM, 'interface point'), n = unit(readVector3(s.normalFromAToB, 'interface normal'));
    const area = finiteNumber(s.areaM2, 'interface area');
    if (!(area > 0)) throw new GeometryError('invalid-input', 'Interface area must be positive.');
    if (typeof s.key !== 'string' || s.key.length === 0) throw new GeometryError('invalid-input', 'Interface key required.');
    for (const [label, cell] of [[s.materialA, s.cellA], [s.materialB, s.cellB]] as const) {
      if (label?.role === 'exterior') {
        if (label.id !== exterior.id || cell !== null) throw new GeometryError('invalid-input', 'Invalid exterior interface side.');
      } else {
        material(label);
        if (!Number.isSafeInteger(cell) || cell === null || cell < 0 || cell >= report.grid.cellCount) {
          throw new GeometryError('invalid-input', 'Interior interface side needs a nonnegative cell index.');
        }
      }
    }
    if (s.materialA.id === s.materialB.id) throw new GeometryError('invalid-input', 'An interface requires different material IDs.');
    output.push(
      { key: `${s.key}:A`, pointM: [...p] as Vec3, outwardNormal: [...n] as Vec3,
        from: cloneMaterial(s.materialA), to: cloneMaterial(s.materialB), fromCell: s.cellA, toCell: s.cellB, areaM2: area },
      { key: `${s.key}:B`, pointM: [...p] as Vec3, outwardNormal: scale(n, -1),
        from: cloneMaterial(s.materialB), to: cloneMaterial(s.materialA), fromCell: s.cellB, toCell: s.cellA, areaM2: area },
    );
  }
  return output;
}
