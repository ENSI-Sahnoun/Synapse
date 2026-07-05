export type LoyaltyRule = {
  id: string
  name: string
  reward_type: string
  points_threshold: number
  reward_value: number | null
}

export type NextReward = { rule: LoyaltyRule; missing: number; progressPct: number }

/** Cheapest active rule the student cannot yet afford, with progress toward it. */
export function getNextReward(balance: number, rules: LoyaltyRule[]): NextReward | null {
  const candidates = rules
    .filter((r) => r.points_threshold > balance)
    .sort((a, b) => a.points_threshold - b.points_threshold)
  const rule = candidates[0]
  if (!rule) return null
  const progressPct = Math.max(0, Math.min(100, (balance / rule.points_threshold) * 100))
  return { rule, missing: rule.points_threshold - balance, progressPct }
}

/** Sum of ledger deltas over the trailing 7 days. */
export function weeklyDelta(
  ledger: { points_delta: number; created_at: string }[],
  now: Date = new Date()
): number {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000
  return ledger
    .filter((e) => new Date(e.created_at).getTime() >= cutoff)
    .reduce((sum, e) => sum + e.points_delta, 0)
}
