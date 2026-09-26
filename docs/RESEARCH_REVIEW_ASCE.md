# Research review: peat fire, thermal layers, and dry-ice treatment

Reviewed September 25, 2026 (America/Los_Angeles). Code baseline: `371a68af76a3c83f94173b0a4a36fddf464a481b`. This is a literature and implementation review, not external peer review of this software or experimental validation. Seven peer-reviewed papers are cited below in ASCE author–date style, with source-specific reasons for inclusion. No coefficients were silently replaced and no paper's experiment is claimed as reproduced.

## What the evidence changes

The app can support an exploratory comparison of cooling, oxygen transport, fuel consumption, and recovery after treatment. A realistic-looking thermal animation does not establish a correct reaction rate or successful suppression. A new, directly relevant laboratory study of dry ice is now available (Zhang et al. 2026); its apparatus and the app's buried sphere are different. The next scientific milestone should be a separately named, matched laboratory case, followed by comparison against independent observations.

The current [physics model](PHYSICS_MODEL.md) uses a single oxidation surrogate, fixed initial conductivity and intrinsic permeability, no liquid-water transport or freezing, and separate mechanics. The [mechanics model](MECHANICS_MODEL.md) documents assumed stiffness and strength. These limitations govern the permitted interpretation of every view.

## Why each source is needed

### R1 — Moisture, density, and oxygen are coupled

Huang and Rein (2017) studied downward spread in a 30 cm peat column. Their moisture trend cannot be replaced by a universal “wetter means slower” multiplier: density and oxygen access mattered, and the observed trend in their tested range differed from horizontal spread. [Publisher article, experimental and modelling sections](https://connectsci.au/wf/article/26/11/907/194558/Downward-spread-of-smouldering-peat-fire-the-role).

**Needed for:** `peatRegions[].bulkDensityKgM3`, `moistureSaturation`, `soil.porosity`, permeability, diffusivity, and boundary composition. Literature moisture on a dry-mass basis must be converted explicitly to pore saturation using the selected dry density and porosity; these fractions are not interchangeable. **Decision:** retain their separate inputs, document their dependence, and reproduce the laboratory geometry before importing a spread rate. The 6.096 m demonstration is not that column. No fitted coefficients are taken from this paper.

### R2 — A single oxidation step cannot represent all peat/char stages

Huang and Rein (2019) distinguished upward and subsequent downward propagation, using a five-step reaction model to interpret different roles of peat and char oxidation. [Publisher abstract](https://www.sciencedirect.com/science/article/pii/S1540748918301317).

**Needed for:** `model.smolderRateS`, `activationEnergyJMol`, `referenceTemperatureK`, `oxygenHalfSaturation`, and `heatOfCombustionJkg`. **Decision:** identify the present complete-oxidation law as a surrogate. A credible replacement needs independent peat, char, mineral/ash, moisture, and gas inventories, compatible kinetics, and energy closure. Increasing the current rate merely to sustain a visually convincing fire would not implement this evidence. The reported laboratory ignition-depth observations are apparatus-dependent; they are not a universal maximum burial depth for fire or treatment. Review scope: publisher abstract and institutional version-of-record metadata; no kinetic table was transcribed.

### R3 — Thermal properties must follow material and moisture basis

O'Donnell et al. (2009) measured moss and organic-horizon conductivity and examined its dependence on moisture, density, and water phase. [USGS author publication record and abstract](https://pubs.usgs.gov/publication/70035377).

**Needed for:** `soil.thermalConductivityWmK`, layer multipliers, and the peat initialization rule `0.16 + 0.6 × saturation`. **Decision:** the latter remains an explicitly assumed mixture, initialized once; it is not a measured correlation from this study and does not evolve with drying. Introduce material-specific measured property curves only with their density, water-content convention, temperature interval, and uncertainty. Measurements from Alaskan organic horizons do not supply a generic hot, charred-peat conductivity. Review scope: author record/abstract and indexed paper abstract; the full PDF endpoint was unavailable, so no numerical curve was extracted.

### R4 — Dry ice requires a finite phase-change energy budget

Giauque and Egan (1937) supply the experimental thermodynamic provenance for solid CO₂. The NIST compilation attributes approximately 25.2 kJ/mol at 195 K to this work, about 573 kJ/kg using the app's CO₂ molar mass. [NIST phase-change data and original-paper reference](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4).

**Needed for:** `CO2_SUBLIMATION_JKG`, `CO2_SUBLIMATION_K`, solid heat capacity, finite source mass, and the energy ledger. **Decision:** 571 kJ/kg stays documented as a rounded near-atmospheric approximation. Its roughly 0.3% difference from the rounded NIST value is smaller than the unresolved contact model, but should be included in property sensitivity. The constant 850 J/(kg·K) is not a fitted temperature curve. Review scope: NIST's evaluated entry and original citation; the original full paper was inaccessible. No high-pressure or liquid-CO₂ capability is inferred.

### R5 — Direct dry-ice suppression evidence now exists, with a different geometry

Zhang et al. (2026) compare water, ice, dry ice, and liquid nitrogen in controlled, shallow horizontal peat-fire experiments. Their observations motivate tracking cooling persistence and temperature rebound after the agent is consumed. [Publisher methods/results](https://doi.org/10.1016/j.firesaf.2026.104772); [official author repository and metadata](https://ira.lib.polyu.edu.hk/handle/10397/118323).

**Needed for:** source inventory and contact heat, `temperatureK`, `reactionRateKgS`, moisture, and post-treatment recovery. **Decision:** add a future matched firebreak benchmark, not a field dosage preset. The paper's suppressant quantities cannot calibrate a sphere at depth. The app currently pauses if wet soil freezes; reproducing cryogenic cooling therefore requires a tested water/ice enthalpy model and phase-dependent transport first. Cooling and oxygen displacement should remain separately diagnosed. Review scope: publisher-indexed methods, results, and limitations plus institutional metadata; no figures or data tables are redistributed.

### R6 — Pore pressure and deformation require coupled conservation

Biot (1941) develops three-dimensional consolidation for an elastic porous medium with fluid flow. [Original paper DOI](https://doi.org/10.1063/1.1712886); [university-hosted article](https://www.math.purdue.edu/~santos/research/biot_papers/biot_1941.pdf).

**Needed for:** effective stress, pore storage, displacement, permeability, and mechanical boundary conditions. **Decision:** keep the current one-way event calculation and traction-driven continuum benchmark explicitly separate from coupled poromechanics. A later coupled model must account for deformation-dependent pore volume and fluid/solid exchange consistently. This paper does not calibrate `youngsPa = 1e6`, `poisson = 0.3`, cohesion, dilation, damping, or peat tensile strength; its elastic consolidation theory is not a fracture or blast model. Review scope: original abstract and verified citation; the full PDF exceeded the browsing tool's size limit.

### R7 — Computational efficiency needs an equivalent operator and local measurements

Kronbichler and Kormann (2012) examine cell-based finite-element operator evaluation and memory-efficient data structures. [Publisher article](https://www.sciencedirect.com/science/article/pii/S0045793012001429).

**Needed for:** the user's question about submatrices. The app already avoids a dense global matrix and stores local 24 × 24 brick stiffness blocks. **Decision:** share the identical regular-cell operators within each solver instance and cache degree-of-freedom indices. This optimization is implemented with unchanged equations and tolerances; the local comparison matched 120,381 numeric values exactly. Their performance results involve different implementations, hardware, and element orders; they do not establish a speedup for first-order TypeScript bricks. The exact local audit and required equivalence checks are in [Solver optimization review](SOLVER_OPTIMIZATION_REVIEW.md). Review scope: publisher-indexed abstract, implementation discussion, and performance qualifications.

## Bounded implementation decisions

These are proposed engineering changes, not claims of source calibration or results already implemented.

| Priority | Change and exact variables | Required evidence before integration |
| --- | --- | --- |
| 1 | Add explicit conversion/reporting for dry-mass moisture `MC = m_water/m_dry` and saturation `S = V_water/(φ V_bulk)`. With consistent density and volume, `MC = ρ_water φ S / ρ_dry`; state whether roots are included in dry mass. | Round-trip unit tests, limits at dry/saturated states, matching sample preparation. Do not silently clamp a literature sample into a different density. |
| 2 | Replace assumed peat conductivity with a named measured material function `k(T, water content, density, phase)`; preserve the present rule as a demonstration option. | Full property dataset with units and applicable range, interpolation checks, energy-conserving face fluxes, dry/wet sensitivity and mesh studies. |
| 3 | Add water ice inventory and an enthalpy formulation before extending wet scenarios below 273.15 K. | Closed-cell freeze/thaw energy tests, phase-front benchmark, consistent pore volume and permeability; retain the current validity pause until then. |
| 4 | Add peat/char reaction inventories and calibrate a matched specimen rather than replacing only `activationEnergyJMol` or `smolderRateS`. | Reproduce the source's heating protocol and boundaries; compare held-out temperature, mass-loss, and front-position histories. Retain nonnegative inventories and species/energy ledgers. |
| 5 | Diagnose minimum temperature, cooling duration, rebound, residual fuel, and oxygen recovery together. | Clear endpoint definitions, observation duration after source depletion, matched untreated control. Low temperature at one instant alone is insufficient as a suppression endpoint. |
| 6 | Calibrate mechanical properties and add coupled pore-volume feedback only in a separate milestone. | Site/sample mechanical tests and coupled analytical benchmarks; force, mass, and energy checks. A fitted animation displacement is not a material property. |

### What remains assumed today

At the reviewed baseline the default rate is `2e-6 s⁻¹` at `550 K`, activation energy `35,000 J/mol`, oxygen half-saturation `0.06` on a gas mole basis, reaction heat `15 MJ/kg` of consumed surrogate fuel, and source contact conductance `1.5 W/(m²·K)`. Peat horizontal/vertical permeability multipliers are four/two. None is calibrated by this review. The base soil's conductivity and the organic-region replacement are different code paths. Current thermal fields, boundaries, and constitutive assumptions must remain visible in scientific exports even when presentation views simplify the controls.

## ASCE-style reference list

Biot, M. A. (1941). “General theory of three-dimensional consolidation.” *Journal of Applied Physics*, 12(2), 155–164. [https://doi.org/10.1063/1.1712886](https://doi.org/10.1063/1.1712886).

Giauque, W. F., and Egan, C. J. (1937). “Carbon dioxide. The heat capacity and vapor pressure of the solid. The heat of sublimation. Thermodynamic and spectroscopic values of the entropy.” *The Journal of Chemical Physics*, 5(1), 45–54. [https://doi.org/10.1063/1.1749929](https://doi.org/10.1063/1.1749929).

Huang, X., and Rein, G. (2017). “Downward spread of smouldering peat fire: The role of moisture, density and oxygen supply.” *International Journal of Wildland Fire*, 26(11), 907–918. [https://doi.org/10.1071/WF16198](https://doi.org/10.1071/WF16198).

Huang, X., and Rein, G. (2019). “Upward-and-downward spread of smoldering peat fire.” *Proceedings of the Combustion Institute*, 37(3), 4025–4033. [https://doi.org/10.1016/j.proci.2018.05.125](https://doi.org/10.1016/j.proci.2018.05.125).

Kronbichler, M., and Kormann, K. (2012). “A generic interface for parallel cell-based finite element operator application.” *Computers & Fluids*, 63, 135–147. [https://doi.org/10.1016/j.compfluid.2012.04.012](https://doi.org/10.1016/j.compfluid.2012.04.012).

O'Donnell, J. A., Romanovsky, V. E., Harden, J. W., and McGuire, A. D. (2009). “The effect of moisture content on the thermal conductivity of moss and organic soil horizons from black spruce ecosystems in interior Alaska.” *Soil Science*, 174(12), 646–651. [https://doi.org/10.1097/SS.0b013e3181c4a7f8](https://doi.org/10.1097/SS.0b013e3181c4a7f8).

Zhang, Y., Chen, Y., Qin, Y., Li, Y., Zhou, Y., Zhang, Z., Jiang, Y., Lin, S., and Huang, X. (2026). “Suppressing underground peat fire and smoldering spread via water, ice, dry ice, and liquid nitrogen.” *Fire Safety Journal*, 162, 104772. [https://doi.org/10.1016/j.firesaf.2026.104772](https://doi.org/10.1016/j.firesaf.2026.104772).

Supporting property database: National Institute of Standards and Technology. (n.d.). “Carbon dioxide: Phase change data.” *NIST Chemistry WebBook, SRD 69*. [NIST entry](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4) (Sept. 25, 2026). This evaluated database supports R4; it is not counted as an eighth peer-reviewed study.

## Review limits and reuse

Source access is specified above to distinguish full-text inspection, indexed publisher excerpts, and metadata-only access. No experimental data fit, independent scientific review, field trial, or new benchmark was performed for this document. No article figures, source code, or tables were copied into the application. The reference list supplements [SOURCES.md](SOURCES.md); it does not change the project's original-code licensing choice.
