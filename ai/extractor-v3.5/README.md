# TenderFit Requirement Extractor V3.5 — Frozen Runtime Baseline

This folder is the runtime source of truth for Extractor V3.5.

Important provenance note: the original raw AI Studio files were not available. These files were mechanically reconstructed from the documented V3.5 technical specification, verified by full raw-to-clean diffs, then promoted only after regression validation.

Runtime files:
- system_instructions.txt
- user_prompt.txt
- structured_output_schema.json
- settings.json

Audit files:
- BASELINE_MANIFEST.json
- provenance/CLEANING_REPORT.md
- provenance/*_full.diff

Do not edit this folder in place. Any Prompt, Schema, Model or Temperature change requires a new version and regression.
