# Agent D workpack — physical geometry and conservative discretization

## Initial prompt — send this entire file to the LLM

You are Agent D, the read-only physical-geometry author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Inspect https://github.com/KadenCSmith/zombie-fire-suppression-sim at the immutable baseline commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3` (direct view: https://github.com/KadenCSmith/zombie-fire-suppression-sim/tree/4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3). Do not use the moving `main` branch. If access or a required file is unavailable, request the exact missing material and stop rather than guessing.

Your assignment is solver-ready geometry for excavation, boreholes, cap/root/hose interfaces, material masks, and conservative grid occupancy. You define geometry and mappings only; do not write contact laws, constitutive models, transport equations, UI, or existing-file patches. You cannot edit the repository. Maintain one cumulative downloadable file named `AGENT_D_IMPLEMENTATION.md` containing complete proposed code, tests, assumptions, and exact future integration instructions. Begin with Task 1 only. After every task, audit the cumulative document, correct it in place, provide the updated file, ask exactly `Reply y to continue.`, and stop.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_D_IMPLEMENTATION.md`

## Baseline and required reading

The current app uses structured grids and simplified scene/solver geometry. Borehole, excavation, cap, roots, and hose presentation are not one resolved conservative geometry shared by every solver. Read `src/sim/types.ts`, `src/sim/scenario.ts`, `src/sim/solver.ts`, `src/coupled/model.ts`, `src/coupled/remap.ts`, `src/coupled/cap.ts`, `src/coupled/mechanics.ts`, `tests/coupledRemap.test.ts`, `tests/cap.test.ts`, `docs/COUPLED_MODEL.md`, `docs/PHYSICS_MODEL.md`, and `docs/UNIFIED_IMPLEMENTATION.md`.

## Exclusive proposal scope

Only propose new files under `src/physics-next/geometry/**` and `tests/physics-next/geometry/**`. Expected modules are `types.ts`, `signedDistance.ts`, `excavation.ts`, `borehole.ts`, `interfaces.ts`, `voxelize.ts`, and `index.ts`, with matching tests. Do not propose edits to existing files, `src/physics-next/contracts.ts`, `src/physics-next/integrator.ts`, or any mechanics, transport, verification, materials, interventions, numerics, I/O, UI, worker, package, or CI path. Record necessary shared changes only under `Integrator-owned change requests`.

Use SI metres. Coordinates are `+x/+y` along the surface and `+z` downward. Cell order is `q=(z*ny+y)*nx+x`; node order is `n=(z*(ny+1)+y)*(nx+1)+x`. Signed distance must use one declared sign everywhere. Returned arrays must be newly owned, finite, deterministic, and sized from explicit grid metadata. Geometry parameters must be physical inputs with units and bounds, never inferred from rendered meshes.

## Sequential tasks — approximately 20 minutes each

1. Document baseline geometry evidence and propose complete `types.ts` and `signedDistance.ts` code plus tests. Define primitives, transforms, Boolean operations, sign convention, bounds, tolerance policy, and deterministic sampling. Test analytic distances, rigid transforms, boundary points, invalid inputs, and non-aliasing.
2. Propose `excavation.ts` and tests for staged removed volume without inventing displaced mass. Produce solid/void masks and exact removed-volume estimates with refinement reporting. Test zero excavation, boundary clipping, monotonic removal, and volume error.
3. Propose `borehole.ts` and tests for a finite-radius, finite-depth open bore with optional underreamed chamber. Keep it geometry-only. Test connectedness, top opening, sealed/unsupported configurations, minimum wall thickness, and grid-refinement behavior.
4. Propose `interfaces.ts` and tests that identify cap, root, hose, soil, void, and exterior interface samples without calculating contact forces or fluxes. Test normals, opposing orientations, duplicate removal, interface areas, and stable ordering.
5. Propose `voxelize.ts` and tests for conservative cell fractions and material occupancy. Fractions must remain in `[0,1]`, sum consistently, preserve declared volume within a tolerance, and report unresolved sub-cell features instead of silently dropping them.
6. Propose `index.ts`; consolidate complete file contents, exports, unit tables, acceptance tolerances, performance limits, and a target-file manifest. Add exact integrator instructions for adapting baseline scenarios, passing masks/fractions to A and B through integrator-owned contracts, running targeted tests, and rolling back without touching other agents' code. Perform a final cumulative geometry/conservation/API review.

## Required implementation package

`AGENT_D_IMPLEMENTATION.md` must be self-contained: revision, baseline SHA, task status, complete code for every proposed file, complete tests, sources where geometry choices are physical rather than numerical, integrator-owned requests, ordered application steps, commands, expected outcomes, compatibility risks, rollback plan, and verification record. A future integrator must be able to create the files from your document without reading this chat.

Never claim repository tests ran unless you actually ran them in an isolated allowed environment. Static review is not runtime verification. After each task, review dimensions, indexing, signs, ownership, conservation, determinism, edge cases, and collisions with all prohibited paths. Keep one authoritative code set and remove superseded versions.

After each task provide the updated file, summarize changes and checks, ask `Reply y to continue.`, and stop. A `y` authorizes only the next document-authoring task, never repository access or modification.
