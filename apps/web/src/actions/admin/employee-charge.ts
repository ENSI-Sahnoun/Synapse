'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createEmployeeChargeSchema } from '@/utils/zod-schemas/purchase'

export const createEmployeeChargeAction = adminActionClient
  .schema(createEmployeeChargeSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const { data, error } = await supabase.rpc('pos_employee_charge', {
      p_items: parsedInput.items,
    })

    if (error) throw new Error(error.message)

    const result = data as unknown as { expense_id: string; total_dt: number }

    revalidatePath('/employee/pos')
    revalidatePath('/admin/accounting')
    return { expenseId: result.expense_id, totalDt: result.total_dt }
  })
