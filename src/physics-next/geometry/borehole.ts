import {
  GeometryError, assertGeometryGrid, createGeometryGrid, finiteNumber, positiveLengthM,
  readPointM, type GeometryGrid, type GeometrySpec, type Vec3,
} from './types';
import { compileGeometry, type GeometryField } from './signedDistance';

export interface BoreholeSpec {
  /** This version deliberately rejects deviated, bent and disconnected shafts. */
  readonly axis: 'vertical';
  readonly centerXYM: readonly [number, number];
  readonly surfaceZM: number;
  readonly radiusM: number;
  /** Shaft bottom depth measured positively from the supplied surface plane. */
  readonly depthM: number;
  /** 'sealed' is a recognized but unsupported input, not silently treated as open. */
  readonly topCondition: 'open' | 'sealed';
  /** Coaxial bottom chamber, with flat annular shoulder and common flat bottom. */
  readonly underream?: { readonly radiusM: number; readonly heightM: number };
}
export interface BoreholeOpening {
  readonly centerM: Vec3;
  readonly radiusM: number;
  readonly areaM2: number;
  /** From bore void into exterior: upward is negative z. This is a portal, not a lid. */
  readonly outwardNormal: Vec3;
  readonly condition: 'open-to-exterior';
}
export interface BoreholeGridAssessment {
  readonly grid: GeometryGrid;
  readonly compatible: boolean;
  readonly reasons: readonly string[];
  /** A proven property of this coaxial continuous geometry, NOT a voxel flood-fill. */
  readonly continuousVoidConnected: true;
  readonly topOpening: BoreholeOpening;
  readonly availableSideWallM: number;
  readonly availableBottomWallM: number;
  /** Only relevant with an underream; otherwise null, not Infinity. */
  readonly availableUnderreamCoverM: number | null;
  readonly requiredWallM: number;
  readonly shaftDiameterInCoarsestHorizontalCells: number;
  readonly chamberHeightInVerticalCells: number | null;
  readonly minimumWallInCoarsestCells: number;
  readonly unresolvedFeatures: readonly string[];
  readonly nominalVolumeM3: number;
  readonly volumeContainedInDomain: boolean;
}
function checkKeys(value: object, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) {
    throw new GeometryError('invalid-input', 'Unsupported bore/chamber property; no geometry input is silently ignored.');
  }
}
function validatedSpec(input: BoreholeSpec): BoreholeSpec {
  if (!input || typeof input !== 'object' || input.axis !== 'vertical') {
    throw new GeometryError('invalid-input', 'Only an explicit vertical bore is supported.');
  }
  checkKeys(input, ['axis', 'centerXYM', 'surfaceZM', 'radiusM', 'depthM', 'topCondition', 'underream']);
  if (input.topCondition !== 'open') {
    throw new GeometryError('invalid-input', 'Sealed, capped or unspecified top conditions are not open-bore geometry.');
  }
  if (!Array.isArray(input.centerXYM) || input.centerXYM.length !== 2) {
    throw new GeometryError('invalid-input', 'centerXYM must contain exactly two metre coordinates.');
  }
  const center = readPointM([input.centerXYM[0], input.centerXYM[1], input.surfaceZM], 'bore top');
  const radiusM = positiveLengthM(input.radiusM, 'bore radiusM');
  const depthM = positiveLengthM(input.depthM, 'bore depthM');
  positiveLengthM(depthM / 2, 'bore halfDepthM');
  readPointM([center[0] - radiusM, center[1] - radiusM, center[2]], 'bore minimum');
  readPointM([center[0] + radiusM, center[1] + radiusM, center[2] + depthM], 'bore maximum');
  let underream: BoreholeSpec['underream'];
  if (input.underream !== undefined) {
    if (!input.underream || typeof input.underream !== 'object') {
      throw new GeometryError('invalid-input', 'underream must be an explicit chamber object.');
    }
    checkKeys(input.underream, ['radiusM', 'heightM']);
    const chamberRadius = positiveLengthM(input.underream.radiusM, 'underream radiusM');
    const heightM = positiveLengthM(input.underream.heightM, 'underream heightM');
    positiveLengthM(heightM / 2, 'underream halfHeightM');
    if (chamberRadius < radiusM || !(heightM < depthM)) {
      throw new GeometryError('invalid-input', 'Underream must be at least shaft radius and leave positive cover.');
    }
    const shoulder = center[2] + (depthM - heightM), bottom = center[2] + depthM;
    if (!(shoulder > center[2] && shoulder < bottom)) {
      throw new GeometryError('resolution', 'Chamber cover/height is not representable at this coordinate.');
    }
    readPointM([center[0] - chamberRadius, center[1] - chamberRadius, shoulder], 'chamber minimum');
    readPointM([center[0] + chamberRadius, center[1] + chamberRadius, bottom], 'chamber maximum');
    if (chamberRadius > radiusM) underream = { radiusM: chamberRadius, heightM };
  }
  return {
    axis: 'vertical', centerXYM: [center[0], center[1]], surfaceZM: center[2],
    radiusM, depthM, topCondition: 'open', ...(underream ? { underream } : {}),
  };
}
function cutter(spec: BoreholeSpec): GeometrySpec {
  const cylinder = (radiusM: number, heightM: number, topZM: number): GeometrySpec => ({
    kind: 'transform',
    transform: {
      translationM: [spec.centerXYM[0], spec.centerXYM[1], topZM + heightM / 2],
      quaternionXYZW: [0, 0, 0, 1],
    },
    child: { kind: 'capped-cylinder', radiusM, halfLengthM: heightM / 2 },
  });
  const shaft = cylinder(spec.radiusM, spec.depthM, spec.surfaceZM);
  if (!spec.underream || spec.underream.radiusM === spec.radiusM) return shaft;
  return {
    kind: 'union',
    children: [
      shaft,
      cylinder(spec.underream.radiusM, spec.underream.heightM,
        spec.surfaceZM + spec.depthM - spec.underream.heightM),
    ],
  };
}

/** Continuous void geometry. Its top field zero set is an opening, not a physical cap. */
export class BoreholeGeometry {
  readonly #spec: BoreholeSpec;
  readonly field: GeometryField;
  readonly nominalVolumeM3: number;
  readonly continuousVoidConnected = true as const;
  private constructor(spec: BoreholeSpec) {
    this.#spec = validatedSpec(spec);
    this.field = compileGeometry(cutter(this.#spec));
    const s = this.#spec, c = s.underream;
    this.nominalVolumeM3 = finiteNumber(Math.PI * (
      s.radiusM * s.radiusM * s.depthM +
      (c ? (c.radiusM - s.radiusM) * (c.radiusM + s.radiusM) * c.heightM : 0)
    ), 'bore volume');
    Object.freeze(this);
  }
  static fromSpec(spec: BoreholeSpec): BoreholeGeometry { return new BoreholeGeometry(spec); }
  spec(): BoreholeSpec { return validatedSpec(this.#spec); }
  cutterSpec(): GeometrySpec { return cutter(this.#spec); }
  topOpening(): BoreholeOpening {
    return {
      centerM: [this.#spec.centerXYM[0], this.#spec.centerXYM[1], this.#spec.surfaceZM],
      radiusM: this.#spec.radiusM, areaM2: Math.PI * this.#spec.radiusM ** 2,
      outwardNormal: [0, 0, -1], condition: 'open-to-exterior',
    };
  }
}
export function createBorehole(spec: BoreholeSpec): BoreholeGeometry { return BoreholeGeometry.fromSpec(spec); }

/**
 * Wall = geometric clearance to side/bottom domain boundaries or chamber cover.
 * It is not a geotechnical strength, stable-soil, casing or containment criterion.
 * requiredWallM is supplied by the caller, not selected as a design recommendation.
 */
export function assessBoreholeGrid(
  bore: BoreholeGeometry, grid: GeometryGrid, requiredWallM: number,
): BoreholeGridAssessment {
  if (!(bore instanceof BoreholeGeometry)) throw new GeometryError('invalid-input', 'Compiled bore geometry required.');
  assertGeometryGrid(grid);
  const required = finiteNumber(requiredWallM, 'requiredWallM');
  if (required < 0 || required > 1e6) throw new GeometryError('invalid-input', 'Invalid required wall distance.');
  const s = bore.spec(), radius = s.underream?.radiusM ?? s.radiusM;
  const end = grid.originM.map((v, a) => v + grid.sizeM[a]);
  const side = Math.min(
    s.centerXYM[0] - radius - grid.originM[0], end[0] - s.centerXYM[0] - radius,
    s.centerXYM[1] - radius - grid.originM[1], end[1] - s.centerXYM[1] - radius,
  );
  const bottom = end[2] - (s.surfaceZM + s.depthM);
  const cover = s.underream ? s.depthM - s.underream.heightM : null;
  const reasons: string[] = [];
  if (s.surfaceZM !== grid.originM[2]) reasons.push('surface-not-domain-top');
  if (side < required) reasons.push('insufficient-side-wall');
  if (bottom < required) reasons.push('insufficient-bottom-wall');
  if (cover !== null && cover < required) reasons.push('insufficient-underream-cover');
  const horizontalSpacing = Math.max(grid.dxM, grid.dyM);
  const coarsestSpacing = Math.max(horizontalSpacing, grid.dzM);
  const diameterCells = 2 * s.radiusM / horizontalSpacing;
  const chamberCells = s.underream ? s.underream.heightM / grid.dzM : null;
  const wallCells = Math.min(side, bottom, cover ?? Math.max(side, bottom)) / coarsestSpacing;
  const unresolved: string[] = [];
  if (diameterCells < 2) unresolved.push('shaft-diameter-below-two-horizontal-cells');
  if (chamberCells !== null && chamberCells < 2) unresolved.push('chamber-height-below-two-vertical-cells');
  if (wallCells < 2) unresolved.push('minimum-wall-below-two-coarsest-cells');
  return {
    grid: createGeometryGrid(grid), compatible: reasons.length === 0, reasons,
    continuousVoidConnected: true, topOpening: bore.topOpening(),
    availableSideWallM: side, availableBottomWallM: bottom, availableUnderreamCoverM: cover,
    requiredWallM: required, shaftDiameterInCoarsestHorizontalCells: diameterCells,
    chamberHeightInVerticalCells: chamberCells, minimumWallInCoarsestCells: wallCells,
    unresolvedFeatures: unresolved, nominalVolumeM3: bore.nominalVolumeM3,
    volumeContainedInDomain: s.surfaceZM >= grid.originM[2] && side >= 0 && bottom >= 0 &&
      s.surfaceZM + s.depthM > grid.originM[2],
  };
}
