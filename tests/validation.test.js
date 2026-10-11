import assert from "node:assert/strict";
import test from "node:test";

import { conservativeDedup, normalizeStructuralParents, prepareAjvSchema, validateRequirements } from "../lib/validate.js";

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

test("dedup redirects child and condition-group references from a removed duplicate", () => {
  const keptParent = {
    ...requirement("parent-kept", "נדרשים רישיון וביטוח"),
    parent_requirement_id: null,
    condition_group_id: null,
  };
  const removedParent = {
    ...requirement("parent-removed", "נדרשים רישיון וביטוח"),
    parent_requirement_id: null,
    condition_group_id: null,
  };
  const child = {
    ...requirement("child", "יש לצרף ביטוח תקף"),
    parent_requirement_id: "parent-removed",
    condition_group_id: "parent-removed",
  };

  const result = conservativeDedup([keptParent, removedParent, child]);
  const rewrittenChild = result.requirements.find((item) => item.requirement_id === "child");
  assert.equal(rewrittenChild.parent_requirement_id, "parent-kept");
  assert.equal(rewrittenChild.condition_group_id, "parent-kept");
  assert.equal(result.log.some((entry) => entry.action === "redirected_reference"), true);
});

test("OpenAPI nullable enums are converted for Ajv without widening non-null values", () => {
  const prepared = prepareAjvSchema({ type: "string", nullable: true, enum: ["each", "all"] });
  assert.deepEqual(prepared.enum, ["each", "all", null]);
  assert.deepEqual(prepared.type, "string");
});

test("an atomic all_of requirement is not mistaken for a structural parent", () => {
  const schema = { type: "object", properties: { requirements: { type: "array", items: { type: "object" } } }, required: ["requirements"] };
  const result = validateRequirements([{
    requirement_id: "insurance", parent_requirement_id: null, logic_type: "all_of", code_comparable: true,
    source_page: 12, source_section: "ביטוח", source_quote: "נדרש ביטוח",
    value: null, business_fact_type: null, requires_manual_review: false,
  }], schema);
  assert.equal(result.semanticErrors.includes("structural_parent_comparable:insurance"), false);
});

test("a real structural parent is conservatively normalized before validation", () => {
  const input = [
    { requirement_id: "parent", parent_requirement_id: null, code_comparable: true },
    { requirement_id: "child", parent_requirement_id: "parent", code_comparable: true },
  ];
  const result = normalizeStructuralParents(input);
  assert.equal(result.requirements[0].code_comparable, false);
  assert.equal(result.requirements[1].code_comparable, true);
  assert.deepEqual(result.log[0], {
    action: "normalized_parent_non_comparable",
    requirement_id: "parent",
    previous_value: true,
    new_value: false,
  });
});
