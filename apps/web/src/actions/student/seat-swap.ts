'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { notifyAllStaff } from '@/data/notifications/inapp'
import { revalidatePath } from 'next/cache'

async function getMyOpenAttendance(userId: string) {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('attendance')
    .select('id, seat_id')
    .eq('student_id', userId)
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Student ends their own attendance session — frees their seat if they had one.
// No id is accepted: the action always resolves the caller's own open
// attendance from ctx.userId, so a student can only ever check out themselves.
export const checkOutSelf = studentActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)
    if (!attendance) throw new Error("Vous n'êtes pas enregistré comme présent.")

    const admin = createSupabaseAdminClient()

    // Guarded update: only closes the row if it's still open. A 0-row match
    // isn't a Postgres error, so we must check the returned row before
    // freeing a seat — otherwise a concurrently-closed/reassigned seat could
    // get flipped back to free out from under another student.
    const { data: closed, error } = await admin
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', attendance.id)
      .is('checked_out_at', null)
      .select('seat_id')
      .maybeSingle()
    if (error) throw new Error(error.message)

    if (!closed) {
      // Already checked out (race or stale state) — idempotent no-op.
      return { success: true }
    }

    if (closed.seat_id) {
      const { data: seat } = await admin
        .from('seats')
        .select('room_id')
        .eq('id', closed.seat_id)
        .maybeSingle()
      const roomId = seat?.room_id ?? null

      await admin.from('seats').update({ status: 'free' }).eq('id', closed.seat_id)

      if (roomId) {
        revalidatePath(`/employee/rooms/${roomId}/map`)
        revalidatePath(`/admin/rooms/${roomId}/map`)
      }
      revalidatePath('/employee/rooms')
    }

    return { success: true }
  })

// Student moves themself to "Divers" — frees their seat if they had one.
export const moveSelfToDivers = studentActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)
    if (!attendance) throw new Error("Vous n'êtes pas enregistré comme présent.")
    if (!attendance.seat_id) return { seatId: null, roomId: null }

    const admin = createSupabaseAdminClient()
    const { data: seat } = await admin.from('seats').select('room_id').eq('id', attendance.seat_id).maybeSingle()

    const { error } = await admin
      .from('attendance')
      .update({ seat_id: null, room_id: null })
      .eq('id', attendance.id)
    if (error) throw new Error(error.message)

    await admin.from('seats').update({ status: 'free' }).eq('id', attendance.seat_id)

    if (seat?.room_id) {
      revalidatePath(`/employee/rooms/${seat.room_id}/map`)
      revalidatePath(`/admin/rooms/${seat.room_id}/map`)
    }
    revalidatePath('/employee/rooms')

    return { seatId: attendance.seat_id, roomId: seat?.room_id ?? null }
  })

// Undo a just-performed moveSelfToDivers, if the seat is still free.
export const undoMoveSelfToDivers = studentActionClient
  .schema(z.object({ seatId: z.string().uuid(), roomId: z.string().uuid() }))
  .action(async ({ parsedInput: { seatId, roomId }, ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)
    if (!attendance) throw new Error("Vous n'êtes pas enregistré comme présent.")
    if (attendance.seat_id) throw new Error('Vous occupez déjà une place.')

    const admin = createSupabaseAdminClient()
    const { data: updatedSeats, error: seatError } = await admin
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', seatId)
      .eq('status', 'free')
      .select('id')
    if (seatError) throw new Error(seatError.message)
    // A 0-row match isn't an error from Postgres — it just silently no-ops.
    // Without checking the row count, this seat would look free forever
    // while someone else actually holds it.
    if (!updatedSeats || updatedSeats.length === 0) {
      throw new Error('Cette place a été prise entre-temps.')
    }

    const { error } = await admin
      .from('attendance')
      .update({ seat_id: seatId, room_id: roomId })
      .eq('id', attendance.id)
    if (error) {
      await admin.from('seats').update({ status: 'free' }).eq('id', seatId)
      throw new Error(error.message)
    }

    revalidatePath(`/employee/rooms/${roomId}/map`)
    revalidatePath(`/admin/rooms/${roomId}/map`)
    revalidatePath('/employee/rooms')
    return { success: true }
  })

// Student who is present but seatless ("Divers") claims a specific free seat
// directly — no staff approval. Mirrors moveSelfToDivers; shares the atomic
// free→occupied flip logic with undoMoveSelfToDivers.
export const claimSeat = studentActionClient
  .schema(z.object({ seatId: z.string().uuid(), roomId: z.string().uuid() }))
  .action(async ({ parsedInput: { seatId, roomId }, ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)
    if (!attendance) throw new Error("Vous devez être enregistré comme présent pour choisir une place.")
    if (attendance.seat_id) throw new Error('Vous occupez déjà une place.')

    const admin = createSupabaseAdminClient()
    const { data: updatedSeats, error: seatError } = await admin
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', seatId)
      .eq('status', 'free')
      .select('id')
    if (seatError) throw new Error(seatError.message)
    // A 0-row match isn't a Postgres error — verify the row count or a seat
    // someone else just took would be silently double-claimed here.
    if (!updatedSeats || updatedSeats.length === 0) {
      throw new Error('Cette place a été prise entre-temps.')
    }

    const { error } = await admin
      .from('attendance')
      .update({ seat_id: seatId, room_id: roomId })
      .eq('id', attendance.id)
    if (error) {
      await admin.from('seats').update({ status: 'free' }).eq('id', seatId)
      throw new Error(error.message)
    }

    revalidatePath(`/employee/rooms/${roomId}/map`)
    revalidatePath(`/admin/rooms/${roomId}/map`)
    revalidatePath('/employee/rooms')
    revalidatePath('/student/dashboard')
    return { success: true }
  })

// Student requests to move to a specific free seat without checking out —
// staff review and either accept (perform the swap) or deny.
export const requestSeatSwap = studentActionClient
  .schema(z.object({ toSeatId: z.string().uuid() }))
  .action(async ({ parsedInput: { toSeatId }, ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)
    if (!attendance) throw new Error("Vous devez être enregistré comme présent pour demander un changement de place.")
    if (attendance.seat_id === toSeatId) throw new Error('Vous occupez déjà cette place.')

    const supabase = await createSupabaseClient()
    const { data: existing } = await supabase
      .from('seat_swap_requests')
      .select('id')
      .eq('student_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) throw new Error('Vous avez déjà une demande en attente.')

    const { error } = await supabase.from('seat_swap_requests').insert({
      student_id: userId,
      attendance_id: attendance.id,
      from_seat_id: attendance.seat_id,
      to_seat_id: toSeatId,
    })
    if (error) throw new Error(error.message)

    await notifyAllStaff('seat_swap_request_new', 'Un étudiant demande un changement de place.')

    return { success: true }
  })

export const cancelSeatSwapRequest = studentActionClient
  .schema(z.object({ requestId: z.string().uuid() }))
  .action(async ({ parsedInput: { requestId }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('seat_swap_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('student_id', userId)
      .eq('status', 'pending')
    if (error) throw new Error(error.message)
    return { success: true }
  })
