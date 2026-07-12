import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import {
  getLockersWithStatus,
  getEligibleStudentsForLocker,
  getLockerMinDurationDays,
  getLockerFeeDt,
  getLockerReminderDelayDaysForAdmin,
} from '@/data/employee/lockers'
import { LockersGrid } from './LockersGrid'
import { LockerAdminSettings } from './LockerAdminSettings'

export const dynamic = 'force-dynamic'

export default async function LockersPage() {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  const role = profile?.role ?? 'employee'

  const [lockers, eligibleStudents, minDurationDays, feeDt, reminderDelayDays] = await Promise.all([
    getLockersWithStatus(),
    getEligibleStudentsForLocker(),
    getLockerMinDurationDays(),
    getLockerFeeDt(),
    getLockerReminderDelayDaysForAdmin(),
  ])

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Casiers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Attribuez un casier aux étudiants ayant un abonnement de {minDurationDays} jours ou plus
          {feeDt > 0 ? ` (${feeDt} DT)` : ''}. Un casier se libère automatiquement à l&apos;expiration de
          l&apos;abonnement de l&apos;étudiant.
        </p>
      </div>

      {role === 'admin' && (
        <LockerAdminSettings
          initialDays={minDurationDays}
          initialFeeDt={feeDt}
          initialReminderDelayDays={reminderDelayDays}
        />
      )}

      <LockersGrid initialLockers={lockers} eligibleStudents={eligibleStudents} />
    </div>
  )
}
