# Parameter reference

The canonical machine-readable registry is [`src/sim/parameters.ts`](../src/sim/parameters.ts). This table is generated from its entries and the default scenario on 2026-09-25. `R` means implemented reduced model; `I` means illustrative only. Source `A` is an uncalibrated demonstration assumption configurable through the scenario schema, although some entries have no direct UI control; `H` is an explicitly hypothetical pathway assumption; `E` is a short-event run/output setting; `V` is an artistic or display setting; `G` is a derived geometric or fixed-support identity. The 6.096 m surface length is supplied by the user brief (20 ft exactly), while the 3 m depth and all property/kinetic defaults are demonstration settings. “Within block” also requires geometry extents to fit the domain; scenario validation is authoritative.

The registry describes full parameter ranges and dependencies. UI slider ranges can be narrower; JSON imports are checked against the schema limits. Setup edits source diameter and density and derives `source.initialMassKg` internally; there is no duplicate mass entry. Initial-condition edits restart the run. The heater enable switch is a live event.

## Scenario

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `seed` | Random seed (s) | 2.026e+7 | 0–2.147e+9 | integer; Deterministic geometry/noise seed | — | A / R |

## Domain

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `domain.widthM` | Surface width (Lx) | 6.096 | 1–100 | m; Computational block | — | A / R |
| `domain.lengthM` | Surface length (Ly) | 6.096 | 1–100 | m; Computational block | — | A / R |
| `domain.depthM` | Soil depth (Lz) | 3 | 0.5–30 | m; Positive below surface | — | A / R |
| `domain.nx` | Grid cells x (Nx) | 12 | 4–64 | cells; Uniform finite-volume grid | — | A / R |
| `domain.ny` | Grid cells y (Ny) | 12 | 4–64 | cells; Uniform finite-volume grid | — | A / R |
| `domain.nz` | Grid cells depth (Nz) | 8 | 4–48 | cells; Uniform finite-volume grid | — | A / R |

## Base soil

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `soil.sandFraction` | Sand (fsand) | 0.5 | 0–1 | fraction; Dry mineral mass; sand+silt+clay=1 | `soil.siltFraction`<br>`soil.clayFraction`<br>`soil.intrinsicPermeabilityHorizontalM2` | A / R |
| `soil.siltFraction` | Silt (fsilt) | 0.35 | 0–1 | fraction; Dry mineral mass; sand+silt+clay=1 | `soil.sandFraction`<br>`soil.clayFraction`<br>`soil.intrinsicPermeabilityHorizontalM2` | A / R |
| `soil.clayFraction` | Clay (fclay) | 0.15 | 0–1 | fraction; Dry mineral mass; sand+silt+clay=1 | `soil.sandFraction`<br>`soil.siltFraction`<br>`soil.intrinsicPermeabilityHorizontalM2` | A / R |
| `soil.organicFraction` | Base soil organic fraction (forg) | 0.03 | 0–1 | fraction; Dry bulk mass, excluding supplemental roots | `soil.bulkDensityKgM3` | A / R |
| `soil.bulkDensityKgM3` | Dry bulk density (rho_b) | 1250 | 50–2500 | kg/m³; Dry solids per bulk volume | `soil.organicFraction`<br>`soil.solidHeatCapacityJKgK` | A / R |
| `soil.porosity` | Porosity (phi) | 0.45 | 0–1 | fraction; Pore volume per bulk volume | `soil.moistureSaturation` | A / R |
| `soil.moistureSaturation` | Initial saturation (Sw) | 0.35 | 0–1 | fraction; Liquid water volume per pore volume | `soil.porosity` | A / R |
| `soil.thermalConductivityWmK` | Soil thermal conductivity (lambda) | 0.65 | 0.01–5 | W/(m·K); Bulk cell, base soil | — | A / R |
| `soil.solidHeatCapacityJKgK` | Dry solid specific heat (cp,s) | 850 | 100–5000 | J/(kg·K); Dry solids | — | A / R |
| `soil.intrinsicPermeabilityHorizontalM2` | Horizontal intrinsic permeability (kh) | 3e-11 | 1e-16–1e-8 | m²; Dry base soil before texture/compaction correction | `soil.compaction`<br>`soil.sandFraction` | A / R |
| `soil.intrinsicPermeabilityVerticalM2` | Vertical intrinsic permeability (kv) | 8e-12 | 1e-16–1e-8 | m²; Dry base soil before texture/compaction correction | `soil.compaction`<br>`soil.sandFraction` | A / R |
| `soil.gasDiffusivityM2S` | Free-gas diffusivity (Dg) | 1.600e-5 | 1e-8–0.001 | m²/s; Base pore gas before porosity/saturation/tortuosity correction | — | A / R |
| `soil.tortuosity` | Tortuosity divisor (tau) | 3 | 1–20 | 1; Effective gas diffusion denominator | — | A / R |
| `soil.compaction` | Compaction index (Cc) | 0.1 | 0–1 | fraction; Assumed k factor exp(-2 Cc) | — | A / R |

## Physical soil layer

Default values below are from the first (surface) layer. The second default layer is 2.2 m thick with neutral multipliers and offsets. Layers are ordered from the surface; their thicknesses sum to the domain depth.

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `soilLayers[].id` | Soil layer identifier (idl) | surface-soil | unique text | text; Ordered vertical layer object | — | A / R |
| `soilLayers[].thicknessM` | Soil layer thickness (hl) | 0.8 | 0.05–30 | m; Ordered from surface; sum equals soil depth | `domain.depthM` | A / R |
| `soilLayers[].dryDensityMultiplier` | Layer dry-density multiplier (mrho,l) | 0.9 | 0.1–3 | 1; Multiplies base dry bulk density | `soil.bulkDensityKgM3` | A / R |
| `soilLayers[].porosityOffset` | Layer porosity offset (dphi,l) | 0.03 | −0.5–0.5 | fraction; Added to base porosity | `soil.porosity` | A / R |
| `soilLayers[].moistureSaturationOffset` | Layer moisture offset (dSw,l) | −0.05 | −0.9–0.9 | fraction; Added to base initial saturation | `soil.moistureSaturation` | A / R |
| `soilLayers[].permeabilityMultiplier` | Layer intrinsic-permeability multiplier (mk,l) | 1.5 | 0.001–1000 | 1; Multiplies base horizontal and vertical k | `soil.intrinsicPermeabilityHorizontalM2`<br>`soil.intrinsicPermeabilityVerticalM2` | A / R |
| `soilLayers[].thermalConductivityMultiplier` | Layer thermal-conductivity multiplier (mlambda,l) | 0.8 | 0.1–5 | 1; Multiplies base thermal conductivity | `soil.thermalConductivityWmK` | A / R |

## Peat region

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `peatRegions[].id` | Peat region identifier (idp) | peat-1 | unique text | text; Scenario geometry object | — | A / R |
| `peatRegions[].shape` | Peat shape (Sp) | ellipsoid | ellipsoid \| slab \| irregular | enum; Layer/slab, ellipsoid, or seeded irregular patch | — | A / R |
| `peatRegions[].centerXM` | Peat center x (xp) | 3 | within block | m; Surface x coordinate | — | A / R |
| `peatRegions[].centerYM` | Peat center y (yp) | 3 | within block | m; Surface y coordinate | — | A / R |
| `peatRegions[].centerDepthM` | Peat center depth (zp) | 1.55 | within block | m; Positive below surface | — | A / R |
| `peatRegions[].sizeXM` | Peat x size (ax) | 2.4 | 0.05–100 | m; Full horizontal extent | — | A / R |
| `peatRegions[].sizeYM` | Peat y size (ay) | 2.2 | 0.05–100 | m; Full horizontal extent | — | A / R |
| `peatRegions[].thicknessM` | Peat thickness (ap,z) | 1.05 | 0.05–30 | m; Full vertical extent | — | A / R |
| `peatRegions[].rotationDeg` | Peat orientation (theta_p) | 20 | -360–360 | °; Rotation in x-y plane | — | A / R |
| `peatRegions[].organicFraction` | Peat organic fraction (fp,org) | 0.75 | 0–1 | fraction; Dry peat bulk mass | — | A / R |
| `peatRegions[].bulkDensityKgM3` | Peat dry bulk density (rho_p) | 300 | 50–2500 | kg/m³; Dry solids per bulk peat volume | — | A / R |
| `peatRegions[].moistureSaturation` | Peat initial saturation (Sp,w) | 0.20 | 0–0.95 | fraction; Liquid volume per peat pore volume | — | A / R |
| `peatRegions[].seed` | Irregular peat seed (sp) | 17 | 0–2.147e+9 | integer; Deterministic cell noise | — | A / R |

## Roots

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `root.amountKgM3` | Root amount (rho_r) | 1.5 | 0–100 | kg/m³; Supplemental dry root fuel per bulk volume at mean depth | `root.meanDepthM`<br>`root.distributionDepthM` | A / R |
| `root.meanDepthM` | Root mean depth (zr) | 0.45 | 0–30 | m; Center of exponential root amount distribution | — | A / R |
| `root.distributionDepthM` | Root depth scale (lr) | 0.45 | 0.01–30 | m; Exponential decay length | — | A / R |
| `root.thicknessM` | Typical root thickness (dr) | 0.015 | 0.001–0.5 | m; Visual geometry only; no extra fuel from thickness | — | A / I |
| `root.seed` | Root distribution seed (sr) | 4103 | 0–2.147e+9 | integer; Deterministic cell variation | — | A / R |

## Initial hot region

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `hotRegions[].id` | Hot region identifier (idh) | hot-1 | unique text | text; Scenario initial-condition object | — | A / R |
| `hotRegions[].shape` | Initial hot shape (Sh) | ellipsoid | ellipsoid \| slab | enum; Ellipsoid or slab | — | A / R |
| `hotRegions[].centerXM` | Hot center x (xh) | 2.8 | within block | m; Surface x coordinate | — | A / R |
| `hotRegions[].centerYM` | Hot center y (yh) | 3 | within block | m; Surface y coordinate | — | A / R |
| `hotRegions[].centerDepthM` | Hot center depth (zh) | 1.55 | within block | m; Positive below surface | — | A / R |
| `hotRegions[].sizeXM` | Hot x size (hx) | 1.6 | 0.05–100 | m; Full horizontal extent | — | A / R |
| `hotRegions[].sizeYM` | Hot y size (hy) | 1.4 | 0.05–100 | m; Full horizontal extent | — | A / R |
| `hotRegions[].thicknessM` | Hot vertical size (hz) | 0.8 | 0.05–30 | m; Full vertical extent | — | A / R |
| `hotRegions[].temperatureC` | Initial hot temperature (Th,0) | 270 | -20–900 | °C; Initial field only; never held fixed | — | A / R |
| `hotRegions[].fuelFraction` | Initial available fuel (fh,0) | 1 | 0–1 | fraction; Fraction of local dry fuel inventory retained | — | A / R |

## Buried source and heater

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `source.centerXM` | Dry-ice center x (xs) | 3.45 | within block | m; Surface x coordinate | — | A / R |
| `source.centerYM` | Dry-ice center y (ys) | 3.05 | within block | m; Surface y coordinate | — | A / R |
| `source.centerDepthM` | Dry-ice center depth (zs) | 1.35 | within block | m; Positive below surface; top cover derived from mass/density | — | A / R |
| `source.densityKgM3` | Dry-ice density (rho_CO2,s) | 1560 | 500–2000 | kg/m³; Assumed homogeneous solid density; linked mass/diameter | — | A / R |
| `source.initialMassKg` | Initial dry-ice mass (m_CO2,0) | 4 | 0–1000 | kg; Solid inventory; diameter derived | `source.densityKgM3` | A / R |
| `source.initialTemperatureK` | Initial dry-ice temperature (Ts,0) | 194.65 | 150–194.65 | K; Lumped source at/below fixed near-atmospheric sublimation temperature | — | A / R |
| `source.supportRadiusM` | Fixed heater support radius (rh) | 0.12 | 0.02–1 | m; Numerical support sphere; unchanged as dry ice shrinks | — | A / R |
| `source.heatGenerationWm3` | Volumetric heater generation (q''') | 2500 | 0–1e+6 | W/m³; Fixed heater support volume; total power derived | `source.supportRadiusM` | A / R |
| `source.startTimeS` | Heater start (th,start) | 0 | 0–1e+8 | s; Physical solver clock | — | A / R |
| `source.durationS` | Heater duration (th,dur) | 86400 | 0–1e+8 | s; Physical solver clock | — | A / R |
| `source.enabled` | Heater enabled (H) | true | true \| false | boolean; Operational edit recorded as event | — | A / R |
| `source.contactConductanceWm2K` | Source/soil contact conductance (hc) | 1.5 | 0–100 | W/(m²·K); Sphere area times soil/source temperature difference | — | A / R |
| `source.initialDiameterM` | Derived initial dry-ice diameter (dCO2,0) | 0.169816 | 0–2 | m; Volume-equivalent sphere | `source.initialMassKg`<br>`source.densityKgM3` | G / R |
| `source.topCoverDepthM` | Derived top-of-sphere cover depth (zcover) | 1.26509 | 0–30 | m; Center depth minus half initial diameter | `source.centerDepthM`<br>`source.initialMassKg`<br>`source.densityKgM3` | G / R |
| `source.heaterPowerW` | Derived total heater power (Ph) | 18.0956 | 0–4.2e6 | W; `q''' × 4πr_support³/3` when enabled and scheduled | `source.heatGenerationWm3`<br>`source.supportRadiusM`<br>`source.enabled`<br>`source.startTimeS`<br>`source.durationS` | G / R |

## Atmosphere and boundaries

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `atmosphere.temperatureC` | Atmospheric temperature (Ta) | 10 | -50–80 | °C; Top heat boundary | — | A / R |
| `atmosphere.deepTemperatureC` | Deep temperature (Tb) | 8 | -50–80 | °C; Bottom heat boundary | — | A / R |
| `atmosphere.pressurePa` | Atmospheric pressure (Pa) | 101325 | 80000–150000 | Pa; Open gas boundary and initial gas pressure | — | A / R |
| `atmosphere.oxygenMoleFraction` | Atmospheric oxygen (xO2,a) | 0.2095 | 0–1 | mole fraction; Dry+humid total gas mixture | — | A / R |
| `atmosphere.co2MoleFraction` | Atmospheric carbon dioxide (xCO2,a) | 4.200e-4 | 0–1 | mole fraction; Dry+humid total gas mixture | — | A / R |
| `atmosphere.waterVaporMoleFraction` | Atmospheric water vapor (xH2O,a) | 0.01 | 0–1 | mole fraction; Dry+humid total gas mixture | — | A / R |
| `atmosphere.exchangeVelocityMS` | Surface gas exchange speed (ve) | 5e-6 | 0–0.1 | m/s; Mole-fraction exchange at open atmospheric faces | — | A / R |
| `atmosphere.surfaceHeatTransferWm2K` | Surface heat-transfer coefficient (hs) | 4 | 0–100 | W/(m²·K); Air/soil heat exchange | — | A / R |
| `atmosphere.bottomHeatTransferWm2K` | Bottom heat-transfer coefficient (hb) | 0.5 | 0–100 | W/(m²·K); Deep-ground/soil heat exchange | — | A / R |
| `atmosphere.topGasBoundary` | Top gas boundary (BCt) | atmospheric | atmospheric \| noFlux | enum; Atmospheric or no flux | — | A / R |
| `atmosphere.sideGasBoundary` | Side gas boundary (BCs) | noFlux | atmospheric \| noFlux | enum; Atmospheric or no flux computational truncation | — | A / R |

## Reduced model

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `model.smolderRateS` | Smolder reference rate (kr) | 2e-6 | 0–0.01 | 1/s; First-order dry fuel oxidation at Tref | — | A / R |
| `model.referenceTemperatureK` | Rate reference temperature (Tref) | 550 | 300–1000 | K; Arrhenius rate reference | — | A / R |
| `model.activationEnergyJMol` | Apparent activation energy (Ea) | 35000 | 0–200000 | J/mol; Uncalibrated Arrhenius factor | — | A / R |
| `model.minimumReactionTemperatureK` | Minimum reaction temperature (Tmin,r) | 390 | 273–1000 | K; Reduced oxidation gate | — | A / R |
| `model.oxygenHalfSaturation` | Oxygen half-saturation (KO2) | 0.06 | 0.001–1 | mole fraction; O2-dependent oxidation factor | — | A / R |
| `model.heatOfCombustionJkg` | Reaction heat (Qr) | 1.500e+7 | 0–5e+7 | J/kg; Dry fuel consumed | — | A / R |
| `model.evaporationRateS` | Evaporation rate (ke) | 1e-6 | 0–0.01 | 1/s; Liquid water first-order maximum | — | A / R |
| `model.evaporationOnsetTemperatureK` | Evaporation onset (Te,on) | 310 | 273–500 | K; Linear kinetic ramp start | — | A / R |
| `model.boilingTemperatureK` | Evaporation ramp end (Te,boil) | 373.15 | 273–500 | K; Linear kinetic ramp end | — | A / R |
| `model.minPressurePa` | Minimum modeled pressure (Pmin) | 80000 | 80000–150000 | Pa; Validity guard; at most atmospheric pressure, never below 80 kPa | `atmosphere.pressurePa` | A / R |
| `model.maxPressurePa` | Maximum modeled pressure (Pmax) | 150000 | 80000–150000 | Pa; Validity guard; at least atmospheric pressure, never above 150 kPa | `atmosphere.pressurePa` | A / R |
| `model.maxDarcyVelocityMS` | Maximum modeled Darcy speed (vmax) | 0.02 | 1e-6–0.02 | m/s; Slow-flow validity guard; cannot be raised above 0.02 m/s | — | A / R |
| `model.maxStepS` | Maximum solver step (dtmax) | 120 | 0.1–3600 | s; Additional explicit heat/diffusion bound applies | — | A / R |

## Assumed pathway

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `pathways[].id` | Assumed pathway identifier (idv) | — | unique text | text; Hypothetical edited geometry object | — | H / R |
| `pathways[].centerXM` | Pathway center x (xv) | — | within block | m; Surface x coordinate | — | H / R |
| `pathways[].centerYM` | Pathway center y (yv) | — | within block | m; Surface y coordinate | — | H / R |
| `pathways[].centerDepthM` | Pathway center depth (zv) | — | within block | m; Positive below surface | — | H / R |
| `pathways[].sizeXM` | Pathway x size (vx) | — | 0.05–100 | m; Full extent | — | H / R |
| `pathways[].sizeYM` | Pathway y size (vy) | — | 0.05–100 | m; Full extent | — | H / R |
| `pathways[].thicknessM` | Pathway vertical extent (vz) | — | 0.05–30 | m; Full extent | — | H / R |
| `pathways[].rotationDeg` | Pathway orientation (theta_v) | — | -360–360 | °; Rotation in x-y plane | — | H / R |
| `pathways[].permeabilityMultiplier` | Assumed pathway k multiplier (mk) | — | 0.01–100000 | 1; Intrinsic permeability multiplier; no predicted soil failure | — | H / R |

## Visual illustration

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `illustrativeEvent.triggeredAtS` | Illustration trigger time (ti) | null | null or nonnegative | s; Visual event clock; does not mutate physics | — | V / I |
| `illustrativeEvent.intensity` | Illustration intensity (Ii) | 0.5 | 0–1 | fraction; Artistic displacement only | — | V / I |

## Derived pressure diagnostics

These registered outputs are calculated from the evolving field; they are not editable scenario inputs. The load proxy's validity status is displayed separately.

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `diagnostics.sourceExcessPressurePa` | Source excess pore pressure (dPs) | 0 | nonnegative | Pa; Positive part of trilinear source-weighted cell pressure minus atmospheric pressure | `source.centerXM`<br>`source.centerYM`<br>`source.centerDepthM`<br>`atmosphere.pressurePa` | G / R |
| `diagnostics.sourceProjectedAreaM2` | Assumed source support projected area (As) | 0.045239 | positive | m²; Fixed imaginary plane area `π × supportRadius²`, not a coherent soil failure surface | `source.supportRadiusM` | G / R |
| `diagnostics.sourcePressureLoadN` | Pressure-area load proxy (Fs,proxy) | 0 | nonnegative | N; Source excess pressure × fixed projected support area; no soil failure or blast mechanics | `diagnostics.sourceExcessPressurePa`<br>`diagnostics.sourceProjectedAreaM2` | G / R |

### Additional reaction readouts

These live solver diagnostics are not scenario inputs or registry entries. `cumulativeReactionHeatJ` is the sum of reacted dry-fuel mass times `model.heatOfCombustionJkg` in joules. `lastReactionPowerW` is heat released in the last accepted physical step divided by that step's duration in watts. `reactingCellCount` counts cells with positive oxidation in that accepted step. They reset with a new run and are restored with checkpoints; none is a measured combustion rate.

## Short-event controls

These registered controls are separate from the saved multiday scenario. Duration and frame count affect the short-event calculation/output sampling; playback pace and overlay affect display only.

| Path | Name / symbol | Default | Range | Units; basis | Dependencies | Source / status |
| --- | --- | ---: | --- | --- | --- | --- |
| `fastEvent.durationS` | Short-event physical duration (te) | 2 | 0.1–2 | s; Independent event clock, separate from multiday solver time | — | E / R |
| `fastEvent.frameCount` | Short-event recorded frame count (Ne) | 61 | 2–100 | frames; Output sampling including initial/final states; internal step ≤0.001 s | `fastEvent.durationS` | E / R |
| `fastEvent.playbackRate` | Short-event playback rate (rplay,e) | 1 | 0.1–4 | ×; Wall-clock replay of recorded frames only | `fastEvent.frameCount` | V / I |
| `fastEvent.overlay` | Short-event display overlay (Oe) | pressure | pressure \| co2 \| damage | enum; Selects shell pressure, CO₂ mole fraction, or illustrative damage colors | — | V / I |

## Fixed reduced-model constants

These are in [`src/sim/solver.ts`](../src/sim/solver.ts), not editable scenario parameters. They remain approximations unless specifically sourced.

| Quantity | Value | Basis and provenance |
| --- | ---: | --- |
| Universal gas constant | 8.314462618 J/(mol·K) | Physical constant. |
| CO₂ molar mass | 0.0440095 kg/mol | NIST S1 molecular weight, rounded. |
| CO₂ sublimation energy | 571 kJ/kg | Rounded near-195 K constant based on NIST S1 25.2 kJ/mol at 195 K. |
| CO₂ set temperature | 194.65 K | Near-atmospheric demonstration approximation. |
| CO₂ solid heat capacity | 850 J/(kg·K) | Demonstration assumption. |
| Liquid-water density | 1000 kg/m³ | Demonstration constant. |
| Liquid-water heat capacity | 4180 J/(kg·K) | Demonstration constant. |
| Water evaporation energy | 2.26 MJ/kg | Approximate near-boiling constant. |
| Reduced mixture heat capacity | 29 J/(mol·K) | Demonstration constant. |
| Source CO₂ gas heat capacity | 28.5 J/(mol·K) | Demonstration constant. |
| Gas viscosity | 1.8 × 10⁻⁵ Pa·s | Fixed near-ambient mixture approximation. |

## Short-event options and fixed assumptions

The separate radial event in `src/fastEvent/model.ts` takes a snapshot; these values do not change the multiday solver. Duration and recorded-frame count are Event-tab controls. Remaining coefficients are fixed, uncalibrated demonstration assumptions, reported with the event output.

| Quantity | Default / limit | Basis and provenance |
| --- | ---: | --- |
| Event duration | Default 2 s; `0 < t ≤ 2 s` | Separate event clock, not added to slow-solver time. |
| Recorded event frames | Default 61; 2–100 | Includes initial frame; rendering record limit. |
| Internal event step | At most 0.001 s | Fixed numerical step. |
| Spatial aggregation | At most 8 radial groups | Source support cells plus distance-sorted 3D cells; assumed reduction. |
| Flux relaxation scale | 250 m/s; at least 0.005 s per face | Sets `τ = max(0.005 s, face distance / 250 m/s)`; not a computed sound speed. |
| Fast-event pressure ceiling | 5 MPa | Uncalibrated numerical validity guard; independent of slow-solver pressure bound. |
| Fast-event face-speed ceiling | 50 m/s | Uncalibrated numerical validity guard, not a shock criterion. |
| Assumed effective-stress pressure coefficient | 0.8 | Dimensionless illustrative coefficient. |
| Assumed cohesion | 20,000 Pa | Illustrative yield-index divisor and offset; not measured soil strength. |
| Gravity in overburden estimate | 9.80665 m/s² | Physical constant; overburden uses base dry density × source center depth. |
| Damage indicator growth coefficient | 3 s⁻¹ | Uncalibrated, dimensionless-damage rate factor. |
| Maximum damage permeability multiplier | 10 | `k/k₀ = 1 + 9D`; illustrative event-only feedback. |

A literature citation for one constant does not calibrate the soil, source contact law, smoldering kinetics, or treatment response. See [`PHYSICS_MODEL.md`](PHYSICS_MODEL.md) and [`SOURCES.md`](SOURCES.md).

The one-click solid-CO₂ conversion is an operational event rather than an editable scenario parameter. Its converted mass and separately accounted external energy are recorded in solver diagnostics and the event log; see `PHYSICS_MODEL.md`.

The displayed pressure-load proxy is a derived diagnostic, not a scenario input. It uses source-weighted excess pore pressure above atmosphere (Pa) times the fixed assumed support-plane area `π × source.supportRadiusM²` (m²), yielding newtons. Its validity status must accompany the value; see `PHYSICS_MODEL.md`.
