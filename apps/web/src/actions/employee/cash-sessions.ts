'use server'

import { employeeActionClient } from '@/lib/safe-action'
import {
  openCashSessionSchema,
  addCashMovementSchema,
  closeCashSessionSchema,
} from '@/utils/zod-schemas/cash-session'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const openCashSessionAction = employeeActionClient
  .schema(openCashSessionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .rpc('pos_open_session', { p_opening_amount: parsedInput.opening_amount_dt })
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/employee/pos')
    return data
  })

export const addCashMovementAction = employeeActionClient
  .schema(addCashMovementSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .rpc('pos_add_cash_movement', {
        p_session_id: parsedInput.session_id,
        p_type: parsedInput.type,
        p_amount: parsedInput.amount_dt,
        p_reason: parsedInput.reason,
      })
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/employee/pos')
    return data
  })

export const closeCashSessionAction = employeeActionClient
  .schema(closeCashSessionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .rpc('pos_close_session', {
        p_session_id: parsedInput.session_id,
        p_closing_amount: parsedInput.closing_amount_dt,
        p_notes: parsedInput.notes,
      })
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/employee/pos')
    revalidatePath('/admin/pos/sessions')
    return data
  })
