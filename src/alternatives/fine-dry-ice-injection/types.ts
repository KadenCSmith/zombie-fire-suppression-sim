export interface ParticleInjectionSettings {
  particleDiameterM: number; sizeProvenance: string;
  effectiveConductivityWmK: number; heatTransferProvenance: string;
  solidDensityKgM3: number; hoseResidenceS: number; probeResidenceS: number; residenceProvenance: string;
  dryPeatMassKg: number; initialMoistureDryBasis: number; dryPeatCpJkgK: number; soilProvenance: string;
  initialPhase: 'solid' | 'pre-sublimated'; stepS: number; parcelStepS: number;
}
export type Location = 'source' | 'hose' | 'probe' | 'soil'
export interface Inventory { waterKg: number; solidKg: number; gasKg: number; enthalpyJ: number; temperatureK: number | null }
export interface Release { location: Location; fromS: number; toS: number; massKg: number; latentJ: number }
export interface ParticleInjectionState {
  schema: 'particle-delivery-d1'; timeS: number; modelTier: string;
  locations: Record<Location, Inventory>; releases: Release[];
  solidEnteringGroundKg: number; co2EnteringGroundKg: number; waterEnteringGroundKg: number;
  upstreamSublimatedKg: number; undergroundSublimatedKg: number;
  upstreamFractionInitialCO2: number | null; undergroundFractionInitialCO2: number | null;
  probeSurvivalFractionArrivedCO2: number | null; initialCO2Kg: number;
  peatTemperatureK: number; retainedMoistureDryBasis: number; heatFromPeatJ: number;
  waterMassResidualKg: number; co2MassResidualKg: number; energyResidualJ: number;
  initialEnthalpyJ: number; additionalColdResourceJ: number;
  meanSolidDiameterM: Record<Location, number | null>;
  pressurePa: null; oxygenMoleFraction: null; extinction: null; penetrationM: null;
  unavailable: string[]; assumptions: string[]; review: string;
  metadata: { panelId: string; seed: number; observationS: number; particleSizeProvenance: string; units: string; numericalStepS: number; parcelStepS: number };
}
