'use server'

import { z } from 'zod'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { validateNavOrderInput } from '@/lib/nav-items'

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

// Toggle free seat swapping (students move to any free seat without staff approval)
export const setFreeSwap = adminActionClient
  .schema(z.object({ enabled: z.boolean() }))
  .action(async ({ parsedInput: { enabled } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'free_swap', value: enabled ? 'true' : 'false' }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour la liberté de changement de place.')
    revalidatePath('/admin/settings')
    return { success: true, freeSwap: enabled }
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

// Update minimum subscription duration required for locker eligibility
const setLockerMinDurationSchema = z.object({
  days: z.number().int().min(1, { message: 'Minimum 1 jour' }).max(365, { message: 'Maximum 365 jours' }),
})

export const setLockerMinDurationDays = adminActionClient
  .schema(setLockerMinDurationSchema)
  .action(async ({ parsedInput: { days } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'locker_min_duration_days', value: String(days) }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour le seuil de casier.')
    revalidatePath('/admin/settings')
    return { success: true, days }
  })

// Update locker assignment fee (charged once when a student gets a locker; not on swaps)
const setLockerFeeSchema = z.object({
  amount_dt: z.number().min(0, { message: 'Minimum 0' }).max(1000, { message: 'Maximum 1000' }),
})

export const setLockerFeeDt = adminActionClient
  .schema(setLockerFeeSchema)
  .action(async ({ parsedInput: { amount_dt } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'locker_fee_dt', value: String(amount_dt) }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour le tarif du casier.')
    revalidatePath('/employee/lockers')
    return { success: true, amount_dt }
  })

// Update nav order/visibility for a role (admin edits both roles' nav from one screen)
const setNavOrderSchema = z.object({
  role: z.enum(['admin', 'employee']),
  items: z.array(z.object({ key: z.string(), hidden: z.boolean() })).min(1),
})

export const setNavOrder = adminActionClient
  .schema(setNavOrderSchema)
  .action(async ({ parsedInput: { role, items } }) => {
    validateNavOrderInput(role, items)
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('settings')
      .upsert({ key: `nav_order_${role}`, value: JSON.stringify(items) }, { onConflict: 'key' })
    if (error) throw new Error('Impossible de mettre à jour la navigation.')
    revalidatePath('/admin', 'layout')
    revalidatePath('/employee', 'layout')
    return { success: true, role }
  })
