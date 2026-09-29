# 0.15 visual code review

Reviewed application changes in `1295153` relative to `f97d28a`, then made two small corrections authorized by the coordinating agent. This is a code review, not a claim of experimental validation. The reviewer contributed the equipment/grass implementation and some earlier scene code; this is not an independent authorship review of those components.

## Findings and disposition

- **Fixed — track motion direction.** `FireExcavator.tsx` advanced the belt phase with `-travel`, causing bottom shoes to move forward relative to the chassis. The phase now uses `+travel`. A finite-difference kinematic check gives approximately zero bottom-shoe ground velocity with the correction, versus twice chassis velocity before it.
- **Fixed — grass clearing shape.** `FireSequenceGrass.tsx` retained a rectangular grass exclusion after the bore became cylindrical. Grass roots now use the same radial cylinder test as the ground, roots and aggregates.
- **Remaining minor visual limitation — burst shadows.** The ground's visible material applies authored rupture displacement and bore clipping, but its default shadow material does not duplicate those shader operations. Ground shadows can therefore retain the original silhouette during rapid uplift. The underground root shader has the same general shadow limitation. This does not change displayed scalar values or numerical state. Correcting it needs coordinated depth-material/shader changes and visual verification, so it was left outside the final small corrections.

No blocking timing, accepted-state mutation or installation-clearance defect was found in the reviewed change.

## Scope and evidence

- No changes to `src/coupled` or `src/worker` occur between the reviewed commits. The scene copies accepted arrays into a rendering texture; it does not write into those arrays. Natural-view fragment displacement, drilling and visual objects are disabled or omitted in the numerical field views.
- Rapid mode still selects the accepted pre-treatment reference after the intervention chapter. Gradual mode retains accepted treatment-frame mass. Rendered-film readouts remain bound to the bundled reference, separately from custom experiment results.
- The unchanged piecewise clock retains 36 seconds of playback for the 90-second story, including 1:1 playback during story seconds 55–61. The excavator remains hidden before the illustrated 70% gate, retracts before the dry-ice drop, and stays clear of the opening.
- The 4 kg sphere radius is 0.084908 m. The initial plate underside clears its top by 0.110092 m. The plate has 0.04 m radial bore clearance. The auger's 0.02 m center offset reduces its minimum radial clearance to 0.02 m; it still fits. Earlier shorthand describing auger clearance as 0.04 m referred only to the difference in radii.
- Grass remains one draw for 30,000 instanced blades; static equipment is batched by material, tracks are instanced, the ground uses one batched mesh, and the canvas uses demand rendering. The renderer still has a finite per-frame cost; no hardware-independent frame-rate claim is made.

After the two corrections: `npm run typecheck`, `npm run lint` and `npm run build` passed. Production build retains existing bundle-size and ignored `use client` warnings. The coordinating agent reported 175 tests passing before these two visual corrections; the full suite was not rerun by this reviewer. No additional browser/native interaction was performed during this code review.

Interface framing/readability, assessed from `outputs/Native-0.15-Excavator-Review.png`: **8/10**. The main scene is unobscured, the four view choices are clear, and chapter/mode/coverage controls are easy to locate. Muted small text and unused upper scene space remain modest readability/framing weaknesses. This score is separate from visual asset realism and physics validity.
