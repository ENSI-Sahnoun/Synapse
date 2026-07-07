'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { saveWeeklyScheduleSchema } from '@/utils/zod-schemas/schedule'
import { revalidatePath } from 'next/cache'

export const saveWeeklyScheduleAction = adminActionClient
  .schema(saveWeeklyScheduleSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const { error: deleteError } = await supabase
      .from('weekly_schedules')
      .delete()
      .eq('employee_id', parsedInput.employee_id)

    if (deleteError) throw new Error(deleteError.message)

    const rows = parsedInput.days
      .filter((d): d is typeof d & { start_time: string; end_time: string } => !!d.start_time && !!d.end_time)
      .map((d) => ({
        employee_id: parsedInput.employee_id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        role: parsedInput.role,
      }))

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('weekly_schedules').insert(rows)
      if (insertError) throw new Error(insertError.message)
    }

    revalidatePath(`/admin/employees/${parsedInput.employee_id}/edit`)
    return { count: rows.length }
  })
