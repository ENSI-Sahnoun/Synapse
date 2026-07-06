// Single source of truth for "tapping a notification takes you where?".
// Role-aware by type: a student never receives the employee-scoped types and
// vice-versa, so one flat map serves both the bell and the toaster. Types with
// no entry are purely informational → tap just marks them read.
export const NOTIFICATION_ROUTES: Record<string, string> = {
  expiry_7d: '/student/dashboard',
  expiry_3d: '/student/dashboard',
  expiry_1d: '/student/dashboard',
  expired: '/student/dashboard',
  renewal_reminder: '/student/dashboard',
  subscription_new: '/student/dashboard',
  purchase_completed: '/student/dashboard',
  reservation_confirmed: '/student/reservation',
  reservation_cancelled: '/student/reservation',
  reservation_accepted: '/student/reservation',
  reservation_new: '/employee/reservations',
  seat_swap_request_new: '/employee/rooms',
  seat_swap_accepted: '/student/reservation',
  seat_swap_denied: '/student/reservation',
  seat_removed_by_staff: '/student/reservation',
  seat_changed_freely: '/employee/rooms',
  loyalty_request_new: '/employee/loyalty-requests',
  loyalty_fulfilled: '/student/loyalty',
  loyalty_rejected: '/student/loyalty',
  points_earned: '/student/loyalty',
  room_almost_full: '/student/rooms',
}

export function notificationHref(type: string): string | null {
  return NOTIFICATION_ROUTES[type] ?? null
}
