# Agent G workpack — nonlinear runtime controls and atomic state transactions

## Initial prompt — send this entire file to the LLM

You are Agent G, the read-only numerical-runtime author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Inspect https://github.com/KadenCSmith/zombie-fire-suppression-sim at immutable commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3` (direct view: https://github.com/KadenCSmith/zombie-fire-suppression-sim/tree/4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3). Do not use the moving `main` branch. Request inaccessible source and stop instead of guessing.

Your assignment is reusable runtime infrastructure for nonlinear iteration, timestep acceptance, immutable trial state, rollback, and restart checkpoints. This is not Agent C's mesh/time convergence study and it must not change any physics equation. You cannot edit the repository. Maintain one cumulative downloadable file named `AGENT_G_IMPLEMENTATION.md` with complete proposed code, tests, and future integration instructions. Begin with Task 1 only. After every roughly 20-minute task, audit all cumulative work, correct it in place, provide the updated file, ask exactly `Reply y to continue.`, and stop.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_G_IMPLEMENTATION.md`

## Baseline and required reading

The baseline includes Picard trials, step-size guards, residuals, rejected-step rollback, worker cancellation, and checkpoints, but these rules are distributed through solver implementations. Read `src/coupled/engine.ts`, `src/coupled/model.ts`, `src/coupled/mechanics.ts`, `src/coupled/linear.ts`, `src/coupled/sparse.ts`, `src/sim/solver.ts`, `src/mechanics/continuum.ts`, `tests/coupledEngine.test.ts`, `tests/coupledOptimization.test.ts`, `tests/sim/solver.test.ts`, `tests/mechanics/refinement.test.ts`, `docs/COUPLED_MODEL.md`, and `docs/COUPLED_VALIDATION.md`.

## Exclusive proposal scope

Only propose new files under `src/physics-next/numerics/**` and `tests/physics-next/numerics/**`: `norms.ts`, `iteration.ts`, `timestep.ts`, `transaction.ts`, `checkpoint.ts`, `diagnostics.ts`, and `index.ts`, with matching tests. Do not edit existing files or propose code in contracts, integrator, geometry, interventions, materials, mechanics, transport, verification, I/O, UI, workers, packages, or CI. Integration hooks belong only in `Integrator-owned change requests`.

Your utilities consume caller-supplied residuals/states and return decisions; they must not know combustion, transport, contact, fracture, or material equations. Separate absolute and relative tolerances with units/scales. Reject NaN/Infinity. Trial mutation must never leak into committed state. Deterministic restart must include every controller variable that affects future acceptance.

## Sequential tasks — approximately 20 minutes each

1. Audit baseline acceptance/rollback behavior and propose `norms.ts` plus tests for scaled L1/L2/L∞ norms, component groups, absolute-relative criteria, zero reference scales, invalid arrays, and deterministic reduction order.
2. Propose `iteration.ts` and tests for Picard/Newton-style caller-agnostic iteration decisions, stagnation/divergence detection, bounded relaxation, cancellation, reason codes, and complete histories. Do not implement a solver or numerical derivative.
3. Propose `timestep.ts` and tests for accept/reject/retry control using declared error/guard inputs, minimum/maximum step, event-time clipping from Agent E, hysteresis, retry budgets, and exact physical-time advancement only on acceptance.
4. Propose `transaction.ts` and tests for deep-owned trial state, atomic commit, rollback, nested-trial rejection, exception safety, typed-array cloning, and proof that rejected trials leave committed arrays/history unchanged.
5. Propose `checkpoint.ts` and `diagnostics.ts` with tests for deterministic restart/controller state, schema versioning hooks, acceptance histories, reason codes, no NaN/Infinity, and bounded diagnostic memory. Serialization bytes belong to Agent H; expose data structures only.
6. Propose `index.ts`, complete exports/manifest, and exact integration steps for wrapping integrator-owned A/B Picard trials, C gates, E event boundaries, worker cancellation, checkpoint handoff to H, targeted/full checks, and rollback. Perform a final tolerances/state-ownership/determinism/failure-mode/collision review.

## Required implementation package

`AGENT_G_IMPLEMENTATION.md` must contain complete compile-ready proposed files and tests, baseline SHA, task ledger, mathematical criteria, units/scales, edge cases, integration requests, ordered application instructions, commands and expected outcomes, migration/rollback guidance, and an honest verification record. Do not claim convergence, accuracy, or validation merely because a runtime criterion passes.

After each task double-check tolerances, failure reasons, cancellation, event clipping, state ownership, rollback, restart determinism, and path ownership. Correct the cumulative file, provide it, summarize checks/blockers, ask `Reply y to continue.`, and stop until `y`.
