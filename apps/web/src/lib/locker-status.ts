export type LockerStatus = 'available' | 'occupied' | 'unavailable'

export interface LockerStatusInput {
  isUnavailable: boolean
  assignedStudentId: string | null
  subscriptionEndDate: string | null
}

// today defaults to a caller-supplied yyyy-MM-dd string (not `new Date()`) so
// this stays pure and deterministic for tests; callers pass the real date.
export function computeLockerStatus(locker: LockerStatusInput, today: string): LockerStatus {
  if (locker.isUnavailable) return 'unavailable'
  if (locker.assignedStudentId && locker.subscriptionEndDate && locker.subscriptionEndDate >= today) {
    return 'occupied'
  }
  return 'available'
}

export type LockerBadgeState = 'active' | 'expiring_soon' | 'expired'

// endDate/today are yyyy-MM-dd strings (same convention as computeLockerStatus).
export function computeLockerBadgeState(endDate: string, today: string): LockerBadgeState {
  if (endDate < today) return 'expired'
  const daysLeft = Math.round(
    (new Date(endDate).getTime() - new Date(today).getTime()) / 86_400_000,
  )
  return daysLeft <= 3 ? 'expiring_soon' : 'active'
}
