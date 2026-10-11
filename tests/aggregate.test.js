import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { aggregateComparison } from "../lib/aggregate.js";

function req(id, overrides = {}) {
  return {
    requirement_id: id,
    parent_requirement_id: null,
    logic_type: "simple",
    requirement_target: "business_fact",
    stage: "eligibility",
    is_critical: false,
    ...overrides,
  };
}

function comparison(status) {
  return { status, explanation: status };
}

test("derives all_of and any_of parents without double-counting them", () => {
  const requirements = [
    req("all", { logic_type: "all_of" }),
    req("all-a", { parent_requirement_id: "all" }),
    req("all-b", { parent_requirement_id: "all" }),
    req("any", { logic_type: "any_of" }),
    req("any-a", { parent_requirement_id: "any" }),
    req("any-b", { parent_requirement_id: "any" }),
  ];
  const output = aggregateComparison(requirements, {
    "all-a": comparison("met"),
    "all-b": comparison("gap"),
    "any-a": comparison("missing"),
    "any-b": comparison("met"),
  });

  assert.equal(output.by_requirement_id.all.status, "gap");
  assert.equal(output.by_requirement_id.any.status, "met");
  assert.equal(output.atomic_business_fact_count, 4);
  assert.deepEqual(output.counts, { met: 2, gap: 1, review: 0, missing: 1 });
  assert.equal(output.compliance_percent, 50);
});

test("uses the documented parent precedence and makes conditional parents review-only", () => {
  const requirements = [
    req("all", { logic_type: "all_of" }),
    req("a", { parent_requirement_id: "all" }),
    req("b", { parent_requirement_id: "all" }),
    req("conditional", { logic_type: "conditional" }),
    req("c", { parent_requirement_id: "conditional" }),
  ];
  const output = aggregateComparison(requirements, {
    a: comparison("missing"),
    b: comparison("review"),
    c: comparison("met"),
  });

  assert.equal(output.by_requirement_id.all.status, "review");
  assert.equal(output.by_requirement_id.conditional.status, "review");
});

test("counts critical eligibility attention and returns a neutral summary", () => {
  const output = aggregateComparison([
    req("gap", { is_critical: true }),
    req("missing", { is_critical: true }),
    req("review", { stage: "evaluation", is_critical: true }),
    req("other", { requirement_target: "evaluation_rule" }),
  ], {
    gap: comparison("gap"),
    missing: comparison("missing"),
    review: comparison("review"),
    other: comparison("review"),
  });

  assert.equal(output.critical_attention_count, 2);
  assert.equal(output.critical_gap_count, 1);
  assert.equal(output.atomic_business_fact_count, 3);
  assert.match(output.summary, /פערים בתנאי סף קריטיים/);
  assert.equal(output.disclaimer, "מחושב בקוד מתוך התוצאות. אינו המלצה.");
});

test("aggregates a realistic requirement volume in under two seconds", () => {
  const requirements = Array.from({ length: 5000 }, (_, index) => req(`r-${index}`));
  const results = Object.fromEntries(requirements.map((item, index) => [item.requirement_id, comparison(index % 2 ? "met" : "missing")]));
  const started = performance.now();
  const output = aggregateComparison(requirements, results);
  const elapsed = performance.now() - started;

  assert.equal(output.atomic_business_fact_count, 5000);
  assert.ok(elapsed < 2000, `aggregation took ${elapsed.toFixed(1)}ms`);
});
