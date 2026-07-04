'use server'

import { z } from 'zod'
import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { assignSeatSchema } from '@/utils/zod-schemas/attendance'
import { revalidatePath } from 'next/cache'

// Employee manually assigns a student to a seat (walk-in override)
// Sets seat status → occupied, creates attendance row
export const assignSeatAction = employeeActionClient
  .schema(assignSeatSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    // For a named student (not an anonymous walk-in) enforce two rules:
    //  1. they must not already occupy another seat (one open attendance max)
    //  2. they must hold an active subscription (end_date today or later)
    if (parsedInput.student_id) {
      const { data: openAttendance, error: openErr } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', parsedInput.student_id)
        .is('checked_out_at', null)
        .limit(1)
      if (openErr) throw new Error(openErr.message)
      if (openAttendance && openAttendance.length > 0) {
        throw new Error('Cet étudiant occupe déjà une place.')
      }

      const today = new Date().toISOString().slice(0, 10)
      const { data: activeSub, error: subErr } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('student_id', parsedInput.student_id)
        .gte('end_date', today)
        .limit(1)
      if (subErr) throw new Error(subErr.message)
      if (!activeSub || activeSub.length === 0) {
        throw new Error("Cet étudiant n'a pas d'abonnement actif.")
      }
    }

    // Reconcile a stale seat: if it's marked occupied but has no open
    // attendance, the owner is unknown (leftover state) — free it so it can be
    // reused. Genuinely occupied seats (with an open attendance) are untouched.
    const { data: openOnSeat } = await supabase
      .from('attendance')
      .select('id')
      .eq('seat_id', parsedInput.seat_id)
      .is('checked_out_at', null)
      .limit(1)
    if (!openOnSeat || openOnSeat.length === 0) {
      await supabase
        .from('seats')
        .update({ status: 'free' })
        .eq('id', parsedInput.seat_id)
        .eq('status', 'occupied')
    }

    // Mark seat occupied — only if it is still free (prevents double-booking)
    const { data: updatedSeats, error: seatError } = await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', parsedInput.seat_id)
      .eq('room_id', parsedInput.room_id)
      .eq('status', 'free')
      .select('id')

    if (seatError) throw new Error(seatError.message)
    if (!updatedSeats || updatedSeats.length === 0) {
      throw new Error('Cette place n\'est plus disponible.')
    }

    // Create attendance record (check-out handled in Phase 4 / kiosk checkout)
    // student_id is nullable (migration 20260629240000) to support "Sans nom" walk-ins
    const { data, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: parsedInput.student_id ?? null,
        seat_id: parsedInput.seat_id,
        room_id: parsedInput.room_id,
        entry_method: 'manual',
      })
      .select()
      .single()

    if (attendanceError) {
      // Rollback seat status
      await supabase
        .from('seats')
        .update({ status: 'free' })
        .eq('id', parsedInput.seat_id)
      throw new Error(attendanceError.message)
    }

    revalidatePath(`/employee/rooms/${parsedInput.room_id}/map`)
    revalidatePath(`/admin/rooms/${parsedInput.room_id}/map`)
    revalidatePath('/employee/rooms')
    return { attendance: data }
  })

export const unoccupySeatAction = employeeActionClient
  .schema(z.object({ seat_id: z.string().uuid(), room_id: z.string().uuid() }))
  .action(async ({ parsedInput: { seat_id, room_id } }) => {
    const supabase = await createSupabaseClient()

    // Close open attendance record
    await supabase
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('seat_id', seat_id)
      .is('checked_out_at', null)

    // Free the seat
    const { error } = await supabase
      .from('seats')
      .update({ status: 'free' })
      .eq('id', seat_id)

    if (error) throw new Error(error.message)

    revalidatePath(`/employee/rooms/${room_id}/map`)
    revalidatePath(`/admin/rooms/${room_id}/map`)
    revalidatePath('/employee/rooms')
    return { success: true }
  })

export const assignSeatToAttendanceAction = employeeActionClient
  .schema(z.object({ attendanceId: z.string().uuid(), seat_id: z.string().uuid(), room_id: z.string().uuid() }))
  .action(async ({ parsedInput: { attendanceId, seat_id, room_id } }) => {
    const supabase = await createSupabaseClient()

    const { data: updatedSeats, error: seatError } = await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', seat_id)
      .eq('status', 'free')
      .select('id')

    if (seatError) throw new Error(seatError.message)
    // A 0-row match isn't an error from Postgres — check the row count or a
    // seat someone else just took would silently get double-assigned here.
    if (!updatedSeats || updatedSeats.length === 0) throw new Error('Place non disponible.')

    const { error } = await supabase
      .from('attendance')
      .update({ seat_id, room_id })
      .eq('id', attendanceId)

    if (error) {
      await supabase.from('seats').update({ status: 'free' }).eq('id', seat_id)
      throw new Error(error.message)
    }

    revalidatePath(`/employee/rooms/${room_id}/map`)
    revalidatePath(`/admin/rooms/${room_id}/map`)
    revalidatePath('/employee/rooms')
    return { success: true }
  })

// Moves a student already checked in to a different seat, without checking them out
export const changeSeatAction = employeeActionClient
  .schema(z.object({
    attendanceId: z.string().uuid(),
    fromSeatId: z.string().uuid(),
    seat_id: z.string().uuid(),
    room_id: z.string().uuid(),
  }))
  .action(async ({ parsedInput: { attendanceId, fromSeatId, seat_id, room_id } }) => {
    const supabase = await createSupabaseClient()

    const { data: updatedSeats, error: seatError } = await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', seat_id)
      .eq('status', 'free')
      .select('id')

    if (seatError) throw new Error(seatError.message)
    if (!updatedSeats || updatedSeats.length === 0) throw new Error('Place non disponible.')

    const { error } = await supabase
      .from('attendance')
      .update({ seat_id, room_id })
      .eq('id', attendanceId)

    if (error) {
      await supabase.from('seats').update({ status: 'free' }).eq('id', seat_id)
      throw new Error(error.message)
    }

    await supabase.from('seats').update({ status: 'free' }).eq('id', fromSeatId)

    revalidatePath(`/employee/rooms/${room_id}/map`)
    revalidatePath(`/admin/rooms/${room_id}/map`)
    revalidatePath('/employee/rooms')
    return { success: true }
  })

// Frees the seat and leaves the student checked in but unassigned ("Divers")
export const moveToDiversAction = employeeActionClient
  .schema(z.object({ attendanceId: z.string().uuid(), seat_id: z.string().uuid(), room_id: z.string().uuid() }))
  .action(async ({ parsedInput: { attendanceId, seat_id, room_id } }) => {
    const supabase = await createSupabaseClient()

    const { error } = await supabase
      .from('attendance')
      .update({ seat_id: null, room_id: null })
      .eq('id', attendanceId)

    if (error) throw new Error(error.message)

    await supabase.from('seats').update({ status: 'free' }).eq('id', seat_id)

    revalidatePath(`/employee/rooms/${room_id}/map`)
    revalidatePath(`/admin/rooms/${room_id}/map`)
    revalidatePath('/employee/rooms')
    return { success: true }
  })
