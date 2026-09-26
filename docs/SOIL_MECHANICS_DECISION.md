# Decision: first pressure-driven soil-motion method

Date: 2026-09-25. Scope: an exploratory, short-time, one-way response to the existing radial gas event.

| Method | What is discretized | Strength | Cost and missing input |
| --- | --- | --- | --- |
| Low-order FEA | Continuum soil as connected elements with nodal displacement | Force balance, boundary reactions, stress and displacement at modest grid sizes | Needs assumed stiffness and strength; coarse elements cannot resolve cracks |
| Material point method (MPM) | Moving material points carrying mass, stress, and history through a background grid | Handles large deformation and separation | More complex transfer, contact, stability, and constitutive calibration; unnecessary for a first small-motion milestone |
| Grain-level modeling | Individual grains and contacts | Resolves granular rearrangement and contact loss | Requires grain sizes, shapes, and contact laws; computationally much larger than the available evidence supports |

**Choice:** a reduced, lumped-mass FEA bar-and-shear-link model. Each displayed cell is a bulk soil prism, with one material point at its centre carrying the cell's mass and vertical displacement. Vertical links are linear elastic bar elements; lateral links represent shear transfer. It is a one-degree-of-freedom-per-prism approximation, not a full 3D continuum FEA calculation. The actual element and material-point counts are both `resolution³`.

This choice makes gravity, inertia, boundaries, pressure forces, and a transparent yield rule testable on the smallest mesh. It cannot predict horizontal rupture geometry, ejecta, shock propagation, or field displacement. Those require measured material properties and a later model decision.
