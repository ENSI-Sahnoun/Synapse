import { getLockersWithStatus, getEligibleStudentsForLocker } from '@/data/employee/lockers'
import { LockersGrid } from './LockersGrid'

export const dynamic = 'force-dynamic'

export default async function LockersPage() {
  const [lockers, eligibleStudents] = await Promise.all([
    getLockersWithStatus(),
    getEligibleStudentsForLocker(),
  ])

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Casiers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Attribuez un casier aux étudiants ayant un abonnement d&apos;un mois ou plus. Un casier se libère
          automatiquement à l&apos;expiration de l&apos;abonnement de l&apos;étudiant.
        </p>
      </div>

      <LockersGrid initialLockers={lockers} eligibleStudents={eligibleStudents} />
    </div>
  )
}
