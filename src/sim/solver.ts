import { resolveMaterials, peatPorosity, type MaterialProperties } from './materials';
import { celsiusToKelvin, diameterFromMass, validateScenario } from './scenario';
import type { Diagnostics, OperationalEvent, ProbeSample, Scenario, SerializedSimulation, Snapshot, SnapshotFields, MechanicsMassGrid } from './types';

// Reduced-model constants. Values and validity limits are documented in docs/PHYSICS_MODEL.md.
const R = 8.314462618; // J mol^-1 K^-1
const CO2_MOLAR_MASS = 0.0440095; // kg mol^-1
const O2_MOLAR_MASS = 0.031998; // kg mol^-1
const H2O_MOLAR_MASS = 0.01801528; // kg mol^-1
// C6H10O5 + 6 O2 -> 6 CO2 + 5 H2O. Use the same molar masses as the inventories.
const FUEL_MOLAR_MASS = 6 * CO2_MOLAR_MASS + 5 * H2O_MOLAR_MASS - 6 * O2_MOLAR_MASS;

type Species = 'oxygen' | 'co2' | 'background' | 'vapor';
const SPECIES: Species[] = ['oxygen', 'co2', 'background', 'vapor'];
function zeroSpecies(): Record<Species, number> { return { oxygen: 0, co2: 0, background: 0, vapor: 0 }; }

interface Face {
  a: number;
  b: number; // -1 denotes atmosphere
  axis: 0 | 1 | 2;
  area: number;
  distance: number;
  g: number; // mol s^-1 Pa^-1 for Darcy pressure solve
  d: number; // mol s^-1 per mole-fraction difference
  thermalConductance: number; // W K^-1; fixed material property
  boundary: boolean;
}

function harmonic(a: number, b: number): number { return a + b > 0 ? 2 * a * b / (a + b) : 0; }
function clamp(value: number, low: number, high: number): number { return Math.min(high, Math.max(low, value)); }
function hash01(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 1619, 668265263) ^ Math.imul(z + 3137, 2246822519) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function withinShape(
  shape: 'ellipsoid' | 'slab' | 'irregular', x: number, y: number, z: number,
  centerX: number, centerY: number, centerZ: number,
  sizeX: number, sizeY: number, thickness: number, rotationDeg: number,
  noise: number,
): boolean {
  const angle = rotationDeg * Math.PI / 180;
  const dx = x - centerX; const dy = y - centerY;
  const xr = (dx * Math.cos(angle) + dy * Math.sin(angle)) / (sizeX / 2);
  const yr = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / (sizeY / 2);
  const zr = (z - centerZ) / (thickness / 2);
  if (shape === 'slab') return Math.max(Math.abs(xr), Math.abs(yr), Math.abs(zr)) <= 1;
  const radial = xr * xr + yr * yr + zr * zr;
  return radial <= (shape === 'irregular' ? (0.8 + 0.4 * noise) ** 2 : 1);
}

function freshDiagnostics(): Diagnostics {
  return {
    status: 'running', warnings: [], stepCount: 0, lastStepS: 0,
    maxDarcyVelocityMS: 0, pressureIterations: 0, pressureResidualPa: 0,
    sourceExcessPressurePa: 0, sourceProjectedAreaM2: 0, sourcePressureLoadN: 0,
    sourcePressureLoadStatus: 'within-reduced-model',
    correctedMoles: 0, correctedWaterKg: 0, correctedFuelKg: 0,
    gasBalanceResidualMol: 0, speciesBalanceResidualMol: zeroSpecies(),
    sourceEnergyResidualJ: 0, resolvedHeatResidualJ: 0,
    cumulativeCO2InputKg: 0, cumulativeCO2OutflowKg: 0,
    cumulativeInterventionEnergyJ: 0, cumulativeInterventionGasSensibleJ: 0,
    cumulativeOxygenBoundaryInKg: 0, cumulativeFuelConsumedKg: 0,
    cumulativeOxygenInterventionMol: 0,
    cumulativeRootFuelConsumedKg: 0,
    cumulativeReactionHeatJ: 0, lastReactionPowerW: 0, reactingCellCount: 0,
    cumulativeWaterEvaporatedKg: 0, cumulativeGasBoundaryOutMol: 0,
  };
}

/** An independent, deterministic 3D finite-volume realization of one scenario. */
export class Simulation {
  readonly scenario: Scenario;
  readonly materials: MaterialProperties;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly cellVolume: number;
  readonly cellCount: number;

  timeSeconds = 0;
  dryIceMassKg: number;
  dryIceTemperatureK: number;
  heaterEnergyJ = 0;
  heaterEnabled: boolean;
  heaterGenerationWm3: number;
  events: OperationalEvent[] = [];
  diagnostics = freshDiagnostics();

  private temperature: Float64Array;
  private oxygen: Float64Array;
  private co2: Float64Array;
  private background: Float64Array;
  private vapor: Float64Array;
  private fuel: Float64Array;
  private mineral: Float64Array;
  private materialClass: Uint8Array;
  private rootFuel: Float64Array;
  private reactionRate: Float64Array;
  private water: Float64Array;
  private dryDensity: Float64Array;
  private solidHeatCapacity: Float64Array;
  private thermalConductivity: Float64Array;
  private thermalLoss: Float64Array;
  private readonly reactionYields: { oxygen: number; co2: number; vapor: number };
  private porosity: Float64Array;
  private intrinsicH: Float64Array;
  private intrinsicV: Float64Array;
  private effectiveH: Float64Array;
  private effectiveV: Float64Array;
  private effectiveDiffusivity: Float64Array;
  private peatMask: Float64Array;
  private pressure: Float64Array;
  private vx: Float64Array;
  private vy: Float64Array;
  private vz: Float64Array;
  private faces: Face[] = [];
  private readonly stepArrays: Float64Array[];
  private readonly stepBackup: Float64Array[];
  private readonly work: {
    heatJ: Float64Array; initialCapacity: Float64Array; pre: Float64Array;
    capacity: Float64Array; diagonal: Float64Array; gauge: Float64Array;
    rhs: Float64Array; residualVector: Float64Array; preconditioned: Float64Array;
    direction: Float64Array; product: Float64Array; outgoing: Float64Array;
    conductanceX: Float64Array; conductanceY: Float64Array; conductanceZ: Float64Array;
    deltas: Record<Species, Float64Array>;
  };
  private sourceCells: Array<{ i: number; weight: number }> = [];
  private initialGasMol = 0;
  private cumulativeGasSourceMol = 0;
  private initialSpeciesMol = zeroSpecies();
  private cumulativeSpeciesSourceMol = zeroSpecies();
  private cumulativeSpeciesBoundaryOutMol = zeroSpecies();
  private cumulativeSpeciesCorrectionMol = zeroSpecies();
  private cumulativeSourceHeaterJ = 0;
  private cumulativeSourceSoilJ = 0;
  private cumulativeSourceSensibleJ = 0;
  private cumulativeSourceLatentJ = 0;
  private cumulativeSourceReturnJ = 0;
  private cumulativeResolvedHeatExpectedJ = 0;
  private cumulativeResolvedHeatActualJ = 0;

  constructor(scenario: Scenario, initialization?: { phaseStateOwnedExternally: true }) {
    const result = validateScenario(scenario);
    if (!result.valid) throw new Error(`Invalid scenario: ${result.errors.join(' ')}`);
    this.scenario = JSON.parse(JSON.stringify(scenario)) as Scenario;
    this.materials = resolveMaterials(this.scenario);
    this.reactionYields = this.scenario.numericalRevision === 2
      ? { oxygen: 6 * O2_MOLAR_MASS / FUEL_MOLAR_MASS, co2: 6 * CO2_MOLAR_MASS / FUEL_MOLAR_MASS, vapor: 5 * H2O_MOLAR_MASS / FUEL_MOLAR_MASS }
      : { oxygen: 192 / 162, co2: 264 / 162, vapor: 90 / 162 };
    const d = this.scenario.domain;
    this.nx = d.nx; this.ny = d.ny; this.nz = d.nz;
    this.dx = d.widthM / d.nx; this.dy = d.lengthM / d.ny; this.dz = d.depthM / d.nz;
    this.cellVolume = this.dx * this.dy * this.dz;
    this.cellCount = d.nx * d.ny * d.nz;
    const array = () => new Float64Array(this.cellCount);
    this.temperature = array(); this.oxygen = array(); this.co2 = array();
    this.background = array(); this.vapor = array(); this.fuel = array(); this.water = array();
    this.mineral = array(); this.rootFuel = array(); this.reactionRate = array();
    this.materialClass = new Uint8Array(this.cellCount);
    this.dryDensity = array(); this.solidHeatCapacity = array(); this.thermalConductivity = array(); this.thermalLoss = array();
    this.porosity = array(); this.intrinsicH = array(); this.intrinsicV = array();
    this.effectiveH = array(); this.effectiveV = array(); this.effectiveDiffusivity = array();
    this.peatMask = array(); this.pressure = array(); this.vx = array(); this.vy = array(); this.vz = array();
    this.stepArrays = [this.temperature, this.oxygen, this.co2, this.background,
      this.vapor, this.fuel, this.rootFuel, this.reactionRate, this.water,
      this.pressure, this.vx, this.vy, this.vz];
    this.stepBackup = this.stepArrays.map(() => array());
    this.work = {
      heatJ: array(), initialCapacity: array(), pre: array(), capacity: array(),
      diagonal: array(), gauge: array(), rhs: array(), residualVector: array(),
      preconditioned: array(), direction: array(), product: array(), outgoing: array(),
      conductanceX: array(), conductanceY: array(), conductanceZ: array(),
      deltas: { oxygen: array(), co2: array(), background: array(), vapor: array() },
    };
    this.dryIceMassKg = scenario.source.initialMassKg;
    this.dryIceTemperatureK = scenario.source.initialTemperatureK;
    this.heaterEnabled = scenario.source.enabled;
    this.heaterGenerationWm3 = scenario.source.heatGenerationWm3;
    this.initializeCells();
    if (!initialization?.phaseStateOwnedExternally && this.hasUnsupportedFrozenWater()) {
      throw new Error('Initial liquid water is below 273.15 K; freezing and thawing are not modeled.');
    }
    this.buildFaces();
    this.refreshThermalConductances();
    this.sourceCells = this.makeSourceWeights();
    this.initialGasMol = this.totalGasMol();
    for (const species of SPECIES) {
      const array = this.gasArray(species);
      for (let i = 0; i < this.cellCount; i++) this.initialSpeciesMol[species] += array[i];
    }
    this.updateDiagnostics();
  }

  private idx(x: number, y: number, z: number): number { return (z * this.ny + y) * this.nx + x; }
  private xyz(i: number): [number, number, number] {
    const x = i % this.nx;
    const y = Math.floor(i / this.nx) % this.ny;
    const z = Math.floor(i / (this.nx * this.ny));
    return [x, y, z];
  }
  private center(i: number): [number, number, number] {
    const [x, y, z] = this.xyz(i);
    return [(x + 0.5) * this.dx, (y + 0.5) * this.dy, (z + 0.5) * this.dz];
  }
  private gasVolume(i: number): number {
    // Liquid fills pore space, leaving an evolving gas-accessible volume.
    return Math.max(1e-12, this.porosity[i] * this.cellVolume - this.water[i] / this.materials.waterDensityKgM3);
  }
  private totalGasAt(i: number): number { return this.oxygen[i] + this.co2[i] + this.background[i] + this.vapor[i]; }
  private totalGasMol(): number {
    let result = 0;
    for (let i = 0; i < this.cellCount; i++) result += this.totalGasAt(i);
    return result;
  }
  private gasArray(species: Species): Float64Array {
    switch (species) {
      case 'oxygen': return this.oxygen;
      case 'co2': return this.co2;
      case 'background': return this.background;
      case 'vapor': return this.vapor;
    }
  }
  private hasUnsupportedFrozenWater(): boolean {
    for (let i = 0; i < this.cellCount; i++) {
      if (this.water[i] > 0 && this.temperature[i] < 273.15 - 1e-9) return true;
    }
    return false;
  }
  private atmosphereFraction(species: Species): number {
    const a = this.scenario.atmosphere;
    switch (species) {
      case 'oxygen': return a.oxygenMoleFraction;
      case 'co2': return a.co2MoleFraction;
      case 'vapor': return a.waterVaporMoleFraction;
      case 'background': return 1 - a.oxygenMoleFraction - a.co2MoleFraction - a.waterVaporMoleFraction;
    }
  }

  private initializeCells(): void {
    const s = this.scenario; const soil = s.soil;
    // Simple documented texture correction: all fractions are mineral dry mass fractions.
    const textureNumerator = 0.1 + 0.9 * soil.sandFraction + 0.2 * soil.siltFraction + 0.02 * soil.clayFraction;
    const textureBaseline = 0.1 + 0.9 * 0.5 + 0.2 * 0.35 + 0.02 * 0.15;
    const textureFactor = textureNumerator / textureBaseline;
    const compactionFactor = Math.exp(-2 * soil.compaction);
    const t0 = celsiusToKelvin(s.atmosphere.temperatureC);
    const o2 = s.atmosphere.oxygenMoleFraction;
    const co2 = s.atmosphere.co2MoleFraction;
    const h2o = s.atmosphere.waterVaporMoleFraction;
    for (let i = 0; i < this.cellCount; i++) {
      const [x, y, z] = this.center(i);
      let layerTop = 0;
      let layer = s.soilLayers[s.soilLayers.length - 1];
      for (const candidate of s.soilLayers) {
        layerTop += candidate.thicknessM;
        if (z < layerTop + 1e-10) { layer = candidate; break; }
      }
      let bulkDensity = soil.bulkDensityKgM3;
      let organic = soil.organicFraction;
      let materialClass = organic > 0 ? 1 : 0;
      let saturation = soil.moistureSaturation;
      let porosity = soil.porosity;
      let kThermal = soil.thermalConductivityWmK;
      let kH = soil.intrinsicPermeabilityHorizontalM2 * textureFactor * compactionFactor;
      let kV = soil.intrinsicPermeabilityVerticalM2 * textureFactor * compactionFactor;
      bulkDensity *= layer.dryDensityMultiplier;
      saturation += layer.moistureSaturationOffset;
      porosity += layer.porosityOffset;
      kThermal *= layer.thermalConductivityMultiplier;
      kH *= layer.permeabilityMultiplier;
      kV *= layer.permeabilityMultiplier;
      for (const peat of s.peatRegions) {
        const noise = hash01(...this.xyz(i), peat.seed ^ s.seed);
        if (withinShape(peat.shape, x, y, z, peat.centerXM, peat.centerYM, peat.centerDepthM,
          peat.sizeXM, peat.sizeYM, peat.thicknessM, peat.rotationDeg, noise)) {
          bulkDensity = peat.bulkDensityKgM3;
          organic = peat.organicFraction;
          saturation = peat.moistureSaturation;
          porosity = peatPorosity(bulkDensity, organic, this.materials, !s.materialProperties);
          kThermal = this.materials.peatDryConductivityWmK + this.materials.peatSaturationConductivityWmK * saturation; // uncalibrated peat heat-conduction mixture
          kH *= this.materials.peatHorizontalPermeabilityFactor; kV *= this.materials.peatVerticalPermeabilityFactor; // demonstration peat pathway assumption
          this.peatMask[i] = 1;
          materialClass = 2;
        }
      }
      for (const path of s.pathways) {
        if (withinShape('slab', x, y, z, path.centerXM, path.centerYM, path.centerDepthM,
          path.sizeXM, path.sizeYM, path.thicknessM, path.rotationDeg, 0.5)) {
          kH *= path.permeabilityMultiplier;
          kV *= path.permeabilityMultiplier;
        }
      }
      const rootDepth = Math.exp(-Math.abs(z - s.root.meanDepthM) / s.root.distributionDepthM);
      const rootVariation = 0.8 + 0.4 * hash01(...this.xyz(i), s.root.seed ^ s.seed);
      const rootFuelKg = s.root.amountKgM3 * rootDepth * rootVariation * this.cellVolume;
      // Roots are added once to the base organic dry mass; never included in its fraction.
      const mineralOrganicFuelKg = bulkDensity * organic * this.cellVolume;
      this.fuel[i] = mineralOrganicFuelKg + rootFuelKg;
      this.rootFuel[i] = rootFuelKg;
      this.mineral[i] = bulkDensity * (1 - organic) * this.cellVolume;
      this.materialClass[i] = materialClass;
      this.water[i] = porosity * this.cellVolume * saturation * this.materials.waterDensityKgM3;
      this.dryDensity[i] = bulkDensity;
      this.solidHeatCapacity[i] = materialClass === 2 ? this.materials.peatHeatCapacityJKgK : soil.solidHeatCapacityJKgK;
      this.thermalConductivity[i] = kThermal;
      this.porosity[i] = porosity;
      this.intrinsicH[i] = kH;
      this.intrinsicV[i] = kV;
      this.temperature[i] = t0 + (celsiusToKelvin(s.atmosphere.deepTemperatureC) - t0) * z / s.domain.depthM;
      for (const hot of s.hotRegions) {
        if (withinShape(hot.shape, x, y, z, hot.centerXM, hot.centerYM, hot.centerDepthM,
          hot.sizeXM, hot.sizeYM, hot.thicknessM, 0, 0.5)) {
          this.temperature[i] = Math.max(this.temperature[i], celsiusToKelvin(hot.temperatureC));
          this.fuel[i] *= hot.fuelFraction;
          this.rootFuel[i] *= hot.fuelFraction;
        }
      }
      const n = s.atmosphere.pressurePa * this.gasVolume(i) / (R * this.temperature[i]);
      this.oxygen[i] = n * o2; this.co2[i] = n * co2; this.vapor[i] = n * h2o;
      this.background[i] = n * (1 - o2 - co2 - h2o);
      this.pressure[i] = s.atmosphere.pressurePa;
    }
    this.updateEffectiveProperties();
  }

  private updateEffectiveProperties(): void {
    const soil = this.scenario.soil;
    for (let i = 0; i < this.cellCount; i++) {
      const gasFraction = clamp(this.gasVolume(i) / (this.porosity[i] * this.cellVolume), 0, 1);
      const relativeGasMobility = gasFraction ** 3;
      this.effectiveH[i] = this.intrinsicH[i] * relativeGasMobility;
      this.effectiveV[i] = this.intrinsicV[i] * relativeGasMobility;
      this.effectiveDiffusivity[i] = soil.gasDiffusivityM2S * this.porosity[i] * gasFraction ** 2 / soil.tortuosity;
    }
  }

  private buildFaces(): void {
    const add = (a: number, b: number, axis: 0 | 1 | 2, area: number, distance: number, boundary = false) => {
      const thermalConductance = b >= 0
        ? harmonic(this.thermalConductivity[a], this.thermalConductivity[b]) * area / distance : 0;
      this.faces.push({ a, b, axis, area, distance, g: 0, d: 0, thermalConductance, boundary });
    };
    for (let z = 0; z < this.nz; z++) for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      const i = this.idx(x, y, z);
      if (x + 1 < this.nx) add(i, this.idx(x + 1, y, z), 0, this.dy * this.dz, this.dx);
      if (y + 1 < this.ny) add(i, this.idx(x, y + 1, z), 1, this.dx * this.dz, this.dy);
      if (z + 1 < this.nz) add(i, this.idx(x, y, z + 1), 2, this.dx * this.dy, this.dz);
      if (z === 0 && this.scenario.atmosphere.topGasBoundary === 'atmospheric') add(i, -1, 2, this.dx * this.dy, this.dz / 2, true);
      if (this.scenario.atmosphere.sideGasBoundary === 'atmospheric') {
        if (x === 0 || x === this.nx - 1) add(i, -1, 0, this.dy * this.dz, this.dx / 2, true);
        if (y === 0 || y === this.ny - 1) add(i, -1, 1, this.dx * this.dz, this.dy / 2, true);
      }
    }
  }

  private refreshThermalConductances(): void {
    this.thermalLoss.fill(0);
    for (const face of this.faces) {
      if (face.b >= 0) {
        face.thermalConductance = harmonic(this.thermalConductivity[face.a], this.thermalConductivity[face.b])
          * face.area / face.distance;
        this.thermalLoss[face.a] += face.thermalConductance;
        this.thermalLoss[face.b] += face.thermalConductance;
      }
    }
    const a = this.scenario.atmosphere, area = this.dx * this.dy;
    for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      this.thermalLoss[this.idx(x, y, 0)] += a.surfaceHeatTransferWm2K * area;
      this.thermalLoss[this.idx(x, y, this.nz - 1)] += a.bottomHeatTransferWm2K * area;
    }
  }

  private makeSourceWeights(): Array<{ i: number; weight: number }> {
    const source = this.scenario.source;
    const fx = source.centerXM / this.dx - 0.5;
    const fy = source.centerYM / this.dy - 0.5;
    const fz = source.centerDepthM / this.dz - 0.5;
    const x0 = Math.floor(fx); const y0 = Math.floor(fy); const z0 = Math.floor(fz);
    const result: Array<{ i: number; weight: number }> = [];
    for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const x = x0 + dx; const y = y0 + dy; const z = z0 + dz;
      if (x < 0 || x >= this.nx || y < 0 || y >= this.ny || z < 0 || z >= this.nz) continue;
      const weight = (dx ? fx - x0 : 1 - (fx - x0)) * (dy ? fy - y0 : 1 - (fy - y0)) * (dz ? fz - z0 : 1 - (fz - z0));
      if (weight > 0) result.push({ i: this.idx(x, y, z), weight });
    }
    const total = result.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) throw new Error('Source support falls outside the grid.');
    return result.map(item => ({ ...item, weight: item.weight / total }));
  }

  private cellCapacity(i: number): number {
    return this.dryDensity[i] * this.cellVolume * this.solidHeatCapacity[i]
      + this.water[i] * this.materials.waterHeatCapacityJKgK + this.totalGasAt(i) * this.materials.gasHeatCapacityJMolK;
  }

  private heaterActiveAt(time: number): boolean {
    const source = this.scenario.source;
    return this.heaterEnabled && time >= source.startTimeS && time < source.startTimeS + source.durationS;
  }
  get heaterPowerW(): number {
    return this.heaterActiveAt(this.timeSeconds)
      ? this.heaterGenerationWm3 * 4 * Math.PI * this.scenario.source.supportRadiusM ** 3 / 3 : 0;
  }

  setHeater(enabled: boolean): void {
    if (this.heaterEnabled === enabled) return;
    this.heaterEnabled = enabled;
    this.events.push({ timeSeconds: this.timeSeconds, type: 'heater-enabled', value: enabled });
  }
  setHeaterGeneration(heatGenerationWm3: number): void {
    if (!Number.isFinite(heatGenerationWm3) || heatGenerationWm3 < 0 || heatGenerationWm3 > 1e6) {
      throw new Error('Heater generation must be within 0 to 1,000,000 W/m³.');
    }
    if (this.heaterGenerationWm3 === heatGenerationWm3) return;
    this.heaterGenerationWm3 = heatGenerationWm3;
    this.events.push({ timeSeconds: this.timeSeconds, type: 'heater-generation', value: heatGenerationWm3 });
  }

  /** Prescribed atmospheric boundary composition for a reduced oxygen-interruption benchmark. */
  setAtmosphericOxygen(moleFraction: number): void {
    const atmosphere = this.scenario.atmosphere;
    const maximum = 1 - atmosphere.co2MoleFraction - atmosphere.waterVaporMoleFraction;
    if (!Number.isFinite(moleFraction) || moleFraction < 0 || moleFraction > maximum) throw new Error('Atmospheric oxygen mole fraction is outside the mixture range.');
    if (atmosphere.oxygenMoleFraction === moleFraction) return;
    atmosphere.oxygenMoleFraction = moleFraction;
    this.events.push({ timeSeconds: this.timeSeconds, type: 'atmospheric-oxygen', value: moleFraction });
  }

  /** Benchmark-only, prescribed inventory exchange at fixed total gas moles and temperature. */
  setUniformOxygenFraction(moleFraction: number): void {
    if (!Number.isFinite(moleFraction) || moleFraction < 0 || moleFraction > 1) throw new Error('Invalid benchmark oxygen fraction.');
    const changes = new Float64Array(this.cellCount);
    for (let i = 0; i < this.cellCount; i++) {
      const target = this.totalGasAt(i) * moleFraction;
      changes[i] = target - this.oxygen[i];
      if (this.background[i] + 1e-12 < changes[i]) throw new Error('Insufficient background gas for prescribed oxygen exchange.');
    }
    let deltaOxygenMol = 0;
    for (let i = 0; i < this.cellCount; i++) {
      this.oxygen[i] += changes[i];
      this.background[i] -= changes[i];
      deltaOxygenMol += changes[i];
    }
    this.diagnostics.cumulativeOxygenInterventionMol += deltaOxygenMol;
    this.cumulativeSpeciesSourceMol.oxygen += deltaOxygenMol;
    this.cumulativeSpeciesSourceMol.background -= deltaOxygenMol;
    this.events.push({ timeSeconds: this.timeSeconds, type: 'oxygen-inventory-benchmark', value: moleFraction,
      externalOxygenMol: deltaOxygenMol, externalBackgroundMol: -deltaOxygenMol, externalEnergyJ: 0 });
    this.updateDiagnostics();
  }

  /**
   * One numerical intervention: transform all remaining solid inventory into CO₂ gas at
   * the source support cells. The required phase-change and gas-equilibration energy is
   * explicitly booked as external intervention energy. No rupture, blast, or shock is
   * calculated. If the resulting pore state exceeds slow-flow validity, inventory stays
   * converted and the transport solver pauses before any further flow calculation.
   */
  convertRemainingDryIce(): Snapshot {
    if (this.dryIceMassKg <= 0) return this.snapshot();
    if (this.diagnostics.status !== 'running') throw new Error('Cannot convert dry ice after the reduced solver has paused outside its valid regime.');
    const convertedMassKg = this.dryIceMassKg;
    const injectedMol = convertedMassKg / CO2_MOLAR_MASS;
    const solidSensibleJ = convertedMassKg * this.materials.co2SolidHeatCapacityJKgK * Math.max(0, this.materials.co2SublimationK - this.dryIceTemperatureK);
    const latentJ = convertedMassKg * this.materials.co2SublimationJkg;
    let gasSensibleJ = 0;
    for (const { i, weight } of this.sourceCells) {
      const mol = injectedMol * weight;
      this.co2[i] += mol;
      gasSensibleJ += mol * this.materials.co2GasHeatCapacityJMolK * (this.temperature[i] - this.materials.co2SublimationK);
    }
    const interventionEnergyJ = solidSensibleJ + latentJ + gasSensibleJ;
    this.dryIceMassKg = 0;
    this.dryIceTemperatureK = this.materials.co2SublimationK;
    this.cumulativeSourceSensibleJ += solidSensibleJ;
    this.cumulativeSourceLatentJ += latentJ;
    this.cumulativeGasSourceMol += injectedMol;
    this.cumulativeSpeciesSourceMol.co2 += injectedMol;
    this.diagnostics.cumulativeCO2InputKg += convertedMassKg;
    this.diagnostics.cumulativeInterventionEnergyJ += interventionEnergyJ;
    this.diagnostics.cumulativeInterventionGasSensibleJ += gasSensibleJ;
    this.events.push({ timeSeconds: this.timeSeconds, type: 'dry-ice-convert-all', value: convertedMassKg, externalEnergyJ: interventionEnergyJ });
    this.vx.fill(0); this.vy.fill(0); this.vz.fill(0);
    this.diagnostics.maxDarcyVelocityMS = 0;
    this.diagnostics.pressureIterations = 0;
    this.diagnostics.pressureResidualPa = 0;
    for (let i = 0; i < this.cellCount; i++) {
      this.pressure[i] = this.totalGasAt(i) * R * this.temperature[i] / this.gasVolume(i);
      if (!Number.isFinite(this.pressure[i])) this.pause('numerical-paused', 'Instant conversion produced a non-finite gas-storage estimate.');
      else if (this.pressure[i] < this.scenario.model.minPressurePa || this.pressure[i] > this.scenario.model.maxPressurePa) {
        this.pause('validity-paused', 'Instant conversion exceeded the supported pore-pressure range. Reduced transport paused; this is a numerical mass-transfer event, not a blast or soil-motion prediction.');
      }
    }
    this.updateDiagnostics();
    return this.snapshot();
  }

  private nextStepLimit(requestedS: number): number {
    const source = this.scenario.source;
    let dt = Math.min(requestedS, this.scenario.model.maxStepS);
    for (const switchTime of [source.startTimeS, source.startTimeS + source.durationS]) {
      if (switchTime > this.timeSeconds + 1e-9) dt = Math.min(dt, switchTime - this.timeSeconds);
    }
    // Conservative explicit heat/diffusion bound. The pressure solve itself is implicit.
    let maxAlpha = 0; let maxDiff = 0;
    for (let i = 0; i < this.cellCount; i++) {
      maxAlpha = Math.max(maxAlpha, this.thermalConductivity[i] * this.cellVolume / this.cellCapacity(i));
      maxDiff = Math.max(maxDiff, this.effectiveDiffusivity[i]);
      // The Fourier bound alone omits Robin boundary losses and heterogeneous face sums.
      if (this.thermalLoss[i] > 0) dt = Math.min(dt, 0.8 * this.cellCapacity(i) / this.thermalLoss[i]);
    }
    const inverseSquaredSum = 1 / this.dx ** 2 + 1 / this.dy ** 2 + 1 / this.dz ** 2;
    // Explicit 3D diffusion stability requires dt <= 1/(2 alpha sum(1/dx²)).
    dt = Math.min(dt, 0.4 / (Math.max(1e-12, maxAlpha, maxDiff) * inverseSquaredSum));
    if (this.dryIceMassKg > 0) {
      const radius = diameterFromMass(this.dryIceMassKg, source.densityKgM3) / 2;
      const area = 4 * Math.PI * radius * radius;
      const contact = source.contactConductanceWm2K * area;
      for (const { i, weight } of this.sourceCells) {
        if (contact > 0) dt = Math.min(dt, 0.8 * this.cellCapacity(i) / (this.thermalLoss[i] + contact * weight));
      }
      if (contact > 0 && this.dryIceTemperatureK < this.materials.co2SublimationK - 1e-8)
        dt = Math.min(dt, 0.8 * this.dryIceMassKg * this.materials.co2SolidHeatCapacityJKgK / contact);
      let weightedSoilTemperature = 0;
      for (const { i, weight } of this.sourceCells) weightedSoilTemperature += weight * this.temperature[i];
      const incomingPower = this.heaterPowerW + source.contactConductanceWm2K * area
        * Math.max(0, weightedSoilTemperature - this.dryIceTemperatureK);
      if (incomingPower > 0) dt = Math.min(dt, Math.max(0.01, 0.5 * this.dryIceMassKg * this.materials.co2SublimationJkg / incomingPower));
    }
    return dt;
  }

  /** Integrate one stable physical step, no larger than maxDtSeconds. */
  step(maxDtSeconds = this.scenario.model.maxStepS): Snapshot {
    if (this.diagnostics.status !== 'running') return this.snapshot();
    if (!Number.isFinite(maxDtSeconds) || maxDtSeconds <= 0) throw new Error('Step duration must be positive and finite.');
    const dt = this.nextStepLimit(maxDtSeconds);
    if (dt <= 0) return this.snapshot();
    this.performStep(dt);
    return this.snapshot();
  }

  /** Advance by a physical duration; useful for worker chunks and tests. */
  advance(seconds: number): Snapshot { return this.advanceTo(this.timeSeconds + seconds); }

  /** Advance to an absolute physical time; maxSteps permits responsive worker chunking. */
  advanceTo(targetTimeSeconds: number, maxSteps = Number.POSITIVE_INFINITY): Snapshot {
    this.advanceUntil(targetTimeSeconds, maxSteps);
    return this.snapshot();
  }

  /** Advance without allocating a full display snapshot; used by fine-grid worker chunks. */
  advanceUntil(targetTimeSeconds: number, maxSteps = Number.POSITIVE_INFINITY): void {
    if (!Number.isFinite(targetTimeSeconds) || targetTimeSeconds < this.timeSeconds - 1e-9) throw new Error('Target time must be finite and not earlier than current solver time.');
    if (maxSteps <= 0) return;
    let steps = 0;
    while (this.timeSeconds + 1e-9 < targetTimeSeconds && this.diagnostics.status === 'running' && steps < maxSteps) {
      const dt = this.nextStepLimit(targetTimeSeconds - this.timeSeconds);
      if (dt <= 1e-10) break;
      this.performStep(dt);
      steps++;
    }
    if (Math.abs(this.timeSeconds - targetTimeSeconds) <= 1e-8) this.timeSeconds = targetTimeSeconds;
  }

  private performStep(dt: number): void {
    const n = this.cellCount;
    // Transactional step: a validity/numerical failure returns to the last fully valid state.
    for (let j = 0; j < this.stepArrays.length; j++) this.stepBackup[j].set(this.stepArrays[j]);
    const backupScalars = [this.dryIceMassKg, this.dryIceTemperatureK, this.heaterEnergyJ,
      this.cumulativeGasSourceMol, this.cumulativeSourceHeaterJ, this.cumulativeSourceSoilJ,
      this.cumulativeSourceSensibleJ, this.cumulativeSourceLatentJ, this.cumulativeSourceReturnJ,
      this.cumulativeResolvedHeatExpectedJ, this.cumulativeResolvedHeatActualJ];
    const backupSpeciesSource = { ...this.cumulativeSpeciesSourceMol };
    const backupSpeciesBoundary = { ...this.cumulativeSpeciesBoundaryOutMol };
    const backupSpeciesCorrection = { ...this.cumulativeSpeciesCorrectionMol };
    const backupDiagnostics: Diagnostics = { ...this.diagnostics, warnings: [...this.diagnostics.warnings],
      speciesBalanceResidualMol: { ...this.diagnostics.speciesBalanceResidualMol } };
    const rollback = () => {
      const failureStatus = this.diagnostics.status;
      const failureWarnings = this.diagnostics.warnings.filter(w => !backupDiagnostics.warnings.includes(w));
      for (let j = 0; j < this.stepArrays.length; j++) this.stepArrays[j].set(this.stepBackup[j]);
      [this.dryIceMassKg, this.dryIceTemperatureK, this.heaterEnergyJ,
        this.cumulativeGasSourceMol, this.cumulativeSourceHeaterJ, this.cumulativeSourceSoilJ,
        this.cumulativeSourceSensibleJ, this.cumulativeSourceLatentJ, this.cumulativeSourceReturnJ,
        this.cumulativeResolvedHeatExpectedJ, this.cumulativeResolvedHeatActualJ] = backupScalars;
      this.cumulativeSpeciesSourceMol = backupSpeciesSource;
      this.cumulativeSpeciesBoundaryOutMol = backupSpeciesBoundary;
      this.cumulativeSpeciesCorrectionMol = backupSpeciesCorrection;
      this.diagnostics = { ...backupDiagnostics, status: failureStatus, warnings: [...backupDiagnostics.warnings, ...failureWarnings] };
      this.updateEffectiveProperties();
      this.updateDiagnostics();
    };
    const { heatJ, initialCapacity } = this.work;
    heatJ.fill(0);
    for (let i = 0; i < n; i++) initialCapacity[i] = this.cellCapacity(i);
    this.applyHeatConduction(dt, heatJ);
    this.applySource(dt, heatJ);
    this.applyReactionAndEvaporation(dt, heatJ);
    let expectedHeatJ = 0; let actualHeatJ = 0;
    for (let i = 0; i < n; i++) {
      const oldT = this.temperature[i];
      this.temperature[i] += heatJ[i] / initialCapacity[i];
      expectedHeatJ += heatJ[i];
      actualHeatJ += initialCapacity[i] * (this.temperature[i] - oldT);
      if (!Number.isFinite(this.temperature[i]) || this.temperature[i] < 150 || this.temperature[i] > 1200) {
        this.pause('numerical-paused', 'Temperature left the supported 150–1200 K numerical range.');
        rollback();
        return;
      }
    }
    if (this.hasUnsupportedFrozenWater()) {
      this.pause('validity-paused', 'Wet soil reached the freezing point; the model has no ice or thawing state.');
      rollback();
      return;
    }
    this.cumulativeResolvedHeatExpectedJ += expectedHeatJ;
    this.cumulativeResolvedHeatActualJ += actualHeatJ;
    this.updateEffectiveProperties();
    this.solvePressureAndTransport(dt);
    if (this.diagnostics.status !== 'running') { rollback(); return; }
    this.timeSeconds += dt;
    this.diagnostics.stepCount++;
    this.diagnostics.lastStepS = dt;
    this.updateDiagnostics();
  }

  private applyHeatConduction(dt: number, heatJ: Float64Array): void {
    const airT = celsiusToKelvin(this.scenario.atmosphere.temperatureC);
    const deepT = celsiusToKelvin(this.scenario.atmosphere.deepTemperatureC);
    for (const f of this.faces) {
      if (f.b < 0) continue;
      const energy = f.thermalConductance * (this.temperature[f.b] - this.temperature[f.a]) * dt;
      heatJ[f.a] += energy; heatJ[f.b] -= energy;
    }
    const a = this.scenario.atmosphere;
    const surfaceArea = this.dx * this.dy;
    for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      const top = this.idx(x, y, 0);
      const bottom = this.idx(x, y, this.nz - 1);
      heatJ[top] += a.surfaceHeatTransferWm2K * surfaceArea * (airT - this.temperature[top]) * dt;
      heatJ[bottom] += a.bottomHeatTransferWm2K * surfaceArea * (deepT - this.temperature[bottom]) * dt;
    }
  }

  private applySource(dt: number, heatJ: Float64Array): void {
    const source = this.scenario.source;
    const power = this.heaterPowerW;
    const heaterJ = power * dt;
    this.heaterEnergyJ += heaterJ;
    if (this.dryIceMassKg <= 0) {
      for (const { i, weight } of this.sourceCells) heatJ[i] += heaterJ * weight;
      return;
    }
    this.cumulativeSourceHeaterJ += heaterJ;
    const radius = diameterFromMass(this.dryIceMassKg, source.densityKgM3) / 2;
    const contactArea = 4 * Math.PI * radius * radius;
    let soilEnergyJ = 0;
    for (const { i, weight } of this.sourceCells) {
      const energy = source.contactConductanceWm2K * contactArea * weight * (this.temperature[i] - this.dryIceTemperatureK) * dt;
      heatJ[i] -= energy;
      soilEnergyJ += energy;
    }
    this.cumulativeSourceSoilJ += soilEnergyJ;
    let availableJ = heaterJ + soilEnergyJ;
    if (availableJ >= 0 && this.dryIceTemperatureK < this.materials.co2SublimationK) {
      const sensible = Math.min(availableJ, this.dryIceMassKg * this.materials.co2SolidHeatCapacityJKgK * (this.materials.co2SublimationK - this.dryIceTemperatureK));
      this.dryIceTemperatureK += sensible / (this.dryIceMassKg * this.materials.co2SolidHeatCapacityJKgK);
      availableJ -= sensible;
      this.cumulativeSourceSensibleJ += sensible;
    }
    if (availableJ < 0) {
      this.dryIceTemperatureK += availableJ / (this.dryIceMassKg * this.materials.co2SolidHeatCapacityJKgK);
      this.cumulativeSourceSensibleJ += availableJ;
      availableJ = 0;
    }
    if (availableJ <= 0 || this.dryIceTemperatureK < this.materials.co2SublimationK - 1e-8) return;
    const sublimatedKg = Math.min(this.dryIceMassKg, availableJ / this.materials.co2SublimationJkg);
    this.dryIceMassKg -= sublimatedKg;
    const latentJ = sublimatedKg * this.materials.co2SublimationJkg;
    this.cumulativeSourceLatentJ += latentJ;
    const unusedJ = availableJ - latentJ;
    if (unusedJ > 0) {
      // If inventory exhausts within this step, excess source energy returns to soil.
      this.cumulativeSourceReturnJ += unusedJ;
      for (const { i, weight } of this.sourceCells) heatJ[i] += unusedJ * weight;
    }
    const addedMol = sublimatedKg / CO2_MOLAR_MASS;
    this.cumulativeGasSourceMol += addedMol;
    this.cumulativeSpeciesSourceMol.co2 += addedMol;
    this.diagnostics.cumulativeCO2InputKg += sublimatedKg;
    for (const { i, weight } of this.sourceCells) {
      const mol = addedMol * weight;
      this.co2[i] += mol;
      // Cold gas sensible heating by the cell is separate from sublimation latent energy.
      heatJ[i] -= mol * this.materials.co2GasHeatCapacityJMolK * Math.max(0, this.temperature[i] - this.dryIceTemperatureK);
    }
  }

  private applyReactionAndEvaporation(dt: number, heatJ: Float64Array): void {
    const model = this.scenario.model;
    let reactionHeatJ = 0;
    let reactingCellCount = 0;
    for (let i = 0; i < this.cellCount; i++) {
      this.reactionRate[i] = 0;
      const temp = this.temperature[i];
      if (temp > model.minimumReactionTemperatureK && this.fuel[i] > 0 && this.oxygen[i] > 0) {
        const gas = this.totalGasAt(i);
        const oxygenFraction = gas > 0 ? this.oxygen[i] / gas : 0;
        const oxygenFactor = oxygenFraction / (oxygenFraction + model.oxygenHalfSaturation);
        const arrhenius = Math.exp(-model.activationEnergyJMol / R * (1 / temp - 1 / model.referenceTemperatureK));
        // The bounded per-step conversion removes explicit reaction stiffness.
        const kineticFuelKg = this.fuel[i] * (1 - Math.exp(-Math.min(50, model.smolderRateS * arrhenius * oxygenFactor * dt)));
        const oxygenLimitedFuelKg = this.oxygen[i] * O2_MOLAR_MASS / this.reactionYields.oxygen;
        const reactedKg = Math.min(this.fuel[i], kineticFuelKg, oxygenLimitedFuelKg);
        if (reactedKg > 0) reactingCellCount++;
        const rootReactedKg = reactedKg * this.rootFuel[i] / this.fuel[i];
        this.rootFuel[i] -= rootReactedKg;
        this.reactionRate[i] = reactedKg / dt;
        this.fuel[i] -= reactedKg;
        this.oxygen[i] -= reactedKg * this.reactionYields.oxygen / O2_MOLAR_MASS;
        this.co2[i] += reactedKg * this.reactionYields.co2 / CO2_MOLAR_MASS;
        this.vapor[i] += reactedKg * this.reactionYields.vapor / H2O_MOLAR_MASS;
        this.cumulativeSpeciesSourceMol.oxygen -= reactedKg * this.reactionYields.oxygen / O2_MOLAR_MASS;
        this.cumulativeSpeciesSourceMol.co2 += reactedKg * this.reactionYields.co2 / CO2_MOLAR_MASS;
        this.cumulativeSpeciesSourceMol.vapor += reactedKg * this.reactionYields.vapor / H2O_MOLAR_MASS;
        const heatReleasedJ = reactedKg * model.heatOfCombustionJkg;
        heatJ[i] += heatReleasedJ;
        reactionHeatJ += heatReleasedJ;
        this.diagnostics.cumulativeFuelConsumedKg += reactedKg;
        this.diagnostics.cumulativeRootFuelConsumedKg += rootReactedKg;
        this.cumulativeGasSourceMol += reactedKg * (-this.reactionYields.oxygen / O2_MOLAR_MASS + this.reactionYields.co2 / CO2_MOLAR_MASS + this.reactionYields.vapor / H2O_MOLAR_MASS);
      }
      if (temp > model.evaporationOnsetTemperatureK && this.water[i] > 0 && model.evaporationRateS > 0) {
        const ramp = clamp((temp - model.evaporationOnsetTemperatureK) / (model.boilingTemperatureK - model.evaporationOnsetTemperatureK), 0, 1);
        const kineticKg = this.water[i] * (1 - Math.exp(-model.evaporationRateS * ramp * dt));
        const availableSensibleJ = Math.max(0, (temp - 273.15) * this.cellCapacity(i));
        const evapKg = Math.min(this.water[i], kineticKg, availableSensibleJ / this.materials.waterEvaporationJkg);
        this.water[i] -= evapKg;
        this.vapor[i] += evapKg / H2O_MOLAR_MASS;
        this.cumulativeSpeciesSourceMol.vapor += evapKg / H2O_MOLAR_MASS;
        heatJ[i] -= evapKg * this.materials.waterEvaporationJkg;
        this.cumulativeGasSourceMol += evapKg / H2O_MOLAR_MASS;
        this.diagnostics.cumulativeWaterEvaporatedKg += evapKg;
      }
    }
    this.diagnostics.cumulativeReactionHeatJ += reactionHeatJ;
    this.diagnostics.lastReactionPowerW = reactionHeatJ / dt;
    this.diagnostics.reactingCellCount = reactingCellCount;
  }

  private solvePressureAndTransport(dt: number): void {
    const n = this.cellCount;
    const atm = this.scenario.atmosphere;
    const atmT = celsiusToKelvin(atm.temperatureC);
    const { pre, capacity, diagonal, gauge, rhs, residualVector, preconditioned, direction, product,
      conductanceX, conductanceY, conductanceZ } = this.work;
    for (let i = 0; i < n; i++) {
      pre[i] = this.totalGasAt(i);
      capacity[i] = this.gasVolume(i) / (R * this.temperature[i]);
      this.pressure[i] = pre[i] / capacity[i];
    }
    for (const f of this.faces) {
      const a = f.a; const b = f.b;
      const kA = f.axis === 2 ? this.effectiveV[a] : this.effectiveH[a];
      const k = b >= 0 ? harmonic(kA, f.axis === 2 ? this.effectiveV[b] : this.effectiveH[b]) : kA;
      const temp = b >= 0 ? (this.temperature[a] + this.temperature[b]) / 2 : (this.temperature[a] + atmT) / 2;
      const molarDensity = atm.pressurePa / (R * temp);
      f.g = k / this.materials.gasViscosityPaS * f.area / f.distance * molarDensity;
      const diffusivity = b >= 0 ? harmonic(this.effectiveDiffusivity[a], this.effectiveDiffusivity[b]) : atm.exchangeVelocityMS * f.distance;
      f.d = diffusivity * f.area / f.distance * molarDensity;
    }
    // The implicit gas-storage equation is symmetric positive definite:
    // C_i (p_i - p*_i) + dt sum_f g_f (p_i - p_neighbor) = 0.
    // Atmospheric boundary pressures are fixed. Solve for gauge pressure with
    // conjugate gradients and a symmetric Gauss-Seidel preconditioner.
    // This changes only the linear solver, not the storage or Darcy equation.
    diagonal.set(capacity);
    for (const f of this.faces) {
      const conductance = dt * f.g;
      diagonal[f.a] += conductance;
      if (f.b >= 0) {
        diagonal[f.b] += conductance;
        if (f.axis === 0) conductanceX[f.a] = conductance;
        else if (f.axis === 1) conductanceY[f.a] = conductance;
        else conductanceZ[f.a] = conductance;
      }
    }
    const applyMatrix = (input: Float64Array, output: Float64Array): void => {
      const layerSize = this.nx * this.ny;
      for (let z = 0; z < this.nz; z++) for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
        const i = (z * this.ny + y) * this.nx + x;
        let value = diagonal[i] * input[i];
        if (x > 0) value -= conductanceX[i - 1] * input[i - 1];
        if (x + 1 < this.nx) value -= conductanceX[i] * input[i + 1];
        if (y > 0) value -= conductanceY[i - this.nx] * input[i - this.nx];
        if (y + 1 < this.ny) value -= conductanceY[i] * input[i + this.nx];
        if (z > 0) value -= conductanceZ[i - layerSize] * input[i - layerSize];
        if (z + 1 < this.nz) value -= conductanceZ[i] * input[i + layerSize];
        output[i] = value;
      }
    };
    // M = (D + L) D^-1 (D + U) is symmetric positive definite for this
    // positive diagonal. The two ordered sweeps apply M^-1 to a residual.
    const precondition = (input: Float64Array, output: Float64Array): void => {
      const layerSize = this.nx * this.ny;
      for (let z = 0; z < this.nz; z++) for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
        const i = (z * this.ny + y) * this.nx + x;
        let value = input[i];
        if (x > 0) value += conductanceX[i - 1] * output[i - 1];
        if (y > 0) value += conductanceY[i - this.nx] * output[i - this.nx];
        if (z > 0) value += conductanceZ[i - layerSize] * output[i - layerSize];
        output[i] = value / diagonal[i];
      }
      for (let z = this.nz - 1; z >= 0; z--) for (let y = this.ny - 1; y >= 0; y--) for (let x = this.nx - 1; x >= 0; x--) {
        const i = (z * this.ny + y) * this.nx + x;
        let value = 0;
        if (x + 1 < this.nx) value += conductanceX[i] * output[i + 1];
        if (y + 1 < this.ny) value += conductanceY[i] * output[i + this.nx];
        if (z + 1 < this.nz) value += conductanceZ[i] * output[i + layerSize];
        output[i] += value / diagonal[i];
      }
    };
    for (let i = 0; i < n; i++) {
      gauge[i] = this.pressure[i] - atm.pressurePa;
      rhs[i] = pre[i] - capacity[i] * atm.pressurePa;
    }
    applyMatrix(gauge, product);
    let residual = 0;
    let rz = 0;
    for (let i = 0; i < n; i++) {
      residualVector[i] = rhs[i] - product[i];
      residual = Math.max(residual, Math.abs(residualVector[i]) / diagonal[i]);
    }
    precondition(residualVector, preconditioned);
    for (let i = 0; i < n; i++) {
      direction[i] = preconditioned[i];
      rz += residualVector[i] * preconditioned[i];
    }
    let iterations = 0;
    const tolerancePa = 1e-5;
    const maxIterations = Math.max(160, Math.min(4 * n, 1200));
    while (residual > tolerancePa && iterations < maxIterations) {
      applyMatrix(direction, product);
      let curvature = 0;
      for (let i = 0; i < n; i++) curvature += direction[i] * product[i];
      if (!(curvature > 0) || !Number.isFinite(curvature) || !Number.isFinite(rz)) break;
      const alpha = rz / curvature;
      for (let i = 0; i < n; i++) {
        gauge[i] += alpha * direction[i];
        residualVector[i] -= alpha * product[i];
      }
      residual = 0;
      let nextRz = 0;
      for (let i = 0; i < n; i++) {
        residual = Math.max(residual, Math.abs(residualVector[i]) / diagonal[i]);
      }
      precondition(residualVector, preconditioned);
      for (let i = 0; i < n; i++) nextRz += residualVector[i] * preconditioned[i];
      iterations++;
      if (residual <= tolerancePa) break;
      const beta = nextRz / rz;
      for (let i = 0; i < n; i++) direction[i] = preconditioned[i] + beta * direction[i];
      rz = nextRz;
    }
    // Use the actual equation residual for the validity gate; the recursively
    // updated CG residual can drift after many iterations.
    applyMatrix(gauge, product);
    residual = 0;
    for (let i = 0; i < n; i++) residual = Math.max(residual, Math.abs(rhs[i] - product[i]) / diagonal[i]);
    this.diagnostics.pressureIterations = iterations;
    this.diagnostics.pressureResidualPa = residual;
    if (!Number.isFinite(residual) || residual > 0.05) {
      this.pause('numerical-paused', `Pressure solver did not converge (equation residual ${residual.toFixed(3)} Pa).`);
      return;
    }
    for (let i = 0; i < n; i++) this.pressure[i] = atm.pressurePa + gauge[i];
    this.vx.fill(0); this.vy.fill(0); this.vz.fill(0);
    let maxVelocity = 0;
    for (const f of this.faces) {
      const pa = this.pressure[f.a]; const pb = f.b >= 0 ? this.pressure[f.b] : atm.pressurePa;
      const ta = this.temperature[f.a]; const tb = f.b >= 0 ? this.temperature[f.b] : atmT;
      const molarDensity = atm.pressurePa / (R * (ta + tb) / 2);
      const velocity = f.g * (pa - pb) / molarDensity / f.area;
      maxVelocity = Math.max(maxVelocity, Math.abs(velocity));
      const component = f.axis === 0 ? this.vx : f.axis === 1 ? this.vy : this.vz;
      if (f.b >= 0) { component[f.a] += velocity / 2; component[f.b] += velocity / 2; }
      else component[f.a] += (f.axis === 2 ? -velocity : velocity) / 2;
    }
    this.diagnostics.maxDarcyVelocityMS = maxVelocity;
    if (maxVelocity > this.scenario.model.maxDarcyVelocityMS) {
      this.pause('validity-paused', `Darcy velocity ${maxVelocity.toExponential(2)} m/s exceeds the selected slow-flow validity limit.`);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (this.pressure[i] < this.scenario.model.minPressurePa || this.pressure[i] > this.scenario.model.maxPressurePa) {
        this.pause('validity-paused', `Pressure ${this.pressure[i].toFixed(0)} Pa left the supported slow-flow range.`);
        return;
      }
    }
    this.transportSpecies(dt);
    for (let i = 0; i < n; i++) {
      this.pressure[i] = this.totalGasAt(i) / capacity[i];
      if (!Number.isFinite(this.pressure[i]) || this.pressure[i] < this.scenario.model.minPressurePa || this.pressure[i] > this.scenario.model.maxPressurePa)
        this.pause('validity-paused', 'Transported gas inventory left the supported pore-pressure range.');
    }
  }

  private transportSpecies(dt: number): void {
    const n = this.cellCount;
    const atm = this.scenario.atmosphere;
    // A static pressure field is valid only for this step; subcycle fractions for positivity.
    let maxTurnover = 0;
    const outgoing = this.work.outgoing;
    outgoing.fill(0);
    for (const f of this.faces) {
      const pb = f.b >= 0 ? this.pressure[f.b] : atm.pressurePa;
      const flux = f.g * (this.pressure[f.a] - pb);
      if (flux > 0) outgoing[f.a] += flux;
      else if (f.b >= 0) outgoing[f.b] -= flux;
    }
    for (let i = 0; i < n; i++) maxTurnover = Math.max(maxTurnover, outgoing[i] * dt / Math.max(1e-12, this.totalGasAt(i)));
    const substeps = Math.max(1, Math.ceil(maxTurnover / 0.2));
    if (substeps > 200) {
      this.pause('numerical-paused', 'Gas transport requires more than 200 positivity substeps.');
      return;
    }
    const subDt = dt / substeps;
    const deltas = this.work.deltas;
    for (let sub = 0; sub < substeps; sub++) {
      for (const species of SPECIES) deltas[species].fill(0);
      for (const f of this.faces) {
        const a = f.a; const b = f.b;
        const pa = this.pressure[a]; const pb = b >= 0 ? this.pressure[b] : atm.pressurePa;
        const totalA = this.totalGasAt(a);
        const totalB = b >= 0 ? this.totalGasAt(b) : 1;
        const molarFlow = f.g * (pa - pb);
        for (const species of SPECIES) {
          const array = this.gasArray(species);
          const xA = totalA > 0 ? array[a] / totalA : 0;
          const xB = b >= 0 ? (totalB > 0 ? array[b] / totalB : 0) : this.atmosphereFraction(species);
          const advective = molarFlow * (molarFlow >= 0 ? xA : xB);
          const diffusive = f.d * (xA - xB);
          const transfer = (advective + diffusive) * subDt;
          deltas[species][a] -= transfer;
          if (b >= 0) deltas[species][b] += transfer;
          else {
            this.diagnostics.cumulativeGasBoundaryOutMol += transfer;
            this.cumulativeSpeciesBoundaryOutMol[species] += transfer;
            if (species === 'co2') this.diagnostics.cumulativeCO2OutflowKg += transfer * CO2_MOLAR_MASS;
            if (species === 'oxygen') this.diagnostics.cumulativeOxygenBoundaryInKg -= transfer * O2_MOLAR_MASS;
          }
        }
      }
      for (const species of SPECIES) {
        const array = this.gasArray(species);
        const delta = deltas[species];
        for (let i = 0; i < n; i++) {
          array[i] += delta[i];
          if (array[i] < 0) {
            // Small roundoff is corrected explicitly and recorded; material negativity pauses.
            if (array[i] < -1e-8) { this.pause('numerical-paused', `${species} became negative at cell ${i}.`); return; }
            this.diagnostics.correctedMoles += -array[i];
            this.cumulativeSpeciesCorrectionMol[species] -= array[i];
            array[i] = 0;
          }
        }
      }
      if (this.diagnostics.status !== 'running') return;
    }
  }

  private pause(status: 'validity-paused' | 'numerical-paused', warning: string): void {
    this.diagnostics.status = status;
    if (!this.diagnostics.warnings.includes(warning)) this.diagnostics.warnings.push(warning);
  }

  private updateDiagnostics(): void {
    let sourcePressurePa = 0;
    for (const { i, weight } of this.sourceCells) sourcePressurePa += weight * this.pressure[i];
    this.diagnostics.sourceExcessPressurePa = Math.max(0, sourcePressurePa - this.scenario.atmosphere.pressurePa);
    this.diagnostics.sourceProjectedAreaM2 = Math.PI * this.scenario.source.supportRadiusM ** 2;
    this.diagnostics.sourcePressureLoadN = this.diagnostics.sourceExcessPressurePa * this.diagnostics.sourceProjectedAreaM2;
    this.diagnostics.sourcePressureLoadStatus = this.diagnostics.status === 'running'
      && sourcePressurePa >= this.scenario.model.minPressurePa
      && sourcePressurePa <= this.scenario.model.maxPressurePa
      ? 'within-reduced-model' : 'outside-validity';
    this.diagnostics.gasBalanceResidualMol = this.initialGasMol + this.cumulativeGasSourceMol
      - this.diagnostics.cumulativeGasBoundaryOutMol + this.diagnostics.correctedMoles - this.totalGasMol();
    for (const species of SPECIES) {
      const array = this.gasArray(species);
      let currentMol = 0;
      for (let i = 0; i < this.cellCount; i++) currentMol += array[i];
      this.diagnostics.speciesBalanceResidualMol[species] = this.initialSpeciesMol[species]
        + this.cumulativeSpeciesSourceMol[species] - this.cumulativeSpeciesBoundaryOutMol[species]
        + this.cumulativeSpeciesCorrectionMol[species] - currentMol;
    }
    this.diagnostics.sourceEnergyResidualJ = this.cumulativeSourceHeaterJ + this.cumulativeSourceSoilJ
      + this.diagnostics.cumulativeInterventionEnergyJ - this.diagnostics.cumulativeInterventionGasSensibleJ
      - this.cumulativeSourceSensibleJ - this.cumulativeSourceLatentJ - this.cumulativeSourceReturnJ;
    this.diagnostics.resolvedHeatResidualJ = this.cumulativeResolvedHeatExpectedJ - this.cumulativeResolvedHeatActualJ;
    if (![this.diagnostics.gasBalanceResidualMol, this.diagnostics.sourceEnergyResidualJ, this.diagnostics.resolvedHeatResidualJ,
      this.diagnostics.sourceExcessPressurePa, this.diagnostics.sourcePressureLoadN,
      this.diagnostics.cumulativeReactionHeatJ, this.diagnostics.lastReactionPowerW,
      ...SPECIES.map(species => this.diagnostics.speciesBalanceResidualMol[species])].every(Number.isFinite)) {
      this.pause('numerical-paused', 'A conservation residual became non-finite.');
      this.diagnostics.sourcePressureLoadStatus = 'outside-validity';
    }
  }

  mechanicsMassState(): MechanicsMassGrid {
    const massKg = new Float64Array(this.cellCount);
    for (let i = 0; i < this.cellCount; i++) massKg[i] = this.mineral[i] + this.fuel[i] + this.water[i];
    return { ...this.scenario.domain, timeSeconds: this.timeSeconds, massKg };
  }

  snapshot(): Snapshot {
    const n = this.cellCount;
    const fields: SnapshotFields = {
      temperatureK: new Float32Array(n), oxygen: new Float32Array(n), co2: new Float32Array(n),
      backgroundGas: new Float32Array(n), waterVapor: new Float32Array(n), fuel: new Float32Array(n),
      mineralKg: new Float32Array(n), rootFuelKg: new Float32Array(n),
      materialClass: new Float32Array(n), dryDensityKgM3: new Float32Array(n),
      thermalConductivityWmK: new Float32Array(n),
      reactionRateKgS: new Float32Array(n), reactionPowerWm3: new Float32Array(n),
      moisture: new Float32Array(n), pressurePa: new Float32Array(n), porosity: new Float32Array(n),
      intrinsicPermeability: new Float32Array(n), effectivePermeability: new Float32Array(n),
      effectiveGasDiffusivity: new Float32Array(n), peatMask: new Float32Array(n),
      fluxXMps: Float32Array.from(this.vx), fluxYMps: Float32Array.from(this.vy), fluxZMps: Float32Array.from(this.vz),
    };
    let peakTemperatureK = -Infinity; let totalFuelKg = 0;
    for (let i = 0; i < n; i++) {
      const totalGas = this.totalGasAt(i);
      fields.temperatureK[i] = this.temperature[i];
      fields.oxygen[i] = totalGas > 0 ? this.oxygen[i] / totalGas : 0;
      fields.co2[i] = totalGas > 0 ? this.co2[i] / totalGas : 0;
      fields.backgroundGas[i] = totalGas > 0 ? this.background[i] / totalGas : 0;
      fields.waterVapor[i] = totalGas > 0 ? this.vapor[i] / totalGas : 0;
      fields.fuel[i] = this.fuel[i];
      fields.mineralKg[i] = this.mineral[i];
      fields.materialClass[i] = this.materialClass[i];
      fields.dryDensityKgM3[i] = this.dryDensity[i];
      fields.thermalConductivityWmK[i] = this.thermalConductivity[i];
      fields.rootFuelKg[i] = this.rootFuel[i];
      fields.reactionRateKgS[i] = this.reactionRate[i];
      fields.reactionPowerWm3[i] = this.reactionRate[i] * this.scenario.model.heatOfCombustionJkg / this.cellVolume;
      fields.moisture[i] = this.water[i] / (this.materials.waterDensityKgM3 * this.porosity[i] * this.cellVolume);
      fields.pressurePa[i] = this.pressure[i];
      fields.porosity[i] = this.porosity[i];
      fields.intrinsicPermeability[i] = Math.sqrt(this.intrinsicH[i] * this.intrinsicV[i]);
      fields.effectivePermeability[i] = Math.sqrt(this.effectiveH[i] * this.effectiveV[i]);
      fields.effectiveGasDiffusivity[i] = this.effectiveDiffusivity[i];
      fields.peatMask[i] = this.peatMask[i];
      peakTemperatureK = Math.max(peakTemperatureK, this.temperature[i]);
      totalFuelKg += this.fuel[i];
    }
    return {
      timeSeconds: this.timeSeconds, nx: this.nx, ny: this.ny, nz: this.nz,
      widthM: this.scenario.domain.widthM, lengthM: this.scenario.domain.lengthM, depthM: this.scenario.domain.depthM,
      fields, dryIceMassKg: this.dryIceMassKg,
      dryIceDiameterM: diameterFromMass(this.dryIceMassKg, this.scenario.source.densityKgM3),
      dryIceTemperatureK: this.dryIceTemperatureK, heaterPowerW: this.heaterPowerW,
      heaterEnergyJ: this.heaterEnergyJ, peakTemperatureK, totalFuelKg,
      diagnostics: { ...this.diagnostics, warnings: [...this.diagnostics.warnings],
        speciesBalanceResidualMol: { ...this.diagnostics.speciesBalanceResidualMol } },
    };
  }

  sampleAt(xM: number, yM: number, depthM: number): ProbeSample {
    if (![xM, yM, depthM].every(Number.isFinite) || xM < 0 || xM > this.scenario.domain.widthM || yM < 0 || yM > this.scenario.domain.lengthM || depthM < 0 || depthM > this.scenario.domain.depthM) {
      throw new Error('Probe lies outside the modeled domain.');
    }
    const x = clamp(Math.floor(xM / this.dx), 0, this.nx - 1);
    const y = clamp(Math.floor(yM / this.dy), 0, this.ny - 1);
    const z = clamp(Math.floor(depthM / this.dz), 0, this.nz - 1);
    const i = this.idx(x, y, z);
    const totalGas = this.totalGasAt(i);
    const o2 = totalGas > 0 ? this.oxygen[i] / totalGas : 0;
    return { xM, yM, depthM, materialClass: this.materialClass[i],
      dryDensityKgM3: this.dryDensity[i], thermalConductivityWmK: this.thermalConductivity[i],
      porosity: this.porosity[i], intrinsicPermeabilityM2: Math.sqrt(this.intrinsicH[i] * this.intrinsicV[i]),
      rootFuelKg: this.rootFuel[i], temperatureK: this.temperature[i], oxygenMoleFraction: o2,
      co2MoleFraction: totalGas > 0 ? this.co2[i] / totalGas : 0,
      oxygenPartialPressurePa: o2 * this.pressure[i], pressurePa: this.pressure[i],
      moistureSaturation: this.water[i] / (this.materials.waterDensityKgM3 * this.porosity[i] * this.cellVolume),
      fuelKg: this.fuel[i], darcyVelocityMS: [this.vx[i], this.vy[i], this.vz[i]] };
  }

  serialize(): SerializedSimulation {
    const arrays: Record<string, number[]> = {};
    for (const [name, array] of Object.entries({
      temperature: this.temperature, oxygen: this.oxygen, co2: this.co2, background: this.background, vapor: this.vapor,
      fuel: this.fuel, rootFuel: this.rootFuel, mineral: this.mineral, reactionRate: this.reactionRate,
      water: this.water, dryDensity: this.dryDensity, solidHeatCapacity: this.solidHeatCapacity,
      thermalConductivity: this.thermalConductivity, porosity: this.porosity, intrinsicH: this.intrinsicH,
      intrinsicV: this.intrinsicV, effectiveH: this.effectiveH, effectiveV: this.effectiveV,
      effectiveDiffusivity: this.effectiveDiffusivity, peatMask: this.peatMask, pressure: this.pressure,
      vx: this.vx, vy: this.vy, vz: this.vz,
    })) arrays[name] = Array.from(array);
    arrays.__ledger = [this.initialGasMol, this.cumulativeGasSourceMol, this.cumulativeSourceHeaterJ,
      this.cumulativeSourceSoilJ, this.cumulativeSourceSensibleJ, this.cumulativeSourceLatentJ,
      this.cumulativeSourceReturnJ, this.cumulativeResolvedHeatExpectedJ, this.cumulativeResolvedHeatActualJ];
    arrays.__speciesLedger = [this.initialSpeciesMol, this.cumulativeSpeciesSourceMol,
      this.cumulativeSpeciesBoundaryOutMol, this.cumulativeSpeciesCorrectionMol]
      .flatMap(totals => SPECIES.map(species => totals[species]));
    return { formatVersion: 1, scenario: JSON.parse(JSON.stringify(this.scenario)) as Scenario,
      timeSeconds: this.timeSeconds, dryIceMassKg: this.dryIceMassKg,
      dryIceTemperatureK: this.dryIceTemperatureK, heaterEnergyJ: this.heaterEnergyJ,
      heaterEnabled: this.heaterEnabled, heaterGenerationWm3: this.heaterGenerationWm3,
      events: this.events.map(e => ({ ...e })), diagnostics: { ...this.diagnostics, warnings: [...this.diagnostics.warnings],
        speciesBalanceResidualMol: { ...this.diagnostics.speciesBalanceResidualMol } }, arrays };
  }

  static restore(data: SerializedSimulation): Simulation {
    if (data.formatVersion !== 1) throw new Error('Unsupported checkpoint format.');
    const sim = new Simulation(data.scenario);
    if (!Number.isFinite(data.timeSeconds) || data.timeSeconds < 0 || !Number.isFinite(data.dryIceMassKg) || data.dryIceMassKg < 0 || data.dryIceMassKg > data.scenario.source.initialMassKg) {
      throw new Error('Invalid checkpoint scalar state.');
    }
    if (!Number.isFinite(data.dryIceTemperatureK) || data.dryIceTemperatureK < 150 || data.dryIceTemperatureK > sim.materials.co2SublimationK
      || !Number.isFinite(data.heaterEnergyJ) || data.heaterEnergyJ < 0
      || !Number.isFinite(data.heaterGenerationWm3) || data.heaterGenerationWm3 < 0 || data.heaterGenerationWm3 > 1e6) {
      throw new Error('Invalid checkpoint source/heater state.');
    }
    const assignments: Record<string, Float64Array> = {
      temperature: sim.temperature, oxygen: sim.oxygen, co2: sim.co2, background: sim.background,
      vapor: sim.vapor, fuel: sim.fuel, rootFuel: sim.rootFuel, mineral: sim.mineral, reactionRate: sim.reactionRate,
      water: sim.water, dryDensity: sim.dryDensity,
      solidHeatCapacity: sim.solidHeatCapacity, thermalConductivity: sim.thermalConductivity,
      porosity: sim.porosity, intrinsicH: sim.intrinsicH, intrinsicV: sim.intrinsicV,
      effectiveH: sim.effectiveH, effectiveV: sim.effectiveV,
      effectiveDiffusivity: sim.effectiveDiffusivity, peatMask: sim.peatMask, pressure: sim.pressure,
      vx: sim.vx, vy: sim.vy, vz: sim.vz,
    };
    const initialRootFuel = Array.from(sim.rootFuel);
    const initialFuel = Array.from(sim.fuel);
    for (const [name, array] of Object.entries(assignments)) {
      let values = data.arrays[name];
      if (values === undefined && name === 'mineral') values = Array.from(sim.mineral);
      if (values === undefined && name === 'reactionRate') values = Array(sim.cellCount).fill(0);
      if (values === undefined && name === 'rootFuel') values = initialRootFuel.map((initial, i) =>
        initial * Math.min(1, data.arrays.fuel[i] / Math.max(1e-12, initialFuel[i])));
      if (!Array.isArray(values) || values.length !== sim.cellCount || values.some(v => !Number.isFinite(v))) throw new Error(`Invalid checkpoint array ${name}.`);
      array.set(values);
    }
    // Checkpoints carry material fields, so a restored conductivity must also
    // refresh the otherwise static face coefficients used by heat conduction.
    sim.refreshThermalConductances();
    for (const name of ['oxygen', 'co2', 'background', 'vapor', 'fuel', 'rootFuel', 'mineral', 'reactionRate', 'water']) {
      if (Array.from(assignments[name]).some(value => value < 0)) throw new Error(`Negative inventory in checkpoint array ${name}.`);
    }
    if (data.arrays.temperature.some(value => value < 150 || value > 1200)
      || data.arrays.porosity.some(value => value <= 0 || value >= 1)
      || data.arrays.pressure.some(value => value <= 0)) throw new Error('Checkpoint temperature, porosity, or pressure is outside supported limits.');
    if (sim.hasUnsupportedFrozenWater()) throw new Error('Checkpoint contains liquid water below 273.15 K without an ice state.');
    const ledger = data.arrays.__ledger;
    if (!Array.isArray(ledger) || ledger.length !== 9 || ledger.some(v => !Number.isFinite(v))) throw new Error('Invalid checkpoint ledger.');
    const rootFuelConsumedKg = data.diagnostics.cumulativeRootFuelConsumedKg ??
      sim.rootFuel.reduce((sum, value, i) => sum + Math.max(0, initialRootFuel[i] - value), 0);
    if (![data.diagnostics.cumulativeReactionHeatJ, rootFuelConsumedKg, data.diagnostics.lastReactionPowerW,
      data.diagnostics.reactingCellCount].every(v => Number.isFinite(v) && v >= 0)
      || !Number.isInteger(data.diagnostics.reactingCellCount)) throw new Error('Invalid checkpoint reaction diagnostics.');
    [sim.initialGasMol, sim.cumulativeGasSourceMol, sim.cumulativeSourceHeaterJ,
      sim.cumulativeSourceSoilJ, sim.cumulativeSourceSensibleJ, sim.cumulativeSourceLatentJ,
      sim.cumulativeSourceReturnJ, sim.cumulativeResolvedHeatExpectedJ, sim.cumulativeResolvedHeatActualJ] = ledger;
    const speciesLedger = data.arrays.__speciesLedger;
    if (speciesLedger !== undefined) {
      if (!Array.isArray(speciesLedger) || speciesLedger.length !== 16 || speciesLedger.some(v => !Number.isFinite(v))) {
        throw new Error('Invalid checkpoint species ledger.');
      }
      [sim.initialSpeciesMol, sim.cumulativeSpeciesSourceMol, sim.cumulativeSpeciesBoundaryOutMol,
        sim.cumulativeSpeciesCorrectionMol].forEach((totals, group) => {
        SPECIES.forEach((species, index) => { totals[species] = speciesLedger[group * 4 + index]; });
      });
    } else {
      // Legacy checkpoints did not retain component fluxes. Begin component accounting
      // at the restored state; the original aggregate ledger still spans the full run.
      for (const species of SPECIES) {
        const array = sim.gasArray(species);
        let currentMol = 0;
        for (let i = 0; i < sim.cellCount; i++) currentMol += array[i];
        sim.initialSpeciesMol[species] = currentMol;
      }
    }
    sim.timeSeconds = data.timeSeconds; sim.dryIceMassKg = data.dryIceMassKg;
    sim.dryIceTemperatureK = data.dryIceTemperatureK; sim.heaterEnergyJ = data.heaterEnergyJ;
    sim.heaterEnabled = data.heaterEnabled; sim.heaterGenerationWm3 = data.heaterGenerationWm3;
    sim.events = data.events.map(e => ({ ...e }));
    sim.diagnostics = { ...data.diagnostics, cumulativeRootFuelConsumedKg: rootFuelConsumedKg,
      cumulativeOxygenInterventionMol: data.diagnostics.cumulativeOxygenInterventionMol ?? 0,
      speciesBalanceResidualMol: zeroSpecies(),
      warnings: [...data.diagnostics.warnings] };
    sim.updateDiagnostics();
    if (Math.abs(sim.diagnostics.gasBalanceResidualMol) > 1e-6 * Math.max(1, sim.initialGasMol)) throw new Error('Checkpoint gas inventory does not match its conservation ledger.');
    for (const species of SPECIES) {
      if (Math.abs(sim.diagnostics.speciesBalanceResidualMol[species]) > 1e-6 * Math.max(1, sim.initialSpeciesMol[species])) {
        throw new Error(`Checkpoint ${species} inventory does not match its conservation ledger.`);
      }
    }
    return sim;
  }

  dispose(): void { /* No timers or external handles belong to the solver. */ }
}

export function createSimulation(scenario: Scenario): Simulation { return new Simulation(scenario); }
export function advance(sim: Simulation, targetTimeSeconds: number): Snapshot { return sim.advanceTo(targetTimeSeconds); }
