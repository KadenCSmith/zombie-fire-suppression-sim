> SUPERSEDED / INVALID: issued before the clarified original-render protection. Do not launch workers from this record.

# Verified four-agent starting record

READY

Repository URL: https://github.com/KadenCSmith/zombie-fire-suppression-sim.git

Integration branch and sole owner: `integration/v21-alternatives`, `/root`; checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/zombie-fire-suppression-sim`.

Remote-reachable immutable base SHA on integration branch: **eae833684ec41475eb6f84e642e6b06c5c350714**. Normal push succeeded; `git ls-remote` matched this full SHA, a subsequent fetch succeeded and `git cat-file -t origin/integration/v21-alternatives` returned `commit`. All worker branches/checkouts were created at this exact SHA. Do not independently use main or follow a moving integration tip.

Contract API version and paths: `v21.1`, `src/alternatives/contract.ts`, `docs/alternatives/CONTRACT_V21_1.md`.

Contract semantics/example adapter: `src/alternatives/model.ts`, `src/alternatives/sublimation-injection/index.ts`; owned snapshot and accepted `advanceTo` core; separate shared worker scheduling, IDs and disposal. Scene and science exports use separate entry points to keep UI out of workers. Read the contract before editing.

Protected shared paths: **all tracked paths except the exact worker-owned subtrees below**, including App/routing, AppChrome/menus, ModelSelector, registry/modules/model/contract, presentation dispatcher/base, common UI, shared workers, peat/contact solvers, package/lock, global tests/docs/release metadata, persistence and archived assets.

Worker A: `/root/sublimation`; branch `feature/v21-sublimation-injection`; checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-sublimation`; owns `src/alternatives/sublimation-injection/**`, `tests/alternatives/sublimation-injection/**`, `docs/alternatives/sublimation-injection/**`, including its fixtures/evidence. Entry points `index.ts`, `scene.tsx`, `science.tsx`. Standalone harness `http://127.0.0.1:5174/?alternative=sublimation-injection&method-preview=1`.

Worker B: `/root/pressure`; branch `feature/v21-pressure-pulse`; checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-pressure`; owns `src/alternatives/pressure-pulse/**`, `tests/alternatives/pressure-pulse/**`, `docs/alternatives/pressure-pulse/**`, including its fixtures/evidence. Same three entry points. Standalone harness `http://127.0.0.1:5175/?alternative=pressure-pulse&method-preview=1`.

Worker C: `/root/vibration`; branch `feature/v21-vibratory-injection`; checkout `/Users/kadensmith/Documents/Codex/2026-10-11/1-extinguishing-methods-1-extinguishing-medium/outputs/v21-agent-vibration`; owns `src/alternatives/vibratory-injection/**`, `tests/alternatives/vibratory-injection/**`, `docs/alternatives/vibratory-injection/**`, including its fixtures/evidence. Same three entry points. Standalone harness `http://127.0.0.1:5176/?alternative=vibratory-injection&method-preview=1`.

Existing implementation transferred to each: its complete descriptor(s), adapter forwarding to supported existing core, presentation hook, private conceptual scene, and a seed evidence component/document. Shared contract tests pass. A receives the finite contact proxy with optional separate direct CO₂ contact. B receives the three pressure variants and wave/multi-contact marker cues. C receives continuous contact and authored machine vibration. Do not create a competing solver or discard transferred code. The original rapid sequence stays the initial app view.

Source hooks/capabilities/known limitations: finite-inventory sensible/latent contact calorimeter, three independent specimens and exact ledgers; no field injection, pressure propagation, fracture, collapse, soil-response or vibration permeability hook exists. Existing reacting FEM is untreated only. Nanoparticle mechanism remains unspecified. Pressure sources are black-box/unavailable thermodynamics. No fabricated cooling, oxygen deletion, permeability multiplier or suppression winner. Numerical verification is not physical validation.

Verified setup/check commands and baseline failures: `npm ci` works in coordinator checkout; `npm run typecheck`, `npm run lint` (16 inherited warnings), `npm test` (**1777 tests / 93 files**, latest full run 5.92 s), `npm run build` and whitespace checks passed after contract extraction. Native alternatives, fire-sequence, comparison and FEM smoke checks passed before extraction; final integration repeats applicable native checks. No known new failures. Existing dependency/large-chunk/Three.js warnings remain. Each worker installs its own dependencies and runs focused/type/lint/build checks.

Process/port assignments: coordinator Vite PID 92990, port 5173. A exclusively owns 5174, B 5175, C 5176; run `npm run dev -- --host 127.0.0.1 --port <assigned> --strictPort` from own checkout after setup and leave it running. Never launch in another checkout. Each checkout has its own ignored node_modules/dist. Native test userData and evidence must be private. Browser storage is isolated by localhost port; the coordinator alone operates Chrome and creates four separate preview windows to avoid concurrent UI control. Workers report when their assigned server is ready and use unit/build/private native checks for verification.

Handoff location: each assigned `docs/alternatives/<module>/HANDOFF.md` plus a final agent message with frozen branch/HEAD SHA, draft PR targeting integration, owned changed paths, check results, evidence/citations and limitations. Commit/push only owned paths/branch, attach each created draft PR, then freeze the delivered SHA. Coordinator alone reviews and merges exact accepted SHAs sequentially. No main merge, force push, shared Git configuration change, release or deployment is authorized.

END READY
