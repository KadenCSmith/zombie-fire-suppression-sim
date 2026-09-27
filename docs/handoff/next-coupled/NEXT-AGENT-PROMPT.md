# Continue the coupled dry ice soil simulator

Act as the lead computational-physics and simulation-software engineer. Continue the actual Zombie Fire Suppression Sim project through working, tested integrations and two successive Mac releases. Audit the current physical limitations first, implement the supported improvements, commit and push the tested code, and then produce a second version with measured improvements in accuracy per runtime and memory. A plan, cosmetic animation, or an isolated benchmark is not completion.

## Research scope and intended scene

Build a physically grounded research simulation and Blender visualization of a drilled borehole in rooted, layered soil with a rockier subsurface; placement of a nominal 0.5 m dry-ice sphere; controlled heating through a metal cover; evolving CO2, temperature and soil response; and a subsequent water-pouring and infiltration stage. The visualization must consume accepted solver states. Let the equations determine whether deformation, damage, openings and preferential water flow actually occur. Do not force lateral propagation or create fractures merely to match the storyboard.

The supported thermal source is controlled electric heating, provisionally selected pending the user's reply, or a measured non-explosive laboratory heat-input history. Model a vented or pressure-relieved research configuration. Exclude energetic compounds, explosive ignition, detonations, an impulsive all-at-once conversion, and design or optimization of a pressure-trapping or self-locking explosive device. The user's proposed cap inversion/locking behavior is not an accepted physical result or a requirement to manufacture that outcome. Do not design that mechanism. A nonconfining heated cover can have measured geometry, thermal response and bounded structural deformation.

Do not assume that all solid converts to gas on command. Compute finite inventory, heat transfer, phase evolution and elapsed time within verified thermodynamic and flow regimes. If the requested geometry or inputs leave those regimes, stop the physical prediction, retain the last accepted state, and report the missing model or evidence. Do not widen a guard simply to finish the scene.

Historical measured Blender geometry is a 0.500 m sphere diameter, 0.750 m hole diameter, floor 2.440 m below ground, and 8 x 8 x 3.2 m soil domain. These are scene measurements, not validated experiment dimensions. Treat them as a historical starting scene, with the 0.5 m sphere diameter still an explicit provisional interpretation of the user’s size description. The coupled 0.11 default instead uses a 4 kg subgrid source, a different source placement and an illustrative borehole. Reconcile these representations explicitly; do not assume that changing the rendered diameter changes the physical inventory. Provide hole-depth and hole-diameter sliders with numeric entry and metre units. Each change must rebuild or conservatively update the physical geometry, check sphere clearance and domain/mesh validity, and recompute stresses, pressure loads and reaction forces from the coupled solution. Define the allowed ranges from geometry, model validity and evidence; do not choose a range to maximize damage. Do not use a cosmetic scale change or an arbitrary force multiplier. Changing geometry during a run must pause and reinitialize consistently or follow a verified conservative remapping procedure. Show which inputs require a new run and preserve the previous result for comparison.

The user has no measurements or additional datasets. Select explicitly named literature-based soil scenarios, keeping site, peat type, layering, water table and moisture assumptions visible. Search accessible primary research and repositories for suitable data as described below. Ask only for a consequential preference that literature cannot establish; absence of user measurements does not prevent numerical verification or a clearly labeled literature-based case.

The user proposes water input of 100 gallons per minute after the dry-ice stage. Provisionally interpret this as US gallons: 0.00630901964 m³/s, approximately 6.31 L/s. Treat it as an unverified scenario boundary condition, not a measured pump curve or an operating recommendation. Make the flow rate, start criterion, duration and inlet water temperature editable, with a consistent enthalpy reference. The user explicitly requires variable water temperature: expose a slider and numeric entry in °C, guard it within the supported phase/material range, and recompute inlet energy and freezing/evaporation response. Do not invent a duration, temperature or total volume as experimentally supported; document the chosen scenario and its sensitivity. Trigger this stage after the non-explosive heating/sublimation sequence, with explicit remaining solid and thermal state. A chosen inflow must account for available inlet area, free-surface exchange, ponding, overflow, gas displacement and backpressure; use a supported pump/boundary model or report that the prescribed flow is not physically enforceable under the computed conditions. Ledger all admitted, stored and discharged water and energy. Do not imply detonation of dry ice or instantaneous conversion.

## Start from the real project

Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim

Local checkout:
`/Users/kadensmith/.codex/.chatgpt-projects/g-p-6ab74cc545008191a50ed1528f722d46/simulation-integration`

Read once, then use as needed:
- `AGENTS.md`
- `docs/BUILD_STATUS.md`, `docs/VALIDATION_STATUS.md`
- `docs/COUPLED_IMPLEMENTATION.md`, `docs/COUPLED_MODEL.md`, `docs/COUPLED_VALIDATION.md`
- this handoff's `CURRENT-CONTEXT.md`, `CODE-REUSE-AUDIT.md`, `INDEPENDENT-REVIEW-PROMPT.md` and annotated bibliography.

Observed main at this handoff is `56c0315e973919a1da17befe7c02fc4ba5388c9e`; inspect actual HEAD, status, remote branches and open changes before editing. The handoff itself may subsequently be committed. Never reset newer work to this hash.

Latest application release: https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.11.0

Application binaries: `05d9c292476677068e9040f5843e70b8ec33ec32`. Supplied source snapshot and successful application CI: `74c0ef55680a5decc0b75d956a6636575f44898f`. The difference is the smoke harness. CI evidence: https://github.com/KadenCSmith/zombie-fire-suppression-sim/actions/runs/36305414929

Portable source: https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/download/v0.11.0/Zombie-Fire-Sim-0.11.0-Source.zip

Local release and source copies:
`/Users/kadensmith/Documents/Codex/2026-09-26/read-astra-prompt-md-and-project-4/outputs/Zombie-Fire-Sim-0.11.0/`

Use the local Git checkout when accessible. If unavailable, use the supplied source ZIP and its SOURCE-MANIFEST, or clone the private repository with authorized access. Do not extract an old snapshot over a newer checkout.

The only known independent edit is `docs/review/material-stage2/Materials_Thermal_Stage_2.blend`, SHA-256 `e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638`. Preserve it exactly and exclude it from application commits. Create derivative Blender files under new versioned names, recording input/output hashes. Any external synced `sources/` are read-only. No such directory or matched raw validation dataset was found in the audited checkout. Preserve the original-code licensing choice and third-party notices.

Installed application: `~/Applications/Zombie Fire Suppression Sim 0.11.app`; preserved 0.10: `~/Applications/Zombie Fire Suppression Sim.app`. The new bundle passed signature/architecture checks. Its final installed-window inspection remained pending because the Mac was locked. Native development-window checks passed. Finish the installed-window observation when the Mac is available and describe precisely which application was inspected.

## Audit the limitations before adding physics

Map each requested phenomenon to code, assumptions, accessible evidence, regime limits, numerical verification, experimental agreement and missing work. At minimum cover:

- Resolved borehole/excavation geometry and soil removal; finite source placement/contact; consistency between Blender and solver coordinates, source size and conserved inventories.
- CO2/air/water thermodynamics, nonideal behavior where consequential, saturation and phase boundaries, finite-rate source heat transfer, sublimation into a mixture, source geometry and internal thermal gradients. A gas EOS alone does not model solid CO2.
- Thermal capacity and conductivity of the cover, thermal contact and losses, source and soil heat transfer, with external heating entering the energy ledger exactly once.
- Coupled gas transport and porous/free-fluid interfaces within a justified non-explosive regime; explicit open boundaries and venting. Distinguish Darcy validity from inertial or other unsupported flow. A gas tracer animation supplies no pressure solution.
- Layered and rockier soil structure, initial effective stress, material-dependent elastic/plastic response, anisotropy and rate/temperature/moisture effects supported by data. Do not treat a modulus multiplier as a measured rock/soil model.
- Spatial damage/fracture verification, pressure work, irreversibility, closure/contact and permeability feedback. Current failed gates must remain failures until corrected and rerun. No completed terrain crack path is presently validated.
- Root stiffness, geometry, soil-root load transfer and, only where evidence supports it, pullout or rupture. Decorative roots are not mechanical reinforcement data.
- Water input, free-surface/pore exchange, liquid and gas mass balance, saturation, capillarity, gas displacement, gravity and heat/phase interaction. Richards flow is a reduction requiring justified gas/phase assumptions; do not append it to significant gas-pressure gradients or phase change without a coupled formulation. Crack flow needs a verified aperture/connectivity relation, not an arbitrary damage multiplier.
- If smoldering remains active, preserve finite oxygen/fuel/energy accounting and distinguish the existing surrogate kinetics from measured peat chemistry. Do not allow a burning initial condition to supply undocumented energy to an otherwise cold test.

Current hard facts: 133 tests in 22 files passed; relative mass and thermal-energy gates were 1e-9 and 1e-8; mechanical equilibrium gate 1e-4 N. Spatial fracture mesh-energy difference is about 5.74%, exceeding a 5% gate. The default coupled-fracture attempt fails an energy-increment check at about 4.99 J. Fracture is off by default. These are unresolved numerical issues in addition to missing experimental data. Do not present them as mere documentation limitations.

## Reuse earlier work selectively

Inspect every candidate in CODE-REUSE-AUDIT.md and the original asset project https://github.com/KadenCSmith/dry-ice-peat-study/releases/tag/v1.0.0 when accessible. Search relevant project history, branches and project-local source snapshots for additional useful work. Do not search unrelated personal files.

Classify each candidate as already integrated, reusable with changes, verification only, visual only, superseded, or inaccessible. Record its path/commit, license, existing tests, changes required and disposition. Integrate every useful compatible component that survives this review; explain concrete reasons for deferring or rejecting the rest. Avoid duplicate inventory, force, phase or energy updates.

The 0.10 handoff has no source/script file missing from current main. Cached `feature/soil-mechanics-plumes` and `performance/solver-and-rendering` branches have no unique commits; refresh refs before asserting that remains true. Do not bulk-merge these older versions. Promising reusable pieces include tested plastic return mapping after fixing its initial-stress limitation, cohesive-energy test oracles, conservative scalar transfer between grids when actually needed, material provenance/import checks, measured Blender geometry/export tooling and renderer batching. Prescribed pressure, staged rupture, assumed launch velocities and decorative crack pieces must remain illustrative. There is no existing hidden liquid-water infiltration solver in the inspected source.

## Implementation sequence and two releases

Give a short dependency-ordered sequence, then implement. Maintain a resumable decision and validation record across context limits.

First create the physically coherent reference version. Establish common geometry/state and evidence first; add the resolved open-hole/source/thermal-cover model, supported soil/root response and conservative gas/water coupling in dependencies dictated by tests. Keep changes integrated in the working application, with failure rollback, exportable diagnostics and deterministic replay. Develop the Blender export path in parallel where independent. The reference release may be 0.12.0 if unused; choose the next unused version after checking the repository.

For each coherent integration: implement source, run its meaningful numerical checks, obtain independent agent review as specified below, repair accepted findings within the review limit, and commit/push the tested milestone. Do not defer all source publication until a final movie. Add a clear changelog and preserve previous simulations and source states.

After the reference version passes its supported gates, commit and push it before starting the optimization version. Then profile the same cases and implement a second version, provisionally 0.13.0 if unused. Compare optimized output against the retained reference, including errors, end-to-end runtime, setup, transfer, render cost and memory. Require measured benefit without weakening numerical or physical acceptance. Keep the reference version usable. If a proposed optimization does not help, report and revert that change rather than claiming a speedup.

## Independent reviews with a maximum of three rounds

Every coherent physics integration and the optimization integration must be examined by an AI agent other than its implementer. Use the separate review prompt supplied here. Allow at most THREE formal review/revision/retest rounds per integration. Ordinary unit tests and debugging are not additional formal review rounds. Do not restart the count by renaming an unchanged integration. Prefer a fresh reviewer where available and give reviewers the actual diff, source hashes, raw results and papers, not just the author's claims.

Each review must give separate 1-10 scores for physical accuracy and visual realism, a justified confidence/evidence level, passed/failed objective gates, the most important findings with reproducible evidence, and a disposition. If no relevant render exists yet, record visual realism as pending rather than inventing a score; an accepted-state render and numeric visual score are required before that integration’s visual review is complete. These are engineering judgments, not percentages of truth. Visual realism cannot raise the physical-accuracy score. Missing matched material validation must be explicit; no high score may imply field validation. A critical conservation, unstable coupling or fabricated-evidence defect blocks a predictive label regardless of score.

After round three, freeze the review record. If unresolved, keep the capability disabled/research-only or retain the last supported implementation, explain the exact deficit and continue independent supported work. Do not relax tolerances, tune arbitrary parameters or stage motion to obtain an attractive score. If separate agents are unavailable, record that independent review is pending; self-review is not a substitute.

## Peer-reviewed evidence and the Word bibliography

Use peer-reviewed primary research for adopted empirical material properties and physical model claims. Search current primary sources and inspect their actual contents. Keep a search log with databases/services, queries, access dates and coverage limits. Use accessible scholarly indexes such as Crossref, OpenAlex and Semantic Scholar as discovery aids, then primary publisher papers and author/institutional repositories for the evidence. Include relevant fire-science, peat-hydrology, geotechnical and thermophysical journals; search dataset supplements and persistent repositories. Do not claim every database or paywalled article was searched. Reviews can guide discovery; trace empirical values to the underlying measurements when available.

When several studies report peat porosity, density, conductivity, moisture thresholds or burn rates, tabulate their material and test conditions before selecting inputs. Keep wet/dry mass moisture basis, bulk/particle density, total/effective/macroporosity, hydraulic conductivity K [m/s] versus intrinsic permeability k [m²], and horizontal/downward spread versus mass consumption distinct. Combine values only when specimens and conditions are comparable, with a documented method and uncertainty. Otherwise retain separate scenarios or bounded ranges and explain the chosen case. A citation does not make an assumed parameter measured, and a numerical paper’s calibrated value is not an independent validation observation. Numerical software documentation may support implementation details; definitions and user-specified geometry are not claimed as measured journal data. Identify existing constants, handbook values and scenario assumptions that do not meet the new evidence requirement. Replace them with applicable peer-reviewed evidence where possible; otherwise report the gap and withhold a physically validated claim. Never invent a value, DOI, uncertainty interval or matched specimen.

For each parameter/equation, record units and basis, value/range, material/preparation/density/moisture/temperature/loading conditions, source location (page/table/figure), extraction/conversion/fitting, uncertainty, applicable range and code locations. A paper cited by another paper is not automatically inspected primary data. Abstract-only access cannot support unseen tables or numerical fitting. Separate calibration specimens from independent validation/holdout observations. Report quantitative errors against data and its uncertainty. Propagate consequential parameter uncertainty into principal thermal, water and mechanical outputs using sensitivity analysis or an appropriately bounded ensemble. Separate numerical error, material variability, measurement uncertainty and model-form limitations; do not imply probabilistic confidence from arbitrary input ranges.

Maintain an editable Word file `Annotated-Physics-Bibliography.docx`, a machine-readable evidence register and a concise plain-text bibliography in the repository. Begin with the supplied annotated seed and expand it to cover EVERY source actually used by the final simulator, its validation and any reused model. For every link include a full citation/DOI, a summary of relevant findings, what was used in the code, experimental conditions, limitations/uncertainty, calibration-versus-validation role, access depth and inspected pages. Separate adopted, verification-only, contextual and proposed sources. Include an explicit unsupported-property list. Render the DOCX and inspect every page before delivery.

Seed sources and proposal limits are in the supplied bibliography; important entry points include:
- Biot consolidation: https://doi.org/10.1063/1.1712886
- Miehe et al. phase-field framework: https://doi.org/10.1002/nme.2861
- Peat laboratory interpretation: https://doi.org/10.1680/jgere.17.00006
- Solid CO2 calorimetry: https://doi.org/10.1063/1.1749929
- Water vapor pressure review: https://doi.org/10.1256/qj.04.94
- Peat smoldering kinetics: https://doi.org/10.1016/j.combustflame.2013.12.013
- Gas-phase assumptions behind Richards flow: https://doi.org/10.2136/vzj2004.0738
Verify these against the supplied annotations and accessible full text before adopting or extending them. Complete the evidence audit for additional water, roots, phase and transport sources.

## Requested controls and result display

Add a three-dot menu at the top of the app with three selectable terrain test cases. The user confirmed these three cases: rooted peat, layered peat/mineral soil, and soil with a rocky subsurface. Each case must select documented physical geometry and material inputs as well as its visual presentation. Preserve edits deliberately, indicate the active case, and invalidate/recompute stale results when the case changes. Include accessible labels, keyboard operation and a clear reset to that case. Their soil parameters must come from applicable literature scenarios; do not fabricate a measured site profile or hide an assumed root/rock arrangement.

After each simulation, show uncertainty as a percentage for the principal reported outputs, with the output name, interval/bounds, evidence basis and assessment status. Compute these estimates from the documented material/input uncertainty and sensitivity or ensemble results; do not invent a single overall “accuracy percentage.” Identify a probabilistic interval and confidence level only when the input distributions and statistical method support it. Otherwise show a bounded sensitivity range in percent and label it accordingly. Define the denominator, show asymmetric bounds when appropriate, and show an absolute range with “percentage not meaningful” near zero or for categorical outcomes. Keep numerical error and experimental-validation gaps visible separately. If the uncertainty calculation is unfinished, failed or unavailable, display that status instead of zero uncertainty. Keep the assessment bounded in memory and responsive/cancellable on the M3 Pro, report its runtime, and export the assumptions and results with the run.

## Blender and application delivery

Use Blender as the rendering/asset pipeline, with versioned scripts, an editable derivative `.blend`, packed or properly attributed assets, solver-derived caches, a low-cost review video and a final movie. The sequence is hole/strata/root inspection, finite source placement, controlled thermal evolution with vented flow and calculated soil response, then water pouring and infiltration. Treat the water-input schedule as an explicit boundary condition. Do not guarantee a fracture stage if the calculation does not produce an accepted one.

Record coordinate transforms, metres, gravity direction, timestamps, physical-to-display scale and source hash in the export manifest. Baked deformation, source size, phases and water fields must correspond to the same accepted states used in application plots. Source-drop motion may use a checked rigid-body calculation or an explicitly identified placement animation; it cannot imply a solved fracture force. CO2 itself is invisible; any visible mist requires a supported water/ice/aerosol interpretation or an illustrative label. Beauty-render interpolation must not alter physical histories. Show simulated time, units, legends and all amplification.

Protect the existing Stage2 Blender edit. The historical Blender approval record is not evidence that a new derivative was approved. This new task authorizes new derivative scenes and the requested AI review workflow; it does not authorize overwriting the old artifact or inventing experimental validation. Treat the maximum of three review rounds as applying to each integration, including the final Blender integration, and do not inherit an unrelated old render-attempt counter as a new completed review.

## Mac efficiency and acceptance

Target the actual Apple M3 Pro: 12 CPU cores, 18 GPU cores and 36 GiB unified memory; verify the execution host. Preserve a float64 CPU reference. Profile before changing architecture; benchmark typed-array workers against useful C++/Rust/WASM/SIMD or Metal/WebGPU candidates with measured transfer/precision costs. Do not assume a language, GPU or Blender renderer is fastest. Avoid CUDA dependencies. Use reusable sparse/matrix-free structures, bounded history and justified adaptive resolution/timesteps. Measure numerical stepping separately from rendering and playback.

Existing 10 s median solve times are 0.437 s / 3.240 s / 16.90 s for 256 / 864 / 2048 cells, excluding rendering/setup; they are small-case results, not predictions for the new geometry. Native Preview observed about 117-120 fps, cancellation within 102 ms at 100 ms polling, and approximately 724 MB summed process working sets. GPU/shared/compressed memory was not fully attributed. The native operator experiment is not a finished backend, and WebGPU exposed no float64 shader feature on the measured runtime.

Retain initial design targets of at least 30 viewport fps, control/cancel response within 200 ms, and no more than 16 GiB total default / 24 GiB opt-in research memory. Report measurement limitations and revise fidelity/resolution transparently if needed. Never claim these budgets passed using solver RSS alone. Document errors and costs for each fidelity preset on a matched physical case, including initial inventory consistency across meshes.

Use analytic/manufactured tests, species/mass/energy/force/contact ledgers, separate mesh/timestep/domain studies, conservation under transfer, and matched experimental comparisons where data exist. Set acceptance before observing final results. Add specific tests for every new phase or liquid flow boundary and interactions between temperature, saturation, gas and mechanics. No rendered plausibility substitutes for convergence.

## Final deliverables and working rules

Deliver tested and pushed source for both successive versions; a concise comparison of physical scope, accuracy/runtime/memory; full independent review records and round counts; evidence register and inspected Word bibliography; source-driven Blender scene/cache/movie; and checksummed Mac downloads with reproducible build/run instructions. Windows/Linux downloads are NOT required for these new versions. Prefer native Apple Silicon packaging for this M3 Pro; provide a universal Mac archive only if there is a concrete reason and verify its architectures. `MAC_ARCH=arm64 npm run package:mac` is the current packaging entry point; inspect the script before relying on it. Do not run `package:all` just to reproduce the old release matrix.

Preserve installed 0.10 and 0.11 before adding new versioned bundles. Verify actual installed native launch, calculation, replay and cancellation; if the Mac is locked, state exactly which observation remains pending and continue other work. Publish new GitHub releases only with accurate source manifests, checksums and capability/gap labels. Do not replace or silently retag old release assets.

Keep all generated files in clearly named project folders. Finder Red means created by Codex; Orange means modified pre-existing folders; preserve existing unrelated tags and let Red take precedence for Codex-created folders. Do not tag inside signed bundles. Follow current sandbox permissions, use authorized escalation when needed, and never bypass permission failures.

Use reasonable engineering judgment and continue through coherent implementations. Ask only for consequential missing information or access; do not repeatedly request authorization already given. Keep the user informed of findings and exact unresolved work. Completion means usable, reviewed implementations and truthful deliverables, not a claim that all possible soil physics or this conceptual apparatus has been experimentally validated.
