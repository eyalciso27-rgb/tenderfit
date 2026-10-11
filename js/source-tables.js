function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function referencesTable(requirement) {
  const text = `${requirement?.requirement_text ?? ""} ${requirement?.source_quote ?? ""}`;
  return /טבל(?:ה|אות)/.test(text);
}

export function groupTableRequirements(requirements) {
  const groups = new Map();
  for (const requirement of requirements ?? []) {
    if (requirement.source_type !== "table" && !requirement.table_id && !requirement.cell_text) continue;
    const title = requirement.table_id || requirement.source_section || `טבלה בעמוד ${requirement.source_page ?? "לא ידוע"}`;
    const key = `${title}::${requirement.source_section ?? ""}`;
    const group = groups.get(key) ?? { key, title, source_section: requirement.source_section ?? null, requirements: [] };
    group.requirements.push(requirement);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    requirements: group.requirements.sort((first, second) => (
      numeric(first.source_page) - numeric(second.source_page)
      || numeric(first.row_index) - numeric(second.row_index)
      || numeric(first.column_index) - numeric(second.column_index)
    )),
  })).sort((first, second) => (
    numeric(first.requirements[0]?.source_page) - numeric(second.requirements[0]?.source_page)
    || first.title.localeCompare(second.title, "he")
  ));
}
