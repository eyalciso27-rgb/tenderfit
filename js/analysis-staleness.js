import { normalizeFactKey } from "../lib/facts.js";

function normalizedKeys(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(normalizeFactKey).filter(Boolean))];
}

export function tenderUsesAnyFact(tender, factKeys) {
  const keys = new Set(normalizedKeys(factKeys));
  if (!keys.size) return false;

  for (const requirement of tender?.requirements ?? []) {
    if (requirement.requirement_target !== "business_fact") continue;
    if (keys.has(normalizeFactKey(requirement.business_fact_key))) return true;
  }

  for (const result of Object.values(tender?.results?.by_requirement_id ?? {})) {
    if (keys.has(normalizeFactKey(result?.business_fact_key))) return true;
  }
  return false;
}

export function markResultsStale(results, factKeys, changedAt = new Date().toISOString()) {
  const keys = normalizedKeys(factKeys);
  if (!keys.length) return { ...(results ?? {}) };
  return {
    ...(results ?? {}),
    stale: true,
    stale_fact_keys: [...new Set([...(results?.stale_fact_keys ?? []), ...keys])],
    stale_since: changedAt,
  };
}

export async function markAffectedTenderAnalysesStale(supabase, userId, factKeys, changedAt = new Date().toISOString()) {
  const keys = normalizedKeys(factKeys);
  if (!keys.length) return 0;
  const { data, error } = await supabase
    .from("tenders")
    .select("id,requirements,results,analysis_updated_at")
    .eq("user_id", userId);
  if (error) throw new Error("נתון העסק נשמר, אך לא הצלחנו לסמן ניתוחים קודמים לבדיקה מחדש.");

  const affected = (data ?? []).filter((tender) => tender.analysis_updated_at && tenderUsesAnyFact(tender, keys));
  const updates = await Promise.all(affected.map((tender) => supabase
    .from("tenders")
    .update({ results: markResultsStale(tender.results, keys, changedAt), updated_at: changedAt })
    .eq("id", tender.id)));
  if (updates.some((result) => result.error)) {
    throw new Error("נתון העסק נשמר, אך לא הצלחנו לסמן את כל הניתוחים הקודמים לבדיקה מחדש.");
  }
  return affected.length;
}
