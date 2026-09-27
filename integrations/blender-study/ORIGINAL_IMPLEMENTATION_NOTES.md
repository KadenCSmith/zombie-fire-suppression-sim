# Implementation notes

## Snapshot

This release publishes the latest existing saved Blender file from September 25, 2026. It includes refinement stage 07. The publication step does not rebuild or alter the scene.

The user requested peat almost entirely below ground, with a partly burned 0.2 m root connecting to the tree. The 0.2 m value was implemented as a nominal **diameter**; the root tapers at its ends. The root joins the trunk, which continues into the tree crown.

## Geometry and organization

| Element | Implementation |
| --- | --- |
| Soil | Approximately 8 × 8 × 3.2 m; irregular stratified mesh layers, procedural color and bump, stones, organic litter, and fibers |
| Borehole | Editable Boolean cutter, 0.75 m diameter; floor at −2.44 m relative to nominal ground at z = 0 |
| Dry ice | 0.50 m diameter, frosty procedural surface; centered at x = −1.4 m, y = 0 |
| Sphere at rest | Center at z = −2.19 m, so its bottom meets the borehole floor |
| Peat | Buried dark organic mass with separate near and far ember regions; restrained flames and smoke |
| Root and tree | Native editable geometry; nominal 0.20 m root, patchy charring, continuous root/trunk junction, living and scorched foliage |
| Cutaway | Rear half of soil shown with a vertical planar section; front soil is retained for the top view |
| Cameras | `CAM_SECTION` and `CAM_TOP` |
| View layers | `SECTION` and `TOP`, with separate annotation visibility |

Collections include soil, peat, borehole, dry ice, CO2, fire, shockwave, lighting, annotations, surface details, and tree/root geometry. The scene uses metric units and Cycles with AgX color management.

## Animation

The sphere follows a keyed ballistic trajectory using gravitational acceleration of 9.81 m/s². Its vertical position is keyed over the drop; horizontal position remains fixed. This is an authored trajectory, without a rigid-body bounce simulation.

Gas movement uses animated volume materials and editable geometry: expansion near the sphere, upward transport through the borehole, ground-hugging surface spread, and visible lateral transport through the soil section. Density and object size change over time.

The pressure front is a brief expanding ring representing a cut-plane intersection of a conceptual spherical shell. Shader masks constrain it to the soil section, and opacity fades shortly after release. Dust volumes and small soil fragments provide local disturbance.

Near-peat ember emission, localized flames, and smoke diminish on a prescribed schedule. Farther peat retains its glow. Suppression is not calculated from a simulated CO2 concentration.

## Latest saved refinements

Stage 07 brought the root and tree to the cut plane to expose their continuous connection. It added curved foliage and bark detail, hid distracting root flares, adjusted smoke, corrected labels, moved stray annotations into the section layer, and adjusted the pressure-front mask.

These edits are present in the uploaded `.blend`. The available attempt-02 PNGs predate these final refinements.

## Source script status

The scripts in `source/` are a record of the construction session. They share variables and helper functions in a persistent Blender Python namespace. Several contain original absolute workspace paths. They are not a tested standalone build system.

- Applied during construction: `01_terrain.py`, `02_peat_and_sphere.py`, `03_gas_and_pulse.py`, `05_realism_refinement.py`, `06_buried_peat_tree.py`, and `07_final_refinement.py`.
- Used for the earlier rendering passes: `04_render_review.py`. Its current default is attempt **3**; that third pass has not been run.
- Prepared but **not executed**: `08_pack_texture_assets.py` and `validate_and_package.py`.

Do not rerun the construction scripts on the finished scene casually. Stage 01 clears scene objects, and later stages are not idempotent: repeated execution can duplicate details or move existing geometry again. Stage 07 was partially resumed after a naming error during the original session; the current saved scene already contains its completed effects. Open the `.blend` to continue editing.

The optional texture stage would apply and pack Poly Haven bark and forest-ground maps. The proposed validation/package script would record dimensions and sampled animation values, embed script text blocks, and add a separate ready-to-render top-view scene. Those proposed changes are not part of this release. This release does not claim those automated checks passed.

## Review and remaining work

Two complete four-image rendering passes were made. Independent overall scores were 5.5/10 and 6.5/10. Attempt 2 identified root continuity, tree foliage, the pressure graphic, and annotation placement as remaining weaknesses. Stage 07 addressed them, but a fresh render is needed to judge the result.

If visual development continues, use the one remaining third rendering/review attempt for frames 66, 96, 240, and 126 with their corresponding cameras. The original instruction caps the process at three total attempts. The saved file is uploaded now as requested, with this remaining review status recorded explicitly.

## Physical limitations

Gas is shown with a white visibility proxy. The rapid release is a conceptual event. No validated thermal model, phase-change rate, gas mass balance, soil permeability model, pressure prediction, CFD, or combustion model is included. This project supports visual explanation and further scene development.
