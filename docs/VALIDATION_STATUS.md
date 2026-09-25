# Verification and validation status

**Scientific status:** no experimental validation has been performed for this application. Passing local tests checks code behavior and selected conservation properties; it does not establish reliable field predictions, treatment efficacy, safety, rupture, or rebound forecasts.

Execution host identified with macOS System Information: MacBook Pro (Mac15,7), Apple M3 Pro, 36 GB RAM, macOS 27.0. This is the machine used for the checks below; measured frame rate and sustained throughput remain to be recorded.

## Automated verification

The repository defines:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test -- --reporter=verbose` passed on the host above after the smoldering/default changes: **2 files, 33 tests, 3.26 s** (Vitest 5.0.2). The 25 slow-solver tests cover unit conversion, composition/geometry and registry checks, layered properties, linked source and heater ledgers, zero-input/exhausted behavior, oxidation stoichiometry, bounded default-peat reaction heat with fuel/oxygen accounting, closed/open gas balances, discrete diffusion flux, analytical heat refinement, permeability response, restart, illustration independence, validity rollback, one-shot CO₂ conversion and high-pressure pause, the source pressure-area proxy, two seven-day runs, and the default 12×12×8 grid through its first hour. The 8 short-event tests cover duration/frame guards, uniform no-source state, CO₂/total-gas closure after conversion, closed and atmospheric side/top boundaries, permeability response, deterministic replay, finite recorded fields, and high-pressure pause.

Selected declared tolerances: short-run source energy residual <10⁻⁶ J; closed gas residual <10⁻⁹ mol; one-hour open gas residual <10⁻⁶ mol; active seven-day gas residual <10⁻⁴ mol; analytical heat-mode fine-grid RMS temperature error <0.2 K with improvement over a coarse mesh. These are tests of the reduced numerical implementation under controlled conditions, not peat-fire validation. The one-face diffusion check verifies the discrete flux formula; it is not an independent analytical diffusion-solution test. Playback speed and browser interaction still need separate checking.

| Check | Result | Evidence or limitation |
| --- | --- | --- |
| TypeScript type check | Passed | `npm run typecheck`: exit 0 on frozen source after the simplified UI and smolder diagnostics. |
| Static lint | Passed | `npm run lint`: exit 0 with oxlint on the same source. |
| Unit/numerical tests | Passed | `npm test -- --reporter=verbose`: 33/33, 2 files, 3.26 s on this host. |
| Production build | Passed | The final-source `npm run package:mac` completed its TypeScript/Vite build with Vite 7.3.6 and 381 modules in 1m49s. Packager then needed the locally cached official Electron ZIP because the GitHub checksum request could not resolve; `node scripts/package-mac.mjs` completed offline using that cache. Only nonfatal Lucide `use client` and >500 kB chunk-size warnings appeared in the build. |
| Native Mac archive | Signed, archive-verified, installed, and launched | The arm64 `Zombie Fire Suppression Sim.app.zip` is outside Git with its own Electron window, bundled `dist`, custom icon, loopback-only static server, and embedded Electron/Chromium/dependency notices. ZIP integrity passed. After extraction outside the Documents File Provider, `codesign --verify --deep --strict` exited 0 and reported “valid on disk” and “satisfies its Designated Requirement.” The installed `~/Applications` bundle also passed strict deep verification; `codesign -dv` showed an ad-hoc signature without hardened runtime. An earlier ad-hoc build with hardened runtime crashed at launch because of framework library validation, so that signing option was removed. `spctl --assess --type execute` still exited 1 with “internal error in Code Signing subsystem”; this local build is not Apple notarized. CUA launched the corrected temporary extraction as its own Electron window at random `127.0.0.1:57201`; the 3D scene had no black slice. The default 30 simulated s / real s pace ran at a displayed 30 sim s / wall s, and at about four simulated minutes the app showed 2242.4 W reaction power, 1.056 MJ cumulative reaction heat, and 12 reacting cells; pause worked. Event loaded. The installed app then opened with `open -a`; CUA saw its own native window and 3D scene on another random loopback port, `127.0.0.1:57315`. These are UI observations, not physical validation. `run-mac.command` targets the installed app, with no browser launch. |
| Browser smoke and visual inspection | Passed for observed controls; further checks remain | On the target Mac, the default 12×12×8 demonstration run reached 0d 01h 00m at selected 3600 simulated s per wall s and showed Ready/paused. The updated default hot peat displayed active modeled oxidation: 68.3 W last-step reaction heat, 0.100 kg fuel consumed, 1.506 MJ cumulative reaction heat, 12 reacting cells, 266.1 °C peak temperature, 3.66 kg dry ice left, and a 6.65 N slow pressure-area proxy. Reset settings and diameter/density controls worked. The default orbit slab was removed; the X section remained colored. From that one-hour state, full solid-to-gas conversion completed a separate 2.000 s event with 0.00 kg solid remaining, 354,927 Pa maximum shell pressure, 1.15×10⁴ N event pressure-area proxy, and illustrative damage index 1.000; the slow run paused at its validity limit and separately displayed a 5.90×10⁴ N out-of-range pressure-area proxy. Gas residual was not inspected in this retest. Replay pace, FPS, memory, and scenario/CSV/JSON import or export remain to confirm. |
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
