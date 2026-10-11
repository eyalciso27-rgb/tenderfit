import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKFLOW_GROUP,
  atomicRequirementIds,
  requirementWorkflow,
  workflowProgress,
} from "../lib/requirement-workflow.js";

test("workflow separates reusable business facts from tender-only answers", () => {
  const missingFact = requirementWorkflow(
    { requirement_target: "business_fact" },
    { status: "missing" },
    { status: "missing", value: null },
  );
  assert.equal(missingFact.group, WORKFLOW_GROUP.BUSINESS_DATA);
  assert.equal(missingFact.requiresAction, true);

  const commitment = requirementWorkflow(
    { requirement_target: "post_award_obligation" },
    { status: "review" },
  );
  assert.equal(commitment.group, WORKFLOW_GROUP.RESPONSE);
  assert.equal(commitment.requiresAction, true);
});

test("workflow treats submission items separately and evaluation rules as read-only", () => {
  assert.equal(
    requirementWorkflow({ requirement_target: "submission_obligation" }).group,
    WORKFLOW_GROUP.SUBMISSION,
  );
  const evaluation = requirementWorkflow({ requirement_target: "evaluation_rule" });
  assert.equal(evaluation.group, WORKFLOW_GROUP.INFORMATION);
  assert.equal(evaluation.requiresAction, false);
});

test("workflow progress counts only atomic actionable requirements", () => {
  const requirements = [
    { requirement_id: "parent", parent_requirement_id: null, requirement_target: "business_fact" },
    { requirement_id: "known", parent_requirement_id: "parent", requirement_target: "business_fact", business_fact_key: "turnover" },
    { requirement_id: "answer", parent_requirement_id: null, requirement_target: "post_award_obligation" },
    { requirement_id: "info", parent_requirement_id: null, requirement_target: "evaluation_rule" },
  ];
  assert.deepEqual([...atomicRequirementIds(requirements)].sort(), ["answer", "info", "known"]);
  assert.deepEqual(
    workflowProgress(
      requirements,
      { known: { status: "met", business_fact_key: "turnover" }, answer: { status: "review" } },
      { turnover: { status: "known", value: 100 } },
      {},
    ),
    { total: 2, completed: 1, remaining: 1 },
  );
});
