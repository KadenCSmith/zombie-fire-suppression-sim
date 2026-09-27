# Coupled continuum 0.11 validation and performance

Numerical verification is distinct from laboratory validation. **No matched experimental validation has passed.** Source: new coupled integration after `a3c3361`, with final file hashes in `examples/coupledValidation.json`; earlier snapshots remain in Git. Host: Apple M3 Pro, 12 CPU cores, 36 GiB unified RAM, arm64 Node 26.8.2. Float64 CPU reference; no CUDA dependency.

## Acceptance and results

Requirements were recorded before integration results in `COUPLED_IMPLEMENTATION.md`. Conservation gates: relative mass <=10⁻⁹, thermal/phase energy <=10⁻⁸; mechanical equilibrium <=10⁻⁴ N. Values below are raw absolute errors, not adjusted to disguise failure. Physics stopped outside its kinematic/flow/phase envelope.

| Check | Measured result | Status / meaning |
|---|---|---|
| Existing regression plus added phase, transport, mechanics, cap and coupling tests | **133 tests / 22 files**, typecheck, lint, build pass | Software/numerical verification |
| Four-species, water, dry ice, reaction and boundary mass | Default 10 s runs: about 10⁻¹⁰ kg mass residual; individual species raw mol residuals exported | Pass, far below relative gate; water inventory includes all phases |
| Thermal, phase, reaction, boundary enthalpy, pressure and gas-gravity work | Default 10 s runs: absolute thermal residual <=9.54×10⁻⁶ J | Pass; these are actual extensive energy balances |
| Heterogeneous initialized gravity | FE geostatic residual exported per preset | Gravity stress is inside new constitutive state; earlier benchmark kept separate |
| Elastic/pressure analytic patch, 1³/2³/4³ | Strain/energy match independent confined solution, force residual <=10⁻⁴ N | Pass |
| Coupled pressure work vs stored soil/cap energy | Default 10 s: absolute mismatch <=1.92×10⁻⁹ J | Pass for the bounded elastic scenario; does not validate rupture |
| Consolidation, linearized dry-gas Biot mode | Combined refinement errors 0.509%, 0.191%, 0.0713% of initial 100 Pa amplitude | Pass and decreasing; zero gas gravity isolates the analytic mode |
| Separate consolidation mesh / timestep sequences | 4/8/16 vertical cells at fixed dt and 1/0.5/0.25 s at fixed mesh exported | Do not infer order from combined refinement alone |
| Insulated 1D heat cosine mode, fixed 50 s timestep, 40,000 s duration | 4/8/16 vertical-cell max errors: 0.01733 / 0.004424 / 0.000956 K | Pass predefined 0.03 K gate and decreasing; impervious dry fixture |
| Water freezing plateau and energy inversion | 180–700 K inversion cases; subzero wet initialization and warming; latent plateau | Pass caloric model checks; no frost heave/cryosuction claim |
| Cap plate limit | Flat-cap limit recovers q = p a⁴/(64D) within 0.1%; area quadrature and nodal/volume virtual work checked | Pass; shallow curved shell/support validation still needs measurements |
| Cap contact/support | Compressive bedding releases at lift; anchors carry tension; elastic energy/work checked | Pass reduced normal-contact model; no general shell friction/buckling |
| Same grid, 20 s, dt 2/1/0.5 s | Exported pressure, temperature, remaining source and work differences | First-order staggered model; compare gauge pressure and depletion, not just large absolute baselines |
| Boundary distance | Same 1 m horizontal cells, domain 8→12 m, same physical source/lens, roots off | Source-cell pressure change ~0.041 Pa; peak displacement change ~0.17% in the initial study; final exact values exported |
| Spatial fracture mesh energy | 8³ vs 12³, ℓ=0.25 m, prescribed Gaussian pressure verification fixture | **FAIL:** fracture-energy difference ~5.74% exceeds the preselected 5% gate |
| Fracture load-increment energy sensitivity | 1000/500/250 Pa increments: work mismatch about 1.53 mJ / 0.386 mJ / 0.0965 mJ | Decreasing; final ~0.010% of cumulative work, not experimental agreement |
| Fracture propagation under increasing pressure | Partial diffuse damage increases spatially; an 8³ specimen reached d≈0.384 by 9.5 kPa, then failed continuation | **Unresolved:** no accepted complete rupture path |
| Fracture enabled in default heterogeneous coupled site | Energy gate stops at ~4.99 J unaccounted increment | **FAIL / correctly rejected.** Do not use the optional fracture setting as a validated site rupture model. Last accepted state is retained. |

The prescribed-pressure fracture fixture tests the spatial discretization; it is **not** substituted for solved terrain gas pressure. No fracture plane is prescribed. Damage/energy sensitivity is reported even where gates fail. A larger density or a pressure footprint is never evidence of horizontal fracture prediction.

## Mac costs and fidelity

Three measured repetitions of the same **10 simulated seconds**, including coupled mechanics/cap stepping but excluding rendering and worker transfer. Setup is separate. These are one-host timings, not portable guarantees.

| Preset | Grid | Median solve | Throughput | Typical setup |
|---|---:|---:|---:|---:|
| Preview | 8 × 8 × 4 = 256 cells | 0.437 s | 22.9 simulated s/wall s | ~30 ms |
| Engineering | 12 × 12 × 6 = 864 cells | 3.240 s | 3.09 simulated s/wall s | ~0.11 s |
| Research | 16 × 16 × 8 = 2048 cells | 16.90 s | 0.592 simulated s/wall s | ~0.30 s |

The largest observed process RSS in these sequential Node studies was about 327 MB. This includes the harness and accumulated runtime state; it is not total desktop/GPU memory. History is bounded to at most 61 regular frames plus a terminal failure frame per model. Numerical steps are independent of snapshot/playback cadence.

The native Electron 120 s Preview exercise measured **117–120 viewport fps**, cancel completion within **102 ms** using a 100 ms polling interval, and summed application working sets around **724 MB**. Shared pages may be counted twice; compressed memory and GPU/unified-memory allocations are not fully attributed. The default observations are comfortably below the 16 GiB design budget, but this is not a full Instruments allocation audit. Research has measured solver RSS, not a native 24 GiB stress certification. System memory pressure was low during checks.

Preset errors are **case-dependent**. Preview's 1 m cells under-resolve the default fracture length, Engineering's 0.667 m cells also exceed ℓ/2, and Research's 0.5 m cells meet that minimum. Meeting spacing alone did not establish fracture convergence. Lens/hot-region initialization currently uses cell classification; different meshes represent different voxelized initial masses/heat, and the default reaction totals differ accordingly. There is no single certified field-error percentage for these presets. Use reported analytical/refinement cases and perform matched-scenario studies before interpreting predictions.

## Algorithm and acceleration decisions

- Retained 3D FVM with shared conservative faces and implicit nonlinear storage; no dense pressure matrix.
- Retained small-strain eight-node brick FEM with reusable local matrices, matrix-free multiplication and float64 PCG. Cap/roots are explicit low-order mechanical elements with energy accounting.
- Profiling identified repeated gather/scatter and spectral work in intact cells. Cached local gathers and algebraically equivalent intact constitutive evaluation reduced end-to-end 10 s solve/setup times about 30–38%. Maximum compared displacement difference was <1.5×10⁻¹⁶ m, pressure <10⁻¹⁰ Pa. Committed reference code and scripts reproduce the comparison.
- Apple clang C++ applies the **same actual FEM operator**, with exact compared outputs, faster for batches of larger operators. The benchmark reports kernel time and process/input/output time separately. A subprocess per CG multiplication adds substantial latency, and no end-to-end native worker with better measured total cost is implemented; it is not presented as a finished backend.
- The installed Electron runtime exposes an Apple `metal-3` WebGPU adapter, timestamp queries and shader-f16, but no float64 shader feature. The float64 reference remains authoritative. No float32/GPU speed or accuracy claim is made. Local clang supports wasm32 compilation, but the wasm linker is unavailable; WASM/SIMD execution remains unmeasured.
- MPM and bonded DEM could address large separation, but neither would supply the missing peat strength, fracture energy, rate law or root/contact data. They would require new particle-transfer, contact, energy and mesh/objectivity verification. The bounded FEM/regularized continuum was adopted for its verified small-strain regime; it does not stand in for a large-deformation solver.

## Exact remaining scientific gaps

1. Matched peat calibration/holdout data: density, preparation, fiber orientation, moisture/suction, stiffness, full force–opening curve/Gc, loading rate, creep and temperature effects. Published Krimpen peak strengths alone do not fit E/Gc/ℓ or validate this terrain.
2. Spatial fracture mesh gate and pressure-controlled instability; dynamic fracture/large deformation and sharp separation/frictional contact. The default site's fracture energy gate fails and is visible.
3. Multistep char/pyrolysis/oxidation kinetics, measured heat release and independent spread/oxygen/temperature observations. Current oxidation is an uncalibrated cellulose surrogate.
4. Mobile liquid, water pressure, capillary/suction effects, non-equilibrium freezing, ice segregation/heave; nonideal/liquid CO₂ and diffusion-limited sublimation film.
5. Resolved borehole/near-source gas conduit and excavation geometry. Cap seals a fractional porous surface; the drawn borehole does not silently become an open pipe.
6. Cap grade, actual geometry/support stiffness, plastic buckling and failure, friction/thermal mass; root tensile rupture, pullout and species-specific calibration. The implemented shell/contact and bonded root bars are reduced assumptions.
7. Native Intel Mac and Windows/Linux ARM device execution, notarization/Windows signing, complete unified-memory accounting, and a verified GPU/native acceleration backend.

These gaps remain explicit in the UI, exports, release notes and model documentation. Working software and numerical convergence are not experimental validation.

## Platform verification scope

The new desktop harness computes 120 s on macOS and Linux. Windows CI uses software graphics and a 10 s calculation for the same worker, A/B, replay, export, invalidation and cancellation checks. Its attempted 120 s check reached 56 s after about 165 wall seconds and hit the harness deadline; this is not reported as a completed Windows long run or a physical convergence failure. A separate Linux fracture rollback test needed 5.31 s, so its test-only wall-clock allowance is now 30 s; numerical acceptance tolerances are unchanged. The harness also checks that selected-model throughput agrees with exported run metadata.
