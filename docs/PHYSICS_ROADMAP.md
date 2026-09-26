# Physics roadmap

## Source audit for the new branch

| Subsystem | Code and method | Verified scope / gap | Next acceptance check |
| --- | --- | --- | --- |
| Soil movement | `mechanics/continuum.ts`: 3D eight-node small-strain FEM; `mechanics/model.ts`: separate vertical dynamic links | Elastic/plastic top-load benchmark calculated; link model remains one-way and spatially sensitive | Heterogeneous gravity, pressure loading, 3D plastic mesh study |
| Pressure | `sim/solver.ts`: implicit finite-volume ideal-gas storage/Darcy solve | Basic conservation tests; fixed geometry and viscosity | Pressure/flow analytical benchmark and property-domain test |
| Gas species | `sim/solver.ts`: finite-volume upwind advection/diffusion of O₂, CO₂, background, vapor | Mixture inventories tracked; no buoyancy or validated CO₂ dissolution | Independent transport benchmark and open-boundary closure |
| Fire | `sim/solver.ts`: finite-fuel oxidation, oxygen limit, reaction heat | Calculated but uncalibrated; char/ash and independent smolder reference absent | Priority 2 reaction/inventory and reference comparison |
| Heat | `sim/solver.ts`: finite-volume conduction/storage and boundary exchange | Analytical heat check exists; gas enthalpy closure incomplete | Reaction/source-inclusive energy closure |
| Water | `sim/solver.ts`: liquid inventory, evaporation, vapor species | No liquid flow, condensation, ice | Moist/dry and evaporation energy checks; bound unsupported freezing |
| Dry ice | `sim/solver.ts`: finite source, heater support, sublimation/soil heat | Source ledger tests; subgrid contact and pressure phase limits | Coarse/resolved deposition and phase-domain checks |
| Property evolution | `sim/solver.ts`: initial spatial mixtures, moisture-dependent mobility | Organic burnout does not update stiffness/porosity | Sourced or explicitly assumed evolution law and balances |
| Geometry mapping | `sim/solver.ts`, `mechanics/model.ts`, `ui/Scene.tsx` | Separate solver/view geometry; no conservative 3D deforming remap | Nonmatching-grid transfer and coupling verification |
| Runtime/restart | `worker/solver.worker.ts`, `sim/solver.ts`, `mechanics/continuum.ts` | Worker separation and slow-solver restart; continuum checkpoint unit check | UI restart/export, run identity, event schedule replay |
| Conservation | `sim/solver.ts` diagnostics and tests | Gas/source/fuel ledgers, incomplete total heat and coupled work | Global and local mass/energy/force residual suite |

The 3D brick mode is FEA because it solves nodal vector displacement with element strain interpolation, constitutive integration at Gauss points, and equilibrium residuals. The old link solver is only a reduced vertical response. The transport grid and rendering triangles are not finite-element mechanics. The table records supported code and open verification work, not a claim of field validity.

The current application is an exploratory animation. Engineering claims require a measured input set, numerical verification, and independent experimental validation. Priorities below identify what evidence is needed before increasing model fidelity.

1. **Measure the domain and fuel.** Map peat geometry, stratigraphy, porosity, bulk density, organic/mineral fractions, root volume and dry fuel mass, moisture on a clearly stated basis, and intrinsic permeability in each direction. Measure thermal conductivity and heat capacity versus temperature and moisture. Record spatial uncertainty rather than treating a single preset as a site survey.
2. **Calibrate peat and root reactions.** Obtain heat-release, oxygen-consumption, char/ash, and product-yield data for the actual peat and roots. Fit a reaction scheme to independent experiments covering moisture, oxygen, and temperature. Test whether it reproduces ignition, persistence, and cooling without tuning to a desired treatment outcome. Huang and Rein (S6) demonstrate why one moisture suppression multiplier is inadequate.
3. **Improve water, freezing, and CO₂ phase handling.** Add coupled liquid-water movement, vapor transport, evaporation/condensation, freezing/thawing, and temperature-dependent gas properties with verified state-domain checks. Measure or bound CO₂ dissolution in pore water. A phase-aware source model should replace a constant sublimation enthalpy before extrapolating beyond the supported regime.
4. **Resolve the buried source.** Measure source geometry, contact resistance, nearby cavities, heater support volume, heater/source temperature, and heat exchange. Compare energy partition among sensible heating, latent sublimation, and soil transfer with laboratory measurements. Keep external heater energy explicit in the ledger.
5. **Calibrate slow gas transport.** Measure gas diffusivity/tortuosity, saturation-dependent relative permeability, boundary leakage, and pressure response. Compare spatial CO₂ and oxygen sensor histories and outflow against controlled experiments. Verify mass balances and mesh/time-step convergence before claiming transport accuracy.
6. **Validate soil response before physical failure claims.** Measure how slow deformation changes porosity, permeability, and transport pathways, then couple a constitutive model to flow within its calibrated range. The short-time radial event adds only assumed yield/damage indicators; physical failure analysis would also need measured strength and rate properties, resolved stress and gas dynamics, boundary geometry, and controlled instrumented comparisons. Keep illustrative movement and assumed post-rearrangement scenarios separate from calculated mechanics. This roadmap does not provide a blast or rupture design.
7. **Evaluate suppression and rebound.** Use untreated and treatment experiments with identical initial conditions where possible. Observe spatial temperature, oxygen, CO₂, moisture, fuel/char, emissions, and renewed smoldering over multiday follow-up. Compare predictions with held-out measurements and report uncertainty, false suppression calls, and model failures.

## Numerical evidence needed

Before scientific use, retain closed-domain conservation tests, open-boundary source/flux closure, analytical diffusion and heat benchmarks, mesh and time-step refinement, deterministic restart comparisons, and long-run finite-state checks. Report residuals separately from any numerical clipping. Experimental agreement is a separate claim: passing numerical tests verifies implementation behavior, not peat-fire validity.
