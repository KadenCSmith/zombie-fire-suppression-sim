# Agent G runtime-controls integration (2026-09-29)

The user-supplied `AGENT_G_IMPLEMENTATION.md` provided 14 proposed TypeScript files. Their content matched the final SHA-256 manifest before exclusive creation at seven source and seven test paths under `src/physics-next/numerics/` and `tests/physics-next/numerics/`. No target path existed, and the document in Downloads was not modified.

The source package contains typed scaled norms and residual-group decisions, iteration and timestep controllers, owned-state trial transactions, bounded diagnostics and restart metadata. Its imports are internal to the numerics package. **No current solver, worker or UI imports it.** Adding the code does not repair any earlier solver rollback path or alter acceptance, timesteps, physical time or installed binaries.

## Actual 0.16 repository checks

| Check | Result |
| --- | --- |
| New numerics tests | 160 passed in seven Vitest files |
| Complete suite with Agent D and F packages | 673 passed in 54 files |
| TypeScript 7.0.2 typecheck | Passed |
| oxlint | Exit 0; five new non-failing `no-new-array` warnings in supplied numerics files, plus two earlier Agent F warnings |
| Production Vite build | Passed; existing Lucide directive and bundle-size warnings |

These results establish software behavior of standalone controls, not solver convergence or physical validation. The independent Stage 2 Blender edit remains untouched.

## Solver adoption boundary

Before wiring the controllers, obtain the actual A/B equation and iteration contracts, C acceptance gates, E event boundaries and H restart/byte-format contract. The integrator must identify one owner of the physical clock and timestep, record the complete accepted and trial state (including hidden class fields and caches), and specify when cancellation and exceptions restore it. A residual norm, iterate-change test and physical conservation gate must remain distinct. Retain legacy behavior by default until side-by-side regression tests show the intended transition, including rejected trials, restart, end events, worker cancellation and performance.

The package does not serialize bytes, create a full solver checkpoint or infer which state is physically safe to commit. Its local tests cannot certify that a future adapter is complete.
