# Worker C launch

Follow ONLY Prompt 4 in `/Users/kadensmith/Downloads/V21_Parallel_Agent_Prompts (2).md`: 4.2.4 vibratory drilling and continuous injection. Preserve the original 4.2.3 read-only. Complete assigned implementation, meaningful tests, scientific/provenance documentation and handoff, ordinary branch push and attached draft PR. First verify/merge the exact source base, then this document-only publication SHA supplied in the coordinator message; acknowledge v21.2/path/base. Start your reserved preview promptly and report URL/PID. Read the complete filled READY appended below before mutations.

# Filled Version21 READY record — PRESERVATION VERIFIED

READY

Readiness status: **READY — preservation verified.** User-approved restoration is complete. This record supersedes the historical NOT READY record in commit 0909a40 and READY_v21_1_SUPERSEDED.md. Workers may begin only after reading this complete record, acknowledging API v21.2, verifying the exact published base and completing the coordinator-authorized ordinary checkpoint merges into their own branches. Do not follow a moving branch tip.

Repository URL: https://github.com/KadenCSmith/zombie-fire-suppression-sim.git — verified remote.

Integration branch and sole owner: `integration/v21-alternatives`, coordinator `/root`; exclusive checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/zombie-fire-suppression-sim`. Ordinary owned commits/pushes and sequential reviewed integrations. The user's subsequent request explicitly authorizes the coordinator to update GitHub main and the app on GitHub and the Mac after final integration/checks. Workers still cannot merge main or publish releases. No force pushes, destructive resets/cleans, history rewriting or shared Git configuration changes.

Remote-reachable immutable base SHA on integration branch: **`c1adb47da0daf72c22eb5ec30020524139629e10`**. Ordinary push succeeded; `git ls-remote origin refs/heads/integration/v21-alternatives` returned this full SHA; subsequent fetch succeeded and cat-file confirmed commit. It contains all permitted preserved work, the frozen v21.2 external seams, approved restoration, corrected original routing and current preservation evidence. The later publication commit containing this READY and the three launch records is documentation-only and must be verified separately; it does not change this frozen source base. Each worker merges this exact base first, then the explicitly supplied READY-publication SHA, without rebase or moving-tip merge.

Contract API version and paths: frozen **v21.2**, `src/alternatives/contract.ts` and `docs/alternatives/CONTRACT_V21_2.md`. v21.1 is superseded. A reviewed the external adapter and preservation read-only; B/C acknowledged v21.2. Every owner must acknowledge the full record and actual own checkpoint before private edits. Essential contract changes require a versioned coordinator update, affected owners' acknowledgment and exact ordinary checkpoint merge; protected original edits remain prohibited.

Contract semantics/example adapter: `src/alternatives/model.ts` defines serializable PanelConfig, accepted snapshots/metrics, units, panel/run IDs and messages; `src/alternatives/contactAdapter.ts` is the external reference adapter. It invokes the original public simulateContactCooling unchanged, clones inputs/outputs, captures owned endS/time, rejects invalid/backward/out-of-window targets and recomputes from initial conditions at each accepted target. `src/worker/alternatives.worker.ts` owns initialization, advance, pause/resume, reset/replacement and disposal; stable panel IDs plus fresh run IDs/current-worker checks reject stale responses. Duplication copies settings only. Physical contact uses the unchanged 0.05 s/event-boundary reference; output checkpoints are 0.5 s. Physical time, scheduling wall time and illustrative presentation remain separate. Linked time requires matched engine/seed/initial/boundary/geometry/numerics/window; disclosed resource differences remain explicit. Example private exports: `src/alternatives/sublimation-injection/index.ts`; UI exports are separate from worker-safe descriptors. No protected original state is mutated.

Original 4.2.3 preservation baseline: **`161e7a4a1f8c35765e1878c132db79977be1f5ea`**, verified V20 commit “Add cinematic interface and connected water-supply presentation,” package 0.20.0. All 57 protected paths are identical between this and inherited 4b2088e926662aee357cde680f2b22c4fbf24f79; neither is a reset target. Import tracing identifies the actual original source, not the new unregistered pressure-pulse scaffold. Baseline/hashes/approved restoration/current verification: `docs/review/version21/original-preservation.json`; explanation `ORIGINAL_AUDIT.md`; historical exact diff `prior-original-changes.patch` in the same folder.

Original 4.2.3 protected read-only paths for ALL agents: exact files and original SHA-256 identities below. No agent including coordinator may edit/move/rename/extract/replace/copy-relabel them. Procedural assets, cached/public assets, results and original regression files are included.

- `src/ui/FireSequenceWorkspace.tsx` — `2b91e2bfbd1bb0b8a2fba4ece2c23c2ac0d369263bff7d2977e9a3e723a04d50`
- `src/ui/FireSequenceScene.tsx` — `3df13c15a17ec47d588eb632ce2aca2b251fc074790d963eba30d29430e50661`
- `src/ui/FireSequenceEquipment.tsx` — `d6d79166da5b6b15d1a53b7d1335b531947aeba9e0370a113bc5807a7ce5ad52`
- `src/ui/FireSequenceGrass.tsx` — `5b3587668cfe7e3bfe89a240a59302174565db7cacb2cf191c9ae6266be5e56e`
- `src/ui/FireExcavator.tsx` — `7a3c2b04ef131dd8fa7d10d2b4e2892dfd1995dae481285be38c770be1276cbe`
- `src/ui/FireWaterTruck.tsx` — `41b41aa7cce6b272a7171a4c18bd542387e3751baddb9c92541ba97cc1fe79c0`
- `src/ui/FireInterventionEquipment.tsx` — `060b90894e2bad07d3ae19a6ec3933ca27f201724f3bb060c8fc7c3555bbd578`
- `src/ui/FireGroundGeometry.ts` — `9ef8140b02c3303da958a82b56be092d03f17d136269cc16ba66ceeb049fe647`
- `src/ui/FireExperimentControls.tsx` — `48514e3f9f5ea16fae804160e8d81a73a60816773780328b6c963b1b563e678f`
- `src/ui/fire-sequence.css` — `5b10c2ee06e864d0f86c0c092229ae96b8a73c4a944d923423a61430dce298b0`
- `src/story/fireSequence.ts` — `42fdcbf3cb41ca19694d8f97a6b6209074f1d01a628c0e196994343d11bc54c6`
- `src/story/firePresentation.ts` — `9ff4c580d5ad1670bc4fecfffc7305906c50acd86b41a3ec722235d4786273f8`
- `src/story/fireAppearance.ts` — `1519434f8f175877240b9d702e63f50f766f6d0e066ffc8450ef65ec80151080`
- `src/story/contactCooling.ts` — `ff39288463fcd9ea187dc6549747a4f2579a2a279b682aa3114a98f8ecd92622`
- `src/coupled/fireProtocol.ts` — `3b7a9a07d2025e6ab8adecd23768170852ecde1b0b7f38b829ff3a6604a8fb68`
- `src/coupled/fireProtocolRunner.ts` — `497bd17ec50121eab89e27896539a18ec66e3a64fc2b14249b2d97642cfa1ed7`
- `src/worker/fireProtocol.worker.ts` — `42abfef2b28dcde2202e1b26409cf687046ceb640d2552df47d2d3f5719d85b2`
- `public/fire-sequence-cache.json` — `212b82c7e51157c3d3f0bdd25408d7c383c00a324d3b60bf1e68828f6b9b25a0`
- `public/fire-sequence-contract.json` — `74697b2c950a1ee67d0d8977a6f3f30a364c84bfb8ee23d83ba237f2edb6c47f`
- `public/contact-cooling.json` — `8bbc44d768e13df92fd1b421add33ff77360223d70b53619222ece6017e4eb1c`
- `public/fire-appearance.json` — `dcd87b3631509b0ee071849a20e6514b5c0023d9fa3d9f2eef7dd9e686beb5b5`
- `scripts/smoke-fire-sequence.cjs` — `2eb32cea8d6cb08a5f03de239ff52cf9123593d358bc19b97d75ce17c6838809`
- `tests/fireSequence.test.ts` — `9adf2b05a0d0497dba88822efa95b1526b4b38e6d247ab55feb048c342a93d7d`
- `tests/firePresentation.test.ts` — `a59fb70d056d40ad6e60917ba783d27849782bdd74f8edbc70d38cf99788c4f5`
- `tests/fireAppearance.test.ts` — `d6fd3eb3f603e361df8d19fe45ebd3b831e92a6f545300e00700533b472087c7`
- `tests/contactCooling.test.ts` — `ac5065dcb41ee8939d2dad3d82d4477418dee4a76f95415ac456bbee8939fa71`
- `tests/fireProtocol.test.ts` — `a7621fee266a2d0ef3adfcebd556557a776ca82b5aefb24a739260b4d94c8724`
- `tests/fireProtocolRunner.test.ts` — `16c4dc60deb08537b3a4279cab97312c33f682b31ebf45a26ff38be98296864b`
- `docs/review/unified/fire-sequence-audit.md` — `7ea6bb4a2fe79114ea680a5cdb64386da644ab24063ed54ffefd4afc441ba823`
- `docs/review/unified/fire-runner-equivalence.json` — `c749faac2a724122ee3f69ea9bfd8c97702bd83942201b0277683e422d7ae371`
- `docs/review/unified/fire-controls-smoke.json` — `ab31a646644eb106ab5295fed1292e04ff7ce62ab774195afb68bb221e038bfa`
- `public/history/v0.12/accepted-checkpoint-review.manifest.json` — `28fd3a5421c4e41aadb9ea099539f2d8fd23e30c031a5537d2ebaa1444ea1210`
- `public/history/v0.12/accepted-checkpoint-review.mp4` — `e47d31ec6eff3607d1c219fe68caefa6ab6a44215bdcb597b544ea539b909988`
- `public/history/v0.14/manifest.json` — `422a74b19bf1da5ba5414bbabf1f8ffd89490a44131105d5899d21f288029dfa`
- `public/history/v0.14/peat-fire-gradual.mp4` — `a610e010ae198e44a2f6ee4860922416b4e93d34a3f40e80d58fb82cb0f34fc8`
- `public/history/v0.14/peat-fire-rapid.mp4` — `1b9d0341f53b628073f6b53d3fc25f7cbc1ca021cc5adc416676af7e9d0d20de`
- `public/models/dry-ice-reference-animation.glb` — `f7111e78a4ff08250d0df226203ebbb50347f4c347e972bbf1990349fe439d15`
- `public/models/dry-ice-reference-animation.manifest.json` — `c2e0c70b65ef97e3f775b8cdcccaab534b887ce9bc822e1ce11bf9e4cce02bf0`
- `public/models/peat-study.glb` — `7ff750685cc49289805d3af7b1f8e524e9586f106d9300e6ec0636523bea7305`
- `public/models/peat-study.manifest.json` — `70a9b171025da3c896bdeb43ac11112040e9e4f128344b5201017a21fe2f0c93`
- `public/renders/Fire_Sequence_Contact_Sheet.png` — `8ac513883909020ee00e1f8c2c657e29312341942748f618a12533acf9de5e16`
- `public/renders/Fire_Sequence_Poster.png` — `fcb10ecf1cc850226683aec260cd542497cd748ed982316552d770c267c15c29`
- `public/renders/manifest.json` — `87ea39454a502cc882e2590e87ed4b7dc825da927b4012d2470521c2643657b6`
- `public/renders/peat-fire-gradual.mp4` — `04bf83a46a05001ab803a821c30b24b3b0d8e87d21601d4b3924019d79a9eb00`
- `public/renders/peat-fire-rapid.mp4` — `e3f27de064e12f3ff3a2cfa44971fb8b59aad7b7cdfe83156d71b4fe194c86b2`
- `integrations/blender-study/fire-sequence/README.md` — `e23a3ebefc6906288d200127c6528a037517650dfa03f7e4fc7bbd04bc286ce2`
- `integrations/blender-study/fire-sequence/build_fire_sequence.py` — `564a444c108dfae0d9784c36d7d753f2f61c9f8803006b509f3afe47ed7089f8`
- `integrations/blender-study/fire-sequence/contact_assets.py` — `e560e69394d91ec4ca0b322c0b574a6a6cb371a0ed92dc7fcac17f8319923447`
- `integrations/blender-study/fire-sequence/create_contact_sheet.py` — `a9452cec8ac6be579a7ad21cec1c36821d90c0dbdebb17cfcc09be4a9cb5b116`
- `integrations/blender-study/fire-sequence/package_render_assets.py` — `dc68b6f3c9f0468c527ab3a160b9214bd01ce6753663fee7836c56b93aaad9d7`
- `integrations/blender-study/fire-sequence/render_delivery.py` — `ac2b6f147470d10a27c3c10ae766417624123533af59fdfbd797998797ca6921`
- `integrations/blender-study/fire-sequence/render_fire_sequence.py` — `8991ce7266e29b1bc79bb4b606e73a62a0c4fb8c1b76d1a92cbd49f64beaab90`
- `integrations/blender-study/fire-sequence/rupture_geometry.py` — `7867ed8d87c0dbc73aaa7ceebc649e301e0013956cb05bee151f660a276dff37`
- `integrations/blender-study/fire-sequence/storyboard.json` — `6c95f61366739f5036e7007b35aa9281653405eb3bf301b736d19268f0b67514`
- `integrations/blender-study/fire-sequence/verify_fire_sequence.py` — `4a04fe892d248b0690a50adb490d464761627cb4497f199706a7886d467af231`
- `integrations/blender-study/fire-sequence/verify_movies.py` — `dee16d4f5c10ee44743c73554b1a619c4ad9c985758ed667d2aeca7206e6480c`
- `integrations/blender-study/fire-sequence/visual_assets.py` — `685f8a1d0e67739ff47eb95bae586671ec75872c4afc1ab1a10fabc497a2c30a`

Original 4.2.3 behavior/results baseline: unchanged callable `FireSequenceWorkspace({onWorkspace,session})` in `src/ui/FireSequenceWorkspace.tsx`, calling FireSequenceScene with realistic straightBore cinematic connectedSupply and original state/frame/resetToken/cameraDistance. App defaults to pressure-pulse, and selecting 4.2.3 always calls this original, including method-preview query. Fresh session: time 0, speed 1, rapid, natural, playing false until scroll entrance, loop false, four layers true, labels true, camera distance 15.75 m. Experiment defaults: 24 h, moisture dry basis 0.1, ignition 120 min at 2500 W; retained sessions restore own settings/time. Camera [7.2,4,12.3], target [0,-0.05,-1.1], FOV 38°, near/far 0.05/60 m, limits 5–19 m, no damping, cinematic wheel zoom disabled; demand Canvas/DPR [1,1.5]. Original variable-rate 90 story seconds: spread 12–40, excavator 18–40, drilling 24–34/clear 36.5, source 44, cap 51.5, gas 55, truck 57–65, hose 65–72, water 72, review 85. Cache: 65 frames physical 0–86430 s, final dry ice 3.998211470103149 kg, max temperature 795.5505599849323 K, reacted fuel 4.254278857572075 kg, reacting depth 0.16 m, heated depth 0.48 m; propagation unresolved. Separate contact heat is not added to field results. All 57 current hashes pass. Unchanged scripts/smoke-fire-sequence.cjs passed original playback/cache/modes/seek, calculation/cancel/short completion/bundled restore, archived movies/byte ranges, contact ledger and session retention. Updated alternatives native check passed actual default/direct original routing and unavailable new-comparison adapter.

Prior changes affecting the original: **resolved by specifically approved restoration, no unresolved protected changes.** Earlier eae8336 added optional method imports/props/cues and treatment bypass to FireSequenceScene.tsx, and appended a 17-line contact session helper to contactCooling.ts. App separately mislabeled original as 4.2.1. These exact diffs were reported first. The user replied “yes” to the specific prepared restoration of only the two protected source files and permitted App route correction. Their original bytes are restored; new alternative host and helper remain separately authored outside the original. All other work is preserved. Historical diff remains recorded; no altered original was blessed as baseline. No further protected edits are authorized.

Coordinator-only additive paths and exports: `src/alternatives/contactAdapter.ts`, `originalPressurePulse.ts` (metadata/original entry path only), `contract.ts`, `model.ts`, `modules.ts`, `registry.ts`, `presentation.ts`, `presentationBase.ts`, `persistence.ts`; `src/worker/alternatives.worker.ts`; new `src/ui/AlternativeScene.tsx`, `AlternativeRenderWorkspace.tsx`, `AlternativeMethodModules.tsx`, `AlternativesWorkspace.tsx`, `AlternativesMenu.tsx`, `AlternativeScience.tsx`, `alternatives.css`; permitted App/AppChrome/ModelSelector/formulas integration, global tests/docs/version metadata outside protected files. AlternativeScene is independent and does not copy/import the original scene/equipment/timeline/camera. The preserved superseded `src/alternatives/pressure-pulse/**` scaffold is unregistered/coordinator-reserved, neither B's ownership nor the actual original. New pressure source/field injection/mechanics hooks are unavailable; finite contact is the supported source seam.

Shared dependencies affecting the original: actual import closure separately tracked below. Workers cannot edit them. Coordinator changes outside protection require original hash/native/default/result regression gates. ModelSelector is an original TypeScript type-only import. App/AppChrome/global CSS/version metadata are additional integration surfaces. Header/menu changes cannot retime/restyle the original scene/camera/defaults/results. npm dependency versions remain unchanged; package/lock version metadata only changed. Original native checks and all six original test files pass at this base.

- `src/coupled/cap.ts` — byte-identical to the original baseline
- `src/coupled/linear.ts` — byte-identical to the original baseline
- `src/coupled/model.ts` — byte-identical to the original baseline
- `src/coupled/remap.ts` — byte-identical to the original baseline
- `src/coupled/source.ts` — byte-identical to the original baseline
- `src/coupled/thermodynamics.ts` — byte-identical to the original baseline
- `src/sim/materials.ts` — byte-identical to the original baseline
- `src/sim/researchProfiles.ts` — byte-identical to the original baseline
- `src/sim/scenario.ts` — byte-identical to the original baseline
- `src/sim/solver.ts` — byte-identical to the original baseline
- `src/sim/types.ts` — byte-identical to the original baseline
- `src/ui/CinematicUI.tsx` — byte-identical to the original baseline
- `src/ui/CoupledNaturalContext.tsx` — byte-identical to the original baseline
- `src/ui/FractureStudy.tsx` — byte-identical to the original baseline
- `src/ui/ModelSelector.tsx` — changed type-only workspace import/menu definition; original native regression passed
- `src/ui/OakTree.tsx` — byte-identical to the original baseline
- `src/ui/WideSoilScene.tsx` — byte-identical to the original baseline
- `src/ui/operations.css` — byte-identical to the original baseline
- `src/ui/soilParticleModel.ts` — byte-identical to the original baseline
- `src/ui/studyModel.ts` — byte-identical to the original baseline

Shared paths reserved from worker edits: **all tracked paths except each owner's exact private trees below**, including all protected original paths, shared routing/chrome/comparison/replay/catalog/registry/dispatchers/contracts/helpers/solvers/workers, package/lock, global tests/docs/release metadata/persistence/assets. This does not authorize coordinator protected edits. No ancestor ownership, self-registration or shared backdoor edits. Private fixtures/evidence/harnesses stay inside assigned private trees.

Worker A: `/root/sublimation`; branch `feature/v21-sublimation-injection`; exclusive checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-sublimation`, verified clean at eae833684ec41475eb6f84e642e6b06c5c350714 before launch. Exclusive `src/alternatives/sublimation-injection/**`, `tests/alternatives/sublimation-injection/**` (including fixtures/harness), `docs/alternatives/sublimation-injection/**` (evidence/HANDOFF). Entry index.ts exports methodModule/variants; scene.tsx MethodCues; science.tsx MethodScience. Test `npm test -- tests/alternatives/sublimation-injection`. Preview `http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1`. Only A fetches/verifies/merges checkpoints and edits/installs/starts processes in A's checkout.

Worker B: `/root/pressure`; branch `feature/v21-pressure-pulse`; exclusive checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-pressure`, verified clean at eae833684ec41475eb6f84e642e6b06c5c350714. Owns children only: liquid waves `src/alternatives/pressure-pulse-liquid-waves/**`, `tests/alternatives/pressure-pulse-liquid-waves/**`, `docs/alternatives/pressure-pulse-liquid-waves/**`; pressure only corresponding three pressure-pulse-pressure-only trees. Each has distinct index.ts/scene.tsx/science.tsx entries, private fixture/harness/docs/evidence/HANDOFF. No original/base or old combined pressure-pulse ownership. Tests `npm test -- tests/alternatives/pressure-pulse-liquid-waves tests/alternatives/pressure-pulse-pressure-only`. Port 5175 previews `http://127.0.0.1:5175/?alternative=liquid-waves&method-preview=1` and pressure-only query. Only B operates its checkout/processes.

Worker C: `/root/vibration`; branch `feature/v21-vibratory-injection`; exclusive checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-vibration`, verified clean at eae833684ec41475eb6f84e642e6b06c5c350714. Exclusive corresponding three src/alternatives, tests/alternatives and docs/alternatives `vibratory-injection/**` trees, private fixtures/harness/evidence/HANDOFF. Same three entry exports as A. Test `npm test -- tests/alternatives/vibratory-injection`. Preview `http://127.0.0.1:5176/?alternative=vibratory-injection&method-preview=1`. Only C operates its checkout/processes.

Existing implementation transferred to each: A/C retain partial descriptors/shared-adapter forwarding/pure presentation/concept cues/science/README from eae8336. Frozen base provides v21.2's external helper and independent host. B receives distinct child descriptors/adapters/presentation/cues/science/README through its own exact checkpoint merge; old combined scaffold is preserved unregistered. No original files are transferred/moved/copied. Workers must complete private scientific equations/SI provenance, source/cost evidence, independent conservation/off/no-inventory tests, proposed unperformed validation plan and HANDOFF. Seed scaffolds are not completed physical models. Coordinator freezes delegated trees after this transfer and does not author their private changes.

Source hooks/capabilities/known limitations: existing finite contact-calorimeter mass/enthalpy ledger, independent prescribed hot specimens, finite liquid and optional separate solid-CO2 contact inventories. No transport/infiltration/tank pressure/pre-chill model. No supported pressure-wave/soil rearrangement/collapse/fracture/vibration-permeability coupling; authored cues give no calculated benefit. Pressure-only is concept/none with no liquid or physical curves. Sources abstract/black-box, never device design. Peat FEM untreated only. Nanoparticles “TBD / mechanism unspecified,” predictive execution disabled. No arbitrary cooling/O2 deletion/permeability boost/suppression ranking. SI/Kelvin metrics include physical s, temperature K, mass kg, energy/residual J, reaction W, solve/wall ms; unavailable contact O2/fuel/reaction null with reasons. Numerical verification is not experimental validation.

Verified setup/check commands and baseline failures: coordinator npm ci succeeded; workers install separately after this launch. Typecheck PASS; npm test **1784/94 files, 6.03 s PASS** including unchanged original tests; build **5.02 s PASS**; lint PASS with 16 inherited warnings; diff whitespace PASS; `node scripts/check-original-preservation.mjs` **57/57 PASS**. Unchanged `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/smoke-fire-sequence.cjs` PASS; corrected scripts/smoke-alternatives.cjs PASS, rerun after latest shared checks. Its machine record docs/review/version21/live-smoke.json: 120 samples each, 2-panel p50/p95 8.3/9.3 ms, 4-panel 8.3/8.8 ms; pause 51.5 ms includes 50 ms poll resolution; cleanup true. Existing dependency/large chunk warnings are inherited. These fixture timings are not an arbitrary FEM mesh guarantee or physical validation. No new failing gate or unavailable original preservation check remains. Final integrated milestone repeats applicable checks.

Process/port assignments and handoff location: coordinator Vite PID 92990 on `http://127.0.0.1:5173/`, Chrome open. A owns5174, B5175, C5176. Worker node_modules absent/servers unstarted at launch; each owner runs npm ci then npm run dev -- --host 127.0.0.1 --port ASSIGNED --strictPort and leaves server running. Report ready URL/PID promptly so coordinator opens three additional separate Chrome windows while work continues. Each owns ignored node_modules/dist/test outputs/private native userData; storage separated by ports. Coordinator alone operates Chrome. Four separate windows are pending, not falsely claimed complete. Handoffs: private docs/alternatives/METHOD/HANDOFF.md (B one per child), final exact frozen HEAD_SHA/branch/draft PR to integration, changed paths/API/entries, original hash checks, all checks/results, sources/ledger/provenance/limitations/integration needs. Each worker commits/pushes only owned paths/branch, creates/attaches draft PR and freezes SHA. Coordinator reviews/merges exact accepted SHAs sequentially and checks original preservation after each. Main/app publication follows final reviewed integration under latest user authorization.

END READY
