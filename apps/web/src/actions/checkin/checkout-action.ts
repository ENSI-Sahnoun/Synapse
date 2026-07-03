'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'

const checkoutSchema = z.object({
  attendanceId: z.string().uuid('ID présence invalide'),
})

export const checkoutAction = employeeActionClient
  .schema(checkoutSchema)
  .action(async ({ parsedInput }) => {
    const { attendanceId } = parsedInput
    const admin = createSupabaseAdminClient()

    const { data: attendance, error } = await admin
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', attendanceId)
      .is('checked_out_at', null)
      .select('seat_id')
      .single()

    if (error) {
      throw new Error(`Erreur lors de la sortie: ${error.message}`)
    }

    if (attendance?.seat_id) {
      await admin.from('seats').update({ status: 'free' }).eq('id', attendance.seat_id)
    }

    return { success: true }
  })
