import { z } from 'zod'

export const checkinSchema = z.object({
  qrToken: z.string().min(1, 'Token QR requis'),
})

export type CheckinInput = z.infer<typeof checkinSchema>

export type CheckinResult =
  | { status: 'AUTHORIZED'; studentName: string; planName: string; endDate: string; daysRemaining: number; reservationFulfilled?: boolean }
  | { status: 'DENIED_EXPIRED'; studentName: string; endDate: string }
  | { status: 'DENIED_NO_SUB'; studentName: string }
  | { status: 'DENIED_UNKNOWN' }
  | { status: 'ALREADY_IN'; studentName: string; checkedInAt: string }
  | { status: 'DENIED_NO_RESERVATION'; studentName: string }
