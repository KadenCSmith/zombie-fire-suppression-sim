# Current presentation and navigation — 0.20.0

The app opens the existing interactive cutaway in a cinematic interface. Scroll down to bring the scene into view; on first reaching the bottom it plays automatically. The bottom bar has pause/play, rewind, scrubbing, speed and restart. Opening Finder or Toolbox pauses the current sequence. Drag the scene to orbit; use Toolbox → Camera distance to zoom so the scroll gesture can enter the scene.

Simulation Version selects the render, coupled continuum, porous gas/heat, mechanics, scene studio or previous simulations. Previous simulations uses a shared timeline; choose archived models in Toolbox. Finder has a search box, guides and current values that open the corresponding control, plus the full physics reference under Documentation. All current-workspace variables are in Toolbox. Additional features at its bottom retain scenario import/export, results, virtual probes, material research, numerical verification, tensile lab and the Instrument/Technical appearances.

## Clock and ordered operations

`src/story/firePresentation.ts` is the deterministic current presentation timeline. `PRESENTATION_TIMING` names the event times; `PRESENTATION_SPEED` names the rates. Existing user speed settings multiply only the presentation clock. Smooth transitions use the existing cubic easing, and an integrated monotone clock is inverted for playback. No physical timestep, reaction coefficient or accepted solver state is changed.

| Story time | Action |
| --- | --- |
| 0–18 s | Accelerated ignition and early underground growth at 3.2 story seconds per real second. |
| 18–24 s | Excavator enters and parks; smooth slowdown to 1.2 story seconds per real second. |
| 24–34 s | Existing auger penetrates and drills; the same authored peat front continues advancing until 40 s. Soil-colored cuttings are drilling cues. |
| 34–40 s | Drill retracts, clears at 36.5 s and excavator exits. Pace smoothly returns toward 2× for source placement. |
| 39–55 s | Existing dry-ice descent, fixed cap and rapid/gradual treatment behavior; pace smoothly approaches 1× around the release. |
| 57–65 s | Water truck enters and parks beside the access point, occupying the former pre-hose waiting interval. |
| 65–69 s | Woven hose unspools from the visible attached reel; only the deployed prefix is drawn. |
| 69–72 s | The free end follows the original bore/cap-gap route, after drill clearance. |
| 72–90 s | Water starts after connection and follows the existing progressive paths and separate finite contact budget. |

Every vehicle, reel, particle and hose pose derives from the same story time, so seeking backward/resetting removes later equipment and water cues. The camera and scene composition are retained. Historical versions keep their original 36-second replay clock, 70% gate and edge-fed hose. Their preserved Blender films are unchanged.

## Checks and limits

New tests cover 24/30/60 fps and 0.5/1/1.5/2/3× settings, smooth rate boundaries, loop/restart, continued growth during drilling, ordered water gating, continuous attached hose-tip motion and densely sampled rendered-tube clearance. Representative browser frames accompany the release. The existing full suite, build and integration tests remain required.

The natural front remains an authored illustration on the existing connected arrival map. Scientific views consistently sample stored accepted growth frames across 10–40 story seconds and retain physical timestamps; they do not claim a resolved underground spread front. Equipment/pump dynamics, construction timings, liquid infiltration and field suppression are not calibrated predictions. The existing finite contact budget and scientific limitations remain in [Fire sequence](FIRE_SEQUENCE.md), [Contact cooling](CONTACT_COOLING.md) and [Validation status](VALIDATION_STATUS.md).
