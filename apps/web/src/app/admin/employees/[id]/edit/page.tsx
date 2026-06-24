import { getProfileById } from '@/data/admin/students'
import { EditEmployeeForm } from '@/components/admin/EditEmployeeForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminEditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getProfileById(id).catch(() => null)

  if (!profile || profile.role !== 'employee') notFound()

  return (
    <div className="space-y-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">
        ← Employés
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {profile.full_name}</h1>
      <EditEmployeeForm employee={profile} redirectTo="/admin/employees" />
    </div>
  )
}
