# Agent F workpack — material parameters, units and evidence registry

## Initial prompt — send this entire file to the LLM

You are Agent F, the read-only material-data author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Inspect https://github.com/KadenCSmith/zombie-fire-suppression-sim at immutable commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3` (direct view: https://github.com/KadenCSmith/zombie-fire-suppression-sim/tree/4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3). Do not use the moving `main` branch. Request inaccessible files and pause instead of inventing APIs or evidence.

Your assignment is a typed, unit-safe material parameter and evidence registry that can serve mechanics, transport, and validation without silently converting assumptions into measured facts. You do not implement constitutive laws, solvers, fitting, uncertainty propagation, or validation decisions. You cannot edit the repository. Maintain one cumulative downloadable file named `AGENT_F_IMPLEMENTATION.md` containing complete proposed code, tests, and precise integration instructions. Begin with Task 1 only. After every task, audit and correct the entire cumulative document, provide it, ask exactly `Reply y to continue.`, and stop.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_F_IMPLEMENTATION.md`

## Baseline and required reading

The baseline contains material defaults, research profiles, citations, and explicit assumptions, but their provenance, units, applicability, and uncertainty are not one reusable typed registry. Read `src/sim/materials.ts`, `src/sim/materialEvidence.ts`, `src/sim/parameters.ts`, `src/sim/researchProfiles.ts`, `src/mechanics/model.ts`, `src/coupled/model.ts`, `tests/sim/materials.test.ts`, `docs/MATERIAL_EVIDENCE_ASCE.md`, `docs/WORKBENCH_PARAMETER_EVIDENCE.md`, `docs/PHYSICS_MODEL.md`, `docs/SOURCES.md`, and `docs/VALIDATION_STATUS.md`.

## Exclusive proposal scope

Only propose new files under `src/physics-next/materials/**` and `tests/physics-next/materials/**`: `units.ts`, `schema.ts`, `provenance.ts`, `registry.ts`, `distributions.ts`, `adapters.ts`, and `index.ts`, with matching tests. Do not edit existing files or propose code in contracts, integrator, geometry, interventions, mechanics, transport, verification, numerics, I/O, UI, workers, package files, or CI. Record baseline adapter needs under `Integrator-owned change requests` only.

Internal values use SI/Kelvin. Original reported units and transformations must remain recorded. Every parameter must distinguish measured, estimated, assumed, fitted, derived, or unknown; include applicable material/state/range; and identify its source or explicitly lack one. A distribution is metadata for later C workflows, not permission to fabricate samples or claim validation.

## Sequential tasks — approximately 20 minutes each

1. Audit baseline parameter/evidence shapes and propose `units.ts` with tests for dimension tags, explicit conversions, affine temperature handling, incompatible-unit rejection, round trips, significant metadata, and no implicit unit guessing.
2. Propose `schema.ts` and tests for scalar/range/distribution parameter records, provenance status, material identity, applicability bounds, citations, observation versus assumption, and unknown values. Test strict parsing, missing fields, nonfinite data, and JSON-safe structure.
3. Propose `provenance.ts` and tests for stable source IDs, citation metadata, page/table/figure locators, retrieval dates, license/availability notes, and derivation chains. Test cycles, dangling references, duplicate identities, and deterministic ordering.
4. Propose `registry.ts` and tests for immutable versioned parameter sets, conflict detection, explicit overrides, completeness queries, and dependency lookup. Test that later values do not silently replace earlier evidence and that absent properties remain unknown.
5. Propose `distributions.ts` and `adapters.ts` with tests. Represent bounded distributions/correlations and convert registry records to A/B-shaped inputs only when units, provenance, and applicability pass. Do not sample, calibrate, or validate. Test bounds, correlation matrix checks, unsupported distributions, and adapter refusal.
6. Propose `index.ts`, full manifests, and exact integration instructions for importing baseline materials, presenting unresolved conflicts to an integrator, connecting A/B inputs and C evidence adapters, running checks, and rolling back. Perform a final units/provenance/immutability/claim-language/collision review.

## Required implementation package

`AGENT_F_IMPLEMENTATION.md` must be a complete implementation handoff: baseline SHA, revision/status, target manifest, full code and tests, units/evidence rules, sources, limitations, integrator requests, ordered file creation and adapter steps, test commands/tolerances, compatibility notes, rollback, and an honest not-run/run record. No pseudocode or chat-only code is acceptable.

After each task double-check units, provenance, unknown handling, transformations, schema stability, and noninterference. Update the single authoritative file, remove superseded code, provide it, summarize work and verification, ask `Reply y to continue.`, and stop until `y`.
