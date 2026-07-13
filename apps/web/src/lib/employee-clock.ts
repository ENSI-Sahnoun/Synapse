import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CheckinResult } from '@/utils/zod-schemas/checkin'

/**
 * Toggles an employee's open clock-in: closes it if one is open, otherwise
 * opens a new one. Shared by the kiosk QR scan and the employee's own
 * "manual clock-in" button so both paths behave identically.
 */
export async function clockEmployee(
  admin: SupabaseClient,
  employeeId: string,
  employeeName: string,
  entryMethod: 'qr_scan' | 'manual_web' = 'qr_scan'
): Promise<CheckinResult> {
  const { data: open } = await admin
    .from('employee_attendance')
    .select('id, clock_in')
    .eq('employee_id', employeeId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (open) {
    await admin
      .from('employee_attendance')
      .update({ clock_out: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', open.id)

    return { status: 'EMPLOYEE_CLOCKED_OUT', employeeName, clockedInAt: open.clock_in }
  }

  await admin.from('employee_attendance').insert({
    employee_id: employeeId,
    entry_method: entryMethod,
  })

  return { status: 'EMPLOYEE_CLOCKED_IN', employeeName }
}
