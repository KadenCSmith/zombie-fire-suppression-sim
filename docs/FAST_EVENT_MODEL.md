# Short-time gas and soil-response event

**Status:** separate, exploratory reduced model. It is a two-second radial aggregate of one three-dimensional solver snapshot, usually taken just after the one-click solid-CO₂ conversion. It is not a continuation of the slow Darcy calculation, a shock solver, a calibrated soil-failure analysis, or evidence that a field event would occur.

## Handoff and clocks

`src/fastEvent/model.ts` reads the scenario and a solver snapshot without mutating either. It records the slow solver time as `startSolverTimeS`, then uses a separate event clock from 0 to at most 2 s. The default recording has 61 frames; the caller may request 2–100 frames and a shorter positive duration. Internal updates are at most 0.001 s. The Event tab exposes separate scrubbing and 0.1–4× recorded replay; this changes display timing only. The short event does not write gas, temperature, permeability, or damage back into the multiday solver. The one-click conversion itself does change the slow solver's solid/gas inventories and may pause that solver at its 80–150 kPa pressure guard; the short event may still be run from the retained post-conversion snapshot.

## Radial gas approximation

The source's trilinear support cells form the first group. The remaining 3D cells are sorted by distance from the source and aggregated into at most seven additional radial groups. This conserves the initial gas moles of the snapshot but discards azimuthal detail, 3D pathways, and local interface geometry. Each group's gas pore volume comes from cell porosity and liquid saturation; temperature is held at a mole-weighted value from the initial snapshot. The two transported inventories are CO₂ and all other gas combined. Group pressure follows isothermal ideal-gas storage `pV = nRT`.

For each interface, the model calculates an assumed porous conductance from effective permeability, fixed viscosity `1.8 × 10⁻⁵ Pa·s`, an assigned face area and spacing, and a gas concentration estimate. Its molar flux relaxes toward that pressure-driven conductance with a finite time constant of at least 0.005 s. The constant 250 m/s only sets that relaxation scale; it is **not** a computed sound speed or a resolved pressure wave. Atmospheric top and side openings follow the scenario's gas-boundary switches; with both set to no-flux, the event is gas-closed. These are aggregate outer-shell openings, not resolved 3D boundary patches. Transfer uses the donor's CO₂ fraction and limits each face's removal to half its donor inventory per substep. A mass ledger reports initial gas, remaining gas, boundary exchange, and residuals for total gas and CO₂.

The event stops if initial or evolving shell pressure exceeds **5 MPa**, estimated face gas speed exceeds **50 m/s**, state becomes nonfinite/negative, or mass closure leaves its numerical tolerance. These are uncalibrated numerical bounds of this reduced event. They do not extend the slow Darcy solver's 80–150 kPa and 0.02 m/s validity window. The event has no CO₂ phase envelope, nonideal-gas properties, or gas-to-soil mechanical-work balance, so staying below 5 MPa does not establish thermodynamic or mechanical validity; it cannot be interpreted as a shock calculation within or beyond these bounds (S1).

## Soil-response indicator and display load

The event computes a dimensionless yield index from an assumed effective-stress deficit:

```text
overburden = base dry soil density × 9.80665 m/s² × source center depth
deficit = 0.8 × max(0, shell pressure − atmospheric pressure)
          − overburden − 20,000 Pa
yield index = max(0, deficit / 20,000 Pa)
```

The 0.8 pressure coefficient and 20 kPa cohesion are **uncalibrated demonstration assumptions**. Overburden uses the base soil dry density, not a resolved layer-by-layer weight or measured total stress. The damage indicator grows as `d_next = 1 − (1 − d) exp(−3 × yield index × Δt)` and raises effective permeability by up to tenfold through `k = k₀[1 + 9d]`. This is an assumed feedback in the radial event only. It does not calculate crack surfaces, displacement, strain, fracture energy, soil-piece trajectories, or lasting permeability changes in the multiday grid. Visible soil motion remains illustrative.

Each frame also reports an algebraic pressure-load proxy: `max(0, first-shell pressure − atmospheric pressure) × π × fixed support radius²`, in newtons. The area is an imagined plane, not an integrated soil interface. Neither that number nor the yield/damage indicator is a measured uplift force, rupture threshold, or blast force. The separate slow-solver pressure-load diagnostic uses a trilinear cell-pressure average rather than this first radial group. The frame-zero short-event pressure/load may therefore differ from the slow snapshot at the same time: this is a consequence of coarse remapping, not an instantaneous pressure change caused by additional gas.

## Evidence and limits

Automated checks cover duration/frame bounds, a uniform no-source case, conservative gas/CO₂ balances after conversion, closed/open boundary choices, permeability response, deterministic replay, validity pause, and finite recorded fields. See `VALIDATION_STATUS.md` for the actual run results. No measured peat, root, layer, cohesion, tensile strength, Biot coefficient, fracture, displacement, or fast-gas experiment has been used to fit or validate this event. The shell grouping, boundary faces, relaxation scale, effective-stress index, damage law, and guards are implementation assumptions. [USGS Neuzil's overview](https://pubs.usgs.gov/publication/70026090) explains why coupled deformation/failure requires material behavior, force balance, boundaries, and geometry; this event does not implement that full system.
