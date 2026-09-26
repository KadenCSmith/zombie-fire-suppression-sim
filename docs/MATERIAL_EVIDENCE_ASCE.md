# Material evidence and physical constraints — ASCE source review

Reviewed 2026-09-26 for version 0.4.0. Companion: [research composition menus](RESEARCH_PROFILES.md), [model equations](PHYSICS_MODEL.md), and [verification status](VALIDATION_STATUS.md).

## What the evidence supports

The Developer tab exposes **94 numeric properties** for the default scenario, including 34 formerly fixed thermal, transport and mechanics coefficients. Region/layer controls expand with the scenario. Each entry records its units, allowed input range, evidence statement and relevant source IDs. The audit export contains the full applied scenario, selected research profile and its original values, subsequent edits, 58 other registry entries, and the 16 references below. Other entries include geometry, display, nonnumeric choices and derived outputs; the count is not the number of independent physical constants.

A citation does not confirm the app’s default specimen, device or reaction model. Only matching quantities and bases were transferred. Particle density is distinct from dry bulk density; mineral texture fractions sum to one within the mineral mass; organic matter is a fraction of total dry mass; water/dry-mass moisture is distinct from pore saturation. Study-derived profile values are labeled individually. Input ranges are software guards, not experimental confidence intervals or field safety limits.

## Changes justified by this review

- New scenarios use peat particle density 1500 kg/m³, peat dry heat capacity 1840 J/(kg·K), water heat capacity 4186 J/(kg·K), and water evaporation enthalpy 2.26 MJ/kg as adopted model inputs from HR17. Base mineral-soil heat capacity remains separately editable. The paper’s solid conductivity is not assigned to bulk peat.
- GE37 supplies 194.67 K and 6030 cal/mol for near-atmospheric CO₂ sublimation. Using 4.184 J/cal and molar mass 0.0440095 kg/mol gives 573274.4067 J/kg. Constant solid/gas heat coefficients and contact conductance remain assumptions.
- Peat solid mixing uses additive specific volumes for organic/mineral dry-mass fractions: `rho_particle = 1 / (f_org/rho_org + (1-f_org)/rho_min)`; `porosity = 1 - rho_dry/rho_particle`. Inadmissible porosity is rejected. Water/dry-mass ratio is `S × porosity × rho_water / rho_dry`.
- The composition menus transfer matching dry density, composition and thermal reference data; all unsupported kinetics, transport and strength properties remain explicit assumptions. See the menu guide for targets and shared peat constants.
- Vertical mechanics uses the chosen water density and local pore volume for wet mass, and reduces its integration step for the minimum element mass, spring/shear stiffness and damping. This is numerical stabilization, not material validation. The existing coarse mechanics geometry approximation still differs from the rotated/irregular finite-volume peat geometry.

## Legacy files and reproducibility

Schema-1 scenarios without `materialProperties` retain the former peat particle density (1400), peat heat capacity inherited from base soil, water heat capacity (4180), CO₂ sublimation point (194.65 K), latent heat (571000 J/kg), and clamped arithmetic peat-density mixing. Checkpoint continuation is tested for legacy and customized cases. Adding a material extension explicitly switches to the new mass-fraction mixing law. The UI flags legacy imports before editing. Shared gas/mechanics defaults resolve centrally; independent optional properties merge with the new defaults.

Manual edits restart the calculation only after all changes pass validation. Profile evidence remains associated with the original applied values, and changed values are labeled as user assumptions. Save the scenario or export the applied evidence before closing; the app does not silently persist a run to disk. Unapplied Developer drafts are discarded when leaving the tab.

## ASCE references and reasons for use

### D25

Decharme, B. (2025). “A process-based modeling of soil organic matter physical properties for land surface models – Part 1: Soil mixture theory.” Geoscientific Model Development, 18, 9349–9384. https://doi.org/10.5194/gmd-18-9349-2025.

**Finding used.** Table 4 supplies ten lowland peat–sand compositions, with observed dry density and estimated organic matter, dry conductivity and volumetric heat capacity. The profile menu preserves that observed/estimated distinction.

**Why this source was necessary.** Provides an auditable mixture dataset and distinguishes organic carbon from organic matter. Its dry-property estimates are not wet or burning-peat calibration.

### AT23

Arkhangelskaya, T. A., and Telyatnikova, E. V. (2023). “Thermal diffusivity of peat-sand mixtures with different peat and sand contents.” Eurasian Soil Science, 56(4), 428–433. https://doi.org/10.1134/S1064229322602463.

**Finding used.** Original laboratory peat–sand mixture dataset used in Decharme Table 4. Values here were retrieved through that published reanalysis, not independently re-extracted from the original article.

**Why this source was necessary.** Identifies the original measurements behind the mixture menus and makes the data lineage explicit. Bibliographic metadata was checked against the publisher’s Crossref record.

### P17

Pastor, E., Oliveras, I., Urquiaga-Flores, E., Quintano-Loayza, J. A., Manta, M. I., and Planas, E. (2017). “A new method for performing smouldering combustion field experiments in peatlands and rich-organic soils.” International Journal of Wildland Fire, 26, 1040–1052. https://doi.org/10.1071/WF17033.

**Finding used.** Peruvian field soils: dry density 188–355 kg/m³, inorganic content 6.0–10.6%, mean dry-basis moisture 114.5%, and mineral texture 66% sand, 22% silt, 12% clay.

**Why this source was necessary.** Adds an organic field-soil composition. The menu uses explicitly labeled range midpoints, not a fictitious paired sample. The wet-density entry is excluded from dry-mass calculations.

### HR17

Huang, X., and Rein, G. (2017). “Downward spread of smouldering peat fire: the role of moisture, density and oxygen supply.” International Journal of Wildland Fire, 26(11), 907–918. https://doi.org/10.1071/WF16198.

**Finding used.** Tables 1–2: peat solid density 1500 kg/m³ and specific heat 1840 J/(kg·K); water density 1000 kg/m³, specific heat 4186 J/(kg·K), and drying enthalpy 2.26 MJ/kg. These are adopted model inputs. The tested oven-dry moss peat bulk density was 135 ± 5 kg/m³.

**Why this source was necessary.** Separates particle density from bulk density and gives explicit heat-storage coefficients. The five-step chemistry and solid conductivity cannot be substituted directly into this one-step, bulk-cell model.

### GE37

Giauque, W. F., and Egan, C. J. (1937). “Carbon dioxide. The heat capacity and vapor pressure of the solid. The heat of sublimation. Thermodynamic and spectroscopic values of the entropy.” The Journal of Chemical Physics, 5(1), 45–54. https://doi.org/10.1063/1.1749929.

**Finding used.** Measured sublimation point 194.67 K and latent heat 6030 cal/mol. Conversion: 6030 × 4.184 / 0.0440095 = 573274.4067 J/kg.

**Why this source was necessary.** Anchors the finite dry-ice energy budget near atmospheric pressure. Does not validate a constant heat capacity, buried pressure behavior or soil-contact conductance.

### OD09

O’Donnell, J. A., Romanovsky, V. E., Harden, J. W., and McGuire, A. D. (2009). “The effect of moisture content on the thermal conductivity of moss and organic soil horizons from black spruce ecosystems in interior Alaska.” Soil Science, 174(12), 646–651. https://doi.org/10.1097/SS.0b013e3181c4a7f8.

**Finding used.** Thawed organic-horizon conductivity depends strongly on volumetric water content, with horizon-dependent relationships.

**Why this source was necessary.** Shows why this app’s assumed saturation-based conductivity is not a verified universal law. Full regression coefficients were not reliably retrieved; none are invented or applied.

### MA07

Mesri, G., and Ajlouni, M. (2007). “Engineering properties of fibrous peats.” Journal of Geotechnical and Geoenvironmental Engineering, 133(7), 850–866. https://doi.org/10.1061/(ASCE)1090-0241(2007)133:7(850).

**Finding used.** Fibrous peat stiffness and strength depend on specimen, stress path and test interpretation. The review reports triaxial friction angles of 40–60° and undrained modulus/strength ratios of 20–80.

**Why this source was necessary.** Prevents assigning mineral-soil constants to peat without calibration. Friction angles are not Drucker–Prager slopes. No numerical mechanics default is confirmed by this review.

### B41

Biot, M. A. (1941). “General theory of three-dimensional consolidation.” Journal of Applied Physics, 12(2), 155–164. https://doi.org/10.1063/1.1712886.

**Finding used.** Provides the theoretical basis for coupled stress and pore-pressure response.

**Why this source was necessary.** Supports the form of an effective-stress coupling, not the assumed coefficient 0.8 or validation of the present dry-gas spring model.

### Q22

Qin, Y., Chen, Y., Lin, S., and Huang, X. (2022). “Limiting oxygen concentration and supply rate of smoldering propagation.” Combustion and Flame, 245, 112380. https://doi.org/10.1016/j.combustflame.2022.112380.

**Finding used.** Tests span 2–21% oxygen and internal flow up to 14.7 mm/s. At oxygen above 10%, the minimum supply approaches 0.08 ± 0.01 g/(m²·s). The concentration limit depends on flow.

**Why this source was necessary.** From the working document. Supports tracking oxygen transport and supply; does not justify a universal 2% extinction switch or the app’s half-saturation coefficient.

### LH21

Lin, S., and Huang, X. (2021). “Quenching of smoldering: Effect of wall cooling on extinction.” Proceedings of the Combustion Institute, 38(3), 5015–5022. https://doi.org/10.1016/j.proci.2020.05.017.

**Finding used.** Near quenching, minimum smoldering temperature was about 250 °C in the tested dry-organic-soil reactors; quenching diameter was about 10 cm.

**Why this source was necessary.** From the working document. Demonstrates dependence on heat loss and oxygen. A measured front temperature is not a universal local Arrhenius reaction cutoff.

### HR15

Huang, X., and Rein, G. (2015). “Computational study of critical moisture and depth of burn in peat fires.” International Journal of Wildland Fire, 24(6), 798–808. https://doi.org/10.1071/WF14178.

**Finding used.** For particular low-inorganic-content modeled beds, extinction moisture reached 2.56 kg water/kg dry peat versus an ignition threshold of 1.17 kg/kg.

**Why this source was necessary.** From the working document. Requires a dry-mass moisture conversion and separate ignition/extinction interpretation. These numbers are not pore saturations or universal constraints.

### S21

Santoso, M. A., Cui, W., Amin, H. M. F., Christensen, E. G., Nugroho, Y. S., and Rein, G. (2021). “Laboratory study on the suppression of smouldering peat wildfires: effects of flow rate and wetting agent.” International Journal of Wildland Fire, 30(5), 378–390. https://doi.org/10.1071/WF20117.

**Finding used.** Laboratory suppression evaluated treatment through cooling and extinction; a 50 °C observation criterion was used.

**Why this source was necessary.** From the working document. Supports checking multiple locations and later recovery. A single cold cell or visual smoke reduction is insufficient.

### S22

Santoso, M. A., Christensen, E. G., Amin, H. M. F., Palamba, P., Hu, Y., Purnomo, D. M. J., Cui, W., Pamitran, A. S., Richter, F., Smith, T. E. L., Nugroho, Y. S., and Rein, G. (2022). “GAMBUT field experiment of peatland wildfires in Sumatra: from ignition to spread and suppression.” International Journal of Wildland Fire, 31, 949–966. https://doi.org/10.1071/WF21135.

**Finding used.** Field suppression used in-depth temperature surveys. Local remaining hot spots required follow-up despite initial readings below 50 °C.

**Why this source was necessary.** From the working document. Establishes the need for spatial coverage and reassessment; it does not calibrate this app’s buried source.

### Z26

Zhang, Y., Chen, Y., Qin, Y., Li, Y., Zhou, Y., Zhang, Z., Jiang, Y., Lin, S., and Huang, X. (2026). “Suppressing underground peat fire and smoldering spread via water, ice, dry ice, and liquid nitrogen.” Fire Safety Journal, 162, 104772. https://doi.org/10.1016/j.firesaf.2026.104772.

**Finding used.** Direct peat-fire experiments compare cooling treatments and persistence. The working document reports 41 kg/m² dry ice and up to 175 minutes cooling for its air-dried test condition; these specific figures remain pending full-table verification here.

**Why this source was necessary.** From the working document and earlier review. Relevant suppression benchmark, but surface treatment geometry and subzero phase behavior differ from this model. No loading or success threshold is installed.

### M22

Mulyasih, H., Akbar, L. A., Ramadhan, M. L., Cesnanda, A. F., Putra, R. A., Irwansyah, R., and Nugroho, Y. S. (2022). “Experimental study on peat fire suppression through water injection in laboratory scale.” Alexandria Engineering Journal, 61(12), 12525–12537. https://doi.org/10.1016/j.aej.2022.06.036.

**Finding used.** Laboratory water injection is compared with surface delivery.

**Why this source was necessary.** From the working document. Relevant to delivery/contact and future benchmarking, but the current solver has no liquid-water injection network; its parameters are not copied into dry-ice transport.

### DB25

Densmore, V. S., and Barnesby, T. K. (2025). “For peat’s sake! Peat type influences critical moisture thresholds that prevent combustion of organic soils in Western Australia.” International Journal of Wildland Fire, 34, WF24204. https://doi.org/10.1071/WF24204.

**Finding used.** Critical moisture varies by peat type, including differences in density and carbon content.

**Why this source was necessary.** From the working document. Supports specimen-specific constraints and explicit uncalibrated labels, rather than a single peat moisture limit.

## Supplied working document: additional source screening

The user’s `Working Document (1).docx` was read as reference material, including its repeated bibliography. It was not modified or uploaded to the repository. Proposal text in that document was not treated as an instruction to change source depth, add steam injection or deploy equipment. Relevant quantitative studies are included in the registry above. The additional items below informed scope or future validation; they supply no silently adopted coefficients.

| Supplied item | Use in this review / limitation |
| --- | --- |
| Rein and Huang (2021), peat-fire review, DOI 10.1016/j.coesh.2021.100296 | Context for persistent subsurface combustion and research gaps; reviewed in the existing ASCE research report. Does not supply a universal property set. |
| Santoso et al. (2019), smoldering-to-flaming review, DOI 10.3389/fmech.2019.00049 | Identifies transition mechanisms omitted by the one-step oxidation surrogate. No flaming threshold installed. |
| Lin, Yuan and Huang (2022), computational quenching study | Distinguish a model-dependent minimum front temperature from the 2021 experimental quenching result. Bibliographic/full-model confirmation remains incomplete; no numerical value applied. |
| Ramadhan et al. (2017), water spray, DOI 10.1016/j.firesaf.2017.04.012 | Wetting, extinction and later recovery need treatment-specific experiments. Liquid spray is outside this solver. |
| Zhang et al. (2024), resurfacing peat fire, DOI 10.1071/WF23128 | Supports investigating surface litter and underground fire interaction. Does not supply root heat capacity or buried dry-ice contact coefficients. |
| Qin et al. (2022), top-coal dry-ice treatment, DOI 10.1007/s11356-021-17213-y | Different authors/material from the peat oxygen-supply paper Q22. Coal field observations are not peat calibration; document-reported dose/cooling figures were not transferred. |
| Tzovolou et al. (2011), steam remediation | Multiphase condensation and preferential pathways identify missing physics. Steam/NAPL soil experiments are not dry CO₂ transport evidence; full bibliographic and numerical extraction remains incomplete. |
| Weishaupt et al. (2016), steam transport, DOI 10.1007/s11242-016-0624-z | Shows the need for an appropriate multiphase formulation. Saturated steam remediation cannot validate the app’s fixed gas-viscosity model. |
| Lin, Liu and Huang (2021), peat firebreaks | Laboratory firebreak width/moisture are geometry- and protocol-dependent. No universal safe-width or extinction rule installed. |
| Shotyk and Noernberg (2020), peat coring | Sampling-method relevance; no retrieved material-property table applied. |
| Drysdale (2011), combustion textbook; Davis (1998), steam report | Background/engineering context, separately identified from peer-reviewed experimental property data. |
| Gerrard (2024), wildfire-smoke policy/law; PHAC (2024), public-health guidance | Context for consequences; not material-property evidence and no solver input changes. |

Some supplied entries had incomplete bibliographic metadata. Those are intentionally identified as incomplete rather than given invented ASCE citations. The 16 verified bibliographic records used in the app have ASCE-style citations above; where only an abstract or reanalysis was accessible, that access limitation is stated. The separate earlier [ASCE review](RESEARCH_REVIEW_ASCE.md) remains relevant.

## Numeric property register

Default scenario values, full stored precision shortened only for this table. Sources linked to an assumed property explain why calibration matters; they do **not** validate its number. The live export adds selected-profile interpretations and later edits.

### Ground

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `soil.sandFraction` | 0.5 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.siltFraction` | 0.35 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.clayFraction` | 0.15 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.organicFraction` | 0.03 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.bulkDensityKgM3` | 1250 | kg/m³ | 50–2500 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.porosity` | 0.45 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.moistureSaturation` | 0.35 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.thermalConductivityWmK` | 0.65 | W/(m·K) | 0.01–5 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.solidHeatCapacityJKgK` | 850 | J/(kg·K) | 100–5000 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.intrinsicPermeabilityHorizontalM2` | 3e-11 | m² | 1e-16–1e-08 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.intrinsicPermeabilityVerticalM2` | 8e-12 | m² | 1e-16–1e-08 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.gasDiffusivityM2S` | 1.6e-05 | m²/s | 1e-08–0.001 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.tortuosity` | 3 | 1 | 1–20 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |
| `soil.compaction` | 0.1 | fraction | 0–1 | Base-soil assumption; no site measurement confirms this value. Mineral fractions use dry mineral mass; organic fraction uses dry bulk mass. Soil presets are illustrative. OD09; DB25 |

### Layers and roots

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `soilLayers.0.dryDensityMultiplier` | 0.9 | 1 | 0.1–3 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.1.dryDensityMultiplier` | 1 | 1 | 0.1–3 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.0.porosityOffset` | 0.03 | fraction | -0.5–0.5 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.1.porosityOffset` | 0 | fraction | -0.5–0.5 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.0.moistureSaturationOffset` | -0.05 | fraction | -0.9–0.9 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.1.moistureSaturationOffset` | 0 | fraction | -0.9–0.9 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.0.permeabilityMultiplier` | 1.5 | 1 | 0.001–1000 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.1.permeabilityMultiplier` | 1 | 1 | 0.001–1000 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.0.thermalConductivityMultiplier` | 0.8 | 1 | 0.1–5 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `soilLayers.1.thermalConductivityMultiplier` | 1 | 1 | 0.1–5 | Assumed layer modifier; no measured layer profile is supplied. OD09 |
| `root.amountKgM3` | 1.5 | kg/m³ | 0–100 | Assumed extra dry root fuel; no site-specific root survey or separate root chemistry is supplied.  |

### Peat

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `peatRegions.0.organicFraction` | 0.75 | fraction | 0–1 | Site-specific assumption. Irish moss peat measurements provide context, not confirmation of this mixed soil deposit. HR17; HR15; DB25 |
| `peatRegions.0.bulkDensityKgM3` | 300 | kg/m³ | 50–2500 | Site-specific assumption. Irish moss peat measurements provide context, not confirmation of this mixed soil deposit. HR17; HR15; DB25 |
| `peatRegions.0.moistureSaturation` | 0.2 | fraction | 0–0.95 | Liquid volume / pore volume. Literature dry-basis moisture is shown separately; neither ignition nor extinction has a universal saturation threshold. HR17; HR15; DB25 |
| `materialProperties.peatOrganicParticleDensityKgM3` | 1500 | kg/m³ | 1000–2000 | 1500 is a literature model input (Huang and Rein, Table 2), not a bulk density or a new measurement. HR17 |
| `materialProperties.mineralParticleDensityKgM3` | 2650 | kg/m³ | 2000–3500 | Assumed quartz-like mineral end member. Site mineralogy is unmeasured.  |
| `materialProperties.peatHeatCapacityJKgK` | 1840 | J/(kg·K) | 100–5000 | 1840 is the peat input in Huang and Rein Table 2. Constant approximation; char/ash heat capacities are not represented. HR17 |
| `materialProperties.peatDryConductivityWmK` | 0.16 | W/(m·K) | 0.01–3 | Assumed intercept in k = intercept + slope × initial pore saturation. No fitted relationship for this specimen. O’Donnell uses volumetric water content, a different basis. OD09 |
| `materialProperties.peatSaturationConductivityWmK` | 0.6 | W/(m·K) | 0–3 | Assumed slope versus pore saturation. Fixed after initialization; excludes pore radiation and evolving conductivity. OD09 |
| `materialProperties.peatHorizontalPermeabilityFactor` | 4 | × base | 0.01–1000 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.  |
| `materialProperties.peatVerticalPermeabilityFactor` | 2 | × base | 0.01–1000 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.  |

### Reaction

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `hotRegions.0.temperatureC` | 270 | °C | -20–900 | Prescribed ignition state; no thermocouple or fuel inventory measurement supplied. LH21 |
| `hotRegions.0.fuelFraction` | 1 | fraction | 0–1 | Prescribed ignition state; no thermocouple or fuel inventory measurement supplied. LH21 |
| `model.smolderRateS` | 2e-06 | 1/s | 0–0.01 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.referenceTemperatureK` | 550 | K | 300–1000 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.activationEnergyJMol` | 35000 | J/mol | 0–200000 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.minimumReactionTemperatureK` | 390 | K | 273–1000 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.oxygenHalfSaturation` | 0.06 | mole fraction | 0.001–1 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.heatOfCombustionJkg` | 1.5e+07 | J/kg | 0–5e+07 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.evaporationRateS` | 1e-06 | 1/s | 0–0.01 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.evaporationOnsetTemperatureK` | 310 | K | 273–500 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |
| `model.boilingTemperatureK` | 373.15 | K | 273–500 | One-step surrogate assumption. Multi-step peat kinetics and experimental extinction temperatures are not interchangeable with these coefficients. HR17; LH21; Q22 |

### Source

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `source.densityKgM3` | 1560 | kg/m³ | 500–2000 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.initialMassKg` | 4 | kg | 0–1000 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.initialTemperatureK` | 194.65 | K | 150–195 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.supportRadiusM` | 0.12 | m | 0.02–1 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.heatGenerationWm3` | 2500 | W/m³ | 0–1000000 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.startTimeS` | 0 | s | 0–1e+08 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.durationS` | 86400 | s | 0–1e+08 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |
| `source.contactConductanceWm2K` | 1.5 | W/(m²·K) | 0–100 | Prescribed device or contact assumption. Source density and contact conductance need measurements; heat input and schedule are controls. GE37; Z26 |

### Boundary

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `atmosphere.temperatureC` | 10 | °C | -50–80 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.deepTemperatureC` | 8 | °C | -50–80 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.pressurePa` | 101325 | Pa | 80000–150000 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.oxygenMoleFraction` | 0.2095 | mole fraction | 0–1 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.co2MoleFraction` | 0.00042 | mole fraction | 0–1 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.waterVaporMoleFraction` | 0.01 | mole fraction | 0–1 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.exchangeVelocityMS` | 5e-06 | m/s | 0–0.1 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.surfaceHeatTransferWm2K` | 4 | W/(m²·K) | 0–100 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |
| `atmosphere.bottomHeatTransferWm2K` | 0.5 | W/(m²·K) | 0–100 | Prescribed boundary condition; not a measured condition at this site. Gas entries are mole fractions and must sum to at most one. Q22 |

### Solver limits

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `model.minPressurePa` | 80000 | Pa | 80000–150000 | Supported numerical range. Limits may be tightened; changing a limit does not extend the physical model. HR17; LH21; Q22 |
| `model.maxPressurePa` | 150000 | Pa | 80000–150000 | Supported numerical range. Limits may be tightened; changing a limit does not extend the physical model. HR17; LH21; Q22 |
| `model.maxDarcyVelocityMS` | 0.02 | m/s | 1e-06–0.02 | Supported numerical range. Limits may be tightened; changing a limit does not extend the physical model. HR17; LH21; Q22 |
| `model.maxStepS` | 120 | s | 0.1–3600 | Supported numerical range. Limits may be tightened; changing a limit does not extend the physical model. HR17; LH21; Q22 |

### Water and dry ice

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `materialProperties.waterDensityKgM3` | 1000 | kg/m³ | 950–1000 | 1000 is the rounded water input in Huang and Rein Table 2. Fixed liquid value; freezing and density variation are excluded. HR17 |
| `materialProperties.waterHeatCapacityJKgK` | 4186 | J/(kg·K) | 3500–5000 | 4186 is the constant water input in Huang and Rein Table 2; not a full temperature-dependent equation of state. HR17 |
| `materialProperties.waterEvaporationJkg` | 2260000 | J/kg | 2000000–2600000 | 2.26 MJ/kg is the drying enthalpy in Huang and Rein Table 1; approximate near boiling, not all temperatures. HR17 |
| `materialProperties.co2SolidHeatCapacityJKgK` | 850 | J/(kg·K) | 300–1200 | 850 is retained as a constant assumption. Giauque and Egan measured temperature dependence; this single value is not a fit. GE37 |
| `materialProperties.co2SublimationK` | 194.67 | K | 194–195 | 194.67 K measured by Giauque and Egan near atmospheric pressure. A fixed point; changing it does not implement pressure-dependent phase equilibrium. GE37 |
| `materialProperties.co2SublimationJkg` | 573274.4 | J/kg | 500000–650000 | 6030 cal/mol at 194.67 K converted using 4.184 J/cal and 0.0440095 kg/mol. Rounded for display only. GE37 |

### Gas transport

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `materialProperties.gasHeatCapacityJMolK` | 29 | J/(mol·K) | 15–60 | 29 is an effective model coefficient, not a species-resolved Cp or Cv. No full compressible energy equation is solved.  |
| `materialProperties.co2GasHeatCapacityJMolK` | 28.5 | J/(mol·K) | 15–60 | 28.5 is the legacy effective source-gas coefficient. No verified temperature-dependent Cp fit is used; do not interpret it as universal Cp.  |
| `materialProperties.gasViscosityPaS` | 1.8e-05 | Pa·s | 5e-06–0.0001 | Fixed air-like approximation. Changes with composition and temperature in reality; no mixture law is fitted.  |

### Vertical mechanics

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `materialProperties.verticalYoungsPa` | 1000000 | Pa | 10000–1e+08 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range. MA07 |
| `materialProperties.verticalShearPa` | 350000 | Pa | 1000–1e+08 | Independent spring-network coupling, not an isotropic E–ν–G relation. Requires calibration. MA07 |
| `materialProperties.verticalBiot` | 0.8 | 1 | 0–1 | Assumed effective-stress coefficient; Biot theory motivates the form, not this numerical value. B41 |
| `materialProperties.verticalTensilePa` | 20000 | Pa | 1–1000000 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range. MA07 |
| `materialProperties.verticalDampingRatio` | 0.12 | 1 | 0–1 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.  |
| `materialProperties.verticalYieldedFraction` | 0.25 | 1 | 0.01–1 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.  |

### 3D mechanics

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `materialProperties.femYoungsPa` | 1000000 | Pa | 10000–1e+08 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range. MA07 |
| `materialProperties.femPoisson` | 0.3 | 1 | 0–0.48 | Isotropic small-strain assumption. Near-incompressible states need a different element formulation. MA07 |
| `materialProperties.femCohesionPa` | 8000 | Pa | 1–1000000 | Intercept in q − friction slope × p − cohesion. Not directly a Mohr–Coulomb cohesion measurement. MA07 |
| `materialProperties.femFrictionSlope` | 0.35 | 1 | 0–2 | Coefficient multiplying pressure, not a friction angle in degrees. No triaxial calibration. MA07 |
| `materialProperties.femDilationSlope` | 0.05 | 1 | 0–2 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.  |
| `materialProperties.femHardeningPa` | 20000 | Pa | 0–1e+08 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range.  |

### Short event

| Setting | Default | Units | Supported input | Evidence / source IDs |
| --- | ---: | --- | --- | --- |
| `materialProperties.fastCohesionPa` | 20000 | Pa | 1–1000000 | Assumed denominator for the illustrative shell yield index; separate from calculated soil displacement.  |
| `materialProperties.fastBiot` | 0.8 | 1 | 0–1 | Uncalibrated model assumption. Measure this for the specimen; the allowed range is a software guard, not an experimental range. B41 |
| `materialProperties.fastDamageRateS` | 3 | 1/s | 0–10 | Illustrative feedback on radial permeability. Does not predict fracture.  |
| `materialProperties.fastDamagePermeabilityFactor` | 10 | × | 1–100 | Hypothetical radial transport feedback; not measured damage.  |
| `materialProperties.fastMaxPressurePa` | 5000000 | Pa absolute | 150000–5000000 | Numerical validity ceiling, not a soil failure or safety pressure. May be lowered, never widened beyond model support.  |
| `materialProperties.fastMaxSpeedMS` | 50 | m/s | 0.01–50 | Numerical validity ceiling; not a validated compressible-flow regime.  |

## What remains unconfirmed

No supplied dataset validates all settings together. Reaction kinetics, moisture-dependent gas transport, intrinsic permeability, texture/compaction multipliers, source contact, root fuel, mechanics strengths/damping and field boundary conditions require matched measurements. Fixed numerical structure (flux limiting, timestep safety factors, oxygen stoichiometry, ideal-gas law, gas molar masses and constant gravity) remains in the solver rather than becoming arbitrary UI knobs. Geometry and animation controls remain in their existing menus.

No freezing/thawing, liquid-water transport, full CO₂ phase equilibrium, char/ash kinetics, calibrated fracture or blast is added. Temperature stops and numerical pressure/velocity ceilings are model validity guards. Experimental peat-type ignition or extinction results are not universal switches. Scene studio continues to show prescribed thermal colors and motion, independently of research profiles and solver temperatures.
