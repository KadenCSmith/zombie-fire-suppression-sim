# Native release verification

27 September 2026. Root integration review on the user's Apple Silicon Mac.

## Reference 0.12.0

Frozen source: `1ec0710c4addc39f8aa1c06cf2a6b06840862d38`. The Mac arm64 ZIP and DMG were built from the committed source using the checked official Electron archive. Strict deep ad-hoc signature verification passed before and after clean ZIP extraction; architecture was verified as arm64; DMG integrity verification passed. These bundles are not Apple notarized.

Installed beside older versions as `~/Applications/Zombie Fire Suppression Sim 0.12.app`; no older app was replaced. CUA launched the installed bundle and observed its native window, new lab controls, natural cutaway, detailed tree and irregular aggregates. The startup preset displayed 2,560 elements and 10 physical seconds. The installed app subsequently displayed a complete 10 s reference run. CUA saved its export through the native Save dialog into the task outputs. The 20 MB JSON contains 21 accepted frames, 2,560 values per scalar field, complete status and a 20.776 s reported solve; it passes the strict Blender cache validator. This establishes native saving rather than relying on the earlier IAB download-event timeout. Separate browser checks inspected replay/comparison/cancellation; see `ui.md`.

GitHub verification for the reference commit passed macOS, Windows and Ubuntu checks, including both Electron smoke harnesses. This is CI execution, not a claim of shipped unified installers or native-device certification on all operating systems.

The original independently edited Stage2 Blender file retains SHA-256 `e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638`.

## Accuracy 0.13.0

Frozen source: `6ac5b404eb2f87894704e91c876a7a05887528d2`. Apple Silicon ZIP/DMG packaging, strict deep signatures, clean archive extraction and DMG integrity checks passed. The release and its source/manifest/checksums were published. This version was not separately installed and inspected; native interaction evidence above applies to 0.12 only.

## Fire sequence 0.14.0

The release source includes the complete fire-first workspace, finite-source experiment worker and two bundled Blender films. The exact packaged commit, Apple Silicon architecture, file hashes and editable-scene provenance are recorded in the release's `release-manifest.json` and film verification records. Post-build installation and UI inspection are recorded separately in `Native-Verification.json`, distributed with the [0.14 release](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.14.0), so the signed application's source commit stays fixed during its inspection.

The local source verification passed 171 tests in 30 files, typecheck, lint and production build. A Windows CI run of the earlier milestone exceeded the 5-second timeout in the legacy high-load soil test because it allocated a matcher for every damage value. The repaired test traverses the same values once and checks the identical monotonicity condition; no physical criterion or tolerance was changed. The fire smoke harness checks accepted history, both source presentations, live-worker completion/cancellation, retained workspace state, full-film metadata and native byte-range seeking. CI logs distinguish these automated checks from native interaction on the user's Mac.

The original independently edited Stage2 Blender SHA-256 was rechecked after the 0.14 scene changes and remains `e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638`.


## Visual revision 0.15.0

The development native window was visually checked at story19 s (44% illustrated involvement, no equipment),33 s (tracked excavator and narrowed bore),55.3 s (rapid soil separation/dust and plate),and the accepted temperature comparison. The final installed-app checks, exact package commit and cross-platform CI are recorded in the release asset `Native-0.15-Verification.json` to avoid changing the signed source while inspecting it. Surface propagation/pressure release remain staged; the accepted cache and original independent Blender source are unchanged.
