# Scene studio

Scene studio is the app's opening workspace. It presents the authored Blender landscape as an interactive 3D illustration, with four camera views and one shared 20-second sequence. The latest version calculates debris translation under gravity, drag and simplified contacts with an assumed release velocity. Gas and thermal displays remain authored. It is not connected to the scientific solver and does not calculate temperature, gas concentration, fracture or treatment success. The top-right ⋯ menu also replays the earlier 0.5 cooling and 0.6 rapid-release scenes. See [dynamics, evidence and limitations](SCENE_DYNAMICS.md).

## Views

| Screen | What it shows |
| --- | --- |
| **Soil cutaway** | Four soil strata, the borehole, dry-ice sphere, buried peat and living tree in natural material colors. |
| **Thermal layers** | The same geometry with a qualitative cold-to-warm color overlay. The legend has no temperature units because no temperatures are calculated. |
| **Surface view** | A view from above, showing the position of the source and tree within the site. |
| **Roots & peat** | A closer camera view of the buried peat and roots. |

Selecting a screen changes the camera and display treatment while keeping the same sequence time. Drag to orbit and scroll to zoom. **Labels** toggles annotations; the focus icon restores the selected screen's camera.

## Playback

The following authored timing describes version 0.6. Version 0.7 retains landing at 4 s and release at 9 s, with a held-then-free-fall source and calculated particle translation. Version 0.5 uses its original cooling/transport chapters.


The sequence starts paused. **Play** starts it; **Pause** holds the current time; **Restart** begins again at zero. The time slider and chapter buttons seek to a frame and pause playback. Speed can be 0.5×, 1× or 2×, and **Loop** repeats the sequence. At the end of a nonlooping sequence, Play replays it from zero. Backgrounding the document pauses playback. Animation callbacks are cancelled when the workspace closes; frame advances are clamped to prevent a long stalled frame from skipping the story.

| Sequence time | Displayed action | Interpretation |
| --- | --- | --- |
| 0–4 s | Source placement | Prescribed descent into the borehole; not a calculated drop or impact. |
| 4–9 s | Five-second hold | The source rests. The inverted cage is lowered onto the opening during 4–4.8 s. |
| 9–12 s | Instant gas release | The solid is hidden exactly at 9 s; gas tracers rapidly spread and 88 soil/rock fragments move. These are prescribed display trajectories. |
| 12–20 s | Fragments settle | The grains and rocks settle and gas tracers disperse; a warm peat region remains. |

These seconds belong to the illustration's playback clock. They are not a conversion from the scientific solver's multiday time or the separate radial gas event's short clock.

## Inverted cage

The default cage is **10 cm high and 95 cm wide**, centered over the 75 cm opening. The 10 cm measurement was interpreted as height because its intended dimension was unspecified; both height and width are editable in the scene sidebar. A checkbox hides it. Its top and four sides have bars; its underside has a perimeter frame with no base grid. It is placed after landing so the falling sphere does not pass through the lid. Bar spacing is at most 10 cm. Dimensions use meters internally.

In version 0.6, cage and fragment motion are authored with no bar collisions. Version 0.7 adds simplified particle/bar contacts; neither version calculates pressure-rated containment, cage deformation, fracture or molecular dynamics. CO₂ is colorless; visible particles are markers, not a claim about its appearance. Timings and trajectories are deterministic functions of playback time, so reverse seeking and looping restore the same state. The scientific solver and the original Blender/GLB asset are unchanged by this feature.

## Open the scientific workspace

Choose **Open simulation** to enter the existing Setup, Simulation, Results and Event workflow. Its **Scene studio** button returns here and pauses the scientific run. The in-memory scenario, calculated state and history remain with the scientific workspace. Studio controls never change their inputs or fields. Studio playback starts from its initial paused state when the component is opened again; save scientific scenario files separately when persistence across app restarts is needed.

The authored landscape is **8 m × 8 m**, with soil extending approximately 3.2 m below the nominal surface. The illustrated borehole is 0.75 m wide and 2.44 m deep; the sphere is 0.50 m in diameter. These illustration dimensions are separate from the scientific default domain of **6.096 m × 6.096 m × 3 m** and its editable source parameters. Neither geometry is silently substituted for the other.

## Asset provenance and web rendering

The source is [`Materials_Thermal_Stage_2.blend`](review/material-stage2/Materials_Thermal_Stage_2.blend), which retains the approved Stage 1 geometry. The export uses its material review scene at frame 66. It exports authored geometry and UVs to [`public/models/peat-study.glb`](../public/models/peat-study.glb), with simplified standard glTF PBR materials. Diffuse and roughness textures are retained where supported; Blender procedural networks, full bump shading, review lighting and animation are not reproduced. Camera movement, thermal display and source/transport animation are authored in the app.

The binary asset is **25,161,996 bytes (25.16 MB)**. The [export manifest](../public/models/peat-study.manifest.json) records 1,179 selected Blender objects, 21 materials, the frame, coordinate conversion and SHA-256 hashes. The source file's hash remains:

```text
2272d17ee6d27edfebcd8a6775d266963d12f53cdf71aa1cf6876c10ea844ae5
```

The exporter checks the source hash before and after export and does not save over the Blender file. Coordinates map from Blender `(x, y, z)` to glTF `(x, z, −y)`, retaining meters. The GLB's exported geometry has no baked animation; the app applies deterministic display changes from the shared playback time.

For web display, the model's **1,194 glTF primitive meshes are combined into 23 material/role batches**, while retaining **187,582 triangles**. Combining compatible static geometry reduces the model's draw submissions without reducing its triangle count or changing the scientific solver. These counts concern the model; annotation lines, tracers and other scene elements add their own rendering work. They are not a measured frame-rate claim. Asset/material loading and renderer errors have an in-app status display.

The bark and forest-ground textures originate from Poly Haven's CC0 assets by Rob Tuytel. See [third-party notices](../THIRD_PARTY_NOTICES.md#blender-review-and-scene-studio-textures--cc0) for source links and the distinction between surface reference and scientific evidence.

## Scope and evidence

- [Staged Blender review](STAGED_REVIEW.md) records the source geometry and material approval workflow. App playback does not constitute approval of later Blender rig, camera or final-render stages.
- [Physics model](PHYSICS_MODEL.md) describes calculated fields and their limits in the scientific workspace.
- [Validation status](VALIDATION_STATUS.md) and [build status](BUILD_STATUS.md) record the checks actually run for this integration.
- [Research review and ASCE citations](RESEARCH_REVIEW_ASCE.md) explain the scientific sources and remaining evidence needs.
- [Solver optimization review](SOLVER_OPTIMIZATION_REVIEW.md) covers finite-element blocks and finite-volume operators separately from this rendering optimization.
