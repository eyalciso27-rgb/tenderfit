export class BudgetExceededError extends Error {
  constructor(scope) {
    super("AI budget limit reached.");
    this.name = "BudgetExceededError";
    this.code = "budget_exceeded";
    this.scope = scope;
  }
}

export function sumUsageCost(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce(
    (sum, entry) => sum + Number(entry?.estimated_cost_usd ?? 0),
    0,
  );
}

function positiveLimit(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function assertAiBudgetAvailable(supabase, tender) {
  const tenderLimit = positiveLimit(process.env.TENDER_AI_BUDGET_USD, 12);
  if (sumUsageCost(tender.ai_usage) >= tenderLimit) {
    throw new BudgetExceededError("tender");
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data, error } = await supabase
    .from("tenders")
    .select("ai_usage")
    .gte("created_at", monthStart);

  if (error) {
    const budgetError = new Error("Could not verify the monthly AI budget.");
    budgetError.code = "budget_check_failed";
    throw budgetError;
  }

  const monthlyCost = (data ?? []).reduce(
    (sum, row) => sum + sumUsageCost(row.ai_usage),
    0,
  );
  const monthlyLimit = positiveLimit(process.env.MONTHLY_AI_BUDGET_USD, 30);
  if (monthlyCost >= monthlyLimit) {
    throw new BudgetExceededError("monthly");
  }

  return {
    tender_cost_usd: sumUsageCost(tender.ai_usage),
    tender_limit_usd: tenderLimit,
    monthly_cost_usd: monthlyCost,
    monthly_limit_usd: monthlyLimit,
  };
}
