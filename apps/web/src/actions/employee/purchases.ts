'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createPurchaseSchema } from '@/utils/zod-schemas/purchase'
import type { Json } from '@/lib/database.types'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'
import { notifyAllStaff } from '@/data/notifications/inapp'
import { buildPurchaseMessage } from '@/lib/notification-message-builders'

export const createPurchaseAction = employeeActionClient
  .schema(createPurchaseSchema)
  .action(async ({ parsedInput }) => {
    const { student_id, items, discount_dt } = parsedInput
    const supabase = await createSupabaseClient()

    const { data, error } = await supabase.rpc('pos_checkout', {
      // database.types.ts says p_student_id: string, but DB fn accepts NULL
      // (anonymous purchase). Regenerate types once project is linked.
      p_student_id: (student_id ?? null) as unknown as string,
      p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      p_discount_dt: discount_dt,
    } as unknown as { p_student_id: string; p_items: Json })

    if (error) throw new Error(error.message)

    const result = data as unknown as { purchase_id: string; total_dt: number; points_earned: number }

    try {
      const [{ data: products }, studentName] = await Promise.all([
        supabase.from('products').select('id, name').in('id', items.map((i) => i.product_id)),
        student_id
          ? supabase
              .from('profiles')
              .select('full_name')
              .eq('id', student_id)
              .maybeSingle()
              .then((r) => r.data?.full_name ?? null)
          : Promise.resolve(null),
      ])
      const nameById = new Map((products ?? []).map((p) => [p.id, p.name]))
      const itemsSummary = items
        .map((i) => `${i.quantity}× ${nameById.get(i.product_id) ?? 'Produit'}`)
        .join(', ')

      await notifyAllStaff(
        'purchase_completed',
        buildPurchaseMessage({ studentName, itemsSummary, totalDt: result.total_dt }),
        student_id ? { link: `/employee/students?studentId=${student_id}` } : undefined,
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
