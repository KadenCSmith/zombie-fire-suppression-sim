# Soil mechanics and visible plumes, version 0.2

**Status:** numerical milestone with assumed parameters, not field validation. The multiday finite-volume transport model and two-second radial gas event remain separate. The mechanics worker reads gas-event frames and does not change their gas inventories or the slow transport state.

## Elements, units, and initial state

The mechanics grid has `n³` bulk soil prisms for `n = 4, 6, 8`; one lumped material point sits at each prism centre. Position and displacement are in m, mass in kg, pressure and stress in Pa, force in N, and event time in s. Cell mass is `[(dry bulk density) + 1000 kg/m³ × porosity × water saturation] × cell volume`. Layer density multipliers and peat-region density overrides are sampled at the element centre. Gas mass is neglected. Dry density and moisture are initial scenario values; the short event does not update them.

Gravity `g = 9.80665 m/s²` acts on every point at every step. A vertical link at the lower face starts with a compressive force equal to the weight of all cells above that face. Thus the undisturbed state balances gravity exactly. Initial centre overburden is the weight above plus half the cell's own weight divided by horizontal face area. Initial effective stress is `overburden − α max(0, p − p_atm)`, with assumed Biot coefficient `α = 0.8`. The frame field uses the current lower-link force divided by face area minus the same pore-pressure term. This is a simplified vertical effective stress, not a full stress tensor.

The bottom has a fixed vertical support and reports its reaction. The four side walls have fixed vertical displacement through shear links to zero; horizontal displacement is absent throughout. The top is mechanically free. These numerical boundaries are assumed local supports, not field structures.

## Motion, pressure, and yield

For vertical displacement `u` positive upward, each point integrates `m ü = F_links + F_pore − mg − c u̇`. Vertical bar stiffness is `E A/Δz` with assumed `E = 1 MPa`; lateral shear stiffness uses assumed `G = 0.35 MPa`. The damping ratio is 0.12. The explicit symplectic step is limited to `min(0.01 s, 0.2 sqrt(m/(2k)))`, and a displacement exceeding the modeled depth stops the run. These parameters are demonstration assumptions, not calibrated peat properties.

The gas event supplies shell-centred absolute pressure in Pa. Each material point takes the pressure of the nearest shell centre; the element containing the sub-cell source is assigned the first shell so its loading cannot vanish at coarse resolution. Mapped values are checked against the source minimum and maximum. For each horizontal face, adjacent cell pressures are averaged once and shared by both cells. The point's vertical pore force is `α A (p_lower_face − p_upper_face)` in N; external top and bottom face pressure is atmospheric. Internal face forces are equal and opposite, so summed pore force is the boundary force. This is a one-way pressure loading: deformation does not change pore volume, permeability, or gas pressure. The radial event's mole ledger checks gas/CO₂ conservation; the mechanics solver checks fixed soil mass and the residual between summed point forces and gravity, damping, side, and bottom reactions. Pressure work and kinetic energy are reported, but gas-to-soil energy exchange is not closed. The forced source-cell assignment is a coarse mapping choice and can materially affect mesh-refinement results.

The documented tensile rule marks a vertical element yielded when its trial link stress minus `α` times local excess pore pressure drops below `−20 kPa`. Yielded elements retain 25% of elastic stiffness and cannot carry tensile force; they still carry compression/contact. The irreversible yield flag is separate from instantaneous displacement. Gravity remains active after pressure falls and can make lifted elements fall or settle against their supports. There is no plastic compression law, fracture-energy budget, or contact geometry beyond the vertical link cutoff. The previous radial damage index is still an illustrative gas-model indicator; it is not used as mechanics displacement.

## Resolution and worker behavior

The default 4³ mesh has 64 elements and 64 material points. The slider reports actual counts, approximate state memory (`112 bytes/element`, excluding framework and frame history), and expected explicit steps. The worker posts each new frame without blocking the UI. Pause preserves worker state; resume continues it; cancel discards it. The 6³ and 8³ runs require a completed 4³ run with finite state, soil-mass closure, and momentum closure, followed by an explicit Run click. Higher resolution changes both spatial mapping and stable time step and should be interpreted as a convergence check, not as accuracy certification.

## Visible smoke and steam

The multiday solver's accepted fuel inventory loss is the modeled oxidation source. A **2% assumed particulate yield** makes that loss the display's smoke mass rate. The accepted liquid-water inventory loss is the modeled evaporation source. A simple atmospheric cooling estimate compares saturation vapor pressures at source and ambient temperatures to calculate an estimated condensed droplet rate; that is the displayed steam. Subsurface condensation is not solved by the transport model. CO₂ is colorless in the view and has no particle visualization.

Plume spheres are a visual approximation. Their horizontal drift uses the local modeled Darcy velocity; upward speed combines temperature-dependent buoyancy with a minimum visual rise. The displayed trajectories do not solve atmospheric turbulence, plume entrainment, aerosol transport, or visibility optics. Visibility switches and quality change only graphics, never source rates or either solver.

## Measurements needed for field validation

Required site data include stratigraphy, in-situ dry and wet density, porosity and saturation, overburden and pore pressure before release, elastic and shear moduli versus strain, tensile and shear strengths, damping, permeability as deformation develops, pressure histories near the source, surface/subsurface displacement histories, reaction and water-loss rates, plume humidity and aerosol yield, and boundary geometry. Field comparison must also establish whether the radial gas event remains within its stated validity bounds.
