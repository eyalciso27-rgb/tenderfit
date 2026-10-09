import assert from "node:assert/strict";
import test from "node:test";

import { conservativeDedup } from "../lib/validate.js";

function requirement(id, quote = "נדרש רישיון תקף") {
  return {
    requirement_id: id, source_quote: quote, source_page: 4,
    business_fact_key: "has_license", value: "true", comparison_operator: "required",
    requires_manual_review: false, review_reason: null,
  };
}

test("conservative dedup removes only an exact five-field duplicate", () => {
  const result = conservativeDedup([requirement("r1"), requirement("r2")]);
  assert.equal(result.requirements.length, 1);
  assert.equal(result.log[0].action, "removed_exact");
});

test("similar facts with different quotes are retained and flagged", () => {
  const result = conservativeDedup([requirement("r1"), requirement("r2", "יש לצרף רישיון תקף")]);
  assert.equal(result.requirements.length, 2);
  assert.equal(result.log[0].action, "kept_suspected");
  assert.equal(result.requirements.every((item) => item.requires_manual_review), true);
});
