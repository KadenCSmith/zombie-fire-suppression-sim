# Fire-first workflow and rendered sequence

The application opens with the complete fire-and-treatment story: a small surface flame, underground peat illustration, a tracked excavator arriving with a boom-mounted auger, drilling and withdrawal, dry-ice placement, buried inverted metal plate placement and upward inversion, gas tracers, and water along assumed openings. Treatment is gated until 70% of the illustrated peat region is involved. The surface-to-peat connection and growing region are prescribed spatial cues; this is not a numerical burning-volume measurement. The remaining 30% stays visibly unburned when the excavator begins.

The natural cutaway retains the detailed oak, exposed roots, layered soil and seeded irregular aggregates and grass requested by the user.

## Two clocks and two source modes

The interactive story lasts 90 presentation seconds. Both interactive playback at the default rate and the rendered films map that story into 36 playback seconds: story 55–61 s runs 1:1, and the remaining setup/growth/water/review stages run 2.8×. Manual playback speed multiplies this schedule. The normal-speed rapid event is still prescribed animation, not a resolved physical explosion duration. Neither presentation clock is a claimed natural event duration. Accepted numerical fields have their own physical timestamps: the baseline cold-start ignition experiment runs for 24 hours, followed by a short finite-source treatment branch.

**Gradual** uses the accepted remaining dry-ice inventory where available. **Rapid** is a prescribed visual conversion. It does not create a new solved pressure, fracture or extinction history, and its comparison holds the accepted pre-treatment numerical fields after the intervention chapter. The original historical Blender study remains accessible in the physics laboratory.

## What the numerical history does

The new fire protocol starts at ambient temperature with retained moisture and no prepared hot region or dry halo. It uses an assumed surface-connected peat specimen, a finite external igniter, the existing reduced oxidation/heat/gas model and explicit mass/energy ledgers. The igniter turns off and the solver continues. Placement of finite dry ice preserves the fire history, imports its solid mass and internal energy, and books pore-volume compression work without resetting the original conservation baseline. Source relocation is included in checkpoint/restore; unsupported placements roll back.

The source-insertion API represents material imported into existing pore space, not a solved drill, excavation, sphere impact or newly formed cavity. It cannot relocate an active or future scheduled igniter. Exact numerical results, source hashes, assumptions and stop status accompany the generated cache.

The baseline sustains oxidation near the surface but does **not** resolve a travelling underground smoldering front. The natural scene illustrates the requested progression; temperature/oxygen/CO₂ views show only accepted data. They hide the staged fire, drill, dome, water and tracers so those shapes cannot be mistaken for computed field values. Heating a deeper cell is distinct from demonstrating downward combustion propagation.

## What remains staged

Drilling and removed cuttings, falling contact, enlarged dome bending, soil fracture creation and liquid flow/cooling along those fractures remain prescribed presentation geometry. No measured suppression success, safe field procedure, pressure-induced rupture or mobile-water infiltration calculation is supplied. CO₂ is invisible; colored tracers are a visualization convention. Residual fire is not automatically removed to manufacture success.

The requested full coupled fracture/infiltration model remains an open scientific dependency. It needs a verified coupled failure law, resolved excavation/source geometry, liquid transport and measured peat/root properties. The current 0.5 × 0.5 × 0.32 m cells and one-step chemistry cannot resolve the centimetre-scale fronts and multistep chemistry of [Huang and Rein (2017)](https://doi.org/10.1071/WF16198). This app does not reproduce their experiment.

## Reproducibility and playback

Use the chapter buttons or scrubber to inspect every operation. Playback speed changes presentation only. The rendered-film control plays the corresponding complete MP4 locally; the native app serves byte ranges so films can seek without loading the entire file into main-process memory.

`src/story/fireSequence.ts` defines the shared sequence timing. Blender construction scripts, editable scenes, rendered movies and their verification record retain corresponding provenance. Existing original Blender files and previous application versions remain preserved.
