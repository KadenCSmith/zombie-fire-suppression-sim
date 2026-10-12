# Agent D initial independent realism audit — signed, failing placeholder

Frozen identity: `85f49eb7423f94c68b544e4d9450628d0ccade20`. Reviewer: `/root/d_realism_reviewer`, independent of D implementation; no source edits, recursive delegation, or implementer self-grade. Run: `D-initial-85f49eb-independent-2026-10-12`. This is initial audit **1/1**, implementation retries **0/3**, scored passes **1/4**. Scores cannot be reset by integration or reviewer replacement.

## Verdict

**Unrounded weighted total 1.3/10; FAIL.** The actual registered `nanoparticles` method4.2.2 is an honest definition-pending placeholder. It has no private module, no supported engines, and no particle-state model. All12 engine/medium combinations independently rejected execution. No proposed equations, future shared seams, A/B/C implementations or unrelated solver tests receive D physics credit.

| Frozen criterion | Weight | Score | Actual evidence |
|---|---:|---:|---|
| Governing physics and conservation |30%|1|No D mass/species/enthalpy state or governing equations to verify. Correct blocking prevents invented results.|
| Medium/soil properties and constitutive behavior |20%|1|No D liquid, particle, peat, filtration or freezing behavior. Shared constants do not establish D coupling.|
| Numerical verification and independent validation |20%|2|28 focused shared tests pass; reviewer all12 rejected-call checks pass. No D physical benchmark or convergence; no experimental results.|
| Method-specific mechanism and coupling |20%|1|No source/hose/probe survival, underground sublimation or prescribed-vs-predicted transport implementation.|
| Visual correspondence to computed states |10%|2|Actual UI labels context illustrative/unavailable and disables predictive execution/Play; no computed D visual exists.|

Exact calculation `(30×1 +20×1 +20×2 +20×1 +10×2)/100=1.3`. Central mechanism unsupported; cap6 applies but does not alter raw1.3. Passing gates: weighted score≥7 **false**; absence of serious D conservation/unit/stability failure **not established** (no D physical model); actual UI inspection **true**; all required scientific evidence **false**. Blocking execution is not a numerical conservation pass.

## Frozen source and independent execution

The review uses a disposable `git archive` snapshot at `/tmp/agent-d-independent-review/initial-85f49eb`, never the live working-tree state. Read `src/alternatives/registry.ts`, `modules.ts`, `contract.ts`, `model.ts`, `records.ts`, `persistence.ts`, presentation files, worker, UI dispatch/host/science/comparison and contract/READY documents. Existing v21.2 contract excludes method4.2.2, registry has `engines:[]`, and generic `createRun` rejects before constructing unrelated solvers. D placeholder returns no accepted inventory/state. Scientific tests from A/B/C/contact/FEM do not satisfy D-specific requirements.

Commands, run in isolated snapshot with reused unchanged installed dependencies:

```text
node node_modules/vitest/vitest.mjs run tests/alternatives.test.ts tests/alternatives-worker.test.ts tests/alternatives-records.test.ts tests/alternatives-host.test.tsx --reporter=json --outputFile=/tmp/agent-d-independent-review/initial-tests.json
node_modules/.bin/esbuild /tmp/agent-d-independent-review/initial-independent-harness.mts --bundle --platform=node --format=esm --outfile=/tmp/agent-d-independent-review/initial-independent-harness.mjs
node /tmp/agent-d-independent-review/initial-independent-harness.mjs
node node_modules/vite/bin/vite.js --config /tmp/agent-d-independent-review/vite-review.config.mjs
node_modules/.bin/electron /tmp/agent-d-independent-review/initial-ui-review.cjs
```

Focused tests:28 pass,0 fail. Reviewer harness:12/12 engine/media calls blocked, no private D module, cloned configuration isolation verified. Full D physical inventory, conservation, depletion, off, zero-particle, full-upstream-loss, deterministic-state, mesh/time-step and calculated-visual checks are **unavailable**, not passed. Independently generated analytical diagnostics below are advisory and not executable D benchmarks.

Runtime: Node26.8.2, npm11.19.1, Darwin arm64, private Electron44.3.0 Chromium capture. Vite7.3.6 used private cacheDir and port5181 after collision check. No existing Chrome windows were touched. No dependencies installed. Twelve principal installed package versions match frozen lock. Exact runtime binaries, lock/package/config/criteria hashes, 13,918 dependency-file hashes and full frozen file manifest are in `initial-provenance.json`, `initial-dependencies-manifest.json`, `initial-source-manifest.json`, `initial-dependency-version-check.json`. Setup-only invocation/assertion corrections are documented in provenance and do not consume implementation retries.

## Actual UI inspection

Reviewed both screenshots personally: `initial-ui-overview.png` and `initial-ui-render.png`, plus DOM/runtime data `initial-ui.json`. The overview shows title4.2.2, Definition Pending, unavailable model, no experimental validation and disabled Execution. The render shows one original-context Canvas and disabled Play. A documentation button, Reset and render controls remain available as expected. There are no renderer console errors. No particle delivery, phase-history graphic or physical values exist. UI evidence is tied to this frozen source and private runtime by the provenance manifest.

## Unscored advice for proposed implementation

The source-free proposal has sound conservative intent: finite inventories/total enthalpy, continuous aging from mixing, honest full upstream-loss cases, no arrival reset and no oxygen deletion. Do not make it a passing evidence substitute. The steady spherical Laplace solution `Qdot=4πkr(T−Ts)` with latent-only fixed bath gives `r²=r0²−2k(T−Ts)t/(rho L)`. Independent calculation at293.15K bath,195K saturated-surface assumption, rho1560kg/m³ and L=25200/0.0440095J/kg gives100µm diameter disappearance0.01896038550978119s at k0.6W/(mK), and1.896038550978119s at k0.006. Diameter10µm gives0.0001896038550978119s at k0.6;500µm gives0.4740096377445298s. These are idealized reference times, not empirical aqueous particle lifetimes. A source that remains in contact for a long withdrawal schedule must continue losing solids even before individual parcel dispatch. Low effective conductivity, tiny prescribed residence or delayed contact must never become a forced survival rule. Complete source sublimation before flow is a valid primary outcome.

Explicitly label k_eff as unmeasured sensitivity. k_water conduction is not a guaranteed bound under convection, film boiling/sublimation, nucleate regimes or ice shells. Bulk liquid above273.15K does not rule out a locally frozen shell/blockage at a cryogenic particle. A liquid-domain rejection is useful but cannot validate entrainment, hose passage, perforation passage or peat penetration. Finite-bath gas sensible enthalpy must remain downstream after paying latent energy once. A matched presublimated1kg water/0.01kgCO2 reference gives291.5859729588857K (full precision in independent results), not a reset to293.15K.

A nominal195K surface is a restricted saturated-film assumption: measured surface temperature depends on surrounding gas concentration and pressure, and this has not been resolved for the proposed carrier. The referenced sphere study measured porous compacted-snow density835–955kg/m³; rho1560 is a separate dense-solid study assumption, not measured particle density. Peat cp/UA, retention and residence require stated provenance and sensitivity; a lumped contact specimen cannot establish field flow, oxygen displacement, extinction, re-ignition prevention or pressure.

Primary sources independently opened on2026-10-12: [NIST CO2 phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=24) supports25.2kJ/mol at195K; [IAPWS SR6-08](https://iapws.org/technical-guidance/release/LiquidWater) sets0.1MPa water correlation domains, including conductivity lower limit273.15K; [Purandare etal2023 primary paper](https://ris.utwente.nl/ws/files/320947389/1-s2.0-S0735193323004311-main.pdf) establishes the conditional saturated-vapor temperature and measured compacted-snow density. These do not validate10–500µm particles in water/hoses/peat. Aoki2002 publisher/DOI failed retrieval; peat DOI and MDPI page were also unavailable through the research tool, so their details are not independently credited in this audit. No empirical apparatus/delivery/suppression data supplied.

## Required next step

Wait for coordinator D-only READY/source seam before edits. Implement supported finite-inventory diagnostic physics and explicit limitations, then freeze candidate for the same reviewer and unchanged criteria. The central apparatus/soil coupling evidence gap remains non-fixable by UI polish or numerical tests; do not force7 or spend cosmetic retries. Preserve this audit and its counters.
