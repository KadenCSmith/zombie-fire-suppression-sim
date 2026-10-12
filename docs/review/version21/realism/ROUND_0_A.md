# Independent initial realism audit — 4.2.1, round 0

**Outcome: 4.1/10; verified ≥7: no.** One scored pass used. Independent reviewer `/root/realism_a_round0` did not implement this module and made no implementation changes. The central surface sublimation / liquid-preparation / enhanced injection mechanism is unsupported, so the fixed cap of 6 applies (arithmetic already lower). No serious conservation, SI-unit or numerical-stability failure was found in the tested calorimeter. This is an engineering review, not experimental validation.

Evidence workspace: `work/version21-realism/round-0/a/` under the repository. Frozen spec: `work/version21-realism/round-0/a/benchmark-spec.json`; numerical results: `work/version21-realism/round-0/a/benchmark-results.json`; machine-readable review: `work/version21-realism/round-0/a/report.json`.

## Frozen identity and isolation

Reviewed integration commit `9ebda6fae2e4101c80cd7b4e35f7ea13444263f9` plus frozen diff SHA-256 `25c643abe579096acc7a401cc27aced343f1bd738660bc05d5209ba102a52062`; frozen A delivery `22a60811f9c9381ea38085e4cc03aff6e559dbec`. Current HEAD `3b21c23d464d48c839f5d19d8715294204a042a7` adds only the rubric. The current root diff still matches the frozen SHA. Actual source, A private tests/docs, shared contact adapter/model and presentation host were inspected, alongside READY/contract/ownership and the human review prompt. The old worker handoff has obsolete cue timing; actual `visuals.ts` controls the audited narrative.

Source/tests/package/config were copied into the isolated evidence workspace with an initial SHA-256 manifest. `npm ci` installed 149 packages locally in3 s; source and protected dependencies were never edited, root dependencies never used for tests. Node v26.8.2 / npm 11.19.1 on Darwin 27 arm64 (MacBook Pro). All copied implementation files remain identical to root. Independent byte-hash verification passed all 57 original files against baseline `161e7a4a1f8c35765e1878c132db79977be1f5ea`; see `preservation-results.json`.

## Fixed scoring

| Criterion | Weight | Score | Evidence |
|---|---:|---:|---|
| Governing physics / conservation |30%|5|Conservative finite lumped contact; absent liquid/gas transport, surface energy coupling and reacting field.|
| Medium / soil constitutive behavior |20%|3|Local water/CO₂ constants supported; peat heat capacity and UA uncalibrated; soil moisture, retention, permeability, transport/reaction absent.|
| Numerical verification / independent validation |20%|6|64 independently executed checks and exact/refinement references pass; no measurements or held-out validation.|
| Method-specific accuracy / coupling |20%|2|Water inlet/flow prescribed; solid directly cools specimen 1, never surface water. No sublimation-assisted injection coupling.|
| Visual correspondence |10%|4|Actual computed SVG/readouts agree; narrative quenching/phase/accelerated flow comes from time, with no computed-state correspondence. Known native route error unresolved.|

Exact decimal weighted arithmetic is `5×.30+3×.20+6×.20+2×.20+4×.10=4.1`. Final `min(4.1,6)=4.1`. No aesthetic credit or labeling credit is included.

## What the actual equations compute

`src/alternatives/model.ts:12–24` builds 3 isolated0.5 kg hot specimens; location/radius are labels, not control-volume geometry. Every specimen has constant heat capacity 920 J/K (`cp,peat=1840 J/kg/K`). Each receives1/3 of delivered pure-water mass; this is a mass-flow fraction, not saturation. The optional solid CO₂ source has8 W/K contact only to specimen 1 from physical0 s. Water arrives at physical8 s by default, at prescribed293.15 K and0.025 kg/s. Default water inventory 0.5 kg is exhausted20 s after arrival. Defaults are examples, not a field dose.

The protected core `src/story/contactCooling.ts:83–105` integrates exact two-capacitance sensible exchange at fixed liquid mass within each step. It switches to373.15 K boiling and debits finite liquid latent heat. Vapor exports both sensible and latent enthalpy. `:140–157` uses `Cp(Tp−Td)[1−exp(−UAd Δt/Cp)]` for dry contact, limited by available specimen heat above inlet and `md Lsub`; it stops at the validity bound rather than predicting subambient equilibrium/freezing. `:158–166` supplies `min(remaining,r Δt)` at the start of each step and mixes retained liquid. Sequential dry/water exchange plus start-of-step mass delivery is a splitting/discretization choice;0.05 s is not an exact solution of continuous influx.

The independent energy identity is `CpΣ(Tp0−Tin) = CpΣ(Tp−Tin)+Qdry+Σmw cw(Tw−Tin)+Hvapor,out`. Each source heat appears once. Water and solid inventories separately close. Energy reference is inlet, so incoming-water reference enthalpy is zero by choice, not deleted energy. There is no O₂/fuel/reaction state or field suppression metric; null metrics are correct for this scope. No spatial mesh exists to refine. No tank, pressure EOS, liquid/CO₂ transport, permeability law, oxygen dilution or reaction response enters this alternative. In particular `co2-water` does not pre-cool incoming water.

The fixed-temperature latent CO₂ approximation is local: the code’s573274.4067 J/kg corresponds to 25.22952kJ/mol, close to the tabulated 25.2kJ/mol near 195 K. This supports limited latent heat, not a pressure or surface source model. [NIST CO₂ phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4). Water’s fixed 373.15 K plateau agrees with the normal boiling reference 373.17±0.04 K. [NIST water phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4). A temperature-dependent liquid heat capacity exists; the module uses 4186 J/kg/K instead. [NIST water thermochemistry](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2). Full thermodynamic functions could use a bounded property formulation, but are not implemented. [Official IAPWS release](https://iapws.org/technical-guidance/release/IF97-Rev).

## Benchmarks published before execution

`benchmark-spec.json` / `.md` were written before npm/test execution. No benchmark was corrected or tuned. Full actual states and expectations are in `benchmark-results.json`; independent test code is `tests/independent-realism-a.test.ts`.

The new water reference is derived independently from `Cp x′=−UA(x−y)` and `d(r τ cw y)/dτ=UA(x−y)` for uniform continuous inflow atTin, with `x=Tp−Tin`, `y=Tw−Tin`, `x(0)=Δ`. Until exhaustion:

`x(τ)=Δ exp(−kτ) Σ[n≥0] ((kτ)^n/n!) b/(b+n)`, where `k=UA/Cp`, `b=UA/(rshare cw)`.

After exhaustion, the weighted energy equilibrium and two-body exponential apply. Settings:3 × 0.5 kg,350 K/293.15 K,UA 24 W/K each,total water 0.5 kg,total flow 0.025 kg/s,arrival 8 s,times 8/8.5/9/18/28/60 s. No boiling is possible. Frozen default error tolerance 0.15 K is twice the early time-shift scale `UA Δ h/Cp≈0.074 K`; refined 0.0125 s tolerance 0.05 K, with strictly decreasing error required.

| Step [s] | Maximum temperature error against independent continuous-inflow solution [K] |
|---:|---:|
|0.2|0.06828545651296736|
|0.1|0.03586131834680373|
|0.05|0.019203044476910236|
|0.025|0.010023660660579026|
|0.0125|0.005148730992402761|

Dry exponential checks at 0/1/10/60 s used1 kg solid capacity,8 W/K,0.5 kg peat,823.15 K vs194.67 K: maximum error5.684341886080801e−13 K. The0.001 kg finite-solid check gave exactly 573.2744066621979 J and 822.5268756449324 K in specimen 1; other specimens stayed unchanged. Conditional two-body continuation after water depletion matched within 5.684341886080802e−14 K. This continuation test takes the depletion state as an initial condition and gives no credit for preceding infusion accuracy.

The complete-vaporization thermodynamic limit used a1kg1000 K specimen and0.1kg293.15 K water with effectively instantaneous exchange. It paid 259488 J (sensible plus latent), giving 858.9739130434782 K, exactly. This checks a final phase budget, not finite-UA infusion timing. Off/no-water/no-flow/no-UA/late-arrival/equal-temperature cases recovered their limits. Source-off matched a separately initialized baseline. Finite small inventories and inlet 273.15 K/350 K, specimen 350 K/1000 K stayed finite and within assumed phase/temperature bounds.

Across new benchmark states maximum absolute energy residual was 2.6542693376541138e−8 J; maximum absolute species/source mass residual 2.5923707624997405e−14 kg. Both pass frozen bounds (energy≤1e−4 J+1e−9× initial energy; mass≤1e−9 kg+1e−9× inventory). This is floating-point conservation, not empirical accuracy.

Reproduce in the isolated evidence workspace:

```sh
cd /Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/zombie-fire-suppression-sim/work/version21-realism/round-0/a
npm ci
npm test -- tests/alternatives/sublimation-injection tests/alternatives-contact-adapter.test.ts tests/contactCooling.test.ts tests/independent-realism-a.test.ts --maxWorkers=1
```

Result: 8 files/64 tests PASS, 0 failed, 1.22 s; see`npm-ci.log`,`tests.log`. The new checks account for 6 test cases; 58 existing checks also passed. Full suite, global typecheck/lint/build and new native full smoke were intentionally not run by this read-only reviewer. Actual fire measurements, matched experiments and phase-event timing refinement remain unrun. No claim of full project PASS or experimental validation follows.

## Actual application evidence and its limits

An independent Chrome tab 862380265 opened the actual app at`http://127.0.0.1:5173/?alternative=sublimation-injection`. At 38 s the existing drilling/fire context was visible; at 75 s the open surface solid/liquid/truck, hose, steam and darkened fire-region cues were visible, labeled illustrative. Source confirms phase amount,flow speed and quench depend exclusively on presentation time (`visuals.ts:23–44`), while the private shader darkens orange pixels using a time-driven radius (`quench.tsx:34–43`). Shared`AlternativeScene.tsx` hides the alternative fire layer at86 s. These are authored endings, not computed suppression.

In actual comparison view, only the A panel was started; other ready panels were unchanged. At 0 s its 3 specimens / maximum were823.15 K with zero heat/water. At 60 s all 3 SVG temperatures were489.0 K and 0.167 kg received; metrics showed 489.01 K,0.500kg water,9.22e5J heat,−2.64e−8 J/5.55e−17kg residual,with O₂/fuel/reactionN/A. Independent default-run results match that display precision. Screenshots were observed directly through CUA; coordinator screenshots are separately supplied evidence and get no independent-observation credit. No FPS estimate was made.

A later automation range-fill to 90 changed the input without updating the accepted 75 s caption ; 90 s narrative observation is therefore unverified, not treated as a proven app defect. The page intermittently returned to its initial hero without reviewer navigation; subsequent selector failure limits further observation. Own-tab error-log read returned empty; inherited Three warnings/browser-extension warnings were present.

Supplied`work/version21-final-alternatives.log` **failed** its renderer-error gate: `removeChild` NotFoundError was logged immediately after A’s second 75 s seek and before the 4.2.2 route-ready stage. This establishes transition association, not root cause. Supplied isolated GPU development andproduction seek/resize/remount logs passed. They do not erase the broader navigation failure; a narrow route / Html cleanup diagnosis is needed before claiming a clean runtime.

## Largest supported next fixes and exact blockers

1. Implement a separate open, unpressurized surface solid/liquid energy model in A’s private tree, then an additive coordinator outlet-state seam. Conserve finite solid/liquid mass and energy, compute water outlet enthalpy, and use it downstream. It requires initial media temperatures/loading history, actual measured or prescribed UA / contact area, ambient-loss assumptions, gas export state and phase-valid bounds/freezing handling. It must not infer accelerated injection or pressure from a visual cue. The contract’s AcceptedState/config/hooks currently lack surface-source/outlet state, so A cannot honestly expose that physics through the current shared seam alone.
2. A predictive soil response needs new additive liquid mass/enthalpy transport and reacting porous-medium coupling. Exact missing inputs are peat density/porosity/moisture basis, measured permeability/retention/relative-permeability behavior, source support/geometry and external liquid boundary conditions, temperature/moisture-dependent thermal properties and kinetics. Original 4.2.3 and protected dependencies cannot be edited to add it. No calibrated field response can be invented to fill these gaps.
3. Use accepted physical states for any claimed calculated cooling/phase visual. A’s current MethodSceneProps has only id/time; an additive accepted-state view seam is needed. Keep the authored narrative excluded from physics evidence. Diagnose the observed native route error with a focused actual-navigation regression, without guessing protected-file repairs.
4. Calibrate/contact validate with independent thermal/mass/evaporation measurements and uncertainties; hold out runs and retain these frozen analytical checks. For suppression/re-ignition claims, separate oxygen/fuel/moisture/reaction histories and a declared observation window are indispensable. Published peat experiments identify wetting/channeling/runoff mechanisms missing here, and are not matched data for this module. [Santoso et al. (2021)](https://doi.org/10.1071/WF20117).

These changes can improve correctness within bounded, newly supported physics. Disclosure, costs, prettier graphics, or a larger unit suite cannot establish the missing central mechanism or reach 7 by themselves. No pressure-device, charge, dose or destructive-pressure optimization is proposed.4.2.2 remains definition-pending and was not scored.

Signed: `/root/realism_a_round0`, independent reviewer of 4.2.1, shared round 0. Signed on 2026-10-12T07:57:40.769567+00:00. Reviewer implementation edits: none.
