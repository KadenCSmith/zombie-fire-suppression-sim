# Install Zombie Fire Unified Physics Lab

The unified releases target **Apple Silicon Macs running macOS 13 or later**.
The **0.20.0** Mac app is packaged for a single installation at `~/Applications/Zombie Fire Suppression Sim.app`. It includes the cinematic render, Simulation Version navigation, searchable Finder and 30%-width desktop Toolbox. Formula documentation is in Finder; all variables and retained extra tools are in Toolbox. Previous simulations retains the authored 0.19.0 scene and earlier scenes/films. The latest sequence overlaps drilling with continuous illustrated spread, then brings in a water truck and an attached unspooling hose before the established progressive water stage. [Current controls and timing](FIRE_PRESENTATION.md). Version **0.12.0** is the reference release. Version **0.13.0** is the optimized
accuracy-workflow successor: it retains the same physics and acceptance gates,
with a verified sparse mechanics backend. No version claims experimental
accuracy or validated field suppression.

[Current Mac release 0.20.0](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.20.0) · [Earlier film release 0.15.0](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.15.0) · [Reference release 0.12.0](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.12.0) · [Accuracy release 0.13.0](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.13.0)

For published versions, download assets only from a published release. GitHub access is required while
the repository is private. The packaged app runs offline without Node.js,
Python, Blender, or an API key. Blender is needed only to create or edit the
optional Blender derivatives. There is no automatic updater.

## Choose the matching download

| Release | Apple Silicon disk image | Alternative archive |
| --- | --- | --- |
| 0.20 current full app | `Zombie-Fire-Sim-0.20.0-macOS-arm64.dmg` | `Zombie-Fire-Sim-0.20.0-macOS-arm64.zip` |
| 0.15 published film release | `Zombie-Fire-Sim-0.15.0-macOS-arm64.dmg` | `Zombie-Fire-Sim-0.15.0-macOS-arm64.zip` |
| 0.12 reference | `Zombie-Fire-Sim-0.12.0-macOS-arm64.dmg` | `Zombie-Fire-Sim-0.12.0-macOS-arm64.zip` |
| 0.13 accuracy workflow | `Zombie-Fire-Sim-0.13.0-macOS-arm64.dmg` | `Zombie-Fire-Sim-0.13.0-macOS-arm64.zip` |

Open the DMG and drag the complete application to Applications, or extract the
ZIP and move the whole `.app`. These new packages are **arm64**, not universal
Mac builds. Earlier Intel Mac, Windows and Linux packages remain in the
[0.11.0 release](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.11.0).
They contain the earlier application and do not include the unified 0.12–0.20
features. Availability of an archive does not establish native testing on that
platform; consult [validation status](VALIDATION_STATUS.md).

The app is ad-hoc signed and integrity checked, but not Apple notarized. If
macOS blocks a downloaded copy and you choose to trust it, use
[Apple's Open Anyway instructions](https://support.apple.com/102445). No
system-wide security settings need changing.

## Launch the single installed app

Open the current installation:

```sh
open -na "$HOME/Applications/Zombie Fire Suppression Sim.app" --args --sequence
```

For an app in system Applications, use
`/Applications/Zombie Fire Suppression Sim.app`. Other workspace flags are
`--simulation` (earlier porous gas/heat model), `--mechanics` (mechanics
benchmarks) and `--studio` (authored scene studio). Opening the current icon enters the
complete fire sequence (`--sequence`); `--coupled` opens the lab, and **Physics model** switches workspaces. Export results before
quitting or replacing a bundle. Replace complete applications, never merge
bundle contents.

From a source checkout, `npm run mac -- --coupled` reads the minor version from
`package.json`, finds the matching installed bundle, and checks its actual
version. This command does not build or install the app.

## Start the complete sequence

Play or scrub the 90-second interactive story using the visible play button above or over the scene, then choose Gradual or Rapid. Open **Previous simulations · v0.8+** for archived scenes, films and simultaneous playback. Temperature/Oxygen/CO₂ switch to accepted numerical fields. Fire experiment recalculates a cold, wet assumed peat specimen; the bundled baseline resolves sustained surface oxidation, not a verified underground front. The rapid gas release, peat fractures and water-filled paths remain illustrated, without a calculated pressure or validated suppression outcome. See the [sequence guide](FIRE_SEQUENCE.md).

## Start a laboratory calculation

1. Begin with the cold source-only case and **2,560 cells**. Click **Calculate**
   and wait for accepted states. The 20,480-cell option solves ten times the old
   research cell count and takes longer; higher count alone is not validation.
2. Use **Natural cutaway**, **Scientific fields**, or **Compare views**. Natural
   layers, detailed oak and seeded aggregate appearance provide visual context;
   accepted nodal displacement supplies calculated terrain motion. Scientific
   fields retain physical units and cell values.
3. In comparison, select the scientific view or historical Blender reference.
   Cameras are synchronized. The Blender reference has different mass, geometry
   and normalized timing, so it is explicitly labeled a concept animation.
4. Scrub accepted checkpoints, adjust replay speed or inspect a cell. Camera,
   field and presentation changes do not rerun the solver. Physical input and
   terrain changes require recalculation; the previous result can be restored.
5. **Export calculation** saves version-2 JSON with exact grid/source metadata,
   states, ledgers and initialization diagnostics. The
   [Blender guide](UNIFIED_BLENDER.md) describes the accepted-checkpoint importer.

Prepared smoldering is an opt-in assumed dry specimen with a documented initial
moisture removal, not a reconstructed natural fire. Fracture remains a gated
research model. Mobile water infiltration, resolved excavation, calibrated root
pullout and accepted terrain rupture remain incomplete. Read the
[quick start](UNIFIED_QUICKSTART.md), [implementation record](UNIFIED_IMPLEMENTATION.md)
and [validation status](VALIDATION_STATUS.md) before interpreting a result.

## Verify the download

Download the release's `SHA256SUMS.txt`. For the reference DMG:

```sh
shasum -a 256 Zombie-Fire-Sim-0.12.0-macOS-arm64.dmg
```

Compare the result with the matching checksum. Use the matching version filename and its own
checksum file for that release. `release-manifest.json` records source commit,
architecture, Electron version, file sizes and hashes. Keep these records with
exported results when comparing versions.

## Build from source

Install Node.js 22.12 or later and use the pinned dependency lockfile:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run dev:mac
```

To package the current source version for Apple Silicon:

```sh
MAC_ARCH=arm64 npm run package:mac
```

Outputs go to `work/releases/v<package-version>/`, outside tracked source.
The cross-platform packaging scripts remain available for development; their
presence does not mean equivalent new Windows, Linux or Intel packages have
been built or tested. Use actual release manifests for supported artifacts.

The original element-by-element float64 mechanics implementation remains the
0.12 reference. The 0.13 optimized sparse backend uses the same inputs and
acceptance criteria; its numerical agreement and measured timings are recorded
in [the optimization report](review/unified/optimization.md). Fracture keeps its
original research path. Both new precision meshes use 0.125 s maximum steps in 0.13. The additional steps reduce observed short-case temporal differences but can increase total runtime; matched backend speedups must not be confused with a release-to-release speedup. See the accuracy-release performance and convergence reports. No CUDA dependency is required.
