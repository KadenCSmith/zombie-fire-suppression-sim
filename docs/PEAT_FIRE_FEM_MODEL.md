# Peat Fire FEM: specification before implementation

Written 2026-10-02 on `feat/peat-fire-fem`, based on published v0.20.0
`161e7a4a1f8c35765e1878c132db79977be1f5ea`. This is a reduced verification
increment, not a reproduction of the complete Huang–Rein model.

## Domain, fields and inventories

Fixed 0.10 m cube, coordinates x/y horizontal and z upward (0 ≤ z ≤ L).
Continuous Q1 trilinear hexahedra on regular cubic cells. Primary nodal fields
are temperature T [K] and oxygen concentration c [kg O₂/m³ gas]. Local nodal
inventories are dry peat f and passive β-char b [kg/m³ bulk]. The cumulative
released lumped product gas is tracked in kg. No shrinkage, drying, pyrolysis,
char oxidation, pressure, total-gas closure or suppression is implemented.

Heat storage is the explicitly **frozen effective medium** U=C(T−300 K), with
C=ρ₀ cₚ. It does not decrease with the reacting solid mass. That approximation
is intentional and limits physical applicability; this is not composition-
dependent enthalpy. Gas sensible enthalpy/storage are omitted (ambient gas
storage is approximately 0.5% of initial solid storage), not added again as
reaction energy. This estimate does not justify hot product advection.

## Equations and boundaries

    C ∂T/∂t − ∇·(k ∇T) = Q r
    φ ∂c/∂t − ∇·(φ D ∇c) = −ν r
    ∂f/∂t = −r;  ∂b/∂t = y r
    released product mass rate = ∫(1+ν−y) r dV

Here r is kg peat/(m³ bulk s), Q=11.60 MJ/kg peat, ν=0.89 kg O₂/kg peat,
y=0.61 kg β-char/kg peat. These all belong to the **peat oxidation (po)**
column of Table 1 in [Huang and Rein 2017](https://doi.org/10.1071/WF16198).
The other four source reactions are omitted, not silently folded into this one.

    r = ρ₀ 10^16.80 exp(−195000/(R T)) (f/ρ₀)^2.33
        × [(1+c/ρg,ref)^0.24 − 1]

Eqns 5a–5c and Table 1 were inspected as publisher formula/table images.
The peat reactant is normalized by its original dry mass; β-char is a passive
product so no unknown initial-char normalization is inferred. c/ρg,ref is an
**oxygen mass fraction relative to a fixed dry reference carrier**, not oxygen
volume percent or a solved gas-mixture fraction. At zero O₂ or zero peat the
oxidative rate and heat release are zero. Accepted extents are bounded by both
inventories and heat/products use those exact extents.

Initial conditions: T=300 K, c=ρg,ref×0.233, f=ρ₀, b=0. Top outward heat flux
is h(T−300)−P a(x,y) for 0≤t<τ, then h(T−300); a is a Gaussian normalized
by the same surface quadrature to ∫a dA=1. Thus total ignition is exactly Pτ,
independent of mesh. Top outward oxygen flux is φ vₘ(c−cambient). All other
faces are insulated and sealed. No runtime Dirichlet condition is imposed;
Dirichlet elimination is provided and independently tested in verification.
Heat and oxygen boundary losses are integrated at their implicit time level.

## Parameters and provenance

| Parameter | Value | Status / inspected locator |
| --- | --- | --- |
| ρ₀, cₚ, intrinsic kₛ | 123 kg/m³, 1840 J/(kg K), 1 W/(m K) | Transferred Irish peat: 2017 Table 2; not measured for this fixture |
| φ, k | 1−123/1500=0.918, kₛ(1−φ)=0.082 W/(m K) | Fixed adaptations of Table 2; omit pore radiation and evolving material |
| po Z, E, orders, yields, heat | Above | Transferred Table 1, Eqns 4c and 5a–5c; subset only |
| h | 10 W/(m² K) | Transferred 2017 Model setup; radiation/bottom exchange omitted |
| D, vₘ, ρg,ref | 2×10⁻⁵ m²/s, 0.002 m/s, 1.2 kg/m³ | Illustrative, constant; no hot-peat diffusivity measurement |
| L, P, τ, Gaussian width | 0.10 m, 8 W, 180 s, 0.025 m | Illustrative localized ignition fixture, not the 2017 protocol |
| cambient | 0.2796 kg/m³ gas | 0.233 dry reference mass fraction × illustrative ρg,ref |

No moisture variable is offered: this is a dry fixture, not 10% dry-basis
experimental peat, wet-basis moisture or pore saturation. D is a gas-volume
diffusivity; φ multiplies storage and flux once. With prescribed zero flow,
Pe=0 by construction, and L²/D=500 s. This justifies a diffusion verification
fixture, **not** removing advection from a matched smouldering column.
Historical modes retain their existing pressure/advection solvers.

## Finite-element discretization and integration

For test functions w in continuous Q1, integrate conduction/diffusion by
parts. Heat weak residual is ∫w C Ṫ + ∫k∇w·∇T + ∫top w h(T−Ta)
−∫wQr−∫top wP a=0; oxygen replaces C,k,h,source with φ,φD,φvₘ,−νr.
Reference basis Nₐ=⅛(1+sₐξ)(1+tₐη)(1+uₐζ), Jacobian diag(h/2),
det J=h³/8. Eight Gauss points assemble consistent mass and stiffness;
mass is row-sum lumped. Four face Gauss points assemble top lumped Robin
terms and the normalized ignition load. The actual connectivity, assembled
sparse operators and action are exposed by the runtime module.

Backward Euler transport uses diagonal-preconditioned conjugate gradients
(relative residual 10⁻¹⁰, explicit absolute tolerance, bounded iterations).
Conservative local chemistry follows transport: analytic fuel power-law
integration at frozen T and oxygen factor, constrained by available O₂.
Two half split steps are compared with one full step; accepted state is the
two-half result. Steps are rejected/adapted on the declared field error norm
or any nonfinite/negative state/nonconvergence. No physical-state clipping,
temperature ceiling, silent renormalization or painted front is permitted.
Report transport residuals and splitting error, not a nonexistent coupled
Newton residual. Chemistry is collocated at lumped nodes with their FE
weights; it is not a separate voxel simulation.

The component ledger checks solid+oxygen+released products and the reduced
stored-energy balance including ignition and top exchanges. This is an
accounting identity for modeled components, **not full gas-mixture conservation**.
An empty intervention interface must be identical; nonempty intervention
entries remain disabled pending their own conservative models/validation.

## Predeclared evidence gates

Element partition/gradient/quadrature, volume and top orientation: 10⁻¹²
normalized error. Hand matrix/action, constant/linear fields and Dirichlet
manufactured cases: 10⁻¹⁰. Closed reaction and open boundary ledgers:
10⁻⁷ normalized. Positivity/depletion, ignition end, deterministic reset,
failure/rejected steps and empty-interface identity must be exercised.

Three-level mesh study (4/8/16 cells per axis, dt≤0.125 s) and step study
(0.5/0.25/0.125 s on 16³), initially through 240 physical seconds. Compare
max/current/peak T, fixed-coordinate probe histories, deepest interpolated
500 K crossing (a declared temperature contour, not a proven fire front),
oxygen, each component and stored energy. Desired coarse-to-fine gate:
≤5 K temperature, ≤5% oxygen/energy, ≤2 mm contour position. These are
project tolerances, not paper uncertainty. Diagnose nonmonotone differences;
no observed order/Richardson/GCI unless an asymptotic regime is demonstrated.
This gate may remain incomplete if the reference is itself under-resolved.

Experimental comparison remains **unvalidated**. The 2017 candidate uses a
0.10×0.10×0.30 m Irish-peat column, measured MC/density, a 100 W buried coil
for 30 min and thermocouples every 2 cm from 5 to 29 cm. Raw/tabulated data
were not supplied; publisher Fig. 3 is measured, Fig. 6 computed. No raw
dataset or uncertainty-qualified digitization has been recovered here.
Geometry, moisture, flow, material evolution and boundary differences above
prevent an honest matched comparison. Oxygen was not established as a
measured observable by this read. Do not manufacture validation scores.

Rendered performance gate: production M3 Pro, coarse mesh with numeric
temperature overlay, 30 s active after warm-up; 1 s rolling FPS floor ≥40.
Keep solver updates, physical time and rendering distinct. Browser-control
access is presently blocked by the app access-policy check; that gate and
developer screenshots are unrun unless access is restored.
