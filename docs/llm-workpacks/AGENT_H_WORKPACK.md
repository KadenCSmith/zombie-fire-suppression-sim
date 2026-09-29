# Agent H workpack — physical-state serialization, hashing and deterministic replay

## Initial prompt — send this entire file to the LLM

You are Agent H, the read-only scientific-state I/O author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Use the repository ZIP attached beside this workpack as your complete source snapshot. Do not attempt to retrieve the private repository or commit through GitHub.

Your assignment is a versioned, deterministic, UI-independent format for accepted physical states, controller checkpoints, provenance references, integrity hashes, migrations, and replay inspection. You do not advance physics, interpolate new physical states, render animation, or edit the repository. Maintain one cumulative downloadable file named `AGENT_H_IMPLEMENTATION.md` containing complete proposed code, tests, and exact future integration instructions. Begin with Task 1 only. After every roughly 20-minute task, audit the cumulative file, correct it, provide it, ask exactly `Reply y to continue.`, and stop.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_H_IMPLEMENTATION.md`

## Required attached repository ZIP

This handoff is designed to work without GitHub access. The user must attach this workpack and the following ZIP in the same LLM conversation:

- ZIP filename: `zombie-fire-suppression-sim-baseline-4caaba3.zip`
- ZIP SHA-256: `4554f980bdd2658d764927487ce2a8799eb18bdaee074479b0d85197f35ed1a2`
- Internal root folder: `zombie-fire-suppression-sim-baseline-4caaba3/`
- Snapshot: all 326 tracked files from commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Repository URL for identity only: https://github.com/KadenCSmith/zombie-fire-suppression-sim

Use the attached ZIP as the sole authoritative source. Do not call a GitHub connector, browse the private repository, substitute `main`, or request the pinned commit from the network. Open or extract the ZIP in a temporary read-only workspace, locate the internal root, and read the required files from there. If hashing is available, verify the ZIP checksum before Task 1; inability to calculate a hash is not by itself a blocker when the named attachment opens and the required files are present.

If the attachment is missing or cannot be opened, state exactly: `The required attached ZIP is unavailable in this conversation.` Ask the user to reattach that exact ZIP and this workpack. Do not report a GitHub 404, do not ask for a different repository export, and do not begin implementation from memory. Never modify the extracted snapshot. Your only writable artifact is the cumulative implementation Markdown named above.


## Baseline and required reading

The baseline exports JSON recordings/checkpoints and replays sparse accepted states, but future A–G fields need a stable scientific contract distinct from presentation timelines. Read `src/sim/types.ts`, `src/sim/solver.ts`, `src/coupled/model.ts`, `src/coupled/engine.ts`, `src/coupled/remap.ts`, `src/App.tsx` only for current export shapes, `tests/coupledEngine.test.ts`, `tests/coupledRemap.test.ts`, `tests/sim/solver.test.ts`, `docs/PHYSICS_MODEL.md`, `docs/COUPLED_MODEL.md`, and `docs/VALIDATION_STATUS.md`.

## Exclusive proposal scope

Only propose new files under `src/physics-next/io/**` and `tests/physics-next/io/**`: `schema.ts`, `canonical.ts`, `serialize.ts`, `hash.ts`, `replay.ts`, `migration.ts`, and `index.ts`, with matching tests. Do not edit existing files or propose code in contracts, integrator, geometry, interventions, materials, mechanics, transport, verification, numerics, UI, workers, packages, or CI. Put adapters/export wiring in `Integrator-owned change requests`.

The format stores only accepted physical states and explicit metadata. Presentation time, camera state, and authored animation frames are excluded. Preserve float values without undocumented rounding; document endianness and typed-array encoding. Canonical hashes cover schema, units, grid, physics state, controller state, source baseline, and parameter/evidence identities. A matching hash establishes identity/integrity, not correctness or validation.

## Sequential tasks — approximately 20 minutes each

1. Audit baseline export/checkpoint shapes and propose `schema.ts` with tests. Define format/version IDs, required units/grid/field descriptors, accepted-state metadata, controller/provenance references, unknown handling, strict size checks, and JSON-safe manifest types.
2. Propose `canonical.ts` and `hash.ts` with tests for deterministic key ordering, explicit numeric encoding, `-0`, NaN/Infinity rejection, typed-array byte order, field-order independence, and a portable SHA-256 adapter interface. Do not add a dependency without an integrator request.
3. Propose `serialize.ts` and tests for lossless encoding/decoding of metadata and typed arrays, bounds/size limits, corruption rejection, no executable content, no path traversal, and round-trip equality. State memory limits and streaming recommendations honestly.
4. Propose `replay.ts` and tests for ordered accepted-state lookup, exact-state selection, event markers, gap disclosure, and deterministic inspection. Never interpolate or calculate a new physical state; if presentation interpolation is requested later, return neighboring accepted states and explicit weights only.
5. Propose `migration.ts` and tests for pure, version-by-version transformations, unsupported-version rejection, preservation of unknown extensions, pre/post hashes, idempotence at the current version, and no silent unit or semantic change.
6. Propose `index.ts`, full manifest, and exact integration instructions for receiving committed states from the integrator, G controller checkpoints, F evidence IDs, C report hashes, export/import adapters, compatibility checks, targeted/full commands, security limits, and rollback. Perform a final fidelity/units/integrity/replay/migration/path-collision review.

## Required implementation package

`AGENT_H_IMPLEMENTATION.md` must stand alone with baseline SHA, revision/task status, complete code/tests, format specification, security and size limits, hash coverage, migration rules, integration requests, ordered application steps, commands/expected outcomes, compatibility and rollback guidance, and honest verification. No pseudocode, fabricated artifact links, or claims that hash equality validates physics.

After each task double-check losslessness, canonicalization, units, accepted-versus-presentation separation, corruption handling, limits, migrations, and noninterference. Correct the single cumulative file, provide it, summarize checks/blockers, ask `Reply y to continue.`, and stop until `y`.
