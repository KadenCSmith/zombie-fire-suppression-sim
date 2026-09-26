import type { Scenario } from '../sim/types'
import type { FastEventFrame, FastEventRun } from '../fastEvent'

/** Vertical, lumped low-order elements. One material point at each prism centre. */
export type MechanicsResolution = 4 | 6 | 8
export const MECHANICS_RESOLUTIONS: MechanicsResolution[] = [4, 6, 8]
export const MECHANICS_ASSUMPTIONS = {
  gravityMS2: 9.80665,
  youngsModulusPa: 1_000_000,
  shearModulusPa: 350_000,
  biotCoefficient: 0.8,
  tensileStrengthPa: 20_000,
  dampingRatio: 0.12,
  yieldedStiffnessFraction: 0.25,
} as const

export interface MechanicsFrame {
  eventTimeS: number
  resolution: MechanicsResolution
  displacementM: Float32Array
  yielded: Uint8Array
  effectiveStressPa: Float32Array
  pressurePa: Float32Array
  maxDisplacementM: number
  yieldedElements: number
  progress: number
  achievedSpeed: number
  status: 'running' | 'complete' | 'validity-paused'
}

export interface MechanicsChecks {
  elements: number
  materialPoints: number
  estimatedMemoryBytes: number
  expectedSteps: number
  stableStepS: number
  initialMassKg: number
  initialOverburdenPa: number
  initialEffectiveStressPa: number
  massResidualKg: number
  maxMomentumResidualN: number
  pressureMapMinimumPa: number
  pressureMapMaximumPa: number
  pressureWorkJ: number
  kineticEnergyJ: number
  warnings: string[]
}

export function mechanicsSizing(resolution: MechanicsResolution, durationS = 2, scenario?: Scenario) {
  const elements = resolution ** 3
  const dx = (scenario?.domain.widthM ?? 6.096) / resolution
  const dy = (scenario?.domain.lengthM ?? 6.096) / resolution
  const dz = (scenario?.domain.depthM ?? 3) / resolution
  const rho = scenario?.soil.bulkDensityKgM3 ?? 1200
  const mass = rho * dx * dy * dz
  const stiffness = MECHANICS_ASSUMPTIONS.youngsModulusPa * dx * dy / dz
  const stableStepS = Math.min(0.01, 0.2 * Math.sqrt(mass / (2 * stiffness)))
  return { elements, materialPoints: elements, estimatedMemoryBytes: elements * 112,
    expectedSteps: Math.ceil(durationS / stableStepS), stableStepS }
}

function index(i: number, j: number, k: number, n: number) { return (k * n + j) * n + i }

/**
 * Pressure is cell-centred in Pa. Nearest radial group is a documented
 * piecewise-constant remap; each vertical face uses one pressure shared by its
 * two neighbours, so equal-and-opposite internal forces cancel exactly.
 */
export class SoilMechanics {
  readonly n: MechanicsResolution
  readonly sizing: ReturnType<typeof mechanicsSizing>
  readonly checks: MechanicsChecks
  readonly mass: Float64Array
  readonly displacement: Float64Array
  readonly velocity: Float64Array
  readonly yielded: Uint8Array
  readonly overburden: Float64Array
  readonly pressure: Float64Array
  private readonly scenario: Scenario
  private readonly run: FastEventRun
  private readonly area: number
  private readonly dz: number
  private readonly springK: number
  private readonly shearK: number
  private readonly damping: number
  private readonly shellIndex: Uint8Array
  private time = 0
  private workJ = 0
  private maxMomentumResidualN = 0

  get timeSeconds() { return this.time }

  constructor(scenario: Scenario, run: FastEventRun, resolution: MechanicsResolution) {
    if (!MECHANICS_RESOLUTIONS.includes(resolution)) throw new Error('Unsupported mechanics resolution.')
    if (!run.frames.length) throw new Error('Mechanics needs gas pressure frames.')
    this.scenario = scenario; this.run = run; this.n = resolution
    this.sizing = mechanicsSizing(resolution, run.durationS, scenario)
    const count = this.sizing.elements
    const dx = scenario.domain.widthM / resolution
    const dy = scenario.domain.lengthM / resolution
    this.dz = scenario.domain.depthM / resolution
    this.area = dx * dy
    const volume = this.area * this.dz
    this.springK = MECHANICS_ASSUMPTIONS.youngsModulusPa * this.area / this.dz
    this.shearK = MECHANICS_ASSUMPTIONS.shearModulusPa * this.dz * Math.min(dx, dy) / Math.max(dx, dy)
    this.mass = new Float64Array(count)
    this.displacement = new Float64Array(count)
    this.velocity = new Float64Array(count)
    this.yielded = new Uint8Array(count)
    this.overburden = new Float64Array(count)
    this.pressure = new Float64Array(count)
    this.shellIndex = new Uint8Array(count)
    let sumMass = 0
    for (let k = 0; k < resolution; k++) for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
      const q = index(i, j, k, resolution)
      const depth = (k + 0.5) * this.dz
      let layerDepth = 0; let densityMultiplier = 1; let saturationOffset = 0
      for (const layer of scenario.soilLayers) {
        layerDepth += layer.thicknessM
        if (depth <= layerDepth + 1e-9) { densityMultiplier = layer.dryDensityMultiplier; saturationOffset = layer.moistureSaturationOffset; break }
      }
      const x = (i + 0.5) * dx; const y = (j + 0.5) * dy
      const peat = scenario.peatRegions.find(region =>
        Math.abs(x - region.centerXM) <= region.sizeXM / 2 && Math.abs(y - region.centerYM) <= region.sizeYM / 2
        && Math.abs(depth - region.centerDepthM) <= region.thicknessM / 2)
      const dryDensity = peat?.bulkDensityKgM3 ?? scenario.soil.bulkDensityKgM3 * densityMultiplier
      const saturation = peat?.moistureSaturation ?? Math.max(0, Math.min(1, scenario.soil.moistureSaturation + saturationOffset))
      const bulkDensity = dryDensity + 1000 * scenario.soil.porosity * saturation
      this.mass[q] = bulkDensity * volume
      sumMass += this.mass[q]
      const radius = Math.hypot(x - scenario.source.centerXM, y - scenario.source.centerYM, depth - scenario.source.centerDepthM)
      let nearest = 0; let distance = Infinity
      for (let s = 0; s < run.shellRadiusM.length; s++) {
        const d = Math.abs(radius - run.shellRadiusM[s])
        if (d < distance) { distance = d; nearest = s }
      }
      // The source can be sub-cell on the coarsest grid. Preserve its first
      // shell in the containing element so that pressure loading is not lost.
      const containsSource = Math.floor(scenario.source.centerXM / dx) === i
        && Math.floor(scenario.source.centerYM / dy) === j
        && Math.floor(scenario.source.centerDepthM / this.dz) === k
      this.shellIndex[q] = containsSource ? 0 : nearest
    }
    for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
      let above = 0
      for (let k = 0; k < resolution; k++) {
        const q = index(i, j, k, resolution)
        this.overburden[q] = (above + this.mass[q] / 2) * MECHANICS_ASSUMPTIONS.gravityMS2 / this.area
        above += this.mass[q]
      }
    }
    this.damping = 2 * MECHANICS_ASSUMPTIONS.dampingRatio * Math.sqrt(this.springK * sumMass / count)
    this.checks = { ...this.sizing, initialMassKg: sumMass,
      initialOverburdenPa: this.overburden[index(0, 0, resolution - 1, resolution)],
      initialEffectiveStressPa: this.overburden[index(0, 0, resolution - 1, resolution)] - MECHANICS_ASSUMPTIONS.biotCoefficient * Math.max(0, run.frames[0].shellPressurePa[this.shellIndex[index(0, 0, resolution - 1, resolution)]] - scenario.atmosphere.pressurePa),
      massResidualKg: sumMass - this.mass.reduce((a, b) => a + b, 0), maxMomentumResidualN: 0,
      pressureMapMinimumPa: 0, pressureMapMaximumPa: 0, pressureWorkJ: 0, kineticEnergyJ: 0, warnings: [] }
  }

  private mapPressure(gas: FastEventFrame) {
    let min = Infinity; let max = -Infinity
    for (let q = 0; q < this.pressure.length; q++) {
      const p = gas.shellPressurePa[this.shellIndex[q]]
      if (!Number.isFinite(p) || p <= 0) throw new Error('Invalid mapped gas pressure.')
      this.pressure[q] = p
      min = Math.min(min, p); max = Math.max(max, p)
    }
    const sourceMin = Math.min(...gas.shellPressurePa); const sourceMax = Math.max(...gas.shellPressurePa)
    if (min < sourceMin - 1 || max > sourceMax + 1) throw new Error('Pressure remap exceeded source bounds.')
    this.checks.pressureMapMinimumPa = min; this.checks.pressureMapMaximumPa = max
  }

  private step(dt: number) {
    const n = this.n, count = this.mass.length, atm = this.scenario.atmosphere.pressurePa
    const force = new Float64Array(count)
    const prior = Float64Array.from(this.displacement)
    const priorMomentum = this.velocity.reduce((sum, v, q) => sum + this.mass[q] * v, 0)
    let external = 0
    for (let q = 0; q < count; q++) { force[q] = -this.mass[q] * MECHANICS_ASSUMPTIONS.gravityMS2 - this.damping * this.velocity[q]; external += force[q] }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const q = index(i, j, k, n)
        const below = k === n - 1 ? -1 : index(i, j, k + 1, n)
        const weightAbove = this.overburden[q] * this.area + this.mass[q] * MECHANICS_ASSUMPTIONS.gravityMS2 / 2
        const relative = this.displacement[q] - (below < 0 ? 0 : this.displacement[below])
        const stiffness = this.springK * (this.yielded[q] ? MECHANICS_ASSUMPTIONS.yieldedStiffnessFraction : 1)
        const trial = weightAbove - stiffness * relative
        const facePressure = this.pressure[q] - atm
        if (trial / this.area - MECHANICS_ASSUMPTIONS.biotCoefficient * facePressure < -MECHANICS_ASSUMPTIONS.tensileStrengthPa) this.yielded[q] = 1
        // Failed tensile link opens. Compression/contact remains and supports settling.
        const linkForce = this.yielded[q] ? Math.max(0, weightAbove - this.springK * MECHANICS_ASSUMPTIONS.yieldedStiffnessFraction * relative) : trial
        force[q] += linkForce
        if (below >= 0) force[below] -= linkForce
        else external += linkForce // supported bottom reaction
        const aboveP = k === 0 ? atm : (this.pressure[index(i, j, k - 1, n)] + this.pressure[q]) / 2
        const belowP = k === n - 1 ? atm : (this.pressure[below] + this.pressure[q]) / 2
        const pressureForce = MECHANICS_ASSUMPTIONS.biotCoefficient * this.area * (belowP - aboveP)
        force[q] += pressureForce
        if (k === 0) external -= MECHANICS_ASSUMPTIONS.biotCoefficient * this.area * (aboveP - atm)
        if (k === n - 1) external += MECHANICS_ASSUMPTIONS.biotCoefficient * this.area * (belowP - atm)
        const side = (i === 0 ? 1 : 0) + (i === n - 1 ? 1 : 0) + (j === 0 ? 1 : 0) + (j === n - 1 ? 1 : 0)
        if (side) { const boundaryForce = -side * this.shearK * this.displacement[q]; force[q] += boundaryForce; external += boundaryForce }
      }
    }
    // Shear between adjacent columns is internal; apply each pair once.
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = index(i, j, k, n)
      for (const neighbor of [i + 1 < n ? index(i + 1, j, k, n) : -1, j + 1 < n ? index(i, j + 1, k, n) : -1]) {
        if (neighbor < 0) continue
        const shear = this.shearK * (this.displacement[neighbor] - this.displacement[q])
        force[q] += shear; force[neighbor] -= shear
      }
    }
    const forceSum = force.reduce((a, b) => a + b, 0)
    this.maxMomentumResidualN = Math.max(this.maxMomentumResidualN, Math.abs(forceSum - external))
    let updatedMomentum = 0
    for (let q = 0; q < count; q++) {
      this.velocity[q] += dt * force[q] / this.mass[q]
      updatedMomentum += this.mass[q] * this.velocity[q]
      this.displacement[q] += dt * this.velocity[q]
      if (!Number.isFinite(this.displacement[q]) || Math.abs(this.displacement[q]) > this.scenario.domain.depthM) throw new Error('Mechanics displacement exceeded the reduced model domain.')
      // Pressure work is a signed force-displacement diagnostic, not an energy coupling to the gas event.
      const k = Math.floor(q / (n * n)), i = q % n, j = Math.floor(q / n) % n
      const aboveP = k === 0 ? atm : (this.pressure[index(i, j, k - 1, n)] + this.pressure[q]) / 2
      const belowP = k === n - 1 ? atm : (this.pressure[index(i, j, k + 1, n)] + this.pressure[q]) / 2
      this.workJ += MECHANICS_ASSUMPTIONS.biotCoefficient * this.area * (belowP - aboveP) * (this.displacement[q] - prior[q])
    }
    this.maxMomentumResidualN = Math.max(this.maxMomentumResidualN, Math.abs((updatedMomentum - priorMomentum) / dt - external))
  }

  advanceTo(gas: FastEventFrame, achievedSpeed = 0): MechanicsFrame {
    this.mapPressure(gas)
    const target = Math.max(this.time, gas.eventTimeS)
    while (this.time < target - 1e-12) {
      const dt = Math.min(this.sizing.stableStepS, target - this.time)
      this.step(dt)
      this.time += dt
    }
    this.checks.maxMomentumResidualN = this.maxMomentumResidualN
    this.checks.pressureWorkJ = this.workJ
    this.checks.kineticEnergyJ = this.velocity.reduce((sum, v, q) => sum + 0.5 * this.mass[q] * v * v, 0)
    const effective = new Float32Array(this.mass.length)
    let maxDisplacement = 0; let yieldedElements = 0
    for (let q = 0; q < this.mass.length; q++) {
      const k = Math.floor(q / (this.n * this.n))
      const below = k === this.n - 1 ? -1 : q + this.n * this.n
      const preload = this.overburden[q] * this.area + this.mass[q] * MECHANICS_ASSUMPTIONS.gravityMS2 / 2
      const stiffness = this.springK * (this.yielded[q] ? MECHANICS_ASSUMPTIONS.yieldedStiffnessFraction : 1)
      const contactForce = preload - stiffness * (this.displacement[q] - (below < 0 ? 0 : this.displacement[below]))
      effective[q] = (this.yielded[q] ? Math.max(0, contactForce) : contactForce) / this.area
        - MECHANICS_ASSUMPTIONS.biotCoefficient * Math.max(0, this.pressure[q] - this.scenario.atmosphere.pressurePa)
      maxDisplacement = Math.max(maxDisplacement, Math.abs(this.displacement[q]))
      yieldedElements += this.yielded[q]
    }
    return { eventTimeS: this.time, resolution: this.n, displacementM: Float32Array.from(this.displacement),
      yielded: Uint8Array.from(this.yielded), effectiveStressPa: effective, pressurePa: Float32Array.from(this.pressure),
      maxDisplacementM: maxDisplacement, yieldedElements,
      progress: this.run.durationS > 0 ? this.time / this.run.durationS : 1, achievedSpeed,
      status: gas.status === 'validity-paused' ? 'validity-paused' : this.time >= this.run.durationS - 1e-9 ? 'complete' : 'running' }
  }
}
