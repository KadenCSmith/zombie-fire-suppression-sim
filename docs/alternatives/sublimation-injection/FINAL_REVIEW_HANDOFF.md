# 4.2.1 final frozen review handoff

The requested from-scratch redesign is implemented: private six-wheel tanker, rounded cab, tank cradles, lower rear treatment deck, pump/reel, rigid articulated loading boom, individually carried/falling dry-ice blocks and explicit tank→pump→vessel plumbing. The loader returns before the lid closes at68.5–71.3s, faster flow follows71.5s, and illustrative fire quenching follows72–85s with the public fire-off86s. Original fire/drilling/grass/tree/camera are reused by the external host unchanged. Artwork is not equipment performance or predicted suppression.

Reviewed source: **a0e0826db17d8e06dfc79fa6baeb6850bb9ab383**, empty tracked diff, branch `feature/v21-sublimation-injection`, [draft PR21](https://github.com/KadenCSmith/zombie-fire-suppression-sim/pull/21) targeting `integration/v21-alternatives`. The final packaging commit adds only A-owned documentation/signed evidence; its exact SHA is announced separately with verified unchanged source/dependency identity. Source/test/doc ownership remains exclusively under the three `sublimation-injection` subtrees. Entry points: `src/alternatives/sublimation-injection/index.ts` and `scene.tsx`. APIv21.2 unchanged; the exact authorized shared checkpoint d07d03fe54b453677c2cd8684e8e2c5eb97112a6 was previously ordinarily merged. No later D-only shared checkpoint was merged into this reviewed checkout.

## Independent scorecard and counters

| Criterion | Weight | Initial | Final |
|---|---:|---:|---:|
|Governing physics/conservation|30%|5|5|
|Medium/soil properties|20%|3|3|
|Numerics/independent validation|20%|6|6|
|Method mechanism/coupling|20%|2|2|
|Visual correspondence|10%|4|3, unverified|

Initial unrounded/final4.1; final unrounded/final**4.0**. Unsupported central mechanism cap**6**; no serious conservation/unit/stability failure found within tested bounds; required current independent visual/runtime evidence unavailable. **Verified≥7: no.** The lower visual criterion reflects missing current evidence, not a measured physics regression or an aesthetic rating. Aesthetic assessment remains unverified and outside this scientific total.

Pass1:22a60811f9c9381ea38085e4cc03aff6e559dbec, reviewer`/root/realism_a_round0`,4.1. Pass2/retry1:de48568ef636dcebc89316bcf6d77d9d6df15265, dedicated reviewer`/root/realism_a_review`,4.1. Pass3/retry2:b27486d5ef2bbe8311282f6e6bec2eb0cf44a38b, same reviewer,4.0. Pass4/retry3:a0e0826db17d8e06dfc79fa6baeb6850bb9ab383, same reviewer,4.0. **All4 scored passes/3 retries used;0 remain; scientific revision loop stops.** The unscored57d9bcc preparation withdrawal and cheap pre-freeze route failure remain explicitly preserved. No reset or discarded completed review.

[Final signed report](review-round3/report.md), [machine score/gates](review-round3/report.json), [ledger](review-round3/LEDGER.md), [signed artifact hashes](review-round3/signed-evidence-sha256.json). Earlier signed reports remain in review-round1/review-round2. Exact signed bytes/logs are archived, without altering historical findings.

## Verification and reproducibility

- Implementer:79 maintained tests/11files,54private,2.19s; typecheck/lint/build PASS, build3.31s;16 inherited lint warnings and inherited build warnings. Source/tests/nonlog-doc whitespace PASS. Signed historical raw logs retain two trailing-whitespace/two EOF findings and were not rewritten.
- Independent reviewer:81tests/12files,2.33s, one worker. Inspected pump/reel overlap and through-housing route defects resolved. Independent finite-cylinder checks sampled10001 points and539 actual tube vertices per route; minimum radius-adjusted clearance.05603553618587511 authored units. This is a bounded primitive/route check, not universal collision or GUI evidence.
- Original protection:57/57 SHA-256 identities independently match `161e7a4a1f8c35765e1878c132db79977be1f5ea`, zero mismatches. No original asset copy/extraction/relabeling or protected change.
- Provenance:75-file transitive closure, configuration/lock/source settings and8 complete relevant package trees/2414files match. Nodev26.8.2/npm11.19.1, macOS27 arm64, AppleM3Pro,12logical CPUs/36GiB, model seed21. One-worker CPU load around29; no FPS claim. Runtime/commands/configuration/seed and exact source/dependency hashes are in the signed packet. No reinstall/upgrade.

Local maintained checks:

```sh
npm test -- tests/alternatives/sublimation-injection tests/alternativeSceneComposition.test.tsx tests/alternatives.test.ts tests/alternatives-infusion-accuracy.test.ts --exclude 'work/**' --maxWorkers=1
npm run typecheck
npm run lint
npm run build
node scripts/check-original-preservation.mjs
```

The isolated reviewer command and independently authored harness are preserved in [report](review-round3/report.md), [harness](review-round3/independent-geometry-harness.log), [run metadata](review-round3/independent-run-metadata.json) and [results](review-round3/independent-geometry-results.json). Supplied local results are distinct from reviewer execution.

## Physical evidence and unresolved limits

The unchanged contact proxy uses3×.5kg specimens, water inventory.5kg, flow.025kg/s, inlet293.15K, contact UA24W/K per specimen, arrival8s,60s window and0.00625s alternative step. The accuracy benchmark starts350K and compares an independent continuous-inflow series/post-depletion solution at8/8.5/9/18/28/60s. Maximum errors:.019203044476910236K at.05s,.0026181586201232676K at.00625s,.0013229686160229903K at.003125s, unchanged tolerances and strict decrease. Latest reused independent physical results have maximum absolute residuals2.0372681319713593e−8J and6.861178292183467e−14kg; the full original benchmark maximum energy residual is3.6694109439849854e−7J. Current default hot runs start823.15K. These are finite lumped contact specimens, not surface-tank or field validation.

[Primary-source digest](review-round3/reused-primary-source-digest.md) preserves NIST water/CO₂, IAPWS and Santoso references and their evidentiary limits. Missing inputs/seams remain a conservative finite surface liquid/solid/gas-export balance and computed outlet mass/enthalpy, supported abstract pressure-to-flow boundary coupling, conservative porous water/CO₂ transport/reaction/oxygen/fuel/moisture behavior, measured peat/thermal/hydraulic/kinetics data, held-out matched validation and an accepted-state rendering seam. Do not infer suppression/re-ignition or experimental validation from authored fog, faster flow or quenching. 4.2.2 remains definition-pending/outside predictive scoring.

## Application and integration status

Independent new-truck GUI/runtime is **UNVERIFIED**: purpose-built Chrome access was denied because administrator policy could not be verified. No subsequent retry, alternate/native/shell route or indirect workaround was attempted. No current independent frame, screenshot, console, playback/seek/navigation/resize/GPU/native result is claimed. [Status](review-round3/browser-status.json) and [verbatim denial](review-round3/prior-browser-policy-denial.log) are preserved. Old-truck observations do not verify this source.

The coordinator reported separate normal-Chrome private-preview observations at75s and fast0→90→86 plus a screenshot; those are coordinator observations, not independent reviewer execution. Its current-console filtering, combined/native/navigation/original/comparison/full-suite/production verification remain coordinator-owned and pending. Later shared D-only additions require exact combined impact/hash checks; no stale green result may be substituted for affected evidence or budget reset.

Owned preview remains `http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1`, detachedPID23895, Node22, log`/tmp/v21-agent-sublimation-preview.log`. Leave it running. No other assigned process was changed. Integrate only the exact accepted packaged SHA after identity/ownership/interface/original/cross-variant checks; no worker merge/main/release/install/deploy was performed. Only nested files/folders in the existing checkout were created, so no new top-level folder requires Finder tagging.
