import assert from "node:assert/strict";
import test from "node:test";

import {
  createFailedUsageEntry,
  createUsageReservation,
  summarizeAiUsage,
} from "../lib/ai-usage.js";

test("a usage reservation counts against the budget before Gemini returns", () => {
  const reservation = createUsageReservation({
    id: "reservation:1",
    component: "extractor-v3.6",
    regionId: "region-1",
    model: "gemini-3.1-pro-preview",
    pdfHash: "abc",
    estimatedCostUsd: 0.75,
    createdAt: "2026-10-11T10:00:00.000Z",
  });

  assert.equal(reservation.status, "reserved");
  assert.equal(reservation.estimated_cost_usd, 0.75);
  assert.equal(reservation.region_id, "region-1");
  assert.equal(reservation.cost_measurement, "reservation");
});

test("usage summary separates input, output and thought costs by component", () => {
  const summary = summarizeAiUsage([
    {
      component: "mapper-v1.2",
      status: "completed",
      total_input_tokens: 100,
      total_output_tokens: 20,
      total_thought_tokens: 30,
      total_tokens: 150,
      estimated_cost_usd: 0.1,
      cost_measurement: "measured",
    },
    {
      component: "extractor-v3.6",
      status: "failed",
      estimated_cost_usd: 0.75,
      cost_measurement: "reservation",
    },
  ]);

  assert.deepEqual(
    {
      calls: summary.calls,
      completed: summary.completed,
      failed: summary.failed,
      unmeasured_failed: summary.unmeasured_failed,
      input: summary.total_input_tokens,
      output: summary.total_output_tokens,
      thought: summary.total_thought_tokens,
      cost: summary.estimated_cost_usd,
    },
    {
      calls: 2,
      completed: 1,
      failed: 1,
      unmeasured_failed: 1,
      input: 100,
      output: 20,
      thought: 30,
      cost: 0.85,
    },
  );
  assert.equal(summary.by_component["extractor-v3.6"].estimated_cost_usd, 0.75);
});

test("a failed interaction keeps measured token usage when Gemini returns it", async () => {
  const entry = await createFailedUsageEntry({
    existing: {
      interaction_id: "interaction-1",
      sent_at: "2026-10-11T10:00:00.000Z",
      estimated_cost_usd: 0.75,
    },
    interaction: {
      id: "interaction-1",
      model: "gemini-3.1-pro-preview",
      usage: {
        total_input_tokens: 100_000,
        total_output_tokens: 10_000,
        total_thought_tokens: 5_000,
      },
    },
    details: { component: "extractor-v3.6" },
    code: "extract_schema_invalid",
    fallbackCostUsd: 0.75,
    completedAt: "2026-10-11T10:01:00.000Z",
    now: Date.parse("2026-10-11T10:01:00.000Z"),
  });

  assert.equal(entry.status, "failed");
  assert.equal(entry.cost_measurement, "measured");
  assert.equal(entry.estimated_cost_usd, 0.38);
  assert.equal(entry.duration_ms, 60_000);
});

test("a failed call without Gemini usage keeps its conservative reservation", async () => {
  const entry = await createFailedUsageEntry({
    existing: { interaction_id: "reservation:1", estimated_cost_usd: 0.75 },
    interaction: null,
    details: { component: "extractor-v3.6" },
    code: "extract_submit_failed",
    fallbackCostUsd: 0.75,
  });

  assert.equal(entry.cost_measurement, "reservation");
  assert.equal(entry.estimated_cost_usd, 0.75);
  assert.equal(entry.total_tokens, 0);
});
