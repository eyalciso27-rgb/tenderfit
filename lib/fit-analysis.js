const SECTION_STATUS = Object.freeze({
  strengths: "met",
  gaps: "gap",
  missing_information: "missing",
  review_priorities: "review",
});

export function buildFitAnalysisContext(tender, businessFacts = {}) {
  const requirements = tender?.requirements ?? [];
  const byRequirement = tender?.results?.by_requirement_id ?? {};
  const parentIds = new Set(requirements.map((item) => item.parent_requirement_id).filter(Boolean));
  const referencedFactKeys = new Set();

  const atomicRequirements = requirements
    .filter((requirement) => !parentIds.has(requirement.requirement_id))
    .map((requirement) => {
      const result = byRequirement[requirement.requirement_id] ?? null;
      const factKey = result?.business_fact_key ?? requirement.business_fact_key ?? null;
      if (factKey) referencedFactKeys.add(factKey);
      return {
        requirement_id: requirement.requirement_id,
        requirement_text: requirement.requirement_text,
        requirement_target: requirement.requirement_target,
        stage: requirement.stage,
        is_critical: Boolean(requirement.is_critical),
        code_comparable: Boolean(requirement.code_comparable),
        requires_manual_review: Boolean(requirement.requires_manual_review),
        source_page: requirement.source_page ?? null,
        source_section: requirement.source_section ?? null,
        result: result ? {
          status: result.status,
          explanation: result.explanation,
          business_fact_key: result.business_fact_key ?? null,
          business_value: result.business_value ?? null,
          business_unit: result.business_unit ?? null,
        } : null,
      };
    });

  const relevantFacts = Object.fromEntries(
    [...referencedFactKeys]
      .filter((key) => businessFacts?.[key])
      .map((key) => [key, businessFacts[key]]),
  );

  return {
    tender: {
      title: tender?.title ?? null,
      tender_number: tender?.tender_number ?? null,
      publisher: tender?.publisher ?? null,
      submission_deadline: tender?.submission_deadline ?? null,
    },
    code_summary: {
      counts: tender?.results?.counts ?? {},
      critical_attention_count: tender?.results?.critical_attention_count ?? 0,
      summary: tender?.results?.summary ?? null,
      disclaimer: tender?.results?.disclaimer ?? null,
    },
    requirements: atomicRequirements,
    business_facts: relevantFacts,
  };
}

export function fillFitAnalysisPrompt(template, context) {
  const marker = "{{FIT_CONTEXT_JSON}}";
  if (typeof template !== "string" || !template.includes(marker)) {
    const error = new Error("Fit Analysis prompt marker is missing.");
    error.code = "fit_prompt_invalid";
    throw error;
  }
  return template.replace(marker, JSON.stringify(context));
}

export function validateFitAnalysisSemantics(output, results) {
  const errors = [];
  const knownResults = results?.by_requirement_id ?? {};
  for (const [section, expectedStatus] of Object.entries(SECTION_STATUS)) {
    const seen = new Set();
    for (const item of output?.[section] ?? []) {
      const result = knownResults[item.requirement_id];
      if (!result) errors.push(`${section}:${item.requirement_id}:unknown_requirement`);
      else if (result.status !== expectedStatus) errors.push(`${section}:${item.requirement_id}:expected_${expectedStatus}`);
      if (seen.has(item.requirement_id)) errors.push(`${section}:${item.requirement_id}:duplicate`);
      seen.add(item.requirement_id);
    }
  }
  return { valid: errors.length === 0, errors };
}
