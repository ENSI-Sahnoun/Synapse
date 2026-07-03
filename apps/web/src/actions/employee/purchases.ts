'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createPurchaseSchema } from '@/utils/zod-schemas/purchase'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { notifyAllStaff } from '@/data/notifications/inapp'

export const createPurchaseAction = employeeActionClient
  .schema(createPurchaseSchema)
  .action(async ({ parsedInput }) => {
    const { student_id, items } = parsedInput
    const supabase = await createSupabaseClient()

    const { data, error } = await supabase.rpc('pos_checkout' as any, {
      p_student_id: student_id ?? null,
      p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    })

    if (error) throw new Error(error.message)

    const result = data as unknown as { purchase_id: string; total_dt: number; points_earned: number }

    try {
      await notifyAllStaff(
        'purchase_completed',
        `Vente enregistrée : ${result.total_dt.toFixed(2)} DT${student_id ? ' (étudiant lié)' : ''}.`,
      )
    } catch { /* non-fatal */ }

    revalidatePath('/employee/pos')
    return {
      purchaseId: result.purchase_id,
      total_dt: result.total_dt,
      pointsEarned: result.points_earned,
      studentLinked: !!student_id,
    }
  })
