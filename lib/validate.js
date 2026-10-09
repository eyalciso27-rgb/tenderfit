import Ajv from "ajv";

export function prepareAjvSchema(schema) {
  if (Array.isArray(schema)) return schema.map(prepareAjvSchema);
  if (!schema || typeof schema !== "object") return schema;
  const prepared = Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, prepareAjvSchema(value)]));
  if (prepared.nullable === true && Array.isArray(prepared.enum) && !prepared.enum.includes(null)) {
    prepared.enum = [...prepared.enum, null];
  }
  return prepared;
}

function normalizedText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function dedupKey(requirement) {
  return [
    normalizedText(requirement.source_quote),
    requirement.source_page ?? "",
    normalizedText(requirement.business_fact_key),
    normalizedText(requirement.value),
    requirement.comparison_operator ?? "",
  ].join("|");
}

function suspectedDuplicateKey(requirement) {
  return [requirement.source_page ?? "", normalizedText(requirement.business_fact_key)].join("|");
}

export function validateRequirements(requirements, schema) {
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  const validate = ajv.compile(prepareAjvSchema(schema));
  const schemaErrors = [];
  const semanticErrors = [];
  const warnings = [];
  const ids = new Set();
  const parentIds = new Set(requirements.map((item) => item.parent_requirement_id).filter(Boolean));

  for (const [index, requirement] of requirements.entries()) {
    if (!validate({ requirements: [requirement] })) {
      schemaErrors.push({ index, errors: structuredClone(validate.errors ?? []) });
    }
    if (ids.has(requirement.requirement_id)) semanticErrors.push(`duplicate_id:${requirement.requirement_id}`);
    ids.add(requirement.requirement_id);
    if (!Number.isInteger(requirement.source_page) || !requirement.source_section || !requirement.source_quote) {
      semanticErrors.push(`missing_source:${requirement.requirement_id}`);
    }
    if (requirement.value !== null && requirement.business_fact_type === "number" && !Number.isFinite(Number(requirement.value))) {
      semanticErrors.push(`invalid_numeric_value:${requirement.requirement_id}`);
    }
    if (parentIds.has(requirement.requirement_id) && requirement.code_comparable) {
      semanticErrors.push(`structural_parent_comparable:${requirement.requirement_id}`);
    }
    if (requirement.requires_manual_review) warnings.push(`manual_review:${requirement.requirement_id}`);
  }
  for (const requirement of requirements) {
    if (requirement.parent_requirement_id && !ids.has(requirement.parent_requirement_id)) {
      semanticErrors.push(`missing_parent:${requirement.requirement_id}:${requirement.parent_requirement_id}`);
    }
  }
  return { ok: schemaErrors.length === 0 && semanticErrors.length === 0, schemaErrors, semanticErrors, warnings };
}

export function conservativeDedup(requirements) {
  const exact = new Map();
  const suspects = new Map();
  const kept = [];
  const log = [];

  for (const requirement of requirements) {
    const exactKey = dedupKey(requirement);
    if (exact.has(exactKey) && normalizedText(requirement.source_quote)) {
      log.push({ action: "removed_exact", kept_id: exact.get(exactKey), removed_id: requirement.requirement_id, key: exactKey });
      continue;
    }
    exact.set(exactKey, requirement.requirement_id);
    const suspectKey = suspectedDuplicateKey(requirement);
    const previous = suspects.get(suspectKey);
    if (previous && requirement.business_fact_key && normalizedText(previous.source_quote) !== normalizedText(requirement.source_quote)) {
      previous.requires_manual_review = true;
      previous.review_reason ||= "חשד לכפילות בין אזורים; שתי הדרישות נשמרו.";
      requirement.requires_manual_review = true;
      requirement.review_reason ||= "חשד לכפילות בין אזורים; שתי הדרישות נשמרו.";
      log.push({ action: "kept_suspected", first_id: previous.requirement_id, second_id: requirement.requirement_id, key: suspectKey });
    } else {
      suspects.set(suspectKey, requirement);
    }
    kept.push(requirement);
  }
  return { requirements: kept, log };
}
