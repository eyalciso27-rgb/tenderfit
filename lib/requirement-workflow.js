export const WORKFLOW_VIEW = Object.freeze({
  ATTENTION: "attention",
  ALL: "all",
  ANSWERED: "answered",
});

export const WORKFLOW_GROUP = Object.freeze({
  BUSINESS_DATA: "business_data",
  RESPONSE: "response",
  SUBMISSION: "submission",
  INFORMATION: "information",
  RESOLVED: "resolved",
});

export const WORKFLOW_GROUP_META = Object.freeze({
  [WORKFLOW_GROUP.BUSINESS_DATA]: {
    label: "להשלמת נתון עסק",
    description: "נתונים חוזרים שאפשר לשמור ולהשתמש בהם גם במכרזים נוספים.",
  },
  [WORKFLOW_GROUP.RESPONSE]: {
    label: "נדרשת תשובה או התחייבות",
    description: "מענה ששייך למכרז הזה בלבד ואינו משנה את פרופיל העסק.",
  },
  [WORKFLOW_GROUP.SUBMISSION]: {
    label: "מסמכים והגשה",
    description: "מסמכים ופעולות שיש להכין לקראת ההגשה.",
  },
  [WORKFLOW_GROUP.INFORMATION]: {
    label: "לקריאה בלבד",
    description: "כללי ניקוד ומידע שאין צורך לשמור כנתון עסק.",
  },
  [WORKFLOW_GROUP.RESOLVED]: {
    label: "נבדק או נענה",
    description: "דרישות שכבר נבדקו אוטומטית או שקיבלו מענה.",
  },
});

export function atomicRequirementIds(requirements = []) {
  const parentIds = new Set(requirements.map((item) => item.parent_requirement_id).filter(Boolean));
  return new Set(requirements.map((item) => item.requirement_id).filter((id) => id && !parentIds.has(id)));
}

export function requirementWorkflow(requirement, result = {}, fact = null, response = null, isAtomic = true) {
  const target = requirement?.requirement_target;
  const answered = Boolean(response);
  const knownFact = fact?.status === "known" && fact?.value !== null && fact?.value !== undefined && fact?.value !== "";
  const automaticallyResolved = target === "business_fact" && ["met", "gap"].includes(result?.status) && knownFact;
  const informational = ["evaluation_rule", "tender_metadata"].includes(target);
  const requiresAction = Boolean(isAtomic && !informational && !answered && !automaticallyResolved);

  let group;
  if (answered || automaticallyResolved) group = WORKFLOW_GROUP.RESOLVED;
  else if (target === "business_fact") group = WORKFLOW_GROUP.BUSINESS_DATA;
  else if (target === "submission_obligation") group = WORKFLOW_GROUP.SUBMISSION;
  else if (informational) group = WORKFLOW_GROUP.INFORMATION;
  else group = WORKFLOW_GROUP.RESPONSE;

  return { group, answered, automaticallyResolved, informational, requiresAction };
}

export function workflowProgress(requirements = [], results = {}, facts = {}, responses = {}) {
  const atomicIds = atomicRequirementIds(requirements);
  let total = 0;
  let completed = 0;
  for (const requirement of requirements) {
    if (!atomicIds.has(requirement.requirement_id)) continue;
    const result = results[requirement.requirement_id] ?? {};
    const factKey = result.business_fact_key || requirement.business_fact_key;
    const workflow = requirementWorkflow(requirement, result, factKey ? facts[factKey] : null, responses[requirement.requirement_id], true);
    if (workflow.informational) continue;
    total += 1;
    if (!workflow.requiresAction) completed += 1;
  }
  return { total, completed, remaining: Math.max(0, total - completed) };
}
