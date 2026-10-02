# Peat FEM working checkpoint

Active checkout: `/Users/kadensmith/Documents/Codex/2026-10-02/ok/outputs/zombie-fire-suppression-sim`.
Local branch: `feat/peat-fire-fem`. Published v20 main/base: `161e7a4a1f8c35765e1878c132db79977be1f5ea`.
Remote publication verified; main CI 36992293227 passed macOS, Windows and Linux. Verified fixture milestone ready for upload to the feature branch. Main remains v20.

Reduced fixture: `src/peatfem/model.ts`; Q1 assembly, diffusion, conservative dry peat oxidation and step doubling. Eleven reduced-fixture tests passed; first full suite passed (1739 tests, 6.01 s). Native FEM lifecycle and all four historical native checks passed; build/typecheck/lint passed (existing warnings retained). This is an intermediate fixture, not the final baseline requested by the follow-up.
Runtime/UI paths: `src/worker/peatFem.worker.ts`, `src/ui/PeatFemWorkspace.tsx`, `src/ui/PeatFemScene.tsx`.
Authoritative model document: `docs/PEAT_FIRE_FEM_MODEL.md`.

Follow-up accepted: implement chemistry, materials, Darcy mixture storage, conservative gas species/enthalpy transport, then convergence/experiment comparison. A scene syntax error detected by integration typecheck was repaired; new UI checks pending. Baseline regression evidence predates these changes.

Source evidence: C4 rendered Eq 5 and Tables 1–2 inspected; char normalization, density/porosity inconsistency, gas thermodynamics and measured figure extraction still require resolution. No raw experimental dataset obtained. No validation claim.
Browser access security check was denied; no bypass attempted; Chrome is unavailable through the connected browser provider. Rendered visual inspection/FPS gate unrun. Apple M3 Pro confirmed.
Budget: best-effort account-wide monitoring accepted; start 27%, target 34.3%, stop before 41.6%. Latest reading 28%. No premium, agents or paid compute.

Next executable step: connect the newly verified five-step chemistry and Darcy/species/enthalpy subsystem to the active worker and UI. Development fixtures: six chemistry, six flow and six coupled tests pass. Source normalization recovered from C3 Eq 15–18. These expanded files are not part of the first reduced-fixture commit.
