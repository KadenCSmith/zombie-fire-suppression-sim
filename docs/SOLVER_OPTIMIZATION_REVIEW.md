# Solver optimization review: local blocks and sparse stencils

Reviewed and measured September 25, 2026 (America/Los_Angeles). Baseline: `371a68af76a3c83f94173b0a4a36fddf464a481b`. The regular-brick operator sharing and degree-of-freedom cache described below are implemented and compared against that preserved baseline. “FEV” is interpreted here as finite-volume transport (FVM), alongside the finite-element mechanics (FEM).

## Answer to the submatrix question

**The code uses local finite-element submatrices and a sparse finite-volume operator.** A dense global matrix would add memory and work. The FEM now shares its repeated operators for identical regular bricks within each solver instance and caches their global indices. A transport optimization should preserve the existing shared face fluxes, conservation ledgers, and equation residual checks; no transport implementation was changed in this integration.

| Calculation | Current representation | Meaning for efficiency |
| --- | --- | --- |
| Continuum mechanics | Eight-node brick, three unknowns per node, one shared **24 × 24 local stiffness block per homogeneous regular-mesh instance**, eight shared Gauss-point `B` matrices, separate element connectivity and plastic state. | It is globally unassembled, element-by-element multiplication. The local operator is stored; it is not a fully quadrature-based matrix-free method. |
| Pressure/porous gas storage | Diagonal and three positive-direction conductance arrays; direct indexing of up to six adjacent cells. | An implicit sparse **seven-point stencil**, without a dense global matrix or sparse row-index structure. |
| Heat/species transport | One shared face record, harmonic conductance, signed transfer to the two neighboring cells; reused work arrays. | Local conservation is built into the paired transfers. Processing unrelated local blocks must not duplicate shared-face transfer. |
| Event mechanics | Separate reduced vertical link calculation in `src/mechanics/model.ts`. | It has a different numerical model and clock. Optimizing the continuum benchmark does not speed up all app modes automatically. |

## Actual implementation inspected

### Continuum FEM — `src/mechanics/continuum.ts`

The constructor builds `K_e = Σ Bᵀ D B w` once for the instance. The elastic matrix `D`, brick dimensions, quadrature locations, and integration weights are identical across this currently homogeneous, regular mesh. The global multiplication gathers displacement by cached element indices and scatters local forces. Fixed degrees of freedom are excluded; conjugate gradients solve the elastic correction. Nonlinear equilibrium uses the elastic correction with a line search and a separate Drucker–Prager return map. Each Gauss point retains its own plastic history.

The baseline repeated storage and construction of identical `K_e` and `B` values. The updated implementation shares these immutable arrays without changing arithmetic order. The per-point **depth** used by the geostatic reference remains correctly associated with each element. Plastic strain, hardening, stress, and connectivity remain distinct. Sharing is local to each constructor; separate geometries and materials cannot reuse another instance's operator.

For scale, the old stored stiffness payload alone was `576 × 8 = 4,608 bytes/element`, and the eight `6 × 24` strain-displacement matrices required `9,216 bytes/element`. Combined, that was 864 KiB for 4³ elements or 54 MiB for 16³ elements. The new shared operators use 13,824 bytes per instance plus `24 × 4 = 96 bytes/element` for the added index cache: 19.5 KiB for 4³ or 397.5 KiB for 16³. These are arithmetic payload estimates from typed-array dimensions, **not measured application memory**; they exclude vectors, history, JS objects, frames, and runtime overhead. A single shared operator is valid only while geometry and material remain identical.

## Measured integration results

The [complete benchmark artifact](../examples/continuumOptimizationBenchmark.json) records source SHA-256 hashes, hardware/runtime, every repetition, output hashes, per-stage nonlinear iterations and residuals, and the comparison counts. The [benchmark script](../scripts/benchmark-continuum.mts) used Node v26.8.2 on an Apple M3 Pro (arm64), one warm-up per implementation per case, then three paired runs with alternating order.

| Case | Setup median before → after (ms) | Solve median before → after (ms) | Equality |
| --- | --- | --- | --- |
| Uniform 4³ bricks | 69.320 → 0.833 | 48.668 → 40.383 | Exact |
| Uniform 6³ bricks | 53.342 → 2.761 | 83.748 → 68.723 | Exact |
| Non-cubic 2 × 3 × 2, distinct material | 2.282 → 0.368 | 5.238 → 4.489 | Exact |
| One-brick plastic load, unload, and checkpoint restart | 0.198 → 0.351 | 11.829 → 11.770 | Exact |

All **120,381 compared numeric values matched exactly**, including signed zero, full displacement/stress/strain/plastic results, yielded indicators, forces, residuals, iteration counts, and checkpoints. Maximum absolute and normalized differences were both zero. Plastic restart additionally matched uninterrupted unloading within both implementations. The plastic case sums three solves; its fresh restart constructor/restore timings are separately recorded.

The measured larger elastic cases solved approximately 17–18% faster by elapsed median time. Construction improved much more because identical integration work is no longer repeated. The single-brick case has no duplicate operator work to remove and its setup was slower; its solve difference was negligible. Three samples on one active workstation do not establish a portable speedup. The broad 4³ baseline setup range (23.085–83.013 ms) also shows runtime variability. No browser frame rate, FVM throughput, peak heap, or improved physical accuracy is claimed.

Verification for this integration: continuum tests **6/6 passed**, including a new independent non-cubic elastic patch/geostatic check with distinct material instances; `npm run typecheck`, `npm run lint`, and `git diff --check` passed. Full application test/build results belong in the integration record, not this isolated mechanics result.

Reproduce after installing dependencies (the historical file remains ignored):

```sh
git show 371a68af76a3c83f94173b0a4a36fddf464a481b:src/mechanics/continuum.ts > work/continuum-before.ts
node --experimental-strip-types scripts/benchmark-continuum.mts
```

Create the ignored `work/` folder first if this is a fresh checkout. The benchmark fails rather than writing a result if any compared value differs or either solver source changes during measurement. Timing has no pass/fail threshold.

### FVM pressure — `src/sim/solver.ts`

The pressure equation has positive storage on the diagonal and symmetric intercell Darcy conductances. `applyMatrix` evaluates the nearest-neighbor stencil directly. The current preconditioner is **symmetric Gauss–Seidel (SGS)**, applied with ordered forward/backward sweeps; the older Jacobi wording in `PHYSICS_MODEL.md` at the reviewed baseline is stale.

The iterative target is `1e-5 Pa` in diagonal-scaled residual units. The code recomputes the actual equation residual after CG and pauses above `0.05 Pa`; these are different tolerances with different purposes. Pressure validity, Darcy velocity, finite inventories, and species-transport subcycling are additional gates. A faster linear solve must preserve them all. Positive-direction conductances encode both opposing neighbor interactions, so dense cell blocks would mostly store zeros.

## Ranked changes to evaluate

| Order | Candidate | Equivalence constraints | Evidence needed |
| --- | --- | --- | --- |
| 1 — implemented | **Share one brick stiffness and eight `B` matrices** within each homogeneous regular-mesh instance. | Depth and history remain per element. No shared mutable plastic tangent or state. A future heterogeneous/deformed mesh needs distinct operators. | Exact baseline comparisons and constructor/solve measurements above. The independent analytic patch also checks non-cubic geometry and separate materials. |
| 2 — implemented | Cache each element's **24 global degree-of-freedom indices** in an `Int32Array`. | Ordering and supports preserved. Repeated division/modulo/connectivity lookup removed without changing load assembly. | Exact elastic/plastic outputs and checkpoint history above. |
| 3 | Reuse mechanics scratch vectors and return-map temporaries. | No aliasing between trial and committed state; line-search failures must not commit history. | Unloading, rejected-trial, deterministic checkpoint/restart, finite-state checks; allocation and timing measurements. |
| 4 | Add a diagonal or node-block preconditioner to mechanics only if iterations dominate. | The preconditioner must be symmetric positive definite for CG. Element-block overlap and supports need correct assembly; singular rigid modes cannot be ignored. | Residual/reaction equivalence, iteration counts and wall time across increasing meshes and near-yield loads. This changes the iterative path, so bitwise equality is not assumed. |
| 5 | Consider block/domain-decomposition or multigrid pressure preconditioning only for demonstrated large-grid cost. | Keep the full cross-block coupling, atmospheric boundary terms, and final residual recomputation. A single sweep of independently solved blocks is not the same equation. | Both uniform and high-contrast permeability cases, convergence and total step timing, unchanged conservative transport. |

The implemented changes preserve the mathematical operators; the benchmark also found exact numeric equivalence for its cases. Scratch-vector reuse remains a candidate. Preconditioning changes convergence behavior, not intended physics, but may change roundoff and accepted nonlinear paths. Reducing Gauss points, dropping couplings, lowering grid resolution, enlarging the explicit time step, removing water/char physics, or loosening residual limits would change the accuracy/model tradeoff and should not be presented as free optimization.

## Required verification and measurement gates

1. Save the baseline commit, scenario/checkpoint, seed, runtime version, machine, mesh, and solver settings. Compare the **same simulated duration** and accepted steps. Pause frame capture during solver timings and time presentation separately.
2. Use existing mechanics tests for the elastic patch, uniaxial solution, force/reaction balance, geostatic reference, plastic unloading, mesh comparison, and checkpoint round-trip. Add only checks needed by the changed cache/preconditioner, particularly trial-state isolation and non-cubic element dimensions.
3. For transport changes, retain the existing closed/open-boundary conservation, species, energy, finite source mass, depletion, numerical rollback, and grid/detail checks. Include heterogeneous permeability and changed atmospheric boundaries.
4. Record initialization, solve/step, snapshot serialization, and render times separately. Use warm-up runs and multiple measured repetitions; publish median and spread. Report peak/retained memory separately. A lower matrix-build time is not automatically a higher simulated-seconds-per-second pace.
5. Select output tolerances in advance from existing test tolerances and solver error bounds. Report maximum absolute and normalized differences for temperature, pressure, species inventories, fuel, energy, displacement, stress, and reactions. Unchanged conservation residuals alone do not prove an unchanged trajectory.
6. Run the repository's typecheck, lint, tests, and build after each implemented integration. Push only the tested state and record actual evidence in `VALIDATION_STATUS.md` and `BUILD_STATUS.md`. Preserve the source hashes alongside each new benchmark result; do not extend the exact-equivalence claim to cases that were not run.

## Literature basis and limit

Kronbichler and Kormann (2012) motivate organizing operator evaluation around cells and reducing memory traffic. Their reported matrix-free gains depend on element order and hardware; their higher-order compiled implementation is not a benchmark for this first-order browser solver. Shared regular-brick blocks above are a deduction from this repository's code, not a result measured in their study. See [R7 and the ASCE reference list](RESEARCH_REVIEW_ASCE.md#asce-style-reference-list).

The research review also identifies physical improvements that cannot be replaced by faster algebra: matched peat kinetics, measured material properties, and freezing/thawing are needed before a cryogenic suppression benchmark is credible. Efficiency work should preserve these future interfaces and the current boundary between illustrative animation and computed fields.
