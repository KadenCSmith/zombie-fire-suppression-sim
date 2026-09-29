# Dry Ice / Subsurface Peat

An editable Blender scene illustrating a 0.50 m dry-ice sphere dropping into a 2.44 m borehole beside buried, smoldering peat. The latest saved version includes a partly charred root, nominally 0.20 m in diameter, connecting the buried peat area to an above-ground tree.

## Download

- [Download the Blender scene](https://github.com/KadenCSmith/dry-ice-peat-study/releases/download/v1.0.0/Dry_Ice_Peat_Study.blend)
- [Download the project package](https://github.com/KadenCSmith/dry-ice-peat-study/releases/download/v1.0.0/Dry_Ice_Peat_Study_v1.0.0.zip)
- [Release page](https://github.com/KadenCSmith/dry-ice-peat-study/releases/tag/v1.0.0)

This repository is private; downloads require access to the repository and a signed-in GitHub session.

## Open the scene

Open `Dry_Ice_Peat_Study.blend` in Blender 4.2 or later. It was authored with Blender 4.2.3 LTS using Cycles. The saved scene uses procedural materials and does not require the optional downloaded textures to open or render.

The animation runs from frame 1 to 300 at 30 fps. Select `CAM_SECTION` with the `SECTION` view layer for the cutaway. For the full site from above, select `CAM_TOP` with the `TOP` view layer and use a square render. Enable only the intended view layer when rendering.

| Frame | Event |
| --- | --- |
| 1 | Sphere above the open borehole |
| 35–59 | Accelerating vertical drop to the bottom |
| 66 | Sphere at rest, before gas release |
| 75–111 | Conceptual rapid release and pressure pulse |
| 96 | Gas expansion in the section view |
| 126 | Gas spreading across the surface in the top view |
| 145 onward | Gas reaches the near portion of the peat |
| 240 | Reduced glow and flames locally; farther peat continues smoldering |

## What is included

- `Dry_Ice_Peat_Study.blend`: latest saved scene, including the final root/tree and annotation refinements.
- `IMPLEMENTATION_NOTES.md`: dimensions, scene structure, animation approach, limitations, and exact completion status.
- `source/`: construction and refinement scripts retained as development history.
- `review/attempt_02/`: four earlier review renders, made before the final root/tree refinements. They are reference images, not renders of the latest saved file.
- `assets/`: optional Poly Haven textures downloaded for a proposed subsequent material pass. These textures have **not** been applied to this saved scene.
- `SHA256SUMS.txt`: checksums for the files included in this snapshot.

## Interpretation

This is a conceptual visualization with prescribed animation. White gas volumes make transport visible; CO2 itself is invisible. The pressure graphic, transport through soil, and local reduction in combustion are illustrative. The scene does not solve or validate fluid flow, thermodynamics, soil permeability, combustion chemistry, pressure, or suppression effectiveness.

## Review status

Two render/review attempts were completed. The independent score for attempt 2 was **6.5/10**. Further root continuity, foliage, pressure-mask, and label changes were saved afterward. Those changes have not yet received a third render/review pass. The original review limit is three total attempts.

## Asset credits

Optional downloaded texture maps are from Poly Haven: [Bark Brown 01](https://polyhaven.com/a/bark_brown_01) and [Forrest Ground 03](https://polyhaven.com/a/forrest_ground_03), provided under [CC0](https://polyhaven.com/license). Exact source URLs are in `assets/sources.json`.
