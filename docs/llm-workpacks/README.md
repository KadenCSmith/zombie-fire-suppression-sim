# Read-only physics authoring workpacks

## Immutable source baseline

- Repository: `https://github.com/KadenCSmith/zombie-fire-suppression-sim`
- Branch at preparation: `codex/unified-physics-lab`
- Baseline commit: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Source manifest: [`BASELINE_SOURCE_MANIFEST.sha256`](BASELINE_SOURCE_MANIFEST.sha256)
- Baseline scope: 326 tracked files. Git dependencies, build output, local caches, credentials and untracked artifacts are excluded.
- Reproduce: clone/fetch the repository, checkout the full SHA in detached state, then run `shasum -a 256 -c docs/llm-workpacks/BASELINE_SOURCE_MANIFEST.sha256` from the checkout root.

The baseline includes the tested version-comparison workspace and all physics code through the current 0.16 candidate. It passed typecheck, lint, production build and 199 tests in 33 files. Those are software checks, not experimental validation.

## Prioritized 10-item physics backlog

| Rank | Improvement | Baseline status and evidence | Dependency / acceptance target | Owner |
|---:|---|---|---|---|
| 1 | Unsaturated effective-stress poromechanics with gas and liquid pore-pressure coupling | **Partial.** `src/coupled/engine.ts` couples gas pressure to `PoroMechanics`; `src/coupled/mechanics.ts` uses a fixed Biot coefficient. Suction, liquid pressure and retention are absent. | Requires shared state contract. Accept on effective-stress sign/unit tests, zero-pressure equivalence, and force/work closure. | A |
| 2 | Finite-strain deformation plus excavation, cap, root and soil contact | **Absent.** `src/coupled/mechanics.ts` is small strain and stops above 2% incremental principal strain; `src/coupled/cap.ts` is a reduced Ritz shell. | Builds on item 1. Accept on rigid-motion/objectivity checks, nonpenetration, contact complementarity and energy balance. | A |
| 3 | Calibratable rate-dependent, anisotropic peat/soil constitutive behavior | **Absent / unverified.** Baseline bricks use elastic response plus phase-field damage; material values are assumptions. | Builds on items 1–2. Accept on one-element analytic paths, creep dissipation, parameter bounds and measured-data adapter tests. | A |
| 4 | Mesh-objective mixed-mode fracture with crack closure/contact and resolved aperture | **Approximation.** `src/coupled/mechanics.ts` has scalar tensile phase-field damage. `docs/COUPLED_VALIDATION.md` records a failed ~5.74% mesh-energy gate and default coupled-fracture rejection. | Builds on items 2–3. Accept on irreversibility, mode-mix benchmarks, closure without tensile traction and mesh-energy tolerance. | A |
| 5 | Multistep peat drying, pyrolysis, char oxidation, ash and gas yields | **Absent.** `src/sim/solver.ts` and `src/coupled/model.ts` use one complete oxidative surrogate; `docs/PHYSICS_MODEL.md` identifies missing char, ash, CO and pyrolysis. | Requires species/source contract. Accept on element conservation, nonnegative species and published kinetic-case reproduction within declared tolerance. | B |
| 6 | Liquid-water transport, vapor nonequilibrium, freezing/thawing and ice-heave source terms | **Partial.** `src/coupled/thermodynamics.ts` equilibrates liquid/ice/vapor locally; `CoupledTransport.resolve()` rejects exhausted gas pore space. No liquid flux or ice heave. | Builds on transport contract; exchanges with A only through integrator-owned fields. Accept on closed-column water/energy closure, hydrostatic equilibrium and freeze/thaw cycle tests. | B |
| 7 | Compressible multicomponent gas transport with variable properties, buoyancy and defensible atmospheric boundaries | **Partial.** Four species, ideal-gas storage, Darcy/advection/diffusion and a gas-gravity ledger exist. Viscosity and several transfer coefficients are fixed; open-air film/wind data are uncalibrated. | Builds on items 5–6. Accept on Stefan/Maxwell limiting cases, hydrostatic column, closed-volume conservation and boundary-flux sign tests. | B |
| 8 | Non-equilibrium dry-ice heat/mass transfer with internal gradients and supported phase regime | **Partial.** `src/coupled/source.ts` conserves mass/energy for a one-way spherical Stefan-film source over 150–216.58 K and 1–300 kPa. Deposition, liquid CO₂ and internal gradients are absent. | Builds on item 7. Accept on limiting solutions, exact mass/energy ledgers and guarded unsupported phase states. | B |
| 9 | Adaptive, convergent time/space integration and independent conservation diagnostics | **Partial.** Baseline has step guards, rollback, residual ledgers and selected refinement tests; the 24 h fire case lacks a full time/mesh convergence study. | Observes A/B via frozen adapters; no solver rewrites. Accept on manufactured/analytic solutions, convergence-rate reports, conservation thresholds and deterministic failure records. | C |
| 10 | Experimental validation, uncertainty propagation and holdout acceptance workflow | **Unverified.** Material sources and isolated coupon observations exist, but there is no matched field treatment validation; see `docs/VALIDATION_STATUS.md` and `docs/COUPLED_VALIDATION.md`. | Follows items 3, 5–9. Accept on machine-readable provenance, calibration/holdout separation, parameter distributions, sensitivity reporting and no validation claim without passing evidence. | C |

Feature implementation and validation are separate. A conservation pass does not validate a material law, and the backlog does not treat feature count as physical correctness.

## Ownership and collision rules

- **Agent A:** only proposals for `src/physics-next/mechanics/**` and `tests/physics-next/mechanics/**`.
- **Agent B:** only proposals for `src/physics-next/transport/**` and `tests/physics-next/transport/**`.
- **Agent C:** only proposals for `src/physics-next/verification/**`, `tests/physics-next/verification/**`, and fixture data under `tests/fixtures/physics-next/**`.
- **Agent D:** only proposals for `src/physics-next/geometry/**` and `tests/physics-next/geometry/**`.
- **Agent E:** only proposals for `src/physics-next/interventions/**` and `tests/physics-next/interventions/**`.
- **Agent F:** only proposals for `src/physics-next/materials/**` and `tests/physics-next/materials/**`.
- **Agent G:** only proposals for `src/physics-next/numerics/**` and `tests/physics-next/numerics/**`.
- **Agent H:** only proposals for `src/physics-next/io/**` and `tests/physics-next/io/**`.
- No author may propose direct replacements for `src/coupled/**`, `src/sim/**`, `src/mechanics/**`, UI files, worker files, package manifests, CI, or another author's target paths.
- The later integrator exclusively owns `src/physics-next/contracts.ts`, `src/physics-next/integrator.ts`, exports, workers, UI/schema wiring, existing-file adapters and dependency/package changes. Authors record requested wiring in their implementation document.

Each workpack repeats the same proposed coupling contract, units, indexing, sign conventions and update order. That repetition is intentional: each implementation document must remain usable on its own.

## Future integration order

The later integration agent must read the latest `AGENT_A_IMPLEMENTATION.md` through `AGENT_H_IMPLEMENTATION.md` in full. Confirm that each declares baseline `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`, then compare that baseline with the current repository. Reconcile requested changes to the integrator-owned shared contract before applying code. Preserve newer repository work and never overwrite a newer file with an older complete replacement.

Integrate on a new branch in this order:

1. Create the shared contracts and minimal adapters requested by all eight documents.
2. Integrate F's material registry, D's geometry, and E's intervention commands because A/B consume those through integrator-owned adapters.
3. Integrate A and B behind opt-in feature flags, resolving only contract-level differences in shared wiring.
4. Integrate G's runtime controls around trial/commit boundaries, then H's accepted-state serialization without changing physics results.
5. Integrate C's independent diagnostics and fixtures after A/B compile, then use C's gates to assess them.
6. Run targeted tests, typecheck, lint, the full test suite, production build and applicable UI/worker smoke checks. Record failures without weakening thresholds merely to obtain a pass.
7. Merge only reviewed, actually tested changes. The author documents are proposals, not verified repository changes and not evidence of physical validation.

The eight future authors are not launched by this preparation. Their `y` checkpoints authorize only continued writing of their own external implementation Markdown documents.
