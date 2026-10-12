# Independent first retry review — 4.2.1

**Scientific score: 4.1/10; verified ≥7: no.** This is scored pass **2** (initial audit plus revision retry **1**); two scored retries remain. Reviewer `/root/realism_a_review` replaces the unavailable initial reviewer without resetting counters. The signed initial 4.1 audit and unscored interim numerical recheck remain preserved. No implementation changes were made by this reviewer. Scores are engineering assessments, not certification or experimental validation.

Frozen reviewed delivery: `de48568ef636dcebc89316bcf6d77d9d6df15265`, `feature/v21-sublimation-injection`, clean/empty tracked diff SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; ordinary merge base `d07d03fe54b453677c2cd8684e8e2c5eb97112a6`. The actual private delta is **14 owned files**. Candidate `303a594` and its provenance were preserved but never scored. PR21 identifies this frozen delivery. Subsequent human-requested truck changes are outside this review and require their own affected-evidence review/counter accounting.

| Fixed criterion | Weight | Initial | Retry | Basis |
|---|---:|---:|---:|---|
| Governing physics/conservation |30%|5|5|Finite conservative contact; no surface outlet/transport/reaction model.|
| Medium/soil properties |20%|3|3|Local constants supported; peat/UA uncalibrated and hydraulic/chemical relations absent.|
| Numerics/independent validation |20%|6|6|Frozen analytical checks pass; smaller step improves accuracy. No measurements or matched validation.|
| Method mechanism/coupling |20%|2|2|No computed sublimation-assisted preparation, pressure/flow, or field response.|
| Visual correspondence |10%|4|4|Current readouts agree; successful own runtime checks. Treatment movie still time-authored.|

Unrounded arithmetic is `5*.30+3*.20+6*.20+2*.20+4*.10 = 4.1`. The unsupported central-mechanism cap **6** remains; final score `min(4.1,6)=4.1`. No serious conservation, SI/Kelvin or numerical-stability failure was found within tested bounds. No aesthetic or labeling credit is included. 4.2.2 remains definition-pending and outside scoring.

## Identity, isolation and valid reuse

An immutable Git archive of source/tests/config was byte-copied into `snapshot-de48568/` for disposable audit execution. The initial frozen benchmark and independent test were copied unchanged; original evidence was not overwritten. Existing isolated interim dependencies were copied with their own writable cache rather than reinstalled. Package/lock/config identities and relevant installed React/Three/Fiber/Drei/Vitest/Vite/TypeScript metadata hashes match the exact local provenance. Node v26.8.2/npm11.19.1 ran on macOS 27 arm64, Apple M3 Pro,12 logical CPUs,36 GiB RAM. One-worker runs started with load averages20.11/26.11/29.95 and21.37/25.99/29.82. Resource/command records are included.

The review traced a 73-file local transitive import closure from numerical and render entry points. The unchanged protected contact core, property/equation definitions, v21.2 interface, registry/defaults, solver worker and host preserve valid initial evidence; changed shared timestep policy was independently re-executed, and changed presentation/annotations inspected afresh. Parent local checks74 tests/type/lint/build are hash-verified **supplied evidence**, distinct from my execution. All 57 protected files were independently hashed against Git baseline `161e7a4a1f8c35765e1878c132db79977be1f5ea`: **zero mismatches**. Protected implementations were neither modified nor extracted/relabelled as new product code.

Detailed identities: [frozen provenance](frozen-review-provenance.json), [source closure](transitive-source-provenance.json), [preservation](preservation-results.json), [original benchmark](benchmark-spec.json), [retry protocol published before execution](retry-execution-spec.json).

## Critical independent execution

**99 tests passed across 14 files.** Run1 passed 97 tests/13 files in 2.34 s; my newly authored current-adapter test file had a declaration typo and failed transformation before executing. I preserved that failed command/log, corrected only the isolated reviewer harness, and reran only its previously unexecuted 2 tests: PASS in .251 s. No implementation, scenario, formula or tolerance changed. This command repair is not another substantive revision or scored pass.

Commands, from `snapshot-de48568/`:

```sh
npm test -- tests/alternatives/sublimation-injection tests/alternatives-contact-adapter.test.ts tests/alternatives-infusion-accuracy.test.ts tests/contactCooling.test.ts tests/alternativeSceneComposition.test.tsx tests/alternatives.test.ts tests/independent-realism-a.test.ts tests/independent-realism-a-current.test.ts --maxWorkers=1
npm test -- tests/independent-realism-a-current.test.ts --maxWorkers=1
```

The original W1 exact continuous-inflow series and post-exhaustion exponential were retained. Inputs:3×.5kg specimens,350K/293.15K,24W/K each,.5kg total water,.025kg/s total flow,arrival8s,samples8/8.5/9/18/28/60s. Same source support and no boiling. Current actual A adapter agrees with the same direct-reference.00625 s result. Additional finer-step check extends the original benchmark without weakening it:

| Step [s] | Maximum temperature error [K] |
|---:|---:|
|.05|.019203044476910236|
|.00625|.0026181586201232676|
|.003125|.0013229686160229903|

The frozen.15K default/.05K refined bounds and strict decrease pass. Unchanged initial exact dry-exchange, finite exhaustion, conditional post-depletion, complete-vaporization energy budget, off/no-inventory/no-flow/no-UA/late/equal-temperature and materially different inlet/initial/source cases also pass. This verifies a lumped numerical proxy; no spatial mesh exists, and no finite-UA phase-event accuracy or experimental validation is inferred.

Across both independent result files, maximum absolute residuals were **3.6694109439849854e−7J** energy and **6.861178292183467e−14kg** mass. Frozen bounds remain energy≤1e−4J+1e−9×initial-energy scale and mass≤1e−9kg+1e−9×inventory scale. At physical60s, water-only gives489.04318585703544K,922134.807034599J heat,−2.0372681319713593e−8J and2.0095036745715333e−14kg residual. Direct CO2+water gives929517.4074691252J heat,−1.9441358745098114e−8J and2.0261570199409107e−14kg residual. Off gives823.15 K/zero source use and heat. Implementer capture matches these independently produced states.

Evidence: [frozen results](benchmark-results-final.json), [current results](current-numerical-results-final.json), [first attempt log](independent-tests-attempt1.log), [current file log](independent-tests-current.log), [run metadata](independent-run-metadata-attempt1.json), [repair/rerun metadata](independent-current-run-metadata.json).

## Actual application and separate aesthetic observations

Normal purpose-built CUA independently opened Chrome tab 862380283 at the frozen 5174 preview. Accepted 55/60/63/66/69/72/75/86 s were observed. The rim, open cover and attached side-loader render; the bucket lifts above the rim, tips, releases solids and retracts. Solids/bubble cues are visible before closure. The cover visibly closes at 69 s and is closed at 72 s, before the later faster-flow/quench sequence. At 75 s the scene, sprite and quench render; at 86 s authored fire is absent. **Aesthetic limitation:** the default foreground tree partly obscures the upper loader/individual solids. The bottom quarter-stage caption already says “Illustrative flow + quenching” at 69 s while the correct owned sprite says “Closing lid”; actual boost starts71.5s and quench72s. These are presentation observations, not computed pressure or treatment evidence.

Fast0→75→0→75→simulation menu→4.2.2 reached its definition-pending route without error. A remount, 75 s resize 1024×768, restored viewport,Restart→accepted0,and leaving comparison→4.2.2 also succeeded. Own final tab error logs were empty; no black scene or removeChild was reproduced. This limited development-browser reproduction does **not** establish the historical error's root cause or the final combined/native/production-GPU gate. One earlier reset occurred during creation of audit copies, accompanied by repeated initialization/extension warnings; possible watch reload remains unconfirmed and is not graded as an app defect. Final observations followed setup and were completed before parent began any next visual change.

The actual A-only computed comparison initially showed823.15 K/zero source/heat. At60s it showed489.04 K,.500kg water,9.22e5J,−2.04e−8J/2.01e−14kg residual; all three SVG specimens showed489.0 K/.167kg received. Untreated panel remained0s/823.1 K/zero water. O2/fuel/reaction stayedN/A. Display precision agrees with independently computed states. No FPS, leak-free memory measurement or zero-job instrumentation claim is made.

[Detailed browser observations and limits](browser-observations.json). Annotation creates a fresh unattached CanvasTexture in each layout-effect setup, binds/disposes the captured material/texture and clears only a matching binding. Source plus replay tests support removal of this private portal path; no root-cause claim follows. Surface effects still consume only authored `time`; the public host still hides fire at 86 s. They do not consume computed bucket/outlet/soil states.

## Primary sources and remaining blockers

The [independent source digest](primary-source-digest.md) records narrow retrieval provenance. [NIST CO2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4) supports a local25.2kJ/mol sublimation approximation near195K. [NIST water phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4) supports the normal-boiling reference, while [water thermochemistry](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2) provides temperature-dependent heat capacity rather than the implemented constant. [Official IAPWS](https://iapws.org/technical-guidance/release/IF97-Rev) describes property formulations this proxy does not implement. [Santoso et al.](https://doi.org/10.1071/WF20117) identifies peat wetting/channeling/contact effects; its measurements are not matched validation for A. [NIOSH](https://www.cdc.gov/niosh/npg/npgd0103.html) lists colorless CO2 and relative gas density1.53; it does not validate visible fog particles or their motion. The new J.Chem.Educ. DOI could not be opened through the web tool and receives no independent evidentiary credit.

Exact scientific needs remain:

- Additive finite surface solid/liquid state with initial temperatures/loading history, defensible area/UA/ambient losses, phase/freezing bounds, gas export enthalpy and a conservative computed liquid-outlet mass/enthalpy seam. Downstream delivery must debit that same outlet once.
- Supported abstract source/pressure-to-flow boundary coupling and independently validated material/domain/boundary inputs; none is calculated here. No containment/trigger/device construction or destructive-pressure optimization is part of this review.
- Conservative water/CO2 transport into reacting porous peat with stated geometry, density/porosity/moisture basis, measured retention/relative permeability/permeability, thermal/reaction properties and uncertainties.
- Held-out matched thermal/mass/evaporation measurements. Suppression/reignition requires supported oxygen/fuel/moisture/reaction histories over a stated observation window.
- An additive accepted-state visual seam; current MethodSceneProps only carriesid/time. Current authored phase,flow and quench cannot establish physical correspondence.

General full suite/type/lint/build were not independently rerun; exact local reports are supplied evidence. Native/production-GPU/final combined checks and experiments remain unrun here. Current corrections support numerical accuracy and artwork/lifecycle robustness but offer no supported scientific path to≥7 with present data/seams. Preserve the honest below7 result; future artwork changes must retain the cap and retry accounting.

Signed: `/root/realism_a_review`, independent read-only reviewer, 2026-10-12T08:44:27.250177+00:00. Outputs confined to ignored nested runtime directory. No new top-level project/output folder was created, so no Finder-tag attempt applies.
