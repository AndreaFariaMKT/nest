// Claude pricing cheat-sheet.
//
// Source: Anthropic docs, cached at authoring time. Update this when pricing
// changes — the /admin/usage dashboard shows estimated cost per client so
// drift matters.
//
// Rates are dollars per million tokens.

export type ClaudeRate = {
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
};

const RATES: ClaudeRate[] = [
  { model: "claude-opus-4-7", inputPerMillion: 5.0, outputPerMillion: 25.0 },
  { model: "claude-opus-4-6", inputPerMillion: 5.0, outputPerMillion: 25.0 },
  { model: "claude-sonnet-4-6", inputPerMillion: 3.0, outputPerMillion: 15.0 },
  { model: "claude-haiku-4-5", inputPerMillion: 1.0, outputPerMillion: 5.0 },
];

export function findRate(model: string | null | undefined): ClaudeRate | null {
  if (!model) return null;
  const lower = model.toLowerCase();
  return RATES.find((r) => r.model.toLowerCase() === lower) ?? null;
}

/**
 * Returns USD cost (float) for a given (model, inputTokens, outputTokens).
 * Returns 0 when the model isn't recognized — callers should surface that as
 * "unknown" separately if they care about coverage.
 */
export function estimateCostUsd(
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = findRate(model);
  if (!rate) return 0;
  const inCost = (inputTokens / 1_000_000) * rate.inputPerMillion;
  const outCost = (outputTokens / 1_000_000) * rate.outputPerMillion;
  return inCost + outCost;
}

/** USD cost formatted for display (e.g., "$0.0423"). */
export function formatUsd(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
