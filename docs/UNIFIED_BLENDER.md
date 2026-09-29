# Blender and accepted physics in one application

The coupled workspace compares accepted scientific fields with the original
Blender concept animation. The unified repository also contains an editable
Blender derivative with separate scientific, natural-presentation and original
reference scenes. Rendering never contributes forces, heat, mass,
permeability, or reaction rates to the calculation.

## What was integrated

- `integrations/blender-study/Dry_Ice_Peat_Study.blend`: byte-preserved original
  from `KadenCSmith/dry-ice-peat-study`, commit
  `596bf84a32ed92d7dcddd7ba15001cb2fe258b0c`.
- `integrations/blender-study/original-source/`: all ten original construction,
  refinement and proposed packaging scripts, retained as historical source.
  They are not an idempotent build pipeline and contain original workspace paths.
- Original README, implementation notes and checksum listing; `PROVENANCE.json`
  gives individual preserved-file hashes. The source `.blend` SHA-256 is
  `0fbed01f1f3120dd700c5f6e569eb448851634182581d07a33aabbc1fd729edd`.
- `public/models/dry-ice-reference-animation.glb`: browser animation with
  immutable context merged by material to reduce draw calls. Animated source and
  gas objects remain separate. `export_reference.py` regenerates it from the
  preserved original, with a checksum guard against source edits.
- `Unified_Accepted_Physics.blend`, the example accepted cache, preview and
  verification records: a working example of the new import pipeline.
- `accepted-checkpoint-review.mp4`: 2.5-second labeled review of five accepted
  checkpoints, held for 0.5 playback seconds each. Physical timestamps are
  0, 0.5, 1, 1.5 and 2 seconds; this is not interpolated continuous motion.

The historical `Materials_Thermal_Stage_2.blend` and the user's separately edited
Stage2 original are outside this pipeline: neither is opened or rewritten.
The existing static `peat-study.glb` remains available for Scene studio.
Optional Poly Haven texture files are not duplicated: they are already embedded
in the existing app asset, and were not applied to the original study. Original
authored-code/geometry licensing remains unchanged; no new license is selected.
Texture source URLs and CC0 credits are preserved in `texture-sources.json` and
the main third-party notices.

## Interpreting the comparison

The original scene is **prescribed concept animation**, not a real-life recording
or a solved flow field. Its ball has diameter 0.50 m (about 102.102 kg at
1560 kg/m³), resting at Blender `(-1.4, 0, -2.19)` m. Its peat geometry also
differs from the coupled case. The default coupled source is 4 kg centered at
`(4.4, 4, 1.3)` m in a depth-positive solver domain, or `(0.4, 0, -1.3)` m in
Blender. A visual comparison therefore compares representations and timeline
phase; it does not imply the same experiment or equal physical time.

The reference's 300-frame, 30 fps authored timeline is sampled every three
frames for browser playback. Use the actual glTF clip duration from its manifest
(9.9 s), not solver time. Cyan translucent objects replace Blender volume
shaders to show the prescribed gas path. CO₂ itself is invisible. Shader-only
density changes, smoke, flames and the masked pressure graphic are not reproduced
in glTF. The original editable `.blend` retains them. Browser PBR shading is a
simplified material representation.

## Export the calculation and import into Blender

1. Finish or stop at a solver validity limit and select **Export calculation** in
   the coupled workspace. Version 2 records the exact grid, source density,
   axes and accepted frames. Unaccepted trial states are never exported.
2. From the repository root, run the importer below with your export path.
3. Open the new output. Choose **PHYSICS • accepted checkpoints** for calculated
   data or **REFERENCE • prescribed illustration** for the original animation.
   **NATURAL • accepted geometry** applies presentation strata colors and seeded
   irregular aggregate details to the identical accepted node positions.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b \
  --python-exit-code 1 \
  --python integrations/blender-study/import_accepted_physics.py -- \
  --cache /path/to/coupled-scenario.json \
  --output /path/to/Unified_Accepted_Physics.blend \
  --reference integrations/blender-study/Dry_Ice_Peat_Study.blend \
  --preview /path/to/accepted-physics-preview.png
```

Omit `--reference` to create only the physics scene. Use `--mode rigid` for an
exported rigid-pore comparison, `--field co2` to color by gas mole fraction, or
`--full-domain` to show the whole volume exterior. Every output is a new file;
the importer rejects a protected source/output collision and Stage2 filenames.

The importer requires explicit version-2 grid and source metadata. It rejects
missing/truncated arrays, nonfinite values, invalid inventories/fractions,
non-increasing times, and unfinished run status. A validity-limited run is
allowed because its history contains only accepted states; its stop message is
stored in the new scene.

## Data contract and replay

Solver `x` and `y` are horizontal, with `z` positive downward. Blender uses
`(x − width/2, y − length/2, −z)` in meters. Nodal displacement uses
`(ux, uy, −uz)` at true 1× scale. The web model follows glTF's Y-up mapping.
Cell ID is `(z × ny + y) × nx + x`; node ID is
`(z × (ny+1) + y) × (nx+1) + x`.

Each Blender timeline frame holds exactly one accepted checkpoint. The true
solver timestamp is in a timeline marker, label and object property. There is no
invented intermediate state, even when checkpoints are unevenly spaced. The
visible mesh contains only exterior faces and the optional cut plane, avoiding
internal faces. Each face retains its `solver_cell_id` and all scalar fields:
temperature K, absolute pressure Pa, oxygen/CO₂ mol/mol of gas, frozen and liquid
water kg/cell, fuel kg/cell, porosity m³/m³ bulk, and research damage.

All original volume data, displacements, ledgers and accepted source states are
embedded in the `ACCEPTED_PHYSICS_CACHE.json` Blender text block. The source
sphere radius is `(3m / (4πρ))^(1/3)`; it disappears at zero inventory. The
reduced cap uses the accepted center/rim/flex state at true scale. Neither adds
an unsupported borehole flow solution, impact, smoke simulation, contact model,
or suppression outcome. Detailed tree anatomy belongs to the reference scene;
the accepted solver's root trusses are an assumed constitutive model.

The natural scene's faceted aggregates use fixed seed 46023 and follow trilinear
interpolation of accepted nodal displacement. They do not introduce resolved
stones, contacts, mass, or a new heterogeneous material law. Peat coloring follows
the exported material peat fraction when available; the other strata bands are
display conventions. Scientific and natural mesh vertices are checked for exact
agreement during derivative verification.

Changing the field after import: select the shared **CELL FIELD** material,
change the Attribute node's name to a recorded scalar field, then set the Map
Range limits in its native units. The numerical data are unchanged. A fresh
import with `--field` is also supported.

## Verification and limits

`python3 -m unittest discover -s integrations/blender-study -p 'test_*.py'`
checks topology, cell identities, coordinate signs, invalid input rejection and
accepted limited histories (six tests passed). `verify_derivative.py` reopens the generated file
and checks every checkpoint's visibility, timestamp, field attributes, mass and
sphere radius. It writes a separate verification record without saving over the
Blender file.
The 2560-cell, five-checkpoint derivative passed this reopen verification, and
both previews plus the held-checkpoint H.264 clip were rendered successfully
with Blender 4.2.3 LTS. Rendering is an illustration check, not physical validation.

The included short numerical example disables oxidation and uses conservative
material/inventory initialization and the verified optimized mechanics backend.
It is a 2560-cell pipeline verification case, not evidence of mesh convergence
or experimental validation. The assumed initial hot region is not a calibrated burn.
The main application offers higher-resolution calculations; exports of any
supported grid follow the same exact metadata contract.
The example provenance records Git HEAD, the dirty-worktree flag and SHA-256
hashes of each coupled engine/model/source/thermodynamics/mechanics/linear/sparse/
remap/cap source file used to generate the cache.

This integration preserves accepted model data faithfully. It does not validate
the material laws experimentally or turn the illustrative reference into a
physics simulation. Consult `VALIDATION_STATUS.md` for the model's current
numerical gates and unresolved physics.
