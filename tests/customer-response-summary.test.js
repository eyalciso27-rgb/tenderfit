import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCustomerResponses } from "../lib/customer-response-summary.js";

test("customer response summary is separate from automatic business-fact results", () => {
  const requirements = [
    { requirement_id: "fact", requirement_target: "business_fact" },
    { requirement_id: "submit", requirement_target: "submission_obligation" },
    { requirement_id: "commit", requirement_target: "post_award_obligation" },
    { requirement_id: "score", requirement_target: "evaluation_rule" },
  ];
  const summary = summarizeCustomerResponses(requirements, {
    submit: { response_status: "met" },
  });
  assert.equal(summary.total, 2);
  assert.equal(summary.answered, 1);
  assert.equal(summary.remaining, 1);
  assert.equal(summary.counts.met, 1);
});

test("a customer gap on a critical requirement produces a severe warning item", () => {
  const requirements = [
    {
      requirement_id: "critical",
      requirement_target: "submission_obligation",
      requirement_text: "אישור חובה",
      is_critical: true,
    },
    {
      requirement_id: "regular",
      requirement_target: "post_award_obligation",
      is_critical: false,
    },
  ];
  const summary = summarizeCustomerResponses(requirements, {
    critical: { response_status: "gap" },
    regular: { response_status: "gap" },
  });
  assert.equal(summary.counts.gap, 2);
  assert.deepEqual(summary.criticalGaps, [{ requirementId: "critical", text: "אישור חובה" }]);
});

test("a parent response is ignored because only atomic requirements are actionable", () => {
  const requirements = [
    { requirement_id: "parent", requirement_target: "submission_obligation" },
    { requirement_id: "child", parent_requirement_id: "parent", requirement_target: "submission_obligation" },
  ];
  const summary = summarizeCustomerResponses(requirements, {
    parent: { response_status: "gap" },
    child: { response_status: "review" },
  });
  assert.equal(summary.total, 1);
  assert.equal(summary.answered, 1);
  assert.equal(summary.counts.gap, 0);
  assert.equal(summary.counts.review, 1);
});
