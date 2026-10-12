import test from "node:test";
import assert from "node:assert/strict";

import { buildDueReminderEmails } from "../lib/reminders.js";

const now = new Date("2026-10-11T06:00:00.000Z");

function tender(overrides = {}) {
  return {
    id: "t1",
    title: "מכרז בדיקה",
    decision: null,
    submission_deadline: null,
    requirements: [{ requirement_id: "r1", requirement_text: "בדיקת רישיון" }],
    results: { responses: {} },
    ...overrides,
  };
}

test("requires-review without a target date never creates an email", () => {
  const emails = buildDueReminderEmails([tender({
    results: { responses: { r1: { response_status: "review", reminder_on: null } } },
  })], { now });
  assert.deepEqual(emails, []);
});

test("a due customer date creates one email and marks it sent", () => {
  const emails = buildDueReminderEmails([tender({
    results: { responses: { r1: { response_status: "review", reminder_on: "2026-10-11", note: "לבדוק" } } },
  })], { now, appUrl: "https://example.test" });

  assert.equal(emails.length, 1);
  assert.match(emails[0].message, /בדיקת רישיון/);
  assert.match(emails[0].message, /לבדוק/);
  assert.match(emails[0].message, /https:\/\/example\.test\/tender\.html\?id=t1/);
  assert.equal(emails[0].results.responses.r1.reminder_sent_at, now.toISOString());
});

test("sent, future, or non-review responses do not create review reminders", () => {
  const emails = buildDueReminderEmails([tender({
    requirements: [
      { requirement_id: "sent", requirement_text: "נשלח" },
      { requirement_id: "future", requirement_text: "עתידי" },
      { requirement_id: "met", requirement_text: "עומד" },
    ],
    results: { responses: {
      sent: { response_status: "review", reminder_on: "2026-10-10", reminder_sent_at: "2026-10-10T06:00:00.000Z" },
      future: { response_status: "review", reminder_on: "2026-10-12", reminder_sent_at: null },
      met: { response_status: "met", reminder_on: "2026-10-10", reminder_sent_at: null },
    } },
  })], { now });
  assert.deepEqual(emails, []);
});

test("a Go tender within seven days creates the existing F32 deadline reminder", () => {
  const emails = buildDueReminderEmails([tender({
    decision: "go",
    submission_deadline: "2026-10-18T09:00:00.000Z",
  })], { now });

  assert.equal(emails.length, 1);
  assert.equal(emails[0].deadline_due, true);
  assert.equal(emails[0].needs_results_update, false);
});

test("No-Go, far deadlines, and missing deadlines do not create deadline mail", () => {
  const emails = buildDueReminderEmails([
    tender({ id: "no-go", decision: "no_go", submission_deadline: "2026-10-15T09:00:00.000Z" }),
    tender({ id: "far", decision: "go", submission_deadline: "2026-10-19T09:00:00.000Z" }),
    tender({ id: "missing", decision: "go", submission_deadline: null }),
  ], { now });
  assert.deepEqual(emails, []);
});

test("a due review reminder changes only its sent marker inside saved results", () => {
  const original = {
    counts: { met: 1, gap: 0, review: 1, missing: 0 },
    responses: {
      r1: { response_status: "review", reminder_on: "2026-10-11", note: "לבדוק" },
      r2: { response_status: "met", note: "נבדק" },
    },
  };
  const [email] = buildDueReminderEmails([tender({ results: original })], { now });
  assert.deepEqual(email.results.counts, original.counts);
  assert.deepEqual(email.results.responses.r2, original.responses.r2);
  assert.deepEqual(email.results.responses.r1, {
    ...original.responses.r1,
    reminder_sent_at: now.toISOString(),
  });
  assert.equal("reminder_sent_at" in original.responses.r1, false);
});
