'use server'

import { employeeActionClient } from '@/lib/safe-action'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { clockEmployee } from '@/lib/employee-clock'
import { revalidatePath } from 'next/cache'

// Self-service clock in/out for an employee without their phone — uses their
// logged-in session as identity proof, no QR token needed.
export const employeeSelfClockAction = employeeActionClient.action(async ({ ctx }) => {
  const admin = createSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .single()

  const result = await clockEmployee(admin, ctx.userId, profile?.full_name ?? '', 'manual_web')
  revalidatePath('/employee/shifts')
  return result
})
