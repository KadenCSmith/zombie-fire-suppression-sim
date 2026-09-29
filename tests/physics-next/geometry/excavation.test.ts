import { describe, expect, it } from 'vitest';
import { createGeometryGrid, GeometryError } from '../../../src/physics-next/geometry/types';
import {
  boxVolumeM3, subtractExcavationBox, excavateBoxes, compareExcavationRefinement,
  type ExcavationStage,
} from '../../../src/physics-next/geometry/excavation';

const grid = (n = 2) => createGeometryGrid({ nx: n, ny: n, nz: n, originM: [0, 0, 0], sizeM: [1, 1, 1] });
const stages: ExcavationStage[] = [
  { id: 'first', remove: [{ minM: [-1, 0, 0], maxM: [0.5, 1, 1] }] },
  { id: 'second', remove: [{ minM: [0.25, 0, 0], maxM: [0.75, 1, 1] }] },
  { id: 'repeat', remove: [{ minM: [0, 0, 0], maxM: [0.5, 1, 1] }] },
];
describe('exact staged box excavation', () => {
  it('retains all solid for no excavation and explicit zero-volume boxes', () => {
    const result = excavateBoxes(grid(), [{ id: 'zero', remove: [{ minM: [0, 0, 0], maxM: [0, 1, 1] }] }]);
    expect(result.initial.removedVolumeM3).toBe(0);
    expect([...result.initial.solidFraction]).toEqual(Array(8).fill(1));
    expect([...result.initial.voidMask]).toEqual(Array(8).fill(0));
    expect(result.stages[0].removedVolumeM3).toBe(0);
    expect(excavateBoxes(grid(), []).stages).toHaveLength(0);
  });
  it('clips exactly at boundaries and never counts overlaps twice', () => {
    const result = excavateBoxes(grid(), stages);
    expect(result.stages.map(s => s.removedVolumeM3)).toEqual([0.5, 0.75, 0.75]);
    expect(result.stages.map(s => s.incrementalRemovedVolumeM3)).toEqual([0.5, 0.25, 0]);
    expect(result.stages[1].voidFraction[1]).toBe(0.5);
    expect(result.stages[1].solidMask[1]).toBe(1);
    expect(result.stages[1].voidMask[1]).toBe(1);
  });
  it('maintains per-cell monotonicity and the solid/void partition', () => {
    const r = excavateBoxes(grid(3), stages);
    for (let t = 0; t < r.stages.length; t++) {
      const before = t === 0 ? r.initial : r.stages[t - 1];
      const after = r.stages[t];
      for (let q = 0; q < after.grid.cellCount; q++) {
        expect(after.voidFraction[q]).toBeGreaterThanOrEqual(before.voidFraction[q] - 1e-14);
        expect(after.voidFraction[q] + after.solidFraction[q]).toBe(1);
      }
      expect(Math.abs(after.integrationResidualM3)).toBeLessThanOrEqual(after.errorAllowanceM3);
    }
  });
  it('subtracts a central cube into six nonoverlapping-volume slabs', () => {
    const parts = subtractExcavationBox(
      { minM: [0, 0, 0], maxM: [3, 3, 3] }, { minM: [1, 1, 1], maxM: [2, 2, 2] },
    );
    expect(parts).toHaveLength(6);
    expect(parts.reduce((s, b) => s + boxVolumeM3(b), 0)).toBe(26);
  });
  it('reports refinement with the same analytic volume on nonaligned grids', () => {
    const r = compareExcavationRefinement([grid(1), grid(3), grid(7)], stages);
    expect(r.referenceVolumeM3).toBe(0.75);
    expect(r.withinRoundoffAllowance).toBe(true);
    expect(r.maxAbsoluteErrorM3).toBeLessThanOrEqual(1e-12);
    expect(r.levels.map(l => l.cellCount)).toEqual([1, 27, 343]);
  });
  it('allocates independent outputs and copies input box vectors', () => {
    const a = excavateBoxes(grid(), stages), b = excavateBoxes(grid(), stages);
    a.stages[0].voidFraction.fill(0);
    (a.stages[0].removedBoxes[0].minM as unknown as number[])[0] = 9;
    expect(b.stages[0].removedVolumeM3).toBe(0.5);
    expect(b.stages[0].voidFraction[0]).toBe(1);
    expect(a.stages[1].removedBoxes[0].minM[0]).toBe(0);
    expect(a.stages[0].grid.originM).not.toBe(b.stages[0].grid.originM);
  });
  it('handles outside and touching cuts as no-ops and full excavation as all void', () => {
    const r = excavateBoxes(grid(), [
      { id: 'touch', remove: [{ minM: [1, 0, 0], maxM: [2, 1, 1] }] },
      { id: 'all', remove: [{ minM: [-1, -1, -1], maxM: [2, 2, 2] }] },
    ]);
    expect(r.stages[0].removedVolumeM3).toBe(0);
    expect([...r.stages[1].voidFraction]).toEqual(Array(8).fill(1));
    expect([...r.stages[1].solidMask]).toEqual(Array(8).fill(0));
  });
  it('rejects invalid boxes, duplicate IDs and shifted refinement domains', () => {
    expect(() => boxVolumeM3({ minM: [1, 0, 0], maxM: [0, 1, 1] })).toThrow(GeometryError);
    expect(() => excavateBoxes(grid(), [stages[0], stages[0]])).toThrow(GeometryError);
    const shifted = createGeometryGrid({ nx: 2, ny: 2, nz: 2, originM: [0.1, 0, 0], sizeM: [1, 1, 1] });
    expect(() => compareExcavationRefinement([grid(), shifted], stages)).toThrow(GeometryError);
  });
  it('is deterministic and enforces bounded retained output', () => {
    const a = excavateBoxes(grid(3), stages), b = excavateBoxes(grid(3), stages);
    expect(a.stages[2].voidFraction).toEqual(b.stages[2].voidFraction);
    const huge = createGeometryGrid({ nx: 64, ny: 64, nz: 32, originM: [0, 0, 0], sizeM: [1, 1, 1] });
    expect(() => excavateBoxes(huge, Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, remove: [] })))).toThrow(GeometryError);
  });
});
