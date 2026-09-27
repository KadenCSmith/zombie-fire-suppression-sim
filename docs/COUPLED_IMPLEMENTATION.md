# Coupled integration record

## Audit, 2026-09-27

Task specification: ASTRA-PROMPT.md and PROJECT-CONTEXT.md from the 0.10.0 handoff, explicitly adopted by the user. Working checkout main a673aaa, equal to origin/main. Only initial independent modification: Stage 2 Blender file, SHA-256 e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638. Preserve/exclude from all commits. Mac15,7 arm64, 12 physical cores, 38,654,705,664 bytes RAM. Baseline: 117 tests in 18 files, typecheck, lint, build PASS.

## Implementation order and acceptance set before integration results

1. A canonical 3D coupled scenario: phase-aware internal energy, finite four-species inventories, shared conservative face transfers, gas enthalpy, finite dry ice, water freezing/condensation, oxygen-limited reaction. Closed/open mass relative error <=1e-9; energy relative error <=1e-8; no unrecorded clipping or negative inventories. Analytical thermal/pressure refinement required.
2. Initialized effective stress, pressure loading, conservative pore-volume and pressure-work feedback. Elastic patch <=1e-6 relative; equilibrium <=1e-4 N; consolidation timestep/mesh refinement before a coupled-consolidation claim.
3. Spatial regularized failure, closure/contact and root/cap interactions only as supported by implementation and tests. No field-rupture claim without energy, mesh/path sensitivity and matched data. Preserve the prescribed-plane coupon.
4. Worker UI integration, shared-scenario comparison, bounded replay, numerical probes and reports. Measure CPU reference accuracy, runtime, process memory and actual viewport/cancel latency. Native/WASM/GPU adoption requires measured benefit and numerical equivalence.
5. Regression, packaging, source push/release, preserved previous installation, native checks and precise gaps.

Conservation requirements are software thresholds, not experimental validation. Material assumptions require explicit evidence status. No matched experimental dataset has been supplied. Unavailable evidence does not authorize invented fits.

## Method decisions (provisional until measurements)

Reuse the existing TypeScript finite-volume and brick-FEM knowledge, but isolate the new coupled state from legacy schemas. Typed Float64 storage is the reference. Finite-volume face conservation and implicit pressure avoid an acoustic timestep where Darcy applies. Small-strain FEM supports bounded elastic/deformation calculations; large separation requires its own supported method. Phase-field and cohesive spatial discretizations will be evaluated by energy/path checks, not rendered appearance. No CUDA dependency.

## Completed integrations and remaining work

- First tested/pushed integration: a3c3361, with phase-aware 3D FVM, initialized heterogeneous FEM, root bars, phase-field research, workers and native UI. Three-platform CI passed.
- Second integration: buoyancy/energy, frozen initial states, explicit reduced cap shell/contact/anchors/venting, separate sensitivity studies, intact-operator optimization, and strict failed-fracture reporting. 133 tests pass. Detailed failed and passed gates are in COUPLED_VALIDATION.md.
- Release delivered: source/application commits and all 17 assets are published and hash-verified; 0.11 is installed beside preserved 0.10; final three-platform CI passes. See BUILD_STATUS.md for commit IDs, archive/native checks and exact scope.
- Remaining installation action: the Mac was locked on two CUA attempts. After the user unlocks it, inspect the installed 0.11 window, calculate/replay the default scenario and record the observation. Do not call the already-passed development smoke an installed-window observation.

Do not overwrite the independent Blender edit or sources. Do not claim the failed fracture mesh/energy gates passed. All remaining model/data gaps are listed individually in COUPLED_VALIDATION.md.
