/**
 * Short-time, radial aggregate of a 3D snapshot. This is a distinct exploratory
 * calculation, never an extension of the slow Darcy model or a blast solver.
 */
export interface FastEventOptions {
  /** Physical transient duration, 0 < durationS <= 2. Default 2 s. */
  durationS?: number;
  /** Number of recorded states including t=0; 2..100. Default 61. */
  frameCount?: number;
}

export type FastEventStatus = 'complete' | 'validity-paused';

export interface FastEventFrame {
  /** Separate event clock, seconds since the short-time model started. */
  eventTimeS: number;
  /** Isothermal ideal-gas shell storage estimate, Pa. */
  shellPressurePa: Float32Array;
  shellCO2MoleFraction: Float32Array;
  /** Assumed effective-stress yield ratio (>=0), not a fracture prediction. */
  shellYieldIndex: Float32Array;
  /** 0..1 illustrative accumulated damage index, not physical displacement. */
  shellDamage: Float32Array;
  sourceExcessPressurePa: number;
  sourcePressureLoadN: number;
  status: 'running' | 'complete' | 'validity-paused';
}

export interface FastEventDiagnostics {
  initialTotalGasMol: number;
  remainingTotalGasMol: number;
  cumulativeBoundaryOutMol: number;
  gasBalanceResidualMol: number;
  initialCO2Mol: number;
  remainingCO2Mol: number;
  cumulativeCO2BoundaryOutMol: number;
  co2BalanceResidualMol: number;
  /** Flux removed by positivity limiter; actual transfers remain conservative. */
  limitedFluxMol: number;
  maxPressurePa: number;
  maxFaceGasSpeedMS: number;
  maxDamage: number;
  steps: number;
  warnings: string[];
}

export interface FastEventAssumptions {
  gasTemperature: 'fixed-from-initial-snapshot';
  spatialReduction: 'eight-radial-cell-groups';
  momentum: 'finite-relaxation-to-porous-conductance';
  soilResponse: 'uncalibrated-effective-stress-yield-index';
  atmosphere: 'top-surface-open-only' | 'sides-open-only' | 'top-and-sides-open' | 'closed-gas-boundaries';
  overburdenPa: number;
  cohesionPa: number;
  biotCoefficient: number;
  damageRateS: number;
  maxDamagePermeabilityMultiplier: number;
  maxSupportedPressurePa: number;
  maxSupportedFaceGasSpeedMS: number;
}

export interface FastEventRun {
  modelId: 'radial-compressible-relaxation-v0.1';
  status: FastEventStatus;
  /** Absolute slow-solver time from which event initial state was sampled. */
  startSolverTimeS: number;
  durationS: number;
  shellRadiusM: number[];
  sourceProjectedAreaM2: number;
  frames: FastEventFrame[];
  diagnostics: FastEventDiagnostics;
  assumptions: FastEventAssumptions;
  limitations: string[];
}
