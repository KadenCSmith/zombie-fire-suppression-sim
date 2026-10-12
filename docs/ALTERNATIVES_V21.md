# Version21 local implementation

Version 0.21.0 extends the inherited React/Vite/Electron app at `4b2088e926662aee357cde680f2b22c4fbf24f79`. Work is coordinated on `integration/v21-alternatives`. The user has authorized the coordinator to update GitHub main and publish/install the Mac app after reviewed worker integration and final checks; workers remain restricted to their owned branches and draft PRs. Original licensing and third-party notices are preserved.

## Open and navigate

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed address in Chrome. The current preview uses `http://127.0.0.1:5173/`. `npm run dev:mac` remains the native development entry point. The initial view is protected original 4.2.3 in its original rapid mode. The specifically approved restoration is complete; all 57 original hashes and native preservation checks pass. See [the READY record](review/version21/READY.md) and [API v21.2](alternatives/CONTRACT_V21_2.md).

The V20 four-column header remains: Fire Simulation, Simulation Version, finder and Toolbox. During scrolling its height, type and icons interpolate over the entry corridor; sublinks fade and collapse together. Reduced-motion preferences remove animation. Each method name opens its latest render directly, so the redundant **Latest render** submenu row is omitted. Disclosures retain the five other numbered model/view sections plus Peat Fire FEM under every parent. The two draft pressure-pulse variants remain under 4.2.3. Secondary views are preserved reference engines; choosing one displays a note that the selected method is not automatically coupled to it.

**Compare Alternatives** is an in-app live workspace, separate from **Previous simulations**, which retains synchronized archived replay semantics. Configure each panel, start/pause/resume/reset individually or together, duplicate configuration, remove panels, and export accepted records. Method details and Mathematics & evidence remain available there and in Finder's documentation.

## What each method supports

| Method | Current render and numerical scope | Missing prediction |
| --- | --- | --- |
| 00 No-treatment baseline | Untreated context; isolated hot contact specimens or existing reacting Peat Fire FEM | Contact reference has no combustion; FEM has no capstone suppression sources |
| 4.2.1 Extinguishing Medium Sublimation and Injection | Original fire/drilling reused in the main scene; authored truck/container, dry-ice addition, faster liquid and fire-out; separate finite liquid/optional solid CO₂ direct-contact calorimeter | Surface tank cooling/pressurization, injection transport, penetration and savings |
| 4.2.2 Solid Inert Gas Nano Particles | Visible TBD entry and untreated context; predictive execution disabled | Material, particle distribution, mechanism, transport, chemistry and boundary inputs |
| 4.2.3 Subsurface Pressure Pulse | Unchanged original V20 rapid cutaway, accepted field history and separate original contact readout; new live-comparison execution unavailable | Pressure propagation, soil rearrangement, fracture or permeability benefit |
| 4.2.3.1 Liquid-pressure waves then injection | Full original authored base, then intermittent pumping pulses, wetting and fire-out; separate prescribed finite contact calculation | Wave/fracture physics or any credited wave benefit |
| 4.2.3.2 Rapid pressure change without liquid | Draft title; abstract disturbance with no liquid; conceptual stage clock only | Collapse, cooling, suppression and all physical outcome curves |
| 4.2.4 Earthquake Extinguisher | Original introduction, authored shaking/multi-depth jets/fire-out Site view, separate experimental reacting field with finite liquid deposition; comparison retains its continuous contact proxy | Liquid migration, vibration/compaction/loosening effects on transport or suppression |

New method renders reuse the original fire-spreading and drilling animation through the unchanged read-only FireSequenceScene export. A/B private cues share its original world Canvas, camera, lighting and depth buffer. Most alternatives use the pre-treatment0–38s context; the liquid-pressure child explicitly replays the complete authored original base at the user's request. C reuses the original introduction before its separate owned field scene. Original4.2.3 retains its complete original timeline, scene, assets, defaults and camera. Ring radii, shaking, jets, wetting and fire-out are presentation choices and never source terms or calculated extinction evidence. No method is experimentally validated.

C's latest-render field is a separate experimental1,280-cell CoupledTransport run. Accepted internal steps receive finite liquid mass and prescribed inlet enthalpy once, with full candidate rollback and separate raw/source-corrected ledgers. Its assumed hot-peat preparation is independent of the opening animation. Numerical temperature, gas oxygen and positive net liquid change are displayed as a labeled middle-y slice; liquid migration and vibration mechanics remain unavailable. The default60s run remains hot and reacting, despite the explicitly illustrative Site ending. This field is not the comparison contact engine or a supported global injection API. See [source equations, evidence and limits](alternatives/vibratory-injection/REVISION_V2.md).

## Implemented equations and inputs

The external `alternatives/contactAdapter.ts` owns configuration and snapshots and invokes the existing public `simulateContactCooling` unchanged at accepted targets. It recomputes from the initial condition rather than adding an export to the protected integrator. Each comparison contains three independent 0.5 kg peat specimens, not a solved depth field. Defaults: 823.15 K initial peat, 293.15 K liquid inlet, 0.5 kg finite water, 0.025 kg/s prescribed total delivery, 24 W/K assumed contact conductance per specimen, 0.05 s integration step, 60 s observation window. Default liquid arrival is 8 s for sublimation, 12 s for the waves variant and 0 s for continuous injection. These timings and conductances are editable assumptions. The optional solid CO₂ inventory is 0.05 kg in separate direct contact with specimen 1; it is not predicted tank pre-cooling. There is no random forcing; the persisted seed is 21.

For sensible contact, `C = m cp`, `Qeq = (Tp − Tw)/(1/Cp + 1/Cw)` and `Q = Qeq [1 − exp(−UA(1/Cp + 1/Cw) Δt)]`. Water exchange is bounded at atmospheric boiling before latent transfer. Solid heat uptake is bounded by remaining mass times the frozen sublimation latent heat. Liquid bypass, retained water, exported vapor, source remainder and transferred energy are separate ledger entries. Intervention off sets both source inventories and contact terms to zero. Zero liquid conductance transfers zero liquid heat. There is no ambient loss, combustion, oxygen transport or hydraulic penetration in this engine.

Mass residuals subtract remaining, retained, bypassed and exported material from initial supplies. Energy residual subtracts current peat, water sensible energy, vapor enthalpy and dry-source heat from initial peat sensible energy. Supported balances are reported, not turned into suppression success. Oxygen, reaction and reactive fuel metrics are N/A in the contact proxy. Pressure-only conceptual stages have no numerical metrics or history curves.

The untouched Peat Fire FEM adapter uses its existing Q1 hexahedral, lumped-storage conservative transport, compressible Darcy/species storage, five-step reactions, thermal/pressure iteration and adaptive step acceptance. Two half steps are accepted after a full-step estimate. Integration remains independent of render FPS. Its no-treatment trajectory is checked against the original solver at identical steps. See [FEM equations and limitations](PEAT_FIRE_FEM_MODEL.md) and [contact model](CONTACT_COOLING.md). No new field suppression source is enabled.

## Evidence, validity and planned empirical work

SI units and kelvin are internal. FEM oxygen uses mass per total gas mass; initial water uses mass per dry peat. Contact fractions are allocation shares, not species concentrations.

- [NIST CO₂ phase-change reference](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4), including Giauque & Egan (1937): the existing constant is 6030 cal/mol × 4.184 / 0.0440095 kg/mol, near 195 K. It is a frozen latent-heat approximation, not a general phase diagram or an unspecified-source prediction.
- [NIST water reference](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2): the existing 4186 J/(kg K) sensible constant and 2.26 MJ/kg atmospheric-boiling latent approximation do not establish accuracy at arbitrary temperatures/pressures. Peat cp = 1840 J/(kg K) remains the existing assumption.
- [Huang & Rein (2017), five-step peat kinetics](https://doi.org/10.1071/WF16198): retained FEM framework, with transferred material/geometry assumptions documented separately. Citation is not validation of this cube or these interventions.
- [Santoso et al. (2021), laboratory water-suppression study](https://doi.org/10.1071/WF20117): measured laboratory context for water delivery and wetting. It does not calibrate the three-specimen proxy or establish injection performance.

Proposed experiments have **not** been performed: characterize density, dry-basis moisture, thermal properties and gas permeability; establish matched untreated controls and uncertainty; independently measure specimen/water temperatures, supplied/retained/effluent/vapor mass and heat exchange; calibrate UA on separate runs and hold it fixed for validation. Then compare measured smoldering oxygen, fuel loss, thermal/reaction behavior and post-treatment history with the supported reacting baseline using repeats and holdouts. Study hydraulic penetration and mechanical/vibration response separately. No re-ignition guarantee, success threshold or winner is inferred from lower temperature.

## Preliminary 4.2.1 costs

USD; reference checked October 11, 2026. An [Onset UX120-014M four-channel thermocouple logger](https://www.onsetcomp.com/products/data-loggers/ux120-014m) was listed at **$380**, sensors separate. An assumed ±25% planning allowance gives **$285–475 for the logger alone**; this is not a supplier confidence interval. Probes, cable/software, installation and other instrumentation are not included.

Operating material cost is `water kg consumed × local USD/kg + selected medium kg consumed × local USD/kg`, only when dated supplier quotes exist. Water and solid-medium prices remain unavailable in this preview; no system total is fabricated. Pressure-source/tank capital and performance are unavailable. Exclude labor, shipping and factory overhead; taxes/fees and minimum purchase quantities also require local procurement information. These are preliminary instrumentation/material scopes, not installed costs or proven savings, and do not form a pressure-device parts list.

## Runtime, comparison and persistence

`alternatives/registry.ts` owns stable method/variant/medium/engine IDs, parameter ranges/defaults, provenance, compatibility and status. `model.ts` supplies owned snapshots and the contact/FEM/concept adapters. Each panel creates its own worker and run ID. Physical changes and reset replace its worker; old or cross-panel messages are rejected. Duplicates copy configuration only; removal/navigation terminates jobs. Failures retain the last accepted state.

Optional linked mode sends monotonic 0.5 s **physical targets** and waits for all accepted timestamps before advancing. It rejects conceptual time, different engines/windows/seeds, different initial or inlet temperatures, and unmatched FEM geometry, initial/boundary conditions or numerical settings. Individual controls break the link and pause the other linked jobs. Match-initial and finite-budget controls disclose conditions and resource differences; baseline consumption remains zero. There is no normalized-replay equivalence or hidden resource matching. Pressure/vibration energy is unavailable and excluded. Shared temperature scale is 293–1000 K; clipping is disclosed. Contact specimens and FEM fields are different physical systems and cannot be linked as an equivalent comparison.

Rendering is separate from integration. Contact views use SVG; FEM comparison uses demand rendering and device pixel ratio 1. A rolling 120-frame budget hides only the contact history chart when presentation p95 exceeds 28 ms and restores it below 20 ms. Accepted states and numerical steps are retained. This is display adaptation, not reduced scientific accuracy.

Settings schema 2 uses `zombie-fire-alternatives-v21`, migrates schema 1, validates ranges/FEM data, repairs duplicate IDs and restores configuration with fresh jobs. It never touches the existing gallery-selection key. JSON records include app/engine/schema versions, settings, source status, seed, units, accepted physical timestamps, histories, per-panel runtime and resource differences. These are records, not resumable solver checkpoints.

## Verification and measured performance

Final integrated local commands: typecheck passed; lint passed with 16 existing physics-next warnings; **1848 tests in 101 files passed** (15.64 s, two workers); production build passed. All three frozen worker deliveries are integrated; see BUILD_STATUS.md for exact SHAs and current verification. Existing Three.js CommonJS deprecation, dependency `use client` and >500 kB chunk warnings remain. Concurrent worker timeouts were resolved by the quiet integrated full run; no test timeouts were changed.

Electron smoke checks passed for alternatives, fire sequence, archived comparison and Peat Fire FEM. The alternatives check exercises direct parent-to-render navigation, nested destinations/variants, all four new variants, unavailable original-comparison execution and nanoparticles, simultaneous workers, individual pause/reset, duplication, removal, linked accepted time, navigation cleanup and two/four-panel performance. Chrome review exercised the real pointer corridor, ArrowRight/ArrowLeft/Escape/focus return and a 700 px stacked comparison without page overflow. At 1508×885 Chrome, the live display measured approximately 33.3 ms median / 34.2 ms p95 and activated the compact budget. Unrelated browser-extension console messages were observed; no app errors were observed.

The final built macOS arm64 Electron fixture measured 120 frame intervals: two contact panels median **8.3 ms / p95 9.0 ms**, four median **8.3 ms / p95 8.5 ms**. Four-panel pause response was **51.3 ms**, including the check's 50 ms polling resolution. [Machine-readable run](review/version21/live-smoke.json). These are measurements on these lightweight contact cases, not a 40 FPS guarantee for arbitrary FEM meshes or machines. Native checks emitted a nonfatal macOS Electron helper resource warning; they completed successfully.

Reproduce native checks after `npm run build`:

```sh
node_modules/.bin/electron scripts/smoke-alternatives.cjs
node_modules/.bin/electron scripts/smoke-fire-sequence.cjs
node_modules/.bin/electron scripts/smoke-comparison.cjs
node_modules/.bin/electron scripts/smoke-peat-fem.cjs
```

| Acceptance item | Result |
| --- | --- |
| V20 header, rapid initial render, gradual scroll transition | Implemented and visually checked |
| Parent click opens latest method render; redundant row removed | Implemented; built smoke passed |
| Nested pressure variants and all remaining reference sections | Implemented; pointer and keyboard checked |
| Independent live runs, controls, cleanup and linked physical time | Unit and built integration checks passed |
| Finite inventories, intervention-off, reproducibility, baseline identity, migration | Regression checks passed |
| Mathematics, status, costs and empirical-plan limitations | Visible in-app and documented |
| Existing FEM, archived replays, films and sequence sessions | Existing smoke checks passed |
| Experimental capstone suppression, fracture, infiltration, vibration coupling | Unavailable; no validation claim |

## Changed implementation paths

Shared integration: `App.tsx`, `AppChrome.tsx`, `ModelSelector.tsx`, formula reference and cinematic styles. New modules: `alternatives/{registry,model,persistence,presentation}.ts`, alternatives worker, AlternativesMenu/Workspace/Science, AlternativeRenderWorkspace and styles. The original scene and contact source match their exact verified V20 contents. New method previews use AlternativeScene, while an external contact adapter calls the unchanged existing public integrator; PeatFemScene has a comparison-only rendering budget. New alternatives unit/worker/presentation tests and built smoke script complement the preserved suite. Package, lockfile and page title carry 0.21.0; no new license is added.
