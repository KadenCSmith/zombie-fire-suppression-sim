# Geometry package integration (2026-09-29)

The user-supplied `AGENT_D_IMPLEMENTATION.md` provides seven geometry modules and seven matching test files. Its 14 fenced TypeScript payloads were extracted only after the listed SHA-256 digests matched and every target path was confirmed absent. The original document in Downloads was read without modification. The separate, independently edited Stage 2 Blender file was not staged or changed.

The package under `src/physics-next/geometry/` provides a validated SI grid, signed primitive and Boolean fields, exact orthogonal-box excavation, finite open borehole and underream geometry, priority-owned material regions, caller-supplied analytic interface sampling, and bounded adaptive material-volume estimates. `tests/physics-next/geometry/` contains its seven executable test files. The package is exported through its own `index.ts` but is **not imported by the application, workers, or existing solvers**. Installing these source files does not change the 0.11 simulation, renderer, or release binaries.

## Checks run in the current repository

| Check | Result |
| --- | --- |
| Manifest and path preflight | 14 unique new paths; all payload hashes matched; no overwrites |
| New Vitest files | 7 files, 86 tests passed |
| Full Vitest suite | 29 files, 219 tests passed |
| Typecheck | Passed with repository TypeScript 7.0.2 |
| Lint | Passed with repository oxlint |
| Production build | Passed with Vite 7.3.6; existing Lucide directive and bundle-size warnings |

Checks were run with Node 26.8.2, npm 11.19.1 and Vitest 5.0.2. These establish software integration of the geometry package, not physical or experimental validation. There was no installed-app visual check because the package is unused by the running application.

## Review and activation boundary

The handoff baseline commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3` is not available in this checkout; the current repository is version 0.11.0 and its coupled implementation has changed. For example, the handoff references `src/coupled/remap.ts`, which is absent here. The new paths had no collisions, and the current locked-toolchain tests passed, so this integration keeps the package separate rather than applying stale adaptation steps to the current solver.

The geometric signs, units and priorities are explicit, but curved volumes are bounded estimates; interface coverage depends on supplied patches; area clipping is quadrature, and `topologyValidated` remains false. The package does not calculate face apertures, transport fluxes, stress, contact, removed inventory, gas/energy budgets, root reinforcement or suppression outcomes. No shape or dimension is inferred from the rendered scene.

Before using these fractions in the coupled solver, define physical geometry inputs and provenance, a shared geometry revision and material mapping, cut-cell mechanics, transport face areas, boundary connectivity, and an inventory ledger for excavation. Retain the current canonical material state until those adapters pass conservation, mesh sensitivity and no-intervention regression checks. A volume-level `accepted` result is not solver or field approval.
