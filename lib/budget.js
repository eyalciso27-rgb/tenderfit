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

export function aiCallReservationUsd(environment = process.env) {
  return positiveLimit(environment.AI_CALL_RESERVATION_USD, 0.75);
}

function positiveLimit(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function assertAiBudgetAvailable(
  supabase,
  tender,
  reservationUsd = aiCallReservationUsd(),
) {
  const tenderLimit = positiveLimit(process.env.TENDER_AI_BUDGET_USD, 12);
  const tenderCost = sumUsageCost(tender.ai_usage);
  if (tenderCost + reservationUsd > tenderLimit) {
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
  if (monthlyCost + reservationUsd > monthlyLimit) {
    throw new BudgetExceededError("monthly");
  }

  return {
    tender_cost_usd: tenderCost,
    reserved_call_cost_usd: reservationUsd,
    projected_tender_cost_usd: tenderCost + reservationUsd,
    tender_limit_usd: tenderLimit,
    monthly_cost_usd: monthlyCost,
    projected_monthly_cost_usd: monthlyCost + reservationUsd,
    monthly_limit_usd: monthlyLimit,
  };
}
