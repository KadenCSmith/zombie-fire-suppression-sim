# 0.16 checkpoint — incomplete release

Checkpointed before beginning the multi-version comparison and layout work.

## Completed

- Added the separate finite dry-ice/water contact-cooling model, generated data, tests, documentation, and UI readouts.
- Added the woven hose, underreamed chamber, deployable buried dome, local wetting cues, and matching Blender scene generation/verification tools.
- Preserved the accepted numerical cache and all 0.15 delivery files; the original user-edited Blender source remains unchanged.
- Passed 193 tests in 32 files, typecheck, lint, a production build, browser view switching, and the implementation CI run at commit `2608f6e`.
- Completed three independent realism cycles. The final accepted score is 7.1/10 overall (live 7.2, Blender 7.1); physical honesty is separately scored 9.0/10 and is not experimental validation.
- Corrected a Tree shader-hook replay/remount defect and added a smoke-test failure gate for Three.js shader compilation errors.

## Partial / current state

- The full-film audit found a Blender hose-onset shape-key collision at story 69 s. The builder and verifier now select one pose per encoded frame and enforce a finite jacket diameter. The rebuilt editable scene passes both the repository verifier and an independent read-only check across every lowering frame.
- Cycle 3 stills include the repaired 69 s and 69.5 s onset and passed review. The two complete MP4s currently in the external task output directory predate that correction and must be re-rendered before release.
- The first decoded-film caption concern was traced to the audit capture path rather than the encoded film. Final replacement-film decoding is still required.

## Remaining release work

1. Re-render both corrected 864-frame films and regenerate their chapter stills/contact sheet.
2. Complete independent full-frame decode and sampled visual audit of the replacement films.
3. Embed the verified films, run final tests/build/smoke checks, package and inspect the versioned Mac app, and publish the 0.16 release artifacts.
4. Update final validation/build records, preservation evidence, Finder tags, secondary handoff, and release/PR metadata.

This checkpoint intentionally records unfinished work. It is not a release, deployment, or experimental validation claim.
