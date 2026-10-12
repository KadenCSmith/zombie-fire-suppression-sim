# Worker B — shared realism round 1 and opposing-truck animation

## Current change

The user's latest selected-liquid request replaces fake expanding pressure rings with sharp ground jolts and progressively opening fissures, and adds two trucks approaching from opposite sides. The unchanged original water truck enters from the right at 57–65 presentation seconds and retains its original hose. The independently authored service truck enters from the left over the same interval; its lifting arm deploys a rigid silver pipe into the existing bore during 67–72 s. No additional original scene, source, water truck or hose is copied.

Original fire spread, drilling, dry-ice placement, cap and release remain the actual protected 4.2.3 exports through the unchanged external same-Canvas host. Normal water pumping starts at72s. At76–78/82–84/87–89s, private crack-bank meshes separate briefly, soil fragments and small turf pieces lift and settle, and the authored fissures remain wider/longer after each pulse. There are no private liquid ring or shell meshes. Existing wet/char coverage progresses72–89s and the alternative-only host ending remains89s.

These are explicitly authored visual outcomes, excluded from scientific realism credit. No calculated pressure, destructive setting, charge, dose, trigger, containment, permeability, cooling, oxygen removal, reaction, soil response or suppression claim is added. Pipe/vehicle geometry is display choreography, not equipment specifications. The finite-water calorimeter remains separate.

4.2.3.2 is unchanged by the direct visual follow-up: concept only, no liquid, solid or thermal source, no truck/hose or extinguishing, and physical metrics unavailable.

## Independent audit and shared counter

The signed coordinator record docs/review/version21/realism/ROUND_0_B.md identifies independent reviewer /root/realism_b_round0, baseline snapshot9ebda6fa plus frozen patch25c643abe579096acc7a401cc27aced343f1bd738660bc05d5209ba102a52062 and integrated B5373e535918c9f2ddd300d58cc48c3e449013cdc. Initial scores:

| Criterion weight | Liquid | Pressure only |
| --- | ---: | ---: |
| Physics/conservation30% |5|1|
| Materials/constitutive20% |3|1|
| Numerical verification/validation20% |5|2|
| Method coupling20% |2|1|
| Computed visual correspondence10% |4|2|
| Weighted total |3.9|1.3|

Both have an unsupported-central-mechanism cap6 and neither has verified7. Initial audit used one scored pass per alternative. This is assigned shared implementation round1; independent round1 scoring is pending. The shared counter permits at most rounds1–3 after round0, four scored passes total; it is never reset or self-scored.

Reviewer-executed evidence: 809/811 numerical assertions pass; two frozen early-fill water-temperature checks fail at0.05s. Worst error0.7737119256911456K exceeds0.2K. Independent conservation checks across33cases pass, maximum raw mass residual7.529532553007812e-13kg and raw energy residual1.4761462807655334e-7J. Fixed-water exchange, phase/depletion limits, finite inventories and guards pass. No empirical validation or pressure response model exists.

Coordinator owns a supported nonprotected alternative-only step-policy correction to0.00625s; independent diagnostic worst early-fill error0.1054885099070475K passes the same frozen0.2K tolerance. The original protected reference/defaults must remain unchanged. Exact published checkpoint d07d03fe54b453677c2cd8684e8e2c5eb97112a6 was fetched, verified remotely reachable and ordinary-merged at3aaf63b755e18d353469d833408468661a866a7a, with all57protected hashes passing. No private source changes the numerical step; the external adapter now requests0.00625s. The initial failed checks are retained, never relabeled as passes.

Essential blockers to verified7 remain measured generic environmental pressure history/domain/boundaries, calibrated peat constitutive and transport properties, supported pressure/momentum/soil/liquid coupling, and independently validated thermal/oxygen/moisture/fuel/reaction behavior over a suppression/re-ignition observation window. Graphics and disclosures cannot supply these.

## Implementation and verification

Branch feature/v21-pressure-pulse, exclusive checkout outputs/v21-agent-pressure, APIv21.2. Existing narrow exports remain unchanged. New owned equipment.tsx and groundPulse.tsx implement the vehicle/rigid-pipe choreography and disposable crack-bank geometries. All poses derive from presentation timestamps, with no private timer or numerical source. Tests exercise opposing arrival, pipe lowering before flow, actual mesh displacement/extension, settling, deterministic seeking and numerical independence.

After exact shared checkpoint merge:59/59 scoped/private/composition/infusion/worker/comparison checksPASS in9files,0.936s; typecheckPASS; lintPASS with16 inherited warnings outside B; production buildPASS3.08s; whitespacePASS; all57protected identitiesPASS against established161e7a4a1f8c35765e1878c132db79977be1f5ea. No full-suite/performance/FPS/experimental claim is made; coordinator owns final integrated suite and native/GPU gates.

Reproduce:
- npm test -- tests/alternatives/pressure-pulse-liquid-waves tests/alternatives/pressure-pulse-pressure-only tests/alternatives-infusion-accuracy.test.ts tests/alternatives.test.ts tests/alternatives-contact-adapter.test.ts tests/alternatives-worker.test.ts tests/alternativeSceneComposition.test.tsx
- npm run typecheck
- npm run lint
- npm run build
- node scripts/check-original-preservation.mjs
- git diff --check

B browser access is denied because the admin-enforced browser security policy could not be verified. No bypass or indirect browser automation was attempted. B does not claim its own browser inspection. Coordinator independently inspected the normal Chrome5175preview at77s: left service truck, unchanged right water truck, rigid silver conduit and ground fragments/fissures were visible, private cyan rings absent, original context in the same Canvas, and own-tab error log empty. Actual screenshot outputs/version21-pressure-round1-preview.png was supplied and viewed. This bounded visual check is not whole-native signoff, motion/FPS measurement, numerical validation or independent round1 scoring; early76.15s pulse and full lifecycle checks remain with coordinator/reviewer.

## Delivery and ownership

Only B's owned source/test/doc trees are authored. Original/shared code, package/lock, assets, timeline, camera, defaults and routes remain untouched. DraftPR20: https://github.com/KadenCSmith/zombie-fire-suppression-sim/pull/20. Exact final source/checkpoint identity is supplied in the frozen delivery message. Earlier PR12/16/17 are historical merged deliveries.

Live user-selected preview: http://127.0.0.1:5175/?alternative=liquid-waves&method-preview=1
Independent pressure-only preview: http://127.0.0.1:5175/?alternative=pressure-only&method-preview=1

The previous5175server had exited; B verified no listener and restarted its own assigned server in session73731 (ready106ms), nodePID23307, leaving it running. No new top-level folder, dependency, port, background watcher, release or permission change was created. Finder tagging does not apply.
