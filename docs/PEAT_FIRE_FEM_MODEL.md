# Peat Fire FEM: active reacting porous baseline

Updated 2026-10-02 after the accepted follow-up. The active worker and scene now use `src/peatfem/coupled.ts`, `chemistry.ts` and `operators.ts`. The reduced dry fixture below remains a separate verification reference; it is no longer the active physical model.

## Active inventories and exact source family

A fixed 0.10 m cube has five finite condensed inventories (water, virgin dry peat, alpha-char, beta-char, ash) and four gas pools (O2, N2, vapor, lumped emissions), all kg/m³ **bulk**. Temperature is K, absolute pressure Pa, oxygen is kg O2/kg **total gas**, Darcy flux m/s superficial; pore velocity is q/theta_g. Gas fractions sum to one by solving the same conservative operator for every species; fields are never renormalized after transport.

C4 Irish-moss **column** constants from the rendered Table 1 are used together: log10 Z [s⁻¹] = 27, 8.18, 16.80, 8.38, 13.30; E [kJ/mol] = 200,112,195,117,172; n = .50,5.31,2.33,1.32,2.58; oxidative orders = .24,.52,.86. Drying and pyrolysis are oxygen independent. Oxidation uses `(1+Y_O2)^nO−1`. C3 Eq 15–18 establishes initial source-species normalization: initial water for drying; initial dry peat for peat and **both chars**. Initial peat includes its original mineral content, released as source-fitted ash yields; adding separate initial mineral mass would double count it. A separately versioned TG fit has not been transferred.

Stoichiometry: water→vapor; peat→.28 alpha-char+.72 emissions; peat+.89 O2→.61 beta-char+1.28 emissions; beta-char+2.21 O2→.04 ash+3.17 emissions; alpha-char+2.12 O2→.07 ash+3.05 emissions. Accepted extents update every inventory, gas source and reaction heat together. Endothermic ΔH [MJ/kg] is +2.26,+.50; oxidative ΔH is −11.60,−28.90,−27.80. Drying latent demand appears once, in ΔH. No resolved elemental CO/CO2/H2O emissions beyond the evaporation pool are claimed: the global chemistry does not provide elemental yields. Ash fractions along the two paths (.0196 and .0244) differ because of the published fitted yields; exact common mineral yield is not asserted.

Local rates are explicitly source-normalized. Conservative subcycling limits shared-reactant depletion and thermal changes; oxygen uses a frozen-state exponential inventory factor shared by all oxidative extents. This is a numerical approximation and its splitting/source error is controlled through full-step versus two-half-step comparison. It is not a nonlinear chemical-equilibrium solve. No arbitrary temperature ceiling, source thermostat, reaction-zone broadening or active suppressant is present. Condensation is omitted; column drying constants are not a complete reversible phase-equilibrium law.

## Active material, mass, pressure and energy closure

Intrinsic constituent densities [kg/m³] =1000,1500,1300,1300,2500; cp [J/(kg K)] =4186,1840,1260,1260,880; intrinsic k [W/(m K)] =.60,1,.26,.26,1.2 (C4 Table 2). Some printed porosities conflict with density ratios. Runtime follows the rendered Eq 6 dimensional relation and derives volumes directly, instead of copying inconsistent entries or changing intrinsic density. Printed Eq 8/text mass-volume labels are inconsistent; the implemented mixing basis is explicit.

    theta_g = 1 − sum(m_i/rho_s,i)
    phi_total = theta_g + m_water/rho_water
    U = [sum(m_i cp_i) + sum(g_j cv_j)] (T−300 K)
    cv_j = cp_g − R/M_j
    p = R T sum(g_j/M_j) / theta_g
    k = sum((m_i/rho_s,i) k_s,i) + theta_g k_g + gamma theta_g sigma T³

This is a fixed-volume adaptation, not Gpyro shrinking geometry. Material loss increases gas-filled space without geometric recession. gamma=.0005 m is an illustrative selection within C4's stated .0001–.001 m range. k_g=.026 W/(m K), common gas cp=1000 J/(kg K), molecular masses [.031998,.028014,.01801528,.02897] kg/mol define an explicit surrogate thermodynamics. The emissions MW is air-like, not a measured molecular emission yield. Char/ash hot properties and gas thermodynamics lack independent calibration.

Intrinsic K=1e-12 m² is a named model assumption comparable to N1, not measured hot-peat permeability. Relative gas connectivity `(theta_g/phi_total)^3` is an explicitly synthetic liquid-blocking closure. μ=1.8e-5 Pa·s and D=2e-5 m²/s are constant illustrative coefficients. Storage, gas density and diffusion coefficient theta*rho*D evolve; no arbitrary temperature multiplier is added. Liquid transport and shrinkage remain absent.

    d(theta_g rho_g)/dt + div(rho_g q) = S_g
    q = −K krg/mu (grad p − rho_g g)
    d(theta_g rho_g Y_j)/dt + div(rho_g q Y_j − theta_g rho_g D grad Y_j)=S_j
    dU/dt + div(rho_g q cp_g (T−300)) − div(k grad T)=−sum(ΔH_k r_k)

Equal species D and common cp imply zero summed diffusive mass and sensible-enthalpy flux, since sum grad Y=0. Species sum/source sum are checked, rather than independently fixing gas density and pressure. Gas generation and thermal expansion affect pressure through the EOS. Gas enthalpy advection and boundary enthalpy are retained in the energy ledger. Sensible storage and latent/reaction source have a common declared 300 K reference. Gas potential/kinetic energy, Darcy dissipation and pressure work associated with changing pore space are omitted. At 1 atm, drying pore-work scale p/rho_water /latent ≈4.5e-5; this only bounds the drying contribution, not every high-pressure composition change. Large overpressures would invalidate that approximation; no fully thermodynamic hot-mixture validation is claimed.

## Active FEM and stabilization

The weak balance is `∫w storage_dot −∫grad(w)·flux +∫boundary w flux·n −∫w source=0`. Heat, pressure and species diffusion are assembled from genuine Q1 hexahedral shapes, connectivity, Jacobian, 2×2×2 volume and 2×2 face Gauss quadrature. Variable diffusion/heat coefficients use element means (piecewise constant coefficient approximation). Time storage uses nodal row-sum lumping. Cubic isotropic Q1 stiffness has nonpositive off-diagonal entries.

Compressible pressure uses EOS storage and a Picard-frozen density Darcy stiffness; symmetric Dirichlet elimination retains physical row scaling, so pressure rows cannot dominate the mixture-mass residual. Darcy stiffness edges furnish a compatible conservative mass-flux representation. Species advection uses donor values on that **assembled FEM graph**; this is an edge upwind / graph-viscosity approximation of the advective weak term, rather than exact Gauss integration of the nonlinear advective product. It adds spatial numerical diffusion. Pressure itself is Galerkin FEM; no existing FVM module is relabeled. Pair fluxes cancel exactly in global balances. Positive diagonal, nonpositive off-diagonal and continuity-derived positive row sums give an M-matrix and a positive species update for positive RHS. The nodal diffusion action preserves constants and summed species flux is zero. Analytical cases and the separate refinement study assess consistency and numerical diffusion; formal second-order advection accuracy is not claimed.

Each split interval performs reaction, frozen-temperature compressible pressure/species EOS Picard, and gas enthalpy/conduction iterated together to relative temperature/EOS error <1e-8, followed by exact EOS evaluation. Every iteration starts from the same reacted checkpoint, so sources and transport are not counted twice. This retains the prescribed boundary pressure after thermal expansion. Reaction versus transport remains first-order operator splitting; gas/heat transport is Picard coupled. It is not a monolithic implicit chemistry solve. Two half intervals are accepted after comparing with a full interval. Norms: T/(.1+.001T), p/(1+.0005p), condensed masses/(1e-5+.002rho0), gas/(1e-7+.001 total gas), times toleranceScale. Error>1, invalid state or failed residual rejects the interval. Bounded retries preserve the last accepted checkpoint. Physics advances in a worker; render speed never changes dt. Actual computed physical seconds per advance-call wall second are displayed separately from requested pacing and rendering.

Top p=101325 Pa; incoming mixture [.233,.767,0,0]; outgoing composition is upwind. Top composition exchange .01 kg/(m² s) times (Y−Yambient) has zero summed mass flux. Other mass faces are sealed. Top convective heat loss h=10 plus Picard-iterated radiation emissivity .95; other heat faces insulated in the cube fixture. A finite normalized Gaussian supplies 8 W for 180 s. Closed fixtures seal/insulate all boundaries. Radiation's coefficient is iterated with temperature; its factored flux recovers sigma(T⁴−Ta⁴) at nonlinear convergence. Gas enthalpy, boundary pressure and species share the converged transport state.

## Current evidence and analysis protocol

Focused checks cover source normalization, zero-oxygen independence, latent cooling, separate chars, EOS, variable materials, homogeneous Darcy flux, gravity equilibrium, closed pressure relaxation, generated-gas venting, total mixture/species/energy closure, finite ignition, deterministic checkpoint, disabled intervention identity and failure retention. The expanded native worker/field/navigation/session lifecycle passes. The full integration suite passes (1763 tests in 91 files, 5.38 s on final code including recording continuation and residual-floor regressions), including pre-existing regressions. Test count is not physical validation.

`node --experimental-strip-types scripts/analyze-peat-fem.mts profile` measures actual throughput at 4³/8³/16³. The separate `convergence` mode runs three meshes, three maximum steps and a stricter solve/splitting case, retains raw observers/residuals and hashes the relevant code and inputs. Reuse requires exact hashes and is labeled. The initial hot-wet runs of the earlier sequential transport implementation failed at t=0: simultaneously imposing an 850 K wet seed and its inherited cold-gas inventory creates an incompatible pressure/rapid-drying start. This is retained failure evidence, not a convergence pass. A prepared dry-hot seed at ambient EOS pressure, buried at the domain center with ambient boundaries, advanced successfully. The 850 K pilot took 66.66 wall seconds for 0.5 physical seconds; its source-conditioning references remain the original uniform material water/peat masses. A separate 650 K / 0.25 s short study assesses transport/source onset on three meshes and three maximum steps. It does not replace the 850 K / 6 s hot study or long-time front convergence, which remain incomplete. The refined study exposed the absolute linear residual floor and the correction tightens 1e-14 to 1e-18 without relaxing nonlinear or conservation tolerances. Old hash failures remain retained.

Temperature contour 500 K and 5% peat-depletion depth are numerical fixture diagnostics, not the C4 measured front. C4 derives spread from thermocouple peak arrival; that definition must be used for a matched comparison. Predeclared coarse limits: 5 K probe error, 5% mass error, 2 mm contour difference. A 16³ reference is not automatically grid independent; order/extrapolation require asymptotic evidence. Approximate measured temperature peaks / arrival facts from C4 Fig3(a,c) are digitized in `C4-measured-peaks.json` / CSV with native pixel coordinates, axis calibration, 3-pixel extraction bounds and protocol metadata. No raw replicate data is claimed. The active cube does not match column height, buried heater, bottom loss or geometric recession; comparison scores remain unrun. No calibration or experimental validation criteria pass is claimed. Source acquisition, observable-level comparisons and limitations belong in the source registry and evidence reports.

---

# Preserved reduced fixture specification (model.ts)

Written 2026-10-02 on `feat/peat-fire-fem`, based on published v0.20.0
`161e7a4a1f8c35765e1878c132db79977be1f5ea`. This is a reduced verification
increment, not a reproduction of the complete Huang–Rein model.

## Domain, fields and inventories

Fixed 0.10 m cube, coordinates x/y horizontal and z upward (0 ≤ z ≤ L).
Continuous Q1 trilinear hexahedra on regular cubic cells. Primary nodal fields
are temperature T [K] and oxygen concentration c [kg O₂/m³ gas]. Local nodal
inventories are dry peat f and passive β-char b [kg/m³ bulk]. The cumulative
released lumped product gas is tracked in kg. No shrinkage, drying, pyrolysis,
char oxidation, pressure, total-gas closure or suppression is implemented.

Heat storage is the explicitly **frozen effective medium** U=C(T−300 K), with
C=ρ₀ cₚ. It does not decrease with the reacting solid mass. That approximation
is intentional and limits physical applicability; this is not composition-
dependent enthalpy. Gas sensible enthalpy/storage are omitted (ambient gas
storage is approximately 0.5% of initial solid storage), not added again as
reaction energy. This estimate does not justify hot product advection.

## Equations and boundaries

    C ∂T/∂t − ∇·(k ∇T) = Q r
    φ ∂c/∂t − ∇·(φ D ∇c) = −ν r
    ∂f/∂t = −r;  ∂b/∂t = y r
    released product mass rate = ∫(1+ν−y) r dV

Here r is kg peat/(m³ bulk s), Q=11.60 MJ/kg peat, ν=0.89 kg O₂/kg peat,
y=0.61 kg β-char/kg peat. These all belong to the **peat oxidation (po)**
column of Table 1 in [Huang and Rein 2017](https://doi.org/10.1071/WF16198).
The other four source reactions are omitted, not silently folded into this one.

    r = ρ₀ 10^16.80 exp(−195000/(R T)) (f/ρ₀)^2.33
        × [(1+c/ρg,ref)^0.24 − 1]

Eqns 5a–5c and Table 1 were inspected as publisher formula/table images.
The peat reactant is normalized by its original dry mass; β-char is a passive
product so no unknown initial-char normalization is inferred. c/ρg,ref is an
**oxygen mass fraction relative to a fixed dry reference carrier**, not oxygen
volume percent or a solved gas-mixture fraction. At zero O₂ or zero peat the
oxidative rate and heat release are zero. Accepted extents are bounded by both
inventories and heat/products use those exact extents.

Initial conditions: T=300 K, c=ρg,ref×0.233, f=ρ₀, b=0. Top outward heat flux
is h(T−300)−P a(x,y) for 0≤t<τ, then h(T−300); a is a Gaussian normalized
by the same surface quadrature to ∫a dA=1. Thus total ignition is exactly Pτ,
independent of mesh. Top outward oxygen flux is φ vₘ(c−cambient). All other
faces are insulated and sealed. No runtime Dirichlet condition is imposed;
Dirichlet elimination is provided and independently tested in verification.
Heat and oxygen boundary losses are integrated at their implicit time level.

## Parameters and provenance

| Parameter | Value | Status / inspected locator |
| --- | --- | --- |
| ρ₀, cₚ, intrinsic kₛ | 123 kg/m³, 1840 J/(kg K), 1 W/(m K) | Transferred Irish peat: 2017 Table 2; not measured for this fixture |
| φ, k | 1−123/1500=0.918, kₛ(1−φ)=0.082 W/(m K) | Fixed adaptations of Table 2; omit pore radiation and evolving material |
| po Z, E, orders, yields, heat | Above | Transferred Table 1, Eqns 4c and 5a–5c; subset only |
| h | 10 W/(m² K) | Transferred 2017 Model setup; radiation/bottom exchange omitted |
| D, vₘ, ρg,ref | 2×10⁻⁵ m²/s, 0.002 m/s, 1.2 kg/m³ | Illustrative, constant; no hot-peat diffusivity measurement |
| L, P, τ, Gaussian width | 0.10 m, 8 W, 180 s, 0.025 m | Illustrative localized ignition fixture, not the 2017 protocol |
| cambient | 0.2796 kg/m³ gas | 0.233 dry reference mass fraction × illustrative ρg,ref |

No moisture variable is offered: this is a dry fixture, not 10% dry-basis
experimental peat, wet-basis moisture or pore saturation. D is a gas-volume
diffusivity; φ multiplies storage and flux once. With prescribed zero flow,
Pe=0 by construction, and L²/D=500 s. This justifies a diffusion verification
fixture, **not** removing advection from a matched smouldering column.
Historical modes retain their existing pressure/advection solvers.

## Finite-element discretization and integration

For test functions w in continuous Q1, integrate conduction/diffusion by
parts. Heat weak residual is ∫w C Ṫ + ∫k∇w·∇T + ∫top w h(T−Ta)
−∫wQr−∫top wP a=0; oxygen replaces C,k,h,source with φ,φD,φvₘ,−νr.
Reference basis Nₐ=⅛(1+sₐξ)(1+tₐη)(1+uₐζ), Jacobian diag(h/2),
det J=h³/8. Eight Gauss points assemble consistent mass and stiffness;
mass is row-sum lumped. Four face Gauss points assemble top lumped Robin
terms and the normalized ignition load. The actual connectivity, assembled
sparse operators and action are exposed by the runtime module.

Backward Euler transport uses diagonal-preconditioned conjugate gradients
(relative residual 10⁻¹⁰, explicit absolute tolerance, bounded iterations).
Conservative local chemistry follows transport: analytic fuel power-law
integration at frozen T and oxygen factor, constrained by available O₂.
Two half split steps are compared with one full step; accepted state is the
two-half result. Steps are rejected/adapted on the declared field error norm
or any nonfinite/negative state/nonconvergence. No physical-state clipping,
temperature ceiling, silent renormalization or painted front is permitted.
Report transport residuals and splitting error, not a nonexistent coupled
Newton residual. Chemistry is collocated at lumped nodes with their FE
weights; it is not a separate voxel simulation.

The component ledger checks solid+oxygen+released products and the reduced
stored-energy balance including ignition and top exchanges. This is an
accounting identity for modeled components, **not full gas-mixture conservation**.
An empty intervention interface must be identical; nonempty intervention
entries remain disabled pending their own conservative models/validation.

## Predeclared evidence gates

Element partition/gradient/quadrature, volume and top orientation: 10⁻¹²
normalized error. Hand matrix/action, constant/linear fields and Dirichlet
manufactured cases: 10⁻¹⁰. Closed reaction and open boundary ledgers:
10⁻⁷ normalized. Positivity/depletion, ignition end, deterministic reset,
failure/rejected steps and empty-interface identity must be exercised.

Three-level mesh study (4/8/16 cells per axis, dt≤0.125 s) and step study
(0.5/0.25/0.125 s on 16³), initially through 240 physical seconds. Compare
max/current/peak T, fixed-coordinate probe histories, deepest interpolated
500 K crossing (a declared temperature contour, not a proven fire front),
oxygen, each component and stored energy. Desired coarse-to-fine gate:
≤5 K temperature, ≤5% oxygen/energy, ≤2 mm contour position. These are
project tolerances, not paper uncertainty. Diagnose nonmonotone differences;
no observed order/Richardson/GCI unless an asymptotic regime is demonstrated.
This gate may remain incomplete if the reference is itself under-resolved.

Experimental comparison remains **unvalidated**. The 2017 candidate uses a
0.10×0.10×0.30 m Irish-peat column, measured MC/density, a 100 W buried coil
for 30 min and thermocouples every 2 cm from 5 to 29 cm. Raw/tabulated data
were not supplied; publisher Fig. 3 is measured, Fig. 6 computed. No raw
dataset or uncertainty-qualified digitization has been recovered here.
Geometry, moisture, flow, material evolution and boundary differences above
prevent an honest matched comparison. Oxygen was not established as a
measured observable by this read. Do not manufacture validation scores.

Rendered performance gate: production M3 Pro, coarse mesh with numeric
temperature overlay, 30 s active after warm-up; 1 s rolling FPS floor ≥40.
Keep solver updates, physical time and rendering distinct. Browser-control
access is presently blocked by the app access-policy check; that gate and
developer screenshots are unrun unless access is restored.

## Final acceptance checkpoint

All six short source/transport study cases completed. The 4³ interactive preset fails the predeclared 5 K probe and 2 mm contour comparison: 38.86 K / 3.1 mm against 16³; 8³ differs by 22.07 K. Actual time-step changes produce probe differences below 0.0046 K; stricter solver/splitting tolerances change the 8³ probe by 0.0072 K. Mesh/time asymptotic order and 16³ grid independence are not established. Current 850 K coarse pilot passes execution and ledgers but is not long-time front convergence. Final-build visible 40 FPS gate and developer screenshot are unrun because the native foreground window could not be established; earlier failed/intermediate diagnostics are retained separately. See [complete evidence and reproduction](PEAT_FIRE_FEM_EVIDENCE.md).

Recordings export all accepted posted states in schema 2 with explicit solver revision. Import validates settings, SI pool dimensions/positivity, EOS/composition, chronology, peaks, solver evidence and global ledgers before restarting a paused worker at the last recorded checkpoint. Older/unknown FEM model revisions require an explicit migration and are rejected. Same-runtime deterministic continuation is tested; import is not independent physical validation. The in-app worked example calls properties()/reactionRates() on actual current node data.
