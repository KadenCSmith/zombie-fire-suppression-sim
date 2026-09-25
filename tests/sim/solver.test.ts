import { describe, expect, it } from 'vitest';
import {
  createDefaultScenario, createSimulation, diameterFromMass, feetToMeters, kelvinToCelsius,
  massFromDiameter, metersToFeet, normalizeMineralFractions, scenarioFromJSON, scenarioToJSON,
  sourceTopCoverDepthM, validateScenario, Simulation, PARAMETER_REGISTRY, SCENARIOS,
} from '../../src/sim';
import type { Scenario, SerializedSimulation, Snapshot } from '../../src/sim';

function smallScenario(): Scenario {
  const s = createDefaultScenario();
  s.domain.nx = 4; s.domain.ny = 4; s.domain.nz = 4;
  return s;
}

function quietClosedScenario(): Scenario {
  const s = smallScenario();
  s.source.initialMassKg = 0; s.source.enabled = false;
  s.hotRegions = []; s.peatRegions = []; s.root.amountKgM3 = 0;
  s.soil.organicFraction = 0;
  for (const layer of s.soilLayers) {
    layer.dryDensityMultiplier = 1; layer.porosityOffset = 0;
    layer.moistureSaturationOffset = 0; layer.permeabilityMultiplier = 1;
    layer.thermalConductivityMultiplier = 1;
  }
  s.model.smolderRateS = 0; s.model.evaporationRateS = 0;
  s.atmosphere.topGasBoundary = 'noFlux'; s.atmosphere.sideGasBoundary = 'noFlux';
  s.atmosphere.surfaceHeatTransferWm2K = 0; s.atmosphere.bottomHeatTransferWm2K = 0;
  s.atmosphere.deepTemperatureC = s.atmosphere.temperatureC;
  return s;
}

function everyFinite(snapshot: Snapshot): boolean {
  return Object.values(snapshot.fields).every(field => Array.from(field).every(Number.isFinite));
}

describe('scenario and units', () => {
  it('keeps exactly 20 ft as 6.096 m and round-trips Celsius', () => {
    expect(feetToMeters(20)).toBeCloseTo(6.096, 12);
    expect(metersToFeet(6.096)).toBeCloseTo(20, 12);
    expect(kelvinToCelsius(273.15)).toBeCloseTo(0, 12);
  });
  it('links dry-ice mass, density, and diameter', () => {
    const mass = massFromDiameter(0.2, 1560);
    expect(diameterFromMass(mass, 1560)).toBeCloseTo(0.2, 12);
    const s = createDefaultScenario();
    expect(sourceTopCoverDepthM(s)).toBeCloseTo(s.source.centerDepthM - diameterFromMass(s.source.initialMassKg, s.source.densityKgM3) / 2);
  });
  it('normalizes mineral dry-mass fractions and rejects invalid composition', () => {
    expect(normalizeMineralFractions(2, 1, 1)).toEqual([0.5, 0.25, 0.25]);
    const s = createDefaultScenario(); s.soil.clayFraction = 0.2;
    expect(validateScenario(s).errors.join(' ')).toMatch(/sum to 1/);
  });
  it('round-trips schema/provenance/units and rejects missing geometry', () => {
    const s = createDefaultScenario();
    expect(scenarioFromJSON(scenarioToJSON(s))).toEqual(s);
    const broken = JSON.parse(scenarioToJSON(s));
    delete broken.peatRegions[0].centerXM;
    expect(validateScenario(broken).valid).toBe(false);
    broken.peatRegions[0].centerXM = 1e6;
    expect(validateScenario(broken).valid).toBe(false);
  });
  it('keeps soil-layer thickness tied to depth and changes resolved properties', () => {
    const s = smallScenario();
    expect(s.soilLayers.reduce((sum, layer) => sum + layer.thicknessM, 0)).toBeCloseTo(s.domain.depthM);
    const topPorosity = createSimulation(s).snapshot().fields.porosity[0];
    s.soilLayers[0].thicknessM = 0.3;
    expect(validateScenario(s).valid).toBe(false);
    s.soilLayers[1].thicknessM = 2.7;
    expect(validateScenario(s).valid).toBe(true);
    expect(createSimulation(s).snapshot().fields.porosity[0]).not.toBe(topPorosity);
  });
  it('registers every scenario control with units, basis, provenance, and status', () => {
    const paths = new Set(PARAMETER_REGISTRY.map(entry => entry.path));
    const collect = (value: unknown, path: string, into: string[]) => {
      if (Array.isArray(value)) { if (value.length) collect(value[0], `${path}[]`, into); return; }
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) collect(child, path ? `${path}.${key}` : key, into);
        return;
      }
      into.push(path);
    };
    const initial = SCENARIOS.hypotheticalPathway;
    const physicalSections = ['domain', 'soil', 'soilLayers', 'peatRegions', 'root', 'hotRegions', 'source', 'atmosphere', 'model', 'pathways', 'illustrativeEvent'] as const;
    const found: string[] = ['seed'];
    for (const section of physicalSections) collect(initial[section], section, found);
    expect(found.filter(path => !paths.has(path))).toEqual([]);
    for (const entry of PARAMETER_REGISTRY) {
      expect(entry.name).toBeTruthy(); expect(entry.symbol).toBeTruthy(); expect(entry.units).toBeTruthy();
      expect(entry.basis).toBeTruthy(); expect(entry.source).toBeTruthy();
      expect(entry.range).toBeDefined(); expect(entry.defaultValue).not.toBeUndefined();
      expect(entry.dependencies).toBeDefined(); expect(entry.status).toBeTruthy();
    }
  });
});

describe('reduced coupled fields', () => {
  it('derives heater power from a fixed support volume, independent of shrinking mass', () => {
    const s = smallScenario();
    const sim = createSimulation(s);
    const expectedPower = s.source.heatGenerationWm3 * 4 * Math.PI * s.source.supportRadiusM ** 3 / 3;
    expect(sim.snapshot().heaterPowerW).toBeCloseTo(expectedPower, 10);
    sim.advance(120);
    expect(sim.dryIceMassKg).toBeLessThan(s.source.initialMassKg);
    expect(sim.snapshot().heaterPowerW).toBeCloseTo(expectedPower, 10);
    expect(sim.heaterEnergyJ).toBeCloseTo(expectedPower * 120, 5);
    expect(Math.abs(sim.diagnostics.sourceEnergyResidualJ)).toBeLessThan(1e-6);
  });
  it('permits environmental sublimation at zero heater input and stops after exhaustion', () => {
    const s = smallScenario();
    s.source.initialMassKg = 0.001;
    s.source.enabled = false;
    const passive = createSimulation(s);
    passive.advance(120);
    expect(passive.heaterEnergyJ).toBe(0);
    expect(passive.diagnostics.cumulativeCO2InputKg).toBeGreaterThan(0);
    s.source.enabled = true; s.source.heatGenerationWm3 = 1e5;
    const sim = createSimulation(s);
    sim.advance(120);
    expect(sim.dryIceMassKg).toBe(0);
    const inputAtExhaustion = sim.diagnostics.cumulativeCO2InputKg;
    sim.advance(120);
    expect(sim.diagnostics.cumulativeCO2InputKg).toBe(inputAtExhaustion);
    expect(inputAtExhaustion).toBeCloseTo(s.source.initialMassKg, 10);
  });
  it('converts all remaining solid once into CO₂ with explicit external energy and a replayable event', () => {
    const s = smallScenario();
    s.source.initialMassKg = 0.001;
    s.source.enabled = false;
    s.source.contactConductanceWm2K = 0;
    const sim = createSimulation(s);
    const before = sim.serialize();
    const beforeCO2 = before.arrays.co2.reduce((a, b) => a + b, 0);
    const result = sim.convertRemainingDryIce();
    const after = sim.serialize();
    const afterCO2 = after.arrays.co2.reduce((a, b) => a + b, 0);
    expect(result.dryIceMassKg).toBe(0);
    expect(result.timeSeconds).toBe(0);
    expect(result.diagnostics.status).toBe('running');
    expect(afterCO2 - beforeCO2).toBeCloseTo(s.source.initialMassKg / 0.0440095, 10);
    expect(result.diagnostics.cumulativeCO2InputKg).toBeCloseTo(s.source.initialMassKg, 12);
    expect(result.diagnostics.cumulativeInterventionEnergyJ).toBeGreaterThan(s.source.initialMassKg * 571000);
    expect(Math.abs(result.diagnostics.sourceEnergyResidualJ)).toBeLessThan(1e-6);
    expect(Math.abs(result.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-8);
    expect(after.events).toEqual([{ timeSeconds: 0, type: 'dry-ice-convert-all', value: s.source.initialMassKg,
      externalEnergyJ: result.diagnostics.cumulativeInterventionEnergyJ }]);
    sim.convertRemainingDryIce();
    expect(sim.events.length).toBe(1);
    expect(sim.diagnostics.cumulativeCO2InputKg).toBeCloseTo(s.source.initialMassKg, 12);
    expect(Simulation.restore(after).snapshot().dryIceMassKg).toBe(0);
  });
  it('keeps the conversion visible but pauses before unsupported high-pressure flow', () => {
    const sim = createSimulation(createDefaultScenario());
    const converted = sim.convertRemainingDryIce();
    expect(converted.dryIceMassKg).toBe(0);
    expect(converted.timeSeconds).toBe(0);
    expect(converted.diagnostics.status).toBe('validity-paused');
    expect(Math.max(...converted.fields.pressurePa)).toBeGreaterThan(sim.scenario.model.maxPressurePa);
    expect(converted.diagnostics.warnings.join(' ')).toMatch(/numerical mass-transfer event, not a blast/);
    expect(converted.diagnostics.sourcePressureLoadStatus).toBe('outside-validity');
    expect(converted.diagnostics.sourcePressureLoadN).toBeGreaterThan(0);
    expect(converted.diagnostics.sourceProjectedAreaM2).toBeCloseTo(Math.PI * sim.scenario.source.supportRadiusM ** 2, 12);
    expect(converted.diagnostics.cumulativeCO2InputKg).toBeCloseTo(sim.scenario.source.initialMassKg, 10);
    expect(sim.advance(3600).timeSeconds).toBe(0);
    expect(Simulation.restore(sim.serialize()).diagnostics.status).toBe('validity-paused');
  });
  it('requires oxygen for oxidation while allowing nonoxidative evaporation', () => {
    const s = smallScenario();
    s.source.initialMassKg = 0; s.source.enabled = false;
    s.atmosphere.oxygenMoleFraction = 0;
    s.model.evaporationRateS = 1e-5;
    s.hotRegions[0].shape = 'slab';
    s.hotRegions[0].sizeXM = 3;
    s.hotRegions[0].sizeYM = 3;
    s.hotRegions[0].thicknessM = 1.5;
    const sim = createSimulation(s);
    const fuel0 = sim.snapshot().totalFuelKg;
    sim.advance(60);
    expect(sim.snapshot().totalFuelKg).toBeCloseTo(fuel0, 10);
    expect(sim.diagnostics.cumulativeWaterEvaporatedKg).toBeGreaterThan(0);
  });
  it('conserves each gas species under source-free, closed-domain diffusion', () => {
    const s = quietClosedScenario();
    s.model.maxStepS = 10;
    const initial = createSimulation(s).serialize();
    const cell = 21; const shift = initial.arrays.oxygen[cell] * 0.1;
    initial.arrays.oxygen[cell] += shift;
    initial.arrays.background[cell] -= shift;
    const sim = Simulation.restore(initial);
    const oxygen0 = initial.arrays.oxygen.reduce((a, b) => a + b, 0);
    const total0 = initial.arrays.oxygen[cell];
    sim.advance(10);
    const after = sim.serialize();
    const oxygen1 = after.arrays.oxygen.reduce((a, b) => a + b, 0);
    expect(oxygen1).toBeCloseTo(oxygen0, 10);
    expect(after.arrays.oxygen[cell]).toBeLessThan(total0);
    expect(Math.abs(sim.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-9);
  });
  it('closes the reduced oxidation stoichiometry across fuel, oxygen, CO₂, and vapor', () => {
    const s = smallScenario();
    s.source.initialMassKg = 0; s.source.enabled = false;
    s.atmosphere.topGasBoundary = 'noFlux';
    s.model.evaporationRateS = 0;
    s.model.smolderRateS = 1e-4;
    s.hotRegions[0].shape = 'slab';
    s.hotRegions[0].sizeXM = 3; s.hotRegions[0].sizeYM = 3; s.hotRegions[0].thicknessM = 1.5;
    const sim = createSimulation(s);
    const before = sim.serialize();
    sim.advance(10);
    const after = sim.serialize();
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    const fuelConsumed = sum(before.arrays.fuel) - sum(after.arrays.fuel);
    const oxygenConsumedKg = (sum(before.arrays.oxygen) - sum(after.arrays.oxygen)) * 0.031998;
    const co2ProducedKg = (sum(after.arrays.co2) - sum(before.arrays.co2)) * 0.0440095;
    const vaporProducedKg = (sum(after.arrays.vapor) - sum(before.arrays.vapor)) * 0.01801528;
    expect(fuelConsumed).toBeGreaterThan(0);
    expect(oxygenConsumedKg).toBeCloseTo(fuelConsumed * 192 / 162, 7);
    expect(co2ProducedKg).toBeCloseTo(fuelConsumed * 264 / 162, 7);
    expect(vaporProducedKg).toBeCloseTo(fuelConsumed * 90 / 162, 7);
    expect(oxygenConsumedKg + fuelConsumed).toBeCloseTo(co2ProducedKg + vaporProducedKg, 7);
  });
  it('matches a one-step finite-volume diffusion flux to within 0.2%', () => {
    const s = quietClosedScenario(); s.model.maxStepS = 10;
    const initial = createSimulation(s).serialize();
    const cell = 21; const normalO2 = initial.arrays.oxygen[cell];
    const shift = normalO2 * 0.1;
    initial.arrays.oxygen[cell] += shift; initial.arrays.background[cell] -= shift;
    const beforeX = initial.arrays.oxygen[cell] / (initial.arrays.oxygen[cell] + initial.arrays.co2[cell] + initial.arrays.background[cell] + initial.arrays.vapor[cell]);
    const ambientX = s.atmosphere.oxygenMoleFraction;
    const d = initial.arrays.effectiveDiffusivity[cell];
    const dx = s.domain.widthM / s.domain.nx; const dy = s.domain.lengthM / s.domain.ny; const dz = s.domain.depthM / s.domain.nz;
    const gasConcentration = s.atmosphere.pressurePa / (8.314462618 * (s.atmosphere.temperatureC + 273.15));
    const expectedLossMol = 10 * d * gasConcentration * (beforeX - ambientX)
      * (2 * dy * dz / dx + 2 * dx * dz / dy + 2 * dx * dy / dz);
    const sim = Simulation.restore(initial); sim.advance(10);
    const actualLossMol = initial.arrays.oxygen[cell] - sim.serialize().arrays.oxygen[cell];
    expect(actualLossMol).toBeCloseTo(expectedLossMol, Math.max(6, -Math.floor(Math.log10(expectedLossMol)) + 2));
  });
  it('approaches an analytical insulated-slab heat mode under mesh/time refinement', () => {
    const durationS = 7 * 86400;
    const runMode = (nx: number, maxStepS: number): number => {
      const s = quietClosedScenario();
      s.domain.nx = nx; s.domain.ny = 4; s.domain.nz = 4;
      s.soil.moistureSaturation = 0;
      s.model.maxStepS = maxStepS;
      const initial = createSimulation(s).serialize();
      const L = s.domain.widthM;
      for (let i = 0; i < initial.arrays.temperature.length; i++) {
        const x = i % nx;
        const oldTemperature = initial.arrays.temperature[i];
        const newTemperature = 300 + 50 * Math.cos(Math.PI * (x + 0.5) / nx);
        initial.arrays.temperature[i] = newTemperature;
        const factor = oldTemperature / newTemperature;
        for (const species of ['oxygen', 'co2', 'background', 'vapor']) initial.arrays[species][i] *= factor;
      }
      initial.arrays.__ledger[0] = ['oxygen', 'co2', 'background', 'vapor']
        .reduce((sum, species) => sum + initial.arrays[species].reduce((a, b) => a + b, 0), 0);
      const sim = Simulation.restore(initial);
      const after = sim.advance(durationS);
      expect(after.diagnostics.status).toBe('running');
      const alpha = s.soil.thermalConductivityWmK / (s.soil.bulkDensityKgM3 * s.soil.solidHeatCapacityJKgK);
      const decay = Math.exp(-alpha * (Math.PI / L) ** 2 * durationS);
      let sumError2 = 0;
      for (let i = 0; i < after.fields.temperatureK.length; i++) {
        const x = i % nx;
        const analytic = 300 + 50 * Math.cos(Math.PI * (x + 0.5) / nx) * decay;
        const error = after.fields.temperatureK[i] - analytic;
        sumError2 += error * error;
      }
      return Math.sqrt(sumError2 / after.fields.temperatureK.length);
    };
    const coarseMesh = runMode(8, 3600);
    const fineMesh = runMode(16, 3600);
    const fineTime = runMode(16, 900);
    expect(fineMesh).toBeLessThan(coarseMesh);
    expect(fineTime).toBeLessThan(coarseMesh);
    expect(fineTime).toBeLessThan(0.2); // K RMS, analytic mode with approximate heat capacity
  });
  it('records open-boundary gas balance, finite fields, and no negative inventories', () => {
    const s = smallScenario();
    const sim = createSimulation(s);
    const snapshot = sim.advance(3600);
    expect(snapshot.diagnostics.status).toBe('running');
    expect(everyFinite(snapshot)).toBe(true);
    expect(Math.abs(snapshot.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-6);
    const checkpoint = sim.serialize();
    for (const species of ['oxygen', 'co2', 'background', 'vapor', 'fuel', 'water']) {
      expect(Math.min(...checkpoint.arrays[species])).toBeGreaterThanOrEqual(0);
    }
  });
  it('propagates a permeability edit into gas mobility and pressure', () => {
    const low = smallScenario();
    const high = smallScenario();
    high.soil.intrinsicPermeabilityHorizontalM2 *= 10;
    high.soil.intrinsicPermeabilityVerticalM2 *= 10;
    const lowResult = createSimulation(low).advance(120);
    const highResult = createSimulation(high).advance(120);
    expect(highResult.fields.effectivePermeability[0]).toBeGreaterThan(lowResult.fields.effectivePermeability[0] * 9.9);
    const pressureDifference = Math.max(...lowResult.fields.pressurePa) - Math.max(...highResult.fields.pressurePa);
    expect(pressureDifference).toBeGreaterThan(0);
    expect(lowResult.diagnostics.sourcePressureLoadN).toBeGreaterThan(highResult.diagnostics.sourcePressureLoadN);
  });
  it('uses source-cell gauge pressure times fixed projected support area for the load proxy', () => {
    const s = smallScenario();
    s.source.centerXM = 1.5 * s.domain.widthM / s.domain.nx;
    s.source.centerYM = 1.5 * s.domain.lengthM / s.domain.ny;
    s.source.centerDepthM = 1.5 * s.domain.depthM / s.domain.nz;
    const snap = createSimulation(s).advance(120);
    const centerIndex = (1 * snap.ny + 1) * snap.nx + 1;
    const area = Math.PI * s.source.supportRadiusM ** 2;
    const gauge = Math.max(0, snap.fields.pressurePa[centerIndex] - s.atmosphere.pressurePa);
    expect(snap.diagnostics.sourceProjectedAreaM2).toBeCloseTo(area, 12);
    expect(snap.diagnostics.sourceExcessPressurePa).toBeCloseTo(gauge, 1);
    expect(snap.diagnostics.sourcePressureLoadN).toBeCloseTo(gauge * area, 1);
    expect(snap.diagnostics.sourcePressureLoadStatus).toBe('within-reduced-model');
  });
  it('is reproducible and restarts from a checkpoint', () => {
    const s = smallScenario();
    const run = createSimulation(s); run.advance(1800);
    const checkpoint: SerializedSimulation = run.serialize();
    run.advance(1800);
    const restarted = Simulation.restore(checkpoint); restarted.advance(1800);
    const a = run.serialize(); const b = restarted.serialize();
    expect(b.timeSeconds).toBe(3600);
    for (const key of ['temperature', 'oxygen', 'co2', 'fuel', 'water']) {
      for (let i = 0; i < a.arrays[key].length; i++) expect(b.arrays[key][i]).toBeCloseTo(a.arrays[key][i], 11);
    }
    expect(b.dryIceMassKg).toBeCloseTo(a.dryIceMassKg, 12);
  });
  it('keeps illustration settings outside solver physics', () => {
    const a = smallScenario(); const b = smallScenario();
    b.illustrativeEvent = { triggeredAtS: 120, intensity: 1 };
    const sa = createSimulation(a).advance(600);
    const sb = createSimulation(b).advance(600);
    expect(Array.from(sa.fields.temperatureK)).toEqual(Array.from(sb.fields.temperatureK));
    expect(Array.from(sa.fields.co2)).toEqual(Array.from(sb.fields.co2));
  });
  it('pauses rather than extrapolating pressure beyond the slow-flow regime', () => {
    const s = quietClosedScenario();
    s.source.initialMassKg = 8;
    s.source.enabled = true;
    s.source.contactConductanceWm2K = 0;
    s.source.heatGenerationWm3 = 1e6;
    s.soil.intrinsicPermeabilityHorizontalM2 = 1e-16;
    s.soil.intrinsicPermeabilityVerticalM2 = 1e-16;
    const sim = createSimulation(s);
    sim.advance(3600);
    expect(sim.diagnostics.status).toBe('validity-paused');
    expect(sim.diagnostics.warnings.join(' ')).toMatch(/Pressure|Darcy velocity/);
    expect(sim.timeSeconds).toBeLessThan(3600);
    const accepted = createSimulation(s);
    accepted.advance(sim.timeSeconds);
    const pausedState = sim.serialize();
    const acceptedState = accepted.serialize();
    expect(pausedState.arrays.oxygen).toEqual(acceptedState.arrays.oxygen);
    expect(pausedState.arrays.co2).toEqual(acceptedState.arrays.co2);
    expect(pausedState.arrays.temperature).toEqual(acceptedState.arrays.temperature);
    expect(pausedState.dryIceMassKg).toBe(acceptedState.dryIceMassKg);
    expect(pausedState.heaterEnergyJ).toBe(acceptedState.heaterEnergyJ);
  });
  it('reaches seven simulated days with schedule boundaries, exhaustion, finite values, and bounded checkpoint size', () => {
    const s = quietClosedScenario();
    s.atmosphere.topGasBoundary = 'atmospheric';
    s.source.initialMassKg = 0.005;
    s.source.enabled = true;
    s.source.contactConductanceWm2K = 0;
    s.source.heatGenerationWm3 = 1e5;
    s.source.startTimeS = 86400;
    s.source.durationS = 3600;
    s.model.maxStepS = 900;
    const sim = createSimulation(s);
    const snapshot = sim.advance(7 * 86400);
    expect(snapshot.timeSeconds).toBe(7 * 86400);
    expect(snapshot.diagnostics.status).toBe('running');
    expect(snapshot.dryIceMassKg).toBe(0);
    expect(snapshot.heaterEnergyJ).toBeCloseTo(1e5 * 4 * Math.PI * s.source.supportRadiusM ** 3 / 3 * 3600, 2);
    expect(everyFinite(snapshot)).toBe(true);
    expect(JSON.stringify(sim.serialize()).length).toBeLessThan(100000);
  });
  it('runs a seven-day active smolder/source scenario on a 3D grid', () => {
    const s = createDefaultScenario();
    s.domain.nx = 8; s.domain.ny = 8; s.domain.nz = 6;
    const sim = createSimulation(s);
    const snapshot = sim.advance(7 * 86400);
    expect(snapshot.timeSeconds).toBe(7 * 86400);
    expect(snapshot.diagnostics.status).toBe('running');
    expect(snapshot.diagnostics.cumulativeCO2InputKg).toBeGreaterThan(0);
    expect(snapshot.diagnostics.cumulativeFuelConsumedKg).toBeGreaterThan(0);
    expect(everyFinite(snapshot)).toBe(true);
    expect(Math.abs(snapshot.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-4);
  }, 20000);
  it('keeps the default 12×12×8 scenario numerically valid through its first hour', () => {
    const sim = createSimulation(createDefaultScenario());
    const snapshot = sim.advance(3600);
    expect(snapshot.timeSeconds, snapshot.diagnostics.warnings.join('; ')).toBe(3600);
    expect(snapshot.diagnostics.status).toBe('running');
    expect(snapshot.diagnostics.pressureResidualPa).toBeLessThan(0.05);
    expect(Math.abs(snapshot.diagnostics.gasBalanceResidualMol)).toBeLessThan(1e-5);
    expect(everyFinite(snapshot)).toBe(true);
  }, 20000);
});
