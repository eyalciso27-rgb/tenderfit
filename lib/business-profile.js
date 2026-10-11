export const BUSINESS_PROFILE_FIELDS = Object.freeze([
  "legal_name",
  "company_number",
  "contact_name",
  "phone",
  "email",
]);

export function normalizeBusinessProfileDetails(input = {}) {
  return Object.fromEntries(BUSINESS_PROFILE_FIELDS.map((field) => [
    field,
    String(input?.[field] ?? "").trim(),
  ]));
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
