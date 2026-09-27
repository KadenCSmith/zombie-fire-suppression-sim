# Peat tensile failure laboratory — 0.10.0

This is the first bounded fracture calculation added to the model workbench. Open **Soil deformation · FEM benchmark → Peat tensile fracture lab**. It calculates force, bulk extension, crack opening, irreversible damage and energy dissipation for a tensile specimen with one prescribed central weak plane. It supports laboratory data comparison. It does **not** choose a spatial crack path or reproduce field gas rupture. The compression comparison remains a separate homogeneous numerical fixture.

## Laboratory target and evidence

The selected reference is horizontally carved **Krimpen woody peat**, reported by Abebaw (2005) and reviewed in the accessible, peer-reviewed O’Kelly (2017) article [OK17]. Four drained direct-tension specimens were 66 mm in diameter and 100 mm long, with gypsum end caps. Sampling depth was 0.5–0.9 m, initial gravimetric water content 460–570% of dry mass, and imposed axial strain rate 12%/h. The two unsubmerged peaks were **3.5 and 5.0 kPa**; the two submerged peaks were **0 and 2 kPa**. Suction and fibrous structure affect transferability. These are specimen results, not confidence intervals or a universal peat strength law.

The review provides strength observations, but no paired machine-readable force–opening records, grip compliance, measured fracture energy or independent holdout dataset were obtained. The original thesis has not been independently checked. No preconsolidation stress is assigned from an unrelated test. No dry density, shear friction, fire kinetics or moisture law from a different peat is grafted onto this tensile material.

| Input | Adopted value / units | Supported range | Basis and insufficiency |
|---|---|---|---|
| Diameter and length | 0.066 m; 0.100 m | Fixed | Reported specimen dimensions [OK17]. End-cap compliance is omitted. |
| Tensile peak `ft` | 4.25 kPa | UI 0.1–10 kPa | Arithmetic midpoint of the two unsubmerged observations [OK17]; **assumed representative value**, not a third measurement, fit or held-out prediction. |
| Bulk Young’s modulus `E` | 1 MPa | UI 0.1–10 MPa | Assumption. Peak strength cannot determine stiffness; requires matched prepeak curve and compliance correction. |
| Fracture energy `Gf` | 5 J/m² | UI 0.2–100 J/m² | Assumption. Method uses work per crack area [HMP76]; no concrete property is transferred to peat. Requires a complete corrected traction–opening curve. |
| Interface stiffness `K` | 1e8 Pa/m = 0.1 MPa/mm | UI 0.01–10 MPa/mm | Assumed compliance regularization; affects prepeak response. Not a measured peat coefficient. |
| Weak plane and lateral condition | Central; unconfined | Fixed | Prescribed boundary/model assumption. Isotropic axial response; no resolved fibres or chosen fracture orientation. |
| Maximum extension | `1.1 × 2Gf/ft` | Derived | Test schedule deliberately passes complete separation, then unloads to zero grip extension. Not measured failure displacement. |
| Bar elements | 4 | UI 2, 4, 8, 32; API 2–64 | Numerical subdivision of a uniform series bar. Not a spatial crack-path discretization. |
| Load increments per leg | 100 | UI 20–400; API 10–1000 | Numerical sampling. No physical time, viscosity or 12%/h rate prediction. |
| Maximum bulk strain | 2% | Fixed | Scope guard, not a measured peat failure strain. Opening itself is a discontinuity and can exceed this ratio. |
| Display magnification | 8 | 1, 4, 8, 12 | Appearance only. Telemetry and exported quantities remain unamplified. |

The evidence metadata retain water content, orientation, depth and source test rate as context, **not solved state variables**. There is no moisture slider for this law. The zero-strength submerged observation is outside the positive-strength cohesive parameterization; it is recorded as evidence, not silently replaced by the UI minimum.

## Equations and numerical behavior

For area `A = π D²/4`, series-bar compliance per stress `C = Σ Le/E = L/E`, and interface opening `δ`, grip extension is `U = C T + δ`. The traction envelope is bilinear:

- Before initiation: `T = K δ`, with `δ0 = ft/K`.
- Softening: `T = ft (δc − δ)/(δc − δ0)`.
- Separated: `T = 0`, with `δc = 2Gf/ft`.

The area under this envelope is `Gf`; force is `A T`. Damage `d = max_history(1 − T/(K δ))` is bounded in [0,1]. Unloading/reloading below the previous maximum uses degraded stiffness `(1−d)K`. The state does not heal. Partial unloading is checked separately from the displayed full-separation cycle. Compression and closing contact forces are not implemented; negative grip extensions are rejected.

The displacement-controlled softening branch exists monotonically only if `δc > δ0 + C ft`. Otherwise the calculation stops with a snap-back message. Changing coefficients to get past this guard changes the assumed material; it does not repair unstable mechanics. Following an unstable equilibrium would require an arc-length method, or inertia and a dynamic energy balance.

Work is integrated exactly over each piecewise-linear segment, splitting steps at initiation, full separation and the previous maximum. Stored energy is `A (C T² + T δ)/2`. Dissipation is interface envelope work minus recoverable interface energy at the maximum opening. Each frame exports `external work − stored energy − fracture dissipation`. The only energy input is mechanical work at the grips; there is no CO₂, heater or combustion in this specimen.

The renderer stretches two bulk halves and opens their common plane from these calculated displacements. The displayed cross section is constant because lateral strain is not solved by the one-dimensional bar. Its peat color is illustrative. No procedural crack geometry is treated as a numerical prediction.

## Measurement comparison and acceptance criteria

Use **Compare measured CSV** after calculating. Header must be `extension_mm,force_N`; at least three finite, nonnegative observations must have strictly increasing extension on the loading branch. Import is limited to 1 MB / 10,000 rows and cannot extrapolate beyond the calculated loading range. Millimeters convert to meters once. The chart overlays observations; the report gives force RMSE and sampled peak-force error. Preserve source, specimen ID, water-content basis, orientation, confinement, grip compliance, test rate and measurement uncertainty in the notes. Declare whether data were used for fitting or reserved for independent comparison. All are included in JSON export. A user declaration is not an independently verified validation result.

A useful experimental acceptance case must include:

1. Matched specimen geometry, material and preparation, water condition, stress history, orientation, grips and loading path. Correct machine/grip compliance before inferring opening or `Gf`.
2. A calibration subset for `E`, `ft`, `Gf` and `K`, with uncertainty and identifiability checks. Grip extension alone cannot necessarily distinguish bulk from interface compliance.
3. Independent specimens withheld from fitting. Assess peak force, prepeak stiffness, complete postpeak shape and dissipated work against their measured uncertainties; do not choose a tolerance after inspecting residuals.
4. A stable control method that captures the postpeak branch. No complete curve means no defensible fracture-energy validation. Rate/creep sensitivity must be measured before using this rate-independent law beyond that test regime.

There is currently **no passed matched experimental validation case**. Selecting a strength inside the source range and comparing the model against itself are not experimental validation. The CSV path makes that comparison possible without manufacturing observations or claiming a validation score from missing data.

## Verification and scope of convergence

Tests cover an independently constructed bilinear force/opening solution, finite `Gf A` work at complete separation, energy closure, irreversible partial unloading/reloading, nonnegative force, mesh subdivisions 2/4/8/32, 100/200-step agreement, snap-back/strain/contact rejection, and strict unit-bearing measurement import. Mesh independence here checks the series compliance and non-volume-scaled interface energy. It is **not evidence of convergence for arbitrary spatial fracture localization**. `scripts/benchmark-tensile.mjs` records actual timings, source hashes and conservation metrics in `examples/tensileFractureBenchmark.json`.

To predict emergent terrain fracture next requires a spatial regularized failure formulation with mixed-mode and orientation-dependent calibration, initial effective stress/confinement in the yield state, separation/contact, and conservative pressure work coupled to finite transported gas. A principal-stress plot or the existing imposed lateral pressure footprint does not satisfy those requirements. The current homogeneous FEM has no such damage evolution; the existing lattice is a separate demonstration. This release does not add speculative MPM/DEM or coupled menu entries.

## ASCE references and method applicability

**OK17.** O’Kelly, B. C. (2017). “Measurement, interpretation and recommended use of laboratory strength properties of fibrous peat.” *Geotechnical Research*, 4(3), 136–171. [doi:10.1680/jgere.17.00006](https://doi.org/10.1680/jgere.17.00006). [Accessible peer-reviewed article](https://www.emerald.com/jgere/article/4/3/136/437184/Measurement-interpretation-and-recommended-use-of), section “Drained tensile strength.” Accessed September 26, 2026. Secondary reporting of Abebaw’s laboratory measurements is identified explicitly; no original raw dataset was retrieved.

Abebaw, B. J. (2005). *Experimental study on shear and tensile strength of peat soil*. M.Sc. thesis, IHE Delft Institute for Water Education (UNESCO-IHE), Delft, Netherlands. Bibliographic attribution through OK17; original thesis not independently inspected and not used as an independently verified source.

**HMP76.** Hillerborg, A., Modéer, M., and Petersson, P.-E. (1976). “Analysis of crack formation and crack growth in concrete by means of fracture mechanics and finite elements.” *Cement and Concrete Research*, 6(6), 773–781. [doi:10.1016/0008-8846(76)90007-7](https://doi.org/10.1016/0008-8846(76)90007-7). [Primary publisher abstract](https://www.sciencedirect.com/science/article/pii/0008884676900077). Accessed September 26, 2026. Supports the cohesive-traction / fracture-work approach only. Concrete experiments and parameters do not validate fibrous peat. The particular bilinear law and coefficients here are explicit modeling choices.
