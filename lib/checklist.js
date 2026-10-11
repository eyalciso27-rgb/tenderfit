export const CHECKLIST_STATUS = Object.freeze({
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  DONE: "done",
});

const VALID_STATUSES = new Set(Object.values(CHECKLIST_STATUS));

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceFor(requirement) {
  return {
    page: Number.isFinite(Number(requirement?.source_page)) ? Number(requirement.source_page) : null,
    section: cleanText(requirement?.source_section) || null,
  };
}

export function createChecklist(requirements = []) {
  const sourceRequirements = Array.isArray(requirements) ? requirements : [];
  const parentIds = new Set(sourceRequirements.map((item) => item?.parent_requirement_id).filter(Boolean));
  const groups = new Map();

  for (const requirement of sourceRequirements) {
    const requirementId = cleanText(requirement?.requirement_id);
    if (!requirementId || parentIds.has(requirementId)) continue;
    const evidence = cleanText(requirement?.evidence_required);
    if (requirement?.requirement_target !== "submission_obligation" && !evidence) continue;

    const name = evidence || cleanText(requirement?.requirement_text) || "פריט להכנה";
    const key = evidence ? `evidence:${evidence}` : `requirement:${requirementId}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.requirement_ids.includes(requirementId)) existing.requirement_ids.push(requirementId);
      continue;
    }
    groups.set(key, {
      name,
      requirement_ids: [requirementId],
      source: sourceFor(requirement),
    });
  }

  return [...groups.values()].map((group, index) => ({
    item_id: `C-${String(index + 1).padStart(3, "0")}`,
    ...group,
    done: false,
    status: CHECKLIST_STATUS.OPEN,
    due_date: null,
    note: null,
  }));
}

export function checklistForGo(existingChecklist, requirements = []) {
  return Array.isArray(existingChecklist) ? existingChecklist : createChecklist(requirements);
}

export function normalizeChecklist(checklist) {
  if (!Array.isArray(checklist)) return [];
  const seen = new Set();
  return checklist.flatMap((raw, index) => {
    const itemId = cleanText(raw?.item_id) || `C-${String(index + 1).padStart(3, "0")}`;
    if (seen.has(itemId)) return [];
    seen.add(itemId);
    const done = raw?.done === true || raw?.status === CHECKLIST_STATUS.DONE;
    const status = done
      ? CHECKLIST_STATUS.DONE
      : VALID_STATUSES.has(raw?.status) ? raw.status : CHECKLIST_STATUS.OPEN;
    return [{
      item_id: itemId,
      name: cleanText(raw?.name) || "פריט להכנה",
      requirement_ids: [...new Set((Array.isArray(raw?.requirement_ids) ? raw.requirement_ids : []).map(cleanText).filter(Boolean))],
      source: {
        page: Number.isFinite(Number(raw?.source?.page)) ? Number(raw.source.page) : null,
        section: cleanText(raw?.source?.section) || null,
      },
      done,
      status,
      due_date: raw?.due_date ?? null,
      note: raw?.note ?? null,
    }];
  });
}

export function updateChecklistItem(checklist, itemId, changes = {}) {
  return normalizeChecklist(checklist).map((item) => {
    if (item.item_id !== itemId) return item;
    let status = VALID_STATUSES.has(changes.status) ? changes.status : item.status;
    let done = typeof changes.done === "boolean" ? changes.done : item.done;
    if (typeof changes.done === "boolean" && !changes.status) {
      status = changes.done ? CHECKLIST_STATUS.DONE : CHECKLIST_STATUS.OPEN;
    } else if (changes.status) {
      done = status === CHECKLIST_STATUS.DONE;
    }
    return { ...item, done, status };
  });
}

export function checklistProgress(checklist) {
  const items = normalizeChecklist(checklist);
  const completed = items.filter((item) => item.done).length;
  return {
    total: items.length,
    completed,
    percent: items.length ? Math.round((completed / items.length) * 100) : 0,
  };
}
