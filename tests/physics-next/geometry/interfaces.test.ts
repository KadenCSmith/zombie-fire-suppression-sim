import { describe, expect, it } from 'vitest';
import { createGeometryGrid, GeometryError, type GeometrySpec } from '../../../src/physics-next/geometry/types';
import {
  createGeometryPartition, sampleGeometryInterfaces, orientGeometryInterfaces,
  type GeometryRegionSpec, type InterfacePatch,
} from '../../../src/physics-next/geometry/interfaces';

const grid = () => createGeometryGrid({ nx: 8, ny: 8, nz: 8, originM: [0, 0, 0], sizeM: [1, 1, 1] });
const opts = { probeOffsetM: 1e-5, classificationBandM: 1e-9, declaredMinimumSeparationM: 1e-3 };
const translated = (geometry: GeometrySpec, p: readonly [number, number, number]): GeometrySpec => ({
  kind: 'transform', transform: { translationM: p, quaternionXYZW: [0, 0, 0, 1] }, child: geometry,
});
const rightVoid: GeometryRegionSpec = {
  id: 'void', role: 'void', priority: 1,
  geometry: { kind: 'half-space', pointM: [0.5, 0, 0], outwardNormal: [-1, 0, 0] },
};
const plane: InterfacePatch = {
  id: 'split', kind: 'rectangle', originM: [0.5, 0, 0], edgeUM: [0, 1, 0], edgeVM: [0, 0, 1],
  segmentsU: 4, segmentsV: 4,
};
describe('material partition and geometry-only interface samples', () => {
  it('uses explicit priority independent of input order and rejects collisions', () => {
    const high: GeometryRegionSpec = { ...rightVoid, id: 'cap', role: 'cap', priority: 2 };
    const a = createGeometryPartition(grid(), [rightVoid, high], { id: 'soil', role: 'soil' });
    const b = createGeometryPartition(grid(), [high, rightVoid], { id: 'soil', role: 'soil' });
    expect(a.materialAt([0.7, 0.5, 0.5])).toEqual({ id: 'cap', role: 'cap' });
    expect(a.materialAt([0.7, 0.5, 0.5])).toEqual(b.materialAt([0.7, 0.5, 0.5]));
    expect(() => createGeometryPartition(grid(), [rightVoid, { ...high, priority: 1 }], { id: 'soil', role: 'soil' })).toThrow(GeometryError);
    expect(() => createGeometryPartition(grid(), [rightVoid], { id: 'void', role: 'soil' })).toThrow(GeometryError);
  });
  it('gives exact full rectangular area and normals from soil to void', () => {
    const partition = createGeometryPartition(grid(), [rightVoid], { id: 'soil', role: 'soil' });
    const r = sampleGeometryInterfaces(partition, [plane], opts);
    expect(r.samples).toHaveLength(16);
    expect(r.acceptedAreaM2).toBe(1);
    expect(r.samples[0].materialA.id).toBe('soil');
    expect(r.samples[0].materialB.id).toBe('void');
    expect(r.samples[0].normalFromAToB).toEqual([1, 0, 0]);
    expect(r.ambiguousCandidateAreaM2).toBe(0);
  });
  it('returns opposing orientations without aliasing or doubling the unique area', () => {
    const partition = createGeometryPartition(grid(), [rightVoid], { id: 'soil', role: 'soil' });
    const r = sampleGeometryInterfaces(partition, [plane], opts), oriented = orientGeometryInterfaces(r);
    expect(oriented).toHaveLength(32);
    for (let j = 0; j < oriented.length; j += 2) {
      expect(oriented[j].from).toEqual(oriented[j + 1].to);
      expect(oriented[j].areaM2).toBe(oriented[j + 1].areaM2);
      expect(oriented[j].outwardNormal.map((v, a) => v + oriented[j + 1].outwardNormal[a])).toEqual([0, 0, 0]);
    }
    (oriented[0].pointM as unknown as number[])[0] = 9;
    expect(r.samples[0].pointM[0]).toBe(0.5);
    expect(oriented[1].pointM[0]).toBe(0.5);
  });
  it('removes identical patches and orders output reproducibly', () => {
    const partition = createGeometryPartition(grid(), [rightVoid], { id: 'soil', role: 'soil' });
    const duplicate = { ...plane, id: 'zzz' };
    const a = sampleGeometryInterfaces(partition, [duplicate, plane], opts);
    const b = sampleGeometryInterfaces(partition, [plane, duplicate], opts);
    expect(a.duplicatePatchCount).toBe(1);
    expect(a.samples).toHaveLength(16);
    expect(a.samples).toEqual(b.samples);
    expect(a.acceptedAreaM2).toBe(1);
  });
  it('identifies the top soil/exterior boundary and correct soil outward normal', () => {
    const partition = createGeometryPartition(grid(), [], { id: 'soil', role: 'soil' });
    const top: InterfacePatch = {
      id: 'top', kind: 'rectangle', originM: [0, 0, 0], edgeUM: [1, 0, 0], edgeVM: [0, 1, 0],
      segmentsU: 2, segmentsV: 2,
    };
    const r = sampleGeometryInterfaces(partition, [top], opts), oriented = orientGeometryInterfaces(r);
    const soil = oriented.find(s => s.from.id === 'soil');
    expect(soil?.outwardNormal).toEqual([-0, -0, -1]);
    expect(soil?.to.role).toBe('exterior');
    expect(soil?.toCell).toBe(null);
    expect(r.acceptedAreaM2).toBe(1);
  });
  it('removes internal ghost surfaces with identical material on both sides', () => {
    const partition = createGeometryPartition(grid(), [{
      id: 'ghost', role: 'root', priority: 1,
      geometry: { kind: 'difference', base: { kind: 'sphere', radiusM: 0.2 }, subtract: { kind: 'sphere', radiusM: 0.2 } },
    }], { id: 'soil', role: 'soil' });
    const r = sampleGeometryInterfaces(partition, [plane], opts);
    expect(r.samples).toHaveLength(0);
    expect(r.hiddenCandidateAreaM2).toBe(1);
  });
  it('samples a spherical root surface with unit radial normals and analytic full area', () => {
    const partition = createGeometryPartition(grid(), [{
      id: 'root', role: 'root', priority: 1, geometry: translated({ kind: 'sphere', radiusM: 0.2 }, [0.5, 0.5, 0.5]),
    }], { id: 'soil', role: 'soil' });
    const sphere: InterfacePatch = {
      id: 'rootSurface', kind: 'sphere-patch', centerM: [0.5, 0.5, 0.5], polarAxis: [0, 0, 1],
      radiusM: 0.2, cosPolarRange: [-1, 1], polarSegments: 8, angularSegments: 16,
    };
    const r = sampleGeometryInterfaces(partition, [sphere], opts);
    expect(r.samples).toHaveLength(128);
    expect(r.acceptedAreaM2).toBeCloseTo(4 * Math.PI * 0.2 ** 2, 12);
    for (const s of r.samples) {
      expect(Math.hypot(...s.normalFromAToB)).toBeCloseTo(1, 13);
      expect(s.normalFromAToB.reduce((v, n, a) => v + n * (s.pointM[a] - 0.5), 0)).toBeCloseTo(0.2, 13);
    }
  });
  it('identifies a finite cap face without claiming a cap constitutive/contact law', () => {
    const partition = createGeometryPartition(grid(), [{
      id: 'cap', role: 'cap', priority: 1,
      geometry: translated({ kind: 'box', halfExtentsM: [0.25, 0.25, 0.05] }, [0.5, 0.5, 0.25]),
    }], { id: 'soil', role: 'soil' });
    const cap: InterfacePatch = {
      id: 'capTop', kind: 'rectangle', originM: [0.25, 0.25, 0.2], edgeUM: [0.5, 0, 0], edgeVM: [0, 0.5, 0],
      segmentsU: 4, segmentsV: 4,
    };
    const r = sampleGeometryInterfaces(partition, [cap], opts);
    expect(r.acceptedAreaM2).toBe(0.25);
    expect(r.samples[0].materialA.role).toBe('cap');
    expect(r.samples[0].normalFromAToB).toEqual([-0, -0, -1]);
  });
  it('identifies annular hose and inner void boundaries with analytic candidate areas', () => {
    const cylinder = (r: number) => translated({ kind: 'capped-cylinder', radiusM: r, halfLengthM: 0.25 }, [0.5, 0.5, 0.5]);
    const partition = createGeometryPartition(grid(), [
      { id: 'hose', role: 'hose', priority: 2, geometry: { kind: 'difference', base: cylinder(0.2), subtract: cylinder(0.1) } },
      { id: 'void', role: 'void', priority: 1, geometry: cylinder(0.1) },
    ], { id: 'soil', role: 'soil' });
    const side: InterfacePatch = {
      id: 'inner', kind: 'cylinder-side', aM: [0.5, 0.5, 0.25], bM: [0.5, 0.5, 0.75],
      radiusM: 0.1, axialSegments: 4, angularSegments: 16,
    };
    const end: InterfacePatch = {
      id: 'hoseEnd', kind: 'annulus', centerM: [0.5, 0.5, 0.25], normal: [0, 0, -1],
      innerRadiusM: 0.1, outerRadiusM: 0.2, radialSegments: 4, angularSegments: 16,
    };
    const a = sampleGeometryInterfaces(partition, [side], opts);
    const b = sampleGeometryInterfaces(partition, [end], opts);
    expect(a.acceptedAreaM2).toBeCloseTo(2 * Math.PI * 0.1 * 0.5, 12);
    expect(a.samples[0].materialA.role).toBe('hose');
    expect(a.samples[0].materialB.role).toBe('void');
    expect(b.acceptedAreaM2).toBeCloseTo(Math.PI * (0.2 ** 2 - 0.1 ** 2), 12);
  });
  it('reports area unresolved when the two probe scales disagree', () => {
    const near = { ...rightVoid, geometry: {
      kind: 'half-space' as const, pointM: [0.5 + opts.probeOffsetM * 0.75, 0, 0] as const, outwardNormal: [-1, 0, 0] as const,
    } };
    const partition = createGeometryPartition(grid(), [near], { id: 'soil', role: 'soil' });
    const r = sampleGeometryInterfaces(partition, [plane], opts);
    expect(r.samples).toHaveLength(0);
    expect(r.ambiguousCandidateAreaM2).toBe(1);
  });
  it('rejects degenerate patches, conflicting IDs and unsafe probe separation', () => {
    const partition = createGeometryPartition(grid(), [rightVoid], { id: 'soil', role: 'soil' });
    expect(() => sampleGeometryInterfaces(partition, [{ ...plane, edgeVM: [0, 2, 0] }], opts)).toThrow(GeometryError);
    expect(() => sampleGeometryInterfaces(partition, [plane, { ...plane, segmentsU: 2 }], opts)).toThrow(GeometryError);
    expect(() => sampleGeometryInterfaces(partition, [plane], { ...opts, declaredMinimumSeparationM: 1e-6 })).toThrow(GeometryError);
    expect(() => sampleGeometryInterfaces(partition, [plane], { ...opts, classificationBandM: opts.probeOffsetM })).toThrow(GeometryError);
  });

  it('normalizes subnormal supplied normals without returning nonfinite arrays', () => {
    const p = createGeometryPartition(grid(), [rightVoid], { id: 'soil', role: 'soil' });
    const report = sampleGeometryInterfaces(p, [plane], opts);
    const unusual = { ...report.samples[0], normalFromAToB: [1e-320, 0, 0] as const };
    const oriented = orientGeometryInterfaces({ ...report, samples: [unusual] });
    expect(oriented[0].outwardNormal).toEqual([1, 0, 0]);
    expect(oriented[1].outwardNormal).toEqual([-1, -0, -0]);
    expect(() => orientGeometryInterfaces({ ...report, samples: [{ ...unusual, cellA: NaN }] })).toThrow(GeometryError);
    expect(() => orientGeometryInterfaces({ ...report, samples: [{ ...unusual, cellA: report.grid.cellCount }] })).toThrow(GeometryError);
  });
});
