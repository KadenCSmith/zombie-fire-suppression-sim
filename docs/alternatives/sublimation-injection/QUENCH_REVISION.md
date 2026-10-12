# Visible quenching follow-up

The user explicitly requested seeing the illustrated fire put out after the on-grass water/dry-ice sequence. This follow-up adds an authored movie ending; it does not calculate extinction or alter the numerical source, temperature, oxygen, reaction, fuel or inventory histories.

## Display behavior

Water reaches the existing access, contact steam appears from presentation 60 s, and an expanding display mask reduces below-ground orange ember glow from 68–85 s. The coordinator's approved public-layer ending turns the alternative's original fire display off at 86 s. The normal independently selected 4.2.3 route stays unchanged. The screen labels this stage “Illustrative quenching,” and the descriptor explicitly distinguishes it from unavailable suppression predictions.

The private quench.tsx component owns its color/depth render target, fullscreen material/geometry and output scene. It renders original objects/materials unchanged, then uses depth-reconstructed world coordinates to reduce only below-ground orange glow within the authored contact mask. This is a display filter, not a wetting/temperature field. At zero or invalid progress it takes the original direct rendering path. It changes only the active render target during a frame and restores it in finally, including after errors. Camera matrices and render dimensions are read each frame. Owned targets/materials/geometry are disposed on unmount, and R3F unregisters the positive-priority render subscription. There is no traversal, material replacement, monkey-patch, original file edit or solver callback.

A selectively committed private work at 51e02e7, then fetched and ordinarily merged the exact coordinator-authorized 1ef3cf120b6ed85d52f60b748b0a97e6a3add616 checkpoint. That shared checkpoint supplies only the approved public fire-layer ending and integration tests/documentation. API v21.2 remains unchanged.

## Actual checks

After the checkpoint: npm run typecheck PASS; focused A, external scene composition and alternatives tests PASS, 61 tests / six files in 510 ms (39 method tests); npm run lint PASS with 16 inherited warnings; npm run build PASS in 2.48 s with inherited lucide/chunk warnings; whitespace PASS; all 57 protected original SHA-256 identities PASS against verified V20 commit 161e7a4a1f8c35765e1878c132db79977be1f5ea.

The new renderer tests verify direct zero-mask rendering, independent resources/uniforms, resized color/depth buffers, camera matrices, unchanged scene objects/materials, target restoration on failure, disposal, and stage order. They are unit tests, not GPU shader compilation or visual inspection. Existing tests continue to verify finite/source-off physical ledgers and absence of feedback from authored cue sampling.

Direct browser access in this chat remains blocked by an unavailable admin-policy check, and no bypass was attempted. The preview serves the new code, but native GPU compilation, visual quality and final integrated checks remain pending coordinator review of the frozen delivery. No heavy concurrent full suite was run.

Preview: http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1

Source changes remain inside the assigned sublimation-injection trees. Original fire/drilling are reused unchanged, and no field suppression or experimental validation is claimed. The final frozen pushed SHA and follow-up draft PR are supplied with delivery.
