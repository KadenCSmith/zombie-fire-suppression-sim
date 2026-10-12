# Independent second retry review — 4.2.1

**Scientific source/numerical assessment: 4.0/10; verified ≥7: no.** This is signed scored pass **3**, revision retry **2**; **one scored retry remains**. The two previous signed4.1 reviews remain preserved. Required actual-app evidence for the redesigned truck is **UNVERIFIED** because the purpose-built Chrome tool denied access. Aesthetic quality is unscored. This is an engineering assessment, not certification or experimental validation.

Frozen delivery: `b27486d5ef2bbe8311282f6e6bec2eb0cf44a38b`, branch `feature/v21-sublimation-injection`, clean tracked diff SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Changes against signed pass2 `de48568ef636dcebc89316bcf6d77d9d6df15265`: six owned source files and two maintained tests; the remaining changed files preserve/update owned review documentation. Full patch SHA-256 `9a94f5fbdeaa0cbcb593b08e14bb1e6c28c91f7d09aaacd60e81a0945d20488a`. This report does not verify a later implementation.

| Fixed criterion | Weight | Initial | Pass2 | Current | Basis |
|---|---:|---:|---:|---:|---|
| Governing physics/conservation |30%|5|5|5|Conservative finite lumped contact; absent surface outlet/transport/reaction model.|
| Medium/soil properties |20%|3|3|3|Local property approximations; uncalibrated peat/UA and missing hydraulic/reactive relations.|
| Numerics/independent validation |20%|6|6|6|Current analytical/conservation checks pass with valid reused benchmarks; no matched measured validation.|
| Method mechanism/coupling |20%|2|2|2|No computed surface sublimation-assisted outlet, pre-cooling, pressure/flow or field response.|
| Visual correspondence |10%|4|4|3|Source-only time-authored mechanism; required new actual-app evidence unavailable, criterion unverified.|

Unrounded arithmetic: `5*.30+3*.20+6*.20+2*.20+3*.10 = 4.0`. Unsupported central mechanism cap6 remains; `min(4.0,6)=4.0`. No serious conservation/SI/Kelvin/stability failure was found within tested numerical bounds. Missing required visual evidence also bars a verified pass. The4.1→4.0 change records the current evidence limitation, not a numerical physics regression. No aesthetic or label credit is included.4.2.2 remains definition-pending/outside predictive scoring.

## Identity, scope and preserved attempts

The implementer explicitly withdrew `57d9bcc7f2b3ff0ccb2bd8763513bb3d3d14f5f1` during static preparation **before any round2 tests, GUI observations or score**. Its wheel angle `travel/R` gave a backward rotation: bottom-point velocity `dx/dt+R*dθ/dt=2*d(travel)/dt`. The replacement uses `-travel/R` for all six wheels, with forward/reverse seeking regression. The withdrawn source snapshot, manifests and independent finding remain preserved; no completed review was discarded or counter reset. [Withdrawal record](withdrawn-candidate-57d9bcc.json).

A Git archive of exactb274 source/tests/package/config was inspected/executed in disposable `snapshot-b27486d/`. The local transitive closure expanded from73 to75 files for the new supply/vehicle modules. Full relevant diff and changed render paths were read, including loading, supply, vehicle, visuals, stage descriptor and host. Protected assets were not imported/extracted/copied/relabelled into the new private vehicle. All57 protected file hashes independently match original Git baseline `161e7a4a1f8c35765e1878c132db79977be1f5ea`, zero mismatches. This is source preservation evidence, not a current native-window test.

Physical core, contact adapter,0.00625s policy, defaults, contract, registry, worker and numerical UI/host call path remain unchanged. Descriptor change is stage text only; adapter validation/createRun are unchanged. Package/lock/Vite/TypeScript config and relevant installed metadata match. Eight complete package trees,2414 files, are byte-identical across current live checkout, the isolated current copy and the prior isolated environment. Existing verified dependencies were copied; no install/upgrade ran. See [frozen provenance](frozen-review-provenance.json), [source hashes](frozen-copy-sha256.json), [75-file closure](transitive-source-provenance.json), [package-content identities](dependency-content-provenance.json), [diff](diff-provenance.json) and [preservation](preservation-results.json).

Prior99 independent numerical checks retain validity under these unchanged equations/source/support/scenario/config/dependency identities. They are reused evidence, not99 newly run tests. Their exact benchmark and source digest are copied unchanged with filenames/hashes recorded in provenance: [frozen benchmark](round1-benchmark-spec.json), [current-adapter protocol](round1-retry-execution-spec.json), [prior benchmark results](round1-benchmark-results-final.json), [signed pass2](round1-report.json) and [primary-source digest](round1-primary-source-digest.md). Old-truck Chrome observations are **not** applied to the new renderer.

## Independent execution and numerical evidence

**80 tests passed across12 files in2.08s**, one worker:78 maintained affected A/scene-composition/registry/continuous-inflow checks plus the unchanged two reviewer current-adapter checks. The80 includes representative deterministic pose sweep, wheel contact direction, carried solids/rim/phase ordering, finite source/off behavior, annotation cleanup and private quench-resource tests. Unit/mocked cleanup tests are not native/GPU lifecycle evidence.

```sh
node node_modules/vitest/vitest.mjs run tests/alternatives/sublimation-injection tests/alternativeSceneComposition.test.tsx tests/alternatives.test.ts tests/alternatives-infusion-accuracy.test.ts tests/independent-realism-a-current.test.ts --maxWorkers=1
```

Executed from the isolated snapshot. [Log](independent-tests.log), [command/environment/run metadata](independent-run-metadata.json), [unchanged reviewer harness](independent-current-harness.log) and [results](current-numerical-results-final.json) are retained. The first npm invocation failed before running tests: reviewer copy dereferenced the `.bin/vitest` symlink, so relative module resolution failed. I preserved [failed log](independent-tests-attempt1.log) and [metadata](independent-run-metadata-attempt1.json), then invoked the same installed canonical Vitest module directly. No source/test/scenario/formula/tolerance/package changed. A prior setup-script `.ts`/`.tsx` filename typo was repaired only in reviewer provenance preparation. These command repairs are not implementation retries.

Runtime: Nodev26.8.2/npm11.19.1, macOS27 arm64, AppleM3Pro/Mac15,7,12 logical CPUs,36GiB RAM. One-worker load before/after the passing run was28.27/23.62/24.59. PreviewNode22/PID23895/HTTP200 are supplied implementer context; no new browser runtime proof follows. Scenario/default seed21 is unchanged; authored pose samples are deterministic.

The re-executed current results are exactly equal to signed pass2 JSON values. W1 retains3×.5kg specimens,350K initial/293.15K liquid,24W/K each,.5kg total water,.025kg/s total flow,arrival8s,samples8/8.5/9/18/28/60s. The independent continuous-inflow series and post-depletion exponential remain unchanged.

| Step [s] | Maximum temperature error [K] |
|---:|---:|
|.05|.019203044476910236|
|.00625|.0026181586201232676|
|.003125|.0013229686160229903|

Frozen.15K default/.05K refined bounds and strict error decrease pass. Current maximum absolute residuals: **2.0372681319713593e−8J** energy and **6.861178292183467e−14kg** mass. The valid reused full benchmark maximum energy residual is3.6694109439849854e−7J. Bounds remain energy≤1e−4J+1e−9×initial-energy scale and mass≤1e−9kg+1e−9×inventory scale; exact dry/post-exhaustion1e−8K and finite-phase1e−5J bounds are unchanged. At physical60s water-only remains489.04318585703544K,922134.807034599J heat; CO2+water heat remains929517.4074691252J. Off gives823.15K/zero heat/source use. Numerical verification of this lumped proxy is not field, phase-event or experimental validation.

Implementer78tests/type/lint/build/57hash/whitespace checks have verified exact provenance but are **supplied evidence**, distinct from my execution. General full-suite/type/lint/build were not independently repeated; native/production-GPU/final combined checks remain unrun here.

## Static vehicle findings; actual appearance unavailable

The source defines a new six-wheel cab/tanker, cradles, rear workdeck, pump bay, reel, lower payload and two-link loading boom. Nominal tire torus radius equals center height at y0; parked footprint lies within the original grass coordinates. Payload/boom support lower faces align to the deck within.0004 authored display units. The rigid boom remains attached with fixed1.55/1.1 link lengths in tested poses. Hose endpoints use the same transformed declared ports as the payload placement. The loading retracts before cover68.5–71.3, boost follows71.5, quench72–85/fireoff86. Bubbles begin after authored solid/water contact before closing; closure does not initiate phase change. These are code/pose facts, not observed proportions, hydraulic behavior or equipment specifications.

**Confirmed static defect A2-GEOM-1:** the pump motor intersects the front hose-reel flange. In truck-local coordinates, point `[-.95,.97,.75]` lies inside both: the flange center `[-.88,.78,.75]` gives radial distance.2024845673<.235, within its.035 thickness; the motor center `[-1.02,1.02,.68]` gives axial distance.07<.135 and radial distance.0860232527<.11. I reported this promptly. Actual perceived severity is unverified. A minor source-only detail is that the bottom boxed tread reaches y−.0045 at parked angle while nominal tire torus meets y0; no severe grounding defect is inferred. No other static hardware collision was established in this bounded review; this is not a comprehensive clearance certificate. [Detailed findings](affected-static-findings.json).

**Confirmed source plumbing issue A2-PLUMB-1:** the single continuous FILL tube passes through motor/head interiors without explicit pump inlet/outlet ports. It is not wholly disconnected: route point`[.50,1.02,-.27]` is inside the motor centered`[.43,1.02,-.27]` (axial.07<.135, radial0<.11), and next point`[.20,1.02,-.27]` equals the pump-head sphere center. Separate authored tank→pump-port→vessel segments/port markers would give a reviewable topology. No hydraulic/pressure behavior is computed, and actual visible severity is unverified. This source-only clarification was added after the first same-pass signature; the first checkpoint is preserved, source/score/counters remain unchanged.

The normal purpose-built Chrome open was denied because administrator policy could not be verified. **Zero new-truck frames, runtime/navigation observations or screenshots were obtained.** Required55/60/63/66/69/72/75/86 observations, fast0→75→0→75→4.2.2 navigation, restart/seek/remount/resize/leave and console checks are UNVERIFIED. Cab proportions, perceived grounding/supports, whole-truck visibility, tree occlusion, solids/lid readability and coherent pump/reel/hose appearance cannot be judged. No alternate browser/native/shell/indirect bypass was attempted; no application defect is inferred from the tool denial. [Verbatim policy diagnostic](browser-policy-denial.log), [status/unrun list](browser-observations.json).

## Scientific limits and stopping assessment

The prior independently retrieved primary sources remain applicable only to unchanged bounded property context. [NIST CO2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4) supports local sublimation latent approximation near195K; [NIST water phase](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4) supports the normal-boiling reference. [Water heat-capacity data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2) and [official IAPWS](https://iapws.org/technical-guidance/release/IF97-Rev) do not validate this constant-property proxy over a broad range. [Santoso et al.](https://doi.org/10.1071/WF20117) motivates wetting/contact/channeling transport, not matched A calibration. Sources were not redundantly reopened this retry; exact prior digest/hash is preserved.

The scientific blockers remain conservative finite surface solid/liquid and gas-export enthalpy states, a computed liquid-outlet mass/enthalpy seam debited once downstream, supported abstract pressure/flow boundary coupling, measured porous-peat thermal/hydraulic/reactive data and matched held-out validation. Suppression/re-ignition requires supported oxygen/fuel/moisture/reaction histories. Current MethodSceneProps carries onlyid/time; authored loading/flow/quench and host fireoff86 do not consume calculated surface/outlet/soil states. Detailed needs are in [machine report](report.json).

Finish below7 is warranted. The unchanged central data/mechanism/interface gaps and missing required current browser evidence prevent a verified pass; remaining budget must not force one through labels or artwork. One scored retry remains. Any later substantive implementation/review consumes it; exact source/dependency reuse after docs-only packaging is a provenance check, not a reset/new score. Integration/release/final combined/native checks remain coordinator-owned.

Signed: `/root/realism_a_review`, 2026-10-12T09:30:44.476929+00:00. Read-only implementation review; outputs confined to ignored nested runtime. No new top-level project/output folder was created, so Finder tagging does not apply.
