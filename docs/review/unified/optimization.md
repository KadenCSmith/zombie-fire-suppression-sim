# Independent review: exact sparse elastic operator

Reviewer: `physics_audit`, separate from the optimization implementer. Date: 27 September 2026. Formal review: **round 1 of a maximum 3**. Disposition: **accepted for the undamaged linear-elastic path**, subject to the unchanged model limits below. No blocking implementation finding remains from this round.

## Scores and evidence

Physical accuracy: **5/10**, the same reduced physical model as the reference. This is an engineering judgment, not a percentage of truth or measured accuracy. The optimization does not improve or weaken constitutive physics. Numerical-equivalence confidence is high for inspected operators and tested cases; empirical predictive confidence remains low without a matched specimen. Visual realism is **pending accepted-state render review** and cannot be inferred from solver timings.

The assembled float64 operator uses the existing eight-point brick stiffness matrices. Fixed degrees of freedom are removed symmetrically and receive identity rows. Root trusses remain explicit in both implementations. For undamaged linear elasticity the potential is quadratic, so one PCG solve replaces repeated constitutive evaluation and line search. The final original stress/strain/residual calculations and the 2% strain and 1e-4 N force gates remain. Damage or fracture uses the retained nonlinear path. A reference backend remains selectable.

## Independently reproduced gates

Command: `npx vitest run tests/coupledOptimization.test.ts tests/poromechanics.test.ts tests/cap.test.ts`. Result: **9/9 passed**, 1.11 s on the host clock at 02:52:57.

- Heterogeneous rectangular mesh, bonded roots, positive/negative loading and unloading: displacement differences below 1e-9 m, elastic-energy difference below 1e-7 J, accepted force residual below 1e-4 N.
- Coupled trajectories: temperature differences below 1e-7 K, pressure differences below 1e-5 Pa, displacement differences below 1e-9 m; original mass/energy limits passed.
- Existing poromechanics and cap tests passed.
- No float32 kernel, reduced quadrature, relaxed conservation gate, or altered fracture law was introduced.

## Matched runtime measurements

Serial CPU runs used identical cold source-only scenario inputs and identical source hashes, with no rendering. The 256- and 2,560-cell cases ran for 2 simulated seconds, three repetitions per backend; table values are medians. The 20,480-cell case ran one 0.25 s step per backend, so its timing is a single observation rather than a robust performance distribution.

| Cells | Simulated duration | Reference setup | Optimized setup | Reference solve | Optimized solve | Solve speedup |
|---:|---:|---:|---:|---:|---:|---:|
| 256 | 2 s | 236.85 ms | 220.91 ms | 68.90 ms | 40.38 ms | 1.71× |
| 2,560 | 2 s | 583.31 ms | 347.90 ms | 4,529.06 ms | 2,405.38 ms | 1.88× |
| 20,480 | 0.25 s | 4,726.39 ms | 2,314.11 ms | 15,390.48 ms | 8,027.06 ms | 1.92×, one run |

All runs finished with zero rejected steps. Compared backends produced identical reported dry-ice inventory and float32 maximum pressure. The full-state tolerances are established by the numerical tests, not those scalar matches. At 20,480 cells the optimized mass residual was −1.4552e-10 kg, energy residual 1.5736e-5 J, and force residual 9.6603e-8 N; the unchanged acceptance gates passed.

Sampled solver-process RSS at the end of the 20,480-cell run increased from 406,175,744 to 480,149,504 bytes. Sparse assembly uses additional memory to save repeated arithmetic. These samples are **not peak memory**, and exclude browser, GPU, shared, compressed and other application memory. They cannot certify the complete application memory or frame-rate budgets. Nor does a successful 0.25 s calculation establish a long-duration 20,480-cell run.

The first attempted fractional-duration benchmark used `SECONDS`, which zsh treats as a special integer clock variable; it became zero and the reporting harness failed because no mechanical step existed. This was not a numerical solver failure. The harness now requires positive `SIM_SECONDS`; all reported accepted runs state their actual simulated duration. Earlier 2 s reports were verified to have actually advanced 2 s.

## Reproduction and provenance

Raw inputs, repeats, ledgers, memory samples, host information, and all relevant source hashes are in [optimization-benchmarks.json](optimization-benchmarks.json). No source hashes changed between the matched runs. Use:

```sh
BACKEND=reference FIDELITIES=preview,precision2560 SIM_SECONDS=2 REPEATS=3 REPORT=work/verification/reference.json node scripts/benchmark-unified.mjs
BACKEND=optimized FIDELITIES=preview,precision2560 SIM_SECONDS=2 REPEATS=3 REPORT=work/verification/optimized.json node scripts/benchmark-unified.mjs
BACKEND=reference FIDELITIES=precision20480 SIM_SECONDS=0.25 REPEATS=1 REPORT=work/verification/research-reference.json node scripts/benchmark-unified.mjs
BACKEND=optimized FIDELITIES=precision20480 SIM_SECONDS=0.25 REPEATS=1 REPORT=work/verification/research-optimized.json node scripts/benchmark-unified.mjs
```

Reviewed optimization file hashes:

```
72ad40c79e9d5fcfa29e8248a56ff420051b766596b29e60b534ba2d461596d3  src/coupled/mechanics.ts
af2f54c5528f4d489782f1550ed0779109c4c90b33c72adb4124c730fe2d76c2  src/coupled/sparse.ts
52c6b51983adcab884656da3749373aec279dce84de0fb37d3ca8cd95728fc1f  src/coupled/engine.ts
90ac27517d96bbcac78d14fef5f1232cd1c0e5bb138f90806d2b108cdc7933c2  tests/coupledOptimization.test.ts
```

No claim is made for converged heterogeneous fracture, resolved excavation, liquid infiltration, root pullout, or field suppression performance. Those are independent physical-model gaps, unaffected by this speedup.
