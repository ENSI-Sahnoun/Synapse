import { getStudentById } from '@/data/employee/students'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  let student
  try {
    student = await getStudentById(studentId)
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError?.code === 'PGRST116') {
      notFound()
    }
    throw error
  }

  const today = new Date().toISOString().split('T')[0]
  const activeSubscription = student.subscriptions?.find((s) => s.end_date >= today)

  return (
    <div className="p-4 space-y-6 pb-24">
      <div>
        <Link href="/employee/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{student.full_name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Téléphone:</span> {student.phone ?? '—'}</div>
        <div><span className="text-muted-foreground">Université:</span> {student.university ?? '—'}</div>
        <div><span className="text-muted-foreground">Niveau:</span> {student.study_level ?? '—'}</div>
        <div><span className="text-muted-foreground">Inscrit le:</span> {new Date(student.created_at).toLocaleDateString('fr-FR')}</div>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Abonnement actif</h2>
          <Button asChild size="sm">
            <Link href={`/employee/students/${studentId}/subscriptions/new`}>
              Vendre abonnement
            </Link>
          </Button>
        </div>
        {activeSubscription ? (
          <div className="text-sm space-y-1">
            <p className="font-medium">{(activeSubscription.subscription_plans as { name: string })?.name}</p>
            <p className="text-muted-foreground">
              Valide jusqu'au {new Date(activeSubscription.end_date).toLocaleDateString('fr-FR')}
            </p>
          </div>
        ) : (
          <p className="text-sm text-destructive">Aucun abonnement actif</p>
        )}
      </div>

      {student.subscriptions && student.subscriptions.length > 0 && (
        <div>
          <h2 className="font-medium mb-2">Historique</h2>
          <div className="border rounded-md divide-y text-sm">
            {student.subscriptions.map((s) => (
              <div key={s.id} className="px-4 py-2 flex justify-between">
                <span>{(s.subscription_plans as { name: string })?.name}</span>
                <span className="text-muted-foreground">
                  {new Date(s.start_date).toLocaleDateString('fr-FR')} → {new Date(s.end_date).toLocaleDateString('fr-FR')}
                </span>
                <span>{s.paid_amount} DT</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
