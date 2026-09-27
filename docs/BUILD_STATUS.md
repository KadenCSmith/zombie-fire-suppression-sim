# Build status and handoff

## Broad opening, irregular roots and surface fire (2026-09-26, version 0.9.0)

The latest scene replaces the horizontal bond markers with irregular soil pieces opening under a broader assumed load and weaker soil coefficients. The oak root network uses reproducible irregular directions, curves, depths and branches. A peat bed spans most of the section, with an unburnt margin and a narrow staged path to a small surface fire. Version 0.8 is retained alongside 0.5–0.7. [Model changes, display approximations and two additional peer-reviewed fire studies with ASCE references](WIDE_RUPTURE_FIRE.md).

Typecheck, lint, all **106 tests in 16 files**, production build and local native desktop smoke passed. The three added tests cover broad surface motion/fixed supports/replay, zero and maximum loads, and irregular display-cell area/finite geometry. Default broad-scenario outputs are about 0.282 m peak surface uplift, 1,872 failed bonds, and 43 of 49 surface nodes lifted over 0.025 m at a stored frame. They are numerical results under assumed coefficients, not validated rupture.

Native development inspection showed the irregular roots, extensive buried fire, separating ground and small surface flame. The smoke test exercises the late fire label, its removal on rewind, all five scene versions and preservation of the scientific 120 s state. Ground display motion now samples the field in the GPU, avoiding per-frame CPU interpolation for the large display mesh. Crack shapes/out-of-plane motion remain illustrative; fire growth is staged and not fed by CO₂ or coupled to combustion. Release verification follows when complete.

## Seated cap, bonded soil and bur oak (2026-09-26, version 0.8.0)

Added a concave cap that drops onto the ice, assumed rim restraint and one calculated flex mode, a deeper lower-density peat lens with unburnt surround, and a young bur oak with connected lateral and descending roots to approximately 2.7 m. Soil motion comes from a 2D unit-thickness spring lattice with irreversible tensile bond failure under an **assumed** lateral/upward pressure footprint. Surface uplift is shown at the calculated scale. The scientific workspace and older scene versions remain separate and available. [Model, source rationale and ASCE references](CAP_SOIL_PARTICLES.md).

Typecheck, lint, all **103 tests in 15 files**, production build and local native Electron smoke passed. New numerical checks cover zero load, cap seating, input bounds, finite results at 30 kPa, irreversible damage, fixed supports and reverse seeking. The default model gives 225 failed bonds, about 1.04 cm peak surface uplift and 10.92 cm peak cap deflection. These are assumed-scenario outputs, not experimental validation. Native development inspection confirmed the oak crown, deep connected roots, deeper peat, seated cap, damage markers and Roots & peat camera. The previous shallow peat cavity is visually filled. The independent Stage 2 Blender edit is preserved and excluded.

Cap support/strength, gas flow, root reinforcement, moisture-dependent fracture and field containment are not validated or fully solved. Increasing density alone does not establish fracture direction. The current root depth is illustrative, informed by bur-oak rooting literature. Release checks are recorded separately when complete.

### Version 0.8 release and installed-app checks

[The private 0.8 release](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.8.0) is published. All nine uploaded asset sizes and SHA-256 digests match the local files built from `f3e7f16eedd0bfc0efb41b5525fa0cb1702127c4`. Mac universal architecture, strict signatures, clean ZIP extraction and DMG integrity passed; Windows/Linux executable architectures and archives passed integrity checks. Verified copies are in `~/Downloads/Zombie Fire Sim/v0.8.0/`. Mac signing is ad-hoc, not notarized; Intel Mac and Windows/Linux ARM native execution remain untested separately.

All 103 tests, typecheck, lint, production builds and native desktop smoke passed on macOS, Windows and Ubuntu ([CI run](https://github.com/KadenCSmith/zombie-fire-suppression-sim/actions/runs/36295220330)). The installed 0.7 bundle was closed and preserved intact in `work/installed-backup-0.7/`; version 0.8 was extracted cleanly into `~/Applications` and passed strict signature verification. Native inspection showed the cap directly on the ice at 6 s in development and the deep-root/damaged-soil view in the installed app.


## Scene dynamics and version history (2026-09-26, version 0.7.0)

The top-right three-dot control in both workspaces replays 0.5 cooling, 0.6 rapid release and the latest 0.7 debris dynamics. Earlier behavior uses shared current assets/renderer fixes; it does not run archived binaries. The latest scene adds held-then-free-fall source placement, fixed-step particle gravity/drag, inelastic contacts, friction and rigid cage-bar contact. Assumed release speed is editable. Gas/thermal displays remain authored; no CFD, fracture, cage strength or experimental validation is claimed. The numerical scientific workspace is unchanged. [Equations, assumptions and ASCE sources](SCENE_DYNAMICS.md).

Typecheck, lint, 99 tests in 14 files, production build and local native Electron smoke passed. The smoke exercise switches all three versions, checks original solid/cage behavior and preserves the 120 s scientific state. Six added tests cover analytical fall/refinement, drag dissipation, contact energy, cage contact, settling/replay and version timing. The independent Stage 2 Blender edit remains excluded. Release and installed-app checks follow.

### Desktop packaging and native installation

[Version 0.7 is published](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.7.0) in the private repository. All nine uploaded asset sizes and SHA-256 digests match the tested local files.

All six archives were built from `ea65388215567f3605510c1f8ae90d2562a4514e`. Universal Mac architecture, strict deep signatures, clean ZIP extraction and DMG integrity passed. Windows/Linux archives passed executable-architecture and archive-integrity checks. Local verified copies are in `~/Downloads/Zombie Fire Sim/v0.7.0/`. ARM Windows/Linux and Intel Mac native execution remain untested separately. Mac signing is ad-hoc, not notarized.

All 99 tests, typecheck, lint, production builds and desktop smoke passed on macOS, Windows and Ubuntu ([CI run](https://github.com/KadenCSmith/zombie-fire-suppression-sim/actions/runs/36293438222)). Native development inspection showed the menu, original paused scene and settled debris in the latest scene. The installed 0.6 app was closed and preserved in `work/installed-backup-0.6/`; the checksum-verified 0.7 ZIP was extracted into `~/Applications`. The installed version reports 0.7.0, passes strict signature verification and opens Scene studio with all three versions in its top-right menu. These are software checks, not experimental physics validation.


## Timed release and cage illustration (2026-09-26, version 0.6.0)

Scene studio now lands the dry ice at 4 s, waits exactly five playback seconds, and hides the solid instantaneously at 9 s while gas tracers expand and 88 soil/rock fragments move outward and settle. The inverted cage defaults to 10 cm high and 95 cm wide, with an open underside, editable dimensions and a visibility switch. Height was the stated assumption for the unspecified 10 cm measurement. It is lowered after landing. All four views use the shared timeline. These effects are prescribed illustration; gas pressure, molecular dynamics, cage collisions/containment and new fracture physics are not calculated.

Two new tests verify the exact conversion boundary and reproducible fragment poses under reverse seeking. Typecheck, lint, 93 tests and production build passed during integration. Native development inspection confirmed disappearance, the expanding particle field, moving/settled fragments and the 10 cm cage. A particle-uniform update issue found during visual review was corrected by updating the actual shader material each rendered frame. The independently modified Stage 2 Blender file is preserved and excluded. Release verification is recorded below.



## Desktop release 0.6.0 verification (2026-09-26)

The universal Mac DMG/ZIP, Windows x64/ARM64 ZIPs and Linux x64/ARM64 archives are built from `f4547708de51c38af5380bda311ff3fe66320d8d`. The [private GitHub release](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.6.0) is published, with all nine uploaded asset sizes and SHA-256 digests verified against the local files. Local copies are in `~/Downloads/Zombie Fire Sim/v0.6.0/`. The manifest records source, architecture, size and SHA-256. Strict Mac signatures, clean ZIP extraction, DMG integrity, target executable architectures and archive integrity passed. The Mac app remains ad-hoc signed and not notarized; Windows/Linux packages are portable archives.

All 93 tests, typecheck, lint, production builds and native Electron smoke checks passed on macOS, Windows and Ubuntu runners ([CI run](https://github.com/KadenCSmith/zombie-fire-suppression-sim/actions/runs/36230145553)). Smoke coverage includes the five-second hold, the 9 s release and cage label, reverse seeking back to the solid, and preservation of the 120 s numerical workspace state. Windows/Linux runners use software graphics. ARM Windows/Linux and Intel Mac native execution remain untested separately.

Native M3 development inspection confirmed the default cage, solid disappearance, the rapid expanding cloud and upward tracer vent, and moved/settled fragments. The initial installation attempt was deferred while the Mac was locked. On the subsequent unlocked attempt, version 0.5 was closed and preserved intact in `work/installed-backup-0.5/`; the checksum-verified 0.6 ZIP was extracted cleanly into `~/Applications`. The installed bundle reports version 0.6.0 and passes strict deep signature verification. Direct `--studio` launch opened the installed app; native inspection showed playback at 10.2 s with the gas-release label and 10 cm cage. The user was interacting with the running app, so further control edits were left to them. The cage-dimension interaction check remains unperformed.


## Desktop release 0.5.0 (2026-09-26)

Built from `65b5c71beebb7af2951bd487a532d98ce46a504e`: universal Mac DMG/ZIP, Windows x64/ARM64 ZIPs and Linux x64/ARM64 tarballs. The manifest and checksum file accompany [the private GitHub release](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.5.0); local copies are in `~/Downloads/Zombie Fire Sim/v0.5.0/`. [Install and launch](INSTALL.md).

The Mac app is installed and tested on the user's M3 Pro, including direct workspace launch, a numerical step, current-inventory event mechanics and animated thermal layers. Archive and application integrity checks passed. Mac signing is ad-hoc, not notarized; Windows/Linux are portable archives. All 91 tests, typecheck, lint and production builds pass on all three OS runners. Later commits add desktop smoke checks and documentation without changing the packaged app. [Exact verification and platform limitations](VALIDATION_STATUS.md).

All fetched remote feature branches remain included in main. The independently modified Stage 2 Blender file is preserved and excluded. Model assumptions and experimental-validation gaps remain explicit; the interface and numerical improvements do not establish field-predictive physics.

## Physics consistency review (2026-09-26, version 0.5.0)

New scenarios use consistent molecular masses for the cellulose oxidation surrogate (`numericalRevision: 2`). Historical imports without this field retain their previous reaction yields. The explicit thermal timestep now includes surface/bottom heat exchange and dry-ice contact conductances. Actual pressure is checked again after species transport, with rollback if it leaves the configured range.

Short-event vertical mechanics now receives the current finite-volume solid and liquid inventories at the event time. Exact box-overlap integration conserves mass across nonaligned meshes and respects the already resolved peat geometry, remaining fuel, water and supplemental roots. This replaces independent geometry classification and initial-density loading. Mechanics remains one-way, with assumed stiffness and nearest-shell pressure loading.

The six added tests cover strong Robin cooling, reaction stoichiometry and checkpoint continuation, conservative mesh transfer, current inventories, and rejected invalid mass. Typecheck, lint and all **91 tests in 13 files** passed. These are numerical checks, not experimental validation. Packaging and native release checks are recorded separately below when completed.


## Research materials and Developer tools (2026-09-26, version 0.4.0)

Added three research menus with 12 composition profiles, a separate Developer tab with 94 editable numeric properties in the default scenario, and an applied-value/source export. New scenarios use the reviewed heat-storage/sublimation inputs and mass-fraction peat-density mixing; legacy material coefficients remain available for older schema-1 scenarios. Slow transport, radial gas, reduced vertical mechanics and FEM read the configured properties. Wet mechanics mass and its stable timestep were corrected; FEM now rejects a non-finite Poisson ratio. Scope and limitations are recorded in [Material evidence and ASCE citations](MATERIAL_EVIDENCE_ASCE.md) and [Research profiles](RESEARCH_PROFILES.md).

The supplied working document was reviewed without modifying or publishing it. Measured density, estimated composition/thermal properties, converted moisture, and unreported assumptions are distinguished. No source confirms all default properties together. Experimental validation, freezing, full multiphase CO₂/water behavior and calibrated fracture remain absent.

Version 0.4.0 is tested, pushed (`1655a24`), packaged, and installed. The native release applied a research profile and completed a 120 s numerical step. All 85 tests, typecheck, lint and production build pass; the archive and installed app pass strict signature checks. See [release verification](VALIDATION_STATUS.md).

The cleanup integration was tested and pushed as `31c95c6`. Both remote feature branches remain integrated; no redundant merge is needed. An independently modified local Stage 2 Blender file is preserved and excluded from this material/UI integration.

## Branch consolidation and cleanup (2026-09-25)

After fetching all remote branches, `main` contains both `feature/soil-mechanics-plumes` (`a83d59f`) and `performance/solver-and-rendering` (`0d7654e`); no remote branch remains unmerged. Historical branches are retained as references. Removed the unused Recharts dependency and 38 installed packages. The UI now uses the canonical scenario definitions used by tests and exported examples; removed duplicate wet/pathway definitions and the redundant pathway option. The slow finite-volume, radial gas, vertical mechanics and 3D FEM modules are distinct models, not duplicate code.

Typecheck, lint, 65 tests in ten files, and production build passed after cleanup. Production dependency audit reports no known vulnerabilities. Existing Three.js deprecation and Vite bundle-size warnings remain. Material evidence and Developer tools are the next integration.


## Scene studio integration — version 0.3 (2026-09-25)

The app now opens a four-view scene studio based on the Stage 2 Blender asset: soil cutaway, illustrative thermal layers, surface, and roots/peat. A shared 20-second sequence offers play/pause, timeline seeking, chapters, restart, speed, and loop controls. Camera changes are animated. The separate numerical workspace remains accessible through Open simulation and preserves its run when returning from the studio. The user expressly requested this app animation; the separate Blender Stage 3–6 review gates remain open.

The portable asset retains 187,582 triangles and combines 1,194 primitive meshes into 23 render batches. No source Blender file changed. Native development checks confirmed all four views, playback, label control, and a numerical step followed by a workspace round trip. Typecheck, lint, 65 tests, and production build pass. The standalone version 0.3 package also passes strict signature verification after extraction and native rendering/playback/workspace-switch checks. See [Scene studio](SCENE_STUDIO.md) and [verification details](VALIDATION_STATUS.md).

## FEM operator reuse and research review (2026-09-25)

Regular-brick FEM instances now share their identical elastic stiffness and strain operators and cache element degrees of freedom. The existing element submatrix method and matrix-free FV pressure stencil are retained. All 120,381 compared numeric values match the baseline exactly, including plastic unloading and checkpoint continuation. In the recorded local 4³/6³ cases, median solve times fell 17–18%; the one-brick case did not improve meaningfully. See [the implementation and measurements](SOLVER_OPTIMIZATION_REVIEW.md) and [benchmark artifact](../examples/continuumOptimizationBenchmark.json).

The separate [research review with ASCE citations](RESEARCH_REVIEW_ASCE.md) explains why seven peer-reviewed studies are needed and maps their evidence to actual variables and model limits. It does not substitute unmatched laboratory coefficients into the demonstration model. Both remote feature branches were already integrated into main; no redundant merge was required.

## Staged continuation (2026-09-25)

[Stage 1 geometry is approved](STAGED_REVIEW.md). [Stage 2 materials and UVs](MATERIAL_THERMAL_REVIEW.md) are ready for the user's approval, with distinct O/A/B/C strata and a separate illustrative thermal scene. The portable Blender candidate packs all six external texture maps. Geometry, original animation actions and sampled sphere motion are preserved. Five review previews were rendered and inspected. Stage 3 rig/deformation work is the next approval-gated step. The remaining final four-frame review is reserved for Stage 6.

The simulator still passes all 59 tests, typecheck, lint and build. Both remote feature branches are already ancestors of main. At that stage, solver optimization and the source report were pending; they are now delivered above. Stage 2 itself introduced no physical-model or solver changes.

Performance follow-up (2026-09-25): the fine-grid pressure calculation uses direct-neighbor matrix application, symmetric Gauss-Seidel preconditioning, and reusable buffers; the slice view avoids rebuilding its instance transforms on each new field snapshot. Checkpoint restoration refreshes the cached heat conductances from saved material fields. The 61 × 61 × 30 benchmark step improved from 849 ms to 569–593 ms in three individual runs; a later busy-host run took 698 ms. All 59 tests, typecheck, lint, and the production build passed on final source. Matched baseline/optimized snapshot fields agreed within 7.71 × 10⁻⁸ normalized difference in the three comparison cases. The Mac was locked during native-window inspection, so native interaction and frame rate are still open; see `VALIDATION_STATUS.md` for the measured scope and limits.

Detailed-grid follow-up: the Setup screen offers ≤10 cm volumes for the default domain (61 × 61 × 30), a material overlay, and sensor readouts of each volume's resolved properties. The fine-grid numerical test and runtime measurement are in `VALIDATION_STATUS.md`; the fast default remains available for longer exploratory runs. This preset refines the finite-volume heat/gas/fire solver, not the separate 4³ FEM mechanics benchmark.

Remaining supported-physics pass: separate gas-species conservation ledgers, checkpoint corruption detection, subgrid source-deposition checks, a wet-soil freezing validity guard, and six reproducible integrated comparison cases have been added after the fire milestone. They do not constitute two-way soil/fire coupling or experimental validation. Exact open physics and affected outputs are listed in `VALIDATION_STATUS.md`.

New branch mechanics-only mode: `src/mechanics/continuum.ts` solves 3D brick-element displacement, stress, strain, and plastic history for a prescribed top load, then renders 1× displacement in the existing scene. `npm run typecheck`, `npm run lint`, 46/46 tests, and `npm run build` passed sequentially on 2026-09-25. A live local Electron development window displayed the calculated result and force readouts. This is an unvalidated demonstration material, and the existing short-event link mechanics remains available separately.

Fire extension: the existing 3D finite-volume solver now exposes reaction activity and distinct mineral/root inventories, and accepts recorded prescribed oxygen boundary changes. A benchmark-only species exchange makes inhibition/recovery reproducible with explicit O₂/background mole amounts. Typecheck, lint, 52/52 tests, and production build passed. This remains a single-step oxidation surrogate, not a matched peat/char kinetic model, and its 4³/6³ fire response is not spatially converged.

Status reviewed against source on 2026-09-25. “Implemented” means code exists for the stated reduced or visual behavior; it does not imply experimental validation. Current native-window and automated-check results are recorded separately in `VALIDATION_STATUS.md`.

| Requested area | Current status | Next concrete task or limit |
| --- | --- | --- |
| Local 3D app under a 6.096 m × 6.096 m grass surface | Rendered in browser and native app | CUA opened the corrected temporary app bundle in its own Electron window; the 3D scene showed no black slice. An obsolete README screenshot showing that removed artifact was deleted. |
| 3 m editable depth, orbit/top/two vertical views, movable slice, coordinates and scale | Implemented in source | The default orbit shows geometry without a full-height field sheet; top and X/Y views retain quantitative colored slices. Pressure X section was viewed in browser; confirm labels and clipping at different window sizes. |
| Buried source with linked mass/diameter/density, cover depth and evolving display | Implemented in source | Setup edits diameter and density, deriving internal mass within its 200 kg validation limit; the redundant mass entry was removed. Measure source-scale contact/cavity behavior before physical interpretation. |
| Finite source/heater energy accounting with `q'''`, schedule, power, and cumulative energy | Implemented reduced model | Zero-heater sublimation, exhaustion, scheduled energy, and ledger behavior have automated checks; source contact and phase properties still need measurements. |
| Editable soil composition, bulk properties, peat shapes and multiple regions, root fuel, and multiple initial hot regions | Implemented reduced controls and scenario schema | Defaults and mixing coefficients remain demonstration assumptions. |
| Soil presets and reset-to-preset controls | Implemented with assumed values | UI and solver share the presets in `src/sim/parameters.ts`; their values are demonstration assumptions, not measured material sets. |
| Simplified controls and reset settings | Implemented and browser-checked | Four top-level tabs are Setup, Simulation, Results, and Event. Setup shows one selected edit category at a time; Reset settings restores default scenario/UI, while physical Reset restarts the selected run. |
| Editable physical soil-layer thickness and separate layer material properties | Implemented reduced controls and schema | Layer multipliers/offsets change density, porosity, initial moisture, intrinsic permeability, and conductivity in the solver; coefficients are demonstration assumptions. |
| Spatially editable initial moisture distribution | Partial | Base soil, layer offsets, and peat-region overrides exist; add a general cell-wise spatial field editor or import. |
| Independently editable initial and boundary O₂/CO₂ conditions | Partial | Atmosphere composition initializes the gas field and sets open-boundary composition; a separate interior initial gas composition is not exposed. |
| Parameter registry with provenance, basis, range, default, dependencies, and status | Implemented in source | `src/sim/parameters.ts` has 113 entries, including layers, derived source/pressure quantities, and four short-event controls; audit its ranges against controls and refresh `PARAMETER_REFERENCE.md` when fields change. |
| Genuine 3D heat, gas, reaction, and moisture fields | Implemented reduced model | Local oxidation heat is added to the energy balance, with measured-by-solver fuel consumption, heat, power, and reacting-cell readouts. The default demonstration hot peat showed active oxidation at one hour, then cooled in an automated longer run; calibrate against measurements later. |
| Pressure-driven slow porous flow with validity pause | Implemented reduced model | Confirm pressure/velocity limits and numerical convergence across scenarios. No shock or rupture physics. |
| Dry-ice phase behavior | Partial | Constant near-195 K sublimation approximation and initial/pressure guards only; no liquid CO₂ or full equation of state. |
| One-click solid-CO₂ conversion intervention | Implemented and exercised in browser | Transfers remaining solid mass to gas at unchanged solver time, books external phase/sensible energy, and applies a pressure validity check. After one simulated hour in the updated default scenario, the solid inventory reached zero, the 2 s event completed, and the slow run paused at its validity limit. No release-rate, blast, or soil-motion prediction. |
| Derived near-source pressure-load number | Implemented algebraic proxy | `max(0, source-weighted pore pressure − atmosphere pressure) × π supportRadius²`; fixed imaginary area, status flagged outside validity. It is not a real soil force or rupture prediction. |
| Separate short-time gas/soil-response event | Implemented reduced gas plus vertical mechanics | The radial event conserves aggregate CO₂/other gas; its pressure now drives a separate gravity/inertia/elastic/yield calculation with live displacement frames. Shell damage remains illustrative. It does not resolve shocks or fracture surfaces; see `FAST_EVENT_MODEL.md` and `MECHANICS_MODEL.md`. |
| Quantitative soil failure and displacement | First numerical milestone, unvalidated | Vertical displacement and yielded element flags are calculated on 4³–8³ grids with assumed material properties and supports. Horizontal deformation and calibrated field failure are not modeled. |
| Char/ash, CO, intermediate pyrolysis | Not modeled | Replace complete-oxidation surrogate with measured multi-step chemistry when data exist. |
| Open top, selectable side gas conditions, bottom thermal exchange | Implemented reduced boundaries | Side heat flux and deep gas conditions are not generally editable. |
| Visible soil motion and crack/settle event | Calculated event elements plus separate manual illustration | Event elements move with worker displacement and show yielded regions; the manual Simulation animation and crack lines remain illustrative. |
| Smoke and steam | Visible, with source-based rates | Oxidation fuel loss supplies assumed particulate smoke; modeled water loss and estimated atmospheric condensation supply visible steam. Plume geometry is visual approximation; CO₂ remains invisible. |
| Native development window | Implemented and observed | `npm run dev:mac` runs Vite and Electron without opening Safari or Chrome; source changes reload the app. A local-server restart can temporarily blank the window, so the dev Electron shell retries empty renders. |
| Hypothetical altered pathway transport | Implemented as an assumed scenario | Preserve an original run beside an edited run if formal post-event comparison is needed. Do not present it as calculated damage. |
| 1-, 3-, and 7-day run, physical step controls, selectable solver pace, separate playback pace | Partial browser verification | At selected 3600 pace the updated default 12×12×8 browser run reached one simulated hour, Ready/paused. Automated seven-day runs pass. Other pace/replay choices, sustained throughput, frame rate, and memory remain to check. |
| Virtual probe, histories, field overlays, flow arrows, diagnostics | Implemented in source | Inspect field mapping, scale bars, units, and plot readability in browser. |
| Identical-seed A/B heater-off comparison | Partial | Both panels now use one view preset and fixed color scale; their cameras are locked while comparing. Interactive linked orbit and strict same-time pausing are not implemented. |
| Scenario JSON validation, CSV, PNG, recorded-state JSON | Implemented in source | Browser-smoke confirmed PNG export; scenario import and the other export paths remain to check. UI imports scenarios, but does not resume from the exported recording. |
| Five reusable JSON demonstration scenarios | Implemented in `examples/` | Regenerated and checked against frozen `SCENARIOS` after the changed demonstration peat/hot-region defaults. Browser imports remain to check. |
| Standalone Mac app outside Git | Version 0.3 signed archive rebuilt and native-verified | The generated `Zombie Fire Suppression Sim.app.zip` sits beside the repository. Strict signature checks pass before and after extraction. Native review confirmed embedded textures, animated views, and workspace switching without console errors. Three.js emits a dependency deprecation warning. This is a local ad-hoc signature, not Apple notarization. |
| Unit/conservation/restart/numerical tests | Implemented and passed locally | Current full suite passes 65/65 in ten files, including slow-solver, species/fire, short-event, mechanics, FEM, scene timeline and portable-asset checks. The original slow/event gates and new gravity, pressure, yield, settling, momentum, replay, plume, and resolution checks are described in `VALIDATION_STATUS.md`. |
| Performance target near 30 fps and Apple-silicon M3 verification | Medium mechanics benchmark measured; UI FPS open | One 6³ mechanics run took 4.89 ms in a test process on the M3 Pro with 2.14 MiB process RSS growth; sustained native-window frame rate remains unmeasured. |
| Private GitHub repository | Created at [KadenCSmith/zombie-fire-suppression-sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim) | Main contains the earlier feature branches; version 0.3 integrates the scene studio, FEM operator reuse, and research documentation. |

## Next agent task

The immediate physics dependencies are measured peat/root material and source-contact properties, a dry-gas effective-stress/storage formulation with a conservative interface to the FEM mesh, and a matched peat-column benchmark. Then add independently checked liquid/ice and multistep char chemistry only within measured validity ranges. Check the remaining pace/replay settings, imports and exports, and sustained performance separately. Do not interpret the six coarse-grid comparisons as field suppression predictions.
