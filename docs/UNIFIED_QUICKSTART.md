# Unified physics lab

Open the 0.18.0 Mac app to the complete peat-fire sequence. Choose Gradual or Rapid and use the prominent Play interactive sequence button to watch the 90-second story. **Previous simulations · v0.8+** above the scene opens the gallery, where prior scenes and films can play together; the three-dot menu also offers three interface layouts. Chapters jump to ignition, underground peat, a straight auger bore, a modest underreamed pocket, source placement, concave-cap flattening and hose-fed fractures. Grass and seeded aggregates provide visual context. Setup is sped up; the six-second source interval plays at normal speed. The natural scene is illustrated; Temperature, Oxygen and CO₂ show accepted numerical values. Rapid mode holds the pre-treatment reference after intervention because rapid conversion is not calculated.

The auger bore, smaller pocket, concave segmented cap and woven hose are authored geometry. A rapid illustrative pressure pulse flattens the cap with bounded diameter growth and lifts only nearby soil. Water follows short fracture paths, dimming embers where it reaches. The current scene omits the older global burst debris and exaggerated dome inversion; those animations remain in Previous simulations. The **Contact model** strip shows a separate finite hot-contact calculation: its natural-scene sphere follows the remaining contact-source mass, and local glow follows small specimen temperatures. **Accepted experiment** metrics and scientific views retain their original porous-model history. These inventories must not be added together. The contact example removes heat locally without predicting a moving liquid front or extinguishment. [Contact assumptions and conservation checks](CONTACT_COOLING.md).

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

Historical source and original Blender edits remain preserved in the repository. Where a prior version has no preserved replay asset, the gallery identifies it as unavailable.
