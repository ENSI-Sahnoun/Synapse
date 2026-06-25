'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

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

    // 4. Insert reservation — DB partial unique index rejects a duplicate active reservation
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()

    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        student_id: userId,
        seat_id: seat_id,
        expires_at: expiresAt,
        status: 'active',
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

    revalidatePath('/student/reservation')
    return {
      success: true,
      reservationId: reservation.id,
      expiresAt,
      holdMinutes,
    }
  })
