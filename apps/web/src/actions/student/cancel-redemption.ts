'use server'

import { studentActionClient } from '@/lib/safe-action'
import { handleRedemptionRequestSchema } from '@/utils/zod-schemas/loyalty-handle-request'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const cancelRedemptionAction = studentActionClient
  .schema(handleRedemptionRequestSchema)
  .action(async ({ parsedInput }) => {
    const { request_id } = parsedInput
    const supabase = await createSupabaseClient()

    // Atomic in the DB: refunds the points reserved at request time and flips status.
    const { error: rpcError } = await supabase.rpc('cancel_redemption_request', {
      p_request_id: request_id,
    })

    if (rpcError) throw new Error(rpcError.message)

    revalidatePath('/student/loyalty')
    revalidatePath('/student/rewards')
    return { success: true }
  })
