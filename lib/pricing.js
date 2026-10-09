import pricing from "../data/pricing.json" with { type: "json" };

export function normalizeUsage(usage = {}) {
  return {
    total_input_tokens: Number(usage.totalInputTokens ?? usage.total_input_tokens ?? 0),
    total_output_tokens: Number(usage.totalOutputTokens ?? usage.total_output_tokens ?? 0),
    total_thought_tokens: Number(usage.totalThoughtTokens ?? usage.total_thought_tokens ?? 0),
    total_tokens: Number(usage.totalTokens ?? usage.total_tokens ?? 0),
  };
}

export async function loadPricing() {
  return pricing;
}

export async function estimateGeminiCost(rawUsage) {
  const usage = normalizeUsage(rawUsage);
  const pricing = await loadPricing();
  const tier = usage.total_input_tokens <= pricing.token_tiers[0].maximum_input_tokens
    ? pricing.token_tiers[0]
    : pricing.token_tiers[1];
  const estimatedCost =
    (usage.total_input_tokens / 1_000_000) * tier.input_usd_per_million
    + ((usage.total_output_tokens + usage.total_thought_tokens) / 1_000_000)
      * tier.output_and_thought_usd_per_million;

  return {
    ...usage,
    estimated_cost_usd: Number(estimatedCost.toFixed(6)),
    pricing_assumption: {
      model: pricing.model,
      input_usd_per_million: tier.input_usd_per_million,
      output_and_thought_usd_per_million: tier.output_and_thought_usd_per_million,
    },
  };
}
