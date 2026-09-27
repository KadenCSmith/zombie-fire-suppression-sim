# Workbench parameter evidence — 0.10.0

Reviewed September 26, 2026. This supplements, rather than replaces, [the existing material evidence registry](MATERIAL_EVIDENCE_ASCE.md). The workbench is a homogeneous numerical fixture. **No measured peat material preset is adopted in this increment.** All below mechanical constants are declared assumptions inherited from the existing solver, with the loading chosen to cross its illustrative yield surface slightly. UI ranges are software limits, not experimental confidence intervals.

## Adopted inputs

All mechanical rows refer to the same homogeneous, initially unloaded incremental block with free sides, vertical roller base, and minimal horizontal anchors. No peat type, water saturation, temperature, specimen preparation, root reinforcement or effective-pore-stress condition is assigned. Consequently none is sufficient for predicting the existing wet, burning oak site.

| Parameter | Default and units | UI range | Measurement basis / applicability and insufficiency |
|---|---:|---:|---|
| Young’s modulus E | 1 MPa | 0.5–10 MPa | Assumption, inherited. Isotropic linear elastic stiffness; no matching peat test. DP52 supports idealization, not this value. |
| Poisson ratio | 0.30, dimensionless | 0–0.45 | Assumption, inherited. Excludes near-incompressible cases needing different elements; no measured moisture relation. |
| Yield intercept c | 8 kPa | 1–20 kPa | Assumption in `q − a p − c − H alpha`; not a direct Mohr–Coulomb cohesion measurement. DP52 motivates pressure-sensitive yielding, not calibration. |
| Friction slope a | 0.35, dimensionless | 0–1 | Assumption, inherited. Not a friction angle. Requires specimen/stress-path calibration. |
| Dilation slope b | 0.05, dimensionless | 0–a | Assumption, inherited. Nonassociated flow extension; no measured volume-change fit. |
| Hardening H | 20 kPa | 10–200 kPa | Assumption, inherited. Linear isotropic hardening; no observed softening, fracture energy or regularization. |
| Bulk density | 1200 kg/m³ | Fixed | Assumption inherited from continuum reference balance. Used only in its gravity check; not a measured peat density or yield-state preload. |
| Gravity | 9.80665 m/s² | Fixed | Conventional standard gravity, not a local site measurement. |
| Block dimensions | 2 × 2 × 1 m | Fixed | Numerical fixture geometry, not a laboratory specimen or site survey. |
| Top traction | 9.2 kPa compression | 0–20 kPa | Prescribed uniform load, chosen for observable yielding under the assumed constants. Not dry-ice gas pressure, a cap load or a prediction. |
| Supports | Base vertical rollers; two horizontal anchor locations; free sides | Fixed | Numerical boundary conditions removing rigid modes. Not measured confinement or cap attachment. |

The linear model uses the same E and Poisson ratio; c, a, b and H do not affect it. This intentional difference is the constitutive comparison. No setting changes the CO₂ or fire inventories in the other workspace.

## Numerical and display inputs

| Setting | Default / range | Basis and limits |
|---|---|---|
| Bricks per axis | 2; choices 1, 2, 4 | Regular eight-node, eight-point bricks. Uniform loading is a patch test; its mesh agreement does not demonstrate convergence of localized failure. |
| Increments per leg | 10; 5–40 | Quasi-static load discretization; 10/20 refinement is checked. Not a time integrator or dynamic rate law. |
| Principal-strain guard | 0.02; fixed | Assumed numerical scope boundary using element-mean total strain. Not a measured failure strain; local Gauss-point localization may be larger. |
| Force tolerances | 1e-4 N absolute, 1e-10 relative | Requested equilibrium norm limits for the new fixture. Both must be interpreted through the solver’s max(absolute, relative × force norm) criterion. |
| Display magnification | 8; 1–20 | Appearance only; instruments/export remain SI. |
| Replay rate | 3; 1, 3, 6 stages/s | Wall-clock presentation only, with no physical time interpretation. |
| Color bounds | Both runs, all stored stages | Common scale; no per-panel normalization. Field definitions are in the workbench guide. |

## Research review and method decisions

**DP52 — constitutive idealization.** The primary AMS-indexed introduction explains an idealized elastic-to-plastic soil with pressure-dependent strength, while explicitly leaving water and constituent differences outside that theory. It supports exposing elasticity and pressure-sensitive plasticity separately. It supplies none of our chosen coefficients. Access: primary indexed opening text; the full PDF fetch returned HTTP 403. The app’s nonassociated hardening implementation is not claimed to reproduce every assumption in the original paper.

Drucker, D. C., and Prager, W. (1952). “Soil mechanics and plastic analysis or limit design.” *Quarterly of Applied Mathematics*, 10(2), 157–165. [doi:10.1090/qam/48291](https://doi.org/10.1090/qam/48291). [Primary publisher text](https://www.ams.org/qam/1952-10-02/S0033-569X-1952-48291-2/S0033-569X-1952-48291-2.pdf).

**HR17 — matching a peat specimen matters.** The accessible publisher methods describe commercial Irish moss peat, dry density 135 ± 5 kg/m³, roughly 2% mineral content, and dry-mass moisture preparation at approximately 10%, 35% and 70%. Density and moisture affect downward spread together; those measurements do not calibrate our homogeneous mechanical fixture or the broad staged fire. Retain finite-volume heat/species inventories and match the column/ignition/boundaries before importing a spread-rate correlation. No new property or kinetic value is adopted here. Access: publisher full-text methods/results.

Huang, X., and Rein, G. (2017). “Downward spread of smouldering peat fire: The role of moisture, density and oxygen supply.” *International Journal of Wildland Fire*, 26(11), 907–918. [doi:10.1071/WF16198](https://doi.org/10.1071/WF16198). [Accessible publisher article](https://connectsci.au/wf/article/26/11/907/194558/Downward-spread-of-smouldering-peat-fire-the-role).

**D25 — mass/volume bases cannot be mixed.** The accessible peer-reviewed soil-mixture paper distinguishes organic carbon, total organic matter and mass/volume properties. It supports retaining separate physical material inputs and existing composition constraints. Its land-surface scope does not establish hot peat mechanics or pressure-driven fracture. No new fitted relation is transferred. Access: publisher full text and abstract; see the previous registry for the already adopted profiles and their provenance.

Decharme, B. (2025). “A process-based modeling of soil organic matter physical properties for land surface models – Part 1: Soil mixture theory.” *Geoscientific Model Development*, 18, 9349–9384. [doi:10.5194/gmd-18-9349-2025](https://gmd.copernicus.org/articles/18/9349/2025/).

FEM is retained for this small-strain equilibrium fixture because independent elasticity and plastic load/unload solutions can be checked immediately. Large-deformation MPM/bonded DEM would additionally require a moving-contact/transfer scheme, calibrated stiffness/strength/fracture energy, stable time integration and separation/conservation benchmarks. The current spring lattice has neither general contact nor gas energy closure. Shell/contact cap mechanics similarly lacks measured cap properties, attachment and interface conditions. These concrete gaps prevent a credible coupled-fracture menu entry in this increment; they do not prevent the working numerical comparison delivered here.
