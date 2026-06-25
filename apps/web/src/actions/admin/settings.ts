'use server'

import { z } from 'zod'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

// Toggle exam mode
const setExamModeSchema = z.object({
  enabled: z.boolean(),
})

export const setExamMode = adminActionClient
  .schema(setExamModeSchema)
  .action(async ({ parsedInput: { enabled } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'exam_mode', value: enabled ? 'true' : 'false' }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour le mode examen.')
    revalidatePath('/admin/settings')
    return { success: true, examMode: enabled }
  })

// Update reservation hold duration
const setReservationHoldSchema = z.object({
  minutes: z.number().int().min(5, { message: 'Minimum 5 minutes' }).max(120, { message: 'Maximum 120 minutes' }),
})

export const setReservationHoldMinutes = adminActionClient
  .schema(setReservationHoldSchema)
  .action(async ({ parsedInput: { minutes } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'reservation_hold_minutes', value: String(minutes) }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour la durée de réservation.')
    revalidatePath('/admin/settings')
    return { success: true, minutes }
  })

// Update priority subscription threshold
const setPriorityMinDaysSchema = z.object({
  days: z.number().int().min(1, { message: 'Minimum 1 jour' }).max(365, { message: 'Maximum 365 jours' }),
})

export const setPriorityMinDurationDays = adminActionClient
  .schema(setPriorityMinDaysSchema)
  .action(async ({ parsedInput: { days } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'priority_min_duration_days', value: String(days) }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour le seuil de priorité.')
    revalidatePath('/admin/settings')
    return { success: true, days }
  })
