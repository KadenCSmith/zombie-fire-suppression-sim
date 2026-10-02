# Coupled continuum 0.11 — equations, evidence and limits

This is a new 3D research workspace. Earlier scientific, mechanics and illustrative scenes remain available. No measured suppression or field-rupture validation is claimed.

## State, geometry and conservative discretization

One 8 × 8 × 3.2 m reference domain, with x/y horizontal and positive depth, drives both finite-volume transport and eight-node/eight-point brick mechanics. SI internally; gas amounts mol, solids/condensed phases kg, stored energies J, temperature K. The peat lens is an assumed 7 × 7 × 1.8 m ellipsoid with unburnt margins. The initially hot region is **prepared dry** at 543.15 K: atmospheric superheated liquid would be inconsistent. Initial hot-region energy is present in the initial inventory, not supplied by CO₂. Initial gas pressure/composition and water saturation are equilibrated before stepping.

Four species: O₂, CO₂, N₂-like background and water vapor. Pressure is nRT divided by current gas-accessible pore volume, which excludes liquid, ice and the finite source-solid volume. Anisotropic intrinsic permeability, cubic gas relative permeability and a Kozeny–Carman pore-volume factor enter Darcy mobility. Mixture-density gravity enters vertical Darcy flow; the associated change in gravitational potential energy is exchanged with internal energy and recorded. A nonlinear compressible implicit storage equation uses shared faces, Picard iteration and float64 PCG. Explicit species fluxes combine upwind advection with equal-diffusivity mole-fraction diffusion. A trial exceeding 20% outward turnover of any species retries at half timestep; no unrecorded inventory clipping. Boundary species/enthalpy transfers are signed and recorded. Darcy flow is bounded by a permeability-derived pore Reynolds estimate <=1 and Mach <=0.05. These are regime guards, not a validated transition model; Forchheimer/acoustic/turbulent flow is unavailable.

The permeability factor follows the *shape* of Carman's granular-bed relation, $k/k_0=(\phi/\phi_0)^3[(1-\phi_0)/(1-\phi)]^2$, but its use for deforming peat is an uncalibrated adaptation. The additional $(V_g/V_p)^3$ gas-relative-permeability factor is a project assumption, not a coefficient measured by Carman or the supplied coal-mine paper. See the [equation and source audit](PHYSICS_FORMULA_AUDIT.md) for the paper-by-paper mapping.

Each cell stores **internal energy**, with species Cv and advected h = u + RT. Dry solid and mineral sensible energy, water vapor reference energy, fusion and liquid/ice heat capacities enter one inversion. Water vapor equilibrates to saturation, with an explicit isothermal freezing plateau. Liquid water and ice are immobile: no Richards flow, water pressure, cryosuction, segregated ice or ice-heave stress. Freeze-volume exhaustion stops the run. Constant caloric coefficients are approximations, and local equilibrium omits finite-rate pore-water phase kinetics.

The finite dry-ice sphere has shrinking mass-derived contact area. A constant-latent-enthalpy Clausius–Clapeyron relation gives the sublimation temperature from total local pressure, restricted below the CO₂ triple point. The caloric source balance uses latent **internal** energy, including the pV conversion from measured sublimation enthalpy, and returns excess heat after depletion. Assumes a locally CO₂-dominated surface film whose pressure equals local total pressure; diffusion-limited sublimation into air, deposition, source thermal gradients and nonideal/liquid CO₂ are unresolved. Heater input is W integrated once; ordinary coupled mode has no instant-conversion intervention.

Oxidation is an explicitly reduced cellulose-surrogate reaction C₆H₁₀O₅ + 6 O₂ → 6 CO₂ + 5 H₂O. Finite O₂ and fuel cap conversion. Arrhenius kinetics include oxygen availability and an assumed exponential dry-basis moisture factor. Chemical energy lost by fuel equals reaction heat added to thermal state. These kinetics and the 15 MJ/kg heat release are **not a fit to matched peat observations**. Char, pyrolysis, CO and surface flaming are not implemented. No staged flame is displayed in this workspace.

## Mechanics and coupling

The same heterogeneous cells are small-strain 3D bricks. Gravity is first solved with the actual material stiffness, root trusses and lateral-roller/base supports. The resulting Gauss-point effective stress/strain is retained in the constitutive reference. This fixes the earlier benchmark's omission of gravity from its material state, without changing the preserved benchmark implementation. Mineral-bearing cells have 10× the assumed peat modulus. This contrast is an assumption.

A spectral tensile/compressive strain-energy split follows the phase-field framework of Miehe et al. Positive elastic energy is degraded by g(d) = 10⁻⁶ + (1−10⁻⁶)(1−d)²; compressive energy is retained. At d=0 the implementation evaluates the algebraically equivalent linear law directly. The phase field has AT2 energy ∫ Gc [d²/(2ℓ) + ℓ|∇d|²/2] dV, cell-centered shared-face gradients, a history drive and irreversible lower bounds. Its spatial support comes from solved stress and material/boundary conditions; no crack plane is prescribed. AT2 has diffuse damage before a discrete failure threshold. ℓ changes effective strength and cannot be treated as only a numerical setting. The history formulation is a common approximation to constrained minimization, not an exact globally minimizing fracture solver.

Positive/compressive splitting restores compressive stiffness on closure, but a diffuse crack is **not a resolved open interface with frictional contact**. A 2% Gauss-point incremental principal-strain limit rejects states beyond the supported kinematics. Crack-band resolution requires h <= ℓ/2; Preview at default ℓ = 1 m is under-resolved. Pressure-controlled instability may exhaust staggered convergence before a propagating crack is obtained; failures preserve the last accepted state. Do not infer a completed rupture path from partial diffuse damage.

Pressure loads use the work-conjugate Bᵀ α Δp I operator. Pore volume changes by α V tr(ε); its feedback changes gas storage and permeability. Pressure/displacement iterations restore all trial histories and converge to 10⁻⁴ Pa. A trapezoidal pressure-work exchange updates internal energy and resolves pressure/phase equilibrium; the reference-pressure boundary work is recorded separately from incremental elastic/fracture work. Thermal and mechanical residuals are exported separately, so a balanced thermal ledger cannot conceal mechanical splitting error. Skeleton density changes after fuel loss, thermal strain, plasticity, creep, rate/temperature/moisture-dependent strength, grain compressibility calibration and changing reference geometry remain unresolved.

Eight axial embedded root trusses contribute explicit EA/L stiffness and stored energy, bonded to grid nodes. Their assumed E = 100 MPa, radius = 12 mm, placement and perfect bonding are uncalibrated; no tensile rupture or pullout. The more detailed irregular root anatomy, oak and borehole in the view are labeled illustrative. The borehole is not a separately resolved gas conduit: it does not create an unaccounted high-permeability shortcut. Source placement is a subgrid finite-solid inclusion; excavation and soil removal are not modeled.

## Concave cap: coupled reduced shell, contact and supports

A circular shallow-shell Ritz model is now coupled to the top control volumes and soil nodes. The normal flexural mode is ψ = (1−r²/a²)²; an in-plane radial mode b(r/a)(1−r²/a²) is eliminated by minimizing membrane energy. Radial quadrature integrates bending and membrane stiffness using D = Et³/[12(1−ν²)] and curvature 2h/a². At zero rise, the uniform-pressure solution recovers q = p a⁴/(64D). This is a shallow-shell approximation, not a general finite-deformation shell mesh. Rise/radius is restricted to <=0.3, flexural change to 5% of radius, support motion to 10 mm, and estimated incremental shell strain to 1%.

The shell has rigid rim translation, bilateral elastic anchors, and unilateral compressive bedding/contact. Weight is included in the geostatic FE preload, with the cap's initial contact compression and flexure used as its reference. A 24 × 64 equal-area surface quadrature and ring interpolation use the **same weights** for pressure force, pore/cavity-volume change and nodal virtual work. Compressive contact vanishes when the rim lifts; anchors then carry tensile restraint. No tensile bedding force is invented. This is frictionless normal contact with a reduced ring, not local frictional sliding or support failure.

The cap seals its fractional footprint against atmospheric Darcy/species exchange. An opened rim provides a 20 mm long laminar parallel-slot outlet, cubic in gap, with Reynolds <=1000 and Mach <=0.05 guards. The previous accepted gap is used during transport and is updated with the converged mechanical state, making this a first-order staggered vent coupling. Cap cavity volume and pressure work are included in the same gas ledger; shell/support energy enters the mechanical mismatch. Cap geometry is driven by the calculated rim and flexural motion at 1× scale.

Defaults: radius 0.475 m, rise 0.1 m, thickness 5 mm, E = 200 GPa, ν = 0.3, density 7850 kg/m³; anchors 10⁸ N/m, contact 10⁹ N/m. All are **assumed**, not measured on the user's cap/supports. The elastic steel coefficients are approximate ordinary steel values; grade/yield/buckling data are absent. Mass uses projected area (a shallow-shell approximation). Higher shape modes, plasticity, buckling, fracture of supports, thermal expansion and cap heat storage are unresolved. Surface heat exchange remains the scenario's effective Robin boundary, including under the cap. In the rigid comparison, the same sealed footprint is retained but soil and cap deformation are suppressed.

Coupled fracture is subject to an additional per-step energy gate: mismatch must be <=max(10 µJ, 0.1% of incremental gauge-pressure work). It fails visibly and rolls back if the static/history approximation releases unaccounted energy; this residual is never relabeled as damping. Pressure-controlled instability and the coarse diffuse fracture energy study remain unresolved gates.

## Evidence register (values, basis and applicability)

All domain, source-placement, hot-region, saturation, soil texture/layer, and material-contrast inputs are scenario **assumptions**, not measurements. The user supplied no matched raw calibration/holdout data. No fitted or holdout validation specimens have been invented. Existing `MATERIAL_EVIDENCE_ASCE.md`, `WORKBENCH_PARAMETER_EVIDENCE.md`, and `PEAT_TENSILE_FAILURE.md` remain the detailed records for reused properties and the preserved coupon.

| Adopted property | Value / range and units | Status, conditions and uncertainty |
|---|---|---|
| Ideal gas R; molar masses O₂/CO₂/N₂/H₂O | 8.314462618 J/(mol K); 0.031998/0.0440095/0.0280134/0.01801528 kg/mol | SI/chemical constants; background approximated as N₂. Ideal mixture restricted to 1–300 kPa. |
| Gas Cv | 20.8/28.8/20.8/25.3 J/(mol K) | Constant species approximations. Not measured/fitted for this changing-temperature mixture; uncertainty not quantified. Cp = Cv + R, never confused with storage Cv. |
| Water heat capacities/densities | liquid 4186 J/(kg K), 1000 kg/m³; ice 2100 J/(kg K), 917 kg/m³ | Rounded near-freezing constants. Temperature/pressure dependence omitted. Not laboratory peat properties. |
| Fusion / vapor enthalpy reference | 333550 / 2500900 J/kg at 273.15 K | Rounded water phase values; vapor internal reference subtracts Rv T. Constant caloric interpolation, not full IAPWS energy EOS. |
| Saturation pressure | Murphy–Koop ice equation; IAPWS liquid saturation correlation | Literature thermodynamic correlations; pure water, no salinity/capillarity. Ice curve used below 273.15 K, liquid to critical temperature. Above critical/all-vapor state is only a caloric approximation. |
| Dry ice | density 1560 kg/m³; cp 850 J/(kg K); 194.67 K at 101325 Pa; Lh = 6030×4.184/0.0440095 J/kg | Temperature/enthalpy from Giauque and Egan; density/cp retained approximations, no new fit. Constant-latent Clapeyron extrapolation below 216.58 K. Contact conductance 1.5 W/(m² K) assumed. |
| Peat dry density, organic fraction, cp | 180 kg/m³, 0.9 dry mass fraction, 1840 J/(kg K) | Density/composition are demonstration assumptions; cp is a literature model input from Huang/Rein, not a measured property of the same peat. |
| Peat conductivity | 0.16 + 0.6 initial saturation W/(m K) | Assumed mixture relation; frozen/char/radiation conductivity not calibrated. |
| Transport | μ = 1.8×10⁻⁵ Pa s; kV base = 8×10⁻¹² m²; kH=3 kV; D=1.6×10⁻⁵ m²/s; tortuosity=3 | Uncalibrated air-like viscosity and soil transport assumptions; inherited peat/layer multipliers documented in source. Temperature-dependent mixture transport missing. |
| Reaction | Aref=2×10⁻⁶ s⁻¹ at 550 K; Ea=35000 J/mol; Q=15 MJ/kg; O₂ half fraction=0.06; T onset=390 K | Reduced assumptions motivated by smoldering studies. No matched peat heat-release/kinetic fit, error interval unavailable. Moisture factor exp(−water/dry solid) assumed. |
| Mechanical E, ν, α | peat E=1 MPa (UI 0.5–10); mineral-bearing E=10 Epeat; ν=0.25; α=0.8 | Assumptions, not calibrated to matched peat. Effective-stress form from Biot. E changes runtime/strain validity, not evidence of realistic strength. |
| Fracture Gc, ℓ, residual g | 5 J/m² (UI 1–100); 1 m (0.2–2); 10⁻⁶ | Unmeasured Gc; ℓ is regularization/material length, not peat fiber observation. Existing 3.5–5 kPa Krimpen tensile observations do not independently determine this model's E/Gc/ℓ. No validation of crack orientation. |
| Root bars | E=100 MPa, r=0.012 m, eight bonded axial elements | Assumed geometry/modulus, not species-specific tests; unquantified uncertainty. Decorative roots have additional geometry outside these bars. |
| Cap geometry / shell / supports | a=0.475 m, h=0.1 m, t=5 mm; E=200 GPa, ν=0.3, ρ=7850 kg/m³; anchors/contact 10⁸/10⁹ N/m; vent length=20 mm | Assumed configuration, ordinary steel approximation. No matched cap/support test or error interval. Shallow-shell/contact mode and numerical verification described above. |
| Gravity and supports | 9.80665 m/s²; lateral rollers and fixed vertical base | Conventional gravity; assumed domain boundaries, subject to domain sensitivity. No arbitrary horizontal pressure footprint applied in the coupled scenario. |

Software input ranges are guardrails, **not confidence intervals**. Quantitative uncertainty awaits matched material preparation, moisture, density, orientation, loading rate and measured force/opening/temperature/species histories. The literature provides model forms and context; it does not validate this implementation.

## ASCE-style references

Biot, M. A. (1941). “General theory of three-dimensional consolidation.” *J. Appl. Phys.*, 12(2), 155–164. https://doi.org/10.1063/1.1712886.

Carman, P. C. (1997 republication of 1937 work). “Fluid flow through granular beds.” *Chem. Eng. Res. Des.*, 75, S32–S48. https://doi.org/10.1016/S0263-8762(97)80003-2. Source of the porosity-factor shape, not a peat calibration.

Giauque, W. F., and Egan, C. J. (1937). “Carbon dioxide. The heat capacity and vapor pressure of the solid. The heat of sublimation. Thermodynamic and spectroscopic values of the entropy.” *J. Chem. Phys.*, 5, 45–54. https://doi.org/10.1063/1.1749929.

Huang, X., and Rein, G. (2014). “Smouldering combustion of peat in wildfires: Inverse modelling of the drying and the thermal and oxidative decomposition kinetics.” *Combust. Flame*, 161(6), 1633–1644. https://doi.org/10.1016/j.combustflame.2013.12.013.

Huang, X., and Rein, G. (2016). “Thermochemical conversion of biomass in smouldering combustion across scales: The roles of heterogeneous kinetics, oxygen and transport phenomena.” *Bioresour. Technol.*, 207, 409–421. https://doi.org/10.1016/j.biortech.2016.01.027.

IAPWS (1992). *Revised supplementary release on saturation properties of ordinary water substance*. International Association for the Properties of Water and Steam. https://iapws.org/relguide/Supp-sat.html.

Miehe, C., Welschinger, F., and Hofacker, M. (2010). “Thermodynamically consistent phase-field models of fracture: Variational principles and multi-field FE implementations.” *Int. J. Numer. Methods Eng.*, 83(10), 1273–1311. https://doi.org/10.1002/nme.2861.

Murphy, D. M., and Koop, T. (2005). “Review of the vapour pressures of ice and supercooled water for atmospheric applications.” *Q. J. R. Meteorol. Soc.*, 131, 1539–1565. https://doi.org/10.1256/qj.04.94.

O’Kelly, B. C. (2017). “Measurement, interpretation and recommended use of laboratory strength properties of fibrous peat.” *Geotechnical Research*, 4(3), 136–171. https://doi.org/10.1680/jgere.17.00006.

Timoshenko, S., and Woinowsky-Krieger, S. (1959). *Theory of plates and shells*, 2nd Ed., McGraw-Hill, New York. ISBN 0-07-085820-9. https://books.google.com/books/about/Theory_of_Plates_and_Shells.html?id=gfo_AQAAIAAJ. General classical shell basis; the specific Ritz/support approximation here is derived in code, not a measured specimen model.

Wierzbicki, T. (2013). “Bending response of plates and optimum design.” *2.080J Structural Mechanics*, Lecture 7, MIT OpenCourseWare. https://ocw.mit.edu/courses/2-080j-structural-mechanics-fall-2013/f8fd2ad49d100766335b4e129a8a4791_MIT2_080JF13_Lecture7.pdf. Analytical circular-plate verification basis.
