import assert from "node:assert/strict";
import test from "node:test";

import { sumUsageCost } from "../lib/budget.js";

test("sumUsageCost totals completed and waiting usage safely", () => {
  assert.equal(sumUsageCost(null), 0);
  assert.equal(sumUsageCost([
    { estimated_cost_usd: 0.25 },
    { estimated_cost_usd: 0 },
    { estimated_cost_usd: "0.75" },
  ]), 1);
});
