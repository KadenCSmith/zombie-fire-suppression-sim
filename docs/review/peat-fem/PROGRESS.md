# Peat FEM working checkpoint

Active checkout: `/Users/kadensmith/Documents/Codex/2026-10-02/ok/outputs/zombie-fire-suppression-sim`.
Local branch: `feat/peat-fire-fem`; uploaded M1 commit `0902122c970d263d884682d387acf38991eb9d6a`. Published v20 main/base: `161e7a4a1f8c35765e1878c132db79977be1f5ea`.
Remote publication verified; main CI 36992293227 passed macOS, Windows and Linux. M1 is uploaded; M2 reacting-flow milestone is being verified for upload. Main remains v20.

Reduced fixture: `src/peatfem/model.ts`; Q1 assembly, diffusion, conservative dry peat oxidation and step doubling. Eleven reduced-fixture tests passed; first full suite passed (1739 tests, 6.01 s). Native FEM lifecycle and all four historical native checks passed; build/typecheck/lint passed (existing warnings retained). This is an intermediate fixture, not the final baseline requested by the follow-up.
Runtime/UI paths: `src/worker/peatFem.worker.ts`, `src/ui/PeatFemWorkspace.tsx`, `src/ui/PeatFemScene.tsx`.
Authoritative model document: `docs/PEAT_FIRE_FEM_MODEL.md`.

Follow-up accepted: implement chemistry, materials, Darcy mixture storage, conservative gas species/enthalpy transport, then convergence/experiment comparison. A scene syntax error detected by integration typecheck was repaired; new UI checks pending. M2 full regression passed: 1,758 tests in 90 files, 7.36 s; typecheck/lint/build passed.

Source evidence: C4 rendered Eq 5 and Tables 1–2 inspected, lawful Imperial full PDF acquired; char normalization recovered from C3. Density/porosity discrepancy and surrogate gas thermodynamics are explicit adaptations; measured figure extraction remains pending. No raw experimental dataset obtained. No validation claim.
Browser access security check was denied; no bypass attempted; Chrome is unavailable through the connected browser provider. Rendered visual inspection/FPS gate unrun. Apple M3 Pro confirmed.
Budget: best-effort account-wide monitoring accepted; start 27%, target 34.3%, stop before 41.6%. Latest reading 28%. No premium, agents or paid compute.

Active worker now uses the expanded coupled solver. Next executable step: final fast checks/native integration and upload M2, then correct the incompatible hot-wet analysis initializer and rerun convergence. Development fixtures: six chemistry, six flow and seven coupled tests pass. Source normalization recovered from C3 Eq 15–18. These expanded files are being prepared for M2. Thermal expansion initially violated the prescribed top pressure by 4.208 Pa; the new regression caught it and Picard gas/heat coupling fixes it without independent pressure resetting. Initial convergence attempts failed at time zero and are retained, not treated as passes. Profiling predates that gas/heat correction and needs rerunning.
