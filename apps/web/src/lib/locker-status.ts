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
