'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  createRecurringExpenseSchema,
  updateRecurringExpenseSchema,
  deleteRecurringExpenseSchema,
  materialiseRecurringExpensesSchema,
} from '@/utils/zod-schemas/recurring-expense'

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>

// `recurring_expenses` is not yet in the hand-maintained database.types.ts, so
// the builder is cast locally.
type WriteBuilder = PromiseLike<{ error: { message: string } | null }> & {
  insert(values: Record<string, unknown>): WriteBuilder
  update(values: Record<string, unknown>): WriteBuilder
  delete(): WriteBuilder
  eq(column: string, value: unknown): WriteBuilder
}

function untypedTable(supabase: SupabaseServerClient, table: string): WriteBuilder {
  return (supabase.from as unknown as (t: string) => WriteBuilder)(table)
}

function revalidateRecurringSurfaces() {
  revalidatePath('/admin/accounting')
  revalidatePath('/admin/dashboard')
}

export const createRecurringExpenseAction = adminActionClient
  .schema(createRecurringExpenseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await untypedTable(supabase, 'recurring_expenses').insert({
      ...parsedInput,
      ends_on: parsedInput.ends_on ?? null,
      created_by: ctx.userId,
    })
    if (error) throw new Error(error.message)

    revalidateRecurringSurfaces()
    return { success: true }
  })

export const updateRecurringExpenseAction = adminActionClient
  .schema(updateRecurringExpenseSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { id, ...fields } = parsedInput
    const { error } = await untypedTable(supabase, 'recurring_expenses').update(fields).eq('id', id)
    if (error) throw new Error(error.message)

    revalidateRecurringSurfaces()
    return { success: true }
  })

// Deleting the rule leaves the expenses it already posted in place — the FK is
// ON DELETE SET NULL. Past months keep their costs; only future occurrences
// stop. Deactivating (is_active = false) is the reversible alternative.
export const deleteRecurringExpenseAction = adminActionClient
  .schema(deleteRecurringExpenseSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await untypedTable(supabase, 'recurring_expenses')
      .delete()
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)

    revalidateRecurringSurfaces()
    return { success: true }
  })

/**
 * Forces a catch-up run of the daily materialisation cron.
 *
 * Idempotent by way of the ON CONFLICT guard, so the owner can safely hit it
 * whenever "dues ce mois, non encore saisies" shows entries — either the cron
 * is down or a rule was just created with a back-dated `starts_on`.
 */
export const materialiseRecurringExpensesAction = adminActionClient
  .schema(materialiseRecurringExpensesSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: number | string | null; error: { message: string } | null }>
    )('materialise_recurring_expenses', { p_through: parsedInput.through ?? null })
    if (error) throw new Error(error.message)

    revalidateRecurringSurfaces()
    return { success: true, created: Number(data ?? 0) }
  })
