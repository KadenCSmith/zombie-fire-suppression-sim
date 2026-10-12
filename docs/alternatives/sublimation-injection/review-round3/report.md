# Independent final retry review — 4.2.1

**Final scientific assessment: 4.0/10; verified≥7: no.** Scored pass **4**, revision retry **3**, is complete. **Budget exhausted; zero retries remain.** Current visual/application evidence is UNVERIFIED under the unresolved Chrome administrator-policy denial. No aesthetic score is assigned. This is an engineering assessment, not certification or experimental validation.

Reviewed frozen delivery: `a0e0826db17d8e06dfc79fa6baeb6850bb9ab383`, branch`feature/v21-sublimation-injection`, clean tracked diff SHA-256`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Delta from signed pass3`b27486d5ef2bbe8311282f6e6bec2eb0cf44a38b`: three private source files and one maintained test; other changes preserve/update owned review documentation. Full patch SHA-256`70f52aeb7637e5893c5824ea6b8badb7483f5e667f8f905e6fb006810528d280`. No implementation edits or delegation by this reviewer.

| Fixed criterion | Weight | Initial | Pass2 | Pass3 | Final | Basis |
|---|---:|---:|---:|---:|---:|---|
| Governing physics/conservation |30%|5|5|5|5|Conservative finite contact; missing surface outlet/transport/reaction model.|
| Medium/soil properties |20%|3|3|3|3|Local property approximations; unmeasured peat/UA and absent hydraulic/reactive relations.|
| Numerics/independent validation |20%|6|6|6|6|Independent analytical/conservation evidence remains valid; no matched measured validation.|
| Method mechanism/coupling |20%|2|2|2|2|No computed surface sublimation-assisted outlet/pre-cooling/pressure/field response.|
| Visual correspondence |10%|4|4|3|3|Source-only authored mechanism; required affected actual-app observations unavailable, unverified.|

Unrounded arithmetic`5*.30+3*.20+6*.20+2*.20+3*.10 = 4.0`; unsupported central-mechanism cap6 remains, final`min(4.0,6)=4.0`. No serious conservation/SI/Kelvin/stability failure was found within frozen tested numerical bounds. Missing required current visual evidence also prevents a verified pass. No scientific credit follows from rearranged hardware, labels or artwork.4.2.2 remains definition-pending/outside predictive scoring.

## Changed source and independent affected checks

The final source moves the pump bay to truck-local`[-1.75,.89,.64]`, behind the reel, and defines separate inlet(+Z)/outlet(+Y) fittings. The truck-local tank→pump inlet hose moves with the arriving truck; the distinct pump outlet→vessel hose is staged only after parking. Both fittings intersect the pump head at their roots and meet the declared hose endpoints. The new private ServiceHose owns a per-route memoized curve/TubeGeometry, layout draw range and disposal effect. This supports intended source ownership, not observed GPU/StrictMode behavior.

The prior source defects **A2-GEOM-1** and **A2-PLUMB-1** are resolved within the inspected primitive/route scope. Complete pump maximumX−1.53 and reel-base minimumX−1.12 leave.41 authored display units of X separation. Separate hoses no longer pass through the motor/head as the former continuous line did; intentional inlet/outlet head contact remains. These coordinates are artwork, not equipment specifications or calculated pressure/flow.

**81 independent tests passed across12 files in2.33s**, single worker:79 maintained affected tests plus two independently authored geometry/topology checks. The maintained checks cover current loading/ports/poses, wheel contact direction, source-off/conservation/contact accuracy, annotation/private quench lifecycle, scene composition and registry/isolation. The new reviewer checks use analytical signed distance to finite motor and flange cylinders,10001 arc-length points per actual Catmull-Rom route and539 actual TubeGeometry vertices per route. They also check moving-feed/staged-feed component wiring and fitting-root contact. No formula/scenario/tolerance was fitted to output.

| Route | Obstruction | Minimum sampled centerline clearance after.036 hose radius | Minimum actual vertex distance |
|---|---|---:|---:|
|Tank→pump|Motor|.0560355362|.0573369773|
|Tank→pump|Flange1|.1089756188|.1094095503|
|Tank→pump|Flange2|.1583210484|.1584370816|
|Pump→vessel|Motor|.0881974235|.0994064899|
|Pump→vessel|Flange1|.6059895437|.6119662170|
|Pump→vessel|Flange2|.7052682201|.7068850951|

These finite samples/vertices and inspected primitives are not a comprehensive continuous all-mesh collision certificate or actual appearance evidence. Minor unchanged parked boxed-tread penetrationy−.0045 remains a source detail; perceived grounding is unverified. No other new actionable source failure was identified in the changed scope. Loading, individual solid/contact cues, returned loader before cover68.5–71.3, boost71.5, quench72–85/fireoff86 remain unchanged authored timing. No pressure/transport/suppression computation follows.

Command from isolated`snapshot-a0e0826/`:

```sh
node node_modules/vitest/vitest.mjs run tests/alternatives/sublimation-injection tests/alternativeSceneComposition.test.tsx tests/alternatives.test.ts tests/alternatives-infusion-accuracy.test.ts tests/independent-realism-a-geometry.test.ts --maxWorkers=1
```

[Log](independent-tests.log), [run metadata](independent-run-metadata.json), [independent harness](independent-geometry-harness.log), [geometric results](independent-geometry-results.json), [static findings](affected-static-findings.json) and [protocol published before execution](review-plan.json). No reviewer execution failure occurred this pass. The implementer's supplied pre-freeze first route failed its unchanged flange bound and was rerouted before freeze; this is preserved in local provenance, not a discarded scored review.

## Identity, preservation and numerical reuse

The exact Git archive was inspected/executed in an isolated disposable copy with copied verified dependencies; no install or upgrade ran. A75-file transitive render/numerical import closure was checked. Only supply/vehicle/visuals and supply test differ from signed pass3. All57 protected files independently match original Git baseline`161e7a4a1f8c35765e1878c132db79977be1f5ea`, zero mismatches. No protected asset extraction/copy/relabeling occurred. All37 prior signed evidence artifacts plus the signature manifest are byte-identical in the owned review-round2 archive. Prior audits, unscored withdrawal and failures remain preserved.

Numerical core/contact adapter/defaults/worker/API/registry,0.00625s policy, package/lock/config and relevant runtime dependencies remain unchanged. Eight complete package trees/2414 files match the current live checkout, current isolated copy and signed pass3 environment. [Frozen provenance](frozen-review-provenance.json), [source hashes](frozen-copy-sha256.json), [75-file closure](transitive-source-provenance.json), [dependency identities](dependency-content-provenance.json), [preservation](preservation-results.json), [prior signed artifact verification](prior-report-preservation.json), [diff](diff-provenance.json).

Only the unchanged physical analytical/conservation findings from the prior99-check audit and exact independently re-executed pass3 adapter results are reused. Its affected old renderer findings do not become current evidence. Current maintained contact/inflow checks ran, but unchanged full numerical experiments were not needlessly repeated. No benchmark/tolerance changed. [Frozen spec](reused-benchmark-spec.json), [adapter protocol](reused-retry-execution-spec.json), [initial results](reused-initial-benchmark-results.json), [latest independent physical results](reused-current-numerical-results.json).

W1 remains3×.5kg specimens,350K initial/293.15K liquid,24W/K each,.5kg total water,.025kg/s total flow,arrival8s, samples8/8.5/9/18/28/60s. Independent continuous-inflow/post-depletion solutions give maximum errors.019203044476910236K at.05s,.0026181586201232676K at.00625s and.0013229686160229903K at.003125s. Frozen.15K default/.05K refined bounds and strict error decrease remain valid.

Latest unchanged current-adapter maximum absolute residuals are2.0372681319713593e−8J energy and6.861178292183467e−14kg mass; the valid original full benchmark maximum energy residual is3.6694109439849854e−7J. Tolerances remain energy≤1e−4J+1e−9×initial-energy scale, mass≤1e−9kg+1e−9×inventory scale, exact dry/post-exhaustion1e−8K and finite-phase1e−5J. These verify the bounded lumped proxy, not surface-source/porous-field behavior or experimental validity.

Runtime: Nodev26.8.2/npm11.19.1, macOS27 arm64, AppleM3Pro/Mac15,7,12 logical CPUs,36GiB RAM. One-worker load before/after was29.68/27.55/26.80; scenario/default seed21 unchanged, authored samples deterministic. Exact supplied local79tests/type/lint/build3.31s/57hash reports are identity-verified, distinct from reviewer execution. Source/test/nonlog-doc whitespace checks are supplied PASS; immutable historical logs retain two trailing-whitespace/two EOF findings and were not rewritten. General full suite/type/lint/build, native/production/final combined checks were not independently run here.

## Required current appearance/runtime evidence remains unavailable

The prior purpose-built Chrome administrator-policy verification denial is unresolved. As instructed, **no browser retry or alternate/native/shell route was attempted** this pass. Zero current app frames/runtime checks/screenshots were obtained. Whole-truck visibility, proportions, grounding/supports, tree occlusion, actual boom/solid/lid readability and service-truck coherence remain unverified. Actual55/60/63/66/69/72/75/86 observations, fastseek/navigation, restart/remount/resize/leave and console/GPU checks remain unrun. No app failure is inferred from the tool denial, and prior old-truck observations do not verify the redesigned renderer. [Current status](browser-status.json), [verbatim prior diagnostic](prior-browser-policy-denial.log).

## Remaining scientific limits and final status

The unchanged bounded property assessment retains the independently retrieved [primary-source digest](reused-primary-source-digest.md). [NISTCO2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4) supports a local latent approximation near195K; [water phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4) supports a normal-boiling reference. [NIST heat capacity](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2) and [IAPWS](https://iapws.org/technical-guidance/release/IF97-Rev) do not validate broad constant-property accuracy. [Santoso et al.](https://doi.org/10.1071/WF20117) motivates missing wetting/contact/channeling transport, not matched A calibration. No redundant new research ran.

Missing scientific needs remain conservative finite surface solid/liquid/gas-export states and liquid-outlet mass/enthalpy seam, supported abstract pressure/flow boundary coupling, measured porous-peat thermal/hydraulic/reactive data, held-out matched validation and an accepted-state render seam. Currentid/time props and authored fireoff86 do not consume calculated surface/outlet/soil states. Suppression/re-ignition requires supported oxygen/fuel/moisture/reaction histories. [Machine report](report.json) records the exact blockers and unrun gates.

The honest result remains below7. **All four scored passes/three retries are now used; stop the scientific revision loop.** Preserve the budget and limitations. Exact docs-only packaging may receive a source/dependency identity reuse check without a new scientific score. Integration/release and final combined/full/native/production gates remain coordinator-owned and pending.

Signed:`/root/realism_a_review`, 2026-10-12T09:42:22.268588+00:00. Outputs confined to ignored nested runtime folders; no new top-level project/output folder was created, so Finder tagging does not apply.
