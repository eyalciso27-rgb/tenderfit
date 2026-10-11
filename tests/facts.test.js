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
  }], {}, { facts: [] });

  assert.equal(output.requirementFactKeys["new-r"], "brand_new_fact");
  assert.deepEqual(output.facts.brand_new_fact, {
    business_fact_type: "string",
    unit: null,
    value: null,
    status: "missing",
    aliases: [],
    source: null,
    updated_at: null,
  });
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
