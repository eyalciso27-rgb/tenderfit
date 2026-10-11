import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const uploadHtml = await readFile(new URL("../upload.html", import.meta.url), "utf8");
const uploadScript = await readFile(new URL("../js/upload.js", import.meta.url), "utf8");
const pipelineScript = await readFile(new URL("../js/pipeline.js", import.meta.url), "utf8");
const processingModel = await readFile(new URL("../lib/processing-status.js", import.meta.url), "utf8");
const tenderHtml = await readFile(new URL("../tender.html", import.meta.url), "utf8");
const tenderScript = await readFile(new URL("../js/tender.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
const profileHtml = await readFile(new URL("../profile.html", import.meta.url), "utf8");
const checklistHtml = await readFile(new URL("../checklist.html", import.meta.url), "utf8");

test("F10 renders six persisted processing phases with words and icons", () => {
  assert.match(uploadHtml, /id="processing-title"/);
  assert.match(uploadHtml, /מתוך <bdi>6<\/bdi>/);
  assert.match(uploadHtml, /role="progressbar"/);
  for (const label of ["מעלה את המסמך", "ממפה אזורי דרישות", "מחלץ דרישות", "מאמת שלמות ומקור", "בודק נתונים חסרים", "מחשב התאמה"]) {
    assert.match(processingModel, new RegExp(label));
  }
  assert.match(uploadScript, /\.select\("id,processing"\)/);
  assert.match(uploadScript, /applyProcessingEvent/);
  assert.doesNotMatch(uploadScript, /realtime|channel\(/i);
});

test("the upload flow now completes compare before navigating to the tender", () => {
  assert.match(pipelineScript, /step: "facts", state: "starting"/);
  assert.match(pipelineScript, /runUntilDone\("compare"/);
  assert.match(pipelineScript, /localStorage\.removeItem\("tenderfit\.activeTender"\)/);
});

test("F22 exposes collapsible summary, dates and guarantees from saved F15 metadata", () => {
  assert.match(tenderHtml, /<details id="executive-summary-section"/);
  assert.match(tenderHtml, /<details id="dates-guarantees-section"/);
  assert.match(tenderHtml, /מועדים קריטיים/);
  assert.match(tenderHtml, /ערבויות/);
  assert.match(tenderScript, /normalizeTenderMetadata\(tender\.metadata/);
  assert.match(tenderScript, /סיכום מנהלים לא חולץ מהמסמך/);
  assert.match(tenderScript, /ערבויות לא חולצו מהמסמך/);
  assert.match(tenderHtml, /אינו ייעוץ משפטי/);
});

test("M6 does not add M7 tender-list or reminder features", () => {
  assert.doesNotMatch(uploadHtml + tenderHtml, /רשימת מכרזים|תזכורת במייל/);
});

test("existing M6 screens use the approved mobile shell and dashboard layout", () => {
  for (const html of [uploadHtml, profileHtml, tenderHtml, checklistHtml]) {
    assert.match(html, /class="mobile-nav"/);
    assert.match(html, /class="app-header"/);
  }
  assert.match(tenderHtml, /class="tender-dashboard"/);
  assert.match(tenderHtml, /id="compliance-ring"/);
  assert.match(tenderScript, /organizeDashboardLayout/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) 340px/);
  assert.match(styles, /bottom: 68px/);
});

test("the M6 tender page is a guided workspace instead of two long duplicate reports", () => {
  assert.match(tenderHtml, /עדכן את בדיקת ההתאמה/);
  assert.match(tenderHtml, /id="fit-analysis-toggle"/);
  assert.match(tenderHtml, /id="workflow-progress-count"/);
  assert.match(tenderHtml, /data-workflow-view="attention"/);
  assert.match(tenderHtml, /למשימה הבאה/);
  assert.match(tenderHtml, /id="show-more-requirements"/);
  assert.match(tenderHtml, /id="customer-response-summary"/);
  assert.match(tenderHtml, /id="customer-critical-alert"/);
  assert.match(tenderHtml, /id="decision-risk-warning"/);
  assert.doesNotMatch(tenderHtml, /נתונים להשוואה למכרז הזה/);
  assert.doesNotMatch(tenderScript, /לסעיף הזה אין Business Fact חוזר/);
  assert.match(tenderScript, /מענה למכרז הזה בלבד/);
  assert.match(tenderScript, /נדרשת תשובתך/);
  assert.match(tenderScript, /summarizeCustomerResponses/);
  assert.match(tenderScript, /תנאי סף קריטיים/);
  assert.match(tenderScript, /compareButton\.addEventListener\("click", \(\) => compare\(\)\)/);
  assert.match(styles, /M6 guided tender workspace/);
});
