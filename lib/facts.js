export const SUPPORTED_FACT_TYPES = Object.freeze([
  "number",
  "currency",
  "boolean",
  "date",
  "enum",
  "string",
]);

const SUPPORTED_TYPE_SET = new Set(SUPPORTED_FACT_TYPES);

export function normalizeFactKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function uniqueAliases(values, canonicalKey) {
  return [...new Set(values.map(normalizeFactKey).filter((value) => value && value !== canonicalKey))];
}

function factPriority(fact) {
  if (fact?.status === "known" && fact.value !== null && fact.value !== undefined) return 3;
  if (fact?.status === "needs_review") return 2;
  return 1;
}

function mergeFacts(first, second, canonicalKey) {
  const preferred = factPriority(second) > factPriority(first) ? second : first;
  const other = preferred === first ? second : first;
  const conflictingKnownValues = first?.status === "known"
    && second?.status === "known"
    && JSON.stringify(first.value) !== JSON.stringify(second.value);
  const conflictingTypes = first?.business_fact_type
    && second?.business_fact_type
    && first.business_fact_type !== second.business_fact_type;
  const conflictingUnits = first?.unit && second?.unit && first.unit !== second.unit;

  return {
    ...other,
    ...preferred,
    status: conflictingKnownValues || conflictingTypes || conflictingUnits ? "needs_review" : preferred.status,
    aliases: uniqueAliases([
      ...(first?.aliases ?? []),
      ...(second?.aliases ?? []),
    ], canonicalKey),
  };
}

function registryMaps(registry) {
  const byKey = new Map();
  const aliasToKey = new Map();
  for (const item of registry?.facts ?? []) {
    const canonicalKey = normalizeFactKey(item.business_fact_key);
    if (!canonicalKey) continue;
    byKey.set(canonicalKey, item);
    aliasToKey.set(canonicalKey, canonicalKey);
    for (const alias of item.aliases ?? []) aliasToKey.set(normalizeFactKey(alias), canonicalKey);
  }
  return { byKey, aliasToKey };
}

export function ensureBusinessFacts(requirements, profileFacts = {}, registry = {}) {
  const { byKey: registryByKey, aliasToKey } = registryMaps(registry);
  const facts = {};

  for (const [rawKey, rawFact] of Object.entries(profileFacts ?? {})) {
    const normalizedRawKey = normalizeFactKey(rawKey);
    if (!normalizedRawKey) continue;
    const canonicalKey = aliasToKey.get(normalizedRawKey) ?? normalizedRawKey;
    const fact = {
      business_fact_type: rawFact?.business_fact_type ?? registryByKey.get(canonicalKey)?.business_fact_type ?? null,
      unit: rawFact?.unit ?? registryByKey.get(canonicalKey)?.unit ?? null,
      value: rawFact?.value ?? null,
      status: ["known", "missing", "needs_review"].includes(rawFact?.status) ? rawFact.status : "missing",
      aliases: uniqueAliases([rawKey, ...(rawFact?.aliases ?? [])], canonicalKey),
      source: rawFact?.source ?? null,
      updated_at: rawFact?.updated_at ?? null,
    };
    facts[canonicalKey] = facts[canonicalKey]
      ? mergeFacts(facts[canonicalKey], fact, canonicalKey)
      : fact;
    aliasToKey.set(normalizedRawKey, canonicalKey);
    for (const alias of fact.aliases) aliasToKey.set(alias, canonicalKey);
  }

  const requirementFactKeys = {};
  for (const requirement of requirements ?? []) {
    if (requirement.requirement_target !== "business_fact") continue;
    const rawKey = normalizeFactKey(requirement.business_fact_key);
    if (!rawKey) continue;
    const canonicalKey = aliasToKey.get(rawKey) ?? rawKey;
    requirementFactKeys[requirement.requirement_id] = canonicalKey;
    aliasToKey.set(rawKey, canonicalKey);

    const registryFact = registryByKey.get(canonicalKey);
    if (!facts[canonicalKey]) {
      facts[canonicalKey] = {
        business_fact_type: registryFact?.business_fact_type ?? requirement.business_fact_type ?? null,
        unit: registryFact?.unit ?? requirement.unit ?? null,
        value: null,
        status: "missing",
        aliases: uniqueAliases([requirement.business_fact_key], canonicalKey),
        source: null,
        updated_at: null,
      };
    } else {
      const fact = facts[canonicalKey];
      if ((requirement.business_fact_type && fact.business_fact_type !== requirement.business_fact_type)
        || (requirement.unit && fact.unit && fact.unit !== requirement.unit)) {
        fact.status = "needs_review";
      }
      fact.aliases = uniqueAliases([...fact.aliases, requirement.business_fact_key], canonicalKey);
    }
  }

  return {
    facts,
    requirementFactKeys,
    supportedTypes: SUPPORTED_FACT_TYPES,
  };
}

export function isSupportedFactType(value) {
  return SUPPORTED_TYPE_SET.has(value);
}
