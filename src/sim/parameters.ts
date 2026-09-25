import { createDefaultScenario, diameterFromMass, sourceTopCoverDepthM } from './scenario';
import type { Scenario, SoilConfig } from './types';

export type ParameterStatus = 'implemented reduced model' | 'illustrative only' | 'not modeled';
export interface ParameterEntry {
  path: string;
  name: string;
  symbol: string;
  units: string;
  basis: string;
  range: [number, number] | string;
  defaultValue: number | string | boolean | null;
  source: string;
  dependencies: string[];
  status: ParameterStatus;
}

const defaultScenario = createDefaultScenario();
type EntrySpec = [string, string, string, string, string, [number, number] | string, string[]?, ParameterStatus?];

function defaultAt(path: string): number | string | boolean | null {
  const parts = path.replace('[]', '[0]').replace(/\[(\d+)\]/g, '.$1').split('.');
  let value: unknown = defaultScenario;
  for (const part of parts) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
  if (value === undefined) return null;
  if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  return null;
}

function entries(specs: EntrySpec[], source = 'Demonstration assumption; editable, uncalibrated'): ParameterEntry[] {
  return specs.map(([path, name, symbol, units, basis, range, dependencies = [], status = 'implemented reduced model']) => ({
    path, name, symbol, units, basis, range, defaultValue: defaultAt(path), source, dependencies, status,
  }));
}

export const PARAMETER_REGISTRY: ParameterEntry[] = [
  ...entries([
    ['seed', 'Random seed', 's', 'integer', 'Deterministic geometry/noise seed', [0, 2147483647]],
    ['domain.widthM', 'Surface width', 'Lx', 'm', 'Computational block', [1, 100]],
    ['domain.lengthM', 'Surface length', 'Ly', 'm', 'Computational block', [1, 100]],
    ['domain.depthM', 'Soil depth', 'Lz', 'm', 'Positive below surface', [0.5, 30]],
    ['domain.nx', 'Grid cells x', 'Nx', 'cells', 'Uniform finite-volume grid', [4, 64]],
    ['domain.ny', 'Grid cells y', 'Ny', 'cells', 'Uniform finite-volume grid', [4, 64]],
    ['domain.nz', 'Grid cells depth', 'Nz', 'cells', 'Uniform finite-volume grid', [4, 48]],
  ]),
  ...entries([
    ['soil.sandFraction', 'Sand', 'fsand', 'fraction', 'Dry mineral mass; sand+silt+clay=1', [0, 1], ['soil.siltFraction', 'soil.clayFraction', 'soil.intrinsicPermeabilityHorizontalM2']],
    ['soil.siltFraction', 'Silt', 'fsilt', 'fraction', 'Dry mineral mass; sand+silt+clay=1', [0, 1], ['soil.sandFraction', 'soil.clayFraction', 'soil.intrinsicPermeabilityHorizontalM2']],
    ['soil.clayFraction', 'Clay', 'fclay', 'fraction', 'Dry mineral mass; sand+silt+clay=1', [0, 1], ['soil.sandFraction', 'soil.siltFraction', 'soil.intrinsicPermeabilityHorizontalM2']],
    ['soil.organicFraction', 'Base soil organic fraction', 'forg', 'fraction', 'Dry bulk mass, excluding supplemental roots', [0, 1], ['soil.bulkDensityKgM3']],
    ['soil.bulkDensityKgM3', 'Dry bulk density', 'rho_b', 'kg/m³', 'Dry solids per bulk volume', [50, 2500], ['soil.organicFraction', 'soil.solidHeatCapacityJKgK']],
    ['soil.porosity', 'Porosity', 'phi', 'fraction', 'Pore volume per bulk volume', [0, 1], ['soil.moistureSaturation']],
    ['soil.moistureSaturation', 'Initial saturation', 'Sw', 'fraction', 'Liquid water volume per pore volume', [0, 1], ['soil.porosity']],
    ['soil.thermalConductivityWmK', 'Soil thermal conductivity', 'lambda', 'W/(m·K)', 'Bulk cell, base soil', [0.01, 5]],
    ['soil.solidHeatCapacityJKgK', 'Dry solid specific heat', 'cp,s', 'J/(kg·K)', 'Dry solids', [100, 5000]],
    ['soil.intrinsicPermeabilityHorizontalM2', 'Horizontal intrinsic permeability', 'kh', 'm²', 'Dry base soil before texture/compaction correction', [1e-16, 1e-8], ['soil.compaction', 'soil.sandFraction']],
    ['soil.intrinsicPermeabilityVerticalM2', 'Vertical intrinsic permeability', 'kv', 'm²', 'Dry base soil before texture/compaction correction', [1e-16, 1e-8], ['soil.compaction', 'soil.sandFraction']],
    ['soil.gasDiffusivityM2S', 'Free-gas diffusivity', 'Dg', 'm²/s', 'Base pore gas before porosity/saturation/tortuosity correction', [1e-8, 1e-3]],
    ['soil.tortuosity', 'Tortuosity divisor', 'tau', '1', 'Effective gas diffusion denominator', [1, 20]],
    ['soil.compaction', 'Compaction index', 'Cc', 'fraction', 'Assumed k factor exp(-2 Cc)', [0, 1]],
  ]),
  ...entries([
    ['soilLayers[].id', 'Soil layer identifier', 'idl', 'text', 'Ordered vertical layer object', 'unique text'],
    ['soilLayers[].thicknessM', 'Soil layer thickness', 'hl', 'm', 'Ordered from surface; sum equals soil depth', [0.05, 30], ['domain.depthM']],
    ['soilLayers[].dryDensityMultiplier', 'Layer dry-density multiplier', 'mrho,l', '1', 'Multiplies base dry bulk density', [0.1, 3], ['soil.bulkDensityKgM3']],
    ['soilLayers[].porosityOffset', 'Layer porosity offset', 'dphi,l', 'fraction', 'Added to base porosity', [-0.5, 0.5], ['soil.porosity']],
    ['soilLayers[].moistureSaturationOffset', 'Layer moisture offset', 'dSw,l', 'fraction', 'Added to base initial saturation', [-0.9, 0.9], ['soil.moistureSaturation']],
    ['soilLayers[].permeabilityMultiplier', 'Layer intrinsic-permeability multiplier', 'mk,l', '1', 'Multiplies base horizontal and vertical k', [0.001, 1000], ['soil.intrinsicPermeabilityHorizontalM2', 'soil.intrinsicPermeabilityVerticalM2']],
    ['soilLayers[].thermalConductivityMultiplier', 'Layer thermal-conductivity multiplier', 'mlambda,l', '1', 'Multiplies base thermal conductivity', [0.1, 5], ['soil.thermalConductivityWmK']],
  ]),
  ...entries([
    ['peatRegions[].id', 'Peat region identifier', 'idp', 'text', 'Scenario geometry object', 'unique text'],
    ['peatRegions[].shape', 'Peat shape', 'Sp', 'enum', 'Layer/slab, ellipsoid, or seeded irregular patch', 'ellipsoid | slab | irregular'],
    ['peatRegions[].centerXM', 'Peat center x', 'xp', 'm', 'Surface x coordinate', 'within block'],
    ['peatRegions[].centerYM', 'Peat center y', 'yp', 'm', 'Surface y coordinate', 'within block'],
    ['peatRegions[].centerDepthM', 'Peat center depth', 'zp', 'm', 'Positive below surface', 'within block'],
    ['peatRegions[].sizeXM', 'Peat x size', 'ax', 'm', 'Full horizontal extent', [0.05, 100]],
    ['peatRegions[].sizeYM', 'Peat y size', 'ay', 'm', 'Full horizontal extent', [0.05, 100]],
    ['peatRegions[].thicknessM', 'Peat thickness', 'ap,z', 'm', 'Full vertical extent', [0.05, 30]],
    ['peatRegions[].rotationDeg', 'Peat orientation', 'theta_p', '°', 'Rotation in x-y plane', [-360, 360]],
    ['peatRegions[].organicFraction', 'Peat organic fraction', 'fp,org', 'fraction', 'Dry peat bulk mass', [0, 1]],
    ['peatRegions[].bulkDensityKgM3', 'Peat dry bulk density', 'rho_p', 'kg/m³', 'Dry solids per bulk peat volume', [50, 2500]],
    ['peatRegions[].moistureSaturation', 'Peat initial saturation', 'Sp,w', 'fraction', 'Liquid volume per peat pore volume', [0, 0.95]],
    ['peatRegions[].seed', 'Irregular peat seed', 'sp', 'integer', 'Deterministic cell noise', [0, 2147483647]],
  ]),
  ...entries([
    ['root.amountKgM3', 'Root amount', 'rho_r', 'kg/m³', 'Supplemental dry root fuel per bulk volume at mean depth', [0, 100], ['root.meanDepthM', 'root.distributionDepthM']],
    ['root.meanDepthM', 'Root mean depth', 'zr', 'm', 'Center of exponential root amount distribution', [0, 30]],
    ['root.distributionDepthM', 'Root depth scale', 'lr', 'm', 'Exponential decay length', [0.01, 30]],
    ['root.thicknessM', 'Typical root thickness', 'dr', 'm', 'Visual geometry only; no extra fuel from thickness', [0.001, 0.5], [], 'illustrative only'],
    ['root.seed', 'Root distribution seed', 'sr', 'integer', 'Deterministic cell variation', [0, 2147483647]],
  ]),
  ...entries([
    ['hotRegions[].id', 'Hot region identifier', 'idh', 'text', 'Scenario initial-condition object', 'unique text'],
    ['hotRegions[].shape', 'Initial hot shape', 'Sh', 'enum', 'Ellipsoid or slab', 'ellipsoid | slab'],
    ['hotRegions[].centerXM', 'Hot center x', 'xh', 'm', 'Surface x coordinate', 'within block'],
    ['hotRegions[].centerYM', 'Hot center y', 'yh', 'm', 'Surface y coordinate', 'within block'],
    ['hotRegions[].centerDepthM', 'Hot center depth', 'zh', 'm', 'Positive below surface', 'within block'],
    ['hotRegions[].sizeXM', 'Hot x size', 'hx', 'm', 'Full horizontal extent', [0.05, 100]],
    ['hotRegions[].sizeYM', 'Hot y size', 'hy', 'm', 'Full horizontal extent', [0.05, 100]],
    ['hotRegions[].thicknessM', 'Hot vertical size', 'hz', 'm', 'Full vertical extent', [0.05, 30]],
    ['hotRegions[].temperatureC', 'Initial hot temperature', 'Th,0', '°C', 'Initial field only; never held fixed', [-20, 900]],
    ['hotRegions[].fuelFraction', 'Initial available fuel', 'fh,0', 'fraction', 'Fraction of local dry fuel inventory retained', [0, 1]],
  ]),
  ...entries([
    ['source.centerXM', 'Dry-ice center x', 'xs', 'm', 'Surface x coordinate', 'within block'],
    ['source.centerYM', 'Dry-ice center y', 'ys', 'm', 'Surface y coordinate', 'within block'],
    ['source.centerDepthM', 'Dry-ice center depth', 'zs', 'm', 'Positive below surface; top cover derived from mass/density', 'within block'],
    ['source.densityKgM3', 'Dry-ice density', 'rho_CO2,s', 'kg/m³', 'Assumed homogeneous solid density; linked mass/diameter', [500, 2000]],
    ['source.initialMassKg', 'Initial dry-ice mass', 'm_CO2,0', 'kg', 'Solid inventory; diameter derived', [0, 1000], ['source.densityKgM3']],
    ['source.initialTemperatureK', 'Initial dry-ice temperature', 'Ts,0', 'K', 'Lumped source at/below fixed near-atmospheric sublimation temperature', [150, 194.65]],
    ['source.supportRadiusM', 'Fixed heater support radius', 'rh', 'm', 'Numerical support sphere; unchanged as dry ice shrinks', [0.02, 1]],
    ['source.heatGenerationWm3', 'Volumetric heater generation', "q'''", 'W/m³', 'Fixed heater support volume; total power derived', [0, 1e6], ['source.supportRadiusM']],
    ['source.startTimeS', 'Heater start', 'th,start', 's', 'Physical solver clock', [0, 1e8]],
    ['source.durationS', 'Heater duration', 'th,dur', 's', 'Physical solver clock', [0, 1e8]],
    ['source.enabled', 'Heater enabled', 'H', 'boolean', 'Operational edit recorded as event', 'true | false'],
    ['source.contactConductanceWm2K', 'Source/soil contact conductance', 'hc', 'W/(m²·K)', 'Sphere area times soil/source temperature difference', [0, 100]],
  ]),
  ...entries([
    ['atmosphere.temperatureC', 'Atmospheric temperature', 'Ta', '°C', 'Top heat boundary', [-50, 80]],
    ['atmosphere.deepTemperatureC', 'Deep temperature', 'Tb', '°C', 'Bottom heat boundary', [-50, 80]],
    ['atmosphere.pressurePa', 'Atmospheric pressure', 'Pa', 'Pa', 'Open gas boundary and initial gas pressure', [80000, 150000]],
    ['atmosphere.oxygenMoleFraction', 'Atmospheric oxygen', 'xO2,a', 'mole fraction', 'Dry+humid total gas mixture', [0, 1]],
    ['atmosphere.co2MoleFraction', 'Atmospheric carbon dioxide', 'xCO2,a', 'mole fraction', 'Dry+humid total gas mixture', [0, 1]],
    ['atmosphere.waterVaporMoleFraction', 'Atmospheric water vapor', 'xH2O,a', 'mole fraction', 'Dry+humid total gas mixture', [0, 1]],
    ['atmosphere.exchangeVelocityMS', 'Surface gas exchange speed', 've', 'm/s', 'Mole-fraction exchange at open atmospheric faces', [0, 0.1]],
    ['atmosphere.surfaceHeatTransferWm2K', 'Surface heat-transfer coefficient', 'hs', 'W/(m²·K)', 'Air/soil heat exchange', [0, 100]],
    ['atmosphere.bottomHeatTransferWm2K', 'Bottom heat-transfer coefficient', 'hb', 'W/(m²·K)', 'Deep-ground/soil heat exchange', [0, 100]],
    ['atmosphere.topGasBoundary', 'Top gas boundary', 'BCt', 'enum', 'Atmospheric or no flux', 'atmospheric | noFlux'],
    ['atmosphere.sideGasBoundary', 'Side gas boundary', 'BCs', 'enum', 'Atmospheric or no flux computational truncation', 'atmospheric | noFlux'],
  ]),
  ...entries([
    ['model.smolderRateS', 'Smolder reference rate', 'kr', '1/s', 'First-order dry fuel oxidation at Tref', [0, 1e-2]],
    ['model.referenceTemperatureK', 'Rate reference temperature', 'Tref', 'K', 'Arrhenius rate reference', [300, 1000]],
    ['model.activationEnergyJMol', 'Apparent activation energy', 'Ea', 'J/mol', 'Uncalibrated Arrhenius factor', [0, 200000]],
    ['model.minimumReactionTemperatureK', 'Minimum reaction temperature', 'Tmin,r', 'K', 'Reduced oxidation gate', [273, 1000]],
    ['model.oxygenHalfSaturation', 'Oxygen half-saturation', 'KO2', 'mole fraction', 'O2-dependent oxidation factor', [0.001, 1]],
    ['model.heatOfCombustionJkg', 'Reaction heat', 'Qr', 'J/kg', 'Dry fuel consumed', [0, 5e7]],
    ['model.evaporationRateS', 'Evaporation rate', 'ke', '1/s', 'Liquid water first-order maximum', [0, 1e-2]],
    ['model.evaporationOnsetTemperatureK', 'Evaporation onset', 'Te,on', 'K', 'Linear kinetic ramp start', [273, 500]],
    ['model.boilingTemperatureK', 'Evaporation ramp end', 'Te,boil', 'K', 'Linear kinetic ramp end', [273, 500]],
    ['model.minPressurePa', 'Minimum modeled pressure', 'Pmin', 'Pa', 'Validity guard; cannot be lowered below the supported 80 kPa floor', [80000, 150000], ['atmosphere.pressurePa']],
    ['model.maxPressurePa', 'Maximum modeled pressure', 'Pmax', 'Pa', 'Validity guard; cannot be raised above the supported 150 kPa ceiling', [80000, 150000], ['atmosphere.pressurePa']],
    ['model.maxDarcyVelocityMS', 'Maximum modeled Darcy speed', 'vmax', 'm/s', 'Slow-flow validity guard; cannot exceed 0.02 m/s', [1e-6, 0.02]],
    ['model.maxStepS', 'Maximum solver step', 'dtmax', 's', 'Additional explicit heat/diffusion bound applies', [0.1, 3600]],
  ]),
  ...entries([
    ['pathways[].id', 'Assumed pathway identifier', 'idv', 'text', 'Hypothetical edited geometry object', 'unique text'],
    ['pathways[].centerXM', 'Pathway center x', 'xv', 'm', 'Surface x coordinate', 'within block'],
    ['pathways[].centerYM', 'Pathway center y', 'yv', 'm', 'Surface y coordinate', 'within block'],
    ['pathways[].centerDepthM', 'Pathway center depth', 'zv', 'm', 'Positive below surface', 'within block'],
    ['pathways[].sizeXM', 'Pathway x size', 'vx', 'm', 'Full extent', [0.05, 100]],
    ['pathways[].sizeYM', 'Pathway y size', 'vy', 'm', 'Full extent', [0.05, 100]],
    ['pathways[].thicknessM', 'Pathway vertical extent', 'vz', 'm', 'Full extent', [0.05, 30]],
    ['pathways[].rotationDeg', 'Pathway orientation', 'theta_v', '°', 'Rotation in x-y plane', [-360, 360]],
    ['pathways[].permeabilityMultiplier', 'Assumed pathway k multiplier', 'mk', '1', 'Intrinsic permeability multiplier; no predicted soil failure', [0.01, 1e5]],
  ], 'Explicit hypothetical geometry assumption'),
  ...entries([
    ['illustrativeEvent.triggeredAtS', 'Illustration trigger time', 'ti', 's', 'Visual event clock; does not mutate physics', 'null or nonnegative', [], 'illustrative only'],
    ['illustrativeEvent.intensity', 'Illustration intensity', 'Ii', 'fraction', 'Artistic displacement only', [0, 1], [], 'illustrative only'],
  ], 'Artistic setting, not a physical prediction'),
  {
    path: 'source.initialDiameterM', name: 'Derived initial dry-ice diameter', symbol: 'dCO2,0', units: 'm',
    basis: 'Volume-equivalent sphere; d = (6m / (πρ))^(1/3)', range: [0, 2],
    defaultValue: diameterFromMass(defaultScenario.source.initialMassKg, defaultScenario.source.densityKgM3),
    source: 'Geometric identity; dry-ice density is an assumed input',
    dependencies: ['source.initialMassKg', 'source.densityKgM3'], status: 'implemented reduced model',
  },
  {
    path: 'source.topCoverDepthM', name: 'Derived top-of-sphere cover depth', symbol: 'zcover', units: 'm',
    basis: 'Positive depth; center depth minus half initial diameter', range: [0, 30],
    defaultValue: sourceTopCoverDepthM(defaultScenario), source: 'Geometric identity',
    dependencies: ['source.centerDepthM', 'source.initialMassKg', 'source.densityKgM3'], status: 'implemented reduced model',
  },
  {
    path: 'source.heaterPowerW', name: 'Derived total heater power', symbol: 'Ph', units: 'W',
    basis: 'q\'\'\' × 4π r_support³ / 3 while scheduled and enabled', range: [0, 4.2e6],
    defaultValue: defaultScenario.source.heatGenerationWm3 * 4 * Math.PI * defaultScenario.source.supportRadiusM ** 3 / 3,
    source: 'Fixed support-volume identity; spatial power definition',
    dependencies: ['source.heatGenerationWm3', 'source.supportRadiusM', 'source.enabled', 'source.startTimeS', 'source.durationS'],
    status: 'implemented reduced model',
  },
  {
    path: 'diagnostics.sourceExcessPressurePa', name: 'Source excess pore pressure', symbol: 'dPs', units: 'Pa',
    basis: 'Positive part of trilinear source-weighted cell pressure minus atmospheric pressure', range: 'nonnegative',
    defaultValue: 0, source: 'Derived from reduced ideal-gas storage and Darcy transport; out-of-range values flagged',
    dependencies: ['source.centerXM', 'source.centerYM', 'source.centerDepthM', 'atmosphere.pressurePa'],
    status: 'implemented reduced model',
  },
  {
    path: 'diagnostics.sourceProjectedAreaM2', name: 'Assumed source support projected area', symbol: 'As', units: 'm²',
    basis: 'Fixed imaginary plane area π × supportRadius²; not a coherent soil failure surface', range: 'positive',
    defaultValue: Math.PI * defaultScenario.source.supportRadiusM ** 2,
    source: 'Geometric identity applied to fixed numerical support radius', dependencies: ['source.supportRadiusM'],
    status: 'implemented reduced model',
  },
  {
    path: 'diagnostics.sourcePressureLoadN', name: 'Pressure-area load proxy', symbol: 'Fs,proxy', units: 'N',
    basis: 'Source excess pressure × fixed projected support area; no soil failure or blast mechanics', range: 'nonnegative',
    defaultValue: 0, source: 'Algebraic diagnostic from reduced pressure field; invalid-range arithmetic flagged',
    dependencies: ['diagnostics.sourceExcessPressurePa', 'diagnostics.sourceProjectedAreaM2'],
    status: 'implemented reduced model',
  },
  {
    path: 'fastEvent.durationS', name: 'Short-event physical duration', symbol: 'te', units: 's',
    basis: 'Independent event clock, bounded separately from multiday solver time', range: [0.1, 2],
    defaultValue: 2, source: 'User-selectable numerical run setting', dependencies: [],
    status: 'implemented reduced model',
  },
  {
    path: 'fastEvent.frameCount', name: 'Short-event recorded frame count', symbol: 'Ne', units: 'frames',
    basis: 'Output sampling including initial and final states; internal step remains <=0.001 s', range: [2, 100],
    defaultValue: 61, source: 'User-selectable output setting', dependencies: ['fastEvent.durationS'],
    status: 'implemented reduced model',
  },
  {
    path: 'fastEvent.playbackRate', name: 'Short-event playback rate', symbol: 'rplay,e', units: '×',
    basis: 'Wall-clock playback of recorded frames only; does not change physical integration', range: [0.1, 4],
    defaultValue: 1, source: 'Visual playback setting', dependencies: ['fastEvent.frameCount'],
    status: 'illustrative only',
  },
  {
    path: 'fastEvent.overlay', name: 'Short-event display overlay', symbol: 'Oe', units: 'enum',
    basis: 'Selects shell pressure, CO₂ mole fraction, or illustrative damage colors',
    range: 'pressure | co2 | damage', defaultValue: 'pressure', source: 'Visual display setting',
    dependencies: [], status: 'illustrative only',
  },
];

/** Demonstration texture presets change both composition and modeled properties. */
export const SOIL_PRESETS: Record<'sandy' | 'silty' | 'clayey' | 'organic', SoilConfig> = {
  sandy: { ...defaultScenario.soil, sandFraction: 0.8, siltFraction: 0.15, clayFraction: 0.05,
    bulkDensityKgM3: 1450, porosity: 0.39, moistureSaturation: 0.22,
    thermalConductivityWmK: 0.8, intrinsicPermeabilityHorizontalM2: 1e-10,
    intrinsicPermeabilityVerticalM2: 3e-11 },
  silty: { ...defaultScenario.soil, sandFraction: 0.2, siltFraction: 0.7, clayFraction: 0.1,
    bulkDensityKgM3: 1250, porosity: 0.46, moistureSaturation: 0.42,
    thermalConductivityWmK: 0.6, intrinsicPermeabilityHorizontalM2: 2e-11,
    intrinsicPermeabilityVerticalM2: 6e-12 },
  clayey: { ...defaultScenario.soil, sandFraction: 0.15, siltFraction: 0.2, clayFraction: 0.65,
    bulkDensityKgM3: 1350, porosity: 0.48, moistureSaturation: 0.65,
    thermalConductivityWmK: 0.9, intrinsicPermeabilityHorizontalM2: 2e-12,
    intrinsicPermeabilityVerticalM2: 5e-13 },
  organic: { ...defaultScenario.soil, sandFraction: 0.3, siltFraction: 0.5, clayFraction: 0.2,
    organicFraction: 0.35, bulkDensityKgM3: 550, porosity: 0.72, moistureSaturation: 0.58,
    thermalConductivityWmK: 0.35, intrinsicPermeabilityHorizontalM2: 5e-11,
    intrinsicPermeabilityVerticalM2: 1e-11 },
};

export function applySoilPreset(scenario: Scenario, preset: keyof typeof SOIL_PRESETS): Scenario {
  const next = JSON.parse(JSON.stringify(scenario)) as Scenario;
  next.soil = { ...SOIL_PRESETS[preset] };
  next.provenance.soil = 'assumed';
  return next;
}
