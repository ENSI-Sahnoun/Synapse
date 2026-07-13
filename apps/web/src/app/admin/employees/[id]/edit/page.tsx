import { getProfileById } from '@/data/admin/students'
import { EditEmployeeForm } from '@/components/admin/EditEmployeeForm'
import { ResetCredentialsForm } from '@/components/admin/ResetCredentialsForm'
import { WeeklyScheduleForm } from '@/components/admin/WeeklyScheduleForm'
import { createSupabaseClient } from '@/supabase-clients/server'
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

  const supabase = await createSupabaseClient()
  const { data: scheduleRows } = await supabase
    .from('weekly_schedules')
    .select('day_of_week, start_time, end_time, role')
    .eq('employee_id', id)

  return (
    <div className="space-y-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">
        ← Employés
      </Link>
      <h1 className="text-2xl font-semibold">Modifier — {profile.full_name}</h1>
      <Link href={`/admin/employees/${id}/attendance`} className="text-sm underline">
        Voir le pointage →
      </Link>
      <EditEmployeeForm employee={profile} redirectTo="/admin/employees" />
      <hr className="my-6" />
      <ResetCredentialsForm userId={id} />
      <hr className="my-6" />
      <h2 className="text-lg font-semibold">Horaires hebdomadaires</h2>
      <WeeklyScheduleForm
        employeeId={id}
        existing={scheduleRows ?? []}
        existingRole={scheduleRows?.[0]?.role ?? 'Front Desk'}
      />
    </div>
  )
}
