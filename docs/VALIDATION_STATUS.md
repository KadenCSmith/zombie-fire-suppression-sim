# Verification and validation status

**Scientific status:** no experimental validation has been performed for this application. Passing local tests checks code behavior and selected conservation properties; it does not establish reliable field predictions, treatment efficacy, safety, rupture, or rebound forecasts.

Execution host identified with macOS System Information: MacBook Pro (Mac15,7), Apple M3 Pro, 36 GB RAM, macOS 27.0. This is the machine on which local checks below will run; browser version and measured throughput remain to be recorded.

## Automated verification

The repository defines:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test -- --reporter=verbose` passed on the host above after the pressure-solver repair: **2 files, 32 tests, 2.43 s** (Vitest 5.0.2). The 24 slow-solver tests cover unit conversion, composition/geometry and registry checks, layered properties, linked source and heater ledgers, zero-input/exhausted behavior, oxidation stoichiometry, closed/open gas balances, discrete diffusion flux, analytical heat refinement, permeability response, restart, illustration independence, validity rollback, one-shot CO₂ conversion and high-pressure pause, the source pressure-area proxy, two seven-day runs, and the default 12×12×8 grid through its first hour. The 8 short-event tests cover duration/frame guards, uniform no-source state, CO₂/total-gas closure after conversion, closed and atmospheric side/top boundaries, permeability response, deterministic replay, finite recorded fields, and high-pressure pause.

Selected declared tolerances: short-run source energy residual <10⁻⁶ J; closed gas residual <10⁻⁹ mol; one-hour open gas residual <10⁻⁶ mol; active seven-day gas residual <10⁻⁴ mol; analytical heat-mode fine-grid RMS temperature error <0.2 K with improvement over a coarse mesh. These are tests of the reduced numerical implementation under controlled conditions, not peat-fire validation. The one-face diffusion check verifies the discrete flux formula; it is not an independent analytical diffusion-solution test. Playback speed and browser interaction still need separate checking.

| Check | Result | Evidence or limitation |
| --- | --- | --- |
| TypeScript type check | Passed | `npm run typecheck`: exit 0 after the fast-event UI integration. |
| Static lint | Passed | `npm run lint`: exit 0 with oxlint after the fast-event UI integration. |
| Unit/numerical tests | Passed | `npm test -- --reporter=verbose`: 32/32, 2 files, 2.43 s on this host after pressure-solver repair. |
| Production build | Passed | Fresh post-repair `npm run build` exited 0 with Vite 7.3.6 (381 modules, about 1 min 30 s). The only reported warnings were nonfatal Lucide `use client` and >500 kB chunk-size notices. |
| Browser smoke and visual inspection | Passed for observed controls; further checks remain | On the target Mac, the initial 3D cutaway rendered; default 30 simulated s per wall s was briefly achieved; pause and single-step worked; the pressure X section displayed; and PNG export produced `docs/images/initial-cutaway.png`. The post-repair production run on the default 12×12×8 grid reached 0d 01h 00m at selected 3600 simulated s per wall s, showed Ready/paused and 10 recorded checkpoints, and had no numerical pause. At that point, full solid-to-gas conversion completed a separate 2.000 s event with zero solid remaining, a displayed 1.11×10⁴ N pressure-area proxy, 346,249 Pa maximum shell pressure, maximum illustrative damage index 1, and near-zero gas/CO₂ residuals; the slow run paused at its pressure-validity limit. Browser console inspection found only a Three.Clock deprecation warning. Replay pace, FPS, memory, and scenario/CSV/JSON import or export remain to confirm. |
| Seven-day run and measured throughput/memory | Partial | Two automated runs reached 604,800 physical seconds with finite fields, including an active 8×8×6 case. A default 12×12×8 automated case and production browser run both reached one hour after pressure-solver repair without a numerical pause. Sustained actual throughput, frame rate, and peak memory are not yet measured. The checkpoint-size assertion uses only a 4×4×4 case. |

## Model coverage versus validation

| Subsystem | Status | Limit |
| --- | --- | --- |
| Heat transfer, gas transport, ideal-gas pressure, finite source, reduced fuel oxidation and evaporation | Implemented reduced model in source | Coarse 3D grid and demonstration property/kinetic coefficients; selected analytical and conservation checks passed, but experimental validation is absent. |
| Near-source pressure-load number | Derived algebraic proxy | Pressure above ambient times a fixed imagined projected area, with a validity status. It is neither a measured soil force nor a blast or rupture calculation. |
| Separate short-time radial gas event | Implemented reduced model in source | Conserves aggregate gas/CO₂ in numerical checks and applies its own validity guards; it omits shock physics and measured transient-gas properties. |
| Short-event yield and damage indicators | Illustrative only | Fixed assumed overburden/cohesion and pressure coefficient; no calibrated failure surface or displacement calculation. |
| Cracks, visible soil movement, and settling | Illustrative only | Visual sequence is manually triggered and never predicts rupture or transport geometry. |
| Char/ash chemistry, liquid CO₂, freezing/thawing, capillary water movement, calibrated poromechanics, shock/blast | Not modeled | These effects have no quantitative outputs. |
| Peat-fire suppression and post-treatment rebound | Not validated | Requires measured peat properties and held-out multiday observations. |

## Experimental validation needed

Compare temperature, oxygen, CO₂, moisture, pressure, emissions, fuel/char, and rebound histories against controlled experiments using measured geometry and properties. A comparison to the 30 cm moss-peat column in Huang and Rein (S6) would require reproducing its material, moisture basis, reactor boundaries, ignition, and kinetics; this app does not presently do so. Details of that study and all other sources are in `SOURCES.md`.
