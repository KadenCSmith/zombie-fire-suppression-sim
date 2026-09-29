# Cold-source spatial and time refinement evidence

Completed 27 September 2026 by the independent physics audit agent. Reproduce with `node scripts/study-unified-convergence.mjs`; complete inputs, source hashes and diagnostics are in [convergence-study.json](convergence-study.json).

This is a **transport-only**, two-second cold source calculation with mechanics and cap absent. It cannot verify mechanical, fracture, water-infiltration or hot-smoldering convergence. All meshes use the same fixed material atlas and source partition. Pressure and temperature fields are reconstructed by volume-weighted piecewise-constant overlap onto the comparison grid; RMS uses equal-volume fine cells. The fixed probe at `(4.4, 4, 1.3) m` uses trilinear cell-center interpolation.

The finer calculation is a **comparison run, not exact truth**. The diagnostic chosen before evaluating results was strictly decreasing absolute error with every non-reference refinement. No material uncertainty or experimental accuracy percentage is inferred from these differences.

## Spatial sweep: mixed outcome, not fully converged

Every mesh uses the same requested timestep of 0.125 s. The comparator has 20,480 cells. Each row reports its difference from that calculation at 2 s.

| Cells | Pressure RMS difference, Pa | Temperature RMS difference, K | Sublimated-mass difference, % | Probe pressure difference, Pa |
|---:|---:|---:|---:|---:|
| 256 | 10.3851 | 0.14184 | −0.7545 | +6.8199 |
| 864 | 3.4964 | 0.07159 | +0.3180 | −4.4059 |
| 2,048 | 2.4355 | 0.05250 | +0.2598 | −5.1963 |
| 2,560 | 1.2763 | 0.05008 | +0.4547 | −7.9697 |
| 20,480 comparator | 0 | 0 | 0 | 0 |

Global pressure and temperature RMS differences decrease through the tested refinements. However, source mass loss, source temperature, and fixed-probe pressure do **not** decrease monotonically. Therefore this study does not establish overall spatial convergence or justify saying 10× as many cells means 10× the physical accuracy. The 2,560-cell global fields are closer to the fine comparator, while some local/source outputs are farther away than at 2,048 cells.

Cold initial thermal/material averaging contributes to field differences. The report separately records initial fields and changes from each mesh's own initial state. The temperature-change RMS differences are only around 1.0e-5 K and are themselves slightly nonmonotonic between 2,048 and 2,560 cells. This short cold run is not a strong test of developed thermal-front accuracy.

The fine comparator sublimates 0.0001533551 kg; the percentage denominator above is this small **mass loss**, not the remaining approximately 4 kg inventory. The percentages are signed numerical differences, not probabilistic intervals or total-model uncertainty. The probe is near an unresolved source, making it sensitive to the chosen reconstruction and mesh.

## Time sweep: decreasing observed differences

The mesh is fixed at 2,560 cells; the comparator uses requested timestep 0.0625 s. Its source mass loss is 0.0001542694 kg. The scenario's configured timestep lower bound remains unchanged: smaller requests use the existing `step(requested)` API.

| Requested step, s | Pressure RMS difference, Pa | Sublimated-mass difference, % | Probe pressure difference, Pa | Source-temperature difference, K |
|---:|---:|---:|---:|---:|
| 0.5 | 0.14230 | −0.9607 | −0.26513 | +0.00025012 |
| 0.25 | 0.06125 | −0.4187 | −0.11143 | +0.00010901 |
| 0.125 | 0.02040 | −0.1407 | −0.03654 | +0.00003664 |
| 0.0625 comparator | 0 | 0 | 0 | 0 |

Pressure/temperature RMS, source mass loss, source temperature, and probe-pressure errors all decrease in this time sweep. This supports timestep refinement for this case; it is not an asymptotic-order proof or a guarantee for long, hot, strongly coupled trajectories.

All completed runs retain mass residual below 3e-9 kg and thermal-energy residual below 1e-5 J. The first harness attempt incorrectly tried to put 0.0625 s into a scenario field restricted to at least 0.1 s and was rejected before the final reference run. The corrected harness uses smaller public step requests; no physics validation bound or numerical tolerance was relaxed.

## Additional time sweep at 20,480 cells

The same two-second cold transport-only case was independently run at 20,480 cells with requested timesteps 0.25, 0.125, and 0.0625 s. Source hashes were unchanged from the first study. The finer-timestep comparator loses 0.000153541943 kg of dry ice. Raw evidence is in [research-temporal-study.json](research-temporal-study.json); reproduce this additional sweep alone with `CONVERGENCE_SWEEP=research-temporal node scripts/study-unified-convergence.mjs`.

| Requested step, s | Accepted steps | Pressure RMS difference, Pa | Sublimated-mass difference, % | Probe pressure difference, Pa | Source-temperature difference, K | Transport solve time, s |
|---:|---:|---:|---:|---:|---:|---:|
| 0.25 | 8 | 0.0174221 | −0.363019 | +0.192853 | +0.00009408 | 2.180 |
| 0.125 | 16 | 0.0058993 | −0.121703 | +0.065300 | +0.00003154 | 3.886 |
| 0.0625 comparator | 32 | 0 | 0 | 0 | 0 | 7.379 |

All five checked absolute-error metrics—pressure and temperature RMS, source mass loss, source temperature, and probe pressure—decrease between the non-reference timestep refinements. Mass residual remains below 3e-9 kg and energy residual below 1e-5 J. Setup times were 0.279 / 0.252 / 0.234 s; the summed measured setup and solve time for the sweep was 14.211 s. These are single transport-only observations, not isolated coupled-app performance measurements or a statistically robust speed comparison.

This supplies case-specific evidence for lowering both precision presets to a 0.125 s maximum step **after the 0.12 reference is frozen**. At 2,560 cells it reduces the source-loss difference against the finer comparator from 0.9607% to 0.1407%; at 20,480 cells it reduces the corresponding difference from 0.3630% to 0.1217%. These percentages quantify the numerical comparison for this test, not physical accuracy or material uncertainty. The spatial nonconvergence findings above remain unchanged.

## Planned 0.13 accuracy/cost comparison

The proposed change trades more time steps for lower measured temporal differences. No default or physical-model file was changed by this study. The reference release must retain its source/binary identity before any default change.

For the follow-up acceptance, keep two distinct comparisons:

1. **Backend comparison at identical numerical settings:** for the 2,560-cell cold coupled case, run reference and optimized backends at 0.125 s maximum step for 2 simulated seconds, three repeats each. Run a bounded 20,480-cell comparison over 0.25 simulated seconds, which now requires two steps. Record input settings, actual accepted/rejected steps, source hashes, setup, numerical solve including final snapshot, and sampled process memory. Preserve the original force, mass, energy, strain and backend-equivalence gates. A successful short 20,480-cell calculation is not a completed long-duration acceptance test.
2. **Release-settings comparison:** compare the frozen 0.12 settings with 0.13 settings over the same physical duration. At 2,560 cells, a 2 s run grows from 4 to 16 nominal steps; at 20,480 cells, a 0.25 s run grows from 1 to 2. Report the observed total setup-plus-calculation cost and the corresponding changed numerical outputs. Do not reuse the old 1.88×/1.92× matched-backend speedups as a claim that the new release itself finishes sooner.

Run timing comparisons serially and separately from heavy builds/renders. Retain the float64 reference backend, do not adjust tolerances to obtain a speedup, and distinguish sampled solver-process memory from total app/GPU memory. Final UI responsiveness, replay and cancellation need their own observations. This is an acceptance plan, not a claim that these post-change runs have already passed.

## Remaining work before a predictive accuracy claim

Refine the physical material/source atlas separately from the solver grid, resolve the source neighborhood sufficiently, study longer thermal and gas transients, and repeat coupled-mechanics refinements with domain-size checks. Then compare against an independent matched specimen with measured input uncertainty. Existing conservation and runtime benefits do not substitute for those checks.
