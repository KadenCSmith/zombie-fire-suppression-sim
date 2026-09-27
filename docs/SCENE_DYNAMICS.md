# Scene dynamics and earlier versions — 0.7

## What changes visibly

The top-right **⋯ Simulation versions** button is available in both workspaces. Choose 0.7 Gravity & contact, 0.6 Rapid gas release, or 0.5 Original cooling study. Selecting a version opens a paused scene at time zero. All four cameras and playback controls remain available. The scientific run stays in memory, paused when leaving its workspace. The selected version is retained when switching workspaces within the app session. Old scenes reproduce their earlier behavior using shared assets and rendering, rather than running old executable code. They are not pixel-identical historical binaries.

0.5 retains the smooth descent, 4–8 s cooling, 8–14 s transport and 14–20 s residual warmth; its solid stays visible and it has no cage or moving debris. 0.6 retains the authored 9 s burst and prescribed fragment paths. Both earlier versions use current renderer fixes.

## New calculated motion

0.7 holds the source until 3.155 s, then drops it 3.5 m from rest under standard gravity (9.80665 m/s²). Landing is at 4 s; the five-second hold and imposed instantaneous conversion at 9 s remain. The source impact is perfectly inelastic and does not drive soil motion.

Eighty-eight independent debris particles receive assumed initial velocities at 9 s. Their translations are integrated at 240 Hz with gravity, quadratic drag, inelastic contacts and Coulomb tangential impulses. The adjustable release speed defaults to 2.8 m/s (0–5 m/s allowed). It is **not derived from gas pressure or a measured release**.

For a spherical collision/drag proxy of radius r and density rho_s:

- mass = 4π rho_s r³ / 3; frontal area = πr²;
- acceleration from drag = −3 rho_air Cd |v| v / (8 rho_s r);
- velocity is damped with the stable scalar update v / (1 + k |v| dt), then gravity is applied;
- positions use the updated velocity (first-order semi-implicit stepping);
- inward normal contact velocity is reversed with restitution e; tangential impulse is bounded by μ times normal impulse, never reversing sliding direction.

Particles contact one of two simplified support planes (surface y = 0 or exposed cutaway base y = −3.16 m). Cage bars are fixed capsules with 6 mm radius and segment positions matching the visible cage. Three projection passes resolve nearby contacts. Discrete contacts may miss sufficiently fast/thin collisions; this is not a continuous collision detector. The UI limits release speed and cage dimensions. Particles do not collide with each other, carve the soil, fracture material or bend the cage. Mesh shapes and sphere proxies differ; rotations are held fixed in the new version. This is a translational debris model, not complete rigid-body or granular dynamics.

Assumed values: debris density 1800 kg/m³, air density 1.2 kg/m³, drag coefficient 0.8, restitution 0.22, friction coefficient 0.6. These are demonstration inputs, not measured peat/rock values from the papers. Surface particles start on their sphere supports. Subsurface fragments represent already detached material exposed at the cutaway face. No model calculates their detachment.

The original gas plume and thermal coloring remain authored illustrations. Neither gas expansion nor transport is CFD in Scene studio. The independent finite-volume heat/gas solver and FEM/reduced mechanics workspace remain available through **Open simulation** and are unchanged.

## Efficiency and replay

A single deterministic replay table is built when version/cage/release settings change. It contains 2,641 frames × 88 particles × 3 coordinates (2,788,896 bytes, Float32). Playback interpolates that table rather than rerunning contact detection each rendered frame. Particles share an instanced mesh. Simple bounds checks discard distant cage bars. Rewinding does not integrate backwards or depend on rendering frame rate.

## Why these sources were needed (ASCE style)

1. Baraff, D. (1991). “Coping with friction for non-penetrating rigid body simulation.” *Computer Graphics*, 25(4), 31–40. <https://www.cs.cmu.edu/~baraff/papers/sig91.pdf> (Sept. 26, 2026).

   Peer-reviewed SIGGRAPH research establishes why friction and nonpenetration require explicit contact treatment and why simultaneous contact is difficult. It informs the model's contact scope and limitations. This implementation uses simplified sequential particle impulses, not the paper's full rigid-body contact algorithm, and the paper supplies none of our material coefficients.

2. NASA Glenn Research Center. (n.d.). “Drag equation.” <https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/> (Sept. 26, 2026).

   This engineering reference provides the drag law and the requirement to identify reference area and experimentally supported Cd. It supports the area/mass scaling used here. It is not a peer-reviewed peat study and does not validate the chosen coefficient.

## Numerical verification

Tests compare free fall to its analytical solution and verify error reduction when the timestep is halved. Other checks cover drag dissipation/density dependence, contact energy loss, cage-bar separation, stable resting contact, finite grounded replay, exact repeatability and preserved earlier-version timing. Experimental release, displacement and cage-load validation remain absent.
