# Independent verification package integration

The Agent C handoff supplied 17 proposed paths. The 15 core paths were copied from its complete code blocks after each block matched the handoff SHA-256 manifest. The two `contractAdapters` paths were held back because they import a shared `physics-next/contracts.ts` interface that is not present in this repository.

The installed code provides independent conservation balances, conditional convergence diagnostics, manufactured fixtures, validation/holdout classification, and deterministic report generation. Its fixture manifest is a campaign plan, not a completed campaign. No active solver, UI, or renderer imports these modules.

Local checks on 2026-09-29: `npm run typecheck`, `npm run lint`, targeted Vitest (99 tests), full Vitest (772 tests in 59 files), and `npm run build` passed. Lint reported non-failing warnings, including two in the new verification modules. The author-supplied isolated checks are not substituted for these repository checks.

Numerical balance and synthetic convergence checks are software verification only. They do not validate this site's soil, peat, fracture, gas release, or suppression behavior against measurements. Application use requires an explicit adapter from accepted solver snapshots, conservation ownership review, and a measured validation campaign.
