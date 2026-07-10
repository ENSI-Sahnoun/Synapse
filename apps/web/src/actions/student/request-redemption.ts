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

    // Fetch the rule
    const { data: rule, error: ruleError } = await supabase
      .from('loyalty_rules')
      .select('id, name, points_threshold, is_active')
      .eq('id', rule_id)
      .single()

    if (ruleError || !rule) throw new Error('Récompense introuvable')
    if (!rule.is_active) throw new Error("Cette récompense n'est plus disponible")

    // Check for existing pending request for this rule
    const { data: existing } = await supabase
      .from('loyalty_redemption_requests')
      .select('id')
      .eq('student_id', studentId)
      .eq('rule_id', rule_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) throw new Error('Une demande est déjà en attente pour cette récompense')

    // Compute current balance
    const { data: ledger, error: ledgerError } = await supabase
      .from('loyalty_ledger')
      .select('points_delta')
      .eq('student_id', studentId)

    if (ledgerError) throw new Error('Erreur de lecture du solde')
    const balance = (ledger ?? []).reduce((sum, row) => sum + row.points_delta, 0)

    if (balance < rule.points_threshold) {
      throw new Error(
        `Solde insuffisant: ${balance} pts disponibles, ${rule.points_threshold} pts requis`
      )
    }

    // Insert redemption request (does NOT deduct points — employee confirms physically)
    const { data: insertedRequest, error: insertError } = await supabase
      .from('loyalty_redemption_requests')
      .insert({
        student_id: studentId,
        rule_id,
        status: 'pending',
        points_used: rule.points_threshold,
      })
      .select('id')
      .single()

    if (insertError) throw new Error('Erreur lors de la demande. Veuillez réessayer.')

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
          ruleName: rule.name,
          points: rule.points_threshold,
        }),
        { link: `/employee/loyalty-requests?highlight=${insertedRequest.id}` },
      )
    } catch { /* non-fatal */ }

    revalidatePath('/student/loyalty')
    return { ruleName: rule.name, pointsUsed: rule.points_threshold }
  })
