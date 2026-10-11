import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tenderHtml = await readFile(new URL("../tender.html", import.meta.url), "utf8");
const tenderScript = await readFile(new URL("../js/tender.js", import.meta.url), "utf8");
const checklistHtml = await readFile(new URL("../checklist.html", import.meta.url), "utf8");
const checklistScript = await readFile(new URL("../js/checklist.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");

test("Go creates the Checklist once and No-Go does not overwrite it", () => {
  assert.match(tenderHtml, /id="checklist-link"/);
  assert.match(tenderScript, /value === "go".*checklistForGo/s);
  assert.match(tenderScript, /Array\.isArray\(tender\.checklist\)/);
  assert.doesNotMatch(tenderScript, /value === "no_go"[^}]*checklist\s*=/s);
});

test("Checklist screen persists item status and renders deterministic progress", () => {
  assert.match(checklistScript, /updateChecklistItem/);
  assert.match(checklistScript, /checklistProgress/);
  assert.match(checklistScript, /\.update\(\{ checklist: next/);
  assert.match(checklistScript, /\.select\("checklist, updated_at"\)/);
  assert.match(checklistHtml, /role="progressbar"/);
  assert.match(checklistHtml, /id="progress-count"/);
  assert.match(checklistScript, /לא התחיל/);
  assert.match(checklistScript, /בתהליך/);
  assert.match(checklistScript, /הושלם/);
});

test("Checklist screen has RTL, labelled controls, text status and responsive views", () => {
  assert.match(checklistHtml, /<html lang="he" dir="rtl">/);
  assert.match(checklistHtml, /aria-live="polite"/);
  assert.match(checklistScript, /aria-label.*סטטוס/);
  assert.match(checklistScript, /aria-label.*כהושלם/);
  assert.match(checklistScript, /className = "checklist-source"/);
  assert.match(styles, /\.checklist-mobile-list/);
  assert.match(styles, /@media \(min-width: 800px\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /\.button:focus-visible/);
});

test("M5 remains code-only and does not add M6 reminders or AI calls", () => {
  assert.doesNotMatch(checklistScript, /runPipelineStepUntilDone|GoogleGenAI|gemini/i);
  assert.doesNotMatch(checklistHtml, /תזכורת|reminder|WhatsApp|SMS/i);
});
