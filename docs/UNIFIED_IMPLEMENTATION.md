# Unified physics lab: implementation record

## Scope and provenance

Started from simulator `80401c4` and the separate `dry-ice-peat-study` repository. The simulator is the canonical application. Original Blender work remains reference illustration; accepted calculation exports provide a separate state-driven Blender path. Existing installed releases and the independently edited Stage2 scene remain untouched.

## Milestone 1: consistent physical input across meshes (reference)

- Adds 2,560 cells (16×16×10), exactly 10× the former preview, and 20,480 cells (32×32×20), exactly 10× the former research mesh. Retains all three old grids for reference.
- Uses one fixed 32×32×20 physical voxel atlas and exact axis-aligned overlap to transfer extensive fuel, mineral, water, gas, pore volume and thermal energy. Specific heat is mass-weighted; coefficient volume averages are documented effective mixtures, not a homogenization theorem.
- A material atlas is an input discretization, not proof of spatial convergence. It cannot resolve features finer than its 0.25×0.25×0.16 m voxels. Finer solve cells do not add new material data.
- Prepared smoldering examples explicitly remove initial water in a fixed dry halo around the hot-region bounding box: 1 m horizontally, 0.8 m vertically. This is an assumed prepared specimen, not a simulated drying process or a measured field moisture profile. It prevents unresolved instantaneous equilibration of 270°C solids with wet neighboring material on coarse meshes. All meshes receive the same prepared inventory. No pressure/phase validity gate is widened. The cold source-only case is the application default. The smoldering option is named a prepared dry specimen and exports its removed initial water mass. Averaging heterogeneous phases may still produce mesh-dependent local temperature/pressure transients; invariant global inventories do not establish solution convergence.
- Turning oxidation off selects a cold source-only case, removing the prepared hot region and dry halo. Heating energy is otherwise fully ledgered.
- Terrain choices change actual initialized materials/root content: organic lens with assumed bonded roots; horizontal peat/mineral layering; a denser, less permeable basal continuum. These are illustrative scenarios, not validated literature specimens or discrete rock mechanics.

## Accuracy claims

Conservation, mechanical residuals and comparison with an independent implementation are numerical verification. They do not establish experimental accuracy. No matched holdout dataset is available. Fracture, resolved excavation, liquid-water infiltration, root pullout and field suppression efficacy remain unresolved. No single overall accuracy percentage is supplied. Uncertainty remains unassessed unless a bounded ensemble is actually calculated.

## Validation protocol

Keep mass and energy totals constant across fidelity presets to 1e-12 relative in initialization tests. Require existing ledger gates and force residual ≤1e-4 N. Compare any optimized operator with the retained reference on identical inputs and tolerances; report setup and solve timings separately. Keep failed experiments visible. Independent review is recorded before accepted source publication.
