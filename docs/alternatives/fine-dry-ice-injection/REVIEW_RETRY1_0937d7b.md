# Agent D independent realism review — implementation retry1

**FAIL, exact unrounded weighted5.1/10.** Frozen final source `0937d7b60db98d1ef1ed544bd745660c10e94f7c`; original candidate `4d780df7d8ef963d1abc95ff4c8f5486782586af`. All D source/tests/docs bytes are identical between these freezes; changed shared seams and imported closure were audited. Reviewer `/root/d_realism_reviewer` independently executed private checks in disposable archives. No source edits, delegation or browser workaround.

Initial audit85f49eb scored1.3 and remains preserved. **Counters: initial1/1 + retry1/3 =2/4 scored passes;2 retries remain.** Same frozen criteria SHA256`e9f4409dd874714ae06d12834f48c54c4bdf67c0e1c412866d37236fdf99f31d`. This failing candidate is not replaced by a target score. Central unsupported coupling cap6 applies; raw5.1 remains5.1.

| Criterion | Weight | Score | Basis |
|---|---:|---:|---|
| Governing physics and conservation |30%|7|Credible restricted enthalpy/conservation surrogate, independent sphere/two-capacity/finite-bath references; no physical film validation.|
| Medium/soil properties and constitutive behavior |20%|3|Assumed lumped warm specimen/UA/cp; no measured peat transport, deposition, local ice or spatial constitutive coupling.|
| Numerical verification and independent validation |20%|5|Strong default/control balances and asymptotic checks; admitted short-lived delivery case has100% entry error and no warning/rejection; no empirical validation.|
| Method-specific mechanism and coupling |20%|5|Particles age in source/transit and sublimation is localized; entrainment/residence/underground placement remain prescribed and unvalidated.|
| Visual correspondence to computed states |10%|4|Accepted-state SVG mass/size/release mapping verified in source; actual candidate UI could not be inspected.|

Exact sum `(30×7+20×3+20×5+20×5+10×4)/100=5.1`.

## Gates and substantive fix required

Weighted≥7 **false**; actual independent UI **unverified/false**; all required evidence **false**. No serious unit, mass/energy or nonfinite/negative instability was observed in the executed default/control cases. That is **not** a global stability claim. Separately, accurate delivery across validator-admissible numerical inputs **fails** due to the following source-fixable resolution defect. It must not be attributed to missing experiments.

**Underresolved active withdrawal produces a false exact zero.** A validator-admissible analytical edge uses10µm diameter, k_eff0.6W/(mK), withdrawal start0, zero prescribed hose/probe residence, and even minimum phase dt0.0003125s / parcel interval0.0125s. Production delivers exactly0 solid kg because its first right-endpoint dispatch occurs after all source particles disappear. An independently derived continuous-flow finite-bath RK4 reference gives **8.7349148326383636e-08kg** entry, with reference-step sensitivity **2.977e-19kg**. Relative entry error is−100%. This is a mathematical diagnostic within the same surrogate, not apparatus instructions or empirical delivery evidence. Full configs/commands are in `short-life-edge.mts` and `short-life-edge-results.json`.

A meaningful correction should reject or explicitly make solid-entry unavailable when active withdrawal overlaps particle survival that the phase/parcel resolution cannot resolve. An onset-only screen using actual aged-source r²/temperature and finite-bath energy gap can bound its numerical domain without imposing survival. Intersect the grid with withdrawal onset; reject before accepting a result. Do not repeatedly reject every resolved run near final extinction. A screen threshold is not proof of accuracy for every allowed input. The legitimate delayed source-loss default and resolved film example must remain accepted; matched controls, atomic failed advance, and this edge require independent retry2 checks. Numeric size edits also retain the default literal100µm provenance text; a generic configured-size description or corresponding update avoids contradictory exports.

## Independently verified behavior

The default100µm conduction case correctly delivers **zero solids** and sublimes0.01kg upstream. Gas and cold-water enthalpy are carried underground; underground sublimation remains0. The film-resistance case conditionally delivers **0.000841320274154137kg** at default resolution, then sublimes that inventory underground. Continuous source aging prevents later water batches from receiving reset/renewed solids. A4s withdrawal delay in the same film sensitivity deliverszero. These results remain conditional on prescribed entrainment, not verified aqueous/peat transport.

Across5 scenarios×13 times, reviewer independently reconstructed every compartment H from water/gas masses and temperatures and recomputed closed-system totals: max water/CO2 mass residual **1.0325074129013956e-14kg**; max absolute energy residual **7.4505805969238281e-09J**; max relative energy residual **1.3711466724553067e-14**; max compartment H reconstruction difference **1.7462298274040222e-10J**. These satisfy unchanged mass1e−10kg and energy1e−9relative tolerances. Release mass and latentJ reconcile with upstream/underground totals; underground sublimation+remaining solids equals actual cumulative solid entry. Water/CO2 inventories remain finite/nonnegative in executed cases. Oxygen, pressure, extinction and penetration remainnull; no air/O2 mixture is solved or credited.

Independent analytical sphere values satisfy frozen1e−10relative tolerance over10–500µm and k0.0006–0.6; signed/long-time two-capacity exchange conserves energy without overshoot. Independently derived finite-bath r² ODE integrated with RK4 at1e−5s shows shrinking production phase errors under successive refinements for0.3/0.9/1.5s. Pre-sublimated reference is291.5859729588857K, using same water enthalpy; no second latent spend. Zero particles exactly match water-only; off retains all source inventory/no exchange; empty/depleted source and nondivisible last parcel remain bounded. Finite withdrawal matches continuous supply within the disclosed one-parcel right-endpoint error. Bulk freezing and out-of-domain hot inputs reject; failed advance preserves last accepted state. Cloned input/snapshot isolation, independent instances, deterministic replay, cadence independence, stale-record rejection and persistence checks pass.

## Convergence limits — failed coarse diagnostic preserved

The first independent harness returns11pass/1fail. The failed assertion demanded that changes shrink across **every** coarse time level0.02→0.01→0.005s. Entry increments grow4.40e−9→7.16e−9→8.75e−9kg as event boundaries subdivide differently. This failure is retained verbatim in `independent-results.json`; no criterion/tolerance or product source was changed. All time-refined outputs nevertheless approach the same direction. Asymptotic differences from default0.005 through0.0003125s halve and meet the unchanged2% tolerance, separately recorded in `asymptotic-supplement-results.json`.

Independent continuous prescribed-flow solid-entry integral is **0.0008536293654834089kg** for the film example; RK4 step1e−5 versus2.5e−6 changes this by3.871e-17kg. Parcel intervals0.1/0.05/0.025/0.0125s have relative errors5.7071%/2.8715%/1.44005%/0.72115%. Thus **default parcel0.025s meets2% for this example**; coarse admitted parcels do not. Default dt0.005 versus finest changes entry by1.94935e-05relative and peat temperature by2.04567e-08relative. No global accuracy/stability claim covers every allowed size/residence/time/parcel setting; the short-life counterexample proves that a numerical domain guard is needed.

## Source, shared seams and actual UI evidence

Read every D source/test/doc file, source-free9a7350c/44aa38f contract/READY, and affected registry/module/model/contract/persistence/records/worker/App/comparison/presentation seams. D optional settings/state and index4 registration preserve previous indices. Shared worker ID/current-worker checks, cloned state, stale export invalidation and lifecycle remain applicable; initial general UI evidence is not reused for changed candidate interfaces.

Final0937 shared delta correctly relabels D temperature as current specimenK, water as cumulative ground entry, CO2 as total sublimated and heat as peat extraction; particle carrier medium no longer says contact proxy. Generic contact/FEM match buttons are disabled when particle panels are present, and their fairness text no longer reports particle water aszero. B changes are separate; D private bytes are identical and15 independently compared scenario/target accepted states are byte-for-byte equal from original to final freeze (`final-identity-reuse-results.json`). This justifies numeric reuse, not UI reuse.

Actual candidate UI **not attempted/unverified** after the reported administrative policy verification denial and coordinator instruction forbidding browser/Electron/CDP/indirect workarounds. No workaround was attempted. Initial85f49eb screenshots apply only to that initial audit. Read-only source correspondence confirms circle area∝accepted solid inventory, explicit enlarged/not-to-scale labels, compartment rather than penetration geometry, accepted mass-weighted sizes, release intervals and null unsupported fields. This does not meet actualUI gate.

D-owned tests independently13pass/0fail. Final affected shared subset **32pass/3fail**; all3 failures are coordinator-owned stale D-placeholder assertions (access=false, unavailable worker init, pending-model message). Their complete outputs are preserved; general full-suite/build/type/lint claims from implementer/coordinator are not relabeled independent execution. Original57hash guard independently passes161e7a4. No dependencies installed or source changed.

## Reproducibility and limitations

`provenance.json` and source/dependency manifests record both exact commits/trees, all owned source hashes, lock/package/runtime binaries, frozen rubric, CPU/OS, complete scenario seeds/windows/numerics, executor/run identities and dependency reuse. Installed non-cache dependency files were rehashed: changed since initial audit=0. Initial audit/report/signature remain preserved. Private outputs are review evidence only.

Commands executed:

```text
node node_modules/vitest/vitest.mjs run tests/alternatives/fine-dry-ice-injection --maxWorkers=1 --reporter=json --outputFile=/tmp/agent-d-independent-review/retry1/owned-tests.json
node_modules/.bin/esbuild /tmp/agent-d-independent-review/retry1/independent-checks.mts --bundle --platform=node --format=esm --outfile=/tmp/agent-d-independent-review/retry1/independent-checks.mjs
node /tmp/agent-d-independent-review/retry1/independent-checks.mjs
node_modules/.bin/esbuild /tmp/agent-d-independent-review/retry1/asymptotic-supplement.mts --bundle --platform=node --format=esm --outfile=/tmp/agent-d-independent-review/retry1/asymptotic-supplement.mjs
node /tmp/agent-d-independent-review/retry1/asymptotic-supplement.mjs
node_modules/.bin/esbuild /tmp/agent-d-independent-review/retry1/short-life-edge.mts --bundle --platform=node --format=esm --outfile=/tmp/agent-d-independent-review/retry1/short-life-edge.mjs
node /tmp/agent-d-independent-review/retry1/short-life-edge.mjs
node_modules/.bin/esbuild /tmp/agent-d-independent-review/retry1/final-identity-reuse.mts --bundle --platform=node --format=esm --outfile=/tmp/agent-d-independent-review/retry1/final-identity-reuse.mjs
node /tmp/agent-d-independent-review/retry1/final-identity-reuse.mjs
node scripts/check-original-preservation.mjs
node node_modules/vitest/vitest.mjs run tests/alternatives.test.ts tests/alternatives-worker.test.ts tests/alternatives-records.test.ts tests/alternatives-host.test.tsx tests/alternativeSceneComposition.test.tsx tests/alternatives-presentation.test.ts --maxWorkers=1 --reporter=json --outputFile=/tmp/agent-d-independent-review/retry1/final-affected-shared-tests.json
```

Primary-source evidence from initial review remains applicable because the exact implemented property values match it: [NIST CO2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=24), [IAPWS water domain](https://iapws.org/technical-guidance/release/LiquidWater), [Purandare2023 primary paper](https://ris.utwente.nl/ws/files/320947389/1-s2.0-S0735193323004311-main.pdf).195K is a restricted saturated-vapor assumption; density/gas cp/peat cp and UA are study assumptions. Film/ice-shell/blockage, slip/entrainment, filtration/peat penetration, liquid/spatial wetting, gas/O2/boundary exchange and combustion/reheating remain unvalidated or unavailable. Numerical verification and labels do not establish experiments or delivery feasibility.

Proceed with the substantive resolution correction and unchanged-criteria retry2; do not use cosmetic retries to force7. Even after numerical correction, central empirical coupling and independentUI evidence gaps can still require a bounded stop below7.
