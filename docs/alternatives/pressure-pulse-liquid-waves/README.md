# 4.2.3.1 Liquid-pressure waves then injection

This independent new child implements a finite ordinary-water contact proxy and a separate illustrative wave-before-injection sequence. It does not import, copy, modify or replace protected original 4.2.3. The source is an abstract environmental input; its material and pressure behavior are unspecified. Water is the known medium for the separate contact calculation. No CO₂-only pressure-source assumption is made.

## Entry points and boundary

API **v21.2**: `index.ts` exports `methodModule` and `variants`; `scene.tsx` exports `MethodCues`; `science.tsx` exports `MethodScience`. `model.ts` owns identity/engine/material guards and pure authored stage cues. Registration, jobs, accepted checkpoints, independent panel/run IDs, cancellation, pause/resume/reset/disposal and linked-time coordination are coordinator-owned. Every adapter invocation clones its serializable inputs, removes unused solid inventory, then calls only the published `hooks.supportedRun`. It cannot mutate caller settings or original state. Shared worker identity guards reject stale results. Source schema/ranges/defaults remain the frozen shared registry's authority.

Preview: `http://127.0.0.1:5175/?alternative=liquid-waves&method-preview=1`. Presentation waves occupy 44–56 s; ordinary injection cue begins at 64 s. These are authored preview seconds, with no claimed pressure, wave velocity, penetration depth or relationship to accepted physical time. The independent host's cutaway/access is conceptual; it is not a new excavation model. No soil displacement, fracture, permeability or benefit is credited.

## Actual equations and units

The permitted external adapter invokes unchanged `simulateContactCooling` through `contactAdapter.ts`. Three independent, non-overlapping 0.5 kg specimens use constant `c_p=1840 J/(kg K)` (inherited uncalibrated assumption). Liquid properties are constant `c_w=4186 J/(kg K)`, `T_b=373.15 K`, `L_v=2.26e6 J/kg`, a near-atmospheric water approximation. All temperatures are kelvin; masses kg; heat J; conductance W/K; flow kg/s; time s. No moisture/pore-saturation or species fraction is inferred; allocation shares are fractions of **supplied water mass**, each 1/3.

For each accepted reference substep, available supply is

`dm = min(M_remaining, mdot * dt)` after the prescribed arrival, else zero.

Each specimen receives `dm/3`. With `C_p=m_p c_p`, `C_w=m_liquid c_w` and `UA` the assumed contact conductance, the exact two-capacitance sensible exchange is

`Q_eq=(T_p-T_w)/(1/C_p+1/C_w)`

`Q_requested=Q_eq * [1-exp(-UA*(1/C_p+1/C_w)*dt)]`.

Sensible heat is capped at the water's boiling plateau. The remaining substep performs exact exponential specimen-to-boiling-water cooling, capped at `m_liquid L_v`. Evaporated mass equals latent heat divided by `L_v`. Vapor exports its liquid sensible enthalpy relative to inlet plus latent enthalpy once. Liquid is retained locally; no infiltration, spatial conduction or flowing-water residence model exists. Zero retained water and zero UA transfer no heat. There are no dry-ice, pressure-work, oxygen or reaction source terms in this child.

The unchanged deterministic reference uses 0.05 s fixed grid plus event boundaries. The external adapter recomputes from the owned initial inputs at each accepted target; output checkpoints use 0.5 s. Recomputed results are independent of checkpoint partitioning. No frame-driven integration occurs. The approximate constant-property/lumped model assumes internally uniform specimens/liquid, near-atmospheric boiling, inlet above freezing and below boiling, and no combustion. These assumptions do not establish validity for real hot peat, high-pressure water, freeze/thaw, pressure waves or field scale. The original protected solver and its defaults remain untouched.

Ledgers:

`M_initial = M_supply_remaining + M_bypass + M_liquid + M_vapor`

`E_specimen_initial = E_specimen + E_liquid_sensible + E_vapor_sensible_and_latent`.

The proxy uses energy relative to inlet temperature, so arriving liquid introduces no additional reference enthalpy. It tracks supplied and contacted water separately. Source heat is not credited twice or added to the original accepted fire history. Oxygen, reacting fuel, reaction power, suppression and re-ignition metrics are unavailable. No empirical validation is claimed.

## Parameters and provenance

Defaults inherited from the approved frozen base: initial 823.15 K; finite water 0.5 kg; inlet 293.15 K; flow 0.025 kg/s; contact arrival 12 s; UA 24 W/K; observation 60 s; seed 21; intervention enabled. Temperature, inventory, flow, arrival, UA and window are editable scenario assumptions within shared registry bounds, not measured field data. The seed is recorded for comparison metadata; the contact reference is deterministic and does not use randomness. Intervention off produces the matched isolated untreated reference, including zero supplied water and heat. Unspecified material may use concept stages only, with null physical metrics. Peat Fire FEM treatment coupling and CO₂ contact media are rejected.

Official/primary reference data inspected 2026-10-11:

- [IAPWS R7-97(2012), revised water and steam formulation](https://iapws.org/technical-guidance/release/IF97-Rev). Provides thermodynamic-property/equilibrium equations; the proxy uses constants rather than implementing that formulation. IAPWS's full domain does not transfer to this simplified model.
- [NIST Chemistry WebBook water phase data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4). Reports normal boiling near 373.17 K. It supports the approximate atmospheric plateau only, not a wave or soil-response law.
- Exact implemented equations are the existing public reference in `src/story/contactCooling.ts`; this file is read-only and neither extracted nor copied into the child.

## Virtual comparison and proposed experiments

Virtual procedure: match specimen geometry, initial/inlet temperatures, seed and observation window. Compare against untreated isolated contact and ordinary contact with matched arrival/resources. Disclose different inventory, flow, UA and arrival. Test off, zero inventory, zero flow, zero UA, finite exhaustion, repeatability, own snapshots and residuals. Wave cue evaluation must leave every accepted numerical state identical. Different arrival schedules are assumptions; they do not demonstrate a wave benefit. Do not rank suppression or compare calorimeter temperature to the full original field result as if they were the same system.

Proposed **unperformed** sub-scale validation: begin with nonreacting warm specimens, measured masses/inlet temperatures and independently calibrated temperature and balance measurements. Use matched untreated and ordinary-water controls, repeated measurements, documented uncertainties and a held-out prediction window. Estimate UA only from a designated calibration set and assess energy/mass balance on a separate validation set. A pressure stage requires independently measured generic environmental inputs and material-response data from a qualified laboratory before any constitutive/transport coupling is added. No apparatus, pressure source, dosage or operating design is specified. Reactive suppression/re-ignition would require separately validated oxygen/fuel/moisture/reaction transport over a defined observation window.

## Approximate cost evidence

[Menlo Park's official current tariff](https://www.menlopark.gov/Government/Departments/Public-Works/Water-stormwater-and-solid-waste/Menlo-Park-Municipal-Water/Water-rates), inspected 2026-10-11, gives consumption $9.39/ccf plus its example capital/pass-through charges $2.00/$0.09 per ccf. Using the page's 748 USgal/ccf, 3.785411784 L/USgal and a nominal 1 kg/L gives `(11.48 / (748*3.785411784))*0.5 ≈ $0.0020` for 0.5 kg water. This is a marginal dimensional illustration, not an actual bill: the utility bills whole units, and fixed charges, transport, labor, access, instruments and treatment/disposal are excluded. Pressure-stage and total-project prices are unavailable; no specified equipment or supplier quote exists. No cost-effectiveness or performance claim follows.

## Verification

Run `npm test -- tests/alternatives/pressure-pulse-liquid-waves`, then repository typecheck/lint/tests/build and `node scripts/check-original-preservation.mjs`. Child tests cover independent state/config/snapshots, deterministic checkpoints, off equivalence with matched scenario metadata, source rejection, finite inventories/enthalpy, zero limits, no wave benefit and unavailable conceptual outcomes. These are numerical/interface checks, not physical experiments. See HANDOFF.md for exact final results.

Reproducible record: `node tests/alternatives/pressure-pulse-liquid-waves/record-evidence.mjs` writes `numerical-evidence.json`. At the default 60 s checkpoint, delivered water is 0.5 kg, transferred heat 887056.6582442669 J, maximum specimen temperature 501.75266005643573 K, mass residual 4.44e-16 kg and energy residual -2.84e-8 J. Solid inventory/source is zero. These are proxy outputs and balance checks, not field suppression predictions. Intervention-off matches the untreated snapshot with matched arrival metadata.
