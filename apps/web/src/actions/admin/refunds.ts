'use server'

import { revalidatePath } from 'next/cache'
import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  refundPurchaseSchema,
  refundSubscriptionSchema,
  refundLockerPaymentSchema,
} from '@/utils/zod-schemas/refund'

// Cashiers, not just admins: the person who mis-rings a sale is the person who
// has to reverse it, and the RPCs are SECURITY DEFINER with their own
// role check plus the over-refund ceiling.
type RefundRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: { id: string } | null; error: { message: string } | null }>

function revalidateRefundSurfaces(): void {
  revalidatePath('/admin/accounting')
  revalidatePath('/admin/dashboard')
  revalidatePath('/employee/pos')
}

export const refundPurchaseAction = employeeActionClient
  .schema(refundPurchaseSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    // The RPC raises French messages ('Remboursement supérieur au montant
    // restant'), and `handleServerError` passes `e.message` straight to the
    // client, so rethrowing it verbatim is what the cashier sees.
    const { data, error } = await (supabase.rpc as unknown as RefundRpc)('refund_purchase', {
      p_purchase_id: parsedInput.purchaseId,
      p_amount: parsedInput.amount,
      p_reason: parsedInput.reason,
      p_restock: parsedInput.restock,
    })
    if (error) throw new Error(error.message)

    revalidateRefundSurfaces()
    return { success: true, refundId: data?.id ?? null }
  })

export const refundSubscriptionAction = employeeActionClient
  .schema(refundSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await (supabase.rpc as unknown as RefundRpc)('refund_subscription', {
      p_subscription_id: parsedInput.subscriptionId,
      p_amount: parsedInput.amount,
      p_reason: parsedInput.reason,
      p_end_now: parsedInput.endNow,
    })
    if (error) throw new Error(error.message)

    revalidateRefundSurfaces()
    return { success: true, refundId: data?.id ?? null }
  })

export const refundLockerPaymentAction = employeeActionClient
  .schema(refundLockerPaymentSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await (supabase.rpc as unknown as RefundRpc)('refund_locker_payment', {
      p_locker_payment_id: parsedInput.lockerPaymentId,
      p_amount: parsedInput.amount,
      p_reason: parsedInput.reason,
    })
    if (error) throw new Error(error.message)

    revalidateRefundSurfaces()
    return { success: true, refundId: data?.id ?? null }
  })
