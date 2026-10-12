import test from "node:test";
import assert from "node:assert/strict";

import {
  REUSABLE_PROFILE_FACTS,
  findReusableProfileFact,
  normalizeBusinessProfileDetails,
  removeGeneratedMissingPlaceholders,
  updateReusableProfileFacts,
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

test("business profile details do not overwrite existing business facts", () => {
  const existingFacts = {
    iso_27001: { value: true, status: "known", source: "user" },
    annual_turnover: { value: 10000000, status: "known", source: "user" },
  };
  const input = {
    legal_name: "חברה לדוגמה בע״מ",
    company_number: "515151515",
    contact_name: "דני",
    phone: "050-1234567",
    email: "dani@example.com",
  };
  const normalized = normalizeBusinessProfileDetails(input);
  const updatedProfile = {
    ...normalized,
    business_facts: existingFacts,
  };
  assert.deepEqual(updatedProfile.business_facts, existingFacts);
  assert.equal(updatedProfile.legal_name, "חברה לדוגמה בע״מ");
});

test("reusable profile facts save annual revenue with period and approved aliases", () => {
  const update = updateReusableProfileFacts({
    annual_revenue: "5,000,000",
    annual_revenue_period: "2025",
  }, {}, "2026-10-12T12:00:00.000Z");

  assert.deepEqual(update.changedKeys, ["annual_revenue"]);
  assert.equal(update.facts.annual_revenue.value, 5000000);
  assert.equal(update.facts.annual_revenue.unit, "ILS");
  assert.equal(update.facts.annual_revenue.period, "2025");
  assert.deepEqual(update.facts.annual_revenue.aliases, ["annual_turnover", "financial_turnover"]);
});

test("reusable boolean facts preserve false and optional validity", () => {
  const update = updateReusableProfileFacts({
    public_entities_transactions_compliant: "false",
    public_entities_transactions_compliant_valid_until: "2027-03-31",
  }, {}, "2026-10-12T12:00:00.000Z");

  assert.equal(update.facts.public_entities_transactions_compliant.value, false);
  assert.equal(update.facts.public_entities_transactions_compliant.valid_until, "2027-03-31");
  assert.equal(update.facts.public_entities_transactions_compliant.status, "known");
});

test("clearing a reusable fact removes it instead of persisting a missing placeholder", () => {
  const existing = {
    required_legal_licenses_valid: {
      business_fact_type: "boolean",
      value: true,
      status: "known",
    },
  };
  const update = updateReusableProfileFacts({}, existing, "2026-10-12T12:00:00.000Z");

  assert.equal(update.facts.required_legal_licenses_valid, undefined);
  assert.deepEqual(update.changedKeys, ["required_legal_licenses_valid"]);
});

test("annual revenue requires an explicit reporting year for safe reuse", () => {
  assert.throws(
    () => updateReusableProfileFacts({ annual_revenue: "1000000" }),
    /שנת דיווח/,
  );
  assert.equal(REUSABLE_PROFILE_FACTS.length, 5);
});

test("an older annual turnover alias is shown and normalized to the canonical key", () => {
  const field = REUSABLE_PROFILE_FACTS[0];
  const existing = {
    annual_turnover: {
      business_fact_type: "currency",
      unit: "ILS",
      value: 4000000,
      period: "2024",
      status: "known",
    },
  };

  assert.equal(findReusableProfileFact(existing, field).value, 4000000);
  const update = updateReusableProfileFacts({
    annual_revenue: "4500000",
    annual_revenue_period: "2025",
  }, existing, "2026-10-12T12:00:00.000Z");
  assert.equal(update.facts.annual_turnover, undefined);
  assert.equal(update.facts.annual_revenue.value, 4500000);
});
