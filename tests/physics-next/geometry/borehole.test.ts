import { describe, expect, it } from 'vitest';
import { createGeometryGrid, GeometryError } from '../../../src/physics-next/geometry/types';
import { createBorehole, assessBoreholeGrid, type BoreholeSpec } from '../../../src/physics-next/geometry/borehole';

const spec: BoreholeSpec = {
  axis: 'vertical', centerXYM: [0.5, 0.5], surfaceZM: 0, radiusM: 0.1, depthM: 0.75, topCondition: 'open',
};
const grid = (n: number) => createGeometryGrid({ nx: n, ny: n, nz: n, originM: [0, 0, 0], sizeM: [1, 1, 1] });
describe('finite open borehole geometry', () => {
  it('has analytic finite shaft volume, an exterior portal and correct signs', () => {
    const bore = createBorehole(spec), opening = bore.topOpening();
    expect(bore.nominalVolumeM3).toBeCloseTo(Math.PI * 0.01 * 0.75, 14);
    expect(opening.outwardNormal).toEqual([0, 0, -1]);
    expect(opening.areaM2).toBeCloseTo(Math.PI * 0.01, 14);
    expect(opening.condition).toBe('open-to-exterior');
    expect(bore.field.valueM([0.5, 0.5, 0])).toBeCloseTo(0, 14);
    expect(bore.field.valueM([0.5, 0.5, -0.01])).toBeGreaterThan(0);
    expect(bore.field.valueM([0.5, 0.5, 0.76])).toBeGreaterThan(0);
    expect(bore.field.valueM([0.61, 0.5, 0.4])).toBeGreaterThan(0);
  });
  it('constructs a connected coaxial underream without double-counting its shaft volume', () => {
    const bore = createBorehole({ ...spec, underream: { radiusM: 0.2, heightM: 0.2 } });
    const expected = Math.PI * (0.1 ** 2 * 0.75 + (0.2 ** 2 - 0.1 ** 2) * 0.2);
    expect(bore.nominalVolumeM3).toBeCloseTo(expected, 14);
    expect(bore.continuousVoidConnected).toBe(true);
    for (let k = 1; k < 100; k++) expect(bore.field.valueM([0.5, 0.5, 0.75 * k / 100])).toBeLessThanOrEqual(0);
    expect(bore.field.valueM([0.65, 0.5, 0.65])).toBeLessThanOrEqual(0);
    expect(bore.field.valueM([0.65, 0.5, 0.4])).toBeGreaterThan(0);
  });
  it('leaves unchanged geometry for a same-radius chamber', () => {
    const a = createBorehole(spec), b = createBorehole({ ...spec, underream: { radiusM: 0.1, heightM: 0.2 } });
    expect(a.nominalVolumeM3).toBe(b.nominalVolumeM3);
    expect(a.field.valueM([0.55, 0.55, 0.6])).toBe(b.field.valueM([0.55, 0.55, 0.6]));
    expect(assessBoreholeGrid(b, grid(10), 0.25).availableUnderreamCoverM).toBe(null);
  });
  it('rejects sealed and unsupported or disconnected input configurations', () => {
    expect(() => createBorehole({ ...spec, topCondition: 'sealed' })).toThrow(GeometryError);
    expect(() => createBorehole({ ...spec, axis: 'tilted' } as unknown as BoreholeSpec)).toThrow(GeometryError);
    expect(() => createBorehole({ ...spec, underream: { radiusM: 0.05, heightM: 0.2 } })).toThrow(GeometryError);
    expect(() => createBorehole({ ...spec, underream: { radiusM: 0.2, heightM: 0.75 } })).toThrow(GeometryError);
    expect(() => createBorehole({ ...spec, depthM: 0 })).toThrow(GeometryError);
    expect(() => createBorehole({
      ...spec, underream: { radiusM: 0.2, heightM: 0.2, offsetM: 0.5 },
    } as unknown as BoreholeSpec)).toThrow(GeometryError);
    expect(() => createBorehole({ ...spec, centerXYM: [NaN, 0] })).toThrow(GeometryError);
  });
  it('reports physical side, bottom and chamber-cover clearances without strength claims', () => {
    const bore = createBorehole({ ...spec, underream: { radiusM: 0.2, heightM: 0.2 } });
    const a = assessBoreholeGrid(bore, grid(10), 0.25);
    expect(a.compatible).toBe(true);
    expect(a.availableSideWallM).toBeCloseTo(0.3, 14);
    expect(a.availableBottomWallM).toBe(0.25);
    expect(a.availableUnderreamCoverM).toBeCloseTo(0.55, 14);
    const b = assessBoreholeGrid(bore, grid(10), 0.26);
    expect(b.compatible).toBe(false);
    expect(b.reasons).toEqual(['insufficient-bottom-wall']);
  });
  it('reports clipped bores and non-surface-aligned openings as incompatible', () => {
    const clipped = createBorehole({ ...spec, centerXYM: [0.05, 0.5] });
    expect(assessBoreholeGrid(clipped, grid(5), 0).volumeContainedInDomain).toBe(false);
    const buried = createBorehole({ ...spec, surfaceZM: 0.1 });
    expect(assessBoreholeGrid(buried, grid(5), 0).reasons).toEqual(['surface-not-domain-top']);
  });
  it('keeps analytic volume fixed while resolution diagnostics improve', () => {
    const bore = createBorehole(spec);
    const coarse = assessBoreholeGrid(bore, grid(2), 0.1);
    const fine = assessBoreholeGrid(bore, grid(20), 0.1);
    expect(coarse.nominalVolumeM3).toBe(fine.nominalVolumeM3);
    expect(coarse.unresolvedFeatures.length).toBeGreaterThan(0);
    expect(fine.unresolvedFeatures).toHaveLength(0);
    expect(fine.shaftDiameterInCoarsestHorizontalCells).toBe(4);
  });
  it('returns owned descriptors and rejects a negative requested wall', () => {
    const bore = createBorehole(spec);
    const opening = bore.topOpening();
    (opening.centerM as unknown as number[])[0] = 99;
    expect(bore.topOpening().centerM[0]).toBe(0.5);
    expect(bore.cutterSpec()).not.toBe(bore.cutterSpec());
    expect(() => assessBoreholeGrid(bore, grid(2), -1)).toThrow(GeometryError);
  });
});
