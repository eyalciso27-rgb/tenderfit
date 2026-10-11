export const TENDER_DECISION = Object.freeze({
  GO: "go",
  NO_GO: "no_go",
});

const DECISIONS = new Set(Object.values(TENDER_DECISION));

export function normalizeTenderDecision(value) {
  return DECISIONS.has(value) ? value : null;
}

export function buildDecisionUpdate(value, updatedAt = new Date().toISOString()) {
  const decision = normalizeTenderDecision(value);
  if (!decision || !Number.isFinite(Date.parse(updatedAt))) return null;
  return { decision, decision_updated_at: updatedAt, updated_at: updatedAt };
}

export function buildAiErrorReport({
  userId,
  tenderId,
  requirement,
  comparisonResult,
  fitAnalysis = null,
  userExplanation,
  createdAt = new Date().toISOString(),
}) {
  const explanation = String(userExplanation ?? "").trim();
  if (!userId || !tenderId || !requirement?.requirement_id || !explanation) return null;
  if (!Number.isFinite(Date.parse(createdAt))) return null;

  return {
    user_id: userId,
    tender_id: tenderId,
    requirement_id: requirement.requirement_id,
    ai_result: {
      requirement: structuredClone(requirement),
      comparison_result: structuredClone(comparisonResult ?? null),
      fit_analysis: structuredClone(fitAnalysis),
    },
    user_explanation: explanation,
    status: "new",
    created_at: createdAt,
  };
}
