# Agent D independent scientific realism review — retry 2

Signed by `/root/d_realism_reviewer`, 2026-10-12T10:18:05.626808+00:00. Frozen candidate `fd8e7a0c3b3596c2ee439d7aec52c2bc71f92440`; tree `c9306d09a496a141fc92912224747cc43f07114c`. Private immutable archive `/tmp/agent-d-independent-review/retry2/source`. I made no source edits and used no other reviewer or delegation.

**FAIL, unrounded weighted total 5.1/10.** The original immediate-withdrawal false-zero now rejects atomically, but coarse pre-onset source aging can clip all solids to zero and bypass the new screen. This is a substantive source-fixable numerical defect. It must not be attributed to the experimental evidence gap. The candidate actual independent UI gate remains unverified.

## Frozen criteria and counters

Criteria SHA256 `e9f4409dd874714ae06d12834f48c54c4bdf67c0e1c412866d37236fdf99f31d`, unchanged. Initial audit `85f49eb7423f94c68b544e4d9450628d0ccade20` scored1.3; retry1 original `4d780df7d8ef963d1abc95ff4c8f5486782586af`/final `0937d7b60db98d1ef1ed544bd745660c10e94f7c` scored5.1. Prior signed reports and failures remain preserved. This is **initial1 + retries2 = 3/4 scored passes used; one retry remains**. No score was rounded up and no criterion/tolerance changed.

| Criterion | Weight | Score | Evidence and limits |
|---|---:|---:|---|
| Physics and conservation |30%|7|SI, finite inventory and independently reconstructed H pass in checked scenarios; approximate saturated-film/constant properties only.|
| Soil constitutive model |20%|3|Finite nominated peat calorimeter with assumed capacity/UA; no moisture-dependent porous constitutive validation or measured penetration.|
| Numerics and validation |20%|5|Independent analytical/ODE and tested asymptotic refinements; remaining accepted false-zero outside tested film case.|
| Mechanism coupling |20%|5|Source/hose/probe aging and conditional underground sublimation linked; aqueous film/ice/blockage, entrainment and peat delivery remain unvalidated.|
| Visual correspondence |10%|4|Accepted inventory, mean size and release source correspondence checked; actual candidate UI unverified.|

Exact `(30*7+20*3+20*5+20*5+10*4)/100 = 5.1`. Unsupported central coupling cap6 applies and leaves5.1 unchanged.

Gates: score≥7 **false**; no serious unit/conservation/nonfinite instability in executed default/control cases **true within that scope**; accuracy throughout validator-admissible delivery domain **false**; actual independent candidate UI **unverified/false**; all required evidence **false**. This is not a global stability or accuracy claim.

## Independent failing case

Full exact config, accepted state, target and executor are in `independent-guard-results.json`; derivation and runnable harness in `independent-guard-checks.mts/.mjs`. Water5kg, solidCO2 1kg, water350K, diameter100µm, density1560kg/m³, effectivek0.6W/(mK), withdrawal0.2kg/s beginning at0.015s, zero prescribed hose/probe residence, phase step0.02s, parcel interval0.00625s, target0.1s. All are accepted by the validator. No local pressure/flow apparatus is inferred.

Production accepts **0kg solid entry**. Its one pre-onset frozen-bath radius update clips the source to zero; the onset guard then skips because it requires positive numerical source solids. Independent finite-bath RK4 retains **0.0261140340051kg solid at onset** and gives **6.5726649592975e-07kg continuous ground entry**, so relative entry error is100%. RK4 step2.5e-9s versus1e-8s changes entry by only2.01252e-15kg. The bulk mixture stays in the permitted liquid regime; this is not a freezing rejection.

Independent derivation: let `u=r²/r0²`, `gas=m0(1-u^(3/2))`, conserved `H=mw*cw*(T0-Ts)`, and `T(u)-Ts=(H-gas*L)/(mw*cw+gas*cg)`. Then `du/dt=-2k(T(u)-Ts)/(rho*r0²[L+cg(T(u)-Ts)])`. Proportional homogeneous withdrawal preserves H/w and initialCO2/w; continuous surviving entry is `flow*m0/mw` times the solid-fraction age integral after onset. This uses the same assumed entrainment/adiabatic surrogate with an independent integrator, not new physical validation or forced survival.

Recommend fail closed before aging for unresolved early withdrawal, and refuse to certify complete source loss from numerical clipping inside a conservative extinction upper bound. For valid liquid `T≥273.15K`, the increasing rate `(T-Ts)/[L+cg(T-Ts)]` gives a latest-extinction bound using the minimum allowed liquid temperature. Delays beyond that bound can preserve supported zero results. Conservative rejection inside the bound is acceptable; forcing surviving particles is not. Keep scenario-specific refinements and the aged-source screen. Final retry3 must verify this edge, original immediate edge, valid delayed zeros and film controls under the same rubric.

## Independent checked successes and retained diagnostic failure

Owned frozen tests independently rerun **14/14 pass**. Private independent general checks **11pass/1fail**, retaining the coarse-grid shrinking-differences diagnostic failure verbatim. From default dt0.005s through0.0003125s, asymptotic differences shrink; default-versus-finest entry relative difference1.949348554e-05, peat2.045667623e-08. Accepted parcel intervals0.025/0.0125/0.00625s give continuous-reference entry relative errors1.44005%/0.721145%/0.360907%, monotone and within unchanged2% bound for the tested film scenario. Coarse0.05s film parcels now reject; the prior coarse accepted failures remain historical evidence. No claim extends these bounds to every validator-admissible combination.

Original10µm immediate-withdrawal edge rejects with underresolved-delivery reason and leaves last accepted snapshot unchanged. Default100µm/k0.6 source delayed1s remains accepted zero ground solids/all0.01kg sublimated upstream. Filmk0.006/short prescribed residence remains accepted0.000841320274154137kg entry and underground sublimation. Non-grid withdrawal0.0137s film case remains accepted. Separate controls check off/zero/no source, depletion/nondivisible last parcels, pre-sublimated counterfactual, invalid/freezing rejection, independent config/snapshot clones, deterministic cadence replay, stale export rejection, explicit unsupported fields null and no oxygen deletion claim.

Independent max mass residual1.0325074129e-14kg; max absolute H residual7.45058059692e-09J; relative H residual1.37114667246e-14; reconstruction error1.7462298274e-10J. Analytical sphere and two-capacity heat references pass. These do not rule out untested errors elsewhere.

## Source, environment and evidence integrity

Full source, owned scope and installed dependency manifests plus hashes in `provenance.json`. Source manifest SHA256 `a08426987a266896167aa59365ca62c75adb5f55ac395be6e1f82f4b836365a5`; owned manifest `283125f61bedb704bcfce436463db064593d218d3d8890b521a0d834b5e70c4f`; lock `7a49fa111bc72e8afbd486195bc35bcbc20573f6d3c6f82824e0e1a538b5aa7d`; runtime `v26.8.2` at `/opt/homebrew/Cellar/node/26.8.2/bin/node`, binary SHA256 `902b6a6984d5d825829ea9064ab73b734548df37bc0683990dca31c8dc2a9253`. Installed non-cache regular files independently rehashed: 13918files; changes from prior audit `[]`. General shared evidence reused only after source/dependency hashes matched. Package/config and all changed-source hashes recorded. No installation. Parent-reported typecheck/lint/build/57guard are supporting implementer evidence, not independently relabeled here.

I reviewed all changed owned source/tests and affected display text, and previously audited unchanged model/registry/shared seam closure. Size provenance now describes configured SI diameter without stale100µm literal. The onset screen disclaimer correctly disclaims an all-input certificate, but the unresolved clipping path contradicts its blanket rejected-zero wording until corrected.

No actual candidate browser/nativeUI attempt occurred. Reported administrative browser verification denial and explicit coordinator prohibition of browser/Electron/CDP/indirect workarounds remain binding. Source-to-SVG checks alone cannot satisfy the actualUI gate; initial placeholder screenshots apply only to their freeze.

Central missing evidence remains aqueous film/ice-shell/blockage, particle slip/filtration/deposition/peat penetration, pressure-driven wetting, spatial gas/O2 and boundaries, combustion/extinction/re-ignition, ambient reheating/drainage and measured validation. Numerical verification is distinct from experimental validation. After the source-fixable correction, stop honestly for those gaps if unresolved; do not force7.

This report is final for retry2 freeze. Signature JSON records reviewer identity and exact SHA256 evidence hashes (integrity manifest, not cryptographic identity attestation).
