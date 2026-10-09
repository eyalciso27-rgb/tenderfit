import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadExtractorBaseline } from "../lib/baseline.js";
import { fillExtractorPrompt, REGION_TYPES } from "../lib/extractor.js";

test("V3.6 benchmark prompt is byte-for-byte compatible with V3.5", async () => {
  const baseline = await loadExtractorBaseline();
  const actual = fillExtractorPrompt(baseline.promptTemplate, {
    title: "נספח 1, סעיף 1 — דרישות חובה",
    start_page: 25,
    end_page: 28,
    region_type: "technical_mandatory",
  }, baseline.regionContext);
  const expected = await readFile(new URL("../ai/extractor-v3.5/user_prompt.txt", import.meta.url), "utf8");
  assert.equal(actual, expected);
});

test("V3.6 has exactly one non-empty context for all 16 mapper region types", async () => {
  const baseline = await loadExtractorBaseline();
  assert.deepEqual(Object.keys(baseline.regionContext).sort(), [...REGION_TYPES].sort());
  for (const context of Object.values(baseline.regionContext)) assert.ok(context.trim().length > 20);
});
