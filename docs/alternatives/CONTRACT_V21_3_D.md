# Additive particle-delivery contract v21.3

This D-only supplement extends the existing v21.2 contract. A/B/C retain the same v21.2 constant, signatures, numerical policy and defaults. No protected original file changes. D acknowledges and merges the exact published seam checkpoint in READY_D before private edits.

Registered identity: `nanoparticles`, method4.2.2, engine`particle`. The human supplied water + fine dry-ice particles carried into peat while still solid, then underground sublimation. Neither nanometer size nor successful delivery/suppression is implied. Concrete scientific inputs, properties, supported capabilities and failure bounds belong to D; missing values are never guessed by coordination.

## Exclusive ownership

D owns `src/alternatives/fine-dry-ice-injection/**`, `tests/alternatives/fine-dry-ice-injection/**`, `docs/alternatives/fine-dry-ice-injection/**`, branch`feature/v21-particle-injection`. The source-free seed in that source folder transfers entirely to D at launch. Coordinator alone edits shared files. Workers create/verify their own checkout and port before edits; local paths are not prerequisites.

## Compiling seams

- `types.ts`: exported `ParticleInjectionSettings` and `ParticleInjectionState`; seed is JSON-safe empty-record capability, carrying no invented physical data. D replaces these with its explicit reviewed SI/kelvin schema.
- `config.ts`: `defaultParticleInjectionSettings()`, `restoreParticleInjectionSettings(raw:unknown)`, `particleObservationWindowS(config:PanelConfig):number`, `particleLinkedCompatibility(configs:readonly PanelConfig[]):string|null`, `PARTICLE_RECORD_UNITS`. Restoration validates a whitelist and never resumes stale accepted states.
- Shared `PanelConfig.particleInjection?` and `AcceptedState.particleInjection?` reference the owned types. Non-D fresh panels retain their prior shape. `freshPanel` supplies D defaults only for4.2.2; structured duplication yields independent nested state.
- `index.ts` exports an `AlternativeModule` with `PARTICLE_API_VERSION='v21.3'`. It is appended at module index4, retaining indices0–3. D registers only supported engine/media capabilities. `createRun` returns the existing `AlternativeRun` shape with independent state, `endS`, monotone `advanceTo` and JSON/structured-clone safe snapshots. The coordinator's seed rejects all execution and invents no results.
- `workspace.tsx` default component receives `{onCompare:()=>void,onDetails:()=>void}`; App routes4.2.2 directly to this private workspace. Reuse original fire spreading and drilling read-only through the established external adapter; never recreate the original.
- `comparison.tsx` exports `ParticleComparison({config,onChange,state?,history})`. Shared comparison owns worker lifecycle/IDs/barrier/pause/reset/duplicate/removal; D owns its inputs and computed display, matched water-only and zero/pre-sublimated counterfactuals. Shared generic thermal contact controls do not represent particle delivery.
- `scene.tsx` exports `MethodCues(MethodSceneProps)`; `science.tsx` exports `MethodScience()`. Coordinator dispatches these without changing protected scenes.
- Worker protocol stays `panelId/runId` scoped. Only accepted snapshots are exported; edits invalidate the prior configuration/result. Jobs are isolated and terminated on navigation/removal. Linked time uses0.5s accepted checkpoints and the owned observation-window/compatibility hooks; unsupported/mixed systems stay unlinked.
- Export preserves complete config and accepted D payloads, D units and engine versionv21.3; experimental validation stays false. D must supply histories, budgets, residuals, assumed inputs/provenance, invalid-regime reasons and unavailable coupled outputs in its payload. Neither a placeholder nor a zero residual validates an absent model.

Seed execution is unavailable until D implements and independently reviews it. Scientific audit, retry counters and authorization remain separate from interface readiness.
