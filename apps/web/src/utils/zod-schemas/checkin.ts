import { z } from 'zod'

export const checkinSchema = z.object({
  qrToken: z.string().min(1, 'Token QR requis'),
})

export type CheckinInput = z.infer<typeof checkinSchema>

export type CheckinResult =
  // `deferred: true` means check-in was validated but NO attendance row was
  // created yet — the student is not marked present until they pick a seat or
  // explicitly defer at the kiosk. `studentId` lets the picker create it then.
  | { status: 'AUTHORIZED'; studentName: string; planName: string; endDate: string; daysRemaining: number; reservationFulfilled?: boolean; attendanceId: string; studentId: string; deferred?: boolean; seatId?: string | null; seatLabel?: string | null; roomId?: string | null; roomName?: string | null }
  | { status: 'DENIED_EXPIRED'; studentName: string; endDate: string }
  | { status: 'DENIED_NO_SUB'; studentName: string }
  | { status: 'DENIED_UNKNOWN' }
  | { status: 'ALREADY_IN'; studentName: string; checkedInAt: string }
  | { status: 'DENIED_NO_RESERVATION'; studentName: string }
