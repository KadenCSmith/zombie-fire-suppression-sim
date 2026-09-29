import {
  GEOMETRY_LIMITS, GeometryError, assertGeometryGrid, createGeometryGrid,
  cellBoundsM, cellCenterM, nodePositionM, finiteNumber, readVector3,
  readPointM, positiveInteger, positiveLengthM,
} from './types';
import type {
  BoundsM, CellMidpointSamples, DistanceKind, GeometryGrid, GeometrySpec,
  GridFieldSamples, PointClassification, Quaternion, RigidTransformSpec, Vec3,
} from './types';

type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];
interface InternalField {
  readonly kind: GeometrySpec['kind'];
  readonly distanceKind: DistanceKind;
  readonly bounds: BoundsM;
  readonly value: (pointM: Vec3) => number;
}

function dataRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new GeometryError('invalid-input', `${label} must be a plain data object.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !keys.includes(key) || !descriptor || !('value' in descriptor)) {
      throw new GeometryError('invalid-input', `${label} has an unknown key or accessor.`);
    }
  }
  return value as Record<string, unknown>;
}

function normalizedQuaternion(value: unknown): Quaternion {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new GeometryError('invalid-input', 'quaternionXYZW must have four components.');
  }
  const raw = Array.from(value, (v, i) => finiteNumber(v, `quaternionXYZW[${i}]`));
  const scale = Math.max(...raw.map(Math.abs));
  if (scale === 0) throw new GeometryError('invalid-input', 'Zero quaternion is not a rotation.');
  const scaled = raw.map(v => v / scale);
  const length = Math.hypot(...scaled);
  const q = scaled.map(v => v / length);
  // q and -q denote the same rotation. Use a reproducible representative.
  const first = q[3] !== 0 ? q[3] : (q.find(v => v !== 0) ?? 1);
  const sign = first < 0 ? -1 : 1;
  return Object.freeze([
    q[0] === 0 ? 0 : q[0] * sign, q[1] === 0 ? 0 : q[1] * sign,
    q[2] === 0 ? 0 : q[2] * sign, q[3] === 0 ? 0 : q[3] * sign,
  ]) as Quaternion;
}

export function makeRigidTransform(
  translationM: Vec3,
  quaternionXYZW: Quaternion,
): RigidTransformSpec {
  return Object.freeze({
    translationM: Object.freeze(readPointM(translationM, 'translationM')),
    quaternionXYZW: normalizedQuaternion(quaternionXYZW),
  });
}

function parseTransform(value: unknown): RigidTransformSpec {
  const v = dataRecord(value, ['translationM', 'quaternionXYZW'], 'transform');
  return Object.freeze({
    translationM: Object.freeze(readPointM(v.translationM, 'translationM')),
    quaternionXYZW: normalizedQuaternion(v.quaternionXYZW),
  });
}

function matrix(q: Quaternion): Matrix3 {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}

function forward(p: Vec3, rotation: Matrix3, translation: Vec3): Vec3 {
  return [
    rotation[0] * p[0] + rotation[1] * p[1] + rotation[2] * p[2] + translation[0],
    rotation[3] * p[0] + rotation[4] * p[1] + rotation[5] * p[2] + translation[1],
    rotation[6] * p[0] + rotation[7] * p[1] + rotation[8] * p[2] + translation[2],
  ];
}

function inverse(p: Vec3, rotation: Matrix3, translation: Vec3): Vec3 {
  const x = p[0] - translation[0], y = p[1] - translation[1], z = p[2] - translation[2];
  return [
    rotation[0] * x + rotation[3] * y + rotation[6] * z,
    rotation[1] * x + rotation[4] * y + rotation[7] * z,
    rotation[2] * x + rotation[5] * y + rotation[8] * z,
  ];
}

export function worldFromLocal(transform: RigidTransformSpec, pointM: Vec3): Vec3 {
  const t = parseTransform(transform);
  return readPointM(forward(readPointM(pointM, 'pointM'), matrix(t.quaternionXYZW), t.translationM), 'world point');
}

export function localFromWorld(transform: RigidTransformSpec, pointM: Vec3): Vec3 {
  const t = parseTransform(transform);
  return readPointM(inverse(readPointM(pointM, 'pointM'), matrix(t.quaternionXYZW), t.translationM), 'local point');
}

/** Bounds are broad-phase enclosures, never occupied volumes. */
function finiteBounds(minM: Vec3, maxM: Vec3): BoundsM {
  const lo = readVector3(minM, 'bounds minimum'), hi = readVector3(maxM, 'bounds maximum');
  if (lo.some((v, axis) => v > hi[axis])) return { kind: 'empty' };
  // Pad only the enclosure, not the signed field. Not certified interval arithmetic.
  const guard = 64 * Number.EPSILON * Math.max(1, ...lo.map(Math.abs), ...hi.map(Math.abs));
  return {
    kind: 'finite',
    minM: [lo[0] - guard, lo[1] - guard, lo[2] - guard],
    maxM: [hi[0] + guard, hi[1] + guard, hi[2] + guard],
  };
}

function cloneBounds(bounds: BoundsM): BoundsM {
  if (bounds.kind !== 'finite') return { kind: bounds.kind };
  return { kind: 'finite', minM: [...bounds.minM], maxM: [...bounds.maxM] };
}

function unionBounds(a: BoundsM, b: BoundsM): BoundsM {
  if (a.kind === 'unbounded' || b.kind === 'unbounded') return { kind: 'unbounded' };
  if (a.kind === 'empty') return cloneBounds(b);
  if (b.kind === 'empty') return cloneBounds(a);
  return finiteBounds(
    [Math.min(a.minM[0], b.minM[0]), Math.min(a.minM[1], b.minM[1]), Math.min(a.minM[2], b.minM[2])],
    [Math.max(a.maxM[0], b.maxM[0]), Math.max(a.maxM[1], b.maxM[1]), Math.max(a.maxM[2], b.maxM[2])],
  );
}

function intersectionBounds(a: BoundsM, b: BoundsM): BoundsM {
  if (a.kind === 'empty' || b.kind === 'empty') return { kind: 'empty' };
  if (a.kind === 'unbounded') return cloneBounds(b);
  if (b.kind === 'unbounded') return cloneBounds(a);
  return finiteBounds(
    [Math.max(a.minM[0], b.minM[0]), Math.max(a.minM[1], b.minM[1]), Math.max(a.minM[2], b.minM[2])],
    [Math.min(a.maxM[0], b.maxM[0]), Math.min(a.maxM[1], b.maxM[1]), Math.min(a.maxM[2], b.maxM[2])],
  );
}

function transformedBounds(bounds: BoundsM, rotation: Matrix3, translation: Vec3): BoundsM {
  if (bounds.kind !== 'finite') return cloneBounds(bounds);
  let lo: number[] | undefined, hi: number[] | undefined;
  for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const p = forward([
      x ? bounds.maxM[0] : bounds.minM[0],
      y ? bounds.maxM[1] : bounds.minM[1],
      z ? bounds.maxM[2] : bounds.minM[2],
    ], rotation, translation);
    if (!lo || !hi) { lo = [...p]; hi = [...p]; }
    else for (let axis = 0; axis < 3; axis++) {
      lo[axis] = Math.min(lo[axis], p[axis]); hi[axis] = Math.max(hi[axis], p[axis]);
    }
  }
  if (!lo || !hi) throw new GeometryError('invalid-input', 'No transformed bound corners.');
  return finiteBounds([lo[0], lo[1], lo[2]], [hi[0], hi[1], hi[2]]);
}

function emptyField(): InternalField {
  // Finite marker, NOT a distance to the empty set. Consult bounds.kind.
  return { kind: 'empty', distanceKind: 'implicit-1-lipschitz', bounds: { kind: 'empty' }, value: () => 1 };
}

function lengths(value: unknown, label: string): Vec3 {
  const v = readVector3(value, label);
  v.forEach((component, i) => positiveLengthM(component, `${label}[${i}]`));
  return v;
}

function unitVector(value: unknown, label: string): Vec3 {
  const v = readVector3(value, label), scale = Math.max(...v.map(Math.abs));
  if (scale === 0) throw new GeometryError('invalid-input', `${label} must be nonzero.`);
  const a = v.map(n => n / scale), length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
}

interface CompileContext { nodes: number; deepest: number; active: WeakSet<object> }
const EXACT: DistanceKind = 'exact-euclidean';
const IMPLICIT: DistanceKind = 'implicit-1-lipschitz';

function compileNode(raw: unknown, context: CompileContext, depth: number): InternalField {
  if (depth > GEOMETRY_LIMITS.maxTreeDepth || ++context.nodes > GEOMETRY_LIMITS.maxTreeNodes) {
    throw new GeometryError('limit', 'Geometry expression exceeds its depth/node budget.');
  }
  context.deepest = Math.max(context.deepest, depth);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new GeometryError('invalid-input', 'A geometry data object is required.');
  }
  if (context.active.has(raw)) throw new GeometryError('cycle', 'Cyclic geometry expression.');
  context.active.add(raw);
  try {
    const tag = Object.getOwnPropertyDescriptor(raw, 'kind');
    if (!tag || !('value' in tag) || typeof tag.value !== 'string') {
      throw new GeometryError('invalid-input', 'kind must be an own string data property.');
    }
    const kind: string = tag.value;
    const child = (value: unknown) => compileNode(value, context, depth + 1);
    switch (kind) {
      case 'empty':
        dataRecord(raw, ['kind'], 'empty');
        return emptyField();
      case 'sphere': {
        const v = dataRecord(raw, ['kind', 'radiusM'], 'sphere');
        const r = positiveLengthM(v.radiusM, 'radiusM');
        return {
          kind, distanceKind: EXACT, bounds: finiteBounds([-r, -r, -r], [r, r, r]),
          value: p => Math.hypot(p[0], p[1], p[2]) - r,
        };
      }
      case 'box': {
        const v = dataRecord(raw, ['kind', 'halfExtentsM'], 'box'), h = lengths(v.halfExtentsM, 'halfExtentsM');
        return {
          kind, distanceKind: EXACT, bounds: finiteBounds([-h[0], -h[1], -h[2]], h),
          value: p => {
            const x = Math.abs(p[0]) - h[0], y = Math.abs(p[1]) - h[1], z = Math.abs(p[2]) - h[2];
            return Math.hypot(Math.max(x, 0), Math.max(y, 0), Math.max(z, 0)) + Math.min(Math.max(x, y, z), 0);
          },
        };
      }
      case 'capped-cylinder': {
        const v = dataRecord(raw, ['kind', 'radiusM', 'halfLengthM'], 'capped-cylinder');
        const r = positiveLengthM(v.radiusM, 'radiusM'), h = positiveLengthM(v.halfLengthM, 'halfLengthM');
        return {
          kind, distanceKind: EXACT, bounds: finiteBounds([-r, -r, -h], [r, r, h]),
          value: p => {
            const radial = Math.hypot(p[0], p[1]) - r, axial = Math.abs(p[2]) - h;
            return Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) + Math.min(Math.max(radial, axial), 0);
          },
        };
      }
      case 'capsule': {
        const v = dataRecord(raw, ['kind', 'aM', 'bM', 'radiusM'], 'capsule');
        const a = readPointM(v.aM, 'aM'), b = readPointM(v.bM, 'bM'), r = positiveLengthM(v.radiusM, 'radiusM');
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], length2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
        return {
          kind, distanceKind: EXACT,
          bounds: finiteBounds(
            [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
            [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
          ),
          value: p => {
            const x = p[0] - a[0], y = p[1] - a[1], z = p[2] - a[2];
            // Coincident endpoints are explicitly the sphere limit.
            const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, (x * d[0] + y * d[1] + z * d[2]) / length2));
            return Math.hypot(x - t * d[0], y - t * d[1], z - t * d[2]) - r;
          },
        };
      }
      case 'ellipsoid': {
        const v = dataRecord(raw, ['kind', 'radiiM'], 'ellipsoid'), r = lengths(v.radiiM, 'radiiM'), minimum = Math.min(...r);
        return {
          kind, distanceKind: IMPLICIT, bounds: finiteBounds([-r[0], -r[1], -r[2]], r),
          // Exact zero set/sign; conservative magnitude bound, not exact clearance.
          value: p => minimum * (Math.hypot(p[0] / r[0], p[1] / r[1], p[2] / r[2]) - 1),
        };
      }
      case 'half-space': {
        const v = dataRecord(raw, ['kind', 'pointM', 'outwardNormal'], 'half-space');
        const a = readPointM(v.pointM, 'pointM'), n = unitVector(v.outwardNormal, 'outwardNormal');
        return {
          kind, distanceKind: EXACT, bounds: { kind: 'unbounded' },
          value: p => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2],
        };
      }
      case 'transform': {
        const v = dataRecord(raw, ['kind', 'transform', 'child'], 'transform node');
        const t = parseTransform(v.transform), rotation = matrix(t.quaternionXYZW), c = child(v.child);
        if (c.bounds.kind === 'empty') return emptyField();
        return {
          kind, distanceKind: c.distanceKind, bounds: transformedBounds(c.bounds, rotation, t.translationM),
          value: p => c.value(inverse(p, rotation, t.translationM)),
        };
      }
      case 'union':
      case 'intersection': {
        const v = dataRecord(raw, ['kind', 'children'], kind);
        if (!Array.isArray(v.children)) throw new GeometryError('invalid-input', 'children must be an array.');
        if (v.children.length > GEOMETRY_LIMITS.maxTreeNodes) throw new GeometryError('limit', 'Too many children.');
        if (kind === 'intersection' && v.children.length === 0) {
          throw new GeometryError('invalid-input', 'Empty intersection is unsupported; specify a domain.');
        }
        // Array.from visits holes, which are rejected as invalid children.
        const all = Array.from(v.children, child);
        if (kind === 'intersection' && all.some(c => c.bounds.kind === 'empty')) return emptyField();
        const children = all.filter(c => c.bounds.kind !== 'empty');
        if (children.length === 0) return emptyField();
        if (children.length === 1) return children[0];
        let bounds = cloneBounds(children[0].bounds);
        for (let i = 1; i < children.length; i++) {
          bounds = kind === 'union' ? unionBounds(bounds, children[i].bounds) : intersectionBounds(bounds, children[i].bounds);
        }
        if (bounds.kind === 'empty') return emptyField();
        return {
          kind, distanceKind: IMPLICIT, bounds,
          value: p => {
            let value = children[0].value(p);
            for (let i = 1; i < children.length; i++) {
              value = kind === 'union' ? Math.min(value, children[i].value(p)) : Math.max(value, children[i].value(p));
            }
            return value;
          },
        };
      }
      case 'difference': {
        const v = dataRecord(raw, ['kind', 'base', 'subtract'], 'difference');
        const a = child(v.base), b = child(v.subtract);
        if (a.bounds.kind === 'empty') return emptyField();
        if (b.bounds.kind === 'empty') return a;
        return {
          kind, distanceKind: IMPLICIT, bounds: cloneBounds(a.bounds),
          value: p => Math.max(a.value(p), -b.value(p)),
        };
      }
      default:
        throw new GeometryError('invalid-input', `Unsupported geometry kind: ${String(kind)}.`);
    }
  } finally { context.active.delete(raw); }
}

export function classifySignedValue(valueM: number, toleranceM = 0): PointClassification {
  const value = finiteNumber(valueM, 'valueM'), tolerance = finiteNumber(toleranceM, 'toleranceM');
  if (tolerance < 0 || tolerance > GEOMETRY_LIMITS.maxLengthM) {
    throw new GeometryError('invalid-input', 'Invalid classification tolerance.');
  }
  return value < -tolerance ? 'inside' : value > tolerance ? 'outside' : 'boundary-band';
}

const fields = new WeakSet<object>();

/** Immutable compiled snapshot. All public array-bearing results are owned copies. */
export class GeometryField {
  readonly #compiled: InternalField;
  readonly kind: GeometrySpec['kind'];
  readonly distanceKind: DistanceKind;
  /** In exact arithmetic; roundoff guards remain necessary in conservative use. */
  readonly lipschitzBound = 1 as const;
  readonly nodeCount: number;
  readonly treeDepth: number;

  private constructor(compiled: InternalField, context: CompileContext) {
    this.#compiled = compiled;
    this.kind = compiled.kind; this.distanceKind = compiled.distanceKind;
    this.nodeCount = context.nodes; this.treeDepth = context.deepest;
    fields.add(this); Object.freeze(this);
  }

  static fromSpec(spec: GeometrySpec): GeometryField {
    const context: CompileContext = { nodes: 0, deepest: 0, active: new WeakSet<object>() };
    return new GeometryField(compileNode(spec, context, 1), context);
  }

  valueM(pointM: Vec3): number {
    return finiteNumber(this.#compiled.value(readPointM(pointM, 'pointM')), 'signed field value');
  }

  classify(pointM: Vec3, toleranceM = 0): PointClassification {
    const value = this.valueM(pointM), result = classifySignedValue(value, toleranceM);
    return this.#compiled.bounds.kind === 'empty' ? 'outside' : result;
  }

  boundsM(): BoundsM { return cloneBounds(this.#compiled.bounds); }
}

export function compileGeometry(spec: GeometrySpec): GeometryField { return GeometryField.fromSpec(spec); }

function checkSampling(field: GeometryField, count: number): void {
  if (!field || typeof field !== 'object' || !fields.has(field)) {
    throw new GeometryError('invalid-input', 'A compiled GeometryField is required.');
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > GEOMETRY_LIMITS.maxSamples ||
      count * field.nodeCount > GEOMETRY_LIMITS.maxSampleNodeVisits) {
    throw new GeometryError('budget', 'Sampling allocation/evaluation budget exceeded.');
  }
}

/** Deterministic scalar values only. Do not threshold these into conservative fractions. */
export function sampleGrid(
  field: GeometryField,
  grid: GeometryGrid,
  location: 'cell-centers' | 'nodes' = 'cell-centers',
): GridFieldSamples {
  assertGeometryGrid(grid);
  if (location !== 'cell-centers' && location !== 'nodes') throw new GeometryError('invalid-input', 'Unknown sample location.');
  const count = location === 'nodes' ? grid.nodeCount : grid.cellCount;
  checkSampling(field, count);
  const valuesM = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    valuesM[i] = field.valueM(location === 'nodes' ? nodePositionM(grid, i) : cellCenterM(grid, i));
  }
  return { grid: createGeometryGrid(grid), location, valuesM, distanceKind: field.distanceKind, lipschitzBound: 1 };
}

/** Fixed tensor-product midpoint quadrature; no random seeds or jitter. */
export function sampleCellMidpoints(
  field: GeometryField,
  grid: GeometryGrid,
  cell: number,
  subdivisions: readonly [number, number, number],
): CellMidpointSamples {
  const bounds = cellBoundsM(grid, cell), raw = readVector3(subdivisions, 'subdivisions');
  const sx = positiveInteger(raw[0], GEOMETRY_LIMITS.maxSubdivisions, 'sx');
  const sy = positiveInteger(raw[1], GEOMETRY_LIMITS.maxSubdivisions, 'sy');
  const sz = positiveInteger(raw[2], GEOMETRY_LIMITS.maxSubdivisions, 'sz');
  const sampleCount = sx * sy * sz;
  checkSampling(field, sampleCount);
  const pointsM = new Float64Array(sampleCount * 3), valuesM = new Float64Array(sampleCount);
  const position = (axis: number, index: number, count: number): number => {
    const value = bounds.minM[axis] + (bounds.maxM[axis] - bounds.minM[axis]) * ((index + 0.5) / count);
    if (!(value > bounds.minM[axis] && value < bounds.maxM[axis])) {
      throw new GeometryError('resolution', 'A midpoint is not representable strictly inside its cell.');
    }
    return value;
  };
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
    const q = (z * sy + y) * sx + x;
    const p: Vec3 = [position(0, x, sx), position(1, y, sy), position(2, z, sz)];
    pointsM.set(p, q * 3); valuesM[q] = field.valueM(p);
  }
  return {
    grid: createGeometryGrid(grid), cell,
    subdivisions: Object.freeze([sx, sy, sz]) as readonly [number, number, number],
    sampleCount, pointsM, valuesM,
    sampleVolumeM3: grid.cellVolumeM3 / sampleCount,
    distanceKind: field.distanceKind,
  };
}
