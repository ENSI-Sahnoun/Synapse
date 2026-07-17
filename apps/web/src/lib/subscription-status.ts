export type SubscriptionState = 'active' | 'expiring_soon' | 'expires_today' | 'expired'

// endDate/today are yyyy-MM-dd strings (same convention as computeLockerBadgeState).
// Applies to every plan type (Journalier, Demi-journée, Mensuel, ...) — duration_days
// only affects the progress bar, never which state is shown.
export function computeSubscriptionState(endDate: string, today: string): SubscriptionState {
  if (endDate < today) return 'expired'
  if (endDate === today) return 'expires_today'
  const daysLeft = Math.round((new Date(endDate).getTime() - new Date(today).getTime()) / 86_400_000)
  return daysLeft <= 3 ? 'expiring_soon' : 'active'
}

// Journalier / Demi-journée plans expire the same day they start, so
// "expiring_soon"/"expires_today" is always true for them — not a real warning.
export function isDailyPlan(planName: string | null | undefined): boolean {
  if (!planName) return false
  const n = planName.toLowerCase().replace(/é|è|ê/g, 'e')
  return n.includes('journalier') || n.includes('journee')
}
