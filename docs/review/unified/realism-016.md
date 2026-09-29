# 0.16 independent realism and scope review

Cycle 1 reviewed 27 September 2026; Cycles 2 and 3 reviewed 29 September 2026. **Formal Cycle 3 passes the visual threshold at 7.1/10 overall.** The user requires revision below 7 and a maximum of three formal review cycles. All three permitted cycles have now been used. Cycle 3 followed a hose-onset defect found during the separate full-film audit after Cycle 2. Final encoded-film, CI and packaged-app checks remain separate release gates. Preliminary author/root self-QA renders were not inspected or rated by this reviewer and are not review cycles. The separate frozen 0.15 review and its scores remain unchanged.

| Formal cycle | Live visual realism | Blender visual realism | Overall, lower of the two | Physical honesty | Disposition |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 7.2 | 6.7 | **6.7** | 9.0 | Revise Blender fracture appearance, then review Cycle 2 |
| 2 | 7.2, carried forward | 7.1 | **7.1** | 9.0 | Visual threshold met; proceed to full-film verification |
| 3 | 7.2, carried forward | 7.1 | **7.1** | 9.0 | Final permitted visual cycle passes; verify corrected encoded films |

These are editorial visual scores, not accuracy percentages, experimental validation, or suppression-efficacy ratings. A 7 means a credible scientific cutaway with remaining stylization, not photorealism. Physical honesty is scored separately and cannot raise the realism result. The reviewer did not author the implementation, geometry, shading, animations, interfaces, or thermal model assessed here. The only authored repository file is this review.

## Formal Cycle 1 findings

All seven named live captures and all twelve frozen Blender renders in the evidence tables below were opened and visually inspected. Scores use the visible materials, geometry, contact and stage changes rather than accepting captions as proof.

The live scene retains the dark cutaway, fine grass and connected root/peat anatomy. The 54 s and 56 s detail views show a materially larger shell changing from a downward bowl to an upward profile. The dry-ice sphere has visible clearance beneath the bowl. Soil is intact at 54 s and visibly fractured during the 55.4 s event. The pale hose bends across the surface and enters the bore; the 79 s and 90 s views retain substantial hot peat with localized darkening. Limits include very regular bright square ember flecks, faint weave at overview size, and small shoulder-engagement features that are less readable than the overall plate inversion. These support **7.2/10** for the inspected live view.

The Blender set shows the excavator/underreaming stage, a folded shell before deployment, the larger buried downward bowl, and its rapid inversion. The corrected hose has a continuous curved jacket; close inspection shows woven fabric texture and a longitudinal seam, consistent with the appearance reference. The 70.5 s lowering view and 78 s water view establish the staged insertion order. The hot layer reads as charcoal with localized incandescence rather than a continuous flame sheet. Darkened contact areas remain local at 90 s, and remote glowing material persists.

**The Blender fracture overlays are the required revision.** In `rapid-wedged-dome-detail.png` and `rapid-wet-contact-detail.png`, the thick black cylindrical paths look like rigid rods or pipes placed in front of the cutaway, not openings in soil. They cross and obscure the wet-contact region and shell. The actual irregular soil-piece gaps already convey rupture; the additional cylinders reduce both realism and contact readability. Replace them with narrow, surface-aligned fissure marks or remove the duplicate tubes while retaining the soil openings and rapid-event onset. Preserve the Cycle 1 files and use a separate Cycle 2 evidence directory. This visible defect holds Blender at **6.7/10**, hence overall **6.7/10**.

Remaining nonblocking stylization includes faceted repeated stones, simplified tree/roots, regular fine grass, repeated chevron-like ember details, blockwise separation of the illustrated soil, and a steel surface that is more uniformly mottled than fabricated sheet metal. The hose lowering is authored kinematics, not length-conserving hose feeding or cloth mechanics. The closeups make the shell inversion clear; exact wedge loads, insertion forces and soil bearing remain uncalculated.

## Formal Cycle 2 findings — threshold met

On 29 September 2026 the reviewer opened all twelve frozen Cycle 2 Blender PNGs listed below, including both fracture closeups, and independently recomputed their SHA-256 hashes. The live score remains **7.2/10** from the seven frozen live images already inspected in Cycle 1; this is a carried-forward result, not a claim that a new native-app capture was reviewed.

In the revised `rapid-wedged-dome-detail.png`, the thick cylindrical black rods have become narrow dark marks. The actual gaps between displaced soil pieces now provide the dominant visible fracture cue. This exposes the inverted shell profile, its side shoes and the shoulder region more clearly. The matching `rapid-wet-contact-detail.png` shows the continuous fabric hose, limited dark contact areas and restrained blue wetting lines without the earlier pipe-like obstruction. The 55.3 s release and 56 s wedged overview retain the event-stage rupture, while the 54 s deployed gradual view remains intact.

The gradual closeups retain the visible weave and seam, downward bowl and separate dry-ice clearance. The 70.5 s and 78 s views retain staged hose lowering followed by water. The 90 s rapid overview and wet-contact detail retain bright remote peat and localized darkening; there is no global visual extinguishment. The dark cutaway, detailed grass and recognizable excavator are retained.

The revision resolves the dominant Cycle 1 visual defect sufficiently for **Blender 7.1/10**. Overall is the lower of Blender 7.1 and live 7.2, hence **7.1/10**. Physical honesty remains **9.0/10**, separately, with the same model limits. No numerical accuracy or field-validation credit is assigned for improving a render.

Remaining quality limits prevent a higher score: the narrow crack/water marks are still schematic polylines and their attachment to displaced soil is imperfect in close view; soil separates as coarse illustrated pieces; ember chevrons, faceted stones and tree anatomy remain visibly stylized. Fine weave and shoe-to-soil contact are much clearer in closeups than in the film overview. These are recorded limitations, not a requirement to begin a third revision cycle. Final film samples must preserve this accepted thinner-fracture appearance and the contact/source distinctions; the final encoded films were not inspected as part of this still-image review.

## Formal Cycle 3 findings — audit-triggered correction, final cycle

After Cycle 2, the independent full-film audit reported an inflated/overlapping hose at story 69 s, a stage absent from the earlier twelve-view sets. The implementation owner traced it to several 0.1 s story samples rounding to the same playback frame: their relative shape-key weights could overlap instead of selecting one hose pose. The reviewer read the corrected `hose_mesh` animation code in `integrations/blender-study/fire-sequence/contact_assets.py`; it selects one canonical sample per actual film frame and uses linear adjacent-frame weights. This was an implementation-owner correction, not code authored by the reviewer. The previously rejected encoded film was not independently watched by this reviewer; that finding is attributed to the separate film audit.

The reviewer opened **all sixteen frozen Cycle 3 PNGs** and independently recomputed the hashes below on 29 September 2026. Four additional views explicitly cover gradual and rapid hose onset at 69.0 s and entry at 69.5 s, as confirmed by their render sidecars. Both modes show a single continuous jacket at ordinary thickness, with a surface bend and short entering tail rather than an inflated overlapping bundle. At 70.5 s, the hose extends coherently down the shaft. The later hose closeup retains its weave and seam. This closes the newly sampled onset defect in the reviewed evidence; it does not claim that stills alone verify every animation frame.

The remaining twelve views retain the Cycle 2 improvements: narrow fracture marks and visible soil gaps, the large downward-to-upward shell profile, visible dry-ice clearance, localized wet/dim contact areas, and substantial remote hot peat at 90 s. No new material or geometry regression is apparent in this set. The prior limitations of schematic wetting polylines, coarse soil pieces, stylized embers/tree/stones and authored non-length-conserving hose insertion remain.

**Cycle 3 scores: live 7.2/10 carried forward from the inspected live evidence; Blender 7.1/10; overall 7.1/10, the lower score. Physical honesty remains 9.0/10 separately.** This is the third and final permitted formal realism cycle and it passes the user's threshold. The final movies must be encoded from the corrected scene and checked independently for complete decoding and the repaired onset interval. This review does not replace that delivery audit or claim native-package verification.

## Physical honesty and independent code checks

**Physical honesty: 9.0/10.** The contact model is a separate finite-inventory, near-atmospheric open enthalpy balance for thirteen assumed 0.5 kg specimens. It is not the accepted 24-hour fire calculation, a spatial thermal solve, pore-water infiltration, or a coupled treatment experiment. Dry-ice sublimation, retained-water sensible heat and escaping vapor sensible-plus-latent enthalpy have explicit destinations. Uncontacted water is booked as bypass. Rapid residual dry ice is exported without gas-conversion, heat-removal or explosive-energy credit. The lower dry-contact validity stop is explicit rather than presented as a physical equilibrium.

The assumed thermal masses, conductances, arrival schedule and projected halo footprints are uncalibrated. Ongoing oxidation, internal thermal replenishment, pressure-dependent phase change, direct water/dry-ice exchange, freezing and mechanical work are absent. Visible wetting extent and crack paths remain authored. These are important limits of what the calculation answers; a balanced ledger does not validate the contact rates, rupture, field cooling or extinguishment. No numerical-accuracy or treatment-effectiveness score is assigned.

The reviewer independently ran `npx vitest run tests/contactCooling.test.ts tests/fireSequence.test.ts tests/fireAppearance.test.ts`: **30 tests in 3 files passed** on 27 September 2026. The checks cover analytic thermal limits, finite source/water inventories, sensible-plus-latent vapor cost, balance residuals, timestep refinement, deterministic scrubbing, 70% illustrated gating, geometry/timing contracts, and limited wetting. This is focused numerical/implementation verification, not an independent experimental validation or a whole-app release check.

The reviewer independently compared `public/fire-sequence-cache.json` with the file at frozen 0.15 commit `223eda6f7a8e29291ebb5844fc2aa3f655f5d1cb`: both SHA-256 values are `212b82c7e51157c3d3f0bdd25408d7c383c00a324d3b60bf1e68828f6b9b25a0`. No `src/coupled` paths differ from that frozen commit at this review. The [NIST carbon-dioxide phase-change table](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=35) was independently checked: its rounded 25.2 kJ/mol sublimation datum near 195 K supports the approximate latent-heat budget, not the assumed conductance or a pressure-release model.

The preliminary review found stale source captions and a short live sphere fade after the ledger exported its mass. Source captions now distinguish the separate contact inventory, rapid wording identifies residual export, and live source mass now directly reads the contact ledger. The seven frozen live screenshots precede those wording/display consistency fixes; they are not falsely identified as screenshots of later code. A subsequent read-only review of the Tree shader-hook cleanup/deduplication fix found it coherent for effect replay and view remounts; browser roundtrip and final CI proof remain the release owner's checks.

## Evidence identity and limits

The live captures are in-app-browser evidence, **not native packaged-app verification**. Blender stills are 1280 × 720 renders of the editable scene, **not decoded evidence of final MP4s**. Neither full film had been encoded at Cycle 1; a subsequent film audit triggered Cycle 3, whose corrected final encodes remain a separate check. The final-film auditor must verify both complete corrected movies, their identity and sampled appearance; the release owner must verify packaging, installation and final CI. Review scores apply to the exact files below. At Cycle 1, source work was at HEAD `2608f6ee9bdcb0978240474dd8ba439157faee20` with later uncommitted changes; the source hashes below identify the stable reviewed thermal files more precisely.

Absolute live evidence directory: `/Users/kadensmith/Documents/Codex/2026-09-27/zombie-fire-hose-cooling/outputs/`. Each filename below appended to that directory is its exact inspected path.

| Inspected live file | Story stage | SHA-256 |
| --- | --- | --- |
| `Live-0.16-Cycle1-Before.png` | 54 s overview | `9e6209466b26b8637b7f555cbee819cb49495a2594004e8f01b1df00f16909df` |
| `Live-0.16-Cycle1-Event.png` | 55.4 s event | `2cbc40e252d97a29ba6cf69ce1618d6357a78dde4d6b43df1c0737a6e20aea06` |
| `Live-0.16-Cycle1-Water.png` | 79 s water | `f92c5627c697fb66d9ca2dec19b3ba53596cba5ad803ab5c4beabce3ed9881b7` |
| `Live-0.16-Cycle1-Residual.png` | 90 s residual heat | `5cae67b0f4c49062b20e591060f417ef2aff70d34ec645a02f8667628dde3344` |
| `Live-0.16-Cycle1-Hose-Detail.png` | 90 s close view | `4fa1c84936de487f0e63067f2bffc732ab0b9ef9744a1e3b445b112df9e367b4` |
| `Live-0.16-Cycle1-Dome-Before-Detail.png` | 54 s downward bowl | `f4781e745b645b5c9eb5fe9075b78db75e0299145df2400168b5e571e89d4fa8` |
| `Live-0.16-Cycle1-Dome-After-Detail.png` | 56 s inverted shell | `7ef17c226599557a9475b6652fd67a60d59a5d28ea50a566c84a7c2182c8973c` |

Absolute Blender Cycle 1 evidence directory: `/Users/kadensmith/Documents/Codex/2026-09-27/zombie-fire-hose-cooling/outputs/Fire-Sequence-0.16/previews/cycle1/`. Each filename below appended to that directory is its exact inspected path. Hashes were independently recomputed and agree with `Review-Images.json`.

| Inspected Blender file | SHA-256 |
| --- | --- |
| `gradual-underream.png` | `a471242dd9c6bbfd31b942e8e0f866a3d5550b4e9cd0efb4e0820ae285b28bd4` |
| `gradual-folded.png` | `1a69db20a9957a927295a57bf874a286a784379be16750121ddfdbaa72b9b3e4` |
| `gradual-deployed.png` | `e3a94cb19859dff548df528ac3d4ff239ae4c9fd4b3125d9428283be48c83960` |
| `rapid-release.png` | `14ca5ca0fe72019e872295e4bb6321a4f22d0b3ae46faec3149be6ace58905a5` |
| `rapid-wedged.png` | `5a38978f9e7af86807bdf601f2f7f5790af61036dd14a080c7c6bfcb190fde08` |
| `gradual-hose-lowering.png` | `8679758596cbd2a42e7b9096c0371f9a25ddd73da23aef95d4b189c6bb2f4227` |
| `gradual-hose-water.png` | `32c289a8d12f8484e92d2922bcdc900ba01a3e8272978b261314e816df02bfba` |
| `rapid-cooled.png` | `d4452ad109862d9f42b460f186694a1fc4b7dd9dd2f449e616f1a58a62e37fe7` |
| `gradual-hose-detail.png` | `7e53ad3aebf721c1d183a8296b57af34d43d809ec6f5bb29feb7b492ef3bb44a` |
| `gradual-downward-dome-detail.png` | `0ed1d1cccb4423f9ef259cdef294ae4beead6cfba26d55e20664e281e4794138` |
| `rapid-wedged-dome-detail.png` | `2443f6e933a0b447915f438f81a49a8fa5c2620ba19cbe6321a5ee2d0241a294` |
| `rapid-wet-contact-detail.png` | `2da037a0181279d248599021f3427e9a538695966acafee4f958070c80d150d8` |

Absolute Blender Cycle 2 evidence directory: `/Users/kadensmith/Documents/Codex/2026-09-27/zombie-fire-hose-cooling/outputs/Fire-Sequence-0.16/previews/cycle2/`. Each filename below appended to that directory is its exact inspected path. All twelve were opened on 29 September 2026. The sidecar render records identify 1280 × 720 EEVEE stills at 24 samples; the hose-lowering record identifies story time 70.5 s, and wet-contact detail identifies 90 s.

| Inspected Blender Cycle 2 file | SHA-256 |
| --- | --- |
| `gradual-underream.png` | `ecb3f6c3e796a91aefd62c3d53c6a475302f0010563878017f9e8d96eb1d93f6` |
| `gradual-folded.png` | `cf375fb2bbcd515f0f33b353da4f5d99ab02ec0ee535c49f6bc229d1f47a8232` |
| `gradual-deployed.png` | `daf35e8f2a831df2ef0a73c468a262da40cf9a7afefb0dd64a18003eeaeba93c` |
| `rapid-release.png` | `0ca39d5da5ae026df40ab142133ab5b4c9b3c0db27fee1dfaf36e4080e976a40` |
| `rapid-wedged.png` | `e33c868488c88bced23972e2775202d1da86456275f0b324d8dcedfa90803cd1` |
| `gradual-hose-lowering.png` | `948f600c18acbb0c4a8126c3249e4181a000b8c81765b962aaf6345c1273db3a` |
| `gradual-hose-water.png` | `db7118cd4508f1c9c966d5943e717c6848e7a5ff263f658f88cd408fb21aa060` |
| `rapid-cooled.png` | `ac549611b59a3b734f2eee1a07b600b7f70de2fa277a81d2f990292a6257f400` |
| `gradual-hose-detail.png` | `ea24066de51df7717614c74773733d6753f5945e7d80e66430e4bc3b5c2da5e2` |
| `gradual-downward-dome-detail.png` | `d53a48b294ce2226b0cdc54d26232aab1646620e1391b2a975a23de89e4d1166` |
| `rapid-wedged-dome-detail.png` | `fc9e668ecd168c767f577b56f7b3fc108e55e8a4cf2c7a74d55850f79b5c419f` |
| `rapid-wet-contact-detail.png` | `926abe17e70482addd4e918bfd128fc2ed253de1a1921a3e311676adeb94d18c` |

Absolute Blender Cycle 3 evidence directory: `/Users/kadensmith/Documents/Codex/2026-09-27/zombie-fire-hose-cooling/outputs/Fire-Sequence-0.16/previews/cycle3/`. Each filename below appended to that directory is its exact inspected path. All sixteen were opened on 29 September 2026. The four onset/entry sidecars confirm 69.0/69.5 s respectively, at 1280 × 720 and 24 samples.

| Inspected Blender Cycle 3 file | SHA-256 |
| --- | --- |
| `gradual-underream.png` | `9cd85e07cc484303ef1280bce99feb3da3a9de8754dba26baa5496538062fc34` |
| `gradual-folded.png` | `6089f9e27f85c7ee6ab3ffdf8a56702a9971d4458115f2e7ba76b2880141a448` |
| `gradual-deployed.png` | `70bfa37818cff1ce78029ddbc7c26a1601f3674389517c0666e231fd046a8685` |
| `rapid-release.png` | `2864273e241cd288897562871873d063bbc47bb23caba76be2abc17a2839af4b` |
| `rapid-wedged.png` | `49fdbb6fa9e62ce00eba6b48a4b7b3decb67efaec0c51470386c85e8ebe02999` |
| `gradual-hose-onset.png` | `7da846e72724e48d7ebfccfce5c187e85935c180ead9c7a4135c3c0b74a65d1c` |
| `gradual-hose-entry.png` | `e2adec666c209badbfcf5e0fa6650ec89bd6342749eb46cf96c2335f0f7a8af0` |
| `rapid-hose-onset.png` | `1117979c58d9bf1a11688df3048b5c21c629916e363e98b3eed1699f2b601cb7` |
| `rapid-hose-entry.png` | `ef3ec73173cb82430462243c5c506166622f6b39ff56782d618f14b89af24da2` |
| `gradual-hose-lowering.png` | `035d684568a177c496001adf8f252b1165c3847269f226e45e92cd7345414915` |
| `gradual-hose-water.png` | `810d6bdeb2f9a5bd6f58f95bc1b9785a0196628378ff43035f8f8db6058eada3` |
| `rapid-cooled.png` | `8a32d9f63e6b20c9995c4f85c79f49f77c4457201f9e286b05c5e0c4ad6f56f5` |
| `gradual-hose-detail.png` | `a7525460de00905827715bfa120d1ba8699a2bafaa55ec0ee607169f257517d4` |
| `gradual-downward-dome-detail.png` | `c7bc3e460234c11fbef08a403c3a8cc623425b8adbae50c4907811006819eacb` |
| `rapid-wedged-dome-detail.png` | `98ee144cd47679adf8ea5e53ca870d1e8a42643edaef00ad8672a0d88bdc654b` |
| `rapid-wet-contact-detail.png` | `fcff8ef14a8e5a24f3497487031f5144721888f5d2b3bd390e705658257e576c` |

Appearance reference actually opened: `/Users/kadensmith/Documents/Codex/2026-09-27/users-kadensmith-documents-codex-2026-09/outputs/Hose-Appearance-Reference.png`, SHA-256 `16a5268cbb7a2c56ea8393e0207aa0ee15fcb31644680d12fe02f8934f04c485`. It informed jacket appearance only; the reviewed weave is procedural and no stock pixels were redistributed in it.

Reviewed repository directory: `/Users/kadensmith/Documents/Codex/2026-09-27/users-kadensmith-documents-codex-2026-09/outputs/zombie-fire-unified/`.

| Stable reviewed source/evidence path relative to that repository | SHA-256 |
| --- | --- |
| `src/story/contactCooling.ts` | `ff39288463fcd9ea187dc6549747a4f2579a2a279b682aa3114a98f8ecd92622` |
| `tests/contactCooling.test.ts` | `ac5065dcb41ee8939d2dad3d82d4477418dee4a76f95415ac456bbee8939fa71` |
| `docs/CONTACT_COOLING.md` | `93ccbea7f360955592d7e7de8adbfb542467d82ef8bc56d44660d848addffaf5` |
| `public/fire-sequence-cache.json` | `212b82c7e51157c3d3f0bdd25408d7c383c00a324d3b60bf1e68828f6b9b25a0` |

All four stable hashes above were rechecked unchanged during Cycle 3 on 29 September 2026. The corrected Blender source read during that cycle, `integrations/blender-study/fire-sequence/contact_assets.py`, has SHA-256 `e560e69394d91ec4ca0b322c0b574a6a6cb371a0ed92dc7fcac17f8319923447`.

No folders were created for this review. The pre-existing Codex-created `docs/review/unified` folder already has a Red tag; Red precedence is retained. No signed-app folder was touched.
