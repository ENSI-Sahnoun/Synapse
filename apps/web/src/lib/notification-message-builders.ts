// Pure message builders for staff-facing notifications. Kept free of any
// Supabase/data-fetching so they're trivial to unit test; callers fetch the
// actor/item names first and pass them in.

export function buildPurchaseMessage(opts: {
  studentName: string | null
  itemsSummary: string
  totalDt: number
}): string {
  const amount = `${opts.totalDt.toFixed(2)} DT`
  return opts.studentName
    ? `${opts.studentName} a acheté ${opts.itemsSummary} (${amount}).`
    : `Vente anonyme : ${opts.itemsSummary} (${amount}).`
}

export function buildSubscriptionMessage(opts: {
  studentName: string
  planName: string
  endDateFormatted: string
}): string {
  return `${opts.studentName} a souscrit à la formule "${opts.planName}" jusqu'au ${opts.endDateFormatted}.`
}

export function buildReservationMessage(opts: {
  studentName: string
  seatLabel: string
}): string {
  return `${opts.studentName} a réservé la place ${opts.seatLabel}.`
}

export function buildLoyaltyRequestMessage(opts: {
  studentName: string
  ruleName: string
  points: number
}): string {
  return `${opts.studentName} a demandé la récompense "${opts.ruleName}" (${opts.points} pts).`
}
