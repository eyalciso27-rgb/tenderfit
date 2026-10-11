import assert from "node:assert/strict";
import test from "node:test";

import {
  aiCallReservationUsd,
  assertAiBudgetAvailable,
  BudgetExceededError,
  sumUsageCost,
} from "../lib/budget.js";

test("sumUsageCost totals completed and waiting usage safely", () => {
  assert.equal(sumUsageCost(null), 0);
  assert.equal(sumUsageCost([
    { estimated_cost_usd: 0.25 },
    { estimated_cost_usd: 0 },
    { estimated_cost_usd: "0.75" },
  ]), 1);
});

function fakeSupabase(rows) {
  const query = {
    select() { return query; },
    gte() { return Promise.resolve({ data: rows, error: null }); },
  };
  return { from() { return query; } };
}

test("tender budget blocks a new AI call at the configured cap", async () => {
  const previous = process.env.TENDER_AI_BUDGET_USD;
  process.env.TENDER_AI_BUDGET_USD = "12";
  try {
    await assert.rejects(
      assertAiBudgetAvailable(fakeSupabase([]), { ai_usage: [{ estimated_cost_usd: 12 }] }),
      (error) => error instanceof BudgetExceededError && error.scope === "tender",
    );
  } finally {
    if (previous === undefined) delete process.env.TENDER_AI_BUDGET_USD;
    else process.env.TENDER_AI_BUDGET_USD = previous;
  }
});

test("a pending call reservation cannot push a tender over its cap", async () => {
  const previous = process.env.TENDER_AI_BUDGET_USD;
  process.env.TENDER_AI_BUDGET_USD = "12";
  try {
    await assert.rejects(
      assertAiBudgetAvailable(
        fakeSupabase([]),
        { ai_usage: [{ estimated_cost_usd: 11.5 }] },
        0.75,
      ),
      (error) => error instanceof BudgetExceededError && error.scope === "tender",
    );
  } finally {
    if (previous === undefined) delete process.env.TENDER_AI_BUDGET_USD;
    else process.env.TENDER_AI_BUDGET_USD = previous;
  }
});

test("AI call reservation has a conservative configurable default", () => {
  assert.equal(aiCallReservationUsd({}), 0.75);
  assert.equal(aiCallReservationUsd({ AI_CALL_RESERVATION_USD: "1.25" }), 1.25);
});

test("monthly budget blocks a new AI call at the configured cap", async () => {
  const previousMonthly = process.env.MONTHLY_AI_BUDGET_USD;
  const previousTender = process.env.TENDER_AI_BUDGET_USD;
  process.env.MONTHLY_AI_BUDGET_USD = "25";
  process.env.TENDER_AI_BUDGET_USD = "100";
  try {
    await assert.rejects(
      assertAiBudgetAvailable(fakeSupabase([
        { ai_usage: [{ estimated_cost_usd: 10 }] },
        { ai_usage: [{ estimated_cost_usd: 15 }] },
      ]), { ai_usage: [] }),
      (error) => error instanceof BudgetExceededError && error.scope === "monthly",
    );
  } finally {
    if (previousMonthly === undefined) delete process.env.MONTHLY_AI_BUDGET_USD;
    else process.env.MONTHLY_AI_BUDGET_USD = previousMonthly;
    if (previousTender === undefined) delete process.env.TENDER_AI_BUDGET_USD;
    else process.env.TENDER_AI_BUDGET_USD = previousTender;
  }
});
