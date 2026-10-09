import assert from "node:assert/strict";
import test from "node:test";

import { estimateGeminiCost } from "../lib/pricing.js";

test("pricing uses the up-to-200K tier", async () => {
  const result = await estimateGeminiCost({
    total_input_tokens: 100_000,
    total_output_tokens: 10_000,
    total_thought_tokens: 5_000,
  });

  assert.equal(result.estimated_cost_usd, 0.38);
  assert.equal(result.pricing_assumption.input_usd_per_million, 2);
  assert.equal(result.pricing_assumption.output_and_thought_usd_per_million, 12);
});

test("pricing uses the over-200K tier", async () => {
  const result = await estimateGeminiCost({
    totalInputTokens: 250_000,
    totalOutputTokens: 20_000,
    totalThoughtTokens: 10_000,
  });

  assert.equal(result.estimated_cost_usd, 1.54);
  assert.equal(result.pricing_assumption.input_usd_per_million, 4);
  assert.equal(result.pricing_assumption.output_and_thought_usd_per_million, 18);
});
