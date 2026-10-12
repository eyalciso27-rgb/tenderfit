import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../tenders.html", import.meta.url), "utf8");
const script = await readFile(new URL("../js/tenders.js", import.meta.url), "utf8");
const auth = await readFile(new URL("../js/auth.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
const workflow = await readFile(new URL("../n8n/f32-reminders.workflow.json", import.meta.url), "utf8");

test("F28 has active and ended counts with links to tenders and new upload", () => {
  assert.match(html, /פעילים \(<bdi id="active-tenders-count">/);
  assert.match(html, /הסתיימו \(<bdi id="ended-tenders-count">/);
  assert.match(html, /href="upload\.html"[^>]*>[\s\S]*?מכרז חדש/);
  assert.match(script, /tender\.html\?id=/);
  assert.match(script, /groups\.active\.length/);
  assert.match(script, /groups\.ended\.length/);
});

test("F28 provides mobile cards and a desktop table at the approved breakpoint", () => {
  assert.match(html, /id="tender-cards"/);
  assert.match(html, /class="tender-list-table"/);
  assert.match(styles, /@media \(min-width: 1024px\)[\s\S]*\.tender-list-cards[\s\S]*display: none/);
  assert.match(styles, /\.tender-list-table-wrap[\s\S]*display: block/);
});

test("regular login routes to the list while first use routes to the profile", () => {
  assert.match(auth, /landingPageForProfile/);
  assert.match(auth, /select\("legal_name"\)/);
});

test("F32 repository template stays inactive and contains no credentials or real destination", () => {
  const parsed = JSON.parse(workflow);
  assert.equal(parsed.active, false);
  assert.match(workflow, /CHANGE-ME/);
  assert.match(workflow, /CHANGE_TO_APPROVED_TEST_EMAIL/);
  assert.doesNotMatch(workflow, /eyalicohen@gmail\.com/);
  assert.doesNotMatch(workflow, /"credentials"\s*:/);
  assert.match(workflow, /n8n-nodes-base\.emailSend/);
  assert.doesNotMatch(workflow, /n8n-nodes-base\.gmail/);
  assert.match(workflow, /reminder_sent_at/);
});
