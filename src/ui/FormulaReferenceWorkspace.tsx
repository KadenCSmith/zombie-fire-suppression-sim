import { BookOpen, ArrowLeft, ArrowUpRight } from 'lucide-react'
import convergence from '../../docs/review/unified/convergence-study.json'
import { ModelSelector, type PhysicsWorkspace } from './ModelSelector'
import './formula-reference.css'

const repository = 'https://github.com/KadenCSmith/zombie-fire-suppression-sim'
const paper = 'https://doi.org/10.3390/fire8010013'

interface FormulaEntry {
  name: string
  equation: string
  meaning: string
  choice: string
  code: string
  references: { label: string; href: string }[]
}

const sections: { id: string; title: string; status: string; entries: FormulaEntry[]; note?: string }[] = [
  {
    id: 'soil', title: 'Soil & mechanics', status: 'Finite elements when enabled',
    entries: [
      {
        name: 'Small-strain soil response', equation: 'ε = ½(∇u + ∇uᵀ) · σ′ = 2με + λ tr(ε) I',
        meaning: 'Eight-node brick elements solve nodal displacement under gravity and incremental pore-pressure loading. Biot’s effective-stress idea links pressure to soil loading.',
        choice: 'A linear elastic reference is tractable with available inputs. Plasticity, creep and large deformation need measured peat properties and further verification.',
        code: 'src/coupled/mechanics.ts · src/coupled/model.ts',
        references: [{ label: 'Biot (1941)', href: 'https://doi.org/10.1063/1.1712886' }],
      },
      {
        name: 'Diffuse tensile damage', equation: 'g(d) = 10⁻⁶ + (1 − 10⁻⁶)(1 − d)² · Efracture = ∫ Gc[d²/(2ℓ) + ℓ|∇d|²/2] dV',
        meaning: 'A phase field reduces tensile stiffness and represents distributed fracture energy. The damage length ℓ and fracture energy Gc are assumed, not measured for this site.',
        choice: 'The AT2 form can be coupled to the brick mesh without prescribing a crack path. It does not resolve an open frictional crack, a completed rupture or blast motion.',
        code: 'src/coupled/mechanics.ts',
        references: [{ label: 'Miehe et al. (2010)', href: 'https://doi.org/10.1002/nme.2861' }],
      },
    ],
  },
  {
    id: 'fire', title: 'Fire & heat', status: 'Reduced peat oxidation',
    entries: [
      {
        name: 'Energy and conduction', equation: 'q = −k∇T · ΔUcell = ΣQface + ΣHface + Qheater + Qreaction + W',
        meaning: 'Signed conductive and gas-enthalpy face transfers, external heating, reaction heat and pressure/gravity work update cell internal energy. Temperature follows an energy and phase inversion.',
        choice: 'Conservative cell energy supports coupled gas and phase accounting. It is not a resolved flame or radiative surface-fire calculation.',
        code: 'src/coupled/model.ts · src/coupled/thermodynamics.ts',
        references: [{ label: 'Huang & Rein (2014)', href: 'https://doi.org/10.1016/j.combustflame.2013.12.013' }],
      },
      {
        name: 'One-step oxidation surrogate', equation: 'C₆H₁₀O₅ + 6 O₂ → 6 CO₂ + 5 H₂O · r = Aref e^[−Ea/R(1/T − 1/Tref)] · xO₂/(xO₂ + K) · e^(−w/dry)',
        meaning: 'Finite fuel and oxygen cap consumption. The moisture factor and heat release are assumed; the rate is not fitted to matched peat samples.',
        choice: 'A single reaction keeps inventories explicit, but detailed peat drying, pyrolysis, char and CO formation require a multistep chemistry model.',
        code: 'src/coupled/model.ts',
        references: [{ label: 'Huang & Rein (2014)', href: 'https://doi.org/10.1016/j.combustflame.2013.12.013' }, { label: 'Huang & Rein (2016)', href: 'https://doi.org/10.1016/j.biortech.2016.01.027' }],
      },
    ],
  },
  {
    id: 'gas', title: 'Gas & CO₂', status: 'Porous flow, not mine ventilation',
    entries: [
      {
        name: 'Ideal gas and Darcy flow', equation: 'pVgas = ntotal RT · u = −(keff/μ)(∇p − ρg)',
        meaning: 'Cell pressure comes from gas moles and accessible pore volume. Face flux uses anisotropic permeability, pressure and mixture gravity; species move by upwind advection and mole-fraction diffusion.',
        choice: 'Darcy flow fits the intended slow porous regime. The solver stops beyond its Reynolds or Mach guards; turbulent mine airflow, jets and shock waves need different equations.',
        code: 'src/coupled/model.ts',
        references: [{ label: 'An et al. (2025): method context only', href: paper }],
      },
      {
        name: 'Finite dry-ice source', equation: 'psat(T) = p₀ exp[(Lmol/R)(1/T₀ − 1/T)] · ṁ = A(D/r)pM/(RT̄) ln[(1 − y∞)/(1 − ys)]',
        meaning: 'A shrinking solid sphere uses a constant-latent Clausius–Clapeyron relation and a finite Stefan film flux. Emitted CO₂ debits solid mass and source energy.',
        choice: 'A finite source prevents unlimited CO₂ or cooling. Film properties, source geometry and conductance remain assumptions; liquid CO₂ and internal solid gradients are absent.',
        code: 'src/coupled/source.ts · src/coupled/thermodynamics.ts',
        references: [{ label: 'Giauque & Egan (1937)', href: 'https://doi.org/10.1063/1.1749929' }, { label: 'Spalding (1954)', href: 'https://doi.org/10.1243/PIME_PROC_1954_168_054_02' }, { label: 'Purandare et al. (2023)', href: 'https://doi.org/10.1016/j.icheatmasstransfer.2023.107042' }],
      },
    ],
  },
  {
    id: 'water', title: 'Water & phase change', status: 'No solved liquid dispersal',
    entries: [
      {
        name: 'Pore-water phase equilibrium', equation: 'pv = mv Rv T / Vgas = psat(T) (when condensed) · mw = mv + mliquid + mice',
        meaning: 'Water vapor equilibrates with liquid or ice; latent heat and condensed-phase volume enter the energy and pore-volume balances.',
        choice: 'Local equilibrium is manageable in the current thermal solver. It omits capillary pressure, liquid mobility, unsaturated infiltration and ice-heave stress.',
        code: 'src/coupled/thermodynamics.ts · src/coupled/model.ts',
        references: [{ label: 'Murphy & Koop (2005)', href: 'https://doi.org/10.1256/qj.04.94' }],
      },
      {
        name: 'Contact cooling in the story', equation: 'Qdry = Cp(T − Tdry)[1 − exp(−UA Δt/Cp)] · Δmdry = Qdry/Lsub',
        meaning: 'The natural presentation uses a separate finite dry-ice and water contact calorimeter. Hose arrival and wetting paths are prescribed illustrations.',
        choice: 'This accounts for local heat and finite inventories without pretending that liquid dispersion through peat has been solved. A predictive water front needs Richards or multiphase flow with measured hydraulic curves.',
        code: 'src/story/contactCooling.ts · src/story/fireSequence.ts',
        references: [{ label: 'Santoso et al. (2021)', href: 'https://doi.org/10.1071/WF20117' }],
      },
      {
        name: 'Proposed infiltration — inactive',
        equation: '∂θ/∂t = ∇·[K(h)(∇h + ∇z)] − S · Sₑ = [1 + (α|h|)ⁿ]⁻ᵐ · Kᵣ = Sₑ^ℓ[1 − (1 − Sₑ^(1/m))^m]²',
        meaning: 'Richards liquid balance with van Genuchten retention and Mualem relative conductivity is a candidate for future water-front modeling. K(h) = KsKᵣ; m = 1 − 1/n; z is elevation positive upward. None of these equations is active in the app.',
        choice: 'Implementation requires measured peat retention and hydraulic-conductivity curves, delivery boundary conditions, and coupling to heat, vapor, gas and changing pore space. Preferential flow may require a richer model.',
        code: 'Not implemented · proposed physical extension',
        references: [
          { label: 'Richards (1931)', href: 'https://doi.org/10.1063/1.1745010' },
          { label: 'van Genuchten (1980)', href: 'https://doi.org/10.2136/sssaj1980.03615995004400050002x' },
          { label: 'Mualem (1976)', href: 'https://doi.org/10.1029/WR012i003p00513' },
        ],
      },
    ],
    note: 'Active water dispersion equation: none. The displayed hose and wetting paths do not come from a pore-water flow solver.',
  },
  {
    id: 'numerics', title: 'Numerics & model type', status: 'Hybrid methods',
    entries: [
      {
        name: 'Finite-volume transport', equation: 'Uᵢⁿ⁺¹ = Uᵢⁿ − Δt Σf Fᵢf + Δt Sᵢ',
        meaning: 'Shared cell faces move gas species and heat; each transferred amount leaves one cell and enters its neighbor. Pressure uses an implicit nonlinear storage solve.',
        choice: 'Face balances make mass and energy bookkeeping explicit on a Cartesian grid. They do not by themselves establish physical accuracy or mesh convergence.',
        code: 'src/coupled/model.ts · src/coupled/linear.ts',
        references: [{ label: 'An et al. (2025): different application', href: paper }],
      },
      {
        name: 'Finite-element mechanics', equation: '∫Ω Bᵀσ′ dV = fgravity + fpressure + fsupport',
        meaning: 'When enabled, eight-node bricks solve displacement; staggered updates exchange pore pressure and volume changes with transport.',
        choice: 'Displacement is naturally represented by finite elements. The natural fire sequence, contact demonstration, radial event and visual effects are separate reduced or authored models.',
        code: 'src/coupled/mechanics.ts · src/coupled/model.ts',
        references: [{ label: 'Biot (1941)', href: 'https://doi.org/10.1063/1.1712886' }],
      },
    ],
  },
]

const sourceLoss = [.25, .125, .0625].map(step => convergence.temporal.find(row => row.maxStepS === step)!.sublimatedKg)
const observedOrder = Math.log(Math.abs((sourceLoss[0] - sourceLoss[1]) / (sourceLoss[1] - sourceLoss[2]))) / Math.log(2)
const extrapolatedSourceLoss = sourceLoss[2] + (sourceLoss[2] - sourceLoss[1]) / (2 ** observedOrder - 1)
const conditionalTimeDifferencePercent = 100 * Math.abs(sourceLoss[1] - extrapolatedSourceLoss) / extrapolatedSourceLoss

function SourceLinks({ entry }: { entry: FormulaEntry }) {
  return <div className="formula-sources"><span>Code: {entry.code}</span>{entry.references.map(reference => <a key={reference.href} href={reference.href} target="_blank" rel="noreferrer">{reference.label} <ArrowUpRight size={12} aria-hidden="true" /></a>)}</div>
}

function Chart({ kind }: { kind: 'spatial' | 'temporal' }) {
  const spatial = kind === 'spatial'
  const rows = spatial ? convergence.spatial : convergence.temporal
  const values = rows.map(row => spatial ? row.pressureRmsErrorPa : Math.abs(row.sublimatedRelativeDifferencePercent))
  const maximum = spatial ? 12 : 1
  const left = 54, right = 468, top = 18, bottom = 195
  const first = spatial ? Math.log10(convergence.spatial[0].cells) : 0
  const last = spatial ? Math.log10(convergence.spatial.at(-1)!.cells) : rows.length - 1
  const x = (row: typeof rows[number], index: number) => left + (spatial ? (Math.log10(row.cells) - first) / (last - first) : index / (rows.length - 1)) * (right - left)
  const y = (value: number) => bottom - value / maximum * (bottom - top)
  const points = rows.map((row, index) => `${x(row, index)},${y(values[index])}`).join(' ')
  const title = spatial ? 'Spatial pressure difference' : 'Timestep sublimated-mass difference'
  const description = spatial ? 'Pressure RMS difference decreases across 256, 864, 2048, 2560 and 20480 cells relative to the 20480-cell comparison run.' : 'Absolute sublimated-mass percentage difference decreases as the timestep is refined from 0.5 to 0.0625 seconds relative to the 0.0625-second run.'
  const ticks = spatial ? [0, 4, 8, 12] : [0, .25, .5, .75, 1]
  return <svg className="formula-chart" viewBox="0 0 500 265" role="img" aria-labelledby={`${kind}-title ${kind}-desc`}>
    <title id={`${kind}-title`}>{title}</title><desc id={`${kind}-desc`}>{description}</desc>
    {ticks.map(tick => <g key={tick}><line className="formula-chart-grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} /><text className="formula-chart-tick" x={left - 9} y={y(tick) + 4} textAnchor="end">{spatial ? tick : tick.toFixed(2)}</text></g>)}
    <polyline className="formula-chart-line" points={points} />
    {rows.map((row, index) => <g key={spatial ? row.cells : row.maxStepS}>
      <circle className={index === rows.length - 1 ? 'formula-chart-point is-reference' : 'formula-chart-point'} cx={x(row, index)} cy={y(values[index])} r="5" />
      <text className="formula-chart-tick" x={x(row, index)} y={bottom + (spatial && index === 3 ? 34 : 20)} textAnchor="middle">{spatial ? row.cells.toLocaleString() : row.maxStepS.toString()}</text>
    </g>)}
    <text className="formula-chart-axis" x={(left + right) / 2} y="258" textAnchor="middle">{spatial ? 'Cells' : 'Maximum timestep (s)'}</text>
  </svg>
}

export default function FormulaReferenceWorkspace({ onWorkspace }: { onWorkspace: (workspace: PhysicsWorkspace) => void }) {
  return <div className="formula-shell">
    <header className="formula-header">
      <div className="formula-brand"><span>Z</span><div><strong>ZOMBIE FIRE</strong><small>PHYSICS REFERENCE</small></div></div>
      <ModelSelector value="formulas" onChange={onWorkspace} />
      <button type="button" className="formula-back" onClick={() => onWorkspace('sequence')}><ArrowLeft size={15} /> Back to sequence</button>
    </header>
    <main className="formula-document">
      <div className="formula-hero"><span className="formula-eyebrow"><BookOpen size={15} /> MODEL BASIS / RESEARCH NOTES</span><h1>What equations drive the simulation?</h1><p>Equation families, source papers, implementation paths and limits for the current application. The app combines a finite-volume gas and heat solver with optional finite-element soil mechanics. Its natural fire sequence also contains authored actions and a separate contact-cooling demonstration.</p></div>
      <div className="formula-alert"><strong>About the linked paper</strong><p><a href={paper} target="_blank" rel="noreferrer">An et al. (2025), <em>Fire</em> 8(1), 13 <ArrowUpRight size={12} aria-hidden="true" /></a> studies methane migration in a coal mining face and goaf. It is useful as finite-volume gas-flow context, but its coal geometry, methane transport, ventilation and validation data do not describe peat fire suppression. This app does not reproduce that paper’s experiment.</p></div>
      <nav className="formula-nav" aria-label="Formula categories">{sections.map(section => <a key={section.id} href={`#formula-${section.id}`}>{section.title}</a>)}<a href="#formula-convergence">Convergence</a><a href="#formula-next">Next steps</a></nav>
      <div className="formula-sections">{sections.map(section => <section className="formula-section" id={`formula-${section.id}`} key={section.id}><div className="formula-section-heading"><h2>{section.title}</h2><span>{section.status}</span></div><div className="formula-cards">{section.entries.map(entry => <article className="formula-card" key={entry.name}><h3>{entry.name}</h3><div className="formula-equation">{entry.equation}</div><p>{entry.meaning}</p><p className="formula-choice"><strong>Why this model:</strong> {entry.choice}</p><SourceLinks entry={entry} /></article>)}</div>{section.note && <p className="formula-section-note">{section.note}</p>}</section>)}</div>
      <section className="formula-section formula-evidence" id="formula-convergence">
        <div className="formula-section-heading"><h2>Convergence & error evidence</h2><span>Numerical comparison only</span></div>
        <p className="formula-intro">The recorded study is a <strong>cold, source-only, 2 s transport calculation</strong>. Mechanics, fracture, cap and reaction are off. Every error below is a difference from the finest available run under the same assumed inputs; the finest run is a comparator, not exact truth.</p>
        <div className="formula-chart-grid-layout">
          <figure><figcaption><strong>Spatial: pressure RMS difference</strong><span>Pa versus cell count · reference: 20,480 cells</span></figcaption><Chart kind="spatial" /><p>Pressure differences decrease here. The source-loss difference rises from 0.2598% at 2,048 cells to 0.4547% at 2,560 cells; fixed-probe pressure is also nonmonotone.</p></figure>
          <figure><figcaption><strong>Temporal: sublimated-mass difference</strong><span>Absolute % versus maximum timestep · reference: 0.0625 s</span></figcaption><Chart kind="temporal" /><p>At 0.125 s, the source-loss difference is 0.141% versus the 0.0625 s comparison. This is a numerical difference for one case.</p></figure>
        </div>
        <div className="formula-richardson"><strong>Conditional time-only estimate</strong><p>Three-level Richardson extrapolation of source loss at 0.25, 0.125 and 0.0625 s gives observed order p ≈ {observedOrder.toFixed(3)} and an estimated {conditionalTimeDifferencePercent.toFixed(3)}% time-discretization difference at 0.125 s. It assumes a smooth asymptotic trend at fixed 2,560-cell geometry. Spatial source-loss differences are nonmonotone, so this is neither a total numerical error nor a field or suppression-accuracy estimate.</p></div>
        <div className="formula-evidence-footer"><p><strong>Physical error prediction:</strong> no defensible model-wide percentage exists without matched peat, cap, water-delivery and fire measurements. The spatial 2,560-cell source-loss difference is 0.455% versus the 20,480-cell run. Neither value is an accuracy claim for extinguishment, rupture, or the natural sequence.</p><p>Study data: <code>docs/review/unified/convergence-study.json</code> · full formula audit: <code>docs/PHYSICS_FORMULA_AUDIT.md</code> in <span className="formula-url">{repository}</span>.</p></div>
      </section>
      <section className="formula-section formula-next" id="formula-next"><div className="formula-section-heading"><h2>Steps toward physical accuracy</h2><span>Validation remains open</span></div><ol><li>Measure peat density, permeability, water retention, thermal properties, oxidation kinetics, strength and fracture energy over relevant moisture and temperature ranges.</li><li>Resolve or calibrate surface ignition, a moving smoldering front, CO/char chemistry and atmospheric exchange against independent peat-fire experiments.</li><li>Add mobile liquid-water flow and measured hose delivery, then validate infiltration and cooling profiles; resolve excavation, gas conduits, cap supports and contact where needed.</li><li>Repeat mesh and timestep studies for hot, wet, reacting and fully coupled cases; compare predicted temperature, gas, displacement and suppression outcomes against holdout experiments.</li><li>Propagate measured input uncertainty and report prediction intervals only after the model passes those independent comparisons.</li></ol></section>
    </main>
  </div>
}
