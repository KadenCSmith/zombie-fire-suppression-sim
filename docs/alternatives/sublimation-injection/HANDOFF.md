# Worker A handoff · 4.2.1

Historical initial delivery record. Its 0.05 s calculations and 22.5/45/67.5 s cues are preserved below; current additive alternative timestep is 0.00625 s and the world choreography is described in ROUND_1.md. These old values are not current verification results.

Branch: `feature/v21-sublimation-injection`.

Draft PR: [#13](https://github.com/KadenCSmith/zombie-fire-suppression-sim/pull/13), targeting `integration/v21-alternatives`. No worker merge to integration/main or release was performed.

Verified implementation commit: **`dda2e855353a2d1857562084cf0bd8388e32ab1a`**, normally pushed and remote-SHA checked. The final delivered HEAD adds only this handoff and the exact PR description; its full immutable SHA is supplied in the final agent handoff and PR head (a tracked file cannot include the SHA of its own enclosing commit). No later source edits are planned during integration review.

Owned checkout: `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-sublimation`.

Frozen contract: **v21.2**. Source base `c1adb47da0daf72c22eb5ec30020524139629e10`, followed by documentation publication `0f52bc2ece39f0c9f90ae7067c9539f5fcc519c4`; fetched, inspected and ordinarily merged sequentially before private edits. No moving-tip merge, rebase or shared configuration change.

## Delivered paths and behavior

Only these private trees changed:

- `src/alternatives/sublimation-injection/`: `index.ts`, `scene.tsx`, `science.tsx`, `evidence.ts`.
- `tests/alternatives/sublimation-injection/`: `adapter.test.ts`, `evidence.test.ts`.
- `docs/alternatives/sublimation-injection/`: `README.md`, `numerical-evidence.json`, `PR_DESCRIPTION.md`, `HANDOFF.md`.

`index.ts` exports the existing stable `variants` and `methodModule`; descriptors remain worker-safe with no React/Three import or global registration. Adapter checks method/panel identity, compatible engine/medium, source sentinel, finite frozen-schema bounds, boolean intervention, integer seed and hot-contact domain. It passes a fresh cloned configuration to the approved shared core. A private test checks the mirrored validation bounds against every authoritative shared parameter bound, avoiding a registry/module import cycle without changing the shared schema.

`MethodCues` depicts separate solid/liquid surface preparation, explicitly unmodeled phase change and an authored contact path in the independent alternative scene. It imports none of the original scene/equipment/geometry/timeline. Pure presentation cues begin at 22.5/45/67.5 s and never advance or alter numerical state. `MethodScience` presents equations/SI boundaries, assumptions, missing coupling, provenance, a proposed unperformed empirical plan and preliminary generic costs. No shared paths/package/lock were edited.

Preview remains running at `http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1`, Vite PID **99660**, tool session 92065. The coordinator reported its separate Chrome window open. Worker A did not operate browser/UI tools; final integrated screenshots/menu/runtime review belong to the coordinator.

## Actual checks

| Command | Observed result |
| --- | --- |
| `npm ci` | Success, 149 packages. Existing install-script warnings; audit reported 1 low and 1 high vulnerability. No dependency/lock edits or audit fix. |
| `V21_CAPTURE_SUBLIMATION_EVIDENCE=1 npm test -- tests/alternatives/sublimation-injection` | **28/28 tests, 2 files PASS**, 3.26 s; captured private deterministic evidence. Earlier adapter-only run passed 25/25. |
| `npm run typecheck` | **PASS**, final separate run after source completion. |
| `npm run lint` | **PASS**, 16 inherited warnings; no new warnings in private files. |
| `npm run build` | **PASS**, final run 3.19 s; existing lucide directive / large-chunk warnings. |
| `node scripts/check-original-preservation.mjs` | **PASS**, all 57 original SHA-256 identities match `161e7a4a1f8c35765e1878c132db79977be1f5ea`. |
| `git diff --check` | **PASS**. |
| `npm test` unrestricted full run | **1793 pass / 19 timeout failures**, 1812 tests / 96 files, 103.44 s. All failures reported existing 5 s or 20 s test timeouts; no assertion mismatch. |
| `npm test -- --maxWorkers=2` | **1805 pass / 7 timeout failures**, 1812 tests / 96 files, 219.34 s. All failures were existing 5 s or 30 s timeouts; no assertion mismatch. |

Unrestricted failures were in existing coupledEngine, dryIceIntervention, firePresentation, fireProtocolRunner, peatfem-coupled, peatfem, soilParticleModel, studyAsset, studyDynamics, wideSoil, mechanics/comparison, sim/solver and physics-next/interventions/ledger tests. The two-worker rerun retained timeouts in coupledEngine, dryIceIntervention, fireProtocolRunner, soilParticleModel (two tests), wideSoil and sim/solver. All A tests passed in both runs. Resource contention/environment slowdown is suspected, not established as the sole cause; a full-suite PASS is **not claimed**. No test timeout, configuration or shared implementation was changed. The coordinator will run the final integrated suite quietly after worker deliveries. No additional full worker run is planned.

The initial private run exposed a registry runtime-import cycle; it was corrected within A's subtree before successful private checks. The first typecheck identified the installed Html entry point under drei/web; the private import was corrected. These are resolved implementation issues, not remaining failures.

## Conservation and reproducibility evidence

`numerical-evidence.json` contains the actual accepted checkpoints at physical 0, 0.5, 8, 8.5, 20, 30 and 60 s for water, separate direct CO₂ + water, and intervention-off cases. The explicit capture harness is private and ordinary test runs do not write files.

At 60 s, default water supplied 0.5 kg, direct solid use 0 kg, heat transfer 922227.3258822378 J, energy residual −2.6426278054714203e−8 J and mass residual 5.551115123125783e−17 kg. The direct CO₂ option supplied 0.5 kg water and used approximately 0.05 kg solid, with energy residual −2.6542693376541138e−8 J and mass residual 2.220446049250313e−16 kg. Source-off produced zero source use/heat and exactly matched the isolated baseline. These are numerical calorimeter ledgers, not measured fire outcomes.

Tests additionally cover separate simultaneous instances, duplication/configuration ownership, nested snapshot mutation, incompatible/unspecified thermodynamics rejection, finite small inventories, zero liquid/solid inventory, zero flow, zero UA, late arrival, zero sensible driving temperature, equal water mass shares, arbitrary output partition, monotonic/window guards and absence of feedback from presentation sampling. Optional solid contact acts only on the first specimen from physical zero; it does not compute water pre-cooling or supply oxygen.

## Evidence and limitations

Primary references and linked details appear in the in-app component and private README:

- [NIST CO₂ phase-change data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4): local sublimation latent-heat approximation near 195 K, not a pressure/tank model.
- [NIST water thermochemistry](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2) and [phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4): reference context for inherited constant water approximations; broad-range accuracy unestablished.
- [Santoso et al. (2021)](https://doi.org/10.1071/WF20117): laboratory delivery/wetting context, not validation of this module.
- [Onset manufacturer listing](https://www.onsetcomp.com/products/data-loggers/ux120-014m): $380 USD logger only, checked 2026-10-11 local; ±25% planning sensitivity is an authored assumption, not supplier uncertainty.
- [Walmart distilled water](https://www.walmart.com/ip/Great-Value-Distilled-Water-1-Gallon/17501951806): $1.44 online/US gallon, checked same date; about $0.19 consumed-water allocation per 0.5 kg assuming 1 kg/L. Minimum purchase remains one $1.44 jug; local price/availability unverified.

Capital/material examples exclude labor, shipping, factory overhead, tax and fees. Probes/software/cable and other instruments are additional; solid quotes and energy/loss data are missing. No installed total, pressure-device list or cost savings is claimed.

The actual thermal proxy is three independent 0.5 kg hot specimens with finite prescribed contact, retained liquid, exported vapor, mass/energy accounting and constant inherited properties. It lacks combustion, oxygen/fuel/reaction histories, spatial infiltration, tank pre-chilling/pressure, mechanical/permeability response and field suppression or re-ignition. Unknown medium remains a sentinel with thermodynamic execution unavailable. Neither visualization nor conservation tests constitute experimental validation.

## Integration needs

No shared API change is required. Coordinator registration/host already uses the three agreed entry points. Keep original 4.2.3 unchanged, retain finite-proxy/illustrative labels and reconcile shared cost text with the same checked assumptions. Review/merge the exact frozen final SHA supplied in the final message, then run global integration/UI/preservation checks; do not merge a moving feature tip. Any further private change requires an agreed follow-up after this freeze.
