import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBusinessProfileDetails,
  removeGeneratedMissingPlaceholders,
} from "../lib/business-profile.js";

test("business identity fields are normalized separately from comparison facts", () => {
  assert.deepEqual(normalizeBusinessProfileDetails({
    legal_name: "  עסק לדוגמה בע״מ ",
    company_number: " 515151515 ",
    contact_name: " נועה ",
    phone: " 03-5550100 ",
    email: " demo@example.com ",
    business_facts: { should_not_be_copied: true },
  }), {
    legal_name: "עסק לדוגמה בע״מ",
    company_number: "515151515",
    contact_name: "נועה",
    phone: "03-5550100",
    email: "demo@example.com",
  });
});

test("migration removes only empty placeholders generated from tender requirements", () => {
  const output = removeGeneratedMissingPlaceholders({
    generated: { value: null, status: "missing", source: null },
    user_cleared: { value: null, status: "missing", source: "user" },
    known: { value: 25, status: "known", source: "user" },
    uncertain: { value: null, status: "needs_review", source: null },
  });

  assert.deepEqual(output.removedKeys, ["generated"]);
  assert.deepEqual(Object.keys(output.facts), ["user_cleared", "known", "uncertain"]);
});

test("migration does not mutate the stored profile object", () => {
  const original = { generated: { value: null, status: "missing", source: null } };
  removeGeneratedMissingPlaceholders(original);
  assert.ok(original.generated);
});
