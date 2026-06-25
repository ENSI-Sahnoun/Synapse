'use server'

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

    // Mark seat occupied
    const { error: seatError } = await supabase
      .from('seats')
      .update({ status: 'occupied' })
      .eq('id', parsedInput.seat_id)
      .eq('room_id', parsedInput.room_id)

    if (seatError) throw new Error(seatError.message)

    // Create attendance record (check-out handled in Phase 4 / kiosk checkout)
    const { data, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: parsedInput.student_id,
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
    return { attendance: data }
  })
