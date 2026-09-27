# Separate finite-inventory contact calorimeter (0.16)

`src/story/contactCooling.ts` calculates a small, explicitly assumed hot-contact case for the natural presentation. It conserves mass and an **open, near-atmospheric enthalpy balance** for finite dry ice, finite incoming water and thirteen small hot specimens. It does not solve a peat fire, oxygen exclusion, pressure release, pore-water infiltration or a treatment outcome. It is not experimentally validated.

The natural-scene sphere uses this calculation's remaining dry-ice inventory. The existing accepted 24-hour fire plus 30-second treatment cache is a **different calculation**, preserved unchanged for temperature/oxygen/CO₂ evidence. Do not add these contact temperatures, inventories or extracted heat to that cache; do not describe the two as one coupled experiment. In particular, the contact demonstration begins before the accepted cache's treatment branch.

## Domain and assumptions

- Thirteen independent 0.5 kg hot specimens, each initialized at 823.15 K (550°C); total modeled dry mass is 6.5 kg. Their constant heat capacity is 1840 J/(kg K). These small thermal masses describe accessible contact material, not the complete illustrated peat lens.
- One projected halo is at the bore base, `(x,y)=(0.4,-1.44)` m, with display radius 0.20 m. Twelve projected halos lie at arc-length fractions 0.20 and 0.45 on the six shared story paths, with radii 0.14 and 0.17 m. The halos are rendering footprints, **not overlapping spatial control volumes or measured thermal penetration distances**. Rendering applies their cooling only to already involved peat. The model does not ignite other ground.
- The central specimen contacts a single finite 4 kg dry-ice source from story time 44 s. Its assumed conductance is 8 W/K; all other specimens have zero dry-ice contact. Dry ice is at 194.67 K. Only sublimation heat is credited; no extra cooling credit for warming outgoing CO₂ is assumed.
- A finite 5 kg water reservoir supplies 0.22 kg/s from story time 72 s, after hose placement. Each specimen receives a fixed 1/13 share only after its prescribed arrival time. Unallocated or not-yet-arrived shares exit the modeled hot-contact subset as `waterBypassKg`, at inlet reference enthalpy; they are not silently stored or subsequently reused.
- Water arrival is the inverse of the exact shared `storyWettingProgress` function, rather than another timing curve: `front = 0.66 sqrt(clamp((t - 72 - 0.65 branch)/18, 0, 1))`. The near and far contact points are first reached at approximately 73.653–76.903 s and 80.368–83.618 s. These are authored contact times, not Darcy/Richards flow results or predictions of water speed through peat.
- Each water contact has an assumed 48 W/K conductance. Water enters at 293.15 K, has constant heat capacity 4186 J/(kg K), boils at 373.15 K and uses a rounded 2.26 MJ/kg vaporization enthalpy. Locally retained liquid and escaped saturated vapor are both booked. `wetness = min(liquidWaterKg / 0.15 kg, 1)` is a display scale, not saturation or volumetric moisture content.
- One contact-model second corresponds to one story second from 44 s onward. The separate playback mapping compresses the film. Neither clock establishes a field timescale.

Thermal conductances, contact masses, initial state, delivery rate, halo footprints and schedules are uncalibrated assumptions. Liquid retention is prescribed; internal conduction, spatial exchange among specimens, reactive heat release, smoldering chemistry, evaporation below the boiling point, gas heat transport, water/dry-ice direct contact, freezing and mechanical work are absent. Consequently, the heat budget is useful for an honest localized cooling illustration, not a forecast of extinguishment or a field application design.

## Heat and inventory equations

For specimen `i`, `Cp_i = m_i cp_peat`. Its tracked sensible enthalpy is `H_i = Cp_i (T_i - T_inlet)`. Before source exhaustion, dry contact over a step has the exact constant-sink solution

`Qd_i = Cp_i (T_i - T_dry) [1 - exp(-UA_dry_i dt / Cp_i)]`.

The total request is limited by `m_dry_remaining L_sub`; each credited `Qd_i` removes the same specimen heat and sublimes exactly `Qd_i/L_sub` kg. The active hot-contact domain excludes subambient cooling. If a request would cool a specimen below the 293.15 K boundary while dry ice remains, the dry-contact term stops at that boundary and sets `dryCoolingDomainLimitReached=true`. This is an explicit **model-validity limit**, not a claim that peat equilibrates with dry ice at room temperature. The default histories do not reach the limit. A colder/frozen extension requires a different phase model.

On each step, the allotted finite water mass is added at inlet reference enthalpy. With retained-liquid capacity `Cw` and temperature `Tw`, sensible exchange follows

`Qs = (Tp-Tw)/(1/Cp+1/Cw) × [1-exp(-UA_water (1/Cp+1/Cw) dt)]`.

This formula permits heat to return to peat if retained water is warmer. If liquid reaches the boiling point, the exact sensible time is removed from the step; the remaining interval transfers heat to a boiling reservoir, limited by the liquid inventory and the peat heat available above boiling. Every vaporized kilogram removes both its liquid sensible enthalpy and its latent heat. No vapor is created without paying both terms. Vapor exits at the assumed boiling point; steam superheat is excluded.

At the rapid event (55 s), remaining dry ice is moved into the explicit **exported residual inventory**. It receives no sublimation or cooling credit. This prescribed removal is an accounting boundary for the illustrative rapid event, not a thermodynamic phase conversion or a gas-production prediction. Gradual mode retains the finite source and continues contact cooling.

The independently recomputed residuals are:

`R_H = H_peat_initial - H_peat_current - Q_dry - H_liquid - H_vapor_out`;

`R_CO2 = m_dry_initial - m_dry_remaining - m_sublimated - m_exported`;

`R_water = m_water_initial - m_supply_remaining - m_bypass - m_liquid - m_vapor`.

The source phase datum is solid CO₂ at its sublimation temperature; inlet water and bypass water have zero enthalpy in the chosen reference. Sublimation/vaporization use enthalpy, including the near-atmospheric displacement contribution. This is **not** a closed-system internal-energy balance with an omitted pressure-work term. No heat credit, power or explosive yield is assigned to the prescribed rapid event.

## Numerical checks and default evidence

The default integration step is 0.05 s. Steps split at source removal, water start and each contact arrival; the integration grid is independent of display-frame requests. Copy-safe half-second checkpoints make interactive scrubbing inexpensive. The shared exported `.25 s` history carries the same state and ledger into Blender; interpolation is a presentation operation.

`npx vitest run tests/contactCooling.test.ts` passed **13 tests** on 2026-09-27. Tests cover the independent analytic dry-contact solution, finite sublimation capacity, rapid residual export without heat credit, no pre-contact cooling, mass/enthalpy conservation over both histories, finite water exhaustion and bypass, analytic sub-boiling exchange, the full sensible-plus-latent cost of vaporization, zero conductance, timestep refinement, deterministic scrubbing, the explicit lower validity stop, and invalid inputs. `npm run typecheck` also passed after adding the model. Whole-app checks and presentation review are recorded separately by the release owner.

Refinement of the final gradual contact temperatures against a 0.00625 s reference gave maximum differences of **0.462865, 0.263424, 0.139947 and 0.066694 K** for steps of 0.2, 0.1, 0.05 and 0.025 s. This decreasing discretization error verifies this reduced integration, not its assumed conductances or field accuracy.

| Mode / story time | Dry remaining / sublimed / exported, kg | Heat to dry ice, kJ | Heat to water, kJ | Water supplied / bypass / liquid / vapor, kg | Specimen range, °C |
|---|---|---:|---:|---|---|
| Both, 44 s | 4 / 0 / 0 | 0 | 0 | 0 / 0 / 0 / 0 | 550–550 |
| Gradual, 55 s | 3.907996 / 0.092004 / 0 | 52.7435 | 0 | 0 / 0 / 0 / 0 | 492.67–550 |
| Rapid, 55 s | 0 / 0.092004 / 3.907996 | 52.7435 | 0 | 0 / 0 / 0 / 0 | 492.67–550 |
| Gradual, 72 s | 3.782039 / 0.217961 / 0 | 124.9514 | 0 | 0 / 0 / 0 / 0 | 414.18–550 |
| Gradual, 78 s | 3.745390 / 0.254610 / 0 | 145.9615 | 400.8807 | 1.32 / 0.942063 / 0.256558 / 0.121379 | 310.07–550 |
| Rapid, 78 s | 0 / 0.092004 / 3.907996 | 52.7435 | 423.3699 | 1.32 / 0.942063 / 0.246607 / 0.131330 | 386.95–550 |
| Gradual, 90 s | 3.691758 / 0.308242 / 0 | 176.7075 | 2333.5906 | 3.96 / 1.347483 / 1.965856 / 0.646661 | 187.76–422.38 |
| Rapid, 90 s | 0 / 0.092004 / 3.907996 | 52.7435 | 2397.1937 | 3.96 / 1.347483 / 1.938927 / 0.673590 | 253.37–422.38 |

At 90 s, each mode still has 1.04 kg in the unused water reservoir. Absolute final enthalpy residuals are approximately 3.87×10⁻⁸ J (gradual) and 3.93×10⁻⁸ J (rapid); tests require <10⁻⁶ J and <10⁻¹² kg mass residual. Temperatures remain high even within the small contacted specimens. No extinction threshold is applied; the remainder of the visual peat is not erased.

## Sources and their limited use

- [Giauque and Egan (1937), DOI 10.1063/1.1749929](https://doi.org/10.1063/1.1749929), with phase-change data in [NIST Chemistry WebBook: carbon dioxide](https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=35). The existing project coefficient uses 6030 cal/mol, 4.184 J/cal and 0.0440095 kg/mol, giving approximately 573.274 kJ/kg. NIST lists a rounded 25.2 kJ/mol near 195 K. These support an approximate atmospheric sublimation heat budget, not a pressure-dependent source model.
- [Huang and Rein (2017), DOI 10.1071/WF16198](https://doi.org/10.1071/WF16198). The constant peat/water heat capacities and rounded drying enthalpy retain the project's literature-derived values. Their experiment concerns slowly spreading smoldering in a small peat column; it does not validate these contact masses, conductances, scene geometry or cooling duration.
- [NISTIR 5078, saturation table](https://www.nist.gov/document/nistir5078-tab1pdf). At 100°C, the table gives 2256.4 kJ/kg vaporization enthalpy and 0.10142 MPa saturation pressure; 2.26 MJ/kg and 373.15 K are documented rounded atmospheric approximations here. A pressure-varying equation of state is not implemented.
- [Santoso et al. (2021), DOI 10.1071/WF20117](https://doi.org/10.1071/WF20117), [open paper](https://research.tees.ac.uk/ws/files/35798984/Laboratory_study_on_the_suppression_of_smouldering_peat_wildfires.pdf). Their experiments distinguish delivered water from runoff and show why contact, retention and time matter. The current example is not fitted to those measurements and does not reproduce their extinction criterion.

Primary sources were read on 2026-09-27. Conservation and numerical convergence are verification evidence. They are not experimental validation or proof of a successful treatment.
