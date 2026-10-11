import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../tender.html", import.meta.url), "utf8");
const script = await readFile(new URL("../js/tender.js", import.meta.url), "utf8");
const api = await readFile(new URL("../api/tenderfit.js", import.meta.url), "utf8");

test("M4 page exposes neutral Go and No-Go controls and an update timestamp", () => {
  assert.match(html, /id="decision-go"/);
  assert.match(html, /id="decision-no-go"/);
  assert.match(html, /המערכת לא ממליצה Go או No-Go/);
  assert.match(script, /decision_updated_at/);
});

test("M4 page exposes Fit Analysis and AI error reporting without replacing code results", () => {
  assert.match(html, /id="fit-analysis-card"/);
  assert.match(html, /התוצאה מסבירה את בדיקת ההתאמה האוטומטית בלבד/);
  assert.match(html, /id="error-report-dialog"/);
  assert.match(script, /ai_error_reports/);
  assert.match(script, /תוצאות הבדיקה האוטומטית נשמרו/);
  assert.doesNotMatch(html, /בקוד|תוצאות הקוד/);
  assert.doesNotMatch(api, /תוצאות הקוד|שחושבו בקוד/);
});
