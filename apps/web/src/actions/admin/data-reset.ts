'use server'

import { z } from 'zod'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { verifyExportToken } from '@/lib/exports/export-token'
import { revalidatePath } from 'next/cache'

const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirm: z.string(),
})

function assertConfirm(confirm: string, from: string, to: string) {
  if (confirm !== `${from}_${to}`) {
    throw new Error('Confirmation invalide — la période saisie ne correspond pas.')
  }
}

// Deletes expenses, purchases (cascades purchase_items), and subscriptions in range.
export const resetFinancialsPeriod = adminActionClient
  .schema(periodSchema.extend({ exportToken: z.string() }))
  .action(async ({ parsedInput: { from, to, confirm, exportToken }, ctx }) => {
    assertConfirm(confirm, from, to)
    if (!verifyExportToken(exportToken, 'financials', from, to, ctx.userId)) {
      throw new Error("Export PDF requis pour cette période avant suppression.")
    }

    const supabase = await createSupabaseClient()

    const { error: expensesError } = await supabase
      .from('expenses')
      .delete()
      .gte('date', from)
      .lte('date', to)
    if (expensesError) throw new Error(expensesError.message)

    const { error: purchasesError } = await supabase
      .from('purchases')
      .delete()
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59')
    if (purchasesError) throw new Error(purchasesError.message)

    const { error: subsError } = await supabase
      .from('subscriptions')
      .delete()
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59')
    if (subsError) throw new Error(subsError.message)

    revalidatePath('/admin/settings')
    return { success: true }
  })

// Deletes attendance and reservations in range.
export const resetAttendancePeriod = adminActionClient
  .schema(periodSchema.extend({ exportToken: z.string() }))
  .action(async ({ parsedInput: { from, to, confirm, exportToken }, ctx }) => {
    assertConfirm(confirm, from, to)
    if (!verifyExportToken(exportToken, 'attendance', from, to, ctx.userId)) {
      throw new Error("Export PDF requis pour cette période avant suppression.")
    }

    const supabase = await createSupabaseClient()

    // Free seats still held by rows about to be deleted — otherwise the seat
    // is left status='occupied' with no attendance row left to back it.
    const { data: openRows } = await supabase
      .from('attendance')
      .select('seat_id')
      .gte('checked_in_at', from + 'T00:00:00')
      .lte('checked_in_at', to + 'T23:59:59')
      .is('checked_out_at', null)
      .not('seat_id', 'is', null)

    const seatIds = [...new Set((openRows ?? []).map((r) => r.seat_id).filter(Boolean))] as string[]
    if (seatIds.length > 0) {
      const { error: freeSeatsError } = await supabase
        .from('seats')
        .update({ status: 'free' })
        .in('id', seatIds)
      if (freeSeatsError) throw new Error(freeSeatsError.message)
    }

    const { error: attendanceError } = await supabase
      .from('attendance')
      .delete()
      .gte('checked_in_at', from + 'T00:00:00')
      .lte('checked_in_at', to + 'T23:59:59')
    if (attendanceError) throw new Error(attendanceError.message)

    const { error: reservationsError } = await supabase
      .from('reservations')
      .delete()
      .gte('reserved_at', from + 'T00:00:00')
      .lte('reserved_at', to + 'T23:59:59')
    if (reservationsError) throw new Error(reservationsError.message)

    revalidatePath('/admin/settings')
    return { success: true }
  })

// Deletes notifications in range. No export gate — notifications have no PDF export.
export const resetNotificationsPeriod = adminActionClient
  .schema(periodSchema)
  .action(async ({ parsedInput: { from, to, confirm } }) => {
    assertConfirm(confirm, from, to)

    const supabase = await createSupabaseClient()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59')
    if (error) throw new Error(error.message)

    revalidatePath('/admin/settings')
    return { success: true }
  })
