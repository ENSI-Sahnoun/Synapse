'use server'

import { employeeActionClient, adminActionClient } from '@/lib/safe-action'
import { updateSubscriptionSchema, deleteSubscriptionSchema, adjustLoyaltyPointsSchema } from '@/utils/zod-schemas/subscription'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { subDays, addDays, parseISO, format } from 'date-fns'
import { revalidatePath } from 'next/cache'

// Cancelling/deleting a subscription must claw back the points it earned —
// otherwise a student can buy, collect points, then have the sub cancelled
// or refunded and keep them permanently. Guards against double-reversal by
// checking for a prior offsetting adjustment tied to the same subscription.
async function reverseSubscriptionLoyaltyPoints(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  subscriptionId: string,
  studentId: string,
) {
  const { data: awarded } = await supabase
    .from('loyalty_ledger')
    .select('points_delta')
    .eq('ref_id', subscriptionId)
    .eq('reason', 'subscription')

  const totalAwarded = (awarded ?? []).reduce((sum, row) => sum + row.points_delta, 0)
  if (totalAwarded <= 0) return

  const { data: alreadyReversed } = await supabase
    .from('loyalty_ledger')
    .select('id')
    .eq('ref_id', subscriptionId)
    .eq('reason', 'adjustment')
    .lt('points_delta', 0)
    .limit(1)
    .maybeSingle()
  if (alreadyReversed) return

  await supabase.from('loyalty_ledger').insert({
    student_id: studentId,
    points_delta: -totalAwarded,
    reason: 'adjustment',
    ref_id: subscriptionId,
  })
}

export const updateSubscriptionAction = employeeActionClient
  .schema(updateSubscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { subscription_id, start_date, end_date, plan_id, cancel } = parsedInput
    const supabase = createSupabaseAdminClient()

    const { data: current, error: fetchError } = await supabase
      .from('subscriptions')
      .select('student_id, start_date, end_date, plan_id, paid_amount, voided_at')
      .eq('id', subscription_id)
      .single()
    if (fetchError || !current) throw new Error('Abonnement introuvable')
    if (cancel && current.voided_at) throw new Error('Abonnement déjà annulé')

    type UpdatesType = {
      start_date?: string
      end_date?: string
      plan_id?: string
      paid_amount?: number
      voided_at?: string
      voided_by?: string
    }
    const updates: UpdatesType = {}

    if (cancel) {
      // Same "cancelled" semantics as the admin Journal's void action
      // (pos_void_subscription): end the membership and mark voided_at so
      // both surfaces show the same "Annulé" state.
      updates.end_date = format(subDays(new Date(), 1), 'yyyy-MM-dd')
      updates.voided_at = new Date().toISOString()
      updates.voided_by = ctx.userId
    } else {
      if (start_date) updates.start_date = start_date
      if (plan_id) updates.plan_id = plan_id

      if (plan_id && plan_id !== current.plan_id) {
        // Formule changed: the price is tied to the plan, so it must be
        // recomputed here too — the create-subscription path already does
        // this, but the edit path previously left the old plan's paid_amount
        // in place after a formule change.
        const { data: newPlan, error: newPlanError } = await supabase
          .from('subscription_plans')
          .select('price_dt, tax_rate_pct')
          .eq('id', plan_id)
          .single()
        if (newPlanError || !newPlan) throw new Error('Formule introuvable')
        updates.paid_amount = Number(
          (newPlan.price_dt * (1 + (newPlan.tax_rate_pct ?? 0) / 100)).toFixed(3),
        )
      }

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

    if (cancel) {
      await reverseSubscriptionLoyaltyPoints(supabase, subscription_id, current.student_id)
    }

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

    await reverseSubscriptionLoyaltyPoints(supabase, subscription_id, sub.student_id)

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
