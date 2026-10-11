import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTenderResponse,
  normalizeTenderResponses,
} from "../lib/tender-response.js";

function requirement(id, overrides = {}) {
  return {
    requirement_id: id,
    parent_requirement_id: null,
    requirement_target: "business_fact",
    logic_type: "simple",
    stage: "eligibility",
    is_critical: false,
    ...overrides,
  };
}

function review(decision, note = "") {
  return { decision, note, reviewed_at: "2026-10-11T10:00:00.000Z", source: "browser" };
}

test("legacy manual decisions migrate to separate tender responses", () => {
  const requirements = [requirement("r1")];
  const responses = normalizeTenderResponses(requirements, {}, { r1: review("met", "נבדק מול מסמך") });

  assert.equal(responses.r1.response_status, "met");
  assert.equal(responses.r1.response_basis, "user_statement");
  assert.equal(responses.r1.source, "user");
  assert.equal(responses.r1.note, "נבדק מול מסמך");
});

test("all customer response states are stored without an automatic result", () => {
  for (const status of ["met", "gap", "partial", "conditional", "review", "not_applicable"]) {
    const response = normalizeTenderResponse({
      response_status: status,
      response_basis: "document",
      note: "נבדק",
      updated_at: "2026-10-11T10:00:00.000Z",
    });
    assert.equal(response.response_status, status);
    assert.equal("automatic_status" in response, false);
  }
});

test("a reminder is kept only for requires-review and may omit a date", () => {
  const withDate = normalizeTenderResponse({
    response_status: "review",
    reminder_on: "2026-10-20",
    reminder_sent_at: "2026-10-20T08:00:00.000Z",
  });
  const withoutDate = normalizeTenderResponse({ response_status: "review" });
  const irrelevantDate = normalizeTenderResponse({
    response_status: "met",
    reminder_on: "2026-10-20",
    reminder_sent_at: "2026-10-20T08:00:00.000Z",
  });

  assert.equal(withDate.reminder_on, "2026-10-20");
  assert.equal(withDate.reminder_sent_at, "2026-10-20T08:00:00.000Z");
  assert.equal(withoutDate.reminder_on, null);
  assert.equal(irrelevantDate.reminder_on, null);
  assert.equal(irrelevantDate.reminder_sent_at, null);
});

test("responses are allowed only for atomic requirements", () => {
  const requirements = [
    requirement("parent", { logic_type: "all_of" }),
    requirement("child-a", { parent_requirement_id: "parent" }),
  ];
  const responses = normalizeTenderResponses(requirements, {
    parent: { response_status: "met" },
    "child-a": { response_status: "conditional" },
  });

  assert.equal(responses.parent, undefined);
  assert.equal(responses["child-a"].response_status, "conditional");
});

test("responses may belong to non-business tender requirements", () => {
  const requirements = [requirement("submission", { requirement_target: "submission_obligation" })];
  const responses = normalizeTenderResponses(requirements, {
    submission: { response_status: "conditional", response_basis: "future_commitment" },
  });

  assert.equal(responses.submission.response_status, "conditional");
  assert.equal(responses.submission.response_basis, "future_commitment");
});

test("invalid responses are ignored and long notes are bounded", () => {
  const invalid = normalizeTenderResponse({ response_status: "missing" });
  const valid = normalizeTenderResponse({ response_status: "met", note: "א".repeat(700) });

  assert.equal(invalid, null);
  assert.equal(valid.note.length, 500);
});
