# Peat FEM evidence and reproduction

The feature branch is `feat/peat-fire-fem`, based on the reviewed/published v20 checkpoint `161e7a4a1f8c35765e1878c132db79977be1f5ea`. Initial v20 hosted CI passed macOS, Windows and Linux ([run 36992293227](https://github.com/KadenCSmith/zombie-fire-suppression-sim/actions/runs/36992293227)). M1 `0902122`, M2 `f1ec195` and residual correction `240d267` were pushed and independently verified. GitHub subsequently merged PR10 outside this session as main `4b2088e`; this session performed no FEM merge to main. Further changes remain on the feature branch.

## Software checks

Final regression: **1763 passed, 0 failed, 91 files, 5.38 s**. Before this task: 1,728 tests / 86 files. Slowest concurrent groups: existing coupledEngine 5.13 s, sim/solver 4.41 s, wideSoil 3.36 s. Counts establish regression coverage, not physical validity. Typecheck, lint and production build pass; 16 pre-existing lint warnings and existing bundle/Three.js notices remain. Dependency install from baseline is reused: package manifest, lock and dependency configuration are unchanged.

All five native scripts pass on the relevant final code. The FEM script was rerun on the final build; historical results were reused after the last FEM-only edits because their relevant source/routes/inputs/configuration are unchanged. FEM coverage: worker startup, accepted step/counter, live run/pause, display-only field/grid identity, four-gas EOS export, actual exported-file import, mesh reset, archive navigation, session restore, repeated reset/stale-worker exclusion, formulas and WebGL. Three recording checks cover deterministic continuation and reject unsupported revisions, incomplete/nonfinite fields, bad EOS, nonconservative ledgers and duplicate times. Historical native checks exercise preserved fire sequence, scientific/worker/mechanics/studio workspaces, tensile calculations and multi-version comparison.

The recording importer accepts current schema 2 plus an explicit solver revision; automatic older-FEM recording migration is unavailable. Existing historical workspace IDs remain unchanged. Empty intervention identity is verified; active suppression is disabled. Worked formulas call the actual runtime properties/rates on the currently selected node.

## Numerical analysis

The separate short fixture is a prepared **buried 650 K seed in wet surroundings**, at ambient initial EOS pressure, run for 0.25 physical s. Its original uniform source-material mass references are retained during conditioning. It is not a measured fire or a long-time propagation validation. Settings and complete observers/ledgers are in `transport-convergence.json`.

| Mesh / maximum step | Accepted steps | Wall time | Max probe difference from 16³, 0.005 s |
|---|---:|---:|---:|
| 4³ / 0.005 s | 71 | 4.81 s | 38.86252 K |
| 8³ / 0.005 s | 70 | 32.71 s | 22.06952 K |
| 16³ / 0.005 s | 72 | 284.00 s | 0.00000 K |
| 16³ / 0.02 s | 56 | 240.46 s | 0.00457 K |
| 16³ / 0.01 s | 56 | 241.24 s | 0.00403 K |
| 8³ / 0.005 s / stricter tolerances | 118 | 53.83 s | 22.06952 K |

**Failed coarse accuracy gate:** 38.8625 K probe difference exceeds the predeclared 5 K limit; 3.1 mm contour difference exceeds 2 mm. Peat mass difference 0.0527% passes its 5% comparison limit. The 8³ probe difference is 22.0695 K. Initial projection/interpolation already contributes strongly: coarse nodal representation misses the compact temperature profile. No reaction-zone broadening or tolerance loosening was used. A 16³ comparison is not established grid independence.

Nominal time levels 0.02 / 0.01 / 0.005 s adapt to maxima 0.011634 / 0.01 / 0.005 s and minima about 0.000153 s. Two coarser runs both take 56 steps. Probe differences are 0.00457 / 0.00403 K against the finest time case; this is not demonstrated asymptotic temporal order. Stricter linear/splitting control on 8³ changes the probe by 0.00720 K.

Across these six cases, maximum mass residual is 9.41e-15 kg and energy residual 2.25e-8 J. Peaks are about 656.5 K. The 500 K contour and 5% peat depletion are fixture diagnostics, not measured smouldering-front definitions; depletion is zero over this short interval.

Current-code 1 s ambient-ignition profiles cost 0.302 / 2.162 / 26.703 wall s at 4³ / 8³ / 16³, giving 3.307 / 0.463 / 0.0374 physical s per wall s. These rates depend on physical state and numerical step. The hot pilot is much more costly.

The source/code/input hashes match after final UI changes; reuse was explicitly checked and labeled in raw results. Earlier t=0 hot-wet failures, interrupted boundary-hot pilot and refined residual-floor failures are retained separately and never reused as current passes. The refined regression fails with the original 1e-14 absolute linear floor and passes with 1e-18; relative and nonlinear tolerances are unchanged.

## Measured evidence and limitations

[Huang & Rein 2017](https://doi.org/10.1071/WF16198), measured Fig3(a,c), was recovered from the lawful Imperial repository PDF. `C4-measured-peaks.json` / CSV contain ten approximate peak-arrival/temperature facts, selected native pixel coordinates, linear axes, protocol and extraction method. Conservative extraction bounds are ±0.242 h and ±8 K, not replicate confidence intervals. Raw sensor traces and replicate temperature/time uncertainty remain unavailable. Measured spread is sensor-depth separation divided by peak-arrival separation.

Baseline MC10 and same-study held-out MC35 roles and project comparison thresholds were declared without fitting. **Matched comparison unrun:** the runtime .10 m cube/top 8 W Gaussian/180 s ignition/insulated bottom differ from the .10 × .10 × .30 m column, 100 W buried coil for 1800 s and source bottom-loss treatment. The fixed mesh also omits measured recession/shrinkage. No experiment error score, parameter calibration, independent validation, or arbitrary 3D-front accuracy is claimed.

Gas thermodynamics/product MW, diffusion, permeability and liquid-connectivity closures have explicit uncertainty/assumption status in `source-registry.json`. Condensation, liquid flow, mechanics and resolved emissions remain absent. The original paper discusses intra-particle oxygen limitation above 500°C; no unrecovered empirical slowdown/temperature ceiling was invented.

Highest-value next step: an independently verified column mesh and buried-heater/bottom boundary implementation, followed by sufficiently resolved source/transport and long-time front studies before interpreting measured discrepancy. The current coarse preset is an interactive diagnostic, not a physically accepted predictor.

## Reproduce

Use the existing checkout and unchanged dependency lock. Full logs are saved under `docs/review/peat-fem/logs/`; full regression timings are in `test-timings-final.json`.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
./node_modules/.bin/electron . --peat-fem
./node_modules/.bin/electron scripts/smoke-peat-fem.cjs
./node_modules/.bin/electron scripts/benchmark-peat-fem.cjs
node --experimental-strip-types scripts/analyze-peat-fem.mts profile
node --experimental-strip-types scripts/analyze-peat-fem.mts transport-convergence
node --experimental-strip-types scripts/analyze-peat-fem.mts pilot
node --experimental-strip-types scripts/analyze-peat-fem.mts convergence
node --experimental-strip-types scripts/digitize-c4-peaks.mts
```

The 850 K `pilot` is bounded at 120 wall s; analysis cases at 600 wall s. The long `convergence` matrix remains an incomplete acceptance gate, not a suggested fast regression check. `--reuse` requires exact code/input hashes. The six-case short study cost 857.04 wall s total and should stay outside ordinary regression.

## Usage and remaining checks

Account-wide weekly allowance began at 27%; latest observed reading is 29%, with target 34.3% and stop before 41.6%. This is rounded best-effort monitoring, not a task-specific hard cap or attributable task usage. No new agents, premium selection, reset credits or paid compute were used.

Unrun: matched column/held-out experiments, long-time hot-front convergence, measured multidimensional front geometry, and new feature packaging/native Windows/Linux checks. Visible benchmark result is recorded separately with production build identity; an earlier loss-of-focus failure remains preserved.

## Final foreground benchmark status

**Unrun on final build.** Direct native launches could not obtain a visible focused window. One normal macOS launch stalled before the benchmark script started and was terminated. Earlier intermediate-run data are retained: a loss-of-focus run had 86.59 mean FPS and zero-frame rolling windows, so it failed. Its reported inter-frame maximum omitted the trailing hidden interval; the corrected benchmark now includes start/end gaps. An earlier finite foreground diagnostic reported a minimum 119 rolling FPS, but its raw file was overwritten by the repeat and it is not used as acceptance evidence. No final 40 FPS pass or developer screenshot is claimed. Native functional checks are separate from visible performance.

The current-code 850 K buried pilot was rerun after the residual-floor change: 0.5 physical s in 69.47 wall s, 981 accepted advances, 783 rejections, peak 855.87 K, final maximum 821.26 K, maximum local Peclet about 73.98. Final mass residual 3.00e-15 kg and energy residual -9.63e-7 J. This single coarse pilot does not complete hot-front convergence.

Earlier full-suite timing JSON reports were preserved locally under `work/peat-fem-evidence/`; final timings and numerical results are uploaded. One native reset run emitted a Chromium shared-image mailbox message; shader/context/lifecycle assertions passed, and visual output remains unverified.
