'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { handleRedemptionRequestSchema } from '@/utils/zod-schemas/loyalty-handle-request'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { insertInAppNotification } from '@/data/notifications/inapp'

export const fulfilRedemptionAction = employeeActionClient
  .schema(handleRedemptionRequestSchema)
  .action(async ({ parsedInput }) => {
    const { request_id } = parsedInput
    const supabase = await createSupabaseClient()

    // Atomic in the DB: deduct points, book the reward expense, flip status.
    // SECURITY DEFINER RPC — employees can't insert into expenses directly (RLS).
    const { data: request, error: fetchError } = await supabase
      .from('loyalty_redemption_requests')
      .select('student_id')
      .eq('id', request_id)
      .single()

    if (fetchError || !request) throw new Error('Demande introuvable')

    const { data: result, error: rpcError } = await supabase.rpc('fulfil_redemption', {
      p_request_id: request_id,
    })

    if (rpcError) throw new Error(rpcError.message)

    const pointsDeducted = Number((result as { points_used?: number } | null)?.points_used ?? 0)

    try {
      await insertInAppNotification({
        userId: request.student_id,
        type: 'loyalty_fulfilled',
        message: `Votre demande de récompense a été approuvée (${pointsDeducted} pts déduits).`,
      })
    } catch { /* non-fatal */ }

    revalidatePath('/employee/loyalty-requests')
    return { success: true, pointsDeducted }
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
