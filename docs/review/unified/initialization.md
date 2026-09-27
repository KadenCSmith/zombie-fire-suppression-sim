# Independent numerical integration review: initialization

Reviewer: `physics_audit`, a separate agent from the initialization implementer. Review completed 27 September 2026. Formal review count: **3 of 3; frozen**. This covers fixed-atlas initialization, conservative remapping, terrain scenario selection, and added mesh presets. It does not cover the forthcoming finite-rate CO₂ source, optimized mechanics, or final rendering integration.

## Disposition and scores

**Accepted for a limited numerical reference milestone.** The reviewed implementation preserves initial extensive quantities and the finite source's physical partition across supported grids. It does not establish spatial convergence or physical validation of the application. No remaining blocking defect was found within this scope after round 3.

- Physical accuracy: **5/10**, an engineering judgment for the idealized initialization scope, not a percentage or validation score. Conservative inventories and source geometry improve numerical consistency; material averaging, prepared heating, and unmeasured terrain parameters remain significant approximations.
- Visual realism: **pending**. No relevant accepted-state render was inspected for this integration. A numeric visual score must come from subsequent integrated render review, not a fabricated score in this record.
- Confidence: high in overlap conservation and the reproduced numerical tests; low in predictive field accuracy because no matched independent experiment is available.

## Review rounds

1. Exact cell-overlap transfer passed inspection and six targeted remap/engine tests passed independently. The initially added dry halo was flagged as an artificial preparation assumption, not a demonstrated physical drying process. The implementer made the lab default a cold source-only case, labeled the optional prepared smoldering specimen, and exposed removed initial water in snapshots/exports. The documentation now distinguishes preserved totals from local solution convergence.
2. Found a concrete source-geometry defect: the gas inventory was projected from the canonical source partition, but solid volume was subtracted using newly computed target-grid weights. The cold 2,560-cell initial pressure ranged 100,939–101,567 Pa while the canonical mesh remained at 101,325 Pa. This blocked a consistent-source claim. The implementer remapped the canonical source partition with the same extensive overlap operator and added a per-cell regression check.
3. Independently reran the revised tests and evaluated every preset. Seven tests in `coupledRemap.test.ts` and `coupledEngine.test.ts` passed. Cold 2,560-cell initial pressure is now 101,311–101,339 Pa; the remaining variation is from finite-volume material/thermal mixing, not relocation of source solid volume. The original source partition defect is repaired. This record freezes the three-round review.

## Objective gates

| Gate | Result | Limit |
|---|---|---|
| Initial mass, fuel, total water, total energy across all five fidelities | Passed, relative tolerance 1e-12 | Does not assert equal pointwise pressure or temperature |
| Non-nested overlap conservation and uniform density | Passed | Axis-aligned same-domain grids only |
| Canonical source partition projected per target cell | Passed | Source remains a fixed unresolved kernel |
| 2,560 and 20,480 cell counts | Passed, exactly 10× former preview/research | Element count is not an accuracy multiplier |
| Engine conservation, force residual, failure rollback | Existing two tests passed independently | Their supplied small cases only |
| Spatial/timestep convergence of complete heterogeneous scenario | Not established here | Required before mesh-independent predictive claims |
| Experimental terrain/source validation | Unavailable | No field predictive claim accepted |
| Visual review | Pending | Needs accepted-state render |

Command: `npx vitest run tests/coupledRemap.test.ts tests/coupledEngine.test.ts`, independently run at 02:48:46 on the host clock; 7/7 passed in 3.41 s. A transient full-project typecheck earlier in review failed because concurrent UI edits had not yet added `createCameraLink` and scene props. That is not recorded as a numerical pass; the final integrated build must be checked separately.

## Reproduced initial-state limitations

The cold source-only case removes **zero** initial water. The optional prepared smoldering case removes **9,136.3455849 kg** before the ledger baseline; this is a declared assumed specimen preparation, not simulated evaporation. Its coarser cells mix hot/cold solid energy and may start with pressure above atmosphere: maximum values were 107,084 / 112,320 / 112,504 / 111,929 / 101,325 Pa for preview / engineering / research / 2,560 / 20,480 cells. The 256-cell peak temperature was 503.91 K, compared with 543.15 K on the fine atlas. These are substantial projection differences and preclude interpreting equal global inventories as converged ignition or pressure fields.

The cold case had maximum deviations from atmospheric pressure of about 34.85 / 22.64 / 18.60 / 14.03 / less than 3e-9 Pa in the same order. Finite-volume equilibration after averaging conserved state does not preserve every intensive field.

The 32×32×20 atlas is an assumed voxelized geometry with fixed material data, not an analytic continuum ground truth. Arithmetic coefficient averaging and interpolated elastic properties are uncalibrated effective mixtures. Rocky terrain is a denser basal continuum, not resolved rocks or contact. Root reinforcement is eight bonded assumed trusses, not measured root/soil mechanics. These limitations remain visible in the implementation notes.

## Reviewed source hashes (SHA-256)

```
b53f9d7fb91b36d168fd93c863fa0afd0cfc08cdb018f10020b68561648f6aa0  src/coupled/model.ts
ad712543634b7e96d3f4f89966273041d6b23a6b2edb1bc3fedc533d657bbb48  src/coupled/engine.ts
315d6ed3cfbcae55da7e39649c178dc5e2007d28362c6614517859d88543d045  src/coupled/remap.ts
3b2d6b711d27778fd8ddebe1a73bbbfd2c424295c1c5bba2f5516dd895aa12ff  tests/coupledRemap.test.ts
```

Later source/optimization integration may change these files; that requires its own scoped review and must not be represented by these hashes.
