import type { AlternativeRun } from '../contract'
import type { AcceptedState, PanelConfig } from '../model'
import type { Inventory, Location, ParticleInjectionSettings, ParticleInjectionState, Release } from './types'
export const PROPERTIES = Object.freeze({ surfaceK: 195, latentJkg: 25200 / .0440095, waterCpJkgK: 4186, gasCpJkgK: 850 })
const { surfaceK: TS, latentJkg: L, waterCpJkgK: CW, gasCpJkgK: CG } = PROPERTIES
export const UNAVAILABLE = ['Aqueous film/ice-shell and blockage coupling', 'Particle slip, filtration, deposition and peat penetration', 'Pressure-driven liquid flow and spatial wetting', 'Gas/O2 mixture and boundary exchange fields', 'Tank pressure', 'Reacting fire, extinction and re-ignition', 'Ambient reheating and drainage']
interface Cohort { count: number; radiusM: number }
interface Carrier { water: number; gas: number; h: number; cohorts: Cohort[] }
interface Parcel { carrier: Carrier; dispatchedS: number; hoseEndS: number; groundS: number }
const empty = (): Carrier => ({ water: 0, gas: 0, h: 0, cohorts: [] })
function solid(c: Carrier, p: ParticleInjectionSettings) { return c.cohorts.reduce((a, b) => a + b.count * 4 * Math.PI / 3 * p.solidDensityKgM3 * b.radiusM ** 3, 0) }
function temperature(c: Carrier) { const capacity = c.water * CW + c.gas * CG; return capacity > 0 ? TS + (c.h - c.gas * L) / capacity : null }
function checkLiquid(t: number | null, location: string, time: number) {
  if (t !== null && (t < 273.15 - 1e-8 || t > 350 + 1e-8)) throw new Error(`Out of liquid-carrier regime at ${location}, t=${time.toFixed(6)} s: ${t.toFixed(3)} K. Bulk freezing/overheating invalidates this model; local ice shells and blockage are unverified even above freezing.`)
}
export function sphereRadiusSquared(r0: number, k: number, bathK: number, rho: number, latent: number, timeS: number) {
  return Math.max(0, r0 * r0 - 2 * k * Math.max(0, bathK - TS) * timeS / (rho * latent))
}
export function twoCapacityHeatJ(hotK: number, coldK: number, a: number, b: number, ua: number, dt: number) {
  if (a <= 0 || b <= 0 || ua === 0 || dt === 0) return 0
  const reciprocal = 1 / a + 1 / b
  return (hotK - coldK) * -Math.expm1(-ua * dt * reciprocal) / reciprocal
}
export function validateParticleConfig(config: PanelConfig): ParticleInjectionSettings {
  if (config.variantId !== 'nanoparticles' || config.engine !== 'particle' || !['water','co2-water'].includes(config.medium)) throw new Error('4.2.2 requires its particle engine and water or CO2-water medium.')
  if (!config.id?.trim() || typeof config.thermal.enabled !== 'boolean' || !Number.isSafeInteger(config.thermal.seed)) throw new Error('Independent panel ID, intervention flag and integer seed are required.')
  const p = config.particleInjection
  if (!p) throw new Error('Explicit particle configuration including size, SI units and provenance is required.')
  const limits = { particleDiameterM: [10e-6, 500e-6], effectiveConductivityWmK: [.0006,.6], solidDensityKgM3: [800,1650], hoseResidenceS: [0,20], probeResidenceS: [0,10], dryPeatMassKg: [.01,10], initialMoistureDryBasis: [0,1], dryPeatCpJkgK: [500,3000], stepS: [.0003125,.02], parcelStepS: [.00625,.5] } as const
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) { const [lo,hi] = limits[key]; if (!Number.isFinite(p[key]) || p[key] < lo || p[key] > hi) throw new Error(`Unsupported ${key}; expected ${lo}–${hi} in SI units.`) }
  for (const key of ['sizeProvenance','heatTransferProvenance','residenceProvenance','soilProvenance'] as const) if (typeof p[key] !== 'string' || !p[key].trim()) throw new Error(`Explicit ${key} required; assumptions are not measurements.`)
  if (!['solid','pre-sublimated'].includes(p.initialPhase)) throw new Error('Unknown initial CO2 phase.')
  const limitsT = { initialK: [300,350], inletK: [273.15,350], waterKg: [0,5], dryIceKg: [0,1], flowKgS: [0,.2], contactStartS: [0,50], conductanceWK: [0,100], endS: [10,120] } as const
  for (const key of Object.keys(limitsT) as (keyof typeof limitsT)[]) { const [lo,hi] = limitsT[key], v = config.thermal[key]; if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(`Unsupported ${key}: this nonreacting warm-specimen/liquid diagnostic requires ${lo}–${hi}. Fire/boiling coupling is unavailable.`) }
  if (config.thermal.waterKg === 0 && config.medium === 'co2-water' && config.thermal.dryIceKg > 0) throw new Error('Solid/gas without liquid carrier is outside the particle-in-water model.')
  return structuredClone(p)
}
/** Recompute from a fixed initial configuration/grid. Output sampling cannot alter the physical trajectory. */
export function simulateParticle(configInput: PanelConfig, targetS: number): ParticleInjectionState {
  const config = structuredClone(configInput), p = validateParticleConfig(config), t = config.thermal
  if (!Number.isFinite(targetS) || targetS < 0 || targetS > t.endS + 1e-9) throw new Error('Invalid particle observation target.')
  const initialCO2 = config.medium === 'co2-water' ? t.dryIceKg : 0
  const source = empty(), soil = empty(), parcels: Parcel[] = [], releases: Release[] = []
  source.water = t.waterKg; source.h = source.water * CW * (t.inletK - TS)
  if (initialCO2 > 0) source.cohorts = [{ count: initialCO2 / (4 * Math.PI / 3 * p.solidDensityKgM3 * (p.particleDiameterM / 2) ** 3), radiusM: p.particleDiameterM / 2 }]
  let upstream = 0, underground = 0, solidEntry = 0, co2Entry = 0, waterEntry = 0, heatPeat = 0, peatK = t.initialK
  const peatCapacity = p.dryPeatMassKg * (p.dryPeatCpJkgK + p.initialMoistureDryBasis * CW)
  const initialH = source.h + peatCapacity * (peatK - TS)
  function record(location: Location, fromS: number, toS: number, massKg: number) {
    if (massKg <= 0) return
    // Fixed 0.25 s release bins retain actual interval bounds. No decorative gas motion.
    const bin = Math.floor((fromS + toS) / 2 / .25)
    let item = releases.find(r => r.location === location && Math.floor((r.fromS + r.toS) / 2 / .25) === bin)
    if (!item) { item = { location, fromS, toS, massKg: 0, latentJ: 0 }; releases.push(item) }
    item.fromS = Math.min(item.fromS, fromS); item.toS = Math.max(item.toS, toS); item.massKg += massKg; item.latentJ += massKg * L
  }
  if (t.enabled && p.initialPhase === 'pre-sublimated' && initialCO2 > 0) {
    source.gas = initialCO2; source.cohorts = []; upstream = initialCO2
    checkLiquid(temperature(source), 'pre-sublimated source', 0); record('source', 0, 0, initialCO2)
  }
  function phase(c: Carrier, location: Location, fromS: number, toS: number) {
    const bath = temperature(c), oldMass = solid(c, p)
    if (bath === null || oldMass === 0 || toS <= fromS) return
    // Finite-bath enthalpy requires latent + warming of newly formed gas. Existing gas H is retained.
    const gap = L + CG * (bath - TS)
    const next = c.cohorts.map(b => ({ ...b, radiusM: Math.sqrt(sphereRadiusSquared(b.radiusM, p.effectiveConductivityWmK, bath, p.solidDensityKgM3, gap, toS - fromS)) }))
    const trial = { ...c, cohorts: next }, dm = Math.max(0, oldMass - solid(trial, p))
    trial.gas += dm; checkLiquid(temperature(trial), location, toS)
    c.cohorts = next.filter(b => b.radiusM > 0); c.gas = trial.gas
    if (location === 'soil') underground += dm; else upstream += dm
    record(location, fromS, toS, dm)
  }
  function merge(into: Carrier, from: Carrier) { into.water += from.water; into.gas += from.gas; into.h += from.h; into.cohorts.push(...from.cohorts); checkLiquid(temperature(into), 'mixed soil carrier', clock) }
  const duration = t.flowKgS > 0 ? t.waterKg / t.flowKgS : Infinity
  let dispatchIndex = 1, clock = 0, withdrawalResolutionChecked = false
  function dispatchTime() { return t.contactStartS + Math.min(dispatchIndex * p.parcelStepS, duration) }
  function dispatch() {
    const water = Math.min(source.water, t.flowKgS * p.parcelStepS)
    if (water <= 1e-14 || source.water <= 0) return
    const f = water / source.water, out: Carrier = { water, gas: source.gas * f, h: source.h * f, cohorts: source.cohorts.map(b => ({ count: b.count * f, radiusM: b.radiusM })) }
    source.water -= water; source.gas *= 1 - f; source.h *= 1 - f; source.cohorts.forEach(b => b.count *= 1 - f)
    if (source.water < 1e-13) { source.water = 0; source.gas = 0; source.h = 0; source.cohorts = [] }
    parcels.push({ carrier: out, dispatchedS: clock, hoseEndS: clock + p.hoseResidenceS, groundS: clock + p.hoseResidenceS + p.probeResidenceS }); dispatchIndex++
  }
  while (t.enabled && clock < targetS - 1e-11) {
    if (!withdrawalResolutionChecked && clock >= t.contactStartS - 1e-10) {
      withdrawalResolutionChecked = true
      const bath = temperature(source)
      if (t.flowKgS > 0 && source.water > 1e-14 && bath !== null && solid(source,p) > 0) {
        // Check the aged source exactly at withdrawal onset, before right-endpoint
        // parcels can erase short-lived entry. This is a resolution screen, not
        // an accuracy certificate. Rechecking near extinction would reject every run.
        const gap = L + CG * (bath - TS)
        const life = Math.min(...source.cohorts.filter(b=>b.count>0 && b.radiusM>0).map(b=>p.solidDensityKgM3*b.radiusM**2*gap/(2*p.effectiveConductivityWmK*(bath-TS))))
        if (Math.max(p.stepS,p.parcelStepS) > life/64) throw new Error(`Underresolved solid delivery at withdrawal onset (${clock.toFixed(6)} s): remaining radius-squared lifetime ${life.toExponential(4)} s requires phase and parcel intervals <= ${(life/64).toExponential(4)} s for this resolution screen. Solid entry is unavailable; zero delivery cannot be inferred. Even screened inputs require scenario-specific refinement.`)
      }
    }
    let next = Math.min(targetS, (Math.floor((clock + 1e-10) / p.stepS) + 1) * p.stepS)
    if (t.contactStartS > clock + 1e-10) next = Math.min(next,t.contactStartS)
    if (source.water > 1e-14 && t.flowKgS > 0 && dispatchTime() > clock + 1e-10) next = Math.min(next, dispatchTime())
    for (const parcel of parcels) for (const boundary of [parcel.hoseEndS, parcel.groundS]) if (boundary > clock + 1e-10) next = Math.min(next, boundary)
    const dt = next - clock
    phase(source, 'source', clock, next)
    for (const parcel of parcels) phase(parcel.carrier, clock < parcel.hoseEndS - 1e-9 ? 'hose' : 'probe', clock, next)
    const carrierK = temperature(soil)
    if (carrierK !== null) {
      const q = twoCapacityHeatJ(peatK, carrierK, peatCapacity, soil.water * CW + soil.gas * CG, t.conductanceWK, dt)
      const trial = { ...soil, h: soil.h + q }; checkLiquid(temperature(trial), 'soil contact', next)
      soil.h += q; peatK -= q / peatCapacity; heatPeat += q
      phase(soil, 'soil', clock, next)
    }
    clock = next
    if (source.water > 1e-14 && t.flowKgS > 0 && clock >= dispatchTime() - 1e-9) dispatch()
    for (let i = parcels.length - 1; i >= 0; i--) if (clock >= parcels[i].groundS - 1e-9) {
      const c = parcels[i].carrier; solidEntry += solid(c, p); co2Entry += solid(c, p) + c.gas; waterEntry += c.water; merge(soil, c); parcels.splice(i, 1)
    }
  }
  function inventory(c: Carrier): Inventory { return { waterKg: c.water, solidKg: solid(c, p), gasKg: c.gas, enthalpyJ: c.h, temperatureK: temperature(c) } }
  const hose = empty(), probe = empty()
  // Aggregate accepted inventories only; these display aggregates do not enter physics.
  for (const parcel of parcels) { const c = clock < parcel.hoseEndS - 1e-9 ? hose : probe; c.water += parcel.carrier.water; c.gas += parcel.carrier.gas; c.h += parcel.carrier.h; c.cohorts.push(...parcel.carrier.cohorts) }
  const carriers = { source, hose, probe, soil }, locations = Object.fromEntries(Object.entries(carriers).map(([k,c]) => [k,inventory(c)])) as Record<Location,Inventory>
  const all = Object.values(locations)
  const mean = Object.fromEntries(Object.entries(carriers).map(([key,c]) => { const m = solid(c,p); return [key,m > 0 ? c.cohorts.reduce((a,b) => a + b.count * 4 * Math.PI / 3 * p.solidDensityKgM3 * b.radiusM ** 3 * 2 * b.radiusM,0) / m : null] })) as Record<Location,number|null>
  return { schema: 'particle-delivery-d1', timeS: targetS, modelTier: 'Unvalidated finite-inventory saturated-film thermal/entrainment sensitivity; nominated underground calorimeter only',
    locations, releases, solidEnteringGroundKg: solidEntry, co2EnteringGroundKg: co2Entry, waterEnteringGroundKg: waterEntry,
    upstreamSublimatedKg: upstream, undergroundSublimatedKg: underground, initialCO2Kg: initialCO2,
    upstreamFractionInitialCO2: initialCO2 > 0 ? upstream / initialCO2 : null, undergroundFractionInitialCO2: initialCO2 > 0 ? underground / initialCO2 : null,
    probeSurvivalFractionArrivedCO2: co2Entry > 0 ? solidEntry / co2Entry : null,
    peatTemperatureK: peatK, retainedMoistureDryBasis: p.initialMoistureDryBasis + soil.water / p.dryPeatMassKg, heatFromPeatJ: heatPeat,
    waterMassResidualKg: all.reduce((a,c) => a + c.waterKg,0) - t.waterKg,
    co2MassResidualKg: all.reduce((a,c) => a + c.solidKg + c.gasKg,0) - initialCO2,
    energyResidualJ: all.reduce((a,c) => a + c.enthalpyJ,0) + peatCapacity * (peatK - TS) - initialH,
    initialEnthalpyJ: initialH, additionalColdResourceJ: initialCO2 * (L + CG * (t.inletK - TS)), meanSolidDiameterM: mean,
    pressurePa: null, oxygenMoleFraction: null, extinction: null, penetrationM: null, unavailable: [...UNAVAILABLE],
    assumptions: [p.sizeProvenance,p.heatTransferProvenance,p.residenceProvenance,p.soilProvenance,'Solid is initially saturated/isothermal at195K; cp-water4186 and cp-gas850J/(kgK) are constant approximations, not full property correlations.','Adiabatic source/transport; water and CO2 gas enthalpy travel together, no vent/slip. Prescribed delivery into a nominated contact specimen; no predicted penetration.','Local ice shells/blockage remain unresolved even when bulk water is273.15–350K.','Parcel withdrawal uses right-endpoint quadrature; phase uses finite-bath explicit r-squared updates and conservative enthalpy, finite-UA pair exchange.','Active solid withdrawal requires phase and parcel intervals no larger than 1/64 of the actual aged-source radius-squared lifetime at withdrawal onset. This fail-closed screen is not an accuracy certificate; refinement evidence applies only to tested scenarios.'],
    review: 'No verified realism pass; initial placeholder1.3/10. Signed candidate scores and frozen identity are in the D REALISM_LEDGER. Experimental validation:false.',
    metadata: { panelId: config.id, seed: t.seed, observationS: t.endS, particleSizeProvenance: p.sizeProvenance, units: 'SI; kelvin; mass fractions use stated denominators', numericalStepS: p.stepS, parcelStepS: p.parcelStepS } }
}
export function createParticleRun(configInput: PanelConfig): AlternativeRun {
  const config = structuredClone(configInput); validateParticleConfig(config)
  let state = simulateParticle(config,0)
  function snapshot(): AcceptedState { return { timeS: state.timeS, particleInjection: structuredClone(state), metrics: { maximumK: state.peatTemperatureK, waterUsedKg: state.waterEnteringGroundKg, dryIceUsedKg: state.upstreamSublimatedKg + state.undergroundSublimatedKg, energyJ: state.heatFromPeatJ, energyResidualJ: state.energyResidualJ, massResidualKg: Math.max(Math.abs(state.waterMassResidualKg),Math.abs(state.co2MassResidualKg)), oxygenKg: null, fuelKg: null, reactionW: null } } }
  return { endS: config.thermal.endS, snapshot, advanceTo(targetS: number) { if (!Number.isFinite(targetS) || targetS < state.timeS - 1e-9 || targetS > config.thermal.endS + 1e-9) throw new Error('Invalid physical target.'); const next = simulateParticle(config,targetS); state = next; return snapshot() } }
}
