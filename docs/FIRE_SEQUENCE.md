# Fire-first workflow and visual evidence boundaries

## Current Chrome development scene (after 0.18.2)

The main interactive natural view now combines preserved visual elements: V16's tracked excavator and rotating auger, V17.1's dense orange smoldering embers and woven hose, V9's straight cylindrical bore and descending metal cap, and V18.1's dark peat with sparse residual embers after local water contact. The auger and bore stay at their original 0.20 m and 0.24 m radii; no underreamed chamber or open pit is made. The metal cap has a constant 0.2184 m radius and 0.055 m concavity during descent and afterward. Its center descends from the surface into the bore at story 48–51.5 s. Neither the cap nor the bore expands, and there is no cap flattening or soil uplift. These dimensions and motions are authored visualization geometry, not an installation or a mechanical calculation.

Short fractures begin when the dry-ice proxy reaches its prescribed depth at story 44 s, before the cap descends. Three local branches are illustrated; one reaches exposed pale soil beside the bore to make the onset legible around the roots. No failure stress or pressure is computed. The woven hose enters at 69–72 s. Water appearance begins along those branches at 72 s in either source mode; a local halo darkens peat and reduces ember density only where its assumed front reaches. Unreached peat stays bright. This is not a Darcy/Richards infiltration prediction or a field-scale extinguishment result. The accepted numerical fields and separate contact budget are unchanged. This is a browser development preview; the installed 0.18.2 Mac app still has the earlier scene.

## Historical 0.18.1 scene

The main interactive scene shows a fixed-width excavator bucket opening a pit with sloped sides. A finite source proxy and shallow concave metal cap are placed while the pit remains open. The pit is then backfilled above the cap. In rapid mode the cap flattens instead of inverting; its projected radius increases only up to the initial meridian length, and soil directly above it lifts by at most 0.04 m. Short illustrated fractures receive water after hose insertion, and embers dim where assumed wetting arrives. The scene omits the prior widening cutter, global burst debris and visible CO₂. The excavation, backfill, deformation and wetting are staged, not measured construction performance or a validated peat-fire treatment. Root damage and excavation support are not calculated. The accepted numerical fields and separate contact budget are unchanged. The earlier 0.18.0 underreamed pocket remains selectable under **Previous simulations · v0.8+**.

## Historical 0.16 presentation

The 0.16 presentation opened with surface ignition, connected irregular underground peat involvement, a tracked hydraulic excavator drilling and underreaming, dry-ice placement, a folded steel dome opening underground, rapid-only inversion and fracture, and a flexible woven hose feeding progressive local wetting. The dark teal/copper cutaway, fine grass, oak/root context and 70% illustrated treatment gate remain. The 70% threshold is an authored sampled-area measure, not numerical fuel consumption or a measured burned volume.

## Historical shared geometry and coherent placement

The illustrative shaft remains 0.48 m in diameter. A folding cutter opens an explicitly shown wider chamber at depth before withdrawing. The segmented dome enters folded, deploys inside that chamber and leaves a service opening for the hose. Its rapid-only upward inversion and radial wedge engagement share the pressure-release timing; fractures begin at story 55 s. Neither the underreaming operation nor the shell/soil motion is a verified field installation or a calculated failure result. Canonical dimensions are in `src/story/fireSequence.ts` and the generated `public/fire-sequence-contract.json`.

The hose follows a curved route from the surface into the bore, with an original procedural woven fabric appearance based on the supplied reference. No watermarked stock pixels are redistributed. Water begins after insertion at story 72 s. Wet paths advance slowly from the outlet into nearby assumed cracks and soil; distant regions stay dry/hot. Wetting paths, arrival times and spread widths are authored assumptions, not a solved Darcy/Richards liquid-flow field. Gradual mode has no newly opened rapid-event cracks.

## Separate contact calculation and accepted field experiment

The natural story uses a separate finite contact calorimeter described in [Contact cooling](CONTACT_COOLING.md). It starts with assumed hot peat patches, a finite dry-ice inventory and a limited water supply. Peat sensible energy lost to contact is balanced by coolant enthalpy gain; source/water masses have explicit ledgers. The gradual natural-scene sphere follows that contact scenario's remaining mass. Rapid removal is a prescribed visual intervention and earns no fictitious additional sublimation heat. Local cooling changes only contacted ember cues; it does not force the scene to extinguish.

This contact scenario is **not** a continuation or validation of the accepted porous-model experiment. Its temperatures, contact areas, conductance, water arrival and treatment timing are assumptions. It omits continuing chemical heat release in those isolated patches and cannot predict field suppression or rebound. Conservation checks verify the reduced calculation, not the assumed contact geometry or material response.

The accepted temperature, oxygen and CO₂ views retain the original cold-start fire experiment, described in [Fire protocol](FIRE_PROTOCOL.md). That baseline covers 24 physical hours and 30 seconds of finite-source treatment; it retains 3.9982114701 kg of its 4 kg source. The original accepted cache SHA-256 remains `212b82c7e51157c3d3f0bdd25408d7c383c00a324d3b60bf1e68828f6b9b25a0`. It sustains surface oxidation, but does not resolve a travelling underground smoldering front or demonstrate successful extinction. Rapid mode holds the accepted pre-treatment field because there is no accepted rapid-conversion experiment. Scientific views omit the staged hose, dome, fire, tracers and rupture geometry.

Do not add the contact model's heat, water or source losses to that accepted experiment's ledgers. They describe different assumed configurations. Main controls, provenance and film captions identify that separation.

## Presentation clocks and appearance

The interactive story lasts 90 presentation seconds. Default playback and both complete films compress it to 36 seconds: story 55–61 runs 1:1 and other stages run 2.8×. Manual speed changes presentation only. The accepted experiment has independent physical timestamps; contact-model elapsed time is its own assumed exposure clock.

A shared seeded connected arrival graph on the 200 × 80 appearance atlas drives peat involvement. The front reaches 70% of its 4,141 display samples before equipment starts, leaving an unburnt margin. The arrival map is a display construction, not a transport/combustion solution. Boundary smoothing does not alter that threshold. Hot peat uses embers and char rather than a buried flame sheet.

In historical replays, rapid ground uplift, irregular piece separation, decorative dust/debris, dome inversion and cracks are prescribed. The preserved 0.18.1 scene uses open excavation and backfill, bounded cap flattening and local soil lift. The current Chrome preview uses a straight bore, a fixed-size cap and a fracture timed to dry-ice contact. CO₂ is nonflammable and invisible; gas wisps in earlier replays are labeled tracers. No pressure, explosive yield, detonation or mechanical failure threshold is inferred from animation.

## Reproducibility and limits

Both Blender scenes consume the exported appearance, geometry/timing and contact-cooling contracts. Each complete film contains 864 H.264 frames at 24 fps and 1280 × 720 for 36 seconds. Delivery records identify the derivative scene, scripts, contracts, cache, reference source and movie hashes. Earlier films, installed apps and original Blender sources remain preserved.

The requested full coupled fracture/infiltration problem still needs verified liquid transport, failure/large-deformation/contact laws, resolved excavation geometry, matched material data and experimental holdout observations. The current 0.5 × 0.5 × 0.32 m accepted cells and one-step chemistry cannot resolve centimetre-scale fronts and multistep chemistry from [Huang and Rein (2017)](https://doi.org/10.1071/WF16198). This app does not reproduce that experiment. Additional visual detail and a conserved contact calculation do not close these scientific gaps.
