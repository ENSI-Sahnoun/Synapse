'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { insertInAppNotification } from '@/data/notifications/inapp'

const createReservationSchema = z.object({
  seat_id: z.string({ message: 'seat_id est requis' }).uuid({ message: 'seat_id doit être un UUID valide' }),
})

export const createReservation = studentActionClient
  .schema(createReservationSchema)
  .action(async ({ parsedInput: { seat_id }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()

    // 1. Verify the student has an active subscription
    const today = new Date().toISOString().split('T')[0]
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, end_date')
      .eq('student_id', userId)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) throw new Error("Erreur lors de la vérification de l'abonnement.")
    if (!subscription) {
      return { error: 'Vous devez avoir un abonnement actif pour réserver une place.' }
    }

    // 2. Verify the seat is currently free
    const { data: seat, error: seatError } = await supabase
      .from('seats')
      .select('id, status, label')
      .eq('id', seat_id)
      .single()

    if (seatError || !seat) {
      return { error: 'Place introuvable.' }
    }
    if (seat.status !== 'free') {
      return { error: `La place ${seat.label} n'est plus disponible.` }
    }

    // 3. Read hold duration from settings
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reservation_hold_minutes')
      .maybeSingle()

    const holdMinutes = parseInt(settingRow?.value ?? '30', 10)

    // --- Exam mode: queue assignment ---
    const { data: examModeSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'exam_mode')
      .maybeSingle()

    const examMode = examModeSetting?.value === 'true'

    let queuePosition: number | null = null
    let isPriority = false

    if (examMode) {
      const { data: prioritySetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'priority_min_duration_days')
        .maybeSingle()

      const priorityMinDays = parseInt(prioritySetting?.value ?? '30', 10)

      // Check if this student qualifies as priority
      const { data: subWithPlan } = await supabase
        .from('subscriptions')
        .select('subscription_plans(duration_days)')
        .eq('student_id', userId)
        .gte('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const planDuration = (subWithPlan?.subscription_plans as { duration_days: number } | null)
        ?.duration_days ?? 0
      isPriority = planDuration >= priorityMinDays

      if (isPriority) {
        // Priority students go ahead of the first non-priority active reservation
        const { data: firstNonPriority } = await supabase
          .from('reservations')
          .select('queue_position')
          .eq('status', 'active')
          .eq('is_priority', false)
          .not('queue_position', 'is', null)
          .order('queue_position', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (firstNonPriority?.queue_position != null) {
          const { error: shiftError } = await supabase.rpc('shift_queue_positions_down', {
            from_position: firstNonPriority.queue_position,
          })
          if (shiftError) throw new Error("Impossible de réorganiser la file d'attente.")
          queuePosition = firstNonPriority.queue_position
        } else {
          const { data: maxRow } = await supabase
            .from('reservations')
            .select('queue_position')
            .eq('status', 'active')
            .not('queue_position', 'is', null)
            .order('queue_position', { ascending: false })
            .limit(1)
            .maybeSingle()

          queuePosition = (maxRow?.queue_position ?? 0) + 1
        }
      } else {
        // Non-priority: join at the end of the queue
        const { data: maxRow } = await supabase
          .from('reservations')
          .select('queue_position')
          .eq('status', 'active')
          .not('queue_position', 'is', null)
          .order('queue_position', { ascending: false })
          .limit(1)
          .maybeSingle()

        queuePosition = (maxRow?.queue_position ?? 0) + 1
      }
    }
    // --- End exam mode queue assignment ---

    // 4. Insert reservation — DB partial unique index rejects a duplicate active reservation
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()

    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        student_id: userId,
        seat_id: seat_id,
        expires_at: expiresAt,
        status: 'active',
        queue_position: queuePosition,
        is_priority: isPriority,
      })
      .select('id')
      .single()

    if (insertError) {
      // 23505 = unique_violation → student already has an active reservation
      if (insertError.code === '23505') {
        return { error: 'Vous avez déjà une réservation active en cours.' }
      }
      throw new Error('Impossible de créer la réservation. Veuillez réessayer.')
    }

    // 5. Mark seat as reserved (with race condition guard)
    const { data: updatedSeats, error: seatUpdateError } = await supabase
      .from('seats')
      .update({ status: 'reserved' })
      .eq('id', seat_id)
      .eq('status', 'free')
      .select('id')

    if (seatUpdateError || !updatedSeats || updatedSeats.length === 0) {
      // Rollback reservation insert — seat was taken between checks
      await supabase.from('reservations').delete().eq('id', reservation.id)
      return { error: 'Impossible de réserver la place. Veuillez en choisir une autre.' }
    }

    // non-fatal — notification failure must not abort the reservation
    try {
      await insertInAppNotification({
        userId,
        type: 'reservation_confirmed',
        message: `Votre réservation pour la place ${seat.label} est confirmée. Elle expire dans ${holdMinutes} minutes.`,
      })
    } catch {
      // ignore notification errors
    }

    revalidatePath('/student/reservation')
    return {
      success: true,
      reservationId: reservation.id,
      expiresAt,
      holdMinutes,
      examMode,
      queuePosition,
    }
  })
