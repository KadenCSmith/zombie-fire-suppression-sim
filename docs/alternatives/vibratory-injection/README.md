> **Current revision:** [V3 — vibration only, requested authored compaction/fire-out](./REVISION_V3.md). The liquid/contact content below is retained historical, inactive and off-scope for current vibration validation.

# 4.2.4 Earthquake Extinguisher

**Vibratory drilling + continuous injection.** API v21.2; private module authored alongside the protected original 4.2.3. The original scene, equipment, timing, camera, defaults, results and dependencies are read-only. No original implementation is copied or mounted here.

## Implemented scope

The method exports `methodModule`/`variants` from `index.ts`, UI-only `MethodCues` from `scene.tsx` and `MethodScience` from `science.tsx`. `model.ts` supplies explicit capabilities, assumption metadata, an owned adapter and a pure presentation function. Descriptors never self-register or import React/Three into numerical workers. Registration and lifecycle belong to the coordinator.

The independent concept host shows excavator-drilled access into a root/peat cutaway. This private scene adds a hose, drill-head cue and three liquid markers. Access appears at authored second 18; vibration and liquid cues run simultaneously from 24 to 60; stationary review follows. The small sinusoidal displacement and marker depths are graphic choices, not a calibrated vibration amplitude, drilling rate, hydraulic penetration or solved soil response. They do not enter any numerical state. Presentation seconds are separate from accepted physical contact time and cannot establish an intervention's performance.

The only treatment calculation available is the existing **finite-inventory contact calorimeter**, called through the external shared adapter. It consists of three independent 0.5 kg specimens. It has no spatial liquid transport, roots, porosity, pressure, oxygen, reacting fuel or mechanical-energy model. The shared Peat Fire FEM remains available for untreated combustion only; 4.2.4 cannot add its source terms. An unspecified liquid/source requires conceptual mode with null physical metrics.

Loosening and compaction are competing hypotheses. Neither changes permeability, thermal conductance, oxygen or reaction in this module. Field penetration, vibratory work, thermal effects of drilling, suppression and re-ignition are **N/A**, with no ranking or experimental validation claim. Continuous liquid contact is modeled; drilling and vibration are illustrative.

## Inputs, conditions and equations

All numerical inputs use SI and kelvin. The shared schema/ranges remain authoritative. C retains inherited defaults: initial specimen 823.15 K; liquid inlet 293.15 K; total water 0.5 kg; prescribed delivery 0.025 kg/s; per-specimen thermal conductance UA 24 W/K; physical contact arrival 0 s; observation 60 s; seed 21. Each specimen receives one third of supplied water. This fraction is a mass-allocation share, not saturation, oxygen mass fraction or moisture content. No random forcing is used. The end window remains editable from 10 to 120 s under the shared schema.

The total supply rate is prescribed, independent of vibration. At each existing 0.05 s/event-boundary step,

`Δm_supply = min(m_remaining, m_dot × Δt)` after the selected arrival.

Source mass is deducted once, then divided equally among the three specimens. Default inventory is depleted at 20 physical seconds. There is no refill. Remaining supply, supplied mass, bypass, retained liquid and exported vapor are separately accounted. Intervention off sets modeled source inventories, flow and conductances to zero through the shared supported adapter. Zero flow/inventory gives no treatment; zero UA gives no transferred heat even though prescribed water may still be supplied.

For each specimen, `C_p = m_p c_p` and `C_w = m_w c_w` in J/K. The unchanged reference solves sensible contact exactly for constant capacitances within a step:

`Q_eq = (T_p − T_w)/(1/C_p + 1/C_w)`

`Q = Q_eq × [1 − exp(−UA × (1/C_p + 1/C_w) × Δt)]`.

Water sensible transfer is bounded at 373.15 K, then latent transfer uses the available liquid mass and remaining hot-specimen energy. Vapor carries its sensible plus latent enthalpy away; its energy is not also retained as liquid. Existing constants are water 4186 J/(kg K), latent heat 2.26 MJ/kg and peat 1840 J/(kg K). Peat heat capacity, UA and hot-specimen temperature are uncalibrated inherited assumptions. Constant water properties and an atmospheric boiling plateau are a narrow thermal approximation; pressure-dependent boiling, freezing and high-pressure thermodynamics are absent. Thermal storage uses the inlet temperature as the enthalpy reference. No combustion or ambient-loss term is added. The optional CO₂ core capability is incompatible with this method's selected medium; dry-ice inventory and credit are zero for 4.2.4.

Mass balance: `m_initial − m_remaining − m_bypass − m_liquid − m_vapor = residual`.

Energy balance: `E_peat,initial − E_peat,current − E_water,sensible − H_vapor = residual`. There is no mechanical-energy input, favorable suppression multiplier, oxygen deletion or hidden heat sink. Lower calculated specimen temperature is not a predicted suppression outcome.

The external adapter invokes the protected public reference from the initial condition at each accepted target, rather than modifying its cache/integrator. Targets must be finite, monotonic and within the observation window. Re-evaluation fixes checkpoint partitioning independence but costs additional work; integrated two/four-panel performance belongs to the coordinator's final evidence. Every adapter invocation owns a serializable configuration clone and returns owned snapshots. Shared workers own unique panel/run IDs, pause/resume scheduling, reset/replacement, stale-result rejection and disposal. Presentation calls have no references to a numerical run.

## Provenance and validity

Sources inspected on **October 11, 2026**:

- [IAPWS R6-95(2018)](https://iapws.org/technical-guidance/release/IAPWS-95) is the official reference formulation for fluid-water properties. The retained calorimeter uses constants, not this complete equation of state.
- [NISTIR 5078, Harvey (1998)](https://www.nist.gov/srd/nistir-5078) provides water/steam property tables based on IAPWS-95. It supports checking the thermal approximation; it does not validate these specimens or UA.
- [Price (2003), Water Resources Research, doi 10.1029/2002WR001302](https://doi.org/10.1029/2002WR001302) reports peat deformation and changes in hydraulic conductivity under seasonal hydrologic conditions. This motivates measuring compaction as well as possible loosening. It is not a vibratory-drilling constitutive relation, and none of its observed changes is inserted as a benefit in this model.

No source here establishes drilling geometry, vibration energy, infiltration improvement or a peat-fire suppression dose. None of the virtual tests below is an experiment.

## Virtual comparison and proposed empirical validation

Virtual comparisons should hold the three specimen masses, initial and inlet temperatures, UA, initial water inventory, prescribed flow, arrival, physical window, numerical step and seed equal. Compare the intervention-off case to the matched isolated untreated contact reference first. Then report supplied water, temperature and energy/mass residuals as **calorimeter metrics**. Treat baseline zero consumption and different resource budgets explicitly. Do not compare contact temperatures as if they were a spatial FEM fire field; do not join presentation time to linked physical time. Vibration-on/off pictures must give exactly the same numerical record under identical physical settings.

The following validation is **proposed and unperformed**. First characterize specimen mass, dry-basis moisture, density and thermal properties; independently calibrate temperature and mass instruments. Measure supplied, retained, bypass and evaporated water, temperatures and heat losses; calibrate UA on one dataset and hold it fixed on independent repeats/holdouts with uncertainty. Check balance closure against instrument uncertainty before comparing trajectories. Then perform matched peat hydraulic/deformation characterization with identical liquid conditions and vibration present/absent, measuring both compaction and loosening rather than assuming either. That dataset would be needed before implementing a constitutive permeability model. Any later controlled smoldering study must measure oxygen, fuel loss, moisture and reaction/thermal histories over a declared follow-up window; such data cannot be inferred from this contact proxy. No field procedure, pressure-source construction or equipment operating specification is provided.

## Preliminary cost scope

USD, reference date October 11, 2026. [EBMUD's official water rates](https://www.ebmud.com/water/water-rates), effective July 1, 2026, list other water use at USD 9.07 per 100 cubic feet, approximately 2832 L. Assuming approximately 1 kg/L only for this planning conversion gives about USD 0.00320/kg. Default 0.5 kg finite supply therefore corresponds to **USD 0.0016 in volumetric water alone**. An explicitly assumed ±25% planning allowance gives approximately USD 0.0012–0.0020; it is not a confidence interval or delivered-water quote. Fees, labor, transport, tax, energy and all equipment are excluded. Local tariffs and procurement can dominate this tiny material-only number.

Capital instrumentation, drilling/vibration equipment, power, maintenance and field-delivery costs are unavailable without quotes and a defined system. No total, pressure-system parts list, operating-energy saving or cost per area treated is invented. [Onset's UX120-014M](https://www.onsetcomp.com/products/data-loggers/ux120-014m) is an instrumentation reference only; this retrieval did not expose a price and none is claimed here.

## Reproduce verification

From the assigned C checkout:

```sh
npm ci
npm test -- tests/alternatives/vibratory-injection
V21_C_EVIDENCE_PATH=docs/alternatives/vibratory-injection/contact-evidence.json npm test -- tests/alternatives/vibratory-injection/evidence.test.ts
npm run typecheck
npm run lint
npm test
npm run build
node scripts/check-original-preservation.mjs
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Preview: `http://127.0.0.1:5176/?alternative=vibratory-injection&method-preview=1`. Coordinator operates the separate Chrome window. See `HANDOFF.md` for actual results, branch/SHA/PR and preservation checks. All owned fixtures/output/harnesses remain in the C private trees.
