import { getStudentById, getActiveSubscription } from '@/data/employee/students'
import { listActivePlans } from '@/data/employee/subscription-plans'
import { notFound } from 'next/navigation'
import { SellSubscriptionForm } from './sell-subscription-form'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function AdminNewSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [student, plans, activeSubscription] = await Promise.all([
    getStudentById(id).catch(() => null),
    listActivePlans(),
    getActiveSubscription(id),
  ])

  if (!student) notFound()

  const today = format(new Date(), 'yyyy-MM-dd')
  const stackStartDate = activeSubscription
    ? format(addDays(parseISO(activeSubscription.end_date), 1), 'yyyy-MM-dd')
    : today

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/students/${id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {student.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Vendre un abonnement</h1>

      {activeSubscription && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
          <p className="font-medium text-amber-800">Abonnement actif détecté</p>
          <p className="text-amber-700">
            Le nouvel abonnement débutera le {format(parseISO(stackStartDate), 'dd MMMM yyyy', { locale: fr })}
          </p>
        </div>
      )}

      <SellSubscriptionForm studentId={id} plans={plans} stackStartDate={stackStartDate} />
    </div>
  )
}
