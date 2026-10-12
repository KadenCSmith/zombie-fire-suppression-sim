# Original 4.2.3 preservation audit

Status: **PRESERVATION VERIFIED.** The user explicitly approved the prepared restoration. The two protected source files were restored to their verified original bytes, and additive App routing now selects original 4.2.3. All 57 protected hashes match. New alternative work remains external; original files are read-only again for all agents.

## Verified identity and history

The original is `src/ui/FireSequenceWorkspace.tsx`, calling `FireSequenceScene` with `realistic straightBore cinematic connectedSupply`. Commit `161e7a4a1f8c35765e1878c132db79977be1f5ea` introduced the V20 cinematic interface/connected-supply presentation and declares application version 0.20.0. Every protected path recorded in `original-preservation.json` is byte-identical between that commit and inherited commit `4b2088e926662aee357cde680f2b22c4fbf24f79`. Neither commit is a reset target. The user clarified that this original represents base 4.2.3.

The complete per-file SHA-256 manifest covers 57 original files: scene/workspace, procedural equipment/tree-context references, story timing/appearance/contact model, original experiment worker/runner, original CSS, source contracts/results, historical assets and render-construction scripts, and original regression tests. The separately listed 20 shared dependencies are not blanket permission to alter original behavior. `ModelSelector.tsx` is the only changed imported shared dependency, and the workspace imports its `PhysicsWorkspace` as a type only. AppChrome, App routing, global CSS and version metadata are additional shared integration surfaces; existing header changes remain separately permitted by the user's earlier request.

## Exact prior changes, before restoration

All changes below were authored in Version21 commit `eae833684ec41475eb6f84e642e6b06c5c350714`, before the clarified protection. The full patch is retained in `prior-original-changes.patch`.

- `src/ui/FireSequenceScene.tsx`: added AlternativeMethodCues/methodPresentation/VariantId imports; extended SceneProps with optional `alternative`; selected `contextTime` from the new presentation hook; passed that value to ground, aggregates, grass, tree and fire; added an alternative-only group with authored excavator vibration/private cues, bypassing source/cap/truck/tracer/pressure/fracture/water groups in that branch. Camera implementation and existing no-alternative props were not edited. The original workspace did not pass `alternative`, and prior smoke checks passed, but the protected scene file itself was changed.
- `src/story/contactCooling.ts`: appended 17 lines exporting `createContactCoolingSession`, using private validate/initialState/advance functions. Original functions/constants/cache were not edited. The file nonetheless differs from the original and must not serve as the preservation baseline.
- `src/App.tsx` (permitted integration surface): associated the original workspace with `sublimation-injection`, and routed `pressure-pulse` into a newly authored 90-second AlternativeRenderWorkspace. This misidentified/replaced the original 4.2.3 selection. Correct mapping is original workspace under `pressure-pulse`, with new alternatives separate.

No original assets, source contracts, cached fields/results, timing files, camera code, defaults, original-only worker/solver, or original regression tests were changed. `docs/review/peat-fem/native-smoke.json` changed only the timestamp in a separate FEM check; it is not the original fire sequence's result baseline.

## Specifically approved restoration completed

Restored only `src/ui/FireSequenceScene.tsx` and `src/story/contactCooling.ts` to their verified original bytes after the user replied “yes” to the exact patch confirmation. Preserve the added alternative code via separate external files: a fresh alternative-only Canvas which does not copy/relabel the original scene, and an external adapter invoking the existing public `simulateContactCooling` unchanged. Corrected additive App routing so original 4.2.3 independently calls FireSequenceWorkspace with its original defaults, even when a method-preview query is present. All other Version21 work stays preserved. No reset, clean, history rewrite or restoration of unrelated changes is proposed.

## Original callable behavior and defaults

Existing entry point: `FireSequenceWorkspace({onWorkspace,session})`; unchanged scene call has `time`, `mode`, `view`, `layers`, accepted `frame`, `resetToken`, and `cameraDistance`, plus four flags listed above. Fresh original session: time 0, speed 1, rapid release, natural cutaway, playback stopped until scroll entrance, loop false, all four layers true, labels true, camera distance 15.75 m. Experiment defaults: 24 h, moisture dry basis 0.1, ignition 120 min at 2500 W. Retained session restores its own prior settings/time rather than overwriting them.

Camera: initial position [7.2,4.0,12.3], target [0,-0.05,-1.1], FOV 38°, near/far 0.05/60 m, distance bounds 5–19 m, no damping; cinematic wheel zoom disabled. Scene Canvas uses demand rendering and DPR [1,1.5]. Original timeline is 90 story seconds with variable presentation rate, not the new alternatives' independent clock. Representative timing: spread 12–40; excavator 18–40; drilling 24–34, clear 36.5; source contact 44; cap seated 51.5; gas release 55; truck 57–65; hose 65–72; connected water starts 72; review 85. These values remain in the protected source.

Bundled result: 65 accepted frames, physical 0–86430 s; final dry ice 3.998211470103149 kg, max temperature 795.5505599849323 K, reacted fuel 4.254278857572075 kg, reacting depth 0.16 m, heated depth 0.48 m. Field propagation remains unresolved. Separate contact calorimeter is not added to those field results. Baseline audit `docs/review/unified/fire-sequence-audit.md` records asset identities and scope; it predates V20's later presentation timing and is not a substitute for the actual V20 source timeline. Original movies/history remain unchanged.

## Completed preservation gates before READY

1. Compare every protected file against the recorded SHA-256; no mismatch allowed.
2. Run unchanged `tests/fireSequence.test.ts`, `tests/firePresentation.test.ts`, `tests/fireAppearance.test.ts`, `tests/contactCooling.test.ts`, `tests/fireProtocol.test.ts`, and `tests/fireProtocolRunner.test.ts`.
3. Run unchanged `scripts/smoke-fire-sequence.cjs` after production build: original default and scroll autoplay, modes, seek, accepted numerical field/reference, original calculation/cancel/restore, historical replay/byte ranges, water ledger and session restoration.
4. Test external adapter results against existing public simulateContactCooling, per-instance independence and snapshot ownership. Original source gets no new export.
5. Test additive mapping/menu: 4.2.3 directly opens the original; 4.2.1 and both children and 4.2.4 use their own separate preview; nanoparticles remains disabled. No standalone-new-preview query may replace original 4.2.3.

Previously verified Version21 state at eae8336: 1777 tests in 93 files passed, typecheck/build passed, lint had 16 inherited warnings; native original/alternative/replay/FEM checks passed before extraction. Those checks do not waive the now-required restoration/hash checks. Current gates passed: all 57 original hashes, full 1784-test/94-file suite (including all six unchanged original test files), typecheck, lint with 16 inherited warnings, build, unchanged native original smoke and updated native alternatives smoke. The latter verifies direct original selection, unsupported original comparison, independent new variants, worker lifecycle/linked time, cleanup and refreshed two/four-panel performance. Original native covers playback/cache/modes/seek, calculation cancellation/completion/restore, archived movies/byte ranges, water ledger and session retention. This is preservation/software verification, not empirical validation.
