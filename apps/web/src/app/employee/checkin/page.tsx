import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { startOfDay } from 'date-fns'
import { CheckinClient } from './CheckinClient'

export const metadata = {
  title: "Contrôle d'accès — Synapse",
}

export const dynamic = 'force-dynamic'

export default async function EmployeeCheckinPage() {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = startOfDay(new Date()).toISOString()

  const [{ count: currentlyIn }, { data: todayRows }] = await Promise.all([
    supabase.from('attendance').select('*', { count: 'exact', head: true }).is('checked_out_at', null).gte('checked_in_at', todayISO),
    supabase.from('attendance').select('student_id').gte('checked_in_at', todayISO),
  ])

  // Count distinct students, not attendance rows — a student who leaves and
  // comes back today is still only one "visit" for the day.
  const total = new Set((todayRows ?? []).map((r) => r.student_id).filter(Boolean)).size
  const inCount = currentlyIn ?? 0
  const checkedOut = total - inCount

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Contrôle d&apos;accès
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Scannez le QR code d&apos;un étudiant pour valider son entrée.
        </p>
      </div>

      <CheckinClient
        todayTotal={total}
        currentlyIn={inCount}
        checkedOut={checkedOut}
      />
    </div>
  )
}
