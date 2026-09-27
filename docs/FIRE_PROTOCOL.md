# Cold surface ignition and finite treatment protocol

The new story has an actual heat/gas experiment beneath its illustrated actions. It starts at 10 °C with all configured water present. There is no prepared hot region, initial dry halo, or deletion of water. The numerical experiment **does not demonstrate a resolved underground smouldering front or successful extinction**.

## Scenario and external energy

`src/coupled/fireProtocol.ts` uses the existing conservative transport model, its reaction kinetics, water phase equilibrium, gas enthalpy transport and acceptance limits. Mechanics, shell deformation, excavation, liquid flow and fracture are absent. The domain is 8 × 8 × 3.2 m with 16 × 16 × 10 cells (0.5 × 0.5 × 0.32 m). A surface-connected peat slab replaces the original buried lens. This is an explicit assumed scenario, not a measured terrain.

Dry bulk density is 180 kg/m³, organic fraction 0.9, and initial water is 0.1 kg per kg dry material. Moisture is converted to pore saturation using the existing material density/porosity relation. A source in the top cell at (3.75, 4.25, 0.08) m deposits 2500 W for 7200 s: exactly 18 MJ enters `ledger.heaterJ`. Heat is distributed through the existing canonical source kernel into a whole top cell; this is a coarse ignition surrogate, not a resolved surface flame or thin heating element. All drying during the experiment follows phase equilibrium and energy/gas transport.

The assumed atmospheric mass exchange coefficient is 0.0016 m/s: gas diffusivity 1.6×10⁻⁵ m²/s divided by an assumed 0.01 m air film. Film thickness, wind, terrain and kinetics are not calibrated. The original 5×10⁻⁶ m/s surface coefficient gives a maximum oxygen diffusive supply of only about 0.0013 g/m²/s at ambient air composition. It should not be silently interpreted as a measured open-air boundary. A preliminary run with that coefficient and a shorter, one-hour igniter cooled from 462 K at cutoff to 412.5 K at three hours and consumed only 0.01031 kg of fuel. That preliminary comparison changed both boundary exchange and ignition duration; it does not isolate either parameter's effect.

## Primary evidence and scope

[Huang and Rein (2017), DOI 10.1071/WF16198](https://doi.org/10.1071/WF16198) reports a 10 × 10 × 30 cm column, ignition using a 100 W coil for 30 minutes, and slow downward spread taking tens of hours. Its computational chemistry has several solid reaction stages. Those observations establish why a 90-second presentation cannot represent 90 seconds of natural metre-scale peat spread. They do **not** validate this different geometry, ignition surrogate, one-step kinetics, or chosen boundary film.

The existing cell size cannot resolve centimetre-scale reaction fronts. `reactingCellDepthM` is the deepest cell centre above the model reaction threshold with more than 0.01% of its initial fuel consumed. `heatedCellDepthM` is the deepest cell centre at or above 60 °C. Neither is a measured or converged front position. `propagationResolved` remains false, independently of whether these coarse diagnostics increase.

## Observed cold-start result

The 24-hour ignition-only run completed 4454 accepted steps and 319 rejected candidate steps in about 182 seconds on the shared development host. The heater ended at two hours at approximately 804.6 K. At 24 hours the maximum was 795.4277 K and 4.2525659 kg of fuel had reacted. Warm cells reached the second depth centre, 0.48 m, while the reacting-cell diagnostic remained in the top cell, 0.16 m. Reaction persisted long after heating stopped; that is evidence of sustained oxidation in this surrogate, not resolved downward propagation.

Each accepted step was checked against mass residual ≤10⁻⁷ kg and energy residual ≤10⁻⁴ J. Final residuals were −1.38×10⁻¹⁰ kg and −1.67×10⁻⁵ J. Numerical conservation is not validation of material properties or fire spread. The ignition run requests at most 20 s per step, with existing thermal, reaction and species-turnover restrictions and retries. This is an offline demonstration time resolution; its long-time solution has not undergone a time/mesh convergence study. The reference laboratory precision presets remain at 0.125 s.

## Treatment and presentation contract

The continuation imports 4 kg of dry ice at 194.65 K and the original study coordinate (4.4, 4, 1.3) m. `CoupledTransport.insertDryIce` books external solid mass, internal energy and pressure-volume compression work without resetting the fire history or conservation baseline. This is an idealized placement intervention into existing pore space, not a drilled-cavity, collision or fracture calculation. The roughly 1.3 m separation from the surface reaction zone is preserved. No extinction or rapid conversion is prescribed.

The post-insertion calculation requests 0.125 s steps for 30 seconds and captures every two seconds. The JSON contains a same-time before/after insertion pair at 86400 s; the post-insertion member is marked `phase: "treatment"`, `event: "dry-ice-insertion"`. Consumers must filter growth and treatment frames by phase and must not interpolate the insertion jump as a gradual import. Source disappearance in rapid illustration mode is an animation assumption and must never alter the accepted source mass, fields or ledgers.

`scripts/generate-fire-protocol.mjs` records source hashes **before loading** the numerical module, full scenario/control inputs, physical times, accepted field arrays, initialization provenance and any stop reason. Arrays use x-fastest, then y, then positive depth; temperature is K, pressure Pa, gas composition mole fraction, and inventories kg per cell. A computation stop retains earlier accepted states and does not fabricate later frames. Physical time and the presentation clock are separate.

Generate the default combined cache with `node scripts/generate-fire-protocol.mjs`. `FIRE_TREATMENT_SECONDS=0` produces an ignition-only cache; `FIRE_OPTIONS` may supply explicit protocol controls for a separate experiment. Any alternative must be labelled with its actual inputs and must not be claimed to reproduce the same physical case.
