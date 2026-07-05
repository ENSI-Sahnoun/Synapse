'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { checkinSchema, type CheckinResult } from '@/utils/zod-schemas/checkin'
import { isValidQrTokenFormat } from '@/lib/qr-token'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { differenceInDays, parseISO, startOfDay } from 'date-fns'

export const checkinAction = employeeActionClient
  .schema(checkinSchema)
  .action(async ({ parsedInput }): Promise<CheckinResult> => {
    const { qrToken } = parsedInput

    if (!isValidQrTokenFormat(qrToken)) {
      return { status: 'DENIED_UNKNOWN' }
    }

    const admin = createSupabaseAdminClient()

    // Lookup student by stored token value
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .eq('qr_token', qrToken)
      .eq('role', 'student')
      .single()

    if (profileError || !profile) {
      return { status: 'DENIED_UNKNOWN' }
    }

    const studentId = profile.id

    const { data: openAttendance } = await admin
      .from('attendance')
      .select('id, checked_in_at')
      .eq('student_id', studentId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openAttendance) {
      return {
        status: 'ALREADY_IN',
        studentName: profile.full_name,
        checkedInAt: openAttendance.checked_in_at,
        attendanceId: openAttendance.id,
      }
    }

    const today = startOfDay(new Date()).toISOString().slice(0, 10)

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('id, end_date, plan_id, subscription_plans(name)')
      .eq('student_id', studentId)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!subscription) {
      const { data: expiredSub } = await admin
        .from('subscriptions')
        .select('end_date')
        .eq('student_id', studentId)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (expiredSub) {
        return {
          status: 'DENIED_EXPIRED',
          studentName: profile.full_name,
          endDate: expiredSub.end_date,
        }
      }

      return {
        status: 'DENIED_NO_SUB',
        studentName: profile.full_name,
      }
    }

    // Exam mode: mandatory reservation check
    const { data: examModeRow } = await admin
      .from('settings')
      .select('value')
      .eq('key', 'exam_mode')
      .maybeSingle()

    if (examModeRow?.value === 'true') {
      const { data: mandatoryReservation } = await admin
        .from('reservations')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle()

      if (!mandatoryReservation) {
        return {
          status: 'DENIED_NO_RESERVATION' as const,
          studentName: profile.full_name,
        }
      }
    }

    // Look for active reservation
    const { data: activeReservation } = await admin
      .from('reservations')
      .select('id, seat_id, seats(room_id)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle()

    const reservedRoomId = (activeReservation?.seats as { room_id: string } | null)?.room_id ?? null

    const planName =
      (subscription.subscription_plans as { name: string } | null)?.name ?? 'Abonnement'
    const daysRemaining = differenceInDays(
      parseISO(subscription.end_date),
      startOfDay(new Date())
    )

    // Walk-in (no reservation): mark present immediately with no seat. The
    // kiosk no longer picks a seat — the student chooses one from their phone
    // (their dashboard shows a "Divers" prompt while seatless).
    if (!activeReservation) {
      const { data: walkInAttendance, error: walkInError } = await admin
        .from('attendance')
        .insert({
          student_id: studentId,
          seat_id: null,
          room_id: null,
          entry_method: 'qr_scan',
        })
        .select('id')
        .single()

      if (walkInError || !walkInAttendance) {
        console.error('Walk-in attendance insert error:', walkInError?.message)
        throw new Error("Erreur lors de l'enregistrement de la présence.")
      }

      return {
        status: 'AUTHORIZED',
        studentName: profile.full_name,
        studentId,
        deferred: false,
        planName,
        endDate: subscription.end_date,
        daysRemaining,
        reservationFulfilled: false,
        attendanceId: walkInAttendance.id,
        seatId: null,
        seatLabel: null,
        roomId: null,
        roomName: null,
      }
    }

    // Reserved seat: they already chose it. Mark present immediately.
    await admin
      .from('reservations')
      .update({ status: 'fulfilled' })
      .eq('id', activeReservation.id)

    await admin
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', activeReservation.seat_id)
      .eq('status', 'reserved')

    const { data: newAttendance, error: insertError } = await admin
      .from('attendance')
      .insert({
        student_id: studentId,
        seat_id: activeReservation.seat_id,
        room_id: reservedRoomId,
        entry_method: 'qr_scan',
      })
      .select('id')
      .single()

    if (insertError || !newAttendance) {
      console.error('Attendance insert error:', insertError?.message)
      throw new Error("Erreur lors de l'enregistrement de la présence.")
    }

    // Resolve the reserved seat's label + room name for the welcome screen.
    let seatLabel: string | null = null
    let roomName: string | null = null
    if (activeReservation.seat_id) {
      const { data: seat } = await admin
        .from('seats')
        .select('label')
        .eq('id', activeReservation.seat_id)
        .maybeSingle()
      seatLabel = seat?.label ?? null
      if (reservedRoomId) {
        const { data: room } = await admin
          .from('rooms')
          .select('name')
          .eq('id', reservedRoomId)
          .maybeSingle()
        roomName = room?.name ?? null
      }
    }

    return {
      status: 'AUTHORIZED',
      studentName: profile.full_name,
      studentId,
      deferred: false,
      planName,
      endDate: subscription.end_date,
      daysRemaining,
      reservationFulfilled: true,
      attendanceId: newAttendance.id,
      seatId: activeReservation.seat_id,
      seatLabel,
      roomId: reservedRoomId,
      roomName,
    }
  })
