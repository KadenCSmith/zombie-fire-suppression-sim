import { describe, expect, it } from 'vitest';
import { createGeometryGrid, GeometryError, type GeometrySpec } from '../../../src/physics-next/geometry/types';
import { createBorehole } from '../../../src/physics-next/geometry/borehole';
import { createGeometryPartition } from '../../../src/physics-next/geometry/interfaces';
import {
  voxelizeGeometry, voxelizeExcavationStages, requireAcceptedVoxelization,
} from '../../../src/physics-next/geometry/voxelize';

const grid = (n = 2) => createGeometryGrid({ nx: n, ny: n, nz: n, originM: [0, 0, 0], sizeM: [1, 1, 1] });
const sphere = (r: number, center: readonly [number, number, number] = [0.5, 0.5, 0.5]): GeometrySpec => ({
  kind: 'transform', child: { kind: 'sphere', radiusM: r },
  transform: { translationM: center, quaternionXYZW: [0, 0, 0, 1] },
});
const partition = (geometry: GeometrySpec, n = 2) => createGeometryPartition(grid(n), [
  { id: 'void', role: 'void', priority: 1, geometry },
], { id: 'soil', role: 'soil' });
const options = { maxDepth: 3, maxBlocks: 200000, volumeToleranceM3: 0.1 };
describe('bounded conservative material voxelization', () => {
  it('represents empty geometry as all background with zero unresolved volume', () => {
    const r = voxelizeGeometry(partition({ kind: 'empty' }), { ...options, volumeToleranceM3: 0 });
    expect(r.materials[0].estimatedVolumeM3).toBe(0);
    expect(r.materials[0].upperVolumeM3).toBe(0);
    expect(r.materials[1].estimatedVolumeM3).toBe(1);
    expect(r.unresolvedVolumeM3).toBe(0);
    expect(r.accepted).toBe(true);
    requireAcceptedVoxelization(r);
  });
  it('keeps fractions bounded, partitions every cell and brackets analytic sphere volume', () => {
    const analytic = 4 * Math.PI * 0.2 ** 3 / 3;
    const r = voxelizeGeometry(partition(sphere(0.2)), {
      ...options, referenceVolumes: [{ materialId: 'void', volumeM3: analytic, toleranceM3: 0.1 }],
    });
    for (let q = 0; q < r.grid.cellCount; q++) {
      let total = 0;
      for (const m of r.materials) {
        expect(m.lowerFraction[q]).toBeGreaterThanOrEqual(0);
        expect(m.upperFraction[q]).toBeLessThanOrEqual(1);
        expect(m.fraction[q]).toBeGreaterThanOrEqual(m.lowerFraction[q]);
        expect(m.fraction[q]).toBeLessThanOrEqual(m.upperFraction[q]);
        total += m.fraction[q];
      }
      expect(total).toBeCloseTo(1, 14);
    }
    expect(r.materials[0].lowerVolumeM3).toBeLessThanOrEqual(analytic);
    expect(r.materials[0].upperVolumeM3).toBeGreaterThanOrEqual(analytic);
    expect(r.volumeChecks[0].intervalContainsDeclared).toBe(true);
    expect(Math.abs(r.integratedPartitionResidualM3)).toBeLessThanOrEqual(1e-13);
  });
  it('reduces volume uncertainty with additional unsaturated refinement', () => {
    const p = partition(sphere(0.2));
    const a = voxelizeGeometry(p, { ...options, maxDepth: 1 });
    const b = voxelizeGeometry(p, { ...options, maxDepth: 4 });
    expect(b.unresolvedVolumeM3).toBeLessThanOrEqual(a.unresolvedVolumeM3);
    expect(b.materials[0].lowerVolumeM3).toBeGreaterThanOrEqual(a.materials[0].lowerVolumeM3 - 1e-10);
    expect(b.materials[0].upperVolumeM3).toBeLessThanOrEqual(a.materials[0].upperVolumeM3 + 1e-10);
    expect(b.budgetLimitedLeafCount).toBe(0);
    expect(b.visitedBlocks).toBeGreaterThan(a.visitedBlocks);
  });
  it('reports an unsampled sub-cell void instead of declaring it absent', () => {
    const p = createGeometryPartition(grid(1), [{
      id: 'tiny', role: 'void', priority: 1, geometry: sphere(0.01, [0.11, 0.12, 0.13]), minimumFeatureM: 0.02,
    }], { id: 'soil', role: 'soil' });
    const r = voxelizeGeometry(p, { ...options, maxDepth: 0, volumeToleranceM3: 2 });
    expect(r.materials[0].estimatedVolumeM3).toBe(0);
    expect(r.materials[0].upperVolumeM3).toBeGreaterThan(0);
    expect(r.materials[0].evidenceMask[0]).toBe(2);
    expect(r.features[0].reasons.includes('possible-occupancy-not-sampled')).toBe(true);
    expect(r.accepted).toBe(false);
  });
  it('preserves exclusive priority ownership for overlapping material geometry', () => {
    const p = createGeometryPartition(grid(), [
      { id: 'root', role: 'root', priority: 1,
        geometry: { kind: 'half-space', pointM: [0.25, 0, 0], outwardNormal: [-1, 0, 0] } },
      { id: 'cap', role: 'cap', priority: 2,
        geometry: { kind: 'half-space', pointM: [0.5, 0, 0], outwardNormal: [-1, 0, 0] } },
    ], { id: 'soil', role: 'soil' });
    const r = voxelizeGeometry(p, options);
    expect(r.materials.map(m => m.material.id)).toEqual(['cap', 'root', 'soil']);
    expect(r.materials.map(m => m.estimatedVolumeM3)).toEqual([0.5, 0.25, 0.25]);
    expect(r.materials.reduce((s, m) => s + m.estimatedVolumeM3, 0)).toBe(1);
  });
  it('retains uncertainty when the refinement budget is exhausted', () => {
    const r = voxelizeGeometry(partition(sphere(0.2), 1), { maxDepth: 8, maxBlocks: 1, volumeToleranceM3: 0 });
    expect(r.visitedBlocks).toBe(1);
    expect(r.budgetLimitedLeafCount).toBe(1);
    expect(r.unresolvedVolumeM3).toBe(1);
    expect(r.accepted).toBe(false);
    expect(() => requireAcceptedVoxelization(r)).toThrow(GeometryError);
  });
  it('does not renormalize to an inconsistent declared volume', () => {
    const p = partition({ kind: 'empty' });
    const r = voxelizeGeometry(p, {
      ...options, referenceVolumes: [{ materialId: 'void', volumeM3: 0.5, toleranceM3: 0.01 }],
    });
    expect(r.materials[0].estimatedVolumeM3).toBe(0);
    expect(r.volumeChecks[0].withinTolerance).toBe(false);
    expect(r.accepted).toBe(false);
  });
  it('is deterministic and returns independent arrays and metadata', () => {
    const p = partition(sphere(0.2)), a = voxelizeGeometry(p, options), b = voxelizeGeometry(p, options);
    expect(a.materials[0].fraction).toEqual(b.materials[0].fraction);
    expect(a.unresolvedFraction).toEqual(b.unresolvedFraction);
    a.materials[0].fraction.fill(0);
    a.unresolvedFraction.fill(0);
    expect(b.materials[0].estimatedVolumeM3).toBeGreaterThan(0);
    expect(b.materials[0].fraction.some(v => v > 0)).toBe(true);
    expect(a.grid.originM).not.toBe(b.grid.originM);
    expect(a.materials[0].fraction).not.toBe(a.materials[0].lowerFraction);
  });
  it('accounts for clipped half-sphere volume at the domain boundary', () => {
    const analytic = 2 * Math.PI * 0.2 ** 3 / 3;
    const r = voxelizeGeometry(partition(sphere(0.2, [0, 0.5, 0.5])), options);
    expect(r.materials[0].lowerVolumeM3).toBeLessThanOrEqual(analytic);
    expect(r.materials[0].upperVolumeM3).toBeGreaterThanOrEqual(analytic);
    expect(r.materials.reduce((sum, m) => sum + m.estimatedVolumeM3, 0)).toBeCloseTo(1, 14);
  });
  it('reports bore-volume bounds against the exact connected shaft/chamber volume', () => {
    const bore = createBorehole({
      axis: 'vertical', centerXYM: [0.5, 0.5], surfaceZM: 0,
      radiusM: 0.12, depthM: 0.75, topCondition: 'open', underream: { radiusM: 0.2, heightM: 0.2 },
    });
    const r = voxelizeGeometry(partition(bore.cutterSpec()), {
      ...options, maxDepth: 4,
      referenceVolumes: [{ materialId: 'void', volumeM3: bore.nominalVolumeM3, toleranceM3: 0.1 }],
    });
    expect(r.volumeChecks[0].intervalContainsDeclared).toBe(true);
    expect(r.topologyValidated).toBe(false);
    expect(r.materials[0].lowerVolumeM3).toBeLessThanOrEqual(bore.nominalVolumeM3);
    expect(r.materials[0].upperVolumeM3).toBeGreaterThanOrEqual(bore.nominalVolumeM3);
  });
  it('uses one shared partition to keep curved staged removal monotonic', () => {
    const s = [
      { id: 'small', geometry: sphere(0.15) },
      { id: 'larger', geometry: sphere(0.25) },
      { id: 'repeat', geometry: sphere(0.15) },
    ];
    const r = voxelizeExcavationStages(grid(), s, options);
    expect(r.stages).toHaveLength(3);
    expect(r.stages[2].incrementalRemovedVolumeEstimateM3).toBe(0);
    for (let k = 1; k < r.stages.length; k++) for (let q = 0; q < 8; q++) {
      expect(r.stages[k].voidFraction[q]).toBeGreaterThanOrEqual(r.stages[k - 1].voidFraction[q]);
      expect(r.stages[k].solidFraction[q] + r.stages[k].voidFraction[q]).toBe(1);
    }
    expect(r.stages[1].lowerRemovedVolumeM3).toBeLessThanOrEqual(4 * Math.PI * 0.25 ** 3 / 3);
    expect(r.stages[1].upperRemovedVolumeM3).toBeGreaterThanOrEqual(4 * Math.PI * 0.25 ** 3 / 3);
    r.stages[0].voidFraction.fill(0);
    expect(r.stages[1].removedVolumeEstimateM3).toBeGreaterThan(0);
  });
  it('rejects invalid options, undersized budgets and unknown declared materials', () => {
    const p = partition({ kind: 'empty' });
    expect(() => voxelizeGeometry(p, { ...options, maxDepth: -1 })).toThrow(GeometryError);
    expect(() => voxelizeGeometry(p, { ...options, maxBlocks: 1 })).toThrow(GeometryError);
    expect(() => voxelizeGeometry(p, { ...options, volumeToleranceM3: NaN })).toThrow(GeometryError);
    expect(() => voxelizeGeometry(p, { ...options, referenceVolumes: [{ materialId: 'missing', volumeM3: 0, toleranceM3: 0 }] })).toThrow(GeometryError);
  });

  it('reports precision-limited refinement at large coordinates instead of manufacturing tiny cells', () => {
    const origin = 1e6 - 1e-6;
    const g = createGeometryGrid({ nx: 1, ny: 1, nz: 1, originM: [origin, origin, origin], sizeM: [2e-8, 2e-8, 2e-8] });
    const p = createGeometryPartition(g, [{
      id: 'void', role: 'void', priority: 1,
      geometry: { kind: 'half-space', pointM: [origin + 1e-8, origin, origin], outwardNormal: [1, 0, 0] },
    }], { id: 'soil', role: 'soil' });
    const r = voxelizeGeometry(p, { maxDepth: 4, maxBlocks: 1000, volumeToleranceM3: 0 });
    expect(r.precisionLimitedLeafCount).toBe(1);
    expect(r.accepted).toBe(false);
    expect(r.cellVolumesM3.every(Number.isFinite)).toBe(true);
    expect(r.materials.every(m => m.fraction.every(Number.isFinite))).toBe(true);
  });
  it('supports an empty curved stage sequence without allocating fictitious removed material', () => {
    const r = voxelizeExcavationStages(grid(), [], { ...options, volumeToleranceM3: 0 });
    expect(r.stages).toHaveLength(0);
    expect(r.voxelization.materials).toHaveLength(1);
    expect(r.voxelization.materials[0].estimatedVolumeM3).toBe(1);
    expect(r.voxelization.accepted).toBe(true);
  });
});
