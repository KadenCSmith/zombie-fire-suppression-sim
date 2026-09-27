# Zombie Fire Sim annotated physics bibliography

Research sources and evidence gaps for the next coupled implementation

Prepared 27 September 2026 for Kaden Smith. This bibliography maps 31 peer-reviewed papers to the current simulator or proposed extensions. It includes selected published observations with their conditions and source locations. It supplies starting evidence for implementation and testing; it does not establish experimental validation of the complete scene.

## How to use this bibliography

Each entry states the source, relevant finding, code use, limitations and depth of access. “Current” means a citation or method already appears in the project; it does not mean all parameters or claims have been verified. “Proposed” means no implementation or validation is claimed. Abstract-only entries cannot support extraction of unseen coefficients. Reviews and fitted model values are distinguished from original measurements.

Construct separate literature benchmark cases before combining physics. Preserve peat type, preparation, density, moisture basis, geometry, oxygen access, thermal conditions and measurement method. Combine studies only when their conditions support it. Retain paired observations and distinguish calibration from independent holdout tests.

## Requested research scenarios

The user confirmed three terrain cases: rooted peat, layered peat/mineral soil, and soil with a rocky subsurface. Hole depth, diameter and water inlet temperature must be adjustable. Proposed water input is 100 US gallons/min (6.309 L/s), using a provisional US-gallon interpretation. Flow duration, thermal state and delivery capability remain scenario inputs without measurements. A 0.5 m sphere diameter is a provisional interpretation of the requested source size.

Use controlled non-explosive heating and a vented or pressure-relieved research configuration. Report per-output uncertainty after each run as computed percentage ranges where meaningful, with an absolute-range fallback near zero. Unsupported model behavior and numerical failure must remain visible independently of those percentages.

## Evidence status

The search was targeted, not exhaustive. No original machine-readable raw experimental dataset was downloaded. Some full papers were inaccessible. The adjacent evidence-register.json preserves detailed source and access records; RESEARCH-SEARCH-LOG.md states coverage and the required next search. The final section lists technical references outside the peer-reviewed paper set and unresolved property audits.

## 1 Solid carbon dioxide thermodynamics

Giauque, W. F., and Egan, C. J. (1937). “Carbon dioxide. The heat capacity and vapor pressure of the solid. The heat of sublimation. Thermodynamic and spectroscopic values of the entropy.” Journal of Chemical Physics, 5, 45–54.

[DOI 10.1063/1.1749929](https://doi.org/10.1063/1.1749929)

**Role** Current thermodynamic source; numerical re-audit pending

**Finding** Experimental calorimetry and solid-vapor equilibrium underpin the existing dry-ice phase reference and sublimation enthalpy.

**Use in the simulator** Audit the existing phase-temperature and enthalpy conversions and obtain the original temperature-dependent measurements before replacing constant approximations.

**Limits** Equilibrium calorimetry does not determine transient soil contact, film transfer or buried-source behavior. Existing constant density, heat capacity and contact conductance are not thereby validated.

**Access** Original abstract/indexed citation and corroborating thermochemical record inspected; original full text and numeric tables not re-extracted in this handoff.

**Code locations** src/coupled/thermodynamics.ts; src/sim/materials.ts

## 2 Fluid carbon dioxide equation of state

Span, R., and Wagner, W. (1996). “A new equation of state for carbon dioxide covering the fluid region from the triple-point temperature to 1100 K at pressures up to 800 MPa.” Journal of Physical and Chemical Reference Data, 25(6), 1509–1596.

[DOI 10.1063/1.555991](https://doi.org/10.1063/1.555991)

[Source record](https://srd.nist.gov/jpcrdreprint/1.555991.pdf)

**Role** Proposed property reference

**Finding** A reference equation relates fluid CO2 thermodynamic properties over a broad documented domain.

**Use in the simulator** Benchmark fluid properties and determine when the present ideal-gas approximation becomes inadequate within the supported research case.

**Limits** It does not model the solid phase or automatically supply an air–CO2–water mixture closure. The paper’s pressure domain is not a supported apparatus operating range.

**Access** Published NIST PDF: abstract, stated domain and formulation inspected. A complete coefficient implementation audit remains pending.

**Code locations** src/coupled/thermodynamics.ts

## 3 Water equation of state

Wagner, W., and Pruß, A. (2002). “The IAPWS formulation 1995 for the thermodynamic properties of ordinary water substance for general and scientific use.” Journal of Physical and Chemical Reference Data, 31(2), 387–535.

[DOI 10.1063/1.1461829](https://doi.org/10.1063/1.1461829)

[Source record](https://www.thermo.ruhr-uni-bochum.de/thermo/forschung/wagner_IAPWS-95.html.en)

**Role** Proposed property reference

**Finding** Describes the reference formulation for ordinary fluid water and thermodynamic property calculations.

**Use in the simulator** Use as a candidate benchmark for liquid/vapor properties; map each selected correlation to its valid range and published source.

**Limits** The current app does not implement full IAPWS-95. Ice, capillary shifts, salinity and porous transport require separate treatment.

**Access** Author-institution summary and exact citation inspected; original full text not retrieved in this audit.

**Code locations** src/coupled/thermodynamics.ts

## 4 Ice and supercooled water vapor pressure

Murphy, D. M., and Koop, T. (2005). “Review of the vapour pressures of ice and supercooled water for atmospheric applications.” Quarterly Journal of the Royal Meteorological Society, 131(608), 1539–1565.

[DOI 10.1256/qj.04.94](https://doi.org/10.1256/qj.04.94)

**Role** Current correlation basis; review

**Finding** Reviews equilibrium vapor-pressure formulations for ice and supercooled water.

**Use in the simulator** Audit the ice-saturation relation and its temperature guards in the current thermal state model.

**Limits** Pure flat-interface equilibrium does not establish pore-curvature, salt effects, freezing kinetics, cryosuction or heave. A review is not a matched soil experiment.

**Access** Publisher abstract/citation and author-institution record inspected; original full text not retrieved.

**Code locations** src/coupled/thermodynamics.ts

## 5 Coupled consolidation framework

Biot, M. A. (1941). “General theory of three-dimensional consolidation.” Journal of Applied Physics, 12(2), 155–164.

[DOI 10.1063/1.1712886](https://doi.org/10.1063/1.1712886)

**Role** Current theoretical framework

**Finding** Establishes a coupled description of deformation and pore-pressure response for consolidation.

**Use in the simulator** Use the applicable linearized theory for formulation and analytical verification of pressure–volume–stress coupling.

**Limits** The theory does not calibrate the app’s assumed coupling coefficient, peat modulus or heterogeneous material parameters. Unsaturated multiphase fracture and large strains exceed this original setting.

**Access** Original indexed abstract and bibliographic record inspected; primary full text inaccessible in this handoff.

**Code locations** src/coupled/mechanics.ts; src/coupled/engine.ts

## 6 Unsaturated hydraulic closure

van Genuchten, M. Th. (1980). “A closed-form equation for predicting the hydraulic conductivity of unsaturated soils.” Soil Science Society of America Journal, 44(5), 892–898.

[DOI 10.2136/sssaj1980.03615995004400050002x](https://doi.org/10.2136/sssaj1980.03615995004400050002x)

**Role** Proposed hydraulic model

**Finding** Provides an analytical retention/conductivity relationship parameterized by fitted soil data.

**Use in the simulator** Evaluate a closure using a complete matched parameter set, with laboratory or field retention observations.

**Limits** There is no universal peat parameter set. Hysteresis, dual pore structure, fracture and ice may invalidate a unimodal approximation. Hydraulic conductivity and intrinsic permeability have different units and fluid dependence.

**Access** Publisher abstract and citation inspected; original full text not retrieved.

**Code locations** Future liquid-water module

## 7 Conservative unsaturated flow numerics

Celia, M. A., Bouloutas, E. T., and Zarba, R. L. (1990). “A general mass-conservative numerical solution for the unsaturated flow equation.” Water Resources Research, 26(7), 1483–1496.

[DOI 10.1029/WR026i007p01483](https://doi.org/10.1029/WR026i007p01483)

**Role** Proposed numerical verification

**Finding** Examines mass-conservative treatment of the unsaturated flow equation.

**Use in the simulator** Use conservation and infiltration benchmark structure when evaluating a suitable liquid-flow discretization.

**Limits** Numerical conservation of a Richards reduction does not establish its applicability while gas pressure or phase changes remain important. No material parameters are adopted here.

**Access** Abstract and bibliographic record inspected; original full text not retrieved.

**Code locations** Future liquid-water module

## 8 Multiphase porous flow assumptions

Pruess, K. (2004). “The TOUGH codes—A family of simulation tools for multiphase flow and transport processes in permeable media.” Vadose Zone Journal, 3(3), 738–746.

[DOI 10.2136/vzj2004.0738](https://doi.org/10.2136/vzj2004.0738)

**Role** Proposed architecture and method comparison

**Finding** Reviews component/energy balances, multiphase flow treatment and numerical methods for permeable media. Its Richards discussion states the passive-gas and neglected-phase-change reduction.

**Use in the simulator** Guide a physically justified formulation for water entering evolving gas-filled pores; compare candidate solvers using matched cases and measured costs.

**Limits** An external engine is not automatically faster or validated for this geometry. Do not append passive-gas Richards flow during significant gas-pressure gradients or phase changes without justification.

**Access** Publisher full text, governing-equation and numerical sections inspected.

**Code locations** Future liquid-water module; src/coupled/engine.ts

## 9 Phase field fracture framework

Miehe, C., Welschinger, F., and Hofacker, M. (2010). “Thermodynamically consistent phase-field models of fracture: Variational principles and multi-field FE implementations.” International Journal for Numerical Methods in Engineering, 83(10), 1273–1311.

[DOI 10.1002/nme.2861](https://doi.org/10.1002/nme.2861)

**Role** Current method basis; failed numerical gates remain

**Finding** Develops a thermodynamically organized phase-field fracture formulation and finite-element treatment.

**Use in the simulator** Audit energy decomposition, irreversibility and discretization against the adopted formulation; retain independent convergence checks.

**Limits** It supplies no calibrated peat fracture energy or regularization length. Diffuse damage is not resolved crack aperture or contact. Current mesh-energy and coupled-increment failures prevent an accepted terrain-rupture claim.

**Access** Publisher abstract and citation inspected; original full text not retrieved in this handoff.

**Code locations** src/coupled/mechanics.ts; src/coupled/engine.ts

## 10 Interpreting fibrous peat strength

O’Kelly, B. C. (2017). “Measurement, interpretation and recommended use of laboratory strength properties of fibrous peat.” Geotechnical Research, 4(3), 136–171.

[DOI 10.1680/jgere.17.00006](https://doi.org/10.1680/jgere.17.00006)

[Source record](https://www.emerald.com/jgere/article/4/3/136/437184/Measurement-interpretation-and-recommended-use-of)

**Role** Current contextual review; secondary measurement reporting

**Finding** Explains how fibrous peat structure, specimen preparation, drainage and testing affect strength interpretation.

**Use in the simulator** Retain provenance and test-condition checks in the existing tensile verification work. Trace summarized measurements to original tests wherever accessible.

**Limits** Strength peaks alone do not determine modulus, fracture energy or root reinforcement. Existing tensile data reported through this review are not a newly retrieved primary raw dataset.

**Access** Open publisher full text: scope, interpretation and relevant tensile discussion inspected.

**Code locations** docs/PEAT_TENSILE_FAILURE.md; src/mechanics/tensileFracture.ts

## 11 Root pullout experiments

Schwarz, M., Cohen, D., and Or, D. (2011). “Pullout tests of root analogs and natural root bundles in soil: Experiments and modeling.” Journal of Geophysical Research Earth Surface, 116, F02007.

[DOI 10.1029/2010JF001753](https://doi.org/10.1029/2010JF001753)

**Role** Proposed root benchmark

**Finding** Experiments and modeling distinguish load transfer and progressive pullout of root analogs and natural bundles.

**Use in the simulator** Evaluate a replacement or validation case for the current perfectly bonded truss assumptions using matched geometry and soil conditions.

**Limits** Species, root architecture, soil moisture and loading matter. These tests do not validate freezing/heating effects or the project’s decorative oak geometry.

**Access** Publisher full text: experiment scope, model and citation inspected; no numerical parameter set extracted for adoption.

**Code locations** src/coupled/mechanics.ts; src/ui/OakTree.tsx

## 12 Peat decomposition kinetics

Huang, X., and Rein, G. (2014). “Smouldering combustion of peat in wildfires: Inverse modelling of the drying and the thermal and oxidative decomposition kinetics.” Combustion and Flame, 161(6), 1633–1644.

[DOI 10.1016/j.combustflame.2013.12.013](https://doi.org/10.1016/j.combustflame.2013.12.013)

[Source record](https://research.polyu.edu.hk/en/publications/smouldering-combustion-of-peat-in-wildfires-inverse-modelling-of-/)

**Role** Current motivation; proposed kinetics work

**Finding** Uses inverse modeling to study peat drying and thermal/oxidative decomposition kinetics.

**Use in the simulator** Guide an evidence-based multistep reaction extension and document the difference from the present oxygen-limited surrogate.

**Limits** A fitted thermogravimetric model is not direct validation of field spread or suppression. The app does not reproduce the paper’s full reaction mechanism.

**Access** Author-institution abstract and citation inspected; original full text not retrieved.

**Code locations** src/coupled/thermodynamics.ts; src/sim/solver.ts

## 13 Smoldering across scales

Huang, X., and Rein, G. (2016). “Thermochemical conversion of biomass in smouldering combustion across scales: The roles of heterogeneous kinetics, oxygen and transport phenomena.” Bioresource Technology, 207, 409–421.

[DOI 10.1016/j.biortech.2016.01.027](https://doi.org/10.1016/j.biortech.2016.01.027)

**Role** Current model motivation; proposed benchmark

**Finding** Examines how heterogeneous reactions, oxygen and transport affect smoldering across scales.

**Use in the simulator** Require simultaneous reaction and transport checks before transferring a fitted small-scale model to a larger case.

**Limits** Agreement reported for the authors’ model does not validate a different one-step solver. No unseen fitted constants are adopted.

**Access** Publisher abstract and highlights inspected; original full text not retrieved.

**Code locations** src/coupled/thermodynamics.ts; src/sim/solver.ts

## 14 Flow through deformable rock fractures

Witherspoon, P. A., Wang, J. S. Y., Iwai, K., and Gale, J. E. (1980). “Validity of cubic law for fluid flow in a deformable rock fracture.” Water Resources Research, 16(6), 1016–1024.

[DOI 10.1029/WR016i006p01016](https://doi.org/10.1029/WR016i006p01016)

**Role** Proposed fracture-flow verification

**Finding** Tests the relation between aperture and flow in deformable rock fractures.

**Use in the simulator** Use as an entry point for a justified aperture-based flow verification case once a physical opening/contact model exists.

**Limits** Rock specimens and laminar fracture flow are not peat tears, rough multiphase openings or inertial flow. A damage field alone does not provide an aperture.

**Access** Publisher abstract and citation inspected; full text not retrieved.

**Code locations** Future fracture-flow module

## 15 Hydraulic measurements in degraded fen peat

Schwärzel, K., Šimůnek, J., Stoffregen, H., Wessolek, G., and van Genuchten, M. T. (2006). “Estimation of the unsaturated hydraulic conductivity of peat soils: Laboratory versus field data.” Vadose Zone Journal, 5(2), 628–640.

[DOI 10.2136/vzj2005.0061](https://doi.org/10.2136/vzj2005.0061)

**Role** Proposed matched hydraulic benchmark

**Finding** Compares undisturbed laboratory cores and field lysimeters from long-drained, strongly altered fen peat at Rhinluch, Germany, with distinct horizons and replicates.

**Use in the simulator** Retain whole fitted parameter rows and their specimen conditions for retention/conductivity benchmarks and independent field comparison.

**Inspected observations** Table 1, laboratory horizon <15 cm, replicate 1: bulk density 0.312 g/cm³; fitted saturated water content 0.880; α = 0.026 cm⁻¹; n = 1.19; fitted saturated conductivity 33.5 cm/day. Keep this paired set and its fitted/measured distinction.

**Limits** Fitted saturated water content is not automatically gas-connected porosity. Near-saturation identifiability is weak; a compacted horizon challenges a unimodal closure. These dense fen samples cannot stand in for loose moss peat.

**Access** Publisher full text: methods, Table 1 and interpretation inspected.

**Code locations** Future liquid-water module

## 16 Freeze thaw changes in peat hydraulics

Liu, H., Rezanezhad, F., Zak, D., Li, X., and Lennartz, B. (2022). “Freeze-thaw cycles alter soil hydro-physical properties and dissolved organic carbon release from peat.” Frontiers in Environmental Science, 10, 930052.

[DOI 10.3389/fenvs.2022.930052](https://doi.org/10.3389/fenvs.2022.930052)

**Role** Proposed hydrophysics evidence

**Finding** Undisturbed cores from two drained German fens were cycled at −5/+5 °C from field-capacity moisture. The study measures changes in pore structure and conductivity.

**Use in the simulator** Use as evidence that hydraulic properties can evolve, and as a separate mild freeze–thaw benchmark with matched conditions.

**Inspected observations** Section 3.1, sites 1 and 2: mean bulk density 0.48 and 0.41 g/cm³; macroporosity 0.12 ± 0.01 and 0.10 ± 0.01 cm³/cm³ (mean ± standard error). Initial saturated conductivity ranges are 1.9 × 10⁻⁶ to 1.0 × 10⁻⁴ m/s and 3.0 × 10⁻⁷ to 4.5 × 10⁻⁴ m/s, respectively.

**Limits** Macroporosity is not total porosity; the stated macropores exceed 30 μm equivalent diameter. Conductivity changes differ between samples. Mild cycles do not validate direct cryogenic contact, rapid gradients or fracture.

**Access** Publisher full text: methods, Sections 3.1–3.2 and Table 1 inspected.

**Code locations** Future freeze–thaw/liquid module

## 17 Downward smolder spread in moss peat

Huang, X., and Rein, G. (2017). “Downward spread of smouldering peat fire: The role of moisture, density and oxygen supply.” International Journal of Wildland Fire, 26(11), 907–918.

[DOI 10.1071/WF16198](https://doi.org/10.1071/WF16198)

[Source record](https://connectsci.au/wf/article/26/11/907/194558/Downward-spread-of-smouldering-peat-fire-the-role)

**Role** Current model-input source; proposed experimental benchmark

**Finding** Commercial Irish moss peat was burned downward in a 30 cm column with separately varied moisture and density. Density and oxygen access alter the moisture–spread relationship.

**Use in the simulator** Audit existing adopted heat-storage inputs and construct a distinct downward-front benchmark from the experiment.

**Inspected observations** Experimental setup and Figure 4b discussion: oven-dried bulk density 135 ± 5 kg/m³; measured downward spread 0.5–2 cm/hour, decreasing with depth. Moisture treatments use dry-mass basis.

**Limits** Published model inputs are not all measurements of the specimen. Front velocity is not fuel mass-consumption rate. Geometry and commercial peat differ from rooted ground; do not infer a universal monotonic moisture multiplier.

**Access** Complete publisher HTML: experimental methods, results and Figure 4 discussion inspected. Existing app also cites Tables 1–2 for model inputs.

**Code locations** src/sim/materials.ts; src/sim/researchProfiles.ts; src/coupled/thermodynamics.ts

## 18 Horizontal smolder spread measurements

Prat-Guitart, N., Rein, G., Hadden, R. M., Belcher, C. M., and Yearsley, J. M. (2016). “Propagation probability and spread rates of self-sustained smouldering fires under controlled moisture content and bulk density conditions.” International Journal of Wildland Fire, 25(4), 456–465.

[DOI 10.1071/WF15103](https://doi.org/10.1071/WF15103)

[Source record](https://researchrepository.ucd.ie/bitstreams/5134319b-bab1-4c4c-9d11-54b893f03078/download)

**Role** Proposed horizontal-front benchmark

**Finding** Controlled laboratory milled peat experiments used shallow horizontal fronts, moisture/compression treatments and infrared front tracking.

**Use in the simulator** Use paired observations from Table 2 for horizontal propagation and extinction comparisons, preserving density and moisture together.

**Inspected observations** Table 2, printed page 461, BD1, four burns per treatment: at 25% dry-basis moisture, density 116 ± 9 kg/m³ and spread 4.33 ± 0.91 cm/hour; at 100%, density 80 ± 7 kg/m³ and spread 2.63 ± 1.08 cm/hour. Density is mean ± SD; spread is median ± median absolute deviation.

**Limits** Rates cannot be pooled with downward fronts into one peat burn-rate constant. Moisture is dry-mass based; reported density variation and different oxygen access affect transferability.

**Access** Complete institutional PDF: methods and Table 2 on printed page 461 inspected.

**Code locations** Future matched smolder benchmark

## 19 Soil organic matter mixture theory

Decharme, B. (2025). “A process-based modeling of soil organic matter physical properties for land surface models – Part 1: Soil mixture theory.” Geoscientific Model Development, 18, 9349–9384.

[DOI 10.5194/gmd-18-9349-2025](https://doi.org/10.5194/gmd-18-9349-2025)

[Source record](https://gmd.copernicus.org/articles/18/9349/2025/)

[Source record](https://doi.org/10.5281/zenodo.15837794)

**Role** Current source/context; proposed extensions identified

**Finding** Develops consistent organic–mineral mass/volume relationships and thermal/hydraulic property mixing. Table 4 distinguishes measured density/carbon, graph-digitized air-dry diffusivity from AT23, and derived organic fractions, conductivity and volumetric heat capacity.

**Use in the simulator** Existing researchProfiles mixture menu uses dry properties reported through this reanalysis; it is not calibration of current coupled wet, frozen or burning soil. Audit property provenance and evaluate compatible mixture laws; public research scripts are a candidate reference.

**Limits** Land-surface mixture relationships do not validate fracture, rooted ground, high-pressure CO2 or cryogenic contact. Derived and digitized quantities must retain their uncertainty and lineage.

**Access** Publisher full HTML inspected for abstract, mixture-data section/Table 4 caption and code/data availability. Individual numeric table entries were not re-extracted in this audit.

**Code locations** src/sim/materialEvidence.ts; src/sim/researchProfiles.ts

## 20 Thermal diffusivity of peat sand mixtures

Arkhangelskaya, T. A., and Telyatnikova, E. V. (2023). “Thermal Diffusivity of Peat-Sand Mixtures with Different Peat and Sand Contents.” Eurasian Soil Science, 56, 428–433.

[DOI 10.1134/S1064229322602463](https://doi.org/10.1134/S1064229322602463)

[Source record](https://link.springer.com/article/10.1134/S1064229322602463)

**Role** Current source/context; proposed extensions identified

**Finding** Laboratory peat–sand mixtures show that moisture, composition and bulk density affect thermal diffusivity nonlinearly; peat and sand exhibit different moisture-response shapes.

**Use in the simulator** Original experimental lineage for the D25-based dry mixture profiles. Current implementation obtained values through D25, not independent extraction of this full article. Potential room-temperature mixture benchmark after obtaining full curves, specimen preparation and uncertainties.

**Limits** Does not establish wet, freezing, burning or source-contact thermal coefficients. Do not confuse diffusivity with conductivity or derive conductivity without independently supported volumetric heat capacity.

**Access** Primary publisher metadata and complete abstract inspected. Full article is subscription content; tables/curves not independently inspected. Russian-language counterpart has different DOI/page numbering and should not silently replace the cited English edition.

**Code locations** src/sim/materialEvidence.ts; src/sim/researchProfiles.ts

## 21 Field experiments in organic soils

Pastor, E., Oliveras, I., Urquiaga-Flores, E., Quintano-Loayza, J. A., Manta, M. I., and Planas, E. (2017). “A new method for performing smouldering combustion field experiments in peatlands and rich-organic soils.” International Journal of Wildland Fire, 26(12), 1040–1052.

[DOI 10.1071/WF17033](https://doi.org/10.1071/WF17033)

[Source record](https://www.publish.csiro.au/WF/WF17033)

[Source record](https://upcommons.upc.edu/server/api/core/bitstreams/7198d4c3-328c-41e7-b2ef-a78f9a450a37/content)

**Role** Current source/context; proposed extensions identified

**Finding** Presents field experiments in undisturbed Andean organic soils and combines temperature measurements across depths with surface thermal observations. Preserving natural heterogeneity and replicate observations matters for interpreting smouldering.

**Use in the simulator** Existing Andean material profile uses explicitly labeled midpoints of reported ranges, not a measured paired specimen. Guide spatial/depth validation outputs and audit the material-profile data lineage.

**Limits** Field combustion methodology does not validate dry-ice treatment, mechanical fracture or water infiltration. Unpaired ranges cannot create a matched constitutive dataset.

**Access** Publisher metadata/abstract verified; institutional full manuscript opened and relevant scope/method sections inspected. Material tables and their numerical entries were not reverified in this audit.

**Code locations** src/sim/materialEvidence.ts; src/sim/researchProfiles.ts

## 22 Moisture and organic soil thermal conductivity

O’Donnell, J. A., Romanovsky, V. E., Harden, J. W., and McGuire, A. D. (2009). “The effect of moisture content on the thermal conductivity of moss and organic soil horizons from black spruce ecosystems in interior Alaska.” Soil Science, 174(12), 646–651.

[DOI 10.1097/SS.0b013e3181c4a7f8](https://doi.org/10.1097/SS.0b013e3181c4a7f8)

[Source record](https://pubs.usgs.gov/publication/70035377)

**Role** Current source/context; proposed extensions identified

**Finding** Measurements of moss and organic horizons show a strong positive relationship between thawed thermal conductivity and volumetric moisture, with differences among horizon types.

**Use in the simulator** Evidence warning that an assumed saturation-dependent conductivity law is not universal; regression coefficients are not currently applied from this source. A possible specimen-specific thawed conductivity calibration after full coefficients and tested conditions are obtained.

**Limits** Does not supply verified coefficients here, or establish frozen/high-temperature conductivity, mechanical strength or gas transport.

**Access** USGS author-agency publication record and abstract inspected through web search. Direct page retry and attempted publisher page returned tool errors. Full tables/regressions not obtained.

**Code locations** src/sim/materialEvidence.ts

## 23 Engineering properties of fibrous peat

Mesri, G., and Ajlouni, M. (2007). “Engineering properties of fibrous peats.” Journal of Geotechnical and Geoenvironmental Engineering, 133(7), 850–866.

[DOI 10.1061/(ASCE)1090-0241(2007)133:7(850)](https://doi.org/10.1061/(ASCE)1090-0241(2007)133:7(850))

[Source record](https://experts.illinois.edu/en/publications/engineering-properties-of-fibrous-peats/)

**Role** Current source/context; proposed extensions identified

**Finding** Interprets fibrous peat permeability, compressibility and shear strength using undisturbed-sample experiments and published laboratory/field evidence. Compression and effective-stress history materially affect behavior.

**Use in the simulator** Context for explicit uncertainty in assumed peat mechanics; no default coupled coefficient is confirmed by this review. Select appropriate constitutive/calibration targets and evaluate permeability change with compression, subject to material matching.

**Limits** Review ranges do not calibrate the modeled peat. Friction angles are not directly interchangeable with Drucker–Prager slopes. No source-scale cryogenic, root or fracture-energy calibration follows.

**Access** Author-institution metadata and abstract inspected; institution labels the article peer-reviewed. Publisher full-text request returned a tool error. No full tables inspected.

**Code locations** src/sim/materialEvidence.ts

## 24 Laboratory water injection in peat

Mulyasih, H., Akbar, L. A., Ramadhan, M. L., Cesnanda, A. F., Putra, R. A., Irwansyah, R., and Nugroho, Y. S. (2022). “Experimental study on peat fire suppression through water injection in laboratory scale.” Alexandria Engineering Journal, 61(12), 12525–12537.

[DOI 10.1016/j.aej.2022.06.036](https://doi.org/10.1016/j.aej.2022.06.036)

[Source record](https://www.sciencedirect.com/science/article/pii/S111001682200415X)

[Source record](https://scholar.ui.ac.id/en/publications/experimental-study-on-peat-fire-suppression-through-water-injecti/)

**Role** Current source/context; proposed extensions identified

**Finding** Laboratory tests on Indonesian natural peat compare subsurface water injection with surface spraying; delivery method changes suppression duration and water consumption in the tested samples.

**Use in the simulator** Cited context for future liquid-water delivery; the current coupled release has no liquid injection/infiltration network and copies no treatment parameters. Candidate independent water-stage benchmark after matching geometry, material, initial state, delivery and observation criteria.

**Limits** Does not validate poured-water flow through gas-created fractures or a combined dry-ice/device sequence. Do not transfer laboratory water requirements as universal treatment values.

**Access** Publisher search extract confirms open-access article and abstract; direct publisher/DOI opens returned tool errors. Author-institution full metadata and abstract inspected. Full methods/tables not obtained.

**Code locations** src/sim/materialEvidence.ts

## 25 Peat type and combustion moisture thresholds

Densmore, V. S., and Barnesby, T. K. (2025). “For peat’s sake! Peat type influences critical moisture thresholds that prevent combustion of organic soils in Western Australia.” International Journal of Wildland Fire, 34(9), WF24204.

[DOI 10.1071/WF24204](https://doi.org/10.1071/WF24204)

[Source record](https://connectsci.au/wf/article/34/9/WF24204/200661/For-peat-s-sake-Peat-type-influences-critical)

**Role** Current source/context; proposed extensions identified

**Finding** Experiments on Western Australian peat turves show that moisture thresholds for ignition and sustained combustion differ by peat type and associated physical/chemical properties.

**Use in the simulator** Evidence against one universal peat moisture cutoff; no fitted threshold from this paper is installed in current coupled physics. Guide material-specific ignition/suppression uncertainty and later matched comparisons.

**Limits** Prevention of ignition is distinct from extinguishing an established smouldering fire. Regional peat classes and moisture relationships are not universal; fitted thresholds require matching basis and measurement method.

**Access** Publisher full HTML inspected for identity, abstract, conclusions and data availability. Numeric tables/models not re-extracted. Supporting data are available by reasonable request to the corresponding author; no request was sent.

**Code locations** src/sim/materialEvidence.ts

## 26 Oxygen supply and smolder propagation

Qin, Y., Chen, Y., Lin, S., & Huang, X. (2022). Limiting oxygen concentration and supply rate of smoldering propagation. Combustion and Flame, 245, 112380.

[DOI 10.1016/j.combustflame.2022.112380](https://doi.org/10.1016/j.combustflame.2022.112380)

[Source record](https://ira.lib.polyu.edu.hk/bitstream/10397/108053/1/Qin_Limiting_Oxygen_Concentration.pdf)

**Role** Current context; proposed matched benchmark

**Finding** Forced-flow peat experiments show that oxygen concentration alone does not determine propagation or extinction; oxygen supply and cooling jointly matter. The accepted manuscript reports a minimum oxygen mass flux of 0.08 ± 0.01 g m−2 s−1 above an oxygen mass fraction of 10% (Section 3.2, manuscript page 11, Fig. 4b discussion).

**Use in the simulator** Already cited as physical context; proposed oxygen-transport and extinction benchmark. This is not evidence that the current one-step reaction law or oxygen half-saturation parameter is calibrated.

**Limits** Tested prepared moss peat and prescribed internal oxidizer flow. Preserve volume fraction versus mass fraction and superficial velocity versus pore velocity. Do not install a universal 2% oxygen extinction switch.

**Access** Full accepted manuscript accessible and methods/Section 3.2 inspected; publisher metadata verified.

**Code locations** src/sim/materialEvidence.ts:30

## 27 Wall cooling and smolder extinction

Lin, S., & Huang, X. (2021). Quenching of smoldering: Effect of wall cooling on extinction. Proceedings of the Combustion Institute, 38(3), 5015–5022.

[DOI 10.1016/j.proci.2020.05.017](https://doi.org/10.1016/j.proci.2020.05.017)

[Source record](https://ira.lib.polyu.edu.hk/bitstream/10397/89605/1/Lin_Quenching_Smoldering_Wall.pdf)

**Role** Current context; proposed matched benchmark

**Finding** Dry organic-soil reactor experiments vary diameter, wall materials and end openings. Cooling and oxygen supply alter quenching and propagation mode. The accepted manuscript's quenching discussion reports a minimum smoldering temperature near 250 °C for this fuel and setup (manuscript page 8).

**Use in the simulator** Already cited as context; proposed heat-loss/extinction benchmark after matching geometry and boundary conditions.

**Limits** A measured front temperature near quenching is not a universal cellwise reaction cutoff. Reactor diameter and wall losses differ from heterogeneous field soil. Repository Source field contains a page-range inconsistency (5012–5022); publisher and repository rights citation give 5015–5022, used here.

**Access** Full accepted manuscript accessible; quenching discussion inspected. Publisher citation verified.

**Code locations** src/sim/materialEvidence.ts:33

## 28 Moisture and modeled burn depth

Huang, X., & Rein, G. (2015). Computational study of critical moisture and depth of burn in peat fires. International Journal of Wildland Fire, 24(6), 798–808.

[DOI 10.1071/WF14178](https://doi.org/10.1071/WF14178)

[Source record](https://connectsci.au/wf/article/24/6/798/21084/Computational-study-of-critical-moisture-and-depth)

**Role** Current context; proposed matched benchmark

**Finding** A one-dimensional reactive porous-media model with multistep chemistry investigates layered peat. Ignition and extinction moisture thresholds differ because the burning layer can supply heat to an adjacent wet layer. Fig. 6 discussion gives modeled critical extinction moisture of 256% for a particular thin wet layer, versus 117% ignition moisture for the stated ignition protocol and peat properties.

**Use in the simulator** Already cited as model motivation. Proposed layered-moisture benchmark; the current reduced chemistry is not equivalent to the paper's Gpyro model.

**Limits** Those are conditional model outputs, not universal measured thresholds. Moisture is dry-mass based, not saturation. Thickness, inert content, density and heating history must be preserved; independent observations should be held out from calibration.

**Access** Full publisher HTML accessible; model description and Fig. 6 discussion inspected.

**Code locations** src/sim/materialEvidence.ts:36

## 29 Water delivery and laboratory suppression

Santoso, M. A., Cui, W., Amin, H. M. F., Christensen, E. G., Nugroho, Y. S., & Rein, G. (2021). Laboratory study on the suppression of smouldering peat wildfires: effects of flow rate and wetting agent. International Journal of Wildland Fire, 30(5), 378–390.

[DOI 10.1071/WF20117](https://doi.org/10.1071/WF20117)

[Source record](https://research.tees.ac.uk/files/35798984/Laboratory_study_on_the_suppression_of_smouldering_peat_wildfires.pdf)

**Role** Current context; proposed matched benchmark

**Finding** Open-top, bottom-draining peat experiments compare water and wetting-agent solutions. Suppression depends on infiltration, runoff and sustained cooling. Methods on page 381 define extinguishment when every monitored thermocouple falls below 50 °C. Page 387/Fig. 12 reports an estimated effective fluid-to-peat ratio of 5.7 ± 2.1 L kg−1 under the study's accounting.

**Use in the simulator** Already cited as context; proposed benchmark for moving liquid, runoff, thermal response and spatial extinction diagnostics.

**Limits** Prepared commercial Irish moss peat differs from rooted, rocky soil. The reported fluid ratio incorporates estimated initial moisture and excludes runoff; it is not a universal field application prescription. The current immobile-liquid solver cannot reproduce this experiment. The 50 °C criterion is an observational definition, not reaction kinetics.

**Access** Full published article accessible in institutional repository; methods, fluid accounting, Fig. 12 discussion and conclusions inspected.

**Code locations** src/sim/materialEvidence.ts:39

## 30 Field spread and suppression observations

Santoso, M. A., Christensen, E. G., Amin, H. M. F., Palamba, P., Hu, Y., Purnomo, D. M. J., Cui, W., Pamitran, A., Richter, F., Smith, T. E. L., Nugroho, Y. S., & Rein, G. (2022). GAMBUT field experiment of peatland wildfires in Sumatra: from ignition to spread and suppression. International Journal of Wildland Fire, 31(10), 949–966.

[DOI 10.1071/WF21135](https://doi.org/10.1071/WF21135)

[Source record](https://connectsci.au/wf/article/31/10/949/88903/GAMBUT-field-experiment-of-peatland-wildfires-in)

**Role** Current context; proposed matched benchmark

**Finding** Field measurements in degraded tropical peat connect spread, temperature, rainfall and water suppression. The suppression methods report surveyed temperatures below 50 °C, yet the subsequent results describe a next-day excavation survey finding a few concealed hot spots beneath wet ash/char and additional water application.

**Use in the simulator** Already cited as context; proposed field-scale challenge case and motivation for spatial coverage, post-treatment observation and explicit reignition assessment.

**Limits** One tropical site with heterogeneous conditions does not calibrate boreal peat or a buried cooling source. Distinguish rainfall from deliberately delivered water and local readings from all-domain extinction. Primary publisher gives author Agus Pamitran (A.), whereas the current code says A. S.; use publisher spelling.

**Access** Full publisher HTML accessible; site/methods and suppression-results sections inspected. Direct LSE PDF retrieval failed, so HTML is the inspected source.

**Code locations** src/sim/materialEvidence.ts:42

## 31 Comparing nonexplosive cooling treatments

Zhang, Y., Chen, Y., Qin, Y., Li, Y., Zhou, Y., Zhang, Z., Jiang, Y., Lin, S., & Huang, X. (2026). Suppressing underground peat fire and smoldering spread via water, ice, dry ice, and liquid nitrogen. Fire Safety Journal, 162, 104772.

[DOI 10.1016/j.firesaf.2026.104772](https://doi.org/10.1016/j.firesaf.2026.104772)

[Source record](https://www.sciencedirect.com/science/article/pii/S0379711226001402)

[Source record](https://ira.lib.polyu.edu.hk/handle/10397/118323)

**Role** Current context; proposed matched benchmark

**Finding** Laboratory horizontal-firebreak experiments compare four cooling agents. Sustained residence and cooling favor solid agents in this setup; transient cooling can be followed by temperature rebound. Section 4.1 explicitly defines the comparison using a 50% extinguishment-probability reference, not a physical guaranteed-success limit.

**Use in the simulator** Already cited as a potential suppression benchmark. Useful for a future matched, open, non-explosive cooling scenario and cooling-persistence validation.

**Limits** Open-top prepared-peat firebreak geometry differs from a buried sphere or pressure-confined soil. No evidence for explosive heating, anchoring, pressure-driven fracture or field effectiveness. Abstract-reported loading and duration require detailed figure/table extraction and should not become calibrated defaults.

**Access** Publisher and institutional record verified. Search-indexed full-text sections 2.1, 2.3–2.4, 3, 4.1 and 4.3 inspected; direct publisher/PDF open attempts failed. This is deeper than abstract-only access but not a fully retrieved PDF or digitized dataset.

**Code locations** src/sim/materialEvidence.ts:45

## Technical references requiring a separate evidence audit

The current coupled documentation also cites the following technical sources. They are useful for formulation or numerical verification, but they are not peer-reviewed empirical measurements. The next implementation must trace physical data and claims to applicable peer-reviewed papers and verify any adopted correlations.

IAPWS (1992). Revised supplementary release on saturation properties of ordinary water substance.

[Reference link](https://iapws.org/relguide/Supp-sat.html)

Current liquid saturation correlation technical specification. Association release, not a peer-reviewed experiment. Trace the adopted correlation to peer-reviewed literature and verify its implementation. The fluid-water WP02 reference is a candidate, not proof of coefficient equivalence.

Timoshenko, S., and Woinowsky-Krieger, S. (1959). Theory of plates and shells, 2nd ed., McGraw-Hill.

[Reference link](https://books.google.com/books/about/Theory_of_Plates_and_Shells.html?id=gfo_AQAAIAAJ)

Classical shell theory background for the current reduced cap. Textbook, not a measured cover specimen or peer-reviewed calibration. Current Ritz/support approximation is derived in code and needs separate verification and evidence.

Wierzbicki, T. (2013). Bending response of plates and optimum design. MIT 2.080J, Lecture 7.

[Reference link](https://ocw.mit.edu/courses/2-080j-structural-mechanics-fall-2013/f8fd2ad49d100766335b4e129a8a4791_MIT2_080JF13_Lecture7.pdf)

Analytical circular-plate verification reference. Course material, not peer-reviewed empirical cover data. The new evidence requirement must preserve this distinction.

## Unresolved properties and validation

- No measured site stratigraphy, roots, water table or paired peat material dataset for the requested scene.

- Existing peat elasticity, Biot coefficient, mineral contrast, fracture energy/length and root contact/failure parameters are not calibrated to a matched specimen.

- Current dry-ice constant density/heat capacity and source contact conductance need a primary-source numerical audit and applicability bounds.

- Cover thermal capacity/conductivity/contact losses and supported nonconfining structural response need evidence and numerical verification.

- No implemented and validated liquid infiltration, pore/free-surface exchange, aperture-flow closure, cryosuction or ice-heave model in the audited release.

- Existing reaction coefficients, product yields and heat release need a full lineage audit; a one-step surrogate is not the cited multistep chemistry.

- Water inlet temperature, duration, start state and actual pump response are unknown; 100 US gpm is an unverified user scenario.

- No full calibration-versus-holdout dataset split, uncertainty propagation or experimental validation of the complete coupled scene.

The current spatial fracture mesh-energy check fails its stated gate, and a default coupled fracture attempt fails an energy increment check. These are numerical failures in addition to material evidence gaps. Keep the capability gated until the stated checks pass; attractive animation or an AI score cannot replace them.
