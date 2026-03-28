/** 与 log_token_usage 一致：input $3/M，output $15/M，×7.2 CNY（占位，可换 MiniMax 单价） */
export function estimateTokenCostUsdCny(inputTokens: number, outputTokens: number) {
  const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
  const costCny = costUsd * 7.2
  return { costUsd, costCny }
}
