# Seated cap, bonded soil and bur oak — version 0.8

This Scene studio version is a **reduced mechanics demonstration under assumed loading**. It does not replace or exchange state with the finite-volume scientific workspace. The ⋯ menu retains the 0.5 cooling illustration, 0.6 authored release and 0.7 gravity/contact particle scene.

## What changed

- The dry-ice sphere lands at 4 s. A downward-facing concave cap begins falling at 4.35 s and seats at approximately 5.09 s. The cap's undeformed apex meets the top of the sphere at −1.94 m. Its rim is then assumed restrained at −2.04 m; this support is a boundary condition, not a calculated attachment or holding force.
- The solid disappears at 9 s, five seconds after landing. A prescribed pressure footprint drives spring-bond particle motion and one deforming cap mode. The footprint broadens laterally and moves upward; its direction is an input.
- The peat lens is centered at 1.65 m depth, with nominal half-width 1.2 m and half-height 0.5 m. A small visibly smoldering core sits inside an unburnt fibrous surround. A slight irregular visual boundary does not change the solver's ellipse.
- A procedural young **bur oak (*Quercus macrocarpa*)** replaces the former tree in this version. It has rounded lobed leaves, a branching crown, a connected root collar, spreading laterals, finer branching roots and descending roots to approximately 2.7 m. The cut face exposes two deep roots around and below the peat pocket; additional roots extend into the section.
- The old shallow peat opening is filled visually. Earlier versions retain their original landscape.

## Particle model and numerical scope

`src/ui/soilParticleModel.ts` calculates a 49 × 25 lattice over an 8 m wide, 3.2 m deep **two-dimensional section of unit thickness**. There are 1,149 active particles and 4,321 initial nearest-neighbor bonds with horizontal, vertical and diagonal connections. The borehole removes particles; the bottom and side boundaries are fixed. Node mass is bulk density × represented cell area × 1 m thickness.

Bond force is axial stiffness times change in length. Bonds fail irreversibly when their tensile stretch exceeds an assumed threshold. Failed bonds retain compressive contact only with their original neighbor. This is a spring lattice: it has no general moving-contact search, particle rotation, calibrated frictional soil law or peridynamic horizon integration. It is not a calibrated DEM or full peridynamic implementation.

Incremental motion is integrated about a supported reference configuration. A local elastic restoring force represents assumed out-of-plane confinement. Gravity-induced initial stress, consolidation and subsequent free gravitational collapse are **not solved** in this soil model. Increasing density changes inertia; independently increasing confinement and failure thresholds with depth also influences its motion. Do not interpret upward separation as a result established by density alone.

A centered pressure-gradient approximation supplies nodal force, `−∇p × volume`. For time `a` after release, the prescribed Gaussian has horizontal scale `0.35 + 0.9 min(a,3)` m, vertical scale `0.2 + 0.25 min(a,4)` m and center height `−2.19 + 0.24 min(a,4)` m. Its amplitude is the editable load times `(1 − exp(−10a)) exp(−a/2.4)`. There is no gas mass/energy budget, solved fluid pressure or pressure/fracture feedback here. The displayed cloud consists of tracers; CO₂ is colorless.

The integration uses 240 steps/s and stores 30 frames/s for the 11 s following release. Replay interpolates those records, so reverse seeking does not integrate the model backward. Fixed neighbor lists and local force accumulation avoid a dense global stiffness matrix; subdividing a dense matrix would not help this implementation. The rendered soil and root vertices sample the same displacement texture. Depth into the display is a visual extrusion/falloff, not a third simulated dimension. Roots do not reinforce, fracture or transfer mass to the particle model. Their biological growth and response to fire are not calculated.

Dark segments are **failed-bond markers**, not resolved crack surfaces. Small grains display the nodal movement. Surface displacement is shown at its calculated scale; the roughly centimeter-scale uplift is not a demonstrated buckling instability. Surface shading normals are approximate under displacement.

## Assumed inputs, not measured properties

| Setting | Current value | Interpretation |
| --- | --- | --- |
| Mineral bulk density | 1,050 + 220 × depth in m, kg/m³ | Scenario-specific mass profile; not a universal soil or peat law. |
| Peat bulk density | 300 kg/m³ | Lower effective bulk density, with no separately resolved moisture inventory. |
| Mineral / peat bond stiffness | 45,000 / 9,000 N/m | Lattice coefficients, not measured Young's moduli. |
| Tensile stretch threshold | 0.014 / 0.009, plus 0.003 per m depth | Assumed mineral / peat failure thresholds. Vertical bonds use a factor 0.6 to represent weaker bedding. |
| Local restoring stiffness | 4,500 + 3,000 × depth in m, N/m | Assumed distributed confinement; not derived from effective overburden stress. |
| Velocity damping | exp(−5 Δt) per step | Numerical/effective damping assumption. |
| Load scale | 18 kPa; UI range 0–30 kPa | Prescribed input, not pressure calculated from dry-ice mass or sublimation. |
| Cap | Radius 0.35 m; initial rise 0.10 m | Downward-facing dome centered on the source. |
| Cap mode mass / stiffness / damping | 8 kg / 42,000 N/m / 180 N·s/m | Single assumed deformation mode, not shell FEA or a material strength rating. |
| Cap loaded area | π × (0.32 m)² | Assumed load area. |
| Oak dimensions and roots | About 3.5 m crown height; descending roots about 2.7 m | Illustrative young-tree geometry in a root-permitting soil; not a surveyed tree. |

For the cap, `8 q̈ + 180 q̇ + 42000 q = p(source) × π × 0.32²`; the added dome displacement is `q(1 − r²/R²)²`. Its restrained rim and load are assumptions. Seating is an inelastic kinematic stop; no impact impulse, plastic shell law, soil anchorage or two-way soil/cap reaction is solved. The model cannot confirm that a cap will hold gas underground.

The separate scientific workspace retains its researched material profiles and finite source inventories. Selecting those profiles does not calibrate these new Scene studio coefficients. See [material evidence](MATERIAL_EVIDENCE_ASCE.md) and [research profiles](RESEARCH_PROFILES.md).

## Research rationale and ASCE-style references

### 1. Pair interactions and irreversible damage — peer-reviewed methods paper

Silling, S. A., and Askari, E. (2005). “A meshfree method based on the peridynamic model of solid mechanics.” *Computers & Structures*, 83(17–18), 1526–1535. https://doi.org/10.1016/j.compstruc.2004.11.026.

**Why needed:** explains damage through particle-pair interactions and provides a relevant path toward a more complete nonlocal fracture model. [Sandia's primary publication record](https://www.sandia.gov/research/publications/details/a-meshfree-method-based-on-the-peridynamic-model-of-solid-mechanics-2005-01-01/) was checked. The present nearest-neighbor spring lattice borrows the general interaction/damage concept, not the full model or calibrated constants. The paper supplies none of this scene's peat or shell coefficients.

### 2. Density with depth — peer-reviewed peat study

Worrall, F., Clay, G. D., Heckman, K., Ritson, J., Evans, M., and Small, J. (2024). “The formation of peat—Decreasing density with depth in UK peats.” *Soil Use and Management*, 40(4), e13155. https://doi.org/10.1111/sum.13155.

**Why needed:** tests the requested assumption that deeper material must be denser. The study of 22 cores from 13 UK sites found no significant increase in bulk density with depth at its individual sites. It supports keeping the scene's increasing mineral-soil profile explicitly scenario-specific; it does not establish the selected 300 kg/m³ peat value or a universal depth gradient. [Primary article](https://bsssjournals.onlinelibrary.wiley.com/doi/10.1111/sum.13155).

### 3. Fracture direction and stress — government research report

Mizuta, Y., and Kobayashi, H. (1980). *Improved stress determination procedures by hydraulic fracturing: Rock fracture extension in hydraulic fracturing for conditions where the principal stresses are inclined to the axis at the pressurized borehole*. Open-File Report 80-1171, U.S. Geological Survey. https://doi.org/10.3133/ofr801171.

**Why needed:** establishes that stress orientation is relevant to pressure-driven fracture direction. It prevents presenting the chosen lateral/upward display path as a consequence of density alone. This report concerns hydraulic fracturing of rock; it is not a direct validation study for gas, peat or this cap. [USGS publication record](https://www.usgs.gov/publications/improved-stress-determination-procedures-hydraulic-fracturing-rock-fracture-extension).

### 4. Oak rooting architecture — government silvics synthesis

Johnson, P. S. (1990). “Bur oak (*Quercus macrocarpa* Michx.).” *Silvics of North America, Vol. 2: Hardwoods*, R. M. Burns and B. H. Honkala, technical coordinators, Agriculture Handbook 654, U.S. Department of Agriculture, Forest Service, Washington, DC. [USDA Forest Service chapter](https://research.fs.usda.gov/silvics/bur-oak) (accessed Sep. 26, 2026).

**Why needed:** supports selecting a bur oak with both rapidly developing deep roots and substantial lateral branching. The chapter reports first-season root penetration of 1.37 m in cited observations. It is a research synthesis, not a new peer-reviewed experiment measuring this scene. The 2.7 m geometry remains an assumed root-permitting scenario, not a species-wide minimum or a prediction in saturated peat. The web chapter has apparent “in”/“m” transcription errors in some later depth examples; those figures were not used to set the geometry.

## Checks and remaining validation

The automated checks cover a zero-load stationary state, cap seating, finite results through the UI load maximum, fixed supports, irreversible damage and repeatable reverse seeking. The default calculation reports 225 failed bonds, about 0.01042 m peak upward surface displacement and 0.10918 m peak cap-mode displacement. These are **software outputs under the tabled assumptions**, not measured performance.

A predictive model would require measured moisture-dependent peat/mineral constitutive laws, independently constrained initial effective stresses, calibrated fracture energy and mesh refinement, gas mass/energy coupling, cap material/contact data and matched physical experiments. Those are not established by passing numerical or UI tests.
