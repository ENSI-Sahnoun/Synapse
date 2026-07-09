import { createSupabaseClient } from '@/supabase-clients/server'
import { redirect } from 'next/navigation'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { startOfDay } from 'date-fns'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { CheckinClient } from '@/app/employee/checkin/CheckinClient'

export const metadata = { title: "Contrôle d'accès — Synapse" }

export default async function AdminCheckinPage() {
  const supabase = await createSupabaseClient()
  if (!(await getCachedLoggedInUserIdOrNull())) redirect('/login')

  const todayISO = startOfDay(new Date()).toISOString()

  const [{ count: currentlyIn }, { count: todayTotal }] = await Promise.all([
    supabase.from('attendance').select('*', { count: 'exact', head: true }).is('checked_out_at', null).gte('checked_in_at', todayISO),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).gte('checked_in_at', todayISO),
  ])

  const total = todayTotal ?? 0
  const inCount = currentlyIn ?? 0
  const checkedOut = total - inCount

  return (
    <div>
      <LiveRefresher tables={['attendance']} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Contrôle d&apos;accès</h1>
        <p className="text-sm text-muted-foreground mt-1">
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
