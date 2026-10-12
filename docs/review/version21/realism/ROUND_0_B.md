# Independent realism audit B — shared round 0

**Signed by `/root/realism_b_round0` at 2026-10-12T08:05:13.958543+00:00.** I did not implement B. This is the initial read-only engineering audit requested through `/Users/kadensmith/Downloads/V21_Realism_Review_Loop.md`, under the frozen [rubric](RUBRIC.md). One scored pass is used for each alternative. No revision has been scored. A score is not certification or experimental validation.

## Separate results

| Fixed criterion | Weight | 4.2.3.1 liquid waves | 4.2.3.2 pressure only |
| --- | ---: | ---: | ---: |
| Governing physics and conservation | 30% | 5 | 1 |
| Medium/soil properties and constitutive behavior | 20% | 3 | 1 |
| Numerical verification and independent validation | 20% | 5 | 2 |
| Method-specific mechanism accuracy and coupling | 20% | 2 | 1 |
| Visual correspondence to computed states | 10% | 4 | 2 |
| **Unrounded weighted arithmetic** | | **3.9** | **1.3** |
| Unsupported central mechanism cap | | 6 | 6 |
| **Effective realism total / verified ≥7** | | **3.9 / no** | **1.3 / no** |

Both pressure mechanisms are unsupported, so the fixed cap applies even though neither arithmetic total reaches it. No serious unresolved mass/energy conservation, unit, or numerical-stability failure was observed in the actually implemented calorimeter subset. Two analytical temperature tolerances failed. Pressure-only physical conservation/stability is **unavailable for assessment**, rather than a passing zero-response physical benchmark. Its missing required physics/evidence and both central-mechanism caps prevent a verified pass. Disclosure and authored visual polish earn no added physics or experimental-validation credit.

For liquid waves, the five scores reflect, in order: a conservative finite-water calorimeter but no pressure/spatial/reaction balance; approximate water properties and uncalibrated peat/contact assumptions; substantial local numerical checks with two early-fill failures and no measured validation; absent pulse/wave/soil/combustion coupling; and accurately calculated specimen readouts alongside a predominantly authored 3D movie. For pressure-only: no physical equations/state; no constitutive material model; tested source-free interface only; no central pressure-response coupling; and a neutral concept display without a computed pressure/deformation field.

## Exact reviewed identity and preservation

Reviewed source commit **9ebda6fae2e4101c80cd7b4e35f7ea13444263f9**, plus frozen pre-review uncommitted patch SHA-256 **25c643abe579096acc7a401cc27aced343f1bd738660bc05d5209ba102a52062**, stored as `work/version21-realism-initial.patch`. Current capture HEAD **3b21c23d464d48c839f5d19d8715294204a042a7** adds the frozen rubric only. Integrated frozen private B delivery: **5373e535918c9f2ddd300d58cc48c3e449013cdc**. Additional frozen untracked fixtures are `scripts/smoke-alternative-gpu.cjs` SHA-256 `44cfc1c8cca126d9790fbd010c4c7c271040b275f8f5fc3d5368afb77e02b9a2` and `scripts/smoke-vibratory-field.cjs` SHA-256 `a3dc9192c7ab9710db49af45f1a43c65743912c43eb6750b691d3f3559a26ffe`; they were not executed by me.

I independently hashed all **57/57** protected identities against the established original **161e7a4a1f8c35765e1878c132db79977be1f5ea** manifest, including original source/assets/tests. All match. I inspected the actual complete original scene and workspace plus original story/protocol context read-only, not merely the introductory replay. I inspected both actual private B trees, their tests/evidence/science text and the shared model, registry, contact adapter, reference integrator, concept/worker lifecycle and alternative scene/comparison hosts. No original or implementation edit, Git mutation, worker message or dependency change was made. The coordinator subsequently authorized this exact new review document; all other review writes stay in the isolated folder below.

## Actual equations, units and boundaries

`src/alternatives/pressure-pulse-liquid-waves/model.ts` forwards a cloned known-water contact config to the shared supported run and forcibly excludes dry ice. `src/alternatives/model.ts:13` constructs **three independent 0.5 kg nonreacting specimens** at fixed positions; their radii/positions are metadata rather than control-volume geometry. All have the same temperature, assumed UA and arrival time, and each receives one third of supplied water mass. There is no peat moisture, pore-saturation, oxygen, fuel or reaction state in this subsystem. It is an isolated hot-body experiment, not a representation of active smoldering peat.

At defaults: initial823.15K, inlet293.15K, finite source0.5kg, flow0.025kg/s after12physical seconds, UA24W/K per specimen, end60s. The shared additive adapter calls the unchanged public reference with step0.05s plus event boundaries. It recomputes from initial inputs at every accepted target; checkpoints are not integration steps. Source exhaustion is32s. No result changes when the pressure/movie functions are evaluated.

For a specimen, `Cp=mp*1840 J/K`, `Cw=m_liquid*4186 J/K`, `Qeq=(Tp−Tw)/(1/Cp+1/Cw)` and `Q=Qeq[1−exp(−UA(1/Cp+1/Cw)dt)]`. The exponential is dimensionless and Q is joules. Sensible exchange stops at373.15K; remaining exchange cools the specimen exponentially toward this plateau and is capped by retained liquid times2.26e6J/kg. Exported vapor carries its sensible enthalpy above the inlet plus latent enthalpy exactly once. Incoming water has zero reference enthalpy because the ledger reference is its inlet temperature. There is no ongoing heat input/combustion, spatial conduction, flow residence, pressure work, freezing or condensation model. Thermal capacities, UA, temperatures, flow, time and masses use consistent SI/kelvin. Allocation fractions are supplied-mass shares; the displayed retained-liquid indicator is not pore saturation.

The correct finite ledgers are `M0=M_remaining+M_bypass+M_liquid+M_vapor` and `E_peat,0=E_peat+E_liquid,sensible+E_vapor,sensible+latent`. Original replay pressure/source behavior is not a new calorimeter source. No source-corrected reaction balance can be assessed because this child has no reacting field.

`pressure-pulse-pressure-only/model.ts:12` permits concept only, rejects water/solid treatment and physical engines, and removes stale thermal inventories/flow/UA in its private clone. The shared concept run returns exactly `{timeS,metrics:null}`. No pressure, momentum, mechanical work, energy, stress/strain, porosity or permeability equation exists. Its exponential/trigonometric contour easing is dimensionless choreography. Source-free guards prevent fabricated cooling but do not establish a pressure-response model.

The atmospheric water approximation has limited primary support: [NIST phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4) gives normal boiling373.17±0.04K. [IAPWS IF97](https://iapws.org/technical-guidance/release/IF97-Rev) provides pressure-dependent water/steam thermodynamics, which this constant-property proxy does not implement. The inherited peat cp1840J/(kgK), UA, uniform-temperature assumption and exact delivery/contact allocation lack measured calibration; no Biot-number/lumped-validity evidence is supplied. The default hot specimen is not credible as a whole reactive peat state solely because its thermal energy balances.

## Frozen independent benchmarks and execution

All review artifacts are under **`work/version21-realism/round-0/b/`**. Source/tests/package+lock/config were copied there before execution; its own `npm ci` installed149packages in2s. The root implementation, installed dependencies and worker checkouts were untouched. Node26.8.2; Darwin27arm64; Apple M3 Pro12CPU; RAM38654705664bytes. Concurrent app/review work was present; timings are reproducibility observations, not hardware guarantees or FPS claims.

`benchmarks.md` and `benchmarks.freeze.json` were frozen before new numerical executions, SHA-256 **b1126c1ade7bc50d11279c380357822b852b6572a53c2fa31de521aa153957e9**, timestamp **2026-10-12T07:49:06.157853+00:00**. They specify exact settings, independently derived ODE solutions and tolerances. Mass tolerance is1e−9kg+1e−9×inventory; energy tolerance is1e−4J+1e−9×initial sensible-energy scale. No expected solution or tolerance was changed after inspecting outputs.

The reviewer harness `reviewer-benchmarks.test.ts` ran eight benchmark groups: **7pass/1fail**, **809/811 individual assertions pass**, measured harness runtime **0.08381s**. Its full per-assertion values remain in `results.json`; source identity is in `snapshot.json`, preservation hashes in `preservation.json`. The initial Vitest reporter used its default `.vitest/json/output.json`; the later existing-test command replaced that reporter file. The separate reviewer `results.json` remains intact, including both failures and timings. Reproductions should use distinct `--outputFile` paths.

- Default/intervention-off/zero-inventory/zero-flow/zero-UA limits, finite exhaustion, event boundaries, no-wave-benefit, independent snapshots and pressure-only source/engine rejection passed.
- Independent exact two-body sensible exchange passed1e−9K temperature and1e−6J heat tolerances. The test explicitly checks the numerical within-step bolus convention and is not physical validation of instantaneous injection.
- Exact sensible/boiling/depletion limits passed1e−8K,1e−5J and1e−10kg tolerances. Independent boiling onset0.7134258299046429s; depletion9.00488857938622s; after20s hot-specimen541.0978260869565K, all0.1kg vaporized and259488J transferred. This tests phase accounting, not pressure-dependent boiling or empirical peat performance.
- A non-grid arrival14.015s, share0.6, source12s to32s produced exactly the expected contacted0.269775kg and bypass0.230225kg within frozen mass tolerance.
- Independent continuous-fill solutions were derived from `Cp*dθp/dt=−UA(θp−θw)` and `d(m*cw*θw)/dt=UA(θp−θw)`, with `m=r*t` and finite depletion followed by two-body exchange. These compare physical continuous filling with the solver's beginning-of-step supply splitting. The two failures below remain failures.

| Failed frozen check, elapsed time after arrival | Actual water K | Analytical water K | Absolute error K | Tolerance K |
| --- | ---: | ---: | ---: | ---: |
| inlet273.15K, hot360K, elapsed1s, dt0.05s |308.9813963261465|308.2076844004554|0.7737119256911456|0.2|
| inlet293.15K, hot360K, elapsed1s, dt0.05s |320.7300672930673|320.1345273709896|0.5955399220777053|0.2|

For the first failure the specimen error is only0.0293365771824K; the larger water error occurs because the newly filling local liquid inventory is small. The singular small-mass start makes an overall thermal-time-scale bound insufficient for that water readout. The benchmark is retained rather than relaxed. Refinement errors for the low inlet atdt0.1/0.05/0.025/0.0125s are1.4448922258/0.7737119257/0.4038643873/0.2074480729K; observed order0.96112068. This is convergent first-order temporal error, not an observed instability.

Default boiling-case timestep refinement to0.00625s gave final501.78986826987546K; production0.05s gave501.75266005643573K, difference0.03720821343972602K. Three equal specimens matched one1.5kg/UA72 specimen to the frozen temperature/heat/mass tolerances. There is no spatial mesh: pressure-field mesh convergence is unavailable. Supported inlet273.15/350K, resource, arrival, flow and UA extremes passed finite-inventory and state bounds; rejected invalid inputs passed. No experimentally justified material-property accuracy is inferred from these synthetic cases.

Independently recomputing energy from accepted **patch temperatures and liquid/vapor masses plus input constants**, rather than trusting its reported energy residual, also passed all **33default/variation cases** in `independent-balances.test.ts` / `independent-balances.json`: maximum raw mass residual **7.529532553007812e-13kg**, maximum raw energy residual **1.4761462807655334e-07J**. Across the original811assertions, maximum reported mass residual7.529532553007812e−13kg, energy residual2.5401823222637177e−7J, and water-destination heat difference1.5296973288059235e−7J. All satisfy the frozen conservation thresholds.

Independent existing tests: **67/67pass in9files**, reporter elapsed **1.62061865234375s**, preserved as `existing-tests.report.json`. They include both B private trees, unchanged contact tests, external adapter, worker, alternative model and scene composition. This is software/numerical evidence only. I did not run the heavy full suite, root build/lint/typecheck, native original regression or GPU fixtures; the coordinator owns integration gates. Supplied native status is inherited evidence, not my independent execution.

Executed commands from the isolated directory (logs retained there):

```sh
npm ci
npm test -- reviewer-benchmarks.test.ts --maxWorkers=1 --reporter=json
npm test -- tests/alternatives/pressure-pulse-liquid-waves tests/alternatives/pressure-pulse-pressure-only tests/contactCooling.test.ts tests/alternatives-contact-adapter.test.ts tests/alternatives.test.ts tests/alternatives-worker.test.ts tests/alternativeSceneComposition.test.tsx --maxWorkers=1 --reporter=json
npm test -- independent-balances.test.ts --maxWorkers=1 --reporter=json --outputFile=independent-balances.report.json
npm test -- remediation-diagnostic.test.ts --maxWorkers=1 --reporter=json --outputFile=remediation-tests.report.json
```

## Independent actual-app observations

My separate Chrome audit tab **862380268**, at127.0.0.1:5173, successfully inspected both alternatives; no user tab was operated. CUA screenshots and DOM snapshots are in the tool transcript. Liquid observations at55.3/77/80/89.5presentation seconds respectively showed the initial original release, pulse fronts/fissures with liquid, normal pumping/wetting, and a dark authored ending. The visible presentation clock is separate from the physical solver clock. The main scene receives presentation time, not the B accepted contact state: pressure/crack growth/wet/char coverage and the host's89s fire-layer switch are authored. Their appearance cannot validate wave transport, penetration or suppression.

I independently ran only the liquid comparison panel and read its completed60s state: three501.8K specimens,0.167kg received each, maximum501.75K, supplied0.500kg, heat8.87e5J, energy residual−2.84e−8J, mass residual4.44e−16kg, and O2/fuel/reaction N/A. Those displayed rounded values agree with the independently reproduced default outputs. Readouts/temperature colors are computed; natural movie effects are not.

Pressure-only observations at48/66/90presentation seconds showed a faint expanding/relaxing contour, then no contour; the original fire/context stayed present, with no liquid truck/hose or invented extinguishment. I added a separate pressure-only comparison panel, ran it to60presentation-stage seconds, and observed all physical metrics N/A and no physical outcome/calculated curve. I removed only that audit-added panel afterward, restoring the prior three-panel configuration. The planned exact38s screenshot was not separately captured; source/animation boundary tests cover that limit.

Coordinator-provided `outputs/version21-pressure-pulse-preview.jpg` and `outputs/version21-pressure-ending-preview.jpg` were separately viewed and agree with my independent77/89.5s observations. They remain **provided**, not my captured evidence files. The two-truck opposing-approach/fissure request was supplied after the frozen snapshot. Any later fulfillment can affect correspondence/visual regression only; it supplies no pressure, transport, conservation or suppression evidence and warrants no physics-score gain.

## Supported next correction and exact blockers

**Supported numerical correction:** the coordinator can change the **nonprotected** alternative `buildContact` policy (`src/alternatives/model.ts:23`) to pass step0.00625s through the existing external adapter into the **unchanged** protected public reference. This changes neither protected source nor original reference defaults/cache, and needs no new pressure input or API signature. At the coordinator's request I executed the separate, explicitly **unscored post-freeze** `remediation-diagnostic.test.ts`, retaining the original two failed checks. Atelapsed1s the low-inlet water error falls to0.1054885099070475K with0.00625s, and0.05330387047081331K with0.003125s; all three inlet diagnostics pass the same0.2K tolerance. See `remediation-diagnostic.json`. This is evidence for a bounded temporal-accuracy correction, not an implemented change or a revised initial score. A future independent round must retain the frozen scenarios/solutions/tolerances, distinguish the legacy protected0.05s reference test from new production alternative policy, and recheck every alternative affected by the shared policy.

The largest realism deficit is the absent central mechanism, not the local calorimeter error. Required inputs are a measured **generic environmental pressure boundary/history**, physical domain/initial/boundary states, peat composition/density/moisture/porosity and measured thermal properties; suitable fluid/EOS/compressibility/attenuation and stress/deformation laws with independently calibrated parameters; hydraulic retention/relative permeability and residence/distribution data for liquid transport; and independently validated thermal/oxygen/fuel/moisture reaction behavior over an observation window for suppression/re-ignition. No such measured source/soil/response dataset or new pressure/mechanics/field source hook is supplied. The current frozen v21.2 seam supports only contact/concept. B cannot repair shared/protected code by editing its private trees; a legitimate new coupled solver would require coordinator-approved additive scope and actual data, rather than guessed parameters or relabeled animations.

Relevant primary context: [van Genuchten1980](https://www.ars.usda.gov/arsuserfiles/20360500/pdf_pubs/p0682.pdf) relates retention and hydraulic conductivity through fitted material parameters; this supplies neither peat parameters nor validation here. [Biot1956](https://doi.org/10.1121/1.1908239) treats coupled compressible-fluid/solid wave behavior under explicit assumptions; I inspected its primary indexed abstract, while full publisher/PDF retrieval failed. It is context for missing coupling, not a ready validated peat model. [Lin and Huang2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7289759/) reports measured interior-temperature and suppression observations; its indexed primary full text was readable although direct PMC navigation challenged access. It demonstrates why visible disappearance of glow does not establish smoldering extinguishment; no experiment from it was numerically matched by this implementation. No pressure-generation apparatus, charge, destructive setting, containment or trigger design is proposed.

Do not replace missing data with arbitrary permeability/fracture/collapse, oxygen deletion, unexplained cooling or scripted suppression. Keep unsupported predictions unavailable and finish below7 unless the actual model and independent evidence change. Additional trucks, fissures, labels or limitations text cannot lift either central cap. Original4.2.3 stays protected.

**Review handoff:** initial audit complete; both alternatives below7, two disclosed local numerical failures, no empirical validation. No implementation changes made by this reviewer. Only nested review/work folders and files were created under the existing project, so the Finder top-level-folder tag rule does not apply.
