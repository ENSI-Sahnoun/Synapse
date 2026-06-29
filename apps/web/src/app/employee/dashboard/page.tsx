import { getEmployeeDashboardData } from '@/data/employee/dashboard'
import { EmployeeKpiCards } from '@/components/employee/dashboard/kpi-cards'
import { QuickLinks } from '@/components/employee/dashboard/quick-links'
import { createSupabaseClient as createSupabaseServerClient } from '@/supabase-clients/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EmployeeDashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  const data = await getEmployeeDashboardData()

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {profile?.full_name ?? 'Employé'} 👋
        </h1>
        <p className="text-muted-foreground">
          {now.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aujourd'hui
        </h2>
        <EmployeeKpiCards data={data} />
      </section>

      <section>
        <QuickLinks />
      </section>
    </div>
  )
}
