import { estimateGeminiCost } from "./pricing.js";

export function createUsageReservation({
  id,
  component,
  model,
  pdfHash,
  estimatedCostUsd,
  regionId,
  createdAt = new Date().toISOString(),
}) {
  return {
    component,
    ...(regionId ? { region_id: regionId } : {}),
    model,
    interaction_id: id,
    status: "reserved",
    sent_at: null,
    completed_at: null,
    duration_ms: null,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_thought_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: estimatedCostUsd,
    cost_measurement: "reservation",
    reserved_at: createdAt,
    pdf_hash: pdfHash,
  };
}

export async function createFailedUsageEntry({
  existing,
  interaction,
  details,
  code,
  fallbackCostUsd,
  completedAt = new Date().toISOString(),
  now = Date.now(),
}) {
  const measured = interaction?.usage ? await estimateGeminiCost(interaction.usage) : null;
  return {
    ...existing,
    ...details,
    interaction_id: interaction?.id ?? existing?.interaction_id,
    model: interaction?.model ?? existing?.model ?? details.model,
    status: "failed",
    completed_at: completedAt,
    duration_ms: existing?.sent_at
      ? Math.max(0, now - Date.parse(existing.sent_at))
      : 0,
    error: code,
    ...(measured ?? {
      total_input_tokens: Number(existing?.total_input_tokens ?? 0),
      total_output_tokens: Number(existing?.total_output_tokens ?? 0),
      total_thought_tokens: Number(existing?.total_thought_tokens ?? 0),
      total_tokens: Number(existing?.total_tokens ?? 0),
      estimated_cost_usd: Number(existing?.estimated_cost_usd ?? fallbackCostUsd),
    }),
    cost_measurement: measured ? "measured" : "reservation",
  };
}

export function summarizeAiUsage(entries) {
  const summary = {
    calls: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    unmeasured_failed: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_thought_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    by_component: {},
  };

  for (const entry of Array.isArray(entries) ? entries : []) {
    const status = entry?.status;
    const component = entry?.component ?? "unknown";
    const componentSummary = summary.by_component[component] ?? {
      calls: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_thought_tokens: 0,
      estimated_cost_usd: 0,
    };
    const input = Number(entry?.total_input_tokens ?? 0);
    const output = Number(entry?.total_output_tokens ?? 0);
    const thought = Number(entry?.total_thought_tokens ?? 0);
    const total = Number(entry?.total_tokens ?? input + output + thought);
    const cost = Number(entry?.estimated_cost_usd ?? 0);

    summary.calls += 1;
    if (status === "completed") summary.completed += 1;
    else if (status === "failed") summary.failed += 1;
    else summary.pending += 1;
    if (status === "failed" && entry?.cost_measurement !== "measured") {
      summary.unmeasured_failed += 1;
    }
    summary.total_input_tokens += input;
    summary.total_output_tokens += output;
    summary.total_thought_tokens += thought;
    summary.total_tokens += total;
    summary.estimated_cost_usd += cost;

    componentSummary.calls += 1;
    componentSummary.total_input_tokens += input;
    componentSummary.total_output_tokens += output;
    componentSummary.total_thought_tokens += thought;
    componentSummary.estimated_cost_usd += cost;
    summary.by_component[component] = componentSummary;
  }

  summary.estimated_cost_usd = Number(summary.estimated_cost_usd.toFixed(6));
  for (const componentSummary of Object.values(summary.by_component)) {
    componentSummary.estimated_cost_usd = Number(componentSummary.estimated_cost_usd.toFixed(6));
  }
  return summary;
}

