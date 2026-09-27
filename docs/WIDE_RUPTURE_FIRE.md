# Broad ground opening, irregular oak roots and a surface fire — 0.9

Version 0.9 responds to the visual review of 0.8: roots should be less patterned, the ground should visibly open rather than carry short horizontal damage marks, and the peat fire should extend across the section with a small outlet at the surface. Version 0.8 remains available in the ⋯ menu alongside 0.5–0.7.

## Changes and interpretation

### Roots

A fixed random seed gives the bur oak uneven main-root directions, depths, taper, curvature and secondary branches. Lateral roots occupy the shallower soil; descending roots and fine branches reach about 2–3 m. Rewinding preserves the same root network. The tree crown translates with the local surface displacement, while root vertices follow the soil displacement field. The geometry is illustrative: there is no root growth, root strength, reinforcement or fire-mortality calculation. The bur-oak source and its limits are documented in [the 0.8 evidence notes](CAP_SOIL_PARTICLES.md).

### Ground motion and rendering

The independent 2D unit-thickness spring lattice from 0.8 remains the mechanics model. Version 0.9 uses a **different assumed weaker-soil scenario**:

| Setting | Version 0.9 |
| --- | --- |
| Peat ellipse | Center (0, −1.5) m; horizontal/vertical semi-axes 3.35/0.65 m |
| Bond stiffness | 0.65 × the 0.8 values: 29,250 N/m mineral; 5,850 N/m peat |
| Critical tensile stretch | 0.8 depth-dependent base × reproducible factor 0.65–1.35; the special vertical-bond weakening is removed |
| Local restoring stiffness | 450 + 500 × depth in m, N/m |
| Pressure horizontal scale | 0.6 + 1.35 min(age,4), m |
| Pressure vertical scale | 0.35 + 0.22 min(age,4), m |
| Pressure center height | −2.19 + 0.37 min(age,4), m |
| Pressure envelope | load × (1 − exp(−10 age)) exp(−age/4.5) |
| Default / maximum load | 18 / 30 kPa, prescribed; no gas-source calculation |

The cap equations, reference-state treatment, density assumptions, 240 Hz integration and 30 Hz replay storage remain as documented for 0.8. Root dimensions and the mechanical constants have not been calibrated to a matched physical experiment. This is a sensitivity scenario selected to show extensive opening, not evidence that dry ice produces this motion. Initial effective stresses, gravity-driven post-failure collapse, finite gas energy and cap anchorage remain unsolved.

At the default assumed load the numerical section produces about **0.282 m peak surface uplift**, 1,872 broken bonds, and a maximum component displacement of about 0.677 m. At one stored frame, 43 of the 49 surface nodes exceed 0.025 m upward displacement (the grid includes inactive borehole nodes and fixed edges). These values describe this assumed model, not measured or field-predictive rupture.

The short horizontal failure markers are removed in 0.9. Instead, 377 irregular Voronoi display cells are split through seven depth bands to form visible soil pieces. GPU vertex deformation reads the displacement/damage texture. Each piece mixes 70% center displacement and 30% vertex displacement. Damage causes small edge recession (up to 7.5% of local distance from its center) and a small depth-dependent offset, exposing visible gaps. Those display choices **do not remove solver mass or determine physical crack topology**. The crack polygons and out-of-plane extent are illustrative. This remains a 2D mechanics calculation shown in 3D, not a new 3D rupture solver. Surface normals are approximate after displacement.

Rendering uses one combined ground mesh and the stored field texture, avoiding repeated CPU interpolation for every displayed vertex on every playback frame. The particle solve already accumulates local bond forces without a dense global stiffness matrix. Adding submatrices to a dense system would not improve this implementation.

### Broad peat fire and small surface outlet

The peat bed extends about 6.7 m across the nominal section, with an irregular unburnt margin around a glowing smoldering interior. Its broad geometry replaces the previous tree-sized pocket. A narrow authored path rises toward the surface near x = 2.5 m. Small flames appear after that path reaches the surface, beginning at 16 s and growing through 19 s of presentation time.

This is **staged fire progression**. Playback seconds do not represent measured fire spread time through 1.5 m of soil. The display does not consume peat, solve oxygen supply, predict smoldering-to-flaming transition, or calculate interaction with the gas event. CO₂ does not feed or ignite the fire. The independent scientific workspace and its finite fuel/source inventories are unchanged.

## Peer-reviewed evidence and ASCE-style citations

### Surface resurfacing and ignition

Zhang, Y., Shu, Y., Qin, Y., Chen, Y., Lin, S., Huang, X., and Zhou, M. (2024). “Resurfacing of underground peat fire: Smouldering transition to flaming wildfire on litter surface.” *International Journal of Wildland Fire*, 33(2), WF23128. https://doi.org/10.1071/WF23128.

**Why needed:** directly supports depicting a buried smoldering fire reaching surface litter and producing a small flaming spot. The experiments used a 10 cm peat sample beneath 5 cm of banyan-leaf litter; ignition propensity varied with moisture and litter density. The study does not validate this scene's 1.5 m depth, oak litter, prescribed narrow pathway, compressed timing or gas interaction. No combustion coefficients were copied from its abstract. [Primary institutional record](https://ira.lib.polyu.edu.hk/handle/10397/108007).

### Upward peat spread and oxygen dependence

Huang, X. Y., and Rein, G. (2019). “Upward-and-downward spread of smoldering peat fire.” *Proceedings of the Combustion Institute*, 37(3), 4025–4033. https://doi.org/10.1016/j.proci.2018.05.125.

**Why needed:** supports distinguishing slow upward smoldering from a surface flame and shows why oxygen transport, density and depth must be considered before predicting spread. Its investigated configuration did not ignite when the igniter was deeper than 15 cm; that experiment-specific result cannot be generalized into this display's much deeper assumed fire. This limitation is why the new fire path is labeled staged rather than calculated. [Primary institutional record](https://ira.lib.polyu.edu.hk/handle/10397/88851).

The method, density-profile and oak references remain in [CAP_SOIL_PARTICLES.md](CAP_SOIL_PARTICLES.md); the scientific workspace's measured/estimated material profiles remain in [MATERIAL_EVIDENCE_ASCE.md](MATERIAL_EVIDENCE_ASCE.md). None of these sources confirms all chosen properties together.

## Verification

New tests check broad surface motion and fixed boundaries, repeatable reverse seeking, finite motion through the maximum UI load, a stationary zero-load case, and positive-area reproducible display cells whose summed area matches the domain. The desktop smoke test also checks the new scene, late surface-fire label, removal on rewind, older versions and preservation of the scientific state. See [validation status](VALIDATION_STATUS.md) for actual results and platform checks.
