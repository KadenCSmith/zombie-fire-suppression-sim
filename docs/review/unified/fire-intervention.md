# Independent finite-source intervention review

Review 1/1, scoped to the new placement API and cold ignition protocol. Reviewer: physics audit agent, independent of the `model.ts` intervention author.

Disposition: accepted for an explicit reduced transport intervention, with the limitations below. No acceptance is given for resolved drilling, collision, fracture, dome loading or extinction prediction.

The source import preserves elapsed time, thermal/gas inventories and the original conservation baseline. Imported mass and solid internal energy have separate ledger terms. Positive gas compression work is supplied by placement and entered with the correct pressure-work sign. The existing post-step energy balance remains intact. Solid CO₂ is outside gas-species totals until sublimation, so the existing emitted-species bookkeeping remains applicable. Finite-step compression uses the trapezoidal pressure-volume work already used by the reduced model; it is not an exact moving-contact solution.

Two review findings were repaired before acceptance: source geometry must participate in checkpoint/restore, and a future scheduled igniter must prevent source relocation unless disabled. The implementation now restores source weights and centre before phase resolution; active and future heating schedules are blocked. Unsupported mass, temperature, domain placement, pore exhaustion and pressure states retain the numerical guards.

Independent validation ran `tests/dryIceIntervention.test.ts` and `tests/fireProtocol.test.ts`: seven tests passed. They cover imported mass/energy with prior history retained, subsequent finite sublimation, placement rollback, invalid/duplicate insertion rejection, cold wet initial conditions, finite heater energy and cutoff, and input validation. Broader verification and actual long-duration treatment results are recorded separately; these tests do not establish experimental accuracy.

Scientific confidence remains limited by the existing one-step combustion surrogate, unresolved cell size, assumed surface film and absence of liquid transport. The actual cold-start run establishes sustained surface oxidation; its reacting-cell depth does not show a resolved underground front. Presentation must retain that distinction.
