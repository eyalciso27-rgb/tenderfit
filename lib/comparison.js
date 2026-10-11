import { isSupportedFactType } from "./facts.js";

export const RESULT_STATUS = Object.freeze({
  MET: "met",
  GAP: "gap",
  REVIEW: "review",
  MISSING: "missing",
});

function result(status, explanation, factKey, fact) {
  return {
    status,
    explanation,
    business_fact_key: factKey ?? null,
    business_value: fact?.value ?? null,
    business_unit: fact?.unit ?? null,
  };
}

function normalizedString(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function exactString(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? "")
    .normalize("NFKC")
    .replace(/[,$₪]/g, "")
    .replace(/\b(?:ils|nis|usd)\b/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizedString(value);
  if (["true", "yes", "1", "כן"].includes(normalized)) return true;
  if (["false", "no", "0", "לא"].includes(normalized)) return false;
  return null;
}

function parseDate(value, { endOfDay = false } = {}) {
  const raw = String(value ?? "").trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = Date.parse(dateOnly && endOfDay ? `${raw}T23:59:59.999Z` : raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAllowedValues(primary, secondary) {
  if (Array.isArray(primary)) return primary;
  const values = [primary, secondary].filter((value) => value !== null && value !== undefined && value !== "");
  if (values.length > 1) return values;
  const single = values[0];
  if (typeof single !== "string") return values;
  try {
    const parsed = JSON.parse(single);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // A plain scalar or delimiter-separated list is handled below.
  }
  return single.split(/[|,;]/).map((value) => value.trim()).filter(Boolean);
}

function findUnitConversion(from, to, units) {
  if (from === to) return { factor: 1 };
  return (units?.conversions ?? []).find((conversion) => conversion.from === from && conversion.to === to) ?? null;
}

function compareOrdered(actual, operator, primary, secondary) {
  if (operator === ">") return actual > primary;
  if (operator === ">=") return actual >= primary;
  if (operator === "=") return actual === primary;
  if (operator === "<=") return actual <= primary;
  if (operator === "<") return actual < primary;
  if (operator === "between") return secondary !== null && actual >= primary && actual <= secondary;
  return null;
}

export function compareAtomicRequirement(requirement, fact, context = {}) {
  const factKey = context.factKey ?? requirement.business_fact_key ?? null;
  if (requirement.requirement_target !== "business_fact") {
    return result(RESULT_STATUS.REVIEW, "הדרישה אינה נבדקת אוטומטית מול פרופיל העסק.", null, null);
  }
  if (!requirement.code_comparable || requirement.requires_manual_review) {
    return result(RESULT_STATUS.REVIEW, "הדרישה סומנה לבדיקה ידנית ואינה מאושרת אוטומטית.", factKey, fact);
  }
  if (!isSupportedFactType(requirement.business_fact_type)) {
    return result(RESULT_STATUS.REVIEW, "סוג המידע אינו נתמך אוטומטית ב-MVP.", factKey, fact);
  }
  if (!fact || fact.status === "missing" || fact.value === null || fact.value === undefined || fact.value === "") {
    return result(RESULT_STATUS.MISSING, "הנתון המקביל חסר בפרופיל העסק.", factKey, fact);
  }
  if (fact.status === "needs_review") {
    return result(RESULT_STATUS.REVIEW, "נתון העסק עצמו דורש בדיקה.", factKey, fact);
  }
  if (fact.business_fact_type !== requirement.business_fact_type) {
    return result(RESULT_STATUS.REVIEW, "סוג נתון העסק שונה מסוג הדרישה.", factKey, fact);
  }
  if (requirement.period && normalizedString(fact.period) !== normalizedString(requirement.period)) {
    return result(RESULT_STATUS.REVIEW, "תקופת נתון העסק אינה תואמת במפורש לתקופת הדרישה.", factKey, fact);
  }
  if (requirement.scope && normalizedString(fact.scope) !== normalizedString(requirement.scope)) {
    return result(RESULT_STATUS.REVIEW, "היקף נתון העסק אינו תואם במפורש להיקף הדרישה.", factKey, fact);
  }

  let actual = fact.value;
  if (requirement.unit !== fact.unit) {
    const conversion = findUnitConversion(fact.unit, requirement.unit, context.units);
    const numericActual = parseNumber(actual);
    if (!conversion || numericActual === null) {
      return result(RESULT_STATUS.REVIEW, "יחידת נתון העסק אינה תואמת ליחידת הדרישה ואין המרה מאושרת.", factKey, fact);
    }
    actual = numericActual * Number(conversion.factor);
  }

  const operator = requirement.comparison_operator;
  const type = requirement.business_fact_type;
  let passed = null;

  if (requirement.requirement_type === "validity" && type === "date") {
    const actualDate = parseDate(actual, { endOfDay: true });
    const deadline = parseDate(context.submissionDeadline);
    if (deadline === null) {
      return result(RESULT_STATUS.REVIEW, "מועד ההגשה לא ידוע ולכן אי אפשר לבדוק את תוקף הנתון.", factKey, fact);
    }
    if (actualDate === null) {
      return result(RESULT_STATUS.REVIEW, "תאריך נתון העסק אינו תקין.", factKey, fact);
    }
    passed = actualDate >= deadline;
  } else if (operator === "required") {
    if (type === "boolean") {
      const actualBoolean = parseBoolean(actual);
      const requiredBoolean = requirement.value === null ? true : parseBoolean(requirement.value);
      if (actualBoolean !== null && requiredBoolean !== null) passed = actualBoolean === requiredBoolean;
    } else {
      passed = String(actual).trim().length > 0;
    }
  } else if (["number", "currency"].includes(type)) {
    const actualNumber = parseNumber(actual);
    const primary = parseNumber(requirement.value);
    const secondary = parseNumber(requirement.value_secondary);
    if (actualNumber !== null && primary !== null) passed = compareOrdered(actualNumber, operator, primary, secondary);
  } else if (type === "date") {
    const actualDate = parseDate(actual);
    const primary = parseDate(requirement.value);
    const secondary = parseDate(requirement.value_secondary);
    if (actualDate !== null && primary !== null) passed = compareOrdered(actualDate, operator, primary, secondary);
  } else if (type === "boolean") {
    const actualBoolean = parseBoolean(actual);
    const requiredBoolean = parseBoolean(requirement.value);
    if (operator === "=" && actualBoolean !== null && requiredBoolean !== null) passed = actualBoolean === requiredBoolean;
  } else if (["enum", "string"].includes(type)) {
    const actualString = type === "string" ? exactString(actual) : normalizedString(actual);
    if (operator === "=") passed = actualString === (type === "string" ? exactString(requirement.value) : normalizedString(requirement.value));
    if (["in", "not_in"].includes(operator)) {
      const allowed = parseAllowedValues(requirement.value, requirement.value_secondary).map(normalizedString);
      if (allowed.length) passed = operator === "in" ? allowed.includes(actualString) : !allowed.includes(actualString);
    }
  }

  if (passed === null) {
    return result(RESULT_STATUS.REVIEW, "לא ניתן לבצע את ההשוואה באופן אוטומטי וחד-משמעי.", factKey, fact);
  }
  return passed
    ? result(RESULT_STATUS.MET, "נתון העסק עומד בתנאי שנבדק אוטומטית.", factKey, fact)
    : result(RESULT_STATUS.GAP, "נתון העסק אינו עומד בתנאי שנבדק אוטומטית.", factKey, fact);
}
