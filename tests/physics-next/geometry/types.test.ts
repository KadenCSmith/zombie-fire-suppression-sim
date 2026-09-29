import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GEOMETRY_TOLERANCE, GEOMETRY_LIMITS, GeometryError,
  createGeometryGrid, assertGeometryGrid, cellIndex, nodeIndex,
  cellCoordinates, nodeCoordinates, cellBoundsM, cellCenterM,
  nodePositionM, resolveToleranceM, positiveInteger,
} from '../../../src/physics-next/geometry/types';
import type { GeometryGrid, GridSpec, Vec3 } from '../../../src/physics-next/geometry/types';

const spec = (): GridSpec => ({ nx: 2, ny: 3, nz: 4, originM: [-1, 2, -3], sizeM: [4, 6, 12] });

describe('explicit physical geometry grid', () => {
  it('retains SI origin, anisotropic spacing, counts, volume and down-positive z', () => {
    const grid = createGeometryGrid(spec());
    expect([grid.dxM, grid.dyM, grid.dzM]).toEqual([2, 2, 3]);
    expect(grid.cellCount).toBe(24);
    expect(grid.nodeCount).toBe(60);
    expect(grid.cellVolumeM3).toBe(12);
    expect(cellCenterM(grid, 23)).toEqual([2, 7, 7.5]);
    expect(nodePositionM(grid, 59)).toEqual([3, 8, 9]);
    expect(nodePositionM(grid, 0)).toEqual([-1, 2, -3]);
  });

  it('round-trips every cell and node using x-fastest ordering', () => {
    const grid = createGeometryGrid(spec());
    expect(cellIndex(grid, 1, 2, 3)).toBe(23);
    expect(nodeIndex(grid, 2, 3, 4)).toBe(59);
    for (let q = 0; q < grid.cellCount; q++) {
      const [x, y, z] = cellCoordinates(grid, q);
      expect(cellIndex(grid, x, y, z)).toBe(q);
    }
    for (let n = 0; n < grid.nodeCount; n++) {
      const [x, y, z] = nodeCoordinates(grid, n);
      expect(nodeIndex(grid, x, y, z)).toBe(n);
    }
  });

  it('uses identical shared edges and exact domain end coordinates', () => {
    const grid = createGeometryGrid({ nx: 7, ny: 3, nz: 2, originM: [0.3, -0.2, 0.1], sizeM: [2, 1, 0.7] });
    for (let x = 0; x < 6; x++) {
      const a = cellBoundsM(grid, cellIndex(grid, x, 1, 1));
      const b = cellBoundsM(grid, cellIndex(grid, x + 1, 1, 1));
      expect(a.maxM[0]).toBe(b.minM[0]);
    }
    expect(nodePositionM(grid, grid.nodeCount - 1)).toEqual([0.3 + 2, -0.2 + 1, 0.1 + 0.7]);
  });

  it('owns and freezes metadata without freezing or retaining caller vectors', () => {
    const origin: [number, number, number] = [-1, 2, -3];
    const size: [number, number, number] = [4, 6, 12];
    const grid = createGeometryGrid({ ...spec(), originM: origin, sizeM: size });
    const other = createGeometryGrid(grid);
    origin[0] = 999; size[0] = 999;
    expect(grid.originM).toEqual([-1, 2, -3]);
    expect(grid.sizeM).toEqual([4, 6, 12]);
    expect(grid.originM).not.toBe(other.originM);
    expect(grid.sizeM).not.toBe(other.sizeM);
    expect(Object.isFrozen(grid)).toBe(true);
    expect(Object.isFrozen(grid.originM)).toBe(true);
    expect(Object.isFrozen(origin)).toBe(false);
  });

  it('returns fresh coordinates and bounds for every query', () => {
    const grid = createGeometryGrid(spec());
    const center = cellCenterM(grid, 0) as [number, number, number];
    const nodes = nodePositionM(grid, 0) as [number, number, number];
    const coordinates = cellCoordinates(grid, 0) as [number, number, number];
    const bounds = cellBoundsM(grid, 0);
    center[0] = 100; nodes[0] = 100; coordinates[0] = 100;
    (bounds.minM as [number, number, number])[0] = 100;
    expect(cellCenterM(grid, 0)).toEqual([0, 3, -1.5]);
    expect(nodePositionM(grid, 0)).toEqual([-1, 2, -3]);
    expect(cellCoordinates(grid, 0)).toEqual([0, 0, 0]);
    expect(cellBoundsM(grid, 0).minM).toEqual([-1, 2, -3]);
  });

  it('rejects invalid counts and excessive allocation before allocating arrays', () => {
    for (const nx of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, GEOMETRY_LIMITS.maxAxisCells + 1]) {
      expect(() => createGeometryGrid({ ...spec(), nx })).toThrow(GeometryError);
    }
    expect(() => createGeometryGrid({ ...spec(), nx: 512, ny: 512, nz: 512 })).toThrow(GeometryError);
  });

  it('validates the public integer helper upper bound as well as its value', () => {
    expect(positiveInteger(3, 3, 'count')).toBe(3);
    for (const maximum of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => positiveInteger(1, maximum, 'count')).toThrow(GeometryError);
    }
  });

  it('rejects non-finite, zero, negative, undersized and oversized physical extents', () => {
    for (const length of [NaN, Infinity, 0, -1, GEOMETRY_LIMITS.minLengthM / 2, GEOMETRY_LIMITS.maxLengthM + 1]) {
      expect(() => createGeometryGrid({ ...spec(), sizeM: [length, 6, 12] })).toThrow(GeometryError);
    }
    for (const coordinate of [NaN, Infinity, GEOMETRY_LIMITS.maxCoordinateM + 1]) {
      expect(() => createGeometryGrid({ ...spec(), originM: [coordinate, 0, 0] })).toThrow(GeometryError);
    }
    expect(() => createGeometryGrid({ ...spec(), sizeM: [1, 2] as unknown as Vec3 })).toThrow(GeometryError);
    expect(() => createGeometryGrid({ ...spec(), originM: [999999, 0, 0] })).toThrow(GeometryError);
    expect(() => createGeometryGrid(null as unknown as GridSpec)).toThrow(GeometryError);
  });

  it('fails visibly when translated coordinates cannot resolve the spacing safely', () => {
    expect(() => createGeometryGrid({
      nx: 2, ny: 1, nz: 1, originM: [999999, 0, 0], sizeM: [1e-8, 1, 1],
    })).toThrow(GeometryError);
    const tiny = createGeometryGrid({ nx: 1, ny: 1, nz: 1, originM: [0, 0, 0], sizeM: [1e-8, 1e-8, 1e-8] });
    expect(tiny.cellVolumeM3).toBeGreaterThan(0);
    expect(Number.isFinite(tiny.cellVolumeM3)).toBe(true);
  });

  it('accepts outer nodes but rejects out-of-range, fractional and non-finite indices', () => {
    const grid = createGeometryGrid(spec());
    expect(nodeIndex(grid, grid.nx, grid.ny, grid.nz)).toBe(grid.nodeCount - 1);
    for (const bad of [-1, 0.5, NaN, Infinity]) {
      expect(() => cellIndex(grid, bad, 0, 0)).toThrow(GeometryError);
      expect(() => nodeIndex(grid, 0, bad, 0)).toThrow(GeometryError);
      expect(() => cellCoordinates(grid, bad)).toThrow(GeometryError);
      expect(() => nodePositionM(grid, bad)).toThrow(GeometryError);
    }
    expect(() => cellIndex(grid, grid.nx, 0, 0)).toThrow(GeometryError);
    expect(() => nodeIndex(grid, grid.nx + 1, 0, 0)).toThrow(GeometryError);
    expect(() => cellBoundsM(grid, grid.cellCount)).toThrow(GeometryError);
    expect(() => nodeCoordinates(grid, grid.nodeCount)).toThrow(GeometryError);
  });

  it('rejects forged/serialized derived metadata until reconstructed', () => {
    const grid = createGeometryGrid(spec());
    const raw = JSON.parse(JSON.stringify(grid)) as GeometryGrid;
    expect(() => assertGeometryGrid(raw)).toThrow(GeometryError);
    expect(() => cellIndex({ ...grid, cellCount: 99 }, 0, 0, 0)).toThrow(GeometryError);
    const restored = createGeometryGrid(raw);
    expect(cellCenterM(restored, 23)).toEqual(cellCenterM(grid, 23));
  });
});

describe('classification tolerance policy', () => {
  it('separates absolute, relative and coordinate-roundoff contributions', () => {
    expect(resolveToleranceM(DEFAULT_GEOMETRY_TOLERANCE, 10, 10)).toBe(1e-10);
    expect(resolveToleranceM({ absoluteM: 0, relative: 1e-4 }, 10, 10)).toBe(0.001);
    expect(resolveToleranceM({ absoluteM: 0, relative: 0 }, 1, 1e6)).toBe(64 * Number.EPSILON * 1e6);
  });

  it('rejects invalid tolerance inputs rather than silently repairing them', () => {
    for (const absoluteM of [-1, NaN, Infinity]) {
      expect(() => resolveToleranceM({ absoluteM, relative: 0 }, 1, 1)).toThrow(GeometryError);
    }
    for (const relative of [-1, 2, NaN, Infinity]) {
      expect(() => resolveToleranceM({ absoluteM: 0, relative }, 1, 1)).toThrow(GeometryError);
    }
    expect(() => resolveToleranceM(DEFAULT_GEOMETRY_TOLERANCE, 0, 1)).toThrow(GeometryError);
    expect(() => resolveToleranceM(DEFAULT_GEOMETRY_TOLERANCE, 1, -1)).toThrow(GeometryError);
    expect(() => resolveToleranceM(DEFAULT_GEOMETRY_TOLERANCE, 1, Infinity)).toThrow(GeometryError);
  });
});
