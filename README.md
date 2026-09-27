# Zombie Fire Unified Physics Lab

An integrated Mac research app combining the coupled simulator with the editable dry-ice Blender study. It opens on a complete fire-first sequence: surface ignition, underground peat illustration, an excavator drilling, dry ice, a buried inverted metal plate, gas displacement cues and water along assumed fractures. The natural cutaway has grass and irregular seeded aggregates, with separate accepted numerical fields and two full Blender films.

**Physics first, with explicit limits.** The new 2,560 and 20,480 cell options are exactly 10× the former preview and research sizes. A shared material atlas conserves initial inventories across meshes. The finite CO₂ source now couples heat transfer, sensible energy and concentration-dependent mass transfer. The original float64 mechanics reference remains available alongside a measured sparse optimization. More elements do not establish experimental accuracy.

- [Start here](docs/UNIFIED_QUICKSTART.md)
- [Full fire sequence and both source modes](docs/FIRE_SEQUENCE.md)
- [Cold-start fire experiment and exact limitations](docs/FIRE_PROTOCOL.md)
- [Implementation and assumptions](docs/UNIFIED_IMPLEMENTATION.md)
- [Measured optimization](docs/review/unified/optimization.md)
- [Blender assets, import and provenance](docs/UNIFIED_BLENDER.md)
- [Evidence register](docs/UNIFIED_EVIDENCE_REGISTER.json) and [bibliography](docs/UNIFIED_BIBLIOGRAPHY.md)
- [Validation status](docs/VALIDATION_STATUS.md)

The original Blender animation remains an explicitly staged comparison. Natural aggregate detail and oak anatomy are presentation geometry; visible solver deformation is driven by accepted nodal states. CO₂ is invisible, and no visible mist is presented as calculated gas.

No matched experimental validation, mobile liquid-water infiltration, resolved excavation or accepted terrain rupture is claimed. Fracture remains a gated research capability. The app reports uncertainty as unassessed rather than inventing an accuracy percentage. Old workspaces, releases and upstream Blender sources are retained.

## Model selection and mechanics comparison — 0.10

The **Physics model** selector opens the fast demonstration, existing porous gas/heat workspace, or new soil-deformation workbench. In the latter, compare identical load/unload stages through explicit linear elasticity and frictional plasticity, using shared cameras/scales and calculated displacement, incremental stress and plastic strain. Sliders have units, numeric entry and resets; changing physical inputs invalidates the previous trajectory. A new analytical benchmark exposed and repaired an unloading convergence defect. The homogeneous fixture is separate from the oak landscape and is not coupled fracture.

The **Peat tensile fracture lab** adds irreversible separation, a force–extension chart, an energy ledger and measured CSV comparison. Documented Krimpen strength observations guide the tensile range; stiffness and fracture energy remain explicit assumptions. [Tensile equations, evidence and validation criteria](docs/PEAT_TENSILE_FAILURE.md).

[Workbench, audit and next stages](docs/MODEL_WORKBENCH.md) · [Parameter evidence](docs/WORKBENCH_PARAMETER_EVIDENCE.md). Open directly with `--mechanics`. Earlier scenes remain in ⋯.

## Broad ground opening and surface fire

Version 0.9 replaces the short damage marks with irregular soil pieces that separate under a broader assumed load. The bur oak has uneven deep branching roots. A wide buried peat fire has an unburnt margin and a staged narrow path to a small surface fire. All earlier versions remain in the **⋯ menu**. [Mechanics assumptions, display choices and peer-reviewed fire evidence](docs/WIDE_RUPTURE_FIRE.md).

## Seated cap, deep roots and bonded soil

Version 0.8 adds a concave cap falling directly onto the ice, an assumed restrained rim with calculated flex, spring-bond soil separation and slight surface uplift. The deeper peat pocket has an unburnt surround. A young bur oak has lobed leaves, lateral roots and descending roots to about 2.7 m. Loading, root dimensions and mechanical coefficients remain assumptions. The **⋯ menu** retains versions 0.5–0.8. [Model, research rationale and ASCE citations](docs/CAP_SOIL_PARTICLES.md).

## Earlier gas-release scenes

Version 0.7 adds calculated debris translation with gravity, air resistance, inelastic bounce, friction and simplified cage-bar contacts. The **⋯ menu** at the top opens 0.5, 0.6 and 0.7 scenes for comparison. Release velocity is assumed and editable; gas pressure, fracture and cage strength are not predicted. [Dynamics, sources and limits](docs/SCENE_DYNAMICS.md).

Version 0.6 adds a **five-second delay after landing**: the sphere lands at 4 s and instantly disappears into expanding gas tracers at 9 s. Soil grains and rocks move outward and settle. An inverted, open-bottom cage is placed over the opening after landing; its default height is 10 cm and its width is 95 cm. Toggle it or edit these dimensions in the scene sidebar. Replay, reverse seeking and all four views share the same event time. This is prescribed animation, with no calculated gas pressure or cage containment. [Sequence guide](docs/SCENE_STUDIO.md).

## Research materials and Developer tools

Version 0.4 adds **12 researched composition profiles**: Irish moss peat, an Andean organic-soil comparison, and ten lowland peat–sand mixtures. Open **Simulation → Developer → Research profiles**. Choose a target, stage a profile, review its measured/estimated inputs, and apply it to restart the calculation. The Developer tab also exposes thermal, gas, reaction, mechanics and numerical constraints with source notes, input validation and an evidence export.

[Profile guide](docs/RESEARCH_PROFILES.md) · [Material audit and ASCE citations](docs/MATERIAL_EVIDENCE_ASCE.md). The user-supplied working document was included in the review. Unsupported settings remain labeled assumptions; selecting a paper does not experimentally validate the simulation.

## Download and launch

[**Download the 0.15.0 fire-sequence release**](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.15.0) — choose the **macOS arm64 DMG** or ZIP for Apple Silicon. This unified release is not a universal Mac build. GitHub access is required while the repository is private; the packaged app works offline.

The 0.12 reference retains the original float64 mechanics backend. The 0.13 accuracy-workflow successor enables the verified sparse optimization under the same physics and acceptance gates, with 0.125 s maximum steps on both new precision meshes. This trades additional runtime for lower observed temporal error. [Release tracks, installation and commands](docs/INSTALL.md) · [Verification status](docs/VALIDATION_STATUS.md).

Open the versioned fire-sequence installation:

```sh
open -na "$HOME/Applications/Zombie Fire Suppression Sim 0.15.app" --args --sequence
```

From this checkout, `npm run mac -- --coupled` finds the installed minor version matching `package.json`. It checks the bundle version and preserves older installations. Mac requires macOS 13 or later; the app is ad-hoc signed and not Apple notarized.

The startup screen offers a 90-second interactive story, two 36-second Blender films, and a separate cold-start fire experiment. The 24-hour baseline retains initial moisture and sustains surface oxidation but does not resolve an underground combustion front. Drilling, dome bending, fractures and water remain illustrative. In the physics lab, start with the cold source-only case and 2,560 cells. Calculate, then switch between Natural cutaway, Scientific fields and synchronized Compare views. Terrain changes require a new calculation; presentation controls preserve accepted states. The historical Blender comparison retains its distinct mass, geometry and normalized timing. [Current controls and model limits](docs/UNIFIED_QUICKSTART.md).

[Earlier 0.11.0 platform downloads](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.11.0) remain available for Intel Mac, Windows and Linux. They contain the earlier application, not the unified 0.12 features. New platform support is determined by the assets and validation records of each release.

Version 0.5 improves surface/contact thermal stability, consistent reaction yields and current-mass transfer from the flow mesh to mechanics. It retains historical reaction yields for older imported files. The model remains experimentally unvalidated. [Equations and limitations](docs/PHYSICS_MODEL.md).

For development, install Node.js 22.12+ and run:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run dev:mac
```

`npm run dev` starts the browser development server. On macOS, `MAC_ARCH=arm64 npm run package:mac` builds a versioned Apple Silicon Mac DMG and ZIP. New unified releases target macOS; old platform downloads remain available. Dependency versions are pinned in `package.json` and `package-lock.json`.

## Example scenarios

These preserved porous gas/heat examples use the same 6.096 m square domain and an explicitly assumed property set. They are demonstration inputs, not measured field cases or tuned proof of suppression.

| Scenario | Change from the heated-source demonstration |
| --- | --- |
| [Untreated smoldering](examples/untreated.json) | Same initial hot peat; dry-ice mass set to zero and heater off. |
| [Buried dry ice, heater off](examples/dryIceOnly.json) | Finite buried dry ice exchanges heat with its surroundings without heater input. |
| [Heated buried dry ice](examples/heatedDryIce.json) | Same initial peat and source with its finite scheduled heater. |
| [Wet, low permeability](examples/wetLowPermeability.json) | Higher assumed water saturation and lower assumed intrinsic permeability. |
| [Hypothetical edited pathway](examples/hypotheticalPathway.json) | A manually assumed higher-permeability pathway; it is **not** predicted by soil motion. |

For a meaningful A/B comparison, keep the same initial hot region, random seed, grid, and display scales, then change one assumption. The outcome depends on the reduced model and must not be interpreted as a field success rate.

The linked JSON files can be selected through **Import**. They carry the schema version, model identity, unit metadata, seed, and input provenance used for repeatable runs.

## Preserved workspace controls

For the current coupled interface, see the [unified quick start](docs/UNIFIED_QUICKSTART.md). The controls below describe retained earlier workspaces.

- **Scene studio:** select one of four views, drag to orbit, scroll to zoom, toggle labels or reset the camera. Play/pause, restart, scrub, select a chapter, set 0.5×/1×/2× speed or loop the 20-second illustration. Changing views preserves its current time. Scrubbing pauses playback; backgrounding the app pauses it. **Open simulation** enters the scientific workspace; its **Scene studio** button returns to the illustration and pauses the scientific run while retaining its current in-memory scenario and history. Studio motion does not modify the solver.

The following controls belong to the **earlier porous gas/heat workspace**:

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
