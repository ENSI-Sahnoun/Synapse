'use server'

import { z } from 'zod'
import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { notifyAllStaffNoPush } from '@/data/notifications/inapp'

const studentIdSchema = z.object({ studentId: z.string().uuid() })

export const dropQrToKiosk = employeeActionClient
  .schema(studentIdSchema)
  .action(async ({ parsedInput: { studentId } }) => {
    const supabase = await createSupabaseClient()
    const { data: student } = await supabase
      .from('profiles')
      .select('full_name, qr_token')
      .eq('id', studentId)
      .eq('role', 'student')
      .maybeSingle()

    if (!student?.qr_token) throw new Error('Étudiant introuvable ou code QR indisponible.')

    await notifyAllStaffNoPush('kiosk_qr_drop', student.full_name ?? 'Un étudiant', {
      link: student.qr_token,
      studentId,
    })

    return { success: true }
  })

export const cancelKioskQrDrop = employeeActionClient
  .schema(studentIdSchema)
  .action(async ({ parsedInput: { studentId } }) => {
    await notifyAllStaffNoPush('kiosk_qr_drop_cancel', 'Diffusion arrêtée', { studentId })
    return { success: true }
  })
