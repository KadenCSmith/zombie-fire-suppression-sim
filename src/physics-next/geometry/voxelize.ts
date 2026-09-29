import {
  GeometryError, GEOMETRY_LIMITS, assertGeometryGrid, cellBoundsM, createGeometryGrid, finiteNumber, positiveInteger,
  type GeometryGrid, type GeometrySpec, type Vec3,
} from './types';
import {
  GeometryPartition, createGeometryPartition, type CompiledGeometryRegion,
  type GeometryMaterial, type GeometryRegionSpec,
} from './interfaces';

export const VOXELIZATION_LIMITS = Object.freeze({
  maxDepth: 10, maxBlocks: 2000000, defaultMaxBlocks: 200000,
  maxFieldNodeVisits: GEOMETRY_LIMITS.maxSampleNodeVisits,
  /** Three Float64 fraction buffers plus one byte evidence buffer per entry. */
  maxMaterialCellEntries: 2000000,
  maxStagedCellEntries: 1048576, maxReferenceVolumes: 33,
});
export interface DeclaredMaterialVolume {
  readonly materialId: string;
  /** Must describe this clipped, priority-owned material, not an overlapping primitive. */
  readonly volumeM3: number;
  readonly toleranceM3: number;
}
export interface VoxelizationOptions {
  readonly maxDepth?: number;
  readonly maxBlocks?: number;
  /** Absolute allowed geometric volume error PER MATERIAL, not a length tolerance. */
  readonly volumeToleranceM3: number;
  readonly referenceVolumes?: readonly DeclaredMaterialVolume[];
}
export interface MaterialVoxelOccupancy {
  readonly material: GeometryMaterial;
  readonly fraction: Float64Array;
  readonly lowerFraction: Float64Array;
  readonly upperFraction: Float64Array;
  /** 0 = proven absent; 1 = positive lower-bound volume; 2 = possible only. */
  readonly evidenceMask: Uint8Array;
  readonly estimatedVolumeM3: number;
  readonly lowerVolumeM3: number;
  readonly upperVolumeM3: number;
  readonly maxVolumeErrorM3: number;
}
export interface MaterialVolumeCheck {
  readonly materialId: string;
  readonly declaredVolumeM3: number;
  readonly estimatedVolumeM3: number;
  readonly lowerVolumeM3: number;
  readonly upperVolumeM3: number;
  readonly estimateDifferenceM3: number;
  readonly intervalContainsDeclared: boolean;
  /** Entire computed interval must lie within declaredVolume +/- tolerance. */
  readonly withinTolerance: boolean;
  readonly toleranceM3: number;
}
export interface SubcellFeatureReport {
  readonly materialId: string;
  readonly declaredMinimumFeatureM: number | null;
  readonly largestAmbiguousLeafWidthM: number;
  readonly possibleVolumeM3: number;
  readonly confirmedVolumeM3: number;
  readonly estimatedVolumeM3: number;
  readonly reasons: readonly string[];
}
export interface GeometryVoxelization {
  readonly grid: GeometryGrid;
  readonly materials: readonly MaterialVoxelOccupancy[];
  readonly cellVolumesM3: Float64Array;
  /** Volume fraction in leaves where material ownership was not uniquely established. */
  readonly unresolvedFraction: Float64Array;
  /** Arithmetic widening, separate from geometric unresolved fraction. */
  readonly arithmeticPaddingFraction: Float64Array;
  readonly representedDomainVolumeM3: number;
  readonly nominalDomainVolumeM3: number;
  readonly domainEdgeRoundoffM3: number;
  readonly integratedPartitionResidualM3: number;
  readonly unresolvedVolumeM3: number;
  readonly maxMaterialVolumeErrorM3: number;
  readonly volumeToleranceM3: number;
  readonly accepted: boolean;
  readonly volumeChecks: readonly MaterialVolumeCheck[];
  readonly features: readonly SubcellFeatureReport[];
  readonly visitedBlocks: number;
  readonly leafCount: number;
  readonly uncertainLeafCount: number;
  readonly depthLimitedLeafCount: number;
  readonly budgetLimitedLeafCount: number;
  readonly precisionLimitedLeafCount: number;
  readonly maxDepthReached: number;
  readonly nodeVisitUpperBound: number;
  readonly method: 'shared-adaptive-lipschitz-volume-bounds';
  /** Engineering floating-point guards, NOT formally certified interval arithmetic. */
  readonly boundArithmetic: 'real-arithmetic-enclosure-with-roundoff-guards';
  readonly topologyValidated: false;
}
interface Block {
  minM: Vec3;
  maxM: Vec3;
  depth: number;
}
const volume = (b: Block): number =>
  (b.maxM[0] - b.minM[0]) * (b.maxM[1] - b.minM[1]) * (b.maxM[2] - b.minM[2]);
function midpoint(b: Block): Vec3 {
  return [
    b.minM[0] + (b.maxM[0] - b.minM[0]) / 2,
    b.minM[1] + (b.maxM[1] - b.minM[1]) / 2,
    b.minM[2] + (b.maxM[2] - b.minM[2]) / 2,
  ];
}
function compensatedSum(values: Iterable<number>): number {
  let result = 0, correction = 0;
  for (const v of values) {
    const y = v - correction, next = result + y;
    correction = (next - result) - y; result = next;
  }
  return result;
}
function nonnegative(value: number, name: string): number {
  const n = finiteNumber(value, name);
  if (n < 0) throw new GeometryError('invalid-input', `${name} must be nonnegative.`);
  return n;
}
function optionsFor(input: VoxelizationOptions): {
  maxDepth: number; maxBlocks: number; tolerance: number; references: DeclaredMaterialVolume[];
} {
  if (!input || typeof input !== 'object') throw new GeometryError('invalid-input', 'Explicit voxelization options required.');
  const depth = input.maxDepth ?? 4;
  if (!Number.isSafeInteger(depth) || depth < 0 || depth > VOXELIZATION_LIMITS.maxDepth) {
    throw new GeometryError('limit', 'maxDepth must be an integer from 0 to 10.');
  }
  const maxBlocks = positiveInteger(input.maxBlocks ?? VOXELIZATION_LIMITS.defaultMaxBlocks,
    VOXELIZATION_LIMITS.maxBlocks, 'maxBlocks');
  const tolerance = nonnegative(input.volumeToleranceM3, 'volumeToleranceM3');
  const refs = input.referenceVolumes ?? [];
  if (!Array.isArray(refs) || refs.length > VOXELIZATION_LIMITS.maxReferenceVolumes) {
    throw new GeometryError('invalid-input', 'Invalid declared-volume array.');
  }
  const ids = new Set<string>();
  const references = (refs as readonly DeclaredMaterialVolume[]).map(r => {
    if (!r || typeof r.materialId !== 'string' || ids.has(r.materialId)) {
      throw new GeometryError('invalid-input', 'Declared-volume IDs must be unique.');
    }
    ids.add(r.materialId);
    return {
      materialId: r.materialId, volumeM3: nonnegative(r.volumeM3, 'declared volume'),
      toleranceM3: nonnegative(r.toleranceM3, 'declared tolerance'),
    };
  });
  return { maxDepth: depth, maxBlocks, tolerance, references };
}

/**
 * At a block centre c with half-diagonal R, each unit-Lipschitz field obeys
 * f(c)-R <= f(p) <= f(c)+R throughout the block in real arithmetic.
 * Unknown higher-priority regions remain candidates even if a lower region
 * is definitely inside. This prevents overlapping solid/void double counting.
 */
function blockOwnership(
  b: Block, regions: readonly CompiledGeometryRegion[],
  bounds: readonly ReturnType<CompiledGeometryRegion['field']['boundsM']>[],
): { candidates: number[]; centerOwner: number } {
  const c = midpoint(b), radius = Math.hypot(
    (b.maxM[0] - b.minM[0]) / 2, (b.maxM[1] - b.minM[1]) / 2, (b.maxM[2] - b.minM[2]) / 2,
  );
  const coordinateScale = Math.max(1, radius, ...c.map(Math.abs));
  const background = regions.length, candidates: number[] = [];
  let centerOwner = background, foundCertainInterior = false;
  for (let i = 0; i < regions.length; i++) {
    const bound = bounds[i];
    if (bound.kind === 'empty' || (bound.kind === 'finite' &&
        b.minM.some((v, a) => v >= bound.maxM[a] || b.maxM[a] <= bound.minM[a]))) continue;
    const field = regions[i].field, value = field.valueM(c);
    const guard = 256 * Number.EPSILON * coordinateScale * (field.treeDepth + 1);
    if (value - radius > guard) continue;
    if (centerOwner === background && value < 0) centerOwner = i;
    candidates.push(i);
    if (value + radius < -guard) { foundCertainInterior = true; break; }
  }
  if (!foundCertainInterior) candidates.push(background);
  if (candidates.length === 1) centerOwner = candidates[0];
  if (!candidates.includes(centerOwner)) throw new GeometryError('resolution', 'Inconsistent block ownership.');
  return { candidates, centerOwner };
}
function split(b: Block): Block[] | null {
  const middle = midpoint(b);
  const floor = 64 * Number.EPSILON * Math.max(1, ...b.minM.map(Math.abs), ...b.maxM.map(Math.abs));
  if (middle.some((v, a) => v - b.minM[a] <= floor || b.maxM[a] - v <= floor)) return null;
  const children: Block[] = [];
  for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const bit = [x, y, z];
    children.push({
      minM: bit.map((v, a) => v ? middle[a] : b.minM[a]) as unknown as Vec3,
      maxM: bit.map((v, a) => v ? b.maxM[a] : middle[a]) as unknown as Vec3,
      depth: b.depth + 1,
    });
  }
  return children;
}

/**
 * A shared disjoint leaf partition conserves total represented volume. Unresolved
 * leaves retain material lower/upper bounds and deterministic centre estimates.
 * A missed centre sample never becomes proof that a thin feature is absent.
 * Resource exhaustion returns a visibly unaccepted/bounded result, not false zeros.
 */
export function voxelizeGeometry(partition: GeometryPartition, input: VoxelizationOptions): GeometryVoxelization {
  if (!(partition instanceof GeometryPartition)) throw new GeometryError('invalid-input', 'Compiled geometry partition required.');
  const opts = optionsFor(input), grid = partition.grid(), regions = partition.regions(), labels = partition.materials();
  const n = grid.cellCount, m = labels.length;
  if (m * n > VOXELIZATION_LIMITS.maxMaterialCellEntries) {
    throw new GeometryError('budget', 'Material/grid output allocation exceeds its explicit budget.');
  }
  for (const r of opts.references) {
    if (!labels.some(label => label.id === r.materialId)) throw new GeometryError('invalid-input', 'Unknown declared material ID.');
  }
  const nodeCost = Math.max(1, regions.reduce((s, r) => s + r.field.nodeCount, 0));
  const blockBudget = Math.min(opts.maxBlocks, Math.floor(VOXELIZATION_LIMITS.maxFieldNodeVisits / nodeCost));
  if (blockBudget < n) throw new GeometryError('budget', 'Budget cannot classify every root cell; no partial grid returned.');
  const bounds = regions.map(r => r.field.boundsM());
  const estimate = labels.map(() => new Float64Array(n));
  const lower = labels.map(() => new Float64Array(n)), upper = labels.map(() => new Float64Array(n));
  const cellVolumesM3 = new Float64Array(n), unresolvedFraction = new Float64Array(n);
  const arithmeticPaddingFraction = new Float64Array(n), ambiguousWidths = new Float64Array(regions.length);
  let scheduled = n, visitedBlocks = 0, leafCount = 0, uncertainLeafCount = 0, maxDepthReached = 0;
  let depthLimitedLeafCount = 0, budgetLimitedLeafCount = 0, precisionLimitedLeafCount = 0;
  for (let q = 0; q < n; q++) {
    const cell = cellBoundsM(grid, q), root: Block = { minM: cell.minM, maxM: cell.maxM, depth: 0 };
    const cellVolume = volume(root);
    if (!(cellVolume > 0) || !Number.isFinite(cellVolume)) throw new GeometryError('resolution', 'Invalid physical cell volume.');
    cellVolumesM3[q] = cellVolume;
    const stack: Block[] = [root];
    let localLeaves = 0;
    while (stack.length > 0) {
      const b = stack.pop()!;
      visitedBlocks++; maxDepthReached = Math.max(maxDepthReached, b.depth);
      const { candidates, centerOwner } = blockOwnership(b, regions, bounds);
      const unknown = candidates.length > 1;
      if (unknown) {
        if (b.depth < opts.maxDepth && scheduled + 8 <= blockBudget) {
          const children = split(b);
          if (children) {
            scheduled += 8;
            // Reverse push preserves x-fastest deterministic child visitation.
            for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
            continue;
          }
          precisionLimitedLeafCount++;
        } else if (b.depth >= opts.maxDepth) {
          depthLimitedLeafCount++;
        } else {
          budgetLimitedLeafCount++;
        }
      }
      const fraction = volume(b) / cellVolume;
      if (!(fraction > 0) || !Number.isFinite(fraction)) throw new GeometryError('resolution', 'Leaf measure underflow.');
      leafCount++; localLeaves++;
      estimate[centerOwner][q] += fraction;
      for (const i of candidates) upper[i][q] += fraction;
      if (!unknown) lower[centerOwner][q] += fraction;
      else {
        uncertainLeafCount++; unresolvedFraction[q] += fraction;
        const width = Math.max(...b.maxM.map((v, a) => v - b.minM[a]));
        for (const i of candidates) if (i < regions.length) ambiguousWidths[i] = Math.max(ambiguousWidths[i], width);
      }
    }
    const guard = Math.min(1, 256 * Number.EPSILON * Math.max(1, localLeaves));
    arithmeticPaddingFraction[q] = guard;
    const total = compensatedSum(estimate.map(values => values[q]));
    if (Math.abs(total - 1) > guard) throw new GeometryError('resolution', 'Shared leaf partition lost volume.');
    // Repair only roundoff in the largest occupied bin, never rescale to a declared volume.
    let largest = 0;
    for (let i = 1; i < m; i++) if (estimate[i][q] > estimate[largest][q]) largest = i;
    estimate[largest][q] += 1 - total;
    unresolvedFraction[q] = Math.max(0, Math.min(1, unresolvedFraction[q]));
    const uniformKnownCell = unresolvedFraction[q] === 0 && estimate[largest][q] === 1;
    for (let i = 0; i < m; i++) {
      const e = estimate[i][q];
      if (e < -guard || e > 1 + guard) throw new GeometryError('resolution', 'Invalid material fraction.');
      estimate[i][q] = Math.max(0, Math.min(1, e));
      if (uniformKnownCell) {
        lower[i][q] = estimate[i][q]; upper[i][q] = estimate[i][q];
      } else {
        lower[i][q] = lower[i][q] === 0 ? 0 : Math.max(0, lower[i][q] - guard);
        upper[i][q] = upper[i][q] === 0 ? 0 : Math.min(1, upper[i][q] + guard);
        if (lower[i][q] > estimate[i][q] || upper[i][q] < estimate[i][q]) {
          throw new GeometryError('resolution', 'Roundoff widened bounds do not contain the estimate.');
        }
      }
    }
  }
  const materials: MaterialVoxelOccupancy[] = labels.map((label, i) => {
    const evidenceMask = new Uint8Array(n);
    for (let q = 0; q < n; q++) evidenceMask[q] = upper[i][q] === 0 ? 0 : lower[i][q] > 0 ? 1 : 2;
    const estimatedVolumeM3 = compensatedSum(estimate[i].map((f, q) => f * cellVolumesM3[q]));
    const lowerVolumeM3 = compensatedSum(lower[i].map((f, q) => f * cellVolumesM3[q]));
    const upperVolumeM3 = compensatedSum(upper[i].map((f, q) => f * cellVolumesM3[q]));
    return {
      material: { ...label }, fraction: estimate[i], lowerFraction: lower[i], upperFraction: upper[i], evidenceMask,
      estimatedVolumeM3, lowerVolumeM3, upperVolumeM3,
      maxVolumeErrorM3: Math.max(estimatedVolumeM3 - lowerVolumeM3, upperVolumeM3 - estimatedVolumeM3),
    };
  });
  const features: SubcellFeatureReport[] = regions.map((r, i) => {
    const occupied = materials[i], reasons: string[] = [];
    if (occupied.upperVolumeM3 > 0 && occupied.estimatedVolumeM3 === 0) reasons.push('possible-occupancy-not-sampled');
    if (occupied.upperVolumeM3 > 0 && occupied.lowerVolumeM3 === 0) reasons.push('no-guaranteed-positive-occupied-volume');
    if (r.minimumFeatureM !== null && ambiguousWidths[i] > r.minimumFeatureM / 2) {
      reasons.push('declared-feature-not-resolved-at-ambiguous-leaves');
    }
    if (r.minimumFeatureM === null) reasons.push('minimum-feature-size-not-declared');
    return {
      materialId: r.id, declaredMinimumFeatureM: r.minimumFeatureM,
      largestAmbiguousLeafWidthM: ambiguousWidths[i], possibleVolumeM3: occupied.upperVolumeM3,
      confirmedVolumeM3: occupied.lowerVolumeM3, estimatedVolumeM3: occupied.estimatedVolumeM3, reasons,
    };
  });
  const volumeChecks: MaterialVolumeCheck[] = opts.references.map(ref => {
    const occupancy = materials.find(o => o.material.id === ref.materialId)!;
    return {
      materialId: ref.materialId, declaredVolumeM3: ref.volumeM3,
      estimatedVolumeM3: occupancy.estimatedVolumeM3, lowerVolumeM3: occupancy.lowerVolumeM3,
      upperVolumeM3: occupancy.upperVolumeM3, estimateDifferenceM3: occupancy.estimatedVolumeM3 - ref.volumeM3,
      intervalContainsDeclared: ref.volumeM3 >= occupancy.lowerVolumeM3 && ref.volumeM3 <= occupancy.upperVolumeM3,
      withinTolerance: Math.max(Math.abs(occupancy.lowerVolumeM3 - ref.volumeM3),
        Math.abs(occupancy.upperVolumeM3 - ref.volumeM3)) <= ref.toleranceM3,
      toleranceM3: ref.toleranceM3,
    };
  });
  const representedDomainVolumeM3 = compensatedSum(cellVolumesM3);
  const nominalDomainVolumeM3 = grid.sizeM[0] * grid.sizeM[1] * grid.sizeM[2];
  const integratedPartitionResidualM3 = compensatedSum(materials.map(o => o.estimatedVolumeM3)) - representedDomainVolumeM3;
  const integrationGuard = 256 * Number.EPSILON * Math.max(n, m) * representedDomainVolumeM3;
  if (Math.abs(integratedPartitionResidualM3) > integrationGuard) throw new GeometryError('resolution', 'Integrated material volumes lost domain measure.');
  const maxMaterialVolumeErrorM3 = Math.max(...materials.map(o => o.maxVolumeErrorM3));
  const unresolvedVolumeM3 = compensatedSum(unresolvedFraction.map((f, q) => f * cellVolumesM3[q]));
  const unresolvedFeature = features.some(f => f.reasons.some(reason =>
    reason !== 'minimum-feature-size-not-declared'));
  return {
    grid: createGeometryGrid(grid), materials, cellVolumesM3, unresolvedFraction, arithmeticPaddingFraction,
    representedDomainVolumeM3, nominalDomainVolumeM3,
    domainEdgeRoundoffM3: representedDomainVolumeM3 - nominalDomainVolumeM3,
    integratedPartitionResidualM3, unresolvedVolumeM3, maxMaterialVolumeErrorM3,
    volumeToleranceM3: opts.tolerance,
    accepted: maxMaterialVolumeErrorM3 <= opts.tolerance && volumeChecks.every(c => c.withinTolerance) && !unresolvedFeature,
    volumeChecks, features, visitedBlocks, leafCount, uncertainLeafCount,
    depthLimitedLeafCount, budgetLimitedLeafCount, precisionLimitedLeafCount, maxDepthReached,
    nodeVisitUpperBound: visitedBlocks * nodeCost, method: 'shared-adaptive-lipschitz-volume-bounds',
    boundArithmetic: 'real-arithmetic-enclosure-with-roundoff-guards', topologyValidated: false,
  };
}
export function requireAcceptedVoxelization(result: GeometryVoxelization): void {
  if (!result || result.accepted !== true) {
    throw new GeometryError('resolution', 'Geometry volume/feature acceptance failed; inspect bounds and refine or revise explicitly.');
  }
}

export interface CurvedExcavationStage {
  readonly id: string;
  /** Physical removal region, not a rendered bore/mesh or a permeability pathway. */
  readonly geometry: GeometrySpec;
  readonly minimumFeatureM?: number;
}
export interface VoxelizedExcavationStage {
  readonly id: string;
  readonly voidFraction: Float64Array;
  readonly solidFraction: Float64Array;
  readonly lowerVoidFraction: Float64Array;
  readonly upperVoidFraction: Float64Array;
  readonly possibleVoidMask: Uint8Array;
  readonly confirmedSolidMask: Uint8Array;
  readonly removedVolumeEstimateM3: number;
  readonly lowerRemovedVolumeM3: number;
  readonly upperRemovedVolumeM3: number;
  readonly incrementalRemovedVolumeEstimateM3: number;
}
export interface VoxelizedExcavationSequence {
  readonly voxelization: GeometryVoxelization;
  readonly stages: readonly VoxelizedExcavationStage[];
}

/**
 * Curved/Boolean staging uses ONE shared tree. Earliest cut wins material ownership,
 * so cumulative estimated removal cannot decrease from independent re-sampling.
 * ReferenceVolumes in options refer to exclusive first-cut ownership by stage ID.
 * For exact orthogonal staging prefer excavateBoxes. No displaced mass is invented.
 */
export function voxelizeExcavationStages(
  grid: GeometryGrid, stages: readonly CurvedExcavationStage[], options: VoxelizationOptions,
): VoxelizedExcavationSequence {
  assertGeometryGrid(grid);
  if (!Array.isArray(stages) || stages.length > 32 ||
      (stages.length + 1) * grid.cellCount > VOXELIZATION_LIMITS.maxStagedCellEntries) {
    throw new GeometryError('budget', 'Invalid or oversized curved-excavation stage array.');
  }
  const specs: GeometryRegionSpec[] = (stages as readonly CurvedExcavationStage[]).map((s, i) => {
    if (!s || typeof s !== 'object') throw new GeometryError('invalid-input', 'Explicit curved stage required.');
    return {
      id: s.id, role: 'void', priority: stages.length - i, geometry: s.geometry,
      ...(s.minimumFeatureM === undefined ? {} : { minimumFeatureM: s.minimumFeatureM }),
    };
  });
  const partition = createGeometryPartition(grid, specs, { id: 'uncutSolid', role: 'soil' });
  const voxelization = voxelizeGeometry(partition, options), results: VoxelizedExcavationStage[] = [];
  const n = voxelization.grid.cellCount;
  let previousEstimate = new Float64Array(n), previousLower = new Float64Array(n), previousUpper = new Float64Array(n);
  for (const stage of stages as readonly CurvedExcavationStage[]) {
    const own = voxelization.materials.find(m => m.material.id === stage.id)!;
    const voidFraction = new Float64Array(n), solidFraction = new Float64Array(n);
    const lowerVoidFraction = new Float64Array(n), upperVoidFraction = new Float64Array(n);
    const possibleVoidMask = new Uint8Array(n), confirmedSolidMask = new Uint8Array(n);
    for (let q = 0; q < n; q++) {
      voidFraction[q] = Math.min(1, previousEstimate[q] + own.fraction[q]);
      solidFraction[q] = 1 - voidFraction[q];
      lowerVoidFraction[q] = Math.min(1, previousLower[q] + own.lowerFraction[q]);
      upperVoidFraction[q] = Math.min(1, previousUpper[q] + own.upperFraction[q]);
      possibleVoidMask[q] = upperVoidFraction[q] > 0 ? 1 : 0;
      confirmedSolidMask[q] = upperVoidFraction[q] < 1 ? 1 : 0;
    }
    const integrate = (values: Float64Array) => compensatedSum(values.map((f, q) => f * voxelization.cellVolumesM3[q]));
    results.push({
      id: stage.id, voidFraction, solidFraction, lowerVoidFraction, upperVoidFraction,
      possibleVoidMask, confirmedSolidMask,
      removedVolumeEstimateM3: integrate(voidFraction),
      lowerRemovedVolumeM3: integrate(lowerVoidFraction), upperRemovedVolumeM3: integrate(upperVoidFraction),
      incrementalRemovedVolumeEstimateM3: own.estimatedVolumeM3,
    });
    // Snapshots above own their arrays. Private next-stage accumulators are copies.
    previousEstimate = voidFraction.slice(); previousLower = lowerVoidFraction.slice(); previousUpper = upperVoidFraction.slice();
  }
  return { voxelization, stages: results };
}
