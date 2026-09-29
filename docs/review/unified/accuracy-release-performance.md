# Accuracy settings and release cost: independent review round 2

Reviewer: `physics_audit`, separate from the default-settings implementer. Date: 27 September 2026. Reference: frozen 0.12 source `1ec0710`. **Disposition: accept the scoped 0.13 default changes.** This is round 2 of the optimization/default-settings integration, not a reopening of the frozen three-round initialization review.

The inspected numerical diff changes only the 2,560-cell timestep cap from 0.5 to 0.125 s, the 20,480-cell cap from 0.25 to 0.125 s, and the lab's default backend to `optimized`. The three historical mesh presets remain unchanged. All numerical source hashes other than `model.ts` match the 0.12 benchmark evidence; the diff in that file contains these settings only. The source, phase, transport, FE, fracture and cap equations, material values, and acceptance tolerances are unchanged.

The timestep choice is justified by the separate cold transport studies: source-loss differences against a 0.0625 s comparator fall from 0.9607% to 0.1407% at 2,560 cells, and from 0.3630% to 0.1217% at 20,480 cells. These are case-specific numerical differences. Overall spatial convergence remains unproven, and no experimental-accuracy claim is accepted. Physical-accuracy judgment remains **5/10** for the limited reduced model; confidence is high in the inspected code/settings and numerical accounting, low in field prediction. Visual realism is not rerated in this numerical round; no render was inspected here. Visual review is recorded separately.

## Same-step backend measurements

Both backends use the new 0.125 s cap, identical cold coupled inputs, and identical source hashes. The 2,560-cell values are medians of three repeats; 20,480-cell values are single observations. Solve time includes the final numerical snapshot, but excludes rendering.

| Cells | Physical duration | Accepted steps | Reference setup | Optimized setup | Reference solve | Optimized solve | Matched solve ratio |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 2,560 | 2 s | 16 | 0.663 s | 0.425 s | 16.003 s | 8.406 s | 1.904× |
| 20,480 | 0.25 s | 2 | 5.121 s | 2.395 s | 30.876 s | 16.187 s | 1.907×, one run |

The explicit benchmark backend overrides the lab default in both runs; the reference measurement therefore did not accidentally use the optimized solver. Matched dry-ice inventories differ by at most 4.45e-16 kg, and reported float32 peak pressures match. Those scalar checks supplement the earlier full-state equivalence tests; they do not replace them.

## Actual settings cost versus 0.12

These totals compare the recorded 0.12 default reference backend against 0.13's optimized backend with additional timesteps. Each total is the median of per-run setup-plus-solve times, not the sum of separately calculated medians.

| Cells / physical duration | 0.12 steps | 0.13 steps | Recorded 0.12 total | Recorded 0.13 total | Observed change |
|---|---:|---:|---:|---:|---:|
| 2,560 / 2 s | 4 | 16 | 5.112 s | 8.822 s | **72.6% longer** |
| 20,480 / 0.25 s | 1 | 2 | 20.117 s | 18.582 s | 7.6% shorter, single observation |

The approximately 1.9× matched-backend benefit does **not** mean the new default release finishes 1.9× sooner. At 2,560 cells the measured temporal-accuracy improvement costs more elapsed time despite faster mechanics. The 20,480-cell comparison is too short and sparsely repeated for a general release-speed claim.

These are serial measurements on the same Apple M3 Pro, but the Mac is a shared host rather than a controlled benchmark appliance. Native UI could remain idle; heavy tests/builds were paused for the timing batches. OS activity, process warmup, thermal conditions, and the earlier baseline's different run time are not controlled. Sampled end-of-run process RSS is not peak or whole-application memory: the new optimized maximum samples were 330.9 MB at 2,560 cells and 502.7 MB at 20,480 cells. GPU, shared, compressed, browser and other process memory are excluded. No long-duration 20,480-cell or viewport frame-rate claim follows from this table.

## Gates and prepared-smoldering check

All **nine** new runs passed the unchanged absolute diagnostic gates: mass residual ≤1e-7 kg, thermal-energy residual ≤1e-4 J, and force residual ≤1e-4 N. All finished the requested physical duration with zero rejected steps. Across the cold runs, the largest absolute mass residual was 2.94e-9 kg, energy residual 7.16e-6 J, and force residual 9.54e-8 N.

A separate 2,560-cell opt-in prepared dry smoldering case ran for 2 physical seconds using the optimized backend and 0.125 s cap. It finished 16 accepted steps in 14.807 s solve time plus 0.432 s setup. Oxidation released 16.429 kJ; final peak temperature was 543.171 K and pressure 102,447 Pa. Its mass residual was −2.33e-10 kg, energy residual −4.77e-7 J, force residual 9.70e-8 N, and mechanical-work balance 1.71e-7 J. This confirms short-run usability of that optional prepared case; it does not establish long-run smoldering or suppression accuracy. Its declared initial preparation removes **9,136.3456 kg of water** before the ledger baseline and must not be mistaken for modeled drying of natural peat. Fracture remained disabled.

## Evidence and reproduction

[accuracy-release-performance.json](accuracy-release-performance.json) contains every new raw record, full inputs, source hashes, gates, timing samples, and baseline comparisons. The preserved 0.12 raw evidence is [optimization-benchmarks.json](optimization-benchmarks.json).

```sh
BACKEND=reference FIDELITIES=precision2560 SIM_SECONDS=2 REPEATS=3 REPORT=work/verification/accuracy-013-reference.json node scripts/benchmark-unified.mjs
BACKEND=optimized FIDELITIES=precision2560 SIM_SECONDS=2 REPEATS=3 REPORT=work/verification/accuracy-013-optimized.json node scripts/benchmark-unified.mjs
BACKEND=reference FIDELITIES=precision20480 SIM_SECONDS=0.25 REPEATS=1 REPORT=work/verification/accuracy-013-research-reference.json node scripts/benchmark-unified.mjs
BACKEND=optimized FIDELITIES=precision20480 SIM_SECONDS=0.25 REPEATS=1 REPORT=work/verification/accuracy-013-research-optimized.json node scripts/benchmark-unified.mjs
BACKEND=optimized BENCH_CASE=prepared-dry-smoldering FIDELITIES=precision2560 SIM_SECONDS=2 REPEATS=1 REPORT=work/verification/accuracy-013-prepared-smoldering.json node scripts/benchmark-unified.mjs
```

Reviewed `model.ts` SHA-256: `49d74169cb7e1415a8b0bcb4d1f571a58c13c5614ee6ccf32484b23eaf1e572c`. All other numerical hashes are preserved in the JSON and unchanged against the 0.12 evidence. No acceptance gate was relaxed to obtain these results.
