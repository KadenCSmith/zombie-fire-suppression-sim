# Zombie Fire Suppression Sim

**Interactive scene studio and a separate, unvalidated scientific model.**

A local desktop application for macOS, Windows and Linux that opens in **Scene studio**: four interactive views of the authored Blender landscape, with soil strata, an illustrative thermal overlay and a 20-second animated sequence. Switch between **Soil cutaway**, **Thermal layers**, **Surface view** and **Roots & peat** without resetting playback. The studio uses an 8 m × 8 m illustration; its colors and motion are prescribed and are not solver results.

Choose **Open simulation** for the separate scientific workspace. Its default domain is 20 ft × 20 ft (6.096 m × 6.096 m), with a finite buried dry-ice source, heater input, peat smoldering and slow gas/heat transport. A bounded radial gas event drives a reduced vertical mechanics calculation, and a separate continuum mechanics benchmark is available. These calculations compare assumptions and numerical behavior; they do not establish field suppression, fracture or safety. [Scene studio guide](docs/SCENE_STUDIO.md).

Private repository: [KadenCSmith/zombie-fire-suppression-sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim).

## Timed gas-release illustration

Version 0.6 adds a **five-second delay after landing**: the sphere lands at 4 s and instantly disappears into expanding gas tracers at 9 s. Soil grains and rocks move outward and settle. An inverted, open-bottom cage is placed over the opening after landing; its default height is 10 cm and its width is 95 cm. Toggle it or edit these dimensions in the scene sidebar. Replay, reverse seeking and all four views share the same event time. This is prescribed animation, with no calculated gas pressure or cage containment. [Sequence guide](docs/SCENE_STUDIO.md).

## Research materials and Developer tools

Version 0.4 adds **12 researched composition profiles**: Irish moss peat, an Andean organic-soil comparison, and ten lowland peat–sand mixtures. Open **Simulation → Developer → Research profiles**. Choose a target, stage a profile, review its measured/estimated inputs, and apply it to restart the calculation. The Developer tab also exposes thermal, gas, reaction, mechanics and numerical constraints with source notes, input validation and an evidence export.

[Profile guide](docs/RESEARCH_PROFILES.md) · [Material audit and ASCE citations](docs/MATERIAL_EVIDENCE_ASCE.md). The user-supplied working document was included in the review. Unsupported settings remain labeled assumptions; selecting a paper does not experimentally validate the simulation.

## Download and launch

[**Download version 0.6.0**](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.6.0) — choose **macOS universal DMG** for either Apple Silicon or Intel, or a Windows/Linux archive for your processor. GitHub access is required because this repository is private. The app works offline after downloading.

[Installation and terminal commands](docs/INSTALL.md) · [Verification status](docs/VALIDATION_STATUS.md)

On this Mac, open either workspace directly:

```sh
open -na "$HOME/Applications/Zombie Fire Suppression Sim.app" --args --simulation
open -na "$HOME/Applications/Zombie Fire Suppression Sim.app" --args --studio
```

Mac requires macOS 13+. The app is locally signed, not Apple notarized; Windows and Linux packages are portable archives. See the installation guide for first launch and whole-bundle replacement instructions.

Version 0.5 improves surface/contact thermal stability, consistent reaction yields and current-mass transfer from the flow mesh to mechanics. It retains historical reaction yields for older imported files. The model remains experimentally unvalidated. [Equations and limitations](docs/PHYSICS_MODEL.md).

For development, install Node.js 22.12+ and run:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run dev:mac
```

`npm run dev` starts the browser development server. On macOS, `npm run package:all` builds all desktop archives into `work/releases/v0.6.0/`; `npm run package:mac` builds only the universal Mac DMG and ZIP. Dependency versions are pinned in `package.json` and `package-lock.json`.

## Example scenarios

All examples use the same 6.096 m square domain and an explicitly assumed property set. They are demonstration inputs, not measured field cases or tuned proof of suppression.

| Scenario | Change from the heated-source demonstration |
| --- | --- |
| [Untreated smoldering](examples/untreated.json) | Same initial hot peat; dry-ice mass set to zero and heater off. |
| [Buried dry ice, heater off](examples/dryIceOnly.json) | Finite buried dry ice exchanges heat with its surroundings without heater input. |
| [Heated buried dry ice](examples/heatedDryIce.json) | Same initial peat and source with its finite scheduled heater. |
| [Wet, low permeability](examples/wetLowPermeability.json) | Higher assumed water saturation and lower assumed intrinsic permeability. |
| [Hypothetical edited pathway](examples/hypotheticalPathway.json) | A manually assumed higher-permeability pathway; it is **not** predicted by soil motion. |

For a meaningful A/B comparison, keep the same initial hot region, random seed, grid, and display scales, then change one assumption. The outcome depends on the reduced model and must not be interpreted as a field success rate.

The linked JSON files can be selected through **Import**. They carry the schema version, model identity, unit metadata, seed, and input provenance used for repeatable runs.

## Controls

- **Scene studio:** select one of four views, drag to orbit, scroll to zoom, toggle labels or reset the camera. Play/pause, restart, scrub, select a chapter, set 0.5×/1×/2× speed or loop the 20-second illustration. Changing views preserves its current time. Scrubbing pauses playback; backgrounding the app pauses it. **Open simulation** enters the scientific workspace; its **Scene studio** button returns to the illustration and pauses the scientific run while retaining its current in-memory scenario and history. Studio motion does not modify the solver.

The following controls belong to the **scientific workspace**:

- **Setup:** choose a demonstration scenario, then use **Edit part of scenario** to show one group at a time: Dry ice and heater, Soil and peat, Smoldering and pathways, Air and boundaries, or Advanced model. Diameter and density set the initial dry-ice mass; there is no separate mass entry. Scenario edits restart the physical run after a short debounce, while heater on/off is recorded as a live operational event. **Reset settings to defaults** restores the demonstration scenario and interface settings, then starts a fresh physical run.
- **Scene:** choose 3D orbit, top, X section, or Y section; drag to orbit and scroll to zoom. The 3D orbit shows geometry without a full-height field sheet. Top and X/Y section views show quantitative colored cells; move their slice with the clipping slider, select a field, and choose fixed or adaptive color scaling. Toggle modeled flow arrows and visible roots. Click a colored cell to place the virtual sensor.
- **Simulation:** play/pause, take one physical solver step, reset the current run, fast-forward, or run to a chosen hour. One-, three-, and seven-day windows are available. The solver pace defaults to **30 simulated seconds per real second** and can request 120, 600, or 3600; the worker reports achieved throughput. The physical **Reset** restarts the currently selected settings, distinct from Setup's **Reset settings to defaults**. Scrub recorded checkpoints or choose a separate playback pace to inspect saved states without advancing the solver. Solver-derived smoldering power, consumed fuel, cumulative heat, and reacting cell count are shown alongside peak temperature and other readouts.
- **Results:** inspect probe histories and mass/energy diagnostics, export CSV, PNG, or recorded states, or compare an otherwise identical heater-off baseline in A/B view. The two runs use the same initial seed and fixed color scales; compare matched physical times.
- **Motion:** trigger a separate visual opening/settling sequence. Its artistic movement setting does not change the solver or generate a predicted pathway.
- **Event:** compute a separate radial gas calculation from the current slow-run state for up to 2 simulated seconds, with its own clock and at most 100 recorded frames. Its pressure frames load 4³ vertical soil elements by default. New mechanics frames arrive live in the Mac window; inspect calculated displacement or yielded elements separately from the legacy illustrative shell damage index. Pause, resume, or cancel mechanics; choose 6³ or 8³ after the small run passes checks and click Run. The one-click **Convert remaining dry ice to CO₂ + compute event** control transfers the remaining modeled solid to gas. Smoke and steam controls show distinct plumes derived from oxidation and water-loss rates; CO₂ remains invisible.
- **Files:** Setup imports or saves scenario JSON; Results exports sparse history as CSV, a scene PNG, or recorded states as JSON. Invalid imports report validation errors. The States JSON is an export of saved snapshots, not a simulator checkpoint that the UI can resume.

The Results panel shows remaining source mass, heater input, peak temperature, remaining fuel, sensor values and histories, and expandable mass/energy diagnostics. See the status labels beside each subsystem before interpreting an overlay.

## What the displays mean

- **Scene studio** shows the authored 8 m × 8 m Blender geometry with simplified web materials. Thermal colors, source placement, transport tracers and partial cooling are an illustrative story, with no calculated temperature scale or treatment outcome. White tracers mark an assumed route; they are not visible CO₂. The dimensions differ from the default scientific domain. The points below describe the scientific workspace.
- The 3D soil and grass scene shows geometry; top and X/Y section views show colored values on a coarse grid beneath the surface. Their colors are display choices; CO₂ itself is not colored.
- The buried source is shown as a volume-equivalent sphere. Its shrinking display does not resolve cavities, contact resistance, or a spherical solid interface.
- An initial hot region sets temperature and available fuel; it is not held hot afterward. Local oxygen-dependent fuel oxidation adds modeled heat to the energy balance, while conduction, gas cooling, evaporation, and boundaries can still cool the peat. The on-screen glow follows modeled temperature and is not a separate heat source.
- The heater input is volumetric heat generation `q'''` in W/m³ over a fixed numerical support volume. Total power is derived from that volume. An editable heater setting is an energy input, not a temperature difference.
- The one-click conversion consumes all remaining modeled solid CO₂ at the current solver time and adds the same mass as pore gas. Its estimated warming, latent, and gas-equilibration costs are booked as **external intervention energy**; this control bypasses the ordinary energy-limited sublimation rate and does not extract that energy from the soil. It may immediately pause slow-flow transport on a pressure-validity warning. The ensuing radial gas calculation loads the reduced mechanics solver; neither is a validated blast, fracture, or field-movement prediction.
- The displayed pressure-load number multiplies modeled near-source excess pore pressure by a fixed, imagined support-plane area. It is a labeled algebraic proxy in newtons, not a calculated force on a real soil surface or a rupture forecast. Values shown after a validity pause are outside the supported model range.
- The event view moves soil elements according to calculated vertical displacement and colors yielded regions separately. The manual motion control in Simulation and the radial shell damage index remain illustrative. Any manually assumed pathway geometry is a separate hypothetical transport case.

## Model limits and documents

- [Scene studio](docs/SCENE_STUDIO.md): four views, animation controls, asset provenance and the boundary between illustration and calculated fields.
- [Blender staged approval](docs/STAGED_REVIEW.md): Stage 1 approved; Stage 2 materials, soil strata, illustrative thermal overlay, and the six approval gates.

The combustible fuel is represented by an uncalibrated, cellulose-like complete-oxidation surrogate. Char and ash are not modeled inventories in this release. Peat-specific kinetics, heterogeneous moisture/flow measurements, source-scale phase behavior, and experimental validation remain open work. The model stops if a configured low-speed gas or thermodynamic validity check fails; it must not be interpreted as a blast or geomechanics calculation.

- [Physics model](docs/PHYSICS_MODEL.md): equations, units, boundaries, numerical treatment, and diagnostics.
- [Short-time event model](docs/FAST_EVENT_MODEL.md): radial gas calculation, illustrative shell damage indicator, and separate validity limits.
- [Mechanics model](docs/MECHANICS_MODEL.md) and [method decision](docs/SOIL_MECHANICS_DECISION.md): vertical force balance, pressure mapping, yield, plumes, assumptions, and limits.
- [Parameter reference](docs/PARAMETER_REFERENCE.md): bases, default values, ranges, and provenance.
- [Sources](docs/SOURCES.md): primary references and reuse choices.
- [Research review with ASCE citations](docs/RESEARCH_REVIEW_ASCE.md): why each source is needed, parameter decisions and unresolved evidence.
- [Solver optimization review](docs/SOLVER_OPTIMIZATION_REVIEW.md): FEM submatrices, the finite-volume stencil and measured optimization evidence.
- [Validation status](docs/VALIDATION_STATUS.md): what was checked and what remains unvalidated.
- [Build status](docs/BUILD_STATUS.md): requirement-by-requirement delivery and next tasks.
- [Physics roadmap](docs/PHYSICS_ROADMAP.md): experiments and model work needed before engineering use.
- [Third-party notices](THIRD_PARTY_NOTICES.md): direct runtime dependency licenses.

## License

No license has been selected for this project's original code. Third-party dependencies retain their own terms.
