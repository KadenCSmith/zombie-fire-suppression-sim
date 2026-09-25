import { describe, expect, it } from 'vitest';
import { runFastEvent } from '../../src/fastEvent';
import { createDefaultScenario, createSimulation } from '../../src/sim';
import type { Scenario } from '../../src/sim';

function sourceScenario(): Scenario {
  const s = createDefaultScenario();
  s.domain.nx = 8; s.domain.ny = 8; s.domain.nz = 6;
  return s;
}

describe('bounded short-time gas/soil event', () => {
  it('keeps event duration and frame count bounded', () => {
    const s = sourceScenario();
    const snap = createSimulation(s).snapshot();
    expect(() => runFastEvent(s, snap, { durationS: 2.01 })).toThrow(/duration/);
    expect(() => runFastEvent(s, snap, { frameCount: 101 })).toThrow(/frameCount/);
  });

  it('preserves a uniform source-free gas state and shows no assumed yield', () => {
    const s = sourceScenario();
    s.source.initialMassKg = 0; s.source.enabled = false;
    s.hotRegions = [];
    s.atmosphere.deepTemperatureC = s.atmosphere.temperatureC;
    const snap = createSimulation(s).snapshot();
    const result = runFastEvent(s, snap, { durationS: 0.2, frameCount: 5 });
    expect(result.status).toBe('complete');
    expect(result.frames).toHaveLength(5);
    expect(result.frames[0].eventTimeS).toBe(0);
    expect(result.frames[4].eventTimeS).toBeCloseTo(0.2, 12);
    expect(result.frames[4].sourcePressureLoadN).toBeLessThan(0.1);
    expect(result.diagnostics.maxDamage).toBe(0);
    expect(Math.abs(result.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-8);
  });

  it('propagates converted gas with conservative inventories and an explicit yield/damage indicator', () => {
    const s = sourceScenario();
    const sim = createSimulation(s);
    const snap = sim.convertRemainingDryIce();
    const originalCo2 = Float32Array.from(snap.fields.co2);
    const result = runFastEvent(s, snap, { durationS: 1, frameCount: 21 });
    expect(result.status).toBe('complete');
    expect(result.frames).toHaveLength(21);
    expect(result.frames[0].sourcePressureLoadN).toBeGreaterThan(0);
    expect(result.diagnostics.maxDamage).toBeGreaterThan(0);
    expect(result.frames[20].shellDamage.some(v => v > 0)).toBe(true);
    expect(result.frames[20].sourcePressureLoadN).toBeLessThan(result.frames[0].sourcePressureLoadN);
    expect(Array.from(result.frames[20].shellPressurePa)).not.toEqual(Array.from(result.frames[0].shellPressurePa));
    expect(result.frames[20].shellPressurePa[1]).toBeGreaterThan(result.frames[0].shellPressurePa[1]);
    for (const frame of result.frames) {
      expect(frame.sourcePressureLoadN).toBeCloseTo(frame.sourceExcessPressurePa * result.sourceProjectedAreaM2, 8);
      expect(Array.from(frame.shellCO2MoleFraction).every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
    }
    expect(Math.abs(result.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-7);
    expect(Math.abs(result.diagnostics.co2BalanceResidualMol)).toBeLessThan(1e-7);
    expect(result.frames.every(frame => Array.from(frame.shellPressurePa).every(Number.isFinite))).toBe(true);
    expect(Array.from(snap.fields.co2)).toEqual(Array.from(originalCo2)); // read-only source snapshot
  });

  it('responds to permeability without changing the same initial conversion mass', () => {
    const low = sourceScenario();
    const high = sourceScenario();
    high.soil.intrinsicPermeabilityHorizontalM2 *= 10;
    high.soil.intrinsicPermeabilityVerticalM2 *= 10;
    const lowSnap = createSimulation(low).convertRemainingDryIce();
    const highSnap = createSimulation(high).convertRemainingDryIce();
    expect(lowSnap.diagnostics.cumulativeCO2InputKg).toBe(highSnap.diagnostics.cumulativeCO2InputKg);
    const lowRun = runFastEvent(low, lowSnap, { durationS: 1, frameCount: 11 });
    const highRun = runFastEvent(high, highSnap, { durationS: 1, frameCount: 11 });
    expect(highRun.frames.at(-1)!.sourcePressureLoadN).toBeLessThan(lowRun.frames.at(-1)!.sourcePressureLoadN);
    expect(Math.abs(lowRun.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-7);
    expect(Math.abs(highRun.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-7);
  });

  it('replays deterministically from the same scenario and snapshot', () => {
    const s = sourceScenario();
    const snap = createSimulation(s).convertRemainingDryIce();
    const first = runFastEvent(s, snap, { durationS: 0.5, frameCount: 11 });
    const second = runFastEvent(s, snap, { durationS: 0.5, frameCount: 11 });
    expect(first).toEqual(second);
    expect(first.assumptions.cohesionPa).toBeGreaterThan(0);
    expect(first.assumptions.overburdenPa).toBeGreaterThan(0);
    expect(first.assumptions.overburdenPa).toBeCloseTo(s.soil.bulkDensityKgM3 * 9.80665 * s.source.centerDepthM, 9);
    expect(first.assumptions.soilResponse).toBe('uncalibrated-effective-stress-yield-index');
  });
  it('conserves all gas exactly in the optional closed-top event boundary', () => {
    const s = sourceScenario();
    s.atmosphere.topGasBoundary = 'noFlux';
    const snap = createSimulation(s).convertRemainingDryIce();
    const result = runFastEvent(s, snap, { durationS: 0.5, frameCount: 11 });
    expect(result.status).toBe('complete');
    expect(result.assumptions.atmosphere).toBe('closed-gas-boundaries');
    expect(result.diagnostics.cumulativeBoundaryOutMol).toBe(0);
    expect(result.diagnostics.remainingTotalGasMol).toBeCloseTo(result.diagnostics.initialTotalGasMol, 9);
    expect(result.diagnostics.remainingCO2Mol).toBeCloseTo(result.diagnostics.initialCO2Mol, 9);
  });
  it('honors the atmospheric side-boundary option independently of the top', () => {
    const s = sourceScenario();
    s.atmosphere.topGasBoundary = 'noFlux';
    s.atmosphere.sideGasBoundary = 'atmospheric';
    const snap = createSimulation(s).convertRemainingDryIce();
    const result = runFastEvent(s, snap, { durationS: 0.5, frameCount: 11 });
    expect(result.status).toBe('complete');
    expect(result.assumptions.atmosphere).toBe('sides-open-only');
    expect(Math.abs(result.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-7);
  });
  it('pauses before a high-pressure state leaves the bounded fast-event model', () => {
    const s = sourceScenario();
    s.source.initialMassKg = 1000;
    const snap = createSimulation(s).convertRemainingDryIce();
    const result = runFastEvent(s, snap);
    expect(result.status).toBe('validity-paused');
    expect(result.frames).toHaveLength(1);
    expect(result.diagnostics.steps).toBe(0);
    expect(result.diagnostics.warnings.join(' ')).toMatch(/pressure exceeds/);
  });
});
