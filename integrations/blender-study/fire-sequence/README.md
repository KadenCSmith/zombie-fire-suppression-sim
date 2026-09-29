# Full fire and treatment story — 0.16

The two editable scenes each contain **864 frames at 24 fps: complete 36-second
films** covering the full 90-second presentation. Setup and follow-up play at
2.8×; story 55–61 seconds plays at 1×. The original user-edited blend and the
0.15 delivery are preserved. A new numbered output directory receives each
successor.

The sequence keeps a small surface ignition, connected irregular underground
peat involvement, the 70% illustrated treatment gate, tracked excavator and
attached auger, finite dry-ice placement, buried steel shell, rapid-only pressure
release, fabric hose placement, limited wetting and remaining hot peat. Over
51,000 fine grass blades per scene preserve the dark natural cutaway treatment.

## Shared geometry and timing

`public/fire-sequence-contract.json` exports canonical TypeScript geometry,
poses, cracks, wetting progress and **centripetal hose samples**. The film uses
those samples directly, without resplining. Live coordinates `[x, up, toward
viewer]` map to Blender `[x, -toward viewer, up]` because the two cutaways use
opposite depth signs. The 200 × 80 arrival field remains
`public/fire-appearance.json`; 70% means sampled two-dimensional illustrated
peat area, not calculated burned volume or fuel loss.

The unchanged bore radius is 0.24 m. During story 31–33 the folding cutter opens
an authored ellipsoidal pocket of radius 0.65 m, centered 0.95 m below the surface
with 0.28 m half-height; it folds before drill withdrawal. The segmented shell
enters with radius 0.15 m, then opens during 51.5–54 to radius 0.58 m and downward
rise 0.16 m at rim depth 0.98 m. The sphere beneath retains clearance. The rapid
55–55.65 event reverses the center upward, increases shell radius to 0.645 m and
moves shoes outward to 0.69 m, showing shoulder engagement. This is a prescribed
folding/deformation mechanism and explicit soil penetration by the shoes;
it is not a manufactured tool design or calculated pressure/soil response.
Gradual mode leaves the shell downward and the ground intact.

An original procedural ivory woven jacket, seams, oval resting section and
metal coupling create the flexible fire hose. No stock photograph or texture
is copied. It lies on the grass, enters the existing bore during 69–72, and
passes through a declared shell service sector. Shared continuous-curve tests
check shaft, source and passage clearance. The rapid fracture paths begin at
the 55-second release; gradual mode has no newly opened fractures. Water starts
at 72. Its assumed branch-dependent front reaches only part of each path by 90,
with small irregular damp footprints around local contacts. This is not a
Darcy flow or fracture-flow solution.

## Distinct numerical cases

The natural source radius and local smolder attenuation follow
`public/contact-cooling.json`, a **separate conserved reduced hot-contact
calculation**. Thirteen independent 0.5 kg hot peat specimens exchange finite
heat with 4 kg dry ice and water supplied from a 5 kg inventory. Temperatures,
source mass and heat readouts use its exported values. Arrival times, footprint
locations and conductances are assumptions; footprints do not define resolved
spatial control volumes. Red charcoal visibility is reduced only at those
contacts. Uncontacted peat remains hot. There is no imposed extinguishment,
oxidation solve or experimental validation claim.

Rapid mode exports the remaining dry-ice inventory at 55 seconds with no extra
sublimation or gas-expansion heat credit. It is an illustrative release, not a
calculated conversion, detonation or CO2 combustion. Faint separate gas tracers
are a visibility convention; real CO2 is invisible.

The temperature inset and explicitly labeled **field-case** dry-ice/gas readout
retain the older accepted 24-hour + 30-second porous calculation. They are not
combined with the contact balance. Rapid holds the pre-treatment field. That
accepted cache does not resolve a travelling underground front. The embedded
`ACCEPTED_FIRE_CACHE.json.gz.b64` can be recovered with
`gzip.decompress(base64.b64decode(text))`. The contact and presentation JSONs
are embedded separately. All used image dependencies are packed.

The manifest records the original study hash, preserved user-original hash,
accepted-cache hash, appearance hash, shared sequence-contract hash and contact
model hash. Source files and data supplied beside the films make the distinction
between calculation and illustration reviewable.

## Build, inspect and render

Generate the shared contract/contact exports before building. Then:

```sh
blender --factory-startup -b --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/build_fire_sequence.py -- \
  --output /path/Fire_Sequence_Gradual_and_Rapid.blend \
  --cache public/fire-sequence-cache.json

blender -b /path/Fire_Sequence_Gradual_and_Rapid.blend --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/verify_fire_sequence.py

blender -b /path/Fire_Sequence_Gradual_and_Rapid.blend --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/render_fire_sequence.py -- \
  --mode gradual --still 78 --output /path/preview.png

blender -b /path/Fire_Sequence_Gradual_and_Rapid.blend --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/render_delivery.py -- \
  --output-directory /path/new-version-folder
```

`render_delivery.py` renders both complete 720p EEVEE films and eight native
chapter stills per mode. `verify_movies.py <folder>` reads MP4 sample tables and
requires 864 H.264 frames, exactly 36 seconds, 1280 × 720, 24 fps for both files.
`create_contact_sheet.py <folder>` arranges the sixteen native stills.
`package_render_assets.py <folder>` copies verified films into the app and
records exact hashes, without touching a frozen prior-version delivery.

The Blender verifier checks complete timelines, underreamed/folded placement,
rapid inversion, source mass, hose samples, crack onset, untouched gradual
soil, all three contact ledger residuals, the 70% appearance gate, packed images
and input hashes. These are numerical and geometry checks, not evidence of
physical validation. Independent visual review ratings belong in the delivery's
review evidence and never substitute for model validation.
