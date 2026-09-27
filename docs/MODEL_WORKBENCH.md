# Model workbench — first integration, 0.10.0

## Repository audit and implementation sequence

Audited main `6e314a7`, equal to freshly fetched `origin/main`, with 106 passing baseline tests. The only starting working-tree change was the independent `docs/review/material-stage2/Materials_Thermal_Stage_2.blend`; its SHA-256 was `e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638`. It is excluded from this integration. Synced `sources/` files are read-only. The installed 0.9 application remains available during development.

Read the project invariants, build/validation status, physics/model roadmap, broad rupture, cap/particles, material evidence, research review, source inventory and previous performance review before selecting the increment. The running application already contains finite-volume transport and a small-strain FEM backend; adding another incomplete engine would not improve those calculations.

1. **This increment:** explicit model selection; separate rendering controls; a paired elastic/plastic load-cycle benchmark, worker execution, meaningful inputs and instruments; fix the unloading convergence failure found by the new benchmark. Preserve previous scenes and finite-volume behavior.
2. **Next transport milestone:** matched specimen geometry and measurement bases, whole-system energy closure, pressure/diffusion analytical cases, and finite dry-ice depletion/rebound comparisons. Add freezing/enthalpy verification before a cryogenic wet-peat matched case.
3. **Next mechanics milestone:** initial effective stress in the constitutive state, heterogeneous specimen properties and pressure traction, supported boundary conditions, conservative pore-volume feedback and consolidation benchmarks. Then assess fracture-energy regularization and contact.
4. **Later scene integration:** drive the oak-site geometry from a verified spatial solver and measured site parameters; calibrated roots, shell/contact cap mechanics and oxygen-limited surface transition each need separate evidence. MPM or bonded DEM should be selected only after defining separation/contact benchmarks and required material data.

## Available models and views

The **Physics model** selector appears in all three workspaces:

- **Fast demonstration:** the existing 8 m landscape, oak and irregular roots, wide peat and unburnt margins, borehole and cap. Pressure loading is prescribed, thermal colors and fire progression illustrative. Versions 0.5–0.9 remain in ⋯. The assumed-load slider has numeric entry, units, reset and restart. Camera and playback state survive workspace changes; switching historical versions deliberately restarts that version.
- **Porous gas & heat:** existing 3D finite-volume transport, finite CO₂ source, heat/oxidation inventories, real simulation clock, research controls and Developer coefficients. Only computed fields are offered; this increment does not alter its equations. The existing heater-off comparison remains a scenario comparison.
- **Soil deformation:** a separate homogeneous verification fixture, not the oak-site scenario. It runs the same 2 × 2 × 1 m block through linear elasticity and the existing Drucker–Prager law. Calculated displacement, vertical incremental stress, accumulated plastic strain and element inspection are available. No temperature, gas, damage or pore-pressure field is invented here.

No coupled engine is offered. A fractured landscape and a homogeneous FEM block are not comparable predictions of the same scenario. The new A/B comparison instead uses identical geometry, material inputs, supports and load stages in two implemented constitutive models. A single orthographic camera and shared color scale prevent unequal perspective or automatic per-panel normalization from implying a model difference.

## Mechanics equations and limitations

The eight-node bricks, eight-point quadrature, elastic local stiffness and per-integration-point plastic history are retained. Linear elasticity is now an explicit constitutive option; historical files without `constitutiveLaw` retain plastic behavior. Checkpoints record the law and reject cross-law restoration. The fixture loads from zero to the specified traction and back to zero, storing every accepted equilibrium. Rewinding selects stored frames; it does not integrate plasticity backward. Stage numbers and stages/s are playback coordinates, **not physical elapsed seconds**.

The compressive uniaxial plastic analytical check uses `q = P`, mean pressure `p = P/3`, and the implemented yield function `f = q − a p − c − H alpha`. At the monotonic peak, `alpha = [P(1 − a/3) − c]/H`, when positive. The vertical strain is `−P/E − alpha(1 − b/3)`; elastic unloading leaves `−alpha(1 − b/3)`. Here `a` and `b` are friction/dilation **slopes**, not Mohr–Coulomb angles. The default 9.2 kPa load gives `alpha = 0.0063333333`, peak vertical strain `−0.0154277778` and residual vertical strain `−0.0062277778`.

Gravity is an independently balanced reference load, using 1200 kg/m³ and 9.80665 m/s². **That reference stress is not included in plastic yielding**, and pore pressure is not coupled to this constitutive state. Density therefore does not establish strength or fracture orientation in this fixture. Displayed stresses are increments excluding the reference. This audit corrects any broader interpretation of the earlier “geostatic equilibrium” check. Neither the older check nor this release verifies a fully initialized geostatic elastoplastic material.

A software guard rejects a frame when any element-mean principal total strain exceeds 2%. It is a conservative presentation boundary for infinitesimal kinematics, not an experimentally measured failure strain. It does not catch all local integration-point localization, and is not a substitute for nonlinear kinematics or constitutive calibration. The last accepted frame is retained and the limit is explained; failures/limited runs cannot be labeled complete. Comparative playback stops at the common last available stage.

The renderer moves each brick corner using its actual node displacement. It offers a labeled 1–20× display magnification; numeric instruments always use the unamplified results. Mesh lines show brick edges, not physical cracks. Displacement colors are mean nodal magnitudes per element, stress is the integration-point mean, and plastic colors are mean accumulated hardening strain. Clicking a visible element reports its ID and current field value. Fixed bounds span both recorded runs. Temperature/flow/fire are absent from this fixture.

## Numerical defect found and fixed

The previous equilibrium search started at 16 times the elastic correction and accepted the first residual decrease. On the new 2³ load/unload case, it could accept factor-2 unloading oscillations based on negligible floating-point improvement and exhaust 200 iterations at approximately 1380 N residual. The 1³ peak also exceeded its convergence budget under tighter tolerances.

The corrected search tries the elastic correction first, requires sufficient residual reduction, expands only while improving (up to 64), and backtracks when needed. Rejected trials never commit plastic history. The workbench requests an absolute 0.0001 N and relative 1e-10 equilibrium tolerance; legacy callers retain their defaults of 0.05 N and 1e-7. This is a convergence repair with changed numerical search paths, **not a claim of bitwise equivalence or a performance optimization**. The previous optimization report applies to its recorded historical commits.

## Controls and performance

Physical inputs immediately clear results and stop calculation/playback. Calculation restarts from zero after explicit **Calculate both models**. Advanced elastic/plastic coefficients and numerical resolution are separate groups. Friction and dilation are constrained to `0 ≤ dilation ≤ friction ≤ 1`. Appearance, camera, fields and replay do not modify the run. Completed inputs, results, stage and view are retained while switching workspaces, within the current app session; closing the app requires exporting if results must be kept.

Both solvers run in a cancellable dedicated worker. An input change or workspace exit terminates an active benchmark worker. Each model starts from a fresh instance, with no shared plastic history. Exports include inputs, geometry, constitutive law, all stored fields, reactions, residuals, timing and model limits. No GPU physics or new global matrix is introduced. The existing shared 24 × 24 brick operator and element-by-element multiplication remain appropriate at this scale.

`node scripts/benchmark-models.mjs` reproduces the measured report in `examples/mechanicsComparisonBenchmark.json`: one warmup and three runs per mesh/law on the local Apple M3 Pro. Median solves for 21 frames were approximately 1.25/3.99 ms (elastic/plastic, 1³), 11.0/76.2 ms (2³), and 201.5/1145.2 ms (4³). Setup was below 0.8 ms in these samples. Maximum recorded force residual was 5.58e-5 N and final strain error against the analytical solution below 7.7e-9. Timing includes no rendering/worker-transfer measurement and is not a portable speed guarantee. Profile allocation/iteration costs before further optimization; do not infer a need for another sparse matrix representation from a large scene alone.

[Parameter evidence](WORKBENCH_PARAMETER_EVIDENCE.md) · [Verification and platform results](VALIDATION_STATUS.md) · [Installation](INSTALL.md)

## First fracture increment

The 0.10 release also implements the [peat tensile failure laboratory](PEAT_TENSILE_FAILURE.md): a series elastic bar with one energy-regularized cohesive interface. It verifies conditional force/opening and irreversible work before any attempt to attach fracture to the terrain. The documented Krimpen specimen strength observations are distinct from the assumed modulus and fracture energy. CSV import, specimen notes and declared fitting/holdout use support future matched comparisons; a passed numerical test is never promoted into experimental validation. This completes the first small fracture implementation, not the later spatial/coupled validation stages above.
