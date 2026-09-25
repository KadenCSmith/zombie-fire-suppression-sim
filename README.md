# Zombie Fire Suppression Sim

**Exploratory animation — reduced, unvalidated physics.**

A local macOS application for exploring a buried dry-ice source, finite heater input, peat smoldering, and slow gas/heat transport under a 20 ft × 20 ft (6.096 m × 6.096 m) grass surface. A separate bounded radial gas event drives a reduced vertical soil mechanics calculation. These reduced calculations compare assumptions and numerical behavior; they do not establish whether a field treatment would suppress a fire, fracture soil, or be safe.

Private repository: [KadenCSmith/zombie-fire-suppression-sim](https://github.com/KadenCSmith/zombie-fire-suppression-sim).

## Run locally

Extract **Zombie Fire Suppression Sim.app.zip** from the task's `outputs` folder into `~/Applications`, then open **Zombie Fire Suppression Sim.app** there. It opens its own window, needs no browser or separate Node.js installation, and works without an API key or cloud service. The app bundles the built interface and serves it to its own window through a random `127.0.0.1` port; closing the app stops that local server. The signed archive is a generated deliverable beside this source repository, not a file committed to Git. It is locally signed for this Mac and is not Apple notarized for general distribution.

The repository's [run-mac.command](run-mac.command), or `npm run mac`, opens the installed app in `~/Applications`. To rebuild the Mac app from source, install Node.js 22.12+ and npm, then run:

```sh
npm ci
npm run package:mac
```

The build places `Zombie Fire Suppression Sim.app.zip` beside this repository in `outputs`. Run this extraction command from the repository folder to keep macOS File Provider metadata out of the app bundle:

```sh
mkdir -p "$HOME/Applications"
ditto -x -k --norsrc --noextattr --noqtn '../Zombie Fire Suppression Sim.app.zip' "$HOME/Applications"
```

Then open the app in `~/Applications`. For source development in its own live-reloading Mac window, run:

```sh
npm run dev:mac
```

Keep that command running while editing source files. It uses Electron and Vite on loopback without opening Safari or Chrome. The browser development server is also available with:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To run checks or prepare a static build:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Dependency versions are pinned in `package.json` and `package-lock.json`; `npm ci` installs the locked set.

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

- **Setup:** choose a demonstration scenario, then use **Edit part of scenario** to show one group at a time: Dry ice and heater, Soil and peat, Smoldering and pathways, Air and boundaries, or Advanced model. Diameter and density set the initial dry-ice mass; there is no separate mass entry. Scenario edits restart the physical run after a short debounce, while heater on/off is recorded as a live operational event. **Reset settings to defaults** restores the demonstration scenario and interface settings, then starts a fresh physical run.
- **Scene:** choose 3D orbit, top, X section, or Y section; drag to orbit and scroll to zoom. The 3D orbit shows geometry without a full-height field sheet. Top and X/Y section views show quantitative colored cells; move their slice with the clipping slider, select a field, and choose fixed or adaptive color scaling. Toggle modeled flow arrows and visible roots. Click a colored cell to place the virtual sensor.
- **Simulation:** play/pause, take one physical solver step, reset the current run, fast-forward, or run to a chosen hour. One-, three-, and seven-day windows are available. The solver pace defaults to **30 simulated seconds per real second** and can request 120, 600, or 3600; the worker reports achieved throughput. The physical **Reset** restarts the currently selected settings, distinct from Setup's **Reset settings to defaults**. Scrub recorded checkpoints or choose a separate playback pace to inspect saved states without advancing the solver. Solver-derived smoldering power, consumed fuel, cumulative heat, and reacting cell count are shown alongside peak temperature and other readouts.
- **Results:** inspect probe histories and mass/energy diagnostics, export CSV, PNG, or recorded states, or compare an otherwise identical heater-off baseline in A/B view. The two runs use the same initial seed and fixed color scales; compare matched physical times.
- **Motion:** trigger a separate visual opening/settling sequence. Its artistic movement setting does not change the solver or generate a predicted pathway.
- **Event:** compute a separate radial gas calculation from the current slow-run state for up to 2 simulated seconds, with its own clock and at most 100 recorded frames. Its pressure frames load 4³ vertical soil elements by default. New mechanics frames arrive live in the Mac window; inspect calculated displacement or yielded elements separately from the legacy illustrative shell damage index. Pause, resume, or cancel mechanics; choose 6³ or 8³ after the small run passes checks and click Run. The one-click **Convert remaining dry ice to CO₂ + compute event** control transfers the remaining modeled solid to gas. Smoke and steam controls show distinct plumes derived from oxidation and water-loss rates; CO₂ remains invisible.
- **Files:** Setup imports or saves scenario JSON; Results exports sparse history as CSV, a scene PNG, or recorded states as JSON. Invalid imports report validation errors. The States JSON is an export of saved snapshots, not a simulator checkpoint that the UI can resume.

The Results panel shows remaining source mass, heater input, peak temperature, remaining fuel, sensor values and histories, and expandable mass/energy diagnostics. See the status labels beside each subsystem before interpreting an overlay.

## What the displays mean

- The 3D soil and grass scene shows geometry; top and X/Y section views show colored values on a coarse grid beneath the surface. Their colors are display choices; CO₂ itself is not colored.
- The buried source is shown as a volume-equivalent sphere. Its shrinking display does not resolve cavities, contact resistance, or a spherical solid interface.
- An initial hot region sets temperature and available fuel; it is not held hot afterward. Local oxygen-dependent fuel oxidation adds modeled heat to the energy balance, while conduction, gas cooling, evaporation, and boundaries can still cool the peat. The on-screen glow follows modeled temperature and is not a separate heat source.
- The heater input is volumetric heat generation `q'''` in W/m³ over a fixed numerical support volume. Total power is derived from that volume. An editable heater setting is an energy input, not a temperature difference.
- The one-click conversion consumes all remaining modeled solid CO₂ at the current solver time and adds the same mass as pore gas. Its estimated warming, latent, and gas-equilibration costs are booked as **external intervention energy**; this control bypasses the ordinary energy-limited sublimation rate and does not extract that energy from the soil. It may immediately pause slow-flow transport on a pressure-validity warning. The ensuing radial gas calculation loads the reduced mechanics solver; neither is a validated blast, fracture, or field-movement prediction.
- The displayed pressure-load number multiplies modeled near-source excess pore pressure by a fixed, imagined support-plane area. It is a labeled algebraic proxy in newtons, not a calculated force on a real soil surface or a rupture forecast. Values shown after a validity pause are outside the supported model range.
- The event view moves soil elements according to calculated vertical displacement and colors yielded regions separately. The manual motion control in Simulation and the radial shell damage index remain illustrative. Any manually assumed pathway geometry is a separate hypothetical transport case.

## Model limits and documents

The combustible fuel is represented by an uncalibrated, cellulose-like complete-oxidation surrogate. Char and ash are not modeled inventories in this release. Peat-specific kinetics, heterogeneous moisture/flow measurements, source-scale phase behavior, and experimental validation remain open work. The model stops if a configured low-speed gas or thermodynamic validity check fails; it must not be interpreted as a blast or geomechanics calculation.

- [Physics model](docs/PHYSICS_MODEL.md): equations, units, boundaries, numerical treatment, and diagnostics.
- [Short-time event model](docs/FAST_EVENT_MODEL.md): radial gas calculation, illustrative shell damage indicator, and separate validity limits.
- [Mechanics model](docs/MECHANICS_MODEL.md) and [method decision](docs/SOIL_MECHANICS_DECISION.md): vertical force balance, pressure mapping, yield, plumes, assumptions, and limits.
- [Parameter reference](docs/PARAMETER_REFERENCE.md): bases, default values, ranges, and provenance.
- [Sources](docs/SOURCES.md): primary references and reuse choices.
- [Validation status](docs/VALIDATION_STATUS.md): what was checked and what remains unvalidated.
- [Build status](docs/BUILD_STATUS.md): requirement-by-requirement delivery and next tasks.
- [Physics roadmap](docs/PHYSICS_ROADMAP.md): experiments and model work needed before engineering use.
- [Third-party notices](THIRD_PARTY_NOTICES.md): direct runtime dependency licenses.

## License

No license has been selected for this project's original code. Third-party dependencies retain their own terms.
