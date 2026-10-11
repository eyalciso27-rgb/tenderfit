import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFitAnalysisContext,
  fillFitAnalysisPrompt,
  validateFitAnalysisSemantics,
} from "../lib/fit-analysis.js";

function tender() {
  return {
    title: "מכרז בדיקה",
    results: {
      counts: { met: 1, gap: 1, missing: 0, review: 0 },
      responses: { child: { response_status: "met" } },
      by_requirement_id: {
        parent: { status: "gap", is_parent: true },
        child: { status: "met", explanation: "עבר בקוד", business_fact_key: "years" },
        gap: { status: "gap", explanation: "לא עבר בקוד", business_fact_key: "staff" },
      },
    },
    requirements: [
      { requirement_id: "parent", parent_requirement_id: null, requirement_text: "הורה" },
      { requirement_id: "child", parent_requirement_id: "parent", requirement_text: "ילד", requirement_target: "business_fact" },
      { requirement_id: "gap", parent_requirement_id: null, requirement_text: "פער", requirement_target: "business_fact", is_critical: true },
    ],
  };
}

test("Fit Analysis context contains atomic code results but never customer responses", () => {
  const context = buildFitAnalysisContext(tender(), {
    years: { value: 5, status: "known" },
    staff: { value: 2, status: "known" },
    unrelated: { value: "private" },
  });

  assert.deepEqual(context.requirements.map((item) => item.requirement_id), ["child", "gap"]);
  assert.equal(context.requirements[0].result.status, "met");
  assert.equal("responses" in context, false);
  assert.deepEqual(Object.keys(context.business_facts).sort(), ["staff", "years"]);
});

test("Fit Analysis prompt inserts JSON data into the approved marker", () => {
  const prompt = fillFitAnalysisPrompt("נתונים:\n{{FIT_CONTEXT_JSON}}", { counts: { met: 2 } });
  assert.equal(prompt, 'נתונים:\n{"counts":{"met":2}}');
  assert.throws(() => fillFitAnalysisPrompt("ללא סימון", {}), /marker/);
});

test("Fit Analysis semantic validation prevents changing code statuses", () => {
  const results = tender().results;
  const valid = validateFitAnalysisSemantics({
    strengths: [{ requirement_id: "child" }],
    gaps: [{ requirement_id: "gap" }],
    missing_information: [],
    review_priorities: [],
  }, results);
  const invalid = validateFitAnalysisSemantics({
    strengths: [{ requirement_id: "gap" }],
    gaps: [{ requirement_id: "missing-id" }],
    missing_information: [],
    review_priorities: [],
  }, results);

  assert.equal(valid.valid, true);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /expected_met/);
  assert.match(invalid.errors.join(" "), /unknown_requirement/);
});

test("Fit Analysis semantic validation rejects advisory language", () => {
  const output = {
    summary: "מומלץ לבדוק את תנאי הסף.",
    strengths: [],
    gaps: [],
    missing_information: [],
    review_priorities: [],
    important_note: "הסבר בלבד, אינו המלצה.",
  };
  const validation = validateFitAnalysisSemantics(output, tender().results);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("prohibited_recommendation_language"));
});
