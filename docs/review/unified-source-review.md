# Finite CO₂ source review — round 1

Reviewer: root integration agent; implementer: independent physics agent.

Scope: `src/coupled/source.ts`, source tests, and model documentation. The constitutive residual is checked independently from ledger closure. A backwards-Euler temperature solve couples finite mass loss and sensible heat; surrounding CO₂ concentration enters a finite film flux. The old total-pressure-only sublimation-temperature assumption is removed. A pure-CO₂ heat-limited branch supplies a useful analytic limiting test.

Physical accuracy judgment: 5/10 for the supported reduced spherical-film source, moderate confidence in numerical consistency; low confidence for buried heterogeneous material prediction. This is not a percentage of experimental accuracy. Visual realism: pending accepted-state render.

Passed gates: seven module tests cover finite inventory, concentration response, analytic heat-limited behavior, caloric balance and timestep refinement. Integration ledger and end-to-end runs remain required before source acceptance.

Limitations: the sphere is isothermal, effective diffusivity and contact conductance are assumptions, phase coexistence uses a constant-latent-enthalpy correlation, geometry is held fixed within each timestep, and deposition is unsupported. Exhaustion transfers remaining step heat to the surrounding cells. These bounds are documented and must remain visible. The primary paper supports the role of gas concentration and heat/mass coupling, not the chosen buried-peat coefficients.

Disposition: conditionally accept as a reduced source after integration conservation tests pass. Do not call this experimentally validated sublimation or a full nonideal multiphase CO₂ model.

## Round 2 — integration repair accepted

The small, strongly heated source exposed a floating-point singularity close to pure surface CO₂. The implementer changed the solve variable to logarithmic carrier depletion so finite flux remains resolvable even when the carrier fraction is below machine epsilon. A specific regression was added without changing the caloric residual acceptance. Eight source tests and fourteen transport/engine/remap tests pass (22 total). The integrated mass/species/energy accounting passes. Reduced-model acceptance granted with the limitations above; visual review remains separate. Review count frozen at 2/3 for this integration.
