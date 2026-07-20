'use server'

import { employeeActionClient, adminActionClient } from '@/lib/safe-action'
import { updateSubscriptionSchema, deleteSubscriptionSchema, adjustLoyaltyPointsSchema } from '@/utils/zod-schemas/subscription'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { subDays, addDays, parseISO, format } from 'date-fns'
import { revalidatePath } from 'next/cache'

export const updateSubscriptionAction = employeeActionClient
  .schema(updateSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const { subscription_id, start_date, end_date, plan_id, cancel } = parsedInput
    const supabase = createSupabaseAdminClient()

    const { data: current, error: fetchError } = await supabase
      .from('subscriptions')
      .select('student_id, start_date, end_date, plan_id')
      .eq('id', subscription_id)
      .single()
    if (fetchError || !current) throw new Error('Abonnement introuvable')

    type UpdatesType = {
      start_date?: string
      end_date?: string
      plan_id?: string
    }
    const updates: UpdatesType = {}

    if (cancel) {
      updates.end_date = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    } else {
      if (start_date) updates.start_date = start_date
      if (plan_id) updates.plan_id = plan_id
      if (end_date) {
        updates.end_date = end_date
      } else if (start_date || plan_id) {
        // Recompute end_date from the (possibly new) plan duration when the
        // caller changed start_date/plan_id but did not explicitly set end_date.
        const { data: plan, error: planError } = await supabase
          .from('subscription_plans')
          .select('duration_days')
          .eq('id', plan_id ?? current.plan_id)
          .single()
        if (planError || !plan) throw new Error('Formule introuvable')
        updates.end_date = format(
          addDays(parseISO(start_date ?? current.start_date), plan.duration_days),
          'yyyy-MM-dd',
        )
      }
    }

    if (Object.keys(updates).length === 0) return { success: true }

    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscription_id)
    if (error) throw new Error(error.message)

    revalidatePath(`/employee/students/${current.student_id}`)
    return { success: true }
  })

// Admin-only. This previously ran under `employeeActionClient` against the
// service-role client, which bypasses RLS — so any cashier could permanently
// erase a revenue record with nothing left behind to show it had existed.
// Staff who need to undo a sale now use `refundSubscriptionAction`, which
// reverses the money while preserving the original transaction. Deletion
// survives only for genuine data-entry errors, and the audit trigger added in
// 20260720000100 journals it.
export const deleteSubscriptionAction = adminActionClient
  .schema(deleteSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const { subscription_id } = parsedInput
    const supabase = createSupabaseAdminClient()

    const { data: sub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('student_id')
      .eq('id', subscription_id)
      .single()
    if (fetchError || !sub) throw new Error('Abonnement introuvable')

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', subscription_id)
    if (error) throw new Error(error.message)

    revalidatePath(`/employee/students/${sub.student_id}`)
    return { success: true }
  })

export const adjustLoyaltyPointsAction = adminActionClient
  .schema(adjustLoyaltyPointsSchema)
  .action(async ({ parsedInput }) => {
    const { student_id, points_delta } = parsedInput
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase.from('loyalty_ledger').insert({
      student_id,
      points_delta,
      reason: 'adjustment',
    })
    if (error) throw new Error(error.message)

    revalidatePath(`/employee/students/${student_id}`)
    return { success: true }
  })
