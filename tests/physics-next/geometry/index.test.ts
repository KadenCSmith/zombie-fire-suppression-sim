import { describe, expect, it } from 'vitest';
import * as geometry from '../../../src/physics-next/geometry/index';

describe('geometry public API and integration smoke fixtures', () => {
  it('exports all six modules without hiding their status or validation gates', () => {
    for (const fn of [
      geometry.createGeometryGrid, geometry.compileGeometry, geometry.excavateBoxes,
      geometry.compareExcavationRefinement, geometry.createBorehole, geometry.assessBoreholeGrid,
      geometry.createGeometryPartition, geometry.sampleGeometryInterfaces, geometry.orientGeometryInterfaces,
      geometry.voxelizeGeometry, geometry.requireAcceptedVoxelization, geometry.voxelizeExcavationStages,
    ]) expect(typeof fn).toBe('function');
    expect(geometry.VOXELIZATION_LIMITS.maxDepth).toBe(10);
    expect(geometry.INTERFACE_LIMITS.maxRegions).toBe(32);
  });
  it('connects an explicit open bore, material occupancy and exterior portal descriptors', () => {
    const grid = geometry.createGeometryGrid({ nx: 2, ny: 2, nz: 2, originM: [0, 0, 0], sizeM: [1, 1, 1] });
    // Numerical regression fixture ONLY. These dimensions are not a field design.
    const bore = geometry.createBorehole({
      axis: 'vertical', centerXYM: [0.5, 0.5], surfaceZM: 0,
      radiusM: 0.15, depthM: 0.5, topCondition: 'open',
    });
    const assessment = geometry.assessBoreholeGrid(bore, grid, 0.1);
    expect(assessment.compatible).toBe(true);
    const partition = geometry.createGeometryPartition(grid, [{
      id: 'boreVoid', role: 'void', priority: 1, geometry: bore.cutterSpec(), minimumFeatureM: 0.3,
    }], { id: 'soil', role: 'soil' });
    const occupied = geometry.voxelizeGeometry(partition, {
      maxDepth: 4, maxBlocks: 200000, volumeToleranceM3: 0.1,
      referenceVolumes: [{ materialId: 'boreVoid', volumeM3: bore.nominalVolumeM3, toleranceM3: 0.1 }],
    });
    expect(occupied.volumeChecks[0].intervalContainsDeclared).toBe(true);
    expect(occupied.accepted).toBe(true);
    geometry.requireAcceptedVoxelization(occupied);
    expect(occupied.topologyValidated).toBe(false);
    const opening = bore.topOpening();
    const interfaces = geometry.sampleGeometryInterfaces(partition, [{
      id: 'opening', kind: 'annulus', centerM: opening.centerM, normal: opening.outwardNormal,
      innerRadiusM: 0, outerRadiusM: opening.radiusM, radialSegments: 4, angularSegments: 16,
    }], { probeOffsetM: 1e-5, classificationBandM: 1e-9, declaredMinimumSeparationM: 0.01 });
    expect(interfaces.acceptedAreaM2).toBeCloseTo(opening.areaM2, 12);
    expect(interfaces.samples.every(s => s.materialA.role === 'exterior' && s.materialB.role === 'void')).toBe(true);
    expect(interfaces.samples.every(s => s.cellA === null && s.cellB !== null)).toBe(true);
    // Both orientation copies refer to the same area; they do not define a flux.
    const oriented = geometry.orientGeometryInterfaces(interfaces);
    expect(oriented.length).toBe(interfaces.samples.length * 2);
  });
  it('keeps independent signed diagnostics and exact excavation masks distinct', () => {
    const grid = geometry.createGeometryGrid({ nx: 2, ny: 2, nz: 2, originM: [0, 0, 0], sizeM: [1, 1, 1] });
    const result = geometry.excavateBoxes(grid, [{
      id: 'cut', remove: [{ minM: [0.49, 0, 0], maxM: [0.51, 1, 1] }],
    }]);
    const field = geometry.compileGeometry({
      kind: 'transform', transform: { translationM: [0.5, 0.5, 0.5], quaternionXYZW: [0, 0, 0, 1] },
      child: { kind: 'box', halfExtentsM: [0.01, 0.5, 0.5] },
    });
    const centerSamples = geometry.sampleGrid(field, grid);
    expect(centerSamples.valuesM.every(v => v > 0)).toBe(true);
    expect(result.stages[0].removedVolumeM3).toBeCloseTo(0.02, 14);
    expect(result.stages[0].voidMask.every(v => v === 1)).toBe(true);
  });
});
