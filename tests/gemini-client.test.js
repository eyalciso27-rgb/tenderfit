import assert from "node:assert/strict";
import test from "node:test";

import {
  createGeminiClient,
  GEMINI_ROUTE,
  GeminiClientConfigurationError,
} from "../lib/gemini-client.js";

class MockGoogleGenAI {
  constructor(options) {
    this.options = options;
  }
}

function mockOptions(environment) {
  return { environment, Client: MockGoogleGenAI };
}

test("the Pro route uses only GEMINI_API_KEY", () => {
  const client = createGeminiClient(GEMINI_ROUTE.PRO, mockOptions({
    GEMINI_API_KEY: "dummy-pro-key",
    GEMINI_FLASH_API_KEY: "dummy-flash-key",
  }));

  assert.deepEqual(client.options, { apiKey: "dummy-pro-key" });
});

test("the Flash route uses only GEMINI_FLASH_API_KEY", () => {
  const client = createGeminiClient(GEMINI_ROUTE.FLASH, mockOptions({
    GEMINI_API_KEY: "dummy-pro-key",
    GEMINI_FLASH_API_KEY: "dummy-flash-key",
  }));

  assert.deepEqual(client.options, { apiKey: "dummy-flash-key" });
});

test("the optional Flash key is not required for the existing Pro route", () => {
  const client = createGeminiClient(GEMINI_ROUTE.PRO, mockOptions({
    GEMINI_API_KEY: "dummy-pro-key",
  }));

  assert.deepEqual(client.options, { apiKey: "dummy-pro-key" });
});

test("a Flash key never replaces a missing Pro key", () => {
  assert.throws(
    () => createGeminiClient(GEMINI_ROUTE.PRO, mockOptions({
      GEMINI_FLASH_API_KEY: "dummy-flash-key",
    })),
    (error) => error instanceof GeminiClientConfigurationError
      && error.code === "gemini_route_not_configured"
      && !error.message.includes("dummy-flash-key"),
  );
});

test("a Pro key never replaces a missing Flash key", () => {
  assert.throws(
    () => createGeminiClient(GEMINI_ROUTE.FLASH, mockOptions({
      GEMINI_API_KEY: "dummy-pro-key",
    })),
    (error) => error instanceof GeminiClientConfigurationError
      && error.code === "gemini_route_not_configured"
      && !error.message.includes("dummy-pro-key"),
  );
});

test("Gemini client creation requires an explicit known route", () => {
  for (const route of [undefined, null, "auto", ""]) {
    assert.throws(
      () => createGeminiClient(route, mockOptions({
        GEMINI_API_KEY: "dummy-pro-key",
        GEMINI_FLASH_API_KEY: "dummy-flash-key",
      })),
      (error) => error instanceof GeminiClientConfigurationError
        && error.code === "gemini_route_required"
        && !error.message.includes("dummy-pro-key")
        && !error.message.includes("dummy-flash-key"),
    );
  }
});
