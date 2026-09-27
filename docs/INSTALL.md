# Download and open Zombie Fire Suppression Sim 0.9.0

[Download release 0.9.0](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.9.0) · [All releases](https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases)

This repository is private. Sign into a GitHub account with access before downloading. The application runs locally without Node.js, Python, Blender, an API key, or an internet connection after download. No automatic updater is included; download a newer release to update.

## Choose your download

| Computer | File | Install |
| --- | --- | --- |
| Mac, Apple Silicon **or** Intel | `Zombie-Fire-Sim-0.9.0-macOS-universal.dmg` | Open the disk image and drag the app to Applications. |
| Mac, alternative archive | `Zombie-Fire-Sim-0.9.0-macOS-universal.zip` | Extract and move the whole app into Applications. |
| Windows, Intel/AMD 64-bit | `Zombie-Fire-Sim-0.9.0-Windows-x64.zip` | Extract the whole folder, then open the application `.exe`. |
| Windows, ARM64 | `Zombie-Fire-Sim-0.9.0-Windows-arm64.zip` | Extract the whole folder, then open the application `.exe`. |
| Linux, Intel/AMD 64-bit | `Zombie-Fire-Sim-0.9.0-Linux-x64.tar.gz` | Extract, then run `Open simulation.sh` or `Open scene studio.sh`. |
| Linux, ARM64 | `Zombie-Fire-Sim-0.9.0-Linux-arm64.tar.gz` | Extract, then run the same launch scripts. |

Windows and Linux downloads are portable applications, not system installers. Keep all extracted files together. The included runtime is Electron 44.3.0. Mac requires **macOS 13 or later**, and all packages are 64-bit, consistent with [Electron 44 platform support](https://www.electronjs.org/blog/electron-44-0). Windows requires a supported 64-bit Windows installation. Linux requires a graphical desktop, Electron's system libraries, and an available Chromium sandbox (for example a distribution permitting unprivileged user namespaces). Linux distribution compatibility and Windows/Intel/ARM native execution are not certified merely by creating an archive. See [verification status](https://github.com/KadenCSmith/zombie-fire-suppression-sim/blob/main/docs/VALIDATION_STATUS.md) for actual tested scope.

## Open on this Mac

The working installation is in `~/Applications`. Copy either command into Terminal:

**Scientific simulation**

```sh
open -na "$HOME/Applications/Zombie Fire Suppression Sim.app" --args --simulation
```

**Animated scene studio**

```sh
open -na "$HOME/Applications/Zombie Fire Suppression Sim.app" --args --studio
```

If installed by dragging from the DMG into the system Applications folder, use `/Applications/Zombie Fire Suppression Sim.app` instead. Opening the icon starts Scene studio. The **Open simulation** and **Scene studio** buttons switch between workspaces. Reopening with these commands switches the existing app and pauses numerical playback without discarding the current run. The `-n` flag delivers the requested workspace to the existing single-instance application; it does not create a second solver window.

### First launch and updates

The Mac application is ad-hoc signed and integrity checked, but **not Apple notarized**. A downloaded copy may be blocked by Gatekeeper. If you trust this release and choose to open it, follow [Apple's instructions](https://support.apple.com/102445) for **System Settings → Privacy & Security → Open Anyway** after attempting to open the app. No system-wide security settings need changing. Windows downloads are unsigned and may show an unknown-publisher notice.

Before updating, export any scenario/checkpoint you want to keep and quit the app. Replace the entire old application or extracted folder; do not merge its contents. Keep a copy of the old version if you need to reproduce an earlier run. Release 0.5 preserves historical reaction yields in imported scenarios that lack `numericalRevision: 2`.

## Windows and Linux commands

From the extracted Windows folder in PowerShell:

```powershell
& '.\Zombie Fire Suppression Sim.exe' --simulation
& '.\Zombie Fire Suppression Sim.exe' --studio
```

From the extracted Linux folder:

```sh
./'Open simulation.sh'
./'Open scene studio.sh'
```

## Verify a download

Download `SHA256SUMS.txt` beside the files. On Mac, from that folder, run:

```sh
shasum -a 256 Zombie-Fire-Sim-0.9.0-macOS-universal.dmg
```

Compare the displayed hash with the matching entry in `SHA256SUMS.txt`. Linux uses `sha256sum`; Windows PowerShell uses `Get-FileHash -Algorithm SHA256`. `release-manifest.json` records the source commit, Electron version, file sizes, architectures and hashes.

## Build from source

Install Node.js 22.12 or later and use the pinned dependency lockfile:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

On a Mac:

```sh
npm run dev:mac       # Live development window
npm run mac -- --simulation  # Installed application
npm run package:mac  # Universal Mac DMG and ZIP
npm run package:all  # Mac + Windows + Linux, x64 and ARM64
```

Release packaging runs on macOS and uses the official Electron binaries for each target. Files are written under `work/releases/v0.9.0/`, excluded from Git. A supplied `ELECTRON_ZIP_DIR` must contain official Electron archives and their `SHASUMS256.txt`; cached inputs are checked against that manifest before use. Otherwise Packager downloads the pinned Electron release. No native Windows/Linux execution is implied by cross-packaging on a Mac.

## Model scope

The scene studio is an illustration. The scientific workspace contains reduced, unvalidated heat/gas/reaction and mechanics models. Twelve study-derived material profiles distinguish measurements, estimates and assumptions; the Developer tab exposes the adjustable physical constraints. The [material evidence document with ASCE citations](https://github.com/KadenCSmith/zombie-fire-suppression-sim/blob/main/docs/MATERIAL_EVIDENCE_ASCE.md) and [physics model](https://github.com/KadenCSmith/zombie-fire-suppression-sim/blob/main/docs/PHYSICS_MODEL.md) describe their scope. No release certifies field suppression, fracture, blast, or safe treatment design.
