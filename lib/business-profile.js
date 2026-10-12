export const BUSINESS_PROFILE_FIELDS = Object.freeze([
  "legal_name",
  "company_number",
  "contact_name",
  "phone",
  "email",
]);

export const REUSABLE_PROFILE_FACTS = Object.freeze([
  Object.freeze({
    key: "annual_revenue",
    type: "currency",
    unit: "ILS",
    title: "מחזור הכנסות שנתי",
    description: "מחזור ההכנסות של העסק בשנת הדיווח שנבחרה",
    aliases: Object.freeze(["annual_turnover", "financial_turnover"]),
    requiresPeriod: true,
  }),
  Object.freeze({
    key: "public_entities_transactions_compliant",
    type: "boolean",
    unit: null,
    title: "חוק עסקאות גופים ציבוריים",
    description: "עמידה בדרישות החוק, לרבות ניהול ספרים וניכוי מס במקור",
    supportsValidity: true,
  }),
  Object.freeze({
    key: "required_legal_licenses_valid",
    type: "boolean",
    unit: null,
    title: "רישיונות והיתרים לפי דין",
    description: "כל הרישיונות, ההיתרים וההרשאות הנדרשים לפעילות העסק תקפים",
    supportsValidity: true,
  }),
  Object.freeze({
    key: "valid_food_service_licenses",
    type: "boolean",
    unit: null,
    title: "רישיונות הסעדה ומכירת מזון",
    description: "רישיונות תקפים לאספקת שירותי הסעדה ומכירת מזון",
    supportsValidity: true,
  }),
  Object.freeze({
    key: "valid_kosher_certificate",
    type: "boolean",
    unit: null,
    title: "תעודת כשרות",
    description: "תעודת כשרות תקפה מטעם הרבנות הראשית",
    supportsValidity: true,
  }),
]);

export function normalizeBusinessProfileDetails(input = {}) {
  return Object.fromEntries(BUSINESS_PROFILE_FIELDS.map((field) => [
    field,
    String(input?.[field] ?? "").trim(),
  ]));
}

function parseReusableValue(field, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return null;
  if (field.type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`הערך של „${field.title}” אינו תקין.`);
  }
  if (field.type === "currency") {
    const amount = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`יש להזין סכום תקין עבור „${field.title}”.`);
    }
    return amount;
  }
  return value;
}

function comparableFactValue(fact) {
  if (!fact) return null;
  return JSON.stringify({
    value: fact.value ?? null,
    period: fact.period ?? null,
    valid_until: fact.valid_until ?? null,
  });
}

function reusableFactKeys(field) {
  return [field.key, ...(field.aliases ?? [])];
}

export function findReusableProfileFact(profileFacts = {}, field) {
  for (const key of reusableFactKeys(field)) {
    if (profileFacts?.[key]) return profileFacts[key];
  }
  return null;
}

export function updateReusableProfileFacts(input = {}, existingFacts = {}, changedAt = new Date().toISOString()) {
  const facts = { ...(existingFacts ?? {}) };
  const changedKeys = [];

  for (const field of REUSABLE_PROFILE_FACTS) {
    const value = parseReusableValue(field, input[field.key]);
    const fieldKeys = reusableFactKeys(field);
    const previous = findReusableProfileFact(existingFacts, field);
    if (value === null) {
      if (previous) {
        for (const key of fieldKeys) delete facts[key];
        changedKeys.push(field.key);
      }
      continue;
    }

    const period = field.requiresPeriod ? String(input[`${field.key}_period`] ?? "").trim() : null;
    if (field.requiresPeriod && !/^\d{4}$/.test(period)) {
      throw new Error(`יש להזין שנת דיווח בת ארבע ספרות עבור „${field.title}”.`);
    }
    if (field.requiresPeriod && (Number(period) < 2000 || Number(period) > 2100)) {
      throw new Error(`שנת הדיווח של „${field.title}” אינה בטווח הנתמך.`);
    }
    const validUntil = field.supportsValidity
      ? String(input[`${field.key}_valid_until`] ?? "").trim() || null
      : null;
    if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
      throw new Error(`תאריך התוקף של „${field.title}” אינו תקין.`);
    }
    const next = {
      ...(previous ?? {}),
      title_he: field.title,
      description_he: field.description,
      business_fact_type: field.type,
      unit: field.unit,
      value,
      status: "known",
      aliases: [...new Set([...(previous?.aliases ?? []), ...(field.aliases ?? [])])],
      source: "user",
      scope: previous?.scope ?? null,
      period,
      valid_until: validUntil,
      verification_status: previous?.verification_status ?? null,
      updated_at: changedAt,
    };

    if (comparableFactValue(previous) === comparableFactValue(next)) {
      next.updated_at = previous.updated_at ?? changedAt;
    } else {
      changedKeys.push(field.key);
    }
    for (const key of fieldKeys) {
      if (key !== field.key) delete facts[key];
    }
    facts[field.key] = next;
  }

  return { facts, changedKeys };
}

function isGeneratedMissingPlaceholder(fact) {
  return fact
    && typeof fact === "object"
    && fact.status === "missing"
    && (fact.value === null || fact.value === undefined)
    && (fact.source === null || fact.source === undefined);
}

export function removeGeneratedMissingPlaceholders(profileFacts = {}) {
  const facts = {};
  const removedKeys = [];
  for (const [key, fact] of Object.entries(profileFacts ?? {})) {
    if (isGeneratedMissingPlaceholder(fact)) {
      removedKeys.push(key);
    } else {
      facts[key] = fact;
    }
  }
  return { facts, removedKeys };
}
