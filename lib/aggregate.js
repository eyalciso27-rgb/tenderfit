import { RESULT_STATUS } from "./comparison.js";

const ALL_OF_PRIORITY = [RESULT_STATUS.GAP, RESULT_STATUS.REVIEW, RESULT_STATUS.MISSING, RESULT_STATUS.MET];
const STATUS_KEYS = [RESULT_STATUS.MET, RESULT_STATUS.GAP, RESULT_STATUS.REVIEW, RESULT_STATUS.MISSING];

function aggregateParent(logicType, childStatuses) {
  if (logicType === "conditional") return RESULT_STATUS.REVIEW;
  if (!childStatuses.length) return RESULT_STATUS.REVIEW;
  if (logicType === "all_of") return ALL_OF_PRIORITY.find((status) => childStatuses.includes(status)) ?? RESULT_STATUS.REVIEW;
  if (logicType === "any_of") {
    if (childStatuses.includes(RESULT_STATUS.MET)) return RESULT_STATUS.MET;
    if (childStatuses.every((status) => status === RESULT_STATUS.GAP)) return RESULT_STATUS.GAP;
    if (childStatuses.includes(RESULT_STATUS.REVIEW)) return RESULT_STATUS.REVIEW;
    if (childStatuses.includes(RESULT_STATUS.MISSING)) return RESULT_STATUS.MISSING;
  }
  return RESULT_STATUS.REVIEW;
}

function buildSummary(counts, criticalGapCount) {
  const parts = [];
  if (criticalGapCount) parts.push(`${criticalGapCount} פערים בתנאי סף קריטיים`);
  if (counts.missing) parts.push(`${counts.missing} נתונים חסרים בפרופיל`);
  if (counts.review) parts.push(`${counts.review} דרישות שדורשות בדיקה שלך`);
  if (counts.gap && !criticalGapCount) parts.push(`${counts.gap} פערים בדרישות שניתנות להשוואה`);
  return parts.length
    ? `${parts.join(", ו-")}.`
    : "לא זוהו פערים או נתונים חסרים בדרישות שנבדקו אוטומטית.";
}

export function aggregateComparison(requirements, atomicResults) {
  const byId = new Map((requirements ?? []).map((requirement) => [requirement.requirement_id, requirement]));
  const childrenByParent = new Map();
  for (const requirement of requirements ?? []) {
    if (!requirement.parent_requirement_id || !byId.has(requirement.parent_requirement_id)) continue;
    const children = childrenByParent.get(requirement.parent_requirement_id) ?? [];
    children.push(requirement.requirement_id);
    childrenByParent.set(requirement.parent_requirement_id, children);
  }

  const results = { ...atomicResults };
  function resolve(requirementId, ancestors = new Set()) {
    if (ancestors.has(requirementId)) {
      return { status: RESULT_STATUS.REVIEW, explanation: "מבנה Parent/Child מעגלי דורש בדיקה." };
    }
    const requirement = byId.get(requirementId);
    const childIds = childrenByParent.get(requirementId) ?? [];
    if (!childIds.length) return results[requirementId] ?? { status: RESULT_STATUS.REVIEW, explanation: "אין תוצאת השוואה." };
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(requirementId);
    const childStatuses = childIds.map((childId) => resolve(childId, nextAncestors).status);
    const status = aggregateParent(requirement.logic_type, childStatuses);
    const parentResult = {
      status,
      explanation: "תוצאת Parent נגזרה מדרישות המשנה ואינה נספרת שוב במונים.",
      business_fact_key: null,
      business_value: null,
      business_unit: null,
      is_parent: true,
    };
    results[requirementId] = parentResult;
    return parentResult;
  }
  for (const requirement of requirements ?? []) resolve(requirement.requirement_id);

  const counts = Object.fromEntries(STATUS_KEYS.map((status) => [status, 0]));
  let criticalAttentionCount = 0;
  let criticalGapCount = 0;
  for (const requirement of requirements ?? []) {
    const isParent = childrenByParent.has(requirement.requirement_id);
    const status = results[requirement.requirement_id]?.status ?? RESULT_STATUS.REVIEW;
    if (!isParent && requirement.requirement_target === "business_fact" && STATUS_KEYS.includes(status)) counts[status] += 1;
    if (!isParent && requirement.is_critical && requirement.stage === "eligibility" && status !== RESULT_STATUS.MET) {
      criticalAttentionCount += 1;
      if (status === RESULT_STATUS.GAP) criticalGapCount += 1;
    }
  }
  const total = STATUS_KEYS.reduce((sum, status) => sum + counts[status], 0);
  const compliancePercent = total ? Math.round((100 * counts.met) / total) : null;

  return {
    by_requirement_id: results,
    counts,
    atomic_business_fact_count: total,
    critical_attention_count: criticalAttentionCount,
    critical_gap_count: criticalGapCount,
    compliance_percent: compliancePercent,
    summary: buildSummary(counts, criticalGapCount),
    disclaimer: "מחושב אוטומטית מתוך התוצאות. אינו המלצה.",
  };
}
