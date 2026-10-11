import test from "node:test";
import assert from "node:assert/strict";

import {
  CHECKLIST_STATUS,
  checklistForGo,
  checklistProgress,
  createChecklist,
  normalizeChecklist,
  updateChecklistItem,
} from "../lib/checklist.js";

function requirement(id, overrides = {}) {
  return {
    requirement_id: id,
    parent_requirement_id: null,
    requirement_target: "submission_obligation",
    requirement_text: `דרישה ${id}`,
    evidence_required: null,
    source_page: 7,
    source_section: "2.1",
    ...overrides,
  };
}

test("Checklist uses atomic submission obligations and evidence requirements", () => {
  const checklist = createChecklist([
    requirement("parent"),
    requirement("child", { parent_requirement_id: "parent", evidence_required: "אישור רו״ח" }),
    requirement("business", { requirement_target: "business_fact", evidence_required: "תעודת ISO" }),
    requirement("ignored", { requirement_target: "business_fact" }),
  ]);

  assert.deepEqual(checklist.map((item) => item.name), ["אישור רו״ח", "תעודת ISO"]);
  assert.deepEqual(checklist.map((item) => item.item_id), ["C-001", "C-002"]);
  assert.ok(checklist.every((item) => item.status === "open" && item.done === false));
});

test("Checklist merges only identical non-empty evidence names", () => {
  const checklist = createChecklist([
    requirement("a", { evidence_required: "אישור רו״ח" }),
    requirement("b", { evidence_required: "אישור רו״ח", source_page: 9 }),
    requirement("c", { evidence_required: "אישור רואה חשבון" }),
    requirement("d"),
    requirement("e"),
  ]);

  assert.equal(checklist.length, 4);
  assert.deepEqual(checklist[0].requirement_ids, ["a", "b"]);
  assert.deepEqual(checklist.slice(2).map((item) => item.requirement_ids), [["d"], ["e"]]);
});

test("Returning to Go preserves an existing Checklist without regenerating it", () => {
  const existing = [{ item_id: "C-001", name: "קיים", done: true, status: "done" }];
  assert.equal(checklistForGo(existing, [requirement("new")]), existing);
  assert.equal(checklistForGo(null, [requirement("new")]).length, 1);
});

test("Checklist status and completion stay consistent and progress is deterministic", () => {
  const original = createChecklist([requirement("a"), requirement("b")]);
  const inProgress = updateChecklistItem(original, "C-001", { status: CHECKLIST_STATUS.IN_PROGRESS });
  const completed = updateChecklistItem(inProgress, "C-001", { done: true });

  assert.equal(original[0].status, CHECKLIST_STATUS.OPEN);
  assert.equal(inProgress[0].done, false);
  assert.equal(completed[0].status, CHECKLIST_STATUS.DONE);
  assert.deepEqual(checklistProgress(completed), { total: 2, completed: 1, percent: 50 });
});

test("Checklist normalization removes duplicate IDs and repairs invalid status", () => {
  const normalized = normalizeChecklist([
    { item_id: "C-001", name: "א", status: "unknown", requirement_ids: ["r1", "r1"] },
    { item_id: "C-001", name: "כפול", status: "done" },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].status, CHECKLIST_STATUS.OPEN);
  assert.deepEqual(normalized[0].requirement_ids, ["r1"]);
});
