import test from "node:test";
import assert from "node:assert/strict";

import {
  formatFactOption,
  formatFactType,
  formatFactUnit,
  formatFactValue,
  inputKindForFact,
  parseFactInput,
  questionForFact,
} from "../js/fact-values.js";

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

test("translates types, units and enum values to Hebrew for display", () => {
  assert.equal(formatFactType("number"), "מספר");
  assert.equal(formatFactType("boolean"), "כן / לא");
  assert.equal(formatFactType("currency"), "מטבע (ש״ח)");
  assert.equal(formatFactUnit("sites"), "אתרים");
  assert.equal(formatFactUnit("diners"), "סועדים");
  assert.equal(formatFactUnit("systems"), "מערכות");
  assert.equal(formatFactOption("authorized_supplier"), "ספק מורשה בישראל");
  assert.equal(formatFactOption("manufacturer"), "יצרן המערכת");
});

test("questionForFact resolves natural Hebrew questions", () => {
  assert.equal(
    questionForFact("simultaneous_food_service_sites_count"),
    "כמה אתרי הסעדה העסק הפעיל בו-זמנית בתקופה הרלוונטית?"
  );
  assert.equal(
    questionForFact("custom_unknown_key", { title_he: "שאלה מותאמת" }),
    "שאלה מותאמת"
  );
});

