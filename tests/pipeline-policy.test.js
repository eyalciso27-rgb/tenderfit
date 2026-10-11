import assert from "node:assert/strict";
import test from "node:test";

import { shouldRetryRegion, shouldRetryStep } from "../js/pipeline-policy.js";

test("M2 retry policy retries transient model failures once", () => {
  assert.equal(shouldRetryStep("map", "mapper_timeout"), true);
  assert.equal(shouldRetryStep("metadata", "metadata_schema_invalid"), true);
  assert.equal(shouldRetryRegion("extract_schema_invalid"), true);
  assert.equal(shouldRetryStep("map", "budget_exceeded"), false);
  assert.equal(shouldRetryRegion("budget_exceeded"), false);
});
