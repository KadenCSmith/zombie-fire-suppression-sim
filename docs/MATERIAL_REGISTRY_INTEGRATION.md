# Agent F material registry integration (2026-09-29)

The 14 proposed TypeScript payloads in the user-supplied `AGENT_F_IMPLEMENTATION.md` were checked against their SHA-256 manifest and added as seven source files under `src/physics-next/materials/` and seven tests under `tests/physics-next/materials/`. No target existed before extraction, and the document in Downloads was not modified.

This package provides explicit quantity kinds and SI conversion, strict material/evidence records, source provenance, immutable registry revisions, distribution metadata, and all-or-nothing scalar projection with an audit sidecar. It contains **no imported measured site-material dataset**. The source files do not connect to the current UI, mechanics, coupled solver or workers, so numerical behavior and installed app binaries are unchanged.

## Actual repository checks

| Check | Result |
| --- | --- |
| New material tests | 228 passed in seven Vitest files |
| Existing material tests | 20 passed in `tests/sim/materials.test.ts` |
| Full repository suite | 513 passed in 47 files |
| TypeScript 7.0.2 typecheck | Passed, including compile-time misuse assertions |
| oxlint | Exit 0; two non-failing style warnings in supplied material files |
| Production Vite build | Passed; existing Lucide directive and bundle-size warnings |

These checks validate code behavior and compatibility with the present 0.16 checkout. They do not verify the accuracy of papers cited elsewhere, calibrate material properties or establish experimental validity.

## Consumer contract required

The handoff's Agent A/B/C consumer bindings are not supplied as code here. Before activating the library, obtain A and B's exported input contracts, quantity kinds, units, material/state applicability, supported guards and ownership of decisions; obtain C's evidence-consumer schema and responsibility for uncertainty/validation. Preserve the old scenario distinction between an absent material extension and `{}`. Import legacy values as model settings or assumptions with source gaps intact, not automatically as measurements. Do not turn numeric software guards into empirical ranges or pressure safety limits.

The independent Stage 2 Blender edit is untouched. The earlier Agent D geometry package remains standalone as described in [its integration review](GEOMETRY_INTEGRATION.md).
