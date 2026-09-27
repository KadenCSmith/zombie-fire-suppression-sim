# Current project context

Prepared 27 September 2026. This is a continuation record, not evidence of new physics implementation in the prompt-preparation task. Reinspect the actual checkout before editing.

## User requirements and provisional choices

The user requests an actionable next-agent prompt, implementation followed by a second measured optimization version, source publication to GitHub, Mac downloads, Blender visualization, independent AI review of each integration with at most three rounds, reuse of compatible earlier code and a peer-reviewed annotated Word bibliography.

New requirements: variable water-injection temperature, post-run percentage uncertainty with an explicit calculation basis, and three selectable terrain cases in a top three-dot menu (confirmed terrain cases, not camera views). The cases are rooted peat, layered peat/mineral soil and soil with a rocky subsurface. Also required: adjustable borehole depth and diameter with recomputed physical loads; literature-based scenarios because no user measurements or validation datasets are available; proposed water inflow of 100 gallons/min after the dry-ice stage. The handoff provisionally uses US gallons (6.309 L/s). Flow duration and start criterion remain editable scenario inputs. Flow delivery is not verified against pump data.

The source size is described as 0.5 m; historical Blender geometry interprets this as diameter. That interpretation remains provisional. The historical hole is 0.750 m in diameter and 2.440 m deep in an 8 x 8 x 3.2 m domain. These dimensions were measured from a scene, not a physical experiment.

The supported scope is controlled non-explosive heating in a vented or pressure-relieved configuration. Controlled electric heating is a provisional choice; the user has not selected between it and a measured non-explosive heat-input history. Energetic compounds, detonation and design of a pressure-trapping/self-locking device are excluded. The user has no additional experimental data or specific site. Do not invent these confirmations.

## Repository and exact versions

- Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim
- Checkout: `/Users/kadensmith/.codex/.chatgpt-projects/g-p-6ab74cc545008191a50ed1528f722d46/simulation-integration`
- Audited main: `56c0315e973919a1da17befe7c02fc4ba5388c9e`
- Published application package commit: `05d9c292476677068e9040f5843e70b8ec33ec32`
- Portable source and application CI: `74c0ef55680a5decc0b75d956a6636575f44898f` (smoke-harness change after the package build)
- Release: https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.11.0
- CI: https://github.com/KadenCSmith/zombie-fire-suppression-sim/actions/runs/36305414929
- Source: https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/download/v0.11.0/Zombie-Fire-Sim-0.11.0-Source.zip
- Previous release has 17 checksum-verified assets, totaling 1,211,208,798 bytes. Do not silently change them.

The next-agent documents may be committed after this recorded main. Their commit does not change the application physics. Keep source, binary and documentation provenance separate.

## Preserve existing work

The sole observed uncommitted change is `docs/review/material-stage2/Materials_Thermal_Stage_2.blend`, SHA-256 `e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638`. Preserve it byte-for-byte and exclude it from unrelated commits. The source snapshot records the Blender override separately; an exported GLB manifest has an older source hash and cannot certify this edit. Create derivatives under new names and record actual parent hashes.

Installed bundles: `~/Applications/Zombie Fire Suppression Sim 0.11.app` and preserved `~/Applications/Zombie Fire Suppression Sim.app` (0.10). The prior preservation audit checked 347 files/symlinks unchanged. Never overwrite these to test a new version.

Local release copies are under `/Users/kadensmith/Documents/Codex/2026-09-26/read-astra-prompt-md-and-project-4/outputs/Zombie-Fire-Sim-0.11.0/`.

## Implemented coupled reference

`src/coupled/` includes conservative four-species finite-volume transport, internal-energy/enthalpy accounting, equilibrium water phase handling, finite dry-ice inventory and reduced oxygen-limited oxidation. Heterogeneous brick finite elements include gravity in the constitutive state, float64 PCG, bounded small-strain mechanics, pressure work and porosity/permeability feedback. Eight bonded root trusses and a reduced shallow-cap model are present. Research phase-field fracture is gated off by default.

The application runs the solver in a worker, bounds replay history to about 61 regular frames plus a terminal failure state, supports deterministic comparisons, probes and exports, and separates numerical solve from rendering. The coupled default has a 4 kg subgrid source, source center around 1.3 m depth and illustrative borehole geometry. It does not represent the historical half-metre sphere merely because the render resembles it.

## Verified results and remaining failures

| Check | Recorded result | Meaning and limit |
|---|---|---|
| Tests | 133 tests in 22 files passed | Numerical/unit coverage; not experimental validation |
| Build checks | Type check, lint and build passed | Application build gates |
| Conservation gates | Relative mass 1e-9; thermal energy 1e-8 | Current tested cases and ledger definitions only |
| Mechanical residual gate | 1e-4 N | Does not validate constitutive parameters |
| Spatial fracture mesh energy | About 5.74% difference against 5% gate | Failed; not an accepted converged fracture result |
| Default coupled fracture | About 4.99 J energy-increment check failure | Failed and rolled back; capability off by default |
| Desktop development UI | Native playback/control tests passed | Distinct from installed release-window observation |
| Installed bundle | Signature, architectures and launch checks passed | Final installed-window observation pending because Mac was locked |
| Experiment | No matched holdout experiment | No field or apparatus validation claim |

Full records are in `docs/COUPLED_VALIDATION.md`, `docs/VALIDATION_STATUS.md` and the release validation-evidence archive. Reproduce relevant gates on the next changed commit.

## Measured performance

Host: Apple M3 Pro, 12 CPU cores, 18 GPU cores, 36 GiB unified memory, arm64; measured Node 26.8.2.

| Cells | Median runtime for 10 simulated seconds |
|---:|---:|
| 256 | 0.437 s |
| 864 | 3.240 s |
| 2048 | 16.90 s |

These timings exclude setup and rendering. Native Preview playback measured roughly 117–120 fps; cancellation was observed within 102 ms with 100 ms polling. Summed process working sets were roughly 724 MB; shared, compressed and GPU memory were not fully attributed. Headless peak RSS was roughly 327 MB. These figures do not prove future larger coupled cases will fit or run interactively.

A matching C++ element operator was benchmarked; there is no production native backend. The measured WebGPU runtime exposed no float64 shader feature. A WASM linker was unavailable. Retain the float64 CPU reference and select future acceleration through matched measurements.

## Main physical gaps

No matched peat calibration/holdout; no full pyrolysis/char chemistry; no mobile liquid-water pressure/infiltration, cryosuction or ice heave; no complete nonideal/liquid CO2 and film-limited source model; no resolved excavation; no finite-deformation sharp-contact rupture; no calibrated root pullout/failure; no validated nonlinear cap buckling, friction or failure. Cover thermal mass and heat transfer need explicit treatment. There is no accepted terrain-rupture path and no unified-memory audit of the requested final scene.

No pre-existing liquid-water solver was found in the scoped source inventory. Several older mechanics/render utilities remain useful after review. See CODE-REUSE-AUDIT.md for exact paths and limitations.

## Continuing work

Read NEXT-AGENT-PROMPT.md as the task specification, with user corrections authoritative. Read the repository AGENTS.md and current status before changes. Use the annotated bibliography as a source map; distinguish full-text inspection from abstracts and adopt no unseen numeric values. Create the reference version, push its tested source, then optimize a second version. Mac-only packaging is sufficient. Finish independent review and rendering/application verification with exact remaining gaps.
