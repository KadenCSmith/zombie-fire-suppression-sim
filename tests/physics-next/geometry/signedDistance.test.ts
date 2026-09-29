import { describe, expect, it } from 'vitest';
import {
  GEOMETRY_LIMITS, GeometryError, createGeometryGrid, cellCenterM, nodePositionM,
} from '../../../src/physics-next/geometry/types';
import type {
  GeometrySpec, Quaternion, RigidTransformSpec, Vec3,
} from '../../../src/physics-next/geometry/types';
import {
  compileGeometry, classifySignedValue, makeRigidTransform,
  worldFromLocal, localFromWorld, sampleGrid, sampleCellMidpoints,
} from '../../../src/physics-next/geometry/signedDistance';

const sphere = (radiusM = 1): GeometrySpec => ({ kind: 'sphere', radiusM });
const translated = (child: GeometrySpec, translationM: Vec3): GeometrySpec => ({
  kind: 'transform', child,
  transform: { translationM, quaternionXYZW: [0, 0, 0, 1] },
});
function closeVector(actual: Vec3, expected: Vec3): void {
  for (let axis = 0; axis < 3; axis++) expect(actual[axis]).toBeCloseTo(expected[axis], 12);
}
function bounded(spec: GeometrySpec) {
  const bounds = compileGeometry(spec).boundsM();
  if (bounds.kind !== 'finite') throw new Error('Expected finite bounds.');
  return bounds;
}

describe('primitive distances and signs', () => {
  it('matches analytic sphere distances, including center and boundary', () => {
    const f = compileGeometry(sphere(2));
    expect(f.distanceKind).toBe('exact-euclidean');
    expect(f.valueM([0, 0, 0])).toBe(-2);
    expect(f.valueM([2, 0, 0])).toBe(0);
    expect(f.valueM([5, 0, 0])).toBe(3);
    expect(f.valueM([1, 1, 1])).toBeCloseTo(Math.sqrt(3) - 2, 14);
  });

  it('matches box face, edge, corner, interior and exterior distances', () => {
    const f = compileGeometry({ kind: 'box', halfExtentsM: [1, 2, 3] });
    expect(f.valueM([0, 0, 0])).toBe(-1);
    expect(f.valueM([1, 0, 0])).toBe(0);
    expect(f.valueM([1, 2, 0])).toBe(0);
    expect(f.valueM([1, 2, 3])).toBe(0);
    expect(f.valueM([4, 6, 3])).toBe(5);
    expect(f.valueM([0, 0, 5])).toBe(2);
  });

  it('uses a finite closed local-z cylinder with flat end caps, not a capsule', () => {
    const f = compileGeometry({ kind: 'capped-cylinder', radiusM: 2, halfLengthM: 3 });
    expect(f.valueM([0, 0, 0])).toBe(-2);
    for (const p of [[2, 0, 0], [0, 0, 3], [0, 0, -3], [2, 0, 3]] as Vec3[]) expect(f.valueM(p)).toBe(0);
    expect(f.valueM([5, 0, 7])).toBe(5);
    expect(f.valueM([0, 0, 4])).toBe(1);
    expect(f.valueM([0, 0, 2])).toBe(-1);
  });

  it('matches segment/capsule distances and the coincident-endpoint sphere limit', () => {
    const f = compileGeometry({ kind: 'capsule', aM: [0, 0, 0], bM: [0, 0, 4], radiusM: 1 });
    expect(f.valueM([0, 0, 2])).toBe(-1);
    expect(f.valueM([1, 0, 2])).toBe(0);
    expect(f.valueM([0, 0, -2])).toBe(1);
    expect(f.valueM([2, 0, 2])).toBe(1);
    const collapsed = compileGeometry({ kind: 'capsule', aM: [1, 2, 3], bM: [1, 2, 3], radiusM: 0.5 });
    expect(collapsed.valueM([1, 2, 3])).toBe(-0.5);
    expect(collapsed.valueM([1, 2, 4])).toBe(0.5);
  });

  it('labels the ellipsoid as an implicit bound, not an exact Euclidean distance', () => {
    const f = compileGeometry({ kind: 'ellipsoid', radiiM: [1, 2, 3] });
    expect(f.distanceKind).toBe('implicit-1-lipschitz');
    for (const p of [[1, 0, 0], [0, 2, 0], [0, 0, 3]] as Vec3[]) expect(f.valueM(p)).toBe(0);
    expect(f.valueM([0, 0, 0])).toBe(-1);
    expect(f.valueM([0, 4, 0])).toBe(1); // True Euclidean distance here is 2 m.
  });

  it('normalizes half-space normals and keeps positive z downward', () => {
    const f = compileGeometry({ kind: 'half-space', pointM: [0, 0, 2], outwardNormal: [0, 0, -4] });
    expect(f.valueM([0, 0, 3])).toBe(-1);
    expect(f.valueM([0, 0, 2])).toBe(0);
    expect(f.valueM([0, 0, 0])).toBe(2);
    expect(f.boundsM()).toEqual({ kind: 'unbounded' });
  });

  it('uses a finite empty-set marker with explicit empty bounds', () => {
    const f = compileGeometry({ kind: 'empty' });
    expect(f.boundsM()).toEqual({ kind: 'empty' });
    expect(f.distanceKind).toBe('implicit-1-lipschitz');
    expect(f.valueM([0, 0, 0])).toBe(1);
    expect(f.classify([0, 0, 0], 100)).toBe('outside');
  });

  it('classifies boundary bands without shifting geometry or masking exact sign', () => {
    const f = compileGeometry(sphere());
    expect(f.classify([1, 0, 0])).toBe('boundary-band');
    expect(f.classify([1 - 1e-6, 0, 0], 1e-8)).toBe('inside');
    expect(f.classify([1 + 1e-6, 0, 0], 1e-8)).toBe('outside');
    expect(f.classify([1 + 1e-9, 0, 0], 1e-8)).toBe('boundary-band');
    expect(f.valueM([1 + 1e-9, 0, 0])).toBeGreaterThan(0);
    expect(classifySignedValue(-0)).toBe('boundary-band');
    expect(Object.is(f.valueM([1, 0, 0]), -0)).toBe(false);
    expect(() => classifySignedValue(Infinity)).toThrow(GeometryError);
    expect(() => classifySignedValue(1, -1)).toThrow(GeometryError);
  });
});

describe('rigid transforms', () => {
  it('preserves distances under a 90-degree rotation plus translation', () => {
    const t = makeRigidTransform([2, -3, 4], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
    const primitive: GeometrySpec = { kind: 'capped-cylinder', radiusM: 0.5, halfLengthM: 2 };
    const f = compileGeometry({ kind: 'transform', child: primitive, transform: t });
    const base = compileGeometry(primitive);
    closeVector(worldFromLocal(t, [0, 0, 2]), [4, -3, 4]);
    for (const local of [[0, 0, 0], [1, 0, 0], [0, 0, 2], [3, -1, 4]] as Vec3[]) {
      const world = worldFromLocal(t, local);
      closeVector(localFromWorld(t, world), local);
      expect(f.valueM(world)).toBeCloseTo(base.valueM(local), 12);
    }
    expect(f.distanceKind).toBe('exact-euclidean');
  });

  it('normalizes non-unit quaternions and canonicalizes equivalent signs', () => {
    const a = makeRigidTransform([0, 0, 0], [0, 0, 2, 2]);
    const b = makeRigidTransform([0, 0, 0], [0, 0, -2, -2]);
    expect(a.quaternionXYZW).toEqual(b.quaternionXYZW);
    closeVector(worldFromLocal(a, [1, 0, 0]), [0, 1, 0]);
    const huge = makeRigidTransform([0, 0, 0], [0, 0, 1e308, 1e308]);
    closeVector(worldFromLocal(huge, [1, 0, 0]), [0, 1, 0]);
    expect(Object.isFrozen(a.quaternionXYZW)).toBe(true);
  });

  it('handles nested transforms in local-to-parent order', () => {
    const a = makeRigidTransform([1, 2, 3], [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    const b = makeRigidTransform([-3, 0, 1], [Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
    const base: GeometrySpec = { kind: 'box', halfExtentsM: [1, 2, 3] };
    const f = compileGeometry({ kind: 'transform', transform: b, child: { kind: 'transform', transform: a, child: base } });
    const local: Vec3 = [1.2, 2.3, 4];
    const world = worldFromLocal(b, worldFromLocal(a, local));
    expect(f.valueM(world)).toBeCloseTo(compileGeometry(base).valueM(local), 12);
  });

  it('encloses rotated corners with padded finite bounds', () => {
    const t = makeRigidTransform([2, 3, 4], [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    const bounds = bounded({ kind: 'transform', transform: t, child: { kind: 'box', halfExtentsM: [1, 2, 3] } });
    closeVector(bounds.minM, [0, 2, 1]); closeVector(bounds.maxM, [4, 4, 7]);
    for (const z of [-3, 3]) for (const y of [-2, 2]) for (const x of [-1, 1]) {
      const p = worldFromLocal(t, [x, y, z]);
      for (let axis = 0; axis < 3; axis++) {
        expect(p[axis]).toBeGreaterThanOrEqual(bounds.minM[axis]);
        expect(p[axis]).toBeLessThanOrEqual(bounds.maxM[axis]);
      }
    }
  });

  it('does not retain transform arrays and rejects scale/shear or invalid rotations', () => {
    const translation: [number, number, number] = [2, 3, 4];
    const quaternion: [number, number, number, number] = [0, 0, 0, 1];
    const t = makeRigidTransform(translation, quaternion);
    translation[0] = 999; quaternion[3] = 0;
    expect(t.translationM).toEqual([2, 3, 4]);
    expect(t.quaternionXYZW).toEqual([0, 0, 0, 1]);
    expect(() => makeRigidTransform([0, 0, 0], [0, 0, 0, 0])).toThrow(GeometryError);
    expect(() => makeRigidTransform([0, 0, 0], [0, NaN, 0, 1])).toThrow(GeometryError);
    expect(() => makeRigidTransform([0, 0, 0], [0, 0, 1] as unknown as Quaternion)).toThrow(GeometryError);
    const illegal = { ...t, scale: 2 } as RigidTransformSpec;
    expect(() => compileGeometry({ kind: 'transform', transform: illegal, child: sphere() })).toThrow(GeometryError);
  });
});

describe('Boolean fields and conservative enclosures', () => {
  const left = translated(sphere(), [-0.5, 0, 0]);
  const right = translated(sphere(), [0.5, 0, 0]);

  it('uses min for union and max for intersection with a non-distance label', () => {
    const union = compileGeometry({ kind: 'union', children: [left, right] });
    const intersection = compileGeometry({ kind: 'intersection', children: [left, right] });
    expect(union.valueM([0, 0, 0])).toBe(-0.5);
    expect(intersection.valueM([0, 0, 0])).toBe(-0.5);
    expect(union.classify([1.4, 0, 0])).toBe('inside');
    expect(intersection.classify([1.4, 0, 0])).toBe('outside');
    expect(union.distanceKind).toBe('implicit-1-lipschitz');
    expect(intersection.distanceKind).toBe('implicit-1-lipschitz');
  });

  it('subtracts the cutter using max(base,-cutter) without inventing volume or mass', () => {
    const f = compileGeometry({
      kind: 'difference',
      base: { kind: 'box', halfExtentsM: [2, 2, 2] },
      subtract: { kind: 'capped-cylinder', radiusM: 0.5, halfLengthM: 3 },
    });
    expect(f.classify([0, 0, 0])).toBe('outside');
    expect(f.classify([1, 0, 0])).toBe('inside');
    expect(f.classify([0.5, 0, 0])).toBe('boundary-band');
    expect(f.classify([3, 0, 0])).toBe('outside');
    const bounds = f.boundsM();
    expect(bounds.kind).toBe('finite');
    if (bounds.kind === 'finite') closeVector(bounds.maxM, [2, 2, 2]);
  });

  it('handles empty identities, disjoint bounds and bounded/unbounded combinations', () => {
    const empty: GeometrySpec = { kind: 'empty' };
    expect(compileGeometry({ kind: 'union', children: [] }).boundsM()).toEqual({ kind: 'empty' });
    expect(compileGeometry({ kind: 'union', children: [empty, sphere()] }).distanceKind).toBe('exact-euclidean');
    expect(compileGeometry({ kind: 'intersection', children: [empty, sphere()] }).boundsM()).toEqual({ kind: 'empty' });
    expect(compileGeometry({ kind: 'difference', base: sphere(), subtract: empty }).valueM([0, 0, 0])).toBe(-1);
    expect(compileGeometry({ kind: 'difference', base: empty, subtract: sphere() }).boundsM()).toEqual({ kind: 'empty' });
    const disjoint = compileGeometry({ kind: 'intersection', children: [sphere(), translated(sphere(), [5, 0, 0])] });
    expect(disjoint.boundsM()).toEqual({ kind: 'empty' });
    const plane: GeometrySpec = { kind: 'half-space', pointM: [0, 0, 0], outwardNormal: [0, 0, -1] };
    expect(compileGeometry({ kind: 'union', children: [plane, sphere()] }).boundsM()).toEqual({ kind: 'unbounded' });
    expect(compileGeometry({ kind: 'intersection', children: [plane, sphere()] }).boundsM().kind).toBe('finite');
    const union = bounded({ kind: 'union', children: [sphere(), translated(sphere(), [5, 0, 0])] });
    closeVector(union.minM, [-1, -1, -1]); closeVector(union.maxM, [6, 1, 1]);
  });

  it('does not mistake coincident or tangential zero sets for occupied interiors', () => {
    const same = sphere();
    const removed = compileGeometry({ kind: 'difference', base: same, subtract: same });
    expect(removed.classify([0, 0, 0])).toBe('outside');
    expect(removed.classify([1, 0, 0])).toBe('boundary-band'); // Candidate only; Task 4 must test both sides.
    const touching = compileGeometry({ kind: 'intersection', children: [sphere(), translated(sphere(), [2, 0, 0])] });
    expect(touching.classify([1, 0, 0])).toBe('boundary-band');
    expect(touching.valueM([1 - 1e-5, 0, 0])).toBeGreaterThan(0);
    expect(touching.valueM([1 + 1e-5, 0, 0])).toBeGreaterThan(0);
  });

  it('owns all compiled inputs and returns independent bound arrays', () => {
    const radii: [number, number, number] = [1, 2, 3];
    const location: [number, number, number] = [2, 0, 0];
    const children: GeometrySpec[] = [translated({ kind: 'ellipsoid', radiiM: radii }, location)];
    const f = compileGeometry({ kind: 'union', children });
    radii[0] = 999; location[0] = 999; children.push(sphere(100));
    expect(f.valueM([2, 0, 0])).toBe(-1);
    const a = f.boundsM(), b = f.boundsM();
    expect(a).not.toBe(b);
    if (a.kind !== 'finite' || b.kind !== 'finite') throw new Error('Expected finite bounds.');
    expect(a.minM).not.toBe(b.minM);
    expect(a.maxM).not.toBe(b.maxM);
    (a.minM as [number, number, number])[0] = 999;
    const fresh = f.boundsM();
    if (fresh.kind !== 'finite') throw new Error('Expected finite bounds.');
    closeVector(fresh.minM, [1, -2, -3]);
  });

  it('satisfies the one-Lipschitz inequality on deterministic analytic probes', () => {
    const specs: GeometrySpec[] = [
      sphere(), { kind: 'box', halfExtentsM: [1, 2, 3] },
      { kind: 'capped-cylinder', radiusM: 0.5, halfLengthM: 2 },
      { kind: 'capsule', aM: [-1, 0, 0], bM: [1, 1, 2], radiusM: 0.3 },
      { kind: 'ellipsoid', radiiM: [0.2, 2, 3] },
      { kind: 'half-space', pointM: [0, 0, 0], outwardNormal: [1, -2, 3] },
      { kind: 'union', children: [left, right] },
      { kind: 'intersection', children: [left, right] },
      { kind: 'difference', base: left, subtract: right },
    ];
    for (const spec of specs) {
      const f = compileGeometry(spec);
      for (let i = 0; i < 30; i++) {
        const a: Vec3 = [(i % 7) / 3 - 1, (i % 5) / 2 - 1, (i % 3) - 1];
        const b: Vec3 = [a[0] + 0.17, a[1] - 0.31, a[2] + 0.29];
        expect(Math.abs(f.valueM(a) - f.valueM(b))).toBeLessThanOrEqual(Math.hypot(0.17, 0.31, 0.29) + 1e-12);
      }
    }
  });
});

describe('validation and bounded work', () => {
  it('rejects malformed primitives, extra keys, non-finite lengths and unknown kinds', () => {
    const invalid: unknown[] = [
      null, {}, { kind: 'cone' }, { kind: 'sphere', radiusM: 0 },
      { kind: 'sphere', radiusM: -1 }, { kind: 'sphere', radiusM: NaN },
      { kind: 'sphere', radiusM: Infinity }, { kind: 'sphere', radiusM: 1, scale: 2 },
      { kind: 'sphere', radiusM: GEOMETRY_LIMITS.minLengthM / 2 },
      { kind: 'sphere', radiusM: GEOMETRY_LIMITS.maxLengthM + 1 },
      { kind: 'box', halfExtentsM: [1, 0, 1] },
      { kind: 'capped-cylinder', radiusM: 1, halfLengthM: 0 },
      { kind: 'capsule', aM: [NaN, 0, 0], bM: [0, 0, 0], radiusM: 1 },
      { kind: 'ellipsoid', radiiM: [1, -1, 1] },
      { kind: 'half-space', pointM: [0, 0, 0], outwardNormal: [0, 0, 0] },
      { kind: 'half-space', pointM: [0, 0, 0], outwardNormal: [NaN, 0, 1] },
      { kind: 'intersection', children: [] }, { kind: 'union', children: [undefined] },
      { kind: 'difference', base: sphere() },
    ];
    for (const spec of invalid) expect(() => compileGeometry(spec as GeometrySpec)).toThrow(GeometryError);
    const f = compileGeometry(sphere());
    for (const x of [NaN, Infinity, GEOMETRY_LIMITS.maxCoordinateM + 1]) {
      expect(() => f.valueM([x, 0, 0])).toThrow(GeometryError);
    }
  });

  it('rejects discriminant accessors without invoking them and rejects inherited tags', () => {
    let called = false;
    const accessor = {
      get kind(): string { called = true; return 'sphere'; },
      radiusM: 1,
    };
    expect(() => compileGeometry(accessor as GeometrySpec)).toThrow(GeometryError);
    expect(called).toBe(false);
    const inherited = Object.create({ kind: 'sphere' }) as { radiusM: number };
    inherited.radiusM = 1;
    expect(() => compileGeometry(inherited as GeometrySpec)).toThrow(GeometryError);
  });

  it('rejects cycles and excessive depth while accepting acyclic shared inputs', () => {
    const cyclic: { kind: 'union'; children: unknown[] } = { kind: 'union', children: [] };
    cyclic.children.push(cyclic);
    expect(() => compileGeometry(cyclic as GeometrySpec)).toThrow(GeometryError);
    let deep = sphere();
    for (let i = 0; i < GEOMETRY_LIMITS.maxTreeDepth; i++) deep = translated(deep, [0, 0, 0]);
    expect(() => compileGeometry(deep)).toThrow(GeometryError);
    const shared = sphere();
    expect(compileGeometry({ kind: 'union', children: [shared, shared] }).valueM([0, 0, 0])).toBe(-1);
  });

  it('preflights tree and sampling work limits instead of starting an oversized evaluation', () => {
    expect(() => compileGeometry({
      kind: 'union', children: Array.from({ length: GEOMETRY_LIMITS.maxTreeNodes }, () => sphere()),
    })).toThrow(GeometryError);
    const f = compileGeometry({
      kind: 'union', children: Array.from({ length: GEOMETRY_LIMITS.maxTreeNodes - 1 }, () => sphere()),
    });
    const grid = createGeometryGrid({ nx: 64, ny: 64, nz: 32, originM: [0, 0, 0], sizeM: [8, 8, 4] });
    expect(() => sampleGrid(f, grid)).toThrow(GeometryError);
  });
});

describe('deterministic owned samples, not conservative occupancy', () => {
  const grid = () => createGeometryGrid({ nx: 2, ny: 2, nz: 2, originM: [0, 0, 0], sizeM: [2, 2, 2] });

  it('samples every cell center and node in the explicit grid ordering', () => {
    const g = grid(), f = compileGeometry(sphere()), cells = sampleGrid(f, g), nodes = sampleGrid(f, g, 'nodes');
    expect(cells.valuesM).toHaveLength(g.cellCount);
    expect(nodes.valuesM).toHaveLength(g.nodeCount);
    for (let q = 0; q < g.cellCount; q++) expect(cells.valuesM[q]).toBe(f.valueM(cellCenterM(g, q)));
    for (let n = 0; n < g.nodeCount; n++) expect(nodes.valuesM[n]).toBe(f.valueM(nodePositionM(g, n)));
    expect(nodes.valuesM[0]).toBe(-1);
    expect(nodes.valuesM[g.nodeCount - 1]).toBeCloseTo(Math.sqrt(12) - 1, 14);
    expect(cells.distanceKind).toBe('exact-euclidean');
  });

  it('returns byte-identical repeated samples without shared mutable buffers or metadata arrays', () => {
    const g = grid(), f = compileGeometry(sphere()), a = sampleGrid(f, g), b = sampleGrid(f, g);
    expect(new Uint8Array(a.valuesM.buffer)).toEqual(new Uint8Array(b.valuesM.buffer));
    expect(a.valuesM.buffer).not.toBe(b.valuesM.buffer);
    expect(a.grid).not.toBe(g);
    expect(a.grid.originM).not.toBe(b.grid.originM);
    expect(a.grid.sizeM).not.toBe(g.sizeM);
    a.valuesM[0] = 999;
    expect(b.valuesM[0]).toBe(f.valueM(cellCenterM(g, 0)));
  });

  it('uses x-fastest tensor midpoints with explicit numerical quadrature volume', () => {
    const g = createGeometryGrid({ nx: 1, ny: 1, nz: 1, originM: [0, 0, 0], sizeM: [2, 4, 6] });
    const f = compileGeometry({ kind: 'half-space', pointM: [0, 0, 0], outwardNormal: [0, 0, 1] });
    const a = sampleCellMidpoints(f, g, 0, [2, 2, 2]);
    const b = sampleCellMidpoints(f, g, 0, [2, 2, 2]);
    expect(a.sampleCount).toBe(8);
    expect(a.pointsM).toHaveLength(24);
    expect(a.valuesM).toHaveLength(8);
    expect(Array.from(a.pointsM.slice(0, 6))).toEqual([0.5, 1, 1.5, 1.5, 1, 1.5]);
    expect(Array.from(a.pointsM.slice(-3))).toEqual([1.5, 3, 4.5]);
    expect(Array.from(a.valuesM)).toEqual([1.5, 1.5, 1.5, 1.5, 4.5, 4.5, 4.5, 4.5]);
    expect(a.sampleVolumeM3 * a.sampleCount).toBe(g.cellVolumeM3);
    expect(a.pointsM.buffer).not.toBe(b.pointsM.buffer);
    expect(a.valuesM.buffer).not.toBe(b.valuesM.buffer);
    expect(a.pointsM.buffer).not.toBe(a.valuesM.buffer);
    a.pointsM[0] = 999; a.valuesM[0] = 999;
    expect(b.pointsM[0]).toBe(0.5); expect(b.valuesM[0]).toBe(1.5);
  });

  it('keeps every sample finite and validates sample requests', () => {
    const g = grid(), f = compileGeometry({ kind: 'empty' });
    expect(Array.from(sampleGrid(f, g).valuesM).every(Number.isFinite)).toBe(true);
    for (const bad of [0, -1, 1.5, NaN, Infinity, GEOMETRY_LIMITS.maxSubdivisions + 1]) {
      expect(() => sampleCellMidpoints(f, g, 0, [bad, 1, 1])).toThrow(GeometryError);
    }
    expect(() => sampleCellMidpoints(f, g, g.cellCount, [1, 1, 1])).toThrow(GeometryError);
    expect(() => sampleGrid(f, g, 'faces' as 'nodes')).toThrow(GeometryError);
    expect(() => sampleGrid({} as ReturnType<typeof compileGeometry>, g)).toThrow(GeometryError);
  });
});
