# Prior code and asset reuse audit

Read-only inventory performed September 27, 2026. This report supports a **controlled, non-explosive, vented research simulator with pressure relief**. It does not authorize reuse of impulsive gas-event models to optimize an explosive, pressure-trapping device or deliberately forceful release.

## Inventory coverage and current state

The inspected checkout is:

`/Users/kadensmith/.codex/.chatgpt-projects/g-p-6ab74cc545008191a50ed1528f722d46/simulation-integration`

Repository: <https://github.com/KadenCSmith/zombie-fire-suppression-sim>

The current audited commit was `56c0315` on `main`. The only working-tree modification was the independently edited Blender file described below. This inventory did not change that repository, run its tests again, fetch remote branches, or merge code. Test descriptions below identify existing checks; they are not claims of newly executed tests.

Coverage includes current tracked source, scripts, tests and evidence documents; project-local ignored source references; and the 0.10.0 handoff under:

`/Users/kadensmith/Documents/Codex/2026-09-26/continue-zombie-fire-simulation-physics-and/outputs/Astra-Handoff-0.10.0/project`

The two related task output folders under `Documents/Codex/2026-09-26` were inspected for this project. This was **not a search of all the user's Mac, cloud storage, GitHub repositories or prior chats**. The separate original Blender asset repository remains an access/audit gap, as documented below. Recheck the actual working tree, current remote refs and newer work before implementation.

All paths in the tables below are relative to the inspected checkout.

## Selective reuse matrix

| Candidate and current integration status | Concrete useful parts | Validity limits and duplication risks | Existing checks and recommended disposition |
|---|---|---|---|
| `src/mechanics/continuum.ts`, `src/mechanics/comparison.ts`. Separate mechanics workspace; its plasticity is not in the coupled solver. | Drucker–Prager local return mapping, retained plastic history, trial/committed state handling, shared brick operators, load/unload comparison and stress/strain probes. | Homogeneous small-strain benchmark; gravity reference is excluded from plastic yield state. Unsupported cone apex/tension, no compressive cap, tensile separation, measured peat/root law or finite deformation. Direct transplantation would give inconsistent initialized effective stress and dissipation. | `tests/mechanics/continuum.test.ts`, `comparison.test.ts`, `refinement.test.ts`; `scripts/benchmark-continuum.mts`, `benchmark-models.mjs`. Reuse selected constitutive and verification components only after incorporating total effective stress/history, compatible energy accounting and independently specified acceptance cases. |
| `src/mechanics/tensileFracture.ts`. Separate tensile laboratory, not spatial coupled fracture. | Analytic bilinear cohesive interface, exact piecewise work integration, irreversible partial unloading, strict measurement CSV comparison, fitting/holdout notes. | One prescribed central weak plane in a series bar; no spatial crack selection, compression/closing contact, rate dependence or root fibers. Modulus, fracture energy and interface stiffness are assumptions. Passing subdivision checks does not establish spatial crack convergence. | `tests/mechanics/tensileFracture.test.ts`, `scripts/benchmark-tensile.mjs`, `docs/PEAT_TENSILE_FAILURE.md`. Retain as an independent fracture-energy and unloading oracle; reuse import/provenance workflow. Do not substitute it for a terrain fracture solver. |
| `src/mechanics/massTransfer.ts`. Used by legacy flow-to-reduced-mechanics path, not current same-grid coupled engine. | Exact axis-aligned overlap integration of piecewise-constant inventories across nonaligned FV/mechanics grids. | Scalar mass transfer only; no work-conjugate pressure/displacement mapping, stress transfer, moving mesh, cut cells or arbitrary geometry. Coupled grids currently coincide, so introducing it now would add unnecessary mapping. | `tests/mechanics/massTransfer.test.ts`: nonaligned/non-cubic mass, sharp interface, current inventories and invalid inputs. Reuse if separate meshes are justified; extend tests for every new conserved inventory and two-way mechanical work. |
| `src/sim/solver.ts`, `src/sim/scenario.ts`, `src/sim/materials.ts`. Grid/material initialization already reused by `src/coupled/model.ts`; legacy transport execution remains separate. | Scenario validation, heterogeneous initialization, material conversions, sparse pressure stencil and symmetric Gauss–Seidel preconditioner as a measured optimization candidate. | Coupled thermodynamics and inventories supersede legacy execution for the new workspace. Double-running sources, phase changes or reaction would duplicate mass/energy. Legacy support volumes and validity windows differ. Current coupled constructor intentionally transfers initialized material state and owns subsequent phases. | `tests/sim/solver.test.ts`, `physicsRevision.test.ts`, `integrated.test.ts`, `materials.test.ts`, `fire.test.ts`, `detail.test.ts`. Reuse specific tested utilities or compare preconditioners under identical operators; retain newer coupled ledgers, rollback and validity gates. |
| `src/sim/materialEvidence.ts`, `src/sim/researchProfiles.ts`, `src/sim/parameters.ts`; `src/ui/ResearchProfiles.tsx`. Existing research profiles not fully exposed as matched coupled-study calibration. | Source IDs, property-level provenance, moisture basis conversion, dry peat–sand thermal profiles, observed-versus-inferred labels, parameter controls. | Reported values often describe unrelated specimens, dry conditions or published model inputs. Midpoints are not measurements. Profile selection can neutralize layer modifiers; this must remain explicit. Do not combine unrelated properties into a supposedly measured soil. | `tests/sim/materials.test.ts` and scenario/material tests; `docs/RESEARCH_PROFILES.md`, `MATERIAL_EVIDENCE_ASCE.md`, `WORKBENCH_PARAMETER_EVIDENCE.md`. Reuse provenance structure; verify every source and property against the new peer-reviewed-data requirement. |
| `src/ui/soilParticleModel.ts`, `src/ui/WideSoilScene.tsx`. Separate illustrative scene, not coupled predictive mechanics. | Fixed-seed visual meshing, replay, batched mesh deformation using field textures, renderer performance patterns. | 2D spring lattice, assumed bonds and prescribed pressure envelope; authored Voronoi gaps do not represent physical fracture topology or lost mass. Cap mode, damage thresholds and pressure history are uncalibrated. | `tests/soilParticleModel.test.ts`, `tests/wideSoil.test.ts`; `docs/CAP_SOIL_PARTICLES.md`, `WIDE_RUPTURE_FIRE.md`. Reuse graphics and deterministic replay techniques only. Derive visible gaps and deformation from accepted new solver state, with unresolved geometry labeled. |
| `src/ui/studyDynamics.ts`, `src/ui/studyModel.ts`, `src/ui/StudyScene.tsx`. Legacy scene dynamics and presentation. | Gravity-drop integration, simple contact verification, deterministic replay tables, camera and sequence scaffolding. | Debris launch velocity is prescribed, not generated by gas work. Sphere proxies and fixed cage contacts do not resolve device–soil interaction. Earlier release animation contains authored conversion and transport. | `tests/studyDynamics.test.ts`, `studyModel.test.ts`; `docs/SCENE_DYNAMICS.md`. Reuse benign drop/replay checks after matching geometry and physical time. Do not import assumed ejection velocities as predictions. |
| `src/ui/OakTree.tsx`. Geometry already reused by `src/ui/CoupledScene.tsx` through `oakStructure`. | Irregular reproducible roots and tree context. | Visual geometry is not a measured root system or mechanical reinforcement law. Current coupled mechanical root bars are a separate assumed representation. | Relevant study/scene tests and `docs/WIDE_RUPTURE_FIRE.md`. Already integrated for rendering; reconcile visible roots with any later calibrated mechanical roots rather than counting geometry as new physics. |
| `src/plumes/model.ts`. Legacy accepted-inventory-to-visual-source path. | Separation of renderer from simulation, time-stamped source derivation and bounded visual source counts. | Assumed particulate yield, approximate condensation and rise; evaporation inferred from legacy saturation. Not water infiltration, atmospheric CFD or calibrated optical visibility. CO₂ is colorless. | Legacy integration/scene checks; `docs/MECHANICS_MODEL.md`. Reuse software pattern only. Compute any new water/steam source from the new phase ledger and label visualization assumptions. |
| `src/fastEvent/model.ts`, `src/fastEvent/types.ts`, `src/mechanics/model.ts`. Separate reduced gas-event and vertical mechanics modes. | Conservation ledgers, deterministic replay, rollback and mapping regression patterns. | Radial isothermal aggregate and vertical-only one-way mechanics lack the coupled thermodynamic/mechanical energy closure needed by the new research model. Assumed event pressure/damage and impulsive release are not suitable predictive inputs. | `tests/fastEvent/fastEvent.test.ts`, `tests/mechanics/mechanics.test.ts`; `docs/FAST_EVENT_MODEL.md`, `MECHANICS_MODEL.md`. Preserve historical modes. Do not import their transient or damage model to optimize a pressure-trapping/impulsive device. Reuse neutral bookkeeping tests only when applicable. |
| `scripts/blender_static_review.py`, `scripts/blender_material_stage2.py`, `scripts/verify_blender_stage2.py`, `scripts/export_study_asset.py`; `docs/review/static-model/`, `docs/review/material-stage2/`, `public/models/peat-study.glb`. Existing static/illustrative asset workflow; no solver-to-Blender animation pipeline. | Evaluated-mesh measurements, nonoverwriting candidate creation, packed textures, UV checks, geometry/action preservation hashes, coordinate conversion and glTF export. | Blender thermal colors and animation are illustrative. Exported GLB has no baked animation. Root/trunk are overlapping separate meshes. Some historical scripts assume exact names/topology and need explicit adaptation for a derivative. | `tests/studyAsset.test.ts`; geometry, material and reopen JSON reports; `docs/STAGED_REVIEW.md`, `MATERIAL_THERMAL_REVIEW.md`. Build a new derivative scene and snapshot-driven animation/export pipeline. Preserve the historical original and pending historical review state. |
| `scripts/benchmarks/engine-reference.ts`, `scripts/benchmarks/poromechanics-reference.ts`, `src/coupled/kernels/brick.c`, `src/coupled/kernels/benchmark.cpp`. Retained benchmark references/native experiment, not an alternate shipped backend. | Numerical-equivalence comparisons, true FE operator kernel, separate kernel/process transfer timing, correctness baselines. | Older reference files are intentional baselines, not unmerged feature improvements. A faster isolated native kernel does not prove faster application execution. No working general GPU or WASM coupled backend is established by these files. | `scripts/compare-coupled-optimization.mjs`, `scripts/benchmark-native.mjs`, corresponding `examples/*Benchmark.json`. Evaluate measured end-to-end benefit; retain precision, all fields, ledgers and rejected-trial behavior. |

## What was already present, and what was not found

- The 0.10.0 handoff contains **no source or script path absent from current repository**. Comparing all files in its `src/` and `scripts/` found 43 source files and 13 scripts unchanged. Three source files (`src/App.tsx`, `src/ui/ModelSelector.tsx`, `src/sim/solver.ts`) and one script (`scripts/package-desktop.mjs`) changed since that snapshot. Copying the old source tree over current work would regress changes.
- The locally cached `origin/feature/soil-mechanics-plumes` and `origin/performance/solver-and-rendering` refs have **zero unique commits ahead of current main**, respectively 45 and 37 behind. They are already represented in the audited history. This was not a fresh network check; refresh refs before a later merge decision.
- Project-local `work/continuum-before.ts` and `work/coupled-before/{linear,mechanics,engine}.ts` are preserved earlier optimization references. They are not additional independently validated physics implementations. `work/write_material_docs.py` and `work/coupled-validation/build-delivery.py` are documentation/delivery helpers.
- No existing implementation of poured-water free-surface flow, liquid-water injection/infiltration, fracture hydraulic aperture flow or coupled root rupture/pullout was found in the inspected source. These require new model work and appropriate data, rather than merely enabling hidden code.
- No additional independent local solver was found among inspected project-local ignored source files. This does not establish that no relevant code exists elsewhere.

## Protected Blender source and provenance

Preserve this independent edit exactly:

`docs/review/material-stage2/Materials_Thermal_Stage_2.blend`

SHA-256: `e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638`

It remains deliberately uncommitted and was the only dirty file at audit time. Do not replace it with the Git version, overwrite it during export, or silently include it in an unrelated application commit. Work from an explicitly identified copy for any new derivative.

Historical evaluated geometry in `docs/review/static-model/measurements.json` and `docs/STAGED_REVIEW.md`:

| Quantity | Measured historical asset |
|---|---|
| Soil block | 8.000 × 8.000 m footprint, base 3.200 m below nominal ground |
| Dry-ice sphere | 0.500 m **diameter**, on all axes |
| Borehole | 0.750 m diameter, floor 2.440 m below nominal ground |
| Centered radial clearance | 0.125 m |
| Root middle rings | Approximately 0.200 m diameter |

These are geometry measurements, not validation of the physical scenario. The 0.500 m asset is not equivalent to the current coupled default 4 kg source; a future scenario must explicitly reconcile physical mass, density, size, occupancy and heat transfer without scaling only the display.

`public/models/peat-study.manifest.json` names an older Blender source hash, `2272d17ee6d27edfebcd8a6775d266963d12f53cdf71aa1cf6876c10ea844ae5`, and a separately hashed GLB. It does **not** assert that the exported GLB contains the protected newer Blender edit. A new derivative/export must record its actual source hash and coordinate/unit mapping.

Historical Stage 1 geometry was approved. Stage 2 material/UV approval remained pending in the old workflow; a new derivative must not retroactively mark that historical approval complete. Read the current user instruction and next-agent prompt for the newly authorized workflow.

## External project and unavailable sources

`docs/STAGED_REVIEW.md` links the original asset project:

- Repository: <https://github.com/KadenCSmith/dry-ice-peat-study>
- Original release: <https://github.com/KadenCSmith/dry-ice-peat-study/releases/tag/v1.0.0>

Its remote authoring scripts, release contents, branches and history were **not fetched or independently audited in this inventory**. The next agent should inspect it through authorized access, identify relevant original construction/animation code, compare hashes/history with the current copies, and record access failures explicitly. Do not claim “all prior code integrated” until that gap and any user-identified locations have been checked.

The handoff says externally synced `sources/` files are read-only. No `sources/` directory is present in the inspected checkout or handoff. Scientific citations do not mean original papers, supplementary tables or raw validation datasets are locally available. No matched raw validation dataset was found in this audit.

## Licensing and scientific evidence

- The repository has no selected license for its original code. Preserve this choice; do not add a license as part of code reuse without user authorization.
- Preserve `THIRD_PARTY_NOTICES.md` and authoritative dependency notices. The local continuum implementation is independent TypeScript; MOOSE was consulted as a method reference, not embedded code.
- `docs/review/material-stage2/asset_sources.json` records Poly Haven [Bark Brown 01](https://polyhaven.com/a/bark_brown_01) and [Forrest Ground 03](https://polyhaven.com/a/forrest_ground_03) as CC0 assets. Keep provenance even when attribution is not legally required.
- Existing evidence documents contain peer-reviewed papers, books, government reports, published model assumptions and secondary reporting. The new requirement that physical data come from peer-reviewed studies needs a property-by-property source audit. Method citations do not validate assumed material coefficients, mixed-site profiles or the whole device scenario.
- Record source, table/figure/page, material/specimen, moisture basis, temperature/pressure range, loading rate, uncertainty, and any conversion for every adopted datum. Missing measurements remain missing; do not invent values or convert an AI review score into experimental validation.

## Required reuse decision record

For each candidate, write one disposition: **already integrated**, **reuse with changes**, **verification reference**, **visual only**, **superseded**, or **inaccessible**. Link the implementation, source evidence and checks supporting that decision. Integrate only useful compatible components, benchmark them against the current coupled baseline, and preserve every applicable conservation and validity gate. Do not bulk-merge older solvers or infer physical validity merely from the presence of functioning code.
