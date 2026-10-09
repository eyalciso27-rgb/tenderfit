# TenderFit Requirement Mapper V1.2 — Frozen Runtime Baseline

Runtime source of truth for Mapper V1.2 (MVP Validated). Original files, SHA-256 recorded in `BASELINE_MANIFEST.json`.

- Request input order: document first, then text (as in `reference/run_mapper.py`).
- `settings.json` fields `cost_cap_usd` and `max_initial_runs` are experiment-phase limits only. Production cost control: `tech-stack.md` §7.

Do not edit this folder in place. Any Prompt, Schema, Model or Temperature change requires a new version and regression.
