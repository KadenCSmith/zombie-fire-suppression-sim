# Unified interface verification

27 September 2026. Author: delegated UI implementation agent. This is an implementation and browser-observation record, not an independent physics validation or installed-app certification.

## Implemented presentation

- Natural cutaway is the initial presentation: a detailed leafy oak and branching roots, continuous tan/brown strata, dark peat shading, and 570 fixed-seed irregular surface aggregates. The peat tint is interpolated from exported solver material fractions after calculation; before calculation it previews the scenario shape. Aggregates follow accepted nodal displacement but add no material inventory, solver elements, contacts, or cracks. Detailed tree anatomy remains illustrative.
- Scientific mode shows cellwise accepted temperature, absolute pressure, gas mole fractions, frozen-water inventory, diffuse damage or pore volume fraction. Colors use fixed declared scales. The whole solver grid is retained; only exposed faces are uploaded for rendering. Geometry buffers are reused and idle rendering is demand-driven.
- Compare views defaults to natural material versus scientific fields, with a common accepted state and linked camera. The optional original-Blender comparison pairs the historical authored animation with the scientific view. Its ~102 kg, 0.5 m source is visibly distinguished from the coupled scenario. Its time is normalized presentation progress, never represented as solver-derived motion.
- Physical edits invalidate the displayed calculation. One bounded previous scenario/result pair is retained and can be restored atomically; repeated edits do not overwrite that backup with an empty run. The worker's active mode is tracked separately, preventing rigid-pore progress from being mislabeled as coupled output.
- The first-run laboratory preset is read from `LAB_DEFAULT_COUPLED`. Resolution labels distinguish 2,560 elements (10 times the original default) and 20,480 elements (10 times the original research preset). Fine setup has an explicit initialization status.
- Terrain choices use the solver's canonical three scenario definitions. The prepared dry smoldering toggle, removed initial water, unassessed uncertainty, unsupported liquid infiltration, fracture limits, and absence of matched experimental validation are exposed explicitly.
- A numerical selector keeps both reference and optimized mechanical operators accessible. Export schema v2 includes grid, source, coordinate convention, accepted runs, display state, and provenance for the Blender importer.

## Observed browser checks

Tested in the Codex in-app browser against Vite on `127.0.0.1:5198`, using the current 0.12.0 source during integration:

| Check | Observation |
|---|---|
| Default presentation | Natural cutaway and precision 2,560-element/10 s preset displayed |
| Precision reference run | Completed 10 physical seconds; accepted state shown at 10.00 s |
| Preview coupled / rigid baseline | Both completed; selecting baseline retained matched physical time |
| Replay | End-state replay restarted at zero and advanced through accepted checkpoints; Blender clip rewound |
| Input change / restoration | Editing a completed Preview run from 10 to 20 s invalidated the display and exposed Restore; restoring returned the 10 s inputs and states together |
| Cancel | A 3,600 s test start was cancelled; controls returned immediately and the previous accepted run remained restorable |
| Terrain menu | Layered and rooted selections changed the scenario before running |
| Presentation | Natural, scientific, natural/scientific comparison, and original-Blender/scientific comparison rendered |
| Camera / cutaway / probe | Orbit interaction, reset, cutaway off/on and exposed-cell selection operated without changing the accepted time |
| Scientific field | Pressure selection updated the scientific view without rerunning |
| Browser console | No error entries in the final fresh session |
| Responsive layout | 1,280 × 720 desktop and 780 × 900 compact layouts inspected. A legacy 950 px global minimum was scoped away for this workspace; compact layout fits horizontally |
| Typecheck / lint | Passed after final UI edits |
| CI smoke script | Updated and `node --check` passed; the Electron script was not executed locally by this agent |
| Browser file export | Button enabled on accepted results. Browser download-event observation timed out, so a completed browser file download is not claimed |

The initial loading overlay used a Drei HTML portal and produced an unmount warning/error during suspense resolution. It was replaced with an ordinary overlay outside the Canvas, and the fresh-session console check above was clean.

User-facing screenshot artifacts are saved beside the repository in the task outputs: `Unified-Natural-Cutaway.png` and `Unified-Physics-Comparison.png`. Both show the completed 2,560-element reference scenario at 10.00 s.

## Limits

No interactive desktop performance FPS claim is made: demand rendering intentionally sleeps when the state and camera are unchanged. The browser checks do not establish native-package startup, experimental validation, or converged field predictions. The scientific solver and benchmark evidence are documented separately. The updated CI harness explicitly selects Preview, 10 seconds and Scientific mode so its runtime does not silently depend on the higher-resolution application default.
