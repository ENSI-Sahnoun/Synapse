'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { revalidatePath } from 'next/cache'
import { insertInAppNotification, notifyAllStaff } from '@/data/notifications/inapp'

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

    // 2. Block if student already has an active seat assignment
    const { data: activeAttendance } = await supabase
      .from('attendance')
      .select('id, seats(label)')
      .eq('student_id', userId)
      .is('checked_out_at', null)
      .not('seat_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (activeAttendance) {
      const label = (activeAttendance.seats as unknown as { label: string } | null)?.label
      return {
        error: label
          ? `Une place (${label}) vous a déjà été assignée par un employé.`
          : 'Une place vous a déjà été assignée par un employé.',
      }
    }

    // 2b. Block if student already has an active reservation
    const { data: activeReservation } = await supabase
      .from('reservations')
      .select('id, seats(label)')
      .eq('student_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (activeReservation) {
      const label = (activeReservation.seats as { label: string } | null)?.label
      return {
        error: label
          ? `Vous avez déjà une réservation active pour la place ${label}.`
          : 'Vous avez déjà une réservation active en cours.',
      }
    }

    // 3. Verify the seat is currently free
    const { data: seat, error: seatError } = await supabase
      .from('seats')
      .select('id, status, label, room_id')
      .eq('id', seat_id)
      .single()

    if (seatError || !seat) {
      return { error: 'Place introuvable.' }
    }
    if (seat.status !== 'free') {
      return { error: `La place ${seat.label} n'est plus disponible.` }
    }

    // 4. Read hold duration from settings
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
      if (insertError.code === '23505') {
        // Could be student unique constraint (one active reservation per student)
        // or seat unique constraint (one active reservation per seat, added by migration)
        const isSeatConflict = insertError.message?.includes('reservations_one_active_per_seat')
        return {
          error: isSeatConflict
            ? 'Cette place vient d\'être réservée par quelqu\'un d\'autre. Veuillez en choisir une autre.'
            : 'Vous avez déjà une réservation active en cours.',
        }
      }
      throw new Error('Impossible de créer la réservation. Veuillez réessayer.')
    }

    // 5. Mark seat as reserved (secondary guard — DB unique index is the primary).
    // Uses the admin client: students have no direct RLS write access to seats
    // (that permissive policy was removed for security). The `.eq('status','free')`
    // guard still keeps this race-safe.
    const admin = createSupabaseAdminClient()
    const { data: updatedSeats, error: seatUpdateError } = await admin
      .from('seats')
      .update({ status: 'reserved' })
      .eq('id', seat_id)
      .eq('status', 'free')
      .select('id')

    if (seatUpdateError || !updatedSeats || updatedSeats.length === 0) {
      await supabase.from('reservations').delete().eq('id', reservation.id)
      return { error: 'Impossible de réserver la place. Veuillez en choisir une autre.' }
    }

    // 6. Notify student + all staff (non-fatal)
    try {
      await Promise.all([
        insertInAppNotification({
          userId,
          type: 'reservation_confirmed',
          message: `Votre réservation pour la place ${seat.label} est confirmée. Elle expire dans ${holdMinutes} minutes.`,
        }),
        notifyAllStaff(
          'reservation_new',
          `Nouvelle réservation : place ${seat.label} réservée (expire dans ${holdMinutes} min).`,
        ),
      ])

      // Room almost full check (>= 80% occupied/reserved)
      if (seat.room_id) {
        const [{ count: total }, { count: occupied }] = await Promise.all([
          supabase.from('seats').select('id', { count: 'exact', head: true }).eq('room_id', seat.room_id),
          supabase.from('seats').select('id', { count: 'exact', head: true }).eq('room_id', seat.room_id).in('status', ['occupied', 'reserved']),
        ])
        if (total && occupied && occupied / total >= 0.8) {
          await notifyAllStaff(
            'room_almost_full',
            `Salle presque pleine : ${occupied}/${total} places occupées ou réservées (${Math.round((occupied / total) * 100)}%).`,
          )
        }
      }
    } catch {
      // ignore notification errors
    }

    revalidatePath('/student/rooms')
    return {
      success: true,
      reservationId: reservation.id,
      expiresAt,
      holdMinutes,
      examMode,
      queuePosition,
    }
  })
