# TenderFit Extractor V3.5-clean — Cleaning Provenance

Generated: 2026-10-08T20:08:58.749065+00:00

## Status

Mechanical reconstruction matches saved clean files: **PASS**

This package is reconstructed from the documented V3.5 technical specification because the original raw AI Studio source files were not available. It must therefore be treated as V3.5-clean, not claimed as byte-for-byte original V3.5.

## Mechanical transformations only

- System Instructions: removed Markdown serialization escapes before period, hyphen, less-than and greater-than characters.
- User Prompt: removed the Hebrew documentation preamble, starting the runtime prompt at 'Analyze ALL requirement-bearing content...'; removed Markdown serialization escapes before period and hyphen.
- Schema: removed the Hebrew documentation preamble, retained the JSON object only, removed Markdown serialization escapes around bracket/angle characters, parsed as JSON, and serialized as valid pretty JSON.
- No intended semantic rule, field, enum, or required-field change was made.

## Verification

{
  "system": {
    "reconstructed_mechanical_clean_matches_saved_clean": true,
    "raw_chars": 20599,
    "clean_chars": 20357,
    "diff_lines": 1151
  },
  "schema": {
    "reconstructed_mechanical_clean_matches_saved_clean": true,
    "raw_chars": 3166,
    "clean_chars": 6005,
    "diff_lines": 424
  },
  "user": {
    "reconstructed_mechanical_clean_matches_saved_clean": true,
    "raw_chars": 7128,
    "clean_chars": 6684,
    "diff_lines": 399
  }
}

## SHA-256 of clean runtime files

- system_instructions.txt: 918bdafec89090a1768ca972275b68c10bb82970c8298824051d835d1261095a
- user_prompt.txt: 7729f13d8ce413f92602000a518061acce60713e464eaa62434a74d02ed85f0b
- structured_output_schema.json: 26b082edb7ab001f539f5817b64c40214d59686d017dbac860d3d8461a710a33
- settings.json: dac64d0f412b682c32513e127172a2ac54fdcefef5f5078a6b57ed5b730ac329

Full raw-to-clean unified diffs are saved beside this report: system_full.diff, schema_full.diff, user_full.diff.
