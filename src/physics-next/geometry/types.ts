/** Geometry only. SI metres; +x/+y horizontal, +z downward. */
export type Vec3 = readonly [number, number, number];
export type Int3 = readonly [number, number, number];
/** Active local-to-world rotation, components [x, y, z, w]. */
export type Quaternion = readonly [number, number, number, number];

export const GEOMETRY_LIMITS = Object.freeze({
  minLengthM: 1e-8,
  maxLengthM: 1e6,
  maxCoordinateM: 1e6,
  maxAxisCells: 512,
  maxCells: 131072,
  maxNodes: 1048576,
  maxTreeNodes: 256,
  maxTreeDepth: 32,
  maxSubdivisions: 32,
  maxSamples: 1048576,
  maxSampleNodeVisits: 20000000,
});

export class GeometryError extends Error {
  constructor(
    readonly code: 'invalid-input' | 'limit' | 'resolution' | 'cycle' | 'budget',
    message: string,
  ) {
    super(message);
    this.name = 'GeometryError';
  }
}

export interface GridSpec {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** Minimum domain corner, not necessarily the ground surface. */
  readonly originM: Vec3;
  /** Positive full physical extents; independent of rendered meshes. */
  readonly sizeM: Vec3;
}

declare const gridIdentity: unique symbol;
/** Obtain through createGeometryGrid; recreate from GridSpec after serialization. */
export interface GeometryGrid extends GridSpec {
  readonly [gridIdentity]: true;
  readonly dxM: number;
  readonly dyM: number;
  readonly dzM: number;
  readonly cellCount: number;
  readonly nodeCount: number;
  readonly cellVolumeM3: number;
}

export type BoundsM =
  | { readonly kind: 'empty' }
  | { readonly kind: 'unbounded' }
  | { readonly kind: 'finite'; readonly minM: Vec3; readonly maxM: Vec3 };

export interface RigidTransformSpec {
  readonly translationM: Vec3;
  /** Any finite nonzero quaternion is explicitly normalized. No scale/shear. */
  readonly quaternionXYZW: Quaternion;
}

export type GeometrySpec =
  | { readonly kind: 'empty' }
  | { readonly kind: 'sphere'; readonly radiusM: number }
  | { readonly kind: 'box'; readonly halfExtentsM: Vec3 }
  | { readonly kind: 'capped-cylinder'; readonly radiusM: number; readonly halfLengthM: number }
  | { readonly kind: 'capsule'; readonly aM: Vec3; readonly bM: Vec3; readonly radiusM: number }
  | { readonly kind: 'ellipsoid'; readonly radiiM: Vec3 }
  | { readonly kind: 'half-space'; readonly pointM: Vec3; readonly outwardNormal: Vec3 }
  | { readonly kind: 'transform'; readonly transform: RigidTransformSpec; readonly child: GeometrySpec }
  | { readonly kind: 'union'; readonly children: readonly GeometrySpec[] }
  | { readonly kind: 'intersection'; readonly children: readonly GeometrySpec[] }
  | { readonly kind: 'difference'; readonly base: GeometrySpec; readonly subtract: GeometrySpec };

export type DistanceKind = 'exact-euclidean' | 'implicit-1-lipschitz';
export type PointClassification = 'inside' | 'boundary-band' | 'outside';

export interface GeometryTolerance {
  readonly absoluteM: number;
  readonly relative: number;
}
export const DEFAULT_GEOMETRY_TOLERANCE: GeometryTolerance = Object.freeze({
  absoluteM: 1e-10,
  relative: 1e-12,
});

/** Diagnostics, not fractions, cut cells, pore volumes, or solver state. */
export interface GridFieldSamples {
  readonly grid: GeometryGrid;
  readonly location: 'cell-centers' | 'nodes';
  readonly valuesM: Float64Array;
  readonly distanceKind: DistanceKind;
  readonly lipschitzBound: 1;
}

export interface CellMidpointSamples {
  readonly grid: GeometryGrid;
  readonly cell: number;
  readonly subdivisions: Int3;
  readonly sampleCount: number;
  /** Interleaved [x,y,z] metres; sample order (k*sy+j)*sx+i. */
  readonly pointsM: Float64Array;
  readonly valuesM: Float64Array;
  /** Equal numerical quadrature volume, NOT material or removed volume. */
  readonly sampleVolumeM3: number;
  readonly distanceKind: DistanceKind;
}

export function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GeometryError('invalid-input', `${label} must be finite.`);
  }
  return value === 0 ? 0 : value;
}

export function readVector3(value: unknown, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new GeometryError('invalid-input', `${label} must be an array of three numbers.`);
  }
  return [
    finiteNumber(value[0], `${label}[0]`),
    finiteNumber(value[1], `${label}[1]`),
    finiteNumber(value[2], `${label}[2]`),
  ];
}

export function readPointM(value: unknown, label: string): [number, number, number] {
  const p = readVector3(value, label);
  if (p.some(v => Math.abs(v) > GEOMETRY_LIMITS.maxCoordinateM)) {
    throw new GeometryError('limit', `${label} exceeds the coordinate budget in metres.`);
  }
  return p;
}

export function positiveLengthM(value: unknown, label: string): number {
  const length = finiteNumber(value, label);
  if (length < GEOMETRY_LIMITS.minLengthM || length > GEOMETRY_LIMITS.maxLengthM) {
    throw new GeometryError('invalid-input', `${label} is outside the supported positive length range.`);
  }
  return length;
}

export function positiveInteger(value: unknown, maximum: number, label: string): number {
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new GeometryError('invalid-input', 'Integer upper bound must be a positive safe integer.');
  }
  const n = finiteNumber(value, label);
  if (!Number.isSafeInteger(n) || n < 1 || n > maximum) {
    throw new GeometryError('limit', `${label} must be a positive integer <= ${maximum}.`);
  }
  return n;
}

const grids = new WeakSet<object>();

export function createGeometryGrid(spec: GridSpec): GeometryGrid {
  if (!spec || typeof spec !== 'object') {
    throw new GeometryError('invalid-input', 'A GridSpec is required.');
  }
  const nx = positiveInteger(spec.nx, GEOMETRY_LIMITS.maxAxisCells, 'nx');
  const ny = positiveInteger(spec.ny, GEOMETRY_LIMITS.maxAxisCells, 'ny');
  const nz = positiveInteger(spec.nz, GEOMETRY_LIMITS.maxAxisCells, 'nz');
  const cellCount = nx * ny * nz;
  const nodeCount = (nx + 1) * (ny + 1) * (nz + 1);
  if (cellCount > GEOMETRY_LIMITS.maxCells || nodeCount > GEOMETRY_LIMITS.maxNodes) {
    throw new GeometryError('limit', 'Grid cell/node count exceeds the allocation budget.');
  }
  const originM = readPointM(spec.originM, 'originM');
  const sizeM = readVector3(spec.sizeM, 'sizeM');
  sizeM.forEach((v, axis) => positiveLengthM(v, `sizeM[${axis}]`));
  const counts = [nx, ny, nz];
  const spacing = sizeM.map((v, axis) => v / counts[axis]);
  for (let axis = 0; axis < 3; axis++) {
    const end = originM[axis] + sizeM[axis];
    if (!Number.isFinite(end) || Math.abs(end) > GEOMETRY_LIMITS.maxCoordinateM) {
      throw new GeometryError('limit', 'The entire grid must fit the coordinate budget.');
    }
    const roundoffFloor = 64 * Number.EPSILON * Math.max(1, Math.abs(originM[axis]), Math.abs(end));
    if (spacing[axis] <= roundoffFloor) {
      throw new GeometryError('resolution', 'Grid spacing is too small at this coordinate magnitude.');
    }
  }
  const cellVolumeM3 = finiteNumber(spacing[0] * spacing[1] * spacing[2], 'cellVolumeM3');
  if (cellVolumeM3 <= 0) throw new GeometryError('resolution', 'Cell volume underflowed.');
  const grid = Object.freeze({
    nx, ny, nz,
    originM: Object.freeze(originM),
    sizeM: Object.freeze(sizeM),
    dxM: spacing[0], dyM: spacing[1], dzM: spacing[2],
    cellCount, nodeCount, cellVolumeM3,
  }) as GeometryGrid;
  grids.add(grid);
  return grid;
}

export function assertGeometryGrid(grid: GeometryGrid): void {
  if (!grid || typeof grid !== 'object' || !grids.has(grid)) {
    throw new GeometryError('invalid-input', 'Use createGeometryGrid; raw/serialized metadata is not a validated grid.');
  }
}

function checkedIndex(value: number, count: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= count) {
    throw new GeometryError('invalid-input', `${label} must be an integer in [0, ${count}).`);
  }
}

export function cellIndex(grid: GeometryGrid, x: number, y: number, z: number): number {
  assertGeometryGrid(grid);
  checkedIndex(x, grid.nx, 'x'); checkedIndex(y, grid.ny, 'y'); checkedIndex(z, grid.nz, 'z');
  return (z * grid.ny + y) * grid.nx + x;
}

export function nodeIndex(grid: GeometryGrid, x: number, y: number, z: number): number {
  assertGeometryGrid(grid);
  checkedIndex(x, grid.nx + 1, 'x'); checkedIndex(y, grid.ny + 1, 'y'); checkedIndex(z, grid.nz + 1, 'z');
  return (z * (grid.ny + 1) + y) * (grid.nx + 1) + x;
}

export function cellCoordinates(grid: GeometryGrid, q: number): Int3 {
  assertGeometryGrid(grid); checkedIndex(q, grid.cellCount, 'cell');
  return [q % grid.nx, Math.floor(q / grid.nx) % grid.ny, Math.floor(q / (grid.nx * grid.ny))];
}

export function nodeCoordinates(grid: GeometryGrid, n: number): Int3 {
  assertGeometryGrid(grid); checkedIndex(n, grid.nodeCount, 'node');
  return [
    n % (grid.nx + 1),
    Math.floor(n / (grid.nx + 1)) % (grid.ny + 1),
    Math.floor(n / ((grid.nx + 1) * (grid.ny + 1))),
  ];
}

/** Adjacent cells use the same edge expression; terminal edges use origin+size. */
function edge(grid: GeometryGrid, axis: number, i: number): number {
  const count = [grid.nx, grid.ny, grid.nz][axis];
  if (i === 0) return grid.originM[axis];
  if (i === count) return grid.originM[axis] + grid.sizeM[axis];
  return grid.originM[axis] + grid.sizeM[axis] * (i / count);
}

export function cellBoundsM(grid: GeometryGrid, q: number): Extract<BoundsM, { kind: 'finite' }> {
  const [x, y, z] = cellCoordinates(grid, q);
  return {
    kind: 'finite',
    minM: [edge(grid, 0, x), edge(grid, 1, y), edge(grid, 2, z)],
    maxM: [edge(grid, 0, x + 1), edge(grid, 1, y + 1), edge(grid, 2, z + 1)],
  };
}

export function cellCenterM(grid: GeometryGrid, q: number): Vec3 {
  const b = cellBoundsM(grid, q);
  return [
    b.minM[0] + (b.maxM[0] - b.minM[0]) / 2,
    b.minM[1] + (b.maxM[1] - b.minM[1]) / 2,
    b.minM[2] + (b.maxM[2] - b.minM[2]) / 2,
  ];
}

export function nodePositionM(grid: GeometryGrid, n: number): Vec3 {
  const [x, y, z] = nodeCoordinates(grid, n);
  return [edge(grid, 0, x), edge(grid, 1, y), edge(grid, 2, z)];
}

/** A field-value band; never applied to geometry, radii, or volume integrals. */
export function resolveToleranceM(
  policy: GeometryTolerance,
  characteristicLengthM: number,
  coordinateMagnitudeM: number,
): number {
  if (!policy || typeof policy !== 'object') throw new GeometryError('invalid-input', 'Tolerance policy required.');
  const absolute = finiteNumber(policy.absoluteM, 'absoluteM');
  const relative = finiteNumber(policy.relative, 'relative');
  const length = positiveLengthM(characteristicLengthM, 'characteristicLengthM');
  const coordinate = finiteNumber(coordinateMagnitudeM, 'coordinateMagnitudeM');
  if (absolute < 0 || absolute > GEOMETRY_LIMITS.maxLengthM ||
      relative < 0 || relative > 1 || coordinate < 0 || coordinate > GEOMETRY_LIMITS.maxCoordinateM) {
    throw new GeometryError('invalid-input', 'Invalid tolerance policy or coordinate magnitude.');
  }
  return Math.max(absolute, relative * length, 64 * Number.EPSILON * Math.max(1, coordinate));
}
