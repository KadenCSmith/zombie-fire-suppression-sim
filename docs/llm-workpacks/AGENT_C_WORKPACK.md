# Agent C workpack — independent numerical verification and validation

## Objective and immutable baseline

Author a cumulative proposal for backlog items 9–10 against commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`. The only writable deliverable is `AGENT_C_IMPLEMENTATION.md` outside the repository. Do not implement or edit the baseline, and do not rewrite Agent A/B solver modules.

Current behavior is **partial/unverified**: rollback, residual ledgers, mass/energy/species checks, analytic fixtures, selected mesh/time comparisons and material citations exist. The long-duration fire case lacks a full convergence study, the default fracture mesh-energy gate fails, and no matched field-treatment validation passes. Numerical conservation is not experimental validation.

## Exact source to inspect

Read: `src/coupled/engine.ts`, `src/coupled/model.ts`, `src/coupled/mechanics.ts`, `src/coupled/source.ts`, `src/coupled/thermodynamics.ts`, `src/coupled/remap.ts`, `src/sim/solver.ts`, `src/sim/types.ts`, `src/sim/materialEvidence.ts`, all `tests/coupled*.test.ts`, `tests/poromechanics.test.ts`, `tests/sim/*.test.ts`, `tests/mechanics/refinement.test.ts`, `examples/coupledValidation.json`, `examples/mechanicsComparisonBenchmark.json`, `docs/VALIDATION_STATUS.md`, `docs/COUPLED_VALIDATION.md`, `docs/PHYSICS_MODEL.md`, `docs/FIRE_PROTOCOL.md`, and `docs/SOURCES.md`.

## Exclusive proposal paths

Only propose new code for:

- `src/physics-next/verification/conservation.ts`
- `src/physics-next/verification/convergence.ts`
- `src/physics-next/verification/manufactured.ts`
- `src/physics-next/verification/validation.ts`
- `src/physics-next/verification/report.ts`
- `src/physics-next/verification/index.ts`
- `tests/physics-next/verification/conservation.test.ts`
- `tests/physics-next/verification/convergence.test.ts`
- `tests/physics-next/verification/manufactured.test.ts`
- `tests/physics-next/verification/validation.test.ts`
- `tests/physics-next/verification/report.test.ts`
- `tests/fixtures/physics-next/**`

Prohibited: all existing files; `src/physics-next/contracts.ts`; `src/physics-next/integrator.ts`; mechanics/transport source paths; UI, workers, package manifests and CI. C may write adapters that consume results but may not substitute equations or relax A/B thresholds. Put shared runner/report wiring requests in `Integrator-owned change requests`.

Dependencies: baseline outputs and contract-shaped result adapters. Design tests that work with baseline fixtures first and can accept A/B implementations later. A/B proposals are unverified inputs, not trusted ground truth.

## Frozen shared interface contract

**Existing baseline interfaces:** cell index `q=(z*ny+y)*nx+x`; mechanics node index `n=(z*(ny+1)+y)*(nx+1)+x`; `PoroMechanics.u[3*n+c]` in metres; engineering strain order `[xx,yy,zz,xy,yz,xz]`; `CoupledFrame` cell fields are `Float32Array`; solver state is `Float64Array`; SI/Kelvin; `Scenario` depth and grid z increase downward; gas order is `[O2, CO2, background/N2, H2O]`; ledger energies are joules and species residuals moles. `CoupledEngine.step()` advances transport, restores mechanical histories for Picard trials, solves mechanics, updates pore volumes, re-solves pressure, and commits only after convergence.

**Proposed integrator-owned interfaces** (authors import but do not create or alter `src/physics-next/contracts.ts`):

```ts
export interface Grid3D { nx:number; ny:number; nz:number; dxM:number; dyM:number; dzM:number; cellVolumeM3:number }
export interface CoupledPrimaryState {
  timeS:number; grid:Grid3D; temperatureK:Float64Array; gasPressurePa:Float64Array;
  liquidPressurePa:Float64Array; porosity:Float64Array; liquidKg:Float64Array;
  iceKg:Float64Array; gasMol:readonly [Float64Array,Float64Array,Float64Array,Float64Array]
}
export interface MechanicalInternalState { displacementM:Float64Array; effectiveStressPa:Float64Array; plasticState:Float64Array; damage:Float64Array; history:Float64Array }
export interface MechanicalTrialInput { primary:Readonly<CoupledPrimaryState>; previous:Readonly<MechanicalInternalState>; dtS:number; totalTractionPa?:Float64Array }
export interface MechanicalTrialResult {
  next:MechanicalInternalState; volumetricStrain:Float64Array; poreVolumeM3:Float64Array;
  crackApertureM:Float64Array; contactPressurePa:Float64Array;
  elasticEnergyJ:number; dissipatedEnergyJ:number; pressureWorkJ:number; residualN:number
}
export interface ThermochemicalSources { speciesMolDelta:readonly [Float64Array,Float64Array,Float64Array,Float64Array]; liquidKgDelta:Float64Array; iceKgDelta:Float64Array; fuelKgDelta:Float64Array; charKgDelta:Float64Array; ashKgDelta:Float64Array; energyJ:Float64Array }
export interface VerificationSample { name:string; value:number; unit:string; tolerance:number; passed:boolean; evidence:string }
```

Array lengths: every cell field is `nx*ny*nz`; displacement is `3*(nx+1)*(ny+1)*(nz+1)`; effective stress uses six values per cell in `[xx,yy,zz,xy,yz,xz]`; aperture/contact pressure use one value per cell until a face contract is approved. All arrays are owned by the returned state and must not alias inputs.

Coordinates: `+x/+y` along the surface, `+z` downward. Displacement follows those axes. Proposed solid Cauchy stress is tension-positive; pore pressures are positive in compression; the proposed effective-stress convention is `sigmaEffective = sigmaTotal + alpha*porePressure*I`. Heat into the modeled control volume is positive; mass/species source into it is positive; boundary flux outward is positive in ledgers.

Integrator update order: (1) snapshot committed state at `t_n`; (2) B produces a transport/thermochemistry trial over `dt` using frozen `t_n` geometry; (3) A solves mechanics from trial gas/liquid pressure and temperature without mutating inputs; (4) integrator updates pore volume/aperture; (5) transport pressure is re-solved and steps 3–5 iterate with restored histories; (6) integrator evaluates C gates and atomically commits or rolls back. Presentation clocks never enter this order.

## Sequential authoring tasks

Each task is a small reviewable unit, roughly a 10-minute authoring target rather than a runtime promise. After each task update the cumulative implementation document, review it once, provide it, ask exactly `Reply y to continue.` and stop.

1. Record the baseline's actual checks, known failures and evidence provenance. Write `conservation.ts` with dimensioned residual normalization and separate mass/species/energy/work terms. Acceptance: signed synthetic ledgers close exactly, intentional omissions fail, unknown terms remain unknown rather than zero, and tolerances carry units/rationale.
2. Add `conservation.test.ts`, including rollback/immutability fixtures, positivity-correction disclosure and independent recomputation from state arrays. Review Task 1 and correct it in place.
3. Write `convergence.ts` and tests for ordered mesh/time sequences, observed order, Richardson estimates only when asymptotic assumptions hold, and explicit inconclusive outcomes. Acceptance: analytic sequences recover known order, noisy/nonmonotone sequences are not assigned false accuracy, unknown runs remain distinct from failures.
4. Write `manufactured.ts` and tests defining adapters/fixtures for heat conduction, gas diffusion/advection, hydrostatic Darcy balance, one-element mechanics and conservative source updates. Do not rewrite solvers. Acceptance: each fixture declares governing equation, boundary/initial conditions, norm, expected order and unit-bearing tolerance.
5. Write `validation.ts` and fixture schemas for source provenance, calibration/holdout separation, observation units/uncertainty, parameter distributions and acceptance gates. Acceptance: calibration data cannot be reused as holdout, missing uncertainty/provenance blocks a validation claim, and numerical verification never upgrades validation status.
6. Write `report.ts`, `index.ts` and tests producing machine-readable plus Markdown summaries with statuses `pass`, `fail`, `inconclusive`, `unknown`, and `not-run`. Include sensitivity/UQ summaries that do not fabricate distributions. Acceptance: deterministic sorted output, linked evidence, no NaN/Infinity serialization and explicit baseline/solver hash.
7. Add complete fixture manifests, commands, integration adapters, CI/runtime budget guidance, rollback instructions and an ordered validation campaign. Perform a final cumulative independence/units/interfaces/conservation/statistics/regression review. List which tests can run on baseline and which wait for A/B integration.

Minimum proposed commands for the future integrator: targeted Vitest paths, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. State that repository checks are NOT RUN by the author unless there is direct evidence. A validation status may be `pass` only with accessible matched evidence and a passed holdout gate.

## Authoring contract

BEGIN READ-ONLY LLM AUTHORING CONTRACT
You are a code-authoring LLM, NOT a repository-editing agent. You cannot edit any of the user's local files, uploaded source files, or GitHub repository. Do not apply patches, create branches/commits/PRs, push, merge, install project dependencies, or run commands that modify the project. Your only writable deliverable is your own newly created implementation Markdown artifact in this conversation's output workspace, outside the user's repo.

Read the supplied baseline source and your assigned interfaces before writing code. If required contents are inaccessible, request the exact missing files and pause the affected task; never guess existing APIs, imports, paths, or behavior. Do not assume another author has already completed a dependency.

Create AGENT_A_IMPLEMENTATION.md, AGENT_B_IMPLEMENTATION.md, or AGENT_C_IMPLEMENTATION.md, matching your assignment. Maintain this ONE cumulative, self-contained document as you work and update it before EVERY progress response, task boundary, or pause. It is the implementation package for a future integration agent, not merely a plan or work log.

The document must contain:
- Baseline commit/snapshot, document revision, scope, target-file manifest, task status, and next unfinished step.
- Complete proposed code for new files and either complete replacements for small existing files or unambiguous unified patches against the baseline. Label each block with its exact repository-relative path and operation. No pseudocode, omitted required sections, or references to code only present in earlier chat messages.
- Required imports/dependencies, interface contracts, units, governing assumptions, applicability limits, and technical sources for introduced physics models.
- Complete proposed tests, commands, expected outcomes/tolerances, edge cases, and acceptance criteria.
- Ordered integration instructions, shared-file change requests, cross-agent dependencies, compatibility concerns, and rollback guidance.
- Review findings, corrections, unresolved issues, and an honest verification record. Distinguish static review, any actually executed isolated checks, and repository/build/runtime checks NOT RUN. Never claim code was installed, integrated, tested, or validated without evidence.

Author only within your assigned proposal scope. Document shared integration requests separately; do not change the agreed contract or another author's code. Keep one authoritative current code/patch set: incorporate corrections and remove superseded conflicting instructions rather than accumulating patch-on-patch chains. Preserve completed work; the latest document must stand alone without the conversation history.

For each task: inspect only needed source, author the implementation and tests, then review the new code and affected earlier sections once for logic, units, interfaces, conservation/stability where applicable, and regression risks. Correct findings in the same Markdown. Include a final cumulative consistency review when your assigned tasks are complete.

After EACH task, provide the updated downloadable Markdown artifact, a brief change/verification/blocker summary, and ask: "Reply y to continue." STOP until the user replies y. On y, resume from the saved next task; do not restart. These approvals authorize continued document authorship only, never repository writes.

If file attachments are unavailable, return the complete current Markdown in a clearly labeled block and state that no downloadable file was created. Never fabricate an artifact link.
END READ-ONLY LLM AUTHORING CONTRACT
