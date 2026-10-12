# C final V3 handoff — 4.2.4

The current vibration-only preview keeps the original fire/drilling world, fractures the displayed soil, settles it, and fades the visible fire as the proposed rearrangement completes. Water, hoses/truck, wetting and active liquid workers are absent. This is an explicitly authored concept illustration; it has no predictive vibration, composition or extinction result.

Frozen source/tests: `95972c98ba1df981df386966a81508b9c52a971e`, branch `feature/v21-vibratory-injection`. Later evidence publication is docs-only, identified in the coordinator message. Checkout: `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-vibration`. APIv21.2 unchanged. Only C-owned source/test/doc trees changed; no shared solver/registry/routing/package/license/original edits. Normal merges of exact coordinator checkpointsd07d03f and1891e00 are recorded; no moving-tip merge/reset/rebase/force/main action.

## Current behavior and interfaces

One original Canvas/world, with one tree/excavator/camera/light set. Original context holds33s with the inserted auger; inherited cuttings finish34s. Authored vibration begins27s, fractures spread33–46s, ground display settles44–68s (2.8% height change, not physical strain), and ember fading occurs50–74s. The owned output blends mutually exclusive original public fire-on/off ground appearances at matching camera/geometry/transform; the hidden reference does not create another Canvas/world. It reaches the exact fire-off appearance continuously, fixing the supplied73.9→74 cutoff. No original material/shader/uniform is mutated. Owned visibility and renderer state restore after reference/output failures; resources dispose exactly once.

VibrationOFF restores the original burning/unsettled context with matching captions. See vibration enablesON and resumes38s; Restart returns0/paused. Deterministic seeking, reduced-motion default and camera controls remain.

`VibratoryWorkspace` default export keeps `{onCompare,onDetails}` callbacks; comparison is unavailable. Named `VibrationScene`/`composeVibrationScene` accept `{time,vibration,cameraDistance,resetToken}`. Root uses the owned workspace; MethodCues is a source-free fallback. DOM markers: version3, treatmentvibration-only, predictionunavailable. Descriptor has no supported engines and medium none; stale numerical configurations fail closed before any hook. Historical field/worker/session/visuals/evidence stay inactive and excluded from the active private module graph.

## Verification and review

Current implementer12active tests/4files PASS; type/lint/build/private-preview build PASS, inactive graph empty, diffcheck PASS.16 inherited lint warnings and inherited bundling warnings remain.15 unchanged historical tests reuse valid earlier27-test-run source/dependency hashes and give no current mechanics credit. [Implementer current provenance](./verification-v3-fade.json), [earlier camera candidate provenance](./verification-v3.json).

Coordinator normalChrome execution, with all214 source/package/lock/config hashes matching final95972c9:65bright→70dim→73.9/74continuousdark,90settled/noembers/no water, OFF90restoresbright/unsettled and correct labels, See vibration enablesON/resumes38, Restart0paused, oneCanvas/errors[]. [Verbatim supplied provenance](./coordinator-ui-v3.json). Provided images were inspected separately by C. This is supplied coordinator software/UI evidence, not independent reviewerGPU execution or experimental validation. Final combined suites/native/comparison/original-return checks belong to root and are unrun by C.

Original57/57SHA-256 identities match baseline `161e7a4a1f8c35765e1878c132db79977be1f5ea`; independently rechecked by reviewer. No new dependency/runtime upgrade. AppleM3Pro/arm64,38.65GB, Node26.8.2/npm11.19.1; source/lock/config/command/run identities are in provenance. No invented FPS.

Independent review final: [signedRetry2](./ROUND_2_C.md) at95972c9, criterion1/1/2/1/1, unrounded1.2/10, cap6 nonbinding; no verified7.17independent focused checks/5files PASS (12repository+5reviewer-selected),632blobs/57protected/214suppliedUIhashes verified. Initial2.3 and signedRetry1at3b2994e1.2 are preserved; Retry1 includes the now-corrected supplied74s cutoff. No counter reset: final review is signedRetry2/thirdscoredpass, with one unused retry. [Ledger](./REALISM_LEDGER.md), [Retry1 signed report](./ROUND_1_C.md). Unsupported central mechanism caps6; absent dynamics make physical conservation/unit/stability gates unassessable and residualsN/A. Actual independent reviewerGPU remains unverified.

The scientific loop stops below7 for missing forcing/load/displacement boundary, work/momentum balance, calibrated cyclic peat/damping/rearrangement data, deformation/transport/reaction coupling and matched response/extinction/re-ignition validation. Authored cracks/settling/fire-out and software checks supply no physics credit. Primary references and exact limits are in the signed reports.

## Delivery

Live preview: http://127.0.0.1:5176/src/alternatives/vibratory-injection/preview.html . Detached VitePID28731 in assigned C checkout; readinessHEAD200 (no C browser-policy bypass). Normal root browser observations remain distinct. The current draft PR URL is supplied in the coordinator message and attached to this task. PR19/11 are historical merged deliveries; their old CI does not cover this source. Root owns accepting/integrating the signed frozen snapshot and final combined checks. No merge/deployment/main/release was performed by C.

No new qualifying top-level project/output folder was created; nested evidence and temporary build/runtime caches are excluded from Finder tagging.
