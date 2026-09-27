# Full fire and treatment story

This new editable Blender sequence accompanies the application's canonical
`src/story/fireSequence.ts` storyboard. `storyboard.json` is its exported stage
and geometry contract. There are two complete scenes, each 864 frames at 24 fps
(36 seconds of video) covering all 90 seconds of presentation time. Setup and
follow-up play at 2.8×; the story's 55–61 second event plays at 1×:

1. Surface ignition (0–10 presentation seconds).
2. Connected surface-to-peat entry and illustrated spread to 70% involvement (10–24).
3. Tracked excavator arrival, attached drill advance and withdrawal (24–37).
4. Dry-ice placement (37–47).
5. Inverted metal plate placement below ground, above the source (47–55).
6. Gas visibility and rapid-only upward plate inversion (55–69).
7. Water along assumed openings (69–85).
8. Review of remaining peat (85–90).

**Gradual** shows finite source mass from the attached accepted cache when one
is supplied. Rendered radius interpolates between accepted samples for smooth
display; it is not an extra numerical solve. Accepted elapsed seconds appear
separately from the presentation clock. **Rapid** prescribes a complete visual
source conversion; it is explicitly not an accepted sublimation calculation.
The final accepted gradual treatment retains 3.998211470103149 kg from the
initial 4 kg after 30 physical seconds. Its radius barely changes; that small
change is intentionally preserved. The gradual plate retains its downward
bowl because this protocol supplies no accepted plate mechanics.

The plate rim is 1.05 m below ground. Its initial center is 1.15 m below ground,
with clearance above the source's top near 1.215 m depth. The rapid animation
inverts its center upward to 0.85 m depth. The plate radius is 0.475 m; the
0.55 m bore and 0.50 m auger provide visible placement clearance. These are
presentation geometry choices, not a simulated installation design.

The ignition/growth choreography, drilling/removed material, source placement,
plate inversion, crack network and water motion remain
illustrative. The porous solver does not establish those operations as a
validated treatment or solve this liquid infiltration. Cyan shapes only make
gas transport legible; CO2 is invisible. The narrative must not be read as
proof that all peat is extinguished or that physical rupture occurred.
The narrative retains 30% unburnt peat margin and ongoing fire at the end.
Its 70% trigger is an exact area fraction of a displayed elliptical section;
it is neither a three-dimensional burned volume nor calculated fuel loss.

The separate temperature inset displays held accepted cell values on a
middle-y cross-section, with its own physical timestamps and fixed 283–850 K
scale. The 24-hour cold-start protocol did not resolve a moving underground
front. Rapid mode holds the last pre-treatment field; it does not reuse the
gradual post-insertion gas calculation as a rapid-conversion prediction.

The source tree collection is loaded read-only from the preserved Blender
study, then repositioned as contextual anatomy. Random aggregate details use a
fixed seed and add no solver mass or mechanical contacts. Original source files
are never saved over. All used image dependencies are packed in the derivative.
Its embedded cache is stored as `ACCEPTED_FIRE_CACHE.json.gz.b64`; recover the
JSON using `gzip.decompress(base64.b64decode(text))`. The adjacent uncompressed
`Accepted-Fire-Cache.json` has the recorded source-file SHA-256.

## Build, inspect and render

```sh
blender --factory-startup -b --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/build_fire_sequence.py -- \
  --output /path/Fire_Sequence.blend --cache /path/accepted-fire.json

blender -b /path/Fire_Sequence.blend --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/verify_fire_sequence.py

blender -b /path/Fire_Sequence.blend --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/render_fire_sequence.py -- \
  --mode gradual --still 64 --output /path/preview.png

blender -b /path/Fire_Sequence.blend --python-exit-code 1 \
  --python integrations/blender-study/fire-sequence/render_fire_sequence.py -- \
  --mode gradual --output /path/Gradual_Fire_Sequence.mp4
```

Repeat the last command with `--mode rapid` and a distinct output path. The
renderer writes its resolution, frame count, wall time and interpretation in a
sidecar JSON. Both modes use EEVEE at 720p; `--samples` controls temporal
antialiasing samples. A representative still should be timed before the full
render. Open the `.blend` and use its scene dropdown to edit either mode.

For the complete delivery, `render_delivery.py -- --output-directory <folder>`
renders both films and eight chapter stills per mode. `verify_movies.py <folder>`
independently reads encoded MP4 sample count, duration, dimensions and codec;
it requires both movies to contain 864 H.264 frames over exactly 36 seconds.
`create_contact_sheet.py <folder>` uses Pillow to assemble the sixteen native
Blender stills without altering their content. The app's copies are in
`public/renders`; editable scenes and the full cache accompany the release.
