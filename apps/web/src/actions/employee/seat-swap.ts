'use server'

import { z } from 'zod'
import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { insertInAppNotification } from '@/data/notifications/inapp'
import { revalidatePath } from 'next/cache'

// Accepting a swap request performs the exact same seat change an employee
// would do manually from the seat map: free the old seat (if any), occupy
// the new one, update the attendance row.
export const acceptSeatSwapRequest = employeeActionClient
  .schema(z.object({ requestId: z.string().uuid() }))
  .action(async ({ parsedInput: { requestId }, ctx: { userId } }) => {
    const admin = createSupabaseAdminClient()

    const { data: request } = await admin
      .from('seat_swap_requests')
      .select('id, student_id, attendance_id, from_seat_id, to_seat_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (!request) throw new Error('Demande introuvable.')
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée.')

    const { data: toSeat } = await admin.from('seats').select('room_id').eq('id', request.to_seat_id).maybeSingle()
    if (!toSeat) throw new Error('Place introuvable.')

    const { data: updatedSeats, error: seatError } = await admin
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', request.to_seat_id)
      .eq('status', 'free')
      .select('id')
    if (seatError) throw new Error(seatError.message)
    if (!updatedSeats || updatedSeats.length === 0) throw new Error("Cette place n'est plus disponible.")

    const { error: attError } = await admin
      .from('attendance')
      .update({ seat_id: request.to_seat_id, room_id: toSeat.room_id })
      .eq('id', request.attendance_id)

    if (attError) {
      await admin.from('seats').update({ status: 'free' }).eq('id', request.to_seat_id)
      throw new Error(attError.message)
    }

    if (request.from_seat_id) {
      await admin.from('seats').update({ status: 'free' }).eq('id', request.from_seat_id)
    }

    await admin
      .from('seat_swap_requests')
      .update({ status: 'accepted', resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq('id', requestId)

    await insertInAppNotification({
      userId: request.student_id,
      type: 'seat_swap_accepted',
      message: 'Votre demande de changement de place a été acceptée.',
    })

    if (toSeat.room_id) {
      revalidatePath(`/employee/rooms/${toSeat.room_id}/map`)
      revalidatePath(`/admin/rooms/${toSeat.room_id}/map`)
    }
    revalidatePath('/employee/rooms')

    return { success: true }
  })

export const denySeatSwapRequest = employeeActionClient
  .schema(z.object({ requestId: z.string().uuid() }))
  .action(async ({ parsedInput: { requestId }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()

    const { data: request } = await supabase
      .from('seat_swap_requests')
      .select('id, student_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (!request) throw new Error('Demande introuvable.')
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée.')

    const { error } = await supabase
      .from('seat_swap_requests')
      .update({ status: 'denied', resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq('id', requestId)
    if (error) throw new Error(error.message)

    await insertInAppNotification({
      userId: request.student_id,
      type: 'seat_swap_denied',
      message: 'Votre demande de changement de place a été refusée.',
    })

    return { success: true }
  })
