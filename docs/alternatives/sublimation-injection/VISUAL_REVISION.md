# 4.2.1 presentation revision

The user requested a visual-quality revision after viewing the old Worker A preview. The original delivery at d061679 remains preserved. This follow-up replaces the private wireframe box, three opaque bubbles and straight line with an open material cutaway, translucent liquid, faceted solid medium, soft vapor sprites, curved delivery path, traveling contact cues and concise labels. All motion is authored from presentation time; it does not advance the solver or depict measured pressure, liquid pre-cooling, field penetration or suppression.

Private implementation checkpoint: c7d3c20. The coordinator explicitly authorized ordinary checkpoint merges of 0b300f71c4fb0c2be8313fb03dd4637d2971808d, 626b4b6c09940683152d5184a51b062481c1d37a and the published host-composition checkpoint 476e4a982c1dd26fe65c9c7ffe83180e9815e063. Private work was selectively committed first; all three merges completed without conflicts. API v21.2 and MethodCues({id,time}) remain unchanged.

The updated shared host reuses the original FireSequenceScene for fire and drilling at story 0–38 s, then promotes the private method view to a larger presentation area. That composition is coordinator work, brought into A's preview through the approved merges. This worker authored no shared host, CSS, global documentation, solver, package or lockfile edits.

## Private changes

- src/alternatives/sublimation-injection/scene.tsx: material cutaway, separate solid/liquid layers, soft presentation vapor, curved delivery and contact markers, lighting and labels.
- src/alternatives/sublimation-injection/visuals.ts: bounded, deterministic presentation transitions, independent from physical state.
- tests/alternatives/sublimation-injection/visuals.test.ts: seek/restart, finite inputs, phase order and smooth transition checks.
- This revision note.

No fire spread, drilling, soil-response or original-equipment implementation was copied or reconstructed. The open cutaway has arbitrary display coordinates and no construction dimensions, enclosure design, pressure gauge, trigger or pressure-device specifications. Fluid level is not a predicted inventory or pre-cooling result.

## Actual checks

After the approved host merges, npm run typecheck passed; npm test -- tests/alternatives/sublimation-injection passed 31 tests in three files (214 ms); npm run build passed (2.54 s) with the inherited lucide directive and chunk-size warnings. npm run lint passed immediately before the checkpoint merges, with the same 16 inherited warnings and none in private files. No private source changed after that lint run. The original-preservation guard passed after each checkpoint group and after the final checks: all 57 hashes match verified V20 commit 161e7a4a1f8c35765e1878c132db79977be1f5ea. Whitespace checks passed.

Port 5174 remains available. HTTP checks confirmed that it serves the updated original-animation host and new MediaCutaway, PhaseChange and DeliveryPath modules. This is a served-source check, not proof of rendering quality.

Direct in-app browser inspection was blocked because the browser security tool could not verify the admin-enforced policy. No bypass or alternate UI access was attempted. Visual composition, native screenshots and final integrated release checks remain for the coordinator's normal review. No heavy full suite was rerun during concurrent work, as requested in the checkpoint.

Preview: http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1

Final exact pushed SHA and follow-up draft PR are supplied with delivery. The worker freezes that SHA for review; the coordinator alone integrates or publishes the app.
