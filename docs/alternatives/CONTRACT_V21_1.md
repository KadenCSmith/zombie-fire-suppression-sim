> SUPERSEDED by prepared API v21.2. This historical record has incorrect original-render mapping and B ownership. Do not launch workers from it; require the replacement verified READY.

# Alternative module API v21.1

This is the frozen interface for the three exclusive method owners. Types are in `src/alternatives/contract.ts`; shared registration is in `modules.ts`, `registry.ts`, `model.ts`, `presentation.ts` and `ui/AlternativeMethodModules.tsx`. Do not edit those shared files from a worker branch. Import them read-only. Request a versioned change from the coordinator when necessary.

## Private entry points

Each assigned subtree exports `methodModule` and `variants` from `index.ts`, `MethodCues({id,time})` from `scene.tsx`, and `MethodScience()` from `science.tsx`. `index.ts` is data/model-only and is imported by workers; it must not import React, Three.js or the scene/science entry points. The separate scene is mounted inside the shared R3F Canvas. Evidence components are included in the existing global formulas view. No module self-registers or changes global routing.

`AlternativeModule` declares API version `v21.1`, method ID, stable variant descriptors, default thermal overrides, `createRun(config,hooks)` and `presentation(id,timeS)`. Keep current IDs and union types. Descriptors carry compatible engines/media, stages, provenance, limitations and illustrative/modeled/experimentallyValidated status. They must retain unsupported physics as unavailable. Shared parameter metadata/ranges remain authoritative; local exports can explain method-specific parameters without independently changing the global schema.

## Actual supported model seam

`hooks.supportedRun(config)` constructs a **new independent** instance of the existing contact calorimeter or conceptual stage clock. FEM is only compatible with the shared untreated baseline. No field injection, multiphase transport, pressure-wave, mechanical or vibration constitutive hook exists. Never invent those hooks or use an arbitrary multiplier to imply the coupling.

Transferred method adapters currently forward their independent serializable configuration to this core. Inspect `alternatives/model.ts` and `story/contactCooling.ts`. The contact core owns finite water/CO₂, prescribed contact and ledgers. Module code may validate or transform *documented* method assumptions through supported config, with regression evidence, but cannot double-count energy/species or silently change scientific scope. Undefined source properties must remain a sentinel. CO₂ is never oxygen. Pressure-only remains concept/none and cannot acquire liquid or physical curves.

`AlternativeRun` has `endS`, `snapshot()` and `advanceTo(targetS)`. Targets are finite, monotonic seconds within the declared window. Snapshot state is independently owned; mutation of a returned snapshot cannot alter the solver. Physical contact uses fixed 0.05 s integration, while the worker schedules 0.5 s output checkpoints; render frames never set the numerical step. Concept time is presentation only with null metrics. Both methods consume deterministic SI configuration; temperature is K. See `PanelConfig`, `AcceptedState`, `Metrics`, `WorkerCommand` and `RunMessage` in `model.ts` for real serializable contracts.

Shared workers own execution: each panel has a stable panel ID plus a fresh run ID. Init constructs a new run; run/pause manipulate scheduling, advance coordinates a physical target, reset terminates/replaces the worker, removal/navigation disposes it. Messages must match panel/run and current worker identity. Duplication copies config only. A private module cannot share mutable state across `createRun` calls, start background timers or own a second worker protocol.

Linked physical time waits for accepted timestamps from compatible engines/windows. Concept stages, unequal windows and mixed engines cannot be linked. Initial/resource matching and disclosure belong to the coordinator. Export units/settings/source/seed/physical timestamps and ledgers are shared. The historical replay system remains separate.

## Presentation and harness

`MethodPresentation` returns `contextTime`, access/pulse/waves/injection booleans, small authored machine vibration and contact-marker count. It is a presentation-only contract: no pressure amplitude, dose, collapse or suppression prediction. The shared renderer holds the environment before the legacy dry-ice/cap/quenching stages. Private scenes can show clearly labeled conceptual operations without changing scientific state. Original rapid rendering remains the default initial app view.

The private standalone preview seam is the ordinary app with `?alternative=<stable-id>&method-preview=1`. It displays the assigned module inside the existing header/renderer, with its own presentation clock. Use only the assigned localhost port and checkout. This route is a method preview, not a predicted field simulation. Open Compare Alternatives to exercise physical supported components. Coordinator preview is port 5173; worker ports are 5174, 5175 and 5176. Dependencies and build outputs are per-checkout. Do not launch processes in another checkout.

## Exclusive ownership

- A: `src/alternatives/sublimation-injection/**`, `tests/alternatives/sublimation-injection/**`, `docs/alternatives/sublimation-injection/**`.
- B: `src/alternatives/pressure-pulse/**`, `tests/alternatives/pressure-pulse/**`, `docs/alternatives/pressure-pulse/**`.
- C: `src/alternatives/vibratory-injection/**`, `tests/alternatives/vibratory-injection/**`, `docs/alternatives/vibratory-injection/**`.

All other tracked paths are coordinator-owned, including package/lock, shared source/worker/solver code, global tests/docs, routing, registry and persistence. Test fixtures and generated evidence belong inside the assigned test/doc subtree. Existing code in each private source subtree is transferred work, not an invitation to create a parallel implementation.

## Check and deliver

Check own branch, exact immutable base SHA and absolute checkout before editing. Use assigned paths and isolated npm dependencies. Run focused tests, typecheck, lint and build; report inherited warnings separately. Add meaningful tests for independent instances, intervention off, finite inventories/ledgers, reproducibility, limits and exact absence of predictive effects from illustrative cues. Cite primary sources for implemented properties/equations, with assumptions/validity; do not call planned experiments performed.

Request shared changes with API version, path, reason, suggested patch, compatibility impact and tests. Pause only affected work. Commit only owned paths, push only the owned branch, open a draft PR into integration, attach it to this chat and freeze the delivered exact SHA. Do not merge or track a moving integration tip without a coordinated checkpoint. The coordinator reviews and merges exact accepted SHAs sequentially.
