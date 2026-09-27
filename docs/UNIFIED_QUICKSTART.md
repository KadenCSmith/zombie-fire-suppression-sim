# Unified physics lab

Open the versioned 0.14 Mac app to the complete peat-fire sequence. Choose Gradual or Rapid, play the 90-second story, or use Rendered film to watch either complete 36-second Blender render. Chapters jump to ignition, underground peat, excavator drilling, source placement, a buried inverted plate, gas and water. Grass and seeded aggregates provide visual context. Setup is sped up; the six-second event segment plays at normal speed. The natural scene is illustrated; Temperature, Oxygen and CO₂ show accepted numerical values. Rapid mode holds the pre-treatment reference after intervention because rapid conversion is not calculated.

Expand **Fire experiment** to change duration, moisture, igniter duration and power, then calculate a new accepted history. Cancelling retains the previous result; Restore bundled result restores the 24-hour baseline plus 30-second finite-source branch. That baseline sustains surface oxidation but does not resolve downward combustion propagation. The source loses about 1.79 g in 30 s; no extinction is claimed.

Select **Open physics lab** for the coupled laboratory and start with the cold source-only case. The default 2,560-cell mesh has exactly ten times the former preview count. Calculate, then scrub the accepted checkpoints. Camera and presentation changes never rerun or modify physics.

- Natural cutaway: textured soil layers, detailed oak and seeded irregular aggregate detail. Aggregates and oak anatomy are presentation geometry, not separate mechanical contact elements.
- Scientific fields: cell data with physical units and fixed scales. Only the visible boundary is drawn; all cells are still solved and exported.
- Comparison: synchronized cameras and a common solver checkpoint, with an option to compare the historical Blender reference. Historical animation is explicitly staged with different geometry, mass and normalized timing.
- Terrain menu: assumed rooted peat, layered peat/mineral or rocky-substrate cases. Changing physical inputs requires a new calculation.
- Prepared smoldering specimen: opt-in initial heat and a documented dry halo; removed initial water appears in diagnostics. It is not a reconstructed natural fire.
- Export calculation: version 2 JSON contains accepted states, SI geometry, finite source, ledgers and initialization diagnostics. Import using integrations/blender-study/import_accepted_physics.py to produce an editable Blender derivative.

## Numerical fidelity

The five grids retain old reference sizes and add 2,560 and 20,480 cells. All lab grids project a shared 20,480-voxel material atlas conservatively. Mesh changes preserve extensive inventories but can alter local averaged temperature, pressure and numerical error. More elements are not experimental proof of greater accuracy.

Version 0.12 retains the element-by-element reference backend by default. Version 0.13 enables the matched float64 sparse elastic backend; the reference remains selectable under Numerical implementation. Both precision meshes use 0.125 s maximum steps, versus 0.5/0.25 s in 0.12. More steps can make the default slower even with a faster operator. Exported calculations record the application version, step limit and backend. Fracture continues to use its original research path and validity gates.

## Limits that remain

The application does not yet solve resolved borehole excavation, mobile liquid infiltration, calibrated root pullout, large-deformation rock contact, or a verified terrain-rupture sequence. Water exists as equilibrium liquid/ice/vapor inventory but is not an inlet/infiltration model. The 100 US gpm proposal is not simulated. No measured site calibration, field suppression claim, or calculated statistical accuracy percentage is available. The UI reports uncertainty as unassessed.

Existing 0.10/0.11 bundles and original Blender edits are preserved. The separate Blender repository remains intact; its useful original files, scripts, provenance and reference animation are integrated here.
