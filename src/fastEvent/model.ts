import { resolveMaterials } from '../sim/materials';
import { validateScenario } from '../sim/scenario';
import type { Scenario, Snapshot } from '../sim/types';
import type { FastEventAssumptions, FastEventDiagnostics, FastEventFrame, FastEventOptions, FastEventRun } from './types';

const R = 8.314462618; // J/(mol K)
const G = 9.80665; // m/s²
const MAX_DURATION_S = 2;
const MAX_FRAMES = 100;
const INTERNAL_STEP_S = 0.001;
const ATMOSPHERIC_SOUND_SCALE_MS = 250; // only sets flux relaxation time; no shock solver

interface Shell {
  radiusM: number;
  bulkVolumeM3: number;
  gasVolumeM3: number;
  temperatureK: number;
  basePermeabilityM2: number;
  co2Mol: number;
  otherMol: number;
  damage: number;
  yieldIndex: number;
}

interface Face {
  left: number;
  right: number; // -1 means atmosphere through the top boundary
  areaM2: number;
  distanceM: number;
  relaxationS: number;
  molarFluxMolS: number;
}

function cellCenterDistance(index: number, snapshot: Snapshot, source: Scenario['source']): number {
  const x = index % snapshot.nx;
  const y = Math.floor(index / snapshot.nx) % snapshot.ny;
  const z = Math.floor(index / (snapshot.nx * snapshot.ny));
  const dx = (x + 0.5) * snapshot.widthM / snapshot.nx - source.centerXM;
  const dy = (y + 0.5) * snapshot.lengthM / snapshot.ny - source.centerYM;
  const dz = (z + 0.5) * snapshot.depthM / snapshot.nz - source.centerDepthM;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function trilinearSourceCellIndices(scenario: Scenario, snapshot: Snapshot): number[] {
  const dx = snapshot.widthM / snapshot.nx;
  const dy = snapshot.lengthM / snapshot.ny;
  const dz = snapshot.depthM / snapshot.nz;
  const fx = scenario.source.centerXM / dx - 0.5;
  const fy = scenario.source.centerYM / dy - 0.5;
  const fz = scenario.source.centerDepthM / dz - 0.5;
  const x0 = Math.floor(fx); const y0 = Math.floor(fy); const z0 = Math.floor(fz);
  const indices: number[] = [];
  for (let kk = 0; kk <= 1; kk++) for (let jj = 0; jj <= 1; jj++) for (let ii = 0; ii <= 1; ii++) {
    const x = x0 + ii; const y = y0 + jj; const z = z0 + kk;
    if (x < 0 || x >= snapshot.nx || y < 0 || y >= snapshot.ny || z < 0 || z >= snapshot.nz) continue;
    const weight = (ii ? fx - x0 : 1 - fx + x0) * (jj ? fy - y0 : 1 - fy + y0) * (kk ? fz - z0 : 1 - fz + z0);
    if (weight > 0) indices.push((z * snapshot.ny + y) * snapshot.nx + x);
  }
  return indices;
}

function validateInput(scenario: Scenario, snapshot: Snapshot, options: FastEventOptions): Required<FastEventOptions> {
  const scenarioResult = validateScenario(scenario);
  if (!scenarioResult.valid) throw new Error(`Invalid fast-event scenario: ${scenarioResult.errors.join(' ')}`);
  const durationS = options.durationS ?? 2;
  const frameCount = options.frameCount ?? 61;
  if (!Number.isFinite(durationS) || durationS <= 0 || durationS > MAX_DURATION_S) throw new Error('Fast-event duration must be within (0, 2] seconds.');
  if (!Number.isInteger(frameCount) || frameCount < 2 || frameCount > MAX_FRAMES) throw new Error('Fast-event frameCount must be an integer from 2 to 100.');
  const d = scenario.domain;
  if (snapshot.nx !== d.nx || snapshot.ny !== d.ny || snapshot.nz !== d.nz
    || Math.abs(snapshot.widthM - d.widthM) > 1e-9 || Math.abs(snapshot.lengthM - d.lengthM) > 1e-9
    || Math.abs(snapshot.depthM - d.depthM) > 1e-9) throw new Error('Fast-event snapshot/grid does not match scenario.');
  const count = d.nx * d.ny * d.nz;
  for (const name of ['temperatureK', 'pressurePa', 'porosity', 'moisture', 'co2', 'effectivePermeability'] as const) {
    if (snapshot.fields[name].length !== count) throw new Error(`Fast-event field ${name} has the wrong length.`);
  }
  for (let i = 0; i < count; i++) {
    const f = snapshot.fields;
    if (!Number.isFinite(f.temperatureK[i]) || f.temperatureK[i] < 150 || f.temperatureK[i] > 1200
      || !Number.isFinite(f.pressurePa[i]) || f.pressurePa[i] <= 0
      || !Number.isFinite(f.porosity[i]) || f.porosity[i] <= 0 || f.porosity[i] >= 1
      || !Number.isFinite(f.moisture[i]) || f.moisture[i] < 0 || f.moisture[i] >= 1
      || !Number.isFinite(f.co2[i]) || f.co2[i] < 0 || f.co2[i] > 1
      || !Number.isFinite(f.effectivePermeability[i]) || f.effectivePermeability[i] <= 0) {
      throw new Error(`Fast-event snapshot has an invalid thermodynamic or gas property at cell ${i}.`);
    }
  }
  return { durationS, frameCount };
}

function aggregateShells(scenario: Scenario, snapshot: Snapshot): Shell[] {
  const count = snapshot.nx * snapshot.ny * snapshot.nz;
  const source = new Set(trilinearSourceCellIndices(scenario, snapshot));
  if (source.size === 0) throw new Error('No source support cell exists for fast-event remapping.');
  const remaining: number[] = [];
  for (let i = 0; i < count; i++) if (!source.has(i)) remaining.push(i);
  remaining.sort((a, b) => cellCenterDistance(a, snapshot, scenario.source) - cellCenterDistance(b, snapshot, scenario.source) || a - b);
  const shellCount = Math.min(8, 1 + Math.floor(remaining.length / 2));
  const groups: number[][] = Array.from({ length: shellCount }, () => []);
  groups[0] = [...source].sort((a, b) => a - b);
  for (let rank = 0; rank < remaining.length; rank++) {
    const ring = 1 + Math.min(shellCount - 2, Math.floor(rank * (shellCount - 1) / remaining.length));
    groups[ring].push(remaining[rank]);
  }
  const cellVolume = snapshot.widthM * snapshot.lengthM * snapshot.depthM / count;
  return groups.map(indices => {
    let bulkVolumeM3 = 0; let gasVolumeM3 = 0; let co2Mol = 0; let otherMol = 0;
    let nT = 0; let permeabilityLogSum = 0; let radialSum = 0;
    for (const i of indices) {
      const f = snapshot.fields;
      const poreGasVolume = f.porosity[i] * (1 - f.moisture[i]) * cellVolume;
      const totalMol = f.pressurePa[i] * poreGasVolume / (R * f.temperatureK[i]);
      bulkVolumeM3 += cellVolume;
      gasVolumeM3 += poreGasVolume;
      co2Mol += totalMol * f.co2[i];
      otherMol += totalMol * (1 - f.co2[i]);
      nT += totalMol * f.temperatureK[i];
      permeabilityLogSum += Math.log(f.effectivePermeability[i]);
      radialSum += cellCenterDistance(i, snapshot, scenario.source);
    }
    const totalMol = co2Mol + otherMol;
    return {
      radiusM: radialSum / indices.length,
      bulkVolumeM3, gasVolumeM3,
      temperatureK: nT / totalMol,
      basePermeabilityM2: Math.exp(permeabilityLogSum / indices.length),
      co2Mol, otherMol, damage: 0, yieldIndex: 0,
    };
  });
}

function makeFaces(shells: Shell[], scenario: Scenario): Face[] {
  const faces: Face[] = [];
  for (let i = 0; i < shells.length - 1; i++) {
    const a = shells[i]; const b = shells[i + 1];
    const distanceM = Math.max(0.05, b.radiusM - a.radiusM);
    const radiusM = Math.max(scenario.source.supportRadiusM, (a.radiusM + b.radiusM) / 2);
    const areaM2 = Math.max(1e-6, Math.min(4 * Math.PI * radiusM ** 2,
      Math.min(a.bulkVolumeM3, b.bulkVolumeM3) / distanceM));
    faces.push({ left: i, right: i + 1, areaM2, distanceM,
      relaxationS: Math.max(0.005, distanceM / ATMOSPHERIC_SOUND_SCALE_MS), molarFluxMolS: 0 });
  }
  if (scenario.atmosphere.topGasBoundary === 'atmospheric') {
    faces.push({ left: shells.length - 1, right: -1,
      areaM2: scenario.domain.widthM * scenario.domain.lengthM,
      distanceM: Math.max(0.1, scenario.domain.depthM / 2),
      relaxationS: Math.max(0.005, scenario.domain.depthM / (2 * ATMOSPHERIC_SOUND_SCALE_MS)),
      molarFluxMolS: 0 });
  }
  if (scenario.atmosphere.sideGasBoundary === 'atmospheric') {
    const sideDistanceM = Math.max(0.1, Math.min(scenario.domain.widthM, scenario.domain.lengthM) / 2);
    faces.push({ left: shells.length - 1, right: -1,
      areaM2: 2 * (scenario.domain.widthM + scenario.domain.lengthM) * scenario.domain.depthM,
      distanceM: sideDistanceM,
      relaxationS: Math.max(0.005, sideDistanceM / ATMOSPHERIC_SOUND_SCALE_MS),
      molarFluxMolS: 0 });
  }
  return faces;
}

function shellPressure(shell: Shell): number {
  return (shell.co2Mol + shell.otherMol) * R * shell.temperatureK / shell.gasVolumeM3;
}
function totalGas(shells: Shell[]): number { return shells.reduce((sum, shell) => sum + shell.co2Mol + shell.otherMol, 0); }
function totalCO2(shells: Shell[]): number { return shells.reduce((sum, shell) => sum + shell.co2Mol, 0); }

/**
 * Compute a bounded short-time radial pressure/gas transient and illustrative soil
 * effective-stress damage indicator from one 3D solver snapshot. The gas equations
 * conserve moles but omit shocks, nonideal CO₂, multidimensional crack geometry,
 * soil displacement mechanics, and measured failure parameters.
 */
export function runFastEvent(scenario: Scenario, initialSnapshot: Snapshot, options: FastEventOptions = {}): FastEventRun {
  const { durationS, frameCount } = validateInput(scenario, initialSnapshot, options);
  const materials = resolveMaterials(scenario);
  const shells = aggregateShells(scenario, initialSnapshot);
  const faces = makeFaces(shells, scenario);
  const atmospherePa = scenario.atmosphere.pressurePa;
  const atmosphereCO2 = scenario.atmosphere.co2MoleFraction;
  const sourceProjectedAreaM2 = Math.PI * scenario.source.supportRadiusM ** 2;
  const assumptions: FastEventAssumptions = {
    gasTemperature: 'fixed-from-initial-snapshot', spatialReduction: 'eight-radial-cell-groups',
    momentum: 'finite-relaxation-to-porous-conductance',
    soilResponse: 'uncalibrated-effective-stress-yield-index',
    atmosphere: scenario.atmosphere.topGasBoundary === 'atmospheric'
      ? scenario.atmosphere.sideGasBoundary === 'atmospheric' ? 'top-and-sides-open' : 'top-surface-open-only'
      : scenario.atmosphere.sideGasBoundary === 'atmospheric' ? 'sides-open-only' : 'closed-gas-boundaries',
    overburdenPa: scenario.soil.bulkDensityKgM3 * G * scenario.source.centerDepthM,
    cohesionPa: materials.fastCohesionPa, biotCoefficient: materials.fastBiot,
    damageRateS: materials.fastDamageRateS,
    maxDamagePermeabilityMultiplier: materials.fastDamagePermeabilityFactor,
    maxSupportedPressurePa: materials.fastMaxPressurePa,
    maxSupportedFaceGasSpeedMS: materials.fastMaxSpeedMS,
  };
  const diagnostics: FastEventDiagnostics = {
    initialTotalGasMol: totalGas(shells), remainingTotalGasMol: totalGas(shells),
    cumulativeBoundaryOutMol: 0, gasBalanceResidualMol: 0,
    initialCO2Mol: totalCO2(shells), remainingCO2Mol: totalCO2(shells),
    cumulativeCO2BoundaryOutMol: 0, co2BalanceResidualMol: 0,
    limitedFluxMol: 0, maxPressurePa: 0, maxFaceGasSpeedMS: 0,
    maxDamage: 0, steps: 0, warnings: [],
  };
  const frames: FastEventFrame[] = [];
  let status: FastEventRun['status'] = 'complete';
  let eventTimeS = 0;
  const updateDiagnostics = () => {
    diagnostics.remainingTotalGasMol = totalGas(shells);
    diagnostics.remainingCO2Mol = totalCO2(shells);
    diagnostics.gasBalanceResidualMol = diagnostics.initialTotalGasMol - diagnostics.cumulativeBoundaryOutMol - diagnostics.remainingTotalGasMol;
    diagnostics.co2BalanceResidualMol = diagnostics.initialCO2Mol - diagnostics.cumulativeCO2BoundaryOutMol - diagnostics.remainingCO2Mol;
    diagnostics.maxDamage = Math.max(...shells.map(s => s.damage));
    diagnostics.maxPressurePa = Math.max(diagnostics.maxPressurePa, ...shells.map(shellPressure));
  };
  const capture = (frameStatus: FastEventFrame['status']) => {
    updateDiagnostics();
    const pressure = Float32Array.from(shells.map(shellPressure));
    const co2 = Float32Array.from(shells.map(s => s.co2Mol / (s.co2Mol + s.otherMol)));
    const yieldIndex = Float32Array.from(shells.map(s => s.yieldIndex));
    const damage = Float32Array.from(shells.map(s => s.damage));
    const sourceExcessPressurePa = Math.max(0, shellPressure(shells[0]) - atmospherePa);
    frames.push({ eventTimeS, shellPressurePa: pressure, shellCO2MoleFraction: co2,
      shellYieldIndex: yieldIndex, shellDamage: damage,
      sourceExcessPressurePa, sourcePressureLoadN: sourceExcessPressurePa * sourceProjectedAreaM2,
      status: frameStatus });
  };
  let initialMaxCellPressure = 0;
  for (const pressure of initialSnapshot.fields.pressurePa) initialMaxCellPressure = Math.max(initialMaxCellPressure, pressure);
  diagnostics.maxPressurePa = initialMaxCellPressure;
  if (initialMaxCellPressure > materials.fastMaxPressurePa || shells.some(s => shellPressure(s) > materials.fastMaxPressurePa)) {
    status = 'validity-paused';
    diagnostics.warnings.push('Initial pressure exceeds the bounded radial event model. No fast transient calculated.');
    capture('validity-paused');
  } else {
    capture('running');
    for (let frameIndex = 1; frameIndex < frameCount && status === 'complete'; frameIndex++) {
      const frameTargetS = durationS * frameIndex / (frameCount - 1);
      while (eventTimeS + 1e-12 < frameTargetS && status === 'complete') {
        const dt = Math.min(INTERNAL_STEP_S, frameTargetS - eventTimeS);
        const pressures = shells.map(shellPressure);
        const nextDamage = shells.map((shell, i) => {
          const effectiveStressDeficitPa = materials.fastBiot * Math.max(0, pressures[i] - atmospherePa)
            - assumptions.overburdenPa - materials.fastCohesionPa;
          shell.yieldIndex = Math.max(0, effectiveStressDeficitPa / materials.fastCohesionPa);
          return 1 - (1 - shell.damage) * Math.exp(-materials.fastDamageRateS * shell.yieldIndex * dt);
        });
        const nextFluxes: number[] = [];
        for (const face of faces) {
          const left = shells[face.left];
          const right = face.right >= 0 ? shells[face.right] : null;
          const rightPressure = right ? pressures[face.right] : atmospherePa;
          const rightTemperature = right ? right.temperatureK : scenario.atmosphere.temperatureC + 273.15;
          const leftK = left.basePermeabilityM2 * (1 + (materials.fastDamagePermeabilityFactor - 1) * nextDamage[face.left]);
          const rightK = right ? right.basePermeabilityM2 * (1 + (materials.fastDamagePermeabilityFactor - 1) * nextDamage[face.right]) : leftK;
          const k = 2 * leftK * rightK / (leftK + rightK);
          const referenceConcentration = (pressures[face.left] + rightPressure) / (R * (left.temperatureK + rightTemperature));
          const conductance = k / materials.gasViscosityPaS * face.areaM2 / face.distanceM * referenceConcentration;
          const equilibriumFlux = conductance * (pressures[face.left] - rightPressure);
          const flux = face.molarFluxMolS + (1 - Math.exp(-dt / face.relaxationS)) * (equilibriumFlux - face.molarFluxMolS);
          const speed = Math.abs(flux) / Math.max(1e-12, referenceConcentration * face.areaM2);
          diagnostics.maxFaceGasSpeedMS = Math.max(diagnostics.maxFaceGasSpeedMS, speed);
          if (!Number.isFinite(flux) || speed > materials.fastMaxSpeedMS) {
            status = 'validity-paused';
            diagnostics.warnings.push('Fast-event face speed exceeded the bounded reduced model; transient paused without a shock extrapolation.');
            break;
          }
          nextFluxes.push(flux);
        }
        if (status !== 'complete') break;
        for (let i = 0; i < shells.length; i++) shells[i].damage = nextDamage[i];
        for (let f = 0; f < faces.length; f++) {
          const face = faces[f];
          let transfer = nextFluxes[f] * dt;
          const donor = transfer >= 0 ? shells[face.left] : face.right >= 0 ? shells[face.right] : null;
          if (donor) {
            const donorMol = donor.co2Mol + donor.otherMol;
            const limited = Math.min(Math.abs(transfer), 0.5 * donorMol);
            diagnostics.limitedFluxMol += Math.abs(transfer) - limited;
            transfer = Math.sign(transfer) * limited;
          }
          face.molarFluxMolS = transfer / dt;
          const co2Fraction = donor ? donor.co2Mol / (donor.co2Mol + donor.otherMol) : atmosphereCO2;
          const transferCO2 = transfer * co2Fraction;
          shells[face.left].co2Mol -= transferCO2;
          shells[face.left].otherMol -= transfer - transferCO2;
          if (face.right >= 0) {
            shells[face.right].co2Mol += transferCO2;
            shells[face.right].otherMol += transfer - transferCO2;
          } else {
            diagnostics.cumulativeBoundaryOutMol += transfer;
            diagnostics.cumulativeCO2BoundaryOutMol += transferCO2;
          }
        }
        eventTimeS += dt;
        diagnostics.steps++;
        if (shells.some(s => s.co2Mol < -1e-9 || s.otherMol < -1e-9 || !Number.isFinite(shellPressure(s)))
          || shells.some(s => shellPressure(s) > materials.fastMaxPressurePa)
          || Math.abs(diagnostics.initialTotalGasMol - diagnostics.cumulativeBoundaryOutMol - totalGas(shells)) > 1e-7 * Math.max(1, diagnostics.initialTotalGasMol)) {
          status = 'validity-paused';
          diagnostics.warnings.push('Fast-event pressure or gas inventory left the bounded reduced model; transient paused.');
        }
      }
      capture(status === 'complete' && frameIndex === frameCount - 1 ? 'complete' : status === 'complete' ? 'running' : 'validity-paused');
    }
  }
  updateDiagnostics();
  if (diagnostics.limitedFluxMol > 0.01 * diagnostics.initialTotalGasMol) {
    diagnostics.warnings.push('More than 1% of initial gas inventory was subject to the conservative flux limiter; temporal resolution may be inadequate.');
  }
  return {
    modelId: 'radial-compressible-relaxation-v0.1', status,
    startSolverTimeS: initialSnapshot.timeSeconds, durationS,
    shellRadiusM: shells.map(s => s.radiusM), sourceProjectedAreaM2,
    frames, diagnostics, assumptions,
    limitations: [
      'Unvalidated radial aggregation of a 3D state; it does not resolve directional cracks or soil displacement.',
      'Finite flux relaxation is a damped porous-gas approximation, not an acoustic shockwave or blast calculation.',
      'Effective-stress threshold, cohesion, Biot coefficient, damage rate, and permeability response are assumed demonstration values.',
      'Gas is ideal and isothermal during this short event; high-pressure CO₂ phase behavior and mechanical work are omitted.',
    ],
  };
}
