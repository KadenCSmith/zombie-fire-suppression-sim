# Peat FEM resumable checkpoint

Active checkout: `/Users/kadensmith/Documents/Codex/2026-10-02/ok/outputs/zombie-fire-suppression-sim`. Branch `feat/peat-fire-fem`, based on reviewed/published v20 `161e7a4a1f8c35765e1878c132db79977be1f5ea`. M1 `0902122`, M2 `f1ec195`, M2.1 `240d267` pushed and verified. M3 evidence/recording milestone ready for upload. GitHub merged PR10 outside this session as main `4b2088e926662aee357cde680f2b22c4fbf24f79`; no merge/rewrite by this session.

Active core: genuine 3D Q1 `model.ts` assembly; five-step `chemistry.ts`; `operators.ts` pressure/species; `coupled.ts` gas/heat Picard and step doubling. Worker calls this core. Current UI/export/import/actual-node worked formulas use the same inventories. Source and model adaptations are explicit; no active suppression. Historical modes/routes retained.

Final tests: 1,763 passed, 0 failed in 91 files / 5.38 s. Typecheck/lint/build and all five native integrations pass. Native saved-file import, replay/reset, EOS and accepted-step counter covered. Baseline 1,728 tests / 86 files; slowest final groups are existing coupledEngine 5.13 s, sim/solver 4.41 s, wideSoil 3.36 s. Full logs under docs/review/peat-fem/logs; final timings in test-timings-final.json.

Separate analysis: six 650 K / 0.25 s cases completed, 857.04 wall s. Coarse 4³ comparison **fails**: max probe difference 38.8625 K and contour 3.1 mm versus 16³, beyond 5 K / 2 mm limits. 8³ probe difference 22.0695 K. Time differences <=0.00457 K; stricter tolerance effect 0.00720 K. No asymptotic order/grid independence. Current source/input hashes match; raw result reuse is labeled. Maximum mass/energy residuals 9.41e-15 kg / 2.25e-8 J. Current 850 K coarse pilot passed 0.5 physical s in 69.47 wall s; long-front mesh/time gate incomplete. Earlier initialization and linear-floor failures retained, not reused.

C4 measured Fig3(a,c) peak data digitized (10 points) with native coordinates, protocol, 0.242 h / 8 K extraction bounds and no raw/replicate claim. Runtime cube/ignition/bottom geometry does not match column; calibration/experimental scores unrun. Highest-value next work: verified column mesh/buried heater/bottom loss, sufficiently resolved/efficient stiff source transport, then long-time front and held-out measured comparisons.

Final-build visible FPS/screenshot unrun: native launches could not establish focused visible window; one normal macOS launch stalled before benchmark startup, then was terminated. Earlier focus-loss failure retained; first intermediate 119 FPS diagnostic has no retained raw file and is not final acceptance evidence. Prior in-app-browser security denial was not bypassed. Native functional results are distinct from visible performance.

Best-effort account-wide usage: start27%, latest29%, target34.3%, stop before41.6%; reset Oct6 1:01 AM Pacific. No hard cap claim, reset credits, premium, agents or paid compute. No new top-level project/output folders in this continuation; Finder tag instruction does not apply to existing/nested/cache folders.

See docs/PEAT_FIRE_FEM_EVIDENCE.md for exact commands and all passed/failed/reused/unrun checks.
