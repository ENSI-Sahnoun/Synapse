// Which staff nav page should show an unread-count badge for a given
// notification type. Deliberately excludes already-settled events
// (purchase_completed, subscription_new) — a badge means "something is
// pending your action", not "something happened".
export const ACTIONABLE_NAV_MAP: Record<string, string> = {
  reservation_new: '/employee/reservations',
  loyalty_request_new: '/employee/loyalty-requests',
  seat_swap_request_new: '/employee/rooms',
}

export function countUnreadByHref(
  notifications: { type: string; is_read: boolean }[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const n of notifications) {
    if (n.is_read) continue
    const href = ACTIONABLE_NAV_MAP[n.type]
    if (!href) continue
    counts[href] = (counts[href] ?? 0) + 1
  }
  return counts
}
