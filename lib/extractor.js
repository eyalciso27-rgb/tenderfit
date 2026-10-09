export const REGION_TYPES = Object.freeze([
  "deadlines", "eligibility", "submission", "guarantee", "evaluation",
  "technical_mandatory", "quality", "implementation", "sla", "cybersecurity",
  "insurance", "financial", "contract", "forms", "post_award", "other",
]);

export function fillExtractorPrompt(template, region, contexts) {
  const context = contexts[region.region_type];
  if (!context) throw new Error(`Missing region context: ${region.region_type}`);
  if (!Number.isInteger(region.start_page) || !Number.isInteger(region.end_page)) {
    throw new Error("Region page boundaries are required.");
  }
  const pages = `${region.start_page}–${region.end_page}`;
  return template
    .replaceAll("{{REGION_NAME}}", region.title)
    .replaceAll("{{PAGES}}", pages)
    .replaceAll("{{REGION_CONTEXT}}", context);
}

export function getRegion(regionsOutput, regionId) {
  return regionsOutput?.regions?.find((region) => region.region_id === regionId) ?? null;
}

export function prefixRegionRequirementIds(regionId, requirements) {
  const idMap = new Map(requirements.map((item) => [item.requirement_id, `${regionId}:${item.requirement_id}`]));
  return requirements.map((item) => ({
    ...item,
    requirement_id: idMap.get(item.requirement_id),
    parent_requirement_id: item.parent_requirement_id
      ? (idMap.get(item.parent_requirement_id) ?? `${regionId}:${item.parent_requirement_id}`)
      : null,
  }));
}
