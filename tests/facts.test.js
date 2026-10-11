import test from "node:test";
import assert from "node:assert/strict";

import { ensureBusinessFacts, normalizeFactKey } from "../lib/facts.js";

test("normalizes aliases and reuses the canonical business fact", () => {
  const registry = {
    facts: [{
      business_fact_key: "active_clients_count",
      business_fact_type: "number",
      unit: "clients",
      aliases: ["Active Clients"],
    }],
  };
  const requirements = [{
    requirement_id: "r1",
    requirement_target: "business_fact",
    business_fact_key: "ACTIVE-CLIENTS",
    business_fact_type: "number",
    unit: "clients",
  }];
  const profileFacts = {
    " Active Clients ": {
      business_fact_type: "number",
      unit: "clients",
      value: 12,
      status: "known",
    },
  };

  const output = ensureBusinessFacts(requirements, profileFacts, registry);

  assert.equal(normalizeFactKey(" Active-Clients "), "active_clients");
  assert.equal(output.requirementFactKeys.r1, "active_clients_count");
  assert.equal(output.facts.active_clients_count.value, 12);
  assert.equal(Object.keys(output.facts).length, 1);
});

test("creates missing facts dynamically instead of treating the registry as closed", () => {
  const output = ensureBusinessFacts([{
    requirement_id: "new-r",
    requirement_target: "business_fact",
    business_fact_key: "Brand New Fact",
    business_fact_type: "string",
    unit: null,
    requirement_text: "יש לצרף מסמך בדיקה תקף",
  }], {}, { facts: [] });

  assert.equal(output.requirementFactKeys["new-r"], "brand_new_fact");
  assert.deepEqual(output.facts.brand_new_fact, {
    title_he: "יש לצרף מסמך בדיקה תקף",
    description_he: "יש לצרף מסמך בדיקה תקף",
    business_fact_type: "string",
    unit: null,
    value: null,
    status: "missing",
    aliases: [],
    source: null,
    scope: null,
    period: null,
    valid_until: null,
    verification_status: null,
    updated_at: null,
  });
});

test("preserves fact context and initializes missing facts with requirement context", () => {
  const output = ensureBusinessFacts([{
    requirement_id: "r-context",
    requirement_target: "business_fact",
    business_fact_key: "annual_turnover",
    business_fact_type: "currency",
    unit: "ils",
    scope: "legal_entity",
    period: "2025",
  }], {
    existing_fact: {
      business_fact_type: "string",
      value: "מאומת",
      status: "known",
      scope: "branch_north",
      period: "2024",
      valid_until: "2027-01-01",
      verification_status: "verified",
    },
  });

  assert.equal(output.facts.annual_turnover.scope, "legal_entity");
  assert.equal(output.facts.annual_turnover.period, "2025");
  assert.equal(output.facts.existing_fact.scope, "branch_north");
  assert.equal(output.facts.existing_fact.period, "2024");
  assert.equal(output.facts.existing_fact.valid_until, "2027-01-01");
  assert.equal(output.facts.existing_fact.verification_status, "verified");
});

test("preserves Hebrew labels and fills missing labels from a requirement", () => {
  const output = ensureBusinessFacts([{
    requirement_id: "r-he",
    requirement_target: "business_fact",
    business_fact_key: "daily_diners",
    business_fact_type: "number",
    unit: "diners",
    requirement_text: "The business must be able to serve the required number of diners.",
    source_quote: "מספר הסועדים היומי שהעסק מסוגל לשרת",
  }], {
    daily_diners: {
      business_fact_type: "number",
      unit: "diners",
      value: 500,
      status: "known",
    },
    existing_label: {
      title_he: "כותרת עברית קיימת",
      description_he: "תיאור עברי קיים",
      business_fact_type: "boolean",
      value: true,
      status: "known",
    },
  }, { facts: [] });

  assert.equal(output.facts.daily_diners.title_he, "מספר הסועדים היומי שהעסק מסוגל לשרת");
  assert.equal(output.facts.daily_diners.description_he, "מספר הסועדים היומי שהעסק מסוגל לשרת");
  assert.equal(output.facts.existing_label.title_he, "כותרת עברית קיימת");
  assert.equal(output.facts.existing_label.description_he, "תיאור עברי קיים");
});

test("marks conflicting aliases for review instead of guessing a value", () => {
  const registry = {
    facts: [{
      business_fact_key: "employee_count",
      business_fact_type: "number",
      unit: "employees",
      aliases: ["workers"],
    }],
  };
  const output = ensureBusinessFacts([], {
    employee_count: { business_fact_type: "number", unit: "employees", value: 10, status: "known" },
    workers: { business_fact_type: "number", unit: "employees", value: 20, status: "known" },
  }, registry);

  assert.equal(output.facts.employee_count.status, "needs_review");
});

test("demo-business-facts.json covers all 31 canonical facts with valid known data", async () => {
  const { readFile } = await import("node:fs/promises");
  const registry = JSON.parse(await readFile("data/business-facts-registry.json", "utf8"));
  const demoFacts = JSON.parse(await readFile("data/demo-business-facts.json", "utf8"));

  assert.equal(registry.facts.length, 31);
  assert.equal(Object.keys(demoFacts).length, 31);

  for (const fact of registry.facts) {
    const key = fact.business_fact_key;
    assert.ok(demoFacts[key], `Missing demo fact for ${key}`);
    const demo = demoFacts[key];
    assert.equal(demo.business_fact_type, fact.business_fact_type);
    assert.equal(demo.unit, fact.unit);
    assert.equal(demo.status, "known");
    assert.notEqual(demo.value, null);
    assert.notEqual(demo.value, undefined);
  }
});
