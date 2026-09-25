# Build status and handoff

Status reviewed against source on 2026-09-25. “Implemented” means code exists for the stated reduced or visual behavior; it does not imply experimental validation. Browser and automated-check results are recorded separately in `VALIDATION_STATUS.md`.

| Requested area | Current status | Next concrete task or limit |
| --- | --- | --- |
| Local 3D browser app under a 6.096 m × 6.096 m grass surface | Rendered in browser | Initial cutaway canvas export saved in `docs/images/`; improve contrast of the underground scene in a later visual pass. |
| 3 m editable depth, orbit/top/two vertical views, movable slice, coordinates and scale | Implemented in source | Pressure X section was viewed in browser; confirm labels and clipping at different window sizes. |
| Buried source with linked mass/diameter/density, cover depth and evolving display | Implemented in source | Measure source-scale contact/cavity behavior before physical interpretation. |
| Finite source/heater energy accounting with `q'''`, schedule, power, and cumulative energy | Implemented reduced model | Zero-heater sublimation, exhaustion, scheduled energy, and ledger behavior have automated checks; source contact and phase properties still need measurements. |
| Editable soil composition, bulk properties, peat shapes and multiple regions, root fuel, and multiple initial hot regions | Implemented reduced controls and scenario schema | Defaults and mixing coefficients remain demonstration assumptions. |
| Soil presets and reset-to-preset controls | Implemented with assumed values | UI and solver share the presets in `src/sim/parameters.ts`; their values are demonstration assumptions, not measured material sets. |
| Editable physical soil-layer thickness and separate layer material properties | Implemented reduced controls and schema | Layer multipliers/offsets change density, porosity, initial moisture, intrinsic permeability, and conductivity in the solver; coefficients are demonstration assumptions. |
| Spatially editable initial moisture distribution | Partial | Base soil, layer offsets, and peat-region overrides exist; add a general cell-wise spatial field editor or import. |
| Independently editable initial and boundary O₂/CO₂ conditions | Partial | Atmosphere composition initializes the gas field and sets open-boundary composition; a separate interior initial gas composition is not exposed. |
| Parameter registry with provenance, basis, range, default, dependencies, and status | Implemented in source | `src/sim/parameters.ts` has 113 entries, including layers, derived source/pressure quantities, and four short-event controls; audit its ranges against controls and refresh `PARAMETER_REFERENCE.md` when fields change. |
| Genuine 3D heat, gas, reaction, and moisture fields | Implemented reduced model | Finish analytical and conservation verification; calibrate against measurements later. |
| Pressure-driven slow porous flow with validity pause | Implemented reduced model | Confirm pressure/velocity limits and numerical convergence across scenarios. No shock or rupture physics. |
| Dry-ice phase behavior | Partial | Constant near-195 K sublimation approximation and initial/pressure guards only; no liquid CO₂ or full equation of state. |
| One-click solid-CO₂ conversion intervention | Implemented and exercised in browser | Transfers remaining solid mass to gas at unchanged solver time, books external phase/sensible energy, and applies a pressure validity check. After one simulated hour in the default scenario, the solid inventory reached zero, the 2 s event completed, and the slow run paused at its validity limit. No release-rate, blast, or soil-motion prediction. |
| Derived near-source pressure-load number | Implemented algebraic proxy | `max(0, source-weighted pore pressure − atmosphere pressure) × π supportRadius²`; fixed imaginary area, status flagged outside validity. It is not a real soil force or rupture prediction. |
| Separate short-time gas/soil-response event | Implemented and opened in browser | A 2 s event view and diagnostics appeared; the model conserves aggregate CO₂/other gas and displays uncalibrated yield/damage indicators. It does not solve a shock, fracture surface, or soil displacement; see `FAST_EVENT_MODEL.md`. |
| Quantitative soil failure and displacement | Not modeled | The short event's yield/damage fields and visible movement are illustrative. A measured constitutive law, resolved stress balance, geometry, and validation would be needed for physical failure claims. |
| Char/ash, CO, intermediate pyrolysis | Not modeled | Replace complete-oxidation surrogate with measured multi-step chemistry when data exist. |
| Open top, selectable side gas conditions, bottom thermal exchange | Implemented reduced boundaries | Side heat flux and deep gas conditions are not generally editable. |
| Visible soil motion and crack/settle event | Illustrative only | Confirm movement is visible and clearly labeled; it is independent of source settings. |
| Hypothetical altered pathway transport | Implemented as an assumed scenario | Preserve an original run beside an edited run if formal post-event comparison is needed. Do not present it as calculated damage. |
| 1-, 3-, and 7-day run, physical step controls, selectable solver pace, separate playback pace | Partial browser verification | Default pace briefly achieved in browser; at selected 3600 pace the default 12×12×8 production run reached one simulated hour, Ready/paused, with 10 checkpoints and no numerical pause. Automated seven-day runs pass. Other pace/replay choices, sustained throughput, frame rate, and memory remain to check. |
| Virtual probe, histories, field overlays, flow arrows, diagnostics | Implemented in source | Inspect field mapping, scale bars, units, and plot readability in browser. |
| Identical-seed A/B heater-off comparison | Partial | Both panels now use one view preset and fixed color scale; their cameras are locked while comparing. Interactive linked orbit and strict same-time pausing are not implemented. |
| Scenario JSON validation, CSV, PNG, recorded-state JSON | Implemented in source | Browser-smoke import/export and screenshot. UI imports scenarios, but does not resume from the exported recording. |
| Five reusable JSON demonstration scenarios | Implemented in `examples/` | Refresh if defaults or schema change, then validate imports in the browser. |
| One-step Mac launch outside Chrome | Implemented and terminal-tested in `run-mac.command` | Requires Node.js 22.12+; installs lockfile dependencies if needed, starts local Vite, and opens Safari. Finder double-click remains to check. |
| Unit/conservation/restart/numerical tests | Implemented and passed locally | Full suite passes 32/32 in two files: 24 slow-solver and 8 short-event checks, including conservation, heat refinement, validity pauses, conversion, two seven-day runs, and default-grid first-hour coverage. Typecheck, lint, fresh production build, and targeted browser retest passed after the pressure-solver repair; see `VALIDATION_STATUS.md`. |
| Performance target near 30 fps and Apple-silicon M3 verification | Not measured | Benchmark on the user's M3 Mac after browser smoke; report machine/browser rather than assuming performance. |
| Private GitHub repository | Published at [KadenCSmith/zombie-fire-suppression-sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim) | The tested project is committed and pushed on `main`. |

## Next agent task

Complete browser checks for the remaining pace/replay settings, imports and exports, and sustained performance; improve the canvas export's underground contrast. The next physics priority is measured soil, peat, source-contact, and short-event material properties with controlled experimental comparisons before adding higher-consequence claims.
