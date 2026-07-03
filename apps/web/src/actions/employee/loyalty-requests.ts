'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { handleRedemptionRequestSchema } from '@/utils/zod-schemas/loyalty-handle-request'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { insertInAppNotification } from '@/data/notifications/inapp'

export const fulfilRedemptionAction = employeeActionClient
  .schema(handleRedemptionRequestSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { request_id } = parsedInput
    const supabase = await createSupabaseClient()

    const { data: request, error: fetchError } = await supabase
      .from('loyalty_redemption_requests')
      .select('id, student_id, points_used, status')
      .eq('id', request_id)
      .single()

    if (fetchError || !request) throw new Error('Demande introuvable')
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée')

    const { error: ledgerError } = await supabase
      .from('loyalty_ledger')
      .insert({
        student_id: request.student_id,
        points_delta: -request.points_used,
        reason: 'redemption',
        ref_id: request_id,
      })

    if (ledgerError) {
      throw new Error('Une erreur est survenue lors de la déduction des points')
    }

    // Known: if this update fails after ledger insert, request stays pending but points are deducted — re-fulfil is blocked by the pending guard above, minimising double-deduction risk
    const { error: updateError } = await supabase
      .from('loyalty_redemption_requests')
      .update({
        status: 'fulfilled',
        handled_by: ctx.userId,
        handled_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    if (updateError) {
      throw new Error('Une erreur est survenue lors de la mise à jour de la demande')
    }

    try {
      await insertInAppNotification({
        userId: request.student_id,
        type: 'loyalty_fulfilled',
        message: `Votre demande de récompense a été approuvée (${request.points_used} pts déduits).`,
      })
    } catch { /* non-fatal */ }

    revalidatePath('/employee/loyalty-requests')
    return { success: true, pointsDeducted: request.points_used }
  })

export const rejectRedemptionAction = employeeActionClient
  .schema(handleRedemptionRequestSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { request_id } = parsedInput
    const supabase = await createSupabaseClient()

    const { data: request, error: fetchError } = await supabase
      .from('loyalty_redemption_requests')
      .select('id, student_id, status')
      .eq('id', request_id)
      .single()

    if (fetchError || !request) throw new Error('Demande introuvable')
    if (request.status !== 'pending') throw new Error('Cette demande a déjà été traitée')

    const { error: updateError } = await supabase
      .from('loyalty_redemption_requests')
      .update({
        status: 'rejected',
        handled_by: ctx.userId,
        handled_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    if (updateError) throw new Error('Une erreur est survenue lors du rejet de la demande')

    try {
      await insertInAppNotification({
        userId: request.student_id,
        type: 'loyalty_rejected',
        message: `Votre demande de récompense a été refusée.`,
      })
    } catch { /* non-fatal */ }

    revalidatePath('/employee/loyalty-requests')
    return { success: true }
  })
