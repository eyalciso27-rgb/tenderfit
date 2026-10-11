import test from "node:test";
import assert from "node:assert/strict";

import { markResultsStale, tenderUsesAnyFact } from "../js/analysis-staleness.js";

test("a tender is affected only by business facts it compares", () => {
  const tender = {
    requirements: [
      { requirement_id: "r1", requirement_target: "business_fact", business_fact_key: "Annual Revenue" },
      { requirement_id: "r2", requirement_target: "submission_obligation", business_fact_key: "iso_9001" },
    ],
    results: { by_requirement_id: {} },
  };

  assert.equal(tenderUsesAnyFact(tender, ["annual_revenue"]), true);
  assert.equal(tenderUsesAnyFact(tender, ["iso_9001"]), false);
});

test("marking stale preserves system results and customer responses", () => {
  const results = {
    by_requirement_id: { r1: { status: "met" } },
    counts: { met: 1, gap: 0, review: 0, missing: 0 },
    responses: { r1: { response_status: "conditional" } },
  };
  const stale = markResultsStale(results, ["annual_revenue"], "2026-10-11T12:00:00.000Z");

  assert.equal(stale.stale, true);
  assert.deepEqual(stale.stale_fact_keys, ["annual_revenue"]);
  assert.deepEqual(stale.by_requirement_id, results.by_requirement_id);
  assert.deepEqual(stale.responses, results.responses);
});

test("repeated stale marks deduplicate fact keys", () => {
  const first = markResultsStale({}, ["annual_revenue"], "2026-10-11T12:00:00.000Z");
  const second = markResultsStale(first, ["Annual Revenue", "employee_count"], "2026-10-12T12:00:00.000Z");

  assert.deepEqual(second.stale_fact_keys, ["annual_revenue", "employee_count"]);
  assert.equal(second.stale_since, "2026-10-12T12:00:00.000Z");
});
