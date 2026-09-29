# 0.15 realism review — two of three permitted cycles

Reviewed 27 September 2026. The user requested a 1–10 realism score, revision below 7, and a maximum of three review cycles. **Cycle 2 reaches the visual threshold at 7.1/10.** No third visual revision cycle is required for the reviewed scope. Final movie encoding/playback and packaged application checks remain separate release gates.

Scores are editorial visual judgments, not experimental validation or an error percentage. They assess material appearance, coherent scale and contact, natural detail, readability, and obvious rendering artifacts. A 7 means a credible, polished scientific cutaway; it does not mean photorealism. Overall visual score is the lower of native and Blender scores so one presentation cannot conceal weaknesses in the other. Physical honesty is rated separately and never used to raise the realism score.

| Review cycle | Native visual realism | Blender preview realism | Overall visual score | Physical honesty | Disposition |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 7.2 | 6.3 | **6.3** | 9.0 | Revise |
| 2 | 7.4 | 7.1 | **7.1** | 9.0 | Visual threshold met |

## Review independence and evidence

The physics-audit reviewer did not author the scene geometry, grass, equipment, peat appearance, rupture animation or Blender render changes being assessed. The same reviewer previously contributed the interface layout; that part is not represented as a fully independent self-review. A separate agent who did not author the layout reviewed `Native-0.15-Excavator-Review.png` and rated interface framing/readability **8/10**, noting strong hierarchy and unobstructed scene space, with small muted labels and slightly conservative model framing still improvable. That interface score is not a physical-realism or validation score.

Compared the user's charcoal/teal cutaway reference and dense-grass reference with native captures and three Blender chapter stills in each cycle: gradual drilling at story 30 s, rapid pulse at 55.3 s, and persistent gaps/tracers at 64 s. Blender stills are 1280 × 720 EEVEE renders with 24 samples. Inspected the shared appearance generator, source-mode gating, scene shaders, Blender asset/construction scripts and relevant scope labels. These are sampled visual checks, not a frame-by-frame review of the final movies.

## Cycle 1 findings and revision

The native scene had convincing fine grass, branching tree anatomy, a recognizable compact excavator and a restrained interface. The film previews had stronger stylization: a pixel-stepped peat boundary, prominent repeated pale pebbles, coarse supplemental root rods, and cyan gas spheres that formed a solid bead/snake shape. The latter looked like a blue tube rather than an explicitly artificial gas-visibility cue. These artifacts held the film score below 7.

Cycle 2 smooths the displayed peat perimeter without changing accepted fields or the shared arrival ranks. The film lawn has fewer/smaller surface pebbles; supplemental roots are thinner with finer branches. Nineteen separated, nonuniform, much fainter gas wisps replace the connected cyan bead chain. The updated 64 s still visibly resolves the dominant gas-shape problem. Native boundary smoothing removes the conspicuous raster stair steps. The small bore, plate and attached auger remain legible, and the frame composition preserves the numerical inset and qualifiers.

The improvement warrants 7.1 for the films and 7.4 for the native scene. Remaining limitations include stylized flames and smoke, simple film tree/root anatomy, regular film lawn appearance, and schematic rigid soil-fragment opening. Native framing could enlarge the model modestly, and some fine interface labels could use more contrast. Those are disclosed quality limits rather than claims of photorealism.

After Cycle 2, two approved presentation-consistency changes were applied for the final render: the surface flame/smoke fades over story 20–27 s to match the live sequence, and a darker steel plate with a copper edge distinguishes it from the dry-ice source. They do not alter the accepted history or begin a third realism cycle. The scores above identify the hashed reviewed stills; final-film verification must confirm the delivered versions and these small changes.

## Physical honesty — 9/10, not an accuracy score

The accepted cache SHA-256 remains `212b82c7e51157c3d3f0bdd25408d7c383c00a324d3b60bf1e68828f6b9b25a0`; no `src/coupled` numerical modules changed in this revision. The shared seeded arrival order and 70% trigger remain authored appearance/sample-area measures, not computed fuel loss. Rapid uplift, rupture, debris and plate inversion remain prescribed; they do not feed the numerical field view. Rapid readouts hold the pre-treatment accepted state. Labels identify invisible CO₂ tracers and do not claim CO₂ combustion or detonation.

The underlying calculation still does not demonstrate a resolved travelling underground front, pressure-induced rupture, liquid infiltration or successful extinction. Its sustained oxidation and finite-source treatment history are distinct from the visual progression. More realistic presentation does not close those scientific gaps. This review therefore supplies no numerical-accuracy or suppression-efficacy rating.

## Reproducible image identity

The review PNGs are preserved under the task's `work/zombie-fire-unified/fire-sequence-0.15/` directory. Native PNGs are in the task's `outputs/` directory. Cycle 1 files are retained separately from Cycle 2. Hashes identify exactly the stills inspected, even if later delivery copies use different paths.

| Image | SHA-256 |
| --- | --- |
| `Cycle1-Preview-Excavator-015.png` | `93fa431a4f67ec7a9ad918867fea3b347004d052b7e9e0493371f44c37102562` |
| `Cycle1-Preview-Rapid-Pulse-015.png` | `5f2803685e30227405c94d3db9e0c1fc7e7b83877e94f673674c0bd61b51a016` |
| `Cycle1-Preview-Persistent-Gaps-015.png` | `092722a6fe48aa0902b6be42445d41af6045a1834fb469264a12dbb3a2d55bb0` |
| `Cycle2-Preview-Excavator-015.png` | `5e42cb75a6ca329ff66da67a4cfc452d6ab152bc3fd9c1cc0ab7d49ffecb651f` |
| `Cycle2-Preview-Rapid-Pulse-015.png` | `75d87ad485d0eb0e671385f4074d99542d47f1966bf02ffdb959c82455164d96` |
| `Cycle2-Preview-Persistent-Gaps-015.png` | `ab6033551989c079ad283cc72475a10c997799f8ce1004067c65ab7a0092293d` |
| `Native-0.15-Excavator-Review.png` | `f5fc38aae562c2be34a855fe756cebaeef3af3c55396b310125fb9939b2f8427` |
| `Native-0.15-Rapid-Review.png` | `626ec95615ec75a73efaef6606304c438ea60aef645c045248e10e33d1fe0460` |
| `Native-0.15-Underground-Spread.png` | `fc5192dac3e63dc37057170969b73302278379e892d28a04202e46e77964fe68` |

The native images are development previews, not proof of a packaged 0.15 installation. Final release verification must identify its own commit, asset hashes, encoded movie metadata and installed application version.
