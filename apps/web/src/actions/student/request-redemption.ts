'use server'

import { studentActionClient } from '@/lib/safe-action'
import { requestRedemptionSchema } from '@/utils/zod-schemas/loyalty-redemption'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { notifyAllStaff } from '@/data/notifications/inapp'
import { buildLoyaltyRequestMessage } from '@/lib/notification-message-builders'

export const requestRedemptionAction = studentActionClient
  .schema(requestRedemptionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { rule_id } = parsedInput
    const studentId = ctx.userId
    const supabase = await createSupabaseClient()

    // Atomic in the DB: advisory-locks the student, re-checks balance, inserts the
    // request, and deducts points — all in one transaction. This closes the race
    // where two concurrent requests could each pass a balance check before either
    // was recorded, later both getting approved and pushing the balance negative.
    const { data: result, error: rpcError } = await supabase.rpc('request_redemption', {
      p_rule_id: rule_id,
    })

    if (rpcError) throw new Error(rpcError.message)

    const { id: requestId, rule_name: ruleName, points_used: pointsUsed } = result as {
      id: string
      rule_name: string
      points_used: number
    }

    try {
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', studentId)
        .maybeSingle()

      await notifyAllStaff(
        'loyalty_request_new',
        buildLoyaltyRequestMessage({
          studentName: studentProfile?.full_name ?? 'Un étudiant',
          ruleName,
          points: pointsUsed,
        }),
        { link: `/employee/loyalty-requests?highlight=${requestId}` },
      )
    } catch { /* non-fatal */ }

    revalidatePath('/student/loyalty')
    revalidatePath('/student/rewards')
    return { ruleName, pointsUsed }
  })
