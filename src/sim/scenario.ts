import { DEFAULT_MATERIALS, resolveMaterials, validateMaterials, peatPorosity } from './materials';
import type { Scenario, ValidationResult } from './types';

export const SCHEMA_VERSION = 1 as const;
export const MODEL_ID = 'zombie-reduced-porous-v0.1' as const;
export const FT_TO_M = 0.3048;
export const M_TO_FT = 1 / FT_TO_M;
export const CELSIUS_OFFSET = 273.15;

export const feetToMeters = (feet: number): number => feet * FT_TO_M;
export const metersToFeet = (meters: number): number => meters * M_TO_FT;
export const celsiusToKelvin = (celsius: number): number => celsius + CELSIUS_OFFSET;
export const kelvinToCelsius = (kelvin: number): number => kelvin - CELSIUS_OFFSET;

export function massFromDiameter(diameterM: number, densityKgM3: number): number {
  if (!Number.isFinite(diameterM) || diameterM < 0 || !Number.isFinite(densityKgM3) || densityKgM3 <= 0) {
    throw new Error('Diameter must be nonnegative and density must be positive.');
  }
  return densityKgM3 * Math.PI * diameterM ** 3 / 6;
}

export function diameterFromMass(massKg: number, densityKgM3: number): number {
  if (!Number.isFinite(massKg) || massKg < 0 || !Number.isFinite(densityKgM3) || densityKgM3 <= 0) {
    throw new Error('Mass must be nonnegative and density must be positive.');
  }
  return Math.cbrt(6 * massKg / (Math.PI * densityKgM3));
}

export function sourceTopCoverDepthM(scenario: Scenario): number {
  return scenario.source.centerDepthM - diameterFromMass(scenario.source.initialMassKg, scenario.source.densityKgM3) / 2;
}

export function normalizeMineralFractions(sand: number, silt: number, clay: number): [number, number, number] {
  if (![sand, silt, clay].every(v => Number.isFinite(v) && v >= 0)) {
    throw new Error('Mineral mass fractions must be finite and nonnegative.');
  }
  const total = sand + silt + clay;
  if (total <= 0) throw new Error('At least one mineral fraction must be positive.');
  return [sand / total, silt / total, clay / total];
}

function cloneScenario(scenario: Scenario): Scenario {
  return JSON.parse(JSON.stringify(scenario)) as Scenario;
}

const DEFAULT: Scenario = {
  materialProperties: { ...DEFAULT_MATERIALS },
  schemaVersion: SCHEMA_VERSION,
  modelId: MODEL_ID,
  unitMetadata: {
    system: 'SI', coordinates: 'x-y-horizontal-depth-positive-down',
    temperature: 'K-in-solver-C-for-configured-ambient-and-hot-regions',
    gasComposition: 'mole-fraction', gasInventory: 'mol-per-cell',
    solidLiquidInventory: 'kg-per-cell',
  },
  name: 'Heated buried dry ice (demonstration)',
  description: 'Open atmospheric surface, buried peat and one initial hot region. Values are demonstration assumptions, not site measurements.',
  seed: 20260925,
  provenance: {
    'domain.widthM': 'assumed',
    'domain.lengthM': 'assumed',
    'source.densityKgM3': 'assumed',
    'source.initialMassKg': 'assumed',
    'source.heatGenerationWm3': 'assumed',
    'soil': 'assumed',
    'peatRegions': 'assumed',
    'hotRegions': 'assumed',
    'model': 'assumed',
  },
  domain: { widthM: 6.096, lengthM: 6.096, depthM: 3, nx: 12, ny: 12, nz: 8 },
  soil: {
    sandFraction: 0.5,
    siltFraction: 0.35,
    clayFraction: 0.15,
    organicFraction: 0.03,
    bulkDensityKgM3: 1250,
    porosity: 0.45,
    moistureSaturation: 0.35,
    thermalConductivityWmK: 0.65,
    solidHeatCapacityJKgK: 850,
    intrinsicPermeabilityHorizontalM2: 3e-11,
    intrinsicPermeabilityVerticalM2: 8e-12,
    gasDiffusivityM2S: 1.6e-5,
    tortuosity: 3,
    compaction: 0.1,
  },
  soilLayers: [
    { id: 'surface-soil', thicknessM: 0.8, dryDensityMultiplier: 0.9, porosityOffset: 0.03,
      moistureSaturationOffset: -0.05, permeabilityMultiplier: 1.5, thermalConductivityMultiplier: 0.8 },
    { id: 'deep-soil', thicknessM: 2.2, dryDensityMultiplier: 1, porosityOffset: 0,
      moistureSaturationOffset: 0, permeabilityMultiplier: 1, thermalConductivityMultiplier: 1 },
  ],
  peatRegions: [{
    id: 'peat-1', shape: 'ellipsoid', centerXM: 3, centerYM: 3, centerDepthM: 1.55,
    sizeXM: 2.4, sizeYM: 2.2, thicknessM: 1.05, rotationDeg: 20,
    organicFraction: 0.75, bulkDensityKgM3: 300, moistureSaturation: 0.20, seed: 17,
  }],
  root: { amountKgM3: 1.5, meanDepthM: 0.45, distributionDepthM: 0.45, thicknessM: 0.015, seed: 4103 },
  hotRegions: [{
    id: 'hot-1', shape: 'ellipsoid', centerXM: 2.8, centerYM: 3.0, centerDepthM: 1.55,
    sizeXM: 1.6, sizeYM: 1.4, thicknessM: 0.8, temperatureC: 270, fuelFraction: 1,
  }],
  source: {
    centerXM: 3.45, centerYM: 3.05, centerDepthM: 1.35,
    densityKgM3: 1560, initialMassKg: 4,
    initialTemperatureK: 194.65, supportRadiusM: 0.12,
    heatGenerationWm3: 2500, startTimeS: 0, durationS: 86400,
    enabled: true, contactConductanceWm2K: 1.5,
  },
  atmosphere: {
    temperatureC: 10, deepTemperatureC: 8, pressurePa: 101325,
    oxygenMoleFraction: 0.2095, co2MoleFraction: 0.00042, waterVaporMoleFraction: 0.01,
    exchangeVelocityMS: 0.000005, surfaceHeatTransferWm2K: 4,
    bottomHeatTransferWm2K: 0.5, topGasBoundary: 'atmospheric', sideGasBoundary: 'noFlux',
  },
  model: {
    smolderRateS: 2e-6, referenceTemperatureK: 550,
    activationEnergyJMol: 35000, minimumReactionTemperatureK: 390,
    oxygenHalfSaturation: 0.06, heatOfCombustionJkg: 15e6,
    evaporationRateS: 1e-6, evaporationOnsetTemperatureK: 310,
    boilingTemperatureK: 373.15, minPressurePa: 80000, maxPressurePa: 150000,
    maxDarcyVelocityMS: 0.02, maxStepS: 120,
  },
  pathways: [],
  illustrativeEvent: { triggeredAtS: null, intensity: 0.5 },
};

export function createDefaultScenario(): Scenario { return cloneScenario(DEFAULT); }

function withChanges(name: string, description: string, change: (s: Scenario) => void): Scenario {
  const scenario = createDefaultScenario();
  scenario.name = name;
  scenario.description = description;
  change(scenario);
  return scenario;
}

export const SCENARIOS: Record<string, Scenario> = {
  untreated: withChanges('Untreated smoldering', 'Same initial hot peat, no dry ice or heater.', s => {
    s.source.initialMassKg = 0;
    s.source.enabled = false;
  }),
  dryIceOnly: withChanges('Buried dry ice, heater off', 'Thermal contact may still sublimate dry ice; no heater energy is supplied.', s => {
    s.source.enabled = false;
  }),
  heatedDryIce: createDefaultScenario(),
  wetLowPermeability: withChanges('Wet, low permeability', 'Assumed wetter ground and lower intrinsic permeability; same initial hot region.', s => {
    s.soil.moistureSaturation = 0.7;
    s.soil.intrinsicPermeabilityHorizontalM2 = 5e-12;
    s.soil.intrinsicPermeabilityVerticalM2 = 1e-12;
    s.peatRegions[0].moistureSaturation = 0.75;
  }),
  hypotheticalPathway: withChanges('Hypothetical edited pathway', 'Assumed post-rearrangement pathway geometry, not predicted soil failure.', s => {
    s.pathways = [{
      id: 'assumed-path-1', centerXM: 3.2, centerYM: 3.05, centerDepthM: 0.95,
      sizeXM: 0.4, sizeYM: 0.35, thicknessM: 1.7, rotationDeg: 0,
      permeabilityMultiplier: 80,
    }];
  }),
};

export const EXAMPLE_SCENARIOS = Object.values(SCENARIOS).map(cloneScenario);

export function validateScenario(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['Scenario must be an object.'], warnings };
  const s = raw as Partial<Scenario>;
  errors.push(...validateMaterials(s.materialProperties));
  if (s.researchSelection !== undefined) {
    const selection = s.researchSelection;
    if (!selection || typeof selection !== 'object' || typeof selection.id !== 'string'
      || typeof selection.target !== 'string' || !/^(soil|peat:\d+)$/.test(selection.target)
      || !Array.isArray(selection.sourceIds) || !selection.sourceIds.every(id => typeof id === 'string')
      || !selection.appliedValues || typeof selection.appliedValues !== 'object' || Array.isArray(selection.appliedValues)
      || !Object.values(selection.appliedValues).every(v => typeof v === 'number' && Number.isFinite(v))
      || (selection.propertyNotes !== undefined && (!selection.propertyNotes || typeof selection.propertyNotes !== 'object'
        || Array.isArray(selection.propertyNotes) || !Object.values(selection.propertyNotes).every(v => typeof v === 'string'))))
      errors.push('Invalid research profile metadata.');
  }
  if (s.schemaVersion !== 1) errors.push('Unsupported schemaVersion; expected 1.');
  if (s.modelId !== MODEL_ID) errors.push(`Unsupported modelId; expected ${MODEL_ID}.`);
  if (!s.unitMetadata || s.unitMetadata.system !== 'SI' || s.unitMetadata.coordinates !== 'x-y-horizontal-depth-positive-down'
    || s.unitMetadata.gasComposition !== 'mole-fraction' || s.unitMetadata.gasInventory !== 'mol-per-cell'
    || s.unitMetadata.solidLiquidInventory !== 'kg-per-cell') errors.push('Unsupported or missing unit metadata.');
  if (!s.domain || !s.soil || !s.source || !s.atmosphere || !s.model || !s.root || !Array.isArray(s.soilLayers) || !Array.isArray(s.peatRegions) || !Array.isArray(s.hotRegions) || !Array.isArray(s.pathways)) {
    errors.push('Missing required domain, soil, soilLayers, source, atmosphere, model, root, or region data.');
    return { valid: false, errors, warnings };
  }
  const d = s.domain; const soil = s.soil; const source = s.source; const atmosphere = s.atmosphere; const model = s.model;
  const check = (label: string, value: number, min: number, max: number) => {
    if (!Number.isFinite(value) || value < min || value > max) errors.push(`${label} must be within [${min}, ${max}].`);
  };
  check('widthM', d.widthM, 1, 100); check('lengthM', d.lengthM, 1, 100); check('depthM', d.depthM, 0.5, 30);
  if (!Number.isInteger(s.seed)) errors.push('Scenario seed must be an integer.');
  if (typeof s.name !== 'string' || s.name.trim().length === 0) errors.push('Scenario name is required.');
  if (typeof s.description !== 'string') errors.push('Scenario description must be text.');
  if (!s.provenance || typeof s.provenance !== 'object') errors.push('Scenario provenance is required.');
  check('nx', d.nx, 4, 64); check('ny', d.ny, 4, 64); check('nz', d.nz, 4, 48);
  if (![d.nx, d.ny, d.nz].every(Number.isInteger)) errors.push('Grid dimensions must be integers.');
  if (d.nx * d.ny * d.nz > 131072) errors.push('Grid exceeds the 131,072-cell browser limit.');
  for (const [label, value] of Object.entries({
    sandFraction: soil.sandFraction, siltFraction: soil.siltFraction, clayFraction: soil.clayFraction,
    organicFraction: soil.organicFraction, porosity: soil.porosity, moistureSaturation: soil.moistureSaturation,
    compaction: soil.compaction,
  })) check(label, value, 0, 1);
  if (Math.abs(soil.sandFraction + soil.siltFraction + soil.clayFraction - 1) > 1e-6) errors.push('Sand, silt, and clay fractions of mineral dry mass must sum to 1.');
  check('soil.bulkDensityKgM3', soil.bulkDensityKgM3, 50, 2500);
  check('soil.thermalConductivityWmK', soil.thermalConductivityWmK, 0.01, 5);
  check('soil.solidHeatCapacityJKgK', soil.solidHeatCapacityJKgK, 100, 5000);
  check('soil.intrinsicPermeabilityHorizontalM2', soil.intrinsicPermeabilityHorizontalM2, 1e-16, 1e-8);
  check('soil.intrinsicPermeabilityVerticalM2', soil.intrinsicPermeabilityVerticalM2, 1e-16, 1e-8);
  check('soil.gasDiffusivityM2S', soil.gasDiffusivityM2S, 1e-8, 1e-3);
  check('soil.tortuosity', soil.tortuosity, 1, 20);
  if (s.soilLayers.length === 0) errors.push('At least one soil layer is required.');
  let totalLayerThickness = 0;
  const layerIds = new Set<string>();
  for (const layer of s.soilLayers) {
    if (!layer || typeof layer !== 'object') { errors.push('soilLayers items must be objects.'); continue; }
    if (typeof layer.id !== 'string' || !layer.id || layerIds.has(layer.id)) errors.push('Soil layer ids must be unique nonempty text.');
    layerIds.add(layer.id);
    check(`${layer.id}.thicknessM`, layer.thicknessM, 0.05, d.depthM);
    check(`${layer.id}.dryDensityMultiplier`, layer.dryDensityMultiplier, 0.1, 3);
    check(`${layer.id}.porosityOffset`, layer.porosityOffset, -0.5, 0.5);
    check(`${layer.id}.moistureSaturationOffset`, layer.moistureSaturationOffset, -0.9, 0.9);
    check(`${layer.id}.permeabilityMultiplier`, layer.permeabilityMultiplier, 0.001, 1000);
    check(`${layer.id}.thermalConductivityMultiplier`, layer.thermalConductivityMultiplier, 0.1, 5);
    totalLayerThickness += layer.thicknessM;
    if (soil.porosity + layer.porosityOffset <= 0.05 || soil.porosity + layer.porosityOffset >= 0.95) errors.push(`${layer.id} yields porosity outside (0.05, 0.95).`);
    if (soil.moistureSaturation + layer.moistureSaturationOffset < 0 || soil.moistureSaturation + layer.moistureSaturationOffset > 0.95) errors.push(`${layer.id} yields moisture saturation outside [0, 0.95].`);
  }
  if (Number.isFinite(totalLayerThickness) && Math.abs(totalLayerThickness - d.depthM) > 1e-6) errors.push('Soil layer thicknesses must sum to soil depth.');
  check('source.initialMassKg', source.initialMassKg, 0, 1000);
  check('source.densityKgM3', source.densityKgM3, 500, 2000);
  check('source.supportRadiusM', source.supportRadiusM, 0.02, 1);
  check('source.heatGenerationWm3', source.heatGenerationWm3, 0, 1e6);
  check('source.startTimeS', source.startTimeS, 0, 1e8);
  check('source.durationS', source.durationS, 0, 1e8);
  check('source.initialTemperatureK', source.initialTemperatureK, 150, resolveMaterials(s as Scenario).co2SublimationK);
  check('source.contactConductanceWm2K', source.contactConductanceWm2K, 0, 100);
  if (typeof source.enabled !== 'boolean') errors.push('source.enabled must be boolean.');
  for (const [label, value, limit] of [
    ['source.centerXM', source.centerXM, d.widthM],
    ['source.centerYM', source.centerYM, d.lengthM],
    ['source.centerDepthM', source.centerDepthM, d.depthM],
  ] as const) check(label, value, 0, limit);
  check('atmosphere.temperatureC', atmosphere.temperatureC, -50, 80);
  check('atmosphere.deepTemperatureC', atmosphere.deepTemperatureC, -50, 80);
  check('atmosphere.pressurePa', atmosphere.pressurePa, 80000, 150000);
  check('atmosphere.oxygenMoleFraction', atmosphere.oxygenMoleFraction, 0, 1);
  check('atmosphere.co2MoleFraction', atmosphere.co2MoleFraction, 0, 1);
  check('atmosphere.waterVaporMoleFraction', atmosphere.waterVaporMoleFraction, 0, 1);
  if (atmosphere.oxygenMoleFraction + atmosphere.co2MoleFraction + atmosphere.waterVaporMoleFraction > 1) errors.push('Atmospheric gas mole fractions exceed one.');
  check('atmosphere.exchangeVelocityMS', atmosphere.exchangeVelocityMS, 0, 0.1);
  check('atmosphere.surfaceHeatTransferWm2K', atmosphere.surfaceHeatTransferWm2K, 0, 100);
  check('atmosphere.bottomHeatTransferWm2K', atmosphere.bottomHeatTransferWm2K, 0, 100);
  if (!['noFlux', 'atmospheric'].includes(atmosphere.sideGasBoundary)) errors.push('Unsupported side gas boundary.');
  if (!['noFlux', 'atmospheric'].includes(atmosphere.topGasBoundary)) errors.push('Unsupported top gas boundary.');
  check('model.smolderRateS', model.smolderRateS, 0, 1e-2);
  check('model.referenceTemperatureK', model.referenceTemperatureK, 300, 1000);
  check('model.activationEnergyJMol', model.activationEnergyJMol, 0, 200000);
  check('model.minimumReactionTemperatureK', model.minimumReactionTemperatureK, 273, 1000);
  check('model.oxygenHalfSaturation', model.oxygenHalfSaturation, 0.001, 1);
  check('model.heatOfCombustionJkg', model.heatOfCombustionJkg, 0, 5e7);
  check('model.evaporationRateS', model.evaporationRateS, 0, 1e-2);
  check('model.evaporationOnsetTemperatureK', model.evaporationOnsetTemperatureK, 273, 500);
  check('model.boilingTemperatureK', model.boilingTemperatureK, 273, 500);
  if (model.boilingTemperatureK <= model.evaporationOnsetTemperatureK) errors.push('Evaporation boiling threshold must exceed onset temperature.');
  check('model.maxStepS', model.maxStepS, 0.1, 3600);
  check('model.minPressurePa', model.minPressurePa, 80000, atmosphere.pressurePa);
  check('model.maxPressurePa', model.maxPressurePa, atmosphere.pressurePa, 150000);
  check('model.maxDarcyVelocityMS', model.maxDarcyVelocityMS, 1e-6, 0.02);
  check('root.amountKgM3', s.root.amountKgM3, 0, 100);
  check('root.meanDepthM', s.root.meanDepthM, 0, d.depthM);
  check('root.distributionDepthM', s.root.distributionDepthM, 0.01, d.depthM);
  check('root.thicknessM', s.root.thicknessM, 0.001, 0.5);
  if (!Number.isInteger(s.root.seed)) errors.push('Root seed must be an integer.');
  const inside = (label: string, x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
    if (![x, y, z, rx, ry, rz].every(Number.isFinite) || rx < 0 || ry < 0 || rz < 0
      || x - rx < 0 || x + rx > d.widthM || y - ry < 0 || y + ry > d.lengthM || z - rz < 0 || z + rz > d.depthM) errors.push(`${label} has invalid geometry or extends outside the computational soil block.`);
  };
  inside('Source center', source.centerXM, source.centerYM, source.centerDepthM, 0, 0, 0);
  if (source.initialMassKg > 0) {
    const r = diameterFromMass(source.initialMassKg, source.densityKgM3) / 2;
    inside('Dry-ice sphere', source.centerXM, source.centerYM, source.centerDepthM, r, r, r);
  }
  for (const region of s.peatRegions) {
    if (!region || typeof region !== 'object') { errors.push('Peat region must be an object.'); continue; }
    const phi = peatPorosity(region.bulkDensityKgM3, region.organicFraction, resolveMaterials(s as Scenario), !s.materialProperties);
    if (!Number.isFinite(phi) || phi <= 0.05 || phi >= 0.95) errors.push(`${region.id}: density and composition must yield porosity within (0.05, 0.95).`);
    if (typeof region.id !== 'string' || !region.id) errors.push('Peat region id is required.');
    check(`${region.id}.organicFraction`, region.organicFraction, 0, 1);
    check(`${region.id}.bulkDensityKgM3`, region.bulkDensityKgM3, 50, 2500);
    check(`${region.id}.moistureSaturation`, region.moistureSaturation, 0, 0.95);
    check(`${region.id}.sizeXM`, region.sizeXM, 0.05, d.widthM);
    check(`${region.id}.sizeYM`, region.sizeYM, 0.05, d.lengthM);
    check(`${region.id}.thicknessM`, region.thicknessM, 0.05, d.depthM);
    check(`${region.id}.rotationDeg`, region.rotationDeg, -360, 360);
    if (!Number.isInteger(region.seed)) errors.push(`${region.id}.seed must be an integer.`);
    if (!['ellipsoid', 'slab', 'irregular'].includes(region.shape)) errors.push(`Unsupported peat shape ${region.shape}.`);
    inside(`Peat region ${region.id}`, region.centerXM, region.centerYM, region.centerDepthM, Math.max(region.sizeXM, region.sizeYM) / 2, Math.max(region.sizeXM, region.sizeYM) / 2, region.thicknessM / 2);
  }
  for (const hot of s.hotRegions) {
    if (!hot || typeof hot !== 'object') { errors.push('hotRegions items must be objects.'); continue; }
    if (typeof hot.id !== 'string' || !hot.id) errors.push('Hot region id is required.');
    check(`${hot.id}.fuelFraction`, hot.fuelFraction, 0, 1);
    check(`${hot.id}.temperatureC`, hot.temperatureC, -20, 900);
    check(`${hot.id}.sizeXM`, hot.sizeXM, 0.05, d.widthM);
    check(`${hot.id}.sizeYM`, hot.sizeYM, 0.05, d.lengthM);
    check(`${hot.id}.thicknessM`, hot.thicknessM, 0.05, d.depthM);
    if (!['ellipsoid', 'slab'].includes(hot.shape)) errors.push(`Unsupported hot-region shape ${hot.shape}.`);
    inside(`Hot region ${hot.id}`, hot.centerXM, hot.centerYM, hot.centerDepthM, Math.max(hot.sizeXM, hot.sizeYM) / 2, Math.max(hot.sizeXM, hot.sizeYM) / 2, hot.thicknessM / 2);
  }
  for (const path of s.pathways) {
    if (!path || typeof path !== 'object') { errors.push('pathways items must be objects.'); continue; }
    if (typeof path.id !== 'string' || !path.id) errors.push('Pathway id is required.');
    check(`${path.id}.permeabilityMultiplier`, path.permeabilityMultiplier, 0.01, 1e5);
    check(`${path.id}.sizeXM`, path.sizeXM, 0.05, d.widthM);
    check(`${path.id}.sizeYM`, path.sizeYM, 0.05, d.lengthM);
    check(`${path.id}.thicknessM`, path.thicknessM, 0.05, d.depthM);
    check(`${path.id}.rotationDeg`, path.rotationDeg, -360, 360);
    inside(`Pathway ${path.id}`, path.centerXM, path.centerYM, path.centerDepthM, Math.max(path.sizeXM, path.sizeYM) / 2, Math.max(path.sizeXM, path.sizeYM) / 2, path.thicknessM / 2);
  }
  if (s.illustrativeEvent && (s.illustrativeEvent.triggeredAtS !== null && (!Number.isFinite(s.illustrativeEvent.triggeredAtS) || s.illustrativeEvent.triggeredAtS < 0))) errors.push('Invalid illustrative event time.');
  if (s.illustrativeEvent) check('illustrativeEvent.intensity', s.illustrativeEvent.intensity, 0, 1);
  if (d.nx * d.ny * d.nz > 10000) warnings.push('Large grid may run slowly in a browser worker.');
  return { valid: errors.length === 0, errors, warnings };
}

export function scenarioFromJSON(json: string): Scenario {
  const raw: unknown = JSON.parse(json);
  const result = validateScenario(raw);
  if (!result.valid) throw new Error(`Invalid scenario: ${result.errors.join(' ')}`);
  return cloneScenario(raw as Scenario);
}

export function scenarioToJSON(scenario: Scenario): string {
  const result = validateScenario(scenario);
  if (!result.valid) throw new Error(`Invalid scenario: ${result.errors.join(' ')}`);
  return JSON.stringify(scenario, null, 2);
}
