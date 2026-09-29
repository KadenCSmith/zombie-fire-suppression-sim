# Fire sequence consistency review

Reviewed 27 September 2026 after the corrected-caption films were published. **Accepted for the stated presentation and numerical-evidence scope; no remaining blocking consistency finding.** This review does not validate fire propagation, suppression, fracture, or infiltration. No implementation was changed by this final audit.

## Evidence checked

- Read `docs/FIRE_SEQUENCE.md`, `docs/FIRE_PROTOCOL.md`, the story helpers, interface selection/provenance logic, field texture mapping, Blender construction and verification scripts, storyboard, and final manifests. Inspected the sixteen-chapter contact sheet. Full native playback and release packaging are recorded separately.
- Programmatically compared every storyboard stage and geometry value with `src/story/fireSequence.ts`: exact match. Independently ran `tests/fireSequence.test.ts`: **9/9 pass**. The 90-second story maps to 36-second playback, with story 55–61 running 1:1. Ignition maps story 0–10 to physical 0–7200 s, later growth maps 10–24 to 7200–86400 s, and gradual treatment maps 55–85 to 86400–86430 s. Earlier accepted states are held; the insertion discontinuity is not interpolated. Partial histories clamp to their last accepted state.
- Re-read both published MP4 containers using the independent parser: each contains **864 encoded H.264 frames, 1280 × 720, 24 fps, 36.000 s**. The application copies are byte-identical to the delivered movies. Verified all **nine** `sourceFilesSha256` entries in `public/renders/manifest.json`, and independently recomputed the movie, editable-scene, cache, and preserved-original hashes below.
- Verified the cache has 65 accepted states, including 16 treatment states, no prepared-water removal, and `propagationResolved: false`. All six recorded numerical-module hashes reproduce from generation commit `a47721f`. The same-time pre/post insertion pair retains 0/4 kg respectively. Final accepted dry ice is **3.998211470103149 kg**, not an illustrated disappearance.
- Field texture indexing is x-fastest, then y, then depth, with nearest-cell sampling. Numerical view suppresses the authored operations and anatomy. The Blender inset uses held accepted middle-y temperatures; rapid mode holds pre-treatment fields. Smooth interpolation of gradual Blender sphere radius is documented as presentation between accepted mass samples.
- Geometry agrees across contracts: 4 kg at 1560 kg/m³ gives radius 0.0849081 m; source centre depth 1.3 m; bore depth 1.385 m and radius 0.55 m; plate radius 0.475 m, rim depth 1.05 m, initial centre depth 1.15 m. The rapid centre rises to depth 0.85 m by prescription. These are geometric clearances, not installation or failure predictions.

## Findings resolved during review

1. **P1 — physical clock mismatch:** the interactive view formerly spread the complete 24-hour history uniformly over the first 24 story seconds, unlike the film. The helper now uses the actual ignition cutoff, with regression tests for the full and partial histories.
2. **P2 — mixed film provenance:** after a custom experiment, the film could show that experiment's stop reason and assumptions beside bundled-reference readouts. The limitations panel now uses the displayed cache and identifies the bundled rendered reference.
3. **P2 — incomplete underground caption:** the final scene and both rerendered movies use “Illustrated underground spread; the numerical front remains unresolved.” Superseded movies are not published.
4. Source documentation now calls (4.4, 4, 1.3) m the original **coupled-scenario** coordinate, avoiding confusion with the historical Blender geometry.

## Scope retained

The 70% trigger is an authored **two-dimensional cutaway area fraction**, not consumed fuel or burned volume. Natural flame/peat geometry is choreographed context, not a registered reconstruction of the numerical reaction front. Numerical ignition and insertion preserve their separately recorded coordinates. The cache sustains surface oxidation but does not resolve travelling underground smoldering or extinction. Rapid conversion, drilling, plate inversion, cracks and water paths remain illustrative. The numerical intervention adds solid material into existing pore space; it does not excavate a cavity. Both documentation and presentation preserve these distinctions.

## Frozen asset identity

| Asset | SHA-256 |
| --- | --- |
| Gradual MP4 | `a610e010ae198e44a2f6ee4860922416b4e93d34a3f40e80d58fb82cb0f34fc8` |
| Rapid MP4 | `1b9d0341f53b628073f6b53d3fc25f7cbc1ca021cc5adc416676af7e9d0d20de` |
| Editable scene | `d24a0b3eefc9a38196cbc4fe0563b974b581c88ef6132d60cf8c5f47f1b0ccfc` |
| Accepted cache | `212b82c7e51157c3d3f0bdd25408d7c383c00a324d3b60bf1e68828f6b9b25a0` |
| Preserved original study | `0fbed01f1f3120dd700c5f6e569eb448851634182581d07a33aabbc1fd729edd` |

The final public manifest supplies the exact construction, render, verification and storyboard source hashes. Matching those hashes establishes reproducible asset identity, not empirical validation.
