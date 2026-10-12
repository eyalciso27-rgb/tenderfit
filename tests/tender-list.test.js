import test from "node:test";
import assert from "node:assert/strict";

import { landingPageForProfile, splitTenderList, tenderListItem } from "../lib/tender-list.js";

const now = new Date("2026-10-12T09:00:00.000Z");

test("tender list separates passed deadlines and keeps unknown deadlines active", () => {
  const groups = splitTenderList([
    { id: "future", submission_deadline: "2026-10-20T09:00:00.000Z" },
    { id: "past", submission_deadline: "2026-10-11T09:00:00.000Z" },
    { id: "unknown", submission_deadline: null },
  ], now);
  assert.deepEqual(groups.active.map((item) => item.id), ["future", "unknown"]);
  assert.deepEqual(groups.ended.map((item) => item.id), ["past"]);
});

test("list item exposes deterministic result and Go checklist progress", () => {
  const item = tenderListItem({
    decision: "go",
    processing: { steps: { upload: { status: "done" }, map: { status: "done" }, metadata: { status: "done" }, validate: { status: "done" }, compare: { status: "done" } }, regions: {} },
    results: { counts: { met: 4, gap: 1, review: 2, missing: 3 }, compliance_percent: 40 },
    checklist: [{ item_id: "C-1", name: "א", done: true }, { item_id: "C-2", name: "ב", done: false }],
  }, now);
  assert.deepEqual(item.counts, { met: 4, gap: 1, review: 2, missing: 3 });
  assert.equal(item.compliancePercent, 40);
  assert.deepEqual(item.checklistProgress, { completed: 1, total: 2, percent: 50 });
  assert.equal(item.fitState.level, "ready");
});

test("stale analysis is visible and non-Go tenders have no checklist progress", () => {
  const item = tenderListItem({ results: { stale: true }, decision: "no_go", checklist: [] }, now);
  assert.equal(item.fitState.level, "stale");
  assert.equal(item.checklistProgress, null);
});

test("first use opens the profile and regular login opens the tender list", () => {
  assert.equal(landingPageForProfile(null), "profile.html");
  assert.equal(landingPageForProfile({ legal_name: "" }), "profile.html");
  assert.equal(landingPageForProfile({ legal_name: "עסק לדוגמה" }), "tenders.html");
});
