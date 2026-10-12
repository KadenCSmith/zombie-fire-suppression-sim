# 4.2.3.2 Rapid pressure change without liquid

This independent child supplies a source-free concept lifecycle and separately authored transient cue. Protected original/base 4.2.3 remains unchanged and independently callable; it is not imported, copied, relabeled or replaced. The environmental disturbance is a generic black box, with no assumed CO₂ source, thermodynamic properties, equipment construction, triggering, pressure optimization or device interpretation.

## Entry points and ownership

API **v21.2**: `index.ts` exports distinct `methodModule`/`variants`; `scene.tsx` exports `MethodCues`; `science.tsx` exports `MethodScience`. The private `model.ts` accepts only `pressure-only`, engine `concept`, medium `none` or `unspecified`. It rejects liquid/solid media and physical engines before invoking a hook. A cloned forwarded configuration sets intervention disabled and water, flow, solid inventory and thermal conductance to zero, protecting against stale calorimeter settings without mutating caller configuration. The shared concept lifecycle creates no calorimeter/FEM state and returns owned snapshots with null metrics. Shared jobs/IDs/cancellation/pause/reset/disposal remain the coordinator's responsibility. No private global mutable run state or frame-driven physical integration exists.

Preview: `http://127.0.0.1:5175/?alternative=pressure-only&method-preview=1`. An authored gold marker appears during 48–54 presentation seconds; a smooth dimensionless envelope `sin²(πu)`, `u=clamp((t-48)/6,0,1)`, controls opacity only. No spatial pressure distribution, sound speed, force or energy is implied. Soil geometry stays fixed. Access is a conceptual cutaway at host resolution, not excavator/drilling mechanics. There are no liquid lines, droplets, injection markers or contact patches at any preview time.

## Unsupported physics and units

No quantitative pressure, compressible multiphase transport, effective stress, strain, permeability/fracture evolution, soil rearrangement/collapse, field temperature, oxygen, fuel, reaction, suppression or re-ignition law is implemented. Those outputs are **N/A with reasons**, not zero-valued physical predictions. Rearrangement and collapse are hypotheses with competing possible responses, not favorable scripted outcomes. No equation/property reference can substitute for missing material/source data and calibrated coupling.

For a future model, source/boundary pressure would be Pa, source energy J, time s, temperature K, mass kg, displacement m and constitutive parameters explicitly dimensioned. None is assigned an invented value here. The only existing concept checkpoint is a presentation/lifecycle timestamp; it is not physical accepted time and cannot enter linked physical-time comparisons. Shared thermal fields remain inert in saved caller settings to preserve configuration compatibility, but this child removes their source content from its forwarded copy. It neither deletes species nor cools a field, and CO₂ is never treated as oxygen. No water, gas or external-energy ledger is produced because there is no supported physical model.

The description and draft number come directly from the user-supplied capstone subsection. There are no empirical measurements or specified material properties to cite for its mechanism. Neighboring official water-property references apply only to a separately chosen ordinary-water calorimeter, which this child never instantiates. Experimental validation has not been performed; interface and no-source tests do not validate a pressure/soil hypothesis.

## Virtual and proposed unperformed validation

Virtual checks are identity/rejection, zero forwarded sources, absence of physical state/metrics, identical intervention-on/off concept snapshots, independent simultaneous instances and snapshots, monotonic bounded checkpoints, and no liquid/soil movement cue at any preview time. Unavailable comparison dimensions stay N/A; no winner or suppression ranking can be inferred.

Proposed **unperformed** empirical sequence: a qualified laboratory would characterize nonreacting soil composition, dry/wet mass fraction basis, density, geometry and boundaries; independently measure an externally prescribed generic disturbance and soil response; use matched untreated controls, repeats and recorded uncertainty; and reserve independent data for constitutive/transport validation. Only then could a calibrated coupled model be assessed. Reactive thermal/species and re-ignition validation would require a separate protocol and window. This is a study outline, not a pressure-source apparatus, dosage or operating/construction instruction. No experiment has been performed.

## Cost scope

Modeled liquid consumption is absent; it does not establish zero financial or environmental cost. The pressure source, field access, delivery, energy, instrumentation, labor and disposal are unspecified, so their costs and total project price are **unavailable**. Supplier quotations and a defined approved study are prerequisites; inventing a parts list or equipment estimate would misrepresent the concept. Cost-effectiveness cannot be compared without validated outcomes and common boundaries.

## Verification

Run `npm test -- tests/alternatives/pressure-pulse-pressure-only`, then repository typecheck/lint/tests/build and `node scripts/check-original-preservation.mjs`. Seven child tests verify frozen descriptors, all forbidden engine/media branches, zero forwarded sources and input ownership, null physical outcomes, intervention-off identity, independent states/snapshots, bounded monotonic lifecycle and purely abstract no-liquid cues. See HANDOFF.md for final results and explicitly deferred integrated UI/native verification.
