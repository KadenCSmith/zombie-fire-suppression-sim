import {
  GeometryError, assertGeometryGrid, cellBoundsM, createGeometryGrid,
  finiteNumber, readPointM, type GeometryGrid, type Vec3,
} from './types';

/** Exact orthogonal excavation model: boxes only, not a curved-cutter surrogate. */
export interface ExcavationBox {
  readonly minM: Vec3;
  readonly maxM: Vec3;
}
export interface ExcavationStage {
  readonly id: string;
  readonly remove: readonly ExcavationBox[];
}
export interface ExcavationState {
  readonly id: string;
  readonly grid: GeometryGrid;
  /** Newly owned, nonoverlapping open-interior pieces clipped to the domain. */
  readonly removedBoxes: readonly ExcavationBox[];
  readonly voidFraction: Float64Array;
  readonly solidFraction: Float64Array;
  /** 1 means nonzero geometric volume of the named phase, not a centre label. */
  readonly voidMask: Uint8Array;
  readonly solidMask: Uint8Array;
  /** Shared-edge physical cell measures; use these for extensive integration. */
  readonly cellVolumesM3: Float64Array;
  readonly removedVolumeM3: number;
  readonly incrementalRemovedVolumeM3: number;
  readonly integratedRemovedVolumeM3: number;
  readonly integrationResidualM3: number;
  readonly errorAllowanceM3: number;
  readonly method: 'exact-axis-aligned-box-union';
}
export interface ExcavationSequence {
  readonly initial: ExcavationState;
  readonly stages: readonly ExcavationState[];
}
export interface ExcavationRefinement {
  readonly levels: readonly {
    readonly cellCount: number;
    readonly removedVolumeM3: number;
    readonly integratedRemovedVolumeM3: number;
    readonly absoluteErrorM3: number;
    readonly errorAllowanceM3: number;
  }[];
  readonly referenceVolumeM3: number;
  readonly maxAbsoluteErrorM3: number;
  readonly withinRoundoffAllowance: boolean;
}

export const EXCAVATION_LIMITS = Object.freeze({
  maxStages: 32, maxInputBoxes: 64, maxPieces: 4096,
  maxBooleanOperations: 1000000, maxCellPiecePairs: 4000000,
  maxStoredCellStates: 1048576,
});

/** A zero-volume input box is accepted as an explicit no-op; inversion is invalid. */
export function readExcavationBox(value: ExcavationBox): ExcavationBox {
  if (!value || typeof value !== 'object') throw new GeometryError('invalid-input', 'Box is required.');
  const minM = readPointM(value.minM, 'box.minM'), maxM = readPointM(value.maxM, 'box.maxM');
  if (minM.some((v, a) => v > maxM[a])) throw new GeometryError('invalid-input', 'Inverted excavation box.');
  return { minM, maxM };
}
function copyBox(b: ExcavationBox): ExcavationBox {
  return { minM: [...b.minM] as Vec3, maxM: [...b.maxM] as Vec3 };
}
export function boxVolumeM3(input: ExcavationBox): number {
  const b = readExcavationBox(input);
  return finiteNumber(
    (b.maxM[0] - b.minM[0]) * (b.maxM[1] - b.minM[1]) * (b.maxM[2] - b.minM[2]), 'box volume',
  );
}
export function intersectExcavationBoxes(aInput: ExcavationBox, bInput: ExcavationBox): ExcavationBox | null {
  const a = readExcavationBox(aInput), b = readExcavationBox(bInput);
  const minM: Vec3 = [0, 1, 2].map(i => Math.max(a.minM[i], b.minM[i])) as unknown as Vec3;
  const maxM: Vec3 = [0, 1, 2].map(i => Math.min(a.maxM[i], b.maxM[i])) as unknown as Vec3;
  return minM.some((v, i) => v >= maxM[i]) ? null : { minM, maxM };
}

/** A \ B as at most six disjoint-interior slabs. No tolerance expands a cutter. */
export function subtractExcavationBox(aInput: ExcavationBox, bInput: ExcavationBox): ExcavationBox[] {
  const a = readExcavationBox(aInput), b = readExcavationBox(bInput);
  if (boxVolumeM3(a) === 0) return [];
  const overlap = intersectExcavationBoxes(a, b);
  if (!overlap) return [copyBox(a)];
  const result: ExcavationBox[] = [];
  const lo = [...a.minM], hi = [...a.maxM];
  for (let axis = 0; axis < 3; axis++) {
    if (lo[axis] < overlap.minM[axis]) {
      const top = [...hi]; top[axis] = overlap.minM[axis];
      result.push({ minM: [...lo] as unknown as Vec3, maxM: top as unknown as Vec3 });
      lo[axis] = overlap.minM[axis];
    }
    if (overlap.maxM[axis] < hi[axis]) {
      const bottom = [...lo]; bottom[axis] = overlap.maxM[axis];
      result.push({ minM: bottom as unknown as Vec3, maxM: [...hi] as unknown as Vec3 });
      hi[axis] = overlap.maxM[axis];
    }
  }
  return result;
}
function sum(values: Iterable<number>): number {
  let total = 0, correction = 0;
  for (const v of values) {
    const y = v - correction, next = total + y;
    correction = (next - total) - y; total = next;
  }
  return total;
}
function domainBox(grid: GeometryGrid): ExcavationBox {
  return {
    minM: [...grid.originM] as Vec3,
    maxM: grid.originM.map((v, a) => v + grid.sizeM[a]) as unknown as Vec3,
  };
}
function state(grid: GeometryGrid, pieces: readonly ExcavationBox[], id: string, previous: number): ExcavationState {
  if (grid.cellCount * Math.max(1, pieces.length) > EXCAVATION_LIMITS.maxCellPiecePairs) {
    throw new GeometryError('budget', 'Excavation cell/piece work budget exceeded; simplify stages or tile explicitly.');
  }
  const voidFraction = new Float64Array(grid.cellCount), solidFraction = new Float64Array(grid.cellCount);
  const voidMask = new Uint8Array(grid.cellCount), solidMask = new Uint8Array(grid.cellCount);
  const cellVolumesM3 = new Float64Array(grid.cellCount);
  const removedVolumeM3 = sum(pieces.map(boxVolumeM3));
  const domainVolume = boxVolumeM3(domainBox(grid));
  const errorAllowanceM3 = 256 * Number.EPSILON * Math.max(1, pieces.length, grid.cellCount) * domainVolume;
  for (let q = 0; q < grid.cellCount; q++) {
    const cell = cellBoundsM(grid, q), volume = boxVolumeM3(cell);
    cellVolumesM3[q] = volume;
    const removed = sum(pieces.map(piece => {
      const clipped = intersectExcavationBoxes(cell, piece);
      return clipped ? boxVolumeM3(clipped) : 0;
    }));
    const raw = removed / volume;
    const guard = 256 * Number.EPSILON * Math.max(1, pieces.length);
    if (raw < -guard || raw > 1 + guard) throw new GeometryError('resolution', 'Invalid disjoint box measure.');
    voidFraction[q] = Math.max(0, Math.min(1, raw));
    solidFraction[q] = 1 - voidFraction[q];
    voidMask[q] = voidFraction[q] > 0 ? 1 : 0;
    solidMask[q] = solidFraction[q] > 0 ? 1 : 0;
  }
  const integratedRemovedVolumeM3 = sum(voidFraction.map((f, q) => f * cellVolumesM3[q]));
  const integrationResidualM3 = integratedRemovedVolumeM3 - removedVolumeM3;
  if (Math.abs(integrationResidualM3) > errorAllowanceM3 || removedVolumeM3 + errorAllowanceM3 < previous) {
    throw new GeometryError('resolution', 'Excavation conservation/monotonicity roundoff allowance exceeded.');
  }
  return {
    id, grid: createGeometryGrid(grid), removedBoxes: pieces.map(copyBox),
    voidFraction, solidFraction, voidMask, solidMask, cellVolumesM3,
    removedVolumeM3, incrementalRemovedVolumeM3: Math.max(0, removedVolumeM3 - previous),
    integratedRemovedVolumeM3, integrationResidualM3, errorAllowanceM3,
    method: 'exact-axis-aligned-box-union',
  };
}

/** Initially all geometric solid. Each stage only adds clipped void; no mass is computed. */
export function excavateBoxes(grid: GeometryGrid, stages: readonly ExcavationStage[]): ExcavationSequence {
  assertGeometryGrid(grid);
  if (!Array.isArray(stages) || stages.length > EXCAVATION_LIMITS.maxStages) {
    throw new GeometryError('limit', 'Invalid excavation stage array.');
  }
  if ((stages.length + 1) * grid.cellCount > EXCAVATION_LIMITS.maxStoredCellStates) {
    throw new GeometryError('budget', 'Cumulative excavation output budget exceeded.');
  }
  const ids = new Set<string>(), validated: ExcavationStage[] = [];
  let boxes = 0;
  for (const stage of stages) {
    if (!stage || typeof stage.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(stage.id) ||
        stage.id === 'initial' || ids.has(stage.id) || !Array.isArray(stage.remove)) {
      throw new GeometryError('invalid-input', 'Stages need unique bounded IDs and explicit box arrays.');
    }
    ids.add(stage.id); boxes += stage.remove.length;
    if (boxes > EXCAVATION_LIMITS.maxInputBoxes) throw new GeometryError('budget', 'Too many excavation boxes.');
    validated.push({ id: stage.id, remove: stage.remove.map(readExcavationBox) });
  }
  const domain = domainBox(grid), pieces: ExcavationBox[] = [];
  const initial = state(grid, pieces, 'initial', 0), results: ExcavationState[] = [];
  let operations = 0, previous = 0;
  for (const stage of validated) {
    for (const box of stage.remove) {
      const clipped = intersectExcavationBoxes(box, domain);
      let pending: ExcavationBox[] = clipped ? [clipped] : [];
      for (const occupied of pieces) {
        const next: ExcavationBox[] = [];
        for (const candidate of pending) {
          if (++operations > EXCAVATION_LIMITS.maxBooleanOperations) {
            throw new GeometryError('budget', 'Exact box-union operation budget exceeded.');
          }
          next.push(...subtractExcavationBox(candidate, occupied));
          if (next.length + pieces.length > EXCAVATION_LIMITS.maxPieces) {
            throw new GeometryError('budget', 'Exact box-union fragmentation limit exceeded.');
          }
        }
        pending = next;
        if (pending.length === 0) break;
      }
      if (pieces.length + pending.length > EXCAVATION_LIMITS.maxPieces) {
        throw new GeometryError('budget', 'Exact box-union fragmentation limit exceeded.');
      }
      pieces.push(...pending);
    }
    const result = state(grid, pieces, stage.id, previous);
    results.push(result); previous = result.removedVolumeM3;
  }
  return { initial, stages: results };
}

/** Comparisons are valid only for identical physical origin/extents, never just equal counts. */
export function compareExcavationRefinement(
  grids: readonly GeometryGrid[], stages: readonly ExcavationStage[],
): ExcavationRefinement {
  if (!Array.isArray(grids) || grids.length < 1 || grids.length > 8) {
    throw new GeometryError('invalid-input', 'Provide 1..8 explicit refinement grids.');
  }
  const validatedGrids: readonly GeometryGrid[] = grids;
  validatedGrids.forEach(assertGeometryGrid);
  const first = validatedGrids[0];
  for (const grid of validatedGrids) {
    if (grid.originM.some((v, a) => v !== first.originM[a]) || grid.sizeM.some((v, a) => v !== first.sizeM[a])) {
      throw new GeometryError('invalid-input', 'Refinement must preserve the exact physical domain.');
    }
  }
  const levels = validatedGrids.map(grid => {
    const result = excavateBoxes(grid, stages);
    const final = result.stages[result.stages.length - 1] ?? result.initial;
    return {
      cellCount: grid.cellCount, removedVolumeM3: final.removedVolumeM3,
      integratedRemovedVolumeM3: final.integratedRemovedVolumeM3,
      absoluteErrorM3: Math.abs(final.integrationResidualM3), errorAllowanceM3: final.errorAllowanceM3,
    };
  });
  const referenceVolumeM3 = levels[0].removedVolumeM3;
  return {
    levels, referenceVolumeM3, maxAbsoluteErrorM3: Math.max(...levels.map(l => l.absoluteErrorM3)),
    withinRoundoffAllowance: levels.every(l => l.absoluteErrorM3 <= l.errorAllowanceM3 &&
      Math.abs(l.removedVolumeM3 - referenceVolumeM3) <= l.errorAllowanceM3),
  };
}
