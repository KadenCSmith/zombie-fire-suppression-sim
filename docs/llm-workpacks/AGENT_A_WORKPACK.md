# Agent A workpack — mechanics, deformation and pressure response

## Initial prompt — send this entire file to the LLM

You are Agent A, the read-only mechanics author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Inspect the repository at https://github.com/KadenCSmith/zombie-fire-suppression-sim and use the exact immutable baseline commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3` (direct commit view: https://github.com/KadenCSmith/zombie-fire-suppression-sim/tree/4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3). Do not work from the moving `main` branch. If the repository or any required file is inaccessible, tell me exactly what you need and stop rather than guessing.

Your assignment is backlog items 1–4: effective-stress poromechanics, finite-strain/contact mechanics, calibratable rate-dependent anisotropic peat behavior, and mesh-objective mixed-mode fracture with closure. You are not allowed to edit the repository. Create and maintain one cumulative downloadable artifact named `AGENT_A_IMPLEMENTATION.md` containing complete proposed code, tests, sources, limits, integration requests, and an honest verification record. Begin with Sequential Authoring Task 1 only. After completing it, audit all work produced so far, correct problems in the same document, provide the updated file, ask exactly `Reply y to continue.`, and stop. Continue one task per `y` response without restarting or discarding earlier work.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_A_IMPLEMENTATION.md`

## Objective and immutable baseline

Author a cumulative proposal for backlog items 1–4 against commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`. The only writable deliverable is `AGENT_A_IMPLEMENTATION.md` outside the repository. Do not implement or edit the baseline.

Current behavior is **partial/approximate**: `CoupledEngine` Picard-couples cell gas pressure to small-strain brick FEM and pore volume; gravity preload, embedded axial root trusses, a reduced cap shell, scalar phase-field damage, rollback and energy checks exist. Liquid-pressure effective stress, finite strain, general contact, calibrated time-dependent peat behavior, crack closure and resolved apertures are absent or unverified. The baseline rejects >2% incremental principal strain and records a failed fracture mesh-energy gate.

## Exact source to inspect

Read: `src/coupled/engine.ts`, `src/coupled/mechanics.ts`, `src/coupled/cap.ts`, `src/coupled/model.ts`, `src/coupled/linear.ts`, `src/coupled/sparse.ts`, `src/mechanics/continuum.ts`, `src/mechanics/tensileFracture.ts`, `src/sim/materials.ts`, `src/sim/types.ts`, `tests/coupled.test.ts`, `tests/coupledEngine.test.ts`, `tests/cap.test.ts`, `tests/poromechanics.test.ts`, `tests/mechanics/continuum.test.ts`, `docs/COUPLED_MODEL.md`, `docs/COUPLED_VALIDATION.md`, and `docs/PHYSICS_MODEL.md`.

## Exclusive proposal paths

Only propose new code for:

- `src/physics-next/mechanics/effectiveStress.ts`
- `src/physics-next/mechanics/finiteStrain.ts`
- `src/physics-next/mechanics/constitutive.ts`
- `src/physics-next/mechanics/contact.ts`
- `src/physics-next/mechanics/fractureContact.ts`
- `src/physics-next/mechanics/index.ts`
- `tests/physics-next/mechanics/effectiveStress.test.ts`
- `tests/physics-next/mechanics/finiteStrain.test.ts`
- `tests/physics-next/mechanics/constitutive.test.ts`
- `tests/physics-next/mechanics/contact.test.ts`
- `tests/physics-next/mechanics/fractureContact.test.ts`

Prohibited: all existing files; `src/physics-next/contracts.ts`; `src/physics-next/integrator.ts`; transport/verification paths; UI, workers, package manifests and CI. Put unavoidable adapter/schema requests in a section named `Integrator-owned change requests` without patching those files.

Dependencies: the proposed shared contract below, baseline linear algebra patterns, and later B outputs for liquid pressure/temperature. Do not assume Agent B code exists. Provide mechanical unit tests using local fixtures and contract-shaped arrays.

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

Coordinates: `+x/+y` along the surface, `+z` downward. Displacement follows those axes. Proposed solid Cauchy stress is tension-positive; pore pressures are positive in compression; the proposed effective-stress convention is `sigmaEffective = sigmaTotal + alpha*porePressure*I`. State this convention in every public function. Heat into the modeled control volume is positive; mass/species source into it is positive; boundary flux outward is positive in ledgers.

Integrator update order: (1) snapshot committed state at `t_n`; (2) B produces a transport/thermochemistry trial over `dt` using frozen `t_n` geometry; (3) A solves mechanics from trial gas/liquid pressure and temperature without mutating inputs; (4) integrator updates pore volume/aperture; (5) transport pressure is re-solved and steps 3–5 iterate with restored histories; (6) integrator evaluates C gates and atomically commits or rolls back. Presentation clocks never enter this order.

## Sequential authoring tasks

Each task is sized as a small reviewable unit, roughly a 10-minute authoring target rather than a runtime promise. After each task update the cumulative implementation document, review it once, provide it, ask exactly `Reply y to continue.` and stop.

1. Record baseline evidence and write the complete `effectiveStress.ts` proposal. Cover gas/liquid pore pressure, Biot coefficient bounds, saturation weighting, tension-positive sign conversion and work-conjugate volumetric strain. Acceptance: zero pressure recovers total stress; equal gas/liquid pressure is saturation-independent; all dimensions and signs are tested.
2. Add `effectiveStress.test.ts` with analytic one-cell cases, invalid lengths/nonfinite inputs, zero/fully saturated limits and pressure-work sign checks. Review Task 1 code and correct it in place.
3. Write `finiteStrain.ts` using a clearly sourced total-Lagrangian or updated-Lagrangian formulation, deformation gradient, objective stress update and rigid-motion invariance. Keep assembly self-contained; do not replace baseline FEM. Acceptance: identity/rigid rotation produce zero strain energy, homogeneous extension matches an analytic result, determinant guards prevent inversion.
4. Write `contact.ts` and tests for soil/cap/root/excavation interfaces. Define gap sign, penalty or augmented-Lagrangian law, friction limit and state ownership. Acceptance: nonpenetration tolerance, zero tensile contact, action/reaction equality and nonnegative frictional dissipation.
5. Write `constitutive.ts` and tests for a bounded, rate-dependent anisotropic peat law with explicit parameter provenance slots. Acceptance: elastic limit, creep/relaxation limiting cases, nonnegative dissipation, frame consistency, restart determinism and rejected unphysical parameters. Do not claim calibration.
6. Write `fractureContact.ts` and tests for mixed-mode irreversibility, closure/contact and aperture derivation. Acceptance: damage never heals, compression closes without tensile traction, pure mode-I/mode-II limits are finite, dissipated fracture energy is nonnegative, and two mesh sizes meet a declared energy tolerance or are honestly reported failing.
7. Add `index.ts`, the target-file manifest, required integrator adapters, ordered integration steps, commands, expected tolerances, rollback plan and unresolved calibration/data needs. Perform a final cumulative units/interfaces/conservation/stability/regression review and remove superseded code.

Minimum proposed commands for the future integrator: targeted Vitest paths, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. State that repository checks are NOT RUN by the author unless there is direct evidence.

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
