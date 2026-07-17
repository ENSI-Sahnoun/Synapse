import { getStudentById, getActiveSubscription } from '@/data/employee/students'
import { listActivePlans } from '@/data/employee/subscription-plans'
import { notFound } from 'next/navigation'
import { SellSubscriptionForm } from './sell-subscription-form'
import { SubscriptionHistory } from './subscription-history'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function NewSubscriptionPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const [student, plans, activeSubscription] = await Promise.all([
    getStudentById(studentId).catch(() => null),
    listActivePlans(),
    getActiveSubscription(studentId),
  ])

  if (!student) notFound()

  const today = format(new Date(), 'yyyy-MM-dd')
  const stackStartDate = activeSubscription
    ? format(addDays(parseISO(activeSubscription.end_date), 1), 'yyyy-MM-dd')
    : today

  return (
    <div className="p-4 space-y-4 pb-24">
      <Link
        href={`/employee/students?studentId=${studentId}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {student.full_name}
      </Link>
      <h1 className="text-2xl font-semibold">Gérer l'abonnement</h1>

      {activeSubscription && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
          <p className="font-medium text-amber-800">Abonnement actif détecté</p>
          <p className="text-amber-700">
            Le nouvel abonnement débutera le {format(parseISO(stackStartDate), 'dd MMMM yyyy', { locale: fr })}
          </p>
        </div>
      )}

      <SellSubscriptionForm
        studentId={studentId}
        plans={plans}
        stackStartDate={stackStartDate}
      />

      <SubscriptionHistory
        plans={plans}
        history={(student.subscriptions ?? [])
          .filter((s) => s.subscription_plans)
          .map((s) => ({
            id: s.id,
            planId: s.plan_id,
            planName: s.subscription_plans!.name,
            startDate: s.start_date,
            endDate: s.end_date,
            paidAmount: s.paid_amount,
          }))}
      />
    </div>
  )
}
