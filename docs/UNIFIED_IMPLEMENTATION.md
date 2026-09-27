# Unified physics lab: implementation record

## Scope and provenance

Started from simulator `80401c4` and the separate `dry-ice-peat-study` repository. The simulator is the canonical application. Original Blender work remains reference illustration; accepted calculation exports provide a separate state-driven Blender path. Existing installed releases and the independently edited Stage2 scene remain untouched.

## Milestone 1: consistent physical input across meshes (reference)

- Adds 2,560 cells (16×16×10), exactly 10× the former preview, and 20,480 cells (32×32×20), exactly 10× the former research mesh. Retains all three old grids for reference.
- Uses one fixed 32×32×20 physical voxel atlas and exact axis-aligned overlap to transfer extensive fuel, mineral, water, gas, pore volume and thermal energy. Specific heat is mass-weighted; coefficient volume averages are documented effective mixtures, not a homogenization theorem.
- A material atlas is an input discretization, not proof of spatial convergence. It cannot resolve features finer than its 0.25×0.25×0.16 m voxels. Finer solve cells do not add new material data.
- Prepared smoldering examples explicitly remove initial water in a fixed dry halo around the hot-region bounding box: 1 m horizontally, 0.8 m vertically. This is an assumed prepared specimen, not a simulated drying process or a measured field moisture profile. It prevents unresolved instantaneous equilibration of 270°C solids with wet neighboring material on coarse meshes. All meshes receive the same prepared inventory. No pressure/phase validity gate is widened. The cold source-only case is the physics laboratory default (the 0.14 application opens its separate fire sequence). The smoldering option is named a prepared dry specimen and exports its removed initial water mass. Averaging heterogeneous phases may still produce mesh-dependent local temperature/pressure transients; invariant global inventories do not establish solution convergence.
- Turning oxidation off selects a cold source-only case, removing the prepared hot region and dry halo. Heating energy is otherwise fully ledgered.
- Terrain choices change actual initialized materials/root content: organic lens with assumed bonded roots; horizontal peat/mineral layering; a denser, less permeable basal continuum. These are illustrative scenarios, not validated literature specimens or discrete rock mechanics.

## Accuracy claims

Conservation, mechanical residuals and comparison with an independent implementation are numerical verification. They do not establish experimental accuracy. No matched holdout dataset is available. Fracture, resolved excavation, liquid-water infiltration, root pullout and field suppression efficacy remain unresolved. No single overall accuracy percentage is supplied. Uncertainty remains unassessed unless a bounded ensemble is actually calculated.

## Validation protocol

Keep mass and energy totals constant across fidelity presets to 1e-12 relative in initialization tests. Require existing ledger gates and force residual ≤1e-4 N. Compare any optimized operator with the retained reference on identical inputs and tolerances; report setup and solve timings separately. Keep failed experiments visible. Independent review is recorded before accepted source publication.

## Milestone 2: integrated natural and scientific presentation

The natural cutaway follows the requested layered-soil/oak reference: 570 fixed-seed irregular aggregate instances, a detailed oak and roots, and peat shading derived from accepted material fractions. Anatomy and aggregate meshes are visual context; they do not fabricate additional mechanical contacts or inventories. Scientific fields retain cellwise values. Natural/scientific views share accepted node displacements, physical time and linked cameras. The original authored Blender animation is an explicitly distinct comparison with different geometry and normalized playback.

The original Blender study is preserved with commit/file provenance. The new importer maps accepted grid topology, units, source mass and checkpoint times into an editable derivative; scientific and natural vertices agree exactly. A five-checkpoint 2,560-cell example, rendered previews and labeled review clip accompany six passing Python contract tests.

A completed browser reference run reached 10 s at 2,560 cells. Replay, previous-result restore, cancellation, terrain changes and synchronized views were inspected. Rendering uploads exposed faces only, reuses geometry buffers and sleeps when idle; this does not reduce solver element count. Full tests: 148 in 25 files, plus six Python tests; typecheck, lint and production build pass. Native packaging is verified separately.

## Milestone 3: accuracy-focused defaults

Version 0.12 freezes the reference operator with 0.5/0.25 s maximum steps on the 2,560/20,480 grids. Version 0.13 selects the independently checked sparse undamaged-elastic operator and 0.125 s maximum steps on both new grids. The original three presets and reference operator remain available. No conservation, force, phase-validity, strain or fracture gate changes. Finer temporal resolution means more solves; matched-operator speedup is not a claim that 0.13 defaults finish faster than 0.12.

Independent short cold transport studies support the step reduction on both meshes. Source-loss differences against a 0.0625 s comparator fall from 0.961% to 0.141% at 2,560 cells, and from 0.363% to 0.122% at 20,480 cells. These percentages use sublimated mass as their denominator and are numerical differences, not field uncertainty. Spatial local outputs remain nonmonotonic; the mesh is not certified converged. Raw reports preserve source hashes and inputs.

The source model couples finite radius/contact, sensible cooling, latent heat and composition-dependent Stefan film transfer with equilibrium vapor pressure and unchanged thermodynamic bounds. Empirical contact/diffusion coefficients remain assumptions. The Blender example separately records nine numerical-source hashes and holds five checkpoints from a 2 s cold calculation for a 2.5 s review clip. No fabricated continuous motion or source provenance is implied.

## Milestone 4: fire-first sequence

User steering makes peat-fire ignition and the full treatment narrative the opening workspace. Version 0.14 adds an interactive 90 s story, both gradual finite-source and illustrative rapid-conversion modes, a cold-start numerical ignition protocol and full rendered films. `FIRE_SEQUENCE.md` distinguishes accepted field data, physical time, staged geometry and unresolved underground-front/fracture/infiltration physics. The numerical lab remains available, with 10× meshes and the prior verified operators.

A conservative source-insertion API adds finite solid mass, internal energy and pressure-volume placement work to an existing thermal history. It preserves conservation baselines and permits atomic rollback, including source location/support, when placement leaves validity bounds. Five intervention tests cover accounting, continued sublimation, prior-clock retention, checkpoint identity, active/future igniter rejection and local-pore-capacity failure. Video serving now supports validated single-byte ranges and streaming; two range tests cover seeks, suffix requests and malformed/unsatisfiable input.


## Milestone 5: scene direction and intervention timing

The complete scene now follows a visible surface-to-peat connection. A contiguous illustrated smoldering region grows to 70% involvement before the tracked excavator and auger enter. Thirty percent remains visibly unburned. Grass and irregular aggregates retain the requested natural cutaway. The staged borehole has clearance for the plate; the plate lowers below ground in an inverted bowl shape above the finite source, then bends continuously through flat into an upward arch. This is prescribed geometry, not a computed failure or pressure threshold.

A shared monotonic clock maps 90 story seconds to 36 playback seconds: 55–61 story seconds run at 1:1, while the other stages run 2.8×. Both modes, films, seeks and interactive playback use the same clock. Manual speed is a multiplier. The normal-speed event remains an authored rapid-conversion illustration and does not establish a real explosion duration.

Films retain their immutable bundled calculation; custom numerical experiments affect only their own interactive fields and exports. A delayed baseline download cannot overwrite a newly accepted run, and terminated workers cannot replace current results. Native film seeking uses bounded byte-range streaming rather than reading entire movie files into the main process.


## 0.15 visual revision — 2026-09-27

- Restored the reference dark teal/copper layout and broad natural cutaway. Added instanced fine grass, realistic tracked/IK/hydraulic excavation equipment and a 0.48 m presentation bore.
- Replaced radial peat progression with a deterministic connected weighted arrival field; 70% of its 4,141 samples gates treatment. Shared JSON drives interactive and Blender appearance. This is not combustion physics.
- Added rapid-only prescribed piece separation, dust/debris and residual gaps. Scientific fields stay on accepted pre-treatment data for rapid mode; no new pressure or fracture prediction is implied.
- Retained the cold-fire numerical history, 2,560/20,480-cell laboratory choices, sparse/reference agreement and source/energy acceptance gates. Numerical cache generation remains a47721ffb7d17ebde0e42a12261094843e618aba.
- Added connectedness, sampled-area, source/auger/plate clearance and burst persistence tests. Independent realism review uses the user-requested threshold of 7/10, with at most three review cycles.
