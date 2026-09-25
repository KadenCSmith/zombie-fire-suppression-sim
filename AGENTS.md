# Project invariants

- Keep the scientific state and rendering in separate modules. The 3D view consumes solver snapshots; visual controls must not alter the physical trajectory.
- Use SI units internally and kelvin in temperature-dependent equations. State every fraction's basis. Convert only at input/output boundaries.
- Keep dry-ice mass finite. CO₂ is a transported source species, never an oxygen source. Heater power is `q''' ×` the documented fixed support volume, and external energy enters the ledger once.
- Distinguish the multiday slow porous-flow solver, bounded short-time radial gas event, calculated reduced vertical soil mechanics, legacy illustrative damage/manual motion, and transport under an assumed hypothetical geometry. Do not infer measured rupture, field displacement, blast force, or treatment success from these reduced models.
- Treat numerical verification and experimental validation as separate claims. Update `docs/VALIDATION_STATUS.md` and `docs/BUILD_STATUS.md` whenever implementation scope changes.
- Preserve the user's original-code licensing choice. Do not add a project license without approval. Preserve third-party notices when copying or bundling their code.

## Local verification

From the repository root after `npm ci`:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

On a Mac, `npm run dev:mac` opens the hot-reloading native development window; `npm run mac` opens the installed app. `npm run dev` starts the local server for a manually chosen browser. Record actual command results and native-window observations in `docs/VALIDATION_STATUS.md`; do not mark an unrun check as passed.
