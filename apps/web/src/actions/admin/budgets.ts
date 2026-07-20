'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { toMonthStart } from '@/data/admin/budgets'
import {
  createBudgetSchema,
  updateBudgetSchema,
  deleteBudgetSchema,
  lockPeriodSchema,
  unlockPeriodSchema,
} from '@/utils/zod-schemas/budget'

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>

// `budgets` and `fiscal_period_locks` are not yet in the hand-maintained
// database.types.ts, so the builder is cast locally.
type WriteBuilder = PromiseLike<{ error: { message: string } | null }> & {
  insert(values: Record<string, unknown>): WriteBuilder
  update(values: Record<string, unknown>): WriteBuilder
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): WriteBuilder
  delete(): WriteBuilder
  eq(column: string, value: unknown): WriteBuilder
}

function untypedTable(supabase: SupabaseServerClient, table: string): WriteBuilder {
  return (supabase.from as unknown as (t: string) => WriteBuilder)(table)
}

function revalidateBudgetSurfaces() {
  revalidatePath('/admin/accounting')
  revalidatePath('/admin/analytics')
  revalidatePath('/admin/dashboard')
}

export const createBudgetAction = adminActionClient
  .schema(createBudgetSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    // Upsert on the (category, month) unique constraint: re-budgeting a
    // category the owner already planned is an edit, not a duplicate-key error
    // they have to decode.
    const { error } = await untypedTable(supabase, 'budgets').upsert(
      {
        account_category_id: parsedInput.account_category_id,
        month: toMonthStart(parsedInput.month),
        amount_dt: parsedInput.amount_dt,
        note: parsedInput.note ?? null,
        created_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_category_id,month' },
    )
    if (error) throw new Error(error.message)

    revalidateBudgetSurfaces()
    return { success: true }
  })

export const updateBudgetAction = adminActionClient
  .schema(updateBudgetSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { id, ...fields } = parsedInput
    const { error } = await untypedTable(supabase, 'budgets')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)

    revalidateBudgetSurfaces()
    return { success: true }
  })

export const deleteBudgetAction = adminActionClient
  .schema(deleteBudgetSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await untypedTable(supabase, 'budgets').delete().eq('id', parsedInput.id)
    if (error) throw new Error(error.message)

    revalidateBudgetSurfaces()
    return { success: true }
  })

export const lockPeriodAction = adminActionClient
  .schema(lockPeriodSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await untypedTable(supabase, 'fiscal_period_locks').insert({
      month: toMonthStart(parsedInput.month),
      locked_by: ctx.userId,
      note: parsedInput.note ?? null,
    })
    if (error) throw new Error(error.message)

    // Locking changes what every financial surface will accept, so the whole
    // admin area is revalidated rather than just the page that closed it.
    revalidateBudgetSurfaces()
    revalidatePath('/admin/settings')
    return { success: true }
  })

export const unlockPeriodAction = adminActionClient
  .schema(unlockPeriodSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await untypedTable(supabase, 'fiscal_period_locks')
      .delete()
      .eq('month', toMonthStart(parsedInput.month))
    if (error) throw new Error(error.message)

    revalidateBudgetSurfaces()
    revalidatePath('/admin/settings')
    return { success: true }
  })
