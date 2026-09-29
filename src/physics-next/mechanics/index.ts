/**
 * Agent A local mechanics building blocks; no global equilibrium solver.
 *
 * All solid stress conventions are tension-positive. Pore pressures and
 * contact pressures are compression-positive:
 * sigmaEffective = sigmaTotal + alpha * pB * I.
 * Each implementation documents its strain/work measure and applicability.
 *
 * The caller owns shared contracts, quadrature/face history storage, objective
 * interface frames, assembly, boundary conditions, ledgers and atomic rollback.
 * Importing this barrel must not activate or mutate the baseline solver.
 */
export {
  evaluatePorePressure,
  toTensionPositiveStress,
  totalToEffectiveStress,
  effectiveToTotalStress,
  volumetricStrainFromEngineering,
  smallStrainPressureWork,
} from './effectiveStress'
export type {
  CellScalar,
  StressSignConvention,
  PressurePrimaryState,
  PorePressureInput,
  PorePressureFields,
  SmallStrainPressureWorkInput,
  SmallStrainPressureWorkResult,
} from './effectiveStress'

export {
  finiteStrainKinematics,
  neoHookeanPoint,
  assembleFiniteStrainHex8,
  finiteStrainPressureTransfer,
} from './finiteStrain'
export type {
  DeformationBounds,
  NeoHookeanParameters,
  FiniteKinematics,
  TotalLagrangianPoint,
  Hex8Trial,
  Hex8Assembly,
  FinitePressureTransferInput,
  FinitePressureTransfer,
} from './finiteStrain'

export { initialContactState, evaluateContact } from './contact'
export type {
  ContactInterfaceKind,
  ContactParameters,
  ContactState,
  ContactTrial,
  ContactResult,
} from './contact'

export { initialPeatHistory, evaluatePeatConstitutive } from './constitutive'
export type {
  MaxwellBranch,
  PeatProvenance,
  PeatParameters,
  PeatHistory,
  PeatTrial,
  PeatResponse,
} from './constitutive'

export { initialFractureHistory, evaluateFractureContact } from './fractureContact'
export type {
  FractureParameters,
  FractureHistory,
  FractureTrial,
  FractureResponse,
} from './fractureContact'
