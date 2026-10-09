import assert from "node:assert/strict";
import test from "node:test";

import handler, { ALLOWED_STEPS } from "../api/tenderfit.js";

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
