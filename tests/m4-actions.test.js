import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAiErrorReport,
  buildDecisionUpdate,
  normalizeTenderDecision,
} from "../lib/m4-actions.js";

test("only the two human tender decisions are accepted", () => {
  assert.equal(normalizeTenderDecision("go"), "go");
  assert.equal(normalizeTenderDecision("no_go"), "no_go");
  assert.equal(normalizeTenderDecision("recommended"), null);
  assert.equal(normalizeTenderDecision(null), null);
});

test("a decision update stores the current decision and timestamp only", () => {
  assert.deepEqual(buildDecisionUpdate("go", "2026-10-11T12:00:00.000Z"), {
    decision: "go",
    decision_updated_at: "2026-10-11T12:00:00.000Z",
    updated_at: "2026-10-11T12:00:00.000Z",
  });
  assert.equal(buildDecisionUpdate("no_go", "not-a-date"), null);
});

test("an AI error report keeps a snapshot without mutating its inputs", () => {
  const requirement = { requirement_id: "R-1", requirement_text: "נדרשות 3 שנות ניסיון" };
  const result = { status: "review", explanation: "נדרשת בדיקה" };
  const report = buildAiErrorReport({
    userId: "user-1",
    tenderId: "tender-1",
    requirement,
    comparisonResult: result,
    fitAnalysis: { summary: "סיכום" },
    userExplanation: "  הדרישה פורשה באופן שגוי  ",
    createdAt: "2026-10-11T12:00:00.000Z",
  });

  requirement.requirement_text = "שונה לאחר יצירת הדיווח";
  result.status = "met";
  assert.equal(report.user_explanation, "הדרישה פורשה באופן שגוי");
  assert.equal(report.ai_result.requirement.requirement_text, "נדרשות 3 שנות ניסיון");
  assert.equal(report.ai_result.comparison_result.status, "review");
  assert.equal(report.status, "new");
});

test("an incomplete AI error report is rejected", () => {
  assert.equal(buildAiErrorReport({
    userId: "user-1",
    tenderId: "tender-1",
    requirement: { requirement_id: "R-1" },
    comparisonResult: null,
    userExplanation: "   ",
  }), null);
});
