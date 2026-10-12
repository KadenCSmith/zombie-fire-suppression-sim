# Independent C scientific-realism review — scored retry 1

Signed: `/root/vibration_reviewer`, independent read-only scientific reviewer, 2026-10-12. I did not implement C, change source/tests, or operate a browser. This report applies to frozen code/test commit **`3b2994ea3715bc5f58ff6d588cdbe6e1eaf9b5fb`** only. The revised human-invoked parallel review prompt and fixed RUBRIC remain authoritative. Latest scope is **vibration only, no water**, including the requested authored fracture/compression/rearrangement/fire-out narrative.

**Result: 1.2 / 10. No verified 7.** The correction removes an unwanted liquid model and makes its scientific boundary clearer, but the current method contains no physical vibration or suppression model. A lower current score reflects the absence of active physical equations/evidence; it is not an aesthetic assessment. No credit is awarded merely for removing a source, adding qualifications or improving choreography.

## Fixed scorecard, gates and exact counter

| Criterion | Weight | Score | Independent finding |
|---|---:|---:|---|
| Governing physics and conservation |30%|1|No force/displacement boundary problem, mechanical work/energy balance, momentum solve, or coupled thermal/species response. There is no current physical inventory or ledger to test. Residuals are N/A, never fabricated zeroes.|
| Medium/soil properties and constitutive behavior |20%|1|No active density/moisture-dependent cyclic constitutive, damping, effective-stress, compaction/loosening or retention/transport law. Authored 2.8% display-height contraction is not measured/calculated strain or composition.|
| Numerical verification and independent validation |20%|2|14 independent software boundary/composition/resource checks pass. No vibration equation, analytical/reference response, physical mesh/time convergence, measured response comparison or uncertainty validation exists. Software checks cannot establish experimental validation.|
| Method-specific mechanism and coupling |20%|1|Sinusoidal display motion, drawn cracks, group scaling and an ember-color output effect do not compute vibration-driven rearrangement, oxygen restriction, heat removal or extinction.|
| Visual correspondence to computed states |10%|1|There are no current computed vibration/thermal/species states for the illustration to represent. Independent live GPU/UI inspection is unavailable. Supplied root inspection additionally reports an abrupt reddish-hatch/ember change at 73.9→74 s.|

Unrounded weighted arithmetic is `1×0.30 + 1×0.20 + 2×0.20 + 1×0.20 + 1×0.10 = 1.2`. The unsupported central mechanism imposes ceiling **6**, nonbinding here. Original preservation passes independently (57/57). Physical conservation/unit/stability gates are **unassessable for absent vibration dynamics**; passing guard/resource checks does not satisfy them. Required independent actual-app visual evidence remains **unverified**. No experimental validation, suppression/re-ignition outcome, treatment ranking or FPS claim is established.

| Scored pass | Identity | Scores: physics / properties / numerics / mechanism / visuals | Total |
|---|---|---|---:|
|Initial audit|Historical C `47cbbb8c535aff159102b481d187b9dc3203ac50`; integration/diff identities in signed ROUND_0_C|2 /3 /3 /1 /3|2.3|
|Retry 1, this report|`3b2994ea3715bc5f58ff6d588cdbe6e1eaf9b5fb`|1 /1 /2 /1 /1|1.2|

**Exactly 2 scored passes used: 1 initial + 1 retry. Exactly 2 retries remain unused.** Replacing the prior reviewer and revising the prompt did not reset the initial audit or budget. `da195eebf5b01a0b6db65f9004113f59578ce356` was archived/inspected but superseded before any independent test execution or score: camera transforms were copied before the primary renderer could update the camera. Only `compaction-pass.tsx` and its test changed in the replacement. This disclosed pre-score correction is not another scored pass. By contrast, substantive review of `3b2994e` is complete and is scored here; any later scientific review of the proposed visual correction is **retry 2**.

## Frozen identity, source scope and provenance

- Frozen tree: `71423a68ad00be67c1a407576e28c702002787c0`. Source/test uncommitted diff SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty). The later working documentation update is not part of this frozen source identity.
- Owned review diff base: coordinator checkpoint `1891e00e4cb40e6b6a9072344e2ef36c9cfd6244`. Patch SHA-256: `7cbdf3549ab3925b7cbe8bbdaae8bfbc08ea103745d49ab88a2ad3efa10ef709`. Its C changes remain inside the three owned C trees.
- Independent run ID: `ec85e53a-7066-4a06-a299-6d08ef314231`. I verified **all 632 tracked blobs** in the isolated snapshot against the frozen Git tree, independently recomputed **57/57** protected SHA-256 identities against established original baseline `161e7a4a1f8c35765e1878c132db79977be1f5ea`, and rechecked snapshot integrity after execution.
- Package lock SHA-256: `7a49fa111bc72e8afbd486195bc35bcbc20573f6d3c6f82824e0e1a538b5aa7d`. Existing installed dependencies were cloned into the private runtime, with all **149 installed lock entries** checked for matching version/resolution/integrity. No npm ci, dependency upgrade or permission change occurred. Full tracked source/config hashes, installed dependency versions and installed-lock hash are in the independent provenance JSON.
- Environment: Apple M3 Pro, arm64, 12 logical processors, 38,654,705,664 bytes RAM; macOS/Darwin 27.0; Node 26.8.2; npm 11.19.1. Initial load averages were approximately31.6/33.8/31.9 with other work present. Checks used one worker and no long liquid-field, convergence or general build jobs. Durations below are audit execution times, not controlled performance comparisons.

I inspected actual active C index/model/workspace/science, scene composition, display-motion/dust/fracture/output-pass implementations, current tests, protected original Canvas factory and relevant original scene/equipment/timeline helpers; also shared contract/registry/module/adapter/model and application routing. This was not limited to implementer-selected excerpts. The root route directly lazy-loads the owned workspace for C. No original implementation was extracted, duplicated in the delivered C module, or edited. The separate audit snapshot contains read-only copies for inspection/execution.

## Actual current behavior and missing equations

The active descriptor exposes `engines:[]`, medium `none`, default engine `concept`, empty modeled capabilities and disabled zero-valued inactive treatment defaults. `createVibratoryRun` rejects every configuration, including stale contact/water combinations, before calling a numerical hook. Disabled treatment defaults are configuration guards, not calculated zero mass/energy outcomes.

One externally composed, unchanged hook-free `FireSequenceScene` Canvas provides the original ground/fire/drilling/excavator/camera. Original context is bounded at33 presentation s, before unrelated source/cap/gas/water treatment. Original tracer time advances only to34 s to finish inherited cuttings. Public water/gas layers are false; there is no active C truck, liquid source, hose/jets/wetting, field tab or liquid worker path. Camera/lights retain stable types/keys outside the authored motion groups.

The C-owned display uses deterministic sine motion beginning27 s, ramping through33, tapering68–74; cracks grow33–46, contraction grows44–68 and scales display height by at most2.8%, with the bottom anchored. Ember-color output fading is authored50–74. The output pass owns its HDR/depth target, shader and quad; it changes no original shader/material/physical field. In the reviewed source, public fire switches off at74. No state variable for force, strain, porosity, composition, oxygen, temperature or reaction is evolved by this narrative.

The camera-order correction copies inverse projection/matrixWorld **after** primary scene rendering and before output rendering. Independent mocked same-frame camera mutation verifies that ordering. These checks establish a software contract, not GLSL compilation, real GPU correctness, physical deformation or extinction.

## Independent execution and frozen checks

Before execution I recorded `/tmp/v21-c-reviewer-check-plan.json`. Existing round0 physical benchmark solutions/tolerances remain unchanged. Because the active method deliberately has no physical run, liquid-source/contact/mesh/time/conservation benchmarks are inapplicable to a current vibration prediction. I did not invent a vibration reference solution or award historical liquid balances to vibration.

**14 tests pass, 0 fail in 5 files:** 12 current repository tests in `model.test.ts`, `evidence.test.ts`, `vibration-scene.test.tsx`, `compaction.test.ts`, plus 2 independently selected reviewer tests. They cover no-engine/no-inventory defaults, stale-config and all engine/medium rejection, no numerical-hook call or input mutation, no source presentation/backward-seek leakage, single original Canvas/ground/excavator and no truck, stable camera/light identity, motion/disable limits, deterministic authored contraction/fading, continuous unequal-length fracture prefixes, fresh resources/exact disposal, renderer-state restoration, same-frame camera transforms and primary-render failure restoration without original material hook/cache/color mutation. The historical-evidence test checks archival separation; it does not validate current physics.

Active test cwd was the isolated frozen runtime:
`/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-vibration/work/version21-realism/round-1/c-reviewer-20261012`.

```sh
npm test -- tests/alternatives/vibratory-injection/model.test.ts tests/alternatives/vibratory-injection/evidence.test.ts tests/alternatives/vibratory-injection/vibration-scene.test.tsx tests/alternatives/vibratory-injection/compaction.test.ts --exclude 'work/**' --maxWorkers=1 --reporter=json --outputFile=/tmp/v21-c-reviewer-active-results.json
```

This independently executed 12 tests in4files, exit0, approximately1.679 s. The filter excludes nested work; no duplicate root/copy tests were counted. The two reviewer tests ran from `/tmp` using the isolated Vitest executable, `/tmp/v21-c-reviewer.config.mjs` (includes exactly `/tmp/v21-c-reviewer-extra.test.ts`), `--maxWorkers=1 --reporter=json --outputFile=/tmp/v21-c-reviewer-independent-results.json`: 2 tests in1file, exit0, approximately0.341 s. The log records a Three CJS deprecation warning, not a failed check.

I independently compiled **source import graphs only**, using installed esbuild with `write:false`, for workspace/index/App (35/5/123 source inputs). No graph reaches the six historical C field/worker/session/effects/visual files and no active C module constructs a Worker. The workspace/index graphs have no worker query edges. App's five unrelated shared Vite `?worker` imports are listed external; this graph is not a replacement for full Vite worker integration. Initial graph tooling attempts failed because native TypeScript7 lacks the old JavaScript compiler API and plain esbuild lacks Vite worker-query semantics. Those diagnosed command attempts are retained in provenance; no source, dependencies, scientific tolerance or score budget was altered.

Implementer-provided run `fc98e6b1-b214-43af-baf6-ea1f10671db4` source/dependency hashes match this snapshot. Its targeted/type/lint/build/private-build/preservation/diff-check passes remain **provided evidence**, not my independent execution. I did not repeat general build/lint/full suites. The full final combined suite/native checks remain coordinator responsibilities; historical PR/CI green is not current evidence.

## Reuse, invalidation and actual-app limits

The signed initial audit is retained for its historical findings, provenance and consumed initial pass. Independently checked historical C file bodies match `47cbbb8c` except added inactive-history comments, and `src/coupled` has no changes. Consequently the initial historical field/core interpretation and its unresolved spatial sensitivity remain valid historical context. Those results are **off-scope** and contribute no current vibration credit; the 15 historical liquid tests were not rerun or included in the14 current checks.

Shared new-alternative contact policy changed0.05→0.00625 s at exact `d07d03fe54b453677c2cd8684e8e2c5eb97112a6`. Prior affected contact temperature/step results cannot be reused as fresh current green. They remain archived with their original identity. The protected original contact default/cache stays unchanged. Current C fails before reaching this adapter, so the policy does not introduce a current vibration source or cure missing dynamics.

The changed workspace/renderer invalidates prior round0 actual-UI evidence for current correspondence. Independent live browser/GPU access was unavailable under the existing policy. I did not bypass it using another browser, local HTTP fetching or headless rendering. Source/resource tests do not compile GLSL or establish current native GPU behavior.

Root separately reports normal authorized Chrome inspection of this candidate:54 s shows one Canvas/context33, cracks/settling, no water and no own-tab errors;65→70 dims gradually, but reddish hatch/ember specks at73.9 disappear abruptly when public fire switches off74. Root reported before/after screenshot paths; I did not separately open those images or operate that app. This is **supplied, nonindependent actual-UI evidence**, including an unresolved concrete visual discontinuity. It supplies no physical extinction validation.

## Primary references and concrete stopping blockers

[Price (2003)](https://doi.org/10.1029/2002WR001302), consulted in primary Wiley full text, studies seasonal peat deformation and hydraulic behavior. It supports the need to characterize deformation-dependent properties; it does not establish a vibration-compaction suppression law.

[Boulanger et al. (1998), Dynamic Properties of Sherman Island Peat](https://doi.org/10.1061/(ASCE)1090-0241(1998)124:1(12)), consulted through the primary ASCE indexed abstract (direct page open unavailable), reports cyclic laboratory characterization of peat modulus/damping and effects including frequency, stress history and anisotropy. Its specimens/forcing are not matched to this app; no measured curve was adopted, fitted or transferred as validation. The reference is evidence of the required characterization, not a supplied universal constitutive model.

A credible predictive mechanism still requires an explicit physical forcing/load or displacement boundary and domain/boundary conditions; mechanical work/energy and momentum coupling; moisture/density/fabric/effective-stress-dependent cyclic peat properties, damping and irreversible rearrangement data; defensible deformation-to-porosity/retention/gas/heat transport coupling; calibrated reaction/moisture/oxygen/fuel behavior; and independent matched vibration-response and extinction/re-ignition observations over a stated window. None is provided by sine motion, a display scale or an ember fade. No arbitrary permeability benefit, oxygen deletion, cooling, fracture/collapse calculation or new suppression law is justified.

**Stop the scientific-realism loop below7 on this concrete mechanism/data gap, leaving two retries unused rather than spending them on cosmetic score inflation.** The authorized UI discontinuity correction may proceed, but changed visual evidence must be invalidated and checked honestly; any later scored scientific diff review consumes retry2. It cannot validate the absent mechanism.

Detailed machine evidence is `/tmp/v21-c-reviewer-provenance.json`, `/tmp/v21-c-reviewer-score.json`, the two test-result JSON/log pairs, the pre-execution plan, reviewer test/config and import-graph script/result. These record hashes, configuration, commands, executor/run identities, scenario and environment. No implementation/shared source/Git mutations, push, merge or browser-policy bypass occurred. The only project-folder creation was nested ignored audit runtime inside an existing checkout; no qualifying new top-level project/output folder was created for Finder tagging.
