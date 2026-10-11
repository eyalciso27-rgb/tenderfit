import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";

import handler, {
  ALLOWED_STEPS,
  buildComparisonResults,
  createInlinePdfDocument,
  isGeminiBlobstoreFileError,
  isPendingInteractionExpired,
  isStaleRunning,
} from "../api/tenderfit.js";

class MockResponse {
  constructor() {
    this.headers = {};
    this.statusCode = 200;
    this.body = null;
    this.ended = false;
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  }

  json(body) {
    this.body = body;
    this.ended = true;
    return this;
  }

  end() {
    this.ended = true;
    return this;
  }
}

test("the API exposes exactly the six architecture steps", () => {
  assert.deepEqual(ALLOWED_STEPS, [
    "upload",
    "map",
    "metadata",
    "extract",
    "validate",
    "compare",
  ]);
});

test("an allowed CORS preflight receives the configured origin", async (context) => {
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  context.after(() => {
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
  });
  process.env.ALLOWED_ORIGIN = "https://example.github.io";
  const response = new MockResponse();

  await handler({
    method: "OPTIONS",
    headers: { origin: "https://example.github.io" },
    query: {},
  }, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://example.github.io");
  assert.equal(response.ended, true);
});

test("a different browser origin is blocked with uniform JSON", async (context) => {
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  context.after(() => {
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
  });
  process.env.ALLOWED_ORIGIN = "https://example.github.io";
  const response = new MockResponse();

  await handler({
    method: "POST",
    headers: { origin: "https://attacker.example" },
    query: { step: "upload" },
  }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
  assert.deepEqual(response.body, {
    ok: false,
    step: "upload",
    status: "failed",
    error: {
      code: "origin_not_allowed",
      message: "מקור הבקשה אינו מורשה.",
    },
  });
});

test("a request without a bearer token receives 401 JSON", async (context) => {
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  context.after(() => {
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
  });
  process.env.ALLOWED_ORIGIN = "https://example.github.io";
  const response = new MockResponse();

  await handler({
    method: "POST",
    headers: { origin: "https://example.github.io" },
    query: { step: "upload" },
    body: {},
  }, response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, "authentication_required");
});

test("the known Gemini background file-reference failure is classified", () => {
  assert.equal(
    isGeminiBlobstoreFileError({
      status: 400,
      message: "400 Unsupported file uri: blobstore:///genai-api/blobref/global::abc",
    }),
    true,
  );
  assert.equal(isGeminiBlobstoreFileError({ status: 503, message: "service unavailable" }), false);
});

test("the approved map workaround creates an inline PDF document input", () => {
  assert.deepEqual(createInlinePdfDocument(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), {
    type: "document",
    data: "JVBERi0=",
    mime_type: "application/pdf",
  });
});

test("resume checks Gemini status before applying the 15 minute timeout", () => {
  const sentAt = "2026-10-09T10:00:00.000Z";
  const now = Date.parse("2026-10-09T10:16:00.000Z");
  assert.equal(isPendingInteractionExpired("in_progress", sentAt, now), true);
  assert.equal(isPendingInteractionExpired("completed", sentAt, now), false);
  assert.equal(isPendingInteractionExpired("failed", sentAt, now), false);
});

test("a running lock is reclaimable only after 330 seconds", () => {
  const startedAt = "2026-10-09T10:00:00.000Z";
  assert.equal(isStaleRunning({ status: "running", started_at: startedAt }, Date.parse("2026-10-09T10:05:29.000Z")), false);
  assert.equal(isStaleRunning({ status: "running", started_at: startedAt }, Date.parse("2026-10-09T10:05:30.000Z")), true);
});

test("compare builds stored code results without a model response", () => {
  const requirements = [{
    requirement_id: "r1",
    parent_requirement_id: null,
    requirement_target: "business_fact",
    business_fact_key: "registered_entity_in_israel",
    business_fact_type: "boolean",
    requirement_type: "threshold",
    comparison_operator: "=",
    value: true,
    value_secondary: null,
    unit: null,
    period: null,
    scope: null,
    code_comparable: true,
    requires_manual_review: false,
    logic_type: "simple",
    stage: "eligibility",
    is_critical: true,
  }];
  const profile = {
    registered_entity_in_israel: {
      business_fact_type: "boolean",
      unit: null,
      value: true,
      status: "known",
      aliases: ["israeli_registered_entity"],
    },
  };

  const output = buildComparisonResults(requirements, profile, "2027-01-01");

  assert.equal(output.results.by_requirement_id.r1.status, "met");
  assert.deepEqual(output.results.counts, { met: 1, gap: 0, review: 0, missing: 0 });
  assert.equal(output.results.critical_attention_count, 0);
});

test("the complete code comparison stays below two seconds", () => {
  const requirements = Array.from({ length: 5000 }, (_, index) => ({
    requirement_id: `r-${index}`,
    parent_requirement_id: null,
    requirement_target: "business_fact",
    business_fact_key: `fact_${index}`,
    business_fact_type: "number",
    requirement_type: "threshold",
    comparison_operator: ">=",
    value: 1,
    value_secondary: null,
    unit: "items",
    period: null,
    scope: null,
    code_comparable: true,
    requires_manual_review: false,
    logic_type: "simple",
    stage: "eligibility",
    is_critical: false,
  }));
  const profile = Object.fromEntries(requirements.map((item) => [item.business_fact_key, {
    business_fact_type: "number",
    unit: "items",
    value: 2,
    status: "known",
  }]));
  const started = performance.now();
  const output = buildComparisonResults(requirements, profile, "2027-01-01");
  const elapsed = performance.now() - started;

  assert.equal(output.results.counts.met, 5000);
  assert.ok(elapsed < 2000, `full comparison took ${elapsed.toFixed(1)}ms`);
});
