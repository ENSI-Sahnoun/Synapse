'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { saveEmployeeAttendanceSchema } from '@/utils/zod-schemas/employee-attendance'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// Admin can freely correct or backfill any employee's punches — covers both
// editing an existing clock_in/clock_out and inserting an entry the employee
// never punched at all (forgot completely).
export const saveEmployeeAttendanceAction = adminActionClient
  .schema(saveEmployeeAttendanceSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { id, employee_id, clock_in, clock_out } = parsedInput

    if (id) {
      const { error } = await supabase
        .from('employee_attendance')
        .update({ clock_in, clock_out, entry_method: 'admin_edit', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('employee_attendance')
        .insert({ employee_id, clock_in, clock_out, entry_method: 'admin_edit' })
      if (error) throw new Error(error.message)
    }

    revalidatePath(`/admin/employees/${employee_id}/attendance`)
    return { success: true }
  })

export const deleteEmployeeAttendanceAction = adminActionClient
  .schema(z.object({ id: z.string().uuid(), employee_id: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('employee_attendance').delete().eq('id', parsedInput.id)
    if (error) throw new Error(error.message)

    revalidatePath(`/admin/employees/${parsedInput.employee_id}/attendance`)
    return { success: true }
  })
