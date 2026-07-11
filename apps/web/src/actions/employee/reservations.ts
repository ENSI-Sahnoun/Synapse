'use server'

import { z } from 'zod'
import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { insertInAppNotification, resolveStaffNotificationsByLink } from '@/data/notifications/inapp'
import { revalidatePath } from 'next/cache'

const schema = z.object({ reservationId: z.string().uuid() })

export const cancelReservation = employeeActionClient
  .schema(schema)
  .action(async ({ parsedInput: { reservationId } }) => {
    const supabase = await createSupabaseClient()

    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, seat_id, student_id, status, seats(label)')
      .eq('id', reservationId)
      .eq('status', 'active')
      .single()

    if (fetchError || !reservation) {
      return { error: 'Réservation introuvable ou déjà terminée.' }
    }

    const seatLabel = (reservation.seats as { label: string } | null)?.label ?? '—'

    const { error: cancelError } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .eq('status', 'active')

    if (cancelError) throw new Error('Impossible d\'annuler la réservation.')

    await supabase
      .from('seats')
      .update({ status: 'free' })
      .eq('id', reservation.seat_id)

    try {
      await insertInAppNotification({
        userId: reservation.student_id,
        type: 'reservation_cancelled',
        message: `Votre réservation pour la place ${seatLabel} a été annulée par le personnel.`,
      })
    } catch { /* non-fatal */ }

    await resolveStaffNotificationsByLink(`/employee/reservations?highlight=${reservationId}`)

    revalidatePath('/employee/reservations')
    return { success: true }
  })

export const acceptReservation = employeeActionClient
  .schema(schema)
  .action(async ({ parsedInput: { reservationId } }) => {
    const supabase = await createSupabaseClient()

    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, seat_id, student_id, status, seats(label, room_id)')
      .eq('id', reservationId)
      .eq('status', 'active')
      .single()

    if (fetchError || !reservation) {
      return { error: 'Réservation introuvable ou déjà terminée.' }
    }

    const seatData = reservation.seats as { label: string; room_id: string } | null
    const seatLabel = seatData?.label ?? '—'
    const roomId = seatData?.room_id ?? null

    // Extend expiry by the configured hold duration and mark as confirmed
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reservation_hold_minutes')
      .maybeSingle()

    const holdMinutes = parseInt(settingRow?.value ?? '30', 10)
    const newExpiry = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()

    const { error: updateError } = await supabase
      .from('reservations')
      .update({ status: 'fulfilled', expires_at: newExpiry })
      .eq('id', reservationId)
      .eq('status', 'active')

    if (updateError) throw new Error('Impossible de confirmer la réservation.')

    // Mark seat occupied
    await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', reservation.seat_id)

    // Create attendance record so seat shows as occupied and student is tied to it
    await supabase.from('attendance').insert({
      student_id: reservation.student_id,
      seat_id: reservation.seat_id,
      room_id: roomId,
      entry_method: 'manual',
    })

    try {
      await insertInAppNotification({
        userId: reservation.student_id,
        type: 'reservation_accepted',
        message: `Votre réservation pour la place ${seatLabel} a été confirmée par le personnel.`,
      })
    } catch { /* non-fatal */ }

    await resolveStaffNotificationsByLink(`/employee/reservations?highlight=${reservationId}`)

    revalidatePath('/employee/reservations')
    return { success: true }
  })
