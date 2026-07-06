'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSubscriptionSchema } from '@/utils/zod-schemas/subscription'
import { createSupabaseClient } from '@/supabase-clients/server'
import { addDays, format, parseISO } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { insertInAppNotification, notifyAllStaff } from '@/data/notifications/inapp'

export const createSubscriptionAction = employeeActionClient
  .schema(createSubscriptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { student_id, plan_id, start_date: startDateOverride } = parsedInput
    const supabase = await createSupabaseClient()

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('duration_days, price_dt, tax_rate_pct, name, is_active')
      .eq('id', plan_id)
      .single()

    if (planError || !plan) throw new Error('Formule introuvable')
    if (!plan.is_active) throw new Error('Cette formule est désactivée')

    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: activeSubscription } = await supabase
      .from('subscriptions')
      .select('end_date')
      .eq('student_id', student_id)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let startDate: Date
    if (startDateOverride) {
      startDate = parseISO(startDateOverride)
    } else if (activeSubscription) {
      startDate = addDays(parseISO(activeSubscription.end_date), 1)
    } else {
      startDate = new Date()
    }

    const endDate = addDays(startDate, plan.duration_days)

    const paidAmount = Number(
      (plan.price_dt * (1 + (plan.tax_rate_pct ?? 0) / 100)).toFixed(3),
    )

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        student_id,
        plan_id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        paid_amount: paidAmount,
        sold_by: ctx.userId,
      })
      .select()
      .single()

    if (subError) throw new Error(`Erreur création: ${subError.message}`)

    const points = Math.floor(plan.price_dt)
    if (points > 0) {
      await supabase.from('loyalty_ledger').insert({
        student_id,
        points_delta: points,
        reason: 'subscription',
        ref_id: subscription.id,
      })

      try {
        await insertInAppNotification({
          userId: student_id,
          type: 'points_earned',
          message: `Vous avez gagné ${points} point(s) Synapse pour votre abonnement ${plan.name}.`,
        })
      } catch {
        // ignore notification errors
      }
    }

    try {
      await notifyAllStaff(
        'subscription_new',
        `Nouvel abonnement créé : plan "${plan.name}" jusqu'au ${format(endDate, 'dd/MM/yyyy')}.`,
      )
    } catch { /* non-fatal */ }

    revalidatePath(`/employee/students/${student_id}`)
    revalidatePath(`/admin/students/${student_id}`)

    return {
      subscriptionId: subscription.id,
      endDate: format(endDate, 'yyyy-MM-dd'),
      pointsEarned: points,
    }
  })
