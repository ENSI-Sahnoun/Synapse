'use server'

import { adminActionClient } from '@/lib/safe-action'
import { adminUpdateSubscriptionSchema } from '@/utils/zod-schemas/subscription'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { subDays, format } from 'date-fns'
import { revalidatePath } from 'next/cache'

export const adminUpdateSubscriptionAction = adminActionClient
  .schema(adminUpdateSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const { subscription_id, end_date, plan_id, cancel } = parsedInput
    const supabase = createSupabaseAdminClient()

    type UpdatesType = {
      end_date?: string
      plan_id?: string
    }
    const updates: UpdatesType = {}

    if (cancel) {
      updates.end_date = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    } else {
      if (end_date) updates.end_date = end_date
      if (plan_id) updates.plan_id = plan_id
    }

    if (Object.keys(updates).length === 0) return { success: true }

    const { data: sub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('student_id')
      .eq('id', subscription_id)
      .single()
    if (fetchError || !sub) throw new Error('Abonnement introuvable')

    const { error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscription_id)
    if (error) throw new Error(error.message)

    revalidatePath(`/employee/students/${sub.student_id}`)
    return { success: true }
  })
