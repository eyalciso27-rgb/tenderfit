import test from "node:test";
import assert from "node:assert/strict";

import { aggregateComparison } from "../lib/aggregate.js";
import { applyManualReviews } from "../lib/manual-review.js";

function requirement(id, overrides = {}) {
  return {
    requirement_id: id,
    parent_requirement_id: null,
    requirement_target: "business_fact",
    logic_type: "simple",
    stage: "eligibility",
    is_critical: false,
    ...overrides,
  };
}

function automatic(status, explanation = "תוצאת הקוד") {
  return { status, explanation, business_fact_key: "test_fact" };
}

function review(decision, note = "") {
  return { decision, note, reviewed_at: "2026-10-11T10:00:00.000Z", source: "browser" };
}

test("manual confirmation resolves a review while preserving the automatic result", () => {
  const requirements = [requirement("r1")];
  const applied = applyManualReviews(requirements, { r1: automatic("review") }, { r1: review("met", "נבדק מול מסמך") });
  const result = applied.results.r1;

  assert.equal(result.status, "met");
  assert.equal(result.automatic_status, "review");
  assert.equal(result.automatic_explanation, "תוצאת הקוד");
  assert.equal(result.manual_review.source, "user");
  assert.equal(result.manual_review.note, "נבדק מול מסמך");
  assert.deepEqual(applied.manualReviews, { r1: result.manual_review });
});

test("manual met and gap decisions update counters and compliance", () => {
  const requirements = [requirement("met"), requirement("gap"), requirement("review")];
  const automaticResults = {
    met: automatic("review"),
    gap: automatic("review"),
    review: automatic("review"),
  };
  const applied = applyManualReviews(requirements, automaticResults, {
    met: review("met"),
    gap: review("gap"),
  });
  const output = aggregateComparison(requirements, applied.results);

  assert.deepEqual(output.counts, { met: 1, gap: 1, review: 1, missing: 0 });
  assert.equal(output.compliance_percent, 33);
});

test("manual child decisions participate in parent aggregation", () => {
  const requirements = [
    requirement("parent", { logic_type: "all_of" }),
    requirement("child-a", { parent_requirement_id: "parent" }),
    requirement("child-b", { parent_requirement_id: "parent" }),
  ];
  const automaticResults = {
    parent: automatic("review"),
    "child-a": automatic("review"),
    "child-b": automatic("met"),
  };
  const applied = applyManualReviews(requirements, automaticResults, {
    "child-a": review("gap"),
  });
  const output = aggregateComparison(requirements, applied.results);

  assert.equal(output.by_requirement_id.parent.status, "gap");
  assert.deepEqual(output.counts, { met: 1, gap: 1, review: 0, missing: 0 });
});

test("manual reviews cannot override parents, non-business requirements, or decisive code results", () => {
  const requirements = [
    requirement("parent", { logic_type: "all_of" }),
    requirement("child", { parent_requirement_id: "parent" }),
    requirement("automatic-met"),
    requirement("evaluation", { requirement_target: "evaluation_rule" }),
  ];
  const automaticResults = {
    parent: automatic("review"),
    child: automatic("review"),
    "automatic-met": automatic("met"),
    evaluation: automatic("review"),
  };
  const applied = applyManualReviews(requirements, automaticResults, {
    parent: review("met"),
    "automatic-met": review("gap"),
    evaluation: review("met"),
  });

  assert.equal(applied.results.parent.status, "review");
  assert.equal(applied.results["automatic-met"].status, "met");
  assert.equal(applied.results.evaluation.status, "review");
  assert.deepEqual(applied.manualReviews, {});
});

test("invalid decisions are ignored and long notes are bounded", () => {
  const requirements = [requirement("invalid"), requirement("valid")];
  const automaticResults = { invalid: automatic("review"), valid: automatic("review") };
  const applied = applyManualReviews(requirements, automaticResults, {
    invalid: review("missing"),
    valid: review("met", "א".repeat(700)),
  });

  assert.equal(applied.results.invalid.status, "review");
  assert.equal(applied.results.valid.manual_review.note.length, 500);
});
