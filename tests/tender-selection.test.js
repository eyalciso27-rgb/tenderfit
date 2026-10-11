import assert from "node:assert/strict";
import test from "node:test";

import { findLatestCompletedTender } from "../js/tender-selection.js";

test("the upload screen links to the newest completed tender and skips unfinished work", () => {
  const unfinished = { id: "newer", processing: { steps: { validate: { status: "pending" } } } };
  const completed = { id: "completed", processing: { steps: { validate: { status: "done" } } } };
  assert.equal(findLatestCompletedTender([unfinished, completed]).id, "completed");
  assert.equal(findLatestCompletedTender([unfinished]), null);
});
