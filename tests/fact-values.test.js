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
    questionForFact("performance_guarantee_amount"),
    "מהו סכום ערבות הביצוע הנדרש (בש״ח)?"
  );
  assert.equal(
    questionForFact("bank_guarantee_validity"),
    "מהו תוקף הערבות הבנקאית?"
  );
});

test("translates English requirement text and explanations to natural Hebrew", async () => {
  const {
    translateToHebrew,
    translateScope,
    translatePeriod,
    translateSourceType,
    translateRequirementType,
    translateCategory,
  } = await import("../js/fact-values.js");

  assert.equal(
    translateToHebrew("The performance guarantee amount must be exactly 300,000 NIS."),
    "סכום ערבות הביצוע חייב להיות בדיוק 300,000 ש״ח."
  );
  assert.equal(
    translateToHebrew("The performance guarantee amount must be at least 300,000 NIS."),
    "סכום ערבות הביצוע חייב להיות לפחות 300,000 ש״ח."
  );
  assert.equal(
    translateToHebrew("The bid bond amount must be at least 50,000 ILS."),
    "סכום ערבות ההצעה חייב להיות לפחות 50,000 ש״ח."
  );
  assert.equal(
    translateToHebrew("The requirement is not automatically checked against the business profile."),
    "הדרישה אינה נבדקת אוטומטית מול פרופיל העסק."
  );
  assert.equal(
    translateToHebrew("The corresponding fact is missing from the business profile."),
    "הנתון המקביל חסר בפרופיל העסק."
  );
  assert.equal(
    translateToHebrew("Business fact satisfies the condition code-comparable."),
    "נתון העסק עומד בתנאי שניתן להשוואה בקוד."
  );
  assert.equal(
    translateToHebrew("Business fact does not satisfy the condition code-comparable."),
    "נתון העסק אינו עומד בתנאי שניתן להשוואה בקוד."
  );
  assert.equal(
    translateToHebrew("הדרישה נבדקה בהצלחה"),
    "הדרישה נבדקה בהצלחה"
  );

  assert.equal(translateScope("all sites"), "כל האתרים");
  assert.equal(translatePeriod("past 3 years"), "3 השנים האחרונות");
  assert.equal(translateSourceType("table"), "טבלה");
  assert.equal(translateRequirementType("threshold"), "תנאי סף");
  assert.equal(translateCategory("guarantee"), "ערבויות");
});


