import { getProfileById } from '@/data/admin/students'
import { EditStudentForm } from '@/components/students/EditStudentForm'
import { ResetCredentialsForm } from '@/components/admin/ResetCredentialsForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminEditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getProfileById(id).catch(() => null)

  if (!profile || profile.role !== 'student') notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">
        ← Étudiants
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {profile.full_name}</h1>
      <EditStudentForm student={profile} redirectTo="/admin/students" />
      <hr className="my-6" />
      <ResetCredentialsForm userId={id} />
    </div>
  )
}
