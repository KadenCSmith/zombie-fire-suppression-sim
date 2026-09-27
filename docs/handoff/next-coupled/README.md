# Next agent handoff

Open `NEXT-AGENT-PROMPT.md` and give its contents to the next coding agent. Keep this folder available so it can read the companion context, reuse inventory, review prompt and annotated bibliography.

This handoff continues the published 0.11.0 application. It specifies new physics work and two successive Mac versions; it does not claim that those future integrations already exist. No physics implementation was changed while preparing this package.

## Included

- `NEXT-AGENT-PROMPT.md` — full actionable continuation specification, including geometry sliders and proposed water input.
- `CURRENT-CONTEXT.md` — exact project/source/binary versions, current tests, performance and unresolved validation gaps.
- `CODE-REUSE-AUDIT.md` — earlier code inventory, reuse decisions and audit coverage.
- `INDEPENDENT-REVIEW-PROMPT.md` — reusable independent review instructions and scoring rubric, capped at three formal rounds per integration.
- `HANDOFF-REVIEW.md` — independent review of this prompt package and resolved clarifications.
- `Annotated-Physics-Bibliography.docx` and `BIBLIOGRAPHY.md` — annotated current/proposed research sources, use, access depth and limits.
- `evidence-register.json` — source records and selected inspected observations. This is a starter evidence register, not a completed audit of every numerical parameter.
- `source/` — the existing 0.11.0 source archive, source manifest, release verification and validation-evidence archive; these preserve earlier code without bulk-merging superseded physics.
- `tools/build_bibliography.py` — reproducible DOCX/Markdown builder from the evidence register, using Python with python-docx.
- `RESEARCH-SEARCH-LOG.md` — scope and limits of the literature search.
- `SHA256SUMS.txt` — package file hashes, excluding itself.

## User choices recorded

Depth, diameter and inlet water temperature must be adjustable and trigger recomputed physical response. Post-run uncertainty must show calculated per-output percentages, with absolute ranges where percentages are misleading. A top three-dot menu must offer three terrain test cases; rooted peat, layered peat/mineral soil and rocky subsurface are the user-confirmed choices. No user measurements or validation datasets exist; the agent must build named literature benchmark cases and search further. Water input is proposed at 100 gallons/min, provisionally US gallons (6.309 L/s), with editable timing, duration and inlet temperature and explicit pump-data limitations. The 0.5 m sphere size is provisionally a diameter, consistent with the historical Blender scene.

The prompt uses controlled non-explosive heating in a vented or pressure-relieved configuration. Electric heating is provisional; a measured non-explosive heat history is an alternative. The user has not confirmed that choice. Pressure-trapping mechanism design and explosive activation are outside this handoff.

## GitHub continuity

Repository: https://github.com/KadenCSmith/zombie-fire-suppression-sim

Published baseline: https://github.com/KadenCSmith/zombie-fire-suppression-sim/releases/tag/v0.11.0

The recorded application/source hashes are intentionally different from a later documentation-only handoff commit. Inspect current Git status before work. Preserve the independent Stage2 Blender edit exactly. For the new work, implement and push the tested reference version before starting the measured optimization version. New downloads need only support macOS.

## Portable use

Prefer the current checkout. If unavailable, extract `source/Zombie-Fire-Sim-0.11.0-Source.zip` into a new folder and follow its build instructions and manifest. Do not extract over a newer checkout. Repository copies of this handoff omit the redundant baseline archives; retrieve them through the existing release links if needed.
