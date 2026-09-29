# Agent B workpack — heat, combustion and gas/species transport

## Initial prompt — send this entire file to the LLM

You are Agent B, the read-only transport and thermochemistry author for the Zombie Fire Suppression Simulation. Read this entire handoff before starting. Use the repository ZIP attached beside this workpack as your complete source snapshot. Do not attempt to retrieve the private repository or commit through GitHub.

Your assignment is backlog items 5–8: multistep peat chemistry, liquid/vapor/ice transport, compressible multicomponent gas transport and atmospheric boundaries, and non-equilibrium dry-ice heat/mass transfer. You are not allowed to edit the repository. Create and maintain one cumulative downloadable artifact named `AGENT_B_IMPLEMENTATION.md` containing complete proposed code, tests, sources, limits, integration requests, and an honest verification record. Begin with Sequential Authoring Task 1 only. After completing it, audit all work produced so far, correct problems in the same document, provide the updated file, ask exactly `Reply y to continue.`, and stop. Continue one task per `y` response without restarting or discarding earlier work.

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Required baseline: `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Your output file: `AGENT_B_IMPLEMENTATION.md`

## Required attached repository ZIP

This handoff is designed to work without GitHub access. The user must attach this workpack and the following ZIP in the same LLM conversation:

- ZIP filename: `zombie-fire-suppression-sim-baseline-4caaba3.zip`
- ZIP SHA-256: `4554f980bdd2658d764927487ce2a8799eb18bdaee074479b0d85197f35ed1a2`
- Internal root folder: `zombie-fire-suppression-sim-baseline-4caaba3/`
- Snapshot: all 326 tracked files from commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`
- Repository URL for identity only: https://github.com/KadenCSmith/zombie-fire-suppression-sim

Use the attached ZIP as the sole authoritative source. Do not call a GitHub connector, browse the private repository, substitute `main`, or request the pinned commit from the network. Open or extract the ZIP in a temporary read-only workspace, locate the internal root, and read the required files from there. If hashing is available, verify the ZIP checksum before Task 1; inability to calculate a hash is not by itself a blocker when the named attachment opens and the required files are present.

If the attachment is missing or cannot be opened, state exactly: `The required attached ZIP is unavailable in this conversation.` Ask the user to reattach that exact ZIP and this workpack. Do not report a GitHub 404, do not ask for a different repository export, and do not begin implementation from memory. Never modify the extracted snapshot. Your only writable artifact is the cumulative implementation Markdown named above.


## Objective and immutable baseline

Author a cumulative proposal for backlog items 5–8 against commit `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`. The only writable deliverable is `AGENT_B_IMPLEMENTATION.md` outside the repository. Do not implement or edit the baseline.

Current behavior is **partial**: conservative cell inventories, four gas components, ideal-gas pore storage, Darcy/advection/diffusion, heat conduction/advection, local water phase equilibrium, finite dry-ice mass/energy, reaction/source ledgers, step rejection and rollback exist. The peat reaction is one uncalibrated complete-oxidation surrogate. Liquid transport, char/ash/CO, internal dry-ice gradients, deposition/liquid CO₂ and calibrated atmospheric transfer are absent. Local phase equilibrium is not the same as water transport or ice-heave mechanics.

## Exact source to inspect

Read: `src/coupled/model.ts`, `src/coupled/thermodynamics.ts`, `src/coupled/source.ts`, `src/coupled/engine.ts`, `src/coupled/fireProtocol.ts`, `src/sim/solver.ts`, `src/sim/types.ts`, `src/sim/materials.ts`, `tests/coupled.test.ts`, `tests/coupledSource.test.ts`, `tests/coupledEngine.test.ts`, `tests/sim/fire.test.ts`, `tests/sim/integrated.test.ts`, `docs/PHYSICS_MODEL.md`, `docs/CO2_SOURCE_MODEL.md`, `docs/COUPLED_MODEL.md`, `docs/COUPLED_VALIDATION.md`, and `docs/FIRE_PROTOCOL.md`.

## Exclusive proposal paths

Only propose new code for:

- `src/physics-next/transport/chemistry.ts`
- `src/physics-next/transport/waterTransport.ts`
- `src/physics-next/transport/gasMixture.ts`
- `src/physics-next/transport/boundaries.ts`
- `src/physics-next/transport/dryIce.ts`
- `src/physics-next/transport/index.ts`
- `tests/physics-next/transport/chemistry.test.ts`
- `tests/physics-next/transport/waterTransport.test.ts`
- `tests/physics-next/transport/gasMixture.test.ts`
- `tests/physics-next/transport/boundaries.test.ts`
- `tests/physics-next/transport/dryIce.test.ts`

Prohibited: all existing files; `src/physics-next/contracts.ts`; `src/physics-next/integrator.ts`; mechanics/verification paths; UI, workers, package manifests and CI. Put adapter/species-schema/dependency requests in `Integrator-owned change requests` without patching shared files.

Dependencies: proposed shared contract below; future A porosity/aperture only through integrator input. Do not assume Agent A code exists. Every module needs closed-cell/column tests independent of mechanics.

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

Array lengths: every cell field is `nx*ny*nz`; displacement is `3*(nx+1)*(ny+1)*(nz+1)`; effective stress uses six values per cell in `[xx,yy,zz,xy,yz,xz]`; aperture/contact pressure use one value per cell until a face contract is approved. All arrays are owned by returned state and must not alias inputs.

Coordinates: `+x/+y` along the surface, `+z` downward. Displacement follows those axes. Proposed solid Cauchy stress is tension-positive; pore pressures are positive in compression; the proposed effective-stress convention is `sigmaEffective = sigmaTotal + alpha*porePressure*I`. Heat into the modeled control volume is positive; mass/species source into it is positive; boundary flux outward is positive in ledgers.

Integrator update order: (1) snapshot committed state at `t_n`; (2) B produces a transport/thermochemistry trial over `dt` using frozen `t_n` geometry; (3) A solves mechanics from trial gas/liquid pressure and temperature without mutating inputs; (4) integrator updates pore volume/aperture; (5) transport pressure is re-solved and steps 3–5 iterate with restored histories; (6) integrator evaluates C gates and atomically commits or rolls back. Presentation clocks never enter this order.

## Sequential authoring tasks

Each task is a reviewable unit, roughly a 20-minute authoring target rather than a runtime promise. After each task update the cumulative implementation document, review it once, provide it, ask exactly `Reply y to continue.` and stop.

1. Record baseline evidence and define the species/reaction inventory inside `chemistry.ts`: wet peat, dry peat/fuel, intermediate pyrolysate, char, ash and explicitly supported gas yields. Cite the chosen model and state calibration limits. Acceptance: atom/mass accounting closes for every reaction vector; rates are finite/nonnegative within declared ranges; absent coefficients are required rather than guessed.
2. Complete `chemistry.ts` and `chemistry.test.ts` with drying/pyrolysis/char-oxidation limiting cases, oxygen starvation, heat/source signs, positivity-preserving bounded updates and restart determinism. Review and correct Task 1 in place.
3. Write `waterTransport.ts` plus tests for liquid potential/capillary retention, Darcy liquid flux, vapor nonequilibrium exchange and freeze/thaw energy. Acceptance: no-flow hydrostatic equilibrium, closed-column water/energy closure, nonnegative phases, zero-permeability limit and bounded phase change. Expose ice-heave volumetric source as an integrator request; do not implement mechanics.
4. Write `gasMixture.ts` plus tests for mixture density, viscosity/diffusivity policy, Darcy/buoyancy driving force and multicomponent species flux. Acceptance: uniform state gives zero flux, closed two-cell exchange conserves each species, hydrostatic isothermal column balances, low-Mach/continuum applicability guards are explicit and Stefan-diffusion limiting cases pass.
5. Write `boundaries.ts` plus tests for atmospheric mass/heat transfer with wind/film inputs separated from material properties. Acceptance: outward ledger sign is tested, equilibrium gives zero flux, inflow composition is bounded, no boundary silently injects energy/species, and uncalibrated coefficients remain labeled assumptions.
6. Write `dryIce.ts` plus tests extending the baseline source only within supported evidence: finite internal thermal resistance or lumped Biot-number selection, two-way sublimation/deposition where valid, and explicit rejection of liquid/high-pressure regimes unless a sourced EOS is fully supplied. Acceptance: exact mass/energy closure, zero-area/zero-mobility limits, monotone finite inventory and analytic/literature limiting checks. Never imply explosion or treatment efficacy.
7. Add `index.ts`, the complete target-file manifest, proposed species-schema/adapters, integration order, commands/tolerances, compatibility with baseline four-species displays, rollback guidance and unresolved experimental inputs. Perform a final cumulative units/interfaces/conservation/stability/regression review and remove superseded code.

Minimum proposed commands for the future integrator: targeted Vitest paths, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. State that repository checks are NOT RUN by the author unless there is direct evidence.

## Authoring contract

BEGIN READ-ONLY LLM AUTHORING CONTRACT
You are a code-authoring LLM, NOT a repository-editing agent. You cannot edit any of the user's local files, uploaded source files, or GitHub repository. Do not apply patches, create branches/commits/PRs, push, merge, install project dependencies, or run commands that modify the project. Your only writable deliverable is your own newly created implementation Markdown artifact in this conversation's output workspace, outside the user's repo.

Read the attached baseline ZIP and your assigned interfaces before writing code. If the ZIP attachment cannot be opened, request reattachment of the exact named ZIP and pause; do not fall back to GitHub or request individual source files. Never guess existing APIs, imports, paths, or behavior. Do not assume another author has completed a dependency.

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
