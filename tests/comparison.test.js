import test from "node:test";
import assert from "node:assert/strict";

import { compareAtomicRequirement } from "../lib/comparison.js";

function requirement(overrides = {}) {
  return {
    requirement_id: "r1",
    requirement_target: "business_fact",
    business_fact_key: "sample_fact",
    business_fact_type: "number",
    comparison_operator: ">=",
    value: 10,
    value_secondary: null,
    unit: "items",
    code_comparable: true,
    requires_manual_review: false,
    requirement_type: "threshold",
    period: null,
    scope: null,
    ...overrides,
  };
}

function fact(overrides = {}) {
  return {
    business_fact_type: "number",
    unit: "items",
    value: 10,
    status: "known",
    ...overrides,
  };
}

test("supports all ordered numeric operators", () => {
  const cases = [
    [">", 11, 10, null, "met"],
    [">=", 10, 10, null, "met"],
    ["=", 10, 10, null, "met"],
    ["<=", 10, 10, null, "met"],
    ["<", 9, 10, null, "met"],
    ["between", 7, 5, 10, "met"],
    ["between", 11, 5, 10, "gap"],
  ];
  for (const [operator, actual, primary, secondary, expected] of cases) {
    const output = compareAtomicRequirement(
      requirement({ comparison_operator: operator, value: primary, value_secondary: secondary }),
      fact({ value: actual }),
    );
    assert.equal(output.status, expected, operator);
  }
});

test("supports required, in and not_in", () => {
  assert.equal(compareAtomicRequirement(
    requirement({ business_fact_type: "string", comparison_operator: "required", unit: null }),
    fact({ business_fact_type: "string", value: "מסמך קיים", unit: null }),
  ).status, "met");
  assert.equal(compareAtomicRequirement(
    requirement({ business_fact_type: "enum", comparison_operator: "in", value: ["gold", "silver"], unit: null }),
    fact({ business_fact_type: "enum", value: "Gold", unit: null }),
  ).status, "met");
  assert.equal(compareAtomicRequirement(
    requirement({ business_fact_type: "enum", comparison_operator: "not_in", value: "blocked|suspended", unit: null }),
    fact({ business_fact_type: "enum", value: "active", unit: null }),
  ).status, "met");
});

test("supports number, currency, boolean, date, enum and string types", () => {
  const cases = [
    [requirement(), fact(), "met"],
    [requirement({ business_fact_type: "currency", unit: "ILS", value: 1000 }), fact({ business_fact_type: "currency", unit: "ILS", value: "₪1,250" }), "met"],
    [requirement({ business_fact_type: "boolean", unit: null, comparison_operator: "=", value: true }), fact({ business_fact_type: "boolean", unit: null, value: "כן" }), "met"],
    [requirement({ business_fact_type: "date", unit: null, comparison_operator: ">=", value: "2026-01-01" }), fact({ business_fact_type: "date", unit: null, value: "2026-02-01" }), "met"],
    [requirement({ business_fact_type: "enum", unit: null, comparison_operator: "=", value: "authorized" }), fact({ business_fact_type: "enum", unit: null, value: "AUTHORIZED" }), "met"],
    [requirement({ business_fact_type: "string", unit: null, comparison_operator: "=", value: "Kosher" }), fact({ business_fact_type: "string", unit: null, value: " Kosher " }), "met"],
  ];
  for (const [required, actual, expected] of cases) {
    assert.equal(compareAtomicRequirement(required, actual).status, expected);
  }
});

test("a deterministic false comparison is a gap", () => {
  assert.equal(compareAtomicRequirement(requirement({ value: 400 }), fact({ value: 399 })).status, "gap");
});

test("missing, uncertain and incompatible data never become a false gap", () => {
  assert.equal(compareAtomicRequirement(requirement(), null).status, "missing");
  assert.equal(compareAtomicRequirement(requirement(), fact({ status: "missing", value: null })).status, "missing");
  assert.equal(compareAtomicRequirement(requirement(), fact({ status: "needs_review" })).status, "review");
  assert.equal(compareAtomicRequirement(requirement({ code_comparable: false }), fact()).status, "review");
  assert.equal(compareAtomicRequirement(requirement({ requires_manual_review: true }), fact()).status, "review");
  assert.equal(compareAtomicRequirement(requirement(), fact({ unit: "years" })).status, "review");
  assert.equal(compareAtomicRequirement(requirement({ period: "2025" }), fact({ period: "2024" })).status, "review");
  assert.equal(compareAtomicRequirement(requirement({ scope: "single site" }), fact({ scope: "all sites" })).status, "review");
});

test("applies only explicitly configured unit conversions", () => {
  const output = compareAtomicRequirement(
    requirement({ unit: "years", value: 2 }),
    fact({ unit: "months", value: 30 }),
    { units: { conversions: [{ from: "months", to: "years", factor: 1 / 12 }] } },
  );
  assert.equal(output.status, "met");
});

test("checks document validity against the tender submission deadline", () => {
  const valid = compareAtomicRequirement(
    requirement({ business_fact_type: "date", unit: null, requirement_type: "validity", comparison_operator: ">=", value: null }),
    fact({ business_fact_type: "date", unit: null, value: "2026-10-12" }),
    { submissionDeadline: "2026-10-11T14:00:00+03:00" },
  );
  const expired = compareAtomicRequirement(
    requirement({ business_fact_type: "date", unit: null, requirement_type: "validity", comparison_operator: ">=", value: null }),
    fact({ business_fact_type: "date", unit: null, value: "2026-10-10" }),
    { submissionDeadline: "2026-10-11" },
  );
  const unknownDeadline = compareAtomicRequirement(
    requirement({ business_fact_type: "date", unit: null, requirement_type: "validity", comparison_operator: ">=", value: null }),
    fact({ business_fact_type: "date", unit: null, value: "2026-10-12" }),
  );
  assert.equal(valid.status, "met");
  assert.equal(expired.status, "gap");
  assert.equal(unknownDeadline.status, "review");
});

test("a validity date covers the full stated calendar day", () => {
  const output = compareAtomicRequirement(
    requirement({ business_fact_type: "date", unit: null, requirement_type: "validity", comparison_operator: ">=", value: null }),
    fact({ business_fact_type: "date", unit: null, value: "2026-10-11" }),
    { submissionDeadline: "2026-10-11T14:00:00+03:00" },
  );
  assert.equal(output.status, "met");
});

test("non-business requirements remain review-only", () => {
  assert.equal(compareAtomicRequirement(
    requirement({ requirement_target: "evaluation_rule" }),
    fact(),
  ).status, "review");
});
