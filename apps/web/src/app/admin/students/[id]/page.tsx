import { getStudentWithSubscription } from '@/data/admin/students'
import { SubscriptionEditor } from '@/components/admin/SubscriptionEditor'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getStudentWithSubscription(id).catch(() => null)
  if (!result) notFound()

  const { profile, subscription, plans } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">
          ← Étudiants
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {profile.phone ?? '—'} · {profile.university ?? '—'} · {profile.study_level ?? '—'}
          </p>
        </div>
        <Link
          href={`/admin/students/${id}/edit`}
          className="text-sm underline text-muted-foreground"
        >
          Modifier le profil
        </Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Abonnement actif</h2>
        <SubscriptionEditor
          subscription={subscription as Parameters<typeof SubscriptionEditor>[0]['subscription']}
          plans={plans}
          studentId={id}
        />
      </div>
    </div>
  )
}
