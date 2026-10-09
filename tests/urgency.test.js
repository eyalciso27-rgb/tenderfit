import assert from "node:assert/strict";
import test from "node:test";

import { calculateUrgency } from "../js/urgency.js";

const now = new Date("2026-10-09T09:00:00.000Z");

test("urgency covers all five PRD levels", () => {
  assert.equal(calculateUrgency(null, now).level, "unknown");
  assert.equal(calculateUrgency("2026-10-08T09:00:00.000Z", now).level, "ended");
  assert.equal(calculateUrgency("2026-10-12T09:00:00.000Z", now).level, "high");
  assert.equal(calculateUrgency("2026-10-16T09:00:00.000Z", now).level, "medium");
  assert.equal(calculateUrgency("2026-10-17T09:00:01.000Z", now).level, "low");
});
