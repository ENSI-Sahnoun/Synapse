import { getStudentWithSubscription } from '@/data/admin/students'
import { SubscriptionEditor } from '@/components/admin/SubscriptionEditor'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getStudentWithSubscription(id).catch(() => null)
  if (!result) notFound()

  const { profile, subscription, plans, history } = result

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
        <div className="flex items-start justify-between mt-1">
          <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/students/${id}/print-qr`}>Imprimer QR</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/students/${id}/edit`}>Modifier le profil</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm border rounded-md p-4 bg-muted/30">
        <div><span className="text-muted-foreground">Téléphone : </span>{profile.phone ?? '—'}</div>
        <div><span className="text-muted-foreground">Université : </span>{profile.university ?? '—'}</div>
        <div><span className="text-muted-foreground">Niveau : </span>{profile.study_level ?? '—'}</div>
        <div><span className="text-muted-foreground">Inscrit le : </span>{new Date(profile.created_at).toLocaleDateString('fr-FR')}</div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Abonnement actif</h2>
          <Button asChild size="sm">
            <Link href={`/admin/students/${id}/subscriptions/new`}>Vendre abonnement</Link>
          </Button>
        </div>
        <SubscriptionEditor
          subscription={subscription as Parameters<typeof SubscriptionEditor>[0]['subscription']}
          plans={plans}
          studentId={id}
        />
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-2">Historique</h2>
          <div className="border rounded-md divide-y text-sm">
            {history.map((s) => (
              <div key={s.id} className="px-4 py-2 flex justify-between items-center">
                <span className="font-medium">{(s.subscription_plans as { name: string } | null)?.name ?? '—'}</span>
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
