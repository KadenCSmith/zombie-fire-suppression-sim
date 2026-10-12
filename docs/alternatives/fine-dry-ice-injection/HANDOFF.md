# Agent D handoff — 4.2.2

**Registered method:** `nanoparticles`. Report title: **Solid Inert Gas Nano Particles**. Subtitle: **Water + fine dry-ice particle injection**. Model tier: conditional finite-inventory thermal/entrainment sensitivity, API `v21.3`, state schema `particle-delivery-d1`. No experimental validation or fire-suppression prediction.

## Immutable identities and ownership

- Implemented D source: `4d780df7d8ef963d1abc95ff4c8f5486782586af`.
- Final retry-1 source: `0937d7b60db98d1ef1ed544bd745660c10e94f7c`, an ordinary merge of coordinator checkpoint `fcd1776909af93477133afec1b4fb70941b2064c`. Every D-owned implementation/test byte is unchanged from the first implemented freeze. Both identities remain in review history.
- Initial audited placeholder: `85f49eb7423f94c68b544e4d9450628d0ccade20`; score 1.3/10.
- Published D seam/base: `9a7350cfdc52e7b160e77dd8f30f01db826ee2c7`; READY publication: `44aa38f277d71d8d7d21f84070e02379edf1fc08`.
- Branch: `feature/v21-particle-injection`. Draft PR: <https://github.com/KadenCSmith/zombie-fire-suppression-sim/pull/24>, targeting `integration/v21-alternatives`.
- D authored only `src/alternatives/fine-dry-ice-injection/**`, `tests/alternatives/fine-dry-ice-injection/**`, and `docs/alternatives/fine-dry-ice-injection/**`. Shared seams and A/B/C changes came only from the coordinator's ordinary published merges. No main merge or deployment.
- Original baseline: `161e7a4a1f8c35765e1878c132db79977be1f5ea`; 57 protected SHA-256 identities pass. Manifest `docs/review/version21/original-preservation.json`, SHA-256 `a0ad327b424f60aa039c4c94f63331683e357aa3b707fe1d63881353f1480889`.

## What the model finds

Particles begin shrinking in the source at physical zero, continue shrinking during finite withdrawal and in hose/probe parcels, and enter the nominated underground contact specimen only if solid mass remains. Gas and water enthalpy travel with the parcel; sublimation heat is never spent twice. Complete upstream loss is an allowed result.

At the documented default 100 µm diameter, 0.01 kg dry ice and 1 kg water, the conduction reference delivers **zero solid CO₂ underground**. All 0.01 kg sublimates upstream. The explicitly unmeasured film-resistance sensitivity conditionally delivers **0.000841320274154137 kg** solid (8.4132% of initial CO₂), then sublimates that amount underground. Its altered effective conductivity and prescribed short residence are hypotheses, not measured apparatus performance or evidence of physical peat penetration.

Matched water-only, zero-particle, fully pre-sublimated and intervention-off controls preserve water quantity/schedule, soil properties and initial conditions. Additional CO₂ cold resource is disclosed. Pre-sublimation cools the same carrier to 291.5859729588857 K; it is not assigned fresh warm water at the probe.

## Supported equations and limits

See `README.md` and `PRIMARY_REFERENCES.md` for domains and primary references. The implemented restricted laws are spherical quasi-steady conduction with evolving radius/mass; finite water/gas enthalpy and latent balance; prescribed finite-parcel transport; and analytical two-capacity heat exchange with a finite warm nonreacting peat specimen. Internal units are SI and kelvin.

Bulk carrier temperatures below 273.15 K or above 350 K reject execution. Initial reacting-fire temperatures are outside the supported specimen domain (300–350 K). Local frozen shells, film behavior and blockage remain unresolved even when bulk water remains liquid. Pressure, real entrainment, filtration/deposition/penetration, spatial wetting/gas/O₂, combustion, extinction, re-ignition and ambient reheating are unavailable. CO₂ inventory is not an air-mixture/O₂ solution.

## Numerical and integration evidence

`candidate-provenance.json` records source/dependency/criteria hashes, runtime/environment, scenarios, executors, exact freezes and evidence hashes. `numerical-evidence.json` contains reproducible scenarios/refinement. Implementer logs remain under `implementer-checks/`.

At the final source freeze:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 16 inherited warnings.
- `npm run build`: PASS, inherited use-client/large-chunk warnings.
- `npm test -- tests/alternatives/fine-dry-ice-injection/physics.test.ts tests/alternatives/fine-dry-ice-injection/numerics.test.ts tests/alternatives.test.ts tests/alternatives-worker.test.ts tests/alternatives-presentation.test.ts --maxWorkers=2`: 35 passed, 3 failed of 38. All 13 D tests pass. The three shared failures still expect D to be an unavailable placeholder: pending compatibility text, failed worker initialization, and no original-context access. These coordinator-owned assertions were not edited by D.
- Full suite at the first implemented freeze: `npm test -- --maxWorkers=2`, 1905 passed and the same 3 failed of 1908; 113 passed and 3 failed of 116 files.
- `node scripts/check-original-preservation.mjs`: PASS, 57/57.
- `git diff --check`: PASS.

Maximum reported absolute mass residual is approximately 1.033e-14 kg; energy residual approximately 7.451e-9 J (relative 1.371e-14). Frozen tolerances remain 1e-10 kg and 1e-9 relative energy. Fine time steps .005/.0025/.00125 s produce shrinking entry-mass changes. Historical parcel .05/.025/.0125 s refinement puts the default .025 s result within the frozen 2% asymptotic tolerance. Retry2 rejects the coarse .05 s film parcel and refines .025/.0125/.00625 s instead, retaining the2% tolerance. Input bounds permit dt0.0003125–0.02s and parcel0.00625–0.5s, subject to the stricter onset lifetime screen; these bounds are not all-input accuracy guarantees. No spatial mesh exists; no spatial convergence is claimed. The reviewer preserves a coarse .02/.01/.005 s event-grid diagnostic that did not have monotonically shrinking increments.

## Independent review and UI evidence

Dedicated independent reviewer: `/root/d_realism_reviewer`. Frozen criteria SHA-256: `e9f4409dd874714ae06d12834f48c54c4bdf67c0e1c412866d37236fdf99f31d`. Weights: physics 30%, soil 20%, numerics/validation 20%, mechanism 20%, visual 10%. One initial audit plus at most three scored retries; integration cannot reset counters.

Retry-1 signed report is archived verbatim: physics7, soil3, numerics5, mechanism5, visual4, exact5.1/10 FAIL. It found a source-fixable10µm short-life false-zero delivery case. Retry2 adds fail-closed aged-source onset resolution screening and an exact onset event; its independent audit is pending. Initial1 + retry1 =2/4 scored passes, two retries remain before retry2. Initial/retry1 private evidence archives contain all signed top-level harnesses/results/manifests; disposable full-source/dependency copies are recoverable by immutable Git identity and hashes, and are not duplicated in the archives. No passing score is claimed. Unsupported central physical coupling caps the score at 6; labels and numerical tests cannot establish experimental validation.

Actual independent candidate UI inspection remains **unverified**. Browser policy verification denied the implementer's attempt; no browser/Electron/CDP workaround was attempted. The initial placeholder UI audit predates that denial and does not establish candidate UI correctness. Any coordinator UI evidence must name its own executor and exact identity, and cannot be substituted for an independent reviewer UI gate.

The private preview is <http://127.0.0.1:5177/?alternative=nanoparticles&method-preview=1>. Its two numerical panels own separate configuration, clocks, run identities, snapshots and export/reset controls. Enlarged mass-weighted symbols describe computed compartment inventories, not penetration. The read-only original fire/drill scene is labeled illustrative context.

## Coordinator completion

Integrate the frozen reviewed identity and report-only delivery commit; update the three stale shared assertions against actual D capability while preserving their lifecycle coverage; run the combined suite, preservation guard, export and permitted real-UI comparison checks. Shared changes require affected rechecks and must preserve this review history. Global build/validation documents are coordinator-owned. Keep PR draft, retain all limitations, and do not merge main or deploy.
