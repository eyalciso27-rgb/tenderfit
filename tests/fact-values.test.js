import test from "node:test";
import assert from "node:assert/strict";

import { formatFactValue, inputKindForFact, parseFactInput } from "../js/fact-values.js";

test("the six Business Fact types have deterministic input handling", () => {
  assert.equal(parseFactInput("number", "1,250"), 1250);
  assert.equal(parseFactInput("currency", "300000"), 300000);
  assert.equal(parseFactInput("boolean", "false"), false);
  assert.equal(parseFactInput("date", "2027-01-09"), "2027-01-09");
  assert.equal(parseFactInput("enum", "manufacturer"), "manufacturer");
  assert.equal(parseFactInput("string", "  תעודה תקפה  "), "תעודה תקפה");
  assert.equal(inputKindForFact("number"), "number");
  assert.equal(inputKindForFact("date"), "date");
  assert.equal(inputKindForFact("boolean"), "select");
  assert.equal(inputKindForFact("string"), "text");
});

test("fact formatting does not confuse boolean false with missing", () => {
  assert.equal(formatFactValue({ business_fact_type: "boolean", value: false }), "לא");
  assert.equal(formatFactValue({ business_fact_type: "number", value: 1200 }), "1,200");
  assert.equal(formatFactValue({ business_fact_type: "string", value: null }), "לא הוזן");
});
