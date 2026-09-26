import type { ResearchSelection } from './researchProfiles'
import type { MaterialProperties } from './materials'
/** All distances are metres. x/y lie along the surface; depth is positive downward. */
export type PeatShape = 'ellipsoid' | 'slab' | 'irregular';

export interface DomainConfig {
  widthM: number;
  lengthM: number;
  depthM: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface SoilConfig {
  /** Dry mineral particle mass fractions; must sum to one. */
  sandFraction: number;
  siltFraction: number;
  clayFraction: number;
  /** Organic dry mass / total dry bulk mass. */
  organicFraction: number;
  bulkDensityKgM3: number;
  /** Pore volume / bulk cell volume. */
  porosity: number;
  /** Initial liquid water volume / pore volume. */
  moistureSaturation: number;
  thermalConductivityWmK: number;
  solidHeatCapacityJKgK: number;
  intrinsicPermeabilityHorizontalM2: number;
  intrinsicPermeabilityVerticalM2: number;
  gasDiffusivityM2S: number;
  tortuosity: number;
  /** 0 to 1. Demonstration property modifier: k *= exp(-2 compaction). */
  compaction: number;
}

/** Vertical material adjustments to the base soil. Thicknesses sum to domain depth. */
export interface SoilLayer {
  id: string;
  thicknessM: number;
  dryDensityMultiplier: number;
  porosityOffset: number;
  moistureSaturationOffset: number;
  permeabilityMultiplier: number;
  thermalConductivityMultiplier: number;
}

export interface PeatRegion {
  id: string;
  shape: PeatShape;
  centerXM: number;
  centerYM: number;
  centerDepthM: number;
  sizeXM: number;
  sizeYM: number;
  thicknessM: number;
  rotationDeg: number;
  organicFraction: number;
  bulkDensityKgM3: number;
  moistureSaturation: number;
  seed: number;
}

export interface RootConfig {
  /** Supplemental dry root fuel mass / bulk soil volume at the surface. */
  amountKgM3: number;
  meanDepthM: number;
  distributionDepthM: number;
  thicknessM: number;
  seed: number;
}

export interface HotRegion {
  id: string;
  shape: 'ellipsoid' | 'slab';
  centerXM: number;
  centerYM: number;
  centerDepthM: number;
  sizeXM: number;
  sizeYM: number;
  thicknessM: number;
  temperatureC: number;
  /** Initially available fraction of the local dry combustible inventory. */
  fuelFraction: number;
}

export interface SourceConfig {
  centerXM: number;
  centerYM: number;
  centerDepthM: number;
  densityKgM3: number;
  initialMassKg: number;
  initialTemperatureK: number;
  /** Fixed numerical support radius, independent of the shrinking dry ice. */
  supportRadiusM: number;
  /** Principal heater input, q''' in W/m³ of fixed support volume. */
  heatGenerationWm3: number;
  startTimeS: number;
  durationS: number;
  enabled: boolean;
  /** Conductance per sphere area between dry ice and nearby soil, W/m²/K. */
  contactConductanceWm2K: number;
}

export interface AtmosphereConfig {
  temperatureC: number;
  deepTemperatureC: number;
  pressurePa: number;
  oxygenMoleFraction: number;
  co2MoleFraction: number;
  waterVaporMoleFraction: number;
  /** Gas composition exchange through the open top, in m/s. */
  exchangeVelocityMS: number;
  surfaceHeatTransferWm2K: number;
  bottomHeatTransferWm2K: number;
  topGasBoundary: 'atmospheric' | 'noFlux';
  /** Side edges are computational boundaries, not physical walls. */
  sideGasBoundary: 'noFlux' | 'atmospheric';
}

export interface ModelConfig {
  /** Fuel first-order reference rate at referenceTemperatureK, 1/s. */
  smolderRateS: number;
  referenceTemperatureK: number;
  activationEnergyJMol: number;
  /** Reaction is zero at and below this temperature. */
  minimumReactionTemperatureK: number;
  oxygenHalfSaturation: number;
  heatOfCombustionJkg: number;
  /** Liquid water evaporation: first-order max at >= boilingTemperatureK. */
  evaporationRateS: number;
  evaporationOnsetTemperatureK: number;
  boilingTemperatureK: number;
  maxPressurePa: number;
  minPressurePa: number;
  maxDarcyVelocityMS: number;
  /** Upper bound for one physical solver step. */
  maxStepS: number;
}

export interface PathwayConfig {
  id: string;
  centerXM: number;
  centerYM: number;
  centerDepthM: number;
  sizeXM: number;
  sizeYM: number;
  thicknessM: number;
  rotationDeg: number;
  /** Multiplier on intrinsic permeability; this is assumed geometry. */
  permeabilityMultiplier: number;
}

export interface Scenario {
  researchSelection?: ResearchSelection;
  /** Optional for legacy imports; recorded in every new scenario and checkpoint. */
  materialProperties?: Partial<MaterialProperties>;
  schemaVersion: 1;
  modelId: 'zombie-reduced-porous-v0.1';
  unitMetadata: {
    system: 'SI';
    coordinates: 'x-y-horizontal-depth-positive-down';
    temperature: 'K-in-solver-C-for-configured-ambient-and-hot-regions';
    gasComposition: 'mole-fraction';
    gasInventory: 'mol-per-cell';
    solidLiquidInventory: 'kg-per-cell';
  };
  name: string;
  description: string;
  seed: number;
  provenance: Record<string, 'assumed' | 'literature-default' | 'measured'>;
  domain: DomainConfig;
  soil: SoilConfig;
  soilLayers: SoilLayer[];
  peatRegions: PeatRegion[];
  root: RootConfig;
  hotRegions: HotRegion[];
  source: SourceConfig;
  atmosphere: AtmosphereConfig;
  model: ModelConfig;
  pathways: PathwayConfig[];
  /** Visual events never mutate the physics state. */
  illustrativeEvent?: { triggeredAtS: number | null; intensity: number };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface Diagnostics {
  status: 'running' | 'validity-paused' | 'numerical-paused';
  warnings: string[];
  stepCount: number;
  lastStepS: number;
  maxDarcyVelocityMS: number;
  /** Positive excess weighted pore pressure at the fixed source support, Pa. */
  sourceExcessPressurePa: number;
  /** Imaginary projected support area π r_support², not a measured soil surface. */
  sourceProjectedAreaM2: number;
  /** Algebraic ΔP × area proxy, N; not a fracture, uplift, or blast prediction. */
  sourcePressureLoadN: number;
  sourcePressureLoadStatus: 'within-reduced-model' | 'outside-validity';
  pressureIterations: number;
  pressureResidualPa: number;
  /** Positive values quantify any numerical inventory correction. */
  correctedMoles: number;
  correctedWaterKg: number;
  correctedFuelKg: number;
  /** Integrated gas balance: initial + sources - boundary outflow - current, mol. */
  gasBalanceResidualMol: number;
  /** Per-species initial + sources - signed boundary outflow + numerical correction - current, mol. */
  speciesBalanceResidualMol: Record<'oxygen' | 'co2' | 'background' | 'vapor', number>;
  /** Integrated dry-ice heater + soil energy - sensible - latent, J. */
  sourceEnergyResidualJ: number;
  /** Diagnostic limited to resolved heat terms; excludes gas enthalpy at boundaries. */
  resolvedHeatResidualJ: number;
  cumulativeCO2InputKg: number;
  /** External energy assigned to instantaneous numerical conversion and gas equilibration. */
  cumulativeInterventionEnergyJ: number;
  /** Of intervention energy, sensible energy carried by gas at local cell temperature. */
  cumulativeInterventionGasSensibleJ: number;
  cumulativeCO2OutflowKg: number;
  cumulativeOxygenBoundaryInKg: number;
  /** Signed prescribed benchmark oxygen change; background changes oppositely, mol. */
  cumulativeOxygenInterventionMol: number;
  cumulativeFuelConsumedKg: number;
  cumulativeRootFuelConsumedKg: number;
  /** Integrated heat released by the reduced dry-fuel oxidation reaction, J. */
  cumulativeReactionHeatJ: number;
  /** Reaction heat generated during the last accepted step divided by that step's duration, W. */
  lastReactionPowerW: number;
  /** Grid cells with positive dry-fuel oxidation during the last accepted step. */
  reactingCellCount: number;
  cumulativeWaterEvaporatedKg: number;
  cumulativeGasBoundaryOutMol: number;
}

export interface SnapshotFields {
  temperatureK: Float32Array;
  oxygen: Float32Array;
  co2: Float32Array;
  backgroundGas: Float32Array;
  waterVapor: Float32Array;
  fuel: Float32Array;
  /** Nonreacting mineral mass per bulk cell, kg. */
  mineralKg: Float32Array;
  /** 0 mineral, 1 mixed mineral/organic soil, 2 peat; roots and paths modify this matrix. */
  materialClass: Float32Array;
  /** Resolved dry bulk density and thermal conductivity for the chosen cell material. */
  dryDensityKgM3: Float32Array;
  thermalConductivityWmK: Float32Array;
  /** Remaining supplemental root fuel, a subset of fuel, kg. */
  rootFuelKg: Float32Array;
  /** Accepted-step dry-fuel oxidation rate, kg/s per cell. */
  reactionRateKgS: Float32Array;
  /** Accepted-step reaction heat source per bulk cell volume, W/m³. */
  reactionPowerWm3: Float32Array;
  moisture: Float32Array;
  pressurePa: Float32Array;
  porosity: Float32Array;
  intrinsicPermeability: Float32Array;
  effectivePermeability: Float32Array;
  effectiveGasDiffusivity: Float32Array;
  peatMask: Float32Array;
  /** Cell-centred, signed Darcy seepage velocity components (m/s). */
  fluxXMps: Float32Array;
  fluxYMps: Float32Array;
  fluxZMps: Float32Array;
}

export interface Snapshot {
  timeSeconds: number;
  nx: number;
  ny: number;
  nz: number;
  widthM: number;
  lengthM: number;
  depthM: number;
  fields: SnapshotFields;
  dryIceMassKg: number;
  dryIceDiameterM: number;
  dryIceTemperatureK: number;
  heaterPowerW: number;
  heaterEnergyJ: number;
  peakTemperatureK: number;
  totalFuelKg: number;
  diagnostics: Diagnostics;
}

export interface ProbeSample {
  xM: number;
  yM: number;
  depthM: number;
  /** 0 mineral, 1 mixed mineral/organic soil, 2 peat matrix. */
  materialClass: number;
  dryDensityKgM3: number;
  thermalConductivityWmK: number;
  porosity: number;
  intrinsicPermeabilityM2: number;
  rootFuelKg: number;
  temperatureK: number;
  oxygenMoleFraction: number;
  co2MoleFraction: number;
  oxygenPartialPressurePa: number;
  pressurePa: number;
  moistureSaturation: number;
  fuelKg: number;
  darcyVelocityMS: [number, number, number];
}

export interface OperationalEvent {
  timeSeconds: number;
  type: 'heater-enabled' | 'heater-generation' | 'dry-ice-convert-all' | 'atmospheric-oxygen' | 'oxygen-inventory-benchmark';
  value: boolean | number;
  externalEnergyJ?: number;
  externalOxygenMol?: number;
  externalBackgroundMol?: number;
}

export interface SerializedSimulation {
  formatVersion: 1;
  scenario: Scenario;
  timeSeconds: number;
  dryIceMassKg: number;
  dryIceTemperatureK: number;
  heaterEnergyJ: number;
  heaterEnabled: boolean;
  heaterGenerationWm3: number;
  events: OperationalEvent[];
  diagnostics: Diagnostics;
  arrays: Record<string, number[]>;
}
