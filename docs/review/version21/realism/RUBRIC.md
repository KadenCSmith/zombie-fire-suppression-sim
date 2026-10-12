# Frozen scientific-realism rubric — round 0

Human-invoked source: `/Users/kadensmith/Downloads/V21_Realism_Review_Loop.md`. This engineering assessment is not certification or experimental validation. Published before any realism implementation changes. Existing in-flight work has been preserved and frozen; reviewers do not edit implementation files.

## Snapshot and ownership

Coordinator: `integration/v21-alternatives`, commit `9ebda6fae2e4101c80cd7b4e35f7ea13444263f9`, plus the preserved pre-review uncommitted diff SHA-256 `25c643abe579096acc7a401cc27aced343f1bd738660bc05d5209ba102a52062` (`work/version21-realism-initial.patch`). Additional pre-review native test files: `scripts/smoke-alternative-gpu.cjs` SHA-256 `44cfc1c8cca126d9790fbd010c4c7c271040b275f8f5fc3d5368afb77e02b9a2`; `scripts/smoke-vibratory-field.cjs` SHA-256 `a3dc9192c7ab9710db49af45f1a43c65743912c43eb6750b691d3f3559a26ffe`. The latter fixture is syntax-checked but unexecuted. Source changes in that diff preceded the realism request; no further implementation changes are allowed before the independent initial audits.

Original4.2.3 baseline `161e7a4a1f8c35765e1878c132db79977be1f5ea`; all57 protected identities pass. Exact paths/evidence remain in `../original-preservation.json` and `../READY.md`. No original edits, extraction, copying/relabeling or changed protected dependencies are authorized.

Frozen worker deliveries already integrated: A `22a60811f9c9381ea38085e4cc03aff6e559dbec`, B `5373e535918c9f2ddd300d58cc48c3e449013cdc`, C `47cbbb8c535aff159102b481d187b9dc3203ac50`. Existing exclusive branches/checkouts/source-test-doc trees remain authoritative. New independent reviewers use isolated test workspaces under ignored `work/version21-realism/round-0/`, with their own dependencies and outputs; no implementation or worker branch mutations.

## Fixed weights, evidence and gates

| Criterion | Weight | Required evidence |
| --- | --- | --- |
| Governing physics and conservation |30%| Actual equations/state variables, SI/kelvin and fraction bases; finite inventories; independent dimensional/closed-system balances; intervention-off and limiting cases. No unexplained heat, species deletion or credited authored effects. |
| Medium/soil properties and constitutive behavior |20%| Actual parameter values/ranges and primary references; phase/EOS/transport/reaction/soil assumptions and validity; sensitivity to materially different conditions. Missing constitutive behavior remains unavailable. |
| Numerical verification and independent validation |20%| Reviewer-executed checks in an isolated workspace; independently justified analytical/reference benchmarks; timestep/mesh/support sensitivity where applicable; measured-data comparison and uncertainty if claimed. Tests are not experiments. |
| Method-specific mechanism and coupling |20%| Trace the central surface sublimation/injection, pulse/liquid response, pressure-only response, or vibratory continuous-injection mechanism into actual conservative source/transport/mechanical equations. Unsupported central mechanisms cap total at6. |
| Visual correspondence to computed states |10%| Actual application observation at representative/different accepted states; timestamps/units/geometry/readouts agree; authored fire-out/shaking/pressure cues remain excluded from physical evidence. Unavailable browser evidence is unverified. |

Score each criterion1–10. Anchors:1–3 substantially illustrative/incorrect;4–6 partial physics with major missing mechanisms/evidence;7–8 credible within explicitly tested bounds;9–10 exceptionally strong independent validation/robustness. Weighted arithmetic is recorded unrounded; final score=min(arithmetic,6) if a central mechanism is unsupported. Serious unresolved conservation/unit/stability defects prevent passing. Every defined alternative must independently reach verified≥7; no averaging, aesthetic credit, rubric changes or labeling-based score gains.4.2.2 stays definition-pending and outside predictive scoring.

## Comparable benchmark protocol

Before executing new benchmarks, each reviewer records exact settings, expected solution/reference, tolerances and runtime environment in its round0 audit. Use unchanged defaults plus source-off, finite exhaustion, physically valid low/high inlet conditions and representative supported variations. Independent calorimeter references use closed-system weighted equilibrium and the analytical two-body exponential exchange, excluding boiling/phase boundaries unless independently accounted. Conservation tolerances: mass/species≤1e−9kg+1e−9×inventory scale; energy≤1e−4J+1e−9×energy scale. These are double-precision implementation checks, not empirical accuracy tolerances.

Reacting-field checks retain raw and source-corrected balances; compare source-off against the same independently initialized unchanged core where possible; dose only accepted time; include finite depletion, source-start/stop and moving-tip boundaries. Timestep refinement uses successive halving with unchanged physical inputs; mesh comparisons hold physical source support fixed or explicitly report confounding support changes. Freeze representative initial/boundary/material choices before execution. Report failures/unrun checks and any justified benchmark correction transparently; never tune expected values to outputs. Published measurements or primary reference benchmarks are required to claim independent physical validation.

Pressure remains an abstract environmental input. No device, charge, dose, destructive pressure, containment or trigger optimization. No arbitrary permeability, fabricated fracture/collapse or scripted suppression can improve realism. If a central model or essential data is absent, report the exact missing evidence; do not guess it.

## Shared retry ledger

Initial shared round0 is complete: signed A/B/C audits use1 scored pass per alternative. Current shared round and exact retry accounting are maintained in [LEDGER.md](LEDGER.md); this fixed rubric and benchmark criteria remain unchanged. At most3 implementation/review retries follow (rounds1,2,3); four scored passes maximum per alternative. The counter never resets across agents/subtasks. Passing alternatives stop unless later shared changes invalidate evidence, still within this budget. Failing alternatives continue justified corrections when the coordinator assigns the next shared round; a failed score or passing unit suite is not completion. If essential data/scope prevents meaningful improvement, stop below7 with a concrete blocker rather than fabricate a pass or retry indefinitely.

Coordinator alone integrates exact frozen retry deliveries, verifies original/comparison behavior, and publishes the authorized main/GitHub/Mac update after the loop and project gates. Current release/install remain pending. All earlier work is preserved.
