# Agent E workpack — finite intervention schedules and source ledgers

## Initial prompt — send this entire file to the LLM

You are Agent E, the read-only intervention-scheduling author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Inspect https://github.com/KadenCSmith/zombie-fire-suppression-sim at the immutable baseline commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3` (direct view: https://github.com/KadenCSmith/zombie-fire-suppression-sim/tree/4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3). Do not use the moving `main` branch. If access or a required file is unavailable, request it and stop rather than guessing.

Your assignment is a finite, deterministic command/schedule layer for ignition energy, dry-ice placement, hose water delivery, excavation timing, and treatment ledgers. You schedule and account for externally commanded inputs only; Agent B owns phase/transport physics, Agent A owns mechanics, and Agent D owns geometry. You cannot edit the repository. Maintain one cumulative downloadable file named `AGENT_E_IMPLEMENTATION.md` with complete proposed code, tests, and future integration instructions. Begin with Task 1 only. After every task, audit all cumulative work, correct it in place, provide the updated file, ask exactly `Reply y to continue.`, and stop.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_E_IMPLEMENTATION.md`

## Baseline and required reading

The baseline has finite ignition/source schedules and separate contact-cooling records, but no single typed command stream spanning every intervention. Read `src/coupled/fireProtocol.ts`, `src/coupled/fireProtocolRunner.ts`, `src/coupled/source.ts`, `src/coupled/engine.ts`, `src/sim/scenario.ts`, `src/sim/types.ts`, `tests/fireProtocol.test.ts`, `tests/fireProtocolRunner.test.ts`, `tests/dryIceIntervention.test.ts`, `tests/contactCooling.test.ts`, `docs/FIRE_PROTOCOL.md`, `docs/CO2_SOURCE_MODEL.md`, and `docs/CONTACT_COOLING.md`.

## Exclusive proposal scope

Only propose new files under `src/physics-next/interventions/**` and `tests/physics-next/interventions/**`: `types.ts`, `schedule.ts`, `ignition.ts`, `dryIcePlacement.ts`, `waterDelivery.ts`, `ledger.ts`, and `index.ts`, with matching tests. Do not edit existing files or propose code in contracts, integrator, geometry, mechanics, transport, verification, materials, numerics, I/O, UI, workers, manifests, or CI. Put shared wiring only in `Integrator-owned change requests`.

All commands use SI units and explicit closed-open time intervals. Inputs into the modeled domain are positive. A schedule may request a finite inventory or rate but may not calculate sublimation, combustion, infiltration, deformation, fracture, cooling efficacy, or treatment success. Applied amounts must be determined by an integrator callback and reconciled against requested amounts without fabricating delivery.

## Sequential tasks — approximately 20 minutes each

1. Document baseline event behavior and propose `types.ts` plus `schedule.ts` with complete tests. Define immutable commands, stable IDs, ordering for equal timestamps, interval semantics, cancellation, validation, and deterministic clipping to a solver step.
2. Propose `ignition.ts` and tests for finite energy/power schedules, exact cutoff splitting, and requested-versus-applied energy accounting. Test zero duration, mid-step cutoff, overlapping invalid sources, restart, and exact cumulative joules. Do not implement reaction chemistry.
3. Propose `dryIcePlacement.ts` and tests for finite mass/internal-energy placement requests, supported location descriptors, capacity rejection callbacks, and rollback-safe receipts. Do not implement Agent B's phase law. Test partial/failed placement, duplicate IDs, inventory exhaustion, and restart determinism.
4. Propose `waterDelivery.ts` and tests for bounded hose flow schedules and finite reservoirs. Separate delivered water, returned/rejected water, and unknown losses. Test rate changes inside steps, shutoff, pressure metadata without hydraulic claims, exact kilograms, and no delivery before placement.
5. Propose `ledger.ts` and tests that reconcile every requested/applied/rejected mass and energy event. Unknown quantities remain unknown, never zero. Test conservation identities, atomic rollback, stable serialization data, and independent recomputation from receipts.
6. Propose `index.ts`, complete exports and manifest. Add ordered integrator instructions for geometry references from D, source-law callbacks from B, physical state commits, UI-independent replay, targeted tests, full repository checks, compatibility, and rollback. Perform a final timing/units/inventory/immutability/collision review.

## Required implementation package

`AGENT_E_IMPLEMENTATION.md` must contain complete file contents and tests, not pseudocode. Include baseline SHA, revision, status, next task, interface tables, time semantics, ledger equations, assumptions, exact integration steps, adapter requests, commands and expected outcomes, edge cases, rollback, and honest verification. The future integrator applies the proposal; you never patch, commit, push, or merge.

After each task double-check event ordering, units, finite inventory, requested/applied separation, rollback, determinism, and noninterference. Correct problems in the same cumulative document. Provide the updated file, summarize checks/blockers, ask `Reply y to continue.`, and stop until the user replies `y`.
