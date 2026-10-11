import { atomicRequirementIds } from "./requirement-workflow.js";

const RESPONSE_STATUSES = ["met", "gap", "partial", "conditional", "review", "not_applicable"];
const INFORMATIONAL_TARGETS = new Set(["business_fact", "evaluation_rule", "tender_metadata"]);

export function summarizeCustomerResponses(requirements = [], responses = {}) {
  const atomicIds = atomicRequirementIds(requirements);
  const counts = Object.fromEntries(RESPONSE_STATUSES.map((status) => [status, 0]));
  const criticalGaps = [];
  let total = 0;
  let answered = 0;

  for (const requirement of requirements) {
    if (!atomicIds.has(requirement.requirement_id)) continue;
    const response = responses?.[requirement.requirement_id] ?? null;
    const expectsResponse = !INFORMATIONAL_TARGETS.has(requirement.requirement_target) || Boolean(response);
    if (!expectsResponse) continue;
    total += 1;
    if (!response || !RESPONSE_STATUSES.includes(response.response_status)) continue;
    answered += 1;
    counts[response.response_status] += 1;
    if (requirement.is_critical && response.response_status === "gap") {
      criticalGaps.push({
        requirementId: requirement.requirement_id,
        text: requirement.requirement_text || "תנאי סף קריטי",
      });
    }
  }

  return {
    total,
    answered,
    remaining: Math.max(0, total - answered),
    counts,
    criticalGaps,
  };
}
