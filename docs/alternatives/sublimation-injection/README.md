# 4.2.1 · Extinguishing Medium Sublimation and Injection

This module adds an independent conceptual render and a validated adapter boundary for the existing **unvalidated finite-contact thermal proxy**. It does not implement a surface pressure system or field injection. Original base 4.2.3 remains unchanged and independently callable; no original implementation is copied, relabeled or modified.

The proposed concept prepares solid and liquid media at the surface, followed by delivery through excavator-drilled access. Surface phase change, pressurization, liquid pre-cooling and penetration remain hypotheses. The render uses symbolic media blocks and an authored path, not device dimensions or construction details. No suppression, re-ignition or economic benefit is predicted.

## Entry points and scope

- `src/alternatives/sublimation-injection/index.ts`: stable `variants` and `methodModule`, API v21.2; no React, Three.js, timers, workers or self-registration. The adapter checks identity, supported engine/medium, finite shared-range inputs, boolean intervention, integer seed and the hot-contact temperature domain. It clones settings before calling the approved shared hook.
- `scene.tsx`: `MethodCues`; independently authored solid/liquid preparation and delivery cues. It imports no original scene, equipment, geometry or story timeline. Symbols and labels never feed a scientific state.
- `science.tsx`: `MethodScience`; in-app equations, assumptions, sources, limitations, proposed empirical plan and preliminary cost evidence.
- `evidence.ts`: cited source links and a simple consumed-water cost allocation, separate from solver calculations.

Preview: `http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1`. Ordinary method selection opens its latest illustrative render directly. The original rapid scene remains the app's default 4.2.3. Use **Compare Alternatives** for the supported contact calculation.

## Implemented thermal system

The supported hook constructs three independent 0.5 kg lumped hot specimens. There is no spatial transport, reaction, fuel consumption, gas species transport or oxygen balance in this proxy. The reacting FEM baseline remains separate and untreated. Water is retained in each specimen until evaporated; vapor leaves at the prescribed atmospheric boiling plateau. Other surfaces are adiabatic. Supply temperature is assumed, never derived from a surface tank.

For a physical interval Δt, `Cp = mp cp`, `Cw = mw cw`, `Qeq = (Tp − Tw)/(1/Cp + 1/Cw)` and `Qs = Qeq [1 − exp(−UA(1/Cp + 1/Cw) Δt)]`, capped by energy to reach boiling. Peat loses the same sensible energy the liquid gains. Remaining time at boiling transfers latent heat, bounded by remaining liquid and available specimen heat: `Δmv = Qlatent/Lv`. Vapor exports both its sensible enthalpy relative to inlet and latent heat. Delivery is `min(remaining supply, mass rate × Δt)` after the prescribed arrival, with equal **mass-flow fractions 1/3**. These fractions are not volumetric moisture, mixture composition or pore saturation.

The optional `co2-water` selection supplies separate direct solid CO₂ contact only to the first specimen, starting at physical time zero. Its requested heat is the exponential lumped-specimen/contact solution, limited by the finite `md Lsub` budget and specimen sensible heat above inlet temperature. `Δmd = Qd/Lsub`; this term stops at the hot-calorimeter lower validity boundary, not a predicted phase equilibrium. It never pre-cools incoming water or supplies oxygen. Missing material properties use the explicit `unspecified` sentinel: contact execution is rejected, while conceptual preview has null physical metrics.

The external alternative adapter calls the unchanged public `simulateContactCooling` reference with 0.00625 s steps and arrival/event boundaries. The independently selected original retains its own 0.05 s defaults/cache. The adapter recomputes from initial conditions at accepted targets; output checkpoints normally occur every 0.5 physical seconds. Any monotonic target in the configured window is accepted without using frame rate as an integration step. The separate 90 s presentation shows the truck arriving at 38–48 s, hose connection at 48–56 s, open bucket loading at 55–66 s, lid closure at 68.5–71.3 s and an authored flow increase at 71.5–77.5 s. Bubbles start on water contact before closure; no simulated pressure law is inferred. No visual cue sets the default 8 s physical water arrival. The visibly supported loading arm, gravity-shaped falls and contact effects remain authored illustrations.

Default contact assumptions: uniform 823.15 K specimens, 293.15 K water, 0.5 kg liquid, 0.025 kg/s delivery, 8 s arrival, each specimen UA 24 W/K and a 60 s observation window. The optional direct solid inventory is 0.05 kg with first-specimen UA 8 W/K. These are demonstration/calorimeter assumptions, not a proposed field dose or calibrated treatment.

## Properties and provenance

All numerical temperatures are kelvin, mass is kg of each pure material and energy is joules. Water uses inherited constant `cp = 4186 J/(kg K)` and `Lv = 2.26 MJ/kg`, approximations near room temperature and atmospheric boiling. [NIST water thermochemistry](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2) provides temperature-dependent reference heat capacity; [phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4) provide phase-reference context. The implementation does not evaluate their temperature-dependent fits, and accuracy across the UI's 300–1000 K specimen range is unestablished. Specimen `cp = 1840 J/(kg K)` and both conductances are inherited assumptions lacking method-specific calibration.

CO₂ uses `194.67 K` and `Lsub = 6030 × 4.184 / 0.0440095 J/kg` (about 573 kJ/kg). [NIST CO₂ data, Giauque and Egan (1937)](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4) give approximately 25.2 kJ/mol near 195 K from data over 154–196 K. This constant models limited direct-contact sublimation heat only. It supplies no pressure law, tank balance, gas warming/transport or broader phase diagram. Known contact properties do not resolve the separate black-box source status.

Authoritative input ranges remain the shared `PARAMETERS` schema. The worker-safe boundary mirrors frozen v21.2 bounds to avoid an import cycle; a private test requires exact equality with that shared schema. Defaults and ranges have not been changed. A future shared range change must update this checked mirror with the coordinator.

## Conservation and unavailable metrics

Energy closure is `initial specimen sensible energy − remaining specimen sensible energy − heat to CO₂ − retained liquid sensible energy − exported vapor enthalpy`. Water closure includes remaining supply, bypass, retained liquid and vapor; CO₂ closure includes remaining, sublimated and exported solid. Each source enters once. Off disables both source inventories/conductances and equals the isolated no-treatment baseline. Empty inventory, zero flow, zero contact UA, delayed arrival and zero sensible temperature difference recover their supported limits.

No modeled pressure, infiltration, permeability, penetration depth, oxygen/fuel/reaction or suppression winner exists. Contact oxygen, fuel and reaction metrics are null. The UI's thermal history is a calorimeter trajectory, not a smoldering prediction. No experimental validation is claimed.

## Virtual comparison and proposed empirical plan

Compare the isolated untreated reference, water contact and optional direct solid contact with matched specimen mass, initial/inlet temperatures, numerical step, seed and observation window. Explicitly disclose finite inventories, UA, contact timing and the solid term. Compare temperature and ledger closure without ranking field success. Optional linked physical time belongs to the shared scheduler; presentation clocks remain independent.

The following study is proposed and **has not been performed**. Begin with open, unpressurized calorimetry, recording specimen/water temperatures, supplied/retained/evaporated water masses, known thermal input and ambient losses. Include no-treatment and water-only controls; calibrate instruments independently and repeat conditions with measurement uncertainties. Estimate contact UA on training runs, reserve held-out runs for temperature-history and closure checks, and assess model discrepancies before validation claims. Any later peat-combustion study must independently measure oxygen, dry fuel and moisture, reaction/thermal history and possible re-ignition over a declared post-treatment window; the current contact proxy cannot answer those questions. This plan contains no pressure-device procedure.

[Santoso et al. (2021)](https://doi.org/10.1071/WF20117) investigated flow rate/wetting effects in laboratory peat suppression. It motivates measuring delivery and wetting but does not calibrate this contact model or establish the proposed tank/field mechanism.

## Preliminary costs

Reference date: 2026-10-11 local; USD. These are generic measurement/material examples, not an installed-system estimate.

| Scope | Public reference | Preliminary allowance | Missing inputs |
| --- | --- | --- | --- |
| Capital · temperature logger only | [Onset UX120-014M](https://www.onsetcomp.com/products/data-loggers/ux120-014m), $380 | $285–475 using an authored ±25% planning sensitivity | External probes, required software/cable and other instruments; supplier uncertainty is not ±25% |
| Operating · consumed water allocation | [Walmart distilled water, one US gallon](https://www.walmart.com/ip/Great-Value-Distilled-Water-1-Gallon/17501951806), $1.44 online | Assume 1 kg/L and 3.785411784 L/US gal: about $0.38/kg, $0.19 per 0.5 kg; ±25% planning sensitivity gives about $0.14–0.24 per 0.5 kg | Minimum one-jug purchase $1.44; local price/availability, unused stock, losses and energy demand |
| Operating · other solid/materials | Unavailable | No estimate | Current verified supplier quote and consumption/losses |

Prices exclude labor, shipping, factory overhead, tax and fees. The Onset listing separately excludes duties/taxes/fees and sells probes separately. The retailer price is an online reference, not a local quote. No pressure-equipment build list, installed total or proven cost savings is supplied.

## Verification and delivery

Run from this owned checkout:

```sh
npm ci
npm test -- tests/alternatives/sublimation-injection --exclude 'work/**'
npm run typecheck
npm run lint
npm run build
node scripts/check-original-preservation.mjs
```

Private deterministic ledger evidence can be refreshed explicitly with `V21_CAPTURE_SUBLIMATION_EVIDENCE=1 npm test -- tests/alternatives/sublimation-injection/evidence.test.ts --exclude 'work/**'`. Ordinary tests do not write evidence. The current0.00625s capture is `numerical-evidence-round1.json`; the original0.05s `numerical-evidence.json` remains historical evidence. Both record accepted states, settings and exact ledgers for water, optional direct CO₂ and source-off configurations, not experiments. `HANDOFF.md` is historical; `ROUND_1.md` preserves the first reviewed revision and `ROUND_2.md` records the new vehicle and signed second retry; `ROUND_3.md` records the final pump/plumbing correction. A's dedicated reviewer owns local scientific review; the coordinator owns shared decisions and final combined checks/integration.

Final frozen source, scorecard, signed review and integration limits: [FINAL_REVIEW_HANDOFF.md](FINAL_REVIEW_HANDOFF.md).
